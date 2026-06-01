# HOME — PR-4 Implementation: Hero + 6 forced-login per-module explainer sections

**Branch:** `claude/home-pr-4`
**Date:** 2026-05-31
**Scope:** Restructure the home page below the Hero into **6 forced-login per-module
explainer SectionCards** (Travel, Trading, Bookkeeping, Tax, Operations,
Compliance) — each = explain + price tag + "Log in to launch" CTA, alternating
colors. Remove the old marketing sections (4-blurb "Three Pillars" row,
"Capabilities"/Features grid, "What's Inside"/AI-Pipeline) + the separate Plans
section. **All modules forced-login** — removed the home `CreateTripForm` + admin
`ScanFilterForm` usage (components kept for `/budgets/trips` + `/trading`). Per the
task. 2 files + report. **0 endpoint, 0 schema, 0 deps.**

**Design-skill grounding** (`SKILL.md`): cohesive tokens, one dominant color + sharp
accents. Six uniform SectionCards (one purple band each, gold CTA) with an
alternating body tint read as distinct stacked modules without a second band.

---

## STEP 1 — Current structure (audited)

`src/app/page.tsx` (LandingPage): Hero (`:58-81`) → `<ModuleLauncher>` (`:87`) →
**Three Pillars** 4-blurb row (`:89-207`) → **Features Grid** / "What's Inside"
(`:209-226`, used the `FEATURES` const `:9`) → **AI Trading Pipeline** (`:229-255`)
→ **Pricing**/Plans (`:257-410`) → CPA Disclaimer (`:412`) → Press → Login Modal.
`ModuleLauncher` (HOME-PR-3) was 6 stacked cards with a live Travel `CreateTripForm`,
an admin Trading `ScanFilterForm`, 4 paid stubs, `isAdmin` detection, scan state, and
the `onRequireAuth` register-modal wiring.

**Confirmed shared components stay** (grep): `CreateTripForm` is also imported by
`src/app/budgets/trips/page.tsx`; `ScanFilterForm` by `src/app/trading/page.tsx` —
so neither is deleted, only the **home usage** removed.

## STEP 2 — Six forced-login explainer sections

`ModuleLauncher.tsx` rewritten: 6 stacked SectionCards (`MODULES.map`, order Travel
→ Trading → Bookkeeping → Tax → Operations → Compliance), each:
- **Band (one purple per card):** module name + a **price tag** from the editable
  **`PRICES` map** (top-of-file const, all values `'Pricing TBD'` placeholders —
  no invented amounts).
- **Body:** the **verbatim** 1-2 sentence explanation + 3 feature bullets (the COPY,
  exactly as given — spot-checked: Travel "…budgeted trip ledger", Trading
  "three-outcome EV model", Compliance "SOC 2-grade controls", Operations "Content +
  compliance workflows") + a **"Log in to launch {Module}"** gold CTA → `onRequireAuth`
  (the existing register/login modal).
- **Alternating treatment:** `altBody = i % 2 === 1` → body `bg-bg-row` (odd) vs
  `bg-white` (even), so the six read as distinct stacked modules.

**No live forms:** the `CreateTripForm` + `ScanFilterForm` JSX usage is gone (only
a comment mentions them). **`isAdmin` detection, the scan state/ref, `useState`/
`useEffect`/`useRouter`, the `/api/auth/me` fetch are all removed** (grep: 0 refs
each) — no longer needed since every module is forced-login. The component is now a
pure prop-driven (`onRequireAuth`) presentational stack.

## STEP 3 — Old marketing + Plans removed

`page.tsx`: the block from `{/* Three Pillars */}` through the Pricing section's
`</section>` (former `:89-410` — the **4-blurb row, Features/"What's Inside" grid,
AI-Pipeline, and Plans/pricing**) is **deleted**, leaving `<ModuleLauncher>` flow
straight into `{/* CPA Disclaimer */}`. The now-dead **`FEATURES` const** (only used
by the removed Features grid) is removed (grep: 0 refs). **Kept:** the Hero, the
register/login modal (`LoginBox`, now triggered by the section CTAs, 3 refs), the
Header/CPA/Press/footer. Page shrank 507 → 172 lines.

**Zero orphans:** `FEATURES` 0 refs; "Three Pillars"/"Features Grid"/"AI Trading
Pipeline"/"Pricing" 0; no dangling helpers (the removed sections were static JSX
using only `FEATURES` + the shared `setLoginMode/setShowLogin`, which the launcher
CTAs still use).

## STEP 4 — Verify

- **Home structure:** Hero (`page.tsx:45`) → ModuleLauncher (`:74`) → CPA Disclaimer
  (`:76`) → Press → Login Modal. **Nothing else below the 6 sections.** ✅
- **All 6 forced-login:** every CTA is "Log in to launch {Module}" → `onRequireAuth`
  → the register/login modal; **no module is guest-usable; no live form on home.** ✅
- **`CreateTripForm` (/budgets/trips) + `ScanFilterForm` (/trading) UNCHANGED:** not
  in the diff; home usage removed, components intact. ✅
- **Old marketing + Plans gone, no orphans:** confirmed (grep 0). ✅
- **`PRICES` map present** with 6 editable `'Pricing TBD'` placeholders — where Alex
  sets real prices. ✅

## Hard-constraint compliance

| Constraint | Status |
|---|---|
| All modules forced-login; live forms removed from HOME only (shared components kept) | ✅ CreateTripForm/ScanFilterForm usage gone from launcher; both still on /budgets/trips + /trading (not in diff) |
| DO NOT invent prices — `PRICES` map with "Pricing TBD" | ✅ 6 `'Pricing TBD'` placeholders, editable const |
| Use the COPY verbatim | ✅ all 6 explanations + 18 bullets verbatim (spot-checked) |
| One purple band per card; alternating treatment | ✅ one band per card; `bg-bg-row`/`bg-white` alternation |
| Old marketing + Plans removed cleanly (no orphans) | ✅ 4 sections + `FEATURES` removed; grep 0 |
| 0 endpoint, 0 schema, 0 deps | ✅ |
| `tsc --noEmit` | ✅ exit 0 |
| eslint | ✅ ModuleLauncher 0 problems; page.tsx 3 warnings (`Link`/`Image`/`setLoginRedirect`) are **pre-existing on main** → +0/+0 |
| git diff scoped | ✅ `ModuleLauncher.tsx` + `page.tsx` (+ report) |

---

## Result
The home page is now **Hero → 6 forced-login per-module explainer sections** (Travel,
Trading, Bookkeeping, Tax, Operations, Compliance) — each a SectionCard with one
purple band (module name + an editable "Pricing TBD" tag), the verbatim explanation +
3 feature bullets, and a "Log in to launch {Module}" CTA opening the register/login
modal — with alternating body tint. The old marketing sections and the Plans section
are removed (no orphans); no module is guest-usable and there's no live form on home.
`CreateTripForm` and `ScanFilterForm` remain unchanged on `/budgets/trips` and
`/trading`. The `PRICES` map at the top of `ModuleLauncher` is where Alex sets real
prices. tsc + lint clean; diff scoped to 2 files.
