# TRAVEL — PR-18 Audit: Itinerary Calendar → Compact Agenda/Stack

**Branch:** `claude/travel-pr-18-audit`
**Date:** 2026-05-30
**Mode:** READ-ONLY. Audit before action. No code changed.
**Goal:** Replace the hourly time-GRID in the Itinerary panel with a compact
chronological AGENDA STACK (one row per accounted-for item; multi-span items
collapse to a single row). Day/Week/Month = grouping granularity, not grid
density. Renderer must be **type-general** (render by source discriminator),
not flight-hardcoded.

---

## 1. Calendar anatomy (CITED)

**Itinerary panel** — `src/app/budgets/trips/[id]/page.tsx:702-728`:
- Purple header "Itinerary" at `:704-706`.
- Renders `<CalendarGrid …/>` at **`:709-720`** with `defaultView="week"`,
  `showBudgetTotals`, `showCategoryLegend`, `compact`.

**Component** — `src/components/shared/CalendarGrid.tsx` (the actual
grid/toggle/blocks). **⚠️ This is a SHARED component** — also consumed by
`src/app/hub/page.tsx`, `src/app/trading/page.tsx`, and
`src/app/budgets/trips/page.tsx` (the trip list). Any edit to CalendarGrid
itself ripples to Hub + Trading. This dominates the scope decision (§7).

**Data array it maps over** — `calendarEvents`
(`page.tsx:425-547`), a `useMemo` that transforms `trip.itinerary` into
`CalendarEvent[]`.

**Item shape** — `CalendarEvent`, `CalendarGrid.tsx:11-31`:
```
id, source, title, icon?, startDate (YYYY-MM-DD), endDate?, startTime? (HH:MM 24h),
endTime?, isRecurring?, location?, budgetAmount?, details?[], href?
```

**The hourly grid that "eats a day column":**
- Hour constants — `CalendarGrid.tsx:77-81` (`HOUR_HEIGHT=40`, `START_HOUR=0`,
  `END_HOUR=24`, `MIN_EVENT_HEIGHT=60px`).
- Time gutter (`12 AM … 11 PM`) — `:461-469` (label string at `:465`).
- Day columns with hour grid-lines — `:471-487`.
- Positioned event blocks — `:504-554`; top/height computed from
  `startMin/endMin` at `:505-506`. A red-eye 00:00→10:05 yields
  `top=0, height≈10h` → a ~400px block filling the column. Most cells empty.
- Week/Day header — `:407-419`; Month grid — `:577-651`.

**Week/Month toggle** — `:346-352`; view state `calendarView`
(`'week'|'month'|'day'`) at `:187`. Trips passes neither `enableDayView` nor
`enableHubChrome`, so only **Week / Month** buttons show (`:350-351`); the Day
button (`:347-349`) is opt-in and off for Trips.

---

## 2. Flight-time fidelity (truth-first gate) — FINDING

**Full read chain for the "12:00 AM" departure:**

| Step | File:line | Code |
|---|---|---|
| Duffel offer → time | `src/lib/duffel.ts:180` | `localTime: firstSeg?.departing_at?.substring(11, 16) \|\| ''` |
| FlightPicker reads it | `FlightPicker.tsx:278` | `const departTime = offer.outbound?.departure?.localTime \|\| undefined` |
| Sent to commit | `FlightPicker.tsx:292` | `startTime: departTime` |
| Route parses body | `vendor-commit/route.ts:87` | `…startTime, endTime…= await request.json()` |
| Persisted | `vendor-commit/route.ts:183` | `homeTime: startTime \|\| null, destTime: endTime \|\| null` |
| Event transform | `page.tsx:462-463` | `startTime: item.homeTime \|\| null` |
| Rendered | `CalendarGrid.tsx:524` | `formatTime12h(block.event.startTime)` |

**Verdict — NOT a midnight-default bug in our code.** Every link defaults a
*missing* time to **empty/null**, never to `"00:00"`:
- `duffel.ts:180` → `|| ''` (empty string)
- `route.ts:183` / `page.tsx:462` → `|| null`
- And a **null `startTime` is skipped from the time grid entirely** —
  `getBlocksForDay` returns early at `CalendarGrid.tsx:125`
  (`if (!event.startTime) continue;`); such items fall into the **all-day row**
  (`:421-455`), which shows no clock time.

