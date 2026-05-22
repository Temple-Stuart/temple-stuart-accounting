# PR-OPS-CAL-2 — Universal calendar block readability (Step A)

Builds on the CAL-1 audit. Three **universal** readability fixes to the timed-
block render in `src/components/shared/CalendarGrid.tsx` — they improve **all four**
CalendarGrid surfaces (Hub, Trading, both Trips) without changing layout structure
on any of them. Not prop-gated (a wrapped time range is ugly everywhere). No token
adoption (colors unchanged — that's a later Hub-only PR). Built off `main` after
rebasing onto the merged DS-2 (`--ts-aqua #14e0c8` confirmed at `globals.css:25`).

Re-verified the block region against live source: `block.map` at
`CalendarGrid.tsx:429`, inner content `px-1.5 py-1` (was :445), title `truncate`
(:446), time-range div with **no** truncate (was :447-452), `isRecurring` on the
type (:19) unused by the component.

---

## 1. The truncate fix (the 4-line-wrap killer)

The time-range element — the `<div>` that renders
`formatTime12h(start) — formatTime12h(end)` — had no overflow handling, so an
~18-char "9:00 AM — 10:00 AM" wrapped to ~4 lines in a ~41px mobile column.

**Changed** (now ~`:448`): added `truncate` to that div:
```diff
- <div className="text-[10px] opacity-80 leading-tight mt-0.5">
+ <div className="text-[10px] opacity-80 leading-tight mt-0.5 truncate">
    {formatTime12h(block.event.startTime)}
    {block.event.endTime ? ` — ${formatTime12h(block.event.endTime)}` : ''}
  </div>
```
The time range now stays one line and ellipsizes instead of wrapping — the single
biggest readability win in the audit, and it applies on every surface.

---

## 2. Roomier padding

**Before:** inner content `px-1.5 py-1` (6px × 4px).
**After:** `px-2 py-1.5` (8px × 6px) — more breathing room, calmer feel.

```diff
- <div className="px-1.5 py-1 h-full overflow-hidden">
+ <div className="px-2 py-1.5 h-full overflow-hidden">
```

**Height logic untouched** — `height = max(duration×40, 60px)` (`:431`),
`HOUR_HEIGHT = 40`, `MIN_EVENT_HEIGHT = 60` are not modified. Only internal
padding changed.

**60px-min short-block check:** with `py-1.5` (12px vertical total) a 60px block
leaves ~48px of inner height. Title (11px, `leading-tight` ≈ 13px) + time line
(10px ≈ 12px, `mt-0.5` = 2px) ≈ **27px** — fits comfortably in 48px. Optional
extra lines (location/details) clip via the existing `overflow-hidden` exactly as
before — no overflow regression, no tension for the title+time case.

---

## 3. Recurrence badge (quiet signal, all text kept)

Uses the existing `isRecurring` hook (`CalendarEvent.isRecurring`, `:19`), which
the component never read before. Rendered as a small Unicode **`↻`** glyph (no new
icon dependency) in the block's top-right corner:

```tsx
{block.event.isRecurring && (
  <span
    className="absolute top-0.5 right-1 text-[10px] leading-none opacity-60 pointer-events-none select-none"
    aria-label="Recurring"
    title="Recurring"
  >
    ↻
  </span>
)}
```

- **All text kept (locked decision):** the badge is added as a sibling of the
  inner content div, so the full title + time stay on every block including
  repeats — the badge is a "this recurs" signal, not a text replacement.
- **Icon:** Unicode `↻` (U+21BB), inheriting the block's white text at
  `opacity-60` so it's low-contrast and doesn't crowd the title. `pointer-events-none`
  keeps it from intercepting the block's click; `aria-label`/`title` give it
  meaning for AT/hover.
- **Tightest-column case (badge yields to title):** the badge is **absolutely
  positioned**, so it takes **zero width from the title row** — the title keeps
  the full block width and truncates independently. In a ~41px column the title
  uses the entire row and ellipsizes; the badge simply overlays the top-right
  corner. In practice recurring content is short routines ("Sleep", "Workout",
  "Breakfast"), whose titles don't fill the width, so the corner sits in
  whitespace; long titles are typically non-recurring. The title is never
  shrunk to make room for the badge — the badge yields, the title wins.
- **Positioning context:** the outer block div is already `absolute` (`:441`)
  with `overflow-hidden`, so the badge anchors to the block corner and is clipped
  to the block — no `relative` change needed.

---

## 4. Layout STRUCTURE untouched on all 4 surfaces

`git status` shows only `src/components/shared/CalendarGrid.tsx` changed; the diff
is two hunks (`@@ -442` and `@@ -460`), both inside the timed-block render. A grep
of the diff for `HOUR_HEIGHT`, `for (let i = 0; i < 7`, `flex-1`, `maxHeight`,
`grid-cols-7`, `scrollRef`, `MIN_EVENT_HEIGHT` returned **0 changed lines** —
confirming I did **not** touch:
- the 7-column flex layout or the `for (i<7)` `weekDays` loop,
- `HOUR_HEIGHT` (40) or the `height` formula (`:431`),
- the 600px scroller (`maxHeight: '600px'`) or the auto-scroll effect,
- the Month view (`grid-cols-7`).

Because the changes are purely block-internal, **Trading and both Trips pages
benefit equally** (their time blocks also stop wrapping and gain padding; trip
itinerary events with `isRecurring` get the badge) while their **structure is
identical**.

---

## 5. No token adoption

Colors are unchanged this PR. The block still uses the existing
`config.badge`/`config.dot` source colors and `text-white`; no `--ts-*` /
`bg-ts-aqua` utilities were introduced. Color migration is the later Hub-only PR.

---

## 6. Verification

- **`tsc --noEmit`:** ✓ exit 0.
- **`next build`:** ✓ `Compiled successfully in 44s`, "Checking validity of
  types" passed; the build then errored only on the **unrelated** route
  `/api/admin/backfill-transaction-fields` (`PLAID_CLIENT_ID and PLAID_SECRET
  must be set`) — the same sandbox-env limit as every prior PR (the `build`
  script also chains `prisma migrate deploy`, needing an unreachable
  `DATABASE_URL`). Not produced by this change; CalendarGrid compiled.

No fallback logic, no schema, no structural change. Surgical: time-line truncate,
block padding, recurrence badge — universal across all four surfaces.
