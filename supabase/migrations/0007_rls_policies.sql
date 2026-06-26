-- 0007_rls_policies.sql
-- Kobly — RLS HABILITADA em TODA tabela de public + policies explícitas por comando.
-- Usa helpers SECURITY DEFINER de 0006 (bypassam RLS -> sem recursão).
-- service_role ignora RLS (edge functions de ingestão). Nenhuma policy para anon.
-- Tabelas-filhas sem organization_id derivam acesso via EXISTS no pai.
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- ENABLE RLS EM TODAS AS TABELAS
-- ===========================================================================
alter table public.plans                    enable row level security;
alter table public.organizations            enable row level security;
alter table public.profiles                 enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.usage_counters           enable row level security;
alter table public.transactions             enable row level security;
alter table public.access_logs              enable row level security;
alter table public.active_sessions          enable row level security;
alter table public.tags                     enable row level security;
alter table public.leads                    enable row level security;
alter table public.lead_tags                enable row level security;
alter table public.lead_metrics             enable row level security;
alter table public.templates                enable row level security;
alter table public.domains                  enable row level security;
alter table public.domain_dns_records       enable row level security;
alter table public.emails                   enable row level security;
alter table public.webhooks                 enable row level security;
alter table public.webhook_event_types      enable row level security;
alter table public.campaigns                enable row level security;
alter table public.campaign_flows           enable row level security;
alter table public.flow_meta_tags           enable row level security;
alter table public.flow_steps               enable row level security;
alter table public.step_trigger_tags        enable row level security;
alter table public.step_add_tags            enable row level security;
alter table public.step_remove_tags         enable row level security;
alter table public.campaign_stats           enable row level security;
alter table public.dashboard_stats          enable row level security;
alter table public.ai_suggestions           enable row level security;
alter table public.webhook_events           enable row level security;
alter table public.email_events             enable row level security;
alter table public.scheduled_steps          enable row level security;
alter table public.support_conversations    enable row level security;
alter table public.support_messages         enable row level security;
alter table public.error_logs               enable row level security;
alter table public.faq                      enable row level security;

-- ===========================================================================
-- PROFILES
-- ===========================================================================
create policy profiles_select on public.profiles for select to authenticated
using (
  auth_id = auth.uid()
  or public.is_admin()
  or public.is_support()
  or (public.is_gestor() and public.has_org_access(organization_id))
);

create policy profiles_update on public.profiles for update to authenticated
using (auth_id = auth.uid() or public.is_admin())
with check (auth_id = auth.uid() or public.is_admin());

create policy profiles_insert on public.profiles for insert to authenticated
with check (public.is_admin());

create policy profiles_delete on public.profiles for delete to authenticated
using (public.is_admin());

-- ===========================================================================
-- ORGANIZATIONS
-- ===========================================================================
create policy organizations_select on public.organizations for select to authenticated
using (public.has_org_access(id) or public.is_support());

create policy organizations_insert on public.organizations for insert to authenticated
with check (public.is_admin());

create policy organizations_update on public.organizations for update to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy organizations_delete on public.organizations for delete to authenticated
using (public.is_admin());

-- ===========================================================================
-- ORGANIZATION_MEMBERSHIPS
-- ===========================================================================
create policy memberships_select on public.organization_memberships for select to authenticated
using (public.has_org_access(organization_id) or public.is_support());

create policy memberships_insert on public.organization_memberships for insert to authenticated
with check (public.is_admin());

create policy memberships_update on public.organization_memberships for update to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy memberships_delete on public.organization_memberships for delete to authenticated
using (public.is_admin());

-- ===========================================================================
-- PLANS (leitura para todo authenticated; escrita admin)
-- ===========================================================================
create policy plans_select on public.plans for select to authenticated
using (true);

create policy plans_insert on public.plans for insert to authenticated
with check (public.is_admin());

create policy plans_update on public.plans for update to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy plans_delete on public.plans for delete to authenticated
using (public.is_admin());

