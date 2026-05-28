# Travel — INVALID_REQUEST on 4 Google categories audit v2

Branch: `claude/travel-invalid-request-audit-v2`. Read-only. No live Google
key in this audit env (`GOOGLE_PLACES_API_KEY` unset), so the final
"what does `error_message` actually say" gap stays open — I include the
exact `curl` command the user can run to close it.

What I *can* do statically: enumerate every query each category sends, find
the structural differences, and bound the suspect set to a couple of
testable hypotheses.

---

## 1. Side-by-side category definitions (cited)

`src/lib/travelCOA.ts` (lines per `git grep`):

| Category | `:line` | `scanQueries` | `interestSlugs` | `googlePlacesType` | Label |
|---|---|---|---|---|---|
| **Dinner** ✓ working | `:59` | `['dinner restaurant', 'fine dining', 'local restaurant', 'street food', 'seafood restaurant']` | — | `'restaurant'` | `Dinner` |
| **Conferences** ✓ working | `:129` | `[]` (→ label fallback) | `['fintech','tech','startup','business','marketing','crypto','accounting']` | `null` | `Conferences & Summits` |
| **Brunch & Coffee** ✗ failing | `:48` | `['brunch', 'breakfast cafe', 'coffee shop', 'bakery', 'specialty coffee']` | — | `'cafe'` | `Brunch & Coffee` |
| **Nightlife** ✗ failing | `:105` | `[]` (→ label fallback) | `['clubs','rooftop_bars','live_music','jazz','comedy','dinner_shows']` | `'bar'` | `Nightlife & Entertainment` |
| **Coworking** ✗ failing | `:141` | `[]` (→ label fallback) | `['day_pass','weekly_desk','nomad_community']` | `null` | `Coworking` |
| **Shopping** ✗ failing | `:175` | `['shopping mall', 'market', 'convenience store', 'pharmacy']` | — | `null` | `Shopping & Supplies` |

**`googlePlacesType` is dead code** — `ai-assistant/route.ts` calls
`searchPlacesMultiQuery(queries, city, country, 60, undefined)`. The `type`
field is hardcoded `undefined`, so `&type=...` is **never** in the URL.
Whatever's set on `googlePlacesType` in TRAVEL_COA does not affect the
request.

---

## 2. The actual query strings Google receives

Post-PR-4 (searchableCity strips parens), with `tripActivities = []`
(post-profile-removal), every COA category's queries come from
`getCOAScanQueries(category, [])` (`travelCOA.ts:235-261`). When
`scanQueries` is non-empty it wins; when empty, the function falls back
to `cat.label.toLowerCase()` (`:257`). For Bali (Canggu) / Indonesia,
this expands to:

| Cat | Queries sent (each becomes `?query=<q> in Bali Canggu Indonesia&location=...&radius=20000`) |
|---|---|
| **Dinner** ✓ | `dinner restaurant`, `fine dining`, `local restaurant`, `street food`, `seafood restaurant` |
| **Conferences** ✓ | `conferences & summits` (single label fallback) |
| **Brunch** ✗ | `brunch`, `breakfast cafe`, `coffee shop`, `bakery`, `specialty coffee` |
| **Nightlife** ✗ | `nightlife & entertainment` (single label fallback) |
| **Coworking** ✗ | `coworking` (single label fallback) |
| **Shopping** ✗ | `shopping mall`, `market`, `convenience store`, `pharmacy` |

---

## 3. Exact URL Google receives (cited)

`src/lib/placesSearch.ts:97`:
```ts
: `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query + ' in ' + searchableCity(city) + ' ' + country)}&location=${lat},${lng}&radius=20000${type ? `&type=${type}` : ''}&key=${apiKey}`;
```

With `type` always undefined the URL pattern is identical across
categories. The only thing that varies per request is the literal `query`
string itself.

### Working vs failing URL diff (one representative of each)

**Dinner (works)**:
```
GET …/textsearch/json
   ?query=dinner%20restaurant%20in%20Bali%20Canggu%20Indonesia
   &location=-8.6478,115.1385
   &radius=20000
   &key=<KEY>
```

**Brunch (fails)**:
```
GET …/textsearch/json
   ?query=brunch%20in%20Bali%20Canggu%20Indonesia
   &location=-8.6478,115.1385
   &radius=20000
   &key=<KEY>
```

The **only** difference is the `query` value. `&location=...&radius=20000`
are identical. There is no per-category `&type=...`. searchableCity()
strips parens for both equally. Hence: the failure is **content of the
`query` parameter**, not URL plumbing.

---

## 4. What I CAN'T do here, and the curl probe to close the gap

`GOOGLE_PLACES_API_KEY` isn't set in the audit env (`env | grep -i google`
returned nothing). The `error_message` text in the response is the
diagnostic gold — Google fills it with the exact reason a request was
rejected — but I can't pull it without the key. Run this from any shell
with the prod key in env:

