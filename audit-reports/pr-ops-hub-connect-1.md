# PR-Ops-Hub-Connect-1 — flush-connect command-center banner to calendar

Banner + calendar now read as ONE continuous block — fully flush, zero gap — on
BOTH desktop and mobile. The hard purple-deep edge is the single join. Hub
page-level only (`src/app/hub/page.tsx`); CalendarGrid internals untouched.

## Audit — what created the gap + the double-boundary seam

1. **Banner** (`hub/page.tsx:406`, pre-fix):
   `mb-0 md:mb-6 … rounded-lg md:rounded-none border-t-2 border-t-ts-aqua border-b-[3px] border-b-brand-purple-deep`
   - **Gap source:** `md:mb-6` → 24px margin below the banner on desktop (mobile
     was already `mb-0`).
   - Own card boundary: rounded all corners on mobile / square on desktop, with a
     3px purple-deep bottom border.
2. **Calendar** (`hub/page.tsx:431`, pre-fix): wrapper `<div className="mb-6">`
   around `<CalendarGrid>`. The wrapper had no border, but the **CalendarGrid root
   is its own card** — `CalendarGrid.tsx:331`:
   `bg-white {rounded-lg|rounded} border border-border overflow-hidden shadow-sm`
   → a 1px `border-border` on **all** sides (incl. top) + rounded top corners.
   - **Seam source:** even flush, the banner's 3px purple bottom edge sat above
     the calendar's own 1px top border + rounded top corners → two distinct cards.
3. **Outer container** (`hub/page.tsx:398`): `p-6 lg:p-8 max-w-[1400px] mx-auto` —
   page-level edge breathing room. **Kept intact.**

So the separation was BOTH a desktop margin AND each element being its own
bordered/rounded card with its own top/bottom edge.

## The fix (page-level only, both breakpoints, no `md:` gating on the join)

**Banner** (`hub/page.tsx:406`):
- `mb-0 md:mb-6` → **`mb-0`** (zero gap on desktop AND mobile).
- `rounded-lg md:rounded-none` → **`rounded-t-lg`** (rounded TOP corners only;
  bottom corners square so they join the calendar).
- Kept `border-t-2 border-t-ts-aqua` (aqua top-rule crowning the block) and
  `border-b-[3px] border-b-brand-purple-deep` (the purple divider = the seam),
  `bg-brand-purple`, `p-3 md:p-4`.

**Calendar wrapper** (`hub/page.tsx:431`):
- `mb-6` → **`mb-6 -mt-px rounded-b-lg overflow-hidden`**:
  - `rounded-b-lg` → rounded BOTTOM corners (the combined block's bottom).
  - `overflow-hidden` → clips CalendarGrid's own rounded TOP corners to square so
    they meet the banner flush (CalendarGrid's `rounded`/`rounded-lg` is visually
    overridden by the clip — its markup is **not** edited).
  - `-mt-px` → tucks the calendar card's 1px top border under the banner's
    purple-deep edge, so the seam reads as a **single** purple divider, not a
    double border line.

**Combined result:** rounded outer corners (top from banner `rounded-t-lg`,
bottom from wrapper `rounded-b-lg`), square flush seam in the middle joined by the
purple-deep divider — one card. Applied identically on desktop and mobile (no
`md:` on the connection).

## Constraints honored
- ✅ **Both desktop and mobile** get the connected look (`mb-0`, `rounded-t-lg`,
  `rounded-b-lg` are unconditional — no `md:` gating on the join).
- ✅ **CalendarGrid internals / toolbar / nav / budget panels / unscheduled
  queues UNTOUCHED.** Only two lines changed: banner bottom margin+radius
  (`:406`) and the calendar card-wrapper top margin+radius (`:431`). The
  calendar's grid/blocks/toolbar render exactly as before.
- ✅ **Page-level breathing room preserved** — outer `p-6 lg:p-8` container
  (`:398`) unchanged.
- ✅ **Tokens only**: `rounded-t-lg`, `rounded-b-lg`, `brand-purple`,
  `brand-purple-deep`, `ts-aqua`. No hardcoded hex.
- ✅ No fallback, no schema.
- ✅ `npx tsc --noEmit` → exit 0. ESLint `hub/page.tsx` → 0 errors (17
  pre-existing warnings, unrelated).

## Note / side effect
`overflow-hidden` on the wrapper clips CalendarGrid's subtle `shadow-sm`, which
reinforces the single-block look (the banner has no shadow, so the combined block
now reads as one flat connected card rather than two shadowed cards). No internal
behavior changes (CalendarGrid root already has its own `overflow-hidden`; its
scroll area and the native timezone `<select>` are unaffected).

## Not verified
`/hub` is auth-gated (307 → `/`) in this headless env, so the flush join needs a
manual visual pass in an authenticated browser at both desktop and mobile widths.
