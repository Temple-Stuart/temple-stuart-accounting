# EDGE-MACHINE AUDIT — desktop tabs · one tab per module · edge-to-edge · fit polish

**Type:** Audit — READ ONLY. Nothing modified.
**Goal:** turn the working mobile tab shell (PR-Mobile2) into an "edge machine" on phone
AND desktop: (1) **tabs on desktop too** (one module at a time, not the full stack);
(2) **each module its own tab** — no "More" grouping; (3) **edge-to-edge** — kill the
floating-card look, headers flush; (4) **fit polish** (cramped calendar caption / tight
controls). Full functionality preserved.

Citations are `src/components/home/ModuleLauncher.tsx` unless noted.

---

## TL;DR

- The shell is already there: `activeModule` state + the visibility recipe
  `${activeModule === KEY ? 'block' : 'hidden'} **md:block**` on every panel
  (`:329, :344, :359`) + a `md:hidden` bottom bar (`:419`). The three changes are
  surgical edits to **the same spots**:
  1. **Desktop tabs** = drop `md:block` (so desktop also obeys `activeModule`) + add a
     `hidden md:flex` **top tab row**.
  2. **One tab per module** = grow `TABS` 5→7 (`:51-57`) and make `MODULE_TO_TAB`
     1:1 (`:59-`), dropping `'more'`.
  3. **Edge-to-edge** = strip the card chrome (`rounded-lg … border … shadow-sm`
     `:331,:346,:361`), the `py-10` gaps, and the `max-w-7xl` gutter on the active panel;
     header (`bg-brand-purple/80` `:332,:347,:362`) spans full width.
- **State persists across tabs** (inactive panels are `hidden`, not unmounted), so the
  calendar demo/real, `currentTrip`, and scanner state keep working per tab — on both
  sizes. No feature is removed; tabs are pure navigation.
- Biggest risks: **7 tabs fitting a ~390px phone bar** (→ horizontal-scroll); **desktop
  now shows one panel** (the intended change — verify nothing assumed the full stack);
  **edge-to-edge not breaking the calendar grid / search forms** (keep inner body
  padding + an inner max-w for wide desktop content).

---

## 1. THE CURRENT SHELL (post-Mobile2)

- **State:** `const [activeModule, setActiveModule] = useState('calendar')` (`:171`,
  additive). Existing state untouched: `authed`, `isAdmin`, `tripsRefresh`,
  `currentTrip`, `scannerFilters`/`scannerUniverse`/`scanTriggerRef`.
- **TABS (5)** (`:51-57`): `calendar · travel · trade · books · more`. **`more` IS the
  grouping** we split.
- **MODULE_TO_TAB** (`:59-`): `travel→travel, trading→trade, bookkeeping→books,
  operations→more, tax→more, compliance→more`.
- **Panels + recipe:** calendar (two sections, authed-true `:329` / authed-false
  `:344`) and `{MODULES.map}` (`:359`) each carry
  `${activeModule === KEY ? 'block' : 'hidden'} **md:block**` — `md:block` is what keeps
  the **full stack on desktop today**.
- **Bottom bar** (`:419-`): `fixed inset-x-0 bottom-0 z-40 flex … pb-[env(safe-area-inset-bottom)]
  **md:hidden**`, 5 tabs each `flex-1 min-h-[44px]`, active = `text-brand-purple`.
- **MODULES (6)** (`:38-45`): `travel, trading, operations, bookkeeping, tax,
  compliance`. Plus **Calendar** (the master, rendered separately, not in `MODULES`).
  → **7 tabs total.**

---

## 2. TABS ON DESKTOP (change #1)

- **Today:** `md:block` forces every panel visible at ≥md (the full stack). To make
  desktop **also** show one panel at a time, **drop `md:block`** so the recipe becomes
  `${activeModule === KEY ? 'block' : 'hidden'}` at **all** sizes (`:329,:344,:359`).
- **Add a desktop TOP tab row**: a `hidden md:flex` nav (the mirror of the mobile
  bottom bar), mounted at the **top of the `ModuleLauncher` return** (above the panels),
  ideally `sticky top-0 z-30` so it stays while scrolling a panel. The mobile bottom bar
  stays `md:hidden`. Both navs read/write the same `activeModule` — one source of truth.
- **Full functionality confirmed:** every module is still reachable via its tab on both
  sizes. Switching tabs only toggles a panel's `display` — panels stay **mounted**
  (`hidden`), so `currentTrip`, the scanner filters, and the calendar's demo/real +
  month state **persist** across tab taps. The calendar's `authed`-driven demo/real
  branch (`:329` vs `:344`) is unchanged — it's just inside the Calendar tab now on
  desktop too.

