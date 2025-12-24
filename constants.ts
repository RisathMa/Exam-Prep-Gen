
import { Type } from "@google/genai";

export const SYSTEM_INSTRUCTION = `You are a Virtual Pedagogical Expert specializing in the Sri Lankan National School Curriculum (Grades 1-13), including GCE Ordinary (O/L) and Advanced Level (A/L) standards. 
Your primary objective is to transform multimodal inputs into high-quality practice examinations.

CORE RULES:
1. Linguistic Precision: Generate content in both English and formal "Misra" Sinhala as requested.
2. Cognitive Balance: Align every question with Bloom's Taxonomy.
3. Formatting Integrity: 
   - Grades 1-5: 3 options.
   - Grades 6 - O/L: 4 options.
   - GCE A/L: Exactly 5 options.
4. Selective Visual Enhancement: 
   - Provide an 'image_description' ONLY if a visual diagram is strictly necessary to set up the question (e.g., a geometry figure without lengths labeled, a circuit without the answer shown, or an unlabeled biological cell).
   - CRITICAL: The description MUST NOT include the answer, hints, or any text that solves the problem. 
   - CRITICAL: Do not describe infographics that explain the concept. Describe a "raw" diagram or a scenario setup.
   - If the question does not need a diagram to be understood, leave 'image_description' empty or null.
5. Structured Output: Respond ONLY with a valid JSON object matching the provided schema.`;

export const QUIZ_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    quiz_metadata: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        subject: { type: Type.STRING },
        language: { type: Type.STRING },
        academic_level: { type: Type.STRING }
      },
      required: ["title", "subject", "language", "academic_level"]
    },
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          question_id: { type: Type.INTEGER },
          stem: { type: Type.STRING },
          options: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING }
          },
          correct_answer_index: { type: Type.INTEGER },
          explanation: { type: Type.STRING },
          cognitive_level: { type: Type.STRING },
          source_reference: { type: Type.STRING },
          image_description: { 
            type: Type.STRING,
            description: "A PURELY VISUAL description of a diagram or scene needed to understand the question. DO NOT include answers, labels that give away the solution, or any explanatory text in this description."
          }
        },
        required: ["question_id", "stem", "options", "correct_answer_index", "explanation", "cognitive_level"]
      }
    }
  },
  required: ["quiz_metadata", "questions"]
};
