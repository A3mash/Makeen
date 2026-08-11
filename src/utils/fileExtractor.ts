import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export async function extractTextFromFile(file: File): Promise<string> {
  if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += pageText + '\n';
      }
      
      if (!fullText.trim()) {
        throw new Error("لم يتم العثور على أي نص داخل ملف الـ PDF. قد يكون عبارة عن صور ممسوحة ضوئياً.");
      }
      
      return fullText;
    } catch (error: any) {
      console.error("PDF Extraction Error:", error);
      throw new Error(`فشل استخراج النص من الـ PDF: ${error.message || error}`);
    }
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      const result = event.target?.result;
      if (typeof result === 'string') {
        resolve(result);
      } else {
        resolve("محتوى غير مدعوم أو فارغ.");
      }
    };
    
    reader.onerror = (error) => {
      console.error("File reading error:", error);
      reject(new Error("حدث خطأ أثناء قراءة الملف."));
    };

    if (file.type === 'text/plain' || file.name.match(/\.(txt|md|csv|json)$/i)) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  });
}
