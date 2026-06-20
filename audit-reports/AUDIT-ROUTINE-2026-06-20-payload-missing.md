# Audit Report — 2026-06-20
## Routine: Codebase Audit (PHASE3-3)

**Status: INCOMPLETE — FIRE PAYLOAD MISSING CORRELATION BLOCK**

---

## 0 · Critical Pre-Condition Failure

This Claude Code Routine received an incomplete fire payload.

`fireAuditRoutine.ts:87-90` builds the payload as:
```
${auditText}\n\n---\nWhen reporting findings back, include this exact correlation block so they can be matched:\ncorrelation_id: ${correlationId}\nproject_id: ${projectId}
```

The payload received by this session contains **only the generic audit instructions**
(the `buildAuditPrompt` template body) and is **missing**:
- `project_title` (interpolated into the header)
- `goal_items` (the specific goals to audit against)
- `deep_research_input` (the research standard to measure against)
- `correlation_id` (the UUID the app stored as `audit_correlation_id`)
- `project_id` (required by the audit-ingest callback URL and body)

Without `project_id` and `correlation_id`, this routine **cannot POST findings back**
to `/api/operations/projects/{project_id}/audit-ingest`.

The `audit-ingest/route.ts:57-85` will reject any callback that:
- Has no `correlationId` → 400
- Has a `project_id` that doesn't match the URL `[id]` → 400
- Has a `correlationId` that doesn't match the stored `audit_correlation_id` → 403

Consequence: The Inngest `await-audit` step in `operations-pipe-run.ts:149-158`
will **time out after 30 minutes** and fail the pipe run terminal
(`NonRetriableError: audit did not complete within timeout`).

Root-cause hypothesis: the Routine API received the `text` payload but the
correlation trailer was either truncated, mis-encoded, or the `buildAuditPrompt`
output was not concatenated with the trailer before firing. See
`fireAuditRoutine.ts:82-91`.

**This audit is filed as the SOC 2 paper trail for this session.
The POST to audit-ingest cannot be completed (missing identifiers).
Alex must investigate the fire payload assembly before the next pipe run.**

---

## 1 · What Exists (Verified File Map)

| Area | File | Status |
|---|---|---|
| Middleware / auth gate | `src/middleware.ts:1-145` | Correct |
| HMAC cookie sign/verify | `src/lib/cookie-auth.ts:1-61` | Correct |
| Admin auth gate | `src/lib/require-admin.ts:1-20` | Correct |
| Double-entry commit | `src/lib/journal-entry-service.ts:40-177` | Correct |
| Double-entry reversal | `src/lib/journal-entry-service.ts:180-282` | Correct |
| Commit-to-ledger route | `src/app/api/transactions/commit-to-ledger/route.ts:1-251` | Correct |
| Tax calculate route | `src/app/api/tax/calculate/route.ts:1-362` | Partial |
| Audit log chain | `src/lib/audit/writeAuditLog.ts:1-143` | Correct |
| Operations pipe run | `src/inngest/functions/operations-pipe-run.ts:1-257` | Correct |
| Audit ingest callback | `src/app/api/operations/projects/[id]/audit-ingest/route.ts:1-121` | Correct |
| Fire audit routine lib | `src/lib/fireAuditRoutine.ts:1-128` | Correct |
| Routine budget guard | `src/lib/routineFireBudget.ts:1-73` | Correct |
| Prompt builder (no-drift) | `src/lib/ai/buildAuditPrompt.ts:1-113` | Correct |
| AI spending insights | `src/app/api/ai/spending-insights/route.ts:1-64` | Partial |
| TastyTrade scanner | `src/app/api/tastytrade/scanner/route.ts:155-277` | Correct |
| Hotel booking (public) | `src/app/api/travel/liteapi/book/route.ts:1-257` | Correct |
| Cron auto-categorize | `src/app/api/cron/auto-categorize/route.ts:1-58` | Partial |
| Admin fix-unbalanced | `src/app/api/admin/fix-unbalanced-entries/route.ts:1-208` | Partial |
| Tier gate | `src/lib/auth-helpers.ts:41-49` | Correct |

**Reusable (reuse over rebuild):**
- `writeAuditLog` — hash-chain SOC 2 audit log, fully reusable for any new route
- `requirePipeBudget` / `requireRoutineBudget` — cost gate pattern, proven, replicate for any new paid call
- `commitPlaidTransaction` — double-entry atomic unit, extend for new transaction types
- `rateLimit` + `reserveTravelSearch` — dual-layer public-endpoint cost guard, replicate for any new public paid route
- `getVerifiedEmail` → user lookup → ownership scope — the standard auth chain, copy exactly in every new route

