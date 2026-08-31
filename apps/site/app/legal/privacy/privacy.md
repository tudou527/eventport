# Privacy Policy

*Last updated: 31 August 2026*

EventPort is a webhook inbox that sits between the platforms you already use and
the AI agent running on your own machine. This policy explains what the hosted
service at [eventport.dev](https://eventport.dev) stores, why, and for how long.

If you self-host EventPort, none of this applies to you in the same way: your
data stays inside your own Cloudflare account, and you are the data controller.

## What we collect

**Account information.** Your email address. We use it to sign you in — either
by emailing a one-time code, or, if you choose it, through Google OAuth. We do
not ask for a name, a phone number, or a payment method.

**Session data.** A signed, HTTP-only cookie that keeps you logged in. It
expires and contains no third-party tracking identifiers.

**Subscription configuration.** For each subscription you create: the
`source` you selected, an optional `signing_secret`, and the two tokens
generated for it (`egw_*` for posting webhooks, `egc_*` for polling).

**Event payloads.** The JSON bodies that platforms deliver to your webhook URL.

## How long we keep event data

Events are **consumed on read**. As soon as your agent receives an event from
`GET /events`, it is deleted from the gateway. There is no archive, no replay,
and no secondary copy.

Events that are never pulled are dropped by a scheduled cleanup after a short
retention window (currently 15 minutes). Backlog is capped per subscription;
beyond that cap, new deliveries are rejected rather than queued.

This is the core design decision behind EventPort: we hold your events for
minutes, not months, because the whole point is to hand them to your agent.

## What we do not do

- We do not sell your data.
- We do not use event payloads to train models.
- We do not run advertising or cross-site tracking pixels.
- We do not read your event payloads except when debugging a specific issue you
  reported to us.

## Third parties

The hosted service runs on infrastructure provided by others, each of which
processes data on our behalf:

| Provider | Purpose | Data involved |
|----------|---------|---------------|
| Cloudflare | Hosting the gateway Worker and the D1 database | Events, subscription config |
| Vercel | Hosting the site and dashboard | Session data, requests |
| Brevo / Resend | Sending one-time login codes | Email address |
| Google | Optional OAuth sign-in | Email address, if you choose it |

When Google OAuth is not configured, the Google login button is hidden and no
data is sent to Google.

## Cookies

One strictly necessary cookie: your signed session. No analytics or advertising
cookies are set by the hosted service.

## Your controls

- **Revoke a token** at any time in the dashboard. Revocation takes effect on
  the next request.
- **Disable or delete a subscription** to stop accepting deliveries and clear
  its configuration.
- **Delete your account** by emailing
  [tudou527@gmail.com](mailto:tudou527@gmail.com). This removes your user row
  and subscriptions; events are already gone by then, since they are deleted on
  read.

## Self-hosting

EventPort is MIT licensed. If you deploy your own copy, you operate it under
your own Cloudflare account and your own privacy terms — we have no access to
your deployment, its database, or its logs.

## Children

EventPort is a developer tool and is not directed at children under 16.

## Changes

If this policy changes materially, we will note the new date at the top and
announce it in the repository.

## Contact

Questions about this policy: [tudou527@gmail.com](mailto:tudou527@gmail.com).
