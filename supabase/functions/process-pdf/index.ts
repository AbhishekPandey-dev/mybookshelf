import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import pdf from "npm:pdf-parse";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    // Extract file path from URL or assume public URL
    // If pdf_url is a full URL, we fetch it directly
    const response = await fetch(record.pdf_url);
    if (!response.ok) throw new Error(`Failed to fetch PDF: ${response.statusText}`);
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let pages: string[] = [];
    const render_page = async function(pageData: any) {
        const textContent = await pageData.getTextContent();
        let text = '';
        for (let item of textContent.items) {
            text += item.str + " ";
        }
        pages.push(text);
        return text;
    };

    await pdf(buffer, { pagerender: render_page });

    // For each page, chunk and embed
    for (let pageNum = 0; pageNum < pages.length; pageNum++) {
      const pageText = pages[pageNum];
      const words = pageText.split(/\s+/);
      const chunkSize = 600;
      const overlap = 60;

      let chunkIndex = 0;
      for (let i = 0; i < words.length; i += chunkSize - overlap) {
        const chunk = words.slice(i, i + chunkSize).join(" ");
        if (!chunk.trim()) continue;

        // Embed
        const embedRes = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            input: chunk,
            model: "text-embedding-3-small"
          })
        });

        if (!embedRes.ok) {
           console.error("Embed failed", await embedRes.text());
           continue;
        }

        const embedData = await embedRes.json();
        const embedding = embedData.data[0].embedding;

        // Insert into resource_chunks
        const { error: dbError } = await supabase.from("resource_chunks").insert({
          resource_id: record.id,
          page_number: pageNum + 1,
          chunk_index: chunkIndex,
          content: chunk,
          embedding: embedding
        });

        if (dbError) {
          console.error("Insert chunk error", dbError);
        }
        chunkIndex++;
      }
    }

    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
  } catch (err: any) {
    console.error("Error processing PDF:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
