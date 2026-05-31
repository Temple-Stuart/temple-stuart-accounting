# TRAVEL — PR-28 Audit: Pro-Tier Scan Page Redesign

**Branch:** `claude/travel-pr-28-audit`
**Date:** 2026-05-30
**Mode:** READ-ONLY. Plan the rebuild; don't implement.
**Design grounding:** `/mnt/skills/public/frontend-design/SKILL.md` (read) +
Temple Stuart palette (`tailwind.config.ts`).

---

## 1. Current scan-page structure

- **Sections = a vertical stack of horizontal carousels**, one per active
  category, rendered at `TripPlannerAI.tsx:919-946`:
  ```tsx
  {CAROUSEL_ORDER.filter(catKey => ACTIVE_SCAN_SET.has(catKey)).map(catKey => {
    … <TravelCarousel label source items … /> …
  })}
  ```
  Order from `CAROUSEL_ORDER` (`:955-972`): `accommodation`, `activities`,
  `brunch_coffee`, `dinner`, `nightlife`, `coworking`, `shopping`,
  `ground_transport`. `ACTIVE_SCAN_SET` (`:974`) = `getActiveScanCategories`.
- **`TravelCarousel`** (`:1013`) is the shared row: header = `label` + a tiny
  `sourceAttribution` badge (`:1016-1021`); body = error banner / skeleton /
  empty / a horizontal `HScrollRow` of 200-260px cards (`:1046+`, arrows added
  PR-27). Scan-row chips + date inputs + Refresh are in the header
  (`:766-820`).
- **Flights are SEPARATE** — `FlightPicker` lives in the trip page, in its own
  purple-header card (`page.tsx:1028-1033`), rendered **above** the
  `<TripPlannerAI>` block (`page.tsx:1098`). So today: Flights (page.tsx) →
  Planner carousels (TripPlannerAI).
- **Sort/filter state EXISTS but is NOT interactive UI:** `minRating`,
  `minReviews`, `maxPriceLevel`, `sortBy` (`:196-199`) + `sortItems` (`:387`).
  But `sortItems` is **never called in the render loop** (`items = byCategory[catKey]`
  directly, `:924`), and `minRating/minReviews/maxPriceLevel` are sent as
  **server-side scan params** (`:309`) — they pre-filter the fetch. **There is
  no per-section interactive filter/sort UI.** That's the core gap.

## 2. Source-separated section architecture (target order)

Target order: **Flights → Hotels → Ground Transport → Activities(Viator) →
Google categories.** Mapping + the rec shape each source provides (the fields
available to filter/sort on):

| Section | Source | Where today | Rec fields available |
|---|---|---|---|
| **Flights** | Duffel | `FlightPicker` (`page.tsx:1028`) — separate | price, depart/arrive times, stops, carriers, duration, legs |
| **Hotels** | LiteAPI | `accommodation` carousel | `pricePerNight`, `priceTotal`, `nights`, `currency`, `googleRating`, `reviewScore`, `reviewCount`, `chain`, `facilities[]`, `city`, `latitude/longitude`, `priceLevel` (+ `facilitiesAll`/full gallery only when `/data/hotel`-enriched — §5) |
| **Ground Transport** | Mozio | `ground_transport` carousel (last today) | none yet — **not wired** → 501 "coming soon" (registry `mozio`) |
| **Activities** | Viator | `activities` carousel | `price`, `rating`, `reviewCount`, `durationMinutes`, `categoryIds[]`, `title` (`viatorClient.ts:183-198`) |
| **Google** | Google Places | `brunch_coffee`/`dinner`/`nightlife`/`coworking`/`shopping` | `rating`, `reviewCount`, `priceLevel`, `types[]`, `name` (`placesCache.ts:8-13`) |

**Reorder needed:** `ground_transport` is **last** in `CAROUSEL_ORDER` (`:971`)
but the target wants it **3rd** (after Hotels, before Viator); the five Google
categories group **last**. So PR-28a reorders `CAROUSEL_ORDER` + reconciles the
Flights card (`page.tsx`) into the same visual section flow.

## 3. Excel-style filtering (the core ask)

**Filterable fields per section** (all already present on the fetched recs, so
client-side is feasible — see below):

