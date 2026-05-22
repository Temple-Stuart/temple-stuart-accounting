# PR-OPS-CAL-3 — Phase 1 Audit: calendar view-state + nav control flow (read-only)

**Context.** Step B adds a **Day** view to `CalendarGrid` (week/month today) and
auto-defaults to it on narrow widths, Apple-style (Day readable on phones;
Week/Month still tappable). CalendarGrid is **shared by 4 surfaces** (Hub,
Trading, both Trips — CAL-1), so this must be **prop-gated, Hub-first**. CAL-1
mapped layout; this maps STATE + CONTROL FLOW. No edits. Audit branch off `main`;
CAL-2 (Step A) confirmed on main (time-line `truncate` at `:448`, `↻` badge at
`:468-474`). Path is `src/components/shared/CalendarGrid.tsx` (the brief's
`src/components/CalendarGrid.tsx` is the pre-`shared/` path); all citations are
the `shared/` file.

---

## 1. View state — internal `useState`, seeded by `defaultView`

- `const [calendarView, setCalendarView] = useState<'week' | 'month'>(defaultView)`
  (**:169**). **View is internal state**, not a controlled prop — the only
  external influence is `defaultView` (`CalendarGridProps.defaultView?: 'week' |
  'month'`, **:44**; default `'week'`, **:141**), which merely **seeds** the
  initial state. → Adding `'day'` is an **internal change**: widen the state
  union and the `defaultView` type to include `'day'`. **No parent contract
  change is required.**
- **Toggle wiring** (**:275-276**): two buttons —
  `onClick={() => setCalendarView('week')}` and `… setCalendarView('month')` —
  each just `setCalendarView(...)` with active-state styling keyed on
  `calendarView === 'week'|'month'`. **A third "Day" button slots in beside
  them** with `onClick={() => setCalendarView('day')}`, gated behind the new prop
  (see §5).
- **Importer prop lists** (none controls view externally — `defaultView` only):
  - **Hub** (`page.tsx:422-429`): `events, sourceConfig, defaultView="week",
    showBudgetTotals, showCategoryLegend, onEventClick`.
  - **Trading** (`trading/page.tsx:974-981`): `events, sourceConfig,
    defaultView="month", showBudgetTotals, showCategoryLegend, compact`.
  - **Trips list** (`budgets/trips/page.tsx:314-320`): `events, sourceConfig,
    defaultView="month", showCategoryLegend, showBudgetTotals`.
  - **Trip detail** (`budgets/trips/[id]/page.tsx:756-766`): `events,
    sourceConfig, defaultView="week", anchorDate, highlightStart, highlightEnd,
    onEventClick, showBudgetTotals, showCategoryLegend, compact`.
  None passes a `view`/`calendarView` prop. A new optional prop (default off)
  **cannot collide** with any existing caller.

---

## 2. Navigation date math — branches on view, but only week vs. month (no day)

The handlers (**:224-232**):
```ts
const prevMonth = () => { if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear(y=>y-1);} else setSelectedMonth(m=>m-1); };   // :224
const nextMonth = () => { … month ±1 with year rollover … };                                                                            // :225
const prevWeek  = () => { const ns = new Date(selectedWeekStart); ns.setDate(ns.getDate() - 7); setSelectedWeekStart(ns); …month/year sync… };  // :226
const nextWeek  = () => { … setDate(getDate() + 7) … };                                                                                  // :227
const goToToday = () => { const t = anchorDate ? parseDate(anchorDate) : new Date(); setSelectedYear(...); setSelectedMonth(...); const s=new Date(t); s.setDate(t.getDate()-t.getDay()); setSelectedWeekStart(s); }; // :228-232
```
The arrow buttons branch on view:
`onClick={calendarView === 'week' ? prevWeek : prevMonth}` (**:295**) and the
next-arrow equivalent (**:298**). **So the ‹ › already branch on view — but only
two-way (week-stepping vs. month-stepping); there is NO day branch.** Week nav
steps **±7 days** via `setDate(getDate() ± 7)` on `selectedWeekStart`.

→ The build **must add view-aware day branching**: new `prevDay`/`nextDay` that
step the active day **±1**, and extend the ternaries to
`calendarView === 'day' ? prevDay : calendarView === 'week' ? prevWeek : prevMonth`.
`goToToday` must also reset the day anchor (today) when in day view. **Not
already day-aware → small additive branching, clean because the two-way ternary
pattern already exists.**

---

## 3. The `weekDays` array — the single-day seam

- **Built** (**:239-240**): `for (let i=0;i<7;i++){ const d=new Date(selectedWeekStart); d.setDate(selectedWeekStart.getDate()+i); weekDays.push(d); }` — 7 days anchored on `selectedWeekStart` (the Sunday of the anchor week, set at :172-176 and by week nav / `goToToday`).
- **Consumed by** (all via `.map`, no `% 7`, no width math hardcoding 7):
  - `headerTitle` reads `weekDays[0]` (**:242-244**) for the month/year label.
  - Week **header** row `weekDays.map((day, idx) => …)` (**:334-343**).
  - **All-day** row `weekDays.map(...)` (**:348**, **:359**).
  - **Auto-scroll** effect `weekDays.flatMap(d => getEventsForDate(d))` (**:251**).
  - **Day columns** `weekDays.map((day, dayIdx) => …)` (**:397**), each `flex-1` (**:405**).
  - **Budget totals** row `weekDays.map(...)` (**:476**).
