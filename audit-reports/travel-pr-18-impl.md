# TRAVEL — PR-18 Implementation: Itinerary Agenda/Stack View

**Branch:** `claude/travel-pr-18`
**Date:** 2026-05-30
**Scope:** New Trips-only `ItineraryAgenda` component (Option A) + a Grid/Agenda
toggle in the Itinerary panel. Agenda is the default. The shared `CalendarGrid`,
`TRAVEL_COA`, and the `calendarEvents` transform are untouched.

---

## New component

**Path:** `src/components/trips/ItineraryAgenda.tsx`.

> **Dir note:** the audit suggested `src/components/travel/`, but no such dir
> exists — the established home for trip UI is `src/components/trips/`
> (TripPlannerAI, FlightPicker, HotelPicker, …). Placed it there to match the
> existing layout, per Step 1's "confirm the right dir."

**Props** (`ItineraryAgenda.tsx:21-32`) — consumes `CalendarEvent` as-is, no new
data shape:
```ts
events: CalendarEvent[];                 // the SAME array CalendarGrid gets
sourceConfig: Record<string, SourceConfig>;
view: 'day' | 'week' | 'month';          // the active granularity (from parent)
anchorDate?: string;                     // window anchor (trip start)
onEventClick?: (event, mouseEvent?) => void;
```
Both `CalendarEvent` and `SourceConfig` are imported as types from the shared
`@/components/shared/CalendarGrid` (`ItineraryAgenda.tsx:18`) — type-only import,
no runtime coupling, grid file unmodified.

---

## Step-by-step, cited

### Step 2 — Row anatomy
`ItineraryAgenda.tsx:185-205`. Each event is one row:
`[color dot] · [time/date-span] · [title] · [location?] · [cost →]`.
- Color dot uses the **existing** `sourceConfig[e.source].dot`
  (`:190-191`) — raw Tailwind from TRAVEL_COA (flights `bg-purple-400`, stays
  `bg-blue-400`, activities `bg-violet-400`). **No brand tokens, TRAVEL_COA
  unmodified.**
- Cost via `formatCurrency` (`:201-203`, 2-fraction-digit → matches the
  `$495.49` cents format).

### Step 3 — Multi-span / timed labels
`timeLabel()` at `ItineraryAgenda.tsx:135-159`:
- **Multi-day span** (lodging): `"Jul 2 → Jul 9 · 7 nights"` — nights computed
  from `startDate`/`endDate` already on the event (`:137-141`).
- **Timed, crossing midnight** (red-eye flight):
  `"Jul 1 · 11:30 PM → Jul 2 · 10:05 AM"` (`:147-151`).
- **Timed, same day:** `"11:30 PM → 10:05 AM"` (`:152`).
- Span vs flight disambiguation: `isMultiSpan` requires **no `startTime`** +
  distinct dates (`:88`), so a red-eye (which has a `startTime`) is a timed row,
  never a span — no synthesized nights. No new fields.

### Step 4 — No-time items (render case, not a fallback)
`sortDay()` at `ItineraryAgenda.tsx:124-130` sorts no-time/all-day/span rows to
the **top** of their day group; `timeLabel` renders them as `"All day"`
(`:158`). This mirrors the grid's audited all-day-row behavior
(`CalendarGrid.tsx:125`) — same render case, no synthesized time, no midnight.

### Step 5 — Day/Week/Month grouping
- Window from `view` + cursor: `ItineraryAgenda.tsx:64-78` (day = 1 day;
  week = Sun–Sat; month = full month).
- Events grouped into their anchor day, clamped into the window
  (`:96-106`); `dayKeys` sorted chronologically (`:107`).
- **Only days with items render** — the map iterates `dayKeys` (the populated
  set), so empty days are skipped (`:172-211`). That's the compactness win.
- Window nav (Start / ‹ / ›) at `:164-179`; month view = wider window, same
  day-grouped rows.

### Step 6 — Toggle + default
In `src/app/budgets/trips/[id]/page.tsx`:
- State: `itinView` (default **`'agenda'`**) + `agendaGran` (default `'week'`)
  at `:122-124`.
- Header toggle (Agenda/Grid + Day/Week/Month when in agenda) at `:706-723`.
- Body branch at `:728-748`: agenda renders `<ItineraryAgenda>`; the **`grid`
  branch renders the existing `<CalendarGrid>` with byte-unchanged props**
  (`defaultView`, `showBudgetTotals`, `showCategoryLegend`, `compact`, the
  highlight range, `onEventClick`). The grid's own Week/Month toggle still
  works internally.
- Cost total preserved in **both** views: grid keeps `showBudgetTotals`; agenda
  renders a `Total` footer (`ItineraryAgenda.tsx:214-219`).

---

## Hard-constraint compliance (proof)

`git diff --name-only main` →
```
src/app/budgets/trips/[id]/page.tsx   (M)
src/components/trips/ItineraryAgenda.tsx  (new)
audit-reports/travel-pr-18-impl.md    (new)
```

| Constraint | Status |
|---|---|
| `shared/CalendarGrid.tsx` untouched | ✅ not in diff (grep-confirmed) |
| `TRAVEL_COA` / `travelCOA.ts` / `travelCategories.ts` colors untouched | ✅ not in diff |
| `calendarEvents` transform (`page.tsx:425-547`) unchanged | ✅ grep-confirmed zero diff in that block |
| data-model / route / schema | ✅ none in diff |
| `duffel.ts:180` 00:00 placeholder flag | ✅ not touched (separate PR) |
| 0 new dependencies | ✅ only React + next/navigation |
| `tsc --noEmit` | ✅ exit 0 |
| eslint changed files | ✅ `ItineraryAgenda.tsx` 0 errors/0 warnings; `page.tsx` error count identical on main and branch (45 — all pre-existing `no-explicit-any`, none added) |

`page.tsx` diff is **+30 / −0**: the CalendarGrid block was wrapped into the
`grid` branch, so its props show no deletions/changes.

---

## Behavior summary
- Default view is the compact agenda: per-day headers, empty days skipped,
  one row per item, multi-day lodging as a single span row, red-eye flights as
  a single timed cross-midnight row, no-time items at the top labeled "All day".
- Grid toggle restores the exact prior `CalendarGrid` experience.
- Both views show a cost total.
- The Duffel `T00:00` "12:00 AM" question is untouched, left for its dedicated PR.