-- ===========================================================================
-- TEMPLATES (globais visíveis a todos; org-scoped por acesso)
-- ===========================================================================
create policy templates_select on public.templates for select to authenticated
using (organization_id is null or public.has_org_access(organization_id));

create policy templates_insert on public.templates for insert to authenticated
with check (
  (organization_id is null and public.is_admin())
  or public.has_org_access(organization_id)
);

create policy templates_update on public.templates for update to authenticated
using (
  (organization_id is null and public.is_admin())
  or public.has_org_access(organization_id)
)
with check (
  (organization_id is null and public.is_admin())
  or public.has_org_access(organization_id)
);

create policy templates_delete on public.templates for delete to authenticated
using (
  (organization_id is null and public.is_admin())
  or public.has_org_access(organization_id)
);

-- ===========================================================================
-- FAQ (leitura authenticated; escrita admin)
-- ===========================================================================
create policy faq_select on public.faq for select to authenticated
using (true);

create policy faq_insert on public.faq for insert to authenticated
with check (public.is_admin());

create policy faq_update on public.faq for update to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy faq_delete on public.faq for delete to authenticated
using (public.is_admin());

-- ===========================================================================
-- TABELAS ORG-SCOPED (ALL -> has_org_access(organization_id))
-- ===========================================================================
create policy tags_all on public.tags for all to authenticated
using (public.has_org_access(organization_id))
with check (public.has_org_access(organization_id));

create policy leads_all on public.leads for all to authenticated
using (public.has_org_access(organization_id))
with check (public.has_org_access(organization_id));

create policy lead_metrics_all on public.lead_metrics for all to authenticated
using (public.has_org_access(organization_id))
with check (public.has_org_access(organization_id));

create policy domains_all on public.domains for all to authenticated
using (public.has_org_access(organization_id))
with check (public.has_org_access(organization_id));

create policy emails_all on public.emails for all to authenticated
using (public.has_org_access(organization_id))
with check (public.has_org_access(organization_id));

create policy webhooks_all on public.webhooks for all to authenticated
using (public.has_org_access(organization_id))
with check (public.has_org_access(organization_id));

create policy campaigns_all on public.campaigns for all to authenticated
using (public.has_org_access(organization_id))
with check (public.has_org_access(organization_id));

create policy campaign_flows_all on public.campaign_flows for all to authenticated
using (public.has_org_access(organization_id))
with check (public.has_org_access(organization_id));

create policy flow_steps_all on public.flow_steps for all to authenticated
using (public.has_org_access(organization_id))
with check (public.has_org_access(organization_id));

create policy campaign_stats_all on public.campaign_stats for all to authenticated
using (public.has_org_access(organization_id))
with check (public.has_org_access(organization_id));

-- dashboard_stats consolidado de Gestor tem organization_id NULL (todas as
-- contas); has_org_access(NULL) é false para não-admin, o que tornaria o
-- próprio dashboard inacessível ao dono. Incluímos o dono via profile_id.
create policy dashboard_stats_all on public.dashboard_stats for all to authenticated
using (public.has_org_access(organization_id) or profile_id = public.current_profile_id())
with check (public.has_org_access(organization_id) or profile_id = public.current_profile_id());

-- ai_suggestions: escopo campanha herda acesso por organization_id; escopo
-- dashboard pode ter organization_id NULL, então deriva acesso do dashboard_stats
-- pai (cujo dono é resolvido por profile_id) ou do campaign_stats pai.
create policy ai_suggestions_all on public.ai_suggestions for all to authenticated
using (
  public.has_org_access(organization_id)
  or exists (
    select 1 from public.dashboard_stats ds
     where ds.id = ai_suggestions.dashboard_stats_id
       and (public.has_org_access(ds.organization_id) or ds.profile_id = public.current_profile_id())
  )
  or exists (
    select 1 from public.campaign_stats cs
     where cs.id = ai_suggestions.campaign_stats_id
       and public.has_org_access(cs.organization_id)
  )
)
with check (
  public.has_org_access(organization_id)
  or exists (
    select 1 from public.dashboard_stats ds
     where ds.id = ai_suggestions.dashboard_stats_id
       and (public.has_org_access(ds.organization_id) or ds.profile_id = public.current_profile_id())
  )
  or exists (
    select 1 from public.campaign_stats cs
     where cs.id = ai_suggestions.campaign_stats_id
       and public.has_org_access(cs.organization_id)
  )
);

