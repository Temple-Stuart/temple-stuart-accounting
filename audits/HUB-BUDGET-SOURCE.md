# HUB BUDGET DATA-SOURCE AUDIT (read-only)

**Branch:** `claude/audit-hub-budget-source` · **Date:** 2026-06-21 · **Scope:** why does the hub Personal/Business budget panel still show old amounts and no burn rows? Read-only; every claim cites `file:line`. No DB access — code only; DB-row checks flagged for Alex.

---

## VERDICT TABLE

| Q | Finding | Cite | Status |
|---|---|---|---|
| **A — Where does "Planned" come from?** | **BOTH:** routines (CANONICAL, precedence) **+** legacy `budgets`/`budget_line_items` (transitional fallback). The routines path is real and wins per-cell; the legacy table fills only cells routines don't cover. So old amounts showing = routines aren't populated, **not** a wrong code source. | `year-calendar:89-112` (routines SOURCE 1) + `:127-142` (budgets SOURCE 2); `business-budget:69-89` (budget_line_items) + `:102-124` (routines) | **BUILT** (dual-source, routines-first) |
| **B — Does a routines-budget path exist?** | **EXISTS.** Both routes sum `operations_routines.budget_amount × occurrences` per `coa_code` via `routinesMonthlyByCoa`. Field is **`budget_amount`** (Decimal), **not** `expected_cost_usd`. Schema confirms `budget_amount` + `coa_code` exist. | `year-calendar:89-112`, `business-budget:102-124`, `routineBudget.ts` (`routinesMonthlyByCoa`); schema `operations_routines` model `:2940`, `budget_amount` + `coa_code` fields | **BUILT** |
| **C — Do burn-tracking rows exist?** | **NOT BUILT.** No `burn`/`runway`/`net_burn`/`cash_balance`/`monthly_burn` table or column in schema. No net-burn route. No writer. Net burn was intended to be **computed on-the-fly** from `ledger_entries` (RUNWAY-1 income exists; the net-burn engine was audited but never built). | schema grep → none; `src/app/api` grep for net-burn/runway → only `income/route.ts` (a doc-comment mention, not a burn computation) | **NOT BUILT** |

---

## QUESTION A — Where "Planned" comes from today

**The panel:** `src/components/hub/HubBudgetSection.tsx` — the toggle table (Personal/Business/Travel/Trading). It fetches per toggle (`:79` `fetch(\`${active.route}?year=${year}\`)`), routes defined `:48-51`:
- Personal → `/api/hub/year-calendar` (`:48`)
- Business → `/api/hub/business-budget` (`:49`)
- Travel → `/api/hub/nomad-budget` (`:50`)
- Trading → `route: null` (`:51`)

**⚠ The file's own doc comment is STALE:** `:9` says Personal "planned ← budgets table" — but the route was upgraded (HB-4c/4d) to read routines first. The actual queries:

**Personal (`year-calendar/route.ts`):**
- **SOURCE 1 — CANONICAL (HB-4d):** `prisma.operations_routines.findMany({ where: { … budget_amount: { not: null } }, select: { budget_amount, coa_code, schedule_rrule, timezone } })` (`:89-97`) → `routinesMonthlyByCoa(...)` summed into `budgetData[coa][m]` (`:107-112`). Comment: "SOURCE 1 (CANONICAL): BUDGETED ROUTINES" (`:79`).
- **SOURCE 2 — TRANSITIONAL:** `prisma.budgets.findMany(...)` (the flat `budgets` table, monthly jan–dec columns, `:127-142`) — fills only cells routines didn't cover (per-cell precedence, prior audit).

**Business (`business-budget/route.ts`):**
- `prisma.budget_line_items.findMany({ where: { … source: 'business' } })` summed into `budgetData[coa][month]` (`:69-89`).
- **PLUS** a routines path: `prisma.operations_routines.findMany(...)` (`:102-124`).

**VERDICT (A):** "Planned" reads from **(b) ROUTINES as the canonical source** (`operations_routines.budget_amount`, `year-calendar:89-112` / `business-budget:102-124`), **with (a) the OLD `budgets`/`budget_line_items` tables as a transitional fallback** for cells routines don't cover. **The code is NOT pointed at the wrong source** — routines win where they exist. So **old amounts persist because the routines aren't carrying budgets** (no `budget_amount`/`coa_code`), causing the display to fall through to the legacy tables — a **data** condition, confirmable by psql (below), **not** a code-source bug.

## QUESTION B — Does a routines-budget path exist in code?

**EXISTS — BUILT.** Both budget routes already sum routine budgets:
- `year-calendar:89-112` and `business-budget:102-124` both query `operations_routines` (`budget_amount != null`) and run `routinesMonthlyByCoa` (`src/lib/operations/routineBudget.ts`, imported `year-calendar:5`).
- **Field-name note:** the recurring-expense cost field is **`budget_amount`** (Decimal 12,2), **NOT** `expected_cost_usd` (the latter does not exist — NOT VERIFIED anywhere). If you were grepping for `expected_cost_usd`, that's why it looked missing; the real field is `budget_amount`.

