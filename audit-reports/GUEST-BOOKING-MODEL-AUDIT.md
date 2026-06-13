# GUEST BOOKING MODEL AUDIT (free hotel booking, no account)

**Scope:** a MODEL CHANGE — hotel booking becomes **guest-friendly** (free, no
account) on the public home page, while **account** booking is still supported +
**tagged**, **save-to-bookkeeping/trip/budget stays account-only** (the sign-up
value-add), and **other modules stay account-gated**. Map what must change.
**Read-only. No source modified.** `Missing = MISSING`.

Branch: `claude/audit-guest-booking-model` · main @ `9294e78d`.

---

## TL;DR — this is an auth-model + SCHEMA change, not a UI tweak

A guest has **no `userId` and no `tripId`**, but `reservations` and
`commission_ledger` **hard-require both** as NOT-NULL foreign keys
(`schema.prisma:1155-1156,1171-1172,1187,1198`). **That is the crux:** guest
booking is impossible to persist until those columns are made **nullable** (a
Prisma **migration**, psql-before-merge per Alex's rule). On top of that: the
prebook/book routes must gain a **guest mode** (no auth, no tripId) — which strips
away their *only* current protection (auth), so they need **strong public-paid
guards** (rate-limit + a booking cap), and the **CheckoutPanel** must be mountable
on the public surface without a `tripId`.

---

## 1. CURRENT AUTH/TRIP GATING — what blocks guest booking

### prebook route — `api/travel/liteapi/prebook/route.ts`
- `getVerifiedEmail()` → 401 (`:15-18`) → `users.findFirst` → 404 (`:19-25`).
- Requires `{ tripId, offerId }` (`:34-40`) → **trip-ownership** query
  `trips.findFirst({ id: tripId, userId: user.id })` → 404 (`:43-49`).
- **No `rateLimit`, no `reserveTravelSearch`** — auth + ownership is the ONLY guard.
- **To allow a guest:** skip the 401 when no email, and skip the `tripId` +
  ownership requirement; prebook only truly needs `offerId`.

### book route — `api/travel/liteapi/book/route.ts`
- Same auth (`:39-49`) + requires `tripId` (`:64-69`) + **trip-ownership**
  (`:90-96`).
- **Persistence** (`prisma.$transaction`, `:140-174`):
  - `reservations.create({ userId: user.id, tripId, provider, providerBookingId,
    …, finalPriceCents, … })` (`:141-157`) — writes **both `userId` and `tripId`**.
  - `commission_ledger.create({ userId: user.id, reservationId, …,
    commissionAmountCents, status:'estimated' })` (`:161-171`) — writes **`userId`**.
- **The crux is here:** a guest booking has no `user.id` / `tripId` to write.

### schema — `reservations` (`:1153`) + `commission_ledger` (`:1185`)
- `reservations.userId String` **(NOT-NULL)** (`:1155`) + `user users @relation(…,
  onDelete: Cascade)` (`:1171`) — a **required FK** to `users`.
- `reservations.tripId String` **(NOT-NULL)** (`:1156`) + `trip trips @relation(…)`
  (`:1172`) — a **required FK** to `trips`.
- `commission_ledger.userId String` **(NOT-NULL)** (`:1187`) + `user users
  @relation(…)` (`:1198`) — a **required FK** to `users`.
- **Verdict:** all three are required FKs → a guest row violates them at insert.
  **Guest booking REQUIRES a migration** making `userId` + `tripId` (reservations)
  and `userId` (commission_ledger) **nullable**, with the relations made optional.

---

## 2. WHAT A GUEST BOOKING NEEDS

- **Holder + guest contact already collected.** PR-B1's CheckoutPanel collects a
  real `holder { firstName, lastName, email }` + `guests[]`
  (`CheckoutPanel.tsx:66-71`,`:120-127`); the book route validates them
  (`book/route.ts:70-81`) and passes them to LiteAPI. So a guest booking = book
  **without `userId`/`tripId`, with the holder email as the contact.** ✅ the data
  exists — but the reservation row currently has **no column to store the guest's
  contact email** (it relies on the `userId` join for "who booked"). → **add a
  `guestEmail`/`contactEmail` column** (nullable) so a guest is reachable.
- **Commission without a userId.** `commission_ledger.userId` is required (`:1187`).
  The margin is earned **regardless of account** (LiteAPI pays on the booking, not
  the user). → make `commission_ledger.userId` **nullable**; a guest commission row
  is keyed to `reservationId` (already a required FK, fine) with `userId = null`.
  The 6% is recorded against the booking either way.
- **Guest-vs-account tracking — smallest distinguisher.** `userId IS NULL` already
  means "guest" once nullable. For explicit reporting, the smallest addition is a
  single column on `reservations`: **`bookingType String @default('account')`**
  (`'guest' | 'account'`) — cheap to query/aggregate. (Alternative: derive from
  `userId IS NULL` with no new column. Recommend the explicit `bookingType` for
  clean analytics + because `userId` may later be backfilled if a guest signs up.)

---

## 3. THE PUBLIC FLOW (no trip)

- **Today:** public `Book` → `onRequireAuth()` (`PublicHotelSearch.tsx:90`, wired to
  the view's `onBook` `:147`) — it opens the register modal and fires **no** booking
  fetch. The CheckoutPanel is **only** reachable from the **authed** TripPlannerAI
  (Reserve button → `handleLiteApiReserve` → panel, PR-B1/B1.5).
- **CheckoutPanel needs a tripId today.** Its props are
  `{ tripId, offerId, hotelName, checkin, checkout, onClose, onBooked }`
  (`CheckoutPanel.tsx:35-43`), and it sends `tripId` to both prebook (`:80-84`) and
  book (`:115-128`). For the public surface it must accept **`tripId?` optional**
  (omit it for guests) — a small prop change, but a real one.
- **Mounting on the public surface:** `PublicHotelSearch` would open
  `<CheckoutPanel>` **directly** (replacing the `onRequireAuth` gate on `onBook`) —
  passing the card's `liteapiOfferId` + dates, no tripId. The panel already manages
  its own prebook/book/confirmation flow, so it drops in; it just needs the
  optional-tripId prop + a guest-aware mount (no authed context required — it only
  uses `fetch`, no ctx).
- **The routes need a guest mode + guards.** Today prebook/book have **no
  `rateLimit`/`reserveTravelSearch`** — auth was the guard. Going public removes
  that, so guest-mode prebook/book MUST add the **public-paid guard pattern** used
  by the search routes: `rateLimit('hotel-prebook:'+ip)` / `rateLimit('hotel-book:'+
  ip)` (+ a daily booking cap), mirroring `hotels/search/route.ts:33` (`rateLimit`)
  + `:66` (`reserveTravelSearch('liteapi')`). See §Security.

---

## 4. ACCOUNT = SAVE (the value-add)

- **The "save" IS the `tripId` linkage.** An account booking writes
  `reservations.tripId` (`book/route.ts:146`), and `trips` / `users` carry
  `reservations reservations[]` back-relations (`schema.prisma:558`,`:481`) +
  `commission_ledger[]` (`:482`,`:1173`). So an account reservation **belongs to a
  trip**, which is what surfaces it in the trip/budget/bookkeeping views. (The
  discover page already references reservations,
  `budgets/trips/[id]/discover/.../page.tsx`.)
- **Difference to preserve:**
  - **Guest book** → reservation with `userId = null`, `tripId = null`,
    `bookingType = 'guest'`, `guestEmail` set → a **standalone** booking
    (confirmation only; no trip/budget linkage). Still persisted, still
    commission-ledgered.
  - **Account book** → reservation with `userId`, `tripId`, `bookingType =
    'account'` → linked into the trip → appears in budgets/bookkeeping. **This trip
    linkage is the value-add that motivates sign-up.**
- **Other modules unchanged:** only the travel prebook/book routes relax auth; every
  other account-gated path (bookkeeping, trading, ops, etc.) keeps `getVerifiedEmail`
  as-is.

---

## REPORT — EXISTS | MUST-CHANGE | THE PLAN

### EXISTS (reuse)
- The full server booking spine (prebookRate/bookRate clients; prebook/book routes;
  reservation + commission persistence) — `liteapiClient.ts` + the two routes.
- The CheckoutPanel (prebook → guest form → book → confirmation) collecting real
  holder/guest contact — `CheckoutPanel.tsx`.
- The public-paid guard pattern (`rateLimit` + `reserveTravelSearch`) on the search
  routes — `hotels/search/route.ts:33,66`.

### MUST-CHANGE
1. **Schema migration (psql-before-merge, Alex's rule) — the crux:**
   - `reservations.userId` → **nullable** (`String?`) + relation optional.
   - `reservations.tripId` → **nullable** (`String?`) + relation optional.
   - `commission_ledger.userId` → **nullable** (`String?`) + relation optional.
   - **ADD** `reservations.bookingType String @default('account')` (`'guest'|
     'account'`) + `reservations.guestEmail String?` (contact for guest bookings).
   - These are real ALTER TABLEs (drop NOT-NULL, drop/relax FK, add 2 columns) —
     **migrations Alex runs via psql before merge.**
2. **prebook route — guest mode:** allow no-auth; require only `offerId` (drop the
   `tripId`+ownership requirement); when authed, keep the user for tagging.
3. **book route — guest mode + tagging:** allow no-auth; persist `userId` =
   user?.id ?? null, `tripId` = (authed) tripId ?? null, `bookingType` =
   authed?'account':'guest', `guestEmail` = holder.email when guest;
   `commission_ledger.userId` = user?.id ?? null. Keep the authed account path
   (tripId + ownership) intact when a user IS present.
4. **CheckoutPanel — `tripId?` optional** + a guest mount in `PublicHotelSearch`
   (open the panel directly instead of `onRequireAuth`).
5. **Public guards on prebook/book** (see Security) — non-optional.

### CRITICAL — security re-think (auth no longer protects these)
- **Today the ONLY guard on prebook/book is `getVerifiedEmail` + trip-ownership.**
  Going public makes them **unauthenticated, money-spending** endpoints (book calls
  LiteAPI and, in production, **charges a real card** + earns commission). Removing
  auth removes the sole abuse barrier.
- **They MUST adopt the public-paid guard pattern** the search routes use —
  per-IP `rateLimit` (`hotels/search/route.ts:33`) + a durable **daily booking cap**
  (`reserveTravelSearch`-style, `:66`) — and likely **tighter** limits than search
  (a booking is far more costly than a quote). Consider: a low per-IP book rate, a
  global daily book cap, and bot/abuse defenses (the search routes' `rateLimit` is
  the template). **prebook** is a quote (cheap, but still rate-limit); **book** is
  the real spend (hard cap + low per-IP limit).
- Sandbox is harmless (no real charge); **production guest booking spends real
  money with no login** — treat the guards as the primary control. Flag a
  dashboard/pricing + fraud review before enabling production guest book.

### Honest size
**This is an auth-model + schema change, not a UI tweak.** It touches: a **Prisma
migration** (3 columns nullable + 2 new columns), **both booking routes**
(guest-mode branching + new public guards), the **CheckoutPanel** prop + a **public
mount**, and a **security hardening** pass. Realistic chain:
- **PR-G1** — migration (nullable `userId`/`tripId`/commission `userId` + add
  `bookingType` + `guestEmail`); schema + raw SQL for Alex to run.
- **PR-G2** — prebook/book routes: guest mode (no-auth, no-trip) + account tagging +
  **public-paid guards** (rateLimit + booking cap).
- **PR-G3** — CheckoutPanel `tripId?` optional + open it directly from
  `PublicHotelSearch` (guest book on the public card).
- **PR-G4** — account "save" parity check (authed book still links the trip/budget)
  + a guest-vs-account reporting view.

**Flags:** every schema change above is a **migration** (psql before merge). The
**public money-spending guard** is mandatory, not optional. No code modified in
this audit.