- **Nothing assumes exactly 7** — every consumer maps the array length, columns are `flex-1` (so 1 column → full width automatically), and the only index access is `weekDays[0]` (valid for a length-1 array). The `w-14` gutter is fixed and independent of day count.

**Recommended seam:** introduce a derived **`displayDays`** array —
`const displayDays = calendarView === 'day' ? [selectedDay] : weekDays` — and
repoint the five week-view consumers (header, all-day, scroll effect, columns,
totals) from `weekDays` to `displayDays`. Add a **`selectedDay` state** (Date,
default = anchor/today) that `prevDay`/`nextDay`/`goToToday` drive. This is
cleaner than mutating `weekDays` (which carries week-nav semantics). A length-1
`displayDays` renders one full-width `flex-1` column with zero changes to the
per-day block code (the readable CAL-2 blocks are reused verbatim). `headerTitle`
needs a day-view branch (e.g. `Tue, May 26, 2026`).

---

## 4. Responsive detection — net-new (no reusable hook exists)

CAL-1's "zero responsive handling" holds for the calendar. App-wide,
`window.innerWidth`/resize appears in 5 files but **all are one-off**: popover
alignment (`SpendingTab.tsx:498/552`, `JournalEntryEngine.tsx:275/305`,
`CommittedInvestmentsTable.tsx:267/296`, `trips/[id]/page.tsx:172/176`) and
landscape/scroll detection in `ResponsiveTable.tsx:32/40-41`. **There is NO
`useMediaQuery`/`useIsMobile` hook and no `src/hooks` directory** — `matchMedia`
is used nowhere.

→ This build introduces the **first reusable responsive hook**. Recommend a
small `useMediaQuery(query: string): boolean` (or `useIsNarrow(maxPx)`) in a new
`src/hooks/` dir, built on `window.matchMedia` with an SSR-safe initial value and
a `change` listener — so later surfaces share one implementation rather than
re-inlining `innerWidth`.

---

## 5. Prop-gating — guaranteed no-op for Trading/Trips

**Recommended contract:** one optional prop, `enableDayView?: boolean` (default
`false`). Hub passes `enableDayView`; the other three pass nothing.

When `enableDayView` is **false** (all current callers), the following are all
gated off, making the path a **true no-op**:
- the **Day toggle button** is not rendered (gated render),
- the **responsive auto-switch effect** does not run (early-return on
  `!enableDayView`),
- `calendarView` can never become `'day'` because (a) the only setter to `'day'`
  is the gated button + gated effect, and (b) existing callers seed
  `defaultView` with only `'week'`/`'month'`.

So with the flag off, `displayDays === weekDays` always, the nav ternary never
hits the day branch, and the render is **byte-identical** to today for Trading
and both Trips. Widening the `defaultView`/state union to include `'day'` is
type-only and doesn't change behavior for callers that never supply or set it.
**Guarantee:** every new code path is reached only when `enableDayView === true`
or `calendarView === 'day'`, neither of which occurs for the un-opted callers.

(Alternative name `responsive` is fine; `enableDayView` is more precise since the
prop enables both the manual Day button and the auto-default.)

---

## RECOMMENDED BUILD PLAN (easy vs. structural)

1. **View union + Day button** — *easy.* Widen `calendarView` state and
   `defaultView` prop to `'week' | 'month' | 'day'` (:44, :169); add a third
   toggle button (:275-276) `setCalendarView('day')`, **rendered only when
   `enableDayView`**.
2. **Day-stepping nav** — *easy/medium.* Add `prevDay`/`nextDay` (`selectedDay ±
   1` day); extend the arrow ternaries (:295/:298) and `goToToday` (:228-232) to
   the three-way `day ? … : week ? … : month`. Add the `selectedDay` state.
3. **Single-day render** — *medium.* Add `displayDays = calendarView==='day' ?
   [selectedDay] : weekDays`; repoint the 5 week consumers (header :334, all-day
   :348/:359, scroll :251, columns :397, totals :476) to `displayDays`; add a
   day-view `headerTitle` branch. Mechanical; verify (done here) no consumer
   assumes 7.
4. **Responsive auto-default + respect-manual-choice** — *medium/structural
   (net-new).* Add `useMediaQuery` hook (`src/hooks/`). In an effect gated by
   `enableDayView`: if narrow and the user hasn't manually chosen a view, set
   `calendarView='day'`. **Respect-manual rule:** track a `userPickedView` flag
   set `true` inside every toggle `onClick`; the auto effect only switches when
   `!userPickedView`, so once the user taps Week/Month/Day it is never re-forced
   on resize/rotate.
5. **Breakpoint value** — *trivial decision for Alex.* Recommend
   `max-width: 768px` (Tailwind `md`, covers phones + small tablets, Apple-ish)
   as the day-default cutoff; `640px` (`sm`) is the narrower alternative. Flag
   for Alex to lock.

**Blast-radius guarantee:** items 1, 2, 4 are gated by `enableDayView`; item 3's
`displayDays` collapses to `weekDays` when not in day view. With the flag off
(Trading + both Trips), behavior is unchanged. Build Hub-first behind the flag,
eyeball the Hub, then later opt other surfaces in if desired.

No edits. Read-only audit only.
