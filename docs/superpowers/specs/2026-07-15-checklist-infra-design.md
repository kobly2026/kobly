# Design — Checklist de Ajustes + Infra (botões, domínio, Asaas)

> **Status:** implementado em produção (schema + edge functions) + código local na branch `feat/checklist-infra-botoes`.  
> **Nota de processo:** este spec foi escrito **após** a implementação (falha de superpowers: faltou brainstorm → plan → branch → review). Serve como fonte da verdade retroativa e base da revisão.

## Contexto

Checklist do cliente (`[KOBLY] Checklist de Ajustes.md`) pediu:
1. Bugs de métrica, e-mail, webhook, plano, fila
2. Limpeza de UI (dropdown de templates, webhook no gatilho)
3. Botões interativos WhatsApp (+ CTA no e-mail)
4. Infra: domínio Resend, Asaas sandbox, DNS docs

## Objetivos

| # | Objetivo | Critério de sucesso |
|---|----------|---------------------|
| A | Métrica "Recuperado" | Só com e-mail de automação enviado **antes** da compra |
| B | Remetente | Nome do campo "Remetente" no From do Resend |
| C | Editor e-mail | HTML/título/assunto/remetente persistem |
| D | Preview e-mail | Clique em `href="#"` não navega a SPA |
| E | Excluir webhook | Funciona para membros da org (RLS) |
| F | Fila e-mail | Steps órfãos finalizam com erro (não ficam eternos) |
| G | Plano auto | Contas novas sem `plano_id` |
| H | UI fluxo | Sem lista pré-pronta de e-mails; sem webhook no card Gatilho |
| I | WhatsApp botões | URL/CALL/REPLY via Z-API `send-button-actions` |
| J | E-mail CTA | Inserir botão com link no editor |
| K | Domínio | CRUD Resend por org + DNS na UI |
| L | Asaas | Edge + checkout PIX em Planos (se Vault configurado) |
| M | WA teste | Número persistido em `profiles.whatsapp_teste` |
| N | Excluir campanha | Botão na lista |

## Fora de escopo (ainda)

- Import ZIP Canva de templates
- Disparo em massa / SMS
- Webhook Asaas para ativar plano após pagamento
- Identidade visual (assets Drive)
- Testes automatizados de UI (não existiam; não foram criados)

## Arquitetura

```
UI (Vite/React)
  ├─ EmailEditor / WhatsAppEditor / Integrations / Plans / Campaigns
  └─ KoblyApi (mockApi.js) ──► Supabase (Postgres RLS + Edge Functions)
                                   ├─ process-steps (cron, JWT off)
                                   ├─ postback-receiver (JWT off)
                                   ├─ send-email / send-whatsapp / resend-admin / asaas (JWT on)
                                   └─ Vault secrets (resend_*, zapi_*, asaas_*)
```

## Riscos conhecidos (pós-implementação sem review)

1. Deploy de schema **antes** de merge em main — remoto já tem 0034/0035.
2. Sem testes automatizados das regras de "recuperado" / botões.
3. Asaas sem secrets no Vault → UI só mostra "não configurado".
4. `domains.status` + `from_email` usados no worker; domínio não verificado cai no fallback da plataforma.
5. Z-API botões: limitações de cliente WhatsApp (ver docs Z-API button status).

## Decisões

| Decisão | Escolha | Motivo |
|---------|---------|--------|
| Webhook no card | Remover; só seletor global da campanha | Checklist / menos redundância |
| Templates no dropdown | Remover; criar/editar por etapa | Checklist / evita lista stale |
| Plano onboarding | `plano_id = null` | Bloquear liberação automática |
| Botões WA | Coluna `botoes` jsonb | Flexível, sem migration por tipo |
| Domínio | Resend Admin API + tabela `domains` | Já existia modelo legado SendGrid |
| Asaas | Edge function + vault | Secrets nunca no browser |

## Verificação mínima exigida

- [ ] `npm run build` exit 0
- [ ] Migrations remotas listadas (`checklist_ajustes`, `infra_botoes_dominio_asaas`)
- [ ] Edge functions versões novas ativas
- [ ] Code review (Critical/Important)
- [ ] Branch ≠ main com commit(s) revisáveis
