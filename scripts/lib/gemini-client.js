const { GoogleGenAI } = require('@google/genai');

const apiKey = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

function fail(message) {
  console.error(message);
  process.exit(1);
}

function extractJson(text, stage) {
  const trimmed = String(text || '').trim();
  if (!trimmed) {
    fail(`[${stage}] Gemini returned an empty response.`);
  }

  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1].trim() : trimmed;

  try {
    return JSON.parse(candidate);
  } catch (_) {
    const firstObject = candidate.indexOf('{');
    const lastObject = candidate.lastIndexOf('}');
    const firstArray = candidate.indexOf('[');
    const lastArray = candidate.lastIndexOf(']');

    const objectJson = firstObject !== -1 && lastObject > firstObject
      ? candidate.slice(firstObject, lastObject + 1)
      : '';
    const arrayJson = firstArray !== -1 && lastArray > firstArray
      ? candidate.slice(firstArray, lastArray + 1)
      : '';

    for (const value of [objectJson, arrayJson]) {
      if (!value) continue;
      try {
        return JSON.parse(value);
      } catch (_) {
        // Try the next extraction shape.
      }
    }
  }

  fail(`[${stage}] Gemini output was not valid JSON.`);
}

function schemaConfig(responseSchema) {
  return {
    responseMimeType: 'application/json',
    responseSchema,
    temperature: 0.35
  };
}

async function callGeminiJson(stage, systemInstruction, prompt, responseSchema) {
  if (!apiKey) {
    fail('Missing GEMINI_API_KEY. Add it in GitHub repository Settings > Secrets and variables > Actions.');
  }

  const ai = new GoogleGenAI({ apiKey });
  let response;
  try {
    response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        systemInstruction,
        ...schemaConfig(responseSchema)
      }
    });
  } catch (error) {
    fail(`[${stage}] Gemini API failed: ${error.message}`);
  }

  const text = typeof response.text === 'function' ? response.text() : response.text;
  return extractJson(text, stage);
}

module.exports = {
  callGeminiJson,
  extractJson
};
