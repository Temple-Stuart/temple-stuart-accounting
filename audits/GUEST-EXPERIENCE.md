# GUEST EXPERIENCE SYSTEM — AUDIT (read-only)

**Branch:** `claude/audit-guest-experience` · **Date:** 2026-06-21 · **Scope:** map the entire current
guest (logged-out) experience + free/paid gating, to sequence atomic PRs toward the target. Read-only;
every claim cites `file:line`. Unread = "NOT VERIFIED." No DB access — code only; DB checks flagged.

---

## Q1 — GUEST VS LOGGED-IN DETECTION

Both the landing page and ModuleLauncher resolve auth client-side via **`/api/auth/me`**:
- `ModuleLauncher.tsx:130` `const [authed, setAuthed] = useState<boolean | null>(null)` → `:154-167`
  `fetch('/api/auth/me')` → `setAuthed(res.ok)` (+ `isAdmin` from the JSON, `:162`). `null` = resolving,
  `true`/`false` = authed/guest.
- `page.tsx:25-41` does the **same** `/api/auth/me` check for the header (Enter ↔ Log out).
- Server-side, every non-public route is gated by `middleware.ts:93` (cookie check), with an explicit
  **`PUBLIC_PATHS`** allowlist (`middleware.ts:50-79`).

→ The UI branches on the **`authed` tri-state**; `authed === false` is the guest render path.

## Q2 — THE DEMO DATA → **(b) hardcoded static literals**, injected only for guests

**VERDICT: the guest calendar's demo events are PURE STATIC hardcoded literals** in
`src/components/hub/showroom/demoCalendar.ts` — *"the LIVING DEMO seed… PURE STATIC DATA — no fetch, no
effect, no server import — just typed literals… Nothing here is real"* (`demoCalendar.ts:1-16`). Each id is
`demo-cal-*` (e.g. `demo-cal-trip-lisbon` `:32`); it builds a pretend trip (`:30-41`), routines
(`:43-45`), etc.

**How it reaches a guest:** `ModuleLauncher.tsx:457-462` — when `authed === false`, it renders
`<HubCalendar demoEvents={demoCalendar} onRequireAuth={onRequireAuth} />`. When `authed === true`
(`:442-456`) it renders the **real** `<HubCalendar />` + `<RunwayBudgetPanel/>` with **no** demoEvents.
Inside HubCalendar, `isDemo = !!demoEvents` (`HubCalendar.tsx:105`); the fetch effect **early-returns**
when demo (`:173` `if (demoEvents) return;`) and `gridEvents` returns the seed directly (`:180`).

→ **Removing demo = change the guest render path** (stop passing `demoCalendar`), **NOT** a DB seed
delete and **NOT** a flag flip. *(Other tabs have their own static seeds:
`trips/showroom/demoTravel.ts`, `operations/.../showroom/demoData.ts` — same convention.)*

## Q3 — CURRENT FREE/PAID MECHANISM → the `MODULES[].live` flag + `renderBody` branch

- **`MODULES` array** (`ModuleLauncher.tsx:58-73`) carries a per-module **`live: boolean`**. Only
  **`travel` is `live: true`** (`:59`); `trading`, `projects`, `routines`, `bookkeeping`, `tax`,
  `compliance`, `content` are all **`live: false`**.
- The badge label is driven by it: `m.live ? 'Free · guest ok' : 'Paid'` (`:562`), with routines/projects
  showing `'Live demo · log in to use'` to guests.
- **The real gate is `renderBody(m)`** (`:206-393`) — it branches on `authed` per module (details in Q4).
  There is **no locked overlay**; "locked" = renderBody returns a teaser/stub instead of the live tool.
- Server-side, paid external routes self-gate (`requireTier`); guest-allowed routes are in
  `PUBLIC_PATHS` (`middleware.ts:50-79`).

## Q4 — PER-TAB GUEST BEHAVIOR TODAY

| Tab (`key`) | `live` | Guest sees today | Cite |
|---|---|---|---|
| **Runway** (`calendar`) | n/a (not in MODULES) | **DEMO calendar** (static `demoCalendar`) + "Make my free account" nudge | `ModuleLauncher:457-462`; `demoCalendar.ts` |
| **Travel** (`travel`) | `true` | **Fully usable** — public search + guest booking; "Your trips" shows a sign-up nudge (saving gated) | `renderBody:207-290`; `:256-268` |
| **Routines** (`routines`) | `false` | Fetch-free **create teaser** (`HomeRoutineCreateForm`) → "create" opens register modal | `renderBody:331-348` |
| **Projects** (`projects`) | `false` | **Rich populated showroom** (`OperationsPipelineShowroom`) | `renderBody:292-310` |
| **Content** (`content`) | `false` | **Rich populated showroom** (`OperationsPipelineShowroom`) | `renderBody:312-329` |
| **Trade** (`trade`/`trading`) | `false` | **Paid stub** ("coming soon… Requires an account · Launch") — *admin* sees the real scanner | `renderBody:350-392` |
| **Books** (`books`/`bookkeeping`) | `false` | **Paid stub** | `renderBody:379-392` |
| **Tax** (`tax`) | `false` | **Paid stub** | `renderBody:379-392` |
| **Compliance** (`compliance`) | `false` | **Paid stub** | `renderBody:379-392` |

