# HOME — PR-8 Implementation: CPA disclaimer band → hero purple background with light text

**Branch:** `claude/home-pr-8`
**Date:** 2026-06-01
**Scope:** Change the CPA disclaimer band's background to the dark hero purple
(matching the Hero), with light text for readability. **Background + text color
only.** 1 file + report. **0 schema, 0 deps.**

---

## STEP 1 — Both cited

- **Hero** (`page.tsx:46`): `<section className="bg-brand-purple text-white pb-12
  pt-8">` — the dark brand-purple background; its muted subtext uses
  **`text-text-faint`** (the Hero's "Plan your life." line + tagline treatment, the
  readable-on-purple muted-light color).
- **CPA Disclaimer** (`page.tsx:77-79`): `<section className="bg-bg-row py-8">`
  (light/cream) with `<p className="text-xs text-text-muted leading-relaxed">`.

The disclaimer should use the **same `bg-brand-purple` as the Hero** + the Hero's
`text-text-faint` muted-light text.

## STEP 2 — Applied

`page.tsx` (before → after):
- **`:77`** band background: `bg-bg-row` → **`bg-brand-purple`** (the exact Hero
  purple).
- **`:79`** text color: `text-text-muted` → **`text-text-faint`** (the Hero's
  muted-light subtext treatment, readable on the dark purple).

**Unchanged:** the copy ("Temple Stuart is not a CPA firm…"), the layout
(`max-w-3xl mx-auto px-4 lg:px-8 text-center`), the padding (`py-8`), and the type
(`text-xs leading-relaxed`). Diff = exactly 2 lines (the two color classes).

## Hard-constraint compliance

| Constraint | Status |
|---|---|
| Background + text color only; no copy/layout/padding change | ✅ diff = 2 class swaps; copy/`py-8`/`max-w-3xl`/`text-center`/`text-xs` intact |
| Same purple as the Hero | ✅ `bg-brand-purple` (Hero's exact token) |
| Nothing else on the page touched | ✅ only the CPA section's 2 lines |
| 0 schema, 0 deps | ✅ |
| `tsc --noEmit` | ✅ exit 0 |
| eslint | ✅ page 0e/3w == main → **+0/+0** (the 3 warnings pre-existing) |
| git diff scoped | ✅ `page.tsx` (+ this report) |

---

## Result
The CPA disclaimer band now sits on the dark **hero purple** (`bg-brand-purple`,
matching the Hero) with **light muted text** (`text-text-faint`, the Hero's subtext
treatment) so it reads on the dark background. Copy, layout, and padding are
unchanged — a pure background + text-color swap. tsc + lint clean; diff scoped to
`page.tsx`.
