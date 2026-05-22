# PR-OPS-CAL-1 — Phase 1 Audit: CalendarGrid layout + responsive behavior (read-only)

**Context.** Design pass on the Hub calendar. On mobile it's unreadable — 7
columns crammed onto a phone, titles truncated to "W…"/"Br…", time ranges
wrapping to ~4 lines. Prior audits read the calendar as a *data* surface
(block→event mapping); none examined LAYOUT/RESPONSIVE. This maps that. No edits.
Audit branch off `main`. All citations: `src/components/shared/CalendarGrid.tsx`
unless noted.

---

## 1. Column / grid structure

**Week view is flexbox, not CSS grid; "7" is hardcoded via a 7-iteration loop.**

- `weekDays` is built with a fixed loop — `for (let i = 0; i < 7; i++) { … weekDays.push(d) }` (**239-240**). There is **no prop** for day count; every render path maps over this 7-element array.
- The week **header** row is `flex` (**332**): a `w-14 flex-shrink-0` time-gutter spacer (**333**) + `weekDays.map(...)` cells each `flex-1` (**338**).
- The week **time grid** is `flex relative` (**384**): the `w-14` gutter (**386**) + `weekDays.map(...)` day columns each `className="flex-1 relative border-l …"` (**405**).
- So the 7 day columns are `flex-1` siblings splitting the width left after the 56px (`w-14`) gutter — equal fractions, no `min-width`.
- **Month view** (488-562) is a true CSS grid: `grid grid-cols-7` (**491**, **494**), also hardcoded 7.

**View modes:** `calendarView: 'week' | 'month'` (**169**), toggled by the Week/Month buttons (**275-276**). Month is a genuinely different layout (per-day mini-cells `min-h-[90px]` with dots/detail lines, 527-558) — not just a reflow. **There is NO single-day or variable-day view** anywhere; both modes are fixed 7-wide.

---

## 2. Responsive / mobile handling — NONE

- **Grep for `sm:`/`md:`/`lg:`/`xl:` in CalendarGrid.tsx returns ZERO matches.** There are no media queries, no breakpoints, no responsive prefixes in the component at all.
- Its Hub container is a bare `<div className="mb-6">` (`page.tsx:421`) — no responsive constraint either. The only responsive thing on the page is the page-level padding/`max-w-[1400px]` (`page.tsx:398`), which doesn't help the calendar internally.
- **Column width mechanism = `flex-1` × 7 (line 405).** Each column = `(containerWidth − 56px gutter) / 7`. On a ~375px phone that's `(375 − 56)/7 ≈ 45px` per column; blocks are `absolute left-0.5 right-0.5` (**441**) inside that, leaving **~41px usable** — this is exactly why blocks crush. No `min-width` and no mobile fallback means the columns shrink unbounded.

---

## 3. Block rendering — why text truncates / wraps

