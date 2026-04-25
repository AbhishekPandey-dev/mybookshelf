import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Lang } from "@/types";

export interface AIReturn {
  isLoading: boolean;
  isExplaining: boolean;
  askQuestion: (question: string, lang: Lang) => Promise<string | null>;
  explainPage: (pageNumber: number, lang: Lang) => Promise<string | null>;
}

export function useAI(resourceId: string): AIReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [isExplaining, setIsExplaining] = useState(false);

  const callEdge = async (
    mode: "ask" | "explain",
    lang: Lang,
    question?: string,
    pageNumber?: number
  ): Promise<string | null> => {
    try {
      const { data, error } = await supabase.functions.invoke("pdf-ai", {
        body: { mode, question, resourceId, pageNumber, language: lang },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error as string);
      return data.answer as string;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to get answer";
      toast.error(message);
      return null;
    }
  };

  const askQuestion = async (
    question: string,
    lang: Lang
  ): Promise<string | null> => {
    setIsLoading(true);
    try {
      return await callEdge("ask", lang, question);
    } finally {
      setIsLoading(false);
    }
  };

  const explainPage = async (
    pageNumber: number,
    lang: Lang
  ): Promise<string | null> => {
    setIsExplaining(true);
    try {
      return await callEdge("explain", lang, undefined, pageNumber);
    } finally {
      setIsExplaining(false);
    }
  };

  return { isLoading, isExplaining, askQuestion, explainPage };
}
