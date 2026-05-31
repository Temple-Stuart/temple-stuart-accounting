# TRAVEL — PR-36 Implementation: re-apply per-category Google split (expense-category titles, registry source)

**Branch:** `claude/travel-pr-36`
**Date:** 2026-05-31
**Scope:** Replace the combined "Places" section with **9 per-category
`TripApiSection` renders**, each titled by its **expense category**
(`TRAVEL_COA.label`) and reading its **source per-category from the registry**
(`getSource`) — so "Places"/"Google" dies and each category's API is swappable.
**Fresh re-apply on current `main`** (PR-34 never merged; the stale branch would
conflict). Per `audit-reports/travel-pr-36-audit.md`. 2 files + this report.
**0 schema, 0 deps.**

---

## STEP 1 — Current state confirmed

- **Combined section:** `TripPlacesSection` (`TripPlannerAI.tsx:897-929`) rendered
  `<SectionCard title="Places">` (`:913`) with **hardcoded `source="google"`**
  (`:917`), pooling all 9 Google catKeys into one ~160-item carousel.
- **Render site:** `page.tsx:1062` `<TripPlacesSection />` (imported `:9`).
- **`TripApiSection` already registry-driven:** `const { source } =
  getSource(catKey)` (`:873`) + title fallback `info?.label || coa?.label ||
  catKey` (`:872`). So the per-category component was already swap-ready — only the
  combined section + its render site needed replacing.
- **`TRAVEL_COA` has all 9 expense labels** (cited): brunch_coffee "Brunch &
  Coffee" (`:49`), dinner "Dinner" (`:63`), nightlife "Nightlife & Entertainment"
  (`:128`), coworking "Coworking" (`:167`), gyms "Gyms & Fitness" (`:236`), sports
  "Sports & Recreation" (`:251`), groceries "Groceries" (`:221`), shopping
  "Shopping & Supplies" (`:204`), festivals "Festivals & Events" (`:143`).

## STEP 2 — `TripApiSection.title` made optional → expense-category label

`TripPlannerAI.tsx:864` — `title: string` → **`title?: string`**; render uses
**`<SectionCard title={title ?? label}>`** (`:881`), where `label = info?.label ||
coa?.label || catKey` (`:877`). So a Google section with no explicit `title`
auto-titles from its `TRAVEL_COA` expense label — **never "Places"/"Google".**
Hotels/Ground/Activities keep their explicit `title` props (`"Hotels"` etc.,
unchanged).

## STEP 3 — `getGooglePlaceCatKeys` + per-category render

- **`TripPlannerAI.tsx:891-901`** — `export function getGooglePlaceCatKeys()` =
  `CAROUSEL_ORDER.filter(k => getSource(k).source === 'google' &&
  ACTIVE_SCAN_SET.has(k))` (the same filter the combined section used, now exposed
  as the section list). A getter (not a module const) so it never reads
  `CAROUSEL_ORDER` before declaration.
- **`page.tsx`** — `<TripPlacesSection />` replaced (`:1062-1069`) with:
  ```tsx
  {getGooglePlaceCatKeys().map((catKey) => (
    <TripApiSection key={catKey} catKey={catKey} />
  ))}
  ```
  (import swapped `:9`: `TripPlacesSection` → `getGooglePlaceCatKeys`.) Each
  section reads `getSource(catKey)` for its source/badge and titles from its
  `TRAVEL_COA` label.

**The 9 sections** (CAROUSEL_ORDER order, after Hotels/Ground/Activities):
Brunch & Coffee → Dinner → Nightlife & Entertainment → Coworking → Gyms & Fitness
→ Sports & Recreation → Groceries → Shopping & Supplies → Festivals & Events.

## STEP 4 — `TripPlacesSection` deleted

`TripPlacesSection` (the hardcoded-`source="google"`, "Places"-titled
anti-pattern) **removed entirely**. Grep-confirmed **zero orphan references**
(`grep -rn TripPlacesSection src/` → none) — the PR-30 clean-removal standard. The
stale CAROUSEL_ORDER comment that referenced it was updated to describe the
per-category render.

## STEP 5 — The 9 + swappability verified

- **9 sections, expense-category titles** (verified, none "Places"/"Google"):
  Brunch & Coffee, Dinner, Nightlife & Entertainment, Coworking, Gyms & Fitness,
  Sports & Recreation, Groceries, Shopping & Supplies, Festivals & Events.
- **Registry-driven source (the monetization-swap foundation):** the only `source`
  in the section render is **`getSource(catKey)`** (`TripApiSection`, `:879`) —
  the hardcoded `source="google"` is gone with `TripPlacesSection`. **Changing a
  category's `SOURCE_BY_CATEGORY` entry (e.g. `gyms: { source: '<new-api>' }`)
  changes that section's source + badge + the route's dispatch with NO render
  edit** — and the category would automatically leave `getGooglePlaceCatKeys()`
  (which filters on `source === 'google'`) and render under its new source. That
  is the swap-ready design (mirrors LiteAPI=hotels, Viator=activities).
- **Honest per-section states, independent:** each `TripApiSection` reads its own
  `byCategory[catKey]` / `loadingCategories.has(catKey)` /
  `categoryErrors[catKey]` (`:865-869`) and `TravelCarousel` renders that
  category's own 429 error banner / no-data / no-match-filters state — an empty
  Gyms section shows its own state without affecting Dinner. (Previously the
  combined section forwarded only the first Google error and pooled all items.)

## Hard-constraint compliance

| Constraint | Status |
|---|---|
| FRESH re-apply on current main (not the stale PR-34 branch) | ✅ edited current main's files directly; no cherry-pick/merge |
| Titles from expense-category label, never "Places"/"Google" | ✅ `title ?? label`, label from `TRAVEL_COA`; all 9 verified |
| Source per-category via `getSource` (no hardcoded 'google') | ✅ only `getSource(catKey)` (`:879`); hardcode removed with TripPlacesSection |
| Reads `byCategory` from context — no new state/fetch/paid call | ✅ same data, rendered as 9 sections |
| TripPlacesSection removed cleanly (no orphan) | ✅ deleted; grep = zero references |
| Hotels/Activities/Flights/Ground Transport + PR-35 PlaceCommitForm untouched | ✅ explicit-title sections unchanged; PlaceCommitForm (detail route) not in diff |
| 0 schema, 0 deps | ✅ |
| `tsc --noEmit` | ✅ exit 0 |
| eslint (JSON, branch vs base) | ✅ TPA 1e/2w, page 34e/19w — **+0/+0 both** (all pre-existing) |
| diff scope | ✅ `TripPlannerAI.tsx`, `page.tsx` (+ this report) |

> **Anti-re-revert:** PR-34's failure was a missing merge, not a code defect. This
> re-apply must be **merged** before the next travel PR branches, so it isn't
> skipped again.

---

## Result
The combined "Places" carousel is gone. Each of the 9 Google discovery categories
renders as its **own peer section**, titled by its expense category (Gyms &
Fitness, Groceries, Brunch & Coffee, …) — never "Places"/"Google" — with its
source read per-category from the registry via `getSource`. A category becomes a
sellable-API section by a single `SOURCE_BY_CATEGORY` edit, with no render change
(the monetization-swap foundation). `TripPlacesSection` is removed with zero
orphans; Hotels/Activities/Flights/Ground Transport and PR-35's `PlaceCommitForm`
are untouched. No new state/fetch/paid call. tsc + lint clean, 0 schema, 0 deps.