The timed-event block is **lines 429-464** (the prior audit's "433-441" was just the color pick; the full block spans 437-464).

- **Padding:** `px-1.5 py-1` (**445**) = 6px × 4px — very tight.
- **Title:** `text-[11px] font-semibold leading-tight truncate` (**446**) — single-line **ellipsis truncate**. At ~41px a 11px title fits ~5-6 chars → "Workout"→"W…", "Breakfast"→"Br…". That's the title truncation.
- **Time range (the 4-line wrap bug):** **447-452** renders `formatTime12h(start) — formatTime12h(end)` (e.g. `9:00 AM — 10:00 AM`, ~18 chars) in a `text-[10px] … leading-tight` div with **NO `truncate`**. With no truncation and ~41px width, that string **wraps to multiple lines** — the 4-line stack in the screenshot. (Location 453-455 and details 456-458 *do* have `truncate`; the time line is the one that doesn't.)
- **Height ↔ duration:** `top = (startMin/60) * HOUR_HEIGHT` (**430**); `height = max(((endMin−startMin)/60) * HOUR_HEIGHT, MIN_EVENT_HEIGHT)` (**431**), with `HOUR_HEIGHT = 40` (**61**) and `MIN_EVENT_HEIGHT = 60` (**65**). So a 1-hour event is 40px of duration but floored to a 60px block.

**Recurrence renders as N separate full blocks.** `CalendarEvent` has an `isRecurring?: boolean` field (**19**), but **CalendarGrid never reads it** in render — it's dead in this component. Recurring routines (Sleep/Morning/Workout/Breakfast) are expanded **upstream** into one `CalendarEvent` per occurrence (per day) by `mapOperationsRoutines` (one event per (routine, occurrence) pair, per Hub-1), and each lands in `eventsByDateKey` (200-216) as an independent event. So each day's instance is a **separate block with the full repeated title + time** — hence the same text 7×. There is no de-duplication and no glyph today; `isRecurring` is available but unused, so a recurrence glyph has a natural hook.

---

## 4. Time axis + scroll

- **Axis:** `hours = [0..23]` (**246**), each row `HOUR_HEIGHT = 40px` (**61**). Hour grid lines (**407-409**) + half-hour lines (**410-412**) are absolutely positioned by `top = (hour−START_HOUR)*HOUR_HEIGHT`. Gutter labels "12 AM…11 PM" in the `w-14` column (**386-394**). Full grid height = `TOTAL_HOURS * HOUR_HEIGHT = 24 × 40 = 960px` (**384**).
- **Scroll container:** the time grid is wrapped in `<div ref={scrollRef} className="overflow-y-auto" style={{ maxHeight: '600px' }}>` (**383**) — a **fixed 600px** viewport over 960px of content.
- **Scroll start:** the effect at **249-263** runs on week view / week change: it finds the earliest timed event and sets `scrollTop = max(0, ((earliest/60) − 1) * HOUR_HEIGHT)`, else defaults to `7 * HOUR_HEIGHT = 280px` (7 AM). That's why it "opens mid-morning."

---

## 5. Shared vs Hub-only — SHARED (broad blast radius)

CalendarGrid is imported as a **component by 4 surfaces**:
- `src/app/hub/page.tsx:10/422` — the Hub.
- `src/app/trading/page.tsx:6/974` — Trading P&L calendar (uses `showBudgetTotals` for daily P&L).
- `src/app/budgets/trips/page.tsx:7/314` — Trips list.
- `src/app/budgets/trips/[id]/page.tsx:11/756` — Trip detail itinerary (uses `anchorDate`/`highlightStart`/`highlightEnd`; the "Trip Local / Home (PST)" tz `<select>` at 280-288 is trip-oriented).

(`HubEventCard.tsx` only *mentions* CalendarGrid in a comment — not an importer.)

**Implication:** any layout/responsive change to CalendarGrid hits Trading and both Trips pages too. A redesign should be **prop-gated** (opt-in) so the Hub can adopt it while Trading/Trips stay byte-identical until each is validated.

---

## RECOMMENDATION — cleanest path to (a) single-day mobile, (b) readable blocks, (c) calm layout

Sequenced easy→structural, with blast-radius notes.

### EASY (low-risk; mostly className/const; high impact)
1. **Fix the time-line wrap — one class.** Add `truncate` to the time-range div (**448**). This alone kills the 4-line stack. (Lowest-effort, highest-visible win.)
2. **Roomier blocks.** Bump block padding (`px-1.5 py-1` → e.g. `px-2 py-1.5`, **445**) and consider hiding the time line on short blocks (height < ~50px) so a 30-min event shows just a truncated title. Pure presentation.
3. **Recurrence glyph.** `isRecurring` is already on the event (**19**) but unused — render a small ↻ before/instead of the repeated time line when `isRecurring` is true (and the title is identical day-to-day). No data change needed for the glyph; true cross-day de-dup is a larger design choice (see structural).

### STRUCTURAL (logic change; shared blast radius — prop-gate it)
4. **Single-day view on narrow widths (the core fix).** The week render already maps over `weekDays`; the structural work is making that array variable:
   - Add a width signal — a `matchMedia('(max-width: 640px)')` hook (or a `view: 'day'` option) — and on narrow screens render `weekDays` sliced to the **selected single day** (1 column, full width → titles/times fit, columns ~300px instead of ~45px).
   - Add day-level prev/next nav (reuse the existing nav button pattern, 295-300) and adjust the sticky header (332-344) + gutter to the 1-column case.
   - Everything else (per-day block positioning, the scroll effect, blocks code 429-464) is already per-day and reused unchanged. Medium effort, contained.
   - **Gate behind a prop** (e.g. `responsive` / `collapseToDayOnMobile`) defaulting off, so Trading/Trips are unaffected until opted in.
5. **Calmer / higher-whitespace.** `HOUR_HEIGHT = 40` (**61**) is dense and the full 24-hour axis is mostly empty; raising row height, lightening the hour/half-hour lines (408/411), and/or defaulting the scroll to working hours would read calmer. These are constants/classes but change **all 4 importers' vertical rhythm** — do it prop-gated or validate Trading/Trips explicitly. The fixed `maxHeight: 600px` (**383**) could also become a prop for the calmer Hub layout.

**Suggested sequencing for the build PRs:** (1) the truncate/padding/glyph quick wins (Hub-visible immediately, near-zero risk, safe for all surfaces) → (2) the prop-gated single-day responsive mode adopted by the Hub only → (3) the whitespace/row-height pass once the responsive frame is in place. Each step is independently eyeball-able and the shared surfaces stay frozen until explicitly opted in.

No edits. Read-only audit only.
