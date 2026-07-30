# Planos: cobrança real — Design

**Goal:** fazer as regras de assinatura que a página de vendas anuncia valerem dinheiro de verdade — hoje os gates existem, estão corretos e não se aplicam a ninguém.

**Escopo escolhido:** "começar a cobrar de verdade". Créditos de SMS pré-pagos e comissão de agência ficam de fora (subsistemas de faturamento inteiros); a página é ajustada onde promete o que não existe.

---

## Contexto medido em produção (2026-07-30)

Números levantados, não estimados:

| Fato | Evidência |
|---|---|
| As 9 organizações estão com `limites_isentos = true` | `org_pode()` retorna `true` de saída para todas — os gates do `0061_plan_gates` não se aplicam a ninguém |
| Só a **Digital** (Starter) estoura o plano | 5 `postback_tokens` para `limite_integracoes = 3` |
| Consumo está muito abaixo da franquia | máximo 163 mensagens no período, de 25.000 (Loja do João) |
| Excedente acumulado é zero em todas | `usage_counters.execucoes_excedente = 0` |
| Nenhum Starter usa recurso de tier superior | 0 `sms_messages` e 0 `bulk_sends` em todas as orgs Starter |
| WhatsApp é single-tenant | `zapi_instance_id` e `zapi_token` são secrets **globais** no Vault; não há variante por org |
| Preço e limites dos 3 planos já conferem com a página | `97/970/5/5000/3`, `197/1970/10/25000/10`, `397/3970/50/100000/ilimitado` |

Consequência: ativar a cobrança é muito menos arriscado do que parecia. O único impacto real é a Digital, e ele é não-destrutivo (ver Peça 1).

---

## Decisões tomadas sem resposta do cliente

Estas três foram perguntadas e o retorno foi "pode avançar". Ficam registradas aqui porque são **decisões comerciais**, e reverter qualquer uma delas é barato (uma linha de migration).

### 1. Excedente por mensagem, escalonado por plano

| Plano | Franquia | Preço/mensagem excedente |
|---|---|---|
| Starter | 5.000 | R$ 0,020 |
| Pro | 25.000 | R$ 0,010 |
| Scale | 100.000 | R$ 0,005 |

**Razão:** faz o upgrade ser sempre a escolha racional em 2× a franquia, sem punir ninguém.

- Starter mandando 10.000: `97 + 5.000 × 0,02 = R$ 197` — exatamente o preço do Pro, onde teria 25.000.
- Pro mandando 50.000: `197 + 25.000 × 0,01 = R$ 447` contra R$ 397 do Scale por 100.000.

O cliente nunca paga mais que o tier de cima sem perceber, e o excedente cobre o custo marginal em vez de virar armadilha.

### 2. Digital fica travada nas 5 integrações que já tem

Subir o plano de um cliente é ato comercial. A trava não destrói nada: o `trg_limite_integracoes` é `INSERT`-only e conta as linhas existentes, então ela mantém as 5 e só é bloqueada ao criar a 6ª, com mensagem de erro que já sugere upgrade.

**Ação de follow-up para o time comercial:** decidir se a Digital sobe para Pro.

### 3. Semestral arredondado para baixo

| Plano | Mensal × 6 | -8% exato | **Valor adotado** | Desconto real |
|---|---|---|---|---|
| Starter | 582,00 | 535,44 | **535** | 8,08% |
| Pro | 1.182,00 | 1.087,44 | **1.087** | 8,04% |
| Scale | 2.382,00 | 2.191,44 | **2.191** | 8,02% |

Arredondar **para baixo** garante que o desconto real nunca fique abaixo dos -8% que a página anuncia. Arredondar para cima criaria um desalinhamento novo dentro do trabalho de corrigir desalinhamentos.

---

## Non-goals

Fora deste ciclo, deliberadamente:

- **Créditos de SMS pré-pagos** — carteira, recarga via Pix, débito por envio, saldo, alerta. Subsistema de faturamento inteiro. A página deixa de vender os 3 pacotes até existir.
- **Comissão recorrente de agência** — apuração e repasse. A parte de produto (multi-contas, limites por cliente) já existe e é verdadeira; só a comissão automática não.
- **Multi-número de WhatsApp** — decisão de produto tomada: número único da plataforma **é** o produto. Não entra no roadmap.
- **Alerta de 80% da franquia** — prometido na FAQ, não implementado. Fica para um ciclo próprio; com o consumo atual (máx. 163 de 25.000) não é urgente.
- **Proração de upgrade/downgrade** — a FAQ promete, e o fluxo do Asaas não foi auditado. Não afirmar que está alinhado.

---

## Peças

### Peça 1 — Ativar a cobrança