Therefore the visible **"12:00 AM" can only mean `homeTime === "00:00"`**, i.e.
Duffel's `departing_at` literally carried a `T00:00` time, faithfully sliced by
`substring(11,16)`. We do **not** fabricate it.

**🚩 FLAGGED (do NOT fix in PR-18 — dedicated PR):** the round `00:00`
departure paired with a precise `10:05 AM` arrival strongly suggests a **Duffel
TEST/sandbox offer placeholder time** being presented as a real departure. Our
extraction is honest, but the upstream value is suspect.
- **Read point to audit:** `src/lib/duffel.ts:180` (and `:186` for arrival).
- **Recommended dedicated-PR action:** detect a `T00:00:00` `departing_at` from
  Duffel test mode and treat it as "time unknown" (→ null → all-day) rather
  than rendering a real-looking "12:00 AM". Verify against a production offer
  first. **Not touched by PR-18.**

---

## 3. Item types + discriminator — renderer is ALREADY type-general

**Discriminator:** the `source` string on each `CalendarEvent` (plus a parallel
`_category`). Resolved in the transform:
- Flights → `source: 'flights'`, one event per entry (`page.tsx:452-475`).
- Lodging → `source` = `'lodging'`/`'accommodation'`, **multi-day collapsed to a
  single event** with `startDate`+`endDate` (`page.tsx:494-518`).
- Everything else → `resolveSource(item)` from `vendorOptions[].category`
  (`page.tsx:446-449`), grouped by `vendorOptionId` (`:519-543`).

**The CalendarGrid render is type-GENERAL, not flight-hardcoded.** It colors and
labels every event purely via `sourceConfig[event.source]`
(`CalendarGrid.tsx:439`, `:507-508`) — no `if (flight)` branches in the render.
So Stays/Activities items already render with zero renderer change; the agenda
stack inherits this. The only type-aware logic is in the **data transform**
(grouping rules), which is upstream of and reusable by the stack.

---

## 4. Day/Week/Month → agenda mapping

Current views: Month grid (`CalendarGrid.tsx:577-651`), Week/Day time-grid
(`:404-576`); the in-scope dates are `gridDays` (`:274`). The toggle changes
**grid scale** today. In an agenda stack it should change **grouping
granularity + date range**, not density:

| View | Date range in scope | Grouping headers | Rows |
|---|---|---|---|
| **Day** | the single `selectedDay` | none (flat list) | every item that touches that date, time-sorted |
| **Week** | the 7-day `weekDays` window | one header per day (e.g. "Wed Jul 2") | items under their day, time-sorted |
| **Month** | the visible month | one header per day **or** per ISO week (taste call) | items under their group, time-sorted |

Sort within a group: by `startTime` ascending, **null times last** (all-day /
no-time items at the bottom of the day, not pinned to midnight — this also
sidesteps the §2 placeholder issue visually).

---

## 5. Multi-span rendering

The data **already** carries the span: lodging events have `startDate` +
`endDate` (`page.tsx:507-508`). Today the grid splits multi-day events into
depart/arrive half-blocks (`CalendarGrid.tsx:136-144`) — noisy.

**Proposal:** one row with a span label computed from the dates, e.g.
`"Jul 2 → Jul 9 · 7 nights"` (`nights = endDate − startDate`). It appears once,
under its **start-day** group header (with a subtle "→ Jul 9" continuation
hint), instead of N cells or two half-blocks. No data-model change needed —
`endDate` is present.

---

## 6. Per-row design + palette (CITED)

**Per-row anatomy** (single flex row, ~chronological):
```
[ time / date badge ] · [ source color dot ] · [ title ] · [ location? ] · [ cost ]
```
- Time badge: `formatTime12h(startTime)` for timed items; span label (§5) for
  multi-day; "all day" for null-time items.
- Source color: **reuse the existing `sourceConfig` `dot`/`badge` classes** so
  the stack matches today's grid + legend exactly. Zero new tokens.
- Cost: `formatCurrency(budgetAmount)`.

