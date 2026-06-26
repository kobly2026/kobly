# Kobly — Design System

> Multichannel campaign-automation SaaS for sales recovery. This design system reconstructs Kobly's product UI from its written specification, with brand foundations, reusable components, and a click-through UI kit.

---

## 1. Product context

**Kobly** is a multichannel campaign-automation SaaS focused on **sales recovery**. It reacts to checkout events — cart abandonment (`cart_abandoned`), PIX generated (`pix_generated`), and approved purchase (`purchase_approved`) — and fires configurable cadences across **email, WhatsApp, and SMS**.

The product was originally built on **Bubble** and is being rebuilt on a modern code stack. Its core differentiator over the legacy build is operational safety: idempotency, per-tenant budget caps, circuit breakers, limited retries, and opt-out — all enforced from the core.

**Audience / roles**
- **Gestor de campanhas** — primary MVP user: creates campaigns, configures cadence, edits messages, reads metrics.
- **Agência / suporte** — operates multiple client workspaces; isolation, operational read access, future white-label.
- **Cliente final / infoprodutor** — offer owner; views and tweaks basic campaigns.
- **Admin interno (Kobly / Dizevolv)** — users, plans, support, audit, critical settings.

**Surfaces (routes):** Dashboard · Clientes · Campanhas · Leads · Integrações · Suporte (+ a technical Ledger surface folded into Dashboard/Integrações).

**Language:** the product is **Brazilian Portuguese**. All UI copy, labels, and sample content in this system are in pt-BR.

### Sources analysed
This system was built from materials provided to the project (stored under `uploads/`):
- `uploads/kobly-reconstruction-spec.md` — the canonical reconstruction spec (product overview, feature map, data model, workflows, RBAC, and a detailed **§10 UI/UX** section that defines the visual shell).
- `uploads/message (3).txt` — the discovery prompt used to produce that spec.

**Not available to this project** (referenced by the spec, treated as missing — flag to user if needed):
- The original **Bubble export** (`kobly-18665…bubble`) — inspected read-only previously; only boilerplate pages.
- The **codebase** (`src/core/*`, `public/*`, `migrations/*`) and **Figma** file — described in the spec but not attached here.
- Local screenshots `.local/dashboard.png`, `.local/dashboard-contracts-worker.png`.

Because the codebase and Figma were not attachable, **the system's structure derives from the spec's §10 values** (260px sidebar, 8px cards). The **color palette is the brand's own**, confirmed by the user (dark theme, orange `#FF6800` primary) — it supersedes the lighter shell the spec described. See **Caveats** at the end.

---

## 2. Content fundamentals

How Kobly writes copy:

- **Language:** Brazilian Portuguese (pt-BR). Operational, product-led, no marketing fluff.
- **Tone:** clear, calm, operational. It describes system state matter-of-factly ("Simule um webhook para iniciar a cadência", "Nenhum job agendado", "Campanha criada").
- **Person:** addresses the operator's task directly via imperatives and nouns rather than chatty "you/we". Labels are noun phrases ("Nova campanha", "Últimos eventos", "Saldo de budget").
- **Casing:** **Sentence case** everywhere — titles, buttons, labels ("Nova campanha", not "Nova Campanha" or ALL CAPS). Eyebrows/section kickers may be uppercase with wide tracking ("GESTOR / AGÊNCIA DEMO").
- **Status language is precise and technical** — it mirrors the domain vocabulary the operator must reason about: `draft`, `active`, `paused`, `archived`; job states `queued`, `processing`, `completed`, `blocked`, `dead_letter`; block reasons surfaced verbatim (`campaign_inactive`, `lead_not_found`, `budget_exhausted`, `provider_circuit_open`).
- **Empty / loading / error states are first-class.** Empty states instruct the next action ("Simule um webhook para iniciar a cadência"). Loading is a plain "Carregando…". Errors show the captured message on a status line — honest, not sugar-coated.
- **Numbers & units:** metrics are counts with a short label below ("Eventos aceitos", "Jobs na fila", "Dispatches enviados", "Budget restante"). PIX, R$ and pt-BR conventions apply.
- **Emoji:** **not used.** The product voice is operational/B2B; iconography carries meaning instead.
- **Provider & channel names** are written as proper nouns: Hotmart, Braip, Vega, Brevo, WhatsApp, SMS.

