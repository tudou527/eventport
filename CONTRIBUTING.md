# Contributing to EventPort

Thanks for taking the time to contribute. EventPort is a small project with a
deliberately small surface area, so the most valuable contributions are usually
the boring ones: a new webhook source, a clearer install guide, or a bug report
with a reproduction.

## Ways to contribute

- **Add a webhook source.** Signature verifiers live in
  `apps/gateway/src/sources/`. Copy the closest existing verifier, add tests for
  the header/signature scheme, and document the `source` value in the README
  table.
- **Add an agent adapter.** Each adapter is a self-contained install guide under
  `apps/site/app/agent/<id>/` (`install.md` + `page.tsx`) that an agent can follow
  on its own. New adapters need no gateway changes.
- **Report a bug.** Open an issue with the platform, the subscription `source`,
  and the request/response you observed. Please redact tokens (`egw_*`, `egc_*`)
  and payload secrets.
- **Improve the docs.** The README is the primary onboarding path; corrections
  are as welcome as code.

## Development setup

Requirements: Node.js 20+, pnpm 9, and a Cloudflare account (gateway only —
the site can run against a local `wrangler dev` instance).

```bash
pnpm install

# Terminal 1 — gateway (Cloudflare Workers + local D1)
pnpm dev:gateway

# Terminal 2 — site (Next.js)
cp apps/site/.env.example apps/site/.env.local   # then fill it in
pnpm dev:site
```

For the site, point `NEXT_PUBLIC_GATEWAY_URL` at `http://127.0.0.1:8787` and set
`INTERNAL_SQL_SECRET` to the same value used by the gateway.

See the README for the full environment variable reference, and
[`docs/coding-standards.md`](./docs/coding-standards.md) for the code style used
across both apps.

## Two rules that are easy to miss

1. **Plan limits are duplicated on purpose.** `apps/site/lib/plans.ts` and
   `apps/gateway/src/plans.ts` each keep their own copy: the two packages deploy
   independently (Vercel / Cloudflare) and cannot share code. If you change a
   limit, change it in **both** files, or the UI will advertise quotas the
   gateway does not enforce.
2. **Schema changes go through `apps/gateway/schema.sql`.** The site has no D1
   binding of its own — it reads and writes through the gateway's authenticated
   `POST /internal/sql` proxy. Applying migrations means running
   `wrangler d1 execute eventport --remote --file=schema.sql`.

## Before opening a pull request

```bash
pnpm --filter site types   # TypeScript
pnpm build:site            # production build
```

- Keep pull requests focused; one change per PR is much easier to review.
- Explain the *why* in the description — what problem you hit, and how you
  verified the fix.
- Update the README when you change behaviour, add a source, or add an adapter.
- Do not commit `.env*` files or real tokens. They are git-ignored; if you
  accidentally leak one, revoke it in the dashboard and tell us.

## Security issues

Please **do not** open a public issue for security problems. See
[`SECURITY.md`](./SECURITY.md).

## Code of conduct

By participating you agree to follow the
[Code of Conduct](./CODE_OF_CONDUCT.md).

## License

Contributions are licensed under the [MIT License](./LICENSE).
