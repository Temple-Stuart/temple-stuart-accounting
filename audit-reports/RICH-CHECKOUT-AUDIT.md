# RICH CHECKOUT AUDIT — photos + details + cancellation + reviews in the booking popup

**Scope:** make the `CheckoutPanel` show hotel **photos**, room/hotel **details**,
**cancellation policy / T&C**, and guest **reviews** — all in one scrollable popup,
with payment at the bottom. Map the data + the wiring. **Read-only. No source
modified.** `Missing = MISSING`.

Branch: `claude/audit-rich-checkout` · main @ `56ff077a`.

---

## TL;DR

Almost all the data **exists as client functions** but **no PUBLIC route exposes
content or reviews** — same gap the location routes had (guests would be redirected/
blocked). Cancellation comes **free** from the prebook the panel already does;
photos come **free** from the search result already on hand. The panel **already
scrolls** (`max-h-[90vh] overflow-y-auto`). The two real needs: **public
content/reviews routes** (paid LiteAPI calls → must be guarded) and **passing
`hotelId` into the panel** (it has `offerId`/`hotelName` but NOT `hotelId`).

---

## 1. HOTEL CONTENT (photos + details)

### Client fn — EXISTS, no route
- `getHotelContent(hotelId: string): Promise<HotelContent | null>`
  (`liteapiClient.ts:846`) → `GET /v3.0/data/hotel?hotelId=…` (paid, B-5100 COGS,
  "per detail-view only").
- **`HotelContent` shape** (`:825-843`, code-confirmed): `id`, `name`,
  `hotelDescription`, `hotelImportantInformation` (← the T&C-ish text),
  `hotelImages: Array<{ url, urlHd?, caption?, order?, defaultImage? }>` (the full
  gallery, incl. **HD**), `hotelFacilities: string[]`, `facilities: Array<{
  facilityId, name }>`, `address`, `city`, `country`, `zip`, `location:{ latitude,
  longitude }`, `starRating`, `rating` (0–5 guest score), `reviewCount`, `stars`.
- **No API route exposes it.** `grep getHotelContent` across `src/app` → **only the
  lib fn, no route. MISSING.** A guest panel needs a PUBLIC fetch.

### Already on hand (no extra call) — the search result
- `HotelResult` (`HotelResultsView.tsx:31-46`) already carries `photoUrl`
  (`:34`), **`images?: string[]`** (`:35`, the gallery URLs from the rate metadata),
  `name`, `facilities?`, **`liteapiHotelId`** (`:45`), `liteapiOfferId` (`:46`).
- So **photos + a facility list + the hotelId are already in the result** the panel
  is opened from — the panel could render photos with **zero** extra calls by
  receiving `images[]`. The **richer** content (full HD gallery, full description,
  `hotelImportantInformation`/T&C, address/stars aggregate) needs `getHotelContent`.

---

## 2. REVIEWS

### Client fn — EXISTS, no route
- `getHotelReviews(hotelId, opts?): Promise<HotelReview[]>` (`liteapiClient.ts:780`)
  → `GET /v3.0/data/reviews?hotelId=…&limit=8` (paid, B-5100 COGS; fail-loud — an
  API error is never an empty list).
- **`HotelReview` shape** (`:765-775`, code-confirmed): `averageScore?` (e.g. 9/10),
  `country?`, `type?` (e.g. "family with young children"), `name?` (reviewer first
  name), `date?` ("YYYY-MM-DD HH:MM:SS"), `headline?`, `language?`, `pros?`, `cons?`.
- **No API route exposes it.** MISSING — same as content; the guest panel needs a
  PUBLIC reviews fetch.

---

## 3. CANCELLATION / T&C — FREE from the prebook the panel already does

- **The panel already prebooks** (`CheckoutPanel.tsx:78-100`) and `PrebookResult`
  includes **`cancellationPolicies?: unknown`** (`liteapiClient.ts:640`), sourced
  from `d.roomTypes?.[0]?.rates?.[0]?.cancellationPolicies ?? d.cancellationPolicies`
  (`:672`). The panel's local `Prebook` type already keeps it
  (`CheckoutPanel.tsx:44`) — so **cancellation needs NO extra call.**
- **Shape is `unknown`** in code — LiteAPI's cancellation object (typically
  `{ refundableTag, cancelPolicyInfos: [{ cancelTime, amount, type }] }`). **FLAG:
  live-probe the exact field shape before rendering it — no guessed fields.**
- **T&C / important info:** `HotelContent.hotelImportantInformation` (`:828`) is the
  hotel's terms/important-info text — comes from the content call (§1).

---

## 4. THE PANEL TODAY

- **Flow** (`CheckoutPanel.tsx`): prebook on open (`:78-104`) → render LiteAPI's
  hosted SDK card form into `#liteapi-payment-target` + `handlePayment()`
  (`:106-138`) → SDK redirects to `/booking/confirm`. New content sections would
  slot **above** the price/payment block in the `phase === 'pay'` body (`:177-205`).
