# HOME — PR-1d Implementation: remove inner band on paid-module stubs — one banner for all modules

**Branch:** `claude/home-pr-1d`
**Date:** 2026-05-31
**Scope:** Remove the **second** purple band on the paid-module stub cards
(Bookkeeping/Tax/Trading/Operations/Compliance) — they now render **bare** under
the single **"Launch a module"** header, matching the bare layout HOME-PR-1c gave
the Travel form. Layout only. 1 file + this report. **0 schema, 0 deps.**

---

## STEP 1 — The stub card's inner band located

`ModuleLauncher.tsx` (before, `:80-96`): selecting a paid module rendered a stub
**card** with its own inner band:
```tsx
<div className="rounded-lg overflow-hidden border border-gray-200/50 shadow-sm mb-4">
  <div className="bg-brand-purple/80 text-white px-4 py-2.5 text-sm font-semibold">
    {activeMod.label}                      {/* ← the inner second banner */}
  </div>
  <div className="bg-white p-6"> …coming soon copy + Sign-in button… </div>
</div>
```
This `{activeMod.label}` band ("Bookkeeping", "Tax", …) is a redundant second
banner under the outer "Launch a module" SectionCard band — the same double-banner
1c removed for Travel, but 1c only touched `CreateTripForm`; the stub's band is
defined **inline** in `ModuleLauncher` and was untouched.

## STEP 2 — Stub inner band removed (render bare)

After (`ModuleLauncher.tsx:79-94`): the card wrapper + inner band are dropped; the
stub copy + Sign-in button render **bare** (in a plain `<div className="pb-1">`),
directly under the single "Launch a module" band:
```tsx
<div className="pb-1">
  <p className="text-sm text-text-primary mb-1">{activeMod.label} — coming soon.</p>
  <p className="text-xs text-text-muted mb-4">{activeMod.blurb} Requires an account.</p>
  <button onClick={onRequireAuth} className="px-6 py-2 bg-brand-gold …">Sign in to get started</button>
</div>
```
The **module name stays as plain text** in the copy (`{activeMod.label} — coming
soon.`) — just no longer a purple band. The `bg-white p-6` inner card body is also
dropped since the launcher's `bg-white p-4` body already provides the surface
(mirroring how the Travel form renders bare).

## STEP 3 — All 6 modules = one banner

- **Travel:** one banner (1c, unchanged) — `<CreateTripForm … showHeader={false}/>`
  renders the form bare under "Launch a module".
- **Each paid module** (Bookkeeping/Tax/Trading/Operations/Compliance): one banner
  — the stub renders bare under "Launch a module", no inner band.
- **Verified:** exactly **one** `bg-brand-purple/80 … px-4 py-2.5` band remains in
  the component (`:69`, the "Launch a module" header). No inner band on either
  branch.
- **Pills, toggle, register-gate, CreateTripForm:** unchanged — `MODULES.map`
  pills, `activeMod.live` branch, `onRequireAuth` (stub CTA + paid-pill gate),
  `gateGuestCreate`/`onUnauthenticated` (Travel), and the `showHeader={false}`
  Travel card are all intact.

## Hard-constraint compliance

| Constraint | Status |
|---|---|
| Remove the stub's inner band only — match 1c's bare Travel layout | ✅ band + card wrapper dropped; stub renders bare |
| Travel card (CreateTripForm, 1c) unchanged | ✅ `showHeader={false}` line untouched; CreateTripForm not in diff |
| No logic/behavior change; layout only | ✅ same copy/handlers; only the band/card wrapper removed |
| 0 schema, 0 deps | ✅ |
| `tsc --noEmit` | ✅ exit 0 |
| eslint | ✅ ModuleLauncher **0 problems** |
| git diff scoped | ✅ `ModuleLauncher.tsx` only (+ this report) |

---

## Result
Every module in the launcher now shows **one** banner — "Launch a module" — with
its content directly beneath: the Travel form (1c) or a paid-module stub (1d), both
bare. The paid stub's inner module-name band is gone (the name stays as plain text
in the "coming soon" copy). Pills, toggle, the guest register-gate, and
`CreateTripForm` are unchanged. tsc + lint clean; diff scoped to `ModuleLauncher.tsx`.