## Q5 — TRAVEL GUEST-BOOKING (revenue exception) → guest CAN book, by design

- **Search is PUBLIC (no auth):** `flights/search` (`route.ts:6` "PUBLIC flight SEARCH", GET `:17`),
  `travel/hotels/search`, `travel/activities/search`, `liteapi/prebook` — all in **`PUBLIC_PATHS`**
  (`middleware.ts:70-79`).
- **Booking is auth-OPTIONAL (guest-allowed):**
  - `flights/book/route.ts:47-48` — *"a guest books standalone. NO 401 here"* (`getVerifiedEmail` read,
    not required).
  - `travel/liteapi/book/route.ts:91-101` — *"Auth is OPTIONAL — resolve account vs guest"*;
    `isAccount = !!user` (`:101`). A guest completes the booking.
- **Guards on the paid booking spend** (`liteapi/book`): per-IP **rate limit** (`:49-50`, "booking is the
  real spend", **limit 3 / 300s**) + a **required `paymentTransactionId`** (`:66`) — i.e. the **guest must
  have paid first** (payment-intent flow). So the *booking* is **guest-funded**, not Alex's cost.

→ **Guest CAN search AND book** today (the intended affiliate/commission model). Trip **saving** is the
only signup-gated piece (`gateGuestCreate`, `ModuleLauncher:191-194`, `:280`).

## Q6 — THE REDUNDANT BANNER

- **The banner** lives **inside HubCalendar** (the demo-calendar footer): `HubCalendar.tsx:258-270` —
  `{isDemo && (… "Like what you see? Make a free account and fill it with your own trips, routines, and
  plans." … <button>Make my free account</button> onClick={onRequireAuth} …)}` (`:261,268`). Renders only
  for guests (`isDemo`).
- **It is SEPARATE from the top Hero "Get Started"** button (`page.tsx` Hero, register modal:
  `page.tsx:142` area — `setLoginMode('register'); setShowLogin(true)`). Two distinct CTAs: top Hero Get
  Started vs the in-calendar "Make my free account" nudge.

→ Removing the redundant banner = delete the `{isDemo && (…)}` block at `HubCalendar.tsx:258-270` (UI-only,
self-contained). *(A second "Make my free account" CTA also exists in the projects showroom narrative copy,
`projects/showroom/narrativeCopy.ts:83-85` — out of scope, flag only.)*

## Q7 — EMPTY-STATE READINESS (if demo is removed)

- **Runway/calendar — empty-state must be BUILT (careful).** The demo seed is what makes the guest path
  **fetch-free**: `HubCalendar.tsx:173` `if (demoEvents) return;` (fetch effect early-returns) and `:180`
  returns the seed. **If you simply stop passing `demoCalendar`, `isDemo` becomes false → the fetch effect
  RUNS → a guest hits personal routes (401s) and the grid renders empty/with failed fetches** — a
  regression (and a re-introduction of the calendar-leak the demo path was built to prevent). Safe removal
  must pass an **explicit empty signal** (e.g. `demoEvents={[]}` keeps `isDemo` true but empty) **or** add a
  dedicated guest-empty mode + a "set up your runway" empty-state. → **BUILD an empty-state; do not just
  delete the seed.**
- **Routines — empty-state largely EXISTS.** The guest already gets `HomeRoutineCreateForm` (a fetch-free
  create teaser, `renderBody:345-346`), not demo data — that *is* a usable empty state. Minimal/no new
  empty-state needed.

---

## PER-TAB: CURRENT → TARGET → GAP → MECHANISM

| Tab | Current guest | Target guest | Gap | Mechanism to change |
|---|---|---|---|---|
| **Runway** | Demo calendar (`demoCalendar`) | Free, guest-usable **EMPTY** | Remove demo; add empty-state without breaking the fetch guard | `ModuleLauncher:460` (stop passing seed → pass `[]` / guest-empty mode) + new empty-state |
| **Routines** | Create teaser (`HomeRoutineCreateForm`) | Free, guest-usable **EMPTY** | Mostly there (teaser exists); confirm it reads as "empty usable" | `renderBody:345-346` (likely keep) |
| **Travel** | Public search + guest booking; save gated | Free, **FULLY usable incl. booking** | **Already met** (search + book are guest-open) | none (confirm) |
| **Projects** | Rich showroom (populated demo) | Paid/locked → **empty teaser** | Replace rich showroom with empty teaser | `renderBody:307-308` |
| **Content** | Rich showroom (populated demo) | Paid/locked → **empty teaser** | Replace rich showroom with empty teaser | `renderBody:326-327` |
| **Trade** | Paid stub | Paid/locked → **empty teaser** | Near-met (stub ≈ teaser); restyle | `renderBody:379-392` |
| **Books** | Paid stub | Paid/locked → **empty teaser** | Near-met | `renderBody:379-392` |
| **Compliance** | Paid stub | Paid/locked → **empty teaser** | Near-met | `renderBody:379-392` |
| **Tax** | Paid stub | **UNDECIDED** | — | report only; do not assume |

---

## DEMO DATA SOURCE — single verdict

**The guest Runway calendar is fed by ONE static file — `src/components/hub/showroom/demoCalendar.ts`
(hardcoded `CalendarEvent[]` literals)** — passed in via `ModuleLauncher.tsx:460`
`<HubCalendar demoEvents={demoCalendar} …>` on the `authed === false` branch. It is **not** a seeded demo
account, **not** a guest-mode injection of real data, **not** a default entity. Remove/empty it at the
*render call*, not the DB.

---

## RECOMMENDED PR SEQUENCE (atomic, safe order)

1. **PR1 — Remove the redundant in-calendar banner.** Delete `HubCalendar.tsx:258-270` (`{isDemo && …}`).
   Pure UI, self-contained, zero data/logic risk. *(Lowest risk; do first.)*
2. **PR2 — Runway guest EMPTY-state (replaces demo).** Stop passing `demoCalendar` and pass an explicit
   empty signal (`demoEvents={[]}` to preserve the fetch-free guard, `HubCalendar.tsx:173`) **plus** a
   "set up your runway" empty-state. **Must keep `isDemo` true (or an equivalent guest guard)** so a guest
   never fetches personal routes — verify no 401/leak. *(Couple this removal with the empty-state in ONE
   PR so guests are never left with a broken/fetching calendar.)*
3. **PR3 — Confirm Travel guest-booking (likely no-op or tiny).** Travel already meets target (Q5); this PR
   just *verifies* search+book are guest-open and the save-gate is the only signup wall. Document; change
   only if a gap is found.
4. **PR4 — Projects + Content: rich showroom → empty teaser.** Swap `OperationsPipelineShowroom`
   (`renderBody:307-308, 326-327`) for an empty paid-teaser (mirror the Trade/Books stub at `:379-392`).
   One concept ("paid tabs show an empty teaser, not a populated demo").
5. **PR5 — (optional) Normalize Trade/Books/Compliance teaser styling** to match PR4's empty teaser, so all
   paid tabs are visually consistent. Tax: **hold for Alex's decision** (undecided).

**Why this order:** banner removal is risk-free (PR1); the demo→empty change is the riskiest (fetch-guard
regression) so it gets its own focused PR with the empty-state bundled (PR2); Travel is verify-only (PR3);
the paid-teaser swap is independent and batchable (PR4/PR5). Each PR is one concept and independently
revertible.

---

## SECURITY CALLOUT (guest-reachable paid APIs)

- **Booking (`liteapi/book`, `flights/book`) — guest-funded, SAFE-PUBLIC by design.** Auth is optional
  (`liteapi/book:91-101`, `flights/book:47-48`); the spend is the **guest's** (a `paymentTransactionId` is
  required first, `liteapi/book:66`) and it's rate-limited (3/300s per IP, `:49-50`). **Not a cost leak to
  Alex.**
