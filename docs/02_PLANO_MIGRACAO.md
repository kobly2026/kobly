# Kobly — Plano de Migração: Bubble → Next.js + Supabase

> Plano de transição do app Bubble `kobly` para uma stack **Next.js (App Router) + Supabase**, com a lógica de automação em **Edge Functions + pg_cron/filas** (e/ou n8n mantido). Base: `01_ESPECIFICACAO_TECNICA.md`.

## 0. Premissas e decisões a confirmar

1. **Supabase próprio**: o projeto Supabase conectado nesta sessão (`godoy_prime_2`) é de **outro produto** (plataforma imobiliária Godoy Prime). O Kobly deve ter **um projeto Supabase novo e dedicado**. ✅ Reaproveitar os *padrões* desse projeto (multi-tenant + RLS, plans/quotas, edge functions, Asaas, AI usage log), não os dados.
2. **E-mail**: definir provedor único. Hipótese: **SendGrid** (autenticação de domínio DKIM/DMARC + tracking de eventos) é o principal; **Brevo** pode ser legado. Confirmar antes de codar o serviço de e-mail.
3. **Motor de automação**: decidir entre (A) **manter n8n** (`webhook.dizevolv.tech`) como orquestrador e o Next/Supabase só como app+dados; ou (B) **internalizar** o motor em Supabase (pg_cron + tabela de fila `agendamentos_etapa` + Edge Functions). Recomendação abaixo (§5).
4. **Pagamentos**: o app Bubble tem `TransaçõesUsuários`/`@StatusPagamento` mas sem gateway visível no API Connector. No projeto irmão usa-se **Asaas** (PIX/boleto/cartão, BR) — recomendado reutilizar.
5. **n8n**: os fluxos de automação atuais vivem **fora do Bubble**, no servidor n8n. Precisam ser **exportados do n8n** (JSON dos workflows) para documentar a lógica viva — não é acessível pelo editor Bubble.

---

## 1. Arquitetura alvo

```
Next.js (App Router, RSC) ── Vercel
  ├─ UI (React + Tailwind/shadcn)
  ├─ Server Actions / Route Handlers (mutations, auth-guarded)
  └─ @supabase/ssr (sessão, RLS por usuário)
        │
Supabase (projeto dedicado Kobly)
  ├─ Postgres (schema public, RLS multi-tenant por organization_id)
  ├─ Auth (substitui o User do Bubble; roles via app_metadata/user_roles)
  ├─ Storage (anexos de chat, imagens de perfil)
  ├─ Edge Functions (Deno): webhook receiver, sendgrid-events, run-campaign, calc-stats, ai-suggestion
  └─ pg_cron + tabela de fila (agendamentos_etapa) p/ etapas com atraso
        │
Integrações: SendGrid (envio+domínio+tracking) · Brevo(?) · Asaas (pagamentos) · n8n/IA (geração de HTML + sugestões)
```

Convenções recomendadas (espelhando o projeto irmão): tudo em `public` com **RLS habilitada**, multi-tenant por `organization_id`, papéis em `user_roles`, Edge Functions com `SECURITY DEFINER` para webhooks idempotentes, log de auditoria, log de uso de IA.

---

## 2. Mapeamento do modelo de dados (Bubble → Supabase)

Regras gerais:
- Cada **Data type** → tabela `snake_case` com `id uuid pk default gen_random_uuid()`, `created_at`, `updated_at`, `created_by uuid` (Creator), `organization_id uuid` (multi-tenant).
- **Option sets** → `enum` Postgres (ou tabela de lookup quando precisar de atributos).
- **Campos "List of X"** → tabela de junção `a_b` (N:N) ou FK no lado "muitos" (1:N).
- **Bubble `User`** → `auth.users` + tabela `profiles` (1:1) para campos custom.

### Multi-tenancy
Bubble usa `Empresa` + `User.EmpresasQueGerencia` + `GestorResponsavel`. Mapear para `organizations` (= Empresa) + `organization_memberships` (user↔org com papel). `organization_id` em todas as tabelas de negócio.

