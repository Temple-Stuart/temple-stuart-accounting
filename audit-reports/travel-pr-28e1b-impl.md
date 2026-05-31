# TRAVEL — PR-28e1b Implementation: per-API peer sections + Destinations & Dates control bar

**Branch:** `claude/travel-pr-28e1b`
**Date:** 2026-05-31
**Scope:** Dissolve the "Trip Planner & Budget" panel into **peer top-level
sections** — Hotels (LiteAPI) / Ground Transport (Mozio) / Activities (Viator) /
Places (Google, **one** combined section) — each rendered by a thin
`<TripApiSection>` reading `TripScanContext`. Add a **"Destinations & Dates"**
control bar (chips + dates + Refresh). Reorder. Flights stays standalone, chrome-
matched. Per `audit-reports/travel-pr-28e1b-audit.md`. **0 schema, 0 deps, 0 new
state, 0 new fetches, 0 new paid calls.** 2 files + this report.

---

## STEP 1 — Provider scope widened

`page.tsx` previously mounted `<TripScanProvider>` wrapping **only**
`<TripPlannerAI/>` inside the panel. Now a single IIFE
(`src/app/budgets/trips/[id]/page.tsx:741-818`) mounts `<TripScanProvider
input={{…}}>` (`:789-808`) enclosing **the Destinations & Dates control card,
Flights, and all four API peer sections** — so every section reads the same scan
state. **The `input={{…}}` object is unchanged** from PR-28e1a (same `tripId /
city / country / activity / month / year / daysTravel / tripDates / onCommitted`,
`:791-803`).

