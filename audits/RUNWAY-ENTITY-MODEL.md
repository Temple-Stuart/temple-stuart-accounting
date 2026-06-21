# RUNWAY ENTITY-MODEL — FEASIBILITY AUDIT (read-only)

**Branch:** `claude/audit-runway-entity-model` · **Date:** 2026-06-21 · **Scope:** can the shipped runway
engine become entity-aware per the locked model — (1) operating runway = Personal + Business combined +
per-entity breakdown; (2) Trading excluded from operating burn, shown separately; (3) only
trading→personal withdrawals count as operating income. Read-only; every claim cites `file:line`. **No DB
access** — code only; row checks flagged for Alex. Unread = "NOT VERIFIED."

---

## VERDICT TABLE (Q1–Q6)

| Q | Finding | Key `file:line` | Status |
|---|---|---|---|
| **Q1 Trading contaminates burn?** | **YES** — runway burn has NO entity filter; trading revenue/expense netted in | `api/runway/route.ts:101-113` | **CONTAMINATED** (confirmed) |
| **Q2 Entity attribution possible?** | `journal_entries.entity_id` direct + `ledger→coa.entity_id→entities`; income route already groups by entity | `schema.prisma:183,150,70`; `income:52,58` | **READY** |
| **Q3 Three entity ids resolvable?** | `entity_type` strings used everywhere — BUT a real conflict on Trading's type | `seed-entities.ts:13` vs `commit-to-ledger:35` | **PARTIAL** (resolve the conflict) |
| **Q4 Trading→personal withdrawal bridge** | No cross-entity transfer posts a trading withdrawal as personal income | `seed-trading-coa.ts:26-27`; no transfer journal | **MISSING** |
| **Q5 Trading panel data** | Realized P&L + contributions/withdrawals queryable; capital partial; drawdown absent | `trading/route.ts:94-95,107-112`; `commit-to-ledger:42-52` | **PARTIAL** (P&L READY) |
| **Q6 Panel surface** | Readout block in header is the attach point for both | `RunwayBudgetPanel.tsx:152-179` | **READY** |

---

## Q1 — DOES THE SHIPPED RUNWAY ROUTE INCLUDE TRADING TODAY? → **YES, CONTAMINATED**

`api/runway/route.ts:101-113` (the burn query, both legs):
```sql
SELECT
  COALESCE(SUM(CASE WHEN coa.account_type = 'expense' AND le.entry_type = 'D' THEN le.amount ELSE 0 END),0) AS exp_cents,
  COALESCE(SUM(CASE WHEN coa.account_type = 'revenue' AND le.entry_type = 'C' THEN le.amount ELSE 0 END),0) AS rev_cents
FROM ledger_entries le
JOIN journal_entries je    ON le.journal_entry_id = je.id
JOIN chart_of_accounts coa ON le.account_id = coa.id
WHERE je."userId" = ${userId}          -- :108  ← ONLY userId
  AND je.is_reversal = false           -- :109
  AND je.reversed_by_entry_id IS NULL  -- :110
  AND je.date >= ${startStr}::date     -- :111  trailing window
  AND je.date <  ${windowEndStr}::date -- :112
```
**There is NO `entity_id` filter and NO `entities` join.** The query scopes by `userId` +
`account_type` + `entry_type` + date only. Therefore **every entity's** revenue and expense — **including
Trading** — is netted into operating burn:
- Trading **gains** post to `4100` (`account_type='revenue'`) and trading **losses** to `5100`
  (`account_type='expense'`) on the **Trading entity** (`commit-to-ledger/route.ts:42-52` looks up
  `1010/4100/5100` under `entity_type:'trading'` `:35` and posts them, `:55-64`).
- Those rows match `coa.account_type IN ('revenue','expense')` → **they ARE summed here.**

→ **CONTAMINATION CONFIRMED.** Trading P&L currently moves the operating runway. The locked model
requires excluding the Trading entity from this query.

## Q2 — CAN ENTRIES BE ATTRIBUTED TO AN ENTITY? → **READY**

Two independent attribution paths exist:
- **`journal_entries.entity_id String`** — a **direct column** (`schema.prisma:183`), with a relation to
  `entities` (`:198`) and an index `@@index([entity_id, date])` (`:205`).
- **`ledger_entries` → `chart_of_accounts.entity_id`** — `ledger_entries.account_id` (`:215`) →
  `chart_of_accounts` (`:222`), whose **`entity_id String`** (`:150`) → `entities` (`:167`).
- `entities.entity_type String` (`:70`) is the discriminator.

A given ledger/journal row resolves to its entity **either** via `je.entity_id` **or** via
`coa.entity_id`. **The income route already does exactly this group-by:** `income/route.ts:52` `JOIN
entities e ON coa.entity_id = e.id`, `:58` `GROUP BY … e.entity_type`, `:84` `byEntityMap[r.entity_type]`
— producing Personal/Business/Trading buckets. The runway burn query already JOINs `je` and `coa`, so
adding `JOIN entities e ON coa.entity_id = e.id` + an entity predicate is a **minimal** change.

