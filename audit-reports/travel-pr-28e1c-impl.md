# TRAVEL — PR-28e1c Implementation: reorder — Crew to top, Committed Budget under Itinerary

**Branch:** `claude/travel-pr-28e1c`
**Date:** 2026-05-31
**Scope:** Pure JSX section reorder in `page.tsx` — move **Crew** to the top
(after TripHeader, before Map) and **Committed Budget** directly after the
Itinerary (before the Destinations & Dates control bar). **No logic, state,
styling, or data change.** Per Alex. 1 file + this report. **0 schema, 0 deps.**

---

## STEP 1 — Current order (origin/main, post-28e1b), cited

`src/app/budgets/trips/[id]/page.tsx` (pre-reorder line ranges):

| Section | Lines |
|---|---|
| `<TripHeader>` | 659-672 |
| Map (`DestinationMap`) | 674-685 (comment 674) |
| Itinerary (`ItineraryAgenda`/`CalendarGrid`) | 687-739 |
| **Destinations & Dates + scan IIFE** (`TripScanProvider` → `TripApiSection`×3 + `TripPlacesSection` + `TripScanModals`) | 741-858 |
| **Committed Budget** | 860-961 |
| Add Expense (inline) | 963-1009 |
| **Crew & Profiles** (`id="travelers"`, PR-31) | 1011-1114 |
| Commit to Ledger | 1116-… |

Order: TripHeader → Map → Itinerary → [Destinations & Dates] → Flights/Hotels/
Ground/Activities/Places → **Committed Budget** → Add Expense → **Crew** → Commit.

## STEP 2 — Two blocks moved verbatim

- **Crew** block (former `:1011-1114`, comment `── Crew & Profiles ──` through its
  closing `</div>`) moved to **directly after `<TripHeader>`** (now
  `page.tsx:674-772`), before the Map comment (`── ... Map + Itinerary`).
- **Committed Budget** block (former `:860-961`, comment `── Committed Budget ──`
  through `})()}`) moved to **directly after the Itinerary** (now
  `page.tsx:846-947`), before the `── Destinations & Dates + scan sections`
  comment.

Both blocks were relocated **byte-for-byte** — same `<div id="travelers">` Crew
table + add-traveler form, same `committedBudgetItems` IIFE + vote buttons + sort
+ destination-filter pills. Add Expense, Map, Itinerary, the scan sections, and
Commit were not touched (only their surrounding positions shifted).

**New order (cited):** `<TripHeader>` (`:659`) → **Crew** (`:674`) → Map (`:779`)
→ Itinerary (`:795`) → **Committed Budget** (`:846`) → Destinations & Dates
(`:949`) → Hotels/Ground/Activities/Places (`:1059-1062`) → Add Expense (`:1068`)
→ Commit to Ledger (`:1116`). Matches the target exactly.

> **Note on Add Expense:** the task named two moving blocks (Crew, Committed
> Budget). Add Expense stayed in its original sequence slot (now between the scan
> sections and Commit). The target order lists Crew/Budget/Map/Itinerary/control/
> APIs/Commit and is satisfied; Add Expense is an inline form that wasn't called
> out to move and its behavior/position-relative-to-Commit is unchanged.

## STEP 3 — Nothing else changed

- **Pure-reorder proof:** `diff <(git show origin/main:page.tsx | sort) <(sort
  page.tsx)` → **empty**. The sorted line multiset is identical to origin/main —
  every line is preserved verbatim; only positions changed. `git diff --stat` =
  208 insertions / 208 deletions (symmetric move), 1 file.
- **Crew add-traveler + invite-link (PR-31):** the entire `id="travelers"` block
  (the `handleAddParticipant` form, `copyInvite`, RSVP rows) moved verbatim — same
  handlers, same `participants`/`isOrganizer`/`showAddTraveler` page state. Works
  identically at the top.
- **Committed Budget votes + data:** the `committedBudgetItems` IIFE (vote
  toggles via `setCommittedBudgetItems`, `budgetSort`, `budgetFilter`, destination
  pills) moved verbatim. Data flow unchanged.
- **Provider scope intact:** the `<TripScanProvider>` spans only the scan IIFE
  (now `page.tsx:1038-1064`). Both moved blocks sit **outside** it (Crew at
  `:674`, Budget at `:846`, both before the provider open) — exactly as before.
  Verified neither block references any scan-context symbol
  (`useTripScanCtx`/`byCategory`/`rescanAll`/`TripApiSection`/`TripScanControls`):
  grep count **0** in each. They consume page state only, so their position is
  free — no consumer was pulled out of the provider.
- **All other sections** (Map, Itinerary, the API peers, Add Expense, Commit)
  unchanged.

## Hard-constraint compliance

| Constraint | Status |
|---|---|
| JSX reorder ONLY — no logic/state/styling/data change | ✅ sorted-multiset diff empty |
| Crew (PR-31) + Committed Budget behaviors identical | ✅ blocks moved verbatim, page state unchanged |
| TripScanProvider scope not broken | ✅ both blocks were & remain outside the provider; 0 scan-context refs |
| 0 schema, 0 deps | ✅ |
| `tsc --noEmit` | ✅ exit 0 |
| eslint (JSON, branch vs origin/main) | ✅ 34e/19w == base → **+0e/+0w** |
| git diff scoped | ✅ `page.tsx` (+ this report) |

---

## Result
Sections now render TripHeader → **Crew** → Map → Itinerary → **Committed
Budget** → Destinations & Dates → Flights → Hotels → Ground Transport →
Activities → Places → Commit. Two blocks were relocated byte-for-byte (proven by
an empty sorted-line diff against origin/main); Crew's add-traveler/invite-link
and the Committed Budget votes/filters behave identically; the TripScanProvider
scope is unchanged (neither moved block depends on scan context). tsc + lint clean.
