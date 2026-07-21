# Link de recuperação no CTA dos e-mails — design

**Data:** 2026-07-21
**Autor:** Giuseppe + Claude
**Status:** proposto

## Contexto

O botão dos e-mails de recuperação ("Finalizar meu Pix agora") deve levar ao checkout
específico daquela transação. O encanamento para isso **já existe e funciona**:

- `postback-receiver` varre o payload atrás do melhor link de checkout
  (`extractRecoveryLink`, ~linha 306) e grava em `leads.link_recuperacao`.
- `process-steps` troca `{{cta_link}}` por esse link no envio (linhas 331, 494, 631).

O que quebrou foi a **origem do dado**:

| Formato do postback | Eventos | Com link | Período | Orgs |
|---|---|---|---|---|
| Payt nativo | 57 | 45 (79%) | 01–19/07 | 5 |
| **ENTITY (CloudEvents)** | **488** | **0** | 20–21/07 | 1 |

Em 2026-07-20 a integração passou a receber o envelope ENTITY. As chaves de `data` são
`endToEndId, items, amount, split, customer, providerId, currency, paymentProvider,
createdAt, externalId, status, netAmount, paidAt, id, method, fee` — **nenhuma URL, nenhum
código PIX copia-e-cola, nenhum QR**. Confirmado por varredura regex: zero ocorrências de
`https?://` nos payloads ENTITY sem `checkout_url`.

Resultado: 133 leads em "Pix Gerado", só 12 com link. Os outros 121 receberam (ou vão
receber) um e-mail que promete finalizar aquele PIX e que aponta para a home da loja
(`brands.link_loja`) ou para `#`.

**O extrator nunca quebrou — o dado deixou de chegar.** E, por causa do fallback silencioso
`lead.link_recuperacao || brand.link || "#"`, isso passou 488 eventos sem ninguém notar.

## Objetivos

1. O CTA dos e-mails de recuperação aponta para o checkout específico da transação.
2. Quando o link específico não existe, o e-mail **não é enviado** — e a falha fica visível.
3. Uma mudança futura no payload da plataforma é detectada em dias, não em centenas de eventos.

## Não-objetivos

- **Não** vamos embutir código PIX copia-e-cola nem QR no corpo do e-mail. A página
  `checkout.payt.com.br/qr-pix/<code>` da plataforma já mostra os dois; duplicar no e-mail
  adiciona um código que pode expirar dentro de uma mensagem que fica na caixa.
- **Não** vamos construir redirect próprio (`/r/<token>`) nesta fase.
- **Não** vamos consultar a API da plataforma no momento do envio nesta fase (plano B se a
  plataforma se recusar a incluir o campo).
- **Não** mexer no fluxo de e-mails não-transacionais, onde a home da loja é destino legítimo.

## Frente 1 — Ingestão do link (ENTITY)

**Pré-requisito operacional, bloqueante:** pedir à plataforma que inclua a URL de checkout
no payload ENTITY, e **capturar um evento real com o campo** antes de escrever a extração.
Escrever contra um nome de campo imaginado é repetir o erro que causou este problema.

Com o payload real em mãos:

1. **Extração determinística primeiro.** Ler o caminho explícito confirmado (ex.:
   `data.checkout.url`). Sem heurística.
2. **Varredor genérico como fallback** — `extractRecoveryLink` fica exatamente como está,
   servindo o Payt nativo e os demais provedores.
3. **Registrar qual dos dois resolveu** (`console.log` com o nome do extrator). Se o
   determinístico parar de acertar porque o payload mudou de novo, isso aparece nos logs
   antes de virar centenas de e-mails quebrados.

Sem migration: `leads.link_recuperacao` e `webhook_events.checkout_url` já existem.

## Frente 2 — Gate de envio

### Regra

Não enviar quando as três condições valem juntas:

