# Link de recuperação no CTA dos e-mails — design

**Data:** 2026-07-21
**Autor:** Giuseppe + Claude
**Status:** proposto (v2 — a v1 foi derrubada por revisão adversarial; ver "O que mudou da v1")

## O que mudou da v1

A primeira versão deste spec assumia que o problema era o postback ter parado de mandar o
link, e propunha um gate que não enviaria o e-mail quando `leads.link_recuperacao` estivesse
vazio. Quatro revisores independentes acharam 28 problemas, 9 bloqueantes. Os três que
matam o desenho original:

1. **O gate seria um no-op.** Nenhum dos 21 passos de e-mail em campanhas Ativas usa
   `{{cta_link}}`. O gate proposto protegeria zero passos e a métrica ficaria cravada em 0%
   — o mesmo silêncio que ele existia para acabar, agora com selo de aprovação.
2. **`leads.ultimo_evento` é a fonte errada.** É sobrescrito por qualquer postback posterior
   do mesmo e-mail. Em 17 de 42 passos agendados (40%) ele já diverge do evento que criou o
   passo.
3. **`leads.link_recuperacao` é pegajoso.** Nunca é limpo (`postback-receiver:531` só grava
   quando o evento traz link). Um comprador recorrente passa no gate com o checkout de uma
   compra anterior — pior que botão morto, porque parece funcionar.

## Contexto

### O que está de fato quebrado

**(a) Os templates ativos não usam o placeholder.** Campanhas Ativas: 21 passos de e-mail,
**zero** com `{{cta_link}}`. Os destinos são fixos no HTML:

| Destino hardcoded | Passos ativos |
|---|---|
| `https://applotto.live/30off/` | 11 |
| `https://checkout.payt.com.br/2ef8206a06371a094ec06428718d95b8` | 7 |
| `href="#"` | 3 |

Os 7 do meio são o pior caso: **um único hash de checkout, o mesmo para todo comprador**.
Os 7 templates que usam `{{cta_link}}` estão todos em campanhas Rascunho.

**(b) O envelope ENTITY não traz link.** Desde 2026-07-20 a integração recebe CloudEvents;
as chaves de `data` são `endToEndId, items, amount, split, customer, providerId, currency,
paymentProvider, createdAt, externalId, status, netAmount, paidAt, id, method, fee` — nenhuma
URL, nenhum código PIX, nenhum QR (confirmado por varredura regex: zero `https?://`). Formato
anterior (Payt nativo): 45 de 57 eventos com link.

**(c) Não há fallback nenhum.** As 6 brands têm `link_loja` vazio
(`select count(*) filter (where coalesce(link_loja,'')='') from brands` → 6 de 6). Logo
`lead.link_recuperacao || brand.link || "#"` resolve para `#` sempre que o lead não tem link.
A v1 justificava deixar eventos terminais fora do gate porque "a home da loja é destino
legítimo" — não existe home nenhuma.