```bash
KEY="<GOOGLE_PLACES_API_KEY>"

# Failing — Brunch's first query
curl -sS "https://maps.googleapis.com/maps/api/place/textsearch/json\
?query=brunch%20in%20Bali%20Canggu%20Indonesia\
&location=-8.6478,115.1385\
&radius=20000\
&key=${KEY}" | jq '{status, error_message, results_len: (.results|length)}'

# Failing — Brunch with NO location/radius (test if it's the location bias)
curl -sS "https://maps.googleapis.com/maps/api/place/textsearch/json\
?query=brunch%20in%20Bali%20Canggu%20Indonesia\
&key=${KEY}" | jq '{status, error_message, results_len: (.results|length)}'

# Failing — Coworking (the single-word label-fallback case)
curl -sS "https://maps.googleapis.com/maps/api/place/textsearch/json\
?query=coworking%20in%20Bali%20Canggu%20Indonesia\
&location=-8.6478,115.1385\
&radius=20000\
&key=${KEY}" | jq '{status, error_message}'

# Working — Dinner's first query, same URL plumbing
curl -sS "https://maps.googleapis.com/maps/api/place/textsearch/json\
?query=dinner%20restaurant%20in%20Bali%20Canggu%20Indonesia\
&location=-8.6478,115.1385\
&radius=20000\
&key=${KEY}" | jq '{status, error_message, results_len: (.results|length)}'
```

The `error_message` field on the failing responses is the answer. Paste
that text back and the diagnosis flips from "informed guess" to "known."

Worth noting: the UI banner today shows `Google Places API: INVALID_REQUEST`
with NO trailing ` — <error_message>`. That means **Google is returning
`INVALID_REQUEST` with no `error_message` field**, or our `GooglePlacesApiError`
constructor (`travelErrors.ts:24-31`) is dropping it. Probable: Google
sometimes omits `error_message` on `INVALID_REQUEST` and just says "the
request was malformed." Hence the gap in the banner.

---

## 5. The two surviving hypotheses (without the live probe)

### Hypothesis A — cache state explains why DIFFERENT categories show different states

`src/lib/placesCache.ts:isCacheFresh()` returns true if **any** row exists
for `(city, country, category)` within the 7-day TTL. `cachePlaces()`
(`:86`) does NOT cache empty results — the for-loop skips when
`places.length === 0`.

So a category that *ever* succeeded on this destination has rows; a
category that has only failed has zero rows.

If Dinner + Conferences have rows in `places_cache` from any past
successful scan, the route serves them from cache (`ai-assistant/route.ts:201-205`
— `if (cacheIsFresh) enriched = await getCachedPlaces(...)`) and **does
not call Google at all**. Brunch / Nightlife / Coworking / Shopping with
no rows run fresh Google calls every time, and those calls fail.

This **fully explains** the working/failing split being persistent across
re-scans — and it's testable with one SQL query:

```sql
SELECT category, COUNT(*) AS n
FROM   places_cache
WHERE  city = 'Bali (Canggu)' AND country = 'Indonesia'
GROUP  BY category
ORDER  BY category;
```

If Dinner + Conferences have rows and the other four don't, **A is the
why-some-work answer**, but it leaves the original question
(why-fresh-calls-fail) intact. Cache state is a *consequence*, not the
root cause.

### Hypothesis B — query content trips Google's text-search parser

