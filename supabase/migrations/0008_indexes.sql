-- 0008_indexes.sql
-- Kobly — índices em TODAS as colunas FK (Postgres não indexa FK automaticamente)
-- e nas colunas usadas por RLS. Índice composto na fila scheduled_steps.
-- Uniques já criam índice (não recriados aqui): profiles.auth_id, profiles.email,
-- organization_memberships(organization_id, profile_id), usage_counters.organization_id,
-- campaign_flows.campaign_id, campaign_stats.campaign_id,
-- webhook_events(webhook_id, id_webhook) [NULLS NOT DISTINCT].
-- email_events.sg_event_id agora é índice unique PARCIAL (criado aqui), pois a
-- coluna é nullable e o unique de coluna deixaria múltiplos NULLs passarem.
-- ---------------------------------------------------------------------------

-- profiles
create index idx_profiles_organization_id on public.profiles (organization_id);
create index idx_profiles_gestor_responsavel_id on public.profiles (gestor_responsavel_id);
create index idx_profiles_created_by on public.profiles (created_by);

-- organizations
create index idx_organizations_user_fundador_id on public.organizations (user_fundador_id);
create index idx_organizations_plano_id on public.organizations (plano_id);
create index idx_organizations_created_by on public.organizations (created_by);

-- organization_memberships
create index idx_memberships_organization_id on public.organization_memberships (organization_id);
create index idx_memberships_profile_id on public.organization_memberships (profile_id);

-- usage_counters
create index idx_usage_counters_profile_id on public.usage_counters (profile_id);
create index idx_usage_counters_plano_id on public.usage_counters (plano_id);

-- transactions
create index idx_transactions_organization_id on public.transactions (organization_id);
create index idx_transactions_profile_id on public.transactions (profile_id);
create index idx_transactions_plano_id on public.transactions (plano_id);

-- access_logs
create index idx_access_logs_profile_id on public.access_logs (profile_id);
-- timeline append-only: log de acessos por profile em ordem cronológica
create index idx_access_logs_profile_created on public.access_logs (profile_id, created_at desc);

-- active_sessions
create index idx_active_sessions_profile_id on public.active_sessions (profile_id);

-- tags
create index idx_tags_organization_id on public.tags (organization_id);

-- leads
create index idx_leads_organization_id on public.leads (organization_id);
create index idx_leads_org_email on public.leads (organization_id, email);
-- tela de listagem filtra por org + último evento (agregação na UI de Leads)
create index idx_leads_org_ultimo_evento on public.leads (organization_id, ultimo_evento);

-- lead_tags
create index idx_lead_tags_lead_id on public.lead_tags (lead_id);
create index idx_lead_tags_tag_id on public.lead_tags (tag_id);

-- lead_metrics
create index idx_lead_metrics_lead_id on public.lead_metrics (lead_id);
create index idx_lead_metrics_organization_id on public.lead_metrics (organization_id);
create index idx_lead_metrics_etapa_email_origem_id on public.lead_metrics (etapa_email_origem_id);

-- templates
create index idx_templates_organization_id on public.templates (organization_id);

-- domains
create index idx_domains_organization_id on public.domains (organization_id);

-- domain_dns_records
create index idx_domain_dns_records_domain_id on public.domain_dns_records (domain_id);

-- emails
create index idx_emails_organization_id on public.emails (organization_id);
create index idx_emails_dominio_id on public.emails (dominio_id);

-- webhooks
create index idx_webhooks_organization_id on public.webhooks (organization_id);

-- webhook_event_types
create index idx_webhook_event_types_webhook_id on public.webhook_event_types (webhook_id);

-- campaigns
create index idx_campaigns_organization_id on public.campaigns (organization_id);
create index idx_campaigns_template_id on public.campaigns (template_id);
create index idx_campaigns_criador_id on public.campaigns (criador_id);
-- tela de listagem filtra campanhas ativas/por status dentro da org
create index idx_campaigns_org_status on public.campaigns (organization_id, status_campanha);

-- campaign_flows
create index idx_campaign_flows_organization_id on public.campaign_flows (organization_id);

-- flow_meta_tags
create index idx_flow_meta_tags_flow_id on public.flow_meta_tags (flow_id);
create index idx_flow_meta_tags_tag_id on public.flow_meta_tags (tag_id);

