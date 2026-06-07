# Travel Commission Engine — Readiness Audit (READ-ONLY)

**Date:** 2026-06-07
**Branch:** `claude/audit-travel-commission-engine`
**Scope:** Read-only. No application code was modified. The only file created is this report.
**Method:** Every claim cites `file:line`. Anything not read is marked **NOT VERIFIED**.

> ⚠️ **Naming discrepancy (read this first).** The task brief names the hotel provider
> **realtyapi.io**. The codebase contains **no** reference to realtyapi
> (`grep -ri "realtyapi" src/` → 0 hits). The accommodation provider that is actually
> wired is **LiteAPI** (`src/lib/liteapiClient.ts`). This audit reports on LiteAPI as the
> live accommodation integration. If realtyapi.io is a separate intended provider, it is
> **MISSING** entirely.

---

## A. EXISTS — verified (file + line)

### A.1 Provider integration inventory

| Provider | Category | Client / route | Pipeline reached | Auth |
|---|---|---|---|---|
| **LiteAPI** (hotels) | `accommodation` | `src/lib/liteapiClient.ts`; scan in `ai-assistant/route.ts:216-301`; `prebook/route.ts`; `book/route.ts` | search → detail → prebook → book → **reservation + commission row** | ✅ all gated |
| **Duffel** (flights) | `flights` | `src/lib/duffel.ts`; `flights/search/route.ts`; `flights/book/route.ts` | search → book (Duffel order) — **no reservation/commission row** | ✅ |
| **Viator** (activities) | `activities` + 4 legacy | `src/lib/viatorClient.ts`; scan in `ai-assistant/route.ts:304-367` | search → **affiliate redirect URL** only; no in-app booking | ✅ |
| **Mozio** (ground transit) | `ground_transport` | none | **MISSING** — registry stub only → 501 | n/a |
| **Google Places** | discovery cats | `src/lib/placesSearch.ts`, `placesCache.ts`, `places/photo/route.ts`, `places/usage/route.ts` | discovery (non-bookable) | ✅ |

#### LiteAPI (accommodation) — FULL booking spine exists

- Client: `src/lib/liteapiClient.ts` (838 lines). Hosts at `:22-23`.
- Key read: `getApiKey()` reads `LITEAPI_PRODUCTION_KEY` / `LITEAPI_SANDBOX_KEY` by mode `:39-46`; mode from `LITEAPI_MODE` `:35-37`.
- **Search:** `searchHotelRates()` POSTs `/hotels/rates` `:201-314`. Mapper `liteApiHotelToRecommendation()` `:466-...`.
- **Search invoked:** `ai-assistant/route.ts:268-273` (dispatched via registry, `:216`).
- **Prebook:** `src/app/api/travel/liteapi/prebook/route.ts:51-57` → `prebookRate()`.
- **Book:** `src/app/api/travel/liteapi/book/route.ts:101-106` → `bookRate()`.
- **Commission/affiliate tracking:** booking persists a `reservations` row (`book/route.ts:141-157`) **and** a `commission_ledger` row with `status:'estimated'` (`book/route.ts:161-171`), atomically (`:140`).
- **UI booking island:** `ReserveHotelButton.tsx:27-71` runs prebook→book.

#### Duffel (flights) — search + book, but no commission persistence

- Client: `src/lib/duffel.ts`. Token: `DUFFEL_API_TOKEN` `:2`; header `:8-12`.
- Search: `flights/search/route.ts:6-...` (GET). Book: `flights/book/route.ts:6-70` → `createOrder()` `:45-49`.
- Payment uses Duffel **balance** (`type:'balance'`, `flights/book/route.ts:46`).
- **No `reservations`/`commission_ledger` write in the flight book path** (verified: `grep` for those tables hits only `liteapi/book/route.ts`). See **B.2**.

#### Viator (activities) — search + affiliate link only

- Client: `src/lib/viatorClient.ts`. Key: `VIATOR_API_KEY` `:15`.
- Affiliate URL hardcoded: `VIATOR_PARTNER_ID = 'P00294427'` `:239`, `VIATOR_MCID = '42383'` `:240`, builder `buildAffiliateUrl()` `:242-244`.
- Booking action is an outbound link only: `discover/.../page.tsx:43-48` (`Book on Viator`), and inline fallback `TripPlannerAI`/`page.tsx:46`.
- No in-app checkout, no `reservations`/`commission_ledger` write for Viator.

