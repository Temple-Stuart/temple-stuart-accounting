# AUDIT — Runway budget sources, one-COA unity, missing Travel-vs-Personal budget (READ-ONLY)

**Branch:** `claude/audit-runway-budget-coa` · **Date:** 2026-06-18 · **Mandate:** Truth-First, read-only, every claim cites `file:line`. Labels: EXISTS / EXISTS-BUT-UNUSED / MISSING / REUSABLE / RISK.

---

## TL;DR

- **Runway rename = LABEL only.** The Calendar tab's `key` is `'calendar'` and that string is hard-wired into the default tab, both render gates, the descriptor map, and the hero mirror. Rename the **label** at `ModuleLauncher.tsx:79`; **keep `key:'calendar'`**. — RISK if the key is changed.
- **"Personal Finances" is a real DB entity name**, not a display string (`seed-entities.ts:12`, `entity_type='personal'`). The seeded entities are **Personal Finances / Trading / Business** — and **Trading is also `entity_type='personal'`** (`:13`), a latent ambiguity for the `findFirst({entity_type:'personal'})` budget queries.
- **Personal budget today reads TWO sources, summed:** the flat **`budgets`** table (`year-calendar:69-92`) **PLUS** the HB-4d routines bridge (`year-calendar:106-135`). The routine bridge **is built and firing**. The **repoint that DISCONNECTS the stale `budgets` read was NEVER built** — so old flat-table figures are still **added on top of** routine figures. **This is the "maps from a retired version" bug.** — RISK.
- **Travel source is correct** — `budget_line_items` where `source='trip'` (`nomad-budget:89-100`). — EXISTS.
- **One canonical COA table EXISTS** (`chart_of_accounts`, `schema.prisma:147-174`) and all budget routes read their COA *list* from it — **but** Travel is polluted with **hardcoded fallback name maps** (`nomad-budget:7-32`) and there are **two seeders** + **3 prefix strategies**. — RISK (fragmentation), not a second canonical table.
- **The Travel-vs-Personal comparison is NOT gone — it lives at `/hub`** (`hub/page.tsx:522` "Budget Comparison", with **Home Months / Travel Months / Travel Savings / Effective Total** at `:566-583`). It is simply **not surfaced on the homepage Runway tab** (the homepage mounts the single-toggle `HubBudgetSection`, not the comparison), and `/hub` entry points are being retired (`page.tsx:18`). — **REUSABLE** (exists, unsurfaced).

---

## 1. RUNWAY (Calendar) TAB IDENTITY

**Tab definition** — `ModuleLauncher.tsx:78-88`, the `TABS` array:
- `{ key: 'calendar', label: 'Calendar', icon: Calendar }` (`:79`).

**The `'calendar'` key string is referenced in 5 places** (rename-blast-radius):
1. `TABS[0].key` — `:79`.
2. **Default active tab** — `const [activeModule, setActiveModule] = useState('calendar');` (`:148`).
3. **Render gates** — `activeModule === 'calendar'` at `:442` (authed) and `:452` (logged-out demo).
4. **Descriptor** — `TAB_DESCRIPTORS` is keyed by tab key: `calendar: 'Your whole life lands here — …'` (`:107`).
5. **Hero mirror** — `page.tsx:16` `useState('calendar')` ("Default 'calendar' matches ModuleLauncher's initial tab").

`MODULE_TO_TAB` (`:91-100`) **does NOT contain `calendar`** — the calendar is rendered in its own dedicated `<section>` (`:441-457`), not via `MODULES.map`. So routing does **not** depend on a `calendar` module key.

→ **(decision) Rename the LABEL only** (`:79` `label: 'Runway'`, and optionally the descriptor `:107`). **Keep `key:'calendar'`.** Changing the key forces edits at `:107, :148, :442, :452` and `page.tsx:16`, and risks a blank tab / hero mismatch. — **EXISTS / RISK (key is load-bearing).**

