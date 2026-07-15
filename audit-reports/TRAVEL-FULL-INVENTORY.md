# TRAVEL-FULL-INVENTORY — read-only audit

**Date:** 2026-07-15 · **Branch:** `claude/travel-full-inventory` · **Mode:** READ-ONLY (no code changes, no design)
**Purpose:** the complete map of the real Travel tab — the GUEST SURFACE (the headline: Travel is the one
tab where a non-account visitor gets real functionality), every section authed AND guest, both causal
orders, the vendor booking-reality table, per-section mountability + the try-it ruling — grounding for
the TRAVEL-SHOWCASE deck (Bloomberg template, proven ×7).

Verification method: I read the composition root (ModuleLauncher travel section), middleware,
quota libs, checkout panels, vendor-commit, nomad-budget, ai-assistant gate, tiers, and the registry
firsthand; three parallel read-only sweeps covered the remaining files, and every load-bearing cite
below was re-verified by direct read on `main` (`1a022f0c`).

---

## 0. Entry points

| Surface | Cite |
|---|---|
| Travel tab section (flush block) | `ModuleLauncher.tsx:627-755` |
| renderBody travel branch (trips list/create/budget) | `ModuleLauncher.tsx:383-467` |
| Tab entry `{ key: 'travel', label: 'Travel', icon: Plane }` | `ModuleLauncher.tsx:120` |
| Tab descriptor (verbatim): *"Book your flights, hotels, things to do, and ground transportation — competitive prices, real times, real data."* | `ModuleLauncher.tsx` TAB_DESCRIPTORS travel |
| Module blurb (verbatim): *"AI trip & flight planning — free to use."* | `ModuleLauncher.tsx:98` |
| Guest gate for trip-create | `gateGuestCreate`, `ModuleLauncher.tsx:367-377` |

**⚠️ Existing-copy tensions the deck must NOT repeat** (flagged, not changed — READ-ONLY):
the blurb says "AI trip planning" but the trip scanner is deterministic and AI-free by Places-ToS
design (§5); the descriptor says "Book your flights" but flight booking is TEST-mode-pinned with no
order persistence (§4). Hotel booking is the one genuinely bookable vertical.

---

## 1. THE GUEST SURFACE — what a logged-out visitor can genuinely DO

The homepage `/` is public (`middleware.ts:51`); the Travel tab renders its full stack for guests.
**13 travel routes are in PUBLIC_PATHS** (`middleware.ts:64-87`): flights/search, hotels/search,
hotels/content, hotels/reviews, activities/search, transfers/search, visa/check, locations/countries,
locations/cities, liteapi/prebook, liteapi/book, flights/book, flights/payment-intent. Exact-or-prefix
match (`:90-92`). NOT public: `/api/places/category-search` and `/api/trips/*` (incl. vendor-commit).

### Guest CAN (real vendor calls, no account):
| Action | Wire | Notes |
|---|---|---|
| Search real flights | `PublicFlightSearch.tsx:126` → GET `/api/flights/search` (Duffel) | "Search real flights — free, no account needed." (`:231-232`) |
| Search real hotels | `PublicHotelSearch.tsx:85` → GET `/api/travel/hotels/search` (LiteAPI) | image-rich `HotelResultsView` |
| **Book a hotel as a guest** | `book` (`PublicHotelSearch.tsx:105`, NOT auth-gated, comment `:99-103`) → CheckoutPanel → LiteAPI hosted card SDK → `/api/travel/liteapi/prebook` + `/book` | a REAL guest reservation persists (`bookingType:'guest'`, `guestEmail`, `liteapi/book/route.ts:166-190`); sandbox by default (§4) |
| Pay for a flight (TEST mode) | `bookLeg` → `FlightCheckoutPanel` (`PublicFlightSearch.tsx:251-258`, guest-ok comment `:68-71`) → payment-intent → Duffel card component → `/api/flights/book` | sandbox only; no order persistence (§4) |
| Search activities / transfers | `PublicActivitySearch.tsx:61` / `PublicTransferSearch.tsx:63` → Viator | affiliate URLs stripped server-side (`activities/search/route.ts:80-84`) |
| Check visa rules | `PublicVisaCheck.tsx:77` → `/api/travel/visa/check` (RapidAPI Travel Buddy) | static 51-country dropdowns (`:25-52`); official gov Apply link; no auth prop at all |
| Use the unified destination bar | `ModuleLauncher.tsx:640-679` — validates city+country, bumps `travelSearchNonce` (`:644`); Transfers/Activities/categories re-search on the nonce | "Search once — fill every section below for your destination." (`:650`); flights/hotels deliberately independent (`:639`) |