### Enums (option sets)
`status_user, tipo_user_geral, status_campanha, status_agendamento, status_criticidade, status_pagamento, status_planos, tipo_card_fluxo, tipo_chamado, prioridade_chamado, status_chamado, tipo_envio, tipo_evento, tipo_template, metodo_https`.

### Tabelas (resumo do mapeamento)
| Bubble | Supabase | Observações |
|---|---|---|
| User | auth.users + `profiles` | profiles: tipo_user_geral, status_user, celular, local, ip_conexao, ultimo_login, imagem_perfil, perfil_completo, gestor_responsavel_id, organization_id |
| Empresa | `organizations` | nome, user_fundador_id |
| (gestão) | `organization_memberships` | user_id, organization_id, role |
| Plano | `plans` | nome, descricao, status, valor_mensal, valor_anual, limite_campanhas, limite_execucoes, deleted |
| UserInfoPlano | `user_plan_usage` / `usage_counters` | plano_id, user_id, numero_campanhas, numero_execucoes |
| TransaçõesUsuários | `transactions` | status_pagamento, plano_id, user_id, valor_pago, forma_pagamento, id_transacao (Asaas) |
| HistóricoAcesso | `access_logs` | ip, local, tipo_log, user_id |
| Leads | `leads` | nome, sobrenome, email, telefone, endereco, produto, valor_compra, metodo_pagamento, pix_gerado, user_id |
| TagsUsuário | `tags` | nome, descricao, tipo_evento, user_id |
| lead↔tag | `lead_tags` | junção N:N |
| MétricasLead | `lead_metrics` | lead_id, etapa_email_origem_id, codigo_sendgrid |
| Campanhas | `campaigns` | nome, status_campanha, organization_id, criador_id, template_id, usa_template |
| FluxoCampanha | `campaign_flows` | campaign_id |
| flow↔tags_meta | `flow_meta_tags` | junção (condição de encerramento) |
| EtapaFluxo | `flow_steps` | tipo_card, posicao, atraso, flow_id, email_id; + junções step_trigger_tags / step_add_tags / step_remove_tags / step_trigger_flows |
| TemplatesProntos | `templates` | nome, descricao, tipo_template, icone |
| AgendamentosEtapa | `scheduled_steps` | **tabela de fila**: step_id, lead_id, status_agendamento, run_at, webhook_id |
| EmailsUsuário | `emails` | titulo, assunto, corpo_html, remetente, dominio_id |
| DomíniosUsuário | `domains` | url, validado, id_sendgrid, dkim/dmarc/cname (jsonb ou colunas), user_id |
| WebhooksUsuario | `webhooks` | nome, url, secret, payload, testado, desabilitado, user_id |
| WebhookDados | `webhook_events` | tipo_evento, dados do comprador, produto, valor, campaign_id, lead_id, webhook_id |
| SendGridWebhook | `email_events` | event, email, timestamp, status, sg_message_id, campaign_id, lead_metric_id |
| EstatisticasCampanha | `campaign_stats` | campaign_id, taxa_abertura, ctr, vendas_recuperadas, valor_criticidade, status_criticidade, ultimo_calculo |
| EstatísticasDashboard | `dashboard_stats` | totais agregados por user/org |
| SugestãoCampanha / TodasCampanhas | `ai_suggestions` | escopo (campanha/dashboard) + sugestao |
| ConversaChat | `support_conversations` | cliente_id, status, prioridade, tipo |
| MensagemChat | `support_messages` | conversation_id, mensagem, arquivos (storage), user_id |
| LogErrosRouter | `error_logs` | tipo_erro |

> Recomendação: gerar tudo via **migrations** (`supabase/migrations/*.sql`), enums primeiro, depois tabelas, depois FKs e índices, por fim RLS.

---

## 3. Autenticação & autorização

- Migrar `User` → **Supabase Auth**. `@TipoUserGeral` (Gestor/Cliente/Suporte/Administrador) → claim de role (`app_metadata.role`) + tabela `user_roles` para checagem em RLS.
- Login redireciona conforme role: Administrador → `/seguranca`; demais → `/dashboard` (regra atual do `Botão Login`).
- Reset de senha → Supabase Auth (substitui `reset_pw`).
- `HistóricoAcesso` → registrar em `access_logs` no callback de login (Edge Function ou server action).
- **RLS**: políticas por `organization_id` e por `user_id`; Gestor enxerga orgs em `organization_memberships`; Administrador via policy de role; Suporte acesso a `support_*`.

