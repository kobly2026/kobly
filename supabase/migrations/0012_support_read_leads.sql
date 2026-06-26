-- 0012_support_read_leads.sql
-- Kobly — fidelidade ao RBAC: o papel Suporte tem "Leads" no nav (store.jsx) e
-- viewAllAccounts:true; o mock (listLeads) entrega TODOS os leads ao Suporte.
-- As policies org-scoped originais só liberavam has_org_access (admin/membros),
-- então o Suporte (sem org/membership) via 0 leads. Aqui damos LEITURA (read-only)
-- de leads + lead_tags + lead_metrics ao Suporte, separando SELECT (admin/membro/suporte)
-- da ESCRITA (admin/membro) — Suporte NÃO escreve. Uma policy por comando (sem
-- reabrir multiple_permissive_policies).
-- ---------------------------------------------------------------------------

-- leads ---------------------------------------------------------------------
drop policy leads_all on public.leads;
create policy leads_select on public.leads for select to authenticated
  using (public.has_org_access(organization_id) or public.is_support());
create policy leads_insert on public.leads for insert to authenticated
  with check (public.has_org_access(organization_id));
create policy leads_update on public.leads for update to authenticated
  using (public.has_org_access(organization_id)) with check (public.has_org_access(organization_id));
create policy leads_delete on public.leads for delete to authenticated
  using (public.has_org_access(organization_id));

-- lead_metrics --------------------------------------------------------------
drop policy lead_metrics_all on public.lead_metrics;
create policy lead_metrics_select on public.lead_metrics for select to authenticated
  using (public.has_org_access(organization_id) or public.is_support());
create policy lead_metrics_insert on public.lead_metrics for insert to authenticated
  with check (public.has_org_access(organization_id));
create policy lead_metrics_update on public.lead_metrics for update to authenticated
  using (public.has_org_access(organization_id)) with check (public.has_org_access(organization_id));
create policy lead_metrics_delete on public.lead_metrics for delete to authenticated
  using (public.has_org_access(organization_id));

-- lead_tags (junção -> acesso via lead) -------------------------------------
drop policy lead_tags_all on public.lead_tags;
create policy lead_tags_select on public.lead_tags for select to authenticated
  using (exists (select 1 from public.leads l where l.id = lead_tags.lead_id
                 and (public.has_org_access(l.organization_id) or public.is_support())));
create policy lead_tags_insert on public.lead_tags for insert to authenticated
  with check (exists (select 1 from public.leads l where l.id = lead_tags.lead_id
                      and public.has_org_access(l.organization_id)));
create policy lead_tags_delete on public.lead_tags for delete to authenticated
  using (exists (select 1 from public.leads l where l.id = lead_tags.lead_id
                 and public.has_org_access(l.organization_id)));
