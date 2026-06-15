# FLIGHT-COMMIT-WIRE-AUDIT — wire the home flight search to commit a flight to a trip

**Branch:** `claude/audit-flight-commit-wire` · **Base:** main @ `98da70d2` · **Date:** 2026-06-15
**Scope:** READ ONLY. No code changes. Maps the wiring for `PublicFlightSearch` → `vendor-commit`.
**Reference:** `docs/FREEMIUM-MODEL.md` (free to use · account to save · pay to unlock).

---

## TL;DR

The home flight widget can **search** (free, public) but its commit button is a stub:
`PublicFlightSearch.tsx:149` `book = () => onRequireAuth()` — wired to both commit + uncommit
(`:170-171`). It receives **only `onRequireAuth`** (`ModuleLauncher.tsx:422`) — no `authed`,
no `currentTrip`, no `tripId` — so it can never reach the commit route.

The **working commit path already exists** in `FlightPicker.tsx` (the in-trip-page flight
picker): `commitLeg` POSTs to `/api/trips/[id]/vendor-commit` (`:250`), which creates the
budget line + itinerary + calendar event. **The fix is to bring that path to home**, branched
across the four freemium states. One atomic PR.

**One real surprise:** the freemium line "guest can create/see a trip in-session but it
doesn't save" is **not** how the home works today — a guest can't make even an in-session
trip; trip creation nudges straight to sign-up (`CreateTripForm` + `gateGuestCreate`), and the
trips list never mounts for guests. So the guest flight path = **sign-up nudge** (matches
today); the in-session-trip idea is a **separate, larger** piece — flagged below.

---

## 1. The current home flight flow

### `PublicFlightSearch.tsx` — search works, commit is a stub
- **Search (free, always open):** `searchLeg` (`:86-116`) hits the **public** route
  `/api/flights/search` (`:106`) — no auth gate. The docstring states search is public,
  booking is gated (`:10-13`). ✅ nothing gates the search itself.
- **Commit/uncommit (the gap):** `const book = () => onRequireAuth();` (`:149`), wired as
  `onCommitLeg={book}` and `onUncommitLeg={book}` (`:170-171`). It **always** opens sign-up —
  no `authed` check, no `tripId`, no `vendor-commit` call. It does not even know if the user
  is logged in.
- It renders the shared pure `<FlightPickerView>` (`:161-172`) — the **same view** the working
  `FlightPicker` uses, with the same `onCommitLeg`/`onUncommitLeg`/`committing` callbacks. So
  the view already supports a real commit; only the handler is missing.

### How it's mounted — receives nothing useful
- `ModuleLauncher.tsx:422` → `<PublicFlightSearch onRequireAuth={onRequireAuth} />`. **Only**
  `onRequireAuth` is passed.
- ModuleLauncher **already has** what's needed but doesn't forward it:
  - `authed` (`:171`, from `/api/auth/me`),
  - `currentTrip` (`:181`, set when a row in `AllTripsList` is clicked — `:264-267`),
  - `setTripsRefresh` (bumps the trips list / budget after a change),
  - `gateGuestCreate` (`:229`, the existing guest→sign-up gate).

---

## 2. The real commit path (already works in the trip page)

### `FlightPicker.tsx` — the path to bring to home
- Props include **`tripId`** + `onCommitted` (`:24-33`). It owns the live commit logic.
- **`commitLeg`** (`:231-278`): builds the body from the selected offer and POSTs to
  `/api/trips/${tripId}/vendor-commit` (`:250-264`):
  ```
  { optionType: 'flight', optionId: flightId, startDate, endDate,
    amount: offer.price, notes: title, startTime, endTime, arriveDate }
  ```
  On success → `updateLeg({ committed:true, commitId, ... })` + `onCommitted()` (`:271-272`).
- **`uncommitLeg`** (`:281-304`): `DELETE` to the same route with `{ optionType:'flight',
  optionId: leg.commitId, notes }`.
- Both use the **same `FlightOffer`/`FlightLeg` types** as `PublicFlightSearch` (both import
  from `./FlightPickerView`), so the offer shape is identical — the logic ports directly.

