# TRADING — PR-3 Audit: ScanFilterForm — expand filters, fix clipping, kill double-purple

**Branch:** `claude/trading-pr-3-audit`
**Date:** 2026-05-31
**Mode:** READ-ONLY.
**Three problems with `<ScanFilterForm>`** (built in PR-1, mounted on the home
Trading pill in PR-2): (1) filters are still **rolled-up popovers** (Liquidity/
Edge/Strategies collapsed) — must be **fully expanded inline**; (2) the form is
**clipped**; (3) **double purple** on home ("Launch a module" band + "Scan filters"
band stacked). Recommend the fix matching Travel's **one-purple + secondary-white**
rule.

---

## 1. Rolled-up filters + the full field list per group

`src/components/trading/ScanFilterForm.tsx` collapses three groups behind
`openPopover` state (`:35`, `setOpenPopover` toggles, `:38`):
- **Liquidity gates** — popover trigger `:129-131`, hidden content `:133-145`.
- **Edge metrics** — trigger `:`, hidden content (the 6 sliders).
- **Strategies** — trigger ("16 strats"/"N/16 strats"), hidden 16-chip grid.

Only Universe / Direction / Premium / Risk / DTE / Width render inline today; the
3 popover groups (Liquidity 4 + Edge 6 + Strategies 16) are click-to-expand.
**Full field list to lay out expanded inline:**

- **Liquidity gates (4)** (`ScannerFilters.liquidity`): `minOpenInterest` (0-5000,
  step 50), `maxBidAskSpreadPct` (1-50%), `minUnderlyingVolume` (0-10M, step 100K),
  `minLiquidityRating` (1-5 ★).
- **Edge metrics (6)** (`.edge`): `minPop` (0-100%), `minEv` (−500..1000, step 10),
  `minEvPerRisk` (−2..2, ×100 slider), `volEdge` (IV>HV / IV<HV / Any),
  `minIvRank` (0-100%), `minSentiment` (−100..100, shown −1.0..1.0).
- **Strategies (16)** (`.risk.strategies[]`, `AVAILABLE_STRATEGIES`): Iron Condor,
  Put/Call Credit Spread, Short Strangle/Straddle, Jade Lizard, Bull/Bear Call
  Spread, Bear/Bull Put Spread, Long Straddle/Strangle, Debit/Calendar/Diagonal
  Spread, Iron Butterfly (empty = all). Toggle chips + "Reset all".
- Already inline (keep): Universe (S&P/Nasdaq), `risk.direction` (ALL/BULL/BEAR/
  NTRL), `risk.premiumStance` (SELL/BUY/BOTH), `risk.riskType` (DEFINED/UNLIMITED),
  `risk.minDte`/`maxDte`, `risk.minSpreadWidth`/`maxSpreadWidth`.

(= the 18 fields. The expand just renders the 3 popover groups as visible labeled
field sections — same controls, same `onFiltersChange` writes.)

## 2. Clipping — the constraining container

`src/app/trading/page.tsx:747` — ScanFilterForm sits inside the **"Purple
Background Zone"**:
```tsx
<div className="-mx-4 lg:-mx-6 -mt-4 lg:-mt-6 px-3 lg:px-6 py-3 pb-5
                bg-brand-purple/95 backdrop-blur-sm sticky top-0 z-40">
```
The clip has two causes:
1. **`sticky top-0` + `backdrop-blur-sm`** create a **new stacking/containing
   context** pinned to the viewport top. The popovers use `absolute top-full`
   positioning (`ScanFilterForm` `:133` etc.); inside a sticky+blur ancestor they're
   trapped within the zone's box and **cut off** rather than overflowing freely.
2. The zone was sized for the **old compact one-line scanner bar** (`py-3 pb-5`);
   an **expanded** full-height form (4 + 6 + 16 fields) overflows the sticky strip.

So even with §1's inline expansion, the form will be clipped until it's **freed
from the sticky/blur zone** — moved into the normal page flow as a full-height
SectionCard (the Travel-style card sits in normal flow, not a sticky bar).

## 3. Double purple

Two `bg-brand-purple/80 text-white px-4 py-2.5 … font-semibold` bands stack on the
home launcher:
- **"Launch a module"** — `ModuleLauncher.tsx:110-111` (the SectionCard container
  band).