**Schema (B6):** `operations_routines` model (`schema.prisma:2940`) has:
- `budget_amount Decimal? @db.Decimal(12, 2)` (model field, per `sed`-relative `:29`) — EXISTS.
- `coa_code String? @db.VarChar(50)` (relative `:30`) — EXISTS.
- `schedule_rrule String @db.Text` (relative `:7`) — EXISTS.
- `expected_cost_usd` — **MISSING** (the cost field is `budget_amount`, per the schema comment relative `:23-29`: "occurrences-in-month × budget_amount … bridged into the homepage budget section (HB-4d)").

So the wiring **was** built (HB-4c/4d). The path is not missing.

## QUESTION C — Do burn-tracking rows exist?

**NOT BUILT — and that's expected, not a bug.**
- **C7 (table/column):** grep of `schema.prisma` for `burn` / `runway` / `net_burn` / `cash_balance` / `monthly_burn` (as model names or columns) → **zero hits.** No burn-tracking table or column exists. MISSING.
- **C8 (writer):** grep of `src/app/api` for `net.burn` / `runway` / `monthly.burn` → only `income/route.ts` (which **mentions** "net burn" in its RUNWAY-1 doc comment but **computes income**, not burn). **No net-burn/runway route exists; no code creates burn rows.** MISSING.
- **Design intent:** net burn was specified to be **computed on-the-fly** from `ledger_entries` (expense debits − revenue credits), not stored. RUNWAY-1 (income from the ledger) shipped; the **net-burn engine (RUNWAY-2) was audited but never built** (no route, no table). So there are **no burn rows because the burn feature was never built** — there is no table to hold them and no route to compute/display them.

---

## DB CHECKS FOR ALEX (run via psql — schema names actually read here)

These verify Question A's data condition (are routines carrying budgets, or is everything still in the legacy tables?). **Only names read in `schema.prisma`/the routes are listed — no guesses.**

```sql
-- 1) Do routines carry budgets? (Question A/B data condition.)
--    operations_routines.budget_amount + coa_code (schema.prisma:2940 model).
SELECT
  COUNT(*)                                                   AS total_routines,
  COUNT(*) FILTER (WHERE budget_amount IS NOT NULL)          AS with_budget_amount,
  COUNT(*) FILTER (WHERE coa_code IS NOT NULL)               AS with_coa_code,
  COUNT(*) FILTER (WHERE budget_amount IS NOT NULL
                     AND coa_code IS NOT NULL)               AS budget_AND_coa
FROM operations_routines
WHERE "userId" = '<ALEX_USER_ID>';
-- If with_budget_amount / budget_AND_coa = 0 → SOURCE 1 (routines) contributes nothing,
-- so the panel shows ONLY the legacy budgets/budget_line_items figures. THAT is "old budgets."

-- 2) Legacy Personal source still populated? (year-calendar SOURCE 2: the `budgets` table,
--    monthly columns jan..dec, read at year-calendar:127-142.)
SELECT COUNT(*) AS budget_rows FROM budgets WHERE "userId" = '<ALEX_USER_ID>';

-- 3) Legacy Business/Travel source. (budget_line_items.amount/source/month,
--    read at business-budget:69-73 source='business', nomad-budget source='trip'.)
SELECT source, COUNT(*) AS rows, ROUND(SUM(amount)::numeric,2) AS total
FROM budget_line_items
WHERE "userId" = '<ALEX_USER_ID>'   -- (confirm the user-scope column name on this table)
GROUP BY source ORDER BY source;
```
*(Table/column names cited: `operations_routines.budget_amount`/`coa_code` — `schema.prisma:2940` model; `budgets` table — `year-calendar:127`; `budget_line_items.amount`/`source` — `business-budget:69-73`. The `budgets` and `budget_line_items` user-scope column names were NOT read in this pass — confirm before running; **NOT VERIFIED**.)*

---

## BOTTOM LINE (one paragraph)

This is **two separate things, neither a deploy problem.** (1) **"Still seeing old budgets" is a DATA / wiring-completion condition, not a wrong-source bug:** the code already reads **routines as the canonical Planned source** (`year-calendar:89-112`, `business-budget:102-124`) and only falls back to the legacy `budgets`/`budget_line_items` tables for cells routines don't cover — so the panel shows old amounts **because the `operations_routines` rows aren't carrying `budget_amount`/`coa_code`** (confirm with DB-check #1) and/or the legacy rows still exist (#2/#3). (2) **"No burn-tracking rows" is a wiring-NEVER-BUILT condition:** there is **no burn/runway table, no net-burn route, and no writer** in the codebase (Question C) — net burn was meant to be computed on-the-fly and the RUNWAY-2 net-burn engine was audited but never implemented, so there is nothing to produce or display burn rows. **Evidence supports: (A) data/incomplete-population, (C) feature-never-built — not a deploy issue and not a wrong-code-source issue.**

*Read-only audit. No code changed; this `.md` is the only file created. DB-row checks flagged for Alex's psql — not run here.*