---

## 2 · Assertion Tests

### 2a — Double-Entry Accounting (`journal-entry-service.ts:40-177`)

| Assertion | Result |
|---|---|
| Existence | JE + 2 ledger entries created atomically in `$transaction`. **PASS** |
| Completeness | Both debit + credit legs always created; missing COA → explicit Error. **PASS** |
| Accuracy | `dollarsToCents(Math.round(amount*100))` converts Plaid float → BigInt. **PASS** |
| Cutoff | `date: new Date(plaidTxn.date)` uses Plaid's transaction date. **PASS** |
| Classification | `accountCode` + `bankAccountCode` resolved from COA before insert. **PASS** |
| Valuation | `Math.abs(amount)` before BigInt conversion; sign is determined by `isExpense` flag. **PASS** |
| Rights | `userId` scoped on all COA lookups; `idempotency` check also scopes by `userId`. **PASS** |

**Concern — rounding in stock-lot commits (not in this file):** The
`admin/fix-unbalanced-entries` route (`route.ts:36-39`) documents two past entries
where `Math.round(totalProceeds*100)`, `Math.round(totalCostBasis*100)`, and
`Math.round(totalGainLoss*100)` were computed independently, breaking debit=credit.
These were patched surgically. The general stock-lot commit path was **not read** in
this session — flag for the next targeted audit.

### 2b — Tax Calculation (`tax/calculate/route.ts`)

| Assertion | Result |
|---|---|
| Existence | Auth-gated; user.id required before any data fetch. **PASS** |
| Completeness | Pulls Schedule C, D, 8949, 1040, tax docs. **PASS for what's wired** |
| Accuracy | `round2(n) = Math.round(n*100)/100` used throughout. **PASS** |
| Cutoff | `yearStart`/`yearEnd` filter on `journal_entry.date` for ledger drill-down. **PASS** |
| Classification | Schedule C expense query (`route.ts:98`) filters `entity: { entity_type: 'sole_prop' }` — **PARTIAL**: entities with a different `entity_type` (LLC, S-Corp) are silently excluded. |
| Valuation | `Number(le.amount)/100` converts BigInt cents to dollars. Sign: debit=+1, credit=-1 for expense accounts. **PASS** |
| Rights | All queries scoped to `user.id` or `userId`. **PASS** |

### 2c — Audit Log Chain (`writeAuditLog.ts`)

| Assertion | Result |
|---|---|
| Existence | Serializable transaction enforces atomic read-prev → compute-hash → insert. **PASS** |
| Completeness | `request_id` idempotency guard prevents double-write on retry. **PASS** |
| Accuracy | SHA-256 of `JSON.stringify({prev_hash, actor, action, target, payload})`. **PASS** |
| Cutoff | `created_at` auto-set by DB. **PASS** |
| Classification | `actor_type`, `action_type` are Prisma enums — reject invalid values. **PASS** |
| Rights | `actor_user_id` recorded but not enforced (audit log is append-only, no ownership filter needed). **PASS** |

---

## 3 · Controls & Evidence

### Auth Gate Survey

| Route | verifyCookie | getCurrentUser | requireTier | requireAdmin | Audit Log | Status |
|---|---|---|---|---|---|---|
| `POST /api/transactions/commit-to-ledger` | `getVerifiedEmail()` L11 | `findFirst({email})` L16 | — | — | No (relies on JE idempotency) | **Correct** |
| `GET /api/tax/calculate` | `getVerifiedEmail()` L47 | `findFirst({email})` L49 | — | — | No | **Correct** |
| `POST /api/ai/spending-insights` | `getVerifiedEmail()` L9 | `findFirst({email})` L14 | `requireTier` L21 | — | No | **Correct** |
| `GET /api/tastytrade/scanner` | `getVerifiedEmail()` L165 | `findFirst({email})` L169 | — | `requireAdmin` L163 | No | **Correct** |
| `POST /api/travel/liteapi/book` | Optional L94 | Optional L95 | — | — | No (commission_ledger written) | **Correct (public by design)** |
| `POST /api/cron/auto-categorize` | — | — | — | CRON_SECRET bearer L8 | No | **Correct (cron pattern)** |
| `POST /api/operations/projects/[id]/audit-ingest` | — (middleware bypass) | — | — | AUDIT_INGEST_SECRET bearer L46 | Yes L93 | **Correct** |
| `POST /api/operations/projects/[id]/run-pipe` | `getVerifiedEmail()` L44 | `findFirst({email})` L47 | — | — | No | **Correct** |

