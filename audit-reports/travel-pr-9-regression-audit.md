# Travel PR-9 Regression Audit

**Status:** Read-only. Findings + proposed fixes for PR-10. No code changes.
**Branch:** `claude/travel-pr-9-regression-audit`
**Scope:** 4 issues visible on post-PR-9 Bali scan + 1 bonus TZ bug.

## Summary

| # | Issue | Severity | Fix size | Root cause |
|---|---|---|---|---|
| 1 | Adventure carousel still shows "Sports & Fitness" | Cosmetic | ≤1 line (or zero — likely cache) | No in-code source of "Sports & Fitness" remains; very likely stale browser bundle / Vercel edge cache |
| 2 | Viator `/search/freetext` BAD_REQUEST "Invalid value format for field: destination" on 3 categories | Blocker for 3 carousels | 1 line | PRE-EXISTING bug exposed by PR-9's orchestration reversal — `productFiltering.destination` is sent as a nested object Viator rejects |
| 3 | "Sports & Fitness" carousel returns 400 "Valid category required" | Blocker for 1 carousel | 1 line | Client bundle still carries old key `sports_fitness`; server (post-PR-9) only knows `adventure`; route validator at line 151 has no alias resolution |
| 4 | Accommodation 0 hotels — whole-trip dates sent to LiteAPI | Blocker for multi-leg trips | **Feature-sized** | Schema (`trip_destinations`) has **no startDate/endDate columns** — there is no per-leg date model |
| 5 | (Bonus) "Date off by one day" on flights / itinerary | Cosmetic but user-visible | 1 line per site | `new Date(y, m-1, d).toISOString().split('T')[0]` in `ItineraryComparison.tsx:91` — local-time → UTC slice loses a day for positive-TZ users |

---

## Issue 1 — Adventure UI label still reads "Sports & Fitness"

### Where the carousel label is rendered

`src/components/trips/TripPlannerAI.tsx:847-868`

```ts
{CAROUSEL_ORDER
  .filter(catKey => ACTIVE_SCAN_SET.has(catKey))
  .map(catKey => {
    ...
    const coa = TRAVEL_COA[catKey];
    const info = CATEGORY_INFO[catKey];
    const label = info?.label || coa?.label || catKey;    // ← line 853
    ...
    return <TravelCarousel ... label={label} ... />;
```

Label sources in priority order:
1. `CATEGORY_INFO[catKey]?.label` — `CATEGORY_INFO` (TripPlannerAI.tsx:66-77) is a hardcoded map of legacy keys (`lodging`, `brunchCoffee`, `wellness`, etc.); **does NOT contain `adventure` or `sports_fitness`** → falls through.
2. `TRAVEL_COA[catKey]?.label` — `TRAVEL_COA.adventure.label` (travelCOA.ts:85) = `'Adventure'` ✓
3. `catKey` fallback.

### Post-PR-9 state

- `CAROUSEL_ORDER` (TripPlannerAI.tsx:880-889) — `'adventure'` ✓ (renamed in PR-9)
- `TRAVEL_COA` keys — `'adventure'` ✓; `.label = 'Adventure'` ✓
- `getActiveScanCategories` (travelCOA.ts:278) iterates `TRAVEL_COA` keys → returns `'adventure'` ✓

### Diagnosis

A repo-wide grep for the literal string `"Sports & Fitness"` finds **only one match**, in the legacy alias resolver at `travelCategories.ts:32` (`sports_fitness: 'adventure'`) — and that's a key, not a label. **There is no code path that can render "Sports & Fitness" after PR-9.**

The most plausible explanation is **stale client bundle / browser cache**: the user's tab is still running the pre-PR-9 JS, where `CAROUSEL_ORDER` had `'sports_fitness'` (which then mapped to `coa?.label` for the old TRAVEL_COA entry, "Sports & Fitness"). This neatly explains Issue 3 too — the old client sends `category: 'sports_fitness'` to the new server, which rejects it.

### Proposed fix

