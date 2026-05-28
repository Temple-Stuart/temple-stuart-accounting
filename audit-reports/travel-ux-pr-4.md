# Travel-UX-PR-4 — Airbnb-style auto-load carousels + per-source detail pages + Brunch fix

Branch: `claude/travel-ux-pr-4`. Stack: built on main (PR-1 + PR-2 + PR-3 +
PR-3b all live). The trip planner section now mirrors how real travel sites
present a fixed destination: open the page → content auto-populates → click
→ detail → Reserve/Book per source's honest action.

> **Scope honesty:** PR-4 delivers the auto-load orchestration, the carousel
> grid, the detail page, the Brunch fix, and honest per-source actions. The
> sandbox booking flow stays as-is (PR-3b's transactionId passthrough) with
> an in-UI disclaimer. The LiteAPI hosted-checkout payment SDK render is
> **deferred to PR-4b** — flagged below in the report and in the UI.

---

## 1. Removed UI (cited)

`src/components/trips/TripPlannerAI.tsx`:

- **Search-button + filters row** (was lines 713-745): the "Min Rating /
  Min Reviews / Max Price / Sort by" select row + the `<Button
  onClick={searchDestination}>` "Search Bali" button. Replaced with a
  compact trip-context header (city · dates · refresh).
- **Page-wide loading splash** (was 749-764): the centered spinner +
  "Searching {city}…" + progress bar. Replaced with per-carousel skeleton
  rows + a tiny `"Loading N of M…"` indicator in the header.
- **Vertical accordion render** (was 837-1067, ~230 lines): the
  `{Object.keys(byCategory).sort(...).map(cat => <accordion>…</accordion>)}`
  block + its expand/collapse state + per-card inline Commit panels.
  Replaced with horizontal scroll carousels.
- **"Search a destination" empty state** (was 1069-1074): no longer needed
  — each carousel renders its own empty state.

The state declarations for filter inputs (`minRating`, `minReviews`,
`maxPriceLevel`, `sortBy`) and the legacy handlers (`handleCommitCard`,
`handleUncommitCard`, `handleLiteApiReserve`, etc.) stay in the file for now
— their values still flow through the API (defaults: 4.0 / 50 / Any / rating)
and the commit modals/handlers will be reused by a follow-up that moves
the Commit/Reserve flow into the detail page. These show up as lint
warnings (29 unused-warnings, **0 new errors** — see §8).

---

## 2. Auto-load orchestration (cited)

Mount effect at `TripPlannerAI.tsx:200-242`:

```ts
useEffect(() => {
  const loadSavedThenAutoScan = async () => {
    // 1. Hydrate from persisted trip_scanner_results (PR-3 cache + 7-day TTL).
    // Repeat opens see content immediately, no upstream calls.
    const loaded: Record<string, GrokRecommendation[]> = {};
    /* fetch /api/trips/{id}/scanner-results → loaded */

    // 2. Auto-scan ONLY the categories not already cached.
    const activeCoaKeys = getActiveScanCategories([], '');
    const missing = activeCoaKeys.filter(k => !(k in loaded));
    if (missing.length === 0) return;
    await autoScanCategoriesFor(missing);
  };
  loadSavedThenAutoScan();
}, [tripId, city, country]);
```

`autoScanCategoriesFor(keys)` at `TripPlannerAI.tsx:275-323`:

```ts
await Promise.allSettled(
  categoriesToScan.map(async ({ key: cat, label, maxResults }) => {
    try {
      const items = await scanSingleCategory(cat, label, maxResults);
      setByCategory(prev => ({ ...prev, [cat]: items }));
      // ...also clear the category's error if one was previously set
    } catch (err) {
      setCategoryErrors(prev => ({ ...prev, [cat]: err.message }));
    } finally {
      setLoadingCategories(prev => { /* delete cat */ });
    }
  })
);
```

**Per-category isolation, NOT loud-fail-fast.** One category's typed error
(e.g. Brunch's `INVALID_REQUEST`, LiteAPI's `MissingLiteApiKeyError`)
populates `categoryErrors[cat]` and renders an inline banner in that
carousel slot — **all other categories continue to load and display.**

Why per-category here vs PR-1's loud-fail-fast: the locked UX is a fixed
trip page where the user expects to see content immediately. With ~13
parallel category scans, one bad config (say `VIATOR_API_KEY` unset)
shouldn't blank the page. The error is still surfaced — just inline,
where the row would be, with the exact upstream message. This is more
informative than a single global banner because the user sees which
categories work and which need attention.

Caching: the route's existing `placesCache` (7-day TTL) + the saved
`trip_scanner_results` means repeat opens are free — the auto-scan only
fires for missing categories.

---

## 3. Carousel layout component (cited)

`TripPlannerAI.tsx:842-873` is the render loop:

```tsx
{CAROUSEL_ORDER
  .filter(catKey => ACTIVE_SCAN_SET.has(catKey))
  .map(catKey => {
    const isLoading = loadingCategories.has(catKey);
    const items = byCategory[catKey] || [];
    const err = categoryErrors[catKey];
    const { source } = getSource(catKey);
    return <TravelCarousel ... onCardClick={rec => router.push(
      `/budgets/trips/${tripId}/discover/${catKey}/${rec.valueRank}`
    )} />;
  })}
```

`CAROUSEL_ORDER` at `:879-892` is the locked layout: Stays first
(highest commission), then Viator-bookable rows (Things to do / Wellness /
Sports / Bucket-list), then Google discovery rows (Brunch / Dinner /
Nightlife / Coworking / Shopping / Conferences), then Mozio Transfers
(which fails loud "not connected").

`TravelCarousel` at `:920-986`:
- Header: title + source attribution badge (`sourceAttribution()`):
  - LiteAPI: `via LiteAPI`
  - Viator: `via Viator`
  - Google: `Google · discovery`
  - Mozio: `Mozio (coming soon)`
  - Airalo/CoverGenius/Duffel: same "coming soon" treatment
- States: error banner, 4-card skeleton row, empty-state message, or items.
- Cards: horizontal-scroll with `scroll-snap-type: x mandatory`,
  `w-[200px] sm:w-[220px]` (mobile-fit). Each card = photo + name + rating
  + price-when-bookable. Click → router.push to detail page.

**Mobile (375px) layout:** the carousel header stays single-line; cards are
200px wide so ~1.8 cards fit on screen with snap. Skeleton placeholders
animate in 4-up so the user perceives loading progress per row instead of
one global spinner.

---

## 4. Detail page (cited)

Route: **`src/app/budgets/trips/[id]/discover/[category]/[rank]/page.tsx`**
(server component) + sibling **`ReserveHotelButton.tsx`** (client island).

Path chosen: `/discover/[category]/[rank]` because `rank` (the
recommendation's `valueRank`) is already in every saved scanner-result
record. The detail page server-loads the trip + the saved
`trip_scanner_results` rows for `(tripId, category)`, finds the
recommendation with the matching `valueRank`, and renders.

### Auth + ownership (security mandate, `page.tsx:51-71`)
```ts
const userEmail = await getVerifiedEmail();
if (!userEmail) redirect('/api/auth/signin');
const user = await prisma.users.findFirst({ ... });
const trip = await prisma.trips.findFirst({
  where: { id: tripId, userId: user.id }, // user-scoped!
  select: { destination, startDate, endDate, daysTravel }
});
if (!trip) notFound();
```

### Per-source action buttons (the honesty rule)

| Source | Buttons rendered |
|---|---|
| **LiteAPI** (Accommodation) | **Reserve** (live, sandbox flow per PR-3b — fires `/api/travel/liteapi/prebook` → `/book` via the `ReserveHotelButton` client island) + **Add to trip**. If trip dates are missing, Reserve is replaced with `"Set trip Start/End dates to enable Reserve"`. If the hotel returned no bookable rate, replaced with `"No bookable offer for this hotel"`. |
| **Viator** | **Book on Viator ↗** (opens `viatorBookingUrl` or the constructed affiliate URL `viator.com/tours/{productCode}?pid=P00294427&mcid=42383&medium=api` in a new tab) + **Add to trip**. |
| **Google** (Brunch, Dinner, Nightlife, Coworking, Shopping, Arts & Culture) | **Open in Google Maps ↗** (`maps.google.com/maps/search/?api=1&query={name+address}`) + **Add to trip**. **No Book button** — Google can't take a restaurant reservation. Inline disclaimer beneath: "Google Places is discovery-only — restaurants and similar venues don't take in-app reservations." |
| **Mozio** (Ground Transport) | **"Mozio not connected yet — coming soon."** No book button. |
| **Flights / Duffel** | Out of carousel today (booked via the existing flight picker) — detail page for `flights` not exercised by the carousel grid (flights are added via the existing widget). |
| **Airalo / Cover Genius** | These categories aren't in the active scan loop today; if they appear via future PRs, get a "coming soon" treatment by default. |

Each detail page also shows a source-attribution badge at the top right
(`via LiteAPI` / `via Viator` / `Google · discovery (no booking)`) so the
user always knows what they're looking at and why the buttons are what
they are.

### LiteAPI hotel price block (`page.tsx:178-191`)
```
$184 / night × 7 nights
Total: $1,288
```
Shown only when LiteAPI returned a nightly rate. The total is `nightly *
trip.daysTravel`.

---

## 5. Brunch & Coffee `INVALID_REQUEST` fix (cited)

### Root cause
`src/lib/placesSearch.ts:97` builds the Google Text Search URL:
```ts
`...textsearch/json?query=${encodeURIComponent(query + ' in ' + city + ' ' + country)}...`
```
For the trip's destination `"Bali (Canggu)"`, the query becomes
`"brunch in Bali (Canggu) Indonesia"`. Google's text-search natural-language
parser **rejects strings with parenthesised location annotations** for some
generic single-word queries (the parser tries to interpret the parens as
syntax). PR-1 made this surface as a real `GooglePlacesApiError(
'INVALID_REQUEST', ...)` instead of silently returning `[]`. Dinner happened
to work because all its queries are two-word phrases that the parser
handles differently.

This is the same kind of failure for any destination with parens in its
name — not just Bali.

### Fix
Two changes in `src/lib/placesSearch.ts`:

**(a)** New helper `searchableCity(city)` at `:53-60` strips parens before
the city is interpolated into the text-search `query=` param (the Geocoding
API is more permissive — we leave the geocode call alone):
```ts
function searchableCity(city: string): string {
  return city.replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
}
```
The text-search URL now uses `searchableCity(city)` (`:97`) so
`"Bali (Canggu)"` becomes `"Bali Canggu"` in the query.

**(b)** `searchPlacesMultiQuery` (`:296-339`) switched from `Promise.all`
to `Promise.allSettled`. One query failing inside a category (e.g. an
awkward search term out of the 5 Brunch queries) no longer kills the
category — the merge takes the union of all queries that succeeded. We
only throw to the route when **every** query in the category failed, so
the fail-loud guarantee at the category level is preserved.

Both fixes together: even if one of Brunch's 5 queries trips
`INVALID_REQUEST` for an unusual reason, the other 4 still populate the
carousel — the user sees results instead of an "INVALID_REQUEST" banner.

---

## 6. LiteAPI SDK decision

**Deferred to PR-4b** — flagged in the UI.

PR-4 ships the sandbox stub flow PR-3b already built: the Reserve button
calls `/api/travel/liteapi/prebook` → immediately calls `/api/travel/liteapi/book`
with the prebook's `transactionId` as the paymentTransactionId. LiteAPI
sandbox accepts this without real card capture.

The `ReserveHotelButton` component renders a small disclaimer beneath the
button:

> *Sandbox booking — no real card captured (PR-4b adds the payment SDK).*

This keeps PR-4 buildable and verifiable end-to-end against LiteAPI's
sandbox while making the next step explicit. PR-4b will:
1. Load LiteAPI's hosted-checkout SDK in the browser.
2. Pass it the prebook's `secretKey` + `transactionId`.
3. Render their payment form inline.
4. Wait for the SDK's success callback before calling `/book`.

Per [LiteAPI's User Payment docs](https://docs.liteapi.travel/docs/user-payment),
the hosted SDK is the recommended production path — keeps PCI scope
effectively zero. The reason for deferral: the SDK render is a non-trivial
client integration with their script tag, form mounting, and event
handling. Splitting it cleanly out of PR-4 keeps the UX rebuild itself
focused on the layout + per-source actions.

---

## 7. Constraints verified

- **`trip_scanner_results` shape unchanged** — `git diff main --
  prisma/schema.prisma` = 0 lines.
- **Commit→budget spine unchanged** — `git diff main -- src/app/api/trips/
  [id]/vendor-commit/route.ts` = 0 lines.
- **Registry unchanged** — `git diff main --
  src/lib/travelSourceRegistry.ts` = 0 lines.
- **Traveler-count plumbing unchanged** — `git diff main` on
  `TripCreationBar.tsx`, `app/budgets/trips/new/page.tsx`,
  `app/api/trips/route.ts` = 0 lines.
- **PR-1 fail-loud handling preserved** — `placesSearch.ts` still throws
  typed `GooglePlacesApiError` on per-query status check; only the new
  `Promise.allSettled` wrapper changes the per-category aggregation
  semantics (return union of successes when at least one succeeded; throw
  when all fail).
- **Auth-first everywhere** — detail page does cookie-verify + user lookup
  + user-scoped trip query before touching any data. Reserve button uses
  the existing `/api/travel/liteapi/prebook` + `/book` routes, both
  already auth'd.
- **No new silent-fallback paths.** Per-category errors surface inline.
  The `Promise.allSettled` aggregation in `searchPlacesMultiQuery` is
  **not** a silent fallback — partial failures log per query, full
  failure still throws.

---

## 8. tsc + lint

- **`npx tsc --noEmit` → exit 0.**
- **Lint:**
  - Baseline error count on `placesSearch.ts` + `TripPlannerAI.tsx` pre-PR
    (per `git stash` baseline): **4 errors.**
  - After PR-4 (incl. two new files): **3 errors.** Net `-1` (the small
    Search Controls block I removed carried one `as any` cast).
  - **Zero new errors introduced.** The two new files
    (`page.tsx` + `ReserveHotelButton.tsx`) are fully lint-clean.
  - **29 unused-variable warnings** on `TripPlannerAI.tsx` — handlers and
    state used by the removed accordion (handleCommitCard,
    handleUncommitCard, handleLiteApiReserve, openCustomModal,
    cardPrices, scannerMeta, etc.). Intentionally left in place: a
    follow-up PR will lift the commit logic into the detail page so
    these will be re-wired rather than deleted. Warnings, not errors;
    repo's `next.config.ts` has `eslint.ignoreDuringBuilds: true`.
  - 2 `<img>` warnings (pre-existing baseline pattern).

---

## 9. Mobile layout description (375px)

I can't run a headless browser from this audit environment, so this is a
structural description of what 375px renders:

- **Top of page:** the trip-context header stays single-row with the city
  + dates left-aligned and the `Refresh` button on the right. On <400px
  the dates wrap to a second line; refresh button stays sticky-right.
- **Each carousel:** the header (`Stays` + `via LiteAPI`) is one row.
  Cards are 200px wide with horizontal scroll-snap — roughly 1.8 cards
  visible at 375px. User swipes left/right to browse; each snap aligns
  the leading card to the row's left edge.
- **Skeleton rows during load:** 4 placeholder cards animate in the same
  200px width — sustains the rhythm of the layout while content streams in.
- **Error rows:** an inline `text-xs` banner replaces the card row
  entirely. Single-line at narrow widths (Tailwind's `text-xs` line-break
  rules handle wrapping).
- **Detail page** on 375px: photo takes full viewport width at 288px
  (`h-72`); content stacks vertically. Reserve / Book / Add-to-trip
  action row wraps when needed (Tailwind `flex-wrap`).

This satisfies the "carousels must work on a narrow viewport" requirement.
Real device QA still recommended pre-merge.

---

## Changeset

```
 A audit-reports/travel-ux-pr-4.md                                                              (this report)
 M src/components/trips/TripPlannerAI.tsx                                                       (auto-load + carousels)
 M src/lib/placesSearch.ts                                                                      (Brunch fix)
 A src/app/budgets/trips/[id]/discover/[category]/[rank]/page.tsx                               (detail page)
 A src/app/budgets/trips/[id]/discover/[category]/[rank]/ReserveHotelButton.tsx                 (client island)
```

## What ships next

- **PR-4b** — LiteAPI hosted-checkout SDK render in the browser (replaces
  the sandbox-stub passthrough with a real card-capture flow). Once
  this lands, the in-UI disclaimer comes off and we're production-ready
  for Accommodation bookings.
- **Commit → detail-page wiring** — move the existing
  `handleCommitCard` / `handleAddCustomItem` / Edit Selection modal
  logic out of `TripPlannerAI.tsx` and onto the detail page. Then the
  29 dead-code warnings clear and the planner component shrinks
  dramatically.
- **Flights carousel** — current PR-4 routes Flights through the existing
  flight picker widget; a future PR adds a horizontal flight-offer
  carousel that calls `/api/flights/search` (Duffel) on mount with
  trip dates + origin airport.

Sources:
- [LiteAPI — POST /rates/prebook](https://docs.liteapi.travel/reference/post_rates-prebook)
- [LiteAPI — POST /rates/book](https://docs.liteapi.travel/reference/post_rates-book)
- [LiteAPI — User Payment SDK](https://docs.liteapi.travel/docs/user-payment)
- [Google Places — Text Search request statuses](https://developers.google.com/maps/documentation/places/web-service/legacy/search-text)
