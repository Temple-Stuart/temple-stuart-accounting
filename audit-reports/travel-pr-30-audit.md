# TRAVEL — PR-30 Audit: remove the redundant "Committed Items" panel

**Branch:** `claude/travel-pr-30-audit`
**Date:** 2026-05-30
**Mode:** READ-ONLY.
**Question:** Is the "Committed Items" panel safe to remove (it shows "No items
committed yet" and duplicates Committed Budget)?

---

## 1. The panel + its data source

`src/app/budgets/trips/[id]/page.tsx:779-830` — "Committed items by destination":
- When `destEntries.length > 0` → per-destination cards of committed vendor
  options (image, category badge, cost, nights, date, an **Uncommit** button)
  (`:780-822`).
- When empty → the **"Committed Items" / "No items committed yet. Scan
  destinations to find places."** state (`:823-829`).

**Data source:** `destEntries` (`:707`) ← `byDestination` (`:696`) ← `allItems`
(`:687`) ← `resolvedItems` (`:657`) ← **`trip.itinerary`** (`:626`,
`trip_itinerary` entries) joined with `vendorOptions`. The whole prep pipeline
sits in the IIFE at `:625-711`. **Note:** `resolvedItems` **filters OUT flights**
(`:658`), so a trip with only flights committed still reads "No items committed
yet" — part of why the panel looks empty/redundant.

## 2. Shared vs unique data — display-only removal is safe

- **Committed Items** reads `trip.itinerary` + `vendorOptions`.
- **Committed Budget** (`:835+`) reads a **different** state — `committedBudgetItems`
  ← `loadBudgetItems` ← `GET /api/trips/[id]/budget` (`budget_line_items`).

Different tables/state, **overlapping facts** (a vendor-commit writes BOTH a
`trip_itinerary` entry AND a `budget_line_item`). So the panel is redundant at
the fact level, but it has **no unique data dependency** — `trip.itinerary` and
`vendorOptions` remain used elsewhere (the Itinerary calendar's `calendarEvents`
transform; `vendorOptions` page state). Removing the panel removes **no data the
rest of the page needs** → **display-only, safe.**

## 3. Write / nav path into it — preserved elsewhere

The panel's only action is the **Uncommit** button → `handleUncommitItem`
(`:813` → defined `:381`, `DELETE /api/trips/[id]/vendor-commit` then reloads).

**`handleUncommitItem` is NOT exclusive to this panel** — it's also wired to the
**Itinerary calendar/agenda event popover's "Uncommit" button** (`:1248-1259`,
calling the same function with `popoverEvent._vendorOptionId`). Every committed
item becomes a clickable calendar event, so it's uncommittable from the
calendar. Therefore removing the panel:
- does **not** orphan `handleUncommitItem` (still used at `:1253`), and
- does **not** remove the only uncommit affordance (the calendar popover remains).
**Safe.**

## 4. Committed Budget stays intact + still receives every expense

`committedBudgetItems` / `loadBudgetItems` / `/budget` are **independent** of the
panel JSX and the IIFE prep — removing the panel touches none of them. The flow
is unchanged: vendor-commit → `budget_line_items` → `GET /budget` →
`committedBudgetItems` → Committed Budget panel (`:835+`). (Committed Budget has
no uncommit/remove of its own — only a vote toggle, `:903-904` — which is fine,
since uncommit lives in the calendar popover.) **Confirmed intact.**

## 5. Removal scope — NOT pure JSX; dead-code cleanup required

The IIFE at `:625-833` renders **three things**: the Map (`:716-723`, uses
`destinations`/`trip.destination`), the Itinerary calendar (`:726-777`, uses
`calendarEvents`/`tripDates`), and the Committed Items panel (`:779-830`). Only
the Committed Items panel consumes the prep pipeline (`:626-711`):
`itinerary`, `DINING_CATEGORIES`, `scannerNameToDest`, `resolveDestination`,
`resolveCategoryLabel`, `CATEGORY_SORT_ORDER`, `CATEGORY_BADGE_COLORS`,
`resolvedItems`, `deduped`, `allItems`, `byDestination`, `destEntries`.

So removing the panel JSX **orphans ~85 lines of prep** (the Map + Itinerary
don't use any of it) → those become unused (lint will flag them). **The impl is
therefore not a single-block delete:**
- Remove the Committed Items JSX (`:779-830`).
- Remove the now-dead prep (`:626-711`).
- **Lift the Map + Itinerary out of the IIFE** (they need none of the prep) and
  drop the IIFE wrapper — the cleanest way to avoid unused-var lint and keep
  Map/Itinerary rendering.
- `vendorOptions`, `trip.itinerary`, `calendarEvents`, `getDiningCategoryKeys`
  stay if still used elsewhere (calendarEvents transform uses `vendorOptions`;
  confirm `getDiningCategoryKeys`/`DINING_CATEGORIES` has no other consumer in
  the file before deleting its import).

---

## VERDICT

**Safe to remove — display-only, no functional loss:**
- Its data (`trip.itinerary`/`vendorOptions`) is **not unique** and stays used
  elsewhere; Committed Budget reads a **separate** source and is untouched.
- Its only action (Uncommit) is **preserved** via the Itinerary calendar/agenda
  event popover (`:1248-1259`).
- Committed Budget still receives every committed expense (independent `/budget`
  flow).

**Scope:** **not** a pure JSX delete. Remove the panel JSX (`:779-830`) **and**
clean up the ~85-line prep pipeline (`:626-711`) it solely fed, lifting the
Map + Itinerary out of the IIFE. tsc + lint must stay clean (the dead-code
cleanup is what keeps lint green). 0 schema, 0 deps, no endpoint changes.

**One thing for the impl to double-check:** that `getDiningCategoryKeys` /
`DINING_CATEGORIES`, `CATEGORY_BADGE_COLORS`, `resolveCategoryLabel` etc. have no
other consumer in the file before deleting them (grep confirms they're
panel-only here, but verify at implementation).

---

**READ-ONLY audit. No implementation performed.**
