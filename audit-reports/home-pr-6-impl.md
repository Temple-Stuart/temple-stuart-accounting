# HOME — PR-6 Implementation: remove old marketing sections + Plans below the 6 module bars

**Branch:** `claude/home-pr-6`
**Date:** 2026-06-01
**Scope:** Remove the 4 old marketing sections below the 6 module bars — the Three
Pillars 4-box row, the Capabilities/Features grid, the "What's Inside" AI-pipeline,
and the Plans/pricing section. The 6 module sections **ARE the vision now**; the old
marketing was the prior articulation. **The ModuleLauncher + its forms are 100%
UNTOUCHED** (the opposite of the reverted PR-4). Removal only. 1 file + report.
**0 endpoint, 0 schema, 0 deps.**

---

## STEP 1 — The 4 sections to remove (cited)

`src/app/page.tsx` (LandingPage), between `<ModuleLauncher>` (`:87`) and
`{/* CPA Disclaimer */}` (`:412`):
- **Three Pillars** (4-box row) — `:89-207`.
- **Features Grid** (Capabilities, uses the `FEATURES` const `:9`) — `:209-226`.
- **AI Trading Pipeline Highlight** ("What's Inside") — `:229-255`.
- **Pricing** (Plans) — `:257-410`.

**Before:** `<ModuleLauncher … />` (`:87`). **After:** `{/* CPA Disclaimer */}`
(`:412`). The **`<ModuleLauncher>` mount + its forms are SEPARATE** from these
sections — it's a single component mount at `:87`, entirely above the removed block
(verified `s.find("<ModuleLauncher") < removalStart`), so removing the marketing
sections cannot touch the 6 module bars or the Travel/Trading forms.

## STEP 2 — Removed

`page.tsx`: deleted the block `:89-410` (Three Pillars → Features Grid → AI Trading
Pipeline → Pricing), leaving `<ModuleLauncher>` flow straight into the CPA
Disclaimer. The now-dead **`FEATURES` const** (`:9`, used only by the removed
Features grid — grep-confirmed) is removed. **Kept:** the Hero, `<ModuleLauncher>`
(+ all 6 module sections + the Travel `CreateTripForm` + Trading `ScanFilterForm` +
stubs — untouched, in the unchanged component), the register/login modal (`LoginBox`,
triggered by the section CTAs + the launcher, 3 refs), the CPA Disclaimer, Press,
Header/footer. Page shrank **507 → 171 lines**.

**Zero orphans:** `FEATURES` 0 refs after removal; the removed sections were static
JSX using only `FEATURES` + the shared `setLoginMode`/`setShowLogin` (which the
launcher CTAs still use, 6 refs). No dangling helpers.

## STEP 3 — Verify

- **Page structure:** Hero (`page.tsx:45`) → ModuleLauncher (`:74`) → CPA Disclaimer
  (`:76`) → Press (`:88`) → footer → Login Modal (`:160`). **Nothing else below the
  modules.** ✅
- **`ModuleLauncher.tsx` NOT in diff** — the 6 module sections + the Travel/Trading
  forms are completely untouched (`git diff --name-only` → only `page.tsx`). ✅
- **Old marketing + Plans gone, no orphans:** Three Pillars / Features Grid / AI
  Trading Pipeline / Pricing / `FEATURES` all 0 refs. ✅

## Hard-constraint compliance

| Constraint | Status |
|---|---|
| ONLY remove the 4 marketing sections from page.tsx; don't touch ModuleLauncher / the 6 sections / forms | ✅ `ModuleLauncher.tsx` not in diff; only the page.tsx marketing block removed |
| Dead consts removed only after grep-confirmed zero other use; register modal kept | ✅ `FEATURES` removed (0 other refs); `LoginBox`/`setShowLogin` preserved |
| 0 endpoint, 0 schema, 0 deps | ✅ |
| `tsc --noEmit` | ✅ exit 0 |
| eslint, no orphans | ✅ page.tsx 3 warnings (`Link`/`Image`/`setLoginRedirect`) are **pre-existing on main** → **+0/+0** |
| git diff scoped | ✅ `page.tsx` (+ this report) |

---

## Result
The home page is now **Hero → ModuleLauncher (the 6 module bars, with the Travel
CreateTripForm + Trading ScanFilterForm + stubs, untouched) → CPA Disclaimer → Press
→ footer → Login Modal**. The four old marketing sections (Three Pillars,
Capabilities/Features grid, "What's Inside" AI-pipeline) and the Plans/pricing
section are removed, along with the dead `FEATURES` const — no orphans. The 6 module
sections and their forms are 100% unchanged (`ModuleLauncher.tsx` not in the diff).
tsc + lint clean; diff scoped to `page.tsx`.
