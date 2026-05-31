# TRAVEL — PR-36 Audit: "Places" regressed to one section — re-split by expense category

**Branch:** `claude/travel-pr-36-audit`
**Date:** 2026-05-31
**Mode:** READ-ONLY.
**Problem:** PR-34 split the combined "Places" into 9 per-category sections, but
current `main` shows **one** "Places" section again (header "Places", "160 places ·
Google · discovery"). Find why, and confirm the fix: each section titled by its
**expense category** (Gyms & Fitness, Groceries, Brunch & Coffee…), with the API
as a swappable **per-category source** from the registry — never "Places" (an API
pool name, not an expense).

---

## 1. Regression verdict — PR-34 NEVER MERGED to main

**Git-history proof:**
- PR-34's commit is `04057d35` ("Travel-PR-34: split combined Places into 9
  per-category sections"). It exists **only on its own branch** `claude/travel-pr-34`
  (and `origin/claude/travel-pr-34`).
- `git merge-base --is-ancestor 04057d35 main` → **NO — 04057d35 is NOT in main.**
- The recent merges into `main` (newest first): #681 PR-35 (`54967ccf`), #680
  PR-35a (`4c4a9ec3`), #679 PR-28f-2, #678 PR-33, #677 PR-33-audit, #676 PR-32,
  #675 PR-32-audit, #674 PR-28f. **PR-34 is absent from this sequence.**
- `git log -- page.tsx` on main ends at `7eadb569` (PR-28e1c); the next page.tsx
  edit would have been PR-34's — it never landed.

**Verdict: NEVER-SHIPPED, not reverted.** PR-34 was authored and pushed to its
branch but the PR was not merged. The subsequent PRs (28f-2, 32, 33, 35a, 35) were
all cut from `main` **without** PR-34, so `main` still carries the PR-28e1b
combined `TripPlacesSection`. (Side effect: **PR-35's `PlaceCommitForm` shipped**,
reachable from the per-category detail route, but the **planner still pools all 9
into one "Places" carousel** — the split the user expects is missing.)

## 2. What renders the single "Places" section now

`src/components/trips/TripPlannerAI.tsx:897-929` — **`TripPlacesSection`** (the
PR-28e1b combined section, still alive on main):
```tsx
const cats = CAROUSEL_ORDER.filter(k => getSource(k).source === 'google' && ACTIVE_SCAN_SET.has(k));  // :901-903
// …pools every byCategory[k] into one items[] (160 places)…
return (
  <SectionCard title="Places">                       {/* :913 — the "Places" header */}
    <TravelCarousel catKey="places" label="Places" source="google" … />   {/* :915-917 */}
  </SectionCard>
);
```
- The header **"Places"** = `SectionCard title="Places"` (`:913`).
- The badge **"Google · discovery"** = `sourceAttribution('google')` driven by the
  hardcoded `source="google"` (`:917`).
- The **160-place pool** = all 9 Google catKeys' recs merged into one `items[]`
  (`:905-909`).

Rendered in `page.tsx:1062` — `<TripPlacesSection />` (imported `:9`). So it is
**TripPlacesSection** (combined-by-design from 28e1b), **not** a per-category
render — PR-34's `getGooglePlaceCatKeys` map never reached main.

## 3. Expense-category title source (the fix's titles)

A `TripApiSection`'s title today comes from its **`title` prop** (required,
`:864`); the body label derives as
`info?.label || coa?.label || catKey` (`:872`) where `coa = TRAVEL_COA[catKey]`
(`:870`). **`TRAVEL_COA` has an expense-category label for all 9** (cited):

| catKey | `TRAVEL_COA[catKey].label` (the title to use) |
|---|---|
| brunch_coffee | **Brunch & Coffee** (`travelCOA.ts:49`) |
| dinner | **Dinner** (`:63`) |
| nightlife | **Nightlife & Entertainment** (`:128`) |
| coworking | **Coworking** (`:167`) |
| gyms | **Gyms & Fitness** (`:236`) |
| sports | **Sports & Recreation** (`:251`) |
| groceries | **Groceries** (`:221`) |
| shopping | **Shopping & Supplies** (`:204`) |
| festivals | **Festivals & Events** (`:143`) |

`CATEGORY_INFO` (TripPlannerAI) only has 3 of the 9 (coworking/dinner/nightlife),
so the title MUST fall back to `TRAVEL_COA[catKey].label` (present for all 9) —
**never "Places" or "Google".** For the fix, each section's title = the
expense-category label (make `TripApiSection.title` optional → default to the
derived `label`, exactly as the PR-34 branch did, see §6).

## 4. API as a swappable per-category source — registry-driven

`src/lib/travelSourceRegistry.ts`:
- `SOURCE_BY_CATEGORY` (`:51`) maps each category → `{ source, hardBookable }`.
- `getSource(category)` (`:115`) returns that assignment (Google default for
  unknown).

