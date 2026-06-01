# TRAVEL — PR-37b Implementation: trips index table chrome matches detail-page template

**Branch:** `claude/travel-pr-37b`
**Date:** 2026-05-31
**Scope:** Aesthetic token alignment of the trips index (`budgets/trips/page.tsx`)
to the **detail page** (`budgets/trips/[id]/page.tsx`, the app-wide template) — so
there's **one purple** (the section band) + a **light table header**
(`bg-gray-50`/`text-gray-500`), not the prior two-shades-of-purple. Token
alignment, **not** a redesign. Detail page is the source of truth — matched, not
modified. Per `audit-reports/travel-pr-37-audit.md`. 1 file + this report.
**0 schema, 0 deps.**

**Design-skill grounding** (`/mnt/skills/public/frontend-design/SKILL.md`): the
skill mandates a **cohesive design language via consistent tokens** and "dominant
colors with sharp accents" over "timid, evenly-distributed palettes" (SKILL.md:31).
Two stacked purples (band + table header) is exactly the timid duplication the
skill warns against; collapsing to **one dominant purple (section band) + a neutral
light table header** is the documented detail-page language. This is consistency
adoption, not invention.

---

## STEP 1 — Both table-header styles cited

**TARGET — detail page** (`[id]/page.tsx`, Committed Budget + Crew tables):
- Card: `rounded-lg overflow-hidden border border-gray-200/50 shadow-sm`
  (`:884`, `:676`).
- Band: `bg-brand-purple/80 text-white px-4 py-2.5 text-sm font-semibold` (`:885`).
- **Table head: `<thead className="bg-gray-50">`** (`:901`) with
  **`<th className="px-3 py-2 text-left font-medium text-gray-500">`** (`:903-905`,
  Crew `:693-694`) — the **light** header.
- Body: `<tbody className="divide-y divide-gray-100">` (`:910`), rows
  `hover:bg-gray-50` (`:917`, `:703`).

**WRONG — index "All Trips" before** (`page.tsx`):
- Card: `bg-white border border-border` (`:336`) — flat, no rounded/shadow.
- Band: `bg-brand-purple text-white px-4 py-2` (`:337`) — full-strength purple,
  `py-2`.
- **Table head: `<thead className="bg-brand-purple-hover text-white">`** (`:348`)
  with `<th className="px-3 py-2 … font-medium">` (`:350-357`) — **a second
  purple shade** stacked under the band.
- Body: `divide-y divide-border` (`:360`), rows `hover:bg-bg-row` (`:363`).

**Exact class diff (table header):**
`bg-brand-purple-hover text-white` → **`bg-gray-50`**; `th … font-medium` →
`th … font-medium **text-gray-500**`; `divide-border` → `divide-gray-100`;
`hover:bg-bg-row` → `hover:bg-gray-50`.

## STEP 2 — Index table header aligned to the light style

`page.tsx` All Trips table (before→after):
- `<thead className="bg-brand-purple-hover text-white">` →
  **`<thead className="bg-gray-50">`**.
- all 8 `<th … font-medium>` → `<th … font-medium **text-gray-500**>`.
- `<tbody className="divide-y divide-border">` →
  **`divide-y divide-gray-100`**.
- row `className="hover:bg-bg-row cursor-pointer"` →
  **`hover:bg-gray-50 cursor-pointer`**.

The section **band stays the single deep purple** (now `bg-brand-purple/80`, see
STEP 3) — result: one purple (band) + a light gray table header, matching the
detail page's Committed Budget table exactly.

## STEP 3 — SectionCard chrome consistency (both index sections)

Both index sections ("Plan a new trip", "All Trips") now use the **same
SectionCard chrome** as every detail-page section:
- Wrapper `bg-white border border-border` → **`rounded-lg overflow-hidden border
  border-gray-200/50 shadow-sm`** (both, matching `[id]:884`).
- Band `bg-brand-purple text-white px-4 py-2` → **`bg-brand-purple/80 text-white
  px-4 py-2.5 text-sm font-semibold`** (both, matching `[id]:885`).
- Body carries `bg-white` (the wrapper no longer sets it): form body
  `p-4`→**`bg-white p-4`**; All Trips empty-state `p-8`→**`bg-white p-8`**; table
  container `overflow-x-auto`→**`overflow-x-auto bg-white`** (matching the
  detail Committed Budget table's `overflow-x-auto bg-white`, `[id]:bg-white`).

Verified: index now has **2** `rounded-lg … gray-200/50 shadow-sm` cards + **2**
`bg-brand-purple/80 … py-2.5` bands — identical tokens to the detail page.

## STEP 4 — Create-trip form in-template

The 37a form's inputs already used `border border-border rounded px-… text-sm`
(the detail-page input token, cf. `[id]:757-763`) and the **`bg-brand-gold
hover:bg-brand-gold-bright`** CTA (the detail-page primary-CTA token). With STEP 3
giving it the SectionCard chrome + `bg-white` body, the form now reads as a
first-class detail-page section. The trip-type toggle uses the brand-purple
active / `border-border` idle pill pattern (consistent with the detail page's
filter pills). No structural change (37a) — only chrome.

## Hard-constraint compliance

| Constraint | Status |
|---|---|
| Token alignment to the detail template — not a new aesthetic | ✅ all tokens copied from `[id]/page.tsx` |
| Section bands = single deep purple; table headers = light | ✅ band `bg-brand-purple/80`; head `bg-gray-50`/`text-gray-500` |
| No change to index structure (37a), endpoint, or data | ✅ only className tokens changed; logic/markup structure intact |
| Detail page is source of truth — match, don't modify | ✅ `[id]/page.tsx` **not in diff** |
| 0 schema, 0 deps | ✅ |
| `tsc --noEmit` | ✅ exit 0 |
| eslint | ✅ index page **0 problems** |
| git diff scoped | ✅ `budgets/trips/page.tsx` only (+ this report) |

---

## Result
The trips index now speaks the detail page's documented design language: both
sections use the SectionCard chrome (`rounded-lg`, `border-gray-200/50`,
`shadow-sm`, the single `bg-brand-purple/80` band, `bg-white` body), and the All
Trips table header is the **light** `bg-gray-50`/`text-gray-500` style with
`divide-gray-100` + `hover:bg-gray-50` rows — so there's **one purple** (the
section band) and a white-ish table header, exactly like the detail-page Committed
Budget/Crew tables. The two-shades-of-purple stacking is gone. The create-trip form
reads as a first-class detail-page section. The detail page (source of truth) is
untouched. tsc clean; index lints clean; diff scoped to one file.
