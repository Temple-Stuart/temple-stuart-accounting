# ROBINHOOD-PARSER `T-` PREFIX — REACHABILITY + DATA IMPACT (read-only)

**Branch:** `claude/audit-robinhood-parser` · **Date:** 2026-06-21 · **Scope:** does `src/lib/robinhood-parser.ts` write `T-`-prefixed COA codes into live data, and is it reachable? Read-only; every claim cites `file:line`. No DB access — code only; DB-row checks flagged for Alex.

---

## HEADLINE VERDICT: **DEAD** — no caller, no DB write, no contamination path

`robinhood-parser.ts` produces five `T-`-prefixed codes in **in-memory `coa` fields only** (`:548,652,654`). It makes **no prisma write** and is **imported/called by nothing in the repo**. Its `T-` codes therefore **cannot reach the database through this module.** The fix (T-→bare) is real but **non-urgent** (dead code); the decision is annotate-vs-fix-vs-delete.

---

## 1. WHAT IT WRITES

Every `T-` literal it produces, all assigned to the **`coa` field** of an in-memory parsed-leg object (interface field `coa: string`, `:56`):

| Line | Literal | Assigned to | Context |
|---|---|---|---|
| `:548` | `'T-4100'` | `coa:` (parsed leg) | `coa: isClosing ? 'T-4100' : this.assignCOA(leg), // All closes use T-4100` |
| `:652` | `'T-1200'` / `'T-1210'` | `assignCOA` return | `return leg.optionType === 'call' ? 'T-1200' : 'T-1210';` (opening LONG) |
| `:654` | `'T-2100'` / `'T-2110'` | `assignCOA` return | `return leg.optionType === 'call' ? 'T-2100' : 'T-2110';` (opening SHORT) |

**DB write? NO.** Grep of the file for `prisma.` / `.create` / `.createMany` / `.update` / `.upsert` / `.delete` / `import … prisma` → **none.** **No direct DB write — it builds in-memory objects and returns them to a caller.** EXISTS (in-memory only).

**Exports:** `robinhoodParser` (a singleton instance, `:675`) + `fetchRobinhoodHistory()` (`:677`); the class `RobinhoodHistoryParser` (`:68`) is internal (not exported). **Not a route** — no `GET`/`POST` export.

## 2. REACHABILITY — DEAD

Grepped the whole repo (`.ts/.tsx/.js/.mjs`, excluding `node_modules`/`.next`/`.md`) for the module path **and** its export names (`robinhood-parser`, `robinhoodParser`, `RobinhoodHistoryParser`, `fetchRobinhoodHistory`):
- **Zero importers / callers** — the only hits are inside the file itself. **MISSING.**
- The `.coa`-field consumers found (`ExpenseSubAccountManager.tsx:124` `data.coa.name`; `SpendingTab.tsx:914,1025,1209,1217,1270` `change.coa`/`txn.coa`) are **UNRELATED** — they are the spending/expense COA-selection UI's own `coa` fields, with no link to the parser's output. EXISTS BUT UNRELATED.

**VERDICT: DEAD** — no in-repo code imports or invokes `robinhood-parser`. Its exports are never consumed. *(Honest caveat: it's a lib, not a route, so it isn't even HTTP-accessible — unlike the dead `GET /api/trading`. It is purely orphaned library code.)*

## 3. IF REACHABLE — N/A

Not reachable (§2). **No caller → no persistence path.** There is no code that takes the parser's `coa` output and writes it anywhere. EXISTS BUT UNUSED.

## 4. DB-CONTAMINATION FLAG (for Alex's psql — do NOT run here)

**Based on the code: `robinhood-parser` COULD NOT have written `T-` rows** — it has no write path (§1) and no caller (§2). So this module is **not** a contamination source.

For completeness (other historical paths, not this parser), a check whether **any** `T-`-prefixed `accountCode` exists in `transactions` — Alex can run to confirm zero and rule out cleanup:
```sql
-- Verify no T-prefixed accountCode rows exist (this parser cannot have written
-- them — no write path/caller; this rules out other/historical sources).
SELECT "accountCode", COUNT(*) AS rows
FROM transactions
WHERE "accountCode" LIKE 'T-%'
GROUP BY "accountCode"
ORDER BY "accountCode";
-- Expected: 0 rows. Any result → a DIFFERENT path wrote them; investigate separately.
```
*(Per the codebase: the other `T-` sites were a LOOKUP in `commit-to-ledger` — `findUnique`, which 400s on miss, never writes — and a `.filter` in `trading/route`, which reads, never writes. So no code path writes `T-` accountCodes; the query is a belt-and-suspenders confirmation.)*

