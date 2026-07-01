-- 0020_whatsapp_enum.sql
-- Kobly — novo tipo de card do fluxo: 'Envio de WhatsApp' (canal Z-API).
-- O motor (process-steps) e o front chaveiam por flow_steps.tipo_card (enum
-- public.tipo_card_fluxo). ALTER TYPE ... ADD VALUE não pode coexistir com o
-- USO do novo valor na mesma transação — por isso esta migration é separada
-- da 0021 (tabelas/colunas WhatsApp).
-- ---------------------------------------------------------------------------

alter type public.tipo_card_fluxo add value if not exists 'Envio de WhatsApp';