### A.2 Data model (schema.prisma)

- `trips` `:515-559` — has `startDate`/`endDate`/`committedAt`/`tripType`; relations include `itinerary`, `scannerResults`, `reservations` (`:546,553,554`).
- `trip_itinerary` `:641-667` — columns: `day`, `homeDate`, `homeTime` (`VarChar(10)`), `destDate`, `destTime`, `category`, `vendor`, `cost`, `note`, `location`, `vendorOptionId`, `vendorOptionType` `:642-661`. **No `duration`/`time_block` field.**
- `trip_scanner_results` `:1793-1811` — `@@unique([tripId, destination, category])` `:1808`; `recommendations Json` `:1798` (per-destination rec arrays; `valueRank` lives inside the JSON).
- `trip_destinations` `:698-714` — **no `startDate`/`endDate`** (confirms the per-leg-date stopgap, see B/D).
- `budget_line_items` `:1022-1043` — `coaCode`, `year`, `month`, `amount`, `description`, `source` ('trip'|'manual'|'recurring' per comment `:1033`).
- `reservations` `:1100-1125` — `userId`, `tripId`, `provider`, `providerBookingId`, `status`, `hotelName`, `checkin/checkoutDate`, `finalPriceCents`, `currency`, `cancellationPolicyJson`; relation `commission_ledger[]` `:1120`.
- `commission_ledger` `:1132-1151` — `reservationId`, `provider`, `grossAmountCents`, `commissionAmountCents`, `status` ('estimated'|'confirmed'|'paid'), `payoutDate`, `providerInvoiceRef`.

### A.3 Booking → bookkeeping link

- **Vendor/place commit** (`vendor-commit/route.ts:147-274`) atomically creates a `budget_line_items` row (`:207-218`) **and** `trip_itinerary` rows (`:230-271`) **and** a `calendar_events` row (`:286-289`). This is the "commit → budgeted expense" spine.
- COA mapping `VENDOR_TYPE_TO_COA` `vendor-commit/route.ts:9-15`; per-category COA via `getCOACode()` `:173`.
- **However:** the LiteAPI **`book` path does NOT create a `budget_line_items`/`trip_itinerary` expense** — only `reservations` + `commission_ledger` (`liteapi/book/route.ts:141-171`). The budgeted-expense write for hotels happens on the **separate** "Add to trip" synthetic-lodging commit (`AddToTripButton` → `vendor-commit` synthetic lodging, `vendor-commit/route.ts:96,151-152`). So "book a hotel" and "budget the hotel" are **two independent user actions**, not one auto-flow. No code auto-creates a recurring/routine expense from a booking (see **B.3**).

---

## B. MISSING — with grep evidence

### B.1 Mozio (ground transit) — fully MISSING (expected)
- `grep -ri "mozio" src/` → matches only in: `travelSourceRegistry.ts:22,86` (declared, not connected), `travelErrors.ts:2` (comment), `ai-assistant/route.ts` (error mapping), `discover/.../page.tsx:426-430` ("Mozio not connected yet — coming soon"), `TripPlannerAI.tsx` (comment).
- No client file, no API route, no env var. `ground_transport` routes to `mozio` `travelSourceRegistry.ts:86` and throws `UnimplementedSourceError` → **501** (`ai-assistant/route.ts:208-212, 495-503`).

### B.2 Flight (Duffel) commission/reservation persistence — MISSING
- `grep -rn "reservations.create\|commission_ledger.create" src/` → only `liteapi/book/route.ts:141,161`. The Duffel `flights/book/route.ts` returns the order (`:51-62`) but writes **nothing** to `reservations` or `commission_ledger`. Flights earn no tracked commission today.

### B.3 Booking-triggered routine/budget expense automation — MISSING
- No code creates a "budgeted routine expense" as a side-effect of a booking. The hotel `book` path writes only reservation+commission (`liteapi/book/route.ts:139-174`). Budget rows come from the manual commit path (`vendor-commit/route.ts`), which is a distinct action. **NOT VERIFIED** that any auto-link exists; grep for a book→budget call found none.

