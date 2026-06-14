# TWO-MODE HUB AUDIT — logged-out demo vs logged-in real

**Type:** Audit — READ ONLY. Nothing modified.
**The model to measure against:**
- **Logged OUT:** every module = an interactive **demo with ZERO API calls** (static
  demo data, like the calendar) — **EXCEPT Travel**, which stays **real** (guest
  search + guest booking; the only logged-out module that hits real APIs, by design).
- **Logged IN:** every module = **real data + real API**, account-scoped.

Citations are `file:line`.

---

## TL;DR — the inconsistency map

| Module | Logged-OUT today | Logged-IN today | Matches model? | Fix |
|---|---|---|---|---|
| **Calendar** | DEMO, zero-fetch (`demoCalendar`) | REAL (fetches) | ✅ both — **the template** | none |
| **Travel** | REAL guest search (4 public widgets) | REAL | ✅ (the exception) — but **flights errors** | fix Duffel token/env + friendly error; NOT a gate change |
| **Operations** | DEMO showroom, zero-fetch | **DEMO showroom (NOT real)** | ⚠️ half — out ✅, in ✗ | give logged-in a real path (or accept demo-only on home) |
| **Trading** | STATIC stub ("coming soon") | admin: REAL form · non-admin: stub | ✗ out (stub ≠ interactive demo) | add a demo for logged-out |
| **Bookkeeping** | STATIC stub | STATIC stub | ✗ both | demo (out) + real (in) — module unbuilt |
| **Tax** | STATIC stub | STATIC stub | ✗ both | same |
| **Compliance** | STATIC stub | STATIC stub | ✗ both | same |

**Security invariant HOLDS today:** no logged-out non-Travel module makes an API call
(all are static demo / stub). Travel's guest routes are the only logged-out API
surface, and they're rate-limited + capped (§3). So the cleanup is about UX coherence,
not a leak.

---

## 1. THE AUTH STATE ON THE HOME PAGE

`ModuleLauncher` (`src/components/home/ModuleLauncher.tsx`):
- `const [authed, setAuthed] = useState<boolean | null>(null)` (`:55`) — **null =
  loading, true/false after `/api/auth/me` resolves**.
- `useEffect` fetches `/api/auth/me`; `setAuthed(res.ok)` (`:65-68`); on `res.ok` it
  also reads `isAdmin` (`:69-71`); network error → `setAuthed(false)` (`:74`).
- `/api/auth/me` returns **401 for a guest** (no valid `userEmail` cookie), so a guest
  resolves to `authed === false`. (Confirmed in the prior CALENDAR-LEAK audit.)
- Everything keys off `authed`: `null` → render nothing/placeholder; `false` →
  demo/stub; `true` → real.

**How each module branches (today):**
- **Calendar** branches on `authed` at the top level (`:190` true → real, `:205`
  false → demo). ✅
- **Travel** does NOT branch the search widgets on `authed` — they always render and
  hit public routes (`:239-252`); only the personal `AllTripsList` is gated
  (`:135` `authed === true`).
- **Operations / Trading / Bookkeeping / Tax / Compliance** are decided in
  `renderBody` (`:116-174`) — Operations always-demo, Trading admin-vs-stub, the rest
  always-stub. They mostly **don't** use `authed` to switch demo↔real.

---

## 2. EACH MODULE'S CURRENT MODE

### Calendar — ✅ MATCHES (the template)
- Logged-out: `<HubCalendar demoEvents={demoCalendar} onRequireAuth={…} />`
  (`ModuleLauncher.tsx:214`) — static seed, **zero fetch**.
- Logged-in: `<HubCalendar />` (`:199`) — fetches the 3 personal routes.
- Band tag: "Live demo · log in to use" (out) / "Your data" (in) (`:196,211`).

