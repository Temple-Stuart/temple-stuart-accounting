# TRAVEL — PR-28e1b Audit: render per-API peer sections + Destinations & Dates control bar

**Branch:** `claude/travel-pr-28e1b-audit`
**Date:** 2026-05-31
**Mode:** READ-ONLY.
**Goal:** Break the "Trip Planner & Budget" panel into **peer top-level sections**
— Hotels (LiteAPI) / Ground Transport (Mozio) / Activities (Viator) / Places
(Google) — each peer to Flights (Duffel), each with its own header/badge/count/28b
filters. Move the shared scaffolding (destination chips + per-location dates +
Refresh) into a **"Destinations & Dates"** control peer section above them.
Reorder. State already lifted to `TripScanContext` (PR-28e1a) — this is the
**structural render only** (aesthetics = PR-28e2).

Builds on `audit-reports/travel-pr-28e1-audit.md` (which recommended the
28e1a/28e1b sub-sequence) and `travel-pr-28e1a-impl.md` (the completed lift).

---

## 1. Current render — post-28e1a

### 1a. `TripPlannerAI` now consumes the context (not props)

After 28e1a, the default export takes **no props** and reads everything from
`useTripScanCtx()`:

- `src/components/trips/TripPlannerAI.tsx:775` — `export default function TripPlannerAI()`
- `:776-778` — `const { … } = useTripScanCtx();` (router, loading, byCategory,
  loadingCategories, categoryErrors, rescanAll, the modals' state, the derived
  `checkinVal/checkoutVal/datesValid/activeCity`, etc.)
- The provider/hook glue lives in the same file: `useTripScanState(input)` (the
  engine + all state), `TripScanContext` (`:762`), `export function
  TripScanProvider({ input, children })` (`:764-767`), `useTripScanCtx()`
  (`:769-773`).

The default export's JSX (`:779-967`) is **byte-identical** to the pre-28e1a
component (proven in 28e1a). It renders, in order:

1. **Trip-context header** (`:783-829`) — the city label (`:785`), the
   no-trip-dates warning (`:790-792`), the **per-location check-in/check-out date
   inputs** (`:796-815`, write `setPerLocationDates`), the dates-valid warning
   (`:816-818`), the **"Loading N of M…"** indicator (`:819-823`), and the
   **Refresh** button (`:824-827`, calls `rescanAll`).
2. **Global error banner** (`:833`).
3. **Edit Selection modal** (`:836-885`) and **Custom Add modal** (`:888-929`).
4. **The section loop** (`:937-964`): a single
   `<div className="space-y-6 pt-2">` wrapping
   `CAROUSEL_ORDER.filter(catKey => ACTIVE_SCAN_SET.has(catKey)).map(...)` →
   one `<TravelCarousel>` per category (`:949-961`), each fed
   `isLoading = loadingCategories.has(catKey)` (`:941`),
   `items = byCategory[catKey] || []` (`:942`),
   `error = categoryErrors[catKey]` (`:943`),
   `source = getSource(catKey).source` (`:947`), and an `onCardClick` that
   `router.push`es to the discover detail route (`:957-960`).

### 1b. `page.tsx` mounts it inside the "Trip Planner & Budget" panel

- `src/app/budgets/trips/[id]/page.tsx:9` — `import TripPlannerAI, {
  TripScanProvider } from '@/components/trips/TripPlannerAI';`
- **Panel wrapper** `:1017` — `<div id="trip-planner-section" className="rounded-lg
  overflow-hidden border border-gray-200/50 shadow-sm">`; **header band** `:1018`
  (`Trip Planner &amp; Budget`); **body** `:1019` (`bg-white p-4`).
- **Scan chips** `:1021-1044` — `<span>Scan:</span>` (`:1023`) + `destinations.map`
  pills calling `selectDestination(d.resortId, name)` (`:1024-1033`) + a `compact`
  `<DestinationSelector … onSelectDestination={selectDestination}>` (`:1034-1042`).
  Empty-state `<DestinationSelector>` at `:1045-1056`.
