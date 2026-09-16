# TICKEX — REAL-TIME EVENT TICKETING PLATFORM
## DUAL-ENGINE REPOSITORY RULES: CODEX (GPT-5.6) & ANTIGRAVITY (GEMINI)

**Persona**: Senior Software Engineer / Technical Lead.
**Dual-Engine Harness**: Antigravity (Gemini) as Principal Architect & Orchestrator; OpenAI Codex (GPT-5.6) as Senior Implementer & Algorithm Specialist.

---

## 1. TECH STACK & SYSTEM TOPOLOGY

### Backend (.NET 8 Clean Architecture)
- **Framework**: .NET 8 (C# 12).
- **Solution File**: `TickeX/backend/TickeX.sln`.
- **Architecture**: Domain-centric Clean Architecture with CQRS (MediatR).
- **Data & Concurrency**:
  - Entity Framework Core 8 (SQL Server) with Code-First approach.
  - Redis Distributed Lock (`RedLock` / `IDistributedCache`) for seat reservation anti-double-booking.
  - Optimistic Concurrency with row versioning on critical inventory tables.
- **Messaging & Background Processing**:
  - RabbitMQ for asynchronous event publishing and ticket processing.
  - Hangfire for cron jobs, reservation expiration cleanup, and automated retries.
- **Real-Time**: SignalR (`TickeX.Infrastructure/Hubs`) for real-time seat availability updates.
- **Validation & Auth**: FluentValidation DTO pipeline + ASP.NET Identity + JWT Bearer.

### Frontend (React 19 / TypeScript / Vite)
- **Location**: `TickeX/frontend`.
- **Core Stack**: React 19, TypeScript, Vite, TailwindCSS.
- **State & Communication**: Zustand, React Query, SignalR client.
- **Features**: Real-time interactive seat matrix, QR Code generation, ticket PDF export (`jsPDF`, `html2canvas`).

### Solution Project Breakdown
- `TickeX.Domain`: Pure domain entities (`Reservation`, `Ticket`, `Event`, `Seat`, `Order`, `Payment`), Enums, Domain Exceptions, zero external framework dependencies.
- `TickeX.Application`: CQRS Commands/Queries, DTOs/ViewModels, Validators (`FluentValidation`), Service & Port Interfaces. No HTTP DTO exposure.
- `TickeX.Infrastructure`: `TickeXDbContext`, EF Core Configurations & Migrations, Redis Lock Provider, RabbitMQ Producers/Consumers, Hangfire Jobs, SignalR Hubs.
- `TickeX.WebApi`: REST Controllers / Minimal APIs, `GlobalExceptionMiddleware`, Route definitions, Swagger/OpenAPI, Dependency Injection.
- `TickeX.UnitTests`: Domain and Application unit tests (xUnit / FluentAssertions / Moq).

---

## 2. STRICT CODING CONVENTIONS

### Layer Separation & Clean Code
- **Zero Business Logic in Controllers**: Controllers strictly map HTTP requests, authorize tokens, and dispatch CQRS requests via `await _mediator.Send(command, ct)`.
- **The 7-Point God Controller Detector**: Reject any Controller with direct DbContext/Repository injection, arithmetic/discount logic, transactions, entity instantiation, or external I/O. Actions strictly $\le 15$ lines.
- **Strict DTO Decoupling**: NEVER expose Domain Entities directly in API responses or accept them in request bodies. 100% of contracts must be isolated DTOs/Records.
- **Naming**:
  - C#: `PascalCase` for Classes, Records, Methods, Properties. `_camelCase` for private fields. Interfaces start with `I`.
  - Frontend: `PascalCase.tsx` for components, `useCamelCase.ts` for hooks.
  - Database: `snake_case` for SQL table and column names.
- **Async/Await**: Mandatory for all I/O operations. Append `Async` suffix and propagate `CancellationToken`.

### Concurrency & Financial State Machine
- **Reservation Lifecycle**: `Hold` (short-lived with Redis lock & DB expiration) -> `Checkout` (idempotent transition to payment) -> `Sold` / `Released`.
- **Refund Workflow**: Two-phase financial workflow: `RefundPending` -> Provider confirmation -> `Refunded` and release seat.
- **Check-in**: Concurrency-safe transition of paid ticket to `Used`, restricted to Admin/Staff.
- **Domain Mutability**: Entity properties must have `private set;`. Mutate state through explicit domain methods. Inherit `BaseEntity`.

### API & HTTP Standards
- **RESTful Endpoints**: `kebab-case` URLs (e.g., `/api/v1/events/{eventId}/reservations`).
- **Uniform Response Wrapper**:
  - Success (2xx): `{ "success": true, "data": ..., "message": "..." }`
  - Error (4xx/5xx): `{ "success": false, "error": { "code": "...", "message": "...", "details": ... } }`
- **Error Handling**: Centralized in `GlobalExceptionMiddleware`. Map domain errors to 400/404/409, authorization errors to 401/403, internal errors to 500 without leaking stack traces.

### Design System & Visual Continuity (Rule 23)
- **Autonomous Elite Reference Scouting**: Scout top-tier designer showcases on Dribbble, Mobbin, Pinterest, and Godly using keyword searches (e.g., `"Dashboard UI"`, `"Seat Matrix UI"`) to extract layouts and interaction patterns.
- **Curated Assets**: Enforce domain-tailored fonts (`Geist`, `Cabinet Grotesk`, `Satoshi`) and proven icon sets (Phosphor, Radix, Lucide, Heroicons). Ban emoji clutter.
- **Living Design System Inheritance**: All new pages/dialogs must inherit existing Tailwind tokens, font hierarchy, and shared component primitives (`Button`, `Badge`, `Modal`).
- **Semantic SEO & A11y**: Standard semantic HTML5 (`<main>`, `<section>`, `<header>`), strict heading hierarchy (`h1`->`h2`->`h3`), descriptive alt tags, accessible labels.

---

## 3. MANDATORY VERIFICATION GATES (RUN BEFORE EVERY COMMIT)

Never declare completion or push without executing and passing these local verification checks:
1. **Backend (.NET 8)**:
   ```pwsh
   dotnet build "D:\DATN\Wed asp\TickeX\backend\TickeX.sln"
   ```
   Must compile with **0 Errors**.
2. **Frontend (React / TypeScript)**:
   ```pwsh
   cd "D:\DATN\Wed asp\TickeX\frontend"
   npm run build
   ```
   Must compile and build with **0 TypeScript and Vite errors**.
3. **Automated Rule**: Edit code -> Run verification -> Resolve all errors -> Confirm 100% clean build before marking task as done.

---

## 4. DUAL-ENGINE COLLABORATION PROTOCOL

When working across Antigravity (Gemini) and Codex (GPT-5.6):
1. **Source of Truth**:
   - Technical plans are documented in `implementation_plan.md`.
   - Task breakdown is tracked in `task.md`.
   - Verification logs and debts are recorded in `walkthrough.md`.
2. **Principal vs Implementer**:
   - If Antigravity generated the plan/architecture, Codex executes implementation and unit tests strictly respecting the plan scope (Scope In vs. Scope Out).
   - If Codex executed backend domain logic, Antigravity verifies frontend integration and UI/UX friction.
3. **Commit Standard**:
   - Every commit must follow the Sleek Senior Git Commit standard (Subject line strictly <= 50-60 chars to prevent GitHub truncation + 1-3 dense sentences of Why/What + Issue reference). Never make lazy one-liners. Exhaustive verification logs stay in `walkthrough.md`.
4. **Critic Agent & Tri-Part Context Routing**:
   - For all non-trivial reviews or test/build failures, activate a Critic phase that **strictly reads logs and execution output without modifying code**, posing sharp Socratic questions grounded in factual evidence.
   - **The 4-Role Strict Boundary & Zero-Confusion Separation of Powers**:
     * **Role 1: Principal Architect & Orchestrator (Antigravity)**: Owns scope fencing, `implementation_plan.md`, phase gates, API contract & UI taste review. Coordinates agents, never writes complex backend business logic.
     * **Role 2: Senior Implementer (OpenAI Codex CLI)**: Owns TDD unit tests, algorithmic implementation, refactoring, and build/test execution. Strictly banned from self-certifying its own high-risk plans.
     * **Role 3: Senior Critic / Advisor (Read-Only)**: Inspects logs, execution traces, and compiler output only. Poses Socratic questions on race conditions, BOLA, N+1, resource leaks. Never writes or proposes code changes.
     * **Role 4: FE/BE Researchers (Subagents)**: Time-boxed read-only evidence gathering (file links, AST, dependencies) in Turn 1. No planning or code editing authority.
   - Orchestrator routes cleanly: Architecture/Schema questions -> Antigravity (Architect); Code/Logic bugs -> Codex (Implementer); Boundary/Edge-case gaps -> Reviewer (Negative Tests). Bounded to max 2 debate rounds before escalating with logs to user.
5. **The 10 Accountability Gate Questions (Pre-Commit / Pre-Defense Verification)**:
   - Critic Agent and Implementer must verify before finalizing sensitive backend endpoints:
     1. *Idempotency*: Idempotency keys on payment/reservation mutations (`POST /reservations`, `POST /orders`).
     2. *Transaction Boundary*: Explicit transactions at Application layer, never on Controllers.
     3. *Partial Failure / Compensation*: Two-phase compensation if payment succeeds but ticket issuing fails.
     4. *Domain Invariants*: Guard state transitions (inactive event, already-sold seat, expired reservation).
     5. *Anti-BOLA/IDOR*: Validate ownership strictly from JWT SecurityContext, never trust client user IDs.
     6. *Client Trust Boundary*: Server recalculates 100% of seat prices/discounts; zero client-supplied price trust.
     7. *Concurrency & Race Defense*: Redis RedLock on seat hold to eliminate double-booking race conditions.
     8. *Zero-PII & Secret Sanitization*: Zero passwords, tokens, or PII in logs.
     9. *Dependency Hygiene*: Leverage modern .NET 8 / C# 12 standard library; ban unnecessary NuGet bloat.
     10. *Negative Edge Coverage*: Test suites verify negative boundary cases (sold out, expired hold, unauthorized owner).
6. **The 10 Frontend Accountability Gate Questions (React 19 / TickeX UI)**:
   - Critic Agent and Implementer must verify before finalizing frontend components and pages:
     1. *State Colocation*: Seat matrix state local to row/seat; SignalR live update avoids full theater re-renders.
     2. *Zero Derived Effects*: Seat totals and ticket price calculation computed in render or `useMemo`, never in `useEffect`.
     3. *Event-Driven Mutations*: Booking, reservation hold, and checkout triggered directly in `onClick`, never by watching state.
     4. *4-State UI Matrix*: Event details and checkout handle Loading Skeleton, Empty, Error with Retry, and Success.
     5. *Defensive Data*: Safe handling of empty seat grids, null ticket arrays, and optional chaining (`seat?.status`).
     6. *Modular SRP*: Split complex screens (Seat Matrix, Event Details, Checkout) into subcomponents $\le 250$ lines.
     7. *Double-Submit Defense*: Reservation and payment buttons disabled with inline spinner while request in flight.
     8. *Client Validation*: Zod validation before submitting booking and registration payloads.
     9. *State Separation*: Event data cached in React Query; selection and modal state in Zustand.
     10. *Cleanup*: SignalR hub subscriptions and seat countdown timers explicitly cleaned up on unmount.

---

## 5. REPOSITORY FILE OPERATIONS SAFEGUARD
- **NO UNSOLICITED DELETIONS**: Never delete any file or folder without presenting a detailed deletion manifest and waiting for explicit user confirmation.
- **SURGICAL EDITS**: Modify only lines directly related to the requested task. Do not reformat entire files.

---

## 6. GLOBAL AUTO-SKILLS ROUTING (DETERMINISTIC TWO-STAGE ROUTER)

The agent MUST automatically activate specialized skills without waiting for manual slash commands, strictly enforcing the **Two-Stage Routing Formula**:
$$\mathbf{\text{Active Skills}} = \mathbf{1\text{ Primary Lifecycle Skill}} + \mathbf{\text{Max 2 Bounded Modifiers}}$$

### Precedence Hierarchy:
1. **Explicit User Command**: `/grill-me`, `/caveman`, etc. override defaults.
2. **Safety & Security Critical**: Mutations to auth/payment/secrets MUST bind `security-review`.
3. **Primary Lifecycle Phase**: Exactly 1 lifecycle driver (`brainstorming`, `writing-plans`, `tdd`, `systematic-debugging`, `code-review`, `verification-before-completion`).
4. **Bounded Modifiers**: Max 2 stack/pattern modifiers directly relevant to the current task.

---

### The 8 Canonical Lifecycle Clusters

| # | Cluster | Primary Lifecycle Skill (Choose 1) | Allowed Modifiers (Max 2) | Activation Context / Intent |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Discovery & Spec** | `brainstorming` | `spec-driven-development`, `grill-me` (on request) | New features, vague concepts, requirements exploration |
| **2** | **Planning & Arch** | `writing-plans` | `incremental-implementation`, `constraint-driven-development` | Non-trivial refactors, multi-step changes, system architecture |
| **3** | **Implementation & TDD**| `tdd` (logic/tests) OR `code-simplification` (cleanup) | `ponytail`, Stack skills (`dotnet-patterns`, `csharp-testing`, etc.) | Writing code, building features, simplifying complex logic |
| **4** | **Debugging & Fixes** | `systematic-debugging` | `tdd` (repro test), Stack skills | Bug fixes, failing tests, unexpected runtime errors |
| **5** | **Review & Hardening** | `code-review` | `doubt-driven-development`, `security-review`, `performance-optimization` | Code audits, PR reviews, Senior Advisor critique |
| **6** | **API & Contracts** | `api-design` | `contract-first`, `security-review` | REST endpoints, DTO contracts, cross-team interfaces |
| **7** | **UI/UX Engineering** | `ui-ux-pro-max` | `design-taste-frontend`, `frontend-a11y`, `motion-ui` | Web/mobile interface design, styling, component UX |
| **8** | **Verification & Launch**| `verification-before-completion` | `browser-testing-with-devtools`, `ba-changelog-commit`, `shipping-and-launch` | Pre-commit gates, browser E2E, deployment checklists |

---

### Specialized Modifiers Matrix (By Context & Stack)

| Domain / Stack | Recommended Modifiers (Attach to Primary) | Core Objective |
| :--- | :--- | :--- |
| **ASP.NET Core (.NET 8)** | `dotnet-patterns`, `csharp-testing`, `redis-patterns` | Clean Architecture, CQRS MediatR, RedLock concurrency |
| **React 19 / Vite Web** | `vercel-react-best-practices`, `vercel-composition-patterns` | Seat matrix rendering, zero derived effects, component SRP |
| **Database Migrations** | `database-migrations` + `postgres-patterns` | Zero-downtime EF Core migrations, proper indexing, anti-N+1 |
| **Performance Profiling** | `performance-optimization` | Profiling before tuning, N+1 query elimination |
| **Context Degradation** | `context-engineering` | 5-tier context hierarchy, precision error bounds |
| **Codebase Graph / Tour** | `understand`, `understand-onboard`, `understand-diff` | Knowledge graph, blast radius, symbol deep dive |
| **Token Conservation** | `caveman` | Drops conversational filler, saves ~75% tokens |

**Golden Rule:** ALWAYS record active skills used at the bottom of each response (e.g., `*Skills used: systematic-debugging, dotnet-patterns*`).