create policy webhook_events_all on public.webhook_events for all to authenticated
using (public.has_org_access(organization_id))
with check (public.has_org_access(organization_id));

create policy email_events_all on public.email_events for all to authenticated
using (public.has_org_access(organization_id))
with check (public.has_org_access(organization_id));

create policy scheduled_steps_all on public.scheduled_steps for all to authenticated
using (public.has_org_access(organization_id))
with check (public.has_org_access(organization_id));

-- usage_counters e transactions: leitura por quem tem acesso à org; escrita
-- (cobrança/contadores) só por admin. service_role bypassa RLS e continua
-- gravando via edge. Sem isto, um Cliente poderia marcar transação como 'Pago'
-- ou zerar numero_execucoes para burlar o limite do plano.
create policy usage_counters_select on public.usage_counters for select to authenticated
using (public.has_org_access(organization_id));

create policy usage_counters_write on public.usage_counters for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy transactions_select on public.transactions for select to authenticated
using (public.has_org_access(organization_id));

create policy transactions_write on public.transactions for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- ===========================================================================
-- TABELAS-FILHAS SEM organization_id (acesso derivado via EXISTS no pai)
-- ===========================================================================

-- lead_tags -> via lead
create policy lead_tags_all on public.lead_tags for all to authenticated
using (exists (
  select 1 from public.leads l
   where l.id = lead_tags.lead_id and public.has_org_access(l.organization_id)
))
with check (exists (
  select 1 from public.leads l
   where l.id = lead_tags.lead_id and public.has_org_access(l.organization_id)
));

-- webhook_event_types -> via webhook
create policy webhook_event_types_all on public.webhook_event_types for all to authenticated
using (exists (
  select 1 from public.webhooks w
   where w.id = webhook_event_types.webhook_id and public.has_org_access(w.organization_id)
))
with check (exists (
  select 1 from public.webhooks w
   where w.id = webhook_event_types.webhook_id and public.has_org_access(w.organization_id)
));

-- domain_dns_records -> via domain
create policy domain_dns_records_all on public.domain_dns_records for all to authenticated
using (exists (
  select 1 from public.domains d
   where d.id = domain_dns_records.domain_id and public.has_org_access(d.organization_id)
))
with check (exists (
  select 1 from public.domains d
   where d.id = domain_dns_records.domain_id and public.has_org_access(d.organization_id)
));

-- flow_meta_tags -> via campaign_flows
create policy flow_meta_tags_all on public.flow_meta_tags for all to authenticated
using (exists (
  select 1 from public.campaign_flows f
   where f.id = flow_meta_tags.flow_id and public.has_org_access(f.organization_id)
))
with check (exists (
  select 1 from public.campaign_flows f
   where f.id = flow_meta_tags.flow_id and public.has_org_access(f.organization_id)
));

-- step_trigger_tags -> via flow_steps
create policy step_trigger_tags_all on public.step_trigger_tags for all to authenticated
using (exists (
  select 1 from public.flow_steps s
   where s.id = step_trigger_tags.step_id and public.has_org_access(s.organization_id)
))
with check (exists (
  select 1 from public.flow_steps s
   where s.id = step_trigger_tags.step_id and public.has_org_access(s.organization_id)
));

-- step_add_tags -> via flow_steps
create policy step_add_tags_all on public.step_add_tags for all to authenticated
using (exists (
  select 1 from public.flow_steps s
   where s.id = step_add_tags.step_id and public.has_org_access(s.organization_id)
))
with check (exists (
  select 1 from public.flow_steps s
   where s.id = step_add_tags.step_id and public.has_org_access(s.organization_id)
));

