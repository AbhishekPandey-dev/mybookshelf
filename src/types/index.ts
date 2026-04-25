export interface Subject {
  id: string;
  name: string;
  icon: string;
  color: string;
  order_index: number;
  created_at: string;
}

export interface Book {
  id: string;
  subject_id: string;
  title: string;
  description: string;
  order_index: number;
  created_at: string;
}

export interface Resource {
  id: string;
  subject_id: string;
  book_id: string | null;
  title: string;
  description: string | null;
  content_type: "full" | "unit" | "part";
  unit_number: string | null;
  order_index: number;
  pdf_url: string;
  pdf_path: string;
  allow_download: boolean;
  cover_emoji: string | null;
  cover_color: string | null;
  grade_level: string | null;
  ai_processed: boolean;
  created_at: string;
}

export interface TeacherSettings {
  id: string;
  site_name: string;
  tagline: string;
  teacher_name?: string;
  teacher_email?: string | null;
  created_at: string;
  updated_at: string;
}

export type Lang = "en" | "hi";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  lang: Lang;
};
