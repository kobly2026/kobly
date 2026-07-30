-- 0052_patch_unsub_link.sql
-- Converte o link de descadastro legado (href="#") dos corpos de e-mail já salvos
-- para o placeholder {{unsubscribe_url}}, que os workers (process-bulk, process-steps,
-- send-email) substituem por um link real por destinatário no momento do envio.
-- Alvo restrito: apenas a âncora "Descadastrar" do rodapé — não toca em CTAs que
-- também usem href="#" (ex.: botão de ação principal do corpo do e-mail).
-- Padrão mantido em concordância com o regex usado pelos senders:
--   /href="#"(\s[^>]*>\s*Descadastrar)/i
-- ---------------------------------------------------------------------------
update public.emails
set corpo_html = regexp_replace(corpo_html, 'href="#"(\s[^>]*>\s*Descadastrar)', 'href="{{unsubscribe_url}}"\1', 'gi')
where corpo_html like '%Descadastrar%' and corpo_html like '%href="#"%';
