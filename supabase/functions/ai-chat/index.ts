// Kobly — Edge Function `ai-chat`: proxy seguro para o DeepSeek.
// A chave do DeepSeek fica no Supabase Vault (lida via RPC get_secret com service_role).
// NUNCA vai pro browser. O front chama via supabase.functions.invoke('ai-chat', ...).
// verify_jwt = true: só usuários autenticados (a UI envia o JWT da sessão).
//
// Tasks (campo `task` no corpo):
//   'chat'       (default) — assistente conversacional, multi-turn, resposta curta.
//   'email'      — redige um e-mail de recuperação: JSON {assunto,titulo,paragrafos,cta,cupom}.
//   'suggestion' — UMA recomendação prática (1-2 frases) fundamentada no contexto real.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

async function callDeepSeek(apiKey: string, dsMessages: unknown[], opts: { jsonMode?: boolean; maxTokens?: number } = {}) {
  const resp = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: dsMessages,
      temperature: opts.jsonMode ? 0.5 : 0.4,
      max_tokens: opts.maxTokens ?? 600,
      stream: false,
      ...(opts.jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!resp.ok) {
    const detail = (await resp.text()).slice(0, 400);
    return { error: { status: resp.status, detail } };
  }
  const data = await resp.json();
  return { content: data?.choices?.[0]?.message?.content ?? "" };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { messages = [], context = {}, task = "chat", brief = "", brand = "" } = await req.json();

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: apiKey, error: keyErr } = await admin.rpc("get_secret", { p_name: "deepseek_api_key" });
    if (keyErr || !apiKey) return json({ error: "secret_unavailable", detail: keyErr?.message }, 500);

    const ctx = JSON.stringify(context).slice(0, 6000);

    // ── Task: email (JSON estruturado) ──────────────────────────────────────
    if (task === "plan") {
      const eventos = ["Abandono de carrinho", "Boleto Gerado", "Compra cancelada", "Depósito Solicitado", "Pix Gerado", "Chargeback", "Cancelamento de Assinatura", "Compra Reembolsada", "Compra Aprovada", "Compra Recusada"];
      const sys = [
        "Você é estrategista de automação de recuperação de vendas por e-mail (pt-BR) da Koblay.",
        "A partir do OBJETIVO do usuário, planeje uma campanha: escolha o GATILHO e uma cadência de 1 a 3 e-mails.",
        "Responda APENAS um JSON válido (sem markdown, sem texto fora do JSON) no formato exato:",
        '{"nome": string (curto), "gatilho": string, "etapas": [{"atraso_min": number, "assunto": string (até ~55 car.), "eyebrow": string (curtíssimo), "titulo": string, "paragrafos": string[] (1-2 curtos), "cta": string (até ~28 car.), "cupom": {"codigo": string, "detalhe": string} | null}]}',
        "O campo gatilho DEVE ser EXATAMENTE um destes: " + eventos.join(" | ") + ".",
        "atraso_min é o atraso desde o gatilho, em minutos (ex.: 0, 60, 1440). Primeira etapa geralmente com atraso pequeno.",
        "Cadência típica de abandono: 3 toques (0, 60, 1440 min). Use cupom só se o objetivo mencionar oferta/desconto. Não invente dados do cliente.",
        `Loja: ${String(brand || "a loja").slice(0, 80)}.`,
        `Objetivo: ${String(brief || "recuperar carrinhos abandonados").slice(0, 600)}.`,
      ].join("\n");
      const r = await callDeepSeek(apiKey, [{ role: "system", content: sys }, { role: "user", content: brief || "Planeje a campanha." }], { jsonMode: true, maxTokens: 1300 });
      if ((r as any).error) return json({ error: "deepseek_error", ...(r as any).error }, 502);
      let plan: any;
      try { plan = JSON.parse((r as any).content); } catch { return json({ error: "parse_error", detail: String((r as any).content).slice(0, 200) }, 502); }
      if (!plan || !eventos.includes(plan.gatilho)) { if (plan) plan.gatilho = "Abandono de carrinho"; }
      if (!plan || !Array.isArray(plan.etapas)) return json({ error: "parse_error", detail: "sem etapas" }, 502);
      return json({ plan });
    }

    if (task === "email") {
      const sys = [
        "Você é redator de e-mail marketing de recuperação de vendas para e-commerce (pt-BR).",
        "Escreva um e-mail curto, persuasivo e honesto, no tom de uma loja falando com o cliente.",
        "Responda APENAS um JSON válido (sem markdown, sem texto fora do JSON) com este formato exato:",
        '{"assunto": string (até ~55 caracteres, sem emojis em excesso), "eyebrow": string (curtíssimo, ex.: "Seu carrinho"), "titulo": string, "paragrafos": string[] (1 a 3 parágrafos curtos), "cta": string (até ~28 caracteres), "cupom": {"codigo": string, "detalhe": string} | null}',
        "Use cupom apenas se o briefing mencionar desconto/oferta. Não invente dados.",
        `Loja: ${String(brand || "a loja").slice(0, 80)}.`,
        `Briefing do usuário: ${String(brief || "recuperação de carrinho abandonado").slice(0, 800)}.`,
      ].join("\n");
      const r = await callDeepSeek(apiKey, [{ role: "system", content: sys }, { role: "user", content: brief || "Escreva o e-mail." }], { jsonMode: true, maxTokens: 700 });
      if ((r as any).error) return json({ error: "deepseek_error", ...(r as any).error }, 502);
      let email: any;
      try { email = JSON.parse((r as any).content); } catch { return json({ error: "parse_error", detail: String((r as any).content).slice(0, 200) }, 502); }
      return json({ email });
    }

    // ── Task: suggestion (texto curto fundamentado) ─────────────────────────
    if (task === "suggestion") {
      const sys = [
        "Você é o analista de IA da Koblay (automação de recuperação de vendas por e-mail).",
        "Dê UMA recomendação prática e específica, em pt-BR, no máximo 2 frases. Texto puro, SEM markdown.",
        "Fundamente nos DADOS REAIS do contexto (cite número ou nome de campanha quando útil). Não invente.",
        "CONTEXTO (JSON):", ctx,
      ].join("\n");
      const userMsg = (brief && String(brief)) || "Dê a recomendação mais impactante agora.";
      const r = await callDeepSeek(apiKey, [{ role: "system", content: sys }, { role: "user", content: userMsg }], { maxTokens: 160 });
      if ((r as any).error) return json({ error: "deepseek_error", ...(r as any).error }, 502);
      return json({ suggestion: String((r as any).content).trim() });
    }

    // ── Task: chat (default) ────────────────────────────────────────────────
    const system = [
      "Você é o assistente de IA da Koblay, plataforma de automação de marketing por e-mail focada em recuperação de vendas de e-commerce (carrinho abandonado, Pix/boleto gerado, pós-venda).",
      "Responda SEMPRE em português do Brasil, objetivo e prático, curto (no máx. ~4 frases ou uma lista enxuta).",
      "Quando fizer sentido, use os DADOS REAIS do usuário no CONTEXTO para fundamentar (cite números/nomes de campanha).",
      "Domínios de ajuda: análise de campanhas, cadências, assuntos/CTA de e-mail, entregabilidade (DKIM/DMARC), leads e métricas.",
      "Não invente dados fora do contexto. Se não houver dado suficiente, oriente o próximo passo dentro da Koblay.",
      "CONTEXTO (JSON dos dados do usuário):", ctx,
    ].join("\n");
    const dsMessages = [
      { role: "system", content: system },
      ...(Array.isArray(messages) ? messages : []).filter((m: any) => m && m.role && m.content),
    ];
    const r = await callDeepSeek(apiKey, dsMessages, { maxTokens: 600 });
    if ((r as any).error) return json({ error: "deepseek_error", ...(r as any).error }, 502);
    return json({ answer: (r as any).content || "Não consegui gerar uma resposta agora." });
  } catch (e) {
    return json({ error: "bad_request", detail: String(e).slice(0, 300) }, 400);
  }
});