**Critical:** the provider is **not mounted for gated (free/pro non-admin)
users** — the IIFE returns the upgrade card *before* the provider
(`:759-766`), so **no scan effect fires and no paid API call is made for free
users** (preserving the prior gate's cost behavior). Pro+/admin get the provider
branch (`:789-816`).

## STEP 2 — `TripApiSection` component

`src/components/trips/TripPlannerAI.tsx:846-884` — `export function
TripApiSection({ catKey, title })`:
- reads `router, byCategory, loadingCategories, categoryErrors, tripId` from
  `useTripScanCtx()` (`:847`);
- gates on `ACTIVE_SCAN_SET.has(catKey)` (`:848`, preserves the old loop's
  `.filter(ACTIVE_SCAN_SET.has)`);
- derives `isLoading / items / err / label / source` exactly as the old section
  loop did (`:849-855`, cf. the former `TripPlannerAI:941-947`);
- wraps the existing `<TravelCarousel>` in **`<SectionCard>`** (`:776-784`) — the
  Flights-shell chrome (`rounded-lg overflow-hidden border border-gray-200/50
  shadow-sm` + `bg-brand-purple/80 … font-semibold` band + `bg-white p-4` body);
- `onCardClick` routes to the discover detail by `catKey` + `rec.valueRank`
  (`:872-875`), identical to before.

`TravelCarousel` is **unchanged** — so its 28b `SectionFilterBar`, 28d
`shown`/Load-more, count, source badge, and honest empty/error states all carry
over verbatim. Hotels (`accommodation`, `source='liteapi'`) therefore keeps the
carousel + load-more.

## STEP 3 — Peer sections rendered in order

`page.tsx:810-815` (pro branch):
```tsx
<TripApiSection catKey="accommodation"     title="Hotels" />
<TripApiSection catKey="ground_transport"  title="Ground Transport" />
<TripApiSection catKey="activities"        title="Activities" />
<TripPlacesSection />
<TripScanModals />
```

**Places = ONE combined Google section** (`TripPlannerAI.tsx:908-949`,
`export function TripPlacesSection`): merges all active Google catKeys
(`GOOGLE_CATKEYS = CAROUSEL_ORDER.filter(source==='google' && ACTIVE_SCAN_SET)`,
`:886-888` → `brunch_coffee, dinner, nightlife, coworking, shopping`) into a
single `<TravelCarousel source="google">`. Each rec is tracked back to the
catKey it was scanned under via a `Map<GrokRecommendation,string>` (`catOf`,
`:917-921`) so **card routing stays exact** (routes by the scan catKey, not a
possibly-different `rec.category`; `:941-944`). `isLoading` = any Google cat
loading; `err` = first Google cat error (**fail-loud, no masking**, `:923`).

The old single `CAROUSEL_ORDER.map` loop in `TripPlannerAI` is **removed** (the
default export is gone).

## STEP 4 — Destinations & Dates control bar

`page.tsx:763-771` (gated) / `:805-812` (pro) render a `Destinations & Dates`
card (Flights-shell chrome) whose body holds:
- **the destination chips** — moved verbatim out of the old planner panel
  (former `page.tsx:1020-1056`) into a local `chipsBlock` const (`:750-789`),
  still **page-level** (`selectDestination`, `destinations`, `DestinationSelector`);
- **`<TripScanControls/>`** (pro only) — the per-location check-in/out dates +
  dates-valid guard + "Loading N of M" + **Refresh** + the global scan-error
  banner, lifted verbatim from the former `TripPlannerAI` header
  (`TripPlannerAI.tsx:786-820`, `export function TripScanControls`, reads
  `checkinVal/checkoutVal/activeCity/setPerLocationDates/datesValid/
  loadingCategories/totalCategories/loading/rescanAll/error` from context).

So the chips drive `trip.destination` (page) → `input.city` → the provider; the
dates/Refresh drive the shared scan. This control bar sits **above** the API
sections and drives them all.

## STEP 5 — Flights: standalone, chrome-matched

Flights is **not** folded into `TripApiSection`/context. The existing
`<FlightPicker>` (Duffel) block is reused verbatim as a `flightsBlock` const
(`page.tsx:751-767`) and rendered between the control bar and the API sections
(`:776` gated, `:809` pro). Its card chrome already matches the shared shell
(brand-purple band + `bg-white p-4`). **The Duffel commit flow / `onCommitted`
is untouched.** Flights renders for all users (gated and pro), as before.

## STEP 6 — Reorder + panel dissolved

**Current (origin/main)** order: `TripHeader` → Map → Itinerary → **Committed
Budget** (`:741`) → Add Expense → **Crew** (`:892`) → **Flights** (`:997`) →
**Trip Planner & Budget panel** (`:1016`) → Commit (`:1088`).

**New** order: `TripHeader` → Map → Itinerary → **[Destinations & Dates]** →
**Flights** → **Hotels → Ground Transport → Activities → Places** → **Committed
Budget** → Add Expense → **Crew** → **Commit**. The `id="trip-planner-section"`
panel wrapper + its "Trip Planner &amp; Budget" title are **deleted** (asserted
absent in the build script). The **Committed Budget + Add Expense + Crew** block
moved down **verbatim** (extracted as `budget_crew_block`, re-emitted after the
scan region); **Commit to Ledger** unchanged. Verified: all 13 section anchors
present; `useEffect` count 9 == 9 (no hooks lost); diff hunks confined to the
import line + the `741-1088` region (lines 7-737 untouched).

## STEP 7 — Honest states preserved

Both flow through the **unchanged** `TravelCarousel` → `getEmptyMessage(source)`
(`TripPlannerAI.tsx:1042-1053`):
- **Ground Transport (Mozio 501):** `source='mozio'` → "Ground transport search
  coming soon." (peer section renders the honest coming-soon).
- **Places (Google 429/quota):** a scan error surfaces as the inline red error
  banner (`categoryErrors`, fail-loud); an empty result shows "No places found.
  Try refreshing or adjusting filters." The combined section forwards the first
  Google category error, so a 429 is never masked.

## Hard-constraint compliance

| Constraint | Status |
|---|---|
| State from `TripScanContext` only — no new state / fetches / paid calls | ✅ all reads via `useTripScanCtx()`; engine unchanged; **provider not mounted for gated users** (no free-user scan) |
| Flights Duffel flow untouched (standalone) | ✅ `FlightPicker` block reused verbatim, not in context |
| Committed Budget / Crew / Commit / TripHeader behavior untouched | ✅ moved verbatim / unchanged |
| 28b filters + 28d load-more + honest empty/error per section | ✅ `TravelCarousel` unchanged |
| Structural only (no restyle beyond shared chrome) | ✅ only `SectionCard` shell applied |
| 0 schema, 0 deps | ✅ |
| `tsc --noEmit` | ✅ exit 0 |
| eslint (JSON-verified, branch vs origin/main) | ✅ **TPA 1 err / 3 warn (== base, 0 new)**; **page 33 err / 19 warn vs base 34 / 19 → −1 error, 0 new** |
| diff scoped | ✅ `TripPlannerAI.tsx`, `page.tsx` (+ this report) |

---

## Result
The planner panel is dissolved. Each scan API is now a top-level peer section
(Hotels / Ground Transport / Activities / Places) rendered by `<TripApiSection>`
(Places combining all Google categories into one) off `TripScanContext`, peer to
a chrome-matched standalone Flights. A "Destinations & Dates" control bar (chips +
dates + Refresh) drives them all. Order is TripHeader → Map → Itinerary →
Destinations & Dates → Flights → Hotels → Ground Transport → Activities → Places →
Committed Budget → Crew → Commit. No new state, fetches, or paid calls; the
provider stays unmounted for gated users; Duffel, Committed Budget, Crew, and
Commit are untouched. PR-28e2 will do the aesthetic pass.