**Examples (verbatim from spec):** "Minhas campanhas > Nova campanha" (breadcrumb) · "Primeiros passos" with "progresso 2/3" · "Campanha criada" (success) · "Simule um webhook para iniciar a cadência" (empty) · eyebrow "Gestor / Agência Demo".

---

## 3. Visual foundations

The brand reads as a **dark operational console**: near-black surfaces, a single confident **orange** accent, and crisp light type. Flat and quiet — nothing decorative competes with data. (Palette confirmed by the user; it supersedes the lighter shell described in the reconstruction spec's §10.)

- **Color vibe:** dark and focused. **Laranja Primário `#FF6800`** is the single brand accent (primary action, links, active nav, key highlights, brand mark). Surfaces are a near-black ramp — app `#000000` (Preto Background), nav `#0d0d0d`, cards **Cinza Escuro `#1A1A1A`**. Text is **Branco `#F9F9F9`** (strong) → `#cfcfcf` (body) → **Cinza Claro `#808080`** (muted). Status colors are tuned to read on dark: green (active/approved), amber (paused/PIX), red (dead-letter/error/opt-out), orange-tint (sandbox/info), grey (draft/archived).
- **Type:** one humanist-geometric sans for everything (UI + display), a monospace for IDs, tokens, webhook payloads and signatures. Headings are near-white (`--text-strong`) semibold/bold with slightly tight tracking; body is light grey. *(Font substituted — see Caveats.)*
- **Backgrounds:** flat solid dark fills only. **No gradients, no imagery, no patterns, no textures, no glassmorphism.** App `#000`, cards `#1A1A1A`, nav `#0d0d0d`.
- **Cards:** `#1A1A1A` background, **1px** subtle border (`#242424`), **8px** radius. Depth reads through surface-color contrast (card vs `#000`) and borders more than shadow; shadows are black-based and subtle. Modals/popovers use a larger shadow (`--shadow-lg`/`--shadow-pop`).
- **Borders:** thin (1px), low-contrast dark grey (`--border-subtle` `#242424`, `--border-default` `#3a3a3a`). Tables and inputs lean on borders + spacing rather than heavy fills.
- **Corner radii:** 8px default for cards/inputs/buttons; 6px for small controls; pill (999px) for badges/tags; 4px micro.
- **Shadows:** black-based (`rgba(0,0,0,…)`), low–medium opacity. A 4-step elevation ramp (`xs → sm → md → lg`) plus a pop level for overlays.
- **Spacing & layout:** 4px base grid. Fixed two-column shell — **260px** sidebar + fluid content, content capped ~1180px with 32px padding. Topbar ~68px with eyebrow + route title + global actions. Generous whitespace; dense but breathable tables.
- **Hover states:** subtle. Nav items lift toward a `#1a1a1a` fill; primary (orange) buttons lighten one step (`--orange-400`); ghost/secondary buttons pick up a faint raised fill; links shift orange-500→orange-400; table rows get a faint `--surface-sunken` wash.
- **Press / active states:** primary buttons deepen to `--orange-600`; no scale-bounce. Interactions are restrained and instant-feeling.
- **Focus:** a 3px orange focus ring (`--shadow-focus`, `--ring`) — visible and accessible, never removed.
- **Transparency & blur:** used sparingly — active nav highlight is a translucent orange wash (`rgba(255,104,0,0.14)`); status pills use translucent tints on dark. No backdrop blur.
- **Motion:** minimal and functional. Short durations (120–200ms), `ease-out` / standard easing. Fades and small position shifts only — no bounces, no infinite decorative loops. Respect `prefers-reduced-motion`.
- **Density:** information-dense but orderly — this is an operational dashboard, not a marketing site. KPI metric cards, status badges, and tables are the workhorses.

---

## 4. Iconography

The original material does **not** define an icon system (no icon font, sprite, or SVG set was attachable). Kobly's UI relies on an orange `K` brand mark and conventional dashboard affordances.

- **Approach in this system:** **Lucide** (`https://unpkg.com/lucide@latest`) — a clean, consistent **outline** icon set (1.5–2px stroke, rounded joins) that matches Kobly's dark, flat, operational aesthetic. Loaded from CDN in components and kits. **This is a substitution** — flag if the real product uses a specific set.
- **Usage:** outline icons at 16–20px in nav, buttons, and table actions; stroke inherits `currentColor` so they pick up orange / light / grey from context. Icons are functional (nav, row actions, status), never decorative filler.
- **Emoji:** never used as icons.
- **Unicode chars:** avoided as icons; use Lucide glyphs.
- **Brand mark:** the **`K`** monogram on an orange rounded tile with a dark K (see `assets/`), used in the sidebar header and as a favicon-scale mark. Recreated from the spec's description ("marca `K`") in the confirmed brand colors — not an original logo file.

See `assets/` for the brand mark and the icon-usage note.

---

## 5. Index / manifest

**Root**
- `styles.css` — global entry point (consumers link this). `@import`s all tokens.
- `readme.md` — this guide.
- `SKILL.md` — Agent-Skills-compatible entry for downloaded use.

**`tokens/`** — `colors.css`, `typography.css`, `spacing.css`, `effects.css` (radii/borders/shadows/motion).

**`assets/`** — brand mark (`kobly-mark.svg`), icon-usage note.

**`guidelines/`** — foundation specimen cards (Colors, Type, Spacing, Brand) shown in the Design System tab.

**`components/core/`** — reusable React primitives (see cards in the Design System tab):
- `Button`, `IconButton` — actions (primary orange / secondary / ghost / danger; sizes; disabled; with icon).
- `Badge` — status pills (campaign/job states, modes, domains, permissions).
- `Card`, `MetricCard` — content panels and dashboard KPIs.
- `NavRail` / `NavButton` — the dark sidebar + primary nav.
- `DataTable` — clientes / campanhas / leads / integrações tables with row actions.
- `TemplateCard` — campaign-template chooser tile.
- `Checklist` — onboarding "Primeiros passos" with progress.
- `StatusLine` — success/error/info inline status messages.
- `Input`, `Select` — form controls.
- `Avatar` — user/workspace initial.

**`ui_kits/app/`** — high-fidelity click-through recreation of the Kobly operator app (Dashboard, Campanhas + Nova campanha, Leads, Suporte). Entry: `ui_kits/app/index.html`.

---

## Caveats

- **Fonts substituted.** No font was specified in the source material. Using **Plus Jakarta Sans** (UI/display) + **JetBrains Mono** (IDs/payloads), loaded from Google Fonts. Send the real brand fonts to swap in.
- **Icons substituted.** No icon system was provided. Using **Lucide** (outline). Confirm or replace with the real set.
- **Brand mark recreated** from the spec's "marca `K`" description — not an original logo asset. Provide the real logo to replace `assets/kobly-mark.svg`.
- **Colors confirmed by the user.** The palette (orange `#FF6800` primary; dark surfaces `#000`/`#1A1A1A`; `#808080`/`#F9F9F9`; text `#000`) comes from the user's brand spec and is authoritative.
- **No pixel sources for layout.** Codebase, Figma, and screenshots referenced by the reconstruction spec were not attachable, so layout details (paddings, exact component shapes) derive from the spec's §10 written values and may differ from the live product. Re-attach the codebase or Figma to tighten fidelity.
