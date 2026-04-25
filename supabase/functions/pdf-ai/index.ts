import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { question, resourceId } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Generate embedding for the question
    const embeddingResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "models/text-embedding-004",
          content: { parts: [{ text: question }] }
        })
      }
    );

    if (!embeddingResponse.ok) throw new Error("Question embedding failed");
    const embeddingData = await embeddingResponse.json();
    const embedding = embeddingData.embedding.values;

    // 2. Match resource chunks
    const { data: chunks, error: matchError } = await supabase.rpc("match_resource_chunks", {
      query_embedding: embedding,
      match_threshold: 0.5,
      match_count: 5,
      p_resource_id: resourceId
    });

    if (matchError) throw matchError;

    const context = chunks?.map((c: any) => c.content).join("\n\n") || "No context found.";

    // 3. Gemini Chat Completion
    const chatResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are MyBookshelf AI, a friendly expert tutor. Use the following context to answer the student's question. 
              If the answer isn't in the context, say you don't know based on the document but try to help generally.
              Answer in the same language as the question (Hindi or English).
              
              Context:
              ${context}
              
              Question: ${question}`
            }]
          }]
        })
      }
    );

    if (chatResponse.status === 429) {
      // Specific rate limit handling
      const isHindi = /[\u0900-\u097F]/.test(question);
      const msg = isHindi 
        ? "Abhi bahut saare sawaal aa rahe hain. Thodi der baad dobara poochiye. 🙏"
        : "Too many questions right now. Please try again in a moment. 🙏";
      return new Response(JSON.stringify({ answer: msg }), { headers: corsHeaders });
    }

    if (!chatResponse.ok) throw new Error(`Gemini Chat failed: ${chatResponse.statusText}`);

    const chatData = await chatResponse.json();
    const answer = chatData.candidates[0].content.parts[0].text;

    return new Response(JSON.stringify({ answer }), { headers: corsHeaders });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
