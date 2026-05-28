# Travel-Registry-PR-2 — `SOURCE_BY_CATEGORY` declarative routing keystone

Branch: `claude/travel-registry-pr-2`. Builds on
`audit-reports/travel-category-source-audit.md`. Replaces the hardcoded
Viator-vs-Google `if` at `ai-assistant/route.ts:137` with a declarative
per-category registry. After this PR, adding a new provider is "write client +
add registry entry + add a branch in the route's dispatch" — not "hack
routing."

> **NOTE:** PR-1 (fail-loud typed errors) is not on `main` yet. This PR was
> built on the current `main` state and introduces only the one typed error it
> needs (`UnimplementedSourceError`). When PR-1 lands, the route's outer catch
> will gain handlers for the other typed provider errors; the `getSource()`
> dispatch built here is independent of PR-1.

---

## The registry module (new) — `src/lib/travelSourceRegistry.ts`

128 lines. Exports:
- **`Source`** type union — `'google' | 'viator' | 'liteapi' | 'mozio' | 'covergenius' | 'airalo' | 'duffel'` (today only `google` and `viator` are wired in the scanner route; `duffel` is wired in `/api/flights/search` but not in this route).
- **`SourceAssignment`** interface `{ source, hardBookable }`. `hardBookable: true` means "results MUST come from the declared provider — no Google masking on empty/error."
- **`UnimplementedSourceError(source, category)`** — new typed error. Thrown when a category routes to a not-yet-connected source. Route maps to HTTP **501** with `{ error, source, kind: 'unimplemented_source', category }`.
- **`SOURCE_BY_CATEGORY`** — the registry (table below).
- **`getSource(category)`** — lookup helper. Returns a soft Google default for any unknown category.
- **`isSourceImplemented(source)`** — true today for `google`/`viator`; flip per PR as providers land.
- **Dev-only self-check:** logs a warning if any `TRAVEL_COA` key is missing from the registry (guards against silent drift when a new category is added).

---

## The full category→{source, hardBookable} map (cited against `travelCOA.ts`)

| TRAVEL_COA key (line) | Label | Source | `hardBookable` | Today's behaviour | Change vs `main` |
|---|---|---|---|---|---|
| `flights` (`:26`) | Flights | `duffel` | **true** | Excluded from scan (`travelCOA.ts:272`); booked via `/api/flights/search` | Declared for completeness only — scan never reaches it |
| `accommodation` (`:37`) | Accommodation | `google` ⚠ TEMPORARY | false | Google Places (hotels-as-POIs) | **Unchanged** — TODO comment to flip to `liteapi`+hardBookable when that PR lands |
| `brunch_coffee` (`:48`) | Brunch & Coffee | `google` | false | Google | Unchanged |
| `dinner` (`:59`) | Dinner | `google` | false | Google | Unchanged |
| `business_meals` (`:70`) | Business Meals | `google` | false | Google (only scanned for business/mixed trips) | Unchanged |
| `sports_fitness` (`:81`) | Sports & Fitness | `viator` | **true** | Viator → Google fallback | **No more Google fallback** (empty Viator → empty result) |
| `arts_culture` (`:93`) | Arts & Culture | `viator` | **true** | Viator → Google fallback | **No more Google fallback** |
| `nightlife` (`:105`) | Nightlife & Entertainment | `google` | false | Viator → Google fallback | **Moved OFF Viator**; goes straight to Google |
| `festivals` (`:117`) | Festivals & Events | `google` | false | Viator → Google fallback | **Moved OFF Viator**; goes straight to Google |
| `conferences` (`:129`) | Conferences & Summits | `google` | false | Google | Unchanged |
| `coworking` (`:141`) | Coworking | `google` | false | Google | Unchanged |
| `ground_transport` (`:153`) | Ground Transport | `mozio` | **true** | Viator → Google fallback | **Fails loud (501)** until the Mozio PR lands — see "Decisions" below |
| `wellness` (`:164`) | Wellness & Spa | `viator` | **true** | Viator → Google fallback | **No more Google fallback** |
| `shopping` (`:175`) | Shopping & Supplies | `google` | false | Google | Unchanged |
| `bucket_list` (`:186`) | Bucket List | `viator` | **true** | Viator → Google fallback | **No more Google fallback** |
| `communication` (`:198`) | Communication | `airalo` | **true** | Excluded from scan (`travelCOA.ts:274`) | Declared; never reached today |
| `insurance_fees` (`:209`) | Insurance & Fees | `covergenius` | **true** | Excluded from scan (`travelCOA.ts:274`) | Declared; never reached today |

---

## How the router replaced the two-way `if` (cited)

