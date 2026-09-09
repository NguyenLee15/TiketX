# ADR-0001: Cookie sessions and durable asynchronous work

## Status

Accepted

## Decision

Browser sessions use short-lived HttpOnly access cookies, rotated persisted refresh tokens and a double-submit CSRF token. Bearer authentication remains available for compatible non-browser clients.

Refund notifications, payment notifications and reservation expiry are durable asynchronous work. Production must use persistent Hangfire/outbox storage; in-memory storage is development-only.

## Consequences

- Logout, password changes and account blocking can revoke active refresh sessions.
- Provider callbacks must be idempotent and must not downgrade a completed payment.
- Production deployments must supply JWT, SQL, Redis, RabbitMQ and Hangfire configuration explicitly.