- **Primary:** hard reload after Vercel deploys PR-9 (Cmd-Shift-R). Confirm "Adventure" appears.
- **Defensive (optional):** add `'adventure': { label: 'Adventure', icon: '' }` to `CATEGORY_INFO` so the lookup never depends on the COA fallback. One line at TripPlannerAI.tsx:77.

If "Sports & Fitness" persists after a forced reload **and** the new bundle confirmed loaded, escalate — there's an undiscovered label source.

---

## Issue 2 — Viator `/search/freetext` "Invalid value format for field: destination"

### Current request body

`src/lib/viatorClient.ts:277-289`

```ts
async function searchV2Freetext(searchTerm: string, destId: number | null, maxCount: number, start: number = 1): Promise<ViatorProduct[]> {
  const body: Record<string, any> = {
    searchTerm,
    searchTypes: [{ searchType: 'PRODUCTS', pagination: { start, count: Math.min(maxCount, 50) } }],
    currency: 'USD',
    productSorting: { sort: 'REVIEW_AVG_RATING', order: 'DESCENDING' },
  };
  if (destId) {
    body.productFiltering = { destination: { type: 'DESTINATION', destId } };    // ← line 288
  }
  ...
```

### Why PR-9 exposed it

Pre-PR-9 (audit `travel-viator-category-filter-audit.md`), the orchestrator ran `/products/search` first; for popular destinations that returned ≥1 result, the gate at the old line 364 (`if (allProducts.length < maxResults)`) short-circuited and **`/search/freetext` never ran**. PR-9's Fix 1 (`viatorClient.ts:351-374`) **promoted freetext to primary**, so now every Viator carousel call hits this path — exposing the latent malformed body.

### Why the body shape is wrong

Viator V2's `/search/freetext` endpoint expects `productFiltering.destination` as either:

- **a plain number** (`destination: <destId>`), or
- **an object keyed by `id`** (`destination: { id: <destId> }`)

depending on documentation revision. The current `{ type: 'DESTINATION', destId }` form mixes two different schemas — that's the "search filter" object used in tag-based filter discovery, not freetext product filtering. The `destId` key (instead of `id` / `destinationId`) is also non-standard.

The `destId` parameter is a `number` (from `preResolvedDestId` in destinations.ts, which is statically typed `viatorDestId?: number`).

### Proposed fix (1 line)

`viatorClient.ts:288` — try the simpler form first:

```ts
body.productFiltering = { destination: destId };
```

If Viator still rejects with the same error, fall back to:

```ts
body.productFiltering = { destination: { id: destId } };
```

`/products/search` (line 251) keeps `filtering.destination: String(destId)` unchanged — that endpoint *does* accept the stringified-id form (proven by the pre-PR-9 working state).

---

## Issue 3 — "Sports & Fitness" → 400 "Valid category required"

### Where it originates

`src/app/api/trips/[id]/ai-assistant/route.ts:147-153`

```ts
// Accept COA keys, legacy CATEGORY_SEARCHES keys, or interest slugs
const isCOACategory = !!TRAVEL_COA[category];
const isLegacyCategory = !!CATEGORY_SEARCHES[category];
const isInterestCategory = !!ACTIVITY_SEARCH_EXPANSIONS[category];
if (!category || (!isCOACategory && !isLegacyCategory && !isInterestCategory)) {
  return NextResponse.json({ error: 'Valid category required' }, { status: 400 });
}
```

When the client sends `category: 'sports_fitness'`:
- `TRAVEL_COA['sports_fitness']` → `undefined` (renamed to `adventure` in PR-9).
- `CATEGORY_SEARCHES['sports_fitness']` → almost certainly undefined (legacy map uses keys like `brunchCoffee`, `motoRental`).
- `ACTIVITY_SEARCH_EXPANSIONS['sports_fitness']` → undefined (interest slugs).

→ 400.

### Does PR-9's alias resolver fire here?

**No.** PR-9's alias rows live in `travelCategories.ts:31-32`:

```ts
sportsFitness: 'adventure',
sports_fitness: 'adventure',
```

The only consumer of those aliases is `resolve()` in `travelCategories.ts:55`, called from `getCategoryByKey` / `getCOACode` / `getSection` / `getCalendarColor` / `getCalendarLabel` / `legendGroupFor` — **none of which the route's validator imports**. The route reads `TRAVEL_COA[category]` directly.

