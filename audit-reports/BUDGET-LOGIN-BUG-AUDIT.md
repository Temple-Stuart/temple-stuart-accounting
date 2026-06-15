# BUDGET-LOGIN-BUG-AUDIT — why a logged-in user gets a login prompt when budgeting a flight, + the post-login redirect

**Branch:** `claude/audit-budget-login-bug` · **Scope:** READ ONLY, no code changed.
**Date:** 2026-06-15 · **Base:** main @ `d036d69b`

---

## TL;DR (root cause)

It is **not** an auth-state bug. The home page's flight widget, `PublicFlightSearch`, is a
**search-only** component whose "Commit to Budget" / uncommit buttons are hard-wired to
fire the login modal **unconditionally** — it never checks `authed`, never reads
`currentTrip`, and never calls the real commit route. So **every** user who clicks "Commit
to Budget" on the home page — logged in or not — gets the sign-up prompt.

> `src/components/trips/PublicFlightSearch.tsx:149` → `const book = () => onRequireAuth();`
> wired to both commit handlers at `:170-171` (`onCommitLeg={book}` / `onUncommitLeg={book}`).

**This is the deferred commit-wiring, not a small bug.** The home page has **no**
flight-commit-to-trip path built yet. The real one lives in a *different* component
(`FlightPicker.tsx`) that is not mounted on the home page. "Fixing" this means **building
the logged-in flight-commit path on home** (a real piece of work), not flipping an auth flag.

---

## 1. The flight budget/commit path — the false login gate

### 1a. The handler (the smoking gun)
`PublicFlightSearch` is the public/guest flight search mounted on the home Travel tab. Its
commit action is a one-liner that always opens the auth modal:

- `src/components/trips/PublicFlightSearch.tsx:147-149`
  ```
  // BOOKING is gated: the "Commit to Budget" / uncommit actions route to sign-up,
  // never the auth-gated vendor-commit fetch. (vendor-commit also 401s guests.)
  const book = () => onRequireAuth();
  ```
- Wired into the picker view at `:170-171`:
  ```
  onCommitLeg={book}
  onUncommitLeg={book}
  ```
- The component's own docstring states this is by design (`:10-14`): *"SEARCH is public;
  BOOKING is gated. The commit/uncommit ('Commit to Budget') actions route to onRequireAuth
  (sign-up) — they do NOT fire the auth-gated vendor-commit fetch."*

**Condition checked before committing: none.** `book()` has no `if (authed)`, no `currentTrip`
check, no fetch. It calls `onRequireAuth()` every time. → **Candidate (c) is the actual cause:
the commit calls `onRequireAuth` unconditionally.**

### 1b. How it's wired in ModuleLauncher (not swapped for logged-in users)
- `src/components/home/ModuleLauncher.tsx:422` →
  `<PublicFlightSearch onRequireAuth={onRequireAuth} />`
- It is rendered **unconditionally** inside the Travel block — it is **not** gated by `authed`
  and there is **no logged-in variant** swapped in. (Contrast: `AllTripsList` /
  `TripBudgetActual` *are* gated by `authed === true` at `:265,286` region.) So a logged-in
  user on home is handed the exact same search-only widget whose commit always gates.
- `onRequireAuth` here is the home page's open-the-login-modal callback
  (`ModuleLauncher` prop → `page.tsx` `setShowLogin(true)`).

### 1c. Does the home page know the user is logged in? (yes — and it's irrelevant here)
- `src/components/home/ModuleLauncher.tsx:160` → `const [authed, setAuthed] = useState<boolean | null>(null);`
- Resolved by `/api/auth/me` in an effect at `:177-190`: `setAuthed(res.ok)` — `null` while
  loading, then `true`/`false`.
- **The flight commit never reads `authed`.** `PublicFlightSearch` doesn't receive `authed`
  as a prop and doesn't re-check auth — it just calls `onRequireAuth`. So the `authed` value
  (even when correctly `true`) has **no effect** on the flight commit. Timing/staleness of
  `authed` is a **red herring** for this bug.

### 1d. The real commit route + the real (un-mounted) commit path
- The genuine commit route is auth- and trip-scoped:
  `src/app/api/trips/[id]/vendor-commit/route.ts:82-83`
  ```
  const userEmail = await getVerifiedEmail();
  if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  ```
  It needs a `tripId` (the `[id]` segment) + a logged-in cookie session.
- The component that actually drives it is **`FlightPicker.tsx`** (NOT on the home page):
  `src/components/trips/FlightPicker.tsx:250` and `:286` →
  `fetch(`/api/trips/${tripId}/vendor-commit`, …)`. It commits a real `selectedOffer`
  against a `tripId` prop. This is used on the authed trip page, not the public home Travel tab.
- On the **home page** there is **no selected trip passed to the flight widget** and **no
  vendor-commit call** at all from `PublicFlightSearch`. (`currentTrip` IS lifted in
  ModuleLauncher and feeds `TripBudgetActual`, but it is **never handed to
  `PublicFlightSearch`** — `:422` passes only `onRequireAuth`.)

### 1e. Candidate verdict
| candidate | evidence | verdict |
|---|---|---|
| (a) no `currentTrip` selected → can't commit → login prompt by mistake | `currentTrip` exists in ModuleLauncher but is never passed to `PublicFlightSearch` (`:422`); the widget has no trip concept | **contributing** (no trip wired in), but not the trigger |
| (b) `authed` null/stale at click time | the commit never reads `authed` (1c) | **ruled out** |
| (c) commit calls `onRequireAuth` unconditionally | `PublicFlightSearch.tsx:149` + `:170-171` | **ROOT CAUSE** |
| (d) route 401s because cookie not sent / not wired to a trip | the route is never reached from home — no fetch fires | **ruled out for this symptom** (would matter only after (c)+(a) are fixed) |

