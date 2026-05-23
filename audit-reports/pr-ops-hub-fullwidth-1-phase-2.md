# PR-Ops-Hub-Fullwidth-1 — Phase 2 Build

Hub is now full-width (capped only by AppLayout's 1800px `<main>`) and the
nav → banner → calendar reads as one continuous block flush from the nav down.
Two edits, both in `src/app/hub/page.tsx`. No CalendarGrid internals, no
AppLayout edit. Tokens only.

## (1) + (2) Full width + closed nav→banner gap — container `hub/page.tsx:398`

**Before:** `<div className="p-6 lg:p-8 max-w-[1400px] mx-auto">`
**After:**  `<div className="px-4 lg:px-6 pt-0 pb-6">`

- `max-w-[1400px] mx-auto` **removed** → content fills the width (banner,
  calendar, queues, budgets — all siblings here — go wide, per Alex's choice).
  Capped by the untouched `<main className="max-w-[1800px] mx-auto">`
  (`AppLayout.tsx:354`).
- `p-6 lg:p-8` → `px-4 lg:px-6` keeps a **small bezel gutter** (~16px / 24px) so
  content doesn't jam the screen edge (not edge-to-edge).
- Top padding → **`pt-0`** closes the nav→banner gap (the gap was 100% this
  container's top padding; `<main>` and the hub root add none). `pb-6` keeps a
  finished bottom. **No AppLayout edit, no other-page impact** — the change lives
  entirely in the Hub page.

## (3) Banner flush-top — `hub/page.tsx:406`

**Before:** `… p-3 md:p-4 rounded-t-lg border-t-2 border-t-ts-aqua border-b-[3px] border-b-brand-purple-deep`
**After:**  `… p-3 md:p-4 rounded-t-none border-t-2 border-t-ts-aqua border-b-[3px] border-b-brand-purple-deep`

- `rounded-t-lg` → **`rounded-t-none`**: square top so the banner butts flush
  against the nav with no floating corner notches.
- **Preserved (Connect-1):** the aqua top-rule `border-t-2 border-t-ts-aqua` (now
  the nav→banner divider), the `bg-brand-purple` body, and the purple seam
  `border-b-[3px] border-b-brand-purple-deep` joining the calendar.
- **Calendar wrapper untouched** (`:439` — `mb-6 -mt-px rounded-b-lg
  overflow-hidden`): the block's outer **bottom** corners stay rounded and the
  banner→calendar flush join from Connect-1 is intact.

Net visual: nav (flush top) → aqua rule → banner → purple seam → calendar →
rounded bottom = one continuous full-width command-center block, desktop + mobile
(no `md:` gating on width or flush-top — consistent both breakpoints).

## Constraints check
- ✅ `hub/page.tsx` ONLY — exactly two lines (`:398` container, `:406` banner).
  CalendarGrid internals / toolbar / AppLayout / nav / Connect-1 calendar wrapper
  all untouched.
- ✅ Small bezel gutter kept (`px-4 lg:px-6`) — not literally edge-to-edge.
- ✅ 1800px `<main>` cap respected — AppLayout not touched.
- ✅ Desktop + mobile both full-width + flush-top.
- ✅ Tokens only: `brand-purple`, `ts-aqua`, `brand-purple-deep`,
  `rounded-t-none`. No hardcoded hex.
- ✅ No fallback, no schema.
- ✅ `npx tsc --noEmit` → exit 0. ESLint `hub/page.tsx` → 0 errors (17
  pre-existing warnings, unrelated).

## NOTE for Alex's eyeball
Everything went wide as chosen — including the **unscheduled task queues and the
budget tables**. On a wide monitor those dense rows now stretch the full ~1800px,
which can make them harder to scan (long horizontal eye travel). If they feel too
stretched, constraining **just** those blocks (wrap queues+budgets in a
`max-w-[1400px] mx-auto` while the calendar stays full-width) is a cheap
follow-up — flagging only; built everything-wide per the brief.

## Not verified
`/hub` is auth-gated (307 → `/`) in this headless env, so the full-width fill +
flush nav→banner join need a manual visual pass in an authenticated browser at
desktop and mobile widths.
