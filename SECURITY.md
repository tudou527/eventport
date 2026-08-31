# Security Policy

EventPort sits on the receiving end of other people's webhooks, so we take
reports seriously — especially anything touching signature verification, token
handling, or the SQL proxy.

## Supported versions

| Version | Supported |
|---------|-----------|
| `v0.1.x` | ✅ |
| `main` (unreleased) | ✅ best-effort |

## Reporting a vulnerability

**Please do not open a public GitHub issue.**

Preferred: use GitHub's private vulnerability reporting —
**Security → Report a vulnerability** on
[github.com/tudou527/eventport](https://github.com/tudou527/eventport). It
creates a private draft advisory visible only to maintainers.

If you cannot use that, email **tudou527@gmail.com** with the subject line
`[SECURITY] EventPort — short summary`.

Please include:

- the affected component (`gateway`, `site`, or a self-hosted deployment),
- a description of the issue and its impact,
- steps to reproduce (a minimal payload or request is ideal),
- whether you believe it is exploitable on the hosted service at
  `eventport.dev`.

**Never include live `egw_*` / `egc_*` tokens or production secrets in a
report.** Redact them; we can exchange details privately once we confirm.

## What to expect

- We acknowledge reports within **72 hours**.
- We send an assessment (confirmed / not a vulnerability / needs more info)
  within **7 days**.
- We credit reporters in the release notes unless you prefer to stay anonymous.
- Please give us a reasonable window to ship a fix before any public
  disclosure.

## Scope

In scope:

- Webhook signature verification and bypasses (`apps/gateway/src/sources/`)
- Token issuance, role enforcement, and revocation (`egw_*` / `egc_*`)
- The `POST /internal/sql` proxy and its shared-secret authentication
- Rate limiting and backlog enforcement
- Authentication and session handling on the site (email OTP, Google OAuth)

Out of scope:

- Vulnerabilities in a self-hosted deployment caused by operator
  configuration — for example a weak or publicly committed
  `INTERNAL_SQL_SECRET` / `SESSION_SECRET`. The README documents these as
  required secrets; treat them like production credentials.
- Reports produced only by an automated scanner with no demonstrated impact.
- Third-party services you connect to EventPort (GitHub, Stripe, and so on) —
  report those to their vendors.

## If you run your own deployment

- Generate `INTERNAL_SQL_SECRET` and `SESSION_SECRET` with a CSPRNG and store
  them as platform secrets, never in the repository.
- Rotate `INTERNAL_SQL_SECRET` on both the Worker and the site at the same time.
- Revoke tokens in the dashboard rather than deleting rows; revocation is a
  soft delete and is enforced on every request.
