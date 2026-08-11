import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Question } from './db';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

if (!apiKey || apiKey.trim() === '' || apiKey === 'your_api_key_here') {
  throw new Error("لم يتم العثور على مفتاح VITE_GEMINI_API_KEY. يرجى إضافته في ملف .env وإيقاف خادم Vite ثم إعادة تشغيله.");
}

const genAI = new GoogleGenerativeAI(apiKey);

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function executeWithRetry<T>(apiCall: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await apiCall();
    } catch (error: any) {
      const isRateLimit = error.status === 429 || 
                          error.message?.includes('429') || 
                          error.message?.includes('Quota') ||
                          error.message?.includes('exceeded');
                          
      if (isRateLimit && i < maxRetries - 1) {
        const delay = 15000 * (i + 1); // Wait 15s, then 30s...
        console.warn(`Rate limit hit (429). Waiting ${delay/1000}s before retrying (Attempt ${i + 1}/${maxRetries})...`);
        await sleep(delay);
      } else {
        throw error;
      }
    }
  }
  throw new Error("Maximum retries exceeded");
}

// Schema to enforce JSON structure from Gemini
export const questionSchemaDescription = `
[
  {
    "text": "نص السؤال",
    "options": ["خيار 1", "خيار 2", "خيار 3", "خيار 4"],
    "correctAnswer": "الإجابة الصحيحة مطابقة تماماً لأحد الخيارات",
    "rationale": "شرح مبسط ومباشر يوضح لماذا هذه الإجابة هي الصحيحة، لردم الفجوة فوراً إذا أخطأ المستخدم",
    "reference": { "pageNumber": 1 }
  }
]
`;

export async function generateQuizFromText(chunkedText: string, materialId: string): Promise<Question[]> {
  
  const model = genAI.getGenerativeModel({
    model: "gemini-flash-latest",
    generationConfig: {
      temperature: 0.2, // Lower temperature for more factual and precise extraction
    }
  });

  const prompt = `
أنت معلم أكاديمي خبير. مهمتك هي توليد أسئلة اختيار من متعدد (MCQ) باللغة العربية بناءً على النص التالي.
تأكد من الآتي:
1. يجب أن تغطي الأسئلة **جميع الأفكار والمفاهيم والتفاصيل الرئيسية** المذكورة في النص بشكل شامل جداً. لا تترك أي فجوة معرفية أو تهمل أي جزء من النص، قم بصياغة أسئلة تغطي النص من بدايته لنهايته.
2. الأسئلة يجب أن تكون دقيقة، واضحة، ولا تقبل القسمة على إجابتين.
3. توفير 4 خيارات لكل سؤال.
4. الإجابة الصحيحة يجب أن تكون متطابقة حرفياً مع أحد الخيارات الأربعة.
5. يجب أن يكون الرد بصيغة JSON فقط، بدون أي نصوص إضافية أو علامات Markdown مثل \`\`\`json.
الهيكل المطلوب:
${questionSchemaDescription}

النص المرجعي:
${chunkedText}
  `;

  try {
    const result = await executeWithRetry(() => model.generateContent(prompt));
    let responseText = result.response.text();
    
    // Strip markdown JSON blocks if present
    responseText = responseText.replace(/```json\n?|\n?```/g, '').trim();

    // Parse the strict JSON response
    const parsedData = JSON.parse(responseText);
    
    // Map parsed AI output to the IndexedDB Question interface
    return parsedData.map((item: any) => ({
      id: crypto.randomUUID(),
      materialId: materialId,
      text: item.text,
      options: item.options,
      correctAnswer: item.correctAnswer,
      rationale: item.rationale,
      reference: item.reference || undefined,
    }));
  } catch (error: any) {
    console.error("AI Generation or Parsing Error:", error);
    throw new Error(`فشلت عملية توليد الأسئلة: ${error.message || error}`);
  }
}

export interface RemediationResult {
  explanation: string;
  subQuestion: {
    text: string;
    options: string[];
    correctAnswer: string;
  };
}

export const remediationSchemaDescription = `
{
  "explanation": "شرح فوري ومبسط",
  "subQuestion": {
    "text": "سؤال فرعي تشخيصي أبسط",
    "options": ["خيار 1", "خيار 2", "خيار 3", "خيار 4"],
    "correctAnswer": "الإجابة الصحيحة"
  }
}
`;

export async function remediateKnowledgeGap(
  questionText: string, 
  wrongAnswer: string, 
  correctAnswer: string
): Promise<RemediationResult> {

  // Using gemini-flash-latest since older models are deprecated and pro tier has quota issues on free tier
  const model = genAI.getGenerativeModel({
    model: "gemini-flash-latest",
    generationConfig: {
      temperature: 0.3,
    }
  });

  const prompt = `
الطالب اختار إجابة خاطئة لسؤال أكاديمي.
السؤال: ${questionText}
الإجابة الخاطئة التي اختارها: ${wrongAnswer}
الإجابة الصحيحة: ${correctAnswer}

المطلوب:
1. قدم شرحاً فورياً ومبسطاً (بفقرة قصيرة) يوضح لماذا الإجابة صحيحة ولماذا اختياره كان خاطئاً لسد الفجوة المعرفية.
2. قم بتوليد سؤال فرعي تشخيصي أبسط لردم الفجوة فوراً والتحقق من استيعابه.
3. الرد يجب أن يكون بصيغة JSON فقط متوافق مع هذا الهيكل:
${remediationSchemaDescription}
  `;

  try {
    const result = await executeWithRetry(() => model.generateContent(prompt));
    let responseText = result.response.text();
    responseText = responseText.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(responseText) as RemediationResult;
  } catch (error: any) {
    console.error("Remediation Error:", error);
    throw new Error(`حدث خطأ أثناء معالجة الفجوة: ${error.message || error}`);
  }
}

export async function generateMaterialMetadata(textChunk: string): Promise<{title: string, topic: string}> {
  const model = genAI.getGenerativeModel({
    model: "gemini-flash-latest",
    generationConfig: { temperature: 0.3 }
  });

  const prompt = `
أنت مساعد ذكي لتنظيم المواد الدراسية. بناءً على هذا المقتطف من مادة دراسية، اقترح:
1. عنواناً مناسباً ومختصراً للمادة (title).
2. اسم موضوع/مجلد عام لتصنيفها تحته (topic)، مثل "الفيزياء"، "التاريخ"، "البرمجة"، إلخ.
يجب أن يكون الرد بصيغة JSON فقط بهذا الهيكل:
{
  "title": "عنوان مقترح",
  "topic": "الموضوع العام"
}

المقتطف:
${textChunk.substring(0, 1000)}
  `;

  try {
    const result = await executeWithRetry(() => model.generateContent(prompt));
    let responseText = result.response.text();
    responseText = responseText.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(responseText);
  } catch (error: any) {
    console.error("Metadata Generation Error:", error);
    return { title: "مادة دراسية جديدة", topic: "عام" };
  }
}

