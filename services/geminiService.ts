
import { GoogleGenAI } from "@google/genai";
import { SYSTEM_INSTRUCTION, QUIZ_RESPONSE_SCHEMA } from "../constants";
import { AcademicLevel, Language, Quiz } from "../types";

const API_KEY = process.env.API_KEY || "";

export const generateQuiz = async (
  input: { 
    data: string; 
    mimeType: string; 
    type: 'image' | 'pdf' | 'video' 
  },
  config: {
    level: AcademicLevel;
    language: Language;
    topics?: string;
  }
): Promise<Quiz> => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  
  const modelName = 'gemini-3-flash-preview';
  
  const prompt = `Analyze the attached ${input.type} and generate a practice examination for ${config.level} in ${config.language}.
${config.topics ? `Focus specifically on: ${config.topics}` : ''}

Rules for images:
- Only provide an 'image_description' if the question setup requires a diagram (like a blank geometry shape or an unlabeled map).
- DO NOT provide an image if the question is purely text-based.
- THE IMAGE DESCRIPTION MUST NOT CONTAIN ANY HINTS, ANSWERS, OR EXPLANATIONS. 
- It should only describe the physical setup of the problem.`;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: [
        {
          parts: [
            {
              inlineData: {
                data: input.data.split(',')[1] || input.data,
                mimeType: input.mimeType,
              }
            },
            { text: prompt }
          ]
        }
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: QUIZ_RESPONSE_SCHEMA,
        temperature: 0.5,
      },
    });

    if (!response.text) {
      throw new Error("No response text received from Gemini.");
    }

    return JSON.parse(response.text) as Quiz;
  } catch (error) {
    console.error("Error generating quiz:", error);
    throw error;
  }
};

export const generateQuestionImage = async (prompt: string): Promise<string | null> => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: `A clean, professional educational diagram or illustration for a school test paper: ${prompt}. 
        IMPORTANT: 
        1. DO NOT include any answers or solutions in the image.
        2. DO NOT include labels that explain the concept.
        3. Only show the problem setup.
        4. Style: Simple black and white line art or clear professional diagram on a white background. No text unless it is a coordinate label like 'A', 'B', 'x', 'y'.` }]
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1"
        }
      }
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Error generating image:", error);
    return null;
  }
};
