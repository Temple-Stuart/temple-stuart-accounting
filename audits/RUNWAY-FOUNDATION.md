# RUNWAY ENGINE FOUNDATION — AUDIT (read-only)

**Branch:** `claude/audit-runway-foundation` · **Date:** 2026-06-21 · **Scope:** verify the foundation
for a runway engine (net burn, cash, runway months, zero date) — which of the 4 inputs already exist
in code vs must be built. Read-only; every claim cites `file:line`. **No DB access** — code only; row
checks flagged for Alex's psql. Unread = "NOT VERIFIED."

---

## VERDICT TABLE (Q1–Q5)

| Q | Finding | Key `file:line` | Status |
|---|---|---|---|
| **Q1 Plaid balance** | Plaid fully wired; total cash already summed from stored `currentBalance` | `api/metrics/route.ts:22-27`, `api/accounts/route.ts:37`, `plaid/exchange-token:104-124` | **READY** (stored/sync-refreshed; no live `/balance/get`) |
| **Q2 Income from ledger** | RUNWAY-1 shipped — revenue credits, user-scoped, `byEntity` | `api/income/route.ts:40-59`, `:127-129` | **READY** |
| **Q3 Expense for net burn** | Actual expense debits queryable (YTD + per-entity); `net` already computed | `api/metrics/route.ts:30-42,143`, `year-calendar:122-139` | **READY** (actuals) |
| **Q4 Burn/runway structures** | No table, column, migration, route, or UI readout for runway/burn anywhere | schema grep (only `accounts.currentBalance:42`); no `/api/runway` | **MISSING** |
| **Q5 Hub surface** | `RunwayBudgetPanel` is the mount; header has room above the toggle; no metric cards exist | `RunwayBudgetPanel.tsx:24-54`, `ModuleLauncher.tsx:448-453` | **READY** (surface exists, empty of metrics) |

---

## Q1 — PLAID BALANCE (the chosen cash source)

**Plaid IS wired — fully.**

| Piece | Evidence | Auth |
|---|---|---|
| Client/SDK | `src/lib/plaid.ts:27` `export const plaidClient = new PlaidApi(configuration)` (production, `:9`) | n/a |
| Link-token route | `api/plaid/link-token/route.ts:40` `plaidClient.linkTokenCreate` | `getVerifiedEmail:10` → user `:16` → **`requireTier(user.tier,'plaid'):24`** ✅ |
| Public-token exchange | `api/plaid/exchange-token/route.ts:29` `itemPublicTokenExchange` | same gate, **`requireTier:24`** ✅ |
| Access-token storage | `exchange-token:60-70` `prisma.plaid_items.create({ … accessToken … })` | — |
| Accounts + balance storage | `exchange-token:73` `plaidClient.accountsGet`; writes `currentBalance:104,123` + `availableBalance:105,124` from `account.balances.current/available` | — |
| Schema | `schema.prisma:31` `model accounts` → `availableBalance Float? :41`, `currentBalance Float? :42` | — |

**Is there a route/function returning a LIVE bank BALANCE?**
- **A dedicated live `/accounts/balance/get` (`accountsBalanceGet`) — MISSING.** Grep across `**/*.ts`
  for `accountsBalanceGet` → **zero hits.** Balance is fetched via `accountsGet` (which *includes*
  `balances`) at **link time** (`exchange-token:73`) and **refreshed on sync**
  (`transactions/sync-complete/route.ts:79-80`; deprecated `plaid/sync:75-76,89-90`), then **stored**
  on `accounts.currentBalance`.
- **The total cash balance is ALREADY computed and returned** by `api/metrics/route.ts:22-27`:
  ```sql
  SELECT COALESCE(SUM("currentBalance")::numeric, 0) as total_balance
  FROM accounts WHERE "userId" = ${userId}          -- :25 user-scoped
  ```
  returned as `balance` (cents, `:27,152`). Per-account balance also at `api/accounts/route.ts:37`
  (`balance: account.currentBalance || 0`, user-scoped `where userId :22`).

**Security mandate:** `/api/metrics` and `/api/accounts` are **DB-only reads** (no paid Plaid call) →
`getVerifiedEmail` + user lookup is the correct bar; `requireTier` is **not** required (it gates only
when a paid call follows — the reference `ai/cart-plan` tiers because it calls OpenAI). The **paid**
Plaid calls (`link-token`, `exchange-token`, `sync`) **do** `requireTier(...,'plaid')` (`:24/:24/:40`).
**No paid-unauth gap.**