**Most likely root cause: (c)** — the home flight widget's commit is a stub that always
opens sign-up — compounded by **(a)** — even if it didn't, no trip is wired to it, so it has
nothing to commit into. Both must be addressed to make logged-in budgeting work on home.

---

## 2. The post-login redirect (should land on home, logged-in mode)

### 2a. Where login redirects
- `src/components/LoginBox.tsx:14` — default `redirectTo = '/hub'`.
- On success (`:40-46`): if an `onSuccess` callback is passed it runs that; **otherwise**
  `router.push(redirectTo)`. OAuth path uses `callbackUrl: redirectTo` (`:59`).
- The home page mounts it WITHOUT `onSuccess`, with `redirectTo` from state:
  `src/app/page.tsx:162` → `<LoginBox … redirectTo={loginRedirect} … />`
  and `src/app/page.tsx:11` → `const [loginRedirect, setLoginRedirect] = useState('/hub');`
- **`setLoginRedirect` is never called** anywhere in `page.tsx` (grep: 0 setter calls). So a
  login started from the home page **always** pushes the user to **`/hub`** — the old hub,
  away from the new tabbed home.

### 2b. The redirect fix (identify, don't apply)
Two equivalent options, both one-line:
- **Simplest:** change the home default `useState('/hub')` → `useState('/')`
  (`src/app/page.tsx:11`). Login from home then lands back on `/` (the tabs), now in
  logged-in mode.
- Or pass `onSuccess={() => setShowLogin(false)}` to `LoginBox` on home so it closes the
  modal in place (no navigation) and the already-mounted `ModuleLauncher` flips to real mode
  when `/api/auth/me` re-resolves. (Note: `authed` is read once on mount at
  `ModuleLauncher.tsx:177-190`; an in-place flip would want a re-fetch or a page refresh to
  re-run that effect — the `redirectTo='/'` option sidesteps this by remounting.)
- Changing the shared `LoginBox` default (`:14`) is **not** advised — `/hub` may be the right
  destination for other mount points; scope the change to the home caller (`page.tsx:11`).

### 2c. Demo→real flip per tab (what "logged-in mode" already does, and what's left)
- **Calendar** — DONE. `ModuleLauncher.tsx:359-372`: `authed === true` mounts
  `<HubCalendar />` (real, fetches the viewer's data); `authed === false` mounts
  `<HubCalendar demoEvents={demoCalendar} … />` (static demo). Correct real/demo split.
- **Travel** — PARTIAL.
  - Trips list + budget/actual: real & gated — `AllTripsList` / `TripBudgetActual` only mount
    when `authed === true` (`ModuleLauncher.tsx` ~`:265,286`), `CreateTripForm` POSTs for real.
  - **Flight search/commit: NOT real for logged-in users.** `PublicFlightSearch` (`:422`) is
    the same search-only, always-gate widget for everyone — this is the bug in §1. The
    logged-in path (`FlightPicker` → vendor-commit) is **not wired into home**. → **the
    remaining work.**
  - Hotels/activities/visa: live search widgets; commit is likewise not wired on home.
- **Trading** — admin-only real form (`ScanFilterForm` when `isAdmin`), stub otherwise
  (`renderBody`, `:285-312`). No demo/real calendar-style flip needed.
- **Operations** — always the static showroom (`OperationsPipelineShowroom`), no live
  container by design (`:278-283`).
- **Bookkeeping / Tax / Compliance** — paid stubs (`renderBody` default, `:300-312`); no real
  mode yet (expected).

So "logged-in mode" is real for Calendar + Trips-list/budget today; the **flight (and other
vendor) commit-to-trip path on home is the missing piece**, which is exactly the §1 bug.

---

## ROOT CAUSE + FIXES (identified, NOT applied)

1. **Budget-flight login bug — ROOT CAUSE:** `PublicFlightSearch`'s commit is a stub:
   `book = () => onRequireAuth()` (`PublicFlightSearch.tsx:149`, wired `:170-171`), mounted
   unconditionally on home (`ModuleLauncher.tsx:422`) with no logged-in swap and no trip
   passed in. It always opens sign-up, even for authenticated users.
   **Fix (bigger piece):** build the logged-in flight-commit path on home — when
   `authed === true` **and** a `currentTrip` is selected, the commit must call the real
   `vendor-commit` route (as `FlightPicker.tsx:250/286` already does) instead of
   `onRequireAuth`. This needs: (i) pass `authed` + `currentTrip` into the flight widget (or
   swap to a `FlightPicker`-style authed variant), (ii) require a selected trip (prompt
   "pick a trip" rather than "log in" when authed-but-no-trip), (iii) only fall back to
   `onRequireAuth` when `authed === false`.

2. **Redirect fix:** home login pushes to `/hub` because `page.tsx:11`
   `useState('/hub')` is never reset. Change that initial value to `'/'` (or add
   `onSuccess` to the home `LoginBox` to close-in-place). The tabs flip to real mode because
   `ModuleLauncher` reads `/api/auth/me` on mount (`:177-190`) and already branches Calendar
   + Trips on `authed === true`.

## FLAG (read this first)
**The "bug" is really the deferred commit-wiring.** Budgeting a flight from the home page
has **no working logged-in path today** — `PublicFlightSearch` was built search-only for
guests and its commit intentionally routes to sign-up. So the proper fix is **not** a small
auth-state tweak; it's **building the home flight-commit-to-trip flow** (wire `authed` +
`currentTrip` into the flight widget and call `vendor-commit`). The redirect change
(`/hub` → `/`) is the small, independent fix and can ship on its own.
