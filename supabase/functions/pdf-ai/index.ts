import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { mode, question, resourceId, pageNumber, language } = await req.json();
    const isHindi = language === "hi";
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let retrievedContext = "";
    
    if (mode === "ask" && question && resourceId) {
      // 1. Embed the question
      const embedRes = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          input: question,
          model: "text-embedding-3-small"
        })
      });

      if (!embedRes.ok) throw new Error("Failed to embed question");
      const embedData = await embedRes.json();
      const query_embedding = embedData.data[0].embedding;

      // 2. Vector search via RPC
      const { data: chunks, error: rpcError } = await supabase.rpc("match_resource_chunks", {
        query_embedding,
        match_threshold: 0.1,
        match_count: 5,
        p_resource_id: resourceId
      });

      if (rpcError) throw rpcError;

      // 3. Construct context
      if (chunks && chunks.length > 0) {
        retrievedContext = chunks.map((c: any) => `[Page ${c.page_number}]\n${c.content}`).join("\n\n");
      }
    } else if (mode === "explain" && resourceId && pageNumber) {
      // If explaining a specific page, just fetch chunks for that page
      const { data: chunks, error } = await supabase
        .from("resource_chunks")
        .select("content, page_number")
        .eq("resource_id", resourceId)
        .eq("page_number", pageNumber)
        .order("chunk_index");
        
      if (!error && chunks) {
        retrievedContext = chunks.map(c => `[Page ${c.page_number}]\n${c.content}`).join("\n\n");
      }
    }

    let systemPrompt = "";
    let userPrompt = "";

    if (mode === "explain") {
      systemPrompt = isHindi
        ? "Explain the following content in simple Hindi (Devanagari script) as if you are a teacher explaining to a student. Use easy language suitable for school or college students. Base your answer only on the provided PDF content. Show a chunk.page_number reference below each AI answer as '📄 Page X'"
        : "You are a friendly teacher explaining content to a school/college student. Use simple, clear language. Keep explanations concise but thorough. Use short paragraphs. Base your answer only on the provided PDF content. Show a chunk.page_number reference below each AI answer as '📄 Page X'";
      userPrompt = `Explain the following context from page ${pageNumber}:\n\n${retrievedContext}`;
    } else {
      systemPrompt = isHindi
        ? `Aap MyBookshelf AI hain — ek dost jaisa, samajhdaar tutor. Student ke sawaal ka jawab sirf neeche diye gaye PDF context ke aadhar par dijiye. Agar jawab context mein nahi hai, toh boliye "Yeh document mein nahi mila." Jawab simple, conversational Hindi mein dijiye — Devanagari script mein. Chhota aur saaf rakho kyunki yeh bol ke sunaya jayega.\nContext: ${retrievedContext}`
        : `You are MyBookshelf AI, a friendly expert tutor. Answer the student's question strictly based on the provided context from their PDF. If the answer is not in the context, say "I couldn't find that in this document." Use short paragraphs. Mention the page number if known.\nContext: ${retrievedContext}`;
      userPrompt = `Student Question: ${question}\n\nShow a page reference below your answer as "📄 Page X" based on the context provided.`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content ?? "No answer available.";

    return new Response(JSON.stringify({ answer }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("pdf-ai error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