- **"Scan filters"** — `ScanFilterForm.tsx:42-43` (the form's own SectionCard band),
  rendered *inside* the launcher card.

→ two purples stacked (the exact issue HOME-PR-1c/1d fixed for the other modules:
the Travel `CreateTripForm` is mounted with `showHeader={false}`, and the paid
stubs render bandless under the single "Launch a module" band).

**On the dashboard (standalone, `/trading`):** "Scan filters" is the **only** band
(no outer module band) — so a purple band there is **fine** (it's the section
header). The double-purple is **home-only**.

## 4. Travel's one-purple + secondary-white rule (the established pattern)

From PR-37b, codified across the detail page: **a SectionCard has exactly ONE
brand-purple band; any nested/inner header goes LIGHT** (`bg-gray-50` /
`text-gray-500`), never a second purple. Cited:
- **Crew SectionCard** (`budgets/trips/[id]/page.tsx`): single purple band
  `bg-brand-purple/80 text-white px-4 py-2.5` "Crew (…)" (`:677`), and the inner
  **table header is light**: `<th className="px-3 py-2 text-left font-medium
  text-gray-500">` Name/Email/Status (`:693-694`), rows `hover:bg-gray-50` (`:703`).
- **Committed Budget** (`:885,901-905`): band `bg-brand-purple/80` + `<thead
  className="bg-gray-50">` + `th … text-gray-500`. Same rule.
- **Home launcher** itself already applies it: one "Launch a module" purple band,
  with the Travel form bandless inside (HOME-PR-1c).

## 5. Recommended fix (at the bar, per surface)

**(a) Expand all 18 filters inline — remove `openPopover`.** Render Liquidity (4),
Edge (6), and Strategies (16) as **visible labeled field groups** in the form body
(same controls/sliders/chips, same `onFiltersChange` writes — 0 filter-logic
change). Drop the `openPopover` state + the 3 popover triggers/`absolute`
containers. Lay out as responsive sections (e.g. a grid: Universe+Direction+
Premium+Risk row; DTE/Width row; Liquidity-gates group; Edge-metrics group;
Strategies chip-grid; Scan CTA). Nothing collapsed.

**(b) Free the form from the clipping wrapper.** On the dashboard, **move
`<ScanFilterForm>` out of the `sticky top-0 z-40 backdrop-blur` Purple Zone** into
normal page flow (a full-height SectionCard, like every Travel section). Either
remove the sticky/blur from the scanner slot or render the form below it. With no
`absolute` popovers (per (a)) and no sticky ancestor, nothing clips. (Keep the ROW
2 metrics bar wherever Alex wants; it's separate.)

**(c) Kill double purple per the Travel rule:**
- **Home launcher (Trading pill):** the inner "Scan filters" band must NOT be a 2nd
  purple. **Recommend: mount ScanFilterForm bandless** under the single "Launch a
  module" band — add a `showHeader?: boolean` prop to ScanFilterForm (default
  true), and pass `showHeader={false}` from the launcher (exactly the
  `CreateTripForm` HOME-PR-1c pattern). The 18 expanded filter groups still get
  their **light** group sub-labels (`text-[10px] uppercase text-text-muted`, the
  secondary-white treatment), so the form is legible under the one purple band.
- **Dashboard (`/trading`, standalone):** keep the "Scan filters" purple band
  (`showHeader` defaults true) — it's the only band, the section header. Correct
  per the one-purple rule.

This mirrors Travel exactly: one purple band per surface; inner structure is
light/secondary.

## 6. Scope

- **`src/components/trading/ScanFilterForm.tsx`** — remove `openPopover`; render the
  3 groups expanded inline (labeled, light sub-headers); add `showHeader?: boolean`
  (default true) → bandless when false (the CreateTripForm pattern). **0
  filter-logic change** (same 18 fields, same `onFiltersChange`, same
  `applyFilters` downstream).
- **`src/app/trading/page.tsx`** — free the form from the `sticky/blur` Purple Zone
  (move to normal flow / drop sticky on the scanner slot). Keep `showHeader` default
  (purple band shows standalone).
- **`src/components/home/ModuleLauncher.tsx`** — pass `showHeader={false}` to the
  Trading `<ScanFilterForm>` (one "Launch a module" band only).
- **0 endpoint, 0 schema, 0 deps.** ScanFilterForm stays the shared component
  (dashboard + home), the convergence endpoint + `applyFilters` untouched.

## Sign-off items
1. **Expand inline (remove popovers)** — confirm all 18 filters visible at once
   (recommended) vs keeping a couple of dense groups collapsible. The task says
   fully expanded → recommend full expansion.
2. **Free from sticky zone** — move ScanFilterForm to normal page flow on the
   dashboard (recommended) vs enlarging the sticky zone. Confirm the sticky scanner
   bar is no longer required (it was for the compact strip).
3. **Home band** — `showHeader={false}` (bandless under "Launch a module",
   recommended, matches CreateTripForm) vs a light/secondary inner "Scan filters"
   label. Confirm.
4. **Dashboard band** — keep the single "Scan filters" purple band standalone
   (recommended). Confirm.
5. **Layout density** — expanded 18 fields is a tall form; confirm a multi-column
   grid is acceptable (vs the old one-line bar).

---

**READ-ONLY audit. No implementation performed.**
