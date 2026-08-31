# EventPort Coding Standards

Conventions for contributing to this repository. When in doubt, match the
existing code — canonical examples are referenced per rule.

## Repository layout

- The monorepo contains exactly two apps: `apps/gateway` (Cloudflare Workers +
  D1) and `apps/site` (Next.js on Vercel). Do not create top-level source
  directories outside `apps/`.
- Agent adapter source code does **not** live in its own package. Each adapter
  is documented on the site under `apps/site/app/agent/<id>/` (see
  [Agent setup pages](#agent-setup-pages)).

## Imports (TypeScript / TSX)

Order imports in groups separated by a blank line:

1. Third-party packages and `next/*` builtins (also `import type` lines).
2. Internal modules — cross-directory via the `@/` alias, same-directory via
   `./`.
3. **CSS module imports go last, separated by a blank line** — never first,
   never in the middle.

```tsx
import type { Metadata } from "next";
import ReactMarkdown from "react-markdown";

import SiteLayout from "@/components/siteLayout";
import installMd from "./install.md";

import style from "./style.module.css";
```

Canonical example: `apps/site/app/agent/dsh/page.tsx`.

## Next.js App Router pages

- One `page.tsx` per route. It carries the route's `metadata` export and the
  rendering logic — do **not** add a separate `index.tsx` component file for a
  page.
- Shared chrome (header / nav / footer) lives in
  `apps/site/components/siteLayout/`. Public pages wrap their content in
  `<SiteLayout>`; the Agents dropdown is built into the layout (no standalone
  `nav.ts` — deleted on purpose). Pass `activeAdapter="dsh" | "pi" | "exec"`
  to highlight the current setup page.
- Nav anchors that target the landing page must be written as `/#section` (not
  `#section`) so they work from other pages.
- `trailingSlash: true` — internal links to site pages end with `/`
  (e.g. `/agent/dsh/`).

## Agent setup pages

Each adapter gets one directory under `apps/site/app/agent/` with exactly two
files:

- `install.md` — the full install guide. Adapter source code is embedded as
  fenced markdown code blocks. This is the single source of truth for adapter
  code: no `.txt` files, no string constants in TS, no `fs` reads, no
  standalone adapter packages.
- `page.tsx` — route entry: `metadata` + `<SiteLayout>` + `react-markdown`
  rendering of `install.md`.

`.md` files are imported as raw strings via `next.config.mjs` (turbopack
`rules` + `raw-loader`, webpack `asset/source`) and typed by
`apps/site/types/md.d.ts`. Render with `react-markdown` (component-based —
no `dangerouslySetInnerHTML`, no `markdown-it`).

### Content rules for install guides

- Example gateway URLs use `https://gw.eventport.dev` (never
  `*.workers.dev` placeholders or `example.com`).
- Document where each file must be saved on the user's machine, and give the
  exact env vars: `EG_URL`, `EG_TOKEN`, `EG_INTERVAL`, `EG_SOURCES`, `EG_DLQ`.
- State the delivery semantics: consume-on-read (at-most-once, no
  redelivery), local NDJSON dead-letter file, and the requirement that agent
  actions be idempotent by `messageId`.

## Naming: plans and quotas

This is an open-source project — **no billing-tier vocabulary**. There are no
"free / pro / enterprise" plans; there is a single internal anti-abuse quota
called `custom`:

- `PlanId = 'custom'` in both `apps/gateway/src/plans.ts` and
  `apps/site/lib/plans.ts` (the two files are deliberate copies — keep them
  in sync when changing limits).
- New user rows default to `'custom'` (`eg_users.plan`,
  `apps/gateway/schema.sql`).
- Docs and comments must not mention pricing, plans comparison, or upgrades.

## Styling

- CSS Modules (`*.module.css`) colocated with the component. No global
  stylesheets beyond `app/globals.css`.
- Use the design tokens from `globals.css` (`--bg`, `--fg`, `--fg-muted`,
  `--border`, `--accent`, `--surface`, ...) — with a fallback when used
  outside the site root, e.g. `var(--radius-md, 0.75rem)`.
- Spacing follows the 4px grid: rem values step by 0.25.
- Nested CSS is fine (style.module.css files use nesting); keep selectors
  scoped to the component's own class names.
- Interactive states (hover, focus-visible, disabled) must have visible styles
  for all nav and copy affordances.

## Code style

- Comments and docs are written in English.
- Quotes: gateway uses single quotes, site uses double quotes (both are
  Prettier-formatted — run the existing formatter conventions, don't mix).
- Gateway response helpers: use `json()` from `apps/gateway/src/utils/http.ts`
  for all JSON responses.
- SQL lives in `apps/gateway/src/db.ts` (gateway) and via the `/internal/sql`
  proxy (site) — site code never talks to D1 directly.

## Dashboard UI

- User-facing strings go through the i18n dictionary
  (`apps/site/app/dashboard/i18n/dict.ts`) with both `en` and `zh` entries —
  no hardcoded copy in dashboard components.
- Keys are dot-namespaced by feature, e.g. `card.agent.guides`.

## Testing

- Gateway tests use Vitest under `apps/gateway/test/`
  (`pnpm --filter gateway test`).
- Seed data goes through the helpers in `test/utils.ts`
  (`seedToken`, `seedEvent`, ...); token plans are seeded as
  `'custom'`.
- Type-check both apps before handing off:
  `pnpm --filter gateway exec tsc --noEmit` and
  `pnpm --filter site exec tsc --noEmit`.

## Build verification

`pnpm build` for the site requires env vars at build time; verify locally with:

```bash
NEXT_PUBLIC_GATEWAY_URL=https://gw.eventport.dev \
INTERNAL_SQL_SECRET=dev-secret \
SESSION_SECRET=dev-session-secret-0123456789abcdefghij \
pnpm --filter site build
```

Gateway tests must stay green: 10 files / 141 tests as of writing.
