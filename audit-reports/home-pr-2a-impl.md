# HOME — PR-2a Implementation: remove Stats bar + Platform/Modules grid

**Branch:** `claude/home-pr-2a`
**Date:** 2026-05-31
**Scope:** Remove the **Stats bar** (12 Modules / Plaid Bank Sync / IRS Compliant /
AI Powered) and the **"Platform / Modules" grid** (12 module cards) from the home
`LandingPage`. Removal only — the PR-1 launcher, the blurbs/Capabilities/What's
Inside/Pricing, and the register modal all stay. 1 file + this report.
**0 schema, 0 deps.**

---

## STEP 1 — The two blocks located

`src/app/page.tsx`:
- **Stats bar** — former `:104-126` (`{/* Stats Bar */}` → `<section
  className="bg-white border-b border-border">` … the 4-cell grid "12 / Modules",
  "Plaid / Bank Sync", "IRS / Compliant", "AI / Powered").
- **Modules grid** — former `:128-152` (`{/* Modules Grid */}` → "Platform /
  Modules" heading + `MODULES.map` over 12 cards, each
  `onClick={() => { setLoginMode('register'); setShowLogin(true); }}`).
- **Immediately before:** the **ModuleLauncher** (PR-1) at `:102` (kept).
- **Immediately after:** the **Three Pillars** section at `:154` (kept).
- **Backing data:** `const MODULES` (former `:9-22`) — used **only** by the grid
  (`grep MODULES` → decl + the one `.map`, nothing else).

## STEP 2 — Both blocks removed + dead data

- **Stats bar + Modules grid JSX** deleted (the `:104-152` span), leaving
  `<ModuleLauncher … />` directly followed by `{/* Three Pillars */}`.
- **`const MODULES` array removed** (former `:9-22`) — grep-confirmed zero other
  use after the grid is gone (`grep MODULES src/app/page.tsx` → **0**).
- **Register modal preserved:** the grid's open-modal handler
  (`setLoginMode('register'); setShowLogin(true)`) is **shared** — the launcher's
  `onRequireAuth`, the Three-Pillars CTAs, the Hero "Get Started", and the
  `LoginBox` modal all still use `setShowLogin`. Confirmed 4 `setShowLogin(true)`
  call sites remain; the modal + state are untouched.
- **`FEATURES` array kept** — still used by the "What's Inside" / Features grid
  (`:283` map). Not touched.

## STEP 3 — Surroundings intact (verified)

- **ModuleLauncher (PR-1)** above — unchanged (still `:102`, 2 refs incl. import).
- **Three Pillars, Features ("What's Inside"), Pricing** — all still rendered
  (grep: Three Pillars 1, FEATURES 2, `id="pricing"` 1).
- **Register modal** — works for the launcher + remaining sections (4
  `setShowLogin(true)` openers + the `LoginBox` modal intact).

## Hard-constraint compliance

| Constraint | Status |
|---|---|
| Remove ONLY the Stats bar + Modules grid; leave everything else | ✅ diff = single 65-line deletion; all other sections present |
| Dead code removed only after grep-confirmed zero other use | ✅ `MODULES` removed (0 other refs); register modal kept; `FEATURES` kept |
| Register modal preserved | ✅ 4 `setShowLogin(true)` openers + `LoginBox` intact |
| 0 schema, 0 deps | ✅ |
| `tsc --noEmit` | ✅ exit 0 |
| eslint, no orphans | ✅ branch **3 warnings / 0 errors** vs main **2 errors / 3 warnings** → removing the grid dropped the 2 pre-existing `(mod as any)` errors; the 3 remaining warnings (`Link`/`Image`/`setLoginRedirect` unused) are **pre-existing**, untouched. **0 new; net −2 errors.** |
| git diff scoped | ✅ `page.tsx` only (+ this report) |

---

## Result
The home landing page no longer renders the Stats bar or the "Platform / Modules"
grid; the page now flows Hero → **ModuleLauncher (PR-1)** → Three Pillars →
Features → Pricing → footer. The dead `MODULES` array is removed (grep-confirmed no
other use); the shared register modal + `FEATURES` data are preserved. tsc clean;
lint improved (the grid's two `any` errors are gone, 0 new); diff is a clean
65-line deletion in `page.tsx`.
