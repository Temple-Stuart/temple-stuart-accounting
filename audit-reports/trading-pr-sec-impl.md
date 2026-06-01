# TRADING — PR-SEC Implementation: gate /api/trading/convergence to admin/owner

**Branch:** `claude/trading-pr-sec`
**Date:** 2026-05-31
**Scope:** Gate `/api/trading/convergence` so only the **admin/owner** (Alex, the
sole admin today) can run the paid scan pipeline. Today it's `getVerifiedEmail`-
only → ANY logged-in user triggers paid TastyTrade/Finnhub/FRED/xAI calls. Closed
with the **existing** `requireAdmin` helper. Per
`audit-reports/trading-pr-1-audit.md` §4. 1 file + this report. **0 schema, 0
deps. Scan logic unchanged.**

---

## STEP 1 — Current gate + paid calls confirmed

- **Before** (`convergence/route.ts:42-47`): `const userEmail = await
  getVerifiedEmail(); if (!userEmail) return 401;` — **login-only, NO tier/admin
  check.** Any authenticated user passed.
- **Paid calls:** the handler runs `runPipeline(limit, userId, universe)`
  (`:128`, + the SSE path `:78`), which hits the paid data feeds (TastyTrade /
  Finnhub / FRED / xAI). So any logged-in account could burn paid data.
- **Single handler:** only `GET` is exported (no POST/other) — one entry point to
  gate.

## STEP 2 — Existing admin/owner mechanism FOUND

The codebase already has a purpose-built API admin guard — **no invention or
hardcoded userId needed**:

- **`requireAdmin()`** (`src/lib/require-admin.ts:8-21`): calls `getVerifiedEmail`,
  returns **401** if no email, **403 "Forbidden: admin access required"** if the
  email ≠ `process.env.OWNER_EMAIL` (case-insensitive), else returns the verified
  email. Env-based owner gate → Alex (sole admin) only.
- **Reference usage** (the established pattern): `src/app/api/admin/*` routes —
  e.g. `fix-unbalanced-entries/route.ts:25-26`:
  ```ts
  const adminResult = await requireAdmin();
  if (adminResult instanceof NextResponse) return adminResult;
  ```
  Used by `fix-unbalanced-entries`, `fix-coa-ownership`, `recalculate-balances`,
  `backfill-transaction-fields`, etc.
- (A second mechanism exists — `isAdminUser(userId)` / `ADMIN_USER_ID` in
  `src/lib/tiers.ts:13,76` — but `requireAdmin` is the **API-route** guard that
  returns a ready `NextResponse`, so it's the right fit here.)

**Mechanism exists → implemented (per the task's conditional).**

## STEP 3 — The gate added

`convergence/route.ts` — the import swap + the guard replacing the login-only
check (`:42-53`):
```ts
import { requireAdmin } from '@/lib/require-admin';   // was getVerifiedEmail
…
export async function GET(request: Request) {
  try {
    const adminResult = await requireAdmin();
    if (adminResult instanceof NextResponse) return adminResult;   // 401 guest / 403 non-admin
    const userEmail = adminResult; // the verified admin email
    const { searchParams } = new URL(request.url);
    …
```
The guard is the **first statement** in the handler — **before** param parsing
(`:55`), the in-memory cache read (`:107`), the SSE streaming path (`:66`), and
**both** `runPipeline` calls (SSE `:84`, non-stream `:134`). So an unauthorized
caller gets 403 **before any paid call fires** — hard gate, no fallback, no
degraded scan. `userEmail` (= the returned admin email) still feeds the two
downstream `prisma.users.findFirst` lookups (`:71`, `:127`), so `userId`
resolution is unchanged.

## STEP 4 — Verified (each path)

- **Alex (admin/owner):** `requireAdmin` returns his email (≠ `NextResponse`) →
  the handler proceeds exactly as before — scan runs, pipeline + filters
  unchanged. ✅
- **Other logged-in user:** email ≠ `OWNER_EMAIL` → `requireAdmin` returns a
  **403** `NextResponse` → `return adminResult` → **pipeline does NOT run, no paid
  call fires.** ✅
- **Guest:** no verified email → `requireAdmin` returns **401** (same as before
  via `getVerifiedEmail`, now inside `requireAdmin`) → blocked before anything. ✅

## Hard-constraint compliance

| Constraint | Status |
|---|---|
| Use the EXISTING admin/tier mechanism (no invented auth, no hardcoded userId) | ✅ `requireAdmin` (`OWNER_EMAIL`), the established `api/admin/*` pattern |
| 403 before any paid call — hard gate, no fallback | ✅ guard is the first statement; precedes params/cache/SSE/runPipeline |
| Do NOT change scan logic/pipeline/filters — auth gate only | ✅ diff is solely the auth swap; pipeline/params/cache untouched |
| Do NOT break Alex's own access | ✅ admin email passes through unchanged; downstream `userId` lookup intact |
| 0 schema, 0 deps | ✅ |
| `tsc --noEmit` | ✅ exit 0 |
| eslint | ✅ route **0 problems** |
| git diff scoped | ✅ `convergence/route.ts` only (+ this report) |

---

## Result
`/api/trading/convergence` is now gated by `requireAdmin` (the existing
`OWNER_EMAIL` mechanism): the admin/owner (Alex) runs the scan exactly as before;
any other logged-in user gets **403 before the pipeline runs** (no paid
TastyTrade/Finnhub/FRED/xAI call fires); guests get 401. The scan logic, pipeline,
filters, and cache are untouched — this is an auth gate only. No invented auth, no
hardcoded userId; 0 schema, 0 deps; tsc + lint clean; diff scoped to the route.
