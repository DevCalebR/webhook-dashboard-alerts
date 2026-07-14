# Troubleshooting

## Generate a signed generic event

```bash
payload='{"id":"evt_demo_123","type":"invoice.paid","amount":1200}'
signature=$(printf '%s' "$payload" | openssl dgst -sha256 -hmac "$WEBHOOK_GENERIC_SECRET" -hex | sed 's/^.* //')
curl -X POST http://localhost:3000/api/webhooks/generic \
  -H 'content-type: application/json' -H "x-signature: $signature" -d "$payload"
```

## Signature is rejected

Confirm the exact raw bytes, source-specific header, signing secret, and—on timestamped events—current timestamp. JSON reformatting after signing changes the bytes and invalidates the signature.

## The response says `duplicate: true`

Use a new synthetic external ID. Repeated external IDs intentionally map to the same dedupe key.

## Dashboard authentication fails

Use Clerk development keys configured for the local origin and sign in with the exact `ADMIN_EMAIL` when testing management actions.

## Slack delivery does not appear

Confirm the alert rule action, matched event type, cooldown, and server-side Slack URL. Inspect the persisted alert-run note; ingestion remains accepted when Slack fails.

## Smoke test fails

Confirm PostgreSQL is reachable, migrations and seed completed, the app is running on the configured port, and local bypass is enabled only for the isolated smoke environment.