- **Pro+ gate + mount** `:1057-1084` — an IIFE computes `selectedDest`
  (`:1058`), shows the upgrade card for free/pro non-admins (`:1060-1065`), else
  mounts **`<TripScanProvider input={{ tripId, city, country, activity, month,
  year, daysTravel, tripDates, onCommitted }}>`** (`:1067-1079`) wrapping
  **`<TripPlannerAI />`** (`:1080`).

**Crux:** today the provider wraps **only** `<TripPlannerAI />`, *inside* the
panel body. The chips live in `page.tsx` and drive `trip.destination` via the
page's `selectDestination` (`:325`); that page state then feeds `input.city`
into the provider. So the chips already sit **outside** the provider and
communicate with it only through the `input.city` prop — an important fact for §3.

## 2. Per-API split — one `TripApiSection` vs inline peers

The section loop (§1a-4) is already **per-category**: each iteration computes
`isLoading/items/error/source` from context and renders one self-contained
`<TravelCarousel>` (`:1221`). `TravelCarousel` already owns the full per-section
chrome:

- header row (`:1242-1248`): **label** (`:1244`) + **source badge**
  (`:1245`, `badgeFor(source)` `:1231-1238`) + **count** "N results" (`:1247`);
- body (`:1249-1285`): error banner (`:1250-1251`) / loading skeleton
  (`:1252-1261`) / **honest empty state** (`:1262-1267`, `getEmptyMessage(source)`)
  / the card grid (`:1270-1273`) + **28d Load-more** (`:1275-1282`);
- **28b filters**: local `filter` state (`:1224`) + `<SectionFilterBar source
  items filter onChange>` (`:1251` of the loop / def `:1116`), with `shown`
  load-more reset on `[filter, items]` (`:1225-1227`).

**Because each category already reads `byCategory[catKey]` from context and
renders a stand-alone card, lifting to peer level is a *relocation*, not a
rewrite.** Two viable approaches:

**Option A (recommended) — a thin `<TripApiSection catKey>` wrapper.** A small
component that calls `useTripScanCtx()`, derives the same five values the loop
derives today (`:941-947`), wraps `<TravelCarousel>` in the **Flights chrome**
(§4), and renders the `onCardClick` router push. `page.tsx` then renders one
`<TripApiSection catKey="accommodation"/>`, `…="ground_transport"`, `…="activities"`,
and one per Google cat — each a page-level peer. Keeps the per-API derivation in
one place (DRY) and matches Flights' card shell exactly.