### Travel — ✅ the real-guest exception (but flights is erroring)
- Always renders the 4 live widgets for everyone: `PublicFlightSearch` (`:239`),
  `PublicHotelSearch` (`:240`), `PublicActivitySearch` (`:249`), `PublicVisaCheck`
  (`:252`). Plus `CreateTripForm` (guest-usable, save gated) and `AllTripsList`
  (authed-only, `:135`).
- These hit **public** guest routes (§3). Search works logged-out **by design**.
  Band tag: "Free · guest ok" (`:227`).

### Operations — ⚠️ HALF (demo out ✅, demo in ✗)
- `renderBody` returns `<OperationsPipelineShowroom onRequireAuth={…} />` for
  `m.key==='operations'` **regardless of `authed`** (`:139-144`). So **logged-in users
  also see the demo showroom**, not real operations data.
- The showroom is zero-fetch by construction + a runtime fetch guard
  (`OperationsPipelineShowroom.tsx:60` `guardShowroomRender`). Good for logged-out;
  wrong for logged-in (model wants real). The real Operations app lives on `/hub` /
  `/operations`, not here.
- Band tag: "Live demo · log in to use" (`:227`).

### Trading — ✗ logged-out is a stub, not a demo
- `renderBody`: admin → `<ScanFilterForm …>` (real; persists filters, routes to
  `/trading`) (`:146-158`); **non-admin (incl. logged-out) → the paid stub**
  (`:160-173`): "coming soon" text + a "Launch …" button → `onRequireAuth`.
- So logged-out Trading = a **static stub** (no interactive demo). Band tag: "Paid".

### Bookkeeping / Tax / Compliance — ✗ stub for everyone
- All fall through to the same paid stub (`renderBody:160-173`) for **both**
  logged-out and logged-in. No demo, no real app. Band tag: "Paid".

### THE FLIGHTS "NOT LOGGED IN" ISSUE — root cause
- `PublicFlightSearch` has **no auth check**; it fetches `/api/flights/search`
  directly and shows `data.error` from the route on failure
  (`PublicFlightSearch.tsx:106-114`). There is **no "not logged in"/"log in" string**
  anywhere in `PublicFlightSearch.tsx` or `FlightPickerView.tsx` (grep: none). In fact
  the literal phrase "not logged in" appears **nowhere** in `src/` — the closest are
  `/api/auth/me`'s "Not authenticated" (`auth/me/route.ts:12`) and the booking-to-trip
  gate's "Sign in to save a booking to a trip." (`liteapi/book/route.ts:112`).
- `/api/flights/search/route.ts` has **NO auth gate** (no `getVerifiedEmail`, no 401)
  and **is in `PUBLIC_PATHS`** (`middleware.ts:70`). So **current code does not gate
  flights behind login** — the widget is correctly real-guest.

**Two candidate causes (both → NOT an app login gate in current code):**

1. **A now-FIXED middleware-history bug (if the deploy is stale).** Before commit
   `43766c8f` (PR-G-public-paths), the travel search routes were **not** in
   `PUBLIC_PATHS`, so a guest's `/api/flights/search` fetch was **redirected to `/`**,
   which returns HTML; `res.json()` then failed and the widget showed a generic error
   that reads like "not logged in." `43766c8f` added all travel routes to PUBLIC_PATHS
   (`middleware.ts:70-79`), and current HEAD includes it — so **a current build is
   already fixed.** If the user still sees it, suspect a **stale deploy** of the
   pre-fix middleware.
2. **Duffel provider/env error passed through (if reproduced on current code).**
   `lib/duffel.ts:6` throws `'DUFFEL_API_TOKEN not configured'` when the env token is
   missing (`:2` `process.env.DUFFEL_API_TOKEN`); an **invalid/expired** token makes
   Duffel return a 401, and the route surfaces `error.message` verbatim
   (`flights/search/route.ts:96`). That raw provider auth message reads like "not
   logged in."

