# HOME — PR-7 Implementation: alternating full-width breathing bands for the 6 module sections

**Branch:** `claude/home-pr-7`
**Date:** 2026-06-01
**Scope:** Give the 6 module sections breathing room — wrap each in a **full-width
band with alternating background** (white / light-gray) + generous vertical padding,
so they read as distinct breathing sections (the old layout's spacing + color
rhythm). **Spacing/wrapper only** — the module content, forms, and purple band
headers are 100% untouched (the opposite of the reverted PR-4). 1 file + report.
**0 endpoint, 0 schema, 0 deps.**

**Design-skill grounding** (`SKILL.md`): "Spatial composition — generous negative
space… controlled density"; "dominant colors with sharp accents." Full-width
alternating bands give each module its own rhythm and separation **without** a
second purple band — the dominant brand-purple stays one-per-card; the separation
is the neutral white/gray alternation.

---

## STEP 1 — Current state audited

- **PR-6 merge status: MERGED.** `page.tsx` is **171 lines**; the old marketing
  sections are **already gone** — Three Pillars / Features Grid / AI Trading
  Pipeline / Pricing / the `FEATURES` const all 0 refs. So **STEP 2 (removal) is a
  no-op** — nothing to remove.
- **Module stack (before):** `ModuleLauncher.tsx` rendered all 6 cards inside a
  single `<section className="py-10 bg-bg-terminal">` with `<div … space-y-3>`
  (`:139-140`) — tight `0.75rem` gaps on a uniform terminal background, no
  per-module breathing or color separation.
- **Wrapper home:** the alternating band belongs **around each module card** in
  `ModuleLauncher`'s render (the `MODULES.map`), not in `page.tsx` (the launcher is
  a single mount at `page.tsx:74`).

## STEP 2 — Old marketing removal

**Skipped — already gone (PR-6 merged).** Verified: `page.tsx` has no Three
Pillars / Features Grid / AI Trading Pipeline / Pricing / `FEATURES` (all 0 refs).
`page.tsx` is **not in this PR's diff.**

## STEP 3 — Alternating breathing bands

`ModuleLauncher.tsx` render restructured: the single `<section> + space-y-3` wrapper
is replaced with a **per-module full-width `<section>`** (`:145-159`):
```tsx
{MODULES.map((m, i) => (
  <section className={`w-full py-10 ${i % 2 === 1 ? 'bg-bg-row' : 'bg-white'} border-b border-border`}>
    <div className="max-w-7xl mx-auto px-4 lg:px-8">
      <div className="rounded-lg overflow-hidden border border-gray-200/50 shadow-sm">
        …the SAME purple band header + bg-white p-4 body + renderBody(m)…
      </div>
    </div>
  </section>
))}
```
- **Full-width alternating background:** even (Travel/Bookkeeping/Operations) =
  `bg-white`; odd (Trading/Tax/Compliance) = `bg-bg-row` (light gray) — the
  established marketing-section tokens. A subtle `border-b border-border` separates
  the bands.
- **Generous vertical padding:** `py-10` (2.5rem top/bottom) per band — the
  breathing rhythm.
- **Card centered** with the existing `max-w-7xl mx-auto px-4 lg:px-8`.
- **One purple band per card stays** — the card's `bg-brand-purple/80` header is
  unchanged; the separation comes from the **full-width bg**, not a second purple.

**The card content is byte-identical** — the diff (verified) changes only the
outer container; the purple band header (name + Free/Paid tag), the `bg-white p-4`
body, and `renderBody(m)` (which returns the Travel `CreateTripForm`, the admin
Trading `ScanFilterForm`, or the stub) are unchanged. `renderBody`, `isAdmin`,
`gateGuestCreate`, the scan state/ref, and `onRequireAuth` are all intact.

## STEP 4 — Verify

- **6 alternating breathing bands:** each module is its own full-width `<section>`
  (`bg-white` ↔ `bg-bg-row`) with `py-10` padding — distinct, breathing. ✅
- **Module content + forms UNCHANGED:** `renderBody` + `<CreateTripForm>` +
  `<ScanFilterForm>` + the "Launch {Module} Module" stub + `isAdmin`/
  `gateGuestCreate` all present and untouched (diff = wrapper-only). ✅
- **Old marketing + Plans gone:** confirmed already removed by PR-6 (page.tsx not in
  diff). ✅
- **One purple band per card, no double-purple:** the only `bg-brand-purple/80` band
  is the card header (one per iteration); the bands are neutral white/gray. ✅
- **`CreateTripForm` (/budgets/trips) + `ScanFilterForm` (/trading) untouched:** not
  in diff. ✅

## Hard-constraint compliance

| Constraint | Status |
|---|---|
| Spacing/wrapper + old-marketing-removal ONLY; don't alter content/forms/band headers | ✅ diff = outer wrapper only; card markup + `renderBody` byte-identical |
| Alternating full-width bg bands; one purple band per card | ✅ `bg-white`↔`bg-bg-row` sections; card purple band unchanged |
| Dead consts removed only after grep zero-other-use; register modal kept | ✅ n/a (PR-6 already did it); page.tsx untouched, modal intact |
| Shared components (/budgets/trips, /trading) untouched | ✅ not in diff |
| 0 endpoint, 0 schema, 0 deps | ✅ |
| `tsc --noEmit` | ✅ exit 0 |
| eslint | ✅ ModuleLauncher **0 problems** |
| git diff scoped | ✅ `ModuleLauncher.tsx` only (+ this report; page.tsx not needed — PR-6 merged) |

---

## Result
The 6 module sections now each sit in their **own full-width band** with an
**alternating white / light-gray background** and `py-10` generous padding — a
breathing, distinct rhythm (the old marketing spacing) — while keeping **one purple
band per card** (the separation is the neutral bg, not a second purple). The module
cards' content, the Travel `CreateTripForm`, the Trading `ScanFilterForm`, the 4
stubs, and all logic are 100% unchanged (the diff is wrapper-only). The old
marketing + Plans were already removed by HOME-PR-6 (no-op here). Shared components
on `/budgets/trips` and `/trading` are untouched. tsc + lint clean; diff scoped to
`ModuleLauncher.tsx`.
