# Travel-QuickFix-PR-5 — Viator destinations URL + LiteAPI cityName extract + V1 cleanup

Branch: `claude/travel-quickfix-pr-5`. Ships the three single-line fixes
from `audit-reports/travel-viator-404-audit.md` (`5762f547`) and
`audit-reports/travel-liteapi-empty-audit.md` (`59d9bea7`), plus the
dead-code cleanup the Viator audit flagged. Net `+22 / −112` lines.

---

## Fix 1 — Viator destinations URL (`src/lib/viatorClient.ts`)

### Before (pre-PR `:75-79`)
```ts
const res = await fetch(`${VIATOR_V2_BASE}/v1/taxonomy/destinations`, {
  headers: v2Headers(),
});
if (!res.ok) {
  throw new ViatorApiError('V2 /v1/taxonomy/destinations', res.status, await res.text());
}
```

### After (`viatorClient.ts:73-80` post-PR)
```ts
const res = await fetch(`${VIATOR_V2_BASE}/destinations`, {
  headers: v2Headers(),
});
if (!res.ok) {
  throw new ViatorApiError('V2 /destinations', res.status, await res.text());
}
const data = await res.json();
cachedDestinations = data.destinations || data.data || [];
destinationCacheTime = Date.now();
console.log(`[Viator] Loaded ${cachedDestinations!.length} destinations (V2 /destinations)`);
```

The full URL is now `GET https://api.viator.com/partner/destinations` —
the V2-correct path per the [Viator Partner API technical guide](https://partnerresources.viator.com/travel-commerce/technical-guide/) (the
version goes in the `Accept: application/json;version=2.0` header, not
the path).

The response-wrapper parse `data.destinations || data.data || []` is
unchanged — defensive across the two field-name conventions Viator's V2
returns. The log line includes `(V2 /destinations)` so the first
successful call clearly states the endpoint that worked.

---

## Fix 2 — LiteAPI cityName extract (`src/lib/liteapiClient.ts`)

### Helper added (`liteapiClient.ts:99-104`)
```ts
/** Our destinations.ts uses "Region (City)" labels (e.g. "Bali (Canggu)") for
 *  user-facing clarity. LiteAPI's catalog keys on the actual city ("Canggu").
 *  Prefer the parenthesised value when present; otherwise pass through. */
export function extractCityName(name: string): string {
  const m = name.match(/\(([^)]+)\)/);
  return (m ? m[1] : name).trim();
}
```

### Call site (`liteapiClient.ts:166`)
```diff
-    cityName: params.city,
+    cityName: extractCityName(params.city),
```

Effect on the live Bali request body:
```diff
 {
-  "cityName": "Bali (Canggu)",
+  "cityName": "Canggu",
   "countryCode": "ID",
   ...
 }
```

`Canggu` is the actual city in LiteAPI's catalog convention; the prior
string never had a chance of matching.

For destinations without parens (the majority of `src/lib/destinations.ts`),
the helper is a no-op — the value passes through unchanged.

---

## Fix 3 — Delete dead V1 paths (`src/lib/viatorClient.ts`)

The `viatorapi.viator.com` host is retired and returns HTTP 503 globally
(confirmed in `audit-reports/travel-viator-404-audit.md` §2). All V1 code
paths were unconditional latency taxes + log noise; deleted:

| Symbol | Lines (pre-PR) | Status |
|---|---|---|
| `VIATOR_V1_BASE` constant | `:11` | **Deleted** |
| `loadDestinations` V1 fallback block | `:93-112` | **Deleted** |
| `parseDurationMinutes` helper | `:126-138` | **Deleted** (only consumer was V1 normaliser) |
| `normalizeV1Product` function | `:140-162` | **Deleted** |
| `searchV1Products` function | `:303-329` | **Deleted** |
| V1 fallback call in `searchViatorProducts` | `:414-423` | **Deleted** |
| Header comment | `:1-4` | Updated to note V1 host retirement |
| `loadDestinations` outer-catch | `:81-89` | Now `throw err` after `MissingViatorKeyError` re-throw — no dead-host attempt |
| Section comment after V2-fallback call site | `:324` | New comment explaining V1 was removed |

### Grep verification
```
$ grep -rn "viatorapi.viator.com\|VIATOR_V1_BASE\|searchV1Products\|normalizeV1Product\|parseDurationMinutes" src/
src/lib/viatorClient.ts:5:   // V1 fallback host (viatorapi.viator.com) has been retired and now returns
src/lib/viatorClient.ts:324: // V1 fallback paths were removed in PR-5 — the V1 host (viatorapi.viator.com)
```