---

## 3. EACH MODULE ITS OWN TAB — NO "MORE" (change #2)

- **TABS 5 → 7** (`:51-57`):
  `Calendar · Travel · Trade · Operations · Books · Tax · Compliance`
  (labels can stay friendly: Trade=trading, Books=bookkeeping). Drop the `'more'` entry.
- **MODULE_TO_TAB → 1:1** (`:59-`): `operations→operations, tax→tax,
  compliance→compliance` (travel/trading/bookkeeping keep their tab keys). Then the
  module-section recipe `activeModule === (MODULE_TO_TAB[m.key] ?? 'more')` (`:359`)
  resolves each module to its own tab.
- **7 tabs on a ~390px phone bar** — the current `flex-1` (equal-width) approach makes
  each tab ~52px: icons fit, but labels like "Compliance"/"Operations" truncate. The
  clean fix (Renaissance-grade, not crammed):
  - **RECOMMEND: a horizontal-scroll bottom bar** — `overflow-x-auto`, each tab a
    fixed `min-w-[64px] shrink-0` (icon + short label), `snap-x`. Scales to 7 (or more)
    without crushing; the active tab can `scrollIntoView`. (Alternatives — 2 rows, or
    shrinking to 5px labels — read as crammed; not recommended.)
  - **Desktop top row** easily fits 7 as a `flex` of buttons within `max-w-7xl`.
- Replace the bottom-bar `flex` (`:419`) with `flex overflow-x-auto`, and the per-tab
  `flex-1` (`:426`) with `min-w-[64px] shrink-0`.

---

## 4. EDGE-TO-EDGE FULL-WIDTH (change #3)

**The floating-card chrome (per panel):**
- `<section className="w-full **py-10** … border-b border-border …">` (`:329,:344,:359`)
  — `py-10` = the big vertical gaps between "cards".
- `<div className="**max-w-7xl mx-auto px-4 lg:px-8**">` (`:330,:345,:360`) — the
  max-width container = the side gutters (panels don't reach the screen edge).
- `<div className="**rounded-lg overflow-hidden border border-gray-200/50 shadow-sm**">`
  (`:331,:346,:361`) — **THE floating card** (rounded corners + border + shadow + the
  white gaps in the screenshots).
- `<div className="**bg-brand-purple/80** … px-4 py-2.5 …">` (`:332,:347,:362`) — the
  header band (currently inside the rounded card, so it has rounded top corners).
- `<div className="bg-white **p-4**">` (`:336,:351,:368`) — the body.

**To go edge-to-edge (native app screen):**
- Drop `rounded-lg … border … shadow-sm` (`:331…`) and the `border-b` + `py-10` on the
  section → the panel fills full width, **header flush** (the `bg-brand-purple/80` bar
  spans edge to edge).
- Drop `max-w-7xl mx-auto` on the active panel **for full-bleed** — BUT keep an inner
  content padding (`px-4`) so text/forms aren't jammed to the screen edge, and **keep
  an inner `max-w` on the BODY for desktop** so wide tables/forms (the budget grids, the
  calendar) don't stretch to absurd widths on a large monitor. (This is the one tension:
  full-bleed header/bg + readable-width body. Recommend: section full-width;
  header full-width; body `mx-auto max-w-7xl px-4` so content stays readable while the
  frame is edge-to-edge.)
