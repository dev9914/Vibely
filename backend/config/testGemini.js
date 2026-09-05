import { GoogleGenAI } from "@google/genai";
import "../src/config/env.js";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("GEMINI_API_KEY is missing");
}

const ai = new GoogleGenAI({ apiKey });

async function test() {
  const response = await ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: "Reply with exactly: Gemini connection works",
  });

  console.log(response.text);
}

test().catch((error) => {
  console.error("Gemini test failed:", {
    status: error?.status,
    message: error?.message,
  });
  process.exitCode = 1;
});