**"Personal Finances" label** — it is the **actual entity `name` in the DB**, not a hardcoded UI string:
- `seed-entities.ts:11-15` `ENTITY_DEFS`:
  - `{ name: 'Personal Finances', entity_type: 'personal', is_default: true, template_name: 'Personal Standard' }` (`:12`)
  - `{ name: 'Trading', entity_type: 'personal', … 'Trading Standard' }` (`:13`)
  - `{ name: 'Business', entity_type: 'sole_prop', … 'Sole Proprietor Standard' }` (`:14`)
- Upserted by `[userId, name]` (`seed-entities.ts:36-48`). — **EXISTS (DB-backed name).**
- **RISK:** Personal Finances **and** Trading are both `entity_type='personal'` (`:12-13`). `year-calendar:29` and `nomad-budget:56` resolve the entity via `entities.findFirst({ entity_type:'personal' })` — which returns **whichever row Prisma orders first**, so on a user with both, the "Personal" budget could bind to the Trading entity's id. Latent, not the reported bug, but flag it. — RISK.

---

## 2. WHAT THE BUDGET READS TODAY (the stale-mapping bug)

**The homepage Runway budget = `HubBudgetSection`** (`ModuleLauncher.tsx:447`, authed calendar branch only). Its 4 toggles (`HubBudgetSection.tsx:38-43`) each fetch one route (`:70` `fetch(\`${active.route}?year=${year}\`)`):
- **Personal** → `/api/hub/year-calendar`, `entityType:'personal'` (`:39`)
- **Business** → `/api/hub/business-budget`, `'sole_prop'` (`:40`)
- **Travel** → `/api/hub/nomad-budget`, `'personal'` (`:41`)
- **Trading** → `route: null` → honest "route pending (HB-2)" (`:42`, rendered `:146-149`) — MISSING (route), not fabricated. 

**Personal (`year-calendar`) reads BOTH planned sources, additively:**
1. **Flat `budgets` table** (`year-calendar:69-92`): `prisma.budgets.findMany({ userId, year, accountCode IN homebaseCodes.map(c => \`P-${c}\`) })` (`:70-76`), then sums the `jan…dec` columns into `budgetData[coa][m]` (`:82-92`). — the legacy flat monthly table.
2. **HB-4d routines bridge** (`year-calendar:106-135`): queries `operations_routines` (`is_active`, `budget_amount != null`, `coa_code != null`, `:107-116`), then **adds** `routinesMonthlyByCoa(...)` into the **same** `budgetData[coa][m] += amount` (`:124-132`). The helper counts real monthly occurrences × per-occurrence amount (`routineBudget.ts:41-60`).

→ **HB-4d IS present and firing** — routine budgets **are** showing. — **EXISTS (routine bridge live).**

→ **The two sources STACK.** `budgets`-table figures and routine figures both land in `budgetData` (`:88` then `:130`), with **no disconnect** of the flat read. The comment even claims "routines write to NEITHER `budgets` NOR budget_line_items … so this is the sole routine path" (`:99-101`) — true that routines don't double-write, but the **old `budgets` rows are still summed in** alongside them. If the user moved their planning into routines, the **stale `budgets` numbers are still added on top** → inflated/duplicated Personal budget. **This is the suspected "maps from a retired version."** — **RISK.**

**The repoint to DISCONNECT the `budgets` read was never built.** Per the prior plan (`hub-budget-existing-audit.md:207-209`, "PR-HB-5 — disconnect `budgets` read … gated on PR-4"). The exact change still needed: in `year-calendar/route.ts`, **stop summing the `budgets`-table block (`:69-92`) into `budgetData`** once routines are the planned source — i.e. either remove/guard the `:82-92` accumulation or make routine-vs-`budgets` mutually exclusive per COA. **Keep the `budgets` rows in the DB** (data-bearing, ~10 writer routes per `hub-budget-existing-audit.md:143`); this is a **read-swap, never a delete**. — **MISSING (the disconnect) / RISK (data-bearing table).**

Business (`business-budget`) and Travel (`nomad-budget`) are **single-source** (`budget_line_items`), so they don't have this stacking problem.

