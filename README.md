# Kobly — Console (Vite + React)

Console operacional de automação de marketing por e-mail. Front-end em **Vite + React 18**,
portado do protótipo Claude Design para uma estrutura componentizada e modular.

> Dados ainda são **mock** (`src/api/`). O backend **Supabase** entra pela "costura" descrita
> abaixo. A especificação de produto/dados/migração está em [`docs/`](docs/) (fonte da verdade).

## Stack
- **Vite 5** + **React 18** (JSX automático)
- **lucide-react** (ícones) · **apexcharts** (gráficos)
- CSS com design tokens (custom properties) — sem framework de UI
- Alias `@` → `src/`

## Scripts
```bash
npm install      # dependências
npm run dev      # servidor de desenvolvimento (http://localhost:5173)
npm run build    # build de produção -> dist/
npm run preview  # serve o build
```

## Estrutura
```
src/
  main.jsx            # entry — monta <App/> + importa styles
  App.jsx             # KoblyStoreProvider + Shell
  ds/                 # DESIGN SYSTEM (componentes) — import { Card, Button, ... } from '@/ds'
    Icon, Avatar, Badge, Button, Card, Checklist, IconButton, Input, MetricCard,
    Select, StatusLine, TemplateCard, DataTable, NavButton, NavRail
  lib/                # primitivos compartilhados
    ui.jsx            # Skeleton/EmptyState/Toast/Segmented/Drawer
    hooks.jsx         # useAsync/PageIntro/Field/Cluster
    motion.jsx        # Reveal/useEnter (motion state-driven)
    charts.jsx        # Chart/Sparkline (ApexCharts) + KoblyChartColors
    tweaks.jsx        # store de tweaks (localStorage) + useKoblyTweak
    tweaks-panel.jsx  # painel de tweaks + controles
  api/                # CAMADA DE DADOS (mock) — ver "Costura Supabase"
    mockData.js       # KoblyMockDB — seed/dados (espelha o modelo do legado)
    mockApi.js        # KoblyApi  — métodos async que a UI consome
    ai.js             # KoblyAI   — sugestões/geração de HTML (mock do n8n)
  store/store.jsx     # estado global: papel (RBAC), sessão, navegação, toast
  shell/              # AppShell (NavRail+Topbar+rota) · Topbar · AIAssistant · Onboarding · TweaksPanel
  routes/             # 13 telas: Dashboard, Campaigns, FlowBuilder, EmailEditor, Leads,
                      # Clients, Integrations, Reports, Plans, Tickets, Help, Security, Profile
  styles/             # tokens/ (colors, typography, spacing, effects) + components.css + global.css
public/assets/        # kobly-mark.svg (servido em /assets/...)
docs/                 # especificação técnica + plano de migração Supabase (fonte da verdade)
prototype/            # protótipo Claude Design original (referência; pode ser removido)
```

## Costura Supabase (onde o backend entra)
A UI depende **somente** das assinaturas de `KoblyApi` (`src/api/mockApi.js`). É o único ponto de
integração — troque o mock por Supabase sem mexer nas telas:

1. **Dados** → reimplemente cada método de `KoblyApi.*` (mesmos nomes e formatos de retorno) usando
   `@supabase/supabase-js`. `mockData.js` (seeds) é substituído por tabelas/queries no Supabase.
2. **Auth/RBAC** → `store.jsx` deriva a sessão de `KoblyApi.getSession(role)`. Troque por Supabase Auth
   + claim de papel (`@TipoUserGeral`: Gestor/Cliente/Suporte/Administrador) e mantenha o seletor de papel
   apenas para dev, ou remova-o.
3. **IA** → `ai.js` (`KoblyAI`) chama o que hoje é mock; aponte para Edge Functions / n8n / LLM.

O mapeamento Bubble→Supabase (tabelas, enums, RLS multi-tenant por `organization_id`, motor de
automação, fases) está em [`docs/02_PLANO_MIGRACAO.md`](docs/02_PLANO_MIGRACAO.md).

## Notas
- **Bundle de ícones**: `Icon` resolve nomes dinamicamente via `import * as Lucide`, o que inclui todo o
  lucide-react no bundle (~368 KB gzip). Otimização futura: registrar estaticamente apenas os ícones usados.
- Telas/shell exportam nomes `Kobly*` (ex.: `KoblyDashboard`) — herdado do protótipo; renomeável.
