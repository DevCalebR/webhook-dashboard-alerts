# Contributing

1. Create a focused branch from `main` and install with `npm ci`.
2. Use synthetic webhook payloads and local provider credentials only.
3. Preserve raw-body signature verification, idempotency, server-side authorization, and safe defaults.
4. Add tests for changed signature, replay, rule, delivery, or tenant behavior.
5. Run lint, typecheck, tests, build, and the configured smoke test where possible.

Do not commit `.env.local`, signing secrets, Clerk data, real webhook payloads, Slack URLs, or database exports. Keep external side effects mocked in unit/integration tests.
