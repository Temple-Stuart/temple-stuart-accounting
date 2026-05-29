# Google 3-category INVALID_REQUEST persists, Coworking works — audit

Branch: `claude/travel-google-3cat-live-audit`. Read-only.

## ⚠️ Important caveat upfront

**`GOOGLE_PLACES_API_KEY` is not in the audit container's env.** Checked:

```
$ env | grep -iE "google|places"
(empty)
$ ls .env*
.env.example
```

I literally could not run the authenticated `curl` the prompt requested.
What I *could* do:

- Keyless probes — get the auth-denied response with full payload to
  verify URL/encoding sanity per query.
- Structural analysis comparing what's different between Coworking
  (post-PR-6 fix worked) and Brunch / Nightlife / Shopping (post-PR-6
  fix didn't work).
- Propose a diagnostic log (one line) that captures Google's actual
  `error_message` per failure on the next deploy.

I'd genuinely want the live curl outputs before claiming certainty.
What follows is the strongest hypothesis I can support with structural
evidence, ranked by likelihood, plus a 30-second diagnostic that closes
the gap on next deploy.

---

## 1. Post-PR-6 `scanQueries` for the 5 Google categories (cited)

`src/lib/travelCOA.ts`:

| Category | Line | Status | `scanQueries` (post-PR-6) |
|---|---|---|---|
| **Dinner** ✓ | `:69` | works | `['dinner restaurant', 'fine dining', 'local restaurant', 'street food', 'seafood restaurant']` |
| **Coworking** ✓ | `:154` | now works | `['coworking space', 'coworking office', 'shared workspace']` |
| **Brunch & Coffee** ✗ | `:58` | still fails | `['brunch restaurant', 'breakfast cafe', 'coffee shop', 'bakery cafe', 'specialty coffee']` |
| **Nightlife** ✗ | `:115` | still fails | `['nightlife venue', 'bar cocktail', 'live music club']` |
| **Shopping** ✗ | `:185` | still fails | `['shopping mall', 'local market', 'convenience store', 'pharmacy drugstore']` |

Every post-PR-6 query is multi-word; **none** is a bare Place-Type
slug. The PR-6 audit's "single-word Place-Type slug" hypothesis was
right for Coworking (its old `[]` → label fallback `coworking` was a
single bare Place-Type; PR-6 replaced it with multi-word queries → now
works). **It was wrong for Brunch / Nightlife / Shopping** — those
already had multi-word queries that were *also* failing pre-PR-6
(`breakfast cafe`, `coffee shop`, `specialty coffee` are unchanged
from before PR-6 and still fail today).

So **the real root cause is something PR-6 didn't target.**

---

## 2. Keyless URL/encoding sanity per query

```
$ for q in "brunch%20restaurant" "nightlife%20venue" "shopping%20mall" \
           "coworking%20space" "dinner%20restaurant"; do
    curl -sS "https://maps.googleapis.com/maps/api/place/textsearch/json\
?query=$q%20in%20Bali%20Canggu%20Indonesia\
&location=-8.6478,115.1385&radius=20000"
  done
```

Every URL returns the same auth-denied payload:
```json
{
  "error_message": "You must use an API key to authenticate each request…",
  "html_attributions": [],
  "results": [],
  "status": "REQUEST_DENIED"
}
```

**That tells me:**
- Google parses every URL successfully (same `REQUEST_DENIED` shape, not `INVALID_REQUEST`).
- URL plumbing + encoding + parameter order are correct for all 5 queries.
- No category-specific URL malformation.

So if any of these queries return `INVALID_REQUEST` when authenticated,
it's not a request-format issue — it's something Google chooses to do
based on query + location + radius semantics.

---

## 3. The PRE-PR-6 vs POST-PR-6 ground truth that PR-6 missed

The previous audit ([travel-invalid-request-audit-v2.md](audit-reports/travel-invalid-request-audit-v2.md))
proposed: "single-word queries that are also valid Google Place-Type
slugs (bakery, pharmacy) trip the NL parser." But look at the
pre-PR-6 vs post-PR-6 query lists:

### Brunch:
- **Pre-PR-6:** `'brunch', 'breakfast cafe', 'coffee shop', 'bakery', 'specialty coffee'`
- **Post-PR-6:** `'brunch restaurant', 'breakfast cafe', 'coffee shop', 'bakery cafe', 'specialty coffee'`
- **Diff:** only `brunch → brunch restaurant` and `bakery → bakery cafe`.
- **Unchanged + still failing:** `'breakfast cafe'`, `'coffee shop'`, `'specialty coffee'` — all multi-word, none bare Place-Type slugs.

### Shopping:
- **Pre-PR-6:** `'shopping mall', 'market', 'convenience store', 'pharmacy'`
- **Post-PR-6:** `'shopping mall', 'local market', 'convenience store', 'pharmacy drugstore'`
- **Diff:** `market → local market`, `pharmacy → pharmacy drugstore`.
- **Unchanged + still failing:** `'shopping mall'`, `'convenience store'` — both multi-word.

### Nightlife (pre-PR-6 was empty `[]` → fell back to label):
- **Pre-PR-6:** `'nightlife & entertainment'` (label fallback).
- **Post-PR-6:** `'nightlife venue', 'bar cocktail', 'live music club'`.
- **Diff:** entirely new list, no overlap.

### Coworking (pre-PR-6 was empty `[]` → fell back to label):
- **Pre-PR-6:** `'coworking'` (label fallback — single bare Place-Type slug).
- **Post-PR-6:** `'coworking space', 'coworking office', 'shared workspace'`.
- **Diff:** entirely new list, no overlap.

**Coworking's pre-PR-6 query was a SINGLE WORD that IS a bare Place-Type
slug.** Replacing with multi-word fixed it. That confirms the single-word-
Place-Type hypothesis for that one case.

**But Brunch and Shopping had pre-existing MULTI-WORD queries that
already failed**, and Nightlife's `'nightlife venue'` etc. are also
multi-word and still fail. Multi-word ≠ fix on its own. Something else
is going on.

---

## 4. Surviving hypotheses ranked by likelihood

### **Hypothesis P (Pagination — highest likelihood):** `searchPlaces` throws on page-1 INVALID_REQUEST, discarding page-0 successful results

`src/lib/placesSearch.ts:84-117`:
```ts
for (let page = 0; page < 3 && allPlaces.length < maxResults; page++) {
  const searchUrl: string = nextPageToken
    ? `…?pagetoken=${nextPageToken}&key=${apiKey}`            // ← page 1+
    : `…?query=…&location=…&radius=20000…`;                    // ← page 0
  if (page > 0 && nextPageToken) await new Promise(r => setTimeout(r, 2000));
  const searchRes = await googleFetch(searchUrl);
  const searchData = await searchRes.json();
  if (searchData.status && searchData.status !== 'OK' && searchData.status !== 'ZERO_RESULTS') {
    throw new GooglePlacesApiError(searchData.status, searchData.error_message);  // ← discards allPlaces
  }
  // … accumulate into allPlaces …
  nextPageToken = searchData.next_page_token || null;
  if (!nextPageToken) break;
}
```

Google's docs explicitly note `next_page_token` activation is delayed
("a short time" — they don't commit to a number). 2 seconds **is often
insufficient**; page-1 requests with an unready token return
`INVALID_REQUEST` (well-documented community behaviour). The throw on
page-1 propagates up and discards every result accumulated on page 0.

**Why this fits the working/failing split:**
- **Coworking works (post-PR-6)** because its queries (`coworking space`,
  `coworking office`, `shared workspace`) likely return **<20 results**
  on page 0 → no `next_page_token` → `if (!nextPageToken) break;` exits
  the loop → no page-1 attempt → no page-1 failure to discard page-0
  results.
- **Dinner works** because of cache. (Per the previous audit's
  Hypothesis A — Dinner had successful scans pre-PR-1 silent-swallow
  days, populated `places_cache`, and the 7-day TTL keeps serving cached
  results without firing Google.)
- **Brunch / Nightlife / Shopping fail** because their queries hit
  popular venue categories in Bali → page-0 returns 20 results + a
  `next_page_token` → page-1 fires 2s later → token-not-yet-active →
  `INVALID_REQUEST` → throw → all page-0 results discarded → user sees
  banner.

This hypothesis explains EVERY observation:
- Why post-PR-6 multi-word queries still fail (they hit popular
  categories → pagination → unready token).
- Why Coworking works post-PR-6 (low-volume category → no pagination).
- Why Dinner works post-PR-6 (cache).
- Why some prior scans succeeded (cache from when timing happened to
  work or when Google didn't return tokens).
- Why the banner shows just `INVALID_REQUEST` with no `error_message`
  text — that's Google's typical response for unready pagetokens (no
  human-readable `error_message`, just the status).

### **Hypothesis NL (NL-parser quirk — medium):** Google's text-search NL parser still rejects certain multi-word phrases with location bias

A weaker version of the previous audit's Place-Type hypothesis: maybe
phrases like `breakfast cafe`, `coffee shop`, `specialty coffee` get
interpreted as type-intent searches because they end in Place-Type
words (`cafe`, `shop`, `coffee` partially). But Dinner's
`'seafood restaurant'` and `'fine dining'` are structurally similar and
don't crash — so this hypothesis on its own can't explain the split.
If it's a contributor at all, it's tangential to the pagination issue.

### **Hypothesis C (cache asymmetry — already accepted):** Dinner is served from cache; the others are running fresh

Already established by the previous audit. Explains why Dinner appears
to work today even if Hypothesis P would otherwise predict it should
fail. Does NOT explain why Coworking's fresh calls work — that's
explained by P (no pagination attempted).

---

## 5. The 30-second diagnostic to confirm

If you can't paste a live curl, the cheapest path to ground truth is a
one-line log added just before the throw in `searchPlaces`:

```diff
   if (searchData.status && searchData.status !== 'OK' && searchData.status !== 'ZERO_RESULTS') {
+    console.error('[PLACES] textsearch failure', {
+      page,
+      query: query.substring(0, 60),
+      status: searchData.status,
+      error_message: searchData.error_message ?? null,
+      had_pagetoken: !!nextPageToken,
+      results_accumulated_so_far: allPlaces.length,
+    });
     throw new GooglePlacesApiError(searchData.status, searchData.error_message);
   }
```

One Bali scan after deploy → the server log shows, for each failed
query, whether the failure is page 0 (request-content issue) or page 1+
(pagination-timing issue), and how many results were already
accumulated when it threw. That single log answer collapses Hypotheses
P / NL / C into the right one.

---

## 6. Proposed fix(es)

### **Step 1 — diagnostic log (Step 5 above), one line, harmless.**

### **Step 2 — preserve page-0 results if pagination throws (recommended regardless of which hypothesis wins):**

```diff
   for (let page = 0; page < 3 && allPlaces.length < maxResults; page++) {
     const searchUrl: string = nextPageToken
       ? `…?pagetoken=${nextPageToken}&key=${apiKey}`
       : `…?query=…&location=…&radius=20000…`;
     if (page > 0 && nextPageToken) await new Promise(r => setTimeout(r, 2000));
     const searchRes = await googleFetch(searchUrl);
     const searchData = await searchRes.json();
     if (searchData.status && searchData.status !== 'OK' && searchData.status !== 'ZERO_RESULTS') {
-      throw new GooglePlacesApiError(searchData.status, searchData.error_message);
+      // Page 0 = first attempt with full URL; a failure here is a real
+      // request-content problem worth surfacing. Page 1+ uses the
+      // pagetoken from page 0; failures there are typically "token not
+      // yet active" (Google's documented behaviour, no error_message),
+      // and the page-0 results we already collected are still valid —
+      // return them instead of throwing the partial batch away.
+      if (page === 0 || allPlaces.length === 0) {
+        throw new GooglePlacesApiError(searchData.status, searchData.error_message);
+      }
+      console.warn(`[PLACES] pagination failed (page ${page}) for "${query}" — returning ${allPlaces.length} results from page 0+`);
+      break;
     }
     // …
   }
```

**Why this is the right fix:**
- **Doesn't silently swallow real errors.** Page-0 failures still throw
  loudly — Hypothesis P is about page 1+ specifically.
- **No new silent fallback.** Page-1+ failures are logged loudly with
  the query string + page number.
- **Restores fail-loud's intent.** PR-1's fail-loud was about
  surfacing real errors; throwing away successful page-0 results
  because of a pagination-token timing race is the *opposite* of
  fail-loud — it makes a legit success look like a failure.
- **Doesn't depend on Hypothesis P being right.** Even if the real
  root cause is something else, preserving page-0 results when a
  partial result exists is strictly better than discarding them.

### **Step 3 (only if log confirms page-0 is failing too — unlikely):**
Per-query content fix, possibly per category. Won't know until Step 1
reveals it.

### **What NOT to do**
- Don't increase the 2-second pagetoken sleep to 4s/5s — that's a guess
  at a Google internal delay and adds 10+s to every scan even when not
  needed.
- Don't disable pagination entirely — losing 40+ results per query
  hurts users on popular destinations.
- Don't keep tweaking `scanQueries` — PR-6 already showed that "more
  multi-word" alone isn't sufficient. The pagination preservation
  (Step 2) fixes the symptom regardless of the underlying parser quirk.

---

## 7. Verdict

PR-6's `scanQueries` diversification was a partial fix that worked
for Coworking (single bare Place-Type slug → multi-word). It doesn't
fix Brunch / Nightlife / Shopping because their failures aren't
caused by single bare slugs — they pre-existed even with multi-word
queries.

**Strongest hypothesis (P):** the pagination-token-timing race in
`searchPlaces` discards successful page-0 results when page-1's
`pagetoken=` request hits a not-yet-active token. Categories with
high-volume queries in Bali (anything that returns 20+ results on page
0) get a token → try page 1 → fail → discard page 0. Coworking has few
results → no token → no page 1 → no failure. Dinner appears to work
because of `places_cache` 7-day TTL serving cached results from prior
successful scans.

**Best path forward:**
1. Ship Step 1 (one-line diagnostic log) → next deploy reveals truth.
2. Ship Step 2 (preserve page-0 on page-1+ failure) — strict
   improvement regardless of which hypothesis wins.
3. If Step 1's log shows page-0 failures with real `error_message`
   text, dig into per-category content. Until then, fixing scanQueries
   further is guessing.

Sources:
- [Google Places — Text Search statuses + pagetoken docs](https://developers.google.com/maps/documentation/places/web-service/legacy/search-text)
- `audit-reports/travel-invalid-request-audit-v2.md` (commit `9efe7fab`)
- Direct keyless probes against `maps.googleapis.com/maps/api/place/textsearch/json` (§2; status only, no payload).
