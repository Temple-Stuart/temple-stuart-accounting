# AUTH-KEYSTONE-AUDIT — make the home page the real logged-in app

**Branch:** `claude/audit-auth-keystone` · **Base:** main @ `6e08b2e8` · **Date:** 2026-06-15
**Scope:** READ ONLY. No code changes. Maps the three auth fixes (redirect · logout · flight bug).
**Reference:** `docs/FREEMIUM-MODEL.md` (free to use · account to save · pay to unlock; login → home not `/hub`; logout in the header where "Enter →" is; `/hub` retiring).

---

## TL;DR

All three are the **same surface: the home page's logged-in handling** — and the root issue
is that **`src/app/page.tsx` has zero auth awareness.** It never checks who's logged in, so:
- its login modal always redirects to **`/hub`** (a hardcoded default), and
- its header always shows **"Enter →"** with **no logout** (logout exists, but only inside the
  *other* app shell, `AppLayout`/`Sidebar`).

The flight "login bug" is a **different** thing: the home flight widget's commit is a
**stub** (`book = () => onRequireAuth()`) — the deferred commit-wiring, not an auth-state bug.

Recommended: **PR-Auth-Home** (redirect → `/` + logout button + authed header — one small PR,
one surface) and a separate **PR-Flight-Commit-Wire** (the bigger money-arc piece).

---

## 1. The login flow + redirect

### Where login happens
- The home modal: `src/app/page.tsx` mounts `<LoginBox>` (`:162`). It's opened by the header
  **"Enter →"** button (`page.tsx:36`, sets `loginMode='login'` + `showLogin=true`) and by
  **"Get Started"** / `onRequireAuth` (`:58`, `:71`, register mode).
- `LoginBox` POSTs to `/api/auth/login` or `/api/auth/signup` (`LoginBox.tsx:28`).
- There's also a standalone page `src/app/login/page.tsx` and the pricing page, both of which
  log users in separately (see §4).

### Where it redirects on success — the `/hub` problem
- `LoginBox.tsx:14` — default **`redirectTo = '/hub'`**.
- On success (`:40-46`): if an `onSuccess` prop is passed it runs that; **otherwise**
  `router.push(redirectTo)` (`:44`). OAuth uses `callbackUrl: redirectTo` (`:59`).
- Home passes `redirectTo={loginRedirect}` (`page.tsx:162`), and
  `loginRedirect = useState('/hub')` (`page.tsx:11`). **`setLoginRedirect` is never called**
  anywhere (grep: 0 setters) → **a login started from home always lands on `/hub`.**

### Source of truth for "authed"
- **Two mechanisms** (per the audits): cookie-auth (`src/lib/cookie-auth.ts`,
  `getVerifiedEmail()`, the `userEmail` cookie) **+** next-auth (`/api/auth/[...nextauth]`,
  `useSession`).
- On the home page the *only* place that resolves login state is **inside `ModuleLauncher`**:
  `const [authed, setAuthed] = useState<boolean | null>(null)` (`ModuleLauncher.tsx:171`),
  filled by a `/api/auth/me` fetch on mount. **`page.tsx` itself has no `authed` state and
  never calls `/api/auth/me`** — so the page shell (header, redirect) is auth-blind.

### What changing the redirect to "/" requires
- Minimal: change `page.tsx:11` `useState('/hub')` → `useState('/')`. (Scope it to the home
  caller; don't change the shared `LoginBox` default `:14`, which other mounts may rely on.)
- Does home already behave differently when authed? **Partly, inside `ModuleLauncher`:**
  - **Calendar** flips demo/real on `authed` (`ModuleLauncher.tsx` calendar blocks: authed →
    real `HubCalendar`, guest → static `demoCalendar`).
  - **Travel** trips list + budget/actual mount only when `authed === true`
    (`AllTripsList`/`TripBudgetActual`).
  - **Trade/Operations/Books/Tax/Compliance** don't change on `authed` (admin gate / showroom
    / stubs).
  So `router.push('/')` lands the user on the home app already in real mode where wired —
  **but the page shell won't re-render its header** to reflect login (see §2), because
  `page.tsx` doesn't track auth. The redirect fix and the header fix go together.