### Why this is happening at all

Same root as Issue 1: the user's browser bundle still has the pre-PR-9 `CAROUSEL_ORDER` (with `'sports_fitness'`), so the scan iteration POSTs `category: 'sports_fitness'`.

### Proposed fix (1 line, defensive)

Option A — alias-resolve at the route entry. Add an import and one line at `route.ts:148`:

```ts
import { getCategoryByKey } from '@/lib/travelCategories';
// ...
const resolvedKey = getCategoryByKey(category)?.key || category;
const isCOACategory = !!TRAVEL_COA[resolvedKey];
// (and pass resolvedKey downstream instead of `category`)
```

Option B (smaller, simpler) — add `sports_fitness` back to TRAVEL_COA as a duplicate entry pointing at the same metadata (kept until all clients drain). Two lines.

Option C — accept that this only happens with stale bundles and rely on Vercel deploy hard-reload. Risk: any persisted client-side state (localStorage, indexedDB) carrying `'sports_fitness'` still breaks.

**Recommended:** Option A — surgical, propagates to all downstream consumers, costs ~3 lines.

---

## Issue 4 — Accommodation 0 hotels (whole-trip dates → LiteAPI)

### How dates are currently derived

`src/app/api/trips/[id]/ai-assistant/route.ts:185-203`

```ts
const trip = await prisma.trips.findFirst({
  where: { id: tripId },
  select: { startDate: true, endDate: true },
});
if (!trip?.startDate || !trip?.endDate) {
  throw new Error('Trip dates required for hotel search — set Start/End on the trip first');
}
const participantCount = await prisma.trip_participants.count({ where: { tripId } });
const adults = Math.max(1, participantCount);
const checkin = trip.startDate.toISOString().slice(0, 10);      // ← line 194
const checkout = trip.endDate.toISOString().slice(0, 10);       // ← line 195
```

For a trip with `startDate=2026-07-01, endDate=2027-01-01` (Bali Jul 1-31, Singapore later, Phuket later …), LiteAPI receives `checkin=2026-07-01, checkout=2027-01-01`. **185 nights.** Almost no property holds availability that long → 0 results. Pre-PR-9 (cityName) returned 1 marginal property; post-PR-9 (coords) the radius search returns 0 because the date-range filter culls the entire pool.

### Where are per-leg dates stored?

**They aren't.** Schema check:

`prisma/schema.prisma:698-714`

```prisma
model trip_destinations {
  id             String   @id @default(cuid())
  tripId         String
  resortId       String?
  name           String?  @db.VarChar(255)
  country        String?  @db.VarChar(100)
  latitude       Decimal? @db.Decimal(10, 7)
  longitude      Decimal? @db.Decimal(10, 7)
  isSelected     Boolean  @default(true)
  estimatedTotal Decimal? @db.Decimal(12, 2)
  createdAt      DateTime @default(now())

  trip trips @relation(fields: [tripId], references: [id], onDelete: Cascade)

  @@unique([tripId, resortId])
  @@index([tripId])
}
```

No `startDate` / `endDate`. The destinations POST handler (`src/app/api/trips/[id]/destinations/route.ts:311-335`) writes only `tripId, resortId, isSelected` / `tripId, name, country, latitude, longitude, isSelected`. No date capture anywhere in the destinations CRUD path.

**This is a feature-sized fix, not a one-liner.**

### Proposed plan (three tiers)

**(i) Interim quick-fix — even split (10 min, no schema change):**

When ≥2 `trip_destinations` exist, split the whole-trip window evenly across destinations by index. The route accepts an optional `destinationIndex` and `destinationCount` from the client, computes the leg dates, and forwards those to LiteAPI. Approximate but unblocks the user immediately. Trades 100% wrong dates for ~70% right dates.

**(ii) Better interim — first-week window (5 min, no schema change):**

For LiteAPI specifically, cap the search window to the first 7 days from `trip.startDate`. Surfaces inventory the user can then re-search with explicit dates when they actually book. Discards multi-destination granularity but at least the cardinality is realistic.

