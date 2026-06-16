# Duffel Payments Audit — flight "Book" via Duffel's hosted card component

**Scope:** read-only audit. We're building flight **Book** (pay now) using **Duffel
Payments** — Duffel's PCI card component collects the traveler's card, funds flow through
Duffel to the airline, we add markup, no cashflow risk. This mirrors how hotels charge via
**LiteAPI's hosted card SDK** (`CheckoutPanel`). This maps the exact Duffel Payments
integration against what exists. **No code changed.**

**Headline:** the order step is *already_* shaped for Duffel Payments — `createOrder` uses
`type: 'instant'` and pays the order from **balance** (`lib/duffel.ts:127, 133-135`), which
is exactly how a Duffel-Payments order is finalized. **What's missing is everything before
the order:** the **Payment Intent** (create + confirm), the **Duffel Card component**
(`@duffel/components` is **not installed**), the **passenger-collection UI** (none exists),
**markup**, and **guest-ok routing** (the route 401s). Today's `type:'balance'` pays from
*our* pre-funded balance; Duffel Payments inserts a Payment Intent that deposits the
*customer's* money into balance first. Map + plan below.

---

## 1. What exists today (the skeleton)

### `lib/duffel.ts` (226 lines) — search + order, no Payments
- Client setup: `DUFFEL_API_URL='https://api.duffel.com'` (`:1`), `DUFFEL_TOKEN =
  process.env.DUFFEL_API_TOKEN` (`:2`), headers `Authorization: Bearer` + `Duffel-Version:
  v2` (`:8-12`). **One token, raw `fetch`.** Test vs live is just *which* token value
  (Duffel test tokens vs live tokens) — no separate mode flag, no Payments client key.
- `searchFlights` (`:27`, `POST /air/offer_requests`), `getOffers` (`:67`), `getOffer`
  (`:85`) — search/offer retrieval. Exist.
- `createOrder(offerId, passengers, payment?)` (`:120`) → `POST /air/orders` with
  **`type: 'instant'`** (`:127`), `selected_offers`, `passengers`, and optional
  `payments: [payment]` (`:133-135`). The order shape is **already correct for Duffel
  Payments.**
- `PassengerDetails` (`:103-112`): `id, title, given_name, family_name, born_on, email,
  phone_number, gender`. (See §3 for gaps — international `identity_documents`, E.164 phone,
  infants.)
- **`PaymentDetails` (`:114-118`): `type: 'balance'` ONLY** — `amount`, `currency`. **No
  Payment Intent type, no Duffel Payments support.** This is the central gap: there is no
  function to create or confirm a Payment Intent.
- `parseOffer` (`:156`) exposes `expiresAt` (`:219`), `price`, `baseAmount`, `taxAmount`,
  `conditions.refundable/changeable` — useful for the checkout UI + expiry handling.

### `/api/flights/book/route.ts` (71 lines) — wired, but wrong payer + locked
- **Auth-gated:** `getVerifiedEmail()` → **401 if no user** (`:8-11`), then requires a
  prisma user (`:12-17`). **Guests are blocked** — violates the freemium "booking never
  locked" rule hotels follow (§2).
- Flow: `POST {offerId, passengers}` → `getOffer` (`:29`) → map `offer.passengers` to
  submitted pax (`:31-43`) → `createOrder(offerId, mapped, { type:'balance', amount:
  offer.total_amount, currency: offer.total_currency })` (`:45-49`) → returns
  `bookingReference, status, totalAmount…` (`:51-62`).
- **Payment problem:** `type:'balance'` with **no preceding Payment Intent** = the order is
  paid from **our** Duffel balance (our money), **the customer is never charged.** It also
  pays `offer.total_amount` exactly — **no markup**.
