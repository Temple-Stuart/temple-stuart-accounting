# TRAVEL — PR-37 Audit: trips index redesign — remove calendar/map, adopt detail-page template, create-trip form

**Branch:** `claude/travel-pr-37-audit`
**Date:** 2026-05-31
**Mode:** READ-ONLY. Grounded in `/mnt/skills/public/frontend-design/SKILL.md`
(app-wide design language) + the `budgets/trips/[id]` detail page as the template.

**Goal:** Redesign `budgets/trips` (index): (1) remove "Trip Calendar" + "Trip
Locations", (2) adopt the detail page's chrome/table/palette as the app-wide
template, (3) replace the search bar with an Expedia/Booking-style create-trip
**form** collecting our system's inputs.

---

## 1. Current index page + sections

`src/app/budgets/trips/page.tsx` (`TripsPage`, client component). Top-to-bottom:

| Section | Lines | Component / data |
|---|---|---|
| **Search bar** (above the page) | mounted by `AppLayout` | `TripCreationBar` (`src/components/trips/TripCreationBar.tsx`) — rendered on `/budgets/trips` via `showTravelSearch` (`AppLayout.tsx:149-150,164-167`, the PR-32 regex). |
| **All Trips** table | `:224-307` | inline `<table>` over `trips` (from `GET /api/trips`, `loadTrips` `:108-127`). |
| **Trip Calendar** | `:309-321` | `<CalendarGrid>` (`@/components/shared/CalendarGrid`) fed `calendarEvents` (built by `loadItineraryEvents` `:129-191`). |
| **Trip Locations** map | `:323-343` | `<TripMap>` (`@/components/trips/TripMap`) fed `committedTrips` (`:207`). |
| **Trip Detail Sidebar** | `:345-357` | dead `selectedTrip` panel — `selectedTrip` is never set (`setSelectedTrip` unused); a latent dead branch. |

## 2. Removal targets — "Trip Calendar" + "Trip Locations" (index-only)

- **Trip Calendar** (`:309-321`) → `<CalendarGrid>`. `CalendarGrid` is a **shared**
  component (`grep`: used by the index, the detail page `[id]/page.tsx:7`, and
  itself) — so **do NOT delete the component**; only remove the **index's usage**.
  Dead after removal (index-only plumbing): `calendarEvents` state (`:102`),
  `loadItineraryEvents` (`:129-191`, which fetches `/api/trips/{id}/itinerary` for
  every trip — N extra fetches gone), `mapCategory` (`:86-95`), `TRIP_SOURCE_CONFIG`
  (`:74-83`), the `loadItineraryEvents(sortedTrips)` call (`:120`), and the
  `ItineraryItem` interface (`:42-53`). **This also removes a per-trip itinerary
  fetch storm on index load** — a perf win.
- **Trip Locations** (`:323-343`) → `<TripMap>`. `TripMap` is **index-only**
  (`grep`: used only by `TripMap.tsx` + the index; the **detail page uses
  `DestinationMap`**, not `TripMap`, `[id]/page.tsx:9`). Removing the index usage
  makes the `TripMap` import (`:6`), `committedTrips` (`:207`), the `leaflet`
  CSS import (`:8`), and the `latitude/longitude` Trip fields (used only for the
  map) dead **for this page** (the `TripMap.tsx` file can stay for now, or be
  deleted if nothing else imports it — grep confirms nothing else does).
- **Detail page untouched:** Alex keeps the detail page's Itinerary
  (`ItineraryAgenda`/`CalendarGrid`) + Map (`DestinationMap`) — different
  components / different page; this removal is **index-only**.
- **Clean-removal (PR-30 standard):** also drop the dead `selectedTrip` sidebar
  (`:104,:345-357`) and its state. After removal the index = header + All Trips +
  the new create-trip form.

## 3. Detail-page template (the documented app-wide language)

Concrete patterns to adopt, cited from `[id]/page.tsx` (every peer section uses
this — Committed Budget, Crew, Flights, etc.):

- **SectionCard chrome:** `rounded-lg overflow-hidden border border-gray-200/50
  shadow-sm` wrapper (`:809`) + a **brand-purple header band**
  `bg-brand-purple/80 text-white px-4 py-2.5 text-sm font-semibold` (`:810`) +
  `bg-white p-4` body. (Codified as the `SectionCard` component in
  `TripPlannerAI.tsx`.)
- **Table style** (Committed Budget, `:824-838`): `overflow-x-auto bg-white` →
  `<table className="w-full text-xs">` → **`<thead className="bg-gray-50">`** with
  `<th className="px-3 py-2 text-left font-medium text-gray-500">` headers,
  **sortable** headers add `cursor-pointer hover:text-gray-700 select-none` + a
  sort arrow (`arrow('category')`, `:828`), amount right-aligned
  (`text-right`, `:831`); **`<tbody className="divide-y divide-gray-100">`**, rows
  `hover:bg-gray-50`.
