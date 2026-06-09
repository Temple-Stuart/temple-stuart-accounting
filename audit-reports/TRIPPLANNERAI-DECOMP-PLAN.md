# TRIPPLANNERAI-DECOMP-PLAN

**Goal:** decide whether/how `TripPlannerAI.tsx` belongs in the public Travel
showroom, and plan any decomposition. Read-only audit + plan. Every claim cites
`file:line` against `main` @ `45d124ac`. Status: EXISTS · MISSING · REUSABLE ·
RISKS · RECOMMENDATION.

---

## 0. TL;DR

- `TripPlannerAI.tsx` (1485 lines) is a **React context subsystem**, not a component:
  a state/logic hook `useTripScanState` (`:189`), a context `TripScanContext`
  (`:762`), an exported `TripScanProvider` (`:764`), and **5 exported context-consumer
  components** (`TripScanControls` `:796`, `TripApiSection` `:864`, `TripScanModals`
  `:919`, …).
- It owns **13 fetches** including a **REAL LiteAPI hotel book** (`:656`), a **paid AI
  scan** (`:310`), and the **Viator affiliate link** (`bookingUrl`, `:33`).
- **§5 KEY FINDING (safety):** every paid/real-money travel route is **already behind
  cookie auth** (`getVerifiedEmail()` → 401) — LiteAPI book/prebook, vendor-commit,
  and the AI scan (also `requireTier('tripAI')`). **A logged-out visitor cannot fire a
  real booking or paid call** — the routes 401. No standalone security hole found.
- **§3 RECOMMENDATION:** the public showroom does **NOT need TripPlannerAI.** The
  category-card spec (Flight / Hotel / Ground / Activities) is covered by the
  **already-pure pickers** (`FlightPicker` post-T1, `HotelPicker`, `TransferPicker`) +
  a **static category map** + a small **static activities card** + a **static
  itinerary** (`TripTimeline`). Leave the 1485-line subsystem **authed-only**
  (already safe) and build the showroom from the pure pieces. Skip the decomposition.

---

## 1. STRUCTURE (EXISTS)

**File:** `src/components/trips/TripPlannerAI.tsx` (1485 lines).

**The context it provides** = the full return of `useTripScanState(input)` (`:189`),
destructured at `:758`. ~90 members, grouped:

- **Data (~recommendations + scan results):** `recommendations`, `byCategory`,
  `scannerMeta`, `loadingCategories`, `categoryErrors`, `completedCount`,
  `totalCategories`, `loadedPhotos`.
- **Selection / commit state:** `selections`, `editingSelection`, `editForm`,
  `commitCardKey`, `committingCard`, `committedCards`, `cardPrices`, `cardDates`,
  `cardFrequency`, `cardTimes`, `savingVendorOption`.
- **Reserve (booking) state:** `reservingKey`, `reservedKeys` (`:229`).
- **Filter/UI state:** `loading`, `loadingCategory`, `expandedCategory`, `minRating`,
  `minReviews`, `maxPriceLevel`, `perLocationDates`, `showCustomModal`,
  `customCategory`, `customForm`, `customLoading`, `customPreview` (+ all setters).
- **Derived/config:** `tripDays`, `tripActivities`, `activeCity`, `defaultCheckin/out`,
  `checkinVal`, `checkoutVal`, `datesValid`, `tripId`, `city`, `country`, `activity`,
  `activities`, `month`, `year`, `daysTravel`, `tripDates`, `onCommitted`.
- **Actions (~12):** `scanSingleCategory`, `autoScanCategoriesFor`, `rescanAll`,
  `handleSelectItem`, `buildVendorBody`, `confirmSelection`, **`handleCommitCard`**,
  **`handleUncommitCard`**, **`handleLiteApiReserve`** (real book), `fetchUrlPreview`,
  `openCustomModal`, `handleAddCustomItem`.

**Context consumers (each reads `useTripScanCtx()` `:769`):**
- `TripScanControls` (`:796`) — refresh/rescan controls.
- `TripApiSection` (`:864`) — one category section → renders `TravelCarousel`.
- `TripScanModals` (`:919`) — custom-item + commit modals.
- (`SectionCard` `:783`, `SectionFilterBar` `:1187`, `TravelCarousel` `:1292` are
  internal, **props-driven**, do NOT read context.)

**Call sites (authed):**
- `budgets/trips/[id]/page.tsx:9` (import), `:854-884` — the provider tree
  (`<TripScanProvider>` → `<TripScanControls/>` + `<TripApiSection catKey=…/>`×N +
  `<TripScanModals/>`).
- `budgets/trips/[id]/discover/[category]/[rank]/page.tsx` — discover/detail page.
- `src/lib/activities.ts:40` — **comment only**, not an import.

---

## 2. EVERY PAID / REAL-MONEY / EXTERNAL CALL

All fetches live in `useTripScanState` (the hook), exposed via context handlers.