The only remaining mentions of `viatorapi.viator.com` are two explanatory
comments (header + post-V2-fallback). No code path references the host;
no other V1 symbol is named anywhere in `src/`. Acceptable per the
constraint — these comments document *why* something isn't there, useful
for anyone wondering "why is there no V1 fallback?".

---

## Constraints verified

```
$ for f in prisma/schema.prisma src/lib/travelSourceRegistry.ts \
           src/app/api/trips/[id]/vendor-commit/route.ts \
           src/components/trips/TripCreationBar.tsx \
           src/app/budgets/trips/new/page.tsx \
           src/lib/travelCOA.ts \
           src/components/trips/TripPlannerAI.tsx; do
     echo "$f: $(git diff main -- "$f" | wc -l)"
   done
prisma/schema.prisma: 0
src/lib/travelSourceRegistry.ts: 0
src/app/api/trips/[id]/vendor-commit/route.ts: 0
src/components/trips/TripCreationBar.tsx: 0
src/app/budgets/trips/new/page.tsx: 0
src/lib/travelCOA.ts: 0
src/components/trips/TripPlannerAI.tsx: 0
```

- Shape, registry, commit→budget spine, traveler-count, COA queries (the
  Google INVALID_REQUEST is for a separate PR), and the PR-4 carousel UI
  all untouched.
- PR-1 fail-loud behaviour preserved — both clients still throw
  `MissingViatorKeyError` / `MissingLiteApiKeyError` / `ViatorApiError` /
  `LiteApiError` for typed handling in the route.
- No new silent-fallback paths introduced. The LiteAPI silent-empty
  behaviour for unmatched cities is unchanged in this PR (deliberately —
  the coordinate-refactor PR adds the unmatched-city distinction).

---

## tsc + lint

- `npx tsc --noEmit` → **exit 0.**
- Lint on the two touched files:
  - **Baseline (pre-PR): 9 errors.**
  - **After this PR: 8 errors.**
  - Net `-1` error (removing `normalizeV1Product` dropped one `(p: any)`
    cast). **Zero new errors introduced.**
  - The remaining 8 errors are pre-existing `@typescript-eslint/no-explicit-any`
    on V2 normalisers and search funcs — same baseline shape. Repo's
    `next.config.ts` has `eslint.ignoreDuringBuilds: true`.

---

## Expected behaviour after merge

### Viator (4 categories)
The 404 banners on Sports & Fitness / Arts & Culture / Wellness /
Bucket-list should disappear. First request to `GET /partner/destinations`
populates the 24-hour `cachedDestinations` cache; the four parallel
category calls all hit the cache on `findDestinationId('Canggu', ...)`
(or whatever the trip's destination matches).

If the first call logs `[Viator] Loaded 0 destinations (V2 /destinations)`
despite a 200 response, the V2 response wrapper-field is something other
than `destinations` or `data` — the defensive parse needs adjustment.
That's the one thing this PR can't verify without a live API key, but
the audit's reading of Viator's docs (`{ destinations: [...] }` shape)
makes the existing parse the right bet.

### LiteAPI (Accommodation)
The Bali (Canggu) request now sends `cityName: "Canggu"`. Three
outcomes possible per the audit's test matrix:

1. **Hotels populate** — quickfix worked end-to-end; Bali sandbox is
   stocked under "Canggu".
2. **Still empty** — sandbox doesn't stock Canggu specifically. Per the
   LiteAPI empty audit's §5 test matrix, try the next destinations to
   disambiguate:
   - `"New York"` / `"US"` — should always work; if non-empty, integration
     is verified end-to-end and only Bali sandbox is thin.
   - `"London"` / `"GB"` — confirms.
   - `"Paris"` / `"FR"` — confirms.
3. **Error banner** — config issue (`LITEAPI_SANDBOX_KEY` unset / wrong);
   PR-1's typed-error path surfaces the message verbatim.

If outcome 2 lands, the empty state itself is honest but uninformative —
the audit's recommended follow-up is the coordinate-based search refactor
(uses `destinations.ts` lat/lng → LiteAPI accepts no-ambiguity location
input → distinguishes "city not in catalog" from "no inventory") and an
unmatched-city UX surface. That's the next PR.

---

## Changeset

```
 A audit-reports/travel-quickfix-pr-5.md       (this report)
 M src/lib/liteapiClient.ts                    (+10 / -1)
 M src/lib/viatorClient.ts                     (+12 / -111)
```

Sources:
- `audit-reports/travel-viator-404-audit.md` (commit `5762f547`)
- `audit-reports/travel-liteapi-empty-audit.md` (commit `59d9bea7`)
- [Viator Partner API technical guide](https://partnerresources.viator.com/travel-commerce/technical-guide/)
- [LiteAPI — Rate and Hotel Query Guide](https://docs.liteapi.travel/docs/rate-request-parameters-guide)
