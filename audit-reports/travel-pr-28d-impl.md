# TRAVEL — PR-28d Implementation: larger population + load-more

**Branch:** `claude/travel-pr-28d`
**Date:** 2026-05-30
**Scope:** Hotels fetch 33→50; client-side load-more reveals already-fetched
results (incl. Viator's ~250); counts reflect filtered totals. 1 file + report.
0 schema, 0 deps, **no route change**, no new paid calls beyond the hotel
33→50 bump.

---

## STEP 1 — Current fetch vs render limits

| Source | Fetched | Rendered (before) |
|---|---|---|
| **Hotels** (LiteAPI) | `maxResults` = client `33` (`route.ts:190`) → `searchHotelRates` `slice(0,33)` (`liteapiClient.ts:302-303`) → route `.slice(0,33)` (`route.ts:278`) | `visible.slice(0, 12)` (`TripPlannerAI:1253`) |
| **Activities** (Viator) | `Math.max(maxResults, 250)` = **250** (`route.ts:321`), `.slice(0,250)` (`:331`) | `visible.slice(0, 12)` — so "236 activities" in the count but only 12 cards |
| **Google** | `33` (`enrichPlaceDetails(places, 33)`, `route.ts:80`) | `visible.slice(0, 12)` |

Client sent a uniform `maxResults: 33` for every category (`TripPlannerAI:334`).

## STEP 2 — Render more of what's already fetched (free)

The render slice `visible.slice(0, 12)` (`TripPlannerAI:1261`) hid most of the
**already-fetched** Viator (~236) and hotel results. PR-28d pages through the
fetched `visible` set via client-side load-more — **no extra API call**. (Viator
needed nothing more than this to surface its 250.)

## STEP 3 — Hotels 33→50 + load-more

- **Fetch bump (1 line):** `TripPlannerAI:331-336` — `maxResults` is now
  per-category: **`key === 'accommodation' ? 50 : 33`**. So hotels fetch 50;
  **Google stays 33** (quota-limited — not increased); Viator ignores the client
  value and forces 250 server-side. **No route change** (the route already honors
  the client `maxResults`; the `|| 33` default is just a fallback). This is a
  slightly larger single hotel fetch (B-5100 marginally higher), **not a new
  call.**
- **Load-more (client-side, no re-query):** `TravelCarousel` now keeps
  `const [shown, setShown] = useState(12)` (`TripPlannerAI:1199-1201`) and renders
  `visible.slice(0, shown)` (`:1262`). A **"Load more (N more)"** button
  (`:1373-1380`) does `setShown(s => s + 12)` — it only **reveals already-fetched
  results**, never re-queries. When `shown >= visible.length` the button hides.

> **⚠ Cost check:** load-more is **purely client-side reveal** of the fetched
> set — it **never triggers a new paid API call**, so no Alex sign-off was
> needed. The only paid change is the hotel fetch 33→50 (an explicitly-approved
> bump, one larger call, not an extra call). Google calls are unchanged.

## STEP 4 — Counts + filters compose with load-more

- The header **count = `visible.length`** (the filtered total, `:1206`) —
  unchanged by paging.
- **Filters (28b) operate over the full fetched set** (`filterRecs(items, …)`,
  `:1196`); **load-more pages the filtered result** (`visible.slice(0, shown)`).
- **Reset on filter/scan:** `useEffect(() => setShown(PAGE), [filter, items])`
  (`:1202`) — changing a filter (or a fresh scan) returns to page 1, so the user
  never lands mid-page on a stale slice. Composes correctly.

---

## Hard-constraint compliance

| Constraint | Status |
|---|---|
| Prefer rendering already-fetched (free) over new fetches | ✅ load-more is client-side reveal only |
| New paid call → flag, don't silently fire; Google NOT increased | ✅ load-more makes no call; only hotels 33→50 (one larger call); Google stays 33 |
| Don't break 28b filtering or 28a structure | ✅ count + filterRecs intact; load-more pages the filtered `visible` |
| 0 schema, 0 deps, no route change | ✅ `route.ts` not in diff |
| `tsc --noEmit` | ✅ exit 0 |
| eslint | ✅ TPA err 1 / warn 27 — **identical to main** (0 new; the 1 error is pre-existing) |
| git diff scoped | ✅ `TripPlannerAI.tsx` (+ report) only |

---

## Result
Hotels now fetch 50 (was 33), and every section reveals its full already-fetched
inventory via a client-side "Load more" — so Activities surfaces its ~236
results and hotels their 50, 12 at a time, with **zero extra API calls** (only
the hotel fetch grew 33→50). The PR-28a counts and 28b filters compose: counts
show the filtered total, filters narrow the whole fetched set, and load-more
pages the filtered result (resetting to page 1 on filter/scan change).
