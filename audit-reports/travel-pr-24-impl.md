# TRAVEL — PR-24 Implementation: fix the 400 root cause (adopt alias only when valid)

**Branch:** `claude/travel-pr-24`
**Date:** 2026-05-30
**Scope:** One file — `src/app/api/trips/[id]/ai-assistant/route.ts`. Fixes the
whole class: an alias that resolves a valid key to a dead one no longer causes a
400. 0 schema, 0 deps, no taxonomy edits.

---

## STEP 1 — The resolution + the 400 guard (before)

`route.ts` (pre-fix):
```ts
// :153-155
const category: string | undefined = rawCategory
  ? getCategoryByKey(rawCategory)?.key || rawCategory   // adopts the resolved key UNCONDITIONALLY
  : rawCategory;
// :163-166 — validity guard (unchanged by this PR; the consts are reused at :354/:356)
const isCOACategory      = !!category && !!TRAVEL_COA[category];
const isLegacyCategory   = !!category && !!CATEGORY_SEARCHES[category];
const isInterestCategory = !!category && !!ACTIVITY_SEARCH_EXPANSIONS[category];
if (!category || (!isCOACategory && !isLegacyCategory && !isInterestCategory)) {
  return NextResponse.json({ error: 'Valid category required' }, { status: 400 });
}
```
`ground_transport` → `getCategoryByKey()` resolves it (via `travelCategories.ts`
alias `ground_transport: 'transport'`) to **`transport`**, which is in no
taxonomy → the `:166` guard 400s every scan.

## STEP 2 — The root fix (after)

**New helper** — `route.ts:109-115` (single source of truth for "valid",
matching the `:183-185` guard exactly):
```ts
function isValidCategory(key: string | undefined): key is string {
  return !!key && (!!TRAVEL_COA[key] || !!CATEGORY_SEARCHES[key] || !!ACTIVITY_SEARCH_EXPANSIONS[key]);
}
```
**New resolution** — `route.ts:171-175`:
```ts
const resolvedCategory = rawCategory ? getCategoryByKey(rawCategory)?.key : undefined;
const category: string | undefined =
  isValidCategory(resolvedCategory) ? resolvedCategory   // 1. resolved-if-valid
  : isValidCategory(rawCategory)    ? rawCategory         // 2. raw-if-valid
  : (resolvedCategory || rawCategory);                    // 3. fall through → existing 400
```
The `:183-186` validity guard is **unchanged** (its `isCOACategory`/
`isLegacyCategory` consts are reused later at `:354/:356` to pick the Google
query path, so they had to stay).

### Why this is correctness, not a fallback
It selects the **valid one of two already-known keys** (`resolvedCategory` and
`rawCategory`), both derived from the request — it never synthesizes a missing
value. An unknown key (both invalid) still falls through to the existing 400. So
it cannot mask bad input; it only stops a good key from being *renamed into* bad
input by the alias map.

## STEP 3 — No regression: every active aliased key still resolves identically

For each, `resolvedCategory` is **valid**, so branch 1 adopts it — exactly as the
old `getCategoryByKey()?.key || raw` did:

| key sent | `resolvedCategory` | `isValidCategory(resolved)` | adopted (after) | adopted (before) | same? |
|---|---|---|---|---|---|
| `business_meals` | `dinner` (alias) | ✅ `TRAVEL_COA.dinner` | `dinner` | `dinner` | ✅ |
| `toiletries` | `shopping` (alias) | ✅ | `shopping` | `shopping` | ✅ |
| `sports_fitness` (stale) | `adventure` (alias) | ✅ | `adventure` | `adventure` | ✅ |
| `accommodation` | `accommodation` | ✅ | `accommodation` | `accommodation` | ✅ |
| `activities`/`nightlife`/`festivals`/`dinner`/`brunch_coffee`/`shopping` | self | ✅ | self | self | ✅ |
| `coworking` | `undefined` (not in CATEGORIES) | ❌ → branch 2 | `coworking` (raw valid) | `coworking` (raw via `\|\| raw`) | ✅ |
| **`ground_transport`** | **`transport`** (alias) | **❌** → branch 2 | **`ground_transport`** (raw valid) | **`transport`** → 400 | **CHANGED (fixed)** |
| unknown e.g. `foobar` | `undefined` | ❌ → branch 3 | `foobar` → 400 | `foobar` → 400 | ✅ |

**Only `ground_transport` changes** — from `transport` (→400) to
`ground_transport` (→ its real source). Every other key is byte-identical.

## STEP 4 — `ground_transport`'s restored behavior → 501

After the fix `category` stays `ground_transport` → passes the `:186` guard
(`TRAVEL_COA.ground_transport` exists) → registry dispatch
`getSource('ground_transport')` = **`mozio`** (`travelSourceRegistry.ts:86`) →
not google/viator/liteapi → **`throw new UnimplementedSourceError(...)`**
(`route.ts:212`) → outer catch returns **501** (`route.ts:495-502`,
`{ status: 501 }`). So the Ground Transport carousel now shows the intended
"routes to mozio (coming soon)" 501 banner instead of the misleading 400 "Valid
category required".

---

## Hard-constraint compliance

| Constraint | Status |
|---|---|
| Only resolution/validity logic changed | ✅ helper + `:171-175`; taxonomy/COA untouched |
| Other aliased keys resolve identically | ✅ proven (Step 3) — only `ground_transport` changes |
| `ground_transport` → 501 (not 400) | ✅ `:212` → `:502` |
| Accommodation/Viator/Google paths unaffected | ✅ they were already valid → branch 1 (resolved-valid) or unchanged; `isCOACategory`/`isLegacyCategory` (`:354/:356`) untouched |
| 0 schema, 0 deps | ✅ |
| `tsc --noEmit` | ✅ exit 0 |
| eslint changed file | ✅ identical to main (11 pre-existing `no-explicit-any`, **0 added**) |
| git diff scoped to route.ts (+ report) | ✅ `git diff --name-only main` = route.ts only |

**Net effect:** the recurring POST 400 on `/ai-assistant` is gone;
`ground_transport` returns its honest 501 "coming soon"; and any future alias
that points to a dead entry can no longer turn a valid key into a 400.