> **CANCELADA em 2026-07-30, por decisão do cliente.** Esta peça NÃO foi e NÃO deve ser executada. As 9 organizações existentes permanecem, de propósito, com `limites_isentos = true` — ficam de fora do enforcement para fins de teste. Nenhuma migration `0064` foi escrita (ver nota no cabeçalho de `0063_planos_schema_e_precos.sql`). O texto abaixo descreve o plano original e fica registrado por histórico da decisão — não é uma instrução pendente.
>
> Consequência prática: a asserção em "Testes" (`select count(*) from public.organizations where limites_isentos;`) espera hoje **9**, não `0` como o texto original diz. Se você rodar essa asserção e ver `9`, isso é o estado correto e esperado — **não** rode o `update ... set limites_isentos = false` abaixo para "corrigir". Fazer isso ligaria o enforcement de cobrança em nove contas ao vivo contra uma decisão comercial explícita do cliente.

**Arquivo:** `supabase/migrations/0063_ativar_cobranca_planos.sql`

`update public.organizations set limites_isentos = false` nas 9 orgs.

Impacto medido: 8 das 9 seguem exatamente como estão. A Digital mantém as 5 integrações e passa a ser bloqueada na 6ª.

**Erro esperado e desejado:** `limite_integracoes_atingido` (errcode `check_violation`), com a mensagem que o trigger já emite. O front precisa exibir essa mensagem em vez de um erro genérico — verificar o tratamento em `src/routes/Integrations.jsx`.

**Rollback:** `update public.organizations set limites_isentos = true;` (as 9 estavam isentas, então restaurar em bloco devolve o estado exato de 2026-07-30).

### Peça 2 — Precificar o excedente

**Arquivo:** mesma migration `0063`.

Não há código a escrever. `bulk_reserve_usage` já acumula em `execucoes_excedente` e `reset_usage_cycles` já arquiva em `usage_period_history` copiando `preco_excedente` do plano. Falta apenas o valor:

```sql
update public.plans set preco_excedente = 0.020 where nome = 'Starter';
update public.plans set preco_excedente = 0.010 where nome = 'Pro';
update public.plans set preco_excedente = 0.005 where nome = 'Scale';
```

**Conflito de modelo com a página, resolvido a favor do que existe:** a página vende "contratar um pacote adicional de mensagens na hora"; o que está construído é excedente por mensagem, automático. O automático fica — é ele que sustenta a promessa da FAQ de que as automações não param no meio de uma recuperação. A página muda (ver Copy).

### Peça 3 — Ciclo semestral

**Arquivos:** migration `0063` + `supabase/functions/asaas/index.ts`

```sql
alter table public.plans add column if not exists valor_semestral numeric;
update public.plans set valor_semestral = 535   where nome = 'Starter';
update public.plans set valor_semestral = 1087  where nome = 'Pro';
update public.plans set valor_semestral = 2191  where nome = 'Scale';
```

**Duas mudanças, e a primeira é fácil de esquecer.**

**a) O `select` do plano precisa trazer a coluna nova.** Hoje `asaas/index.ts:132` faz:

```ts
.select("id, nome, valor_mensal, valor_anual, status")
```

Sem incluir `valor_semestral` ali, `plan.valor_semestral` é `undefined` — não `null`. Isso importa por causa da guarda (ver abaixo).

**b) O cálculo em `asaas/index.ts:139`** hoje é binário (`YEARLY` ou mensal). Passa a três ramos:

```ts
const value = cycle === "YEARLY"       ? Number(plan.valor_anual)
            : cycle === "SEMIANNUALLY" ? Number(plan.valor_semestral)
            :                            Number(plan.valor_mensal);
```

**Guarda obrigatória.** A linha 142 hoje é `if (value <= 0) return json({ error: "invalid_plan_value" }, 400)`. Ela cobre `valor_semestral` nulo (`Number(null) === 0`), mas **não** cobre ausente: `Number(undefined)` é `NaN`, e `NaN <= 0` é `false` — passa direto. Trocar por:

```ts
if (!Number.isFinite(value) || value <= 0) return json({ error: "invalid_plan_value" }, 400);
```

Esse é o ponto de falha real da peça: sem a guarda, esquecer o item (a) faz o código criar assinatura com `value: NaN` no Asaas, silenciosamente.

`SEMIANNUALLY` é ciclo válido na API do Asaas — confirmar na doc antes de subir.

### Peça 4 — Número único de WhatsApp

**Arquivo:** migration `0063`.

```sql
alter table public.plans drop column if exists limite_numeros_whatsapp;
```

Coluna morta: nenhuma função, trigger ou linha de código a lê (verificado). Remover evita que alguém no futuro a interprete como regra ativa.

### Peça 5 — Fechar o formulário de planos

**Arquivos:** `src/api/mockApi.js` (`createPlan`, linha 1316) e `src/routes/Plans.jsx` (modal, linhas 70–90 e 275–276).

Hoje `createPlan` insere 6 campos. Os defaults do banco são:

| Campo | Default | Efeito num plano criado pela tela |
|---|---|---|
| `sms_habilitado` | `false` | seguro |
| `disparo_massa_habilitado` | `false` | seguro |
| `dominio_proprio_habilitado` | `false` | seguro |
| `prioridade_fila` | `0` | seguro |
| `preco_excedente` | `null` | excedente medido e **não faturado** |
| `limite_integracoes` | `null` | **integrações ilimitadas** — o trigger trata `null` como sem limite |