- **Identifier it has:** props are `tripId?`, **`offerId`**, **`hotelName`**,
  `checkin`, `checkout`, `onClose`, `onBooked` (`:51-58`) — **NO `hotelId`.**
  `getHotelContent`/`getHotelReviews` need a `hotelId`. The callers DO have it:
  `PublicHotelSearch` opens the panel from a `HotelResult` (`liteapiHotelId`,
  `HotelResultsView.tsx:45`) but passes only `offerId`/`hotelName`
  (`PublicHotelSearch.tsx:169-171`); `TripPlannerAI` opens from a rec with
  `liteapiHotelId` but passes only `offerId`/`hotelName`
  (`TripPlannerAI.tsx:892-895`). → **add a `hotelId` prop + `images?` prop; both
  callers already hold the values.**
- **Scroll:** the modal is `fixed inset-0 … flex items-center justify-center`
  (`:145`) with an inner `max-h-[90vh] w-full max-w-lg overflow-y-auto …` (`:152`)
  — **it ALREADY scrolls.** Long content + reviews fit with no structural change;
  keep the payment block last so it stays at the bottom of the scroll.

---

## REPORT — EXISTS | MISSING | THE PLAN

### EXISTS (reuse)
- `getHotelContent` (`:846`) + `HotelContent` shape (`:825`); `getHotelReviews`
  (`:780`) + `HotelReview` shape (`:765`).
- Cancellation already in the prebook (`PrebookResult.cancellationPolicies`, `:640`)
  the panel already fetches.
- Photos + `liteapiHotelId` already on the search `HotelResult` (`images[]` `:35`,
  `liteapiHotelId` `:45`).
- The panel already scrolls (`:152`).

### MISSING
- **Public route for hotel content** (`/api/travel/hotels/content?hotelId=`).
- **Public route for hotel reviews** (`/api/travel/hotels/reviews?hotelId=`).
- Both must be **added to `middleware.ts` PUBLIC_PATHS** (else a guest is redirected
  — exactly the bug PR-G-public-paths fixed for locations/search).
- A **`hotelId` (+ `images?`) prop** on `CheckoutPanel`, passed by both callers.

### THE PLAN — smallest PRs

1. **PR-RC1 — public content + reviews routes (paid → guarded).** Two GET routes
   wrapping `getHotelContent` / `getHotelReviews`, mirroring the activity/visa guard
   pattern: extract IP → `rateLimit('hotel-content:'+ip)` / `('hotel-reviews:'+ip)`
   → validate `hotelId` (400) → call the fn → return. **These are PAID LiteAPI
   calls** (B-5100 COGS), so unlike the free locations routes they should ALSO get a
   durable daily cap (`reserveTravelSearch('hotelcontent'/'hotelreviews')`, tight
   default like the booking cap) so public guests can't run up COGS. Add both paths
   to `PUBLIC_PATHS`. No auth (the panel runs for guests). LiteApiError → 502.
2. **PR-RC2 — richer scrollable panel.** Add `hotelId` (+ optional `images`) props
   to `CheckoutPanel`; wire both callers (`PublicHotelSearch` →
   `checkoutHotel.liteapiHotelId`/`.images`; `TripPlannerAI` → the rec's
   `liteapiHotelId`/`images`). In the panel: above the payment block render
   - a **photo gallery** (from `images[]` on hand, or the content call's HD gallery),
   - **details** (description, stars, address, amenities from content),
   - **cancellation** (from the prebook already done) + **important info / T&C**
     (from content),
   - **reviews** (fetch the new reviews route; render `headline/pros/cons/score`,
     "no reviews" honest empty, error state).
   The modal already scrolls; payment stays last. Pure-view + fetch states; no fake
   data.

**One PR or split?** **Split.** RC1 (routes + middleware) is independently
mergeable and unblocks RC2; RC2 (the panel UI + the two new fetches) depends on
RC1's routes existing at runtime (same runtime-not-compile dependency as the
locations picker). Keeping them separate keeps each atomic + revertible.

### Live-probe flags (no guessed shapes)
- **`cancellationPolicies`** is typed `unknown` (`:640`) — probe `/rates/prebook`'s
  cancellation object (refundableTag? cancelPolicyInfos[]?) before rendering it.
- **`/data/hotel`** + **`/data/reviews`** shapes are documented in code comments
  (`:759-760`, `:818-823`) but should be confirmed live with the prod key (esp.
  which image field is populated — `url` vs `urlHd` — and whether `pros/cons` come
  through) before the panel maps them. Reuse the existing probe family
  (`scripts/probe-liteapi-*.ts`) for a quick content+reviews shape check.

**Cost note:** content + reviews are PAID per-call. The panel opens per booking
attempt (one hotel), so it's bounded per user — but PUBLIC + paid means the RC1
routes need rate-limit + a daily cap, and ideally the panel fetches them ONCE
(cache in state) and only when the panel is open. No code modified in this audit.