- **⚠ Search + prebook are Alex's API cost (guest-triggered).** `flights/search`, `travel/hotels/search`,
  `travel/activities/search`, `liteapi/prebook` are **public** (`middleware.ts:70-79`) and call **paid
  external APIs** (Duffel/LiteAPI/Viator) **before** any guest payment — so **each guest search/prebook is
  an API call Alex pays for.** Mitigation present: these are rate-limited cheap reads (the PUBLIC_PATHS
  comment, `middleware.ts:67-70`). **Decision flag for Alex:** confirm the per-IP rate limits + provider
  pricing make public guest search/prebook acceptable (it's the intended funnel, but it IS a guest-driven
  cost — verify the limits, esp. before promoting the guest experience). **NOT a leak, but a guest-cost
  surface to confirm.**

**DB checks for Alex (psql — code can't reach):** none required for this audit — the demo data is static
(no DB rows); the gating is code-only. (If the guest-cost question matters, Alex can review provider
dashboards/rate-limit logs, not the app DB.)

---

*Read-only audit. No code changed; this `.md` is the only file created. Core verdicts: guest demo =
static `demoCalendar.ts` injected at `ModuleLauncher:460`; gating = `MODULES[].live` + `renderBody`
branch; Travel guest-booking is intended-public + guest-funded (search/prebook are Alex's guest-cost
surface); removing demo requires a built empty-state to avoid a fetch-guard regression. Every claim cites
`file:line`.*
