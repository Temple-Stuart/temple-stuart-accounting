# HOTEL BOOKING INFRASTRUCTURE AUDIT (LiteAPI User Payment SDK)

**Scope:** map what's built vs the gap to a working **public** hotel booking on the
**User Payment SDK / commission** model — guest pays via LiteAPI's hosted payment
SDK, Alex earns markup; NOT Alex's own Stripe. LiteAPI flow: search → prebook
(`usePaymentSdk:true` → `secretKey`+`transactionId`) → SDK collects card → book
(`prebookId` + guest info). **Read-only. No source modified.** `Missing = MISSING`.

Branch: `claude/audit-hotel-booking-infra` · main @ `f1c27833`.

---

## TL;DR — server side is BUILT; the browser PAYMENT SDK is the real gap

The entire **server** spine (prebook client → book client → routes → reservation +
commission persistence) **EXISTS and is robust**, and the search result **carries
the `offerId`** prebook needs. The gaps to a *working public booking* are all on the
**front end + flow**: (1) **no LiteAPI hosted Payment SDK** in the browser (the
biggest gap — production card capture), (2) **no real guest/checkout form** (the one
existing caller hardcodes `'Trip Owner' / guest@example.com`), and (3) the booking
routes are **trip-scoped + authed**, so the public flow must hand off via sign-up →
trip. **Sandbox can book WITHOUT the SDK today** (book accepts the prebook
`transactionId` directly); production cannot.

---

## 1. EXISTING prebook/book CLIENT FNS — COMPLETE

### `prebookRate` — `liteapiClient.ts:638`
- **Sends** `{ offerId, usePaymentSdk: params.usePaymentSdk ?? true }` (`:639-642`) →
  `POST ${LITEAPI_BASE}/rates/prebook` (`:643`). ✅ correct endpoint, ✅ defaults
  `usePaymentSdk:true` (PCI scope stays off our stack, `:606-607`).
- **Returns** `PrebookResult` (`:617-634`): `prebookId`, `hotelId`, `offerId`,
  `price`, `currency`, **`commission`** (the markup, `:625`), **`transactionId` +
  `secretKey`** (the SDK payment context, `:626-629`), `paymentTypes`,
  `cancellationPolicies`. Parses `json.data ?? json` (`:654`) — handles both shapes.
- **TRUTH-FLAG:** the `secretKey`/`transactionId` mapping (`:662-663`) is the live
  prebook-with-`usePaymentSdk` shape — **confirm against the live API with the prod
  key** before relying on the SDK handoff (sandbox may differ).

