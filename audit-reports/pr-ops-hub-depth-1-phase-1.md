# PR-Ops-Hub-Depth-1 — Phase 1 Audit (read-only)

Two refinements: (1) a 3-step purple depth gradient (nav darkest → banner medium
→ toolbar lightest), and (2) make the banner a true edge-to-edge full bar flowing
out of the nav instead of a tucked, inset card. Resolves the shared-component nav
question and the exact full-bar cause before any edit.

---

## ⚠️ Critical token gotcha (affects every recommendation below)

The spec says "brand-purple-light **#4e3e85**". In THIS codebase that mapping is
**wrong** — `brand-purple-light` resolves to **`#7b6baa`** (a light lavender),
not #4e3e85:

```
tailwind.config.ts:18  purple:        var(--ts-purple)        // #3b2d6b
                  :19  purple-deep:   var(--ts-purple-deep)   // #2d1b4e
                  :20  purple-hover:  var(--ts-purple-light)  // #4e3e85  ← the #4e3e85 the spec wants
                  :21  purple-light:  '#7b6baa'  // LEGACY literal, 0 refs, NOT #4e3e85
                  :22  purple-wash:   var(--ts-purple-wash)   // #eae7f2
```

So the medium shade **#4e3e85 is exposed as the Tailwind class
`bg-brand-purple-hover`** (its CSS var is `--ts-purple-light`). Using
`bg-brand-purple-light` would yield #7b6baa (too light, lavender — wrong).
**Build must use `brand-purple-hover` for #4e3e85.** (globals.css:18-22 confirms
`--ts-purple-light: #4e3e85`.)

---

## 1. The nav shade (shared-component crux)

