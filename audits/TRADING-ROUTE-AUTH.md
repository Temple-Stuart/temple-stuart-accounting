# TRADING/ROUTE.TS — AUTH + SCOPE AUDIT (read-only)

**Branch:** `claude/audit-trading-route-auth` · **Date:** 2026-06-21 · **Scope:** is `GET /api/trading` (`src/app/api/trading/route.ts`) properly authenticated + user-scoped, and what's the T- lookup state. Read-only; every claim cites `file:line`. DB truth is Alex's — reachability only.

---

## HEADLINE VERDICT

`GET /api/trading` **IS authenticated** (cookie → email → user lookup) and the **data it RETURNS is user-scoped** (transactions/positions are filtered by the user's `accountId`/`user_id`). **No direct cross-user data leak.** But there are **two real defects**: (1) the COA-codes query (`:35-36`) is **not user/entity-scoped** — it reads *all users'* trading COAs (a least-privilege gap + a mis-categorization risk, not a leak), and (2) the `T-3200`/`T-3300` filters (`:108,:111`) can never match the DB's bare codes, so **contributions/withdrawals are always $0** (data-correctness bug). The route calls **no paid external API** (DB-only), so there is **no CRITICAL paid-unauth issue**.

---

## 1. REFERENCE PATTERN — `cart-plan/route.ts`

The auth bar (cart-plan calls OpenAI, a PAID API, so it tiers):
- `getVerifiedEmail()` (`:77`) → `401 Unauthorized` if absent (`:79`).
- `prisma.users.findFirst({ … email … })` (`:81`).
- `requireTier(user.tier, 'ai', user.id)` (`:88`) — the paid-feature gate.

So the bar = **verifyCookie (via `getVerifiedEmail`) → user lookup → (requireTier ONLY when a paid call follows).**

## 2. TRADING/ROUTE.TS — FULL AUTH STATE

- `getVerifiedEmail()` — **EXISTS** (`trading/route.ts:7`); `401` if absent (`:8-9`).
- `prisma.users.findFirst({ … email … })` — **EXISTS** (`:12`); `404` if absent (`:13-14`).
- `requireTier(...)` — **MISSING**, but **not required**: this route makes **no paid external API call** (grep for `fetch(`/`openai`/`anthropic`/`http` → none; it reads `prisma` only). So `requireTier` is correctly absent.
- **PUBLIC_PATHS:** `/api/trading` is **NOT** in `middleware.ts` PUBLIC_PATHS (`:50-90`; the list has `/`, `/api/auth`, `/api/inngest`, travel routes — no `/api/trading`). So middleware's cookie gate applies. **EXISTS (gated).**
- **Paid external API?** **No** — DB-only. So no public+unauth+paid CRITICAL flag.

**VERDICT: FULLY AUTHENTICATED** for a free, user-data read. `getVerifiedEmail` + user lookup run first; the response data is user-scoped (§3). The defects below are **scope-correctness**, not missing-auth.

## 3. THE UNSCOPED QUERY (`:35-36`)

```ts
const tradingCodes = await prisma.chart_of_accounts.findMany({
  where: { module: 'trading' },          // :36 — ONLY filter
  select: { code: true, name: true, account_type: true }
});
```
- **WHERE fields:** `module: 'trading'` **only**. **NOT** filtered by `userId`, **NOT** by `entity_id`. So it returns **every user's** trading COA codes. — **RISK (least-privilege gap).**
- **Authenticated-user variable available for the fix:** `user` (`:12`) and `user.id` — already in scope. A user-scoped fix is `where: { module: 'trading', userId: user.id }`. `chart_of_accounts` has a `userId` field (per schema). EXISTS.
- **Data-leak severity — LOW-to-MEDIUM, NOT a direct leak:** the `codes` from this query are used **only** as a filter for the user's own transactions, which ARE re-scoped by `accountId: { in: accountIds }` (`:44`, `accountIds` = the user's accounts, `:18-22`); positions are scoped by `userInvestmentTxnIds`/`user_id` (`:64,72,80`). **No other user's transactions/positions are returned.** The real exposures:
  1. **Cross-user READ of COA metadata** (`code/name/account_type`) that this route fetches but does **not** return in the response — a defense-in-depth / least-privilege violation, not a financial-data leak.
  2. **Mis-categorization risk:** because bare codes are reused across users (established fact), the polluted `codes` set could cause **this** user's transactions to be counted as "trading" if a code collides with another user's trading code — a correctness bug, still confined to the user's own rows (the `accountId` filter holds).

  → **Not a data leak of another user's financials; it IS an unscoped cross-user read + a mis-categorization risk.** Should be user-scoped on principle + correctness.

