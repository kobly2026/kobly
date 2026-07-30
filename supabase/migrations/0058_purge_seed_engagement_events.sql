-- 0058_purge_seed_engagement_events.sql
-- Remove os 2 eventos de engajamento SINTÉTICOS de 2026-07-01 16:22 e refaz as métricas
-- derivadas deles.
--
-- Contexto (auditoria de entregabilidade, 2026-07-21). A base tinha exatamente 1 `open` e
-- 1 `click` em toda a sua história, ambos do mesmo sg_message_id
-- 'c0bd170e-edf8-45de-9934-4f7fcbf5fc32', para kobly@dizeops.com, com o clique apontando
-- para 'https://loja.exemplo.com/checkout' — domínio fictício. São seed de teste do
-- resend-webhook, não engajamento real.
--
-- Por que isso importa e não é cosmético: o rastreamento de abertura do Resend está
-- DESLIGADO neste domínio (flag off e nenhum subdomínio de tracking publicado), logo
-- nenhuma abertura real jamais foi ou poderia ser registrada. Esses 2 eventos falsos eram
-- a única coisa fazendo os KPIs exibirem 50% de abertura/CTR naquela campanha e 1,5% de
-- abertura global — número inventado que dava a impressão de haver engajamento medido onde
-- não há instrumento nenhum. Zerar é o que torna a UI honesta: 0% com tracking desligado é
-- a verdade, e é o que deixa visível que a métrica precisa ser ligada.
--
-- As métricas derivadas são RECALCULADAS a partir dos eventos restantes (mesma fórmula do
-- resend-webhook: abridores/clicadores ÚNICOS ÷ enviados), não decrementadas. Recalcular é
-- idempotente e não desencontra se a migration rodar duas vezes ou se algum contador já
-- estiver fora de sincronia por outro motivo.
-- ---------------------------------------------------------------------------

-- 1) Os eventos sintéticos. Escopo travado nas três condições juntas (message id + tipo +
--    destinatário) para que isto não possa alcançar engajamento legítimo futuro.
delete from public.email_events
 where sg_message_id = 'c0bd170e-edf8-45de-9934-4f7fcbf5fc32'
   and event in ('open', 'click')
   and email = 'kobly@dizeops.com';

-- 2) campaign_stats da campanha afetada, recalculada dos eventos que sobraram.
--    Espelha o cálculo do resend-webhook (index.ts, bloco "Recalcula taxa_abertura / ctr").
update public.campaign_stats cs
   set taxa_abertura = case when coalesce(cs.emails_enviados, 0) > 0
                            then least(1.0, (select count(distinct e.email)::numeric
                                               from public.email_events e
                                              where e.campaign_id = cs.campaign_id
                                                and e.event = 'open') / cs.emails_enviados)
                            else 0 end,
       ctr           = case when coalesce(cs.emails_enviados, 0) > 0
                            then least(1.0, (select count(distinct e.email)::numeric
                                               from public.email_events e
                                              where e.campaign_id = cs.campaign_id
                                                and e.event = 'click') / cs.emails_enviados)
                            else 0 end,
       ultimo_calculo = now()
 where cs.campaign_id = '0fd463fe-d4f7-45a4-a882-7a6b1588c65d';

-- 3) lead_metrics do lead afetado, recalculado dos eventos que sobraram. Conta eventos
--    (não únicos) porque é isso que o webhook incrementa por evento recebido.
update public.lead_metrics lm
   set aberturas = (select count(*) from public.email_events e
                     where e.organization_id = lm.organization_id
                       and e.email = l.email and e.event = 'open'),
       cliques   = (select count(*) from public.email_events e
                     where e.organization_id = lm.organization_id
                       and e.email = l.email and e.event = 'click')
  from public.leads l
 where l.id = lm.lead_id
   and lm.lead_id = '58151ff2-3c4b-43d4-8000-ef416db8d660';