- **Verdict:** flights is correctly **real-guest (ungated)** in current code — the
  app is **not** gating it behind login. The symptom is either a **stale deploy** of
  the pre-`43766c8f` middleware (cause 1, already fixed in HEAD) or a **Duffel
  env/provider** error (cause 2). **To disambiguate:** confirm the deployed commit
  includes `43766c8f`, then `curl -i '/api/flights/search?origin=JFK&destination=LAX&departureDate=2026-09-01&passengers=1'`
  with **no cookie** — a 200 with offers = fully fixed; a 5xx with a Duffel/token
  message = cause 2 (set/refresh `DUFFEL_API_TOKEN`); a 3xx redirect to `/` = stale
  deploy (cause 1). **Fix:** (1) redeploy current `main`; (2) set/refresh the Duffel
  token (env, Alex) + optionally map provider-auth errors to a friendly "Flight search
  is temporarily unavailable" (the route already does this for rate-limit/quota,
  `:84,90`). **No un-gating needed** either way.

---

## 3. TRAVEL IS REAL-GUEST-CAPABLE (the exception confirmed)

**The travel search routes are public** (`src/middleware.ts` PUBLIC_PATHS):
`/api/flights/search` (`:70`), `/api/travel/hotels/search` (`:71`),
`/api/travel/activities/search` (`:74`), `/api/travel/visa/check` (`:75`), plus
`/api/travel/hotels/content`, `/reviews`, `/locations/*`, and the guarded booking
routes `/api/travel/liteapi/prebook` + `/book` (`:72-79`).

**Route-level auth:**
- `/api/flights/search` — no `getVerifiedEmail` (fully public). 
- `/api/travel/activities/search` — no `getVerifiedEmail` (fully public).
- `/api/travel/visa/check` — no `getVerifiedEmail` (fully public).
- `/api/travel/hotels/search` — has **one** `getVerifiedEmail`, but it's the
  **optional guest-mode** read (returns null for guests to tag guest vs account
  booking), not a 401 search gate (PR-G2/G3 guest-booking model).

**UI-level:** every widget keeps SEARCH public and routes only BOOKING to
`onRequireAuth`:
- `PublicHotelSearch` — "SEARCH is public; BOOKING is gated… Book routes to
  onRequireAuth" (`:10`); fetches `/api/travel/hotels/search` (`:75`).
- `PublicActivitySearch` — same pattern; fetches `/api/travel/activities/search`
  (`:56`); `book = () => onRequireAuth()` (`:72`).
- `PublicVisaCheck` — fetches `/api/travel/visa/check` (`:76`); no auth at all.
- `PublicFlightSearch` — fetches `/api/flights/search` (`:106`); `book =
  onRequireAuth` (`:149`).

So **logged-out Travel WORKS** (real guest search across all four), and the flights
"not logged in" is a provider/env error (§2), **not** the UI wrongly gating a public
route.

---

## 4. THE DEMO TEMPLATE (calendar) — the pattern to replicate

`HubCalendar` (`src/components/hub/HubCalendar.tsx`):
- Optional `demoEvents?: GridEvent[]` prop (`:75`). When set, the fetch effect
  **early-returns** (`:143` `if (demoEvents) return;`) → **zero personal-route calls**;
  the merge renders the seed instead (`:150`).
- ModuleLauncher passes the static `demoCalendar` seed logged-out (`:214`), nothing
  logged-in (`:199` real fetch). Labeling: "Live demo · log in to use" vs "Your data"
  (`:196,211`).
- **A second demo template exists for non-calendar modules:**
  `OperationsPipelineShowroom` — pure views + static seed + `guardShowroomRender`
  runtime fetch guard (`OperationsPipelineShowroom.tsx:60`). That's the "interactive
  demo, zero-API" half; what it lacks is the calendar's **real-when-authed toggle**.