1. O corpo do passo contém `{{cta_link}}`; **e**
2. `leads.ultimo_evento` é um evento de recuperação transacional; **e**
3. `leads.link_recuperacao` está vazio.

### Eventos de recuperação transacional

Constante única em `process-steps`, comentada:

```
Abandono de carrinho | Pix Gerado | Boleto Gerado | Depósito Solicitado | Compra Recusada
```

São os estados do enum `tipo_evento` em que existe uma transação pendente ou reprocessável
— ou seja, em que o CTA promete retomar algo específico. Ficam **de fora** os terminais,
onde a home da loja é destino legítimo: `Compra Aprovada`, `Compra cancelada`,
`Compra Reembolsada`, `Chargeback`, `Cancelamento de Assinatura`.

### Comportamento

- **Antes de reservar cota**, no mesmo ponto e com a mesma forma da checagem de supressão
  que já existe. Passo pulado não custa cota do plano.
- **Finaliza na hora, sem retry.** O link, quando vem, vem no mesmo postback que criou o
  lead; tentar de novo em 5 minutos não o faz aparecer, só atrasa a jornada.
- **Motivo explícito:** `last_error = 'sem link de recuperação'`, visível na jornada do lead
  como qualquer outro passo pulado.
- **Vale para os três canais** (e-mail, WhatsApp, SMS). Os três resolvem o mesmo
  `{{cta_link}}` com o mesmo fallback; travar só o e-mail deixaria o WhatsApp prometendo
  finalizar o PIX e mandando a pessoa para a home.
- **Checagem centralizada em uma função**, chamada nos três canais — não copiada três vezes.

### Risco aceito

A lista de eventos é regra implícita: um evento de recuperação novo, adicionado ao enum sem
entrar na lista, volta a enviar e-mail quebrado silenciosamente. A alternativa à prova disso
seria um campo explícito por passo ("requer link específico"), que custa schema e UI.
Decisão: manter a lista agora, concentrada numa constante única e comentada, de modo que o
ponto de manutenção seja óbvio em vez de espalhado.

## Frente 3 — Visibilidade

1. **Jornada do lead:** o passo pulado aparece com o motivo (herdado do mecanismo existente
   de `last_error`).
2. **Agregado:** query de taxa de passos pulados por `sem link de recuperação` por dia. É o
   número que teria mostrado o problema em 20/07, quando saltaria de 0% para ~90% num dia.
   Fica como query documentada, não como sistema de alerta.
3. **Ingestão:** log de qual extrator resolveu o link (Frente 1, item 3).

## Verificação

1. Capturar um postback ENTITY real já com o campo novo; escrever a extração contra ele.
2. `deno test` do gate (lógica pura): evento de recuperação + sem link → pula com o motivo
   certo; evento de recuperação + com link → envia; evento terminal + sem link → envia
   (fallback para a home continua legítimo); corpo sem `{{cta_link}}` → envia.
3. Fim a fim num lead de teste: postback → `leads.link_recuperacao` preenchido → e-mail com
   o botão apontando para o checkout correto.
4. Confirmar que o passo pulado **não** consumiu cota (comparar contador antes/depois).

## Riscos / decisões em aberto

- **A plataforma pode não incluir o campo.** Todo o desenho depende disso. Se recusarem, o
  plano B é a Frente C descartada (consulta à API no envio), que custa credencial por tenant
  e uma chamada de rede dentro do loop de envio.
- **Volume de envio cai no curto prazo.** Com o gate ligado e o campo ainda não chegando,
  os passos de recuperação de PIX passam a ser pulados em massa em vez de enviados
  quebrados. Isso é intencional e correto, mas precisa ser combinado com o cliente antes de
  subir — senão parece que a plataforma parou de funcionar.
- **`Compra Recusada` e `Depósito Solicitado`** entraram na lista de recuperação por
  analogia (transação pendente/reprocessável). Se na prática não houver link para esses
  casos, eles passam a ser pulados — revisar com dado depois da primeira semana.