> **VERDICT: (a) READY to read.** Cash = `SUM(accounts.currentBalance)`, already exposed by
> `/api/metrics` (`:22-27`), user-scoped, refreshed on each Plaid sync. **Caveat:** this is the
> **sync-time stored** balance, not a real-time `/accounts/balance/get` pull (which is MISSING but
> **not required** for a runway readout). It is **not GREENFIELD** and **not merely PARTIAL** — tokens,
> accounts, balances, and a balance-sum endpoint all exist today.

## Q2 — INCOME FROM LEDGER (RUNWAY-1) — **EXISTS, VERIFIED**

`api/income/route.ts` (RUNWAY-1) computes income from the **ledger**, not `transactions`:
```sql
-- :40-59
SUM(le.amount) ... FROM ledger_entries le
JOIN journal_entries je ON le.journal_entry_id = je.id
JOIN chart_of_accounts coa ON le.account_id = coa.id
JOIN entities e ON coa.entity_id = e.id
WHERE je."userId" = ${user.id}            -- :53 user-scoped
  AND je.is_reversal = false AND je.reversed_by_entry_id IS NULL
  AND coa.account_type = 'revenue' AND le.entry_type = 'C'
```
**Returns** (`:111-137`): `byCode`, `byMonth`, `summary{ ytdTotal, allTimeTotal, monthlyAvg,
transactionCount }`, **`byEntity`** (per Personal/Business/Trading, `:127-129`), `recentTransactions`.
**User-scoped** (`je."userId" = user.id`, auth `getVerifiedEmail:25` → user `:30`). A second YTD copy
exists at `api/metrics/route.ts:45-57` (`revYtd`). **READY.**

## Q3 — EXPENSE INPUT FOR NET BURN

Net burn = **expenses − income**, on **ACTUALS** (committed-ledger), not planned/routines.

| Source | Query | Scope |
|---|---|---|
| **ACTUAL (metrics)** | `metrics:30-42` `SUM(le.amount)` `account_type='expense' AND entry_type='D'`, YTD | user, **all-entity** |
| **ACTUAL (personal)** | `year-calendar/route.ts:122-139` `$queryRaw` expense debits per `coa × month`, `e.entity_type='personal'` | user, personal |
| **ACTUAL (business)** | `business-budget/route.ts` expense-debit `$queryRaw`, `entity_type IN ('sole_prop','business')` | user, business |
| PLANNED (routines) — *not for net burn* | `year-calendar:87-115` `routinesMonthlyByCoa` | budget, not actual |

**Appropriate for net burn = the ACTUAL expense debits** (matches the income basis — same
`ledger_entries`/committed/non-reversed filter), so `expenses − income` is a **true single-basis net
burn**. **`metrics` already computes it:** `net = revYtd − expYtd` (`:143`) → **net burn = `expYtd −
revYtd` = `−net`**. The all-entity **YTD** figure is **reusable as-is** (negate `metrics.net`). An
**entity-scoped or trailing-window** net burn must be **BUILT** — small: mirror the income `byEntity`
query with an expense-debit twin.

## Q4 — EXISTING BURN/RUNWAY STRUCTURES — **MISSING (all of it)**

- **Schema:** grep `schema.prisma` for `runway|burn|net_burn|cash_balance|zero_date` → **only**
  `accounts.currentBalance:42` / `availableBalance:41`. **No** runway/burn/cash table or column.
- **Migrations:** grep `prisma/` for `runway|net_burn|burn_rate|cash_balance|zero_date` → **No files
  found.** No migration introduces any runway structure.
- **Routes:** glob `src/app/api/**/{runway,burn,cash}/**/route.ts` → **No files found.** No `/api/runway`
  or `/api/burn`.
- **UI:** the only "Runway" components are `RunwayBudgetPanel.tsx` (a Month/Year **toggle wrapper** over
  `HubBudgetSection`/`BudgetComparison` — `:55`) and `RunwayDataProvider.tsx` (a **context** that fetches
  the **three budget routes** — `:68-121`; carries `budgetData/actualData`, **no** burn/cash/runway
  fields). **No runway readout, metric card, or even a stub** computes cash ÷ burn anywhere.
- The metrics that exist (`balance`, `expYtd`, `revYtd`, `net`) are consumed **only** on the **dashboard**
  (`MetricsAndProjectionsTab.tsx:49` `fetch('/api/metrics')`) — **not** on the hub, and **not** as runway.

→ The **net-burn → runway-months → zero-date math is MISSING**; the **raw inputs all exist.**

## Q5 — THE HUB SURFACE