**The reusable recipe** = (a) a static demo seed (operations-style), (b) a
`demoEvents`/`demo`-style prop that early-returns the fetch, (c) the
`authed === true ? <Real/> : <Demo/>` switch in ModuleLauncher, (d) the "Live demo ·
log in" band tag. Trading/Bookkeeping/Tax/Compliance need this; Operations needs the
real-when-authed half added.

---

## REPORT: THE CLEANUP PLAN

### The flights bug (do first — the acquisition hook is visibly broken)
- **Root cause (one of two):** (1) a **stale deploy** of the pre-`43766c8f`
  middleware (travel routes not yet in PUBLIC_PATHS → guest fetch redirected to `/` →
  HTML → JSON-parse error) — already fixed in current HEAD; or (2) `DUFFEL_API_TOKEN`
  missing/invalid, leaking a raw provider auth error through
  `flights/search/route.ts:96` (`lib/duffel.ts:6`). Disambiguate with the cookieless
  `curl` in §2.
- **Fix:** (1) redeploy current `main`; (2) set/refresh the token (Alex/env), then
  optionally map provider-auth errors to a friendly message (mirroring the route's
  existing rate-limit/quota messages `:84,90`). **No gating change** — flights is
  correctly public (`middleware.ts:70`, no `getVerifiedEmail`).

### Staged module cleanup (by impact)
1. **Flights env/error (above)** — highest impact, smallest change (env + a message map).
2. **Operations real-when-authed** — give logged-in users real operations data on the
   home module instead of the demo showroom (or consciously keep it demo-only and
   relabel). Today it's demo for everyone (`renderBody:139-144`).
3. **Trading / Bookkeeping / Tax / Compliance demos** — replace the static "coming
   soon" stub (`renderBody:160-173`) with an **interactive demo** (calendar/operations
   template) for logged-out, so "every module is a living demo" holds. Stage these as
   each module's real app is built (the real logged-in half can't exist until then).
4. **Calendar** — already correct; it's the reference. No change.

### New building blocks needed
- A shared **demo/real toggle** convention (calendar already embodies it) + per-module
  **static demo seeds** (operations-style). Trading has a real admin form to reuse;
  Bookkeeping/Tax/Compliance have neither a demo nor a real app yet.

### Security invariant — CONFIRMED HOLDING
- Logged-out, **no non-Travel module hits an API**: Calendar demo early-returns the
  fetch (`HubCalendar.tsx:143`); Operations showroom is fetch-free + guarded
  (`OperationsPipelineShowroom.tsx:60`); Trading/Bookkeeping/Tax/Compliance stubs are
  static (a button → `onRequireAuth`); `AllTripsList` is `authed===true`-gated
  (`ModuleLauncher.tsx:135`).
- **Travel's guest routes are the only logged-out API surface**, all in PUBLIC_PATHS
  and each guarded by per-IP `rateLimit` + a durable daily provider cap (e.g.
  `flights/search/route.ts:84,90` rate-limit + `reserveTravelSearch('duffel')`).
- → No personal data and no uncapped cost is reachable logged-out. As new module
  demos are added, **keep them zero-API (static seed)** to preserve this.

---

## Citations index
- Auth state: `ModuleLauncher.tsx:55,63-74`; gate uses `:135,190,205`.
- renderBody modes: `:116-174` (travel `:117-138`, operations `:139-144`, trading
  `:146-158`, stub `:160-173`).
- Calendar demo template: `HubCalendar.tsx:75,143,150`; ModuleLauncher `:196,199,211,214`.
- Operations demo: `OperationsPipelineShowroom.tsx:60`.
- Flights: `PublicFlightSearch.tsx:106-114,149`; `api/flights/search/route.ts:84,90,96`
  (no auth gate); `lib/duffel.ts:2,6`; `middleware.ts:70`.
- Travel widgets/routes: `PublicHotelSearch.tsx:10,75`; `PublicActivitySearch.tsx:56,72`;
  `PublicVisaCheck.tsx:76`; PUBLIC_PATHS `middleware.ts:70-79`.
