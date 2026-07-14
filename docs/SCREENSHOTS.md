# Verified screenshot inventory

The committed captures were produced locally from `prisma/seed.ts` with `DEV_BYPASS_AUTH=true`; no Clerk account or external webhook provider was used.

1. `event-stream-desktop.png` — filters, signature status, source, type, and receipt time.
2. `event-detail-desktop.png` — formatted seeded JSON and alert-run history.
3. `alert-rules-desktop.png` — enabled rules, match behavior, cooldown, and action type.
4. `alert-rules-mobile.png` — alert rules at 390 × 844.

No signing material, Slack URLs, Clerk identifiers, or real provider payloads appear. A replay-result capture was intentionally omitted because the existing seeded views provide the useful visual evidence without implying an external delivery occurred.