- **Filter pills** (`:812-823`): rounded-full chips, active =
  `bg-brand-purple text-white`, idle = `bg-gray-100 text-gray-600 hover:bg-gray-200`.
- **Palette / tokens** (Tailwind theme): `brand-purple` (+ `/80`, `-hover`),
  `brand-gold` / `brand-gold-bright` (primary CTAs), aqua/`cyan` accents, status
  chips `emerald` (committed/confirmed) / `amber` (planning/pending), neutrals
  `gray-50/100/200/500/900` + `gray-200/50` borders.

**Grounding in the frontend-design skill:** the skill mandates a **cohesive
design language via CSS variables / tokens** and **"Color & Theme: commit to a
cohesive aesthetic … dominant colors with sharp accents"** (SKILL.md:31). The
detail page already embodies this (dominant brand-purple section bands + gold CTAs
+ emerald/amber status accents on a clean gray-scale table system). PR-37's job is
**consistency adoption** — make the index speak the same documented language, not
invent a new one. (The skill's anti-"AI slop"/"purple-gradient-on-white" caution
is about *generic* purple gradients; here brand-purple is the established, codified
brand token used as solid section bands, not a default gradient.)

## 4. "All Trips" — already-matching vs needs-alignment

The index's All Trips table (`:224-307`) **partially** matches — adoption should
**extend** it, not rebuild:

| Aspect | Index now | Detail template | Action |
|---|---|---|---|
| Header band | `bg-brand-purple` (flat) `px-4 py-2 text-sm font-semibold` (`:226`) | `bg-brand-purple/80 … px-4 py-2.5` (`:810`) | align to `/80` + `py-2.5` |
| Card wrapper | `bg-white border border-border` (`:225`) | `rounded-lg overflow-hidden border border-gray-200/50 shadow-sm` (`:809`) | add rounded + shadow + gray-200/50 |
| Table head | `bg-brand-purple-hover text-white` (`:237`) | `bg-gray-50` + `text-gray-500` headers (`:826-828`) | switch to the gray-50/gray-500 head |
| Body divide | `divide-y divide-border` (`:249`) | `divide-y divide-gray-100` (`:835`) | align token |
| Row hover | `hover:bg-bg-row` (`:252`) | `hover:bg-gray-50` (detail rows) | align token |
| Status chips | emerald/amber (`:289-293`) | same | ✅ already matches |
| Sortable headers | none | sort arrows (`:828-831`) | optional add (sort trips by date/name) |

So All Trips keeps its columns/data; only the **chrome tokens** (card radius/
shadow, header `/80`, gray-50 table head, gray-100 divides) align to the template.

## 5. Create-trip endpoint + inputs (verified from source)

- **`TripCreationBar`** (`TripCreationBar.tsx`) ALREADY collects a full input set,
  not just name/destination: **trip name** (`barName`, `:34`), **multi-destination**
  with autocomplete (`selectedDestinations`, `:35`, `searchDestinations`),
  **date range** (`barStartDate`/`barEndDate`, `:36-37`), **travelers**
  (`barTravelers`, `:38`, a 1-8 select), and **trip type** toggle
  (`tripType`, `:39`, Personal/Business/Mixed `:318-333`). It is a **3-mode**
  component (`landing | new | detail`, `:32`): on **landing** (`/budgets/trips`)
  its button does `router.push('/budgets/trips/new' + querystring)`
  (`:199`) — i.e. it **does NOT create on the index**; it forwards the collected
  inputs as URL params to the `/budgets/trips/new` page, which performs the actual
  create. On **detail** it PATCHes the trip (`:172-193`); on **new** it saves.
- **`POST /api/trips`** (`src/app/api/trips/route.ts:POST`) destructures
  `{ name, destination, activity, activities, month, year, daysTravel, daysRiding,
  startDate, endDate, tripType }` (`:19-31`). It **derives** month/year/daysTravel
  from `startDate`/`endDate` when present (`:33-48`), and **DOES persist
  `startDate`/`endDate`** in the `create` block (`route.ts:132-133`:
  `startDate: startDate ? new Date(startDate+'T12:00:00') : null` / same for
  `endDate`) — plus it creates the **owner participant** (`:81-91`,
  `isOwner:true, rsvpStatus:'confirmed'`) and an invite token. **Required:**
  `name` AND a resolvable `month`+`year`+`daysTravel` (`:50-53`, 400 otherwise) —
  so passing a `startDate`+`endDate` (which derive all three) satisfies it.
  Auth+ownership gated (`getVerifiedEmail` → user, `:3-16`).

