# Terms of Service

*Last updated: 31 August 2026*

These terms cover your use of the hosted EventPort service at
[eventport.dev](https://eventport.dev). If you self-host EventPort, these terms
do not apply — the software is licensed under the
[MIT License](https://github.com/tudou527/eventport/blob/main/LICENSE) and you
run it under your own terms.

## The service

EventPort gives you a public webhook URL. Platforms you already use post events
to it; your agent polls the gateway and consumes them. We verify signatures at
the edge, buffer events briefly, and delete them once delivered.

## Your account

You are responsible for:

- keeping your tokens (`egw_*`, `egc_*`) secret. Anyone holding a consumer token
  can read your events; anyone holding a webhook token can post to your inbox.
- revoking tokens you no longer use, or that you suspect have leaked.
- the accuracy of the account information you provide.

One account is for one person. Do not resell access to the hosted service.

## Delivery semantics — please read this

EventPort delivers events **at most once**. Events are deleted from the gateway
the moment they are returned by `GET /events`. There is no acknowledgement step,
no redelivery, and no dead-letter queue on our side.

This means:

- if your agent crashes after receiving events but before processing them, those
  events are gone;
- the adapter scripts included in the agent install guides write failures to a
  local NDJSON file so nothing is silently lost — use them, or implement the
  equivalent;
- **EventPort is not a system of record.** Do not use it as the only copy of
  anything you cannot afford to lose.

## Fair use

The hosted service is free and funded by the maintainer. Limits are enforced per
subscription (see `PLANS` in the source): a retention window, a per-minute
delivery rate, a backlog cap, and a cap on subscriptions per user. These are
anti-abuse quotas, not a service-level commitment, and they may be adjusted.

## Acceptable use

Do not use the hosted service to:

- relay, store, or distribute unlawful content, or content that infringes
  someone else's rights;
- send unsolicited bulk messages;
- attack, probe, or attempt to gain unauthorised access to the service or other
  users' data;
- resell the hosted service or use it as a general-purpose message broker at
  scale;
- circumvent rate limits or the backlog cap.

We may throttle, suspend, or terminate access for violations, usually after a
warning, and immediately where there is a risk of harm to the service or others.

## Availability and changes

The service is provided **"as is"** and **"as available"**, without warranty of
any kind. It is an early-stage project: features change, and planned sources
(RSS, webpage monitoring, social platforms) may or may not ship. We do not offer
an uptime SLA on the hosted service.

We may change or discontinue the hosted service. Where a change is material, we
will announce it in the repository; because events are consumed on read, there
is no backlog of your data to migrate.

## Liability

To the maximum extent permitted by law, we are not liable for lost events, lost
profits, or indirect or consequential damages arising from your use of the
service — including events that expire before your agent polls them, or that
your agent fails to process after receiving them. Nothing here limits liability
that cannot be limited by law.

## Intellectual property

The EventPort source code is MIT licensed — you may use, modify, and distribute
it, including commercially, subject to that license. The EventPort name and
logo are not covered by the MIT license; please do not use them to imply an
endorsement of your own product or fork.

## Termination

You may stop using the service and delete your account at any time by emailing
[tudou527@gmail.com](mailto:tudou527@gmail.com). We may suspend or terminate
accounts that violate these terms.

## Governing law

These terms are governed by the laws of the People's Republic of China, without
regard to conflict-of-law provisions.

## Contact

Questions about these terms: [tudou527@gmail.com](mailto:tudou527@gmail.com).
