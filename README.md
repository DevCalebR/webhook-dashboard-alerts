# Webhook Dashboard Alerts

Production-ready webhook ingestion + dashboard + alerts app built with Next.js App Router, Prisma/Postgres, Clerk, Tailwind, and shadcn-style UI components.

## Overview

This app provides:

- Signed webhook ingestion for two sources: `generic` and `stripe_like`
- Event persistence with idempotent dedupe
- Protected dashboard for event search and inspection
- Alert rules and alert run tracking
- Admin-only rule management
- Structured logging for webhook + alert lifecycle

## Stack

- Next.js 16 (App Router, TypeScript)
- Prisma ORM + PostgreSQL
- Clerk authentication (email/password)
- Tailwind CSS + shadcn-style UI components
- Vitest test suite

## Features

### Webhook ingestion

- `POST /api/webhooks/:source`
- Supported sources:
  - `generic` using `x-signature` (HMAC SHA-256)
  - `stripe_like` using `stripe-signature` format `t=<timestamp>,v1=<signature>`
- Events stored with:
  - `id, source, receivedAt, type, externalId, payload, rawBodyHash, signatureValid, dedupeKey, ip, userAgent`
- Idempotency:
  - dedupe key = `source:externalId` or `source:sha256(payload)`
  - duplicate requests return `200 { duplicate: true }` without inserting
- Simple in-memory rate limiter per source + IP (MVP)

### Dashboard (protected)

- `/events`: filterable/paginated table
  - filters: source, signature validity, date range, text search (`type` / `externalId`)
- `/events/[id]`: event detail + formatted JSON payload + alert run history
- `/alerts`: rule management + recent alert runs

### Alerts engine

- Alert rules evaluated synchronously when an event is inserted
- Rule matching by event `type`:
  - `exact`, `prefix`, `contains`
- Cooldown support
- Alert run statuses:
  - `fired`, `skipped_cooldown`, `disabled`, `no_match`

### Admin setup

- User profiles are synced on sign-in
- If signed-in email matches `ADMIN_EMAIL`, role becomes `ADMIN`
- Only admins can create/edit/disable alert rules

## Quickstart (local)

### 1) Prerequisites

- Node.js 20.x
- npm
- PostgreSQL 15+ (local) or Docker

### 2) Install

```bash
npm install
```

### 3) Configure env

```bash
node scripts/setup-env.mjs
```

Edit `.env.local` with real Clerk keys and your secrets.

### 4) Start Postgres

Option A: Docker

```bash
docker compose up -d
```

Option B: existing local Postgres service

- Ensure `DATABASE_URL` points at a reachable DB.

### 5) Apply schema + seed

```bash
npm run db:migrate
npm run db:seed
```

### 6) Run app

```bash
npm run dev
```

Open `http://localhost:3000`.

## Environment variables

See `.env.example`.

Required for production:

- `DATABASE_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `WEBHOOK_GENERIC_SECRET`
- `WEBHOOK_STRIPE_LIKE_SECRET`
- `ADMIN_EMAIL`

Optional:

- `WEBHOOK_ALLOW_UNSIGNED_GENERIC` (default `false`)
- `WEBHOOK_RATE_LIMIT_MAX` (default `60`)
- `WEBHOOK_RATE_LIMIT_WINDOW_MS` (default `60000`)
- `DEV_BYPASS_AUTH` (local-only; default `false`)

## Signed webhook examples

### Generic source (`x-signature`)

```bash
payload='{"id":"evt_123","type":"invoice.paid","amount":1200}'
signature=$(printf '%s' "$payload" | openssl dgst -sha256 -hmac "$WEBHOOK_GENERIC_SECRET" -hex | sed 's/^.* //')

curl -X POST http://localhost:3000/api/webhooks/generic \
  -H "content-type: application/json" \
  -H "x-signature: $signature" \
  -d "$payload"
```

### Stripe-like source (`stripe-signature`)

```bash
payload='{"id":"evt_456","type":"payment.failed"}'
ts=$(date +%s)
base="$ts.$payload"
sig=$(printf '%s' "$base" | openssl dgst -sha256 -hmac "$WEBHOOK_STRIPE_LIKE_SECRET" -hex | sed 's/^.* //')
header="t=$ts,v1=$sig"

curl -X POST http://localhost:3000/api/webhooks/stripe_like \
  -H "content-type: application/json" \
  -H "stripe-signature: $header" \
  -d "$payload"
```

## How alerts work

1. Webhook is verified and stored as `Event`.
2. Enabled rules for matching source (`source` or `*`) are evaluated.
3. For each rule, an `AlertRun` is created with status:
   - `disabled`, `no_match`, `skipped_cooldown`, or `fired`
4. On `fired`, `lastFiredAt` is updated.

MVP implementation is synchronous in request path. For production scale, move alert evaluation to a queue worker.

## Tests and verification

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run smoke
```

Smoke test verifies:

1. app boots
2. webhook accepts signed payload
3. event appears in `/events`
4. alert fires and appears in `/alerts`

## Deployment (Vercel + Postgres)

1. Create managed Postgres (Neon, Supabase, RDS, etc.)
2. Create Clerk app and enable email/password
3. Import repo into Vercel
4. Set env vars in Vercel:
   - `DATABASE_URL`
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
   - `WEBHOOK_GENERIC_SECRET`
   - `WEBHOOK_STRIPE_LIKE_SECRET`
   - `ADMIN_EMAIL`
   - Optional rate limit and unsigned settings
5. Deploy
6. Run migrations against production DB:

```bash
npx prisma migrate deploy
```

## Troubleshooting

- `Invalid signature`:
  - Confirm correct source and signing secret.
  - For `stripe_like`, ensure timestamp is current.
- `duplicate: true` unexpectedly:
  - Check `externalId`; dedupe key may already exist.
- Auth not working:
  - Verify Clerk publishable/secret keys and redirect URLs.
- DB errors:
  - Verify `DATABASE_URL` and run `npm run db:migrate`.
- Local smoke/auth bypass:
  - `DEV_BYPASS_AUTH=true` is only for local validation.
