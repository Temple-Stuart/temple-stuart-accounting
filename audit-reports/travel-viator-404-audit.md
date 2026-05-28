# Travel — Viator destinations 404 audit (read-only)

Branch: `claude/travel-viator-404-audit`. Read-only. Direct probes against
Viator's API (no key needed — 404 vs 400 was enough to tell the URL apart).

---

## TL;DR

**It's our bug, not Viator's.** The destinations URL in
`src/lib/viatorClient.ts:75` is constructed wrong: it injects a `/v1/`
prefix and a `/taxonomy/` segment that aren't part of the V2 Partner API's
URL convention. The V1 fallback also points at a host that no longer
serves traffic. One-line fix below.

---

## 1. The exact URL being called (cited)

`src/lib/viatorClient.ts`:
```
10:  const VIATOR_V2_BASE = 'https://api.viator.com/partner';
11:  const VIATOR_V1_BASE = 'https://viatorapi.viator.com/service';
…
75:    const res = await fetch(`${VIATOR_V2_BASE}/v1/taxonomy/destinations`, …);
79:      throw new ViatorApiError('V2 /v1/taxonomy/destinations', res.status, await res.text());
…
96:    const res = await fetch(`${VIATOR_V1_BASE}/taxonomy/destinations`, …);
100:     throw new ViatorApiError('V1 /taxonomy/destinations', res.status, await res.text());
```

The fully-expanded URLs:
- V2 attempt → `https://api.viator.com/partner/v1/taxonomy/destinations`
- V1 fallback → `https://viatorapi.viator.com/service/taxonomy/destinations`

The "V2 /v1/taxonomy/destinations" wording in the error banner is **our
label**, not Viator's URL convention. We hit the V2 host but pasted a
`/v1/` into the path on top of it.

---

## 2. Direct probe (no API key — observe 400 vs 404)

I `curl`'d the candidate URLs and read the HTTP status to triangulate the
correct endpoint. A 400 "missing exp-api-key" means the URL exists and is
the right shape (just needs auth); a 404 means the URL doesn't exist.

```
$ curl -sS -o /dev/null -w "%{http_code}\n" \
    "https://api.viator.com/partner/v1/taxonomy/destinations" \
    -H "Accept: application/json;version=2.0"
404                                       ← our current URL (wrong)
body: {"code":404,"message":"HTTP 404 Not Found"}

$ curl -sS -o /dev/null -w "%{http_code}\n" \
    "https://api.viator.com/partner/taxonomy/destinations" \
    -H "Accept: application/json;version=2.0"
404                                       ← also wrong (no /taxonomy/ in V2)
body: {"code":404,"message":"HTTP 404 Not Found"}

$ curl -sS -o /dev/null -w "%{http_code}\n" \
    "https://api.viator.com/partner/destinations" \
    -H "Accept: application/json;version=2.0"
400                                       ← CORRECT — endpoint exists, just needs auth
body: {"code":"MISSING_HEADER_VALUE","message":"Missing required header: exp-api-key",
       "timestamp":"2026-05-28T21:59:14.535668089Z","trackingId":"…"}

$ curl -sS -o /dev/null -w "%{http_code}\n" -X POST \
    "https://api.viator.com/partner/destinations" …
405                                       ← so it's a GET, not POST
body: {"code":"METHOD_NOT_ALLOWED","message":"HTTP 405 Method Not Allowed"}

$ curl -sS -o /dev/null -w "%{http_code}\n" \
    "https://viatorapi.viator.com/service/taxonomy/destinations"
503                                       ← V1 fallback host is OFFLINE
body: <html><body><h1>503 Service Unavailable</h1>
       No server is available to handle this request.</body></html>

$ curl -sS -o /dev/null -w "%{http_code}\n" -X POST \
    "https://api.viator.com/partner/products/search" …
400                                       ← sanity: V2 search endpoint is FINE
body: {"code":"MISSING_HEADER_VALUE","message":"Missing required header: exp-api-key"…}
```

**Verdict:** the correct endpoint is **`GET https://api.viator.com/partner/destinations`** (no `/v1/`, no `/taxonomy/`). The V1 fallback host (`viatorapi.viator.com`) is dead.

---

## 3. Why our path is wrong — V2 URL convention

