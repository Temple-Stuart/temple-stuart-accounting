# MOBILE-APP AUDIT — templestuart.com as a native phone app

**Type:** Audit — READ ONLY. Nothing modified.
**Goal (approved):** rebuild the home page (= the app) to feel like a native phone
app at full functionality — a **bottom tab bar** (Calendar · Travel · Trade · Books ·
More), **collapsed module intros**, the swipe money view preserved, **every feature
reachable**, **desktop kept intact**.

Citations are `file:line` (mostly `src/components/home/ModuleLauncher.tsx`).

---

## TL;DR

- The whole module experience is **one component, `ModuleLauncher`** (356 lines). The
  calendar renders **above** a `MODULES.map(...)` stack; each module is a full-width
  `<section>`. Turning this into tabs = add **one `activeModule` state** + show one
  panel at a time **on mobile only**, keeping the stack on desktop via a `md:`
  breakpoint. Zero feature removal — tabs are navigation, not deletion.
- **Desktop-safe recipe:** each tab panel gets `className={active ? 'block' : 'hidden'}
  **md:block**`, and the bottom bar is `**md:hidden**`. Desktop renders the exact
  current stack; mobile shows one panel + the bar.
- Smallest first win: **collapse `MODULE_INTROS`** (a per-module "How it works" toggle)
  — tiny, low-risk, instantly less wall-of-text on a phone.
- Biggest risks: not breaking the **demo/real calendar toggle** + the **currentTrip /
  tripsRefresh / scanner** state during the restructure; the **safe-area** bottom bar
  (needs `viewport-fit=cover`); and verifying **desktop is byte-identical**.

---

## 1. THE CURRENT RENDER STRUCTURE

`ModuleLauncher` return (`:249-355`):
- **Fragment** `<>`.
- **Calendar section** — rendered ABOVE the module map (the master, top of stack):
  - `authed === true` → real `<HubCalendar/>` in a banded card (`:263-277`).
  - `authed === false` → `<HubCalendar demoEvents={demoCalendar} …/>` (`:278-292`).
  - `authed === null` → nothing. **This is the demo/real toggle that must keep working
    per the Calendar tab.**
- **`{MODULES.map((m, i) => <section …>)}`** (`:293-353`): each of the 6 modules
  (`MODULES` `:36-44`: travel/trading/operations/bookkeeping/tax/compliance) is a
  full-width alternating-bg `<section>` containing:
  - The card: purple band header (`m.label` + a tag, `:297-302`) + body `<div
    bg-white p-4>` (`:303-312`):
    - **`MODULE_INTROS[m.key]` render** (`:304-310`) — the intro paragraphs.
    - **`{renderBody(m)}`** (`:311`) — the module's content (`renderBody` `:113-247`:
      travel = create form + trips + budget/actual; operations = showroom; trading =
      scan form/stub; bookkeeping/tax/compliance = paid stub).
  - **The Travel internal stack** (`:319-350`, only `m.key === 'travel'`):
    PublicFlightSearch (`:319`), PublicHotelSearch (`:320`), ComingSoon "Getting
    around" (`:323`), PublicActivitySearch (`:329`), PublicVisaCheck (`:332`),
    ComingSoon insurance (`:333`), eSIM (`:339`), Events (`:345`).

**State already in `ModuleLauncher`** (`:99-142`): `authed` (null/true/false, `:99`),
`isAdmin` (`:103`), `tripsRefresh` (`:105`), `currentTrip` (`:109`), `scannerFilters`/
`scannerUniverse`/`scanTriggerRef` (`:131-142`). **A tab shell adds one more:
`activeModule`** — it lives alongside these; none of them change.

**`MODULE_INTROS`** (`:46-89` map; rendered `:304-310`): `Record<string, string[]>`,
all paragraphs printed in a `space-y-2` block above the body. This is what PR1 wraps in
a collapse.

---

## 2. THE TAB-BAR SHELL (the big move)

### Where `activeModule` slots
- Add `const [activeModule, setActiveModule] = useState('calendar');` next to the
  other `useState`s (`:99-109`). Default `'calendar'` = the master/first tab.
- The 5 tabs map to the existing render:
  | Tab | Content (already exists) |
  |---|---|
  | **Calendar** | the calendar section (`:263-292`) |
  | **Travel** | the `travel` module section (card body + the travel stack `:319-350`) |
  | **Trade** | the `trading` module section |
  | **Books** | the `bookkeeping` module section |
  | **More** | the overflow modules — `operations`, `tax`, `compliance` (a small sub-list that sets `activeModule` to one of them) |

