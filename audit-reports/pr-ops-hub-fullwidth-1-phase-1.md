# PR-Ops-Hub-Fullwidth-1 — Phase 1 Audit (read-only)

Two asks: (1) make the Hub calendar fill the screen width (today it floats
centered with big side margins on wide monitors), and (2) close the white gap
between the shared AppLayout nav and the command-center banner so it's one
continuous stack nav → banner → calendar. AppLayout is shared — **must not be
edited**; the audit confirms what's achievable Hub-side.

---

## 1. Width constraint chain

The calendar is constrained by **two** nested `max-w` + `mx-auto` boxes:

| # | Element | Class | Editable? |
|---|---------|-------|-----------|
| 1 | AppLayout children wrapper | `<main className="max-w-[1800px] mx-auto">` — `AppLayout.tsx:354` (no padding) | **NO — shared shell** |
| 2 | Hub page container | `<div className="p-6 lg:p-8 max-w-[1400px] mx-auto">` — `hub/page.tsx:398` | **YES — Hub-side** |

Between page root and calendar:
- `hub/page.tsx:396` `<AppLayout>` → `:354` `<main max-w-[1800px] mx-auto>`
- `:397` `<div className="min-h-screen bg-bg-terminal">` (no max-w, just bg)
- `:398` `<div className="p-6 lg:p-8 max-w-[1400px] mx-auto">` ← **the 1400px cap + 24/32px side padding that floats the calendar centered.**

So on wide monitors the calendar is capped at **1400px** (Hub container), itself
inside the **1800px** `<main>` cap.

### Can the calendar widen independently of queues/budgets?
**Not as currently structured — they're all siblings in the same `:398`
container.** Confirmed direct children of `:398`:
- Banner block — `hub/page.tsx:406` (banner) + `:439` (`<div className="mb-6 -mt-px rounded-b-lg overflow-hidden">` → `<CalendarGrid>`)
- Unscheduled queues — `<div className="max-h-[640px] overflow-y-auto">` (`~:461`) → `<UnscheduledTaskTable>`
- Budget panels — three `<div className="mb-6">` blocks (`~:471`, `~:521`, `~:597`) with the budget tables

Widening `:398` widens **everything** (queues + budgets too). To widen **only**
the calendar, the banner+calendar block must be **lifted out** of the 1400px
container into its own full-width wrapper, leaving queues/budgets in a still-
constrained container. This is a Hub-side restructure (no shared-component risk).

> **Hard cap flag:** even full-width Hub-side, `<main className="max-w-[1800px]">`
> (`AppLayout.tsx:354`) caps everything at 1800px. True edge-to-edge beyond 1800px
> would require editing AppLayout — **out of scope / flagged**. "Full width" here
> means "fill `<main>` up to 1800px, minus a small gutter."

---

## 2. The nav→banner gap

**Source: the Hub container's TOP padding** — `p-6 lg:p-8` on `hub/page.tsx:398`
(24px, 32px at `lg`). `<main>` has **no** padding (`:354`), and the hub root
`:397` has no padding either, so the only thing between the nav's bottom and the
banner's top is that `p-6 lg:p-8` top padding. Its `bg-bg-terminal` (warm white)
shows as the gap band between the purple nav and the purple banner.

### Closes purely Hub-side? YES.
Because the gap is 100% the Hub page's own top padding (not `<main>`, not
AppLayout), removing the **top** padding on the Hub container (keep left/right/
bottom for breathing room) closes it with **no AppLayout edit** and **no effect
on other pages** (the fix lives in `hub/page.tsx`). No negative margin needed —
`<main>` adds nothing to overcome.

### Nav bottom edge (so the join looks intentional)
The `<header>` (`AppLayout.tsx:188`) has **no bottom border or shadow**. For Hub
(no Travel search, no Bookkeeping bar, no ledger/engine metrics bars) the header
ends with **ROW 2 tab bar** — `bg-brand-purple/90 border-t border-white/[.06]`
(`:212`). So the nav's bottom edge is simply the bottom of that purple/90 row.
The banner is solid `bg-brand-purple` with a `border-t-2 border-t-ts-aqua` rule
(`hub/page.tsx:406`). When the banner sits flush under the nav, **the aqua rule
becomes the divider between nav and banner** — a clean, intentional seam (purple
nav → aqua line → purple banner), mirroring the existing aqua-crown design.

---

## 3. AppLayout boundary (confirm don't-touch)

- Children wrapper: `<main className="max-w-[1800px] mx-auto">{children}</main>`
  (`AppLayout.tsx:354`). **No padding** — so it neither creates the top gap nor
  needs overcoming with a negative margin. It DOES impose the 1800px width cap.
- Header: `<header className="sticky top-0 z-50">` (`:188`) … `</header>` (`:352`),
  sticky, no bottom border/shadow.
- **Crux confirmed:** the nav→banner gap is fully Hub-side (Hub's `pt`), and the
  only AppLayout-imposed limit is the 1800px `<main>` cap (affects max width, not
  the gap). Everything asked is achievable Hub-side **except** edge-to-edge beyond
  1800px.

---

## RECOMMENDED BUILD PLAN (Hub-side only, no AppLayout edit)

**Restructure `hub/page.tsx` into two zones inside the existing `:397` root:**

1. **Full-width header+calendar zone** (lifted out of the 1400px container):
   - Wrap banner + calendar in a wrapper with a **small bezel gutter** only:
     `px-4 lg:px-6` (≈16–24px), **no `max-w`**, **no top padding** (`pt-0`) so it
     meets the nav flush. Caps at 1800px via `<main>` (acceptable).
   - **Banner top corners:** change Connect-1's `rounded-t-lg` → **`rounded-t-none`
     (square top)** so the banner butts flush against the nav with no light corner
     notches. (Connect-1's rounded top was for a banner that floated below page bg;
     now the nav sits directly above it.) Keep the aqua top-rule as the nav/banner
     divider, keep the purple-deep bottom border as the banner→calendar seam.
   - Calendar wrapper keeps its Connect-1 treatment (`-mt-px rounded-b-lg
     overflow-hidden`); its **bottom** corners stay rounded to finish the block.
   - Net: nav → (aqua rule) → banner → (purple seam) → calendar, full-width with a
     small side gutter, zero white gaps top-to-bottom.

2. **Constrained rest zone** (queues + budgets unchanged in feel):
   - Keep these in their own `max-w-[1400px] mx-auto` container with normal padding
     (e.g. `px-6 lg:px-8 pb-6 lg:pb-8 pt-6`) so dense tables stay readable and
     centered. **Queues/budgets do NOT widen** — only the calendar does.

**Token usage:** `rounded-t-none` / `rounded-b-lg`, `brand-purple`, `ts-aqua`,
`brand-purple-deep` — no hardcoded hex. No CalendarGrid/toolbar/nav/queue/budget
internals touched — only the page-level wrappers.

### Flags (cannot be done without touching AppLayout)
- **Edge-to-edge beyond 1800px**: capped by `<main className="max-w-[1800px]">`.
  If the user wants literal screen-edge fill on >1800px monitors, AppLayout's
  `<main>` max-w must change (out of this PR's Hub-only scope).
- Everything else (full-width to 1800px w/ gutter, nav→banner flush) is Hub-side.

### Open decision for Phase 2
- **Do queues/budgets widen too, or stay at 1400px?** Recommendation: **stay
  constrained** (dense financial tables read better narrower; only the calendar
  benefits from width). Confirm before building.
- **Gutter size**: recommend `px-4` mobile / `lg:px-6` desktop (~16/24px).
