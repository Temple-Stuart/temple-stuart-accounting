# Discover Resolve-by-ID Fix Viability — Audit (READ-ONLY)

**Date:** 2026-06-07
**Branch:** `claude/audit-discover-resolve-by-id`
**Scope:** Read-only. No application code modified. Only this report was created.
**Method:** Every claim cites `file:line`. Anything not read is marked **NOT VERIFIED**.
**Path note:** the route lives at `src/app/budgets/trips/[id]/discover/[category]/[rank]/page.tsx` (the brief's `discover/[category]/[rank]` shorthand).

> **Bottom line up front:** The collision is purely the **missing destination dimension**. Both
> candidate fixes must *still* use `valueRank` to pick the rec **within** a row (valueRank is unique
> per row). **Fix A (row id)** is harder than it looks: the row id is **not present** in the rec at
> link-build time, the client load **discards** it, and the fresh-scan endpoint **never returns** it —
> so Fix A needs an API change plus client threading. **Fix B (add destination)** uses data the
> link-builder **already holds** (`city`/`country` in context), matches the schema's existing unique
> key exactly, and changes the URL contract only (which is linked **nowhere external**).

---

## A. SCHEMA FACTS

`model trip_scanner_results` (`prisma/schema.prisma:1793-1811`):
- **Primary key:** `id String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid` (`:1794`) — a DB-generated UUID, globally unique.
- **Destination column:** `destination String @db.VarChar(200)` (`:1796`).
- **Uniqueness that makes `valueRank` per-destination:** `@@unique([tripId, destination, category])` (`:1808`). One row per (trip, destination, category); the `recommendations Json` array (`:1798`) carries its own `valueRank` values `1..N` scoped to that row. → `valueRank` collides across destinations of the same (trip, category).

**Ground truth on what the rec object carries (the JSON array element):** `interface GrokRecommendation` (`src/components/trips/TripPlannerAI.tsx:13-54`) has `valueRank` (`:28`) and `category` (`:29`) but **no `id`, no `scannerResultId`, no `destination`** field. It has an optional LiteAPI-only `city` (`:42`) — not the row's `destination` string.

**What the row's `destination` value is:** written by the scan as `` `${city}, ${country}` `` (`src/app/api/trips/[id]/ai-assistant/route.ts:285,287`).

---

## B. CALL-SITE TABLE — every link-builder into the route

Grep (`grep -rn "discover/" src/`) yields exactly **one** navigation builder; the only other hit is a nav-suppression regex (not a link).

| File:line | What it builds | Has row `id`? | Has `destination`? |
|---|---|---|---|
| `src/components/trips/TripPlannerAI.tsx:889-891` | `router.push(\`/budgets/trips/${tripId}/discover/${catKey}/${idForRoute}\`)` where `idForRoute = String(rec.valueRank ?? 0)` (`:890`) | **NO** — `rec` is a `GrokRecommendation`, no id field (`:13-54`) | **NO** in `rec`; but **YES in context** (`city`/`country`, see below) |
| `src/components/ui/AppLayout.tsx:150` | comment + regex `(\/discover\/.*)?` for nav-bar suppression (`:155`) — **not a link** | n/a | n/a |

**Where the call-site's data comes from (can id/destination be included without a new fetch?):**
- The carousel item `rec` is read from `byCategory[catKey]` (`TripPlannerAI.tsx:868`, inside `TripApiSection`).
- `byCategory` is populated two ways, **both of which drop the row id and destination**:
  1. **On mount** from `GET /api/trips/${tripId}/scanner-results` (`TripPlannerAI.tsx:250`). The loop does `loaded[r.category] = recs` (`:257`) — it keeps only the `recommendations` array, **discarding `r.id` and `r.destination`**. (It also **overwrites** when two rows share a category — see D, client-side collapse.)
  2. **On fresh scan** from `POST /api/trips/${tripId}/ai-assistant` (`scanSingleCategory`, `TripPlannerAI.tsx:310`), which returns `{ category, recommendations }` (`ai-assistant/route.ts:293`) — **no row id, no destination**.
- **The API GET already returns the row id + destination:** `prisma.trip_scanner_results.findMany({ where: { tripId: id } })` with no `select` (`scanner-results/route.ts:28-31`) → each `r` includes `id`, `destination`. So **id/destination are in the payload the client receives but thrown away at `:257`.**
- **`destination` is already reconstructable at link-build time without any fetch:** the scan context value exposes `city` and `country` (`TripPlannerAI.tsx:758`), and the row's destination is exactly `` `${city}, ${country}` `` (`ai-assistant/route.ts:287`). `TripApiSection` currently destructures `{ router, byCategory, loadingCategories, categoryErrors, tripId }` (`:865`) — it does **not** read `city`/`country` today, but they are present in the same context object and need only be added to the destructure (no new fetch).

---

## C. RESOLVER + COMMIT-PATH TRACE

### C.1 The resolver (`page.tsx:106-144`)
- Parses `tripId, category, rankStr` from params (`:106`), `wantedRank = parseInt(rankStr,10)` (`:126`).
- Query: `prisma.trip_scanner_results.findMany({ where: { tripId, category }, orderBy: { updatedAt: 'desc' } })` (`:129-132`) — **destination omitted** → returns ALL destinations' rows for that (trip, category).
- Resolution loop (`:135-143`): iterates rows (most-recently-updated first) and returns the **first** rec whose `valueRank === wantedRank`; also captures `destinationLabel = row.destination` (`:140`).
- → On a multi-destination trip, `wantedRank` matches in **whichever destination's row sorts first by `updatedAt desc`**, not the destination the user clicked. **This is the collision.**

### C.2 What depends on `rank` being in the URL
- `rec` drives the entire page render (name `:252`, gallery `:244`, pricing `:200-202`, etc.) and is passed to the commit components: `PlaceCommitForm placeName={rec.name}` (`:471`), `AddToTripButton hotelName={rec.name}` (`:451`), `ReserveHotelButton` (`:404-412`).
- `destinationLabel` (from the matched row) is passed as `location` to the commit forms (`:453,471`).
- **Nothing else** depends on `rank` — no analytics, no prefetch, no `generateMetadata`, no `generateStaticParams` in this file (not present; **verified** by reading `:1-485` in the prior travel audit and `:100-254` here). `rank` is used solely as the rec selector.

### C.3 The other commit paths
- **`handleCommitCard(rec)`** (`TripPlannerAI.tsx:523`) — takes the rec object directly and commits by the returned `optionId`; it does **not** touch the route or `valueRank`. **However it is never invoked:** `grep "handleCommitCard("` → only the definition (`:523`) and the context export (`:758`); **zero call sites**. It is currently dead code.
- **`handleSelectItem` → `confirmSelection` → `buildVendorBody`** (`:396-404`, `:460`, `:407-410`) — the active "select + schedule" path. `handleSelectItem(item)` captures the in-hand `item: GrokRecommendation` into the selection (`:398`); `buildVendorBody` reads `sel.item` (`:408`) → commits the in-hand object's name. **No rank re-resolution → no mismatch on this path.**
- → **The name-mismatch can occur ONLY via the detail-page resolver (C.1).** Every in-app path that holds the rec object directly is immune.

---

## D. READ-BACK TRACE — does a commit-time fix fully close the bug?

- **Commit storage:** `vendor-commit/route.ts` writes the name as a literal string into `trip_itinerary.vendor` (`:234,247,264`, set to `details.title`) and `budget_line_items.description` (`:215`). For synthetic Google places `details.title = notes = placeName` (`:152`).
- **Read-back:** `GET /api/trips/[id]/itinerary` returns `trip_itinerary` rows directly (`itinerary/route.ts:17-22`, `findMany`, no transform). The itinerary display renders the stored `vendor` string — **no re-query of `trip_scanner_results`, no `valueRank`/index re-derivation** anywhere in the display path (`grep "valueRank|/discover/|rank"` over `ItineraryAgenda.tsx` and `budgets/trips/[id]/page.tsx` → **0 hits**).
- → **A commit-time resolution fix fully kills the symptom.** Once the correct rec is resolved at commit, its name is frozen into `trip_itinerary.vendor` / `budget_line_items.description`, and every downstream display reads that stored string. No display path re-derives identity by rank/index.
- **Caveat (separate, client-side collapse):** the load effect `loaded[r.category] = recs` (`TripPlannerAI.tsx:257`) **overwrites** when two rows share a category, so `byCategory[category]` holds only the **last-iterated** destination's recs (GET orders by `category asc` only, `scanner-results/route.ts:30`, so among same-category rows the surviving destination is unspecified). This means a multi-destination carousel may only display **one** destination's items to click in the first place. This is a **distinct** display-level collision that neither candidate fix addresses on its own; it affects which recs are even clickable and should be considered alongside either fix.

---

## E. FIX A vs FIX B — what each would touch (FACTS, not implementation)

Both fixes share one fact: **`valueRank` is unique within a row** (`schema.prisma:1808`), so it remains the in-row selector. The collision is only the **destination/row** dimension. The two fixes differ in how they disambiguate that dimension.

### Fix A — resolve by `trip_scanner_results.id`
What exists / what it touches:
1. **Rec lacks the id today.** `GrokRecommendation` has no id (`TripPlannerAI.tsx:13-54`).
2. **Client load discards the id.** `loaded[r.category] = recs` (`:257`) keeps only the array; `r.id` is dropped (even though the GET returns it, `scanner-results/route.ts:28-31`).
3. **Fresh-scan path never returns the id.** `ai-assistant/route.ts:293` returns `{ category, recommendations }`; the `upsert` (`:284-288`) writes by composite key and does not read back `id`. → A freshly-scanned category has **no id available** until a page reload re-fetches via the GET.
4. **Link builder** (`TripPlannerAI.tsx:891`) would need the id threaded onto each rec (or onto the carousel item).
5. **Resolver** (`page.tsx:129-143`) would change to `findUnique({ where: { id } })` — but the row is a *bucket* of recs, so it **still needs `valueRank`/index** to pick the rec within the row. So Fix A is "(row id) + (valueRank within row)".
6. **Net:** an opaque row id functionally equals `(tripId, destination, category)` (the unique key, `:1808`). Touch set: `ai-assistant` return shape **(API change)**, client load threading **(2 paths: mount + fresh-scan)**, link builder, route param/shape, resolver. The **fresh-scan path cannot supply the id without the API change** — the most load-bearing fact for Fix A.

### Fix B — add `destination` to the resolution
What exists / what it touches:
1. **Destination is already available at link-build time, no fetch.** Context value exposes `city`/`country` (`TripPlannerAI.tsx:758`); the row's destination is `` `${city}, ${country}` `` (`ai-assistant/route.ts:287`). `TripApiSection` would add `city`/`country` to its existing `useTripScanCtx()` destructure (`:865`).
2. **Link builder** (`TripPlannerAI.tsx:891`) adds the destination as a new path segment or query param.
3. **Route shape** gains a destination param (new `[destination]` segment) or reads it from `searchParams` (no new segment).
4. **Resolver** (`page.tsx:129-130`) adds `destination` to the `where` → `{ tripId, destination, category }`, which **matches the schema unique key exactly** (`:1808`); the loop then picks by `valueRank` within the now-unique row.
5. **No API return-shape change** required (destination is reconstructed client-side from context).
6. **Net:** touch set is link builder + route param + resolver `where`. No change to `ai-assistant`, no client-load threading.

### URL contract (applies to either fix)
- Grep for external references to the route (`sitemap`, `share`, `email`, `mailto`, `rsvp`, `public`) → **NONE**. No `sitemap`/`robots` files exist (`find src public -iname "*sitemap*" -o -iname "*robots*"` → none). The only link builder is in-app (`TripPlannerAI.tsx:891`); the only other mention is a nav regex (`AppLayout.tsx:150`).
- → Changing the URL shape (Fix B's new segment/param, or Fix A's id) **breaks nothing external**. The one in-app builder and the one nav-suppression regex (`AppLayout.tsx:155`) are the only consumers; whether the regex still matches a changed shape is **NOT VERIFIED** against a specific new shape (the current pattern is `(\/discover\/.*)?`, which is permissive about trailing segments).

---

## F. SUGGESTIONS (not verified needs)

Auditor opinion only:

1. **Fix B is the lower-touch, lower-risk disambiguation** based on the facts above: the destination is already in hand at link-build time (`TripPlannerAI.tsx:758`), it needs no API return-shape change (unlike Fix A, which the fresh-scan path can't satisfy today — E.A.3), and adding `destination` to the resolver `where` (`page.tsx:130`) reproduces the schema's own unique key (`schema.prisma:1808`). Either way `valueRank` stays as the in-row selector.
2. **If Fix A is preferred** (opaque id in the URL), budget for the `ai-assistant` return-shape change (E.A.3) and client-load threading on **both** the mount and fresh-scan paths — otherwise freshly-scanned cards can't deep-link until reload.
3. **Address the client-side cache collapse (D caveat) regardless of fix:** `loaded[r.category] = recs` (`TripPlannerAI.tsx:257`) overwrites per category, so a multi-destination carousel may never display the colliding destination's items. A resolver-only fix corrects *which* rec commits but not *which* recs are shown; both may need attention for true multi-destination support.
4. **Confirm the nav-suppression regex** (`AppLayout.tsx:155`) still matches whatever new URL shape is chosen — it's the only other consumer of the path shape.

---

*End of audit. No application code was modified; only this report was created.*
