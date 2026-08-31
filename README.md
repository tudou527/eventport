# EventPort

A public webhook inbox for local AI agents.

> The public marketing site is branded **EventPort**.

```
External SaaS webhook
        ↓
Cloudflare Workers (gateway) — verify signature, buffer in D1
        ↑
Your agent polls GET /events on its own schedule
        ↓
Agent processes each pulled event (consumed on read)
```

## How it works

There is **no dedicated CLI to install**. Your agent (OpenClaw, Codex, DeepSeek
Harness, or any CLI agent) polls the gateway itself — or hand it one of the
adapter setup pages on the site (`/agent/dsh/`, `/agent/pi/`, `/agent/exec/`):
Each page is a self-contained install guide (with full source) that an agent
can follow on its own.

```
GET {GATEWAY_URL}/events?limit=1
Authorization: Bearer egc_xxx
```

Events are **consumed on read**: once returned by `GET /events`, they are
deleted from the gateway. Delivery is at-most-once; a poll that fails before
processing simply leaves events in place for the next cycle. Adapters
dead-letter failed events to a local NDJSON file so nothing is silently lost.

## Architecture

The project is split into two apps so the gateway stays small and cheap to run on Cloudflare Workers:

- **gateway** (Cloudflare Workers + D1): verifies webhook signatures, buffers events in a durable queue, serves them to polling agents, and exposes an internal SQL proxy for the site. It never issues API keys and does not manage users.
- **site** (Vercel + Next.js): landing page, email-OTP login (Google OAuth optional), dashboard, subscription / token lifecycle (create / list / revoke / rate-limit), and agent adapter setup pages (`/agent/*`) — self-contained install guides (source included) for DeepSeek Harness (`dsh`), Pi (`pi`), and any command-line agent (`exec`).

Storage is a single **Cloudflare D1** (SQLite) database bound directly to the
gateway Worker. The site (on Vercel) has no D1 binding, so it reads and writes
through the gateway's authenticated `POST /internal/sql` proxy. The full schema
lives in `apps/gateway/schema.sql`.

Each subscription has two tokens with different privileges:

- **Webhook token** (`egw_*`) — used by the upstream SaaS to call `POST /hooks/{apiKey}`. It cannot poll events.
- **Consumer token** (`egc_*`) — used by your agent to call `GET /events`. It cannot post webhooks.

The gateway enforces the token role on every request. Rate limits are per
token; the consumer rate limit is a uniform 60 requests/minute (anti-abuse
only).

## Sources

The gateway ships signature verifiers for these webhook sources (set `source` on the subscription to route to the matching verifier):

- github, linear, stripe, shopify, slack, hubspot, calendly, typeform

Any other source falls back to **custom** — the event is accepted without signature verification. Register a `signing_secret` on the subscription to verify your own payloads.

RSS, YouTube, X/Twitter, webpage monitoring, and email sources are on the roadmap.

## Monorepo layout

```
.
├── apps/
│   ├── gateway/   # Cloudflare Workers + D1: webhook receiver + poll API
│   └── site/      # Landing page + auth + dashboard + /agent/* setup guides
│       └── app/agent/         # One install.md per adapter, rendered by react-markdown
│           ├── dsh/  pi/  exec/
└── package.json   # pnpm workspace root
```

## Development

```bash
# Install dependencies
pnpm install

# Gateway local dev
pnpm dev:gateway

# Site local dev
pnpm dev:site
```

## Gateway setup

1. Create a D1 database (`wrangler d1 create eventport`) and wire it in
   `apps/gateway/wrangler.jsonc` (`d1_databases` binding `DB`).
2. Apply the schema to the remote database:

   ```bash
   cd apps/gateway && pnpm exec wrangler d1 execute eventport --remote --file=schema.sql -y
   ```
3. Set the shared secret for the site's SQL proxy:

   ```bash
   wrangler secret put INTERNAL_SQL_SECRET
   ```

4. Deploy:

```bash
pnpm deploy:gateway
```

## Database schema

All tables use the `eg_` prefix and target Cloudflare D1 (SQLite). The full DDL is in `apps/gateway/schema.sql`. Summary:

| Table | Purpose |
|-------|---------|
| `eg_users` | Dashboard users (managed by site); holds `plan`. |
| `eg_subscriptions` | One per webhook source; holds `source` + `signing_secret`, plus a `disabled` kill switch. |
| `eg_tokens` | Two per subscription: `egw_*` (webhook) / `egc_*` (consumer); `revoked_at` soft-deletes. |
| `eg_events` | One row per webhook event; deleted when pulled by `GET /events`. |
| `eg_rate_limits` | Per `(subscription_id, role, minute)` counter. |
| `eg_otp_codes` / `eg_otp_rate_limits` | Email OTP login (managed by site). |
| `eg_rejected_events_hourly` | Per-hour counter for backlog-exceeded rejections. |

## Site setup

The site is a full-stack Next.js app deployed to Vercel. It reads and writes
all state through the gateway's `/internal/sql` proxy — the same D1 database
as the gateway.

1. Copy `apps/site/.env.example` to `apps/site/.env` (or `.env.local`) and
   fill in the variables listed below.
2. Set `ADMIN_EMAILS` to a comma-separated list of email addresses that should have admin access.
3. Users sign in with **email OTP** (required). **Google OAuth** is optional —
   set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` to enable it; when unset the
   Google login button is hidden.
4. On first sign-in, a user row is created in `eg_users`; users whose email is
   in `ADMIN_EMAILS` become admins.
5. Deploy to Vercel (set the same environment variables in the project settings):

```bash
pnpm build:site
# or push to a Vercel-connected Git repository
```

## Environment variables

| Variable | Used by | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_GATEWAY_URL` | site | Public URL of the Cloudflare gateway (server-side calls + webhook URL display) |
| `INTERNAL_SQL_SECRET` | site + gateway | Shared secret for the `/internal/sql` proxy — must match on both sides |
| `SESSION_SECRET` | site | Cookie session signing key |
| `ADMIN_EMAILS` | site | Comma-separated list of bootstrap admin emails |
| `EMAIL_PROVIDERS` | site | Ordered provider list, e.g. `brevo` or `brevo,resend` (first success wins) |
| `BREVO_API_KEY` / `BREVO_FROM` | site | Brevo OTP email credentials |
| `RESEND_API_KEY` / `RESEND_FROM` | site | Resend OTP email credentials (optional fallback) |
| `GOOGLE_CLIENT_ID` | site | Google OAuth client ID (optional — omit to disable Google login) |
| `GOOGLE_CLIENT_SECRET` | site | Google OAuth client secret (optional) |

Gateway-side, only `INTERNAL_SQL_SECRET` is required (set via `wrangler secret
put`); D1 access goes through the `DB` binding in `wrangler.jsonc`.

## Consumer API

### `GET /events`

Poll for queued events. Authenticate with `Authorization: Bearer egc_*`.
Supports `limit` (default 10, max 100) and cursor-based pagination via the
`messageId` query parameter (last seen id).

**Response**

```json
{
  "events": [
    { "messageId": "...", "payload": { ... }, "timestamp": 1721203200000 }
  ],
  "cursor": "<last messageId>"
}
```

Returned events are **deleted server-side** (consume-on-read). There is no
`/ack` endpoint and no redelivery — ensure your processing logic is reliable,
and treat `messageId` as an idempotency key (adapters may replay from a local
dead-letter queue).

See the agent setup pages on the site (`/agent/dsh/`, `/agent/pi/`, `/agent/exec/`)
for per-agent install guides with full adapter source.

## License

MIT
