# HOME — PR-3 Implementation: ModuleLauncher → six separate stacked module sections

**Branch:** `claude/home-pr-3`
**Date:** 2026-05-31
**Scope:** Restructure `ModuleLauncher` from a single toggle-card into **six
separate stacked module SectionCards** — Travel (live, create-trip form, free/
guest-ok) + Trading, Bookkeeping, Tax, Operations, Compliance (paid). No toggle
pills; all six render. Reuses `CreateTripForm` (Travel) + the admin `ScanFilterForm`
(Trading) unchanged. Per the task. 1 file + report. **0 endpoint, 0 schema, 0
deps.**

**Design-skill grounding** (`SKILL.md`): "cohesive design language via consistent
tokens." Six identical SectionCards (one purple band each, white body) is the
app-standard chrome; the live forms render bandless inside so each card has exactly
**one** purple band (the established one-purple rule).

---

## STEP 1 — Current structure (audited)

`ModuleLauncher.tsx` was a **single "Launch a module" SectionCard** (`:109-180`)
with a **pill toggle**: `active` state (`:40`), the pill row (`:153-177`,
`setActive`), and three content branches selected by the active module —
Travel `<CreateTripForm>` (`:116-119`), admin Trading `<ScanFilterForm>`
(`:120-133`), and the paid stub (`:134-150`). The `/api/auth/me` `isAdmin`
detection (`:48-61`), the scan state + `scanTriggerRef`→`/trading` (`:68-86`), the
`gateGuestCreate` guest register-gate (`:93-100`), and `onRequireAuth` were all
wired. **Reused:** all of the above (auth/state/handlers + the two child forms).
**Removed:** the pill toggle (`active`/`setActive` + the pill row) — no longer
needed since all six render.

## STEP 2 — Six stacked module SectionCards

Replaced the single toggle-card with `<div className="… space-y-3">` mapping
**`MODULES`** (reordered per the task: **Travel, Trading, Bookkeeping, Tax,
Operations, Compliance**) — each module is its own SectionCard:
```tsx
{MODULES.map(m => (
  <div className="rounded-lg overflow-hidden border border-gray-200/50 shadow-sm">
    <div className="bg-brand-purple/80 text-white px-4 py-2.5 … flex … justify-between">
      <span>{m.label}</span>
      <span className="text-[10px] uppercase …">{m.live ? 'Free · guest ok' : 'Paid'}</span>
    </div>
    <div className="bg-white p-4">{renderBody(m)}</div>
  </div>
))}
```
- **One purple band per card** (module name + a tag — Travel "Free · guest ok",
  others "Paid"), white body — the app SectionCard chrome.
- **`renderBody(m)`** picks the body:
  - **Travel** → `<CreateTripForm onUnauthenticated={gateGuestCreate}
    showHeader={false} />` (bandless — the module band is the card's; guest
    register-gate intact).
  - **Trading + `isAdmin`** → `<ScanFilterForm … showHeader={false} />` (the PR-3
    expanded form; Scan routes to `/trading`).
  - **Trading non-admin + Bookkeeping/Tax/Operations/Compliance** → a stub: the
    blurb + a **"Launch {m.label} Module"** gold button → `onRequireAuth` (register
    modal).

Structure verified: pill toggle removed (`active`/`setActive` → 0), 6 cards via
`MODULES.map`, one band token per card, order correct.

## STEP 3 — Behavior preserved (confirmed)

- **`CreateTripForm` + guest register-gate:** unchanged — same `onUnauthenticated=
  {gateGuestCreate}` + `showHeader={false}`; the gate opens the register modal for
  guests. `CreateTripForm` not in diff.
- **`ScanFilterForm` (admin Trading) + route-to-/trading + admin-gated endpoint:**
  unchanged — same props + `scanTriggerRef.current = () => router.push('/trading')`;
  `ScanFilterForm` + the convergence endpoint not in diff.
- **`/api/auth/me` `isAdmin` detection:** unchanged (`:48-61`) — drives the Trading
  branch; `auth/me/route.ts` not in diff.
- **Register modal (`onRequireAuth`):** reused for all stub "Launch" buttons + the
  Travel guest gate (4 refs).
- **Home mount (`page.tsx`) + the rest of the landing page:** untouched (not in
  diff — `<ModuleLauncher onRequireAuth=…/>` signature unchanged).

## Hard-constraint compliance

| Constraint | Status |
|---|---|
| Six separate stacked SectionCards; pill toggle REMOVED | ✅ `MODULES.map` → 6 cards; `active`/pills gone |
| One purple band per card; live forms bandless inside (`showHeader={false}`) | ✅ one band token per card; Travel + admin Trading `showHeader={false}` |
| Reuse CreateTripForm + ScanFilterForm unchanged (don't fork) | ✅ both not in diff |
| Guest register-gate, isAdmin detection, admin-gated scan endpoint unchanged | ✅ `gateGuestCreate`/`isAdmin`/endpoint intact; not in diff |
| 0 endpoint, 0 schema, 0 deps | ✅ |
| `tsc --noEmit` | ✅ exit 0 |
| eslint | ✅ ModuleLauncher **0 problems** |
| git diff scoped | ✅ `ModuleLauncher.tsx` only (+ this report) |

---

## Result
The home launcher is now **six separate stacked module SectionCards** (Travel,
Trading, Bookkeeping, Tax, Operations, Compliance), each with one purple band
(module name + Free/Paid tag) and a white body — no toggle pills, all visible.
Travel renders the live `CreateTripForm` (guest register-gated save); Trading shows
the admin `ScanFilterForm` for admins (Scan → /trading) and a "Launch Trading
Module" stub otherwise; the other four are stub sections with "Launch {Module}
Module" buttons opening the register modal. `CreateTripForm`, `ScanFilterForm`, the
guest register-gate, the `isAdmin` detection, the admin-gated endpoint, and the home
mount are all unchanged. tsc + lint clean; diff scoped to `ModuleLauncher.tsx`.
