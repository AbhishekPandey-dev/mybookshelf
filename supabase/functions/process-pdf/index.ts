import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple HTML to text converter helper
function extractText(html: string): string {
  return html.replace(/<[^>]*>/g, ' ');
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const payload = await req.json();
    const record = payload.record;

    if (!record || !record.pdf_url) {
      return new Response("Missing record or pdf_url", { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing");

    // We use a lighter approach for PDF parsing in Edge functions to avoid complex 'npm' dependencies that might fail deploy
    const response = await fetch(record.pdf_url);
    if (!response.ok) throw new Error(`Failed to fetch PDF: ${response.statusText}`);
    
    // Note: For production edge functions, consider using a specialized OCR/PDF API 
    // for high reliability. This is a simplified implementation for standard text PDFs.
    const text = await response.text();
    const cleanText = extractText(text).substring(0, 50000); // Limit size

    const words = cleanText.split(/\s+/);
    const chunkSize = 600;
    const overlap = 60;

    let chunkIndex = 0;
    for (let i = 0; i < words.length; i += chunkSize - overlap) {
      const chunkText = words.slice(i, i + chunkSize).join(" ");
      if (!chunkText.trim()) continue;

      const embeddingResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "models/text-embedding-004",
            content: { parts: [{ text: chunkText }] }
          })
        }
      );

      if (!embeddingResponse.ok) continue;

      const embeddingData = await embeddingResponse.json();
      const embedding = embeddingData.embedding.values;

      await supabase.from("resource_chunks").insert({
        resource_id: record.id,
        page_number: 1,
        chunk_index: chunkIndex,
        content: chunkText,
        embedding: embedding
      });

      chunkIndex++;
    }

    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
  } catch (err: any) {
    console.error("Error processing PDF:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
