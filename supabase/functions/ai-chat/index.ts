// Kobly — Edge Function `ai-chat`: proxy seguro para o DeepSeek.
// A chave do DeepSeek fica no Supabase Vault (lida via RPC get_secret com service_role).
// NUNCA vai pro browser. O front chama via supabase.functions.invoke('ai-chat', ...).
// verify_jwt = true: só usuários autenticados (a UI envia o JWT da sessão).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { messages = [], context = {} } = await req.json();

    // service_role (injetado pelo Supabase) só para ler o segredo do Vault.
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: apiKey, error: keyErr } = await admin.rpc("get_secret", { p_name: "deepseek_api_key" });
    if (keyErr || !apiKey) {
      return new Response(JSON.stringify({ error: "secret_unavailable", detail: keyErr?.message }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const system = [
      "Você é o assistente de IA da Kobly, plataforma de automação de marketing por e-mail focada em recuperação de vendas de e-commerce (carrinho abandonado, Pix/boleto gerado, pós-venda).",
      "Responda SEMPRE em português do Brasil, objetivo e prático, curto (no máx. ~4 frases ou uma lista enxuta).",
      "Quando fizer sentido, use os DADOS REAIS do usuário no CONTEXTO para fundamentar (cite números/nomes de campanha).",
      "Domínios de ajuda: análise de campanhas, cadências, assuntos/CTA de e-mail, entregabilidade (DKIM/DMARC), leads e métricas.",
      "Não invente dados fora do contexto. Se não houver dado suficiente, oriente o próximo passo dentro da Kobly.",
      "CONTEXTO (JSON dos dados do usuário):",
      JSON.stringify(context).slice(0, 6000),
    ].join("\n");

    const dsMessages = [
      { role: "system", content: system },
      ...(Array.isArray(messages) ? messages : []).filter((m: any) => m && m.role && m.content),
    ];

    const resp = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "deepseek-chat", messages: dsMessages, temperature: 0.4, max_tokens: 600, stream: false }),
    });

    if (!resp.ok) {
      const detail = (await resp.text()).slice(0, 400);
      return new Response(JSON.stringify({ error: "deepseek_error", status: resp.status, detail }), {
        status: 502, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const json = await resp.json();
    const answer = json?.choices?.[0]?.message?.content ?? "Não consegui gerar uma resposta agora.";
    return new Response(JSON.stringify({ answer }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: "bad_request", detail: String(e).slice(0, 300) }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
