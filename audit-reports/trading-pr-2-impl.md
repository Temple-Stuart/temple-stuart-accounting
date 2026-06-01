# TRADING — PR-2 Implementation: home Trading pill shows ScanFilterForm for admin, stub for everyone else

**Branch:** `claude/trading-pr-2`
**Date:** 2026-05-31
**Scope:** Mount the PR-1 shared `<ScanFilterForm>` on the home launcher's Trading
pill **admin-only**; non-admins/guests keep the existing "coming soon / paid"
stub. Trading is paid + admin-gated (unlike guest-usable Travel), so a working form
to a non-admin would dead-end on a 403 *and* expose the scanner's filter
architecture. Per the task. 2 files + report. **0 schema, 0 deps.**

---

## STEP 1 — Launcher auth detection + admin-status availability

- **Launcher auth detection:** `ModuleLauncher` fetches `GET /api/auth/me` on mount
  and previously only read `res.ok` (`ModuleLauncher.tsx:41-43`, `authed` state).
- **`/api/auth/me` did NOT expose admin status** — it returned
  `{ user: { id, email, name, createdAt, tier } }` (`auth/me/route.ts` select) — no
  `isAdmin`. The admin mechanism is `isAdminUser(userId) === (userId ===
  ADMIN_USER_ID)` (`tiers.ts:76-78`), a **server constant**.
- **Decision (per the ⚠ guidance — the recommended small option):** rather than
  leak `ADMIN_USER_ID` into the client bundle or invent client-side admin logic, I
  added a **server-computed `isAdmin` boolean** to `/api/auth/me` using the existing
  `isAdminUser`:
  ```ts
  import { isAdminUser } from '@/lib/tiers';
  …
  return NextResponse.json({ user: { ...user, isAdmin: isAdminUser(user.id) } });
  ```
  (`auth/me/route.ts:4,42`). One line of server logic, the existing check, no new
  auth scheme, no schema.

## STEP 2 — Admin → ScanFilterForm, else → stub

`ModuleLauncher` reads `isAdmin` from `/api/auth/me` (`:46` state,
`:56` `setIsAdmin(!!data?.user?.isAdmin)`), then on the selected card
(`:118-145`):
```tsx
{activeMod.live ? (
  <CreateTripForm … />                              // Travel (unchanged)
) : activeMod.key === 'trading' && isAdmin ? (
  <ScanFilterForm … />                              // TRADING-PR-2: admin only
) : (
  …the paid "coming soon" stub…                     // everyone else (unchanged)
)}
```
- **Admin + Trading pill → `<ScanFilterForm>`** (the PR-1 shared component,
  unchanged), with launcher-owned local state passed as props (mirroring how the
  dashboard wires it): `scannerUniverse`/`setScannerUniverse`, `scannerFilters`/
  `onFiltersChange` (= a `handleFiltersChange` that persists to the same
  `localStorage 'scanner-filters'` key the dashboard uses), `scanTriggerRef`.
- **Non-admin Trading / all other paid pills / guests → the existing stub** (no
  form, no 403 surface, no exposed scanner internals). `isAdmin` defaults `false`,
  set true only from the server flag, so the form is never shown speculatively.

## STEP 3 — Scan wiring (route to /trading, filters carry via localStorage)

The home page can't host the full `ConvergenceIntelligence` results view, so the
home form's Scan **routes the admin to `/trading`** (the full dashboard, where the
admin-gated convergence scan runs):
```ts
scanTriggerRef.current = () => router.push('/trading');
```
(`ModuleLauncher.tsx`). **Filters carry over** via the shared
`localStorage 'scanner-filters'` key — the dashboard **reads it on init**
(`trading/page.tsx:113` `localStorage.getItem('scanner-filters')` → `scannerFilters`),
so `/trading` opens with the home-set filters pre-loaded. I deliberately route to
plain `/trading` (not an auto-fire `?scan=`) because auto-triggering would require
dashboard scan-logic changes (out of scope) — this is an honest hand-off, not a
half-wired scan that goes nowhere. **Belt-and-suspenders:** even the rendered form
is safe — the convergence endpoint itself enforces `requireAdmin` (TRADING-PR-SEC),
so the scan is admin-gated regardless of who sees the form.

## STEP 4 — Verify

- **Admin on Trading pill:** `isAdmin` true → sees `<ScanFilterForm>`; Scan routes
  to `/trading` with filters pre-loaded (the dashboard runs the admin-gated scan). ✅
- **Non-admin / guest on Trading pill:** `isAdmin` false → the stub ("Trading —
  coming soon … Requires an account." + Sign-in CTA). No form, no 403 dead-end, no
  exposed internals. ✅
- **Travel pill + other module pills:** unchanged — `CreateTripForm` (Travel) and
  the paid stub (bookkeeping/tax/operations/compliance) render as before. ✅
- **`ScanFilterForm` (PR-1) + the dashboard + the convergence endpoint:** unchanged
  — **not in the diff** (the shared component is reused verbatim). ✅

## Hard-constraint compliance

| Constraint | Status |
|---|---|
| Admin-only form via the EXISTING auth detection | ✅ `/api/auth/me` + the existing `isAdminUser` check (server-computed `isAdmin`) — no client-side admin invention, no leaked `ADMIN_USER_ID` |
| Non-admins keep the stub — no working form, no 403 dead-end | ✅ else-branch stub for non-admin/guest |
| Reuse the PR-1 ScanFilterForm unchanged; don't fork it | ✅ `ScanFilterForm.tsx` not in diff |
| Convergence endpoint stays admin-gated (unchanged) | ✅ not in diff (TRADING-PR-SEC's `requireAdmin` intact) |
| 0 schema, 0 deps | ✅ `isAdmin` is a computed response field, not a DB column |
| `tsc --noEmit` | ✅ exit 0 |
| eslint | ✅ ModuleLauncher + auth/me **0 problems** |
| git diff scoped | ✅ `ModuleLauncher.tsx` + `auth/me/route.ts` (+ report) |

---

## Result
The home launcher's Trading pill now shows the working shared `<ScanFilterForm>`
**only to the admin** (Alex) — detected via a server-computed `isAdmin` added to
`/api/auth/me` (the existing `isAdminUser` check, no leaked constant). Its Scan
routes to `/trading` with the filters carried over via the shared
`localStorage 'scanner-filters'` key (the dashboard reads it on init). Non-admins,
guests, and all other paid pills keep the existing "coming soon / paid" stub — no
working form, no 403 dead-end, no exposed scanner internals. The PR-1
`ScanFilterForm`, the dashboard, and the admin-gated convergence endpoint are
untouched. tsc + lint clean; diff scoped to the launcher + the auth endpoint. The
form opens to paid tiers later when pro_plus governs Trading.
