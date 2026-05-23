# PR-Ops-Hub-Mobile-Header-1 — Followup: gate the toolbar's mobile detection

Closes the passive-listener regression: the Phase-2 build called
`useMediaQuery` **unconditionally** at CalendarGrid top level, so non-Hub callers
subscribed a `matchMedia` listener and re-rendered on 768px crossings despite
identical output. Now removed — unified onto the single Cal-4 mobile signal.

## Audit (current source, pre-fix)

- Non-Hub callers pass **neither** `enableDayView` nor `enableHubChrome`:
  - `src/app/trading/page.tsx:974`, `src/app/budgets/trips/page.tsx:314`,
    `src/app/budgets/trips/[id]/page.tsx:756` — all bare `<CalendarGrid …>` with
    no responsive props (grep: zero `enableDayView`/`enableHubChrome` in those files).
- So `ResponsiveViewController` (Cal-4) is mounted at `CalendarGrid.tsx:335`
  **only** behind `{enableDayView && …}` → **Hub is the only caller that mounts
  it**, and it already calls `useMediaQuery('(max-width: 767px)')` internally
  (`ResponsiveViewController.tsx:27`).
- The Phase-2 line `const isMobile = useMediaQuery(...)` at the parent top level
  ran for **every** caller — the regression.

## Fix — Option 1 (unify with the Cal-4 controller). Chosen, clean.

There was no state entanglement, so the preferred unification applies: the
controller already owns the only `<768px` hook and is already Hub-only-mounted;
I just surfaced its signal to the parent. **No second hook, no parallel detector,
no new child component.**

**`ResponsiveViewController.tsx`** (`:6-15`, `:34-50`)
- New optional prop `onMobileChange?: (isMobile: boolean) => void`.
- New effect `useEffect(() => { onMobileChange?.(isMobile); }, [isMobile, onMobileChange])`
  mirrors the signal up. When the prop is `undefined` it is a no-op (optional
  chaining short-circuits — no `setState`, no parent re-render). The Day-view
  auto-switch effect is untouched, so Cal-4's existing job is unchanged.

**`CalendarGrid.tsx`**
- Removed `import { useMediaQuery }` and the unconditional
  `const isMobile = useMediaQuery(...)`.
- `isMobile` is now parent **state**: `const [isMobile, setIsMobile] = useState(false)`
  (`:292`), default `false`.
- The controller mount passes the callback **gated on `enableHubChrome`**
  (`:340`): `onMobileChange={enableHubChrome ? setIsMobile : undefined}`.
- `hubMobileToolbar = enableHubChrome && isMobile` and all toolbar class strings
  (`:294-305`) + the card radius (`:331`) are unchanged downstream.

### How the toolbar gets its mobile signal WITHOUT an unconditional hook
Hub mounts `ResponsiveViewController` (because `enableDayView`); that child's
single `useMediaQuery` flips `isMobile`; because Hub also sets `enableHubChrome`,
the callback is `setIsMobile`, so the child pushes the value into the parent's
state, which drives `hubMobileToolbar`. The hook only ever exists inside a child
that only Hub mounts.

## Byte-identical proof — Trading + both Trips (gate-by-gate)

1. **No hook / no listener.** They pass no `enableDayView` → the
   `{enableDayView && <ResponsiveViewController/>}` guard (`:335`) renders
   nothing → the only `useMediaQuery` in the tree is never instantiated → no
   `matchMedia` subscription. ✓
2. **No `onMobileChange` push.** Even hypothetically (a future caller with
   `enableDayView` but not `enableHubChrome`): `onMobileChange={enableHubChrome ? setIsMobile : undefined}`
   is `undefined` → controller's mirror effect is a no-op → no `setIsMobile` →
   **zero extra re-renders**. ✓
3. **State stays `false`.** `setIsMobile` is never called for them → `isMobile`
   remains its `useState(false)` initial value. ✓
4. **All class strings unchanged.** `hubMobileToolbar = enableHubChrome && isMobile`
   = `false && false` = `false`, so:
   - `toolbarBarClass` → `flex items-center justify-between px-4 py-3 border-b border-border bg-bg-row/50`
   - `toolbarLeftClass` → `flex items-center gap-4`
   - `viewTrackExtra` / `viewBtnExtra` → `''`
   - `toolbarTitleClass` → `text-sm font-semibold text-text-primary`
   - `toolbarRightClass` → `flex items-center gap-2`
   - card radius → `rounded`
   All character-identical to the pre-mobile build. ✓

Net: non-Hub callers now call **no** `useMediaQuery`, subscribe **no** listener,
and have **zero** extra re-renders — matching the Cal-4 `enableDayView` discipline.

## Hub unchanged
- Mobile toolbar still stacks `<768px` (Row 1 equal-width Day/Week/Month · Row 2
  centered title · Row 3 centered ‹ Today ›): `hubMobileToolbar` becomes `true`
  exactly as before, just sourced from controller-pushed state instead of a
  parent hook. Same 768px boundary (the controller's `(max-width: 767px)`).
- Day-view auto-switch still works: the controller's first effect
  (`setCalendarView(isMobile ? 'day' : defaultView)`) is untouched.

## Checks
- `npx tsc --noEmit` → exit 0.
- ESLint (CalendarGrid, ResponsiveViewController, hub/page) → 0 errors (19
  pre-existing warnings, unrelated).
- No fallback logic, no schema changes. Nav (AppLayout) untouched.
