# CALENDAR DEMO-MODE AUDIT — a living demo for logged-out visitors

**Type:** Audit — READ ONLY. No source modified.
**Goal:** When LOGGED OUT, the home-page master calendar should show a **living
demo** (fictional example events) instead of the "log in" card — matching the
existing Operations showroom (Maria's Food Truck). Logged in → real data,
unchanged. Map the existing demo pattern to reuse, and scope the calendar's
demo seed.

---

## VERDICT — EXISTS (the pattern) | MISSING (a calendar seed) | small PR

The Operations showroom already establishes the exact pattern to copy: a **pure
view fed a static `demo*` seed**, fictional + `demo-`-prefixed, shown to
logged-out users with "live demo · log in" labeling and a "Make my free account"
nudge — and **zero fetches by construction**. The calendar has no such seed yet.
The smallest change: add a static `demoCalendar` seed (a pre-merged
`CalendarEvent[]`), give `HubCalendar` a `demoEvents?` prop that **skips the
fetch `useEffect`** and renders the seed, and in `ModuleLauncher` swap the
logged-out login card for `<HubCalendar demoEvents={demoCalendar} />`. One PR.

---

## 1. THE EXISTING OPERATIONS DEMO PATTERN (reuse this)

### 1a. Where the demo data lives + how it's structured

- **Seed file:** `src/components/workbench/operations/content/showroom/demoData.ts`
  — `PURE STATIC DATA … no fetch, no effect, no server import — just typed
  literals` (`demoData.ts:5-7`). Exports `demoDay`, `demoDayEntities`,
  `demoDayDate`, `demoScript`, `demoExecNotes`.
- **Fictional + `demo-` prefixed:** identifiers are `demo-entity-truck`,
  `demo-project-books`, `demo-scene-morning`, etc. (`demoData.ts:27-29,50,71`);
  entities are `"Maria's Food Truck"` / `"Maria (home)"` (`:36-39`). The comment
  is explicit: `prefixed so they read clearly as showroom seed rows`
  (`demoData.ts:26`).
- **Type-conformance proof:** the seed is typed against the SAME view-prop
  contracts and proven assignable at the bottom (`demoData.ts:215-223`,
  `_checkTimeline`, `_checkEntities`, …) — so the seed can never drift from the
  shape the real view renders. This convention should carry to the calendar seed.

### 1b. How it's shown to logged-out users vs real data to logged-in

- The showroom is rendered for **everyone** by `ModuleLauncher` for the
  Operations module: `renderBody` returns
  `<OperationsPipelineShowroom onRequireAuth={onRequireAuth} />`
  (`src/components/home/ModuleLauncher.tsx:131`), independent of `authed`.
- It is "locked but visible": every panel renders the **real pure view** fed the
  static seed, and **every action is bound to one inert `lock` handler** that
  does ONLY `onRequireAuth()` — `const lock = () => onRequireAuth();`
  (`OperationsPipelineShowroom.tsx:58`, applied `:70,95-100`).
- It does **not** branch on real-vs-demo by user — the showroom is always demo.
  The "real data" version of Operations lives on the authed `/operations`
  surface, a different route. (This differs from the calendar ask, where the
  SAME component must do demo-when-guest / real-when-authed — see §2.)

### 1c. Public-safety: ZERO fetch, two layers

The showroom guarantees no server reach for guests by **construction + a guard**:

- **By construction:** the seed has no I/O and the views are pure; every handler
  is the inert `lock` (`OperationsPipelineShowroom.tsx:10-15,56-58`).
- **Layer 2 runtime guard:** the whole render is wrapped in
  `guardShowroomRender(() => …)` (`OperationsPipelineShowroom.tsx:60`), which
  swaps `globalThis.fetch` for a throwing stub **for the synchronous duration of
  the render only**, then restores it in `finally`
  (`src/lib/showroom/renderGuard.ts:43-67`); a fetch attempt throws
  `ShowroomFetchError` (`renderGuard.ts:22-39`).
- **Important limit to note for the calendar:** `guardShowroomRender` guards only
  the **synchronous render**, not effects. The showroom is safe because it has
  **no `useEffect`/fetch at all**. The calendar **does** fetch in a `useEffect`
  (§2), so the guard alone would not stop it — the calendar's guarantee must come
  from **not running the effect** in demo mode (§3b), with the guard as optional
  defense-in-depth.

### 1d. The labeling pattern + voice (match this)

- **Band tag (Operations):** `'Live demo · log in to use'` —
  `src/components/home/ModuleLauncher.tsx:211`
  (`m.key === 'operations' ? 'Live demo · log in to use' : …`).
- **"Nothing gets saved" + "real app, not a screenshot":** the projects showroom
  intro — `"Yo, check this out. This is the real app, not a screenshot. … we
  loaded a pretend project … Nothing here gets saved. Go ahead, touch
  everything."` (`projects/showroom/narrativeCopy.ts:44-51`).
- **Free-account nudge:** `closingNudge.body` = `"Like what you see? Make a free
  account and build your own…"`, `ctaLabel: 'Make my free account'`
  (`narrativeCopy.ts:81-86`).
- **Voice spec:** `short, friendly, 5th-grade … describes ONLY what the showroom
  shows on screen` (`narrativeCopy.ts:6-9`). The calendar demo copy should match:
  e.g. a caption "A peek at how your calendar looks — these are pretend events,
  nothing here is saved" + a "Make my free account" button.

### 1e. Reusable toggle, or bespoke per module? **Bespoke.**

There is **no shared "demo vs real" toggle component.** Each module hard-codes
its own seed + showroom (`operations/.../showroom/`, `projects/.../showroom/`).
The only reusable primitive is `guardShowroomRender` (`renderGuard.ts`) and the
`demo*`-seed convention. So the calendar demo is a **new bespoke seed** following
the same convention — not an extension of a generic toggle.

---

## 2. THE CALENDAR'S CURRENT GATING (what changes)

### 2a. The exact mount/gate to change

`src/components/home/ModuleLauncher.tsx:178-203`:

```jsx
{authed === true && (                       // :178 — real calendar (keep)
  <section ...><HubCalendar /></section>
)}
{authed === false && (                       // :185 — login card (REPLACE with demo)
  <section ...>
    ... "Your calendar" + "Log in to see your calendar" button → onRequireAuth ...
  </section>
)}
```

- **Change:** the `authed === false` branch (`:185-203`) currently renders a
  static login card. Demo mode replaces it with the calendar **fed the demo
  seed** (e.g. `<HubCalendar demoEvents={demoCalendar} />`), plus the demo
  labeling + a "Make my free account" CTA wired to `onRequireAuth`.
- **Unchanged:** `authed === true` (`:178`) still renders `<HubCalendar />` with
  real fetches; `authed === null` (initial) still renders nothing.
- Note: the master-calendar section sits **above** `{MODULES.map(...)}` (`:204`)
  and has **no purple band header** of its own (unlike the module cards), so the
  `'Live demo · log in to use'` tag pattern can't reuse the band at `:211`; the
  demo label goes as a caption inside the calendar header (§3c, near
  `HubCalendar.tsx:153-157`).

### 2b. HubCalendar's data shape + the 3 layers

`HubCalendar` today takes **no props** (`HubCalendar.tsx:60`), fetches 3 sources
in a `useEffect` (`:116`), and **merges them into one `GridEvent[]`** via a memo
(`:119-132`):

| Layer | Loader (route) | Mapper → output |
|---|---|---|
| trip | `loadCalendar` → `/api/calendar` (`HubCalendar.tsx:71-80`), filtered `source==='trip'` | inline map to `GridEvent` (`:120-130`) |
| operations | `loadOperationsBlocks` → `/api/operations/daily-plan/items` (`:82-93`) | `mapOperationsBlocks(items)` (`mapOperationsBlocks.ts:43`) → `CalendarEvent[]` |
| routines | `loadOperationsRoutines` → `/api/hub/operations-routines` (`:95-114`) | `mapOperationsRoutines(window)` (`mapOperationsRoutines.ts:80`) → `CalendarEvent[]` |

All three normalize to the **shared `CalendarEvent` (the grid's "GridEvent")**,
`src/components/shared/CalendarGrid.tsx:11-32`:

```ts
export interface CalendarEvent {
  id: string; source: string; title: string;
  icon?: string | null;
  startDate: string;        // YYYY-MM-DD
  endDate?: string | null;
  startTime?: string | null; endTime?: string | null;  // HH:MM
  isRecurring?: boolean; location?: string | null;
  budgetAmount?: number; details?: string[]; href?: string;
}
```

The merged `gridEvents: GridEvent[]` is what `CalendarGrid` renders
(`HubCalendar.tsx:166-176`). **Because everything is pre-merged into this one
shape, the demo seed does not need to reproduce the 3 raw upstream shapes — it
can be a single static `CalendarEvent[]` of fictional events.** That is the key
simplification.

---

## 3. THE DEMO SEED (what to build)

### 3a. A static `demoCalendar` seed — shape + content

- **Shape:** `CalendarEvent[]` (import `type CalendarEvent` from
  `@/components/shared/CalendarGrid`) — one array of fictional, pre-merged
  events across the 3 sources, e.g.:
  - `source: 'trip'` → a demo trip (e.g. `id: 'demo-cal-trip-bali'`, title
    "Trip to Bali", `startDate`/`endDate`, `budgetAmount`, `location`).
  - `source: 'routines'` → demo routines (`isRecurring: true`) like "Morning
    Workout", "Sleep" with `startTime`/`endTime` — matching the 5th-grade voice.
  - `source: 'operations'` → a demo daily-plan block (e.g. "Sort the receipts")
    with `details: ['Get the books ready', 'B-6210 · $250']`.
  - All `id`s **`demo-cal-*` prefixed**, all fictional — mirroring `demoData.ts`'s
    `demo-*` convention (`demoData.ts:26-29`).
- **Dates:** to keep the demo "living" (visible in the current month), generate
  dates relative to "today" at module load (pure, no fetch) or pin to a near
  month — author's choice; keep it a pure literal/derivation, no I/O.
- **Type proof:** add a `_check: CalendarEvent[] = demoCalendar;` line (erased by
  the compiler) mirroring `demoData.ts:215-223`, so the seed can't drift.

### 3b. Where it lives (convention)

Mirror the Operations convention — a `showroom/` subfolder beside the consumer
with a `demo*` seed file. Operations uses
`workbench/operations/content/showroom/demoData.ts` (`demoData.ts:1`). For the
calendar: **`src/components/hub/showroom/demoCalendar.ts`** (new `showroom/`
folder beside `HubCalendar.tsx`; `src/components/hub/` currently has no
`showroom/` — confirmed). Pure typed literals, no React, no fetch — same as
`narrativeCopy.ts`/`demoData.ts`.

### 3c. The HubCalendar change (smallest)

Add an optional prop and short-circuit the fetch:

- `HubCalendar({ demoEvents }: { demoEvents?: GridEvent[] })` (`:60`).
- **Effect guard (the hard guarantee):** first line of the `useEffect` (`:116`)
  becomes `if (demoEvents) return;` — so **none of the 3 loaders run** when a seed
  is supplied. This is the by-construction "zero fetch" guarantee for guests
  (§3d).
- **Render:** `const gridEvents = demoEvents ?? <existing merge memo>` — when demo,
  render the seed straight into `CalendarGrid`; the click handler
  (`handleEventClick`, `:135-142`) already no-ops for non-operations and finds
  nothing in the empty `operationsItems`, so demo clicks are inert (optionally
  route demo operations clicks to `onRequireAuth` for parity with the showroom's
  `lock`).
- **Labeling:** add a demo caption + "Make my free account" button in the header
  (`:153-164`), shown only when `demoEvents` is set, in the 5th-grade voice
  (§1d). Pass an `onRequireAuth` prop through for the CTA.

### 3d. CRITICAL — ZERO personal fetch for guests (fake by construction)

- The guarantee is the **`if (demoEvents) return;` at the top of the effect**
  (`HubCalendar.tsx:116`): with the seed supplied, the component **never calls**
  `/api/calendar`, `/api/operations/daily-plan/items`, or
  `/api/hub/operations-routines`. A logged-out visitor triggers **zero**
  personal-route fetches; the data is a static literal, so there is **nothing
  real to leak**.
- Defense-in-depth (optional, mirrors §1c): wrap the demo render path in
  `guardShowroomRender` (`renderGuard.ts:43`). Caveat (§1c): that guard only
  covers the synchronous render, **not** the effect — so it is a backstop, **not**
  the primary control. The primary control is the effect early-return.
- This also closes the §CALENDAR-LEAK-AUDIT concern: in demo mode there is no
  authed fetch at all, so even a cache/cookie edge case cannot surface real rows
  to a guest — the guest path is provably fake.

---

## 4. THE PLAN — smallest PR

**One PR** (small, atomic, revertible):

1. **New** `src/components/hub/showroom/demoCalendar.ts` — static fictional
   `CalendarEvent[]` (`demo-cal-*`), across trip/routines/operations, with a
   `_check` type proof. (Pure data; no logic.)
2. **Edit** `src/components/hub/HubCalendar.tsx` — add `demoEvents?` (+
   `onRequireAuth?`) prop; `if (demoEvents) return;` at the top of the `useEffect`
   (`:116`); `gridEvents = demoEvents ?? <merge>`; a demo caption + "Make my free
   account" CTA in the header shown only in demo mode.
3. **Edit** `src/components/home/ModuleLauncher.tsx:185-203` — replace the
   logged-out login card with
   `<HubCalendar demoEvents={demoCalendar} onRequireAuth={onRequireAuth} />`
   inside the existing section; keep `authed === true` (`:178`) and `authed ===
   null` branches unchanged.

Could be split (seed PR, then wiring PR), but it is small enough for **one** —
the seed is inert until step 2/3 consume it, so a single PR is clean.

**Labeling to apply** (from §1d): a header caption in the calendar's
5th-grade voice (e.g. "A peek at your calendar — these are pretend events,
nothing here is saved") + the **"Make my free account"** button
(`narrativeCopy.ts:85`) wired to `onRequireAuth`. Optionally surface a
`'Live demo · log in to use'`-style tag (`ModuleLauncher.tsx:211`) near the
calendar header for consistency.

**CRITICAL confirm:** logged-out demo mode fires **ZERO** personal-route fetches —
the `if (demoEvents) return;` guard at `HubCalendar.tsx:116` short-circuits all
three loaders, and the rendered data is a static literal. The demo is **fake by
construction**, so it is impossible to leak real data to a guest.

---

## Citations index

- Operations showroom render + lock + guard:
  `src/components/workbench/operations/showroom/OperationsPipelineShowroom.tsx:10-15,56-64,70,95-100`
- Seed (pure, `demo-` prefixed, type-proof):
  `src/components/workbench/operations/content/showroom/demoData.ts:5-7,26-39,215-223`
- Runtime fetch guard: `src/lib/showroom/renderGuard.ts:22-39,43-67`
- Labeling/voice: `src/components/home/ModuleLauncher.tsx:211`;
  `src/components/workbench/operations/projects/showroom/narrativeCopy.ts:6-9,44-51,81-86`
- Calendar mount/gate to change: `src/components/home/ModuleLauncher.tsx:178-204`
- HubCalendar (no props, fetch effect, merge memo, click):
  `src/components/hub/HubCalendar.tsx:60,71-114,116,119-132,135-142,153-176`
- Shared event shape: `src/components/shared/CalendarGrid.tsx:11-32`
- Mappers → `CalendarEvent[]`: `src/lib/hub/mapOperationsBlocks.ts:43`,
  `src/lib/hub/mapOperationsRoutines.ts:80`
- No existing `hub/showroom/`: `find src/components/hub` (only
  HubCalendar/HubEventCard/Unscheduled/TripExpenses/BudgetDrillDown)
