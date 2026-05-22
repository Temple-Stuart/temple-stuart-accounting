# PR-Ops-Cal-4 followup — gate the responsive hook via a child component

**Goal:** make the mobile auto-default truly no-op for non-opting callers
(Trading + both Trips). Previously `useMediaQuery` was called unconditionally in
`CalendarGrid` (Rules of Hooks), so every caller subscribed a `matchMedia`
listener and got extra re-renders even though render output was identical. After
this change the prop-off path runs **zero** new code.

## Change

### New behavior-only child — `src/components/shared/ResponsiveViewController.tsx`
- Calls `useMediaQuery('(max-width: 767px)')` **internally** (`:26`).
- Runs the auto-default + respect-manual-choice effect **internally**
  (`:27-30`): `if (userPickedView) return; setCalendarView(isMobile ? 'day' : defaultView);`
- Renders `null` (`:32`) — no DOM.
- Props (`:7-11`): `userPickedView`, `defaultView`, `setCalendarView`.

### `src/components/shared/CalendarGrid.tsx`
- Removed the `useMediaQuery` import; replaced with
  `import ResponsiveViewController from './ResponsiveViewController';` (`:5`).
- Removed the unconditional `const isMobile = useMediaQuery(...)` and the
  auto-default `useEffect` (formerly `:276-280`).
- Mount the controller **only when gated** (`:303-309`):
  ```tsx
  {enableDayView && (
    <ResponsiveViewController
      userPickedView={userPickedView}
      defaultView={defaultView}
      setCalendarView={setCalendarView}
    />
  )}
  ```

## Where shared state lives — PARENT

`calendarView`/`setCalendarView` (`CalendarGrid.tsx:178`) and
`userPickedView`/`setUserPickedView` (`:189`) stay in **CalendarGrid**, because
the view buttons (`selectView`, `:254`, wired at `:312/:314/:315`) and the
controller must share them. Only the **hook** and the **effect** moved into the
child; the effect reads `userPickedView`/`defaultView` and writes
`setCalendarView` — all passed down as props. The child does **not** own any
view state. (The original effect never read `calendarView`, only wrote it, so no
read-state needed crossing down.)

## Proof: non-opting path is a true no-op

For a caller that does not pass `enableDayView` (defaults `false`,
`CalendarGrid.tsx:157`):

1. **No controller mounts** — the JSX is behind `{enableDayView && (...)}`
   (`:303`). With the prop false, React never creates the element.
2. **No hook runs** — `useMediaQuery` is now called *only* inside
   `ResponsiveViewController` (`:26`). No mount → the component function never
   executes → the hook never runs.
3. **No listener subscribed** — the `matchMedia('change')` `addEventListener`
   lives in `useMediaQuery.ts:23`, reachable only via that hook. No hook → no
   subscription.
4. **Zero extra re-renders** — the only `setMatches` state update
   (`useMediaQuery.ts:21-22`) lives in the unmounted hook, so nothing triggers
   the extra `CalendarGrid` re-renders that previously fired on mount and on each
   768px crossing.

`CalendarGrid` itself no longer references `useMediaQuery`/`isMobile` (grep:
"no stale refs in CalendarGrid"). Existing callers — Trading
(`trading/page.tsx:977` `defaultView="month"`), Trips list
(`budgets/trips/page.tsx:317` `"month"`), Trip detail
(`budgets/trips/[id]/page.tsx:759` `"week"`) — pass no `enableDayView`, so they
are now **truly byte-identical** to pre-Cal-4: same render tree, no new effect,
no listener, no re-render.

## Hub behavior unchanged (re-walk)

Hub passes `enableDayView={true}` (`hub/page.tsx:426`), so the controller mounts.

- **Auto-Day <768px:** initial load `userPickedView=false`; controller's
  `useMediaQuery` resolves `isMobile=true` → effect (`ResponsiveViewController.tsx:27-30`)
  runs → `setCalendarView('day')`.
- **Week/Month tappable:** buttons unchanged in the parent (`:312-315`), each via
  `selectView` (`:254`).
- **Respect-manual-choice latch (VERIFY-3 re-walk):**
  1. Load <768 → auto-Day (above).
  2. User taps "Week" → `selectView('week')` (`:254`) → `setCalendarView('week')`
     **and** `setUserPickedView(true)`.
  3. Resize/rotate → `matchMedia` `onChange` (`useMediaQuery.ts:22`) → `setMatches`
     → `isMobile` changes → controller effect re-runs (dep `isMobile`,
     `ResponsiveViewController.tsx:30`).
  4. Guard `if (userPickedView) return;` (`:28`) — now `true` → early-return
     before `setCalendarView`. View stays on the user's choice.
  - One-way latch: nothing resets `userPickedView` to `false`.

  (The pre-followup guard was `if (!enableDayView || userPickedView) return;`. The
  `!enableDayView` term is now redundant because the controller only mounts when
  `enableDayView` is true, so it was dropped — behavior identical.)

## Verification

- `npx tsc --noEmit` → **exit 0**.
- `npm run lint` (touched files) → **0 errors**; 2 pre-existing warnings in
  `CalendarGrid.tsx` (`compact` unused `:156`; auto-scroll effect-deps `:290`,
  same pattern as the original week effect). `ResponsiveViewController.tsx` and
  `useMediaQuery.ts` clean.