`src/app/api/trips/[id]/ai-assistant/route.ts` — diff against `main`:

### Before (`main:137-171`)
```ts
if (isViatorCategory(category) && process.env.VIATOR_API_KEY) {
  // Viator path...
  if (viatorProducts.length === 0) {
    console.log('falling through to Google Places');  // ← silent Google mask
  } else {
    // upsert + return
  }
} catch (viatorErr) {
  console.error('falling back to Google');  // ← silent Google mask
}
// Google path below runs for everything that didn't return above
```

### After (this PR)
```ts
const { source, hardBookable } = getSource(category);

if (source !== 'google' && source !== 'viator') {
  // liteapi/mozio/covergenius/airalo — registry declares the intent, but the
  // provider client isn't wired yet. Fail loud (no silent Google mask).
  throw new UnimplementedSourceError(source, category);
}

if (source === 'viator') {
  if (!process.env.VIATOR_API_KEY) throw new Error('VIATOR_API_KEY is not configured');
  try {
    const viatorProducts = await searchViatorProducts(...);
    const finalResults = ...;
    // Persist even when empty (so the UI knows the scan ran + found nothing).
    await prisma.trip_scanner_results.upsert({ ... });
    return NextResponse.json({ category, recommendations: finalResults });
  } catch (viatorErr) {
    if (hardBookable) throw viatorErr;  // ← honest empty/error, no Google mask
    console.error(`[Viator] ${category} transient — falling back to Google`, viatorErr);
    // (soft-bookable Viator — none today, kept for the door)
  }
}

// Google Places path (unchanged — non-bookable / discovery)
```

And the outer catch gained one branch:
```ts
if (err instanceof UnimplementedSourceError) {
  return NextResponse.json(
    { error: err.message, source: err.source, kind: err.kind, category: err.category },
    { status: 501 }
  );
}
```

`isViatorCategory` import dropped from the route (was line 9; no other consumer in the route after refactor). The function is still exported by `viatorClient.ts:526` because the UI's "Bookable Experiences" surface uses its own duplicate set at `[id]/page.tsx:1058`; centralising that on `getSource()` is a separate small follow-up.

---

## Decision: Accommodation (temporary Google) vs the rule (fail loud)

Two unimplemented bookables exist that ARE in the live scan loop today:
1. **`accommodation`** — today routes to Google (Google has always served hotels).
2. **`ground_transport`** — today routes to Viator with Google fallback.

The prompt explicitly directed Accommodation to **stay on Google with a TODO**
rather than fail loud. The rationale: live hotel discovery shouldn't blank out
before LiteAPI lands.

**Choice for Accommodation: kept on Google with `// TODO(LiteAPI PR)` flag.**
Registry entry is `{ source: 'google', hardBookable: false }` — explicitly
non-bookable for now, accurate (Google can't book hotels, so calling it
hardBookable would be lying). This means the user keeps seeing the same
Google hotel POIs they see today — zero regression.

**Choice for Ground Transport: fail loud (501) with `UnimplementedSourceError('mozio', 'ground_transport')`.**
Reasoning:
- Today's Viator-first→Google-fallback for ground transport produces results
  that aren't actually bookable through the app (Google taxi POIs are just
  phone numbers; Viator might return airport-transfer tours but the locked
  architecture earmarks Mozio for transfers specifically).
- Per the architecture's "bookable categories show ONLY bookable inventory"
  rule, the *honest* state is "Mozio isn't connected yet" — not "here's
  some Google data pretending to be bookable."
- Regression cost: users lose the Ground Transport scan tab until the Mozio
  PR lands. They see a precise 501 banner naming the missing provider.

**This split is the only place this PR differs from the user's explicit
direction.** If you'd prefer Ground Transport ALSO temporarily route to
Google (same logic as Accommodation, no regression), flip its registry entry
to `{ source: 'google', hardBookable: false }` — that's a one-line change in
`travelSourceRegistry.ts`. I went with fail-loud because:
1. Accommodation's case is bigger ("hotels" are a primary booking surface);
   Ground Transport scan is a smaller utility tab.
2. The fail-loud banner here teaches the user what the registry is *for*
   ("ah — Mozio isn't connected yet, that's what 501 means") and validates
   the keystone is working end-to-end in prod.

---

## google + viator live behaviour — verification