- Nav backgrounds in `AppLayout.tsx`: ROW1 `:190 bg-brand-purple` (#3b2d6b),
  ROW2 tab bar `:212 bg-brand-purple/90`, Travel/Bookkeeping rows `:233/:242
  bg-brand-purple/80`, mobile menu `:324 bg-brand-purple-deep` (#2d1b4e).
- **Blast radius: app-wide.** `AppLayout` wraps ~25+ routes (hub, trading,
  income, net-worth, agenda, shopping, compliance/*, soc2, data-observatory,
  …). Changing `:190` to `brand-purple-deep` darkens the nav on **every** page.
- The blur today: nav `#3b2d6b` and banner `#3b2d6b` are the **same** shade.

### Options
- **(a) Darken nav app-wide** to `brand-purple-deep` (#2d1b4e): simplest literal
  match to "nav darkest," consistent, but **touches the shared shell → changes
  every page**. #2d1b4e is a reasonable nav shade (it's already the mobile-menu
  color), but it's an app-wide visual change beyond Hub.
- **(b) Lighten the BANNER instead** (#3b2d6b → #4e3e85 = `brand-purple-hover`),
  nav untouched: the 3-step contrast comes from lightening the banner, **zero
  AppLayout change, zero other-page impact.** Resulting top-to-bottom gradient:
  nav `#3b2d6b` → banner `#4e3e85` → toolbar wash `#eae7f2` — monotonically
  lighter, nav is the darkest, clear steps between all three.

### Recommendation: **(b)** — Hub-only-safe, achieves the full 3-step depth
without darkening the shared nav. (Nav stays #3b2d6b but is now the darkest of
the three because the banner lightened.) #3b2d6b vs #4e3e85 reads as a clear
step. If Alex specifically wants the nav itself at #2d1b4e app-wide, that's
option (a) and must be called out as a deliberate all-pages change.

---

## 2. Banner shade + active button

- **Banner**: `hub/page.tsx:406` is `bg-brand-purple` (#3b2d6b). Confirmed.
  Target medium = #4e3e85 → swap to **`bg-brand-purple-hover`** (NOT
  `-light`, per the gotcha above). Hub-only inline JSX — safe.
- **Active view button** (`CalendarGrid.tsx:306`):
  `const viewBtnActive = enableHubChrome ? 'bg-brand-purple text-white shadow-sm' : 'bg-white shadow-sm text-text-primary';`
  - It is **already gated on `enableHubChrome`**. Changing only the
    `enableHubChrome` branch (`bg-brand-purple` → `bg-brand-purple-hover`) to
    match the banner affects **Hub only**.
  - **No-op for Trading/Trips**: they don't pass `enableHubChrome`, so they take
    the `: 'bg-white shadow-sm text-text-primary'` branch — byte-identical,
    untouched. (Inactive `:307` and the wash bar can stay as-is.)
  - This is a Hub-gated restyle, not an app-wide token swap — the cleanest path.

---

## 3. The not-full-bar cause

- **Radius is NOT the cause.** `hub/page.tsx:406` is already `rounded-t-none`
  (Fullwidth-1) and `pt-0` flush — confirmed. No rounded notch from the corners,
  no top gap.
- **The cause is the horizontal side gutter.** The Hub container
  `hub/page.tsx:398` is `<div className="px-4 lg:px-6 pt-0 pb-6">` — its
  `px-4 lg:px-6` (~16/24px) applies to **all** children including the banner, so
  the banner is inset from the screen edges. Meanwhile the nav is **full-bleed**:
  AppLayout's `<header>` (`:188`) is a sibling of `<main>` inside the root div
  (no max-w), so the nav bg divs (`:190` etc.) span the full viewport, while
  their content uses an inner `max-w-[1800px] mx-auto px-6`. Net: nav bar reaches
  the edges, banner is inset → the banner reads as a narrower tucked card with a
  "notch" at the top corners.

### Make the banner a true full bar without losing the content gutter
The banner and calendar are a **connected block** (Connect-1 flush seam), so they
must stay the same width — full-bleed the **block**, not just the banner, or the
seam misaligns.

- **Recommended (surgical): negative-margin breakout.** Give the banner AND the
  calendar wrapper (`:439`) `-mx-4 lg:-mx-6` to cancel the container's
  `px-4 lg:px-6`, extending them edge-to-edge, while queues/budgets (no negative
  margin) keep the gutter. Only the header block changes; container + content
  below untouched.
- **Alternative (restructure):** drop `px-4 lg:px-6` from `:398` (full-bleed
  container) and add the gutter to the content-below sections (queues + each
  budget panel). More edits, same result.

> **1800px cap flag:** `<main className="max-w-[1800px] mx-auto">`
> (`AppLayout.tsx:354`, untouched) caps Hub content at 1800px. On ≤1800px
> monitors the full-bled banner reaches the screen edges and aligns with the nav.
> On **>1800px** monitors the nav bg extends to the full viewport while the banner
> stops at 1800px — they won't align at the extreme edges. That's an existing
> shared-shell behavior; matching it would require editing AppLayout (out of
> scope). Acceptable per the locked 1800 cap.

---

## RECOMMENDED BUILD PLAN

| # | Change | File / line | Scope |
|---|--------|-------------|-------|
| 1 | Banner bg `bg-brand-purple` → **`bg-brand-purple-hover`** (#4e3e85, medium) | `hub/page.tsx:406` | **Hub-only-safe** |
| 2 | Active view button Hub branch `bg-brand-purple` → **`bg-brand-purple-hover`** | `CalendarGrid.tsx:306` | **Shared file, but `enableHubChrome`-gated → Hub-only effect; Trading/Trips byte-identical** |
| 3 | Full-bar: add `-mx-4 lg:-mx-6` to banner (`:406`) + calendar wrapper (`:439`) to break out of the container gutter | `hub/page.tsx:406, 439` | **Hub-only-safe** |
| — | Nav stays #3b2d6b (option b) — **do NOT** darken `AppLayout.tsx:190` | — | (avoids app-wide change) |

Result: nav `#3b2d6b` (darkest) → aqua rule → banner `#4e3e85` (medium, full
edge-to-edge bar) → purple-deep seam → toolbar wash `#eae7f2` (lightest), active
view button `#4e3e85` matching the banner. Queues/budgets keep their gutter.

### Flags
- **Token name**: use `brand-purple-hover` for #4e3e85, never `brand-purple-light`
  (=#7b6baa). This is the single biggest correctness risk in the build.
- **Shared CalendarGrid** edit (#2) is gated — confirm the no-op holds (it does:
  `enableHubChrome` false → white branch).
- **Nav darkening (option a)** is the only thing that can't be done without an
  app-wide AppLayout change — recommend NOT doing it; option (b) gets the depth.
- **>1800px monitors**: banner full-bleed aligns with nav only up to 1800px (main
  cap); flagged, not fixable Hub-side.

NO edits made.
