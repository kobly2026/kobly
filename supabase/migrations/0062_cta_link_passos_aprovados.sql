-- 0062_cta_link_passos_aprovados.sql
-- Task 10 do plano 2026-07-21-cta-link-recuperacao: primeiro lote APROVADO.
--
-- Escopo aprovado (4 passos de 19). Os outros 15 seguem intocados de propósito:
--   - 10 apontam para https://applotto.live/30off/ (landing promocional, não
--     checkout) — decisão de marketing, não de engenharia;
--   -  5 apontam para o carrinho fixo do payt mas são disparados por "Pix Gerado",
--     cujo payload ainda NÃO traz a URL de checkout (Task 11, bloqueada na
--     plataforma). Converter agora só trocaria um link errado por um "#".
--
-- Por que estes 4:
--   * "Carrinho Abandonado - 3 toques" (3 passos) é recuperação de carrinho e o
--     gatilho "Abandono de carrinho" TRAZ o link (campo `link` no payload). Hoje os
--     três mandam todo destinatário para o MESMO carrinho de outra pessoa
--     (2ef8206a06371a094ec06428718d95b8) — está objetivamente errado.
--   * "Nova campanha" pos. 2 tem href="#": CTA morto saindo em produção. Gatilho é
--     "Pix Gerado" (sem link ainda), mas resolveCtaLink degrada para
--     lead.link_recuperacao > link da marca > "#", então o pior caso passa a ser a
--     loja em vez de um link morto.
--
-- Substituição verificada: cada um dos 4 corpos tem EXATAMENTE um href, uma
-- ocorrência (checado antes de aplicar), então o replace não pode atingir link de
-- descadastro, logo ou rastreio.
--
-- Rollback:
--   update public.emails set corpo_html = replace(corpo_html, 'href="{{cta_link}}"',
--     'href="https://checkout.payt.com.br/2ef8206a06371a094ec06428718d95b8"')
--    where id in ('ee56ccdc-4d5b-4233-acf5-61851f3d1d13',
--                 '0eaa11bc-45bc-47c7-a206-26774b81c980',
--                 '944e6059-3eb0-4f36-a5d9-280dfbe0aa12');
--   update public.emails set corpo_html = replace(corpo_html, 'href="{{cta_link}}"', 'href="#"')
--    where id = 'f79112b6-fc58-49a3-9d0d-ccefa96e78a4';
-- ---------------------------------------------------------------------------
do $$
declare
  n_payt int;
  n_hash int;
begin
  -- Lote A: carrinho fixo do payt -> CTA da transação
  update public.emails
     set corpo_html = replace(
           corpo_html,
           'href="https://checkout.payt.com.br/2ef8206a06371a094ec06428718d95b8"',
           'href="{{cta_link}}"'),
         updated_at = now()
   where id in ('ee56ccdc-4d5b-4233-acf5-61851f3d1d13',
                '0eaa11bc-45bc-47c7-a206-26774b81c980',
                '944e6059-3eb0-4f36-a5d9-280dfbe0aa12')
     and corpo_html like '%href="https://checkout.payt.com.br/2ef8206a06371a094ec06428718d95b8"%';
  get diagnostics n_payt = row_count;

  -- Lote B: href="#" morto -> CTA (degrada para link da marca, nunca pior que hoje)
  update public.emails
     set corpo_html = replace(corpo_html, 'href="#"', 'href="{{cta_link}}"'),
         updated_at = now()
   where id = 'f79112b6-fc58-49a3-9d0d-ccefa96e78a4'
     and corpo_html like '%href="#"%';
  get diagnostics n_hash = row_count;

  raise notice 'lote payt: % linhas | lote href-morto: % linhas', n_payt, n_hash;

  -- Idempotente: rodar de novo atualiza 0 linhas (os predicados não casam mais).
  -- Só falha se a primeira aplicação pegar menos linhas que o aprovado.
  if n_payt + n_hash not in (0, 4) then
    raise exception 'esperado 4 passos (ou 0 em reaplicacao), atualizados: %', n_payt + n_hash;
  end if;
end $$;