## 4. THE T- LOOKUPS (`:108,:111`)

```ts
const contributions = transactions.filter(t => t.accountCode === 'T-3200')  // :108
  .reduce((sum, t) => sum + Math.abs(t.amount), 0);
const withdrawals   = transactions.filter(t => t.accountCode === 'T-3300')  // :111
  .reduce((sum, t) => sum + Math.abs(t.amount), 0);
```
- These are **`.filter()` string-equality checks** on the already-fetched (user-scoped) `transactions` array — **NOT** `chart_of_accounts` lookups, so **not** entity-scoped like commit-to-ledger (and they don't need to be — `transactions` is already `accountId`-scoped). Different mechanism, **same prefix bug.**
- The `transactions.accountCode` values come from the `tradingCodes` set (`:38,45`), which holds **bare** codes (per DB). Comparing them to `'T-3200'`/`'T-3300'` **never matches** → **`contributions` and `withdrawals` are always 0.** — **RISK (silent $0).**
- **Bare targets exist as trading equity:** `3200` "Capital Contributions - Trading", `account_type: 'equity'` (`seed-trading-coa.ts:26`); `3300` "Capital Withdrawals - Trading", `account_type: 'equity'` (`:27`). Fix = `'T-3200'→'3200'`, `'T-3300'→'3300'`. CONFIRMED.

## 5. BLAST RADIUS

**`GET /api/trading` consumer — NOT LOCATED.** Grep across `src` for `fetch('/api/trading')` (the bare path, excluding `/api/trading/...` and `/api/trading-...`) → **no hit**. `trading/page.tsx` fetches `/api/trading/trades`, `/api/trading-journal`, `/api/trading/commit-to-ledger` (from prior audit) — **not** the bare GET. **NOT VERIFIED reachable** (could be legacy/unused, or invoked via a path/dynamic call not found by grep). Reachability reported from code only — no claim about whether it has ever run.

## 6. FIX SURFACE TABLE

| Group | File · lines | Proposed change | Concept |
|---|---|---|---|
| **(a) scope/security** | `trading/route.ts:35-36` | add `userId: user.id` to the `where` (`{ module: 'trading', userId: user.id }`) | user-scope the COA query (least-privilege + no mis-categorization) |
| **(b) code-correctness** | `trading/route.ts:108,111` | `'T-3200'→'3200'`, `'T-3300'→'3300'` | bare-code filters so contributions/withdrawals compute |

**Same concept or split?** They are **closely related** — both make `GET /api/trading` read the **correct, user-scoped trading data** for the *same route*, both are in the **same file**, and both are **tiny**. (a) is a scope/security correction; (b) is a value bug — arguably two concepts.

**RECOMMENDATION: ONE PR** ("correct + user-scope `trading/route` trading queries"). Reasoning: the diff is ~3 lines in one file; both defects are facets of "this route's trading reads are wrong"; (b) without (a) still leaves the unscoped query, and (a) without (b) still leaves $0 contributions — shipping them together delivers a coherent, correct route in one revertible change. **Conservative alternative** (if strict one-concept-per-PR is preferred): split into PR-A (the `userId` scope, tagged *security*) and PR-B (the `T-`→bare filters, tagged *fix*) — both small and independent. Given the consumer is **NOT VERIFIED reachable**, urgency is low either way; correctness-when-revived is the goal.

---

## SUMMARY

- **Auth: present and correct** (`getVerifiedEmail:7` + user lookup `:12`); not public; no paid API → no `requireTier` needed; **fully authenticated.**
- **Returned data: user-scoped** (`accountId`/`userInvestmentTxnIds`/`user_id`) → **no direct cross-user leak.**
- **Defect 1 (scope):** `:35-36` reads **all users'** trading COAs (least-privilege gap + mis-categorization risk; fix = `userId: user.id`).
- **Defect 2 (prefix bug):** `:108,111` `T-3200/T-3300` never match bare codes → **contributions/withdrawals always $0** (fix = bare; targets confirmed `seed-trading-coa:26-27`).
- **Reachability:** bare `GET /api/trading` caller **NOT VERIFIED** found.

*Read-only audit. No code changed; this `.md` is the only file created. DB truth is Alex's; reachability reported from code only.*