### B.4 Booking-confirmation webhook handler — MISSING
- `find src/app/api -type d -name "webhook*"` → only `src/app/api/stripe/webhook`. No LiteAPI / Duffel / Viator webhook route. Commission rows stay `status:'estimated'` with no reconciliation; the code comment acknowledges this: `liteapi/book/route.ts:159-160` ("flipped to 'confirmed' by a later reconciliation/webhook PR").

### B.5 realtyapi.io — MISSING
- `grep -ri "realtyapi" src/` → 0 hits. See top-of-report discrepancy note.

### B.6 Public travel surface on the home page — MISSING
- Home page `src/app/page.tsx` is a marketing landing page; the travel module is described in `src/components/sections/ModulesSection.tsx:241-250` but exposes **no live travel feature** (no search/affiliate widget). All travel functionality lives under auth-gated `/budgets/trips/*` and `/trips/*`. There is no guest-usable affiliate surface today.

---

## C. REUSABLE — fits with zero/trivial change (cited)

- **`requireTier()` feature-gating** (`src/lib/auth-helpers.ts:41-49`) gates a route by tier+feature; already used for travel AI (`ai-assistant/route.ts:135-136`, feature `'tripAI'`). Reusable for "auth'd users trigger paid Google calls," but it gates by **tier**, not guest-vs-auth — the guest/auth boundary is `middleware.ts` `PUBLIC_PATHS` + `getVerifiedEmail()`.
- **`getVerifiedEmail()` / `getCurrentUser()`** (`auth-helpers.ts:10-20`, `cookie-auth`) — the consistent per-route auth primitive; every travel route already uses it (see E).
- **Source registry swap point** (`travelSourceRegistry.ts:51-117`) — adding a provider or flipping a category's source is a single-table edit; the carousel reads source per-category with no render change (`TripPlannerAI.tsx:876-879`).
- **Commit→budget→calendar spine** (`vendor-commit/route.ts:147-292`) — already produces a budgeted expense + itinerary + calendar event from any committed item; reusable as the booking→bookkeeping bridge once a book path calls it.
- **`reservations` + `commission_ledger` models** (`schema.prisma:1100-1151`) are provider-agnostic (`provider VarChar`), so Duffel/Viator/Mozio can reuse them as-is.

### C.1 Operations day-timeline reuse — NEEDS-ADAPTER (not reusable as-is)
- The Operations day-timeline lives under `src/components/workbench/operations/` (e.g. `content/useDayFeed.ts`, `DayCalendar` per recent commits `6f29b529`/`87eb4c4e`). **The audit did NOT fully read these CE-8B components — treat their internal prop shapes as NOT VERIFIED.**
- Data-shape gap is verifiable from the travel side: `trip_itinerary` (`schema.prisma:641-667`) carries `day` (int) + `homeTime`/`destTime` (free-text `VarChar(10)`, nullable) + `cost`, but **no `duration` and no normalized `time_block_start`**. A day-timeline that expects start+duration blocks would need an adapter to derive duration (and to handle null times). → **NEEDS-ADAPTER**, based on the cited itinerary columns.

---

## D. BUG TRACES

### D.1 "No accommodation found" (hotel search)

**Exact emit point:** `TripPlannerAI.tsx:1340` — `No {label.toLowerCase()} found for this destination.` Rendered when `items.length === 0` (`:1337`) for the accommodation carousel. (The literal string is composed from the category label; there is no hard-coded "No accommodation found" string — `grep` confirms.)

**Important distinction:** this message renders **only on HTTP 200 with an empty `recommendations` array**. A missing key or API error does **not** reach it — those set `categoryErrors[...]` and render the red banner (`TripPlannerAI.tsx:319-322`, `:360-363`), because the route maps them to 500/502 (`ai-assistant/route.ts:481-494`). So if the live symptom is literally the dashed "No accommodation found" box, the LiteAPI call **succeeded and returned zero hotels**.