### Guest CANNOT (register-gated):
- **Create/save a trip** — `gateGuestCreate` opens the register modal before any POST (`ModuleLauncher.tsx:370-377`; `CreateTripForm.tsx:100-101`). Guest branch copy: *"Sign up free to save trips here — tap "+ Create a trip" to start one."* (`ModuleLauncher.tsx:441-443`).
- **Save a flight/hotel to a trip** — `commitLeg` (`PublicFlightSearch.tsx:148`) / `saveToTrip` (`PublicHotelSearch.tsx:122`) call `onRequireAuth()` for guests; authed-no-trip gets *"Pick or create a trip above first, then save this flight/stay to it."* (`:150` / `:124`).
- **"Book" an activity or transfer** — the Book button is a pure sign-up nudge (`PublicActivitySearch.tsx:94`, `PublicTransferSearch.tsx:96`); no booking backend exists for these (affiliate model, §4).
- **Search premium categories** — 6 locked cards (§6); the form + fetch never mount when locked (`PublicCategorySearch.tsx:68-77`) → zero Google spend.

### The cost-safety guards (what makes the public surface safe — and the try-it ruling possible):
Two independent DB-backed guards on every public vendor route, validation between them so a 400
never burns a cap slot:

1. **Per-IP fixed-window rate limit** — `rateLimit.ts` (`rate_limit_hits` table `:65-69`; default 5/60s,
   env `SEARCH_RATE_LIMIT`/`SEARCH_RATE_WINDOW` `:23-24`; 429 + Retry-After `:71-73`).
2. **Durable per-provider daily cap** — `travelSearchQuota.ts`: atomic upsert-increment then throw-over-cap
   (`:93-108`, verified). Safe defaults (`:41-61`, verified): `travelbuddy: 5` (free tier ~120-200/mo),
   `hotelprebook: 100`, `hotelbooking: 25`, `hotelcontent: 500`, `hotelreviews: 500`, `flightbooking: 25`;
   others env → `DEFAULT_DAILY_CAP=1000`. Reserve-only (no release on provider failure — conservative).
   Over-cap responses are honest 503s: *"Flight search is temporarily paused."* etc.
3. **Live-money kill switches** — Duffel live blocked unless `DUFFEL_ALLOW_LIVE_BOOKING==='true'`
   (`flights/book/route.ts:75`, `payment-intent/route.ts:35`, both verified); LiteAPI defaults sandbox
   (`liteapiClient.ts:35-37`, verified); tight hard rate-limits on booking steps (prebook 5/60s, book 3/300s).
4. **Locked premium cards mount no fetch** (`PublicCategorySearch.tsx:68-77`); the auth-gated Google
   category route is additionally cache-first (`category-search/route.ts:153-165`) under a 5k/mo atomic
   monthly cap (`googlePlacesQuota.ts` — `DEFAULT_CAP=5000`, fail-loud).

**Flagged:** no result caching on the public flight/hotel/activity/transfer/visa routes — every guest
search hits the vendor, bounded only by guards 1+2. Stale comment: `hotels/search/route.ts:20` still
says booking is auth-gated; prebook/book are public since PR-G2 (`middleware.ts:79-80`).

---

## 2. THE SEARCH SURFACES PER VERTICAL

