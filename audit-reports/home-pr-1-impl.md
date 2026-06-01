# HOME — PR-1 Implementation: module launcher under the Hero

**Branch:** `claude/home-pr-1`
**Date:** 2026-05-31
**Scope:** Add a module launcher to the home page (`/`) directly under the Hero —
extract the create-trip card into a shared `<CreateTripForm>`, reuse it for
**Travel** (live, free, register-gated save), add module toggle pills (Travel + 5
paid stubs). **Additive** — nothing on the current landing page is removed (that's
HOME-PR-2). Per `audit-reports/home-pr-1-audit.md` + the locked decisions.
4 files (2 new) + this report. **0 schema, 0 deps, POST /api/trips unchanged.**

---

## STEP 1 — `<CreateTripForm>` extracted (0 logic change), trips index parity

New **`src/components/trips/CreateTripForm.tsx`** — the create-trip card lifted
**verbatim** from `budgets/trips/page.tsx` (PR-37a/b): the SectionCard chrome
(`rounded-lg overflow-hidden border border-gray-200/50 shadow-sm` + `bg-brand-purple/80`
band "Plan a new trip" + `bg-white p-4` body), all inputs (name, destinations
autocomplete via `searchDestinations`, start/end dates, travelers, trip-type
pills), and the handlers (`handleDestChange`/`addDestination`/`removeDestination`/
`handleClickOutside`/`handleCreate`). The `handleCreate` POST `/api/trips` body,
validation (`canCreate = name.trim() && datesValid && !creating`, `datesValid =
start && end && end>=start`), and redirect (`router.push('/budgets/trips/{id}')`)
are **byte-identical** to the original.

**`budgets/trips/page.tsx`** now imports `CreateTripForm` and renders
`<CreateTripForm />` (`:6,:116`) where the inline card was; the form-only state
(name/dest/dates/travelers/tripType/creating/error/autocomplete refs), the
`TRIP_TYPES` const, the autocomplete + `handleCreate` handlers, and the now-unused
`useRef`/`useCallback`/`searchDestinations`/`Destination` imports were removed.
**Parity:** the index keeps its own `trips`/`loading`/`deleting` state, `loadTrips`,
`deleteTrip`, the loading spinner, and the **All Trips table** unchanged (tsc exit
0; grep confirms 0 dangling form refs; the table's "Destination" header + all rows
intact). The index renders identically — the card is the same component, just
behind a boundary (the 28e1a-style lift).

## STEP 2 — `<ModuleLauncher>` component

New **`src/components/home/ModuleLauncher.tsx`** — a pill row over the selected
module's card:
- **Pills** (`MODULES`): Travel (live) + Bookkeeping/Tax/Trading/Operations/
  Compliance (paid). **Style matches the trip-type pills** exactly: active
  `bg-brand-purple text-white border-brand-purple`, idle `bg-white
  text-text-secondary border-border hover:bg-bg-row`, `text-xs px-3 py-1
  rounded-full border` — with a small **"Paid"** tag on the 5 non-live pills.
- **Card swap:** selecting a pill sets `active`; Travel → renders
  `<CreateTripForm onUnauthenticated={gateGuestCreate} />`; a paid module → a stub
  card (same SectionCard chrome, brand band titled by module, body "{Module} —
  coming soon. {blurb} Requires an account." + a **"Sign in to get started"** CTA
  → `onRequireAuth`).
- Default active = Travel (the live, free, guest-usable module leads).

## STEP 3 — Guest register-gate on Travel (option A)

- **Auth detection:** `ModuleLauncher` fetches `GET /api/auth/me` on mount →
  `authed = res.ok` (200 signed-in, 401 guest).
- **Gated create:** `CreateTripForm` gained an optional
  `onUnauthenticated?: () => boolean | Promise<boolean>` prop. In `handleCreate`,
  **before** the POST: `if (onUnauthenticated) { if (await onUnauthenticated())
  return; }`. The launcher passes `gateGuestCreate` → when `authed === false` it
  calls `onRequireAuth()` (opens the **existing** `LoginBox` register modal) and
  returns `true` ("handled — don't POST"); when authed it returns `false` → the
  form POSTs normally.
- **Trips index unchanged:** there the form is mounted **without**
  `onUnauthenticated`, so `handleCreate` POSTs directly exactly as before (always
  authenticated context).
- **No backend change, no anonymous persistence:** `POST /api/trips` is untouched
  (still auth-gated). A guest never POSTs; an authenticated user POSTs as before.
  (If an edge 401 slips through for an authed-looking user, the form surfaces it as
  its inline error — fail-loud, no silent redirect.)

## STEP 4 — Mounted on home, additive, under the Hero

`src/app/page.tsx`: imported `ModuleLauncher` (`:7`) and mounted
`<ModuleLauncher onRequireAuth={() => { setLoginMode('register'); setShowLogin(true); }} />`
**directly after the Hero `</section>`** (`:102`), before the Stats Bar (`:104`).
`onRequireAuth` reuses the page's existing register-modal state
(`setLoginMode`/`setShowLogin` → the `LoginBox` modal at the page bottom). **The
diff is exactly 2 hunks (import + mount)** — every existing section (Hero, Stats
Bar, Modules Grid, Three Pillars, Features, AI Pipeline, Pricing, CPA Disclaimer,
Press, footer, Login Modal) is **untouched** (grep-confirmed present). Old content
removal is HOME-PR-2.

## Hard-constraint compliance

| Constraint | Status |
|---|---|
| CreateTripForm extraction = 0 logic change; index identical | ✅ verbatim lift; POST/validation/redirect unchanged; tsc 0; 0 dangling refs |
| Guest = register-gated create (A); POST unchanged; no anon rows | ✅ `onUnauthenticated` gate; `/api/trips` not in diff; guest never POSTs |
| Additive only — nothing on landing removed | ✅ page diff = import + mount (2 hunks); all sections present |
| Paid pills = stubs (register modal / coming soon) | ✅ stub card + "Sign in to get started" → register modal |
| Pills match trip-type pill style | ✅ same classes (active purple / idle white-border) |
| 0 schema, 0 deps | ✅ |
| `tsc --noEmit` | ✅ exit 0 |
| eslint | ✅ CreateTripForm / ModuleLauncher / trips index — **0 problems each**; page.tsx's 5 problems (2 err/3 warn) are **pre-existing on main** (the Modules-Grid `any` casts + unused Link/Image — untouched by this PR) |
| diff scoped | ✅ new `CreateTripForm.tsx`, new `home/ModuleLauncher.tsx`, `budgets/trips/page.tsx` (form swap), `page.tsx` (mount) (+ report) |

---

## Result
The home page now has a module launcher under the Hero: a pill row (Travel +
5 paid) over the selected module's card. **Travel** renders the shared
`<CreateTripForm>` (extracted verbatim from the trips index, which now renders it
too — identical behavior) and is fully usable by guests; pressing **Create trip**
while unauthenticated opens the existing register modal (register-gated save,
option A) — no backend change, no anonymous rows. The 5 **paid** pills are stubs
that prompt sign-in. Everything below the launcher (the existing landing page) is
untouched — old-content removal is HOME-PR-2. tsc clean; new components + trips
index lint clean; `POST /api/trips`, schema, and deps unchanged.