**End-to-end path:**
1. UI scan → `scanSingleCategory()` POST `/ai-assistant` `TripPlannerAI.tsx:305-326`.
2. Route auth + dispatch → `source==='liteapi'` `ai-assistant/route.ts:216`.
3. Dates: per-location if set, else **7-night stopgap from `trip.startDate`** `ai-assistant/route.ts:247-259`.
4. Coords: `findDestinationCoords(city,country)` `:265`; coord-radius vs cityName chosen in `searchHotelRates` `liteapiClient.ts:208-236`.
5. Provider call: POST `/hotels/rates` `liteapiClient.ts:244-258`.
6. Parse: `rateItems = data.data || []` `liteapiClient.ts:284`; merge with `data.hotels` `:285-310`.
7. Map/sort/persist `ai-assistant/route.ts:275-293`; empty array is persisted and returned (200).

**Candidate causes, ranked by evidence:**

1. **Sandbox inventory / mode (strongest).** Default mode is `sandbox` unless `LITEAPI_MODE==='production'` (`liteapiClient.ts:35-37`). LiteAPI sandbox has sparse inventory; a real city+date that has zero sandbox properties returns `data.data=[]` → 200 empty → "No accommodation found." Evidence: explicit mode default `:36`; the PR-20 raw-count log distinguishes this at runtime (`liteapiClient.ts:264`) — `dataLen=0` confirms upstream-empty. *Alex must check Vercel logs for `[LiteAPI] rates raw: dataLen=...`.*

2. **Stale/past dates.** When per-location dates are unset, search uses `trip.startDate + 7` (`:251-258`). If `trip.startDate` is in the past, LiteAPI returns nothing for past check-in → empty. Evidence: stopgap block `ai-assistant/route.ts:250-259`; no guard that check-in is in the future.

3. **Response-shape mismatch.** Parser assumes rates under `data.data` and metadata under `data.hotels` (`liteapiClient.ts:279-289`). The retained PR-7 diagnostic log (`:271-277`) and the `id`-vs-`hotelId` hedge (`:286-288`) show the shape was **never fully confirmed**. If production returns a different envelope, `rateItems=[]` → empty. Evidence: diagnostic comment `:266-277`.

4. **Coord-radius miss.** With catalog coords, a 25 km radius search (`liteapiClient.ts:209`) around a coordinate that doesn't match sandbox properties returns empty, where a cityName search might not. Evidence: branch `:208-236`.

5. **Country not mapped (would NOT show this message).** `countryNameToIso2` throws `LiteApiError` on unknown country (`liteapiClient.ts:95-103`) → 502 banner, not the empty box. Listed only to exclude it.

**Swallowed-exception / silent-fallback check:** The hotel path is **clean** — it re-throws on error and never falls back to Google (`ai-assistant/route.ts:294-300`, comment `:295-297`). The only swallowed exception is the **results-persistence** `upsert` (`:289-291`), which is non-fatal and does not affect what the user sees. No mandate violation in the hotel path.

### D.2 Itinerary name-mismatch (commit shows a different name)

**Two commit paths exist:**
- **(P-A) Detail-page commit** — card → `/budgets/trips/[id]/discover/[category]/[rank]` → `PlaceCommitForm` (Google) / `AddToTripButton` (hotel).
- **(P-B) Inline carousel commit** — `handleCommitCard()` `TripPlannerAI.tsx:522-601`.

**Where identity is established and can diverge:**

1. **`valueRank` is not globally unique — detail page resolves the wrong rec (STRONGEST, structural).**
   - Card click routes by **`rec.valueRank`** only: `idForRoute = String(rec.valueRank ?? 0)` `TripPlannerAI.tsx:889-891`.
   - The detail page finds the rec by `(tripId, category, valueRank)`, **ignoring destination**: query `where:{tripId, category}` `discover/.../page.tsx:129-132`, then `recs.find(r => r.valueRank === wantedRank)` across all rows, taking the first match by `updatedAt desc` `:135-143`.
   - But `valueRank` is assigned **per (destination, category)** — `1..N` within each scan (`ai-assistant/route.ts:279` and `:422`), and rows are keyed `@@unique([tripId, destination, category])` (`schema.prisma:1808`).
   - **Consequence:** on a multi-destination trip with the same category scanned in ≥2 destinations, `valueRank` collides. Clicking rank 3 in destination A resolves to rank 3 of whichever destination row was updated most recently — a **different place with a different name**. The wrong name then flows into the commit (`PlaceCommitForm placeName={rec.name}` `page.tsx:471` / `AddToTripButton hotelName={rec.name}` `:451`) and is stored as `vendor`/`description` (`vendor-commit/route.ts:215,264`). **This matches "selected a cafe, committed a different name."**