| file:line | route | handler / user action | external |
|---|---|---|---|
| `:250` | GET `/api/trips/[id]/scanner-results` | mount load (`:244`) | — |
| **`:310`** | POST `/api/trips/[id]/ai-assistant` | `scanSingleCategory` (`:305`) — "Scan"/"Rescan" | **PAID AI (Grok), tier 'tripAI'** |
| `:473/483` | POST `/api/trips/[id]/transfers` | `scanSingleCategory` (transfers) | provider search |
| `:494` | POST `/api/trips/[id]/${vendorApi}` | `scanSingleCategory` (vendor search) | provider search |
| `:553/564` | POST `/api/trips/[id]/${vendorApi}`,`/transfers` | `handleCommitCard` (`:523`) — "Add"/"Commit" | write |
| `:573/587` | POST `/api/trips/[id]/vendor-commit` | `handleCommitCard` | budget/itinerary write |
| `:606` | DELETE `/api/trips/[id]/vendor-commit` | `handleUncommitCard` (`:603`) | uncommit |
| **`:636`** | POST `/api/travel/liteapi/prebook` | **`handleLiteApiReserve` (`:623`) — "Reserve"** | **LiteAPI (locks price)** |
| **`:656`** | POST `/api/travel/liteapi/book` | **`handleLiteApiReserve` — "Reserve"** | **LiteAPI — REAL RESERVATION** |
| `:695` | POST `/api/fetch-og` | `fetchUrlPreview` (`:691`) — custom-item URL | OG scrape |

**The LiteAPI BOOK chain (real money):** "Reserve" button (in `TravelCarousel`/
`TripApiSection`, gated on trip dates, `:814`) → `handleLiteApiReserve` (`:623`,
in the hook) → `fetch('/api/travel/liteapi/prebook')` (`:636`) → `fetch('/api/travel/
liteapi/book')` (`:656`). The actual external LiteAPI call is in the **route handler**
(`src/app/api/travel/liteapi/book/route.ts`), not the component — the component only
POSTs the internal route. **Triggered from a child (`TripApiSection`/carousel) via a
context handler defined in the hook.**

**Viator affiliate URL:** `GrokRecommendation.bookingUrl` (`:33`) + `viatorProductCode`
(`:32`); `source === 'viator'` → "via Viator" (`sourceAttribution`, `:1069/1072`). It
is a **stored URL on the recommendation** (returned by the AI scan), rendered as an
external link in the card (`TravelCarousel`, `:1292+`) — opening it navigates the user
to viator.com (affiliate attribution). No paid call fires from us; it is an outbound
link.

**Paid AI:** `/api/trips/[id]/ai-assistant` (`:310`) — the Grok scan that produces the
recommendations. Fired by "Scan"/"Rescan" (`scanSingleCategory`/`rescanAll`).

---

## 3. SHOWROOM FIT — does TripPlannerAI belong on the public page?

**Showroom spec:** a horizontal scroll of category cards (Flight / Hotel / Ground /
Activities = BOOK+BUDGET; all other categories = BUDGET-ONLY) + the travel calendar.

**What provides each:**

| Card | Source today | State |
|---|---|---|
| Flight | `FlightPicker` → `FlightPickerView` (T1) | **pure (post-T1)** |
| Hotel | `HotelPicker.tsx:32` | **already pure** (no fetch) |
| Ground | `TransferPicker.tsx:47` | **already pure** (no fetch, stub) |
| Activities | `TripPlannerAI` `TripApiSection catKey="activities"` | **context subsystem** |
| Itinerary calendar | `TripTimeline.tsx:155` | **near-pure** (1 inline PATCH) |
| Category map (book vs budget-only) | `travelCOA.ts` `vendorApi` (no explicit flag) | **MISSING static map** |

**Honest assessment:** three of the four BOOK cards (Flight / Hotel / Ground) are
**already pure pickers** — they need only demo props + locked callbacks. Only
**Activities** lives inside TripPlannerAI, and the showroom needs only an *example
activity card*, **not** the live Grok scanner, the filter bar, the commit/reserve
flow, or the custom-item modal. A small **static activities card** (a demo
`GrokRecommendation`-shaped item with a locked "book"/"via Viator" button) fully
covers the spec.

**RECOMMENDATION (§3):** **Do NOT put TripPlannerAI in the public showroom.** Build the
Travel showroom from:
1. the **pure pickers** (`FlightPickerView`, `HotelPicker`, `TransferPicker`) fed
   static demo offers + locked buttons → `onRequireAuth`;
2. a **static category map** (the four book cards + the budget-only set) — small new
   seed constant (MISSING today);
3. a **small static activities card** (demo item + locked link) — no scanner;
4. a **static itinerary** via a pure `TripTimelineView` (lift the one PATCH at
   `TripTimeline.tsx:341`).

This avoids decomposing the 1485-line subsystem entirely and keeps the public subtree
genuinely fetch-free + guardrail-clean (no `useContext`).

---

## 4. IF IT MUST BE SHOWROOMED — decomposition options

(Only if a future decision insists on the *live* scanner UI in the demo.)

**Option A — locked context provider.** Render the existing consumer components inside
a NEW static `TripScanContext.Provider` whose value is all demo data + every handler
(esp. `handleLiteApiReserve`, `scanSingleCategory`) → `onRequireAuth`. The real
`TripScanProvider`/hook stay untouched (authed identical).
- **Effort:** medium-high — must construct the full ~90-member value (`:758`) and keep
  it type-compatible with `ReturnType<typeof useTripScanState>`.
