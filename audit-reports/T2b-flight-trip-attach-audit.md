# T2b Audit — flight bookings born attached to trips

Read-only audit, live lines authoritative, performed before any implementation.
Scope: thread `tripId` from the flight checkout into `POST /api/flights/book`, guarded by
the EXACT ownership gate `liteapi/book` already proves, persisted on the reservation, and
surfaced with the T2c-grade visible choice. No fallback logic — attachment is explicit or
absent, never assumed.

## 1. flights/book/route.ts — current state (`src/app/api/flights/book/route.ts`, 359 lines)

Guard ordering as it exists today:

| Order | What | Lines |
|---|---|---|
| 1 | `rateLimit('flight-book:'+ip)` — per-IP burst limit | :43-46 |
| 2 | OPTIONAL auth — `getVerifiedEmail()` + `users.findFirst` ("NO 401 here", guest-ok) | :48-57 |
| 3 | `body` parse + destructure `{ offerId, passengers, idempotencyKey, paymentIntentId }` | :59-63 |
| 4 | 400 validation (offerId / passengers) | :65-70 |
| 5 | **GUARD 2** — `reserveTravelSearch('flightbooking')` daily cap | :75 |
| 6 | Fail-closed mode gate (`duffelMode()`) | :82-90 |
| 7 | `getOffer(offerId)` — **FIRST Duffel call** | :94 |
| 8 | Expired-offer 409 guard | :97-102 |
| 9 | Intent verify (`getPaymentIntent`) or create+confirm — **money** | :127-149 |
| 10 | `createOrder` — **money** | :152-157 |
| 11 | `reservations.create` | :170-187 |
| 12 | Confirmation email | :214-278 |

- The `tripId: null` write site (PR-5, by design): **:173**.
- The optional-auth block (:48-57) already resolves `user` (`{ id }` or `null`) before the
  body is read — the T2a-era lookup the gate now makes purposeful.
- **Gate insertion point**: after the 400 validation (:70), before GUARD 2 (:75). This
  mirrors liteapi/book's placement (validation → auth resolve → trip gate → cap → provider
  call) and puts the gate before the cap and before EVERY Duffel call in the request —
  `getOffer` at :94 is the first.

## 2. liteapi/book — the gate template (`src/app/api/travel/liteapi/book/route.ts:105-126`)

Comment block :105-109; gate code :110-126, verbatim:

```ts
    let resolvedTripId: string | null = null;
    if (tripId) {
      if (!isAccount) {
        return NextResponse.json(
          { error: 'Sign in to save a booking to a trip.' },
          { status: 401 }
        );
      }
      const trip = await prisma.trips.findFirst({
        where: { id: tripId, userId: user!.id },
        select: { id: true },
      });
      if (!trip) {
        return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
      }
      resolvedTripId = tripId;
    }
```

- 401 copy, exactly: **`Sign in to save a booking to a trip.`** (:114) — reused verbatim.
- Ownership proof: `trips.findFirst({ id: tripId, userId: user.id })` (:118-121), else the
  defensive **404 `Trip not found`** (:123) — never a 403, never confirms existence.
- `resolvedTripId` starts `null`, set ONLY after proof (:110, :125). Absent tripId falls
  straight through — byte-identical standalone behavior.
- Persisted at :174 (`tripId: resolvedTripId`).

## 3. FlightCheckoutPanel (`src/components/trips/FlightCheckoutPanel.tsx`)

- Props (:53-65): `offer`, `passengerCount`, `onClose`, `onBooked?`, `onOfferExpired?` —
  no trip awareness today.
- Book POST body (:186-190): `{ offerId, paymentIntentId, passengers }` — the tripId
  enters here (finalizeOrder), NOT the payment-intent call.
- Payment-intent is created at :151-154 with body `{ offerId: offer.id }` only, BEFORE
  passenger/payment submit. The intent is priced off the offer alone — trip attachment is
  **money-neutral** at intent time, so the payment-intent route needs **0 lines**.
- Flow: form phase → `startPayment()` (:147, the payment entry point) → payment phase
  (Duffel Card component) → `finalizeOrder()` (:177) → `/api/flights/book`.

## 4. PublicFlightSearch (`src/components/trips/PublicFlightSearch.tsx`)

- Props (:23-32) already receive `authed` (:27) and `currentTrip` (:29) from
  ModuleLauncher (mount :727-732 passes both).
- The panel mounts from booking state `{ legId, offer }` (:73, :253-268).
- Threading pattern to mirror — `PublicHotelSearch.tsx:260-262`:
  `tripId={authed === true && currentTrip ? currentTrip.id : undefined}` (+ tripName,
  authed). Guest safety is provable from the component's own props, and the server gate
  401s a guest-with-tripId regardless.

### DECISION — chooser consistency (the task's audit question)

**YES — FlightCheckoutPanel gets the same three-state UI as CheckoutPanel (T2c), reusing
the same fetch-gating logic** (`CheckoutPanel.tsx:130-170`): the state trio
(`myTrips` / `tripsFetch` / `chosenTripId`), the case-(b)-only `/api/trips` fetch
(:142-157), `attachChoicePending` (:162-166), `resolvedTripId` (:170), and the same
tri-valued explicit state (`undefined` = unchosen/held, `null` = explicit "Don't attach",
`string` = chosen).

