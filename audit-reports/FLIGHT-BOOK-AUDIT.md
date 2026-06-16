# Flight "Book" Audit — make flights match hotels (Book + Save to trip)

**Scope:** read-only audit. Today, home-Travel flight cards can only **Save to trip**
(budget). Hotels offer **both** "Book" (pay now → real vendor reservation) and "Save to
trip" (budget). Goal: map what it takes to add a flight **Book** action via Duffel,
mirroring the hotel pattern. **No code changed.**

**Headline:** the Duffel order *plumbing* already exists (`lib/duffel.ts` + `/api/flights/book`),
but it is **never wired to any UI, is auth-gated (hotels aren't), has no passenger-collection
screen, and books against the Duffel account *balance* rather than capturing the guest's
card.** So this is **not** a simple "add a button" — the route is a skeleton, and a real
pay-now flight book is **heavier than hotels**. Details + plan below.

---

## 1. How hotels "Book" today (the pattern to mirror)

### Two actions per hotel card
`PublicHotelSearch.tsx` renders **both** actions, exactly the target shape for flights:
- Comment `PublicHotelSearch.tsx:10-14`: *"Two actions per stay: 'Book' (pay now → a real
  guest reservation via CheckoutPanel, no login) and 'Save to trip' (plan → … vendor-commit)."*
- **Book** → `book()` opens `CheckoutPanel` (`PublicHotelSearch.tsx:244` `onBook={book}`,
  panel mounted `:256-264`), opened **standalone with NO tripId** (`:253` "guest checkout").
- **Save to trip** (budget) → `POST /api/trips/[id]/vendor-commit` as synthetic lodging
  (`PublicHotelSearch.tsx:141`), the same commit the discover flow uses.

### The Book flow, end-to-end (real payment)
`CheckoutPanel.tsx` (401 lines) — header comment `:4-15`:
1. **Prebook** on open → `POST /api/travel/liteapi/prebook` (`CheckoutPanel.tsx:167`),
   returns `prebookId` + `transactionId` + `secretKey` + `paymentEnv`.
2. **Card capture** → loads LiteAPI's **hosted Payment SDK** (`SDK_SRC`,
   `CheckoutPanel.tsx:34`, `:213` `new window.LiteAPIPayment`). The card (PAN/CVV) is
   captured client-side and **never touches our server** (`:5-7`).
3. **Confirm** → the SDK redirects to our `returnUrl` `/booking/confirm`
   (`CheckoutPanel.tsx:209`); that page collects guest details and calls the book route
   → `POST /api/travel/liteapi/book` (`src/app/booking/confirm/page.tsx:77`), which needs
   `prebookId` + `paymentTransactionId` (`liteapi/book/route.ts:66`) and calls `bookRate`
   (`:132`). Sandbox uses test card 4242… (`CheckoutPanel.tsx:15`) — no real charge.

### Guests can book (never locked) — freemium confirmed
- `liteapi/book/route.ts:92-94`: *"getVerifiedEmail returns null for a guest (no throw)."*
  Booking does **not** require login.
- `middleware.ts:78-79` lists `/api/travel/liteapi/prebook` and `/api/travel/liteapi/book`
  as **public** routes.
- So hotel **vendor booking is free to guests**, matching the freemium rule (booking feeds
  are never locked; only *saving to a trip* nudges sign-up).

---

## 2. The current flight actions (Save only — no Book)

- **Save to trip (the only commit today):** `PublicFlightSearch.tsx` drives the public
  `/api/flights/search` (`:115`) and, for a logged-in user with a selected trip, commits a
  chosen offer via `POST /api/trips/[id]/vendor-commit` (`commitLeg` `:136`, fetch `:154`)
  — the **same** vendor-commit hotels use for Save. The view exposes only
  `onCommitLeg`/`onUncommitLeg` (`FlightPickerView.tsx:85-86`); a committed leg shows a
  "Committed" badge (`:140`) + an "Uncommit" button (`:165`). This is **budget/plan**, not
  pay-now.
- **No Book anywhere.** Confirmed by the component's own note —
  `FlightPicker.tsx:16-17`: *"The real Duffel order (/air/orders, via /api/flights/book) is
  **not invoked** by this component at all."*
- **Where a "Book" button would go:** the flight-card action row in
  `FlightPickerView.tsx:158-207` — for a leg with `selectedOffer` (price shown `:149`),
  add a **Book** button alongside the existing commit/Save control, mirroring the hotel
  card's two-button row.

---

## 3. The Duffel Book path — EXISTS, but a skeleton

### What already exists (reusable)
- **Client `src/lib/duffel.ts` (226 lines)** has order-creation, not just search:
  - `getOffer(offerId)` → `GET /air/offers/{id}` (`:85`)
  - `createOrder(offerId, passengers, payment?)` → **`POST /air/orders`** (`:120`, `:137`)
  - `PassengerDetails` (`:103`) + `PaymentDetails` (`:114`) interfaces, `parseOffer` (`:156`)
  - (plus `searchFlights` `:27`, `getOffers` `:67`)
- **Route `src/app/api/flights/book/route.ts` EXISTS** — `POST {offerId, passengers}` →
  `getOffer` → maps `offer.passengers` to the submitted pax → `createOrder(...)` → returns
  `{bookingReference, status, totalAmount, …}`. So the **order API is wired in code.**

