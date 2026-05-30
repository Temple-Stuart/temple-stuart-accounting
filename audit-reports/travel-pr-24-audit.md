# TRAVEL — PR-24 Audit: the recurring POST 400 on /ai-assistant

**Branch:** `claude/travel-pr-24-audit`
**Date:** 2026-05-30
**Mode:** READ-ONLY.
**Question:** Which category sends the bad key that 400s on every scan, and why?

---

## 1. The two 400 paths

`src/app/api/trips/[id]/ai-assistant/route.ts`:
- **`:154-156`** — `if (!city || !country) → 400 "City and country required"`.
- **`:163-165`** — category validation:
  ```ts
  const isCOACategory      = !!category && !!TRAVEL_COA[category];                 // :163
  const isLegacyCategory   = !!category && !!CATEGORY_SEARCHES[category];          // :164
  const isInterestCategory = !!category && !!ACTIVITY_SEARCH_EXPANSIONS[category]; // :165
  if (!category || (!isCOACategory && !isLegacyCategory && !isInterestCategory)) {
    return NextResponse.json({ error: 'Valid category required' }, { status: 400 });
  }
  ```
  preceded by alias-resolution at **`:153-154`**:
  ```ts
  const category = rawCategory ? getCategoryByKey(rawCategory)?.key || rawCategory : rawCategory;
  ```

## 2. Which category 400s — `ground_transport`

The client scans the output of `getActiveScanCategories([], '')`
(`travelCOA.ts:297`), which iterates `TRAVEL_COA` keys and skips
flights/communication/insurance_fees/conferences/adventure/arts_culture/
wellness/bucket_list (+ business_meals on leisure trips). The **9 active keys**
are:
`accommodation, brunch_coffee, dinner, activities, nightlife, festivals,
coworking, ground_transport, shopping`.

Running each through the route's `getCategoryByKey(rawCategory)?.key || rawCategory`:

| key sent | `resolve()` via ALIASES | `getCategoryByKey().key` | route `category` | in TRAVEL_COA? | result |
|---|---|---|---|---|---|
| accommodation | — | (n/a) | accommodation | ✅ | 200/handled |
| brunch_coffee | — | — | brunch_coffee | ✅ | ok |
| dinner | — | — | dinner | ✅ | ok |
| activities | — | activities | activities | ✅ | ok |
| nightlife | — | nightlife | nightlife | ✅ | ok |
| festivals | — | festivals | festivals | ✅ | ok |
| coworking | — (not in CATEGORIES) | undefined → falls to raw | coworking | ✅ | ok |
| **ground_transport** | **→ `transport`** | **`transport`** | **`transport`** | **❌** | **400** |
| shopping | — | shopping | shopping | ✅ | ok |

**`ground_transport` is the single offender.**

## 3. Why — a taxonomy mismatch, NOT a stale bundle

Two taxonomies disagree on the transport key:
- **`TRAVEL_COA`** (canonical, current) uses **`ground_transport`**
  (`travelCOA.ts:181`). There is **no `transport` key** in `TRAVEL_COA`.
- **`travelCategories.ts`** (the older `lodging/dining/activities` taxonomy)
  uses **`transport`** (`travelCategories.ts:29`), and its `ALIASES` map bridges
  the COA key to it: **`ground_transport: 'transport'`** (`travelCategories.ts:40`,
  plus `groundTransport: 'transport'` at `:41`).

So the route's normalization step (`:154`, intended to repair *stale* keys like
`sports_fitness → adventure`) does the opposite here: it takes the **valid
current** COA key `ground_transport` and **renames it to the dead key
`transport`**. Then at `:163-165`:
- `TRAVEL_COA['transport']` → **undefined** (confirmed: no `transport:` in
  `travelCOA.ts`).
- `CATEGORY_SEARCHES['transport']` → **undefined** (no `transport:` in
  `placesSearch.ts`, where `CATEGORY_SEARCHES` is defined `:253`).
- `ACTIVITY_SEARCH_EXPANSIONS['transport']` → **undefined** (no `transport:` in
  `activities.ts`, where it's defined `:74`).

→ all three false → **400 "Valid category required"**, every scan.

**This is deterministic in the current code, not a cached/stale client.** The
other alias-resolved keys (`business_meals → dinner`, `toiletries → shopping`)
happen to resolve to keys that *do* exist in `TRAVEL_COA`, so only
`ground_transport → transport` breaks.

## 4. User-visible impact

`ground_transport`'s registry source is **`mozio`** (not yet wired), so the
*intended* outcome is a **501 UnimplementedSourceError** → a clean "Ground
Transport routes to mozio (coming soon)" banner. Instead, the 400 fires **before
dispatch**, so the client's `scanSingleCategory` (`TripPlannerAI.tsx:305`) sees
`!res.ok` and throws → `categoryErrors['ground_transport']` → the **Ground
Transport carousel renders a red error banner: "Couldn't load Ground Transport —
Valid category required."**

So: **not data-loss** (mozio has no real inventory regardless), but a
**misleading red error every scan** in place of the intended "coming soon", plus
log noise (a 400 per scan). Cosmetic-but-noisy and confusing.

---

## Fix options (for PR-24)

| # | Fix | Effect | Risk |
|---|---|---|---|
| **1 (recommended, 1-line)** | In `getActiveScanCategories` (`travelCOA.ts:303-area`) **skip `ground_transport`** alongside `communication`/`insurance_fees` — it routes to unwired `mozio`, so it has no scannable results today. | Removes the 400 + the empty would-be-501 slot entirely. Matches the existing "no scannable results" precedent. | Minimal. The `ground_transport` COA entry stays for budget mapping; only the scan is skipped. |
| 2 | Remove the `ground_transport`/`groundTransport` aliases (`travelCategories.ts:40-41`). | `getCategoryByKey('ground_transport')` → undefined → route keeps raw `ground_transport` → valid COA → dispatches to mozio → intended **501**. | **Side effects:** `getCOACode`/`getSection` also use `resolve()`; dropping the alias changes `ground_transport`'s COA code (9200 → 9950 default) and section. Broader. |
| 3 (most correct, root cause) | In `route.ts:153-154`, only adopt the resolved key when it's actually valid; else keep `rawCategory`: `const resolved = getCategoryByKey(rawCategory)?.key; const category = resolved && TRAVEL_COA[resolved] ? resolved : rawCategory;` | Alias-resolution can never invalidate a valid COA key again (fixes the whole class). `ground_transport` then dispatches to mozio → 501. | Route-logic change; needs a quick check that no other key relies on resolve-to-non-COA. |

**Recommendation:** **Option 1** for PR-24 — smallest, safest, kills the noisy
400 immediately, and `ground_transport` (mozio) genuinely isn't scannable yet so
skipping it is honest. Pair it with **Option 3** later as the principled
root-cause fix once mozio is wired and `ground_transport` should scan again.

**Scope:** Option 1 = **1-line** edit to the skip list in
`getActiveScanCategories` (`src/lib/travelCOA.ts`). 0 schema, 0 deps.

---

**READ-ONLY audit. No implementation performed.**
