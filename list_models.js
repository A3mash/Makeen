import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = "your_api_key_here";
const genAI = new GoogleGenerativeAI(apiKey);

async function listModels() {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();
    console.log(data);
  } catch (e) {
    console.error(e);
  }
}

listModels();