-- step_remove_tags -> via flow_steps
create policy step_remove_tags_all on public.step_remove_tags for all to authenticated
using (exists (
  select 1 from public.flow_steps s
   where s.id = step_remove_tags.step_id and public.has_org_access(s.organization_id)
))
with check (exists (
  select 1 from public.flow_steps s
   where s.id = step_remove_tags.step_id and public.has_org_access(s.organization_id)
));

-- ===========================================================================
-- ACCESS_LOGS (próprio OR admin OR support; INSERT admin/definer)
-- ===========================================================================
create policy access_logs_select on public.access_logs for select to authenticated
using (
  profile_id = public.current_profile_id()
  or public.is_admin()
  or public.is_support()
);

create policy access_logs_insert on public.access_logs for insert to authenticated
with check (public.is_admin());

create policy access_logs_delete on public.access_logs for delete to authenticated
using (profile_id = public.current_profile_id() or public.is_admin());

-- ===========================================================================
-- ACTIVE_SESSIONS (próprio OR admin OR support; encerrar sessão -> próprio/admin)
-- ===========================================================================
create policy active_sessions_select on public.active_sessions for select to authenticated
using (
  profile_id = public.current_profile_id()
  or public.is_admin()
  or public.is_support()
);

create policy active_sessions_insert on public.active_sessions for insert to authenticated
with check (profile_id = public.current_profile_id() or public.is_admin());

create policy active_sessions_update on public.active_sessions for update to authenticated
using (profile_id = public.current_profile_id() or public.is_admin())
with check (profile_id = public.current_profile_id() or public.is_admin());

create policy active_sessions_delete on public.active_sessions for delete to authenticated
using (profile_id = public.current_profile_id() or public.is_admin());

-- ===========================================================================
-- SUPPORT_CONVERSATIONS
-- ===========================================================================
create policy support_conversations_select on public.support_conversations for select to authenticated
using (
  public.is_admin()
  or public.is_support()
  or cliente_id = public.current_profile_id()
  or public.has_org_access(organization_id)
);

create policy support_conversations_insert on public.support_conversations for insert to authenticated
with check (
  public.is_admin()
  or public.is_support()
  or (cliente_id = public.current_profile_id() and public.has_org_access(organization_id))
);

create policy support_conversations_update on public.support_conversations for update to authenticated
using (
  public.is_admin()
  or public.is_support()
  or cliente_id = public.current_profile_id()
)
with check (
  public.is_admin()
  or public.is_support()
  or cliente_id = public.current_profile_id()
);

create policy support_conversations_delete on public.support_conversations for delete to authenticated
using (public.is_admin() or public.is_support());

-- ===========================================================================
-- SUPPORT_MESSAGES (acesso derivado da conversa; INSERT por participante)
-- ===========================================================================
create policy support_messages_select on public.support_messages for select to authenticated
using (exists (
  select 1 from public.support_conversations c
   where c.id = support_messages.conversation_id
     and (
       public.is_admin()
       or public.is_support()
       or c.cliente_id = public.current_profile_id()
       or public.has_org_access(c.organization_id)
     )
));

-- INSERT: além de exigir acesso à conversa, coage identidade — profile_id deve
-- ser o próprio autor, e só suporte/admin podem postar como 'suporte'/'sistema'.
-- Um Cliente só pode inserir mensagens com autor='cliente'. Evita falsificação
-- de identidade do atendente dentro do tenant.
create policy support_messages_insert on public.support_messages for insert to authenticated
with check (
  profile_id = public.current_profile_id()
  and (
    public.is_admin()
    or public.is_support()
    or autor = 'cliente'
  )
  and exists (
    select 1 from public.support_conversations c
     where c.id = support_messages.conversation_id
       and (
         public.is_admin()
         or public.is_support()
         or c.cliente_id = public.current_profile_id()
         or public.has_org_access(c.organization_id)
       )
  )
);

-- ===========================================================================
-- ERROR_LOGS (admin apenas)
-- ===========================================================================
create policy error_logs_select on public.error_logs for select to authenticated
using (public.is_admin());

create policy error_logs_insert on public.error_logs for insert to authenticated
with check (public.is_admin());