- **Hotels:** price/night (range slider), reviewScore (≥ N), starRating, chain
  (multi-select), facilities (multi-select: Pool/Wifi/Breakfast/Gym/Spa/Parking
  + full set when enriched), city/neighborhood, "has bookable rate"
  (`liteapiOfferId != null`).
- **Activities (Viator):** price (range), rating (≥ N), reviewCount (≥ N),
  duration (buckets: <2h / 2-4h / half-day / full-day from `durationMinutes`),
  category (`categoryIds`).
- **Google:** rating (≥ N), reviewCount (≥ N), priceLevel ($–$$$$), type.
- **Flights:** price, stops (nonstop/1+), carrier, depart-time window, duration.

**Combine logic:** stackable **AND** across fields (a row passes only if it
satisfies every active filter), with multi-select treated as **OR within a
field** (e.g. chain ∈ {Marriott, Hilton}). Standard faceted-filter semantics.

**Sort:** price ↑/↓, rating/score ↓, reviewCount ↓, duration (Viator). Reuse +
extend the existing `sortBy`/`sortItems` (`:387-399`) — currently dormant.

**Client-side vs re-query:** **Client-side on already-fetched results is
feasible now** — every filterable field is on the rec in `byCategory[catKey]`.
This gives instant, stackable filtering with **zero extra API cost**. The
pattern: **fetch broad (§4), filter narrow client-side** (Kayak/Booking model).
Re-query is only needed when a filter wants inventory *outside* the fetched set
(e.g. a much higher price ceiling than the page fetched) — defer that to a
"load more / widen search" action. Recommend client-side for v1.

## 4. Larger population + cost

Today's per-source fetch caps:
- **Hotels:** `maxResults = 33` (`route.ts:190`), `slice(0, 33)` (`:278`); client
  sends `maxResults: 33` (`TripPlannerAI.tsx:335`).
- **Viator:** `viatorMax = Math.max(maxResults, 250)` → up to **250**
  (`route.ts:321,331`) — already large; just not all surfaced (carousel shows
  `items.slice(0,12)` at `TripPlannerAI.tsx:1048`).
- **Google:** `maxResults = 33`, `enrichPlaceDetails(places, 33)` (`route.ts:405`).

**Proposal:** raise hotel + Google caps (e.g. 33 → 50-100), and **render the full
fetched set behind filters/pagination** instead of `slice(0,12)`. Add
**load-more / pagination** per section. **Cost implication:** the hotels
`/hotels/rates` call is paid (B-5100 COGS) and scales with result count; Google
`enrichPlaceDetails` does N details calls (quota + cost). Viator is already 250
(cheap relative). **Recommend:** moderate bump (50) + load-more, not unbounded —
and surface counts ("Showing 50 of 120") so the user can widen deliberately.
**Alex sign-off on the number** (cost vs completeness).

## 5. Full images / rich metadata — `/data/hotel` enrichment

Confirmed (prior audit + here): the mapper reads only the **thin `/hotels/rates`
metadata** (price + photo + address). Full gallery, full facilities, coords, and
the aggregate review score live in the dedicated **`/data/hotel` content
endpoint**, which **we do not call** (`liteapiClient.ts:160,519` only *reference*
it in comments; no client fn). This is why detail pages show no map/amenities for
thin hotels (PR-22-23-verify finding).

**Proposal:** add `getHotelDetails(hotelId)` → `GET /v3.0/data/hotel?hotelId=…`
(reuse the `headers()`/`getApiKey()` auth path), returning full
`hotelImages[]`/`hotelFacilities[]`/`location`/`hotelDescription`/review
aggregates.

**On-scan vs on-detail — RECOMMEND on-detail:** enriching **all** scan hotels =
1 paid content call **per hotel** (33-100 calls every scan) → expensive +
slow. Enriching **on detail-view** = **one** call for the hotel the user
actually opened → cheap, lazy, and it's exactly where the gallery/amenities/map
render. (The card already has enough from rates: photo, price, name.) So:
**scan cards stay rates-thin; the detail page enriches the single viewed hotel
via `/data/hotel`.** This also fixes the empty detail-page sections.

## 6. Visual polish (grounded in `frontend-design/SKILL.md`)