| Vertical | Component | Route → vendor | Result view | Result actions |
|---|---|---|---|---|
| Flights | `PublicFlightSearch` (261) | `/api/flights/search` → Duffel offers (top-10 server-side) | `FlightPickerView` (multi-leg, round-trip; manual entry disabled `:242`) | Save-to-trip (auth), Book/pay (guest-ok, TEST) |
| Hotels | `PublicHotelSearch` (266) | `/api/travel/hotels/search` → LiteAPI | `HotelResultsView` (photos, nightly+total, rating) | Book (guest-ok, real), Save-to-trip (auth) |
| Activities | `PublicActivitySearch` (138) | `/api/travel/activities/search` → Viator (`maxResults=12`) | `ActivityResultsView` | Book = sign-up nudge only |
| Transfers | `PublicTransferSearch` (140) | `/api/travel/transfers/search` → **Viator transfer tags 21745+12044** (`transfers/search/route.ts:28-29,69`) — NOT Mozio | `ActivityResultsView` | Book = sign-up nudge only |
| Visa | `PublicVisaCheck` (134) | `/api/travel/visa/check` → RapidAPI "Travel Buddy" (`travelBuddyClient.ts:104-121`) | `VisaResultView` (rule, stay, official Apply link) | none — free public value |
| Premium categories | `PublicCategorySearch` (317) | `/api/places/category-search` → Google Places (auth+entitlement-gated, cached) | list w/ ratings+prices (entitled only) | guest: locked card → checkout (§6) |