**One structural divergence, reported before building:** the two panels start payment
differently, so the HOLD attaches to different sites. The hotel panel's payment starts
automatically in an SDK-init effect, so T2c holds via `attachChoicePending` in that
effect's guard (:245). The flight panel's payment starts ONLY from the user-driven
"Continue to payment" button (`startPayment`, :313-320). The minimal honest variant:
`attachChoicePending` disables that button — payment cannot start until the explicit
choice exists. Same semantic (payment held until choice), same state machine, different
hold site because the payment entry points differ. The attach status block renders in the
form AND payment phases so attachment is visible at the moment of payment, never silent.

## 5. reservations.create field map (`flights/book/route.ts:170-187`)

```
userId: user?.id ?? null,          ← unchanged (PR-5)
tripId: null,                      ← THE CHANGE: → resolvedTripId
bookingType: user ? 'account' : 'guest',   ← unchanged (PR-5)
guestEmail: user ? null : (passengers[0]?.email ?? null),  ← unchanged
provider / providerBookingId / providerConfirmationCode / status /
hotelName / checkinDate / checkoutDate / guestCount /
finalPriceCents / currency         ← unchanged
```

**Confirmed: NO bookingType/userId implications.** The gate guarantees a non-null
`resolvedTripId` implies a non-null `user`, and `user` non-null already yields
`bookingType 'account'` + `userId` set (PR-5 logic). A guest can never reach a non-null
`resolvedTripId` (401 first). `resolvedTripId` is `string | null`, exactly the column's
shape — `resolvedTripId ?? null` simplifies to `resolvedTripId`.

## 6. ModuleLauncher trip-strip copy (`src/components/home/ModuleLauncher.tsx:430`)

Before: `— hotel bookings attach to this trip, and saved flights budget into it
(flight-booking attach coming next).`
After (the new truth): `— hotel and flight bookings attach to this trip, and saved
flights budget into it.`

## 0-line surfaces (verified untouched at the end by `git diff --stat`)

- `src/app/api/flights/payment-intent/route.ts` — money-neutral to attachment (§3)
- `src/lib/duffel.ts`
- Hotel lane: `CheckoutPanel.tsx`, `PublicHotelSearch.tsx`, `travel/liteapi/*`
- `/booking/confirm` page
- Email templates (`src/lib/emailTemplates/*`)

## Post-implementation adversarial review (8-agent workflow, findings verified)

Five review dimensions (gate parity, gate-before-money ordering, panel state machine,
prop threading/guest safety, constitution compliance) ran over the uncommitted diff;
every finding was independently challenged. Three survived:

1. **MAJOR — FIXED (panel-only).** A gate 401/404 at finalize time lands AFTER the
   customer's card was charged: the Duffel card component confirms the intent one request
   BEFORE the book POST, so — unlike liteapi/book, whose book request itself performs the
   charge — the mirrored gate is not pre-charge in the panel flow. Reachable when the
   session cookie expires or the chosen trip is deleted between the pick and card success.
   The panel showed a plain retryable error whose 401 copy invites sign-in + a NEW intent
   (second charge). Fix: `finalizeOrder` now treats a 401/404 on an attach-requested
   finalize as the post-charge truth it is — the existing "card charged but booking did
   not finalize… Do not pay again" banner raises instead of the plain error
   (`FlightCheckoutPanel.tsx`, finalizeOrder). The ROUTE is untouched by the fix — its
   gate-before-any-Duffel-call ordering is exactly as prescribed; verifying the intent
   before the gate would spend a provider call on an unauthorized request.
2. **MINOR — reported, not fixed.** If the panel mounts while `authed` is still `null`
   and resolves `true` only after the user reaches the payment phase, the chooser can
   render mid-payment ("payment opens after you choose" above an open card form). The
   T2c hotel template shares this same mount-time gap; a mid-payment pick still rides the
   POST correctly and no pick books unattached — nothing silent, nothing wrong-trip.
   Reachability near zero (requires /api/auth/me unresolved through search + full
   passenger form). Kept for template parity; shared follow-up with T2c.
3. **MINOR — reported, not fixed.** `TravelShowcaseSections.tsx` traceability comments
   cite line numbers into the two shifted files (`flights/book:75`,
   `FlightCheckoutPanel.tsx:206`) that were ALREADY stale pre-diff and drift further.
   Comment-only, verbatim strings unchanged, file deliberately untouched (0-line surface
   discipline). Follow-up documentation fix.

## HARD GATE note (repo constitution)

This change touches auth + sits in a paid-call route. The established plan (the task
prompt) prescribes the exact gate: mirror liteapi/book verbatim, 401/404 copy reused,
gate BEFORE any Duffel call, absent-tripId path byte-identical. This audit is the
confirm/report step; implementation proceeds only on that plan — no validation is
relaxed (the route gains a check, loses none), and the guest path is untouched.
