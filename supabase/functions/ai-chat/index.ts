// Kobly — Edge Function `ai-chat`: proxy seguro para o DeepSeek.
// A chave do DeepSeek fica no Supabase Vault (lida via RPC get_secret com service_role).
// NUNCA vai pro browser. O front chama via supabase.functions.invoke('ai-chat', ...).
// verify_jwt = true: só usuários autenticados (a UI envia o JWT da sessão).
//
// Tasks (campo `task` no corpo):
//   'chat'       (default) — assistente conversacional, multi-turn, resposta curta.
//   'support'    — agente de SUPORTE do produto (multi-turn); conhece o Koblay e indica
//                  o botão "Falar com atendente" quando a solução exige ação interna.
//   'email'      — redige um e-mail de recuperação: JSON {assunto,titulo,paragrafos,cta,cupom}.
//   'whatsapp'   — redige UMA mensagem de WhatsApp: JSON {titulo,texto} (com {{cta_link}}).
//   'suggestion' — UMA recomendação prática (1-2 frases) fundamentada no contexto real.
//   'plan'       — planeja campanha completa; aceita `canais` (['email','whatsapp']) e
//                  gera etapas com campo `canal` (whatsapp → campo `texto` com {{cta_link}}).
//
// Hardening: entrada sanitizada/truncada (20 msgs × 4000 chars; brief 2000) e rate
// limit de 10 req/min por usuário via tabela ai_usage (service role; 429 ao estourar).
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
    const body = await req.json();
    const { context = {}, task = "chat", brand = "", canais = [] } = body;

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // ── Sanitização de entrada (vale para todas as tasks) ────────────────────
    const safeMessages = (Array.isArray(body.messages) ? body.messages : [])
      .filter((m: any) => m && m.role && m.content)
      .slice(-20)
      .map((m: any) => ({ role: m.role === "user" ? "user" : "assistant", content: String(m.content).slice(0, 4000) }));
    const brief = String(body.brief ?? "").slice(0, 2000);

    // ── Rate limit: 10 req/min por usuário (ai_usage; fail-open em erro) ─────
    try {
      const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
      const { data: u } = await admin.auth.getUser(jwt);
      if (u?.user?.id) {
        const oneMinAgo = new Date(Date.now() - 60_000).toISOString();
        const { count } = await admin.from("ai_usage")
          .select("id", { count: "exact", head: true })
          .eq("auth_id", u.user.id).gte("created_at", oneMinAgo);
        if ((count ?? 0) >= 10) return json({ error: "rate_limited" }, 429);
        await admin.from("ai_usage").insert({ auth_id: u.user.id, task });
      }
    } catch (_e) { /* fail-open: rate limit nunca derruba a função */ }

    const { data: apiKey, error: keyErr } = await admin.rpc("get_secret", { p_name: "deepseek_api_key" });
    if (keyErr || !apiKey) return json({ error: "secret_unavailable", detail: keyErr?.message }, 500);

    const ctx = JSON.stringify(context).slice(0, 6000);

    // ── Task: support (agente de suporte do produto, multi-turn) ────────────
    if (task === "support") {
      const sys = [
        "Você é o agente de SUPORTE da Koblay (pt-BR), plataforma de automação de recuperação de vendas de e-commerce.",
        "CONHECIMENTO DO PRODUTO:",
        "- Campanhas: fluxos com um Gatilho (Abandono de carrinho, Pix Gerado, Boleto Gerado, Compra Aprovada etc.) + etapas de Envio de e-mail / Envio de WhatsApp / Adicionar-Remover Tag / Condição (comprou / não comprou) / Acionar Fluxo, cada etapa com atraso em minutos.",
        "- Tags-meta encerram o lead no fluxo quando o evento correspondente chega.",
        "- Criticidade: índice 0–1 (Crítico→Excelente) calculado de abertura, CTR e vendas recuperadas.",
        "- Integrações: postback/webhook de checkout (Hotmart, Kiwify, NexusPayt etc.) — URL com token na tela Integrações; envio de e-mail via provedor gerenciado; WhatsApp via Z-API (credenciais configuradas pelo suporte).",
        "- Planos: limites de campanhas e execuções; upgrade em Planos & cobrança → Falar com o comercial.",
        "REGRAS: responda curto (máx. ~4 frases), prático e passo-a-passo quando for instrução de tela. Use os DADOS REAIS do CONTEXTO quando útil. Não invente.",
        "Se o problema exigir ação interna (cobrança, credenciais Z-API/e-mail, bug, dados que você não vê) ou o usuário pedir um humano, oriente explicitamente a tocar no botão 'Falar com atendente' logo abaixo — a conversa será anexada ao chamado.",
        "CONTEXTO (JSON dos dados do usuário):", ctx,
      ].join("\n");
      const r = await callDeepSeek(apiKey, [{ role: "system", content: sys }, ...safeMessages], { maxTokens: 500 });
      if ((r as any).error) return json({ error: "deepseek_error", ...(r as any).error }, 502);
      return json({ answer: (r as any).content || "Não consegui responder agora." });
    }

    // ── Task: email (JSON estruturado) ──────────────────────────────────────
    if (task === "plan") {
      const eventos = ["Abandono de carrinho", "Boleto Gerado", "Compra cancelada", "Depósito Solicitado", "Pix Gerado", "Chargeback", "Cancelamento de Assinatura", "Compra Reembolsada", "Compra Aprovada", "Compra Recusada"];
      const useWhatsapp = Array.isArray(canais) && canais.includes("whatsapp");
      const useEmail = !Array.isArray(canais) || canais.length === 0 || canais.includes("email");
      const canalDesc = useWhatsapp && useEmail
        ? "Misture os canais na cadência: cada etapa tem \"canal\": \"email\" ou \"whatsapp\" (WhatsApp é ótimo pro 1º toque rápido; e-mail pros toques com mais conteúdo/cupom)."
        : useWhatsapp
          ? 'TODAS as etapas devem ter "canal": "whatsapp".'
          : 'TODAS as etapas devem ter "canal": "email".';
      const sys = [
        "Você é estrategista de automação de recuperação de vendas (pt-BR) da Koblay.",
        "A partir do OBJETIVO do usuário, planeje uma campanha: escolha o GATILHO e uma cadência de 1 a 3 toques.",
        "Responda APENAS um JSON válido (sem markdown, sem texto fora do JSON) no formato exato:",
        '{"nome": string (curto), "gatilho": string, "etapas": [{"canal": "email" | "whatsapp", "condicao": "sempre" | "comprou" | "nao_comprou", "atraso_min": number, "assunto": string (até ~55 car.; p/ whatsapp é o título interno), "eyebrow": string (curtíssimo; só email), "titulo": string, "paragrafos": string[] (1-2 curtos; só email), "cta": string (até ~28 car.; só email), "cupom": {"codigo": string, "detalhe": string} | null, "texto": string (SÓ whatsapp: a mensagem, 2-6 linhas, tom pessoal, no máx. 1 emoji, DEVE conter {{cta_link}})}]}',
        canalDesc,
        "O campo gatilho DEVE ser EXATAMENTE um destes: " + eventos.join(" | ") + ".",
        "atraso_min é o atraso desde o gatilho, em minutos (ex.: 0, 60, 1440). Primeira etapa geralmente com atraso pequeno.",
        "Cadência típica de abandono: 3 toques (0, 60, 1440 min). Use cupom só se o objetivo mencionar oferta/desconto. Não invente dados do cliente.",
        "condicao é o IF/ELSE do fluxo, avaliado na hora do envio: em fluxos de RECUPERAÇÃO use 'nao_comprou' nos toques de cobrança/lembrete (quem pagar no meio da cadência para de receber). Se o objetivo pedir agradecer/confirmar quem pagou, adicione uma etapa com condicao 'comprou' no MESMO fluxo (ex.: e-mail de agradecimento com atraso maior). Use 'sempre' quando o toque não depende do pagamento.",
        "Em etapas whatsapp o placeholder {{cta_link}} é obrigatório no texto — é trocado pelo link de recuperação no envio.",
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

    // ── Task: whatsapp (mensagem curta contextual por objetivo — TPL-2) ─────
    if (task === "whatsapp") {
      // TPL-2: objetivo (tipo_evento da campanha) define o TOM da mensagem.
      // Sem objetivo, mantém "recuperação de vendas" (comportamento anterior).
      const objetivo = String(body.objetivo || "").slice(0, 80);
      const contexto = objetivo
        ? `CONTEXTO da mensagem: o cliente acaba de receber o evento "${objetivo}". Escreva a mensagem ADEQUADA a este contexto (ex.: se for "Compra Aprovada", entregue o acesso e parabenize; se for "Abandono de carrinho", recupere a venda; se for "Pix Gerado", lembre do pagamento). NÃO assuma que é sempre recuperação de carrinho.`
        : "Escreva uma mensagem de recuperação de vendas de e-commerce.";
      const sys = [
        "Você é redator de mensagens de WhatsApp para e-commerce (pt-BR).",
        contexto,
        "Escreva UMA mensagem curta (2 a 6 linhas), tom pessoal e direto, como a loja falando com o cliente no WhatsApp. No máximo 1 emoji.",
        "Se o contexto exigir um link de ação (checkout, acesso, pagamento), inclua o placeholder {{cta_link}} exatamente assim — ele é trocado pelo link real no envio. Se NÃO houver ação (ex.: confirmação de reembolso sem link), omita o {{cta_link}}.",
        "Responda APENAS um JSON válido (sem markdown, sem texto fora do JSON) com este formato exato:",
        '{"titulo": string (título INTERNO curto), "texto": string (a mensagem, use \\n para quebras de linha)}',
        "Use cupom apenas se o briefing mencionar desconto/oferta. Não invente dados.",
        `Loja: ${String(brand || "a loja").slice(0, 80)}.`,
        `Briefing do usuário: ${String(brief || (objetivo ? `Mensagem para: ${objetivo}` : "recuperação de carrinho abandonado")).slice(0, 800)}.`,
      ].join("\n");
      const r = await callDeepSeek(apiKey, [{ role: "system", content: sys }, { role: "user", content: brief || "Escreva a mensagem." }], { jsonMode: true, maxTokens: 400 });
      if ((r as any).error) return json({ error: "deepseek_error", ...(r as any).error }, 502);
      let mensagem: any;
      try { mensagem = JSON.parse((r as any).content); } catch { return json({ error: "parse_error", detail: String((r as any).content).slice(0, 200) }, 502); }
      // Normaliza {{cta_link}} apenas se a mensagem o mencionar (malformado).
      if (mensagem && typeof mensagem.texto === "string" && mensagem.texto.includes("cta_link")) {
        mensagem.texto = mensagem.texto.replace(/\{{1,2}\s*cta_link\s*\}{1,2}/gi, "{{cta_link}}");
      }
      return json({ mensagem });
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
      ...safeMessages,
    ];
    const r = await callDeepSeek(apiKey, dsMessages, { maxTokens: 600 });
    if ((r as any).error) return json({ error: "deepseek_error", ...(r as any).error }, 502);
    return json({ answer: (r as any).content || "Não consegui gerar uma resposta agora." });
  } catch (e) {
    return json({ error: "bad_request", detail: String(e).slice(0, 300) }, 400);
  }
});
