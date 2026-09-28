# TickeX Audit Remediation Implementation Plan

**Goal:** Resolve the audit findings sequentially with a verified build/test cycle after each bounded change.

**Architecture:** Preserve the existing Clean Architecture and PayOS `int` contract. Apply fail-fast validation at the checkout boundary, keep React seat data immutable during render, and propagate request cancellation to EF Core. Defer migration, pagination, transaction strategy, caching, and integration-test work until their own scoped steps.

**Tech Stack:** .NET 8, EF Core, xUnit, FluentAssertions, React 19, TypeScript, Vite, Vitest.

**Spec:** User-provided TickeX full-stack audit report pasted in the conversation.

## Global Constraints

- Modify only files explicitly listed for the active step.
- Preserve existing public contracts unless a later step explicitly approves a contract migration.
- Run the relevant focused tests, then the complete backend/frontend verification required by the repository.
- Do not perform destructive migration changes without an explicit data-preservation design and verification.

## Review Focus

- Decimal, zero, negative, and overflow payment amounts must fail before PayOS I/O.
- Seat rows must not be mutated while rendering or memoizing.
- Aborted HTTP requests must cancel the security-stamp database query.
- Cursor pagination must preserve deterministic ordering when timestamps tie.
- Explicit EF transactions must remain compatible with retry execution strategies.

### Step 1: Hotfix money boundary

Files:
- Modify: `backend/TickeX.Infrastructure/Services/CustomerCheckoutOperations.cs`
- Test: `backend/TickeX.UnitTests/Customer/CustomerCheckoutOperationsTests.cs`

Add a regression test for a fractional ticket price and make checkout return `INVALID_PAYMENT_AMOUNT` without calling PayOS. Also reject non-positive and out-of-range values at the same boundary.

Verification: focused xUnit test, full `dotnet build`, and full `dotnet test`.

### Step 2: Preserve SeatMap immutability

Files:
- Modify: `frontend/src/pages/EventDetail/SeatMap.tsx`

Replace the in-place row sort with a sorted shallow copy.

Verification: frontend test suite and `npm run build`.

### Step 3: Propagate request cancellation

Files:
- Modify: `backend/TickeX.WebApi/Program.cs`

Pass `context.HttpContext.RequestAborted` into the security-stamp query.

Verification: backend build and test suite.

### Step 4: Refactor admin modal state

Files:
- Modify: `frontend/src/pages/Admin/Events/AdminEventsModals.tsx`
- Modify: its direct caller only if the new typed state contract requires it

Group modal state without introducing a global store or unrelated UI changes.

Verification: frontend test suite and build.

### Step 5: Remove duplicate client-side ticket filtering

Files:
- Modify: `frontend/src/pages/Tickets/MyTicketsPage.tsx`

Use the server-filtered page as the single source of truth and preserve pagination metadata.

Verification: focused frontend tests, full frontend tests, and build.

### Step 6: Make explicit EF transactions retry-safe

Files:
- Modify: `backend/TickeX.Application/Interfaces/IApplicationDbContext.cs`
- Modify: `backend/TickeX.Infrastructure/Persistence/ApplicationDbContext.cs`
- Modify: `backend/TickeX.Infrastructure/DependencyInjection.cs`
- Modify: all five explicit transaction command sites, including `CancelEventCommand.cs`
- Test: existing command/security tests plus targeted regression tests

Apply one consistent execution-strategy wrapper per explicit transaction, preserving transaction boundaries and cancellation.

Verification: focused tests, full backend build, and full backend test suite.

### Step 7: Design and implement cursor pagination

Files:
- Modify: `CustomerTicketReadModelAdapter.cs`, `CustomerEventCatalogAdapter.cs`, and their DTO/query contracts only after API compatibility review
- Test: corresponding query tests

Introduce deterministic cursor ordering and bounded limits for public event catalog and customer-ticket reads. Keep the existing offset/page-number contracts as compatibility paths during migration.

Verification: negative/boundary query tests, full backend build, and full backend test suite.

### Step 8: Production hardening

Scope:
- Add short-lived security-stamp caching only after cache invalidation semantics are specified.
- Add real SQL Server/Redis integration tests only after the test runtime and container availability are confirmed.
- Handle the reported migration issue only with an expand-contract migration plan and explicit rollback evidence.

These are separate changes and will not be bundled with the hotfixes above.
