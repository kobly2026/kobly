# Documento de entrega para o cliente — reformulação

**Data:** 2026-07-21
**Arquivo alvo:** `~/Downloads/kobly-plataforma-dizevolv-atualizado.html` (substitui a versão técnica)

## Problema

A versão atual do documento foi escrita para engenheiro: 11 seções técnicas, tabela de 57 migrations,
contagem de índices e políticas RLS, nomes de função SQL e de Edge Function. O cliente (Vitor Leite,
não-técnico) não consegue extrair dele nem "o que eu comprei está pronto?" nem "o que eu faço com isso?".

## Objetivo

Um documento que serve a dois propósitos ao mesmo tempo:

1. **Prova de entrega** — o que foi prometido no escopo original está pronto?
2. **Guia do que a plataforma faz** — o que o cliente consegue fazer lá dentro?

Não é peça comercial. O detalhe técnico não some: fica num apêndice recolhido no mesmo arquivo.

## Decisões

| Decisão | Escolha | Por quê |
|---|---|---|
| Organização do corpo | Jornada de uso em 7 passos, com selo de entrega | Narrativa natural para leigo; evita repetir cada assunto duas vezes (uma no checklist, outra no guia) |
| Prova de entrega | Placar no topo: promessa → status | Responde a pergunta do contrato em 30 segundos, antes de qualquer detalhe |
| Detalhe técnico | Apêndice `<janela>` fechada por padrão, um arquivo só | Cliente não tropeça nele; equipe técnica não perde a referência |
| Pendências | Seção própria em linguagem de negócio | Prova de entrega sem pendência não tem credibilidade |
| Arquivo | Um só, substituindo o atual | Pedido explícito do cliente |

## Estrutura

1. **Abertura** — o que a plataforma é, em três frases, sem jargão.
2. **Placar de entrega** — 10 promessas do escopo original com status (entregue / parcial / não construído).
3. **A jornada em 7 passos** — cada passo em duas colunas: *o que você faz* / *o que a plataforma faz por você*.
   1. Conectar seu checkout
   2. Configurar a identidade da loja
   3. Montar a campanha
   4. Criar o conteúdo
   5. Disparar
   6. Acompanhar o resultado
   7. Operar o negócio
4. **O que a plataforma faz sozinha** — a parte invisível que sustenta confiança (supressão, retentativa,
   parar de insistir com quem comprou, dead-letter, estorno de cota, reputação de envio).
5. **O que vem a seguir** — pendências reais, verificadas no código.
6. **Apêndice técnico** (recolhido) — números do banco, Edge Functions, migrations, segurança.

## Verificações feitas antes de escrever

- **PDF/CSV:** `grep -rniE "csv|jspdf|exportar" src/` → zero ocorrências. Pendência real.
- **Reply-To:** só existe em `database.types.ts` e nos senders; **nenhuma UI**. O motor usa, o cliente
  não tem onde configurar. Pendência real.
- **White label:** `brands` dá logo/cor/tema por marca nos e-mails e domínio próprio opcional, mas o
  AppShell continua Koblay. Status **parcial**, confirmado com o usuário.
- Contagens de plataforma conferidas no projeto Supabase vivo (45 tabelas, 94 policies, 16 Edge
  Functions ACTIVE, 57 migrations).

## Fora de escopo

- Não é material de venda para os clientes finais do Vitor.
- Não altera código da plataforma — só o documento.

## Regra de honestidade

O placar afirma compromisso contratual. Nenhuma linha marcada "entregue" sem que o recurso esteja
verificado no código ou no banco. "Parcial" e "não construído" aparecem com a mesma proeminência
visual de "entregue" — a seção de pendências não é rodapé.
