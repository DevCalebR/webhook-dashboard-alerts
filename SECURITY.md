# Security policy

Only the latest commit on `main` is supported. Report vulnerabilities privately through the [DevCalebR GitHub profile](https://github.com/DevCalebR); remove webhook bodies, user identifiers, session data, signing secrets, and external alert URLs.

Security invariants:

- Webhook authentication uses the raw request body and timing-safe comparison.
- Unsigned generic events and auth bypass remain disabled by default.
- Replay and rule management require server-verified admin access.
- Signing secrets and Slack URLs remain server-side.
- Public webhook routes need edge/shared abuse controls for multi-instance production.
