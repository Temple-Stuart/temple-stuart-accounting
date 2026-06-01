# HOME — PR-1 Audit: home-page module launcher (mimic /budgets/trips create-trip card + module pills)

**Branch:** `claude/home-pr-1-audit`
**Date:** 2026-05-31
**Mode:** READ-ONLY.
**Goal:** Add a module launcher to the home page (`/`) mimicking the
`/budgets/trips` "Plan a new trip" card pattern — the same create-trip card +
module toggle pills: **Travel** (live, free, guest-usable) and
**Bookkeeping/Tax/Trading/Operations/Compliance** (paid, account-gated form stubs).
**Additive** on top of the current home page (keep what's there; delete old content
later).

---

## 1. The home `/` route + current content

`src/app/page.tsx` — **`LandingPage`** (client component, `'use client'` `:1`,
565 lines). A **marketing landing page**, not an app surface. Sections top-to-bottom:
- **Header** (`:43-70`, brand-purple, TS logo + Pricing/contact links).
- **Hero** (`:72-95`, "Track your money. Trade smarter. Plan your life." +
  **"Get Started"** → opens the register modal `setShowLogin(true)`).
- **Stats Bar** (`:97-119`), **Modules Grid** (`:121-145`, the `MODULES` array
  `:8-21` — 12 cards; **every card `onClick` opens the register modal**, `:135`,
  it does NOT route into the module), **Three Pillars** (`:147`), **Features Grid**
  (`:267`), **AI Trading Pipeline** (`:287`), **Pricing** (`:315`, Free/Pro/Pro+/
  Trader Pro), **CPA Disclaimer** (`:470`), **Press** (`:482`), footer.
- **Auth UI:** a `LoginBox` modal toggled by `showLogin`/`loginMode`
  (`:6,:37-39`). The page renders the **same for guest and logged-in** — it's a
  static marketing page; there is **no server-side auth branch** on `/`
  (the client never calls `/api/auth/me` here). Logged-in users still see the
  landing page unless they navigate to `/hub` etc.

**Additive placement (per Alex):** the launcher goes **at the top of the existing
stack** (e.g. directly under the Hero, before/above the Modules Grid) — nothing in
§1 is removed in this PR.

## 2. The create-trip card pattern to reuse — INLINE, needs extracting

The "Plan a new trip" card is **inline in `src/app/budgets/trips/page.tsx`**
(PR-37a/37b), **not a standalone component** (`grep "Plan a new trip"` → only that
file). Its pieces:
- **SectionCard chrome** (PR-37b): `rounded-lg overflow-hidden border
  border-gray-200/50 shadow-sm` + `bg-brand-purple/80 … px-4 py-2.5 … font-semibold`
  band "Plan a new trip" + `bg-white p-4` body (`page.tsx:209-213`).
- **Inputs:** name (`:215-…`), destination(s) autocomplete via
  `searchDestinations` (`:6,:112`), start/end dates, travelers select, trip-type
  pills.