**Option B — inline peers in `page.tsx`.** Map `CAROUSEL_ORDER` directly in
`page.tsx` inside the provider, each iteration rendering the Flights shell +
`<TravelCarousel>`. Fewer files but pushes context reads + the catKey→source
derivation into `page.tsx`, and `TravelCarousel`/helpers are **not exported**
today (they're module-private in `TripPlannerAI.tsx`), so this forces exporting
them. **Option A localizes those exports behind one component** and is the
cleaner seam.

Either way **Hotels stays carousel + 28d load-more** (no change to
`TravelCarousel`; `accommodation` → `source='liteapi'` via `getSource` `:984-988`).

**CAROUSEL_ORDER → API mapping** (`:975-988`): `accommodation`→LiteAPI (Hotels),
`ground_transport`→Mozio, `activities`→Viator, `food/entertainment/wellness/
shopping/tours`→Google Places. `ACTIVE_SCAN_SET` (`:984-986`) gates which render.

> **Open question for §7:** Google is **five** catKeys (food/entertainment/…).
> Do they become five separate "Places" peer sections (one per cat, as today),
> or one consolidated "Places" peer? Today they're five separate carousels. The
> task names a single "Places (Google)" section — this needs Alex sign-off
> (see What needs sign-off #2).

## 3. "Destinations & Dates" control bar — what moves, from where

A new control peer section (matching the Flights shell, §4) holding three pieces
that **already exist**, all reading/writing `TripScanContext` except the chips:

| Piece | Lives now | Moves to | Reads/writes |
|---|---|---|---|
| **Scan chips + DestinationSelector** | `page.tsx:1021-1056` | control bar | page `selectDestination` (`:325`) → sets `trip.destination` → feeds provider `input.city`. **Stays page-level** (no context dependency); only its *position* moves. |
| **Per-location check-in/out dates** | `TripPlannerAI:796-815` (the trip-context header) | control bar | `setPerLocationDates` + `checkinVal/checkoutVal/activeCity/datesValid` from `useTripScanCtx()` |
| **Refresh + "Loading N of M"** | `TripPlannerAI:819-827` | control bar | `rescanAll`, `loading`, `loadingCategories.size`, `totalCategories` from context |

So the control bar is essentially the **existing trip-context header**
(`TripPlannerAI:783-829`) hoisted to page level **plus** the chips block
(`page.tsx:1021-1056`) folded in. The date inputs + Refresh must read context, so
the control bar must render **inside `<TripScanProvider>`** (see §3a). The chips
can stay where they are functionally (page `selectDestination`); only their DOM
position changes.

### 3a. Provider scope must widen — the key structural move

Today `<TripScanProvider>` wraps **only** `<TripPlannerAI />` (`page.tsx:1067-1081`).
For 28e1b the provider must wrap **the control bar + all API peer sections** so
each consumes the same scan state. Concretely: hoist `<TripScanProvider
input={{…}}>` up to enclose the new control section *and* the Hotels / Ground /
Activities / Places peers (and, if desired, leave Flights outside since it has
its own data path). The `input={{…}}` object (`:1068-1078`) is unchanged; only
the **wrapped region grows**. The Pro+ gate (`:1060-1065`) stays the entry guard.

## 4. Flights peer-section chrome — the template to match

`page.tsx:997-1014`:
```tsx
{/* ── Flights ── */}
{tripDates && trip.destination && (
  <div className="rounded-lg overflow-hidden border border-gray-200/50 shadow-sm">
    <div className="bg-brand-purple/80 text-white px-4 py-2.5 text-sm font-semibold">Flights</div>
    <div className="bg-white p-4"><FlightPicker … /></div>
  </div>
)}
```
**Shell:** `rounded-lg overflow-hidden border border-gray-200/50 shadow-sm` →
`bg-brand-purple/80 … font-semibold` header band → `bg-white p-4` body. The same
shell wraps Committed Budget (`:778`), the planner panel (`:1017-1019`), and
Commit to Ledger (`:1088-1090`). Each new API peer + the control bar uses **this
exact shell** (structural parity; restyle = 28e2). Note the per-section
**source badge + count** already live *inside* `TravelCarousel`'s own header
(`:1242-1247`), nested below the purple band — consistent with the task's
"own header/badge/count/28b filters."

## 5. Reorder — current vs target page tree

**Current** (`page.tsx`):
`TripHeader` (`:659`) → Map/Itinerary (`~:674-738`) → **Committed Budget**
(`:741`/band `:778`) → **Crew** (band `:859`) → **Flights** (`:997`) → **Trip
Planner & Budget** panel (chips + all APIs, `:1016-1086`) → **Commit to Ledger**
(`:1088`/band `:1090`).

**Target:**
```
TripHeader
Map
Itinerary
[Destinations & Dates]   ← new control peer (chips + dates + Refresh)
Flights                  (Duffel — existing peer, moves UP)
Hotels                   (LiteAPI — lifted; carousel + 28d load-more + 28b)
Ground Transport         (Mozio — lifted; 501 "coming soon")
Activities               (Viator — lifted; 28b + load-more)
Places                   (Google — lifted; 28b)        [1 or 5 sections — see §2]
Committed Budget         (existing peer — unchanged)
Crew                     (existing peer — unchanged)
Commit to Ledger         (existing — unchanged)
```
**What moves:** Flights rises from below Crew to just under the control bar; the
API carousels leave the planner panel to become peers above Committed Budget; the
**"Trip Planner & Budget" panel wrapper dissolves** (its chrome `:1017-1019` +
title `:1018` disappear; the "& Budget" label was always just text — the real
**Committed Budget** peer at `:778` is independent and **stays put**, per
28e1-audit §5). **Committed Budget + Crew remain intact peers** — their JSX is
untouched, only their relative position (now after the API sections) changes.

## 6. Ground Transport + Google honest states — preserved

Both render through the **same** `TravelCarousel` → `getEmptyMessage(source)`
(`:1042-1053`), so peer-lifting preserves them verbatim:

- **Ground Transport (Mozio, 501):** `source='mozio'` → empty state **"Ground
  transport search coming soon."** (`:1047`), amber badge (`badgeFor` `:1235`).
  The unwired 501 path surfaces as this honest coming-soon, not an error — and
  continues to as a peer.
- **Google (quota/429):** `source='google'` → if the scan errors,
  `categoryErrors[catKey]` renders the **red error banner** (`:1250-1251`,
  fail-loud, no masking); if it simply returns nothing, the empty state **"No
  places found. Try refreshing or adjusting filters."** (`:1048`). A 429 propagates
  as the inline error banner per category — unchanged.

Because the honest states are computed inside `TravelCarousel` from `source` +
`error` + `items`, moving the carousel to a peer section changes **nothing** about
them. (LiteAPI hotels: `:1045`; Viator: `:1046` — same.)

## 7. Scope + risk

**Lower than 28e1a** — the state is already lifted; this is a render/relocation
PR with no engine surgery.

**Files:**
- `src/app/budgets/trips/[id]/page.tsx` — the bulk: widen `<TripScanProvider>`
  scope (§3a), add the **Destinations & Dates** control peer (fold in chips
  `:1021-1056`), render the **Hotels/Ground/Activities/Places** peer sections in
  the Flights shell, move Flights up, **delete the "Trip Planner & Budget" panel
  wrapper** (`:1017-1019,:1085-1086`). Committed Budget / Crew / Commit JSX
  untouched (only reordered).
- `src/components/trips/TripPlannerAI.tsx` — extract the trip-context header
  (`:783-829`) into a control-bar component reading context, and (Option A) add a
  `<TripApiSection catKey>` wrapper; **export** it (+ whatever the control bar
  needs). `TravelCarousel`/`SectionFilterBar`/`getSource`/`getEmptyMessage`/
  `CAROUSEL_ORDER`/`ACTIVE_SCAN_SET` stay; only their **call sites** move. The
  default export `TripPlannerAI()` is largely **dissolved** (its header → control
  bar; its loop → peer sections; its two modals must still render somewhere under
  the provider — likely hosted by the control bar or a small modal-host).
- **New (Option A):** `TripApiSection` + a `TripScanControls`/Destinations&Dates
  component (can be co-located in `TripPlannerAI.tsx` to reuse the module-private
  helpers without new exports, mirroring 28e1a's co-location choice).

**Estimate:** ~150-300 lines moved across 2 files (1 new component each, no new
file strictly required if co-located). **0 schema, 0 deps, 0 route change, 0 new
paid calls** (same scan engine, same `rescanAll`).

**Risks:**
1. **Provider scope move** — if the provider remounts at a different position,
   `useTripScanState`'s mount auto-scan effect could re-fire. Mitigate: hoist the
   provider once around the whole region and keep `input` referentially stable
   (same object shape as `:1068-1078`).
2. **The two modals** (Edit `:836-885`, Custom `:888-929`) live in the dissolved
   default export — they must keep rendering under the provider (they read
   `editingSelection`/`customCategory` from context). Re-home them deliberately.
3. **Chips ↔ provider coupling** — chips drive `trip.destination` (page) →
   `input.city` → provider re-derives. Keep that wire intact when relocating the
   chips into the control bar.
4. **Google 1-vs-5 sections** (§2) — a behavior-visible choice; confirm before
   building.

## What needs Alex sign-off
1. **Split mechanism** — Option A (`<TripApiSection>` + control component,
   co-located, recommended) vs Option B (inline in `page.tsx`, forces exporting
   `TravelCarousel` + helpers).
2. **Google: one "Places" peer vs five** (food/entertainment/wellness/shopping/
   tours) — today it's five carousels; the target names a single "Places."
3. **Flights in or out of the provider** — Flights has its own data path
   (`FlightPicker`); confirm it stays a sibling peer outside `TripScanContext`.
4. **Where the Edit/Custom modals re-home** (control bar host vs a dedicated
   modal host under the provider).
5. **Confirm the planner panel fully dissolves** (no thin wrapper retained) and
   the target order in §5 (Flights up; APIs above Committed Budget; Committed
   Budget + Crew + Commit unchanged).

---

**READ-ONLY audit. No implementation performed.**