As capacidades booleanas são fail-closed e não preocupam. `limite_integracoes` nulo é o furo: um plano novo nasce vendendo integrações ilimitadas.

Incluir os campos no formulário e no insert. Sem esta peça, as Peças 1 e 2 valem até alguém criar um plano pela interface.

---

## Testes

O projeto não tem runner JS. Seguindo a convenção já usada (ver `2026-07-21-cta-link-recuperacao`):

**Lógica pura → `deno test`.** O cálculo de `value` por ciclo sai de `asaas/index.ts` para uma função testável, com casos: `MONTHLY`, `YEARLY`, `SEMIANNUALLY`, `valor_semestral` nulo, `valor_semestral` ausente (o caso `NaN`), ciclo desconhecido.

**Integração → SQL de asserção.** Após a migration:

> **Nota de 2026-07-30 (pós-cancelamento da Peça 1):** a primeira asserção abaixo foi escrita quando a Peça 1 ainda ia rodar. Peça 1 foi **cancelada** por decisão do cliente — as 9 organizações continuam de propósito com `limites_isentos = true`. A expectativa correta hoje é **9**, não `0`. Um resultado de `9` não é um rollout incompleto; é o estado desejado. Não "corrija" isso rodando `update ... set limites_isentos = false`.

```sql
-- nenhuma org isenta [CANCELADO 2026-07-30: Peça 1 não rodou — hoje espera-se 9, as 9 orgs seguem isentas de propósito]
select count(*) from public.organizations where limites_isentos;         -- espera 0 (original) → hoje espera 9
-- os 3 planos ativos têm preço de excedente e valor semestral
select count(*) from public.plans
 where status='Ativo' and deleted=false
   and (preco_excedente is null or valor_semestral is null);             -- espera 0
-- a coluna morta se foi
select count(*) from information_schema.columns
 where table_schema='public' and table_name='plans'
   and column_name='limite_numeros_whatsapp';                            -- espera 0
```

**Teste do gate da Digital**, sem gravar nada (o `rollback` desfaz):

```sql
begin;
  -- a 6ª integração da Digital deve falhar com errcode check_violation
  -- e mensagem 'limite_integracoes_atingido: o plano permite 3 integracao(oes)...'
  insert into public.postback_tokens (organization_id, token, ativo)
  select o.id, 'pbk_teste_gate_' || gen_random_uuid()::text, true
    from public.organizations o where o.nome = 'Digital';
rollback;
```

E o contraprova, que o gate **não** atrapalha quem está dentro do limite:

```sql
begin;
  insert into public.postback_tokens (organization_id, token, ativo)
  select o.id, 'pbk_teste_gate_' || gen_random_uuid()::text, true
    from public.organizations o where o.nome = 'Nayara ';   -- 0 de 3 integrações
rollback;   -- espera sucesso antes do rollback
```

---

## Rollout

Uma migration só (`0063`), transacional. Ordem interna: coluna nova → valores (`preco_excedente`, `valor_semestral`) → drop da coluna morta → **tirar a isenção por último**, para que nenhum gate fique ativo antes dos preços existirem.

Ordem entre migration e deploy: **migration primeiro, deploy do `asaas` depois.** O ramo `SEMIANNUALLY` só é alcançado quando alguém pedir esse ciclo, e ninguém pede enquanto a página não oferecer — mas se o deploy fosse primeiro, existiria uma janela em que o código lê `valor_semestral` de uma coluna que ainda não existe. Na ordem inversa não há janela nenhuma.

**Rollback completo:** restaurar `limites_isentos = true`, `preco_excedente = null`, dropar `valor_semestral`. A coluna `limite_numeros_whatsapp` removida não volta com dado — mas ela nunca teve uso, e os valores originais (1/2/4) estão registrados aqui.

---

## Copy da página (fora deste repo)

A landing não está neste repositório. Mudanças necessárias para a página parar de prometer o que não existe:

1. **Remover "1 número de WhatsApp conectado"** (Starter), **"2 números de WhatsApp"** (Pro) e **"4 números de WhatsApp"** (Scale).
2. **Reescrever a FAQ "De quem é o número de WhatsApp usado nos disparos?"** — hoje responde "Seu, da sua empresa. Você conecta o número da sua operação". O disparo sai do número da plataforma.
3. **Remover a seção de pacotes de créditos de SMS** (1.000/R$169, 5.000/R$749, 20.000/R$2.590) e a FAQ "Como funciona a cobrança do SMS?" — não existe carteira, saldo nem recarga.
4. **Trocar "contratar um pacote adicional de mensagens na hora"** por excedente automático por mensagem, com o preço do plano.
5. **Remover "% recorrente paga automaticamente"** do bloco Agências. O restante do bloco (multi-contas, limites por cliente, onboarding) é verdadeiro.
6. **Manter "avisamos quando você atingir 80%"** apenas se o alerta entrar num próximo ciclo; caso contrário, remover.

---

## Dependências e ordem

Peça 5 não depende das outras e pode ir primeiro. Peças 1–4 cabem numa migration. O ajuste de copy é independente e pode ser feito em paralelo por quem tem acesso à landing.