**(d) Nada está sendo agendado.** A plataforma posta no token `7384a44e` ("Nexopayt -
GERAL"), que não tem campanha Ativa amarrada. 496 eventos entre 20 e 21/07, 0 passos.
Já corrigida a **observabilidade** disso (commit `2ab7118`, `postback-receiver` v15: agora
responde `motivo_sem_agendamento`); a **configuração** segue pendente e é pré-requisito para
testar qualquer coisa deste spec.

### O que já funciona e não deve ser reinventado

- `extractRecoveryLink` (`postback-receiver:306`) varre o payload e grava em
  `leads.link_recuperacao` e `webhook_events.checkout_url`. Funciona — o dado é que sumiu.
- `process-steps` substitui `{{cta_link}}` no envio (linhas 331, 494, 631).
- `scheduled_steps.webhook_event_id` já aponta para o evento que originou o passo, e
  `webhook_events` guarda `tipo_evento` e `checkout_url` **imutáveis**. Esta é a fonte certa
  para tudo que a v1 tirava do lead.

## Objetivos

1. O CTA dos e-mails de recuperação aponta para o checkout **daquela transação**.
2. Quando não existe link utilizável, o e-mail **não é enviado**, e o motivo fica visível.
3. Uma mudança futura no payload da plataforma aparece em dias, não em centenas de eventos.

## Não-objetivos

- **Não** embutir código PIX copia-e-cola nem QR no corpo. *Premissa não verificada:* a
  página `checkout.payt.com.br/qr-pix/<code>` deve mostrar QR + copia-e-cola — **conferir
  manualmente numa transação de teste antes de fechar este não-objetivo.** Vale só para
  "Pix Gerado": os 18 links de "Abandono de carrinho" apontam para
  `checkout.payt.com.br/<hash>?cart=<code>`, que é checkout comum, sem QR.
- **Não** construir redirect próprio (`/r/<token>`).
- **Não** consultar a API da plataforma no envio (plano B se a plataforma recusar o campo).

---

## Frente 0 — Migrar os templates ativos para `{{cta_link}}` (PRÉ-REQUISITO)

**Sem esta frente, todo o resto é decorativo.** É também a resposta literal ao pedido
original ("colocar os links de checkout nos CTAs"): hoje o link não está lá, e nenhum
mecanismo de backend muda isso.

Os 21 passos ativos precisam trocar o `href` fixo por `{{cta_link}}`. Isso é **conteúdo do
cliente**, não código: a migração deve ser feita com ele, passo a passo, decidindo caso a
caso qual CTA de fato deve ser dinâmico. Os 7 que apontam para um único hash de checkout são
prioridade — hoje mandam todo comprador para o carrinho de outra pessoa.

Ação de produto complementar: o gerador de template (`src/lib/emailTemplate.js:80`, `button()`)
tem `href = '#'` como padrão. Trocar o default para `{{cta_link}}` faz o caminho certo ser o
caminho preguiçoso, e é o que impede a próxima campanha de nascer com botão morto.

## Frente 1 — Ingestão do link

**Pré-requisito operacional, bloqueante:** pedir à plataforma que inclua a URL de checkout no
payload ENTITY, e **capturar um evento real com o campo** antes de escrever a extração.
Escrever contra um nome de campo imaginado repetiria o erro que criou este problema.

1. **Extração determinística primeiro** — ler o caminho explícito confirmado. Sem heurística.
2. **Varredor genérico como fallback** — `extractRecoveryLink` fica como está, servindo o
   Payt nativo e os demais provedores.
3. **Validar o que vai ser gravado.** O varredor pontua por nome de chave e pode eleger uma
   URL qualquer. Aceitar apenas `https?://`, rejeitar host vazio. Um link inválido gravado é
   pior que link ausente: passa pelo gate e vira botão quebrado.
4. **Registrar qual extrator resolveu** (`console.log`), para que uma mudança de payload
   apareça antes de virar centenas de e-mails.

## Frente 2 — Resolver o CTA pelo evento gatilho, não pelo lead

Esta é a correção central da v1, e sozinha resolve três bloqueantes.

**Hoje:** `const ctaLink = lead.link_recuperacao || brand.link || "#"` (linhas 331, 494, 631).

**Passa a ser:** para passos originados de postback, o link vem de
`webhook_events.checkout_url` do **evento que criou o passo**, alcançado por
`scheduled_steps.webhook_event_id`. `leads.link_recuperacao` continua como fallback apenas
para passos sem `webhook_event_id` (criados fora de postback).

Por quê:
- `webhook_events` é **imutável**: o link e o `tipo_evento` são os daquela transação, não o
  estado atual do lead. Mata o problema do link pegajoso (comprador recorrente recebendo o
  checkout da compra anterior) e o da classificação errada por `ultimo_evento` sobrescrito.
- O dado já existe; não precisa de migration.

**Mudança de query necessária** (a v1 afirmava "sem migration" e esquecia disto): o select da
fila em `process-steps:187` traz `leads(id, email, nome, telefone, link_recuperacao, produto,
valor_compra)` e **não** traz `webhook_event_id` nem `webhook_events(...)`. Sem acrescentar,
o gate lê `undefined`, classifica tudo como não-transacional e libera 100% dos envios — falha
silenciosa, exatamente o modo de falha que este spec existe para eliminar.

## Frente 3 — Gate de envio

### Regra

Não enviar quando as três condições valem juntas:

1. **O passo vai renderizar um CTA dinâmico** — o corpo contém `{{cta_link}}`, **ou** (canal
   WhatsApp) existe botão sem `url` própria: `process-steps:508` faz
   `String(b?.url || "{{cta_link}}")`, ou seja, o botão usa o CTA **por padrão**, mesmo sem o
   placeholder aparecer em lugar nenhum; **e**
2. **O evento gatilho** (`webhook_events.tipo_evento`, não `leads.ultimo_evento`) é de
   recuperação transacional; **e**
3. **O link resolvido não é uma URL `http(s)` válida** — isto substitui o "campo vazio" da
   v1 e cobre de quebra o `#` e a string vazia, que hoje saem como botão morto sem
   visibilidade nenhuma.

### Eventos de recuperação transacional

Constante única e comentada em `process-steps`:

```
Abandono de carrinho | Pix Gerado | Boleto Gerado | Depósito Solicitado | Compra Recusada
```

Estados do enum `tipo_evento` com transação pendente ou reprocessável. Ficam de fora os
terminais: `Compra Aprovada`, `Compra cancelada`, `Compra Reembolsada`, `Chargeback`,
`Cancelamento de Assinatura`.

Sobre `Abandono de carrinho`: a revisão apontou que alguns passos de carrinho são oferta
genérica cujo destino natural seria a loja. Mantido na lista mesmo assim, porque (a) os 18
links reais de carrinho apontam para um checkout específico com `?cart=<code>`, e (b) sem
`link_loja` em nenhuma brand, o "destino natural" hoje é `#`. Se a Frente 0 preencher
`brands.link_loja`, revisar esta decisão com dado.

### Comportamento

- **Antes de reservar cota.** No e-mail isso é o padrão já existente (checagem de supressão
  em `:352`, imediatamente antes do `reserveOne` de `:377`). **Atenção:** esse padrão não
  existe nos outros canais — no WhatsApp o `reserveOne` está em `:546`, aninhado em
  `if (zapiInstanceId && zapiToken)` e **depois de uma chamada de rede ao Z-API**; o gate tem
  de ficar antes dela, não "no mesmo lugar da supressão".
- **`last_error = "pulado: sem link de recuperação"`** — com o prefixo `pulado:`, que é o
  contrato usado por `:313`, `:372`, `:379`. Sem ele o passo aparece como **falha vermelha**
  na jornada, não como pulado.
- **Finaliza na hora, sem retry.** Evidência: `select` cruzando primeiro evento e primeiro
  evento com link por lead → **0 de 33** leads receberam o link num postback posterior. O
  limite dessa evidência: os 33 são todos Payt nativo; sobre o ENTITY com o campo novo não há
  observação. Refazer a mesma query no primeiro período com o campo e confirmar 0 antes de
  manter o "sem retry".
- **Gate por passo, não por jornada.** Todos os passos do fluxo são enfileirados de uma vez
  (`postback-receiver:649-661`), então um fluxo de 3 passos sem link gera 3 pulos com o mesmo
  motivo. É o comportamento desejado (coerente com o pulo por condição); a métrica da Frente
  4 conta **passos**, não leads.
- **Vale para os três canais.** Nota factual que a v1 errou: o fallback do SMS é `""`
  (`:631`), não `"#"` como e-mail e WhatsApp — no SMS a URL some no meio da frase.
- **Checagem centralizada numa função** chamada pelos três canais, não copiada.

### Efeito colateral que precisa ser combinado antes de subir

Passo pulado não gera `email_events` com `status='enviado'`. A atribuição de venda recuperada
depende disso (`postback-receiver:565-571` só credita a campanha quando existe um envio
anterior à "Compra Aprovada"). Ou seja: com o gate ligado, o painel do cliente não mostra só
menos envios — mostra **receita recuperada caindo a zero enquanto as vendas continuam
acontecendo**. Isso precisa ser dito ao cliente antes, ou vira chamado de "a plataforma
parou". Se o KPI precisar continuar honesto, registrar o passo pulado de forma distinguível,
para o relatório separar "não recuperamos" de "nem tentamos".

## Frente 4 — Controle e visibilidade

1. **Chave de desligamento sem deploy.** Flag lida via `get_secret` (mesmo padrão dos outros
   segredos em `process-steps:111-183`), com default explícito. Sem isso, a única reversão de
   um falso positivo é um novo deploy.
2. **Ordem de entrega:** o gate (Frente 3) **só sobe depois** da extração determinística
   (Frente 1) estar em produção e confirmada com evento real. Subir antes leva o envio de
   recuperação de PIX a zero enquanto se espera a plataforma responder.
3. **Jornada:** o passo pulado aparece com o motivo (mecanismo de `last_error` existente).
4. **Agregado:** query de passos pulados por `pulado: sem link de recuperação` por dia.
5. **Ingestão:** log de qual extrator resolveu (Frente 1, item 4).

## Verificação

1. **Frente 0:** conferir que os 21 passos ativos passaram a usar `{{cta_link}}` e que o
   default do `button()` mudou.
2. Capturar um postback ENTITY real **já com o campo**; escrever a extração contra ele.
3. `deno test` da lógica pura do gate. Matriz mínima: evento transacional × link válido /
   link inválido (`#`, `""`, string não-URL) / sem link; evento terminal × sem link; corpo
   sem `{{cta_link}}` mas com botão WhatsApp sem url; `brand.link` ausente.
4. **Teste de integração do select** — o `deno test` puro recebe o campo pronto e passaria
   mesmo se a query não trouxesse `webhook_event_id`. Exercitar o caminho real.
5. Fim a fim: postback com link → passo agendado → e-mail com o botão no checkout certo.
6. Confirmar que o passo pulado **não** consumiu cota.
7. Confirmar que a queda de receita recuperada no painel é consequência do gate, não
   regressão de contagem.

## Riscos / decisões em aberto

- **Depende de configuração que não é código:** enquanto nenhuma campanha Ativa escutar o
  token `7384a44e`, nada é agendado e nada aqui é testável.
- **A plataforma pode recusar o campo.** Plano B: consulta à API no envio — custa credencial
  por tenant e uma chamada de rede dentro do loop.
- **Retroatividade:** o gate é avaliado no envio, então passos já enfileirados **são**
  alcançados. É o comportamento desejado (não faz sentido enviar quebrado o que ainda não
  saiu), mas significa que a fila atual pode esvaziar em pulos no primeiro tick.
- **A lista de eventos é regra implícita.** Um evento de recuperação novo, adicionado ao enum
  sem entrar na lista, volta a enviar quebrado em silêncio. Mitigação: constante única e
  comentada. A alternativa à prova disso é um campo por passo ("requer link específico"), que
  custa schema e UI — descartado por ora.
