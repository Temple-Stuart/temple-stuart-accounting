# TRAVEL — PR-15 Audit: Per-Night Price + `extractNightlyRate` Latent-Bug Fix

**Branch:** `claude/travel-pr-15-audit`
**Date:** 2026-05-30
**Mode:** READ-ONLY. Audit before action. No code changed.
**Goal:** Diagnose the mislabeled-total bug PR-13 flagged, propose the per-night
computation + the bucketing repair, and trace **every** caller so the fix
doesn't silently break the price field, the price filter, or the booking ledger.

---

## 1. Re-located bug (line-shifted since PR-13)

`extractNightlyRate` now lives at **`src/lib/liteapiClient.ts:356-368`** (PR-13
cited ~:294). The PR-13 TODO is intact at **`:352-355`**:

```
352  TODO(PR-15): name says "nightly" but `retailRate.total` is the WHOLE-STAY
353  total, so nightlyToPriceLevel() over-buckets multi-night stays. PR-15 owns
354  the real per-night computation using `hotel.nights` (threaded in PR-13 via
355  searchHotelRates). Left unfixed here to keep PR-13 a pure mapper expansion.
```

What it reads + returns (`:356-368`):
```ts
const total = rate.retailRate?.total?.[0]?.amount;          // :359  WHOLE-STAY total
if (typeof total === 'number' && total > 0) return total;   // :360
const suggested = rate.retailRate?.suggestedSellingPrice?.[0]?.amount; // :361
if (…) return suggested;                                    // :362
const offer = rate.offerRetailRate?.amount;                 // :363
if (…) return offer;                                        // :364
return null;
```
It returns `retailRate.total[0].amount` — the **whole-stay total**, despite the
"nightly" name. The single call site is **`:433`** (`const nightlyUsd =
extractNightlyRate(hotel)`), and that value feeds **two** things (see §7).

---

## 2. Threshold bucketing — proving the mismatch with real numbers

`nightlyToPriceLevel` at **`src/lib/liteapiClient.ts:415-423`**, called at
**`:434`** with the total:

```
417  function nightlyToPriceLevel(usd: number | null) {
419    if (usd < 80)  return { level: 1, display: '$'   };
420    if (usd < 200) return { level: 2, display: '$$'  };
421    if (usd < 400) return { level: 3, display: '$$$' };
422    return            { level: 4, display: '$$$$' };
423  }
```
Doc comment (`:415-416`): *"$-$80, $$-$200, $$$-$400, $$$$-above."* These are
unambiguously **per-night** thresholds (a hotel night under $80 = budget).

**Mismatch proof (worked example):** a $700 total for a 7-night stay.
- **Honest per-night:** $700 / 7 = **$100/night** → `100 < 200` → **level 2 `$$`**.
- **Current (buckets the total):** `nightlyToPriceLevel(700)` → `700 ≥ 400` →
  **level 4 `$$$$`** (luxury).

A budget-moderate hotel is rendered as `$$$$` — a **two-band** inflation. The
$1,400/7-night example from PR-13 → $200/night → should be `$$$` but shows
`$$$$`. Confirmed bug, with numbers.

---

## 3. `nights` / `priceTotal` / `currency` availability

All three are present on the recommendation and reachable where per-night must
be computed:
- `nights` is threaded by `searchHotelRates` onto each hotel
  (`liteapiClient.ts:272-285`) and read into the rec at **`:502`**
  (`nights: hotel.nights`).
- `priceTotal` from `extractRateMeta` (`:374-386`), set at **`:501`**.
- `currency` from the same extractor, set at **`:500`**.

The mapper (`liteApiHotelToRecommendation`, `:427-504`) has `priceTotal`,
`currency`, and `hotel.nights` all in local scope at the point of return — so
per-night can be computed once, in the mapper, with no new plumbing.

---

## 4. Per-night math — proposal + recommendation

**Computation:** `pricePerNight = priceTotal / nights`, guarded `nights > 0`.

**Where:** **in the mapper, stored as a new optional `pricePerNight` field** —
not at render. Rationale:
- Computed once, consistent across the card, the detail page, and the bucketing
  (three consumers today).
- Same backward-compat pattern as PR-13/14 — an optional field; Viator/Google
  recs leave it `undefined`.
- Render-time computation would have to be duplicated in ≥2 components and
  re-derive the guard each place.

