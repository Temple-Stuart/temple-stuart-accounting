# TRAVEL — PR-34 Implementation: split combined Places into 9 per-category sections

**Branch:** `claude/travel-pr-34`
**Date:** 2026-05-31
**Scope:** Replace the single combined `TripPlacesSection` (28e1b) with **9
per-category peer sections** — one `TripApiSection` per Google catKey — each with
the same treatment as Hotels/Activities (header/badge/count/SectionFilterBar/
carousel/load-more). **Structural only** — the manual-price/date-time commit is
PR-35. Reads `byCategory` from `TripScanContext`; **no new state, fetch, or paid
call.** 2 files + this report. **0 schema, 0 deps.**

---

## STEP 1 — The combined section, mapped

`TripPlacesSection` (was `TripPlannerAI.tsx:897-929`) derived its Google members
**dynamically**:
```ts
const cats = CAROUSEL_ORDER.filter(
  (k) => getSource(k).source === 'google' && ACTIVE_SCAN_SET.has(k),   // :901-903
);
```
then **merged** every `byCategory[k]` rec into one `items` array with a
`catOf` map for routing (`:905-909`) and rendered **one** `<TravelCarousel
catKey="places" source="google">` (`:913-927`). Rendered once in `page.tsx:1062`
(`<TripPlacesSection />`).

**The 9 pooled Google catKeys** (`CAROUSEL_ORDER`
`TripPlannerAI.tsx:1047-1076`, filtered to `source==='google'`, in order):
`brunch_coffee, dinner, nightlife, coworking, gyms, sports, groceries, shopping,
festivals` — confirmed against `SOURCE_BY_CATEGORY` (all `source:'google'`) and
the active scan set. **9 categories.**

## STEP 2 — Each Google catKey now its own `TripApiSection`

- **`TripPlacesSection` removed** (no orphan — `grep TripPlacesSection src/` →
  none). Replaced by a lazy getter exporting the same ordered set:
  ```ts
  export function getGooglePlaceCatKeys(): string[] {          // TripPlannerAI.tsx
    return CAROUSEL_ORDER.filter((k) => getSource(k).source === 'google' && ACTIVE_SCAN_SET.has(k));
  }
  ```
  (a getter, not a module-level const, so it never reads `CAROUSEL_ORDER` before
  its declaration — same precaution as the old combined section.)
- **`page.tsx`** (`:1059-1063`) renders the 3 existing peers then maps the getter:
  ```tsx
  <TripApiSection catKey="accommodation" title="Hotels" />
  <TripApiSection catKey="ground_transport" title="Ground Transport" />
  <TripApiSection catKey="activities" title="Activities" />
  {getGooglePlaceCatKeys().map((catKey) => (
    <TripApiSection key={catKey} catKey={catKey} />
  ))}
  ```
  Import updated (`page.tsx:9`): `TripPlacesSection` → `getGooglePlaceCatKeys`.
- **Order:** CAROUSEL_ORDER order — Hotels → Ground Transport → Activities →
  **Brunch & Coffee → Dinner → Nightlife → Coworking → Gyms → Sports → Groceries
  → Shopping → Festivals**.
- **Reuses the existing `TripApiSection`** (the very component Hotels/Activities
  use, `TripPlannerAI.tsx:864-890`) — no new section component. It already reads
  `byCategory[catKey]` / `loadingCategories` / `categoryErrors` per catKey and
  wraps `TravelCarousel` in the `SectionCard` chrome.

## STEP 3 — Labels + empty/error/429 states (per section)

- **Label/header:** `TripApiSection`'s `title` was made **optional**
  (`title?: string`); when omitted it falls back to the derived
  `label = CATEGORY_INFO[catKey]?.label || TRAVEL_COA[catKey]?.label || catKey`
  (`:872`, rendered as the `SectionCard` title via `title ?? label`, `:875`). So
  each Google section shows its own category label: **Brunch & Coffee, Dinner,
  Nightlife, Coworking, Gyms & Fitness, Sports & Recreation, Groceries, Shopping &
  Supplies, Festivals & Events** (from `TRAVEL_COA`). Hotels/Ground/Activities
  keep their explicit `title` props (unchanged).
- **Empty / error / 429 — per section:** each `TripApiSection` reads
  `err = categoryErrors[catKey]` (`:869`) and `items = byCategory[catKey]`
  (`:868`) independently, and `TravelCarousel` renders the honest states from
  them: a Google quota **429 → the inline red error banner** for *that* category
  only; **no-data → "No {label} found for this destination."**; **filters narrow
  to zero → "No {label} match your filters." + Clear**. So an empty Gyms section
  shows its own state without affecting Dinner. (Previously the combined section
  forwarded only the **first** Google error and pooled all items — now each is
  independent and honest per category.)

## STEP 4 — Filters per category

Each of the 9 sections renders its **own** `SectionFilterBar` inside its
`TravelCarousel` instance — local `filter` state per carousel
(`TripPlannerAI.tsx:1224`-ish), so filters are **independent per section**. For
`source==='google'` the bar shows the Google facets present on those recs (min
rating, price levels) per 28b's present-fields-only rule
(`SectionFilterBar` google branch). 28d load-more (`shown`) is likewise per
instance. Filtering Dinner does not touch Nightlife.

## Hard-constraint compliance

| Constraint | Status |
|---|---|
| Reads `byCategory[catKey]` from context — no new state/fetch/paid call | ✅ same data, rendered as 9 sections; `TripApiSection` unchanged in how it reads |
| `TripPlacesSection` replaced; removed cleanly (no orphan) | ✅ deleted; `grep` finds zero references |
| Hotels/Activities/Flights/Ground Transport unchanged | ✅ same `TripApiSection` calls with explicit titles; not in the Google map |
| Honest 429/empty/no-match preserved per section | ✅ each reads its own `categoryErrors[catKey]`/`byCategory[catKey]` |
| Manual-price commit (PR-35) untouched | ✅ commit flow not in diff |
| 0 schema, 0 deps | ✅ |
| `tsc --noEmit` | ✅ exit 0 |
| eslint (JSON, branch vs base) | ✅ TPA 1e/2w, page 34e/19w — **+0/+0 both** (all pre-existing) |
| diff scope | ✅ `TripPlannerAI.tsx`, `page.tsx` (+ this report) |

---

## Result
The single combined "Places" carousel is gone; each of the **9** Google discovery
categories — Brunch & Coffee, Dinner, Nightlife, Coworking, Gyms & Fitness, Sports
& Recreation, Groceries, Shopping & Supplies, Festivals & Events — now renders as
its **own peer section** via the same `TripApiSection` that backs Hotels and
Activities, in `CAROUSEL_ORDER` order, each with its own header/label, source
badge, count, independent `SectionFilterBar`, carousel + load-more, and honest
per-section empty/error/429 states. No new state, fetch, or paid call (same
`byCategory` data, rendered as separate sections); `TripPlacesSection` removed
cleanly. The manual-price commit is PR-35. tsc + lint clean, 0 schema, 0 deps.