---

## 4. Páginas → rotas Next.js

| Bubble | Rota Next | Notas |
|---|---|---|
| index (login/cadastro/curadoria) | `/login`, `/signup`, `/onboarding`, `/privacidade` | curadoria = onboarding wizard |
| dashboard | `/dashboard` | KPIs + calendário filtro + sugestões IA |
| campanhas | `/campanhas` (+ `/campanhas/[id]/fluxo`, `/campanhas/[id]/email`) | **construtor de fluxo drag-drop** (dnd-kit) + editor de e-mail c/ IA |
| leads | `/leads` | tabela paginada (server pagination) + drawer InfoLeads |
| clientes | `/clientes` | Gestor: CRUD de contas |
| integracao | `/integracao` | domínios (DNS/SendGrid), webhooks, tags, API |
| perfil | `/perfil` | perfil + plano |
| planos_cobrancas | `/planos` | planos + histórico (Asaas) |
| chamados | `/chamados/[id]` | chat (Supabase Realtime) |
| suporte | `/suporte` | FAQ/vídeos (estático/CMS) |
| seguranca | `/admin/seguranca` | painel admin (guard role=Administrador) |
| relatorios_globais | `/admin/relatorios` | relatórios consolidados |

Reusables → componentes React: `Header`, `Sidebar` (Menu lateral), `LeadDetail` (InfoLeads), `CampaignStatusBadge`, `PlanCard`, `PlanFormModal`, `EmptyState`, etc.

Bibliotecas-alvo: dnd-kit (construtor de fluxo, substitui Draggable Elements), Recharts/Chart.js (gráficos), TanStack Table (listas), shadcn/ui + Tailwind, react-hook-form + zod (forms), Monaco (substitui Code Editor de HTML).

---

## 5. Motor de automação (o coração)

Reimplementar a lógica `old_*` (ver spec §6). **Recomendação: internalizar em Supabase** para reduzir dependência do n8n, mantendo n8n apenas para IA (geração de HTML/sugestões) se desejado.

Pipeline alvo:
1. **Edge Function `webhook-receiver`** (pública, valida `secret` do `webhooks`, idempotente por `id_webhook`): grava `webhook_events`, faz upsert de `lead`, incrementa `usage_counters.numero_execucoes`, **bloqueia se exceder `plans.limite_execucoes`**, e enfileira a campanha.
2. **`run-campaign`** (Edge Function ou função SQL): resolve campanha → fluxo → cria registros em `scheduled_steps` (fila) com `run_at = now() + atraso` por etapa.
3. **`pg_cron`** (a cada minuto) processa `scheduled_steps` com `run_at <= now()` e `status = pendente`:
   - *Adicionar/Remover Tag* → muta `lead_tags`
   - *Envio de e-mail* → chama SendGrid + grava `lead_metrics`
   - *Acionar Fluxo* → enfileira subfluxo
   - *Meta atingida* (`flow_meta_tags ∩ webhook.tipo_evento`) → cancela `scheduled_steps` pendentes do lead (status "Encerrado por Meta")
4. **`sendgrid-events`** (Edge Function): recebe webhooks de evento do SendGrid → grava `email_events` + atualiza `lead_metrics`/`campaign_stats`.
5. **`calc-stats`** (cron diário ou on-demand): recalcula `campaign_stats`/`dashboard_stats`, classifica `status_criticidade` por faixas (≤0.15 Crítico … >0.4 Excelente — confirmar mapeamento exato das faixas).
6. **`ai-suggestion`**: chama n8n `/suggestion-ai` (ou LLM direto) → grava `ai_suggestions`. Geração de HTML de e-mail → n8n `/generate_html` (ou LLM direto).

> ⚠️ Reproduzir fielmente as faixas de criticidade e a regra de encerramento por meta exige **abrir cada passo `old_*` no Bubble** (ou os fluxos n8n). A spec captura a estrutura; valores exatos (campos setados em cada "Make changes", thresholds) devem ser conferidos passo a passo numa fase dedicada.