Viator's V2 Partner API moved the version out of the URL path and into the
`Accept` header. From [Viator's technical guide](https://partnerresources.viator.com/travel-commerce/technical-guide/)
and the [v2 upgrade page](https://partnerresources.viator.com/travel-commerce/upgrade-to-v2/),
V2 requests use:

- Base: `https://api.viator.com/partner`
- Header: `Accept: application/json;version=2.0`  ← version lives here
- Header: `exp-api-key: <key>`
- Path: bare resource, no `/v1/` prefix. Examples from the docs:
  - `POST /partner/products/search`
  - `POST /partner/search/freetext`
  - `GET  /partner/destinations`
  - `GET  /partner/products/{productCode}`

Our other V2 calls in `viatorClient.ts` get this right —
`searchV2Products` at `:283` calls `${VIATOR_V2_BASE}/products/search` (no
`/v1/`). Only the destinations call has the stray `/v1/taxonomy/` prefix.
That prefix is a holdover from Viator's *legacy V1* API (the
`viatorapi.viator.com/service/v1/taxonomy/destinations` path) that
shouldn't have been pasted into the V2 URL.

So this is NOT:
- a Viator deprecation (`/products/search` works fine on the same host, just needs auth)
- a Bali-specific issue (the destinations endpoint is global; Bali never enters into it)
- a Viator outage (the V2 host responds with structured JSON errors)

It IS:
- **a hand-written path bug.** The `/v1/taxonomy/` segment never belonged in a V2 URL.

---

## 4. Why all 4 categories show the same error

`searchViatorProducts` (`viatorClient.ts:351`) calls `findDestinationId`
(`:105`) which calls `loadDestinations` (`:64`). `loadDestinations` tries
V2 first; the V2 throw is captured into `v2Error`; the V1 fallback (`:96`)
fails too because **`viatorapi.viator.com` is offline (503)**;
`loadDestinations` then re-throws `v2Error` (the more diagnostic of the
two). That's why the V2 message is what surfaces, even though the V1
fallback also failed silently.

Per-category context: each of the 4 affected categories
(`sports_fitness`, `arts_culture`, `wellness`, `bucket_list`) routes
through Viator (per the registry) and tries to resolve the same
destination first. **All four call `findDestinationId('Bali (Canggu)', 'Indonesia')`
→ which calls `loadDestinations()` → which throws V2 404**. Same root,
four banners.

The destinations response is also cached (`cachedDestinations` at `:60`
with a 24h TTL), so if the first call had succeeded the other three would
hit the cache. Today none of them ever populate the cache.

---

## 5. Verification gaps — response shape

I confirmed the URL but **not the response shape** of the live endpoint
(would need a real `exp-api-key`). Our current unpacking at `:76` accepts
both `data.destinations` and `data.data`:

```ts
cachedDestinations = data.destinations || data.data || [];
```

That's a reasonable defensive parse. The V2 `/partner/destinations`
response, per the docs / similar partner-API responses I've seen, returns
`{ data: [ { destinationId, name, type, parentDestinationId, … } ] }`
where each destination has the same `destinationId` / `destinationName` /
`destinationType` shape `findDestinationId` already reads. The defensive
parse should handle it. Worth eyeballing once the URL fix is in.

---

## 6. Proposed one-line fix (DO NOT IMPLEMENT — awaiting approval)

`src/lib/viatorClient.ts:75` — change one URL:

```diff
-    const res = await fetch(`${VIATOR_V2_BASE}/v1/taxonomy/destinations`, {
+    const res = await fetch(`${VIATOR_V2_BASE}/destinations`, {
       headers: v2Headers(),
     });
```

…and update the error label at `:79` to match (also one-line) so the
banner says the right path next time:

```diff
-      throw new ViatorApiError('V2 /v1/taxonomy/destinations', res.status, await res.text());
+      throw new ViatorApiError('V2 /destinations', res.status, await res.text());
```

### Secondary cleanup (optional — separate concern, can be its own PR)

- **The V1 fallback at `:96` and the V1 search-products fallback at `:333`
  are dead code.** `viatorapi.viator.com` returns 503 — that host has been
  retired. The fallback adds latency and produces noise in the error
  message ("V1 destination load also failed" log line every single call).
  Recommend deleting the V1 paths entirely. Out of scope for the
  destinations fix itself; flagged as a separate cleanup.
- **Response field name validation**: once the URL fix is in, the first
  successful call will print `[Viator] Loaded N destinations (V2)`. If
  that N is 0, the V2 response uses a field name we don't expect — easy
  follow-up. The `findDestinationId` matcher already reads
  `destinationName` / `destinationType` directly, so the per-item shape
  is what matters more than the wrapper.

---

## Sources

- [Viator — Partner API technical guide (v2 conventions, headers)](https://partnerresources.viator.com/travel-commerce/technical-guide/)
- [Viator — Upgrade your connection to v2](https://partnerresources.viator.com/travel-commerce/upgrade-to-v2/)
- [Viator — Affiliate API docs index](https://docs.viator.com/partner-api/affiliate/technical/)
- Direct HTTP probes against `api.viator.com/partner/*` (see §2; no API
  key used — only 4xx codes observed).