**No route found that calls a paid external service without auth or budget gate.**

### Middleware Public-Path Review (`middleware.ts:50-87`)

`/api/admin/verify` and `/api/admin/users` are explicitly in `PUBLIC_PATHS`
(`middleware.ts:53-54`). Cookie auth is bypassed at the middleware layer for
these two paths. Each must carry its own auth internally.

- `/api/admin/verify` — intentionally public (login endpoint that issues the
  `adminSession` cookie). Internal auth: bcrypt password check + env
  `ADMIN_PASSWORD`. **Correct by design.**
- `/api/admin/users` — **NOT READ in this session.** Its internal auth is
  unverified. The `PUBLIC_PATHS` bypass means a request with no cookie reaches it.
  If it lacks `requireAdmin()`, user data is exposed. **Flag for next audit.**

---

## 4 · Root Causes

### RC-1: Missing correlation block in fire payload (SEV-1)
`fireAuditRoutine.ts:82-91` builds the payload by concatenating `buildAuditPrompt()`
output with a correlation trailer. If `buildAuditPrompt` returns the template-only
string (because `projectTitle` was empty or goals were empty), the AUDIT_HEAD
constant at `buildAuditPrompt.ts:35` becomes just the generic instruction text —
indistinguishable from a misconfigured fire. The correlation trailer is appended
unconditionally, so a missing trailer suggests the Routine API call succeeded but
something upstream passed the wrong `text` value, or the call was made outside
`fireAuditRoutine` (e.g., a test or manual trigger).

### RC-2: `/api/admin/users` in PUBLIC_PATHS without verified internal auth (SEV-2)
The admin page requires the `adminSession` HMAC cookie to interact, but the
`/api/admin/users` route at `middleware.ts:53` bypasses cookie auth entirely. The
internal check was not read. If the route relies only on session-storage state
(client-side), it would be trivially bypassable via a direct API call.

### RC-3: Schedule C entity filter hardcoded to `sole_prop` (SEV-3)
`tax/calculate/route.ts:98` hard-filters `entity: { entity_type: 'sole_prop' }` when
fetching COA for ledger drill-down. A user with mixed entity types (e.g., LLC +
sole_prop) will see incomplete Schedule C line items. The `generateScheduleC`
service may have the same filter — not verified in this session.

### RC-4: Spending-insights OpenAI prompt built from unvalidated user input (SEV-3)
`ai/spending-insights/route.ts:28-44` injects `merchants` array (from `req.json()`)
directly into the prompt string with no sanitization. A valid-tier authenticated user
could inject adversarial prompt content via merchant names. Root cause: the endpoint
treats the request body as trusted (tier-gated user) rather than as untrusted data.

### RC-5: Cron auto-categorize runs all users in one request with silent per-batch failure (SEV-4)
`cron/auto-categorize/route.ts:29-38` fetches all users and loops. Any unhandled
exception inside `autoCategorizationService.categorizePendingTransactions` propagates
to the outer `catch` at line 51 and aborts the entire job, leaving remaining users
uncategorized with no partial-success report. Root cause: no per-user try/catch
isolation within the loop.

### RC-6: Hotel booking DB persist failure has no automated escalation (SEV-4)
`travel/liteapi/book/route.ts:222-233`: on DB failure after a successful LiteAPI
book, the route returns 500 with the `bookingId`. No Inngest event, no alert webhook,
no admin notification is fired. The booking is chargeable but untracked locally.
Root cause: no durable compensation step (the pattern used elsewhere via Inngest
is absent here).

---

## 5 · Failure Modes & Blast Radius

