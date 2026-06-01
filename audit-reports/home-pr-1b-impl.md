# HOME — PR-1b Implementation: band on "Launch a module" header, pills under the form

**Branch:** `claude/home-pr-1b`
**Date:** 2026-05-31
**Scope:** Layout/label/chrome-only adjustment to `ModuleLauncher` (HOME-PR-1): put
the purple SectionCard band on **"Launch a module"** (the container header), and
move the module pills to **below the form** (form first → divider → pills + hint).
No logic, state, or behavior change. 1 file + this report. **0 schema, 0 deps.**

---

## STEP 1 — Band on "Launch a module"

**Before** (`ModuleLauncher.tsx`): a plain heading block — `<div>` with
`"Start here"` eyebrow + `<h2>Launch a module</h2>` (former `:64-67`), then pills,
then the card.

**After:** one **SectionCard container** matching the app/trips-index chrome:
```tsx
<div className="rounded-lg overflow-hidden border border-gray-200/50 shadow-sm">
  <div className="bg-brand-purple/80 text-white px-4 py-2.5 text-sm font-semibold">
    Launch a module
  </div>
  <div className="bg-white p-4"> … </div>
</div>
```
(`:68-71`) — identical tokens to the trips-index SectionCard (`rounded-lg
overflow-hidden border border-gray-200/50 shadow-sm` + `bg-brand-purple/80 …
px-4 py-2.5 text-sm font-semibold` + `bg-white p-4`). The old "Start here" eyebrow
+ plain `<h2>` are removed (grep: 0 refs).

> **Note (per your direction):** `CreateTripForm` is kept **fully untouched**, so
> for the Travel module its own "Plan a new trip" band remains nested inside the
> new "Launch a module" container (the shared component is not modified). The new
> band is the container header; the Travel card keeps its band as before.

## STEP 2 — Pills under the form

The body is reordered: the **selected module's card renders FIRST** (`:75-98` —
Travel `<CreateTripForm>` or the paid stub), then a **divider**
(`<div className="border-t border-gray-100 pt-3">`, `:100`), then the **module
pill row** (`MODULES.map`, `:103-117`) + a **hint** line below
(`:121-123`, "Travel is free to use — sign in to save. Other modules require an
account."). Previously the pills sat above the card; they now sit below it behind
the divider.

## STEP 3 — Everything else preserved (confirmed)

- **`CreateTripForm` unchanged** — not in the diff; the shared component (+ the
  trips index that also renders it) is untouched.
- **Pill toggle logic** — `active`/`setActive` + `MODULES` + `activeMod.live`
  branch (Travel card vs paid stub) unchanged (same code, only relocated below the
  card).
- **The 5 paid stubs** — same stub card markup ("{Module} — coming soon … Requires
  an account." + "Sign in to get started" → `onRequireAuth`), unchanged.
- **Guest register-gate** — `gateGuestCreate` + `onUnauthenticated={gateGuestCreate}`
  on `CreateTripForm`, and `onRequireAuth` for the paid stub, all unchanged.
- **`/api/auth/me` detection** — the mount-time `fetch('/api/auth/me')` →
  `setAuthed(res.ok)` effect unchanged.
- **Home page mount + landing page** — `page.tsx` not in the diff; the
  `<ModuleLauncher onRequireAuth={…}/>` mount + all existing landing sections
  untouched.

Grep confirms the logic symbols are all present and unchanged: `setActive`,
`authed`, `/api/auth/me`, `gateGuestCreate`, `onRequireAuth`,
`onUnauthenticated={gateGuestCreate}`, `MODULES`, `activeMod.live`.

## Hard-constraint compliance

| Constraint | Status |
|---|---|
| Layout + band-label + chrome ONLY; no logic/state/behavior change | ✅ only JSX reorder + the container band; all handlers/state identical |
| Match the app's SectionCard band chrome (brand-purple, trips-index) | ✅ exact tokens copied |
| CreateTripForm + trips index untouched | ✅ not in diff |
| Guest register-gate + auth detection unchanged | ✅ `gateGuestCreate`/`onRequireAuth`/`/api/auth/me` intact |
| 0 schema, 0 deps | ✅ |
| `tsc --noEmit` | ✅ exit 0 |
| eslint | ✅ ModuleLauncher **0 problems** |
| git diff scoped | ✅ `ModuleLauncher.tsx` only (+ this report) |

---

## Result
The launcher is now a single SectionCard whose purple band reads **"Launch a
module"** (app-standard chrome), with the selected module's card first, then a
divider, then the module pills (Travel + 5 paid) and a hint below. The form,
the pill set, the toggle logic, the 5 paid stubs, the guest register-gate
(`onRequireAuth`/`onUnauthenticated`), and the `/api/auth/me` detection are all
unchanged; `CreateTripForm` and the home-page mount are untouched. tsc + lint clean;
diff scoped to `ModuleLauncher.tsx`.