### `vendor-commit` route — what it does + its gating
`src/app/api/trips/[id]/vendor-commit/route.ts`:
- **Auth gate (server):** `getVerifiedEmail()` → `401 Unauthorized` if logged out (`:82-83`);
  trip is ownership-scoped `trips.findFirst({ where:{ id, userId } })` (`:86`, 404 if not the
  user's). So a guest POST is rejected server-side regardless — the client must gate first.
- **What it creates (POST), all in one `$transaction` (`:159`):**
  - **B · `budget_line_items`** (`:228-239`) — the **budgeted** expense: `coaCode` (travel 9xxx),
    `amount`, `description`, `source:'trip'`, `tripId`, `year/month`.
  - **C · `trip_itinerary`** — flight branch (`:260-272`): one entry with depart date/time
    (`homeDate/homeTime`) + arrive date/time (`destDate/destTime`), `category:'flight'`,
    `vendor`, `cost`, `vendorOptionId/Type`.
  - links `budget_line_items.itineraryId` (`:313-318`).
  - **D · `calendar_events`** via raw SQL (`:325-336`) so it shows on the hub/calendar.
  - returns JSON (`:343`).
- **DELETE (uncommit)** is likewise gated (`:364`) and removes the `calendar_events` row
  (`:434-437`) + the budget/itinerary rows.

So a single POST = **budgeted expense + itinerary + calendar event**, exactly the freemium
"save as plan → persists → maps to calendar."

---

## 3. The freemium wiring — the 4 states

| State | Should do | Where the check lives / needs to live |
|---|---|---|
| **Logged OUT (guest)** | Search freely (already does). Commit / "save as plan" → **sign-up nudge**. | `authed === false` → call `onRequireAuth` (already the prop). Today: `book()` does this for everyone; correct only for this state. |
| **Logged IN + selected trip** | "Save as plan" → POST `vendor-commit` with `currentTrip.id` → budgeted + persists + calendar. | Needs `authed===true` **and** `currentTrip` passed in; run `FlightPicker.commitLeg`-style POST against `currentTrip.id`. |
| **Logged IN + NO trip** | Prompt **"pick or create a trip"** (NOT a login prompt). | `authed===true && !currentTrip` → inline message / point at the trips list above (in the same Travel block). New branch. |
| **Free vendor feed** | Flight search (Duffel) always open, never gated. | `searchLeg` → public `/api/flights/search` (`PublicFlightSearch.tsx:106`); no auth check. ✅ confirmed — leave as-is. |

**Where `authed`/`currentTrip` are known:** both live in `ModuleLauncher` (`:171`, `:181`) and
just need to be passed down as props to `PublicFlightSearch` (today only `onRequireAuth` is).

---

## 4. The wiring plan

### What to pass into `PublicFlightSearch`
From `ModuleLauncher.tsx:422`, add props alongside `onRequireAuth`:
- `authed: boolean | null` (`:171`)
- `currentTrip: TripRow | null` (`:181`)
- `onCommitted?: () => void` → wire to `setTripsRefresh((n)=>n+1)` so the selected trip's
  `TripBudgetActual` re-fetches and the new flight shows as budgeted.

### How the commit action branches (replace the `book` stub, `:149`/`:170-171`)
Replace `onCommitLeg`/`onUncommitLeg` with handlers that branch:
- `authed !== true` → `onRequireAuth()` (sign-up nudge).
- `authed === true && !currentTrip` → set an inline "pick or create a trip first" message on
  the leg (reuse `updateLeg(legId, { error })`) — point them at the trips list in the same tab.
- `authed === true && currentTrip` → port `FlightPicker.commitLeg` (`:231-278`): POST
  `/api/trips/${currentTrip.id}/vendor-commit`, set `committed/commitId`, call `onCommitted`.
- Uncommit → port `FlightPicker.uncommitLeg` (`:281-304`) against `currentTrip.id`.

### Reusable vs new
- **Reusable as-is:** the `vendor-commit` route (no change); the `FlightPickerView`
  (already has the commit callbacks + `committing` state); the `FlightOffer`/`FlightLeg`
  types; the `commitLeg`/`uncommitLeg` bodies from `FlightPicker.tsx`.
- **New (small):** the 3-prop additions on `PublicFlightSearch` + the 4-state branch in its
  commit/uncommit handlers (≈ the two ported functions + a guard). `committing` state
  (already in `FlightPicker`) added to `PublicFlightSearch` (today it passes `committing={null}`).

### Scope flag — the guest "in-session trip" is NOT current behavior (separate, larger)
The freemium doc says a guest can "create/see a trip in-session (doesn't save)." Today:
- `CreateTripForm` for a guest **does not** create anything — `onUnauthenticated`
  (`gateGuestCreate`, `ModuleLauncher.tsx:229-235`) returns `true` for `authed===false`, which
  **opens the register modal and skips the POST** (`CreateTripForm.tsx:98-105`).
- `AllTripsList` only mounts when `authed===true` (`ModuleLauncher.tsx:262`) and fetches
  `/api/trips` (`AllTripsList.tsx:85`) — never for guests.

So there is **no in-session, non-persisted guest trip** today; a guest hitting trip-create gets
a sign-up nudge. Building "guest makes a throwaway in-session trip they can attach a flight to"
is a **bigger, separate concern** (local trip state + a guest commit-to-local path). **Keep it
out of the flight-commit PR.** For now the guest flight path = sign-up nudge (consistent with
the rest of Travel).

### Recommended atomic PR
- **PR-Flight-Commit** (one concept): pass `authed` + `currentTrip` + `onCommitted` into
  `PublicFlightSearch`; branch commit/uncommit across the 3 logged-in/out states (sign-up
  nudge · pick-a-trip · real `vendor-commit`); refresh the budget after. Reuses the
  `vendor-commit` route + `FlightPicker` commit logic verbatim. Self-contained — does not touch
  `vendor-commit`, `FlightPicker`, or trip creation.
- **Deferred (separate):** guest in-session trip (the freemium "create/see but don't save"
  path) — a larger Travel-state PR.

---

## REPORT (summary)

- **Current flow:** home flight **search is live + free** (`/api/flights/search`, public); the
  **commit is a stub** (`PublicFlightSearch.tsx:149` → `onRequireAuth`), mounted with only
  `onRequireAuth` (`ModuleLauncher.tsx:422`) — no `authed`/`currentTrip`/`tripId`.
- **Reusable commit path:** `FlightPicker.commitLeg/uncommitLeg` → `/api/trips/[id]/vendor-commit`
  (`FlightPicker.tsx:250`, `:286`), which writes `budget_line_items` + `trip_itinerary` +
  `calendar_events` (`vendor-commit/route.ts:228`, `:260`, `:325`) under an auth+ownership gate
  (`:82-86`).
- **4-state branch:** guest → sign-up nudge (`onRequireAuth`); logged-in + trip →
  `vendor-commit` against `currentTrip.id`; logged-in + no trip → "pick a trip"; search always
  free.
- **PR plan:** one atomic **PR-Flight-Commit** (pass `authed`+`currentTrip`+`onCommitted`, port
  the commit logic, branch the 4 states). Flag: guest in-session trip is **not** today's
  behavior and is a separate, larger PR — not part of this one.

**No code modified. Audit only.**