Looking at the failing categories' actual content words, **3 of 4 are
dominated by single-content-word queries that are also valid Google
Place-Type slugs** ([Google place type list](https://developers.google.com/maps/documentation/places/web-service/supported_types)):

| Category | Failing single-content-word queries | Each word is also a Google place_type? |
|---|---|---|
| Brunch | `brunch`, `bakery` | `bakery` ✓ (valid place_type) |
| Coworking | `coworking` | no, but the *only* query — no diversification |
| Shopping | `market`, `pharmacy` | `pharmacy` ✓ (valid place_type) |
| Nightlife | `nightlife & entertainment` | no single-word — **outlier** |

When the `query` parameter happens to be (or contain) a bare Place-Type
slug AND `location`+`radius` are set, Google's text-search NL parser may
treat it as a type-search-disguised-as-text and reject the request with
`INVALID_REQUEST` because the format doesn't match either text-search OR
nearby-search cleanly. This would explain Brunch ("bakery" trips it),
Shopping ("pharmacy" trips it), and possibly Coworking ("coworking" is
not a Place-Type but is a single generic word).

Nightlife is the outlier for B — `nightlife & entertainment` isn't single-
word and isn't a Place-Type. The `&` character does survive
`encodeURIComponent` as `%26`, which is valid. Possibilities for
Nightlife specifically: Google's text-search returning INVALID_REQUEST for
the ampersand somehow, OR Nightlife is failing for a different reason
entirely (cache state explanation A only).

The curl probe in §4 separates A from B definitively.

---

## 6. Proposed fixes (do NOT implement until probe lands)

### Quick fix — diversify failing categories' `scanQueries` away from bare Place-Type words

`src/lib/travelCOA.ts`, three single-line additions (no schema change, no
route change):

```diff
   brunch_coffee: {
     ...
-    scanQueries: ['brunch', 'breakfast cafe', 'coffee shop', 'bakery', 'specialty coffee'],
+    scanQueries: ['brunch restaurant', 'breakfast cafe', 'coffee shop', 'bakery cafe', 'specialty coffee'],
     ...
   },
   shopping: {
     ...
-    scanQueries: ['shopping mall', 'market', 'convenience store', 'pharmacy'],
+    scanQueries: ['shopping mall', 'local market', 'convenience store', 'pharmacy drugstore'],
     ...
   },
   coworking: {
     ...
-    scanQueries: [],
+    scanQueries: ['coworking space', 'coworking office', 'shared workspace'],
     ...
   },
   nightlife: {
     ...
-    scanQueries: [],
+    scanQueries: ['nightlife venue', 'bar cocktail', 'live music club'],
     ...
   },
```

Logic: every query becomes at least two words, none of which is a bare
Place-Type slug. Mirrors Dinner's working pattern (`dinner restaurant`,
`fine dining`, `local restaurant`, etc.). Defensive against both
hypotheses A and B.

### Durable fix — Promise.allSettled at the query level (already done in PR-4!)

`placesSearch.ts:searchPlacesMultiQuery` was switched to `Promise.allSettled`
in PR-4 for exactly this scenario: one bad query inside a category should
not blank the category. The fact that all 4 categories show the banner
means **every query in those categories** is failing — which makes
sense if all of Brunch's queries trip the same Place-Type parser quirk.

Whether to also wrap `searchPlaces`'s 3-page pagination in allSettled
(so a bad page-1 token doesn't kill the otherwise-fine page-0 results) is
worth considering, but the symptom doesn't point there — these calls
likely fail on page 0.

### What NOT to change

- **`searchableCity()` (`placesSearch.ts:53-60`)**: keep it. The Bali (Canggu)
  parens-stripping is independently correct — it would still be needed
  even if hypothesis B is right, because destinations with parens are a
  general class our `destinations.ts` uses. Removing it would re-introduce
  the original PR-4 bug for any future Bali-like destination.
- **The route / registry / commit spine / count plumbing**: nothing
  upstream touched.

---

## 7. Verdict on searchableCity()

**Keep, no changes.** PR-4 documented its purpose as "Bali (Canggu)" →
"Bali Canggu" to stop our text-search query from containing parens.
That fix is still useful regardless of which of A/B is the right
explanation for the 4-category failure:
- If A (cache state), the 2 working categories were cached from earlier
  scans — they happily ignore the URL today.
- If B (Place-Type parser), `searchableCity` is orthogonal to the
  Place-Type quirk; both fixes co-exist.

So PR-4's helper isn't wrong, it just wasn't the *complete* fix for the
4-category problem. The Place-Type-slug `scanQueries` adjustment in §6
is the next layer.

---

## Verdict on whether this is "pre-existing"

Per the prompt, both Dinner and Brunch worked before the recent PRs (per
earlier screenshots in this session). What changed since then:

1. **PR-1 surfaces INVALID_REQUEST** instead of silently swallowing it.
   So if Brunch was *always* failing with INVALID_REQUEST, we now SEE it
   where we didn't before — that's *visibility*, not *introduction*.
2. The cache hypothesis (A) explains why the working categories were
   cached during the silent-swallow days but the failing ones never
   were. So pre-PR-1, the user might have seen "0 brunch results" but
   no banner. PR-1's fail-loud honestly exposes the underlying flaw.
3. PR-4's `searchableCity()` was *necessary but not sufficient*. It
   removed the `(Canggu)` parens from text-search queries, which is the
   right call. The remaining INVALID_REQUEST is a different root cause
   (Place-Type-slug query content, most likely).

The bug is therefore pre-PR-1 in origin, made *visible* by PR-1, partly
*not* fixed by PR-4. The proper completion is the §6 query
diversification.

---

## What I need from the user to close this with certainty

Run the 4-curl probe in §4 with the prod key and paste the
`error_message` text for the failing requests. That single value
collapses hypotheses A/B into one definitive root cause and confirms
whether the §6 query change suffices.

Sources:
- [Google Places — Text Search statuses](https://developers.google.com/maps/documentation/places/web-service/legacy/search-text)
- [Google Places — Supported place types (the slug list)](https://developers.google.com/maps/documentation/places/web-service/supported_types)
- `src/lib/travelCOA.ts:48-185` — TRAVEL_COA Google-source category defs
- `src/lib/placesSearch.ts:53-60, 92-100, 295-340` — searchableCity + URL construction + allSettled
- `src/lib/placesCache.ts:86-135, 150-170` — cachePlaces (skips empty) + isCacheFresh
- `src/app/api/trips/[id]/ai-assistant/route.ts:200-218` — cache-first then Google
