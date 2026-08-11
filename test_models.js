import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = "your_api_key_here";
const genAI = new GoogleGenerativeAI(apiKey);

async function testModel(modelName) {
  try {
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent("مرحبا");
    console.log(`Model ${modelName} worked! Response:`, result.response.text());
    return true;
  } catch (e) {
    console.error(`Model ${modelName} failed:`, e.message);
    return false;
  }
}

async function runTests() {
  const models = [
    "gemini-flash-latest",
    "gemini-3.5-flash",
    "gemini-3.6-flash",
    "gemini-pro-latest",
    "gemini-3.1-pro-preview"
  ];
  for (const m of models) {
    await testModel(m);
  }
}

runTests();