→ **VERDICT: per-entity burn/income split is BUILDABLE from existing data.** The only caveat is *how* to
name the trading entity in the predicate — see Q3.

## Q3 — THE THREE ENTITY IDS → **PARTIAL: a real `entity_type` conflict on Trading**

Entities are identified by the **`entity_type` string** throughout:
- `personal` — `year-calendar:30`, `nomad-budget:57`, `auto-categorization:99`.
- `sole_prop` — `business-budget:30`, `business/route.ts:21`, `schedule-c-service:164`.
- `trading` — `commit-to-ledger:35`, `seed-trading-coa.ts:83,87`, `batch-trade-processor.ts:403…1545`,
  `admin/seed-missing-coa:36`, `verify-trading-accounts.ts:6`.
- (note `metrics:72` / `tax-estimate:133` filter business as **`'business'`**, a *fourth* spelling — the
  budget routes use `'sole_prop'`. Flag: business entity_type spelling is itself inconsistent.)

**⚠ THE CRITICAL CONFLICT — Trading's `entity_type` is ambiguous in code:**
- **`seed-entities.ts:13`** seeds `{ name: 'Trading', entity_type: 'personal' … }`, and its own comment
  (`:55`) says *"Trading and Personal both use 'personal'."* This is the unified 3-entity seeder.
- **`commit-to-ledger:35` / `seed-trading-coa.ts:87` / `batch-trade-processor`** all create/resolve
  Trading by **`entity_type:'trading'`.**

These cannot both describe the live row. **NOT VERIFIED which is live** (no DB access). Indirect signal:
RUNWAY-1's `byEntity` reported a **distinct "trading" bucket** ($905, separate from personal
$175,230.61) — which only happens if the **live** Trading entity's `entity_type = 'trading'`. If it were
`'personal'`, trading P&L would have merged into the personal bucket. So the **live value is most likely
`'trading'`**, making `seed-entities.ts:13` stale — **but this MUST be confirmed before building** (it
decides whether trading is separable by `entity_type` at all).

→ **RECOMMENDATION:** resolve the three entities by **`entity_id`** (look each up by `name` /
`is_default`, as the seeders do) and filter the burn query on the **specific Trading `entity_id`** to
EXCLUDE it — rather than trusting the `entity_type` string. This is robust to the conflict above and to
the `business`/`sole_prop` spelling split. (`journal_entries.entity_id` makes this a direct, indexed
predicate.)

## Q4 — THE TRADING→PERSONAL WITHDRAWAL BRIDGE → **MISSING**

The locked model says only **trading→personal withdrawals** count as operating income (raw P&L does not).
- `3200` "Capital Contributions - Trading" and `3300` "Capital Withdrawals - Trading" exist as
  **Trading-entity equity** accounts (`seed-trading-coa.ts:26-27`, `account_type:'equity'`).
- `trading/route.ts:107-112` computes `contributions`/`withdrawals` by filtering
  `transactions.accountCode === '3200'/'3300'` — but that is **trading-internal** bookkeeping, and that
  route is **DEAD** (no caller — prior `TRADING-ROUTE-REACHABILITY` audit).
- **No journal/transfer posts a trading withdrawal as PERSONAL operating income.** Grep for
  `transfer|withdrawal|3300` finds only: Plaid investment `type==='transfer'` legs (option
  assignment/exercise, `batch-trade-processor.ts:184,1663-1666`) — unrelated to cash movement — and the
  3300 equity definition. **There is no cross-entity journal that debits Trading `3300` and credits a
  Personal cash/revenue COA.**

→ **DECLARE THE GAP (no fallback designed):** the trading→personal withdrawal bridge **cannot be built
yet** — no tracked transfer represents it. Operating runway must therefore show **WITHOUT**
trading-withdrawal income until such a transfer is modeled. *(A real withdrawal landing in a Plaid-linked
personal bank account would surface as a personal bank transaction, but nothing links it to the trading
`3300` leg — so as a **tracked bridge** it is MISSING.)*

## Q5 — TRADING PANEL DATA → **PARTIAL (realized P&L READY)**

| Panel figure | Source | Status |
|---|---|---|
| **Realized P&L** | `trading/route.ts:94-95` (`optionRealizedPL` from `closedPositions.realized_pl` + `stockRealizedPL` from dispositions); **and** the ledger — `commit-to-ledger` posts `4100` gains / `5100` losses on the Trading entity (`:42-52`) | **READY** |
| **Contributions / Withdrawals** | `trading/route.ts:107-112` filters `accountCode 3200/3300`; equity defs `seed-trading-coa.ts:26-27` | **READY** (data exists) |
| **Trading capital / balance** | Trading cash `1010` `settled_balance` (`commit-to-ledger:42-52` increments it); `accounts.currentBalance` if a trading account is linked | **PARTIAL** (figure exists; no dedicated read) |
| **Drawdown** | nothing computes peak-to-trough | **MISSING** |

