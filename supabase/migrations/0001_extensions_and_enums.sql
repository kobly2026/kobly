-- 0001_extensions_and_enums.sql
-- Kobly — extensões necessárias + os 15 enums principais (+ auxiliares).
-- Aplicável numa base Supabase vazia. Valores de enum EXATOS (com acentos) conforme o brief.
-- ---------------------------------------------------------------------------

-- Extensões. pgcrypto e uuid-ossp normalmente já vêm no schema `extensions` no Supabase;
-- usamos `create extension if not exists` para tornar o arquivo auto-suficiente/idempotente.
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists citext with schema extensions;
create extension if not exists moddatetime with schema extensions;

-- ---------------------------------------------------------------------------
-- ENUMS principais (15)
-- ---------------------------------------------------------------------------

create type public.status_user as enum ('Ativo', 'Desabilitado', 'Pendente');

create type public.tipo_user_geral as enum ('Gestor', 'Cliente', 'Suporte', 'Administrador');

-- inclui 'Rascunho' (usado por createCampaign e camp_4 no mock)
create type public.status_campanha as enum ('Ativa', 'Pausada', 'Finalizada', 'Inativa', 'Pendente', 'Rascunho');

create type public.status_agendamento as enum ('Iniciado', 'Em andamento', 'Encerrado por Meta', 'Finalizado');

create type public.status_criticidade as enum ('Crítico', 'Mediano', 'Bom', 'Excelente', 'Não Iniciado');

create type public.status_pagamento as enum ('Pago', 'Pendente', 'Pagamento recusado');

create type public.status_planos as enum ('Ativo', 'Inativo');

create type public.status_chamado as enum ('Em andamento', 'Resolvida');

create type public.prioridade_chamado as enum ('Alta', 'Média', 'Baixa');

create type public.tipo_chamado as enum ('Dúvidas', 'Integração com a Plataforma', 'Pagamento', 'Erros');

create type public.tipo_envio as enum ('email', 'SMS', 'Whatsapp');

create type public.tipo_card_fluxo as enum ('Gatilho', 'Adicionar Tag', 'Remover Tag', 'Envio de e-mail', 'Acionar Fluxo');

create type public.metodo_https as enum ('GET', 'POST', 'DELETE', 'PATCH');

create type public.tipo_evento as enum (
  'Abandono de carrinho', 'Boleto Gerado', 'Compra cancelada', 'Depósito Solicitado', 'Pix Gerado',
  'Chargeback', 'Cancelamento de Assinatura', 'Compra Reembolsada', 'Compra Aprovada', 'Compra Recusada'
);

create type public.tipo_template as enum (
  'Criar em Branco', 'Vender Curso', 'Abandono de Carrinho', 'Envio de oportunidade p/ Kobly CRM',
  'Marcar Leads eCommerce como oportunidades', 'Marcar Leads eCommerce como vendas', 'Pré-inscrição de curso',
  'Indique e Ganhe', 'Pós-venda', 'Cupom de Desconto', 'Resposta automática', 'Nutrição de Leads'
);

-- ---------------------------------------------------------------------------
-- ENUMS auxiliares
-- ---------------------------------------------------------------------------

create type public.dns_record_status as enum ('pendente', 'verificado');

create type public.autor_mensagem as enum ('cliente', 'suporte', 'sistema');