---

## 2. Logout — exists, but not on the home surface

### It exists (in the deep app shell only)
- `src/components/ui/AppLayout.tsx:133-140` — `handleSignOut`:
  ```
  document.cookie = 'userEmail=; path=/; max-age=0';   // clear cookie-auth
  if (session) { await signOut({ callbackUrl: '/' }); } // next-auth
  else { await fetch('/api/auth/logout', { method: 'POST' }); router.push('/'); }
  ```
  Wired to the **Sidebar** (`AppLayout.tsx:169`, `onSignOut={handleSignOut}`).
- The clear-cookie route exists: `src/app/api/auth/logout/route.ts:6-7`
  (`cookieStore.delete('userEmail')`).

### It's MISSING on the home page
- `src/app/page.tsx` header is **static**: it always renders **"Enter →"** (`:36`) — there is
  **no logged-in branch**, no logout, because `page.tsx` never learns `authed` (§1). A
  logged-in user on `/` still sees "Enter →" and has no way to sign out from home.

### Where the logout button goes + the path to reuse
- **The header**, in place of / next to "Enter →" (`page.tsx:33-40` is the header's right-side
  button group). When authed → show user + **Logout**; when not → "Enter →".
- Reuse the proven `AppLayout.handleSignOut` recipe: **clear `userEmail` cookie**
  (`document.cookie ...max-age=0`) **+** next-auth `signOut({callbackUrl:'/'})` **+/or**
  `POST /api/auth/logout`, then stay on `/` (or refresh so the tabs flip to guest mode).
- Prereq: `page.tsx` must gain an `authed` source of truth (a `/api/auth/me` check, same as
  `ModuleLauncher.tsx:171`) to choose Enter-vs-Logout.

---

## 3. The budget-flight login bug — it's the missing commit-wiring

### The handler
- `src/components/trips/PublicFlightSearch.tsx:149` — `const book = () => onRequireAuth();`
  wired to **both** commit actions: `onCommitLeg={book}` / `onUncommitLeg={book}` (`:170-171`).
- The component's own docstring (`:10-13`) says this is by design: search is public, "the
  commit/uncommit ... actions route to onRequireAuth (sign-up) — they do NOT fire the
  auth-gated vendor-commit fetch."
- It is mounted on the home Travel tab with **only** `onRequireAuth`
  (`ModuleLauncher.tsx` renders `<PublicFlightSearch onRequireAuth={onRequireAuth} />`); it is
  **not** passed `authed` or `currentTrip`. (`currentTrip` IS lifted in ModuleLauncher
  (`:181`) but feeds `AllTripsList`/`TripBudgetActual`, never the flight widget.)

### Why a logged-in user trips it — candidate verdict
| candidate | evidence | verdict |
|---|---|---|
| (a) no `currentTrip` on home → can't target a trip | `currentTrip` never passed to the flight widget | contributing |
| (b) `authed` null/stale at click | the handler never reads `authed` | **ruled out** |
| (c) `onRequireAuth` fires unconditionally | `PublicFlightSearch.tsx:149` + `:170-171` | **the trigger** |
| (d) commit needs `/api/trips/[id]/vendor-commit` + a tripId the home flow doesn't pass | the route is auth+trip-scoped; home never calls it | true (not reached) |
| (e) home flight-commit path isn't wired (deferred) | `book` is a stub; the real path is in `FlightPicker.tsx` (→ `vendor-commit`), not mounted on home | **ROOT CAUSE** |