### What's MISSING / mismatched (the real work)
1. **Never reached from the UI.** No Book button calls `/api/flights/book` (per
   `FlightPicker.tsx:16-17`). Net-new wiring required.
2. **Auth-gated — unlike hotels.** `flights/book/route.ts` returns **401** for a guest
   (`getVerifiedEmail` → `if (!userEmail) 401`, top of the POST) and is **not** in the
   `middleware.ts` public list (only `/api/flights/search` is, `:70`). This **violates the
   freemium "booking never locked" rule** hotels follow. Must be made guest-ok (public
   route + drop the hard 401) to mirror hotels.
3. **No passenger-collection UI.** The route expects a `passengers[]` array (title,
   given/family name, DOB, email, phone, gender — `route.ts` mapping), but **nothing
   collects it.** Hotels have `CheckoutPanel`; flights have **no equivalent**. This screen
   is net-new and is more involved than a hotel guest form (per-passenger name/DOB/gender,
   and passport/nationality for international itineraries).
4. **Payment model differs — the crux.** `createOrder` is called with
   `payment: { type: 'balance', … }` (`flights/book/route.ts`), i.e. it pays from the
   **Duffel account balance** (sandbox/test money) — it does **not** capture the *guest's*
   card. Hotels capture a **real card** via LiteAPI's hosted SDK. So "Book = pay now,
   charging the traveler" is **not** what the current flight route does; real card capture
   (Duffel Payments / a hosted card flow, or Stripe) is **net-new** and is the heaviest
   piece.

---

## 4. The plan

### Target UX (mirror hotels)
Flight card (`FlightPickerView.tsx:158-207`) gets **two** actions on a selected offer:
- **Book** (pay now → real Duffel order → actual) → opens a new **`FlightCheckoutPanel`**.
- **Save to trip** (budget → plan) → the existing `vendor-commit` commit (unchanged).

### Reusable vs net-new
| Piece | Status |
|---|---|
| Duffel order client (`getOffer`, `createOrder`, pax/payment types) | **Reuse** — `lib/duffel.ts` |
| `/api/flights/book` route skeleton | **Reuse / finish** — exists but auth-gated + balance-pay |
| Modal/checkout pattern (prebook→pay→confirm chrome) | **Reuse the shape** of `CheckoutPanel.tsx` |
| Two-button card layout | **Reuse the shape** of `PublicHotelSearch.tsx:244-264` |
| Guest-ok routing | **Net-new** — add `/api/flights/book` to `middleware.ts` public list + drop the 401 |
| Passenger-collection screen (`FlightCheckoutPanel`) | **Net-new** — no flight equivalent exists |
| Real card capture / charging the traveler | **Net-new** — today it's Duffel `balance`, not guest card |

### Honest complexity
**Flight Book is heavier than hotel Book.** Hotels handed us a hosted card SDK and a
guest form; flights have **none of the payment/passenger UI**, and the existing route
charges Duffel balance, not the customer. The order plumbing existing is a real head start,
but "pay now, charge the traveler, give them a booking reference" still needs a passenger
form, guest-ok routing, **and** a real payment integration. International flights also need
passport/nationality data Duffel may require at order time.

### Recommended atomic PRs (in order)
1. **`PR-Duffel-Book-Route`** — finish `/api/flights/book`: make it **guest-ok**
   (`middleware.ts` public + remove the hard 401, matching hotels) and settle the payment
   model (decision below). Smallest server-only PR; nothing user-visible yet.
2. **`PR-Flight-Checkout`** — net-new `FlightCheckoutPanel` (the `CheckoutPanel`-equivalent):
   passenger form + payment + confirmation/booking-reference. The heavy PR.
3. **`PR-Flight-Book-Button`** — wire a **Book** button into `FlightPickerView.tsx:158-207`
   next to Save, opening the panel. Small once 1–2 land.

**Decision needed before building (payment model):** keep Duffel **`balance`** (test/own
account — fast, but *we* pay, not the traveler) **or** build real **card capture**
(Duffel Payments / Stripe — true "pay now," mirrors hotels, much larger). This choice
drives whether PR-2 is light or heavy and should be answered first. If `balance` is
acceptable for an MVP, all three PRs are tractable; if real card capture is required,
PR-2 is a substantial payment-integration effort comparable to (or beyond) the hotel SDK
work.

---

### Citation index
- Hotel two-button card: `src/components/trips/PublicHotelSearch.tsx:10-14, 141, 244, 253-264`
- Hotel checkout flow: `src/components/trips/CheckoutPanel.tsx:4-15, 34, 167, 209, 213`;
  `src/app/booking/confirm/page.tsx:77`; `src/app/api/travel/liteapi/book/route.ts:66, 92-94, 132`
- Hotel guest-ok routing: `src/middleware.ts:78-79`
- Current flight Save-only: `src/components/trips/PublicFlightSearch.tsx:115, 136, 154`;
  `src/components/trips/FlightPickerView.tsx:85-86, 140, 158-207`;
  `src/components/trips/FlightPicker.tsx:16-17`
- Duffel client: `src/lib/duffel.ts:27, 67, 85, 103, 114, 120, 137, 156`
- Flight book route (exists, auth-gated, balance-pay): `src/app/api/flights/book/route.ts`
- Flight routing today (search public, book not): `src/middleware.ts:70`