**Caveat:** `trading/route.ts` is **DEAD** (no caller). The underlying data is real, but a trading panel
needs either to revive/point at that route or a small new trading-entity query (realized P&L from the
ledger `4100`/`5100` is the cleanest, single-basis source — consistent with the runway ledger basis).

## Q6 — THE RUNWAY PANEL SURFACE → **READY**

The shipped readout is the `<div className="mt-3">` block inside the panel header
(`RunwayBudgetPanel.tsx:152-179`): a flex row (`:158`) of a **Cash card** (`:160-168`) + the two
window cards (`:169-171`), with a source-label footnote (`:174-178`).
- **(a) Per-entity breakdown rows** attach **inside this `mt-3` block** — e.g. a sub-row under each
  window card, or a small Personal/Business table beneath the card row (same container, same tokens).
- **(b) A separate Trading panel** attaches as a **sibling after the header `</div>` (`:180`)**, around
  the `{view === 'month' ? … : …}` switch (`:181`) — a distinct card so trading is visually and
  semantically outside operating runway (matching the locked model's separation).

---

## BUILD PLAN PRECONDITIONS

**Buildable NOW (no missing data):**
1. **Exclude Trading from operating burn** (fixes Q1 contamination): add `JOIN entities e ON
   coa.entity_id = e.id` and exclude the Trading **`entity_id`** in `api/runway/route.ts:101-113`.
   *(Use entity_id, not the `entity_type` string — Q3.)*
2. **Per-entity breakdown** (Personal vs Business operating burn): group the same query by
   `e.entity_type`/`entity_id` — the income route's pattern (`income:52,58,84`) is directly reusable.
3. **Trading panel — realized P&L** from the ledger (`4100` gains − `5100` losses on the Trading entity)
   + contributions/withdrawals (`3200`/`3300`). READY.

**Blocked on missing data / decisions:**
4. **Trading→personal withdrawal income (Q4): BLOCKED** — no tracked transfer exists. Ship operating
   runway *without* it and declare the omission truthfully; do **not** synthesize it.
5. **The Trading `entity_type` conflict (Q3): BLOCKING CONFIRMATION** — must verify the live Trading
   entity's identity (entity_type/id) before writing the exclusion predicate, or the filter could either
   fail to exclude trading (if it's `'personal'`) or wrongly drop personal rows.
6. **Trading capital + drawdown (Q5): PARTIAL/MISSING** — capital needs a dedicated read; drawdown is new
   computation. Optional, not required for the operating-runway fix.

---

## DB CHECKS FOR ALEX (psql — schema names only; not run here)

1. **THE entity_type question (decides Q1/Q3 build):**
   ```sql
   SELECT id, name, entity_type, is_default
   FROM entities WHERE "userId" = '$UID' ORDER BY name;
   -- Confirm the live Trading entity's entity_type ('trading' vs 'personal') + its id.
   -- This determines whether burn can exclude trading by entity_type or MUST use entity_id.
   ```
2. **Journal volume per entity (confirms attribution + how much trading is contaminating burn):**
   ```sql
   SELECT e.entity_type, e.name, COUNT(*) AS journal_entries
   FROM journal_entries je JOIN entities e ON je.entity_id = e.id
   WHERE je."userId" = '$UID' GROUP BY e.entity_type, e.name ORDER BY 3 DESC;
   ```
3. **Does any trading→personal transfer exist (confirms Q4 MISSING)?** Any journal whose legs span BOTH a
   Trading-entity COA and a Personal-entity cash COA:
   ```sql
   SELECT je.id, je.date, je.description,
          array_agg(DISTINCT e.name)  AS entities_touched,
          array_agg(DISTINCT coa.code) AS codes
   FROM journal_entries je
   JOIN ledger_entries le      ON le.journal_entry_id = je.id
   JOIN chart_of_accounts coa  ON le.account_id = coa.id
   JOIN entities e             ON coa.entity_id = e.id
   WHERE je."userId" = '$UID'
   GROUP BY je.id, je.date, je.description
   HAVING COUNT(DISTINCT e.id) > 1;   -- >1 entity in one journal = a cross-entity transfer
   -- Expected: ZERO rows → confirms no trading→personal bridge exists yet.
   ```

---

*Read-only audit. No code changed; this `.md` is the only file created. DB-row checks flagged for Alex's
psql — not run here. Every claim cites `file:line`; the live Trading `entity_type` is NOT VERIFIED and
gates the build.*