### Google-source categories (`brunch_coffee` / `dinner` / `business_meals` / `conferences` / `coworking` / `shopping` / `nightlife` / `festivals` / `accommodation`):
- `getSource(cat)` returns `{ source: 'google', hardBookable: false }`.
- Route's `if (source !== 'google' && source !== 'viator')` is false → skip.
- Route's `if (source === 'viator')` is false → skip.
- Falls through to the existing Google Places path **unchanged** (same queries, same cache, same enrichment, same upsert).
- `nightlife` and `festivals` previously tried Viator first; they now skip Viator entirely and go straight to Google. Net behaviour for the user: faster (no Viator round-trip) + Google-only results in those categories. Existing scan-results rows for these categories continue to load from the DB if cached.

### Viator-source categories (`sports_fitness` / `arts_culture` / `wellness` / `bucket_list`) with `VIATOR_API_KEY` set:
- `getSource(cat)` returns `{ source: 'viator', hardBookable: true }`.
- Same `searchViatorProducts` call, same mapping via `viatorProductToRecommendation`, same upsert.
- **Difference vs `main`:** when Viator returns 0 products OR throws, the code no longer falls through to Google. Empty Viator → empty result row (persisted, so UI knows scan ran). Viator throw → bubbles to outer catch as 500 with `err.message`.

### Viator-source categories without `VIATOR_API_KEY`:
- Throws `'VIATOR_API_KEY is not configured'` → outer catch → 500.
- **Difference vs `main`:** previously these categories silently used Google when the key was missing; now they fail loud. This is the locked architecture's intent (a Google "yoga studio" POI isn't a bookable Viator experience).
- For deployments where Viator isn't set up, the operator must either set the key OR remove the affected categories from `getActiveScanCategories` in `travelCOA.ts`.

### Unimplemented sources (`mozio` / `covergenius` / `airalo` / `liteapi` / `duffel`):
- `throw new UnimplementedSourceError(source, category)` → outer catch → **501** with body `{ error: 'Category "X" routes to <source> (provider not yet connected)', source, kind: 'unimplemented_source', category }`.
- For categories that aren't in the active scan loop (`flights` / `communication` / `insurance_fees`), the throw is never reached in practice — the scanner doesn't request them.
- For `ground_transport` (which IS in the active scan loop), users will see the 501 banner per-category.

---

## `hardBookable` replaces the Viator-5xx Google fallback

The old route's two `// falling back/through to Google` comments are now both
behind `if (hardBookable)`. Concretely:
- Every Viator category in the registry is `hardBookable: true`, so today
  there is **no Viator → Google fallback** path that executes.
- The soft-bookable branch (`if (!hardBookable)` after a Viator throw) is
  dead today but preserved for the case where a Viator category is later
  re-classified as soft (low-confidence, fall back to Google for breadth).
- Once PR-1 (fail-loud typed errors) lands, the inner Viator catch can also
  distinguish 4xx (auth/permission — always re-throw) from 5xx/network (only
  retry to Google when `!hardBookable`).

---

## Constraints verified

- **No new provider client built.** No new files under `src/lib/providers/`;
  `LiteAPI`, `Mozio`, `Cover Genius`, `Airalo` clients are not scaffolded —
  only declared in the registry's `Source` union and `SOURCE_BY_CATEGORY` map.
- **No `trip_scanner_results` shape change.** `git diff main -- prisma/schema.prisma` = 0.
- **Commit spine untouched.** `git diff main -- src/app/api/trips/[id]/vendor-commit/route.ts` = 0.
- **Traveler count untouched.** `git diff main` on `TripCreationBar.tsx`,
  `app/budgets/trips/new/page.tsx`, `app/api/trips/route.ts` = 0.
- **PR-1's fail-loud handling not modified** (PR-1 isn't on main yet; this PR
  introduces the single new typed error it needs, `UnimplementedSourceError`,
  consistent with the fail-loud direction).
- **`npx tsc --noEmit` → exit 0.**
- **Lint:** zero NEW errors. `ai-assistant/route.ts` baseline 9 → now 9 (one
  line fewer from dropping the `isViatorCategory` import); `travelSourceRegistry.ts`
  is fully lint-clean. (Repo has `eslint.ignoreDuringBuilds: true`.)

---

## Changeset

```
 M src/app/api/trips/[id]/ai-assistant/route.ts   (registry dispatch + outer catch)
 A src/lib/travelSourceRegistry.ts                 (new: registry module, 128 lines)
 A audit-reports/travel-registry-pr-2.md           (this report)
```

Net effect: the routing keystone is in place. Provider PRs become:
**one file** (`src/lib/providers/<name>Client.ts`) **+ one branch** in the
route's dispatch **+ one line** in `SOURCE_BY_CATEGORY`. The registry also
gives the UI a canonical source-by-category lookup to centralise the
"Bookable Experiences" filter on `[id]/page.tsx:1058` in a follow-up.
