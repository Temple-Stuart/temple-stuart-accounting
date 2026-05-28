# Travel-LiteAPI-PR-3b — Booking flow (prebook → book → reservation → commission)

Builds on PR-3 (search shipped) and PR-1's fail-loud typed errors. After this
PR, the Accommodation cards on the existing UI have a working Reserve button:
click it and a real LiteAPI booking is created against the sandbox + a row
lands in `reservations` + a row in `commission_ledger`. Branch:
`claude/travel-liteapi-pr-3b`.

> **Sandbox-only this PR.** `LITEAPI_MODE=sandbox` (the default). Production
> bookings happen once `LITEAPI_MODE=production` is flipped + the prod key is
> set — a follow-up env change after sandbox is verified end-to-end.

---

## 1. Client extensions — `src/lib/liteapiClient.ts`

Two new methods, both fail-loud per PR-1's pattern. Two new constants:
`LITEAPI_BASE` (search + prebook host) and `LITEAPI_BOOK_BASE`
(`https://book.liteapi.travel/v3.0` — per LiteAPI's docs the book call lives
on a separate host with a 5-10s response window).

### `prebookRate({ offerId, usePaymentSdk? })` (`liteapiClient.ts:344-376`)
- **Endpoint:** `POST https://api.liteapi.travel/v3.0/rates/prebook`
  ([docs](https://docs.liteapi.travel/reference/post_rates-prebook)).
- **Request body:** `{ offerId, usePaymentSdk: true }`. `usePaymentSdk: true`
  is the default — keeps card data off our servers (LiteAPI's hosted SDK
  tokenises in the browser; we only ever see a `transactionId`).
- **Response → `PrebookResult`:** `{ prebookId, hotelId, offerId, price,
  currency, commission, transactionId, secretKey, paymentTypes?,
  cancellationPolicies? }`. **`commission`** is LiteAPI's quote of our
  margin on this specific rate — that's the number we ledger.
- **Errors:** throws `LiteApiError('/v3.0/rates/prebook', status, body)` on
  any non-2xx; `MissingLiteApiKeyError` if the mode's key isn't set.

### `bookRate({ prebookId, holder, guests, paymentTransactionId })` (`liteapiClient.ts:415-451`)
- **Endpoint:** `POST https://book.liteapi.travel/v3.0/rates/book`
  ([docs](https://docs.liteapi.travel/reference/post_rates-book)).
- **Request body:**
  ```json
  {
    "prebookId":  "<from prebook>",
    "holder":     { "firstName", "lastName", "email" },
    "payment":    { "method": "TRANSACTION_ID", "transactionId": "<from prebook>" },
    "guests":     [{ "occupancyNumber", "firstName", "lastName", "email" }]
  }
  ```
- **Response → `BookResult`:** `{ bookingId, status,
  hotelConfirmationCode?, supplierConfirmationNum?, checkin?, checkout?,
  hotelName?, price?, commission?, currency?, cancellationPolicies? }`.
- **Errors:** same typed-error pattern as prebook.

### Mapper extended — `extractOfferId` + `liteapiOfferId` on the recommendation
The PR-3 search mapper now also surfaces the rate-level `offerId`
(`liteapiClient.ts:227-240` + recommendation field at `:212` + mapper line
at `:310`). Without `offerId` we can't prebook — the UI hides the Reserve
button on hotels that didn't quote a bookable rate (sandbox metadata-only
properties).

---

## 2. Schema — `prisma/schema.prisma` + migration

Migration: `prisma/migrations/20260528000000_travel_reservations_commission_ledger/migration.sql`
(additive only; no backfill; safe on `prisma migrate deploy`). `prisma
generate` ran successfully; `prisma validate` passes.

### `reservations` (lines 1094-1124 of schema.prisma)
One row per confirmed booking through any bookable provider (`provider` is
a string so Viator/Duffel/Mozio plug in without further schema change).
**User-scoped (`userId` FK)** so every read/write through the routes filters
by the verified user.

```prisma
model reservations {
  id                       String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId                   String
  tripId                   String
  provider                 String   @db.VarChar(20)
  providerBookingId        String   @db.VarChar(120)
  providerConfirmationCode String?  @db.VarChar(120)
  status                   String   @db.VarChar(20)
  hotelName                String?  @db.VarChar(255)
  checkinDate              DateTime @db.Date
  checkoutDate             DateTime @db.Date
  guestCount               Int      @default(1)
  finalPriceCents          Int                       // integer cents
  currency                 String   @default("USD") @db.VarChar(3)
  cancellationPolicyJson   Json?
  createdAt                DateTime @default(now())
  updatedAt                DateTime @updatedAt
  user              users               @relation(fields: [userId], references: [id], onDelete: Cascade)
  trip              trips               @relation(fields: [tripId], references: [id], onDelete: Cascade)
  commission_ledger commission_ledger[]
  @@index([userId])
  @@index([tripId])
  @@index([provider, providerBookingId])
}
```

### `commission_ledger` (lines 1132-1153 of schema.prisma)
One row per bookable reservation tracking our earned margin. Status walks
`estimated` → `confirmed` → `paid` as LiteAPI confirms the booking + remits
weekly payout (the confirm/paid transitions are a later PR's webhook /
reconciliation work).

```prisma
model commission_ledger {
  id                    String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId                String
  reservationId         String    @db.Uuid
  provider              String    @db.VarChar(20)
  grossAmountCents      Int
  commissionAmountCents Int
  currency              String    @default("USD") @db.VarChar(3)
  status                String    @db.VarChar(20)
  payoutDate            DateTime?
  providerInvoiceRef    String?   @db.VarChar(120)
  createdAt             DateTime  @default(now())
  user        users        @relation(fields: [userId], references: [id], onDelete: Cascade)
  reservation reservations @relation(fields: [reservationId], references: [id], onDelete: Cascade)
  @@index([userId])
  @@index([reservationId])
  @@index([status])
}
```

Back-references added to `users` (`schema.prisma:480-481`) and `trips`
(`schema.prisma:517`).

---

## 3. Two new auth'd routes

Both follow the existing auth pattern from `src/app/api/ai/cart-plan/route.ts`:
`getVerifiedEmail()` → `prisma.users.findFirst({email})` → ownership check
on the trip → call the provider client. All Prisma writes are user-scoped
(`userId: user.id` in every `data`/`where`).

### `POST /api/travel/liteapi/prebook` — `src/app/api/travel/liteapi/prebook/route.ts`
- **Auth checks:** cookie verify at `route.ts:17-19`, user lookup at `:20-26`.
- **Body:** `{ tripId, offerId, usePaymentSdk? }`.
- **Ownership check:** `prisma.trips.findFirst({ where: { id: tripId,
  userId: user.id } })` at `:42-47`. Cross-user trip access returns 404.
- **Calls `prebookRate(...)` and returns the prebook payload** including the
  `transactionId` + `secretKey` the browser uses to drive LiteAPI's hosted
  payment SDK. **Persists nothing** — prebook is a quote, not a booking.
- **Typed-error mapping:** `MissingLiteApiKeyError → 500`,
  `LiteApiError → 502` (with the upstream HTTP status in the body), all
  else → 500 with the raw message.

### `POST /api/travel/liteapi/book` — `src/app/api/travel/liteapi/book/route.ts`
- **Auth checks:** cookie verify at `route.ts:39-41`, user lookup at
  `:42-48`.
- **Body:** `{ tripId, prebookId, paymentTransactionId, holder, guests,
  checkinDate, checkoutDate, hotelName?, guestCount?, finalPriceCents?,
  currency?, commissionAmountCents? }`.
- **Ownership check:** same user-scoped `trips.findFirst` at `:86-91`.
- **Calls `bookRate(...)` at LiteAPI** (still a real network call, even in
  sandbox — typed-error mapping is the same as prebook).
- **Prisma transaction** (`route.ts:138-167`) wraps:
  1. `reservations.create({ userId, tripId, provider: 'liteapi',
     providerBookingId: booked.bookingId, providerConfirmationCode, status,
     hotelName, checkinDate, checkoutDate, guestCount, finalPriceCents,
     currency, cancellationPolicyJson })`.
  2. `commission_ledger.create({ userId, reservationId,
     provider: 'liteapi', grossAmountCents, commissionAmountCents,
     currency, status: 'estimated' })`.
- **Booked-but-failed-to-persist** path at `:178-192`: if LiteAPI succeeded
  (real booking is chargeable!) but our DB write failed, returns a 500
  with the `bookingId` + `confirmationCode` so ops can manually reconcile.
  Loud, not silent.

---

## 4. Payment model decision

**Chosen: hosted-checkout via LiteAPI's Payment SDK (`usePaymentSdk: true`).**

- Card data never touches our servers. LiteAPI's SDK is loaded in the
  browser with the `secretKey` returned by prebook; the user enters card
  details; the SDK tokenises and returns a `transactionId`; we send only
  that opaque token to `/rates/book`. **PCI scope is effectively zero**
  (we never see PAN/CVV).
- The alternative (raw card capture on our pages) would put us in PCI-DSS
  Self-Assessment Questionnaire D scope — much heavier. No good reason
  to take it on for a thin-margin reseller integration.
- LiteAPI's docs explicitly recommend the SDK path for production
  ([User Payment](https://docs.liteapi.travel/docs/user-payment)).

**Sandbox in this PR:** the Reserve button calls prebook → immediately
calls book with the prebook's `transactionId` as the paymentTransactionId.
LiteAPI sandbox accepts this without a real charge — proves the end-to-end
pipe works without integrating the SDK in the browser. **Production cannot
use this shortcut** — PR-4 (UX rebuild) is where the SDK actually renders
in the browser to capture payment before book.

---

## 5. Minimal UI wiring — `src/components/trips/TripPlannerAI.tsx`

Per scope: just enough to verify end-to-end on the existing card UI. No
modals, no carousels — that's PR-4.

- **Recommendation interface** (`TripPlannerAI.tsx:27-34`) — added
  `liteapiHotelId?` + `liteapiOfferId?` fields.
- **State** (`:198-199`) — `reservingKey` (the cardKey of the in-flight
  reserve), `reservedKeys` (map of cardKey → `{ confirmationCode, bookingId }`
  for successful reserves).
- **Handler `handleLiteApiReserve(rec, cardKey)`** (`:565-628`):
  - Calls `/api/travel/liteapi/prebook` with `{ tripId, offerId }`.
  - On success, calls `/api/travel/liteapi/book` with the prebook's
    `prebookId` + `transactionId` + a sandbox-stub `holder`/`guests`
    derived from the trip (real holder data plumbed in PR-4 once the
    checkout UI exists).
  - Sets `reservedKeys[cardKey]` on success; sets the existing `error`
    banner on failure with the upstream message — per PR-1 fail-loud,
    LiteApiError text reaches the user verbatim.
- **Button** (`:961-971`) — on every card that has a `liteapiOfferId`:
  - Default: `Reserve` button next to the existing `Commit` button.
  - In flight: `Reserving…`, disabled.
  - After success: green `Reserved · <confirmationCode>` chip
    (booking ID in the title attr).

What the user will see on success:
> Card for "The Mulia Resort, Bali" shows: photo, name, ★4.6 ($$$),
> Canggu, [Commit] [Reserve] [Visit] → click Reserve → button becomes
> "Reserving…" → 5-10s later → green "Reserved · LB12345-A" chip
> replaces the Reserve button. A row exists in `reservations` keyed by
> userId; a `commission_ledger` row exists with `status: 'estimated'`.

What the user will see on failure (any LiteAPI / config error):
> Banner: `Couldn't reserve The Mulia Resort, Bali — LiteAPI: /v3.0/rates/book returned 422 — <body>`

---

## 6. Sandbox → production env flip

| Env var | Sandbox (this PR) | Production (next env flip) |
|---|---|---|
| `LITEAPI_MODE` | `sandbox` (default) | `production` |
| `LITEAPI_SANDBOX_KEY` | required | unused |
| `LITEAPI_PRODUCTION_KEY` | unused | required |

The client's `getMode()` / `getApiKey()` (`liteapiClient.ts:24-37`) is the
single switch — no code change needed for the flip. Routes + DB tables work
identically against either environment; the only behavioural difference is
LiteAPI's sandbox accepts the prebook's `transactionId` as a stand-in for
real card capture (the PR-4 checkout SDK must run for real production
bookings).

---

## Constraints verified

- **Scope held:** client methods + 2 DB tables + 2 auth'd routes + minimal
  Reserve button. No UX rebuild, no payment SDK in the browser, no
  webhook/reconciliation, no production env flip.
- **Auth on every new route:** cookie verify + user lookup FIRST, ownership
  check via `userId`-scoped Prisma query before any provider call. Same
  idiom as `src/app/api/ai/cart-plan/route.ts:77-88`.
- **User-scoped DB writes:** `reservations.create` and
  `commission_ledger.create` both set `userId: user.id` from the verified
  session — never from request body.
- **Prisma transaction:** reservation + commission writes wrapped in
  `prisma.$transaction` so a failed commission insert rolls the reservation
  back too (and vice-versa).
- **Fail-loud:** all upstream errors are typed (`MissingLiteApiKeyError`,
  `LiteApiError`); routes map them to structured HTTP; UI banner shows
  the upstream message verbatim. Booked-but-DB-failed is explicitly
  surfaced loud (with the `bookingId` for manual reconciliation).
- **No silent fallbacks:** if prebook/book fails, the Reserve button leaves
  the card untouched and shows the error — never silently masks with
  Commit-only behaviour or routes to Google.
- **Schema/migration in sync:** both `prisma/schema.prisma` + the migration
  SQL changed in this PR; `npx prisma generate` regenerated the client;
  `npx prisma validate` passes.
- **Sandbox-only:** the Reserve button's flow assumes sandbox semantics
  (transactionId passthrough). Production needs the SDK — PR-4.

### Untouched (cited)
- `git diff main -- src/app/api/trips/\[id\]/ai-assistant/route.ts` = 0
- `git diff main -- src/lib/travelSourceRegistry.ts` = 0
- `git diff main -- src/lib/placesSearch.ts` = 0
- `git diff main -- src/lib/viatorClient.ts` = 0
- `git diff main -- src/app/api/trips/\[id\]/vendor-commit/route.ts` = 0
- `git diff main -- src/components/trips/TripCreationBar.tsx` = 0
- `git diff main -- src/app/budgets/trips/new/page.tsx` = 0

### tsc + lint
- `npx tsc --noEmit` → exit 0.
- `npx eslint` on the touched + new files: 2 errors / 4 warnings, **all
  pre-existing baseline on `TripPlannerAI.tsx` + `liteapiClient.ts`**
  (confirmed via `git stash` baseline diff: 2 errors before, 2 errors
  after). Both new route files + the new client methods are fully
  lint-clean.

---

## Changeset

```
 M  prisma/schema.prisma                                                     (+62)
 A  prisma/migrations/20260528000000_travel_reservations_commission_ledger/migration.sql
 M  src/lib/liteapiClient.ts                                                 (+148)
 A  src/app/api/travel/liteapi/prebook/route.ts                              (76 lines)
 A  src/app/api/travel/liteapi/book/route.ts                                 (193 lines)
 M  src/components/trips/TripPlannerAI.tsx                                   (+87)
 A  audit-reports/travel-liteapi-pr-3b.md                                    (this report)
```

---

## What's next (out of scope here)

1. **PR-4 — UX rebuild + real SDK integration:** Airbnb-style carousels
   for the scan, plus rendering LiteAPI's hosted payment SDK in the
   browser. The SDK collects card → returns a real `transactionId` → we
   call `/api/travel/liteapi/book` with that. After this lands, production
   bookings become viable.
2. **Webhook + reconciliation:** LiteAPI confirms bookings + remits payouts
   weekly. A new route `POST /api/travel/liteapi/webhook` consumes those
   events and flips `commission_ledger.status` from `estimated` →
   `confirmed` → `paid`, plus a `Reservations` admin view.
3. **Holder data plumbing:** the booking PR-4 captures real `holder`/
   `guests` data (currently the sandbox stub uses `Trip Owner` /
   `guest@example.com`). The data is there in `trip_participants`; PR-4
   threads it through.
4. **Cancel / refund flow:** LiteAPI has cancellation endpoints not
   wired here. Surface in a "My Reservations" view.

Sources:
- [LiteAPI — POST /rates/prebook](https://docs.liteapi.travel/reference/post_rates-prebook)
- [LiteAPI — POST /rates/book](https://docs.liteapi.travel/reference/post_rates-book)
- [LiteAPI — User Payment / SDK flow](https://docs.liteapi.travel/docs/user-payment)
- [LiteAPI — Step 3: Pre-booking a room](https://docs.liteapi.travel/docs/step-3-pre-booking-a-room)
- [LiteAPI — Step 4: Booking a room](https://docs.liteapi.travel/docs/step-4-booking-a-room)
- [LiteAPI — Endpoints overview](https://docs.liteapi.travel/reference/api-endpoints-overview)