The runway readout would render in **`RunwayBudgetPanel`** — mounted in
`ModuleLauncher.tsx:448-453` inside `<RunwayDataProvider>`. Its header block
(`RunwayBudgetPanel.tsx:24-54`) already has a title ("Runway Budget", `:28`) + a Month/Year toggle;
**the natural attach point for cash / net-burn / runway-months / zero-date is this header, above the
`{view === 'month' ? … : …}` switch (`:55`).**

**On the "Planned/Actual/Variance cards" from prior work — NOT VERIFIED as cards.** `HubBudgetSection`
renders a **Budget-vs-Actual table** with a **Total footer** (`HubBudgetSection.tsx:209-226`), not
top-line metric cards. No metric-card component was found in `RunwayBudgetPanel` / `HubBudgetSection` /
`BudgetComparison`. The surface exists and is empty of metrics — a readout is **additive**, not a
retrofit of existing cards.

---

## BUILD vs REUSE — the 4 runway inputs

| Input | REUSE or BUILD | Evidence |
|---|---|---|
| **1. Net burn** (exp − inc) | **REUSE blocks** (all-entity YTD reusable as-is via `−metrics.net`); **BUILD** the entity-scoped/trailing-window variant | expense `metrics:30-42`, income `income:40-59` / `metrics:45-57`, `net = revYtd−expYtd` `metrics:143` |
| **2. Cash** (Plaid balance) | **REUSE** — already returned | `metrics:22-27` `SUM(currentBalance)`, user-scoped `:25` |
| **3. Runway months** (cash ÷ burn) | **BUILD** — trivial arithmetic; **no** divide computed anywhere | nothing in repo; guard `burn ≤ 0` → honest "n/a" (no fake number) |
| **4. Zero date** (today + months) | **BUILD** — trivial date math from #3 | nothing in repo |

**Two of four inputs (cash, income) are READY today; expense actuals are READY; only the two
derived numbers (runway months, zero date) are genuinely new code — plus the readout UI.**

## PLAID SCOPE — **SMALL add, NOT a sub-project**

Plaid is **fully integrated** (client, link-token, exchange-token, token storage, account+balance sync,
schema). The **total cash balance is already computed and returned** by `/api/metrics` (`:22-27`).
Wiring cash into runway = **consume an existing field**, not build a Plaid integration. **No greenfield
Plaid work, no new paid endpoint, no migration.**

→ **Fix #4 (runway) is ONE PR**, not several: a compute-on-read runway figure (cash from a metrics-style
`SUM(currentBalance)`, net burn from expense−income on the committed ledger, then months + zero date) +
a small readout in `RunwayBudgetPanel`'s header. The only genuinely-new code is the months/zero-date
arithmetic and the UI.

---

## DB CHECKS FOR ALEX (psql — schema names only; not run here)

1. **Cash is populated + fresh** (drives runway numerator):
   ```sql
   SELECT id, name, "currentBalance", "availableBalance", "updatedAt"
   FROM accounts WHERE "userId" = $UID ORDER BY "updatedAt" DESC;
   -- confirm currentBalance is non-null and recently synced (stale balance → stale runway).
   ```
2. **Trailing-window income vs YTD** (the runway denominator pitfall): prior RUNWAY-1 verification put
   **all-time income ≈ $176,135.61 but YTD ≈ $905** (Alex quit his job). A **YTD** net burn would read
   near-infinite/odd; the engine should use a **trailing window** (e.g. last 3–6 months), not YTD:
   ```sql
   SELECT EXTRACT(YEAR FROM je.date) yr, EXTRACT(MONTH FROM je.date) mo,
          SUM(CASE WHEN coa.account_type='expense' AND le.entry_type='D' THEN le.amount ELSE 0 END) exp_cents,
          SUM(CASE WHEN coa.account_type='revenue' AND le.entry_type='C' THEN le.amount ELSE 0 END) rev_cents
   FROM ledger_entries le
   JOIN journal_entries je ON le.journal_entry_id = je.id
   JOIN chart_of_accounts coa ON le.account_id = coa.id
   WHERE je."userId" = $UID AND je.is_reversal = false AND je.reversed_by_entry_id IS NULL
   GROUP BY 1,2 ORDER BY 1 DESC, 2 DESC LIMIT 12;
   -- gives the per-month burn the trailing-window engine should average.
   ```
3. **No runway/burn table to count** — the engine is **compute-on-read** (no migration needed) unless we
   later choose to persist snapshots; flag if persistence is wanted (that WOULD be a migration = human gate).

---

*Read-only audit. No code changed; this `.md` is the only file created. DB-row checks flagged for Alex's
psql — not run here. Every claim cites `file:line`; unread items marked NOT VERIFIED.*
