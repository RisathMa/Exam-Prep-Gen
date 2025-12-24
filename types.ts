
export enum AcademicLevel {
  GRADE_1 = 'Grade 1',
  GRADE_2 = 'Grade 2',
  GRADE_3 = 'Grade 3',
  GRADE_4 = 'Grade 4',
  GRADE_5 = 'Grade 5',
  GRADE_6 = 'Grade 6',
  GRADE_7 = 'Grade 7',
  GRADE_8 = 'Grade 8',
  GRADE_9 = 'Grade 9',
  GRADE_10 = 'Grade 10',
  OL = 'GCE O/L',
  AL = 'GCE A/L'
}

export enum Language {
  ENGLISH = 'English',
  SINHALA = 'Sinhala'
}

export interface Question {
  question_id: number;
  stem: string;
  options: string[];
  correct_answer_index: number;
  explanation: string;
  cognitive_level: string;
  source_reference?: string;
  image_description?: string; // Prompt for the image generator
  image_url?: string;         // Generated image data URL
}

export interface QuizMetadata {
  title: string;
  subject: string;
  language: Language;
  academic_level: AcademicLevel;
}

export interface Quiz {
  quiz_metadata: QuizMetadata;
  questions: Question[];
}

export interface UploadedFile {
  file: File;
  preview: string;
  type: 'image' | 'pdf' | 'video';
  base64?: string;
}
