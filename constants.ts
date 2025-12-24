
import { Type } from "@google/genai";

export const SYSTEM_INSTRUCTION = `You are a Virtual Pedagogical Expert specializing in the Sri Lankan National School Curriculum (Grades 1-13).

CORE RULES:
1. Linguistic Precision: Generate content EXCLUSIVELY in the requested target language. 
   - If Sinhala is requested, use ONLY formal "Misra" Sinhala. No mixed English.
2. Cognitive Balance: Align every question with Bloom's Taxonomy.
3. MATHEMATICAL NOTATION (CRITICAL):
   - Use standard LaTeX for all math. 
   - ALWAYS use double backslashes in your internal logic to ensure they appear as single backslashes in the JSON string.
   - Fraction: $\\frac{numerator}{denominator}$ (NOT rac or \frac without backslash).
   - Square Root: $\\sqrt{value}$ (NOT ext or √ without delimiters).
   - Multiplication: $\\times$.
   - Delimiters: Math MUST be enclosed in $...$.
   - CORRECT: "Calculate $\\frac{5}{\\sqrt{3}}$"
   - INCORRECT: "Calculate rac{5}{ext{√}3}" or "Calculate 5/√3"
4. Formatting Integrity: 
   - Grades 1-5: 3 options.
   - Grades 6 - O/L: 4 options.
   - GCE A/L: Exactly 5 options.
5. Selective Visual Enhancement: 
   - Provide an 'image_description' ONLY if a diagram is strictly necessary.
6. Structured Output: Respond ONLY with a valid JSON object.`;

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
            description: "A visual diagram setup. DO NOT include answers."
          }
        },
        required: ["question_id", "stem", "options", "correct_answer_index", "explanation", "cognitive_level"]
      }
    }
  },
  required: ["quiz_metadata", "questions"]
};
