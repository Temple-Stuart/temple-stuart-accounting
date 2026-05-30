# TRAVEL — PR-20 Verify Audit: why the 3 diagnostic lines don't appear in prod logs

**Branch:** `claude/travel-pr-20-verify-audit`
**Date:** 2026-05-30
**Mode:** READ-ONLY.
**Question:** PR-20 is merged + deployed, but the 3 new `[LiteAPI]` lines
(mode/keyPrefix, rates http, rates raw dataLen) don't appear in Vercel — only the
pre-existing `[LiteAPI] accommodation: 0 hotels` summary shows. Why?

---

## 1. The 3 lines ARE on main (PR-20 landed)

`src/lib/liteapiClient.ts` on current main:
- `:236` — `console.log(\`[LiteAPI] mode=${liteMode} keyPrefix=${liteKeyPrefix}\`)`
- `:249` — `console.log(\`[LiteAPI] rates http: status=${res.status} ok=${res.ok}\`)`
- `:259` — `console.log(\`[LiteAPI] rates raw: dataLen=… hotelsLen=… status=${res.status}\`)`

All three present and all plain `console.log`. **Not a "missing from main" problem.**

## 2. The accommodation path DOES reach searchHotelRates (no short-circuit)

- `route.ts:11` imports `searchHotelRates` from `@/lib/liteapiClient` — the exact
  file holding the 3 lines.
- `route.ts:192` enters the LiteAPI block straight from registry dispatch
  (`:182`); `route.ts:231` `const hotels = await searchHotelRates({ … })`.
- The summary `[LiteAPI] accommodation: ${finalResults.length} hotels`
  (`route.ts:244`) is the **only** producer of that line, and it sits **inside
  the try, after** the `await searchHotelRates(...)` call. It logs only when the
  call returned (no throw).

The 3 lines (`:236/:249/:259`) are in the **linear body** of `searchHotelRates`,
before its `return merged.slice(…)`, with **no early return** between function
entry and them. So: **if `:244` "0 hotels" is produced, `searchHotelRates` ran to
completion and the 3 lines executed in the same invocation.** No short-circuit
skips them.

## 3. The 400 is NOT accommodation

400 paths: `route.ts:155` (missing city/country) and `:163` (invalid category).
`accommodation` is a valid `TRAVEL_COA` key, so `:163` can't fire for it; and it
shares the same city/country as every other category, so `:155` won't single it
out. Accommodation reaches the LiteAPI block (it logs `:244`). The concurrent 400
is a **different** parallel category (a stale/removed key hitting `:163`) — not
the accommodation request, and unrelated to the missing lines.

## 4. Caching — the LiteAPI path never reads cache (ruled out)

The cache helpers (`getCachedPlaces` / `isCacheFresh` / `cachePlaces`,
`route.ts:5`) are used **only in the Google path** (`route.ts:358-369`). The
LiteAPI block (`:192-264`) has **no cache read** — every accommodation scan calls
`searchHotelRates` fresh. So a cached "0 hotels" can't bypass the 3 lines.
(Client-side, TripPlannerAI shows stored `scanner_results` on mount, but that's a
GET that produces **no** server `[LiteAPI]` logs — so any server-side `[LiteAPI]`
line implies a real call.)

## 5. Console stripping — NOT configured (ruled out)

`next.config.ts` has **no `compiler.removeConsole`** (full file reviewed:
eslint/webpack/headers/redirects only). `console.log` is not stripped in prod —
and the summary `:244` is itself a `console.log` that *does* appear, which alone
disproves stripping.

---

## VERDICT — ranked

### (a) MOST LIKELY — the 3 lines are firing but are INVISIBLE to a category/destination-scoped log search

`searchHotelRates` has **no knowledge of the category or destination** — its
three lines carry only a generic `[LiteAPI]` prefix and contain **no
"accommodation" and no city token**:
```
[LiteAPI] mode=production keyPrefix=prod
[LiteAPI] rates http: status=200 ok=true
[LiteAPI] rates raw: dataLen=0 hotelsLen=12 status=200
```
The route's lines, by contrast, **do** carry the category:
- `route.ts:229` → `[LiteAPI] accommodation: Bali (Canggu), … (2026-07-01 → …)`
- `route.ts:244` → `[LiteAPI] accommodation: 0 hotels (hardBookable=true)`

If Alex finds "the accommodation log" by **filtering/searching Vercel for
`accommodation` (or `Bali`)** — the natural query — the 3 new lines **don't match
that filter** and look absent, even though they're emitted microseconds earlier
in the same request. They only surface under a broader query like `[LiteAPI]`,
`rates raw`, `mode=`, or `dataLen`.

**This is the single most probable cause** and it's verifiable purely from code
(the lines lack the category tag the route lines have). It also implies the
*real* data is already in the logs — Alex just needs to grep `[LiteAPI] rates
raw:` to read `dataLen`, and `[LiteAPI] mode=` to read prod-vs-sandbox.

> Fix direction (a follow-up, not this audit): tag the `searchHotelRates` lines
> with the search context (e.g. city/coords + dates) so they sort next to the
> route summary under a destination search. The data is correct; only the
> greppability is off.

### (b) POSSIBLE secondary — concurrent-burst log sampling
A full scan fires ~9 categories in parallel (`Promise.allSettled`), each emitting
several `console.log`s in a tight burst. Vercel's log pipeline can rate-limit/drop
lines under bursts. This could thin the per-request lines while the terminal
summary survives — but it's probabilistic, so it doesn't cleanly explain the
*consistent* absence of exactly these three. Plausible contributor, not the
primary.

### (c) LESS LIKELY — stale/no-fresh-call
If no accommodation POST actually ran post-deploy (e.g. the UI rendered cached
`scanner_results` and Alex read historical `:244` entries), only old summary
lines would show. The "request count 6→9 = new code live" signal argues against
this, but if in doubt: trigger a deliberate **Refresh** and immediately grep
`[LiteAPI] rates raw:` for that timestamp.

### Ruled out
- **(d) short-circuit before the call** — `:244` only logs *after*
  `searchHotelRates` returns; reaching it means the 3 lines ran.
- **(e) lines missing from main** — present at `:236/:249/:259`.
- **console stripping** — no `removeConsole` in `next.config.ts`.
- **cache bypass** — LiteAPI path never reads cache.

---

## What Alex should do to confirm (read-only)
Search Vercel runtime logs for the **untagged** strings, not the category:
- `[LiteAPI] mode=` → confirms `production` / `sandbox` + key prefix.
- `[LiteAPI] rates http:` → the HTTP status.
- `[LiteAPI] rates raw:` → `dataLen` / `hotelsLen` for the real search.

If those three return hits, verdict (a) is confirmed and the empty-vs-real
question is answerable (`dataLen=0 mode=production` ⇒ upstream-empty;
`dataLen=0 mode=sandbox` ⇒ prod not live). If they return **nothing** even for a
fresh Refresh timestamp, escalate to (b) log sampling.

---

**READ-ONLY audit. No implementation performed.**
