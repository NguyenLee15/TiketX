# TickeX production runbook

## Deployment prerequisites

- Terminate TLS at the host reverse proxy and proxy to `127.0.0.1:3000`; set `X-Forwarded-Proto: https` and retain the original client IP in `X-Forwarded-For`.
- Copy `.env.example` to a host-only `.env`, replace every value, and store it with owner-only permissions. Do not commit it.
- Ensure SQL Server data volumes are backed up before every release. Record the backup location and test a restore on an isolated host.

## Release procedure

1. Pull the reviewed image/source release and render its configuration: `docker compose --env-file .env config -q`.
2. Create and verify a SQL backup.
3. Apply migrations once: `docker compose --env-file .env run --rm backend --migrate`.
   Generate and attach the reviewed idempotent SQL script before the first production release: `dotnet ef migrations script --idempotent --project backend/TickeX.Infrastructure --startup-project backend/TickeX.WebApi --output tickex-migrations.sql`.
4. Start the release: `docker compose --env-file .env up -d --build`.
5. Confirm `curl --fail http://127.0.0.1:3000/health/ready` and exercise login, one seat hold, a payment-provider callback sandbox flow, and SignalR seat updates.

## Rollback and incident response

- Roll back application images only after checking that the target version supports the migrated schema. Do not run EF migration rollback automatically.
- For a failed migration, stop the rollout, restore the verified SQL backup to an isolated environment, document the failure, then prepare an explicit forward-fix migration.
- Rotate JWT, ticket-signing, PayOS, RabbitMQ, Redis, SQL, and SMTP credentials after suspected disclosure; restart the stack after each rotation.
- Treat `/health/live` as process liveness and `/health/ready` as dependency readiness. Investigate readiness failures before routing traffic to a new release.
