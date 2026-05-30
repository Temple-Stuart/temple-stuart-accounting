# TRAVEL — PR-23 Implementation: Individual guest reviews via /v3.0/data/reviews

**Branch:** `claude/travel-pr-23`
**Date:** 2026-05-30
**Scope:** Fill the PR-22 seam with real written guest reviews from a new paid
LiteAPI call. 2 files (`liteapiClient.ts` + detail page). 0 new deps, 0 schema.

---

## STEP 1 — Live `/v3.0/data/reviews` response shape (no assumed names)

Confirmed from LiteAPI docs (a real sample object):
```json
{ "data": [ {
  "averageScore": 9,
  "country": "us",
  "type": "family with young children",
  "name": "Daisha",
  "date": "2024-06-20 04:10:14",
  "headline": "The stay was pleasant ,...",
  "language": "en",
  "pros": "it was beachfront , so it wasn't a far walk at all .",
  "cons": "the kitchen area could have been more nicer ."
} ] }
```
Top-level wrapper `{ data: [...] }`; per-review fields: **`averageScore`**
(number), **`country`** (2-letter), **`type`** (guest category), **`name`**
(first name), **`date`** (`YYYY-MM-DD HH:MM:SS`), **`headline`**, **`language`**,
**`pros`**, **`cons`**. The `HotelReview` interface (`liteapiClient.ts:717-727`)
mirrors these exactly — all optional, rendered only when present.

## STEP 2 — Client function (reuses auth/mode path)

`getHotelReviews(hotelId, opts)` — `liteapiClient.ts:732-762`:
- `GET ${LITEAPI_BASE}/data/reviews?hotelId=…&limit=…` (`:747`), params
  `limit` (default 8), `offset`, `getSentiment`, `timeout`.
- **Same auth path as `searchHotelRates`:** `headers()` → `getApiKey()` →
  `X-API-Key` (`:748`); `getApiKey` throws `MissingLiteApiKeyError` if no key.
- **PR-20-style logging** (`:744`, `:751`, `:761`): `[LiteAPI] reviews: mode=…
  keyPrefix=… hotelId=…`, `[LiteAPI] reviews http: status=… ok=…`,
  `[LiteAPI] reviews: dataLen=… (B-5100 COGS — paid call)` (4-char key prefix
  only, never the full key).
- **Fail-loud:** non-2xx → `throw new LiteApiError('/v3.0/data/reviews', …)`
  (`:753`). An API error is NEVER returned as `[]`, so callers distinguish
  "errored" from "no reviews".

## STEP 3 — Auth-gated fetch (paid-call protection)

The detail page is a **server component already auth-gated**: `getVerifiedEmail()`
→ `redirect` if absent (`page.tsx:101-102`), user lookup → redirect (`:107`),
plus the trip is loaded `where: { id: tripId, userId: user.id }` (ownership).
So PR-23 fetches reviews **directly server-side** (`page.tsx:168-176`) — no new
public route, the paid call can never be hit anonymously. Guarded by
`source === 'liteapi' && rec.liteapiHotelId` so it only fires for real hotels.

## STEP 4 — Render at the seam (three distinct states)

`page.tsx:277-307` replaces the PR-22 seam comment. Inside the existing "Guest
reviews" block, below the aggregate badge:
- **error** (`reviewsError`) → muted "Guest reviews couldn't be loaded right now."
- **empty** (`reviews.length === 0`) → muted "No written guest reviews yet."
- **list** → per review: `averageScore` badge (brand-purple), `name`,
  `country`, `type`, `date` (sliced to the day), `headline`, and `pros`/`cons`
  (green `+` / red `−`). **Only fields present in the response render** — nothing
  fabricated.

**Zero reviews = quiet empty (a render case), NOT a synthesized fallback** — and
it's a state DISTINCT from the error state, so an API failure is never disguised
as "no reviews".

## STEP 5 — Cost tracking (B-5100 COGS) — flagged

This is a paid LiteAPI call → B-5100 COGS. **The rates/prebook/book LiteAPI calls
do NOT track per-call COGS today** (grep of `src/app/api/travel/liteapi` found no
cost/ledger logic) — they only log. PR-23 **matches that pattern**: it logs the
paid call with a `B-5100 COGS` marker (`liteapiClient.ts:757-761`) but does **not**
write a ledger entry on this read path. **Flagged:** a unified LiteAPI
COGS-tracking PR should ledger all paid calls (rates, prebook, book, reviews) to
B-5100 consistently — out of scope here, and inventing a one-off ledger write on
a GET render path would diverge from the established (untracked) rates pattern.

---

## Hard-constraint compliance

| Constraint | Status |
|---|---|
| Auth-first (paid call behind verifyCookie+user) | ✅ server component gated by `getVerifiedEmail`+ownership (`page.tsx:101-107`); fetch at `:168-176` |
| Real data only; zero reviews → quiet empty | ✅ only response fields render; empty → muted line; nothing fabricated |
| Throw on API error (fail-loud, no silent empty) | ✅ `getHotelReviews` throws on non-2xx (`liteapiClient.ts:753`); page keeps error state distinct from empty |
| Pricing (PR-21), charge path (PR-15/ReserveHotelButton), card, aggregate badge untouched | ✅ `ReserveHotelButton.tsx` + `TripPlannerAI.tsx` **not in diff**; diff grep for pricing/charge/aggregate-badge lines returns **nothing** |
| 0 new deps | ✅ |
| 0 schema | ✅ |
| `tsc --noEmit` | ✅ exit 0 |
| eslint changed files | ✅ `liteapiClient.ts` 0/0, detail page 0/0 (identical to main) |

**git diff scope:** `src/lib/liteapiClient.ts` (+getHotelReviews) + the detail
page (import + server fetch + seam render) + this report. Nothing else.

---

## Result
The hotel detail page now renders real written guest reviews (score, author,
country, type, date, headline, pros/cons) from a paid, auth-gated
`/v3.0/data/reviews` call — with honest error/empty/list states and never a
fabricated review. Pricing, the charge path, the card, and the aggregate badge
are byte-unchanged.