Coming-soon rows (static, `ComingSoonSection` — no fetch/state, verified): **Travel insurance**
("Cover your trip — medical, delays, lost bags — priced into your budget."), **Stay connected**
("Get data the moment you land, no hunting for a SIM."), **Events** ("Concerts, shows, and live events
wherever you're headed.") — `ModuleLauncher.tsx:710-721`.

---

## 3. THE TRIP MODEL + THE CROSS-MODULE FEEDS

**Tables** (`prisma/schema.prisma`): `trips` (`:515-564` — name/destination/dates/status
planning→committed, `tripType` personal|business|mixed, lat/lng; `entity_id` **schema-only, unread**
`:545`); `trip_itinerary` (`:646-695` — day/date/time/category/vendor/cost + a staged tz/COA block
`:668-688`); **`budget_line_items`** (`:1050-1075` — the planned-spend spine: `coaCode, year, month,
amount, source 'trip'|'manual'|'recurring'`; `entity_id` schema-only); `trip_expenses`/`expense_splits`
(`:603-644` — separate participant-split system, NOT the budget feeds' source); `reservations` +
`commission_ledger` (hotel bookings); vendor-option tables (`:1850-1944`). All 23 `/api/trips/*` routes
are cookie-auth + `userId`-scoped (ownership `findFirst({ id, userId })`, e.g. vendor-commit `:454`).

**Authed trip UI:** `AllTripsList` (GET `/api/trips` `:89`, select→`currentTrip`, delete `:72`);
`CreateTripForm` (POST `/api/trips` `:107`; **the Travelers selector is collected but never sent**
`:42,110-116` — flag); `TripBudgetActual` (GET `/api/trips/[id]/budget` `:255` — **despite the name
there is NO actual column**: every row is planned, status hardcodes "Saved" `:312-315` (verified),
Project always "—" `:330`; actual reconciliation explicitly lives in Bookkeeping/Plaid, header `:8`).
Empty state: *"Nothing planned yet."* (`:285`).

**The commit spine (vendor-commit):** writes exactly three things — a `budget_line_items` row
(planned), a `trip_itinerary` row, and a `calendar_events` row (`vendor-commit/route.ts:294,364,401-425`,
verified) — **no ledger posting** (its only other Prisma use is lookups). COA map verified:
flight 9100 · lodging 9200 · vehicle 9300 · transfer 9600 · activity 9400 · default 9950
(`vendor-commit/route.ts:11-17,240`).

### FEED 1 — Travel → Runway budgets (`/api/hub/nomad-budget`)
Planned = `budget_line_items` where `source='trip'` ONLY (`nomad-budget/route.ts:89-100`, verified) —
**it does not read routines** (confirms the Routines audit from this side). Actuals = ledger debits on
travel COAs (raw SQL `:125-141`). COA names: **canonical 9xxx** (`:6-20`) + legacy 7xxx fallback
(`:22-32`), reading personal-entity expense codes starting `9` or `7` (`:60-71`).

**⚠️ THE 7xxx/9xxx SPLIT (refines the Routines audit's gap):** the seed chart is 7xxx
(`coaDefaults.ts:42-50`) but the commit spine writes 9xxx (`travelCOA.ts`, vendor-commit map).
`year-calendar` excludes only `startsWith('7')` (`year-calendar/route.ts:45-46`) — so a budgeted
routine on a 7xxx COA surfaces nowhere (both feeds drop it), while one on a 9xxx COA would leak INTO
the homebase table (not excluded) yet still be ignored by nomad-budget. The exclusion boundary no
longer matches the written code range. (Report only — no fix here.)

### FEED 2 — Travel → the calendar
Trips land on HubCalendar as the cyan ✈️ layer (`HubCalendar.tsx:72-74`) — but NOT via a trips API:
`loadCalendar()` fetches `/api/calendar?from&to` and filters `source==='trip'` (`:126-135`), reading the
**`calendar_events`** table that vendor-commit inserted (cyan, per-type icon, `coa_code`,
`budget_amount`, flight-only depart/arrive times — `vendor-commit/route.ts:401-425`, verified). The
insert is try-caught non-fatal (`:426-428`) — a calendar write can fail while the budget line commits
(flag). `/api/hub/trips` separately feeds the map/list with committed trips + total budget.

---

## 4. BOOKING REALITY — what completes end-to-end TODAY (the deck's claim calibration)

| Vendor / vertical | What exists (verified) | Where it STOPS | Deck may claim |
|---|---|---|---|
| **Duffel — flights** | Search + full Duffel Payments checkout: passenger form → `/api/flights/payment-intent` → `client_token` → real `@duffel/components` card element (`FlightCheckoutPanel.tsx:24-30`, dep `package.json`) → server verifies intent → `createOrder` (`flights/book`). Honest "charged but no order" 502 state. | **TEST mode pinned** — live double-flag-blocked (`flights/book:75`, `payment-intent:35`); **no order persistence** — the book route's only Prisma call is the user lookup (verified; `onBooked={() => {/* nothing to persist here */}}` `PublicFlightSearch.tsx:256`); markup stub is a no-op. | "Search real flights" ✓; the checkout exists but is sandbox — NOT "book flights now" |
| **LiteAPI — hotels** | The one complete money+persistence flow: search → prebook (quote) → hosted card SDK (`CheckoutPanel.tsx:34,213`) → book → **`reservations` + `commission_ledger` rows in one transaction** (`liteapi/book/route.ts:166-204`, verified; guest OR account booking, fail-loud if booked-but-not-persisted). | Defaults **sandbox** (`liteapiClient.ts:35-37`, verified; production = `LITEAPI_MODE=production`); **no in-app confirmation email** (no send in the book path — LiteAPI relied on). Daily book cap 25. | "Book a stay — as a guest, no account" is structurally true; mode is an env flip; don't promise our email |
| **Viator — activities** | Search live. "Booking" = **affiliate link-out** to viator.com (pid/mcid, `discover/.../page.tsx:43-47,461-469`; `viatorClient.ts:288`) — route header says so verbatim (`activities/search/route.ts:28`). Public payload strips the URLs (`:80-84`, verified). | No in-app order, ever. On the public tab, Book = sign-up nudge. | "Find real tours & prices" ✓; never "book activities here" |
| **Viator — transfers** | Public "Getting around" search live on Viator transfer tags (verified). | Same affiliate model; the scanner's dedicated Mozio lane is declared NOT connected. | "Find airport rides" ✓ |
| **Google Places — categories** | Category search live (auth+entitlement), cache-first, atomic 5k/mo cap fail-loud (`googlePlacesQuota.ts`). No autocomplete, no Place-Details fan-out. | Paid feature; guest sees locked cards. | "Local picks with ratings and prices — subscribe" ✓ |
| **RapidAPI — visa** | Live check + official apply link, normalized rules (`travelBuddyClient.ts:144-168`). | Data-only. capped 5/day (free tier). | "Check entry rules free" ✓ |
| **Airalo / Mozio / Cover Genius / Events** | Registry: "declared, NOT connected" (`travelSourceRegistry.ts:18-25`, verified); scanner lanes fail-loud 501, never Google-fallback (`:41-47,86-88`); static ComingSoonSection rows. | Not built. | Coming-soon labels only, verbatim |

**Registry doc-drift (flag):** `travelSourceRegistry.ts:21` still labels `liteapi` "declared, NOT
connected" — stale; hotels are live end-to-end. The deck must trust the routes, not that comment.

---

## 5. TRIPPLANNERAI — deterministic, AI-free, gated, and NOT on this tab

- **Mounts on `/budgets/trips/[id]`** (+ discover pages) — NOT on the homepage Travel tab (verified:
  no ModuleLauncher import).
- **AI-FREE by Places-ToS design.** The scan hits `/api/trips/[id]/ai-assistant`, whose header states
  (verbatim, `ai-assistant/route.ts:26-30`, verified): *"per Google Places API terms, Google Places
  data is NOT sent to any AI/LLM. There is no AI step in this pipe — results come straight from
  Google, ranked by a deterministic quality score."* Same guards in `googlePlacesQuota.ts:9-10`,
  `placesSearch.ts:2-4`. (The task's pointer to `TripPlannerAI.tsx:1078` is a conferences-removal
  note; the compliance comments live in the route/libs.)
- **Tier gate:** `requireTier(user.tier, 'tripAI', user.id)` (`ai-assistant/route.ts:137`, verified);
  `tripAI: true` only on `pro_plus` (`tiers.ts:62`, verified) — effectively admin-only today.
- **No `/api/ai/*` trip planner exists** (those routes are meal-plan/cart-plan/market-brief/etc.).
- Source attribution labels in its carousels: "via LiteAPI", "via Viator", "Google · discovery",
  "Mozio (coming soon)", "Airalo (coming soon)", "Cover Genius (coming soon)" (`TripPlannerAI.tsx:1086-1093`).

---

## 6. PREMIUM CATEGORIES — the one paid piece, and its working checkout

- Keys: `GOOGLE_CATEGORY_KEYS` = 9 (`categoryKeys.ts:6-16`, read firsthand); homepage sells 6
  (`HOMEPAGE_PAID_CATEGORIES` `:41-48`): brunch_coffee, dinner, gyms, coworking, sports, groceries
  (nightlife/shopping/festivals deliberately excluded). NOTE: `tab:travel` exists in
  `TAB_ENTITLEMENT_KEYS` (`:23`) but the Travel tab mount has **no lock** (only trade/books/tax/
  compliance lock, `ModuleLauncher.tsx:226-229`) — the tab itself is free; categories are the paid part.
- Locked card (`LockedCategoryCard`, `PublicCategorySearch.tsx:96-155`): 🔒 + *"Subscribe to see
  top-rated <label> with prices."* + **Subscribe to unlock**. Guest → register modal (`:111-114`);
  logged-in → real `POST /api/stripe/checkout-entitlement` → Stripe subscription Checkout Session with
  `{userId, entitlementKey}` metadata (`checkout-entitlement/route.ts:63-71`) → redirect (`:128`).
- Grant is webhook-only: signature-verified, key re-derived from the PAID price id and cross-checked
  against metadata (mismatch → no grant), `grantEntitlement` upserts the row, audit-logged
  (`stripe/webhook/route.ts:134-193`). Admin bypass + fail-loud reads in `entitlements.ts:20-33,47-61`.
- **Caveat:** each key is purchasable only if its `STRIPE_CAT_<KEY>_PRICE_ID` env exists — otherwise a
  deliberate 400 *"not purchasable yet (price not configured)"* (`checkout-entitlement/route.ts:39-44`).
  Code path live; per-key activation is operational.

---

## 7. THE REAL CAUSAL ORDERS

**GUEST journey (all real, no account):**
1. Land on Travel → the full live stack renders (no lock, no teaser).
2. Search flights (Duffel) / hotels (LiteAPI) → real offers with real prices.
3. Set the destination bar once → transfers + activities (+ entitled categories) fan out.
4. Check visa rules → official apply link.
5. **Book a hotel as a guest** (hosted card, real reservation row) — the only vertical that completes.
6. Try to SAVE anything → the register modal (the conversion moment).
7. Premium categories → locked cards → register, then Stripe checkout.

**AUTHED journey (adds persistence):**
1. Create a trip (modal: *"Start a trip and we'll help you plan, book, and budget it"*).
2. Pick it in AllTripsList → `currentTrip`.
3. Search → **Save to trip** → `vendor-commit` writes budget line (9xxx COA) + itinerary row +
   cyan calendar event.
4. `TripBudgetActual` shows the planned ledger per trip; edits PATCH the itinerary.
5. The trip feeds Runway (nomad-budget planned/actuals) and the master calendar (cyan ✈️ layer,
   budget riding on the event).
6. Actuals arrive via Plaid/Books categorization — never auto-posted.

---

## 8. MOUNTABILITY + THE TRY-IT RULING

**The special ruling first — option (a): the deck's live section IS the real guest surface.**
Travel differs from all six prior decks: logged-out visitors already get the REAL product on this tab.
The deck therefore must NOT replace the live stack with mirrors (that would delete real guest
functionality); it adds the narrative frame — dark hero + causal slides ABOVE the live surfaces, the
live surfaces AS the deck's live section (with truth strips), CTA below.

Cost-safety for a live embed is already engineered and cited: per-IP rate limit + durable per-provider
daily caps with honest 503s (§1 guards 1-2, `travelSearchQuota.ts:93-108`), validation-before-reserve,
Duffel TEST pin + LiteAPI sandbox default (§1 guard 3), locked cards mounting no fetch (§1 guard 4).
The deck adds ZERO new fetch paths: it composes the same components ModuleLauncher already mounts
for guests. Deep-link "try it ↓" anchors from slide panels into the live sections (option b) are the
recommended complement. Mirrors only where reality would otherwise mislead (booking panels).

| Section | Ruling | Seam / cites |
|---|---|---|
| PublicFlightSearch / PublicHotelSearch / PublicActivitySearch / PublicTransferSearch / PublicVisaCheck | **DIRECT REUSE — LIVE** (already guest-public + quota-guarded) | components fetch only on user submit (no fetch-on-mount anywhere in them); guards §1 |
| Destination bar | **DIRECT REUSE — LIVE** (deck re-implements the same nonce fan-out or keeps ModuleLauncher's) | `ModuleLauncher.tsx:640-679` |
| Locked premium cards | **DIRECT REUSE — LIVE** (guest-safe: no fetch when locked; checkout CTA real) | `PublicCategorySearch.tsx:68-77,96-155` |
| Trips list / TripBudgetActual / vendor-commit flow | **STATIC MIRROR** (authed-only fetches; guests must see the story) | `AllTripsList.tsx:89`, `TripBudgetActual.tsx:255` |
| Hotel/flight checkout panels | **STATIC MIRROR in slides** (a live mount invites sandbox charges mid-deck; the live sections keep their own real Book buttons — the mirrors just narrate the steps + modes honestly) | `FlightCheckoutPanel.tsx:1-18`, `CheckoutPanel.tsx` |
| Trip-on-calendar (cyan event) | **STATIC MIRROR** with correspondence cites | `vendor-commit/route.ts:401-425`, `HubCalendar.tsx:72-74` |
| TripPlannerAI / trip scan | **STATIC MIRROR only, labeled Pro+** (tier-gated, different page, Places-cost) | §5 |
| ComingSoonSection rows | **DIRECT REUSE** (static by construction) | `ComingSoonSection.tsx` |

**Example-data ruling:** the coherent example trip is the one the Runway deck already seeded —
**"Portland food-truck festival," 3 days, Portland OR, $450 budget** (`RunwayShowcaseSections.tsx:143`,
cyan trip event `ymd(3)→ymd(5)`). Deck slide panels (trip → budget lines → calendar) carry it:
e.g. flight 9100, lodging 9200 committed lines summing with the $450 activity into nomad-budget's
planned column. The LIVE searches need no seed — they are genuinely live. All slide-panel figures
must be declared example data; no invented vendor prices presented as live quotes.

---

## 9. NOT-LIVE / BANNED LIST (zero rendered hits required in the deck)

| # | Banned claim / surface | Why | Cite |
|---|---|---|---|
| 1 | "Book flights now" (real money) | Duffel TEST-pinned, live double-flag-blocked, no order persistence | `flights/book:75`, `payment-intent:35`, no `reservations.create` |
| 2 | "Book activities/transfers here" | affiliate model; public Book = sign-up nudge; authed = viator.com link-out | `activities/search/route.ts:28,80-84` |
| 3 | eSIM / Mozio ground / insurance / events as features | declared NOT connected; fail-loud 501 lanes; static coming-soon rows | `travelSourceRegistry.ts:18-25,86-88` |
| 4 | "AI trip planner" | deterministic, AI-free by Places ToS; the existing blurb's "AI" wording must not carry into the deck | `ai-assistant/route.ts:26-30` |
| 5 | The trip scan as generally available | `requireTier('tripAI')` = pro_plus (admin-only today); different page | `ai-assistant:137`, `tiers.ts:62` |
| 6 | Travelers count persisting | collected, never sent | `CreateTripForm.tsx:42,110-116` |
| 7 | "Booked" status / Project links in the trip budget | hardcoded "Saved"; Project always "—" | `TripBudgetActual.tsx:312-315,330` |
| 8 | Trip spend auto-posting to the books | commit writes budget/itinerary/calendar only; actuals via Plaid/Books | `vendor-commit` (no ledger writes) |
| 9 | In-app booking confirmation emails | none in the book path; LiteAPI relied on | book route (no send) |
| 10 | A Travel subscribe-wall / paid tab | the tab is free (no lock); only the 6 categories are paid, each per-key price-config-dependent | `ModuleLauncher.tsx:226-229`, `checkout-entitlement:39-44` |

**Verbatim strings to carry:** "Search real flights — free, no account needed.", "Getting around —
airport rides & transfers, no account needed.", "Search once — fill every section below for your
destination.", "Sign up free to save trips here…", "Pick or create a trip above first, then save this
flight/stay to it.", "Subscribe to see top-rated <label> with prices.", "Premium categories /
Subscription / Unlock local picks with ratings and prices — subscribe to access.", the coming-soon
explainers (§2), the honest 503 pause strings (§1), "Nothing planned yet.", and the modal subtitle
"Start a trip and we'll help you plan, book, and budget it — sign up free to save it."

---

## 10. Scope of a future TRAVEL-SHOWCASE build (informational, no design here)

Unlike prior decks, the guest Travel tab must KEEP its live stack; the deck wraps it (hero + slides
above, live sections as the live act, CTA below) rather than replacing it. CTA ruling: the tab is
free-with-account for saving — honest "Make my free account"; the premium categories keep their real
"Subscribe to unlock" cards (a real checkout, not a fake wall). No gate/route/lib changes.

---

*READ-ONLY audit. No code changed. Authored for the SOC 2 paper trail; Alex merges.*
