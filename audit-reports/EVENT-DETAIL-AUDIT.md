# EVENT-DETAIL AUDIT — a type-aware click→detail panel for the master calendar

**Type:** Audit — READ ONLY. No source modified.
**Goal:** Clicking a calendar event (currently dead) should open a **type-aware**
detail panel — trips / projects / routines show the standard fields + the 12-column
`hub_scheduled_items` scaffold (placeholders for now); **trade** shows different
fields (position / signal / P&L / expiry). It must work on the **demo** events
(logged-out) first, with **zero fetches**.

All citations are `src/` line numbers.

---

## VERDICT — EXISTS (a one-type card) | MISSING (a type-aware demo panel) | small PR

A working slide-in card already exists for ONE type (`HubEventCard`, projects only,
logged-in only). The click is dead for everything in the demo. The smallest PR is a
new **type-aware `EventDetailPanel`** that renders the clicked `GridEvent` directly
(zero fetch), mounted in HubCalendar, opened by routing **every** demo click into a
`selectedEvent` state. The panel branches on `event.source`: trip/project/routine →
standard fields + 12-col placeholders; trade → trade fields.

---

## 1. THE CLICK TODAY — why it's dead

### 1a. HubCalendar's handler ignores everything except live projects
`handleEventClick` (`HubCalendar.tsx:168-175`):
```js
const handleEventClick = (event: GridEvent) => {
  if (event.source !== 'project') return;          // :169 — trip/routine/trade: dead
  for (const item of operationsItems) {            // :170 — empty [] in demo mode
    const block = item.calendar_blocks.find((b) => b.id === event.id);
    if (block) { setCardSelection({ item, block }); return; }
  }
  console.warn('[Hub] Could not locate item+block for event id:', event.id); // :174
};
```
Two dead paths:
- **Non-project events** (trip, routines, trade) hit the `source !== 'project'`
  early-return (`:169`) → nothing happens.
- **Project events in demo mode** loop over `operationsItems`, which is **empty**:
  the demo path early-returns before fetching (`HubCalendar.tsx:133-136`
  `if (demoEvents) return;`), so `operationsItems` stays `[]` (`:84`). The loop
  finds nothing → `console.warn` (`:174`) → nothing opens.

**Net: in the logged-out demo, EVERY click is dead.** (Logged-in, only a real
project block opens `HubEventCard`.)

### 1b. CalendarGrid → handler wiring (and the href trap)
- Tiles call `handleTileClick(event, …)` on click — month tile `CalendarGrid.tsx:442`,
  day timed block `:515`.
- `handleTileClick` (`:179-185`): **if `event.href` is set it `router.push(href)`
  and RETURNS — `onEventClick` never fires** (`:180-184`); otherwise it calls
  `onEventClick?.(event)` (`:184`), which HubCalendar passes as `handleEventClick`
  (`HubCalendar.tsx:209`).
