# TickeX domain and architecture context

## Core terms

- **Reservation**: a short-lived, owner-bound seat hold. It is valid only while the distributed lock, database state and expiry agree.
- **Checkout**: the idempotent transition from an owned reservation to a payment transaction.
- **Refund**: a two-phase financial workflow. A request creates `RefundPending`; only provider confirmation creates `Refunded` and releases the sold seat.
- **Check-in**: a concurrency-safe transition of a paid ticket to `Used`, restricted to Admin or assigned Staff.

## Architecture rules

- Domain has no framework dependency.
- Application owns policy and Interfaces; it does not accept HTTP DTOs.
- Infrastructure owns EF, Redis, Hangfire, messaging and payment Adapters.
- WebApi maps HTTP DTOs, authorization and status codes only.
- Every financial or reservation mutation must be idempotent and auditable.