**The per-category render is ALREADY registry-driven; the combined one is NOT:**
- `TripApiSection` reads **`const { source } = getSource(catKey)`**
  (`TripPlannerAI.tsx:873`) — per-category source from the registry. ✅ So
  swapping, say, `gyms` from `google` → a future sellable API is a **registry
  edit** (`SOURCE_BY_CATEGORY.gyms = { source:'<new>', … }`), **not** a render
  change. This is the swap-ready design (mirrors LiteAPI=hotels, Viator=activities).
- `TripPlacesSection` **hardcodes `source="google"`** (`:917`) — the anti-pattern.
  It can't represent a per-category swap (everything in the pool is forced
  Google), which is exactly why it must be replaced by per-category
  `TripApiSection` renders.

**Proposal: render one `TripApiSection` per Google catKey** (each reads
`getSource(catKey)` → its own source + badge), titled by the expense label.

## 5. The 9 categories — COA + registry source (cited)

In `CAROUSEL_ORDER` order (`TripPlannerAI.tsx:1057-1072`), all `source:'google'`
in `SOURCE_BY_CATEGORY`:

| # | catKey | Expense label | COA (P / B) | Registry source |
|---|---|---|---|---|
| 1 | brunch_coffee | Brunch & Coffee | P-9310 / B-9310 | google |
| 2 | dinner | Dinner | P-9320 / B-9320 | google |
| 3 | nightlife | Nightlife & Entertainment | P-9430 / null | google |
| 4 | coworking | Coworking | P-9510 / B-9510 | google |
| 5 | gyms | Gyms & Fitness | P-9520 / null | google |
| 6 | sports | Sports & Recreation | P-9530 / null | google |
| 7 | groceries | Groceries | P-9830 / B-9830 | google |
| 8 | shopping | Shopping & Supplies | P-9800 / B-9800 | google |
| 9 | festivals | Festivals & Events | P-9440 / null | google |

(COA from `travelCOA.ts`; source from `travelSourceRegistry.ts:51-…`.) **Each
should be its own section** — its expense identity is what the user budgets, and
its source is a swappable implementation detail. (The null-business set —
nightlife/gyms/sports/festivals — is the personal-only group PR-35 already
enforces at commit; unrelated to the section split.)

## 6. Re-apply scope + WHY it regressed (prevent re-revert)

**Why it regressed:** PR-34 was a **clean, correct implementation that simply was
never merged** (the PR sat un-merged while 28f-2/32/33/35a/35 merged ahead of it).
Because those later PRs branched from a PR-34-less `main`, re-merging the **old**
PR-34 branch now would conflict (page.tsx + TripPlannerAI moved under PR-35 etc.).
**The safe path is a fresh re-apply on current `main`,** not a merge of the stale
branch.

**Re-apply (mirrors the PR-34 branch's proven approach,
`04057d35:TripPlannerAI.tsx`):**
- **`TripPlannerAI.tsx`:**
  - Make `TripApiSection.title` **optional** (`title?: string`) → `SectionCard
    title={title ?? label}` so a Google section auto-titles from its
    `TRAVEL_COA` expense label (§3). (~2 lines.)
  - Add **`export function getGooglePlaceCatKeys()`** =
    `CAROUSEL_ORDER.filter(k => getSource(k).source === 'google' &&
    ACTIVE_SCAN_SET.has(k))` (the same filter `TripPlacesSection` uses, `:901-903`).
  - **Remove `TripPlacesSection`** (delete `:892-929`) — the orphan combined
    section.
- **`page.tsx`:** replace `<TripPlacesSection />` (`:1062`) with
  `{getGooglePlaceCatKeys().map(catKey => <TripApiSection key={catKey}
  catKey={catKey} />)}`; swap the import (`:9`) `TripPlacesSection` →
  `getGooglePlaceCatKeys`.
- **Result:** 9 sections, each titled by its expense label, each reading
  `getSource(catKey)` for its source/badge — registry-swappable.

**Files:** `TripPlannerAI.tsx`, `page.tsx` (+ report). **0 schema, 0 deps.**
Hotels/Ground Transport/Activities/Flights untouched. PR-35's `PlaceCommitForm` is
unaffected (it lives on the detail route).

**Anti-re-revert note:** the re-apply must go in as its own PR on current `main`
and be **merged** (the PR-34 failure was a missing merge, not a code defect).
Recommend confirming the merge lands before the next travel PR branches.

## Sign-off items
1. **Re-apply fresh vs merge the stale PR-34 branch** — recommend fresh re-apply
   on current `main` (the branch will conflict with PR-35's edits).
2. **Title fallback** — confirm titles come from `TRAVEL_COA[catKey].label` (all 9
   present) when `title`/`CATEGORY_INFO` is absent — never "Places"/"Google".
3. **Section order** — `CAROUSEL_ORDER` order (Brunch & Coffee → Dinner →
   Nightlife → Coworking → Gyms → Sports → Groceries → Shopping → Festivals), after
   Hotels/Ground/Activities. Confirm.
4. **Remove `TripPlacesSection` entirely** (no combined fallback) vs keep it dead —
   recommend remove (clean, no orphan).

---

**READ-ONLY audit. No implementation performed.**