- **POST wiring:** `handleCreate` (`page.tsx:151`) POSTs `/api/trips`
  `{ name, destination, startDate, endDate, tripType }` → `router.push(
  '/budgets/trips/{id}')` (the new trip's detail). Validation: `canCreate = name
  && startDate && endDate && endDate>=startDate` (no fallback, PR-33 discipline).
- All of it lives in `TripsPage` state (useState hooks `:67-95`).

**To reuse on the home page it must be EXTRACTED** into a standalone
`<CreateTripForm onCreated?>` component (the form markup + its state + handlers +
the destination autocomplete), then mounted in **both** the trips index and the
home launcher. This is the bulk of the implementation work (a clean lift, like the
PR-28e1a hook lift) — **0 logic change**, just relocation behind a component
boundary. (Alternatively duplicate the markup, but extraction is the DRY path and
keeps the trips index + home in lock-step.)

## 3. Auth model — logged-in vs guest

- **Server-side:** `getVerifiedEmail()` (`src/lib/cookie-auth.ts:54-62`) reads the
  HMAC-signed `userEmail` cookie (`verifyCookie`, `:30`) → returns the email or
  **`null` for guests**. `getCurrentUser()` (`src/lib/auth-helpers.ts:10`) wraps it
  with a DB lookup. Every protected API gate is `getVerifiedEmail()` → 401 if null.
- **Client-side:** `GET /api/auth/me` (`src/app/api/auth/me/route.ts`) returns
  `{ user: { id, email, name, tier } }` when signed in, **401 when guest**. So the
  launcher can detect guest-vs-account by fetching `/api/auth/me` (200 → account,
  401 → guest) and read **`user.tier`** for paid gating (Free/Pro/Pro+/Trader Pro).
- **The gate for the 5 paid modules:** on the home launcher, selecting
  Bookkeeping/Tax/Trading/Operations/Compliance must require an account → if
  `/api/auth/me` is 401 (guest), the pill's CTA opens the **register modal**
  (`setShowLogin(true)` — already on the page); if signed-in, it's a **stub**
  ("coming soon") for now. Travel needs **no** gate to *use the form* (§4).

## 4. Guest Travel flow — POST /api/trips IS auth-gated (the real decision)

**`POST /api/trips` is auth-gated** (`src/app/api/trips/route.ts` POST): it calls
`getVerifiedEmail()` → **401 "Not authenticated"** for guests, then `users.findUnique`
→ 404, then creates the trip with **`userId: user.id`** and seeds the owner
participant. So **a guest CANNOT persist a trip today** — the trip row requires a
real user (FK `userId`).

This collides with the spec ("guests CAN use Travel but can't SAVE on close").
**The form's create action (POST → redirect to a saved detail page) does not work
for a guest.** Options (the one architecture decision — **FLAG for Alex**):
- **(A) Prompt-to-save / register-gated create (recommended, smallest):** guests
  can **fill** the Travel form freely, but pressing "Create trip" when
  unauthenticated opens the **register modal** (the page already has it); after
  sign-up, the collected inputs POST and redirect. "Use it, but sign in to save" —
  matches the spec without backend change. (Pass the form state through the
  register flow, or re-submit after auth.)
- **(B) Scratch / ephemeral guest trip:** let guests plan in a **client-only
  scratch state** (no POST) — search hotels/activities, see a budget — with a
  persistent "Sign in to save" banner; nothing persists until they register. Bigger
  (the planner reads a real `tripId` for scans/commits, so a scratch trip needs a
  guest-safe planner path — large).
- **(C) Anonymous trip rows:** relax the FK / allow `userId: null` trips claimed on
  signup — **schema + security change**, not recommended.

**Recommend (A)** — zero schema/endpoint change, honors "guests can use it, must
sign in to save," reuses the existing register modal. Confirm with Alex.

## 5. Module pill row — proposal + style to match

A toggle-pill row **under the card** selecting the active module. **Match the
existing trip-type pill style** (`budgets/trips/page.tsx:313-326`):
```
active: bg-brand-purple text-white border-brand-purple
idle:   bg-white text-text-secondary border-border hover:bg-bg-row
        (text-xs px-3 py-1 rounded-full border transition-colors)
```
(This is the same chip vocabulary as the destination "Scan:" chips and the
Committed-Budget filter pills.)

- **Pills:** **Travel** (live), Bookkeeping, Tax, Trading, Operations, Compliance.
- **Behavior:** selecting a pill **swaps the card's header band + CTA**. Travel →
  the real create-trip card (§2). The 5 paid → a **stub card** (same SectionCard
  chrome, brand band titled e.g. "Bookkeeping", body: a short "Paid module —
  coming soon" + a **"Sign in / Get started"** CTA that opens the register modal
  for guests, or a "coming soon" note for signed-in users). The pills can carry a
  small **"Paid"** badge (mirroring the modules-grid `featured` "New" badge style,
  `page.tsx:136-137`) to set expectation.
- **Default:** Travel selected (the live, free, guest-usable module leads).

## 6. Additive placement (nothing removed)

Mount the launcher **once, near the top** of `LandingPage` — recommended **directly
after the Hero** (`page.tsx:95`), before the Stats Bar / Modules Grid, in a
`max-w-7xl mx-auto px-4 lg:px-8` container so it aligns with the page grid. **No
existing section is deleted** this PR (Hero, Modules Grid, Pillars, Features,
Pricing, etc. all stay). A later PR removes the now-redundant old content once the
launcher is validated.

## 7. Scope + PR sequence

- **HOME-PR-1 (this — additive launcher + live Travel):**
  - **Extract** `<CreateTripForm>` from `budgets/trips/page.tsx` into a shared
    component (`src/components/trips/CreateTripForm.tsx`); re-mount it in the trips
    index (parity) — a clean lift, 0 logic change.
  - **New** `<ModuleLauncher>` (pill row + card swap) wrapping `CreateTripForm`
    (Travel) + the 5 stub cards; reads `/api/auth/me` for the guest/account gate;
    opens the existing register modal for paid pills / guest-save.
  - **Mount** `<ModuleLauncher>` near the top of `LandingPage`.
  - **Files:** `src/app/page.tsx`, new `CreateTripForm.tsx`, new
    `ModuleLauncher.tsx`, `budgets/trips/page.tsx` (swap inline form → component).
    **POST /api/trips unchanged. 0 schema, 0 deps.**
- **HOME-PR-2:** remove the redundant old home content (Modules Grid / Pillars /
  etc.) once the launcher is the front door.
- **HOME-PR-3+:** wire each paid module's real create form (replace the stubs) as
  those modules ship.

**Guest-save (§4) is the gating decision for PR-1's Travel** — recommend option A
(register-gated create), which keeps PR-1 to **0 backend change**.

## Sign-off items
1. **Guest Travel save (§4):** option A (register-gated create, recommended) vs B
   (ephemeral scratch planner) vs C (anonymous rows). **The one real decision.**
2. **Extract `CreateTripForm` shared** (recommended) vs duplicate the markup on
   home.
3. **Launcher placement** — directly under the Hero (recommended) vs replacing the
   Modules Grid now vs another spot.
4. **Paid-pill behavior** for signed-in users — "coming soon" stub vs route to the
   module's real (future) form. For guests, both open the register modal — confirm.
5. **Which 5 paid modules + labels** — Bookkeeping/Tax/Trading/Operations/Compliance
   (per spec) vs the existing `MODULES` taxonomy (Books/Trading/Business/… — note
   "Operations"/"Compliance" aren't current top-level modules; confirm the launcher
   taxonomy).
6. **PR sequence** — additive PR-1 then removal PR-2 (recommended).

---

**READ-ONLY audit. No implementation performed.**
