# HUB BUDGET — MERGE LOGIC + CALENDAR LINKAGE (read-only)

**Branch:** `claude/audit-budget-merge-linkage` · **Date:** 2026-06-21 · **Scope:** explain two live
symptoms with cited code — **S1** the Personal budget panel shows MANY expense rows when only ~1
routine (rent) was committed, and **S2** clicking a calendar expense that has a COA + budget_amount
shows NO COA/budget on the detail. Read-only; every claim cites `file:line`. **No DB access** — code
only; row-count checks are flagged for Alex's psql, never asserted here.

---

## HEADLINE VERDICT

| # | Symptom | Where | Verdict |
|---|---|---|---|
| **S1** | Panel shows MANY rows, few routines exist | budget read merge | **REPLACE per-cell, NOT a union** — but the legacy `budgets` table dominates because very few routines are budgeted. The rows you see are mostly legacy SOURCE 2, not routines. |
| **S2** | Clicked calendar expense shows no COA/budget | routine→calendar feed | **BROKEN at READ** — `/api/hub/operations-routines` fetches the full routine row but DROPS `coa_code` + `budget_amount` from its response shape. WRITE is fine; mapping never receives the fields. |

---

## QUESTION 1 — IS LEGACY UNIONED OR REPLACED? → **REPLACED per (coa, month)**

`src/app/api/hub/year-calendar/route.ts` builds `budgetData[coa][month]` from **two sources in
precedence order**, NOT a sum of both:

**SOURCE 1 (CANONICAL — routines), `:88-118`:**
```ts
const budgetedRoutines = await prisma.operations_routines.findMany({
  where: { user_id: user.id, entity_id: personalEntity.id, is_active: true,
           budget_amount: { not: null }, coa_code: { not: null } },     // :90-96
  select: { budget_amount: true, coa_code: true, schedule_rrule: true, timezone: true },
});
// per month → routinesMonthlyByCoa(...)  :107
budgetData[coa][m] = (budgetData[coa][m] || 0) + amount;                 // :112
routineCovered.add(`${coa}:${m}`);                                       // :114 — records the cell
```

**SOURCE 2 (TRANSITIONAL — legacy `budgets`), `:127-146`:**
```ts
const budgetRows = await prisma.budgets.findMany({
  where: { userId: user.id, year, accountCode: { in: homebaseCodes.map(c => `P-${c}`) } }, // :128-132
});
for (const row of budgetRows) {
  const coa = row.accountCode.replace(/^P-/, '');
  for (let m = 0; m < 12; m++) {
    if (routineCovered.has(`${coa}:${m}`)) continue;  // :138 — routine owns it → SKIP legacy
    const val = Number(row[MONTH_COLS[m]] || 0);
    if (val !== 0) budgetData[coa][m] += val;          // :140-142 — fill ONLY uncovered cells
  }
}
```

**The route's own comment is explicit (`:120-126`):** *"the routine bridge wins per (coa, month) …
ADD a figure ONLY for cells the routine bridge did NOT cover … a COA that has BOTH a budgets row and
a routine shows the ROUTINE figure ALONE (no stacking)."*

**VERDICT: (a) REPLACE per-cell.** It is **not a UNION** — there is no double-count; `routineCovered`
is the per-cell guard at `:114` (write) and `:138` (skip).

**Why S1 happens (MANY rows, few routines):** the displayed table is dominated by **SOURCE 2**.
SOURCE 1 only emits a row when a routine is `is_active` AND has **both** `budget_amount` **and**
`coa_code` (`:90-96`) — i.e. only fully-budgeted routines. With ~1–3 routines fully budgeted, almost
every cell stays **uncovered**, so the legacy `budgets` table (one flat row per `P-####` account with
jan–dec columns, `:127-132`) fills nearly the whole grid. The panel isn't showing phantom routines —
it's showing the **old `budgets` rows**, which were never removed (`:122` "NON-DESTRUCTIVE, the rows
are kept"). This is **BUILT and behaving as written**, not a bug in the merge; the surprise is data
provenance (legacy ≫ routines), not logic.

> **DB check for Alex (psql — not run here):** confirm the gap between budgeted routines and legacy
> rows for the Personal entity / current year:
> ```sql
> -- (1) how many routines actually feed SOURCE 1 (need BOTH fields, active):
> SELECT count(*) FROM operations_routines
> WHERE user_id = $UID AND is_active = true
>   AND budget_amount IS NOT NULL AND coa_code IS NOT NULL;
> -- (2) how many legacy budgets rows feed SOURCE 2 (one per P- account):
> SELECT count(*) FROM budgets WHERE "userId" = $UID AND year = 2026;
> ```
> Expectation matching the symptom: (1) is tiny (≈1–3), (2) is large → legacy dominates the panel.