2. **Stale client cache after re-scan (secondary).** A re-scan upserts the same `(tripId,destination,category)` row with **new** `recommendations` and re-assigned `valueRank`s (`ai-assistant/route.ts:284-288`). If the client carousel still shows the pre-rescan order in memory, clicking an old `valueRank` resolves on the server to the **new** rec now occupying that rank → different name. Evidence: server resolves live from DB (`page.tsx:129-143`); client state is populated separately on mount (`TripPlannerAI.tsx:250`).

3. **`valueRank ?? 0` fallback (edge).** If a rec lacks `valueRank`, the route becomes `.../0` (`TripPlannerAI.tsx:890`); the detail page then matches the first rec with `valueRank===0` or `notFound()`. Low likelihood (all three sources assign `valueRank`), listed for completeness.

**Ruled out:** the inline carousel path (P-B) passes `rec.name` directly into the created option (`TripPlannerAI.tsx:544-551`) and commits by the returned `optionId`; `vendor-commit` reads the name back from that row (`vendor-commit/route.ts:41-45`). No index indirection there — so the mismatch is specific to the **detail-page `valueRank` resolution** (P-A).

**Read-back for display:** committed names are read from `trip_itinerary.vendor` / `budget_line_items.description`, both set to `details.title` (`vendor-commit/route.ts:215,234,247,264`). The mismatch originates upstream at rec-resolution, not at read-back.

---

## E. SECURITY FLAGS

**No CRITICAL unauthenticated paid-API route found.** Every travel/paid route verifies auth before any external call:

| Route | Auth line |
|---|---|
| `flights/search/route.ts` | `getVerifiedEmail()` `:8-10` |
| `flights/book/route.ts` | `:8-10` (+ user lookup `:12-17`) |
| `travel/liteapi/prebook/route.ts` | `:15-17` (+ user `:19-25`, ownership `:43-49`) |
| `travel/liteapi/book/route.ts` | `:39-41` (+ user `:43-49`, ownership `:90-96`) |
| `places/photo/route.ts` | `:15-17` before reading `GOOGLE_PLACES_API_KEY` `:20` |
| `places/usage/route.ts` | `:8-10` |
| `trips/[id]/ai-assistant/route.ts` | `getVerifiedEmail()` `:128-130` + `requireTier(...,'tripAI')` `:135-136` |
| `trips/[id]/vendor-commit/route.ts` | `:81-86` (auth + user + trip ownership) |
| `discover/[category]/[rank]/page.tsx` | `getVerifiedEmail()` + ownership `:109-123` before the PAID `getHotelContent`/`getHotelReviews` calls `:163,225` |

**Middleware** (`src/middleware.ts:50-64`) `PUBLIC_PATHS` = `/`, `/admin`, `/api/admin/verify`, `/api/admin/users`, `/api/auth`, `/_next`, `/favicon.ico`, `/pricing`, `/api/stripe/webhook`, `/api/inngest`, `/opengraph-image`, `/terms`, `/privacy`. **No travel route is public.** (Note for follow-up, out of travel scope: `/admin`, `/api/admin/verify`, `/api/admin/users` are public in `PUBLIC_PATHS` — not a travel issue, flagged only in passing.)

**Implication for the planned public surface:** because there is currently no public travel route, building a guest-usable section will require adding entries to `PUBLIC_PATHS` and/or new public routes. Any such route that calls Google/LiteAPI/Viator/Duffel **with a key** must keep auth — only key-less affiliate **links** are safe to expose to guests.

---

## F. ALEX-SIDE CHECKS

**Env var NAMES the code reads (verify they are SET in Vercel/local — values never printed here):**