### Desktop-safe approach — RECOMMENDED: responsive CSS visibility
Wrap each tab panel (the calendar section + each module `<section>`) with a visibility
class instead of removing them:
```
className={`${activeModule === key ? 'block' : 'hidden'} md:block`}
```
- **Mobile (< md):** only the active panel is `block`; the rest are `hidden`. One
  screen at a time.
- **Desktop (≥ md):** `md:block` overrides `hidden` → **all panels render, exactly the
  current full stack.** Desktop is untouched.
- The bottom bar is `**md:hidden**` (mobile only). Tailwind `md:` is the gate
  (`tailwind` default `md` = 768px) — same breakpoint family already used across the
  app (`lg:px-8` etc., `:265`).

This keeps a **single DOM** (no double-mount) and a **byte-identical desktop**. The
one cost: on mobile, hidden panels are still mounted, so their on-mount fetches run
(only `HubCalendar` + Travel's `TripBudgetActual`/`AllTripsList` fetch; the rest are
fetch-free stubs/showroom). Acceptable; a later optimization can lazy-mount via a
`matchMedia` hook (adds a hydration flash — why it's not the first cut).

(Alternative — conditional mount only the active panel — is leaner on mobile but needs
a JS media query + a second desktop code path; **not recommended** for the first cut.)

### The bottom bar
- A `fixed inset-x-0 bottom-0 z-40 md:hidden` nav with 5 tap targets (icon + label),
  each calling `setActiveModule(key)`, the active one highlighted (brand-purple).
- **Safe area:** add bottom padding `pb-[env(safe-area-inset-bottom)]` to the bar so it
  clears the iOS home indicator. ⚠ `env(safe-area-inset-*)` only resolves when the
  viewport meta has **`viewport-fit=cover`** — verify/add it in the root layout
  (`src/app/layout.tsx`); without it the inset is 0.
- The scrolling content needs bottom clearance so the fixed bar doesn't cover the last
  rows: add `pb-20 md:pb-0` to the page/module container (mobile only).

### Calendar tab keeps its behavior
The Calendar tab renders the **same** `authed === true` / `authed === false` sections
(`:263-292`) unchanged — so the real-vs-demo toggle, the "Your data" / "Live demo · log
in to use" tags, and the zero-fetch guest demo all keep working. Only the wrapper
visibility class is added.

### Page chrome note
`src/app/page.tsx` wraps `ModuleLauncher` in `min-h-screen bg-bg-terminal` (`:15`) with
a marketing header (`:18-29`) + hero + footer **outside** `ModuleLauncher`. For a
native feel on mobile, the hero/footer can be `hidden md:block` so the app fills the
screen (tabs + bar); desktop keeps the marketing rhythm. Optional, part of PR2's polish.

---

## 3. COLLAPSED INTROS (the quick readability win)

- **Today:** `MODULE_INTROS[m.key].map(...)` prints every paragraph in a `space-y-2`
  block (`:304-310`) — a wall of text on a phone.
- **Change:** a small collapsible. Show **paragraph[0] as the teaser** always; a "How
  it works ▾" button toggles the rest. Implement as a tiny `<ModuleIntro paragraphs=
  {…} />` component with its own `useState(expanded)` (cleaner styling/animation than
  `<details>`, and matches the app's button idiom). Each module collapses
  independently.
- **Recommendation:** collapse by default on **both** mobile and desktop (consistent,
  least code; the teaser is enough, the rest is one tap away). A `md:`-expanded variant
  is possible but adds branching — not worth it.
- This is the smallest, lowest-risk PR (one render swap, no state outside the new
  component) → ship first.

---

## 4. MOBILE POLISH NEEDS

Per the skill: "responsive down to mobile, visible keyboard focus, reduced motion
respected" (`SKILL.md:43`); write controls by what people tap (`:49`). Concrete
offenders:

- **Touch targets < 44px:** the calendar month-nav + Today buttons are `px-2 py-1
  text-sm/text-xs` (≈28-30px tall) — `HubCalendar.tsx:206-209`. The module band tags
  (`text-[10px]`, `:299-301`) and the Remove/Delete buttons (`text-xs`,
  `TripBudgetActual.tsx`) are small. Bump tappable controls to ~44px (`min-h-[44px]` /
  larger padding) on mobile.
- **Cramped caption column:** the HubCalendar header puts the explainer `<p
  text-xs>` ("This is the real app…" / "Trips, routines…") **in the same flex row** as
  the month-nav cluster (`HubCalendar.tsx:199-209`) — on a narrow screen the caption is
  squished into a sliver beside 4 buttons. Fix: stack the caption above the nav on
  mobile (`flex-col` under `sm:`/`md:`, `flex-row` above).
- **Tiny type:** `text-[10px]` band tags (`:299`) and `text-[10px]` page meta
  (`page.tsx:26`) are below comfortable mobile reading; bump to `text-xs`+ on mobile.
- **Reduced motion / focus:** ensure the new tab bar + intro toggle have visible focus
  rings and respect `prefers-reduced-motion` (no required animation).

### Travel internal stack → tap tiles (the mockup's 2×2)
- **Today:** the Travel tab stacks **8 sections** vertically (`:319-350`) — flights,
  hotels, ground (soon), activities, visa, insurance (soon), eSIM (soon), events
  (soon) — a very long mobile scroll under the card body.
- **Map to the 2×2 mockup:** add a `const [travelTool, setTravelTool] =
  useState('flights')`; render a **tile grid** (Flights / Hotels / Activities / Visa +
  the coming-soon ones) where tapping a tile selects it, and **only the selected tool's
  component renders below** (the others unmounted). The card body (intro/create/trips/
  budget-actual) stays pinned at top; the search tools become a compact picker. This
  turns one long scroll into a tile picker + one active tool — and is itself a small
  win (fewer mounted search widgets = fewer guest-route fetches).

---

## REPORT: THE ATOMIC STAGED PLAN (desktop-safe, ordered)

### PR1 — Collapsible intros  *(tiny, lowest risk — ship first)*
- **Touches:** `ModuleLauncher.tsx` intro render (`:304-310`) → a small `ModuleIntro`
  component (teaser + "How it works" toggle).
- **Desktop-safe:** collapse on both; pure display, no state outside the component.
- **Risk:** near-zero. Instant readability win.

### PR2 — Bottom tab-bar app shell  *(the big sock-knocker)*
- **Touches:** `ModuleLauncher.tsx` — add `activeModule` state (`:99-109` area); wrap
  the calendar section + each module section in `${active ? 'block':'hidden'} md:block`;
  add a `md:hidden` fixed bottom bar (Calendar/Travel/Trade/Books/More) + safe-area;
  add `pb-20 md:pb-0` content clearance. Maybe `hidden md:block` the page hero
  (`page.tsx`). Verify `viewport-fit=cover` in `layout.tsx`.
- **Desktop-safe:** every panel keeps `md:block` (full stack renders) + bar is
  `md:hidden` → desktop unchanged.
- **Risk (the big ones):**
  1. Don't disturb the **demo/real calendar toggle** (`:263-292`) or the **currentTrip
     / tripsRefresh / scanner** state — `activeModule` is purely additive.
  2. **Desktop must stay identical** — verify with a desktop screenshot (all sections
     visible, no bar).
  3. **Safe-area** needs `viewport-fit=cover`; without it the bar sits flush to the
     home indicator.
  4. Mobile mounts hidden panels (fetches run) — acceptable; flag for later lazy-mount.

### PR3 — Travel internal tap-tiles  *(the 2×2 from the mockup)*
- **Touches:** the Travel stack (`:319-350`) → a `travelTool` state + tile grid;
  render only the selected tool. Card body unchanged.
- **Desktop-safe:** can also use tiles on desktop, or keep the stack on desktop via
  `md:` — recommend tiles everywhere (consistent, and reduces fetches). Verify the
  live searches (flights/hotels/activities/visa) all stay reachable.
- **Risk:** medium — make sure every one of the 8 sections is still reachable as a
  tile (zero feature removal).

### PR4 — Mobile polish  *(touch targets, type, cramped captions)*
- **Touches:** `HubCalendar.tsx:199-209` (stack caption above nav on mobile; 44px
  buttons); band tags `:299-301`; Remove/Delete buttons; `text-[10px]` → `text-xs`.
- **Desktop-safe:** all under `sm:`/`md:` responsive modifiers — desktop sizes
  unchanged.
- **Risk:** low — cosmetic/responsive only.

### Full-functionality confirmation
Every PR is **navigation/layout only — zero feature removal.** Tabs show one panel at a
time on mobile and the full stack on desktop; the intros collapse but keep all copy;
the travel tools become tiles but all remain reachable; polish only resizes. The
demo/real calendar, guest search, budget/actual, uncommit/delete, and the scanner all
keep working exactly as today.

---

## Citations index
- Render structure: `ModuleLauncher.tsx:249-355`; calendar sections `:263-292`; module
  map `:293-353`; MODULE_INTROS render `:304-310`; travel stack `:319-350`; renderBody
  `:113-247`; MODULES `:36-44`.
- State: `:99` (authed), `:103` (isAdmin), `:105` (tripsRefresh), `:109` (currentTrip),
  `:131-142` (scanner).
- Calendar header offenders: `HubCalendar.tsx:199-209` (caption-in-nav-row `:199-203`;
  small buttons `:206-209`).
- Page wrapper/chrome: `page.tsx:15,18-29` (+ tiny meta `:26`).
- Skill mobile/touch guidance: `SKILL.md:43,49`.
