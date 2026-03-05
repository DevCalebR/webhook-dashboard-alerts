# SHIP REPORT

## Project

`webhook-dashboard-alerts`

## What was built

- Next.js App Router + TypeScript app with protected dashboard UI
- Prisma/Postgres data layer with migration + seed
- Clerk auth integration with admin role bootstrap via `ADMIN_EMAIL`
- Webhook ingestion endpoint: `POST /api/webhooks/:source`
  - `generic` HMAC SHA-256 verification (`x-signature`)
  - `stripe_like` timestamp + `v1` signature verification (`stripe-signature`)
  - idempotent dedupe (`dedupeKey`) and duplicate short-circuit response
  - in-memory request rate limiting (MVP)
- Alerts engine with rule matching and cooldown handling
- Admin rule management UI and recent alert run history
- Event list/detail pages with filters, pagination, and JSON viewer
- Scripts:
  - `scripts/setup-env.mjs`
  - `scripts/smoke-test.mjs`
- Tests:
  - signature verification unit tests
  - webhook API-route integration test

## Repo layout

- `src/` application code
- `prisma/` schema, migration, seed
- `scripts/` setup and smoke scripts
- `.env.example` env template

## Verification run

Executed locally:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run smoke
```

All commands passed.

Smoke test validated:

1. app boots
2. signed webhook accepted
3. event appears in dashboard list
4. alert fires and is visible in alerts UI

## Notes

- Current rate limiter is in-memory and suitable for single-node/dev usage.
- Alert evaluation is synchronous in webhook request path (MVP); production should move to a queue/worker model.