---

## 3. TRAVEL SOURCE

`/api/hub/nomad-budget` budget half reads the Travel-tab committed source correctly:
- `prisma.budget_line_items.findMany({ userId, year, source:'trip' })` (`nomad-budget:89-94`), joined to `trip` for the name (`:95-99`), summed by `coaCode×month` into `budgetData` (`:106-117`), stripping any `P-/B-` prefix (`:108`).
- Actuals = ledger (`:125-141`). — **EXISTS (correctly wired to the Travel/trip source).**
- **RISK:** the COA **names** are DB-first **with hardcoded fallbacks** layered on — `TRAVEL_COA_NAMES` (`:7-20`) + `LEGACY_COA_NAMES` (`:23-32`) fill any code the DB query (`:60-71`) didn't return (`:79-84`). Personal/Business have no such fallback, so Travel can show a **hardcoded label that has drifted from the DB name**. (Covered in §4.)

---

## 4. ONE COA (unity check)

**Canonical table EXISTS — `chart_of_accounts`** (`prisma/schema.prisma:147-174`): per-user, per-entity, `code`/`name`/`account_type`/`entity_id`/`is_archived`, unique `[userId, entity_id, code]`. All four budget surfaces read their **COA list** from it:
- Personal: `chart_of_accounts.findMany` (`year-calendar:34-43`), bare codes, excludes `7xxx` (`:46`).
- Business: `chart_of_accounts.findMany` over the `sole_prop` entity (`business-budget`, agent-confirmed `:26-100`, `source='business'`).
- Travel: `chart_of_accounts.findMany` `code startsWith '9'|'7'` (`nomad-budget:60-71`).
- Routine picker `CoaSelect` → `fetch('/api/chart-of-accounts?entity_id=…')` (`CoaSelect.tsx:31-60`) — DB, entity-scoped. — **EXISTS / unified read.**

**But the COA surface is FRAGMENTED around that table** (each a RISK):
| What | Where | Label |
|---|---|---|
| Hardcoded travel COA validator/selector (`P-/B- 9xxx`, null-business rules) | `src/lib/travelCOA.ts` `TRAVEL_COA` (agent: `:25-316`) + `LEGACY` (`:401-416`) | HARDCODED (commit-time truth, not in DB) |
| Hardcoded travel **name fallbacks** (bare `9xxx`+`7xxx`) | `nomad-budget:7-32`, applied `:79-84` | HARDCODED / RISK (drifts from DB names) |
| Second hardcoded travel registry (bare `9xxx`) | `src/lib/travelCategories.ts` (agent: `:13-40`) | HARDCODED / duplicate |
| Vendor→COA map (bare `9xxx`) | `trips/[id]/vendor-commit/route.ts:11-17` `VENDOR_TYPE_TO_COA` | HARDCODED |
| **Two seeders** | `src/lib/seedDefaultCOA.ts` (hardcoded `DEFAULT_COA`) **AND** `src/lib/seed-coa-templates.ts` → `coa_templates` (data-driven, used by `seed-entities.ts:56-59`) | RISK (two seed paths, `7xxx` vs `9xxx`) |
| **Three prefix strategies for the SAME code** | `budgets.accountCode = 'P-'+code` (`year-calendar:74`); `budget_line_items.coaCode` bare for Business but `P-/B-` for Travel (stripped on read, `nomad-budget:108`); `chart_of_accounts.code` bare | RISK (prefix normalization scattered: `.replace(/^[PB]-/,'')` at `nomad-budget:108`, `year-calendar:127`) |

**Do Personal/Business/Trading/Travel resolve against the same source?** The **list** of accounts: yes (all `chart_of_accounts`). The **names shown** and the **code prefixing**: no — Travel overlays hardcoded fallbacks and the prefix scheme differs per storage table. **Trading** has **no budget route at all** (`HubBudgetSection.tsx:42` `route:null`) — its COA exists (seeded `Trading Standard`) but nothing reads it into a budget. — **EXISTS (one table) / RISK (fragmented overlays + prefixes) / MISSING (trading route).**