### `bookRate` — `liteapiClient.ts:713`
- **Sends** `{ prebookId, holder, payment:{ method:'TRANSACTION_ID', transactionId },
  guests }` (`:714-722`) → `POST ${LITEAPI_BOOK_BASE}/rates/book` (`:723`, the
  separate book host `:23`). ✅ the User-Payment-SDK book shape (`method:
  TRANSACTION_ID` + the SDK's `transactionId`).
- **Returns** `BookResult` (`:697-709`): `bookingId`, `status`,
  `hotelConfirmationCode`, `supplierConfirmationNum`, dates, `hotelName`, `price`,
  `commission`, `currency`, `cancellationPolicies`.
- **Wired?** YES — both fns are called by routes (§2), not just defined.

---

## 2. EXISTING BOOKING ROUTES / UI

### Routes — EXIST, authed + trip-scoped
- **`POST /api/travel/liteapi/prebook`** (`prebook/route.ts`): `getVerifiedEmail`
  →401 (`:15-18`) → user lookup → **requires `tripId` + `offerId`** (`:34-40`) →
  **trip-ownership check** (`:43-49`) → `prebookRate({ offerId, usePaymentSdk })`
  (`:52`) → returns `{ prebook }` (with `transactionId`+`secretKey`) (`:57`). Errors
  map MissingKey→500, LiteApiError→502 (`:59-69`).
- **`POST /api/travel/liteapi/book`** (`book/route.ts`): same auth + trip-ownership
  (`:39-96`); validates `prebookId`, `paymentTransactionId`, `holder`, `guests`,
  dates (`:64-87`) → `bookRate(...)` (`:101-106`) → **persists `reservations` +
  `commission_ledger` in one `prisma.$transaction`** (`:140-174`), commission
  `status:'estimated'` (`:169`). Handles the "booked at LiteAPI but DB persist
  failed" case loudly for manual reconciliation (`:190-204`). **This is a complete,
  careful server booking.**
- **Schema:** `model reservations` (`schema.prisma:1153`) + `model
  commission_ledger` (`:1185`) EXIST. ✅

### Booking UI — only a SANDBOX one-click STUB (no real form)
- The sole caller of the routes is `TripPlannerAI.tsx` `handleLiteApiReserve`
  (`:624`): prebook (`:636-643`) → book (`:656-673`) in one click. It is explicitly
  a **prove-the-pipe sandbox stub**, per its own comments: *"Sandbox-only this PR —
  LiteAPI's sandbox accepts the prebook's transactionId without real card capture…
  PR-4 adds the proper checkout panel + LiteAPI's hosted payment SDK"* (`:620-622`),
  and *"booking PR will replace this with real card capture via LiteAPI's SDK"*
  (`:651`).
- **Guest info is HARDCODED:** `ownerName = 'Trip Owner'`, `ownerEmail =
  'guest@example.com'` (`:651-655`), sent as both `holder` and `guests[0]`
  (`:663-664`). → **No real guest/checkout form exists. MISSING.**
- **Confirmation:** minimal — `setReservedKeys({ confirmationCode, bookingId })`
  (`:679-682`) flips the card to a "reserved" chip. No dedicated confirmation page.
- **Reusable for public?** The *routes* + the prebook→book *sequence* are reusable
  as-is; the *UI* (one-click, hardcoded guest, no payment step) is NOT — a real
  checkout panel must be built.

### offerId survives search → UI ✅
- `extractOfferId(hotel)` (`liteapiClient.ts:468`) digs `roomTypes[].offerId` /
  `roomTypes[].rates[].offerId` (`:470-472`, "what `/rates/prebook` needs", `:465`)
  → mapped to `liteapiOfferId` (`:577`).
- It reaches the public UI: `HotelResult.liteapiOfferId` is in the view's type
  (`HotelResultsView.tsx:46`). So a public card already *holds* the offerId prebook
  needs. ✅ (Today the public `Book` ignores it and calls `onRequireAuth`, §4.)

---

## 3. THE PAYMENT SDK — MISSING (the biggest gap)

- **No LiteAPI hosted Payment SDK anywhere.** Grep for `secretKey` / `usePaymentSdk`
  / payment-SDK script across `src/components` → **only the TripPlannerAI comments
  saying it's not integrated** (`:621-622`,`:651`). No frontend `<script>` load of
  LiteAPI's `liteAPIPayment`/hosted-fields SDK, no `secretKey` → browser handoff, no
  card-capture iframe/element. **MISSING.**
- **Intended thread (what must be built):**
  1. prebook returns `secretKey` + `transactionId` (already surfaced by `prebookRate`
     `:662-663` and passed through the prebook route `:57`).
  2. The browser loads LiteAPI's hosted payment SDK, initialises it with `secretKey`,
     renders the card form, and on submit tokenises/charges **client-side** (PAN/CVV
     never touch our server, `:606-607`).
  3. On SDK success → call the book route with `prebookId` + `paymentTransactionId`
     (the SDK-confirmed transaction).
- **Sandbox shortcut (why "book" works today without the SDK):** the book route +
  stub pass the **prebook's** `transactionId` straight to `bookRate` — LiteAPI
  sandbox accepts it without real capture (`book/route.ts:692-694` comment;
  `bookRate` body `:717-720`). So end-to-end booking is demonstrable in sandbox NOW;
  **production requires the real SDK card capture in step 2.**
- **TRUTH-FLAG:** the SDK script URL, its init signature, and the exact
  `secretKey`→SDK handoff are **LiteAPI-doc + live-key confirm** — do not guess the
  SDK wiring; pull it from LiteAPI's current Payment-SDK docs with the prod key.

---

## 4. AUTH / GUEST MODEL

- **Public surface gates booking at sign-up (established pattern):**
  `PublicHotelSearch` `book = () => onRequireAuth()` (`:90`), wired to the view's
  `onBook` (`:147`) — a guest tapping **Book** opens the register modal, fires NO
  booking fetch. ✅ The header comment states it: *"SEARCH is public; BOOKING is
  gated"* (`:10`).
- **The routes enforce it server-side:** both prebook + book require
  `getVerifiedEmail` (`prebook:15`, `book:39`) **and** a **`tripId` the user owns**
  (`prebook:43-49`, `book:90-96`). So booking is not just UI-gated — it is
  **auth + trip-scoped at the server**. A guest genuinely cannot book; they must
  (a) sign up, (b) have a trip, (c) book within it.
- **Guest info** (`holder` + `guests[]`, name/email) is required by the book route
  (`:70-81`) but only ever supplied hardcoded by the stub (§2). A real form is
  needed and naturally collects this post-sign-up.

---

## REPORT — EXISTS | MISSING | THE GAP TO A WORKING BOOKING

### EXISTS (server spine — reuse as-is)
- `prebookRate` (usePaymentSdk, returns secretKey+transactionId+commission) —
  `liteapiClient.ts:638`.
- `bookRate` (TRANSACTION_ID payment, returns bookingId+confirmation) — `:713`.
- `POST /api/travel/liteapi/prebook` + `/book` — authed, trip-scoped, persist
  `reservations` + `commission_ledger` (`book/route.ts:140-174`).
- Schema `reservations` (`:1153`) + `commission_ledger` (`:1185`).
- `offerId` from search → `liteapiOfferId` in the public card type
  (`liteapiClient.ts:577`, `HotelResultsView.tsx:46`).
- The prebook→book sequence proven end-to-end in **sandbox** (TripPlannerAI stub).

### MISSING
- **LiteAPI hosted Payment SDK** in the browser (secretKey handoff + card capture) —
  the production-critical gap.
- A **real guest/checkout form** (holder + guests; the stub hardcodes them).
- A **confirmation view** (beyond a card chip).
- A **public→authed booking handoff** that carries the chosen `offerId`/hotel into
  the signed-up user's trip (today public Book just opens the register modal and
  drops the context).

