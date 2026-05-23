# PR-Ops-Hub-Depth-1 — Phase 2 Build

3-step purple depth (nav darkest → banner medium → toolbar lightest) achieved by
**lightening the banner** (nav untouched), plus the banner+calendar broken out to
a full-bleed bar. Three changes. Tokens only. `tsc` + lint clean.

## (1) Banner → MEDIUM purple — `hub/page.tsx:405`

`bg-brand-purple` → **`bg-brand-purple-hover`** (#4e3e85, via `--ts-purple-light`).
⚠️ Used `brand-purple-hover`, **NOT** `brand-purple-light` (which is #7b6baa
lavender). Preserved: `border-t-2 border-t-ts-aqua` (aqua rule / nav divider),
`border-b-[3px] border-b-brand-purple-deep` (calendar seam), `rounded-t-none`,
`pt-0` (via the container), `mb-0`.

Resulting gradient: nav `#3b2d6b` (darkest, untouched) → banner `#4e3e85`
(medium) → toolbar wash `#eae7f2` (lightest).

## (2) Active view button → MEDIUM purple — `CalendarGrid.tsx:306`

```
const viewBtnActive = enableHubChrome ? 'bg-brand-purple-hover text-white shadow-sm' : 'bg-white shadow-sm text-text-primary';
```
- Swap is **inside the `enableHubChrome ? … : …` Hub branch only** — the
  `bg-brand-purple` → `bg-brand-purple-hover` change is in the first arm.
- **No-op proof for Trading/Trips:** they don't pass `enableHubChrome` (confirmed
  in the prior audits — none of `trading/page.tsx`, `budgets/trips/page.tsx`,
  `budgets/trips/[id]/page.tsx` pass it), so `viewBtnActive` resolves to the
  unchanged `: 'bg-white shadow-sm text-text-primary'` branch — byte-identical.
  `viewBtnInactive` (`:307`) untouched. So the active Day/Week/Month button is
  medium purple on Hub and white everywhere else, exactly as before for non-Hub.

## (3) Full-bar breakout — `hub/page.tsx:405` (banner) + `:438` (calendar wrapper)

Both got the **same** negative margin **`-mx-4 lg:-mx-6`** to cancel the
container's `px-4 lg:px-6` gutter (`hub/page.tsx:398`) and go edge-to-edge:
- Banner: `-mx-4 lg:-mx-6 mb-0 bg-brand-purple-hover … rounded-t-none …`
- Calendar wrapper: `-mx-4 lg:-mx-6 mb-6 -mt-px rounded-b-lg overflow-hidden`

Same negative margin on both ⇒ identical width ⇒ the Connect-1 seam
(`-mt-px` / `overflow-hidden` / `rounded-b-lg`) stays aligned. Queues + budget
panels get **no** negative margin → they keep the gutter. Result: nav (full-bleed)
→ banner (full-bleed, medium) → calendar (full-bleed) as one continuous
edge-to-edge bar; content below stays guttered.

## Constraints check
- ✅ Medium shade = `bg-brand-purple-hover` (not `-light`). Tokens only, no hex.
- ✅ **AppLayout / nav untouched** — depth comes from lightening the banner.
- ✅ **Connect-1 + Fullwidth-1 preserved**: `-mt-px` / `overflow-hidden` /
  `rounded-b-lg` seam intact, `rounded-t-none` + `pt-0` intact, no flush-join
  regression. Banner + calendar share the same `-mx` so the seam width matches.
- ✅ Queues/budgets keep the gutter (no `-mx` added).
- ✅ CalendarGrid active-button change is gated → Trading/Trips byte-identical.
- ✅ No fallback, no schema.
- ✅ `npx tsc --noEmit` → exit 0. ESLint (both files) → 0 errors (19 pre-existing
  warnings, unrelated).

## Note
Per the audit's 1800px flag: on monitors **>1800px** the banner full-bleeds only
to `<main>`'s `max-w-[1800px]` cap while the nav bg extends to the full viewport,
so they align at the edges only up to 1800px — an existing shared-shell behavior,
not fixable without touching AppLayout.

## Not verified
`/hub` is auth-gated (307 → `/`) headless, so the depth gradient + full-bleed bar
need a manual visual pass in an authenticated browser (desktop + mobile).