**⚠️ Palette correction to the task's premise.** The calendar's source colors
come from `TRAVEL_COA` via `buildCalendarSourceConfig()`
(`src/lib/travelCOA.ts:358-382`) and are **raw Tailwind classes, NOT brand
tokens**:
- Flights = `bg-purple-400` (`travelCOA.ts:29`) — *purple ✓ (matches premise)*
- Accommodation = `bg-blue-400` (`:40`) — **blue, NOT gold ✗**
- Activities = `bg-violet-400` (`:95`); Adventure = `bg-green-500` (`:106`) —
  **violet/green, NOT aqua ✗**

The brand tokens the task names **do exist** — `brand-purple` (#3b2d6b),
`brand-gold` (`tailwind.config.ts:25`), `ts.aqua` (#14e0c8,
`tailwind.config.ts:60`) — but the calendar doesn't use them. So
"flights=purple / stays=gold / activities=aqua" would be a **recolor of
`TRAVEL_COA`**, a separate concern that also changes the existing grid + legend
+ Hub/Trading-shared semantics. **Recommendation:** PR-18 reuses the existing
`sourceConfig` colors (mechanical, consistent); a brand-token recolor is a
deliberate taste call to raise separately (§8).

**Cost-total footer:** today's in-view cost signal is CalendarGrid's per-day
`showBudgetTotals` row (`CalendarGrid.tsx:562-575`, enabled at `page.tsx:717`).
The stack should preserve a cost total — per-group subtotals and/or a single
footer total — using the same `formatCurrency`. (Note: that helper uses
`minimumFractionDigits:0`; the screenshot's `$495.49` with cents implies a
trip-level sum rendered elsewhere — preserve whichever total is shown today.)

---

## 7. Scope estimate

**The decisive constraint: CalendarGrid is shared (Hub/Trading/Trips).** Two
clean options:

| Option | What | Risk | Files |
|---|---|---|---|
| **A. Separate `ItineraryAgenda` component** (recommended) | New Trips-only component consuming the same `calendarEvents` + `TRIP_SOURCE_CONFIG`; swap it into the panel at `page.tsx:709-720`. | **Zero** risk to Hub/Trading — they keep CalendarGrid untouched. | 1 new component + ~1 edit in `page.tsx` |
| **B. Opt-in `renderMode="agenda"` inside CalendarGrid** | Follows the existing `enableDayView`/`enableHubChrome` opt-in precedent (`CalendarGrid.tsx:59,67`); gated off for other callers. | Low, but edits the shared file. | 1 file (CalendarGrid) + flag at call site |

**Recommend A** — the agenda is itinerary-specific and the data transform
already lives in `page.tsx`, so a focused component keeps the shared grid
pristine. The shared CalendarGrid stays available for the Week/Month grid if a
toggle to "grid vs stack" is ever wanted.

- **Line estimate:** ~120-200 lines (one component: group/sort + row +
  per-group header + cost footer; type-general via `sourceConfig`).
- **0 new dependencies.** **0 data-model change** (`endDate`/`startTime`
  already present). **0 route change.** `tsc --noEmit` + `eslint` clean.

---

## 8. TASTE CALLS vs MECHANICAL

**MECHANICAL (safe to ship):**
- Chronological sort (null-time last).
- Multi-span single row "Jul 2 → Jul 9 · 7 nights" (data already has `endDate`).
- Reuse existing `sourceConfig` dot/badge colors.
- Per-row anatomy (time · dot · title · location · cost).
- Preserve a cost total.
- Type-general row renderer (already the pattern).

**TASTE CALLS (confirm with user):**
- **Component A vs opt-in B** (§7) — I recommend A.
- **Brand-token recolor** (flights=purple / stays=gold / activities=aqua) vs
  keeping the existing raw-Tailwind `sourceConfig` colors (§6). A recolor
  touches `TRAVEL_COA` and the shared grid/legend — separate PR if wanted.
- **Month grouping cadence** — per-day headers vs per-week headers (§4).
- Whether the Week/Month/Day toggle should also offer a "grid vs stack" switch,
  or the stack fully replaces the grid in the Trips panel.

**TRUTH-GATE (separate PR, not PR-18):**
- The Duffel `T00:00` "12:00 AM" departure (§2) — `duffel.ts:180`. Flag only.

---

**READ-ONLY audit. No implementation performed.**