- **What changes for Duffel Payments:** insert Payment Intent create + confirm (collect the
  customer's card into balance, with markup) *before* `createOrder`; make the route
  guest-ok; add idempotency.

### Packages / env
- **`@duffel/components` is NOT installed** (`grep duffel package.json` → none). The Card
  component must be added.
- Env today: only **`DUFFEL_API_TOKEN`** (server) + a UI flag `NEXT_PUBLIC_DUFFEL_ENABLED`
  (`FlightPicker.tsx:310`). The note "DUFFEL_API_TOKEN must be set" is surfaced in
  `FlightPickerView.tsx:357`. **No Payments key is needed beyond the token** — the Card
  component authenticates with the **per-intent `client_token`** returned by the
  create-intent call (unlike Stripe, there's no global publishable key).

---

## 2. The hotel parallel (the proven pattern to mirror)

### `CheckoutPanel.tsx` (hotels) — the UX/architecture template
Header comment `CheckoutPanel.tsx:4-15` + flow:
1. **Prebook** on open → `POST /api/travel/liteapi/prebook` (`:167`) → returns
   `prebookId + transactionId + secretKey + paymentEnv` (`:174-180`); `phase` state
   `'prebooking' | 'pay'` (`:117`).
2. **Hosted card** → loads LiteAPI's SDK from `SDK_SRC` (`:34`), inits
   `new window.LiteAPIPayment({ publicKey: paymentEnv, returnUrl, … })` (`:24-30, :194+`).
   **Card (PAN/CVV) is captured client-side and never touches our server** (`:5-7, :14`).
   `publicKey` is driven off the server's key env — never hardcoded (`:14`).
3. **Confirm** → SDK redirects to `returnUrl` `/booking/confirm` (`:209`); that page
   collects holder first/last/email (`booking/confirm/page.tsx:55-57`) and finalizes via
   `POST /api/travel/liteapi/book` (needs `prebookId + paymentTransactionId`).
   `onBooked({confirmationCode, bookingId})` (`:66`).

**This is the template for `FlightCheckoutPanel`:** open → prepare payment → mount the
vendor's hosted card UI → confirm → show booking reference. The Duffel equivalents:
prebook→**Payment Intent**, LiteAPI SDK→**Duffel Card component**, liteapi/book→**createOrder
(instant, from balance)**.

### Freemium: hotel book is guest-ok + public — flights must match
- `liteapi/book/route.ts:92-94`: "getVerifiedEmail returns null for a guest (no throw)" —
  **booking does not require login.**
- `middleware.ts:50` `PUBLIC_PATHS` includes `/api/travel/liteapi/prebook` + `…/book`
  (`:78-79`) and `/api/flights/search` (`:70`) — but **NOT `/api/flights/book`.** Flight
  book must be added to `PUBLIC_PATHS` and lose its 401 to match (booking never locked).
- Today flights collect **zero** passenger detail: search sends `passengers: '1'`
  (`PublicFlightSearch.tsx:112`) and `FlightPickerView` collects **no** pax fields (grep:
  none). All passenger UI is net-new.

---

## 3. What Duffel Payments needs (the build map)

### Step-by-step, mapped to where it lives

| # | Duffel Payments step (doc) | Endpoint / SDK | Today | Where it goes |
|---|---|---|---|---|
| 1 | Search → select offer | `POST /air/offer_requests`, `GET /air/offers/{id}` | **Exists** `lib/duffel.ts:27,85` | — |
| 2 | Collect passenger details | (form) | **Missing** | `FlightCheckoutPanel` (new) |
| 3 | **Create Payment Intent** (amount+currency, **+markup**) | `POST /payments/payment_intents` → returns `id` + **`client_token`** | **Missing** | new `createPaymentIntent()` in `lib/duffel.ts` + a server route |
| 4 | Mount **Duffel Card component**, customer enters card | `@duffel/components` (`DuffelPayments`/`DuffelCardForm`) using `client_token` | **Missing** (pkg not installed) | `FlightCheckoutPanel` (client) |
| 5 | **Confirm Payment Intent** (captures customer funds → our balance) | `POST /payments/payment_intents/{id}/actions/confirm` | **Missing** | new `confirmPaymentIntent()` + server route |
| 6 | **Create order** `type:'instant'`, `payments:[{type:'balance',…}]` | `POST /air/orders` | **Exists** `createOrder` `lib/duffel.ts:120-151` (pays balance) | finalize route |
| 7 | Confirmation (booking reference) | order response | **Exists** route `:51-62` | confirmation UI |

**Key insight to avoid a wrong turn:** the order at step 6 *stays* `type:'balance'` — that
is correct for Duffel Payments. Steps 3–5 are what make "balance" the *customer's* money
instead of ours. Don't change the order payment type; add the intent in front of it.

### Passenger fields — `PassengerDetails` vs what Duffel needs
- Have (`lib/duffel.ts:103-112`): `id, title, given_name, family_name, born_on, email,
  phone_number, gender`. Covers a basic **domestic adult**.
- Likely additions for real orders: **`phone_number` in E.164** (`+1…`), **`identity_documents`**
  (passport number/expiry/nationality) for **international** itineraries, **infant/child**
  `type` + `infant_passenger_id`, and matching each form passenger to the **offer's**
  `passenger.id` (the route already maps by index `:31-43`, which is fragile for
  multi-pax — match by id).

### Markup — config point only
Duffel Payments lets the **Payment Intent `amount` exceed the offer total**; the delta
stays in our balance after paying the order = our margin. **Markup goes on the
create-Payment-Intent amount (step 3, server-side).** Flag as a single config point — do
**not** hardcode a number; make it a configurable function/env so finance owns it.

### Env / keys
- Server: reuse **`DUFFEL_API_TOKEN`** for intents + confirm + order. **Test mode = a Duffel
  test token; live = live token** (same var, different value).
- Client: **no new public key** — the Card component uses the per-intent `client_token`.
- **New dependency:** `@duffel/components` (npm). That's the only package add.

---

## 4. The plan (atomic PRs, honest complexity)

### PR order
1. **`PR-Duffel-Payments-Backend`** (server only, nothing user-visible)
   - Add `createPaymentIntent(amount, currency)` + `confirmPaymentIntent(id)` to
     `lib/duffel.ts` (the missing `/payments/payment_intents` calls).
   - Add the **markup** config point on the intent amount.
   - Rework `/api/flights/book` into the Payment-Intent → confirm → `createOrder(instant,
     balance)` sequence (one orchestrating route, or split create-intent vs finalize).
   - **Guest-ok:** drop the 401 (`route.ts:8-11`), decouple from requiring a prisma user
     (mirror `liteapi/book:92-94`), and add `/api/flights/book` (+ any intent route) to
     `middleware.ts` `PUBLIC_PATHS`.
   - Add **idempotency keys** on order creation (avoid double-charge on retry).
2. **`PR-Flight-Checkout`** (the heavy one) — `FlightCheckoutPanel`, modeled on
   `CheckoutPanel`: passenger form (§3 fields) → create intent → mount **Duffel Card
   component** (`@duffel/components`, install) → confirm → finalize order → show booking
   reference. Handle offer-expiry + error states (below).
3. **`PR-Flight-Book-Button`** (small) — add a **Book** button to the flight card
   (`FlightPickerView.tsx:158-207`) alongside Save-to-trip, opening the panel. Guest-ok.

### Riskiest step + sandbox-first
- **Riskiest: real card capture + live order creation (steps 4–6) — this touches real
  money.** Build and prove the **entire** flow in **Duffel test mode first**: a test token,
  Duffel's **test airline offers** (Duffel Airways), and Duffel's **test card numbers**, so
  no real charge or real PNR is created until the sandbox flow is green end-to-end
  (intent → confirm → order → booking reference → refund/cancel).

### Honest complexity — every place that needs care
- **PCI:** the card is entered **only** in Duffel's component; **never** send/log card data
  through our server. Audit logging — the route currently `console.error`s errors
  (`route.ts:65`); ensure no PAN/CVV can ever appear there.
- **Markup math:** intent `amount` vs `offer.total_amount`, same `currency`; reconcile that
  the order's actual total is covered after markup; round correctly (minor units).
- **Test vs live:** one `DUFFEL_API_TOKEN` switches both — a wrong value books *real*
  flights. Gate live behind explicit config; never default to live in dev.
- **Offer expiry race:** offers expire in minutes (`parseOffer.expiresAt`,
  `lib/duffel.ts:219`). If the offer expires between select and order, re-fetch/re-price;
  surface a clear "price/availability changed" state, not a 500.
- **Duffel order error states to handle explicitly:** `already_paid`, expired offer,
  `requires_action`/payment-intent failure, price-change-on-order, and (for hold offers)
  `past_payment_required_by_date`. Each needs a user-facing message, like LiteAPI's
  fail-loud inline errors — never a silent failure or fake success.
- **Index-based passenger mapping** (`route.ts:31-43`) is fragile for multi-passenger /
  infants — match form pax to `offer.passengers[].id` explicitly.

---

### Citation index
- Duffel client / order shape / payment type: `src/lib/duffel.ts:1-2, 8-12, 27, 85,
  103-118, 120, 127, 133-135, 219`
- Flight book route (locked, balance, no intent, no markup):
  `src/app/api/flights/book/route.ts:8-17, 29, 31-43, 45-49, 51-62, 65`
- No Duffel npm component / env: `package.json` (no `@duffel`); `src/lib/duffel.ts:2`;
  `src/components/trips/FlightPicker.tsx:310`; `src/components/trips/FlightPickerView.tsx:357`
- Hotel checkout template: `src/components/trips/CheckoutPanel.tsx:4-15, 24-30, 34, 66,
  117, 167, 174-180, 194, 209`; `src/app/booking/confirm/page.tsx:55-57`
- Freemium guest-ok + middleware: `src/app/api/travel/liteapi/book/route.ts:92-94`;
  `src/middleware.ts:50, 70, 78-79`
- No flight passenger UI today: `src/components/trips/PublicFlightSearch.tsx:112`;
  `src/components/trips/FlightPickerView.tsx` (no pax fields)