### Small bug or missing wiring?
**Missing commit-wiring.** `PublicFlightSearch` was built search-only for guests; its commit
is an intentional sign-up stub. There is **no working logged-in flight-commit path on the home
page** — the real one (`FlightPicker.tsx` → `vendor-commit` with a `tripId`) lives in the deep
`/budgets/trips/[id]` flow. So the "fix" is to **build** the home commit path, not flip an auth
flag. Per `docs/FREEMIUM-MODEL.md`: free to *search*, account-to-*save* — committing a flight
to a trip is the "save" that needs an account **and** a selected trip.

---

## 4. How they connect + fix plan

### Same surface
Redirect (§1) and logout (§2) are **both** about `page.tsx` learning `authed` and acting on it
(header shows Enter-vs-Logout; modal redirects to `/`). The flight bug (§3) is a **separate,
larger** Travel-money-arc concern (commit-wiring), gated by the freemium save rule.

### `/hub` retirement scope — what points there
- `src/components/ui/Sidebar.tsx:60,71,96` — the deep-app sidebar logo + nav link to `/hub`.
- `src/components/LoginBox.tsx:14` — default `redirectTo='/hub'`.
- `src/app/page.tsx:11` — home `loginRedirect='/hub'`.
- `src/app/login/page.tsx:28` — `window.location.href = '/hub'` on login success.
- `src/app/pricing/page.tsx:118` — `router.push('/hub')`.
- **What breaks if we stop:** nothing structural — `/hub` still renders. Retiring it means
  repointing these five entry points to `/`. The home redirect is the first/safest; the
  Sidebar link is inside the deep app and can change when `/hub` is fully folded in. Do it
  incrementally, not in the keystone PR.

### Recommended PR plan (each atomic)
1. **PR-Auth-Home** (redirect + logout + authed header — ONE PR, one surface):
   - `page.tsx` gains an `authed` check (`/api/auth/me`, like `ModuleLauncher.tsx:171`).
   - Header: authed → show Logout (reuse `AppLayout.handleSignOut` recipe); guest → "Enter →".
   - Login redirect: home `loginRedirect` `/hub` → `/` (or pass `onSuccess` to close-in-place
     and refresh so tabs flip). Small, high-value, makes home the logged-in app + testable
     login/logout flips.
2. **PR-Flight-Commit-Wire** (the bug — separate, larger):
   - Pass `authed` + `currentTrip` into the flight widget. Commit logic: `authed===false` →
     `onRequireAuth` (sign-up); `authed` + no trip → "pick a trip first"; `authed` + trip →
     real `POST /api/trips/[id]/vendor-commit` (as `FlightPicker.tsx` already does). Extends to
     hotels/activities later. This is the Travel money-arc, not an auth tweak.
3. **(Later) PR-Hub-Retire** — repoint the five `/hub` entry points to `/` once the home app
   fully covers it.

**Sequence:** PR-Auth-Home first (unblocks testing login→home + logout flips), then
PR-Flight-Commit-Wire, then the `/hub` retirement cleanup.

---

## REPORT (summary)

- **Login flow:** home "Enter →"/"Get Started" → `LoginBox` → on success `router.push('/hub')`
  (`LoginBox.tsx:44` + home default `page.tsx:11`, never reset). Authed source of truth lives
  **only inside `ModuleLauncher`** (`:171`), **not** in `page.tsx`.
- **Logout:** **exists** in `AppLayout.tsx:133-140` (cookie clear + `signOut` + `/api/auth/
  logout`) but **missing from the home header** — `page.tsx` is auth-blind and always shows
  "Enter →".
- **Flight bug:** root cause = **missing commit-wiring** (`PublicFlightSearch.tsx:149` stub),
  not an auth-state bug; the real commit path (`FlightPicker.tsx` → `vendor-commit`) isn't
  mounted on home.
- **Plan:** PR-Auth-Home (redirect + logout + authed header, one surface) → PR-Flight-Commit-
  Wire (build the home commit path) → later PR-Hub-Retire (repoint 5 entry points).

**No code modified. Audit only.**