-- flow_steps
create index idx_flow_steps_flow_id on public.flow_steps (flow_id);
create index idx_flow_steps_organization_id on public.flow_steps (organization_id);
create index idx_flow_steps_email_id on public.flow_steps (email_id);
create index idx_flow_steps_webhook_id on public.flow_steps (webhook_id);
create index idx_flow_steps_fluxo_alvo_id on public.flow_steps (fluxo_alvo_id);

-- step_*_tags
create index idx_step_trigger_tags_step_id on public.step_trigger_tags (step_id);
create index idx_step_trigger_tags_tag_id on public.step_trigger_tags (tag_id);
create index idx_step_add_tags_step_id on public.step_add_tags (step_id);
create index idx_step_add_tags_tag_id on public.step_add_tags (tag_id);
create index idx_step_remove_tags_step_id on public.step_remove_tags (step_id);
create index idx_step_remove_tags_tag_id on public.step_remove_tags (tag_id);

-- campaign_stats
create index idx_campaign_stats_organization_id on public.campaign_stats (organization_id);

-- dashboard_stats
create index idx_dashboard_stats_organization_id on public.dashboard_stats (organization_id);
create index idx_dashboard_stats_profile_id on public.dashboard_stats (profile_id);

-- ai_suggestions
create index idx_ai_suggestions_campaign_stats_id on public.ai_suggestions (campaign_stats_id);
create index idx_ai_suggestions_dashboard_stats_id on public.ai_suggestions (dashboard_stats_id);
create index idx_ai_suggestions_organization_id on public.ai_suggestions (organization_id);

-- webhook_events
create index idx_webhook_events_organization_id on public.webhook_events (organization_id);
create index idx_webhook_events_webhook_id on public.webhook_events (webhook_id);
create index idx_webhook_events_campaign_id on public.webhook_events (campaign_id);
create index idx_webhook_events_lead_id on public.webhook_events (lead_id);
-- timeline append-only: últimos eventos por org em ordem cronológica
create index idx_webhook_events_org_created on public.webhook_events (organization_id, created_at desc);

-- email_events
create index idx_email_events_organization_id on public.email_events (organization_id);
create index idx_email_events_campaign_id on public.email_events (campaign_id);
create index idx_email_events_lead_metric_id on public.email_events (lead_metric_id);
-- dedup SendGrid: unique parcial (só quando sg_event_id presente; NULLs não colidem)
create unique index uq_email_events_sg_event_id
  on public.email_events (sg_event_id)
  where sg_event_id is not null;
-- timeline append-only: eventos por org em ordem cronológica
create index idx_email_events_org_created on public.email_events (organization_id, created_at desc);

-- scheduled_steps (FILA: índice PARCIAL focado nos estados que a fila varre)
-- A fila lê WHERE status_agendamento in ('Iniciado','Em andamento') AND run_at <= now()
-- ORDER BY run_at. O parcial mantém o índice pequeno (não indexa Finalizado/
-- Encerrado por Meta) e o pop O(log n) sobre poucas linhas pendentes.
create index idx_scheduled_steps_pending_run_at on public.scheduled_steps (run_at)
  where status_agendamento in ('Iniciado', 'Em andamento');
create index idx_scheduled_steps_organization_id on public.scheduled_steps (organization_id);
create index idx_scheduled_steps_step_id on public.scheduled_steps (step_id);
create index idx_scheduled_steps_lead_id on public.scheduled_steps (lead_id);
create index idx_scheduled_steps_webhook_event_id on public.scheduled_steps (webhook_event_id);

-- support_conversations
create index idx_support_conversations_organization_id on public.support_conversations (organization_id);
create index idx_support_conversations_cliente_id on public.support_conversations (cliente_id);
create index idx_support_conversations_assigned_to on public.support_conversations (assigned_to);

-- support_messages
create index idx_support_messages_conversation_id on public.support_messages (conversation_id);
create index idx_support_messages_profile_id on public.support_messages (profile_id);
-- timeline do chat: mensagens de uma conversa em ordem cronológica
create index idx_support_messages_conv_created on public.support_messages (conversation_id, created_at);

-- error_logs
create index idx_error_logs_organization_id on public.error_logs (organization_id);
