# HOME — PR-1c Implementation: one banner — hide the inner "Plan a new trip" band on the home launcher

**Branch:** `claude/home-pr-1c`
**Date:** 2026-05-31
**Scope:** Remove the **second** purple band on the home launcher — the form now
renders directly under the single **"Launch a module"** header. The inner
"Plan a new trip" band is made **optional** (a prop), hidden on the launcher and
**still shown on the trips index** (which shares the component). Layout only.
2 files + this report. **0 schema, 0 deps.**

---

## STEP 1 — Where the inner band lives

The "Plan a new trip" band is in the **shared** `CreateTripForm`
(`CreateTripForm.tsx`, was `:125-128`: the `rounded-lg … shadow-sm mb-4` card
wrapper + the `bg-brand-purple/80 … font-semibold` band "Plan a new trip").
`CreateTripForm` is rendered on **both** surfaces:
- **Home launcher** — `ModuleLauncher.tsx:78` (`<CreateTripForm
  onUnauthenticated={gateGuestCreate} …/>`), inside the new "Launch a module"
  SectionCard → the band is a **redundant second banner** here.
- **Trips index** — `budgets/trips/page.tsx:116` (`<CreateTripForm />`) → the band
  **should stay** (it's that page's section header).

So the band can't be deleted globally — it must be conditional.

## STEP 2 — Band made optional (prop), default preserves the index

`CreateTripForm` gained **`showHeader?: boolean`** (default **`true`**),
destructured `({ onUnauthenticated, showHeader = true })` (`CreateTripForm.tsx:25`).
The render was refactored: the form fields are now a `formBody` fragment, and:
```tsx
if (!showHeader) return formBody;          // launcher: bare form, no band/card
return (
  <div className="rounded-lg overflow-hidden border border-gray-200/50 shadow-sm mb-4">
    <div className="bg-brand-purple/80 … font-semibold">Plan a new trip</div>
    <div className="bg-white p-4">{formBody}</div>   // index: unchanged band + chrome
  </div>
);
```
(`CreateTripForm.tsx` end of render.) **Default (`showHeader` true)** reproduces
the exact prior markup → the trips index is byte-identical.

**Call sites (before → after):**
- **Launcher** (`ModuleLauncher.tsx:78`): `<CreateTripForm
  onUnauthenticated={gateGuestCreate} />` → `… **showHeader={false}** />`. The
  launcher already wraps the form in its `bg-white p-4` body under the "Launch a
  module" band, so the bare `formBody` sits directly under the single header.
- **Trips index** (`budgets/trips/page.tsx:116`): `<CreateTripForm />` —
  **unchanged** (no prop → default `showHeader=true` → keeps its band). Not in the
  diff.

## STEP 3 — Both surfaces verified

- **Home:** ONE banner ("Launch a module"); the Travel form renders bare directly
  beneath it (no inner "Plan a new trip" band) — `showHeader={false}` returns
  `formBody`.
- **Trips index:** UNCHANGED — still shows its "Plan a new trip" band (the
  default); `page.tsx` is not in the diff.
- **Form logic, pills, register-gate, toggle:** unchanged — `formBody` is the same
  fields/handlers; `onUnauthenticated`/`gateGuestCreate`/`onRequireAuth`/
  `/api/auth/me` and the pill toggle are all untouched (only the band wrapper is
  now conditional).

## Hard-constraint compliance

| Constraint | Status |
|---|---|
| ONE band removal via an OPTIONAL prop — not deleted globally | ✅ `showHeader` (default true); index keeps the band |
| Trips index render UNCHANGED (default keeps band) | ✅ `page.tsx` not in diff; default reproduces prior markup |
| No logic/behavior change; layout only | ✅ only the band wrapper is conditional; handlers/state identical |
| 0 schema, 0 deps | ✅ |
| `tsc --noEmit` | ✅ exit 0 |
| eslint | ✅ CreateTripForm + ModuleLauncher **0 problems** |
| git diff scoped | ✅ `CreateTripForm.tsx`, `ModuleLauncher.tsx` (+ report) |

---

## Result
The home launcher now shows **one** banner — "Launch a module" — with the
create-trip form directly beneath it (no inner "Plan a new trip" band). The band
is preserved on the trips index via the new `showHeader` prop (default true; the
launcher passes `false`). Form logic, pills, the guest register-gate, and the
toggle are unchanged; the trips index is untouched. tsc + lint clean; diff scoped
to `CreateTripForm.tsx` + `ModuleLauncher.tsx`.
