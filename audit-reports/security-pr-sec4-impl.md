# SECURITY — PR-SEC4 Implementation: gate shared-firm-account TastyTrade routes to admin

**Branch:** `claude/security-pr-sec4`
**Date:** 2026-05-31
**Scope:** Gate every `/api/tastytrade/*` route that uses the **shared firm
account** with `requireAdmin`, so only the admin/owner (Alex) can spend it or read
its data. The sweep found TastyTrade auth = shared env creds (not per-user OAuth)
→ any logged-in user spent Alex's account (`scanner`/`chains`/`quotes`/`greeks`)
and **leaked his brokerage data** (`balances`/`positions`/`status`). This is a
**data-leak fix (highest priority) + cost fix**. Per
`audit-reports/security-sweep-audit.md`. 10 files + report. **0 schema, 0 deps,
TT call logic unchanged.**

---

## STEP 1 — Shared-firm-session confirmed + route table

**Shared firm session (not per-user):** `getTastytradeClient()`
(`src/lib/tastytrade.ts:6-13`) builds the client from **env creds**
(`TASTYTRADE_CLIENT_SECRET` / `TASTYTRADE_REFRESH_TOKEN`). Crucially,
`getAuthenticatedClient(userId)` (`:`) checks for a `tastytrade_connections` row
for the user **but returns `getTastytradeClient()` — the SHARED client** regardless
(the row is only an "is-connected" flag). `getTastytradeSessionToken` likewise uses
`TT_USERNAME`/`TT_PASSWORD`. **So there is NO per-user token** — every TT call hits
Alex's firm account. The sweep's correction is verified; **no route is genuinely
per-user** (none to over-gate).

| Route | Firm-acct action | Was | Now |
|---|---|---|---|
| `balances` | **reads** firm balances (DATA LEAK) | login-only | `requireAdmin` |
| `positions` | **reads** firm positions (DATA LEAK) | login-only | `requireAdmin` |
| `status` | reads firm connection/accounts (DATA LEAK — account #s) | login-only | `requireAdmin` |
| `scanner` | **spends** — batched candle scan (broad cost) | login-only | `requireAdmin` |
| `chains` | spends — option-chain fetch (arbitrary symbol) | login-only | `requireAdmin` |
| `greeks` | spends — market-data subscribe (arbitrary symbol) | login-only | `requireAdmin` |
| `quotes` | spends — market-data subscribe (arbitrary symbol) | login-only | `requireAdmin` |
| `connect` | calls `getCustomerAccounts()` (**leaks Alex's account #s**) + unlocks the firm session for a user | login-only | `requireAdmin` |
| `callback` | touches the shared client + updates connection state | login-only | `requireAdmin` |
| `disconnect` | deletes the caller's own `tastytrade_connections` row (no TT call) | login-only | `requireAdmin` |

`backtest/{run,simulate,available}` (also shared-firm, currently **no auth**) are
**out of scope here** — the sweep assigned them to SEC-2 (the no-auth test/backtest
batch). `test/*` + `data-observatory/check` = SEC-2/3/6.

**Per-user routes flagged (NOT over-gated):** none in `/api/tastytrade/*` — all are
firm-scoped. (Plaid/Stripe per-user routes, per the sweep, are a different cluster
and untouched here.)

## STEP 2 — Gate added (the convergence pattern)

Each of the 10 routes got, as the **first statement** in the handler:
```ts
import { requireAdmin } from '@/lib/require-admin';   // added after the cookie-auth import
…
    const adminGate = await requireAdmin();
    if (adminGate instanceof NextResponse) return adminGate;   // 403 non-admin / 401 guest
    const userEmail = await getVerifiedEmail();   // existing — preserved
```
The existing `getVerifiedEmail` + `users.findFirst` lookup is **kept** (admin
passes both), so downstream `user.id` usage is unchanged — minimal diff, no logic
touched. Verified the guard precedes the **actual TT call** in every route
(`balances` guard@14 vs first call@26; `scanner` @162 vs @174; etc. — all
GUARD-FIRST ✓). `disconnect` has no TT call (DB-only) but is gated for consistency.

## STEP 3 — Verify (per path)

- **Alex (admin):** `requireAdmin` returns his email (not a `NextResponse`) → the
  handler proceeds; every TT route works exactly as before. ✅
- **Other logged-in user:** email ≠ `OWNER_EMAIL` → **403 returned before any TT
  call or data read** → no firm-account spend, **no data leak**. ✅
- **Guest:** `requireAdmin` returns 401 (no verified email); middleware also
  blocks/redirects (routes not in PUBLIC_PATHS). Double-blocked. ✅

## Hard-constraint compliance

| Constraint | Status |
|---|---|
| `requireAdmin` (existing mechanism) on every firm-account TT route; no invented auth, no hardcoded userId | ✅ all 10 use `requireAdmin` |
| 403 before any TT call / data read — hard gate, no fallback | ✅ guard is the first handler statement; precedes every TT call |
| Genuinely per-user routes flagged, not over-gated | ✅ none exist (all firm-scoped — confirmed via `getAuthenticatedClient`) |
| Do NOT change TT call logic — auth gate only | ✅ only the guard + import added; TT calls/`userEmail`/`user.id` flow unchanged |
| Don't break Alex's access | ✅ admin passes the gate + the existing login check |
| 0 schema, 0 deps | ✅ |
| `tsc --noEmit` | ✅ exit 0 |
| eslint | ✅ 25 `no-explicit-any` errors are **pre-existing on main** (identical per-route counts: branch == main for all 10) — **0 new** from the guard |
| git diff scoped | ✅ the 10 `tastytrade/*` route files (+ this report) |

---

## Result
All 10 firm-account `/api/tastytrade/*` routes are now `requireAdmin`-gated: only
Alex can read his brokerage data (`balances`/`positions`/`status` — the data leak)
or spend his firm account (`scanner`/`chains`/`greeks`/`quotes`/`connect`/
`callback`), with `disconnect` gated for consistency. Any other logged-in user gets
**403 before any TastyTrade call or data read**; guests are blocked. No genuinely
per-user TT route exists (the shared-client architecture confirmed), so nothing was
over-gated. TT call logic unchanged; tsc + lint clean (0 new); diff scoped to the 10
routes. (`backtest/*` no-auth routes remain for SEC-2.)