---

## 6. Integrações

- **SendGrid**: serviço `lib/sendgrid.ts` — autenticar domínio (`/whitelist/domains`), criar/gerenciar senders, enviar e-mail, e **Inbound/Event Webhook** → Edge Function `sendgrid-events`. Migrar config DKIM/DMARC/CNAME (tabela `domains`).
- **DMARC**: consulta DNS TXT (`dns.google/resolve`) — pode virar Edge Function `verify-dmarc`.
- **n8n / IA**: manter endpoints `/generate_html` e `/suggestion-ai` OU substituir por chamada direta a LLM com camada de abstração de provider + log de uso (padrão `ai_usage_log`/`ai_model_pricing` do projeto irmão).
- **Pagamentos (Asaas)**: `transactions` + Edge Functions `asaas-checkout`/`asaas-webhook` (idempotência por event_id) — reaproveitar padrão existente.
- **Brevo**: confirmar se descontinua.

---

## 7. Migração de dados

1. Exportar dados do Bubble (Data → "App data", export CSV por tipo; ou Bubble Data API).
2. Mapear ids do Bubble (unique id) → guardar em coluna `legacy_bubble_id` para reconciliar FKs.
3. Ordem de carga: organizations → profiles (após criar usuários no Auth) → plans → tags → templates → domains → campaigns → flows → steps → emails → leads → métricas/stats → webhooks/eventos.
4. Usuários: criar no Supabase Auth (convite/senha temporária) e vincular `profiles` por e-mail.
5. **Exportar os workflows do n8n** (JSON) do servidor `webhook.dizevolv.tech` para versionar a lógica viva.

---

## 8. Fases sugeridas

- **Fase 0 — Fundação**: projeto Supabase Kobly, repo Next.js, `@supabase/ssr`, enums + tabelas (migrations), RLS base, Auth + roles + redirecionamento de login.
- **Fase 1 — Núcleo de leitura**: dashboard (stats), leads (lista/detalhe), perfil, planos (leitura). Importar dados.
- **Fase 2 — Campanhas & fluxo**: CRUD de campanhas, construtor de fluxo (dnd-kit), editor de e-mail (+IA), templates.
- **Fase 3 — Integrações**: domínios/SendGrid, webhooks (CRUD + secret), tags.
- **Fase 4 — Motor de automação**: `webhook-receiver`, fila `scheduled_steps`, pg_cron, `sendgrid-events`, `calc-stats`, limites de plano. (Validar passo a passo vs. `old_*`/n8n.)
- **Fase 5 — Admin & suporte**: seguranca (usuários/sessões/webhooks/histórico), relatórios globais, chat de suporte (Realtime), pagamentos (Asaas).
- **Fase 6 — Cutover**: paridade, migração final de dados, redirecionar webhooks do e-commerce para o novo endpoint, descomissionar Bubble/n8n conforme decisão.

---

## 9. Riscos & pontos de atenção

1. **Lógica viva no n8n** (não no Bubble) — exportar e documentar os fluxos n8n é pré-requisito da Fase 4. Sem isso, a paridade do motor fica incompleta.
2. **Detalhe de ações dos workflows**: a spec mapeia eventos→ações no nível de título/condição. Campos exatos setados em cada "Make changes" e thresholds (criticidade) precisam de uma passada passo-a-passo no editor (ou inspeção do n8n).
3. **SendGrid vs. Brevo**: decisão de provedor de e-mail afeta domínios/tracking — resolver cedo.
4. **Idempotência de webhooks** (e-commerce e SendGrid): essencial p/ não duplicar leads/execuções (padrão `*_webhook_events` com unique id).
5. **Limites de plano**: a checagem `numero_execucoes > limite_execucoes` é regra de negócio crítica (corta envios) — replicar fielmente.
6. **Multi-tenant/RLS**: modelar `organization_id` e papéis desde o início evita retrabalho.
7. **Curadoria/onboarding** (31 cards no index): confirmar o que persiste (`User.Curadoria` é List of text).