---

## QUESTION 2 — THE ROUTINE → CALENDAR LINKAGE → **BROKEN at READ**

A routine carries `coa_code` + `budget_amount`. Trace those two fields from DB write → calendar feed →
mapper → click detail.

| Stage | File · line | Carries `coa_code` / `budget_amount`? |
|---|---|---|
| **WRITE** (POST routine) | `src/app/api/operations/routines/route.ts:284-285` | ✅ `budget_amount: budgetAmount`, `coa_code: coaCode` — **persisted** |
| **READ — fetch** | `src/app/api/hub/operations-routines/route.ts:104-107` | ✅ `findMany` has **no `select`** → full row, fields ARE in memory |
| **READ — response shape** | same file, type `:109-117` + `out.push` `:174-182` | ❌ **`RoutineWindowEntry` omits both fields; `out.push` never includes them — DROPPED here** |
| **MAP** | `src/lib/hub/mapOperationsRoutines.ts` interface `:43-51`, emit `:94-103` / `:112-120` | ❌ no `coa_code`/`budget_amount` (grep empty) — can't carry what it never receives |
| **GRID merge** | `src/components/hub/HubCalendar.tsx:215` | ❌ `mapOperationsRoutines(...).map(e => ({ ...e, href: undefined }))` → `GridEvent.budgetAmount`/`coaCode` stay **undefined** for routine tiles |
| **DETAIL panel** | `HubCalendar.tsx` `EventDetailPanel` (reads `GridEvent`) | ❌ shows nothing — the fields arrived empty |

**The smoking gun — the feed fetches the data then throws it away.** The route loads the entire
routine row (`:104`, no projection), so `r.coa_code` and `r.budget_amount` are right there, but the
emitted object is:
```ts
out.push({
  routine_id: r.id, name: r.name, entity_id: r.entity_id, timezone: r.timezone,
  start_time: ..., end_time: ..., occurrences: ...,           // :174-182
});                                                            // ← no coa_code, no budget_amount
```

**Proof the GridEvent type already SUPPORTS these fields** (so this is a feed gap, not a type gap):
`HubCalendar.tsx` declares `budget_amount: number` (`:52`) and `coa_code: string | null` (`:55`), and
the **calendar-events** feed populates them at `:201` `budgetAmount: e.budget_amount` and `:204`
`coaCode: e.coa_code ?? null` (used for lodging amortization). Those values reach the detail panel
fine for trip/lodging tiles. Routine tiles come through the **separate** `mapOperationsRoutines` path
(`:215`), which never had the fields — so only routine clicks show blank COA/budget.

**VERDICT: BROKEN at READ.** Not WRITE (persisted, `routines/route.ts:284-285`; and the budget panel
successfully reads the same fields at `year-calendar/route.ts:90-97`). Not MAPPING-to-wrong-table. The
`/api/hub/operations-routines` route **omits `coa_code` + `budget_amount` from its response shape**
(`:109-117`, `:174-182`); everything downstream is starved by that single omission.

> **DB check for Alex (psql — not run here):** confirm the rent routine actually has both fields, so
> the fix has data to surface:
> ```sql
> SELECT id, name, coa_code, budget_amount
> FROM operations_routines
> WHERE user_id = $UID AND is_active = true AND budget_amount IS NOT NULL;
> ```

---

## BOTTOM LINE (plain English)

- **S1 is not a merge bug.** The code REPLACES per cell (routine wins, legacy fills the rest) exactly
  as written (`year-calendar/route.ts:114,138`). The panel looks "full" because the legacy `budgets`
  table is still populated and only a handful of routines are fully budgeted — so legacy fills almost
  every cell. The fix is a **data/source decision**, not a logic fix: either stop reading SOURCE 2
  (`:127-146`) once routines are the source of truth, or migrate the legacy `budgets` rows into
  routines (the route's own `:125` "Option B" plan), after which the legacy read and table retire.
- **S2 is a real, single-point bug at READ.** `/api/hub/operations-routines` fetches the full routine
  but drops `coa_code` + `budget_amount` from its response (`:109-117`, `:174-182`). The fix is
  additive and self-contained: add both fields to `RoutineWindowEntry` + the `out.push`, add them to
  the mapper's interface + emitted `CalendarEvent` (`mapOperationsRoutines.ts:43-51,94-120`), and
  carry them in the `HubCalendar.tsx:215` spread. The GridEvent type and detail panel already accept
  them (`:52,55,201,204`) — no schema or DB change needed.

Both fixes are separate concepts (one source-precedence decision, one feed-field passthrough) and
should ship as separate PRs.

---

*Read-only audit. No code changed; this `.md` is the only file created. DB-row checks are flagged for
Alex's psql — not run here. Every claim cites `file:line`.*
