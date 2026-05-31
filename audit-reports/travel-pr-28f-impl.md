# TRAVEL — PR-28f Implementation: restore festivals + add Gyms/Groceries/Sports (Google Places)

**Branch:** `claude/travel-pr-28f`
**Date:** 2026-05-31
**Scope:** Restore `festivals` to the render surface (the true 1-line regression),
and add three new **Google Places** COA keys — **Gyms**, **Groceries**, **Sports**
— as recurring-membership/necessity *places* (not Viator activities). Per
`audit-reports/travel-pr-28f-audit.md`. 3 files + this report. **0 schema, 0
deps.** Viator `activities` bucket untouched.

---

## STEP 1 — festivals restored (the true regression)

The audit proved `festivals` was in the active scan set
(`getActiveScanCategories`, `travelCOA.ts:297-325` — not in any skip list) but
**absent from `CAROUSEL_ORDER`**, so it scanned and never rendered. Fixed by one
line in `CAROUSEL_ORDER` (`TripPlannerAI.tsx`):

- **Before:** `…coworking, shopping,` then conferences comment — no `festivals`.
- **After:** added `'festivals',  // Festivals & events (Google)` to the list.

Validity: `festivals` is a COA key (`travelCOA.ts:142-153`, label "Festivals &
Events", `P-9440`) → `isValidCategory` true (no 400). Source: it already had a
registry entry `festivals: { source: 'google', hardBookable: false }`
(`travelSourceRegistry.ts:97`). Its `scanQueries` are empty (`:149`) so the route
falls back to interest-expansion/label queries (`route.ts:374-375` →
`getCOAScanQueries`, `travelCOA.ts:286-288`).

## STEP 2 — Gyms (Google Places COA key)

Added `gyms` to `TRAVEL_COA` (`travelCOA.ts`, after `groceries`):
- label **"Gyms & Fitness"**, `source: google` (`travelSourceRegistry.ts` new
  entry), `coaPersonal: 'P-9520'` (unused before — verified unique),
  `coaBusiness: null`.
- **COA line:** P-9520 — a personal recurring-membership line (sits in the
  P-95xx coworking/membership band alongside coworking P-9510).
- `multiDay: true` (membership spans the stay), `defaultFrequency: 'total'`.
- **Google queries** (extracted from the gym terms previously buried in the
  Viator-routed `wellness` `CATEGORY_SEARCHES`, `placesSearch.ts:347`, now given a
  proper Google home): `['gym fitness center', 'crossfit box', 'climbing gym
  bouldering', 'pilates reformer studio']` — all multi-word (no bare-slug
  INVALID_REQUEST).
- Added to `CAROUSEL_ORDER` (`'gyms'`).

## STEP 3 — Groceries (Google Places, distinct from Shopping)

Added `groceries` to `TRAVEL_COA` (after `shopping`):
- label **"Groceries"**, `source: google`, `coaPersonal: 'P-9830'`,
  `coaBusiness: 'B-9830'` (both unused before — verified unique).
- **COA line:** P-9830/B-9830 — a recurring **necessity** line, deliberately
  separate from discretionary `shopping` (P-9800/B-9800) so weekly food spend is
  budgeted apart from one-off mall/market purchases.
- **Google queries:** `['supermarket grocery store', 'local food market',
  'organic health food store', 'butcher fishmonger deli']`.
- Added to `CAROUSEL_ORDER` (`'groceries'`), distinct from `'shopping'` (both
  present).

## STEP 4 — Sports (Google Places — membership courts/clubs/spots)

Added `sports` to `TRAVEL_COA`:
- label **"Sports & Recreation"**, `source: google`, `coaPersonal: 'P-9530'`,
  `coaBusiness: null` (unique). **NOT Viator** — these are the recurring-
  membership *places* you join (same shape as Gyms/Coworking), not book-once
  Viator experiences.
- **COA line:** P-9530 — personal recurring-membership line (P-95xx band).
- `multiDay: true`, `defaultFrequency: 'total'`.
- **Search terms (the PLACES):** `['tennis court club', 'pickleball court', 'golf
  club course', 'surf school spot', 'kitesurfing center', 'ski snowboard
  resort']`.
- Added to `CAROUSEL_ORDER` (`'sports'`).

## STEP 5 — No 400, right section

For each new key (gyms / groceries / sports) and restored `festivals`:
- **(a) No PR-24 400** — all four are keys in `TRAVEL_COA`, so
  `isValidCategory` (`route.ts:113-114`: `!!TRAVEL_COA[key] || …`) is **true**.
  Verified: COA-code collision check = none; all 21 COA keys present.
- **(b) Routes to Google** — each has an explicit `SOURCE_BY_CATEGORY` entry
  `{ source: 'google', hardBookable: false }`. Registry exhaustiveness verified:
  **all 21 COA keys have a registry entry** (the dev self-check
  `travelSourceRegistry.ts:119-130` stays silent; `festivals` previously already
  had one). `getSource(key).source === 'google'` for all four.
- **(c) Renders in the combined Places section** — per the audit's recommendation
  and 28e1b's locked "one Places section" design, `TripPlacesSection`
  (`TripPlannerAI.tsx:897-903`) derives its members **dynamically**:
  `CAROUSEL_ORDER.filter(k => getSource(k).source === 'google' &&
  ACTIVE_SCAN_SET.has(k))`. So adding each Google key to `CAROUSEL_ORDER` makes it
  **auto-join Places** with **no `page.tsx` change**. Each card still routes to
  its own catKey's detail (the `catOf` map, `:906-908`).
- **Scan set** — `getActiveScanCategories([], '')` skips only
  flights/communication/insurance_fees/conferences/adventure/arts_culture/
  wellness/bucket_list/business_meals; the new keys are **none of those** →
  active by the "everything else gets scanned" branch (`travelCOA.ts:320-321`).
  No edit to that function was required.

## STEP 6 — Viator untouched

- `src/lib/viatorClient.ts` **not in the diff**.
- The `activities` Viator COA entry (`travelCOA.ts:92-102`) is **unchanged**; no
  un-collapse of `adventure`/`arts_culture` (Sports is Google here, not Viator).
- `CAROUSEL_ORDER`'s `'activities'` entry + its Viator `TripApiSection` render
  path are unchanged. The Activities section behaves exactly as before.
- (The `vendorApi: 'activities'` field on the new keys is the *vendor-commit*
  endpoint — the generic activity option type used at commit time — not the
  Viator scan path. Same as shopping/coworking use today.)

## Quota-429 honest state

The new Google categories show an **honest 429** when Google's daily quota is
exhausted — expected, not a bug. A quota error surfaces as
`categoryErrors[catKey]` → the per-section inline red banner in `TravelCarousel`;
the combined Places section forwards the **first** Google error
(`TripPlacesSection` `err = cats.map(...).find(Boolean)`, `TripPlannerAI.tsx:911`)
— never a fabricated empty. Google calls remain cache-first (`route.ts:397-408`).

## Hard-constraint compliance

| Constraint | Status |
|---|---|
| All new keys GOOGLE source, in TRAVEL_COA (no 400) | ✅ 3 new + festivals, all `source: google`, all valid COA keys |
| Sports = PLACES (courts/clubs), not Viator | ✅ Google queries for courts/clubs/spots; Viator untouched |
| Groceries distinct from Shopping | ✅ own key P-9830/B-9830, own queries, both in CAROUSEL_ORDER |
| Each mapped to correct COA line | ✅ gyms P-9520, sports P-9530 (recurring membership), groceries P-9830/B-9830 (necessity) — all unique |
| Quota-429 honest state | ✅ inline error banner, first-error forwarded, no masking |
| 0 schema (COA keys are data) | ✅ no prisma/schema/migration file touched |
| 0 deps | ✅ |
| `tsc --noEmit` | ✅ exit 0 |
| eslint (JSON, branch vs origin/main) | ✅ travelCOA 0e/1w, registry 0e/0w, TPA 1e/2w — **+0/+0 on all three** |
| git diff scoped | ✅ `travelCOA.ts`, `travelSourceRegistry.ts`, `TripPlannerAI.tsx` (+ this report) |

---

## Result
`festivals` renders again (regression closed), and **Gyms**, **Groceries**, and
**Sports** are now Google-Places recurring-membership/necessity categories — each
a valid COA key (no 400), routed to Google, auto-joining the combined Places
section via `CAROUSEL_ORDER` (no `page.tsx` change), mapped to its own COA line
(gyms P-9520, sports P-9530, groceries P-9830/B-9830, distinct from shopping
P-9800). The Viator `activities` bucket is untouched. Google quota shows an honest
429 until reset. tsc + lint clean, 0 schema, 0 deps.