## 5. BARE-MAPPING TABLE — all five have a matching bare COA

| `T-` code | → bare | Seed proof | `account_type` | Match? |
|---|---|---|---|---|
| `T-4100` | `4100` | `seed-trading-coa.ts:30` "Options Income - Credit Spreads"; `seed-coa-templates.ts:137` "Trading Gains" | **revenue** | ✅ |
| `T-1200` | `1200` | `seed-trading-coa.ts:10` "Options Positions - Long Calls"; `seed-coa-templates.ts:130` "Long Call Positions" | **asset** | ✅ |
| `T-1210` | `1210` | `seed-trading-coa.ts:11` "Options Positions - Long Puts"; `seed-coa-templates.ts:131` "Long Put Positions" | **asset** | ✅ |
| `T-2100` | `2100` | `seed-trading-coa.ts:20` "Options Positions - Short Calls"; `seed-coa-templates.ts:132` "Short Call Positions" | **liability** | ✅ |
| `T-2110` | `2110` | `seed-trading-coa.ts:21` "Options Positions - Short Puts"; `seed-coa-templates.ts:133` "Short Put Positions" | **liability** | ✅ |

**All five bare equivalents exist with matching `account_type`/purpose.** No `T-` code lacks a bare COA — a straight swap is valid for all five.

**⚠ SEPARATE SEMANTIC OBSERVATION (not a prefix issue — flag, not a fix):** `:548` assigns **`T-4100` (gains/revenue) to ALL closes** (`// All closes use T-4100`), regardless of whether the close realized a gain or a **loss** (which would belong to `5100`, expense). That is a categorization question independent of the `T-`→bare swap; do **not** fold it into a prefix fix — it needs its own decision.

## 6. FIX-SURFACE TABLE

| File | Lines | Proposed change | Reachable? |
|---|---|---|---|
| `src/lib/robinhood-parser.ts` | `:548` | `'T-4100'` → `'4100'` | **DEAD** |
| `src/lib/robinhood-parser.ts` | `:652` | `'T-1200'`/`'T-1210'` → `'1200'`/`'1210'` | **DEAD** |
| `src/lib/robinhood-parser.ts` | `:654` | `'T-2100'`/`'T-2110'` → `'2100'`/`'2110'` | **DEAD** |

- **One concept?** Yes — `T-`→bare in this single file (5 literals, 3 lines). Self-contained.
- **Ship now or wait?** **WAIT / decide** — the module is **dead** (no caller, no write, not even HTTP-accessible), so the `T-` codes harm nothing today. This is an **annotate-vs-fix-vs-delete** decision, not an urgent bug:
  - **Delete** — if the Robinhood-history parser is abandoned (no caller anywhere), removing the orphaned file is the cleanest (eliminates the drift entirely). Needs confirmation it's truly retired.
  - **Fix** (T-→bare) — only worthwhile if it will be **revived/wired** to a real persistence path; otherwise it's fixing dead code.
  - **Annotate** — minimal: a comment noting the codes must be bare if revived.
  - **Whichever is chosen, also resolve the §5 gain-vs-loss semantic** before any revival.

---

## SUMMARY

- **Writes:** 5 `T-` codes into in-memory `coa` fields (`:548,652,654`); **no prisma write.**
- **Reachable:** **DEAD** — no importer/caller in the repo; not a route; orphaned lib.
- **Contamination:** **impossible via this module** (no write, no caller); psql query provided to confirm zero `T-` rows from any source.
- **Mapping:** all five `T-`→bare equivalents exist with matching `account_type` (`seed-trading-coa.ts:10,11,20,21,30`).
- **Fix:** one concept, but **non-urgent** (dead) → annotate/fix/delete decision, plus a flagged gain-vs-loss semantic at `:548`.

*Read-only audit. No code changed; this `.md` is the only file created. DB-row checks flagged for Alex's psql — not run here.*