- Since only ONE panel shows (after change #1), the alternating `bg-bg-row`/`bg-white`
  (`:359`) becomes moot — give each panel a single clean bg.

**Hero (`src/app/page.tsx`):** the marketing `<header>` (`:17-43`) + `<section>` hero
(`:46-68`) sit ABOVE `<ModuleLauncher/>` (`:74`); CPA/press/footer sit below. So the
hero is the logged-out marketing top, and the tab frame is the app below it.
- **Recommend:** keep the hero as the logged-out marketing band; mount the desktop
  **top tab row at the top of the `ModuleLauncher` frame** (sticky under the page
  header). Optionally hide the hero when `authed === true` (`hidden`/conditional) so a
  logged-in user lands straight in the app — a small, separate enhancement, not
  required for the edge-to-edge look.

---

## 5. FIT POLISH (change #4)

`HubCalendar.tsx:199-209` — the header puts the caption and the month-nav in **one
flex row**:
- caption `<p className="text-xs text-text-muted">` ("This is the real app…" /
  "Trips, routines…") (`:200-204`) shares the row with
- the nav cluster `<div className="flex shrink-0 items-center gap-2">` (`:206-209`):
  `‹` / `min-w-[120px]` month label / `›` / `Today`, buttons `rounded border … px-2 py-1
  text-sm` (~30px tall, **< 44px**).
→ On a narrow phone the caption is squeezed into a sliver beside ~250px of controls, and
the buttons are below-target. **Fix:** stack the caption ABOVE the nav on mobile
(`flex-col` under `sm:`/`md:`, `flex-row` above), and bump the nav buttons to ~44px.
- Also small everywhere: the band tags `text-[10px]` (`:336`-style) and the bottom-bar
  labels `text-[10px]` (`:426`) — fine on the bar, but verify the calendar caption +
  any `text-[10px]` body copy reads on a phone.

---

## REPORT: THE ATOMIC EDGE-MACHINE PLAN

All four are desktop+mobile-safe and **remove zero features** — tabs/navigation/layout
only; panels stay mounted so all state persists.

### PR-A — each module its own tab (split "More") + a 7-tab phone bar that fits
- **Touches:** `TABS` 5→7 (`:51-57`), `MODULE_TO_TAB` 1:1 (`:59-`); convert the bottom
  bar (`:419,:426`) to `overflow-x-auto` + `min-w-[64px] shrink-0` per tab.
- **Risk:** 7 tabs crammed on a phone → mitigated by horizontal-scroll. Desktop still
  shows the full stack here (md:block untouched) — so PR-A is safe on its own.
- **Functionality:** every module now has a tab; nothing grouped.

### PR-B — tabs on desktop too (drop md:block + a top tab row)
- **Touches:** remove `md:block` from the 3 panel recipes (`:329,:344,:359`); add a
  `hidden md:flex` sticky **top tab row** at the top of the `ModuleLauncher` return
  (mirrors the bottom bar, same `activeModule`).
- **Risk:** desktop now shows ONE panel (the intended change) — verify nothing relied on
  the full stack; confirm the calendar demo/real (`:329/:344`), `currentTrip`, and
  scanner all work after switching tabs (they persist — panels stay mounted).
- **Order note:** B depends conceptually on A (the 7-tab list), so **A → B**. They could
  combine into one "tab system" PR, but separate keeps each diff verifiable.

### PR-C — edge-to-edge full-width panels
- **Touches:** strip `rounded-lg … border … shadow-sm` (`:331,:346,:361`), `py-10` +
  `border-b` on the sections, and the `max-w-7xl` gutter on the active panel; keep an
  inner `max-w-7xl px-4` on the BODY for readable desktop width; header spans full width.
- **Risk:** full-bleed could disrupt the calendar grid / search forms — keep inner body
  padding + max-w; test the Calendar + Travel panels specifically.

### PR-D — fit polish
- **Touches:** `HubCalendar.tsx:199-209` (stack caption above nav on mobile; 44px
  buttons); any `text-[10px]` body copy; tight spacing.
- **Risk:** low — responsive/cosmetic only.

### Recommended order
**A → B → C → D.** (A+B may be merged if you prefer one nav rework; C and D are
independent polish on top.)

### Biggest risks (flagged)
1. **7 tabs on a phone bar** — use a horizontal-scroll bar, not equal-width crush.
2. **Desktop one-panel switch** — the working `activeModule` must keep persisting state
   (panels hidden, not unmounted); verify calendar demo/real + currentTrip + scanner.
3. **Edge-to-edge vs the grid** — keep inner body padding + a desktop max-w so the
   calendar/budget tables don't break or stretch.

### Full-functionality confirmation
Every PR is navigation/layout only. Every module gets a dedicated tab; tabs work on both
sizes; panels go edge-to-edge but keep all content; polish only resizes. The calendar
demo/real, guest search, budget/actual, uncommit/delete, and the scanner all keep
working exactly as today.

---

## Citations index
- Shell: `ModuleLauncher.tsx:51-57` (TABS, with `more`), `:59-` (MODULE_TO_TAB),
  `:171` (activeModule), `:329,:344,:359` (panel recipe `… md:block`), `:419-426`
  (bottom bar).
- MODULES: `:38-45` (6 modules); Calendar rendered at `:329/:344`.
- Card chrome: `:330` (max-w container), `:331` (rounded card), `:332` (header band),
  `:336` (body) — repeated at `:345-368`.
- Hero/frame: `src/app/page.tsx:17-43` (header), `:46-68` (hero), `:74` (ModuleLauncher).
- Fit polish: `HubCalendar.tsx:199-209` (caption-in-nav-row `:200-204`; small buttons
  `:206-209`).
