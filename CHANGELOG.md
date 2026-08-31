# Changelog

All notable changes to EventPort are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned

- RSS, YouTube, X/Twitter, webpage monitoring, and email sources
- Paid plan tiers (the `custom` plan is currently an internal anti-abuse quota)

## [0.1.0] - 2026-08-31

First public release.

### Added

**Gateway** (Cloudflare Workers + D1)

- `POST /hooks/{apiKey}` webhook receiver with per-source signature
  verification: github, linear, stripe, shopify, slack, hubspot, calendly,
  typeform — anything else falls back to `custom`, verifiable with your own
  signing secret
- `GET /events` polling endpoint with `limit` and cursor-based pagination
- Consume-on-read semantics: returned events are deleted server-side
- Two tokens per subscription with separate roles — `egw_*` can only post
  webhooks, `egc_*` can only poll
- Durable event queue in D1 with per-subscription TTL and backlog cap
- Per-token rate limiting (consumer: 60 requests/minute, anti-abuse)
- `POST /internal/sql` authenticated proxy so the site can share the same D1
- Hourly rejection counter (`eg_rejected_events_hourly`) for backlog-exceeded
  events

**Site** (Next.js on Vercel)

- Landing page with data-flow diagram, sources, features, and FAQ
- Email OTP login (Google OAuth optional, hidden when unconfigured)
- Dashboard: create, list, disable, and revoke subscriptions and tokens
- Agent install guides an agent can follow on its own: `/agent/dsh`,
  `/agent/pi`, `/agent/exec`
- i18n for the dashboard (English and Chinese)

### Security

- Signature verification happens at the edge, before an event is queued
- Token roles are enforced on every request
- Revocation is a soft delete (`revoked_at`) and takes effect immediately

[Unreleased]: https://github.com/tudou527/eventport/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/tudou527/eventport/releases/tag/v0.1.0