- **Risk:** the consumers still call `useContext`; the PR10 guardrail **bans
  `useContext`/`createContext`**, so these files can't enter the static `SUBTREE_FILES`
  — needs a documented carve-out + reliance on the runtime `guardShowroomRender`.
- **Guardrail change:** explicit exception for the demo-provider + consumer files.

**Option B — extract only the presentational pieces for the category card.** Pull
`TravelCarousel` (`:1292`, already props-driven: `items`/`onCardClick`/`isLoading`)
into a pure `TravelCarouselView` (strip any context), feed demo `GrokRecommendation[]`,
lock `onCardClick`. Ignore controls/modals/reserve.
- **Effort:** low-medium — `TravelCarousel` is already mostly pure; mostly verifying
  it reads no context + a demo seed.
- **Risk:** low. Guardrail-clean. **Preferred if any TripPlannerAI UI is wanted.**

**Recommended (if forced):** Option B — atomic steps: (1) `TravelCarousel` → pure
`TravelCarouselView` + demo seed; (2) add to guardrail; (3) drop one locked activities
card into the Travel showroom. Skip Option A unless the live controls/reserve UI is a
hard requirement.

---

## 5. MONEY-PATH SAFETY (route-level auth) — VERIFIED

Every paid/real-money travel route checks cookie auth and 401s when absent:

| Route | Auth | Cite |
|---|---|---|
| `POST /api/travel/liteapi/book` (real book) | `getVerifiedEmail()` → 401 | `book/route.ts:39,41` |
| `POST /api/travel/liteapi/prebook` | `getVerifiedEmail()` → 401 | `prebook/route.ts:15,17` |
| `POST /api/trips/[id]/ai-assistant` (paid AI) | `getVerifiedEmail()` → 401 **+ `requireTier(user.tier,'tripAI')`** | `ai-assistant/route.ts:128,130,135` |
| `POST/DELETE /api/trips/[id]/vendor-commit` | `getVerifiedEmail()` → 401 | `vendor-commit/route.ts:82,83` |

**FINDING:** **No missing-auth hole.** A logged-out visitor hitting any of these gets
401 — **a real LiteAPI booking or paid AI scan cannot fire unauthenticated**, even if
the UI somehow issued the request. The worst-case failure of the whole showroom project
(a real reservation from the public page) is **already blocked server-side**. The Viator
`bookingUrl` is an outbound affiliate link (no paid call on our side); lock it in any
demo only to avoid sending guests off-site.

(Defense-in-depth still wants the showroom UI to be fetch-free + locked — so it doesn't
*attempt* 401-ing calls or look broken — but there is no money risk for logged-out
users today.)

---

## EXISTS | MISSING | REUSABLE | RISKS

- **EXISTS:** TripPlannerAI context subsystem (authed, `budgets/trips/[id]`); pure
  pickers (`HotelPicker`, `TransferPicker`; `FlightPickerView` post-T1); near-pure
  `TripTimeline`; route-level auth on all paid travel routes.
- **MISSING:** a static **book-vs-budget category map** for the showroom; a pure
  `TripTimelineView` (one PATCH to lift); a Travel demo seed; (optional) a pure
  `TravelCarouselView`.
- **REUSABLE:** `TravelCarousel`/`SectionFilterBar`/`SectionCard` + pure helpers
  (`calcTotal`, `sourceAttribution`, `filterRecs`, `sortRecs`); `makeLockedHandlers` +
  `guardShowroomRender` + the PR10 guardrail; the demo-seed/narrative-copy pattern.
- **RISKS:** Option A's `useContext` vs the guardrail; the ~90-member context value;
  both authed pages if prop-ifying. The paid AI scan + real book are the calls to keep
  locked in any demo (already 401-gated server-side).

---

## RECOMMENDATION

**Smallest safe path to (a) the Travel showroom spec and (b) guaranteed no paid travel
call fires unauthenticated:**

1. **Build the Travel showroom WITHOUT TripPlannerAI.** Compose the category cards from
   the **pure pickers** (`FlightPickerView`, `HotelPicker`, `TransferPicker`) fed static
   demo offers + locked buttons (`onRequireAuth`), a **static category map** (the four
   BOOK cards + the budget-only list), a **small static activities card** (demo item +
   locked link — no scanner), and a **static itinerary** (`TripTimelineView`, after
   lifting the one PATCH). All fetch-free, guardrail-clean.
2. **Leave `TripPlannerAI` authed-only** and unchanged. Its money paths are **already
   route-auth-gated** (§5) — a logged-out visitor cannot trigger a booking or paid AI.
3. **No decomposition of TripPlannerAI is required** for the showroom. Only revisit
   Option B (`TravelCarousel` → pure view) if a future decision wants the live scanner
   look on the public page — and even then, keep the scan/reserve handlers locked.

Net: the public Travel showroom is achievable from already-pure pieces + small static
seeds; the 1485-line subsystem stays where it is, and the catastrophic case (a real
hotel booking from the public page) is already impossible for logged-out users.
