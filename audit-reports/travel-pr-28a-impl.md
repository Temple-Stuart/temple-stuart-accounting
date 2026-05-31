# TRAVEL — PR-28a Implementation: source-separated scan sections (reorder + headers/counts)

**Branch:** `claude/travel-pr-28a`
**Date:** 2026-05-30
**Scope:** Structure + ordering + section headers/counts ONLY. No filtering (28b),
no enrichment (28c), no population change (28d), no visual overhaul (28e). 1 file
+ report. 0 deps, 0 schema, 0 new fetches.

---

## STEP 1 — Reorder `CAROUSEL_ORDER`

`TripPlannerAI.tsx` — the rendered planner sequence (beneath the Flights card).

**Before** (`:955-972` on main):
`accommodation → activities → brunch_coffee → dinner → nightlife → coworking →
shopping → ground_transport`

**After** (`:952-973`):
```
accommodation       // Hotels (LiteAPI)
ground_transport    // Ground Transport (Mozio — 501 "coming soon", PR-24)
activities          // Activities (Viator)
brunch_coffee       // ┐
dinner              // │ Google discovery
nightlife           // │
coworking           // │
shopping            // ┘
```
`ground_transport` moved from **last → 2nd**, so the rendered order is
**Hotels → Ground Transport → Activities(Viator) → Google**.

**Flights stay above the planner — unchanged.** `FlightPicker` renders in its own
card at `page.tsx:1028-1033`, before `<TripPlannerAI>` (`page.tsx:1098`). So the
full page sequence is **Flights → Hotels → Ground Transport → Activities →
Google**, the target order. No `page.tsx` change needed (confirmed; not in diff).

## STEP 2 — Section header: name + source badge + result count

Each section is a `TravelCarousel` whose header already carried the section name
+ source badge (`:1020-1024`). PR-28a adds the **result count**:
- New `sourceNoun(source, n)` helper (`TripPlannerAI.tsx:992-1002`) → "hotel(s)"
  / "activity/activities" / "place(s)" / "option(s)" / "result(s)".
- Header (`:1025-1036`): label + `{items.length} {sourceNoun(...)}` (e.g.
  "12 hotels"), from `byCategory[catKey]` items. Gated `items.length > 0` so it's
  hidden while loading/empty/errored. The source badge (`sourceAttribution`)
  stays on the right.

Section comment updated to describe the new order (`:915-920`).

## STEP 3 — No behavior change beyond order + headers

| Deferred to | Touched here? |
|---|---|
| Filtering UI (28b) | ❌ not added |
| `/data/hotel` enrichment (28c) | ❌ not called |
| Fetch limits / population (28d) | ❌ unchanged |
| Card styling / gradient placeholders (28e) | ❌ untouched |

Cards, `HScrollRow` arrows (PR-27), pricing, fetch logic — all unchanged, just
reordered + wrapped with the count in the existing header.

**`ground_transport` 501 intact in its new position:** its source is still
`mozio` (`travelSourceRegistry.ts:86`); the route still validates it (PR-24) →
`getSource` = mozio → `UnimplementedSourceError` → 501 "coming soon". The
registry/route are not in this diff — position in `CAROUSEL_ORDER` doesn't change
its dispatch. So it renders honestly in the 2nd slot.

---

## Hard-constraint compliance

| Constraint | Status |
|---|---|
| Structure + order + headers/counts only | ✅ |
| ground_transport now 2nd, 501 intact | ✅ registry/route untouched (PR-24 behavior) |
| Carousels + HScrollRow arrows preserved | ✅ TravelCarousel body unchanged |
| 0 deps, 0 schema, 0 new fetches | ✅ |
| `tsc --noEmit` | ✅ exit 0 |
| eslint changed file | ✅ 2 errors (pre-existing, identical to main — 0 added) |
| git diff = TripPlannerAI.tsx (+ report) | ✅ `git diff --name-only main` = TripPlannerAI.tsx only |

---

## Result
The planner now renders clean source-separated sections in the target order
(Hotels → Ground Transport → Activities → Google, with Flights above), each
header showing the section name, source badge, and a live result count — the
structural foundation for 28b (filtering), 28c (enrichment), 28d (population),
and 28e (polish).