- **Consequence for routines:** the live routines mapper sets
  `href: '/operations/routines'` (`mapOperationsRoutines.ts:102,119`), so a **live**
  routine click NAVIGATES away instead of opening a panel. **Demo routines carry NO
  href** (`demoCalendar.ts:49-80`), so they DO reach `onEventClick`. → The demo path
  is clean for a panel; only live routines would need href handling later (out of
  scope; don't change live behavior).

---

## 2. WHAT EACH EVENT TYPE CARRIES

### 2a. The `CalendarEvent` (GridEvent) shape — every field
`CalendarGrid.tsx:11-31`: `id`, `source`, `title`, `icon?`, `startDate` (YYYY-MM-DD),
`endDate?`, `startTime?`/`endTime?` (HH:MM), `isRecurring?`, `location?`,
`budgetAmount?`, `details?: string[]`, `href?`. The panel can only show these — no
invented fields.

### 2b. Populated fields per source (demo + live)

| Source | Demo seed populates | Live mapper populates |
|---|---|---|
| **trip** | id, title, icon, `startDate`, `endDate`, `location`, `budgetAmount` (`demoCalendar.ts:30-41`) | id, title, icon, startDate, endDate, isRecurring, location, budgetAmount (`HubCalendar.tsx:146-158`, from `/api/calendar`). No startTime/details. |
| **project** | id, title, icon, `startDate`, `startTime`, `endTime`, `details[]` (`demoCalendar.ts:83-104`) | id (block.id), title, startDate, endDate, startTime, endTime, `budgetAmount` (cost), `details` `["<coa> · $<cost>"]` (`mapOperationsBlocks.ts:66-76`). No icon/href. |
| **routines** | id, title, icon, `startDate`, `startTime`, `endTime`, `isRecurring` (`demoCalendar.ts:49-80`) | id, title, startDate, startTime/endTime (or all-day), `isRecurring:true`, **`href`** (`mapOperationsRoutines.ts:94-120`). No budget/details. |
| **trade** | id, title, icon, `startDate`, (one has `startTime`), `details[]` (`demoCalendar.ts:108-134`) | **none yet** — trade is demo-only; real wiring later. |

So the panel shows: trips → dates + location + budget; projects → times + details
(+ cost when live); routines → times + recurring badge; trade → date + the details
line(s). Only render fields that are present (mirror HubEventCard's "no empty rows"
rule, `HubEventCard.tsx:19`).

---

## 3. TRADE IS DIFFERENT — the divergence the panel must branch on

- **Demo trade events today** carry only generic calendar fields: `title`
  ("MSFT Iron Condor" / "Scanner: NVDA signal" / "AAPL covered call expiry"),
  `startDate`, an optional `startTime`, and a free-text `details[]` line
  ("Options · opened", "Watchlist · high IV", "Options · expires")
  (`demoCalendar.ts:108-134`). There is **no** project/routine/COA/budget — by design
  (PR-HCR-TRADE: "Trade has NO project/routine/COA — its meaningful fields differ").
- **Two different field sets the panel must switch between:**
  - **trip / project / routine** → the bookkeeping-shaped set: Entity, Cadence,
    Category (COA), Project-or-Routine, Task/Step, Billable, Budget $, Actual $
    (the `hub_scheduled_items` 12 columns, §4).
  - **trade** → a markets-shaped set: **Position** (symbol + strategy, e.g. "MSFT
    Iron Condor"), **Signal** (scanner/watchlist source), **P&L** (realized /
    unrealized $), **Expiry** (option expiration), and likely strike / IV / quantity.
    These map to the trading domain, **not** `hub_scheduled_items`.
- So `EventDetailPanel` should be: `if (event.source === 'trade') renderTradeBody()
  else renderScheduledBody()`. Trade's fields will be sourced from the trading
  models later; for now it shows the demo `title`/`details` + labeled placeholders
  for Position/Signal/P&L/Expiry.

---

## 4. THE 12-COLUMN SCAFFOLD (non-trade placeholder layout)

`hub_scheduled_items` now exists (PR-HCR2, merged — `prisma/schema.prisma:2949-2980`).
The non-trade panel body should lay out these as labeled rows (most empty/placeholder
until the feed PR authors them):

| Calendar column | `hub_scheduled_items` column | Shown now from the event? |
|---|---|---|
| Start Date + Time | `starts_at` | yes — `startDate` + `startTime` |
| End Date + Time | `ends_at` | trip: `endDate`; project: `endTime` |
| Cadence | `cadence` | routine: infer from `isRecurring`; else placeholder |
| Category (COA) | `coa_code` | project (live): inside `details[0]`; else placeholder |
| Project-or-Routine | `project_id` / `routine_id` | `source` tells which; name = `title` |
| Description (task/step) | `task_id` / `routine_step_id` + `description` | placeholder (not in GridEvent) |
| Entity | `entity_id` | placeholder (not in GridEvent) |
| Billable | `is_billable` | placeholder |
| Budget $ | `budget_usd` | `budgetAmount` (trip + live project) |
| Actual $ | `actual_usd` | placeholder |

The panel is the **scaffold**: real fields render now; the not-yet-wired columns show
as labeled "—" / "Not set yet" rows so the layout is ready for the feed PR (HCR3+).

---

## 5. THE PLAN — smallest PR

**New `src/components/hub/EventDetailPanel.tsx`** (mirror `HubEventCard`'s chrome —
right-side slide-in `max-w-lg`, `bg-black/30` backdrop, click-outside + Escape +
`×` close, brand-purple header; `HubEventCard.tsx:5-21`):
- Props: `{ event: GridEvent; onClose: () => void }` (+ optional `onRequireAuth` if a
  "log in to edit" CTA is wanted). **No data props beyond the event** — it renders
  `event.*` directly.
- Header: `event.icon` + `event.title` + a source chip (reuse `HUB_GRID_CONFIG`
  label/color, `HubCalendar.tsx:52-61`).
- Body: `event.source === 'trade'` → trade fields (§3); else the 12-col scaffold (§4).
- "Only render rows that have data" for the live fields; show labeled placeholders
  for the unwired 12 columns.

**Edit `src/components/hub/HubCalendar.tsx`** (open/close + mount):
- Add `const [detailEvent, setDetailEvent] = useState<GridEvent | null>(null);`.
- In `handleEventClick` (`:168`): route the click to the panel. Smallest correct
  form — **open the panel for any clicked event**: `setDetailEvent(event)` (keep the
  existing live-project `HubEventCard` path if desired, or let the new panel supersede
  it; for the demo, `operationsItems` is empty so the new panel is the only thing that
  can open). Recommended: in demo mode always `setDetailEvent(event)`; live mode keep
  `HubEventCard` for project and `setDetailEvent` for trip/trade.
- Mount near the existing card (`HubCalendar.tsx:213` area / after the grid):
  `{detailEvent && <EventDetailPanel event={detailEvent} onClose={() => setDetailEvent(null)} />}`.
- Open = a tile click (already wired through `onEventClick` → `handleEventClick`,
  `:209`); close = `onClose` / Escape / backdrop (mirrors HubEventCard).

**Where it mounts / opens / closes:** inside HubCalendar's returned tree
(`:184-216`), as a sibling of the grid and the existing `{cardSelection && …}`
mount (`HubCalendar.tsx:213+`). State-driven, same as `cardSelection`.

### Zero-fetch confirmation (no leak regression)
- The clicked `GridEvent` **already carries all its data** (the demo seed is a static
  literal — `demoCalendar.ts`; live events are already-fetched). The panel renders
  `event.*` and fetches **nothing**.
- The logged-out demo path never mounts the fetch effect (`HubCalendar.tsx:133-136`),
  and the panel adds no fetch — so the demo stays **zero personal-route calls**. No
  regression to the CALENDAR-LEAK fix. (Confirmed: `EventDetailPanel` would take only
  `event` + `onClose`, no route calls.)

---

## REPORT SUMMARY

- **Why dead:** `handleEventClick` returns for all non-project sources
  (`HubCalendar.tsx:169`) and finds nothing for projects in demo (empty
  `operationsItems`, `:170`); separately, live routines navigate via `href`
  (`CalendarGrid.tsx:180-182` + `mapOperationsRoutines.ts:102`).
- **Make it open:** add `detailEvent` state + a type-aware `EventDetailPanel`,
  route demo clicks to it via the already-wired `onEventClick`.
- **Type-aware:** branch on `event.source` — trade (Position/Signal/P&L/Expiry) vs
  trip/project/routine (the 12-column `hub_scheduled_items` scaffold).
- **Real fields now + placeholders:** show what the `GridEvent` carries (§2b);
  label the unwired 12 columns as placeholders (§4).
- **Zero-fetch:** the panel renders the clicked event object only — demo stays
  leak-free.

---

## Citations index
- Dead handler: `src/components/hub/HubCalendar.tsx:168-175`; empty demo items
  `:84`, `:133-136`; onEventClick wiring `:209`.
- Click dispatch + href trap: `src/components/shared/CalendarGrid.tsx:179-185`,
  tiles `:442`, `:515`; onEventClick prop `:49`.
- GridEvent shape: `src/components/shared/CalendarGrid.tsx:11-31`.
- Demo fields: `src/components/hub/showroom/demoCalendar.ts:30-41` (trip),
  `:49-80` (routines), `:83-104` (project), `:108-134` (trade).
- Live mappers: `src/lib/hub/mapOperationsBlocks.ts:66-76` (project),
  `src/lib/hub/mapOperationsRoutines.ts:94-120` (routines, incl. href).
- Existing card pattern to mirror: `src/components/hub/HubEventCard.tsx:1-39`.
- 12-column scaffold: `prisma/schema.prisma:2949-2980` (hub_scheduled_items).