> **Correction to a common assumption:** the endpoint **already writes
> startDate/endDate** (`:132-133`) and **already derives month/year/daysTravel
> from the date range** (`:33-48`). **No endpoint change is needed** for the new
> form to persist dates. Travelers: the POST seeds **only the owner** as a
> participant; there is **no bulk-traveler-create at trip-create** (additional
> crew are added later on the detail page's Crew section, PR-31). So a "travelers"
> count in the form is cosmetic at create unless a participant-seed path is added
> — recommend the form omit travelers (or collect a count with no persistence),
> matching how `TripCreationBar`'s `barTravelers` is currently forwarded but not
> turned into participant rows at create.

## 6. Proposed create-trip form (Expedia/Booking-style, our inputs)

A horizontal create-trip **bar/card** at the top of the index, styled in the
detail-page language (SectionCard chrome, brand tokens), replacing the
`TripCreationBar` search bar:

- **Layout:** one `SectionCard` titled e.g. "Plan a new trip" (brand-purple band),
  body a responsive horizontal row (wraps on mobile):
  **Trip name** (text, required) · **Destination(s)** (text — "Where to?") ·
  **Date range** (start + end date inputs → maps to `startDate`/`endDate` +
  derive `month`/`year`/`daysTravel`) · **Activity** (select, optional) ·
  **Trip type** (segmented Personal/Business/Mixed toggle) · **Create trip**
  (brand-gold CTA).
- **Behavior:** POST `/api/trips` directly with the collected fields (name,
  destination(s), startDate/endDate, tripType) — the endpoint persists dates +
  derives month/year/daysTravel (§5), so **no endpoint change needed** — then
  redirect to the new trip's detail page (`/budgets/trips/{id}`). This is a more
  direct flow than today's landing bar, which forwards inputs to
  `/budgets/trips/new` (an extra hop). Disabled until `name` present (+ valid date
  range, end ≥ start, no fallback — the PR-33 discipline).
- **Mounts:** at the top of `budgets/trips/page.tsx` (replacing the All-Trips
  empty-state hint "use the search bar above"). The `AppLayout` `TripCreationBar`
  search bar must be **suppressed on `/budgets/trips`** (it currently shows there
  via `showTravelSearch`, `AppLayout.tsx:155,169`) so the page-level form is the
  single create surface (no double bar). The bar can remain on other travel routes
  if desired, or the landing-mode `/new` hop can be retired entirely — confirm.

## 7. Scope + sequencing

**Recommend sequencing (two PRs):**
- **PR-37a (structural):** remove Trip Calendar + Trip Locations + the dead
  sidebar + their dead plumbing (clean-removal); add the in-page create-trip form;
  suppress the AppLayout search bar on `/budgets/trips`. **No endpoint change** —
  `POST /api/trips` already persists dates + derives month/year/daysTravel (§5).
  **Files:** `budgets/trips/page.tsx`, a new `CreateTripForm.tsx` (or fold into the
  page), `AppLayout.tsx` (suppression). **0 schema** (trips already has
  startDate/endDate/month/year/daysTravel columns).
- **PR-37b (aesthetic adoption):** align All Trips chrome to the template + style
  the create-form in the detail-page language; codify shared `SectionCard`/table
  tokens if extracting for app-wide reuse.

**Or one PR** if Alex wants the index done in a single pass (structural + aesthetic
together) — lower coordination, larger diff. **0 deps either way.**

## Sign-off items
1. **One PR vs 37a/37b split** (recommend split: structural then aesthetic).
2. **Travelers at create?** The POST seeds only the **owner** participant; there's
   no bulk-traveler-create at trip-create (Crew is added on the detail page,
   PR-31) — confirm the form omits a travelers field (or collects a count with no
   persistence yet).
3. **Search-bar handling** — suppress `TripCreationBar` on `/budgets/trips` (the
   new in-page form replaces it) and decide whether to retire the landing→`/new`
   hop entirely. Confirm scope.
4. **Delete `TripMap.tsx`** (index-only, no other importer — grep-confirmed) vs
   leave the file dormant. Recommend delete (clean, no orphan).
5. **Direct-create vs `/new` hop** — the new form POSTs `/api/trips` directly and
   redirects to the detail page (recommended), replacing today's landing-bar →
   `/budgets/trips/new` forward. Confirm.

> **Endpoint correction (vs an earlier draft):** `POST /api/trips` **already
> writes `startDate`/`endDate`** (`route.ts:132-133`) and **derives
> month/year/daysTravel from the date range** (`:33-48`) — so there is **no
> 2-line endpoint add** and no "dates don't stick" gap. The form only needs to
> send the date range.

---

**READ-ONLY audit. No implementation performed.**