| Var | Read at | Notes |
|---|---|---|
| `LITEAPI_SANDBOX_KEY` | `liteapiClient.ts:43` | used when `LITEAPI_MODE!=='production'` (default) |
| `LITEAPI_PRODUCTION_KEY` | `liteapiClient.ts:42` | empty placeholder in `.env.example:72` |
| `LITEAPI_MODE` | `liteapiClient.ts:36` | `sandbox` unless set to `production` — **likely why hotels return empty** |
| `DUFFEL_API_TOKEN` | `duffel.ts:2` | flights |
| `VIATOR_API_KEY` | `viatorClient.ts:15`, `ai-assistant/route.ts:305` | **NOT documented in `.env.example`** — add it |
| `GOOGLE_PLACES_API_KEY` | `placesSearch.ts:71,207`, `places/photo/route.ts:20`, `commit/route.ts:138` | discovery (paid) |
| `GOOGLE_PLACES_MONTHLY_CAP` | `googlePlacesQuota.ts:28` | spend guard |
| `JWT_SECRET` | `middleware.ts:10` | cookie HMAC |

**psql queries Alex can run (auditor cannot reach the DB):**

```sql
-- Was accommodation ever scanned, and did it return rows? (D.1)
SELECT destination, jsonb_array_length(recommendations) AS n, "updatedAt"
FROM trip_scanner_results
WHERE category = 'accommodation'
ORDER BY "updatedAt" DESC LIMIT 20;

-- valueRank collisions across destinations for one trip+category (D.2 #1)
SELECT destination, category, jsonb_array_length(recommendations) AS n
FROM trip_scanner_results
WHERE "tripId" = '<TRIP_ID>'
ORDER BY category, destination;

-- Are any commissions being recorded, and in what state? (commission readiness)
SELECT provider, status, count(*), sum("commissionAmountCents") AS cents
FROM commission_ledger GROUP BY provider, status;

-- Reservations written by the booking flow
SELECT provider, status, count(*) FROM reservations GROUP BY provider, status;
```

**Vercel-log greps Alex can run for the empty-hotel bug (D.1):**
- `[LiteAPI] mode=` / `keyPrefix=` (`liteapiClient.ts:241`) — confirms sandbox vs production and that a key is present.
- `[LiteAPI] rates http: status=` (`:254`) and `[LiteAPI] rates raw: dataLen=` (`:264`) — `dataLen=0` on a 2xx = upstream-empty (sandbox/dates), not a key/mode fault.

---

## G. SUGGESTIONS (not verified needs)

These are auditor opinions, not confirmed requirements:

1. **D.2 fix direction:** make the detail-page rec lookup destination-aware — route by `(category, destination, valueRank)` or by a stable per-rec ID rather than `valueRank` alone (`discover/.../page.tsx:129-143`, `TripPlannerAI.tsx:889-891`). A stable identifier per recommendation (e.g. Google `placeId`, Viator `productCode`, LiteAPI `hotelId`) persisted as the route key would eliminate index ambiguity.
2. **D.1 triage:** flip `LITEAPI_MODE=production` (with a real production key) before concluding the parser is wrong; the empty result is most cheaply explained by sandbox inventory. Add a future-date guard so a past `trip.startDate` doesn't silently produce empty searches.
3. **Flights commission gap (B.2):** route Duffel `flights/book` through the same `reservations`+`commission_ledger` write the hotel path uses, so flight bookings are tracked.
4. **Booking-confirmation webhooks (B.4):** add provider webhook handlers (mirroring `api/stripe/webhook`) to walk `commission_ledger.status` from `estimated`→`confirmed`→`paid`.
5. **Day-timeline (C.1):** before reusing the Operations timeline, read the CE-8B components' prop shapes and decide whether to add a `duration`/`time_block_start` column to `trip_itinerary` vs. building an adapter that derives them from `homeTime`/`destTime`.
6. **Public surface (B.6, E):** expose only key-less Viator affiliate links to guests; keep every keyed Google/LiteAPI/Duffel call behind `getVerifiedEmail()`. Reuse `requireTier` for paid-tier gating once the guest boundary is set in `PUBLIC_PATHS`.
7. **Resolve the realtyapi.io vs LiteAPI naming** in the brief so future work targets the right provider.

---

*End of audit. No application code was modified; only this report was created.*