**New field** (optional, added to all three rec interfaces — §7 lists them):
```ts
/** Per-night price = priceTotal / nights. Absent when nights is 0/unknown. */
pricePerNight?: number;
```

### ⚠️ FLAG FOR ALEX — the `nights = 0 / absent / null` case
When `nights` is `0`, `undefined`, or `null` (sandbox metadata-only hotels, or
hotels that quoted no window): per-night **cannot** be computed.

**The audit does NOT pre-decide a fallback.** What the audit *thinks* should
happen (for Alex to confirm): **show no per-night and bucket nothing** —
`pricePerNight = undefined`, `priceLevel = null` — mirroring PR-14's locked
"render nothing when no rate" decision. Do **not** synthesize a per-night, do
**not** divide by 1, do **not** fall back to bucketing the total (that's the
very bug). **Decision owner: Alex.** (Consequence to note: such hotels would
then have `priceLevel = null`, so the `maxPriceLevel` filter at
`ai-assistant/route.ts:377` lets them through — acceptable, since we can't
price-filter a hotel we can't price.)

---

## 5. The bucketing repair — before/after

The repair is to change the **input** to `nightlyToPriceLevel` from the total to
the per-night value. It is the real fix, not a rename.

**Before** (`liteapiClient.ts:433-434`):
```ts
const nightlyUsd = extractNightlyRate(hotel);          // = WHOLE-STAY total
const { level, display } = nightlyToPriceLevel(nightlyUsd);   // buckets TOTAL ✗
```

**After** (proposed):
```ts
const { total: priceTotal, currency } = extractRateMeta(hotel);
const pricePerNight =
  (priceTotal != null && hotel.nights && hotel.nights > 0)
    ? Math.round(priceTotal / hotel.nights)
    : undefined;                                        // §4 Alex-flag case
const { level, display } = nightlyToPriceLevel(pricePerNight ?? null); // buckets PER-NIGHT ✓
```
With the $700/7-night example: input flips from `700` (`$$$$`) to `100` (`$$`) —
the bucketing is now correct, which also corrects the **filter** (§7) and the
**sort** (§7), not just the badge.

> The misnamed `extractNightlyRate` can be left as-is (it still correctly
> sources the *total* for the `price`/`priceTotal` fields — see §7). Renaming it
> is cosmetic and optional; the substantive fix is feeding per-night into the
> bucket. A clarifying rename to `extractStayTotal` is a taste call (§8).

---

## 6. Display upgrade (additive to PR-14)

PR-14's hotel-card price line is **`TripPlannerAI.tsx:1055-1058`**:
```tsx
{rec.priceTotal != null && rec.nights != null ? (
  <span className="font-semibold text-brand-gold-bright">
    {rec.currency || '$'}{rec.priceTotal} · {rec.nights} nights
  </span>
) : ( … render nothing … )}
```
**Proposed upgrade** (per the locked additive decision):
`"$200/night · 7 nights · $1,400"` — lead with `pricePerNight`, keep `nights`,
keep `priceTotal` as the trailing total. Guard unchanged: render only when the
real numbers exist (`pricePerNight != null && nights != null`); otherwise the
PR-14 render-nothing path stands.

---

## 7. Blast radius — EVERY caller traced (the key risk)

`extractNightlyRate` is called **once** (`:433`); its return (`nightlyUsd`) fans
out to two sinks, and `priceLevel`/`price` then fan out further. Full map:

### Sink A — bucketing → `priceLevel` / `priceLevelDisplay`
| Consumer | File:line | Effect of the fix |
|---|---|---|
| local bucket call | `liteapiClient.ts:434` | now per-night ✓ |
| **price filter** | `ai-assistant/route.ts:377` (`p.priceLevel <= maxPriceLevel`) | **fixed** — inflated levels no longer wrongly filter out moderate hotels |
| priceLevel passthrough/display | `ai-assistant/route.ts:47,58` | now correct band |
| **sort by price** | `TripPlannerAI.tsx:380` (`sortBy==='price'` sorts on `priceLevel`) | **fixed** — ordering now reflects per-night |
| detail-page badge | `discover/[rank]/page.tsx:163` | now correct band |
| card non-liteapi branch | `TripPlannerAI.tsx:1097-1098` | unaffected (Viator/Google) |

### Sink B — the `price` field (`liteapiClient.ts:489 price: nightlyUsd`)
`price` is documented "nightly rate in USD" (`:322`) but currently holds the
**total**. Consumers:
| Consumer | File:line | Current behavior | Risk under the fix |
|---|---|---|---|
| **detail page** | `discover/[rank]/page.tsx:119-120` | `nightly = rec.price` (total); `totalForTrip = nightly × nights` | **DOUBLE-COUNT BUG** today: total × nights (a $1,400 stay shows `$9,800`). See below. |
| detail "/ night" label | `discover/[rank]/page.tsx:183` | `${nightly} / night` | shows the **total** labeled "/night" — wrong today |
| detail total | `discover/[rank]/page.tsx:189` | `${totalForTrip}` | inflated by ×nights today |
| **Reserve charge fallback** | `ReserveHotelButton.tsx:58` | `finalPriceCents = (prebook.price \|\| nightly \|\| 0)×100` | **see ⚠ below** |
| card non-liteapi branch | `TripPlannerAI.tsx:1096` | `${rec.price}` | Viator/Google only — unaffected |
| card liteapi branch | `TripPlannerAI.tsx:1055` | uses `priceTotal`, **not** `price` | unaffected |

**This bug has THREE live manifestations of one root cause** (per-night never
computed): the bucketing (§2), the detail-page **double-count**
(`page.tsx:120`), and the detail-page **"/night" mislabel** (`page.tsx:183`).

> ### ⚠️ The decisive blast-radius risk — the Reserve charge fallback
> `ReserveHotelButton.tsx:58`: `finalPriceCents = (prebook.price || nightly || 0)`.
> The real charge is the **live `prebook.price`**; `nightly` (= `rec.price`) is
> only the fallback when prebook omits a price. **Today `nightly` = the total,
> so the fallback charges the correct stay total.** If PR-15 were to change
> `price` to per-night, this fallback would charge **one night** instead of the
> whole stay — a silent **undercharge**.
>
> **Therefore the recommended fix keeps `price` = total (semantics UNCHANGED)**
> and introduces the *new* `pricePerNight` field for per-night display +
> bucketing. No existing field changes meaning → the Reserve fallback stays
> safe. The detail page is then fixed to read `pricePerNight` for "/night" and
> `priceTotal` for the total (removing the `× nights` double-count), and to keep
> passing the **total** to `ReserveHotelButton`'s charge fallback.

---

## 8. Scope + taste-vs-mechanical

**Files touched (recommended Option-2 = add `pricePerNight`, keep `price`=total):**
1. `src/lib/liteapiClient.ts` — compute `pricePerNight`, bucket on it, add field
   to `HotelRecommendation` (`:298`). (~10-15 lines)
2. `src/components/trips/TripPlannerAI.tsx` — add `pricePerNight?` to
   `GrokRecommendation` (`:12`); upgrade card price line (`:1055-1058`). (~6 lines)
3. `src/app/budgets/trips/[id]/discover/[category]/[rank]/page.tsx` — add
   `pricePerNight?` to `Recommendation` (`:27`); fix `:119-120` to use
   `pricePerNight` (/night) + `priceTotal` (total), removing the ×nights
   double-count; keep passing the total to Reserve. (~8 lines)
4. *(No change to `ReserveHotelButton.tsx` if the detail page passes the total to
   its `nightly` charge-fallback prop — confirm during impl.)*

- **New optional field:** **yes** — `pricePerNight?: number` on the 3 rec
  interfaces. Backward-compatible (Viator/Google leave it undefined).
- **0 route change** (the filter at `:377` reads the now-correct `priceLevel`,
  no code change), **0 schema change**, **0 new deps**.
- **Line estimate:** ~25-35 lines across 3 files. `tsc` + `eslint` clean.

**MECHANICAL (safe):**
- Add `pricePerNight` and bucket on it (the core fix).
- Card display upgrade to "$/night · N nights · $total".
- Detail-page: read `pricePerNight` for "/night", `priceTotal` for the total
  (kills the double-count).

**TASTE CALLS (confirm):**
- The **`nights = 0/absent` case** — render-nothing vs anything else (§4).
  **Alex's decision.**
- Whether to **rename** `extractNightlyRate → extractStayTotal` for honesty
  (cosmetic; the substantive fix doesn't need it).
- Exact display string ("$200/night · 7 nights · $1,400" vs a compacter form).

---

**READ-ONLY audit. No implementation performed.**