---

## 5. THE MISSING TRAVEL-VS-PERSONAL COMPARISON BUDGET

**It still EXISTS — at `/hub`** (`src/app/hub/page.tsx`), exactly the view the prior audit described:
- **"Budget Comparison"** section header (`:522`).
- **Summary cards (`:565-583`):** **Home Months Cost** (`:568`, `homeMonthsHomebaseBudget`), **Travel Months Cost** (`:573`, `travelMonthsTravelBudget`), **Travel Savings** (`:578-580`, `travelSavings`, green/red), **Effective Total** (`:583`).
- **The comparison math (`:362-371`):** `travelMonthsHomebaseBudget` / `travelMonthsTravelBudget` / `homeMonthsHomebaseBudget` / `homeMonthsTravelBudget` and `yearly*` totals — Personal (`homebaseBudget`) vs Travel (`nomadBudget`) side by side.
- **Category × Jan–Dec grid** with Homebase row (`:605`), Travel row (`:626`), combined (`:636-638`); per-COA **Homebase Budget vs Actual** table (`:687-733`) and **Travel** table (`:763-809`).
- **Data feeds:** `loadYearCalendar()` → `/api/hub/year-calendar` → `homebaseBudget` (`:303-317`); `loadNomadBudget()` → `/api/hub/nomad-budget` → `nomadBudget` (`:319-330`). **Same two routes the homepage `HubBudgetSection` already calls.**

**Why the user lost it:** the homepage **Runway/Calendar tab mounts `HubBudgetSection`** (`ModuleLauncher.tsx:447`) — a **single-toggle flat month table** (one of Personal/Business/Travel/Trading at a time, `HubBudgetSection.tsx:128-143`) with **no side-by-side comparison, no Travel Savings, no Effective Total**. The comparison only ever lived on **`/hub`**, and **`/hub` is being retired as an entry point** (`page.tsx:18` "Other /hub entry points are a separate retire PR"; login no longer lands there). So the comparison wasn't deleted — it was **stranded on a page that's being unlinked**. — **REUSABLE (exists at `/hub`, unsurfaced on Runway).**

**How to restore on Runway:** **reuse, don't rebuild.** The comparison is **inline JSX in `hub/page.tsx` (`:517-810`)**, not yet a component, and it reads the **same `homebaseBudget`/`nomadBudget`** that the homepage already fetches. Path: **extract the Budget-Comparison block (summary cards `:565-583` + month grid `:585-665`, optionally the two per-COA tables) into a shared `<BudgetComparison>` component**, then mount it on the Runway tab beside/under `HubBudgetSection`. No new routes, no migration — `year-calendar` + `nomad-budget` already return `budgetData`/`actualData`/grand totals. (Caveat: once §2's `budgets`-disconnect lands, the comparison's Personal numbers shift accordingly — they share `year-calendar`.) — **REUSABLE.**

---

## Explicit answers