### THE GAP — smallest PR chain to a working booking

**Sandbox-first (no SDK), then production (SDK):**

1. **PR-B1 — Checkout panel + guest form (authed, sandbox-bookable):** a real
   checkout UI that takes a search result's `liteapiOfferId` → calls the EXISTING
   prebook route → shows final price/commission/cancellation → collects **real**
   `holder`+`guests` (replacing the hardcoded stub) → calls the EXISTING book route
   with the prebook `transactionId`. Works end-to-end in **sandbox today** (no SDK).
   Replaces `TripPlannerAI.handleLiteApiReserve`'s hardcoded path. *(Server already
   done — this is UI + form.)*
2. **PR-B2 — LiteAPI Payment SDK integration (production card capture):** load
   LiteAPI's hosted payment SDK, init with prebook `secretKey`, render the card form,
   on success pass the SDK `transactionId` to the book route. **Gated on a live-key
   confirm of the SDK script + secretKey handoff** (no guessed SDK wiring). This is
   the multi-step piece.
3. **PR-B3 — Public→authed handoff:** when a guest taps **Book** on the public card,
   carry the chosen `{ liteapiOfferId, hotel, dates }` through sign-up into a trip,
   then drop them into the PR-B1 checkout panel (so the public funnel completes
   instead of dead-ending at the register modal).
4. **PR-B4 (later) — confirmation page + commission reconciliation webhook** (flip
   `commission_ledger.status` `estimated → confirmed` on LiteAPI's weekly payout
   confirmation; the book route already writes `estimated`, `book/route.ts:169`).

### Honest size estimate
- **"Book in SANDBOX today" is realistic and SMALL** — PR-B1 alone (a guest form +
  wiring the two existing routes) gets a real, persisted, commission-ledgered
  booking, because the server spine is complete.
- **"Book in PRODUCTION" is a multi-step build** — it requires the **Payment SDK**
  (PR-B2), which is genuinely new front-end work + a live-doc/key confirmation of
  LiteAPI's SDK contract. Do **not** estimate production booking as a one-PR task;
  the SDK is the real lift. Everything *around* it (routes, persistence, commission,
  offerId plumbing) is already built.

**Flags (live-confirm, no guessed shapes):** the prebook-with-`usePaymentSdk`
response (`secretKey`/`transactionId`, `liteapiClient.ts:662-663`); the Payment SDK
script URL + init + handoff (§3). Confirm both against LiteAPI's docs with the prod
key before PR-B2. **No code modified in this audit.**
