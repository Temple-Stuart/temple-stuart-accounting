# TRAVEL — PR-35a Implementation: sync getCOACode for coworking/gyms/sports/groceries

**Branch:** `claude/travel-pr-35a`
**Date:** 2026-05-31
**Scope:** Add the 4 PR-28f Google categories (coworking, gyms, sports, groceries)
to `getCOACode`'s source table (`travelCategories.ts`) so they file to their
canonical `travelCOA.ts` codes instead of the `9950` default. **Numeric mapping
sync only**, to the re-verified codes. The 5 already-matching categories are
untouched. Per `audit-reports/travel-pr-35-coa-read.md`. 1 file + this report.
**0 schema, 0 deps.**

---

## STEP 1 — Re-verified ground truth (read from the files, not the prompt)

**Canonical codes in `src/lib/travelCOA.ts`:**
| Category | `coaPersonal` / `coaBusiness` | Line |
|---|---|---|
| coworking | `P-9510` / `B-9510` | `travelCOA.ts:170` |
| gyms | `P-9520` / `null` | `travelCOA.ts:239` |
| sports | `P-9530` / `null` | `travelCOA.ts:254` |
| groceries | `P-9830` / `B-9830` | `travelCOA.ts:224` |

**Confirmed absent** from both `TRAVEL_CATEGORIES` (`travelCategories.ts:13-30`)
and `ALIASES` (`:33-60`) before this PR — presence check returned
`in_table=0, in_alias=0` for all 4 → `getCOACode` was returning the `'9950'`
default (`:73`).

## STEP 2 — Added the 4 mappings

`src/lib/travelCategories.ts` — 4 entries added to `TRAVEL_CATEGORIES`
(immediately after `shopping`, before `transport`), matching the existing entry
structure (`key`, `label`, `section`, `coaCode`, `calendarColor`):

```ts
coworking:      { key: 'coworking',      label: 'Coworking',          section: 'activities', coaCode: '9510', calendarColor: '#8B5CF6' },
gyms:           { key: 'gyms',           label: 'Gyms & Fitness',     section: 'activities', coaCode: '9520', calendarColor: '#8B5CF6' },
sports:         { key: 'sports',         label: 'Sports & Recreation',section: 'activities', coaCode: '9530', calendarColor: '#8B5CF6' },
groceries:      { key: 'groceries',      label: 'Groceries',          section: 'activities', coaCode: '9830', calendarColor: '#8B5CF6' },
```

`coaCode` = the **re-verified numeric part** of each `travelCOA.ts` code
(9510/9520/9530/9830). `section: 'activities'` (the only valid non-lodging/dining
value in the `TravelCategory` type, `:8`); `calendarColor: '#8B5CF6'` matches the
existing activities-group entries (nightlife/festivals/shopping/wellness). No
invented codes; no `ALIASES` change needed (the keys now resolve directly).

**Before → after** (`getCOACode` for all 9, simulated against the real table):
| Category | Before | After |
|---|---|---|
| brunch_coffee | 9310 | 9310 (untouched) |
| dinner | 9320 | 9320 (untouched) |
| nightlife | 9430 | 9430 (untouched) |
| **coworking** | **9950** | **9510** ✓ |
| **gyms** | **9950** | **9520** ✓ |
| **sports** | **9950** | **9530** ✓ |
| **groceries** | **9950** | **9830** ✓ |
| shopping | 9800 | 9800 (untouched) |
| festivals | 9440 | 9440 (untouched) |

**All 9 now file to their canonical codes.** The `git diff` is exactly the 4 new
lines + a comment — the 5 matching entries are byte-for-byte unchanged.

## STEP 3 — FLAGGED (not fixed): prefix + null-business question

Documented for **PR-35** (a commit-logic concern, **not** changed here):
- `getCOACode` returns the **bare number** (e.g. `9510`); `travelCOA.ts` carries
  the **`P-`/`B-` prefix**. vendor-commit prepends the prefix itself
  (`route.ts:122` `const prefix = trip.tripType === 'business' ? 'B' : 'P'` →
  `${prefix}-${coaNumber}`). So the prefix is chosen at **commit time** by trip
  type — out of scope for this numeric sync.
- **Null-business categories:** `gyms`, `sports`, `nightlife`, `festivals` have
  `coaBusiness: null` in `travelCOA.ts`. **Open question for PR-35:** when a place
  in one of these categories commits on a **Business/Mixed** trip, vendor-commit
  would currently build `B-9520` (gyms) even though `travelCOA.ts` defines no
  business code for it. How should P- vs B- be chosen, and what's the correct
  behavior for personal-only (null-business) categories? **This sync does not
  touch commit logic or prefix handling** — it only makes the numeric code
  correct; the prefix/null-business decision is PR-35's.

## Hard-constraint compliance

| Constraint | Status |
|---|---|
| Numeric sync ONLY — the 4 re-verified codes | ✅ 9510/9520/9530/9830 read from travelCOA.ts |
| No invented codes; 5 matching categories untouched | ✅ diff = 4 additions + comment; the 5 unchanged |
| No commit-logic / prefix / vendor-commit change | ✅ only `travelCategories.ts` table; prefix question flagged, not touched |
| 0 schema, 0 deps | ✅ TS map edit |
| `tsc --noEmit` | ✅ exit 0 |
| eslint (JSON, branch vs base) | ✅ 0e/0w == base → +0/+0 |
| diff scope | ✅ `travelCategories.ts` (+ this report) |

---

## Result
`getCOACode('coworking'|'gyms'|'sports'|'groceries')` now returns
`9510`/`9520`/`9530`/`9830` (their canonical `travelCOA.ts` codes) instead of
`9950`. All 9 Google categories now file to their correct COA. The 5 that already
matched are untouched. The P-/B- prefix + null-business-code question is documented
as an open item for PR-35's commit logic — not changed here. tsc + lint clean,
0 schema, 0 deps, diff scoped to one file.