**(iii) Proper fix — first-class per-leg dates (feature, 1 PR):**

1. **Schema migration:**
   ```prisma
   model trip_destinations {
     ...
     startDate  DateTime?  // leg arrival
     endDate    DateTime?  // leg departure
     orderIndex Int        @default(0)  // for sequence display
   }
   ```
2. **Destinations CRUD route** — accept + persist `startDate`, `endDate`, `orderIndex` in POST/PATCH.
3. **TripCreationBar.tsx** — wire a per-destination date picker next to each destination chip.
4. **ai-assistant route** — accept optional `destinationId` in the request body; when present, load that `trip_destinations` row, use its `startDate`/`endDate` for LiteAPI; fall through to `trip.startDate/endDate` when missing (back-compat).
5. **TripPlannerAI.tsx** — when there are ≥2 destinations, the carousel scan iterates per destination tab and passes `destinationId` per call.

Recommended order for PR-10: ship **(ii) first-week window** as a 5-minute patch to stop the bleeding, queue **(iii) proper fix** as PR-11.

---

## Issue 5 (Bonus) — "Date off by one day" on flights / itinerary

### Cite

`src/components/trips/ItineraryComparison.tsx:85-94`

```ts
const tripDates = useMemo(() => {
  if (!startDay) return null;
  const dates: string[] = [];
  for (let i = 0; i < daysTravel; i++) {
    const d = new Date(year, month - 1, startDay + i);    // ← LOCAL time
    dates.push(d.toISOString().split('T')[0]);            // ← UTC slice — line 91
  }
  return dates;
}, [startDay, month, year, daysTravel]);
```

`new Date(y, m-1, d)` is local-time midnight. `.toISOString()` projects to UTC. For users in TZ ahead of UTC (Asia / AU / NZ), local midnight on Jul 1 → UTC Jun 30 ~16:00 → `.split('T')[0]` = `'2026-06-30'`. **The displayed date shifts backward one day.** Classic JS Date-only TZ bug.

Worth flagging: most US users are TZ-behind-UTC where this **shifts forward**, hiding the bug; it surfaces on travel itineraries because users plan trips while temporarily in the destination's timezone (Bali = UTC+8).

### Proposed fix (1 line)

Replace `d.toISOString().split('T')[0]` with a local-time formatter:

```ts
const y = d.getFullYear();
const m = String(d.getMonth() + 1).padStart(2, '0');
const day = String(d.getDate()).padStart(2, '0');
dates.push(`${y}-${m}-${day}`);
```

Or, more concisely (Node 20 / modern browsers):

```ts
dates.push(d.toLocaleDateString('en-CA'));  // 'YYYY-MM-DD' in local TZ
```

### Scope estimate

Single hot-spot today (`ItineraryComparison.tsx:91`). Sweep the codebase for `toISOString().slice(0, 10)` / `toISOString().split('T')[0]` patterns when fixing — there are similar sites in `ai-assistant/route.ts:194-195`, but those operate on Prisma-returned `Date` objects whose underlying ISO string was already `T12:00:00`-anchored at write (`src/app/api/trips/[id]/route.ts:188`), so they are TZ-safe **for trips dates only**. New date-only fields added in PR-11 should follow the same `T12:00:00` write convention or move to plain string columns.

---

## Recommended order for PR-10

1. **Issue 2** (1-line, unblocks 3 carousels) — Viator freetext destination format. Highest blast radius, lowest cost.
2. **Issue 3** (3-line, defensive alias) — route validator alias resolution. Unblocks remaining 1 carousel for stale bundles.
3. **Issue 4 (ii)** (5-line stopgap) — first-week LiteAPI window so Accommodation isn't empty while PR-11 lands.
4. **Issue 5** (1-line) — TZ fix in ItineraryComparison; sweep for sibling sites.
5. **Issue 1** — verify resolved by 2+3+hard-reload; only add the `CATEGORY_INFO['adventure']` defensive entry if it persists.

**Defer to PR-11:** Issue 4 (iii) proper per-leg dates feature — schema migration + UI date pickers + route plumbing.