**(a) Runway rename + "Personal Finances" source.** Rename the **label** at `ModuleLauncher.tsx:79` to "Runway"; **keep `key:'calendar'`** (it's load-bearing at `:107, :148, :442, :452` and `page.tsx:16`). "Personal Finances" is the **DB entity name** (`seed-entities.ts:12`), `entity_type='personal'` — not a display string; and Trading shares `entity_type='personal'` (`:13`) → `findFirst` ambiguity RISK.

**(b) What Personal/Business reads TODAY.** Personal = **`budgets` flat table (`year-calendar:69-92`) PLUS routines (HB-4d, `:106-135`), summed**. Routines fire; the **stale `budgets` read was never disconnected** → old flat figures stack on routine figures. **Yes — the missing repoint (drop/guard `year-calendar:82-92` once routines are canonical, keep the rows) is the cause.** Business/Travel are single-source `budget_line_items` (no stacking).

**(c) Travel source correct?** **Yes** — `budget_line_items source='trip'` (`nomad-budget:89-100`), actuals from ledger. EXISTS. Minor RISK: hardcoded name fallbacks (`:7-32`) can drift from DB names.

**(d) One COA?** **One canonical table** (`chart_of_accounts`, `schema.prisma:147-174`); all surfaces read their account list from it. **But fragmented:** hardcoded `travelCOA.ts` (commit-time validator), `nomad-budget:7-32` name fallbacks, `travelCategories.ts` duplicate, `vendor-commit:11-17` map, **two seeders** (`seedDefaultCOA.ts` vs `coa_templates`), and **three prefix schemes** (`P-`/bare/`P-`+`B-`). Trading has **no budget route** (`HubBudgetSection.tsx:42`). RISK per location above.

**(e) The missing comparison.** It was the **`/hub` "Budget Comparison"** (Home vs Travel months, **Travel Savings**, **Effective Total**) — `hub/page.tsx:522, 565-583, 362-371, 685-809`. It **still EXISTS** but is **unsurfaced** on the homepage Runway tab (which shows the single-toggle `HubBudgetSection` instead) and `/hub` is being unlinked (`page.tsx:18`). **REUSABLE** — extract the inline block into a component and mount on Runway; the two routes it needs are already wired.

**(f) Recommended PR sequence (honest sizing; migrations flagged):**
1. **PR-Runway-Rename (SMALL, no migration).** `ModuleLauncher.tsx:79` label → "Runway" (+ optional descriptor `:107`). Keep `key:'calendar'`. Pure label.
2. **PR-Runway-Comparison (MED, no migration).** Extract `hub/page.tsx:517-665` (comparison + summary cards; optionally `:667-810` tables) into `<BudgetComparison>`, mount on the Runway tab using the already-fetched `year-calendar`/`nomad-budget` data. Reuse, not rebuild.
3. **PR-HB-5 Personal-disconnect (SMALL, NO delete — read-swap, RISK gated).** In `year-calendar/route.ts`, stop stacking the `budgets`-table block (`:82-92`) onto routine figures so Personal stops double-counting. **Keep all `budgets` rows** (data-bearing, ~10 writers). This is the fix for the "retired version" numbers. Verify against a user who has both `budgets` rows and budgeted routines.
4. **PR-Trading-budget (MED, no migration).** New `/api/hub/trading-budget` over `entity_type='trading'` (entity, COA, ledger actuals already exist) so `HubBudgetSection`'s 4th toggle stops being "pending".
5. **PR-COA-unify (LARGE, MIGRATION — flagged).** Collapse the hardcoded travel maps (`travelCOA.ts`, `nomad-budget:7-32`, `travelCategories.ts`) and the two seeders onto the canonical `chart_of_accounts`, and normalize the prefix scheme (store bare, prefix on read in one helper). True migration — schedule last, never drop user financial rows.

---

### Citation index
- Tab identity: `ModuleLauncher.tsx:78-88` (TABS), `:91-100` (MODULE_TO_TAB, no calendar), `:107` (descriptor), `:148` (default), `:442/:452` (render gates), `:447` (HubBudgetSection mount); `page.tsx:16, :18`.
- Entities: `seed-entities.ts:11-15, 36-59`.
- Personal budget: `year-calendar/route.ts:34-46, 69-92` (budgets), `:106-135` (HB-4d routines), `:142-159` (ledger actuals); `routineBudget.ts:41-77`.
- Toggles/section: `HubBudgetSection.tsx:38-43, 66-79, 146-149`.
- Travel: `nomad-budget/route.ts:7-32, 56-84, 89-117, 125-141`.
- COA: `schema.prisma:147-174`; `travelCOA.ts:25-316, 401-416`; `nomad-budget:7-32`; `travelCategories.ts:13-40`; `vendor-commit/route.ts:11-17`; `seedDefaultCOA.ts`; `seed-coa-templates.ts`; `CoaSelect.tsx:31-60`.
- Comparison: `hub/page.tsx:303-330, 362-371, 522, 565-583, 585-665, 687-733, 763-809`.

*Do not implement — audit only.*
