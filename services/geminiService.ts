
import { GoogleGenAI, Type } from "@google/genai";
import type { WordTiming } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

export const generateWordTimings = async (
  audioBase64: string,
  mimeType: string,
  transcript: string
): Promise<WordTiming[]> => {
  try {
    const prompt = `You are an expert in audio-to-text alignment. 
    Your task is to provide precise start and end timestamps for each word in the provided transcript, based on the provided audio file.
    Output the result as a valid JSON array where each element is an object with 'word', 'start', and 'end' keys. The timestamps must be in seconds.
    Ensure the 'word' values in your JSON output exactly match the words from the transcript. Do not add, remove, or alter any words.

    Transcript:
    ---
    ${transcript}
    ---
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{
        parts: [
          { inlineData: { mimeType, data: audioBase64 } },
          { text: prompt },
        ],
      }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              word: {
                type: Type.STRING,
                description: 'A single word from the transcript.',
              },
              start: {
                type: Type.NUMBER,
                description: 'The start time of the word in seconds.',
              },
              end: {
                type: Type.NUMBER,
                description: 'The end time of the word in seconds.',
              },
            },
            required: ['word', 'start', 'end'],
          },
        },
      },
    });

    const jsonString = response.text.trim();
    const timings = JSON.parse(jsonString);

    if (!Array.isArray(timings)) {
        throw new Error("API did not return a valid array for timings.");
    }
    
    // Basic validation
    if (timings.length > 0 && (!timings[0].hasOwnProperty('word') || !timings[0].hasOwnProperty('start') || !timings[0].hasOwnProperty('end'))) {
        throw new Error("API response is missing required fields in timing objects.");
    }

    return timings as WordTiming[];

  } catch (error) {
    console.error("Error calling Gemini API for word timings:", error);
    throw new Error("Failed to generate word timings from Gemini API.");
  }
};