**What reads unpolished today (cited):**
- **The purple-gradient placeholder** `bg-gradient-to-br from-purple-50 to-indigo-100`
  (`TripPlannerAI.tsx:1064`, `HotelGallery.tsx:30`, detail page) — this is
  *literally* the cliché the skill names: *"cliched color schemes (particularly
  purple gradients on white backgrounds)"* (SKILL.md:36). Replace with a neutral
  textured placeholder + a source glyph.
- **Carousel-only, thin 200-260px cards** with minimal chrome (just a label + a
  10px source badge, `:1016-1021`) — no result counts, no filter affordances, no
  density option. The skill calls for *"controlled density"* and *"precise
  spacing/alignment"* (SKILL.md:33,40).
- **Flat, evenly-distributed styling** — the skill prescribes *"dominant colors
  with sharp accents"* and *"depth rather than defaulting to solid colors"*
  (SKILL.md:31,34).

**What the skill prescribes (mapped to Temple Stuart tokens):**
- **Section chrome:** a strong section header band (brand-purple, like the
  Flights/Itinerary cards `page.tsx:1031`), result count, source badge, and a
  filter/sort bar beneath — consistent across all five sections.
- **Hotels as a responsive results GRID** (Booking.com), not only a carousel —
  controlled density; keep the carousel for Activities/Google where browsing is
  casual. (Skill: *"Generous negative space OR controlled density"*.)
- **Depth via shadows + hairline borders** (`border-border`, `shadow-sm`), not
  flat gradients; **brand-purple dominant, gold/aqua sharp accents** for
  price/score badges (already the PR-14/15/22 pattern).
- **Typography:** keep the existing system (IBM Plex Mono + Inter,
  `tailwind.config.ts:67-70`) for product consistency — the skill warns against
  generic fonts, but an internal product values a *consistent* type system over
  novelty; use weight/size hierarchy + `tabular-nums` for prices.
- **Motion:** one staggered section reveal on load (`animation-delay`) — the
  skill's *"one well-orchestrated page load with staggered reveals"* (SKILL.md:32).
- **Keep the left nav as-is** (Alex's preference).

## 7. Sequenced PR breakdown (NOT one mega-PR)

Per the one-fix-per-PR mandate, split into ordered PRs:

| PR | Scope | Files | Risk |
|---|---|---|---|
| **28a — Section restructure** | Reorder to Flights→Hotels→GroundTransport→Viator→Google; unify section chrome (header/source-badge/result-count); reconcile the Flights card into the flow. Render-only. | `TripPlannerAI.tsx` (`CAROUSEL_ORDER`, section shell), `page.tsx` (Flights placement) | low |
| **28b — Excel filtering + sort** | Per-section client-side faceted filters (AND across fields, OR within) + sort; filter bar UI; activate `sortItems`. No new fetch. | `TripPlannerAI.tsx` (+ a `SectionFilters` component) | medium (the core ask) |
| **28c — `/data/hotel` enrichment (detail-view)** | `getHotelDetails` client fn; detail page enriches the viewed hotel (full gallery/amenities/map/score). One paid call per view. | `liteapiClient.ts`, detail `page.tsx` | medium (paid call — auth-gated) |
| **28d — Larger population + load-more** | Raise hotel/Google caps; render full set behind pagination; surface counts. | `route.ts` (caps), `TripPlannerAI.tsx` (pagination) | medium (cost) |
| **28e — Visual polish** | Kill purple-gradient placeholders; hotels results-grid; spacing/typography/depth/staggered reveals per SKILL.md. | `TripPlannerAI.tsx`, cards, `HotelGallery.tsx` | low-medium |

**Recommended order:** **28a → 28b → 28c → 28d → 28e.** Structure first (a stable
shell to hang filters on), then the core filtering ask, then enrichment (fixes
the empty detail page), then population (cost-gated), then polish last (so polish
lands on the final structure). **Schema impact: none** (display + fetch only).
**New deps: none** (lucide + Leaflet present; filters are native controls).

## What needs Alex sign-off
1. **Filter scope** — which fields per section ship in 28b (full Excel vs a
   curated set).
2. **Population size** — the hotel/Google cap (cost vs completeness) for 28d.
3. **Enrichment cost** — confirm `/data/hotel` enrichment is **on-detail only**
   (recommended) vs on-scan (richer cards, far costlier).
4. **Hotels grid vs carousel** — density choice for 28e.

---

**READ-ONLY audit. No implementation performed.**