| ID | Failure | Blast Radius | Trigger |
|---|---|---|---|
| FM-1 | Correlation block absent in fire payload | Pipe run fails after 30-min timeout; no tasks generated; pipe budget incremented for nothing | This session — already live |
| FM-2 | `/api/admin/users` exposes user list without auth | All user records readable unauthenticated if internal check absent | Any unauthenticated HTTP request to that path |
| FM-3 | Schedule C silently excludes non-sole-prop entity COA | Tax estimate understates expenses; user files incorrect return | Any user with LLC + Schedule C income |
| FM-4 | OpenAI prompt injection via merchant names | LLM output manipulation; could cause misleading advice in "insights" | Any valid-tier authenticated user |
| FM-5 | Cron aborts mid-loop on one user error | Remaining users uncategorized until next cron run | Any single user whose categorization throws |
| FM-6 | Hotel booking confirmed but not persisted | Commission lost; no local booking record; user receives no confirmation email | DB timeout or connection error at booking time |
| FM-7 | Audit log genesis row missing | All `writeAuditLog` calls throw on first write; SOC 2 chain broken | Fresh deploy without seeding the genesis row |

---

## 6 · Traceability & Honest Delta

**Single sources of truth (verified):**
- Financial balances: `chart_of_accounts.settled_balance` (BigInt cents), updated in the same `$transaction` as ledger entries.
- Journal entries: `journal_entries` + `ledger_entries` in 1:2 relationship, atomic per commit.
- Audit log: `audit_log` hash chain, serializable isolation, idempotency via `request_id`.
- Operations pipe: `operations_projects.deep_research_input`, `.claude_code_audit_input`, `.audit_correlation_id` — single DB columns, written by distinct steps.

**Competing copies / drift risks (identified):**
- `buildAuditPrompt` string builder vs `buildAuditSegments` — covered by no-drift rule (`buildAuditPrompt.ts:15-17`), enforced by preview route. Not verified to be actually enforced in CI.
- COA `settled_balance` vs sum of ledger entries — balance is denormalized. If a ledger entry is inserted without going through `commitPlaidTransaction`, the balance drifts. The `recalculate-balances` admin route exists as a repair tool but the divergence would be silent.

**Where this project actually stands vs. the standard:**
- Auth gate pattern: **consistent and correct** across all read routes.
- Double-entry: **correct** for Plaid transactions; stock-lot commits had a past rounding bug (now surgically patched).
- Audit logging: **present and hash-chained** on the operations/audit flows; **absent** on most financial routes (transaction commits, tax reads). Not a compliance gap given the ledger itself is the financial paper trail, but it means financial mutations are not in the SOC 2 audit chain.
- Cost controls: **present** for AI/pipe/routine calls; **correct rate-limiting** on public travel booking.

**The uncomfortable truth:**
The automated audit pipe (PHASE3-3) cannot close its own loop when the fire payload
is missing the correlation block. This session is evidence of that failure. The
`await-audit` timeout in `operations-pipe-run.ts:149-158` is 30 minutes — that clock
started when the pipe run fired this routine. The pipe will fail terminal. The fix
is to debug why `fireAuditRoutine.ts:82-91` produced a payload without the correlation
trailer before re-running any project pipe.

---

## Severity Ranking

| Rank | ID | Finding | File:Line | Action Needed |
|---|---|---|---|---|
| 1 | FM-1 | **FIRE PAYLOAD MISSING CORRELATION BLOCK** — pipe will time out, no tasks generated | `src/lib/fireAuditRoutine.ts:82-91` | Alex: debug payload assembly; likely the `text` field was not the full concatenation |
| 2 | FM-2 | `/api/admin/users` in PUBLIC_PATHS — internal auth unverified | `src/middleware.ts:53`, `src/app/api/admin/users/route.ts` (not read) | Read that route; verify `requireAdmin()` is called FIRST |
| 3 | FM-3 | Schedule C entity filter hardcoded `sole_prop` | `src/app/api/tax/calculate/route.ts:98` | Multi-entity users get wrong Schedule C |
| 4 | FM-4 | OpenAI prompt injection via unvalidated merchant names | `src/app/api/ai/spending-insights/route.ts:28-44` | Sanitize or limit merchant name length before prompt injection |
| 5 | FM-5 | Cron aborts all users on one failure | `src/app/api/cron/auto-categorize/route.ts:29-38` | Add per-user try/catch |
| 6 | FM-6 | Hotel booking confirmed but DB persist failure has no alert | `src/app/api/travel/liteapi/book/route.ts:222-233` | Add Inngest event or alert on this path |
| 7 | FM-7 | Audit log genesis row missing → all writes fail | `src/lib/audit/writeAuditLog.ts:78-81` | Ensure genesis seed is in deploy checklist |

---

*Audit filed: 2026-06-20. Session: unwatched Routine run. POST to audit-ingest: CANNOT COMPLETE (missing project_id and correlation_id). Alex must re-fire the pipe after debugging fireAuditRoutine payload assembly.*
