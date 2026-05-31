# TRAVEL — PR-28f Audit: restore the dropped Google/Places + Viator category set

**Branch:** `claude/travel-pr-28f-audit`
**Date:** 2026-05-31
**Mode:** READ-ONLY.
**Goal:** Restore the category set the 28a/28e1b restructure dropped from the
scan surface, add Alex's requested categories, and map each to the correct API
(Google Places vs Viator) — with no PR-24 alias→dead-key 400. Git-history the
regression.

**Alex's targets:**
- **Google Places** (places you GO): Groceries/Shopping, Gyms, Coworking,
  Coffee+Brunch, Dinner
- **Viator** (things you DO): Sports Activities, Cultural Activities,
  Entertainment

---

## 1. Regression inventory (git history)

**Two independent surfaces gate what the user sees:**
- **scan set** = `getActiveScanCategories([], '')` (`src/lib/travelCOA.ts:297-325`)
  — which COA keys get *scanned*.
- **render set** = `CAROUSEL_ORDER` (`src/components/trips/TripPlannerAI.tsx:1047-1065`)
  filtered by `ACTIVE_SCAN_SET` (`:1067`) — which scanned keys get *rendered*.

A category must be in **both** to appear. The regression is in `CAROUSEL_ORDER`.

### BEFORE — `CAROUSEL_ORDER` at PR-4 (`5542378d`, git-cited)
`git show 5542378d:src/components/trips/TripPlannerAI.tsx` (the `CAROUSEL_ORDER`
block) listed **12** entries:
```
accommodation, sports_fitness, arts_culture, wellness, bucket_list,
brunch_coffee, dinner, nightlife, coworking, shopping, conferences,
ground_transport
```
(`sports_fitness` was the pre-PR-9 name for `adventure`.) So the BEFORE
Google/Places discovery surface was **brunch_coffee, dinner, nightlife,
coworking, shopping, conferences**, and the Viator surface was **4 distinct
buckets** (sports/arts/wellness/bucket_list).

### Intervening collapses (legitimate, git-cited)
- **PR-9** (`a64f5718`) renamed `sports_fitness`→`adventure`.
- **PR-11** (`729fd523`) collapsed the 4 Viator carousels into **one
  `activities`** bucket; `getActiveScanCategories` now skips
  `adventure/arts_culture/wellness/bucket_list` (`travelCOA.ts:317`).
- **PR-10 Fix 6** dropped `conferences` (Google returns venues, not events;
  `travelCOA.ts:305-311`).

### CURRENT — `CAROUSEL_ORDER` now (`TripPlannerAI.tsx:1047-1065`)
**8** entries:
```
accommodation, ground_transport, activities,
brunch_coffee, dinner, nightlife, coworking, shopping
```
Rendered by 28e1b as: Hotels, Ground Transport, Activities (Viator unified), and
a single combined **Places** section merging the 5 Google keys
(`TripPlacesSection`, `TripPlannerAI.tsx:899-901` filters `CAROUSEL_ORDER` for
`source==='google'` → `brunch_coffee, dinner, nightlife, coworking, shopping`).

### What was DROPPED — exactly
| Category | In scan set now? | In `CAROUSEL_ORDER` now? | Status |
|---|---|---|---|
| **festivals** | ✅ YES (active) | ❌ **NO** | **scanned but never rendered — pure regression** |
| **conferences** | ❌ (skipped `:311`) | ❌ | deliberately dropped PR-10 (business-only, no real event API) |

So `CAROUSEL_ORDER` omits **`festivals`** even though it's in the active scan set
— the clearest dropped item. (The 4 legacy Viator keys are intentionally folded
into `activities`, not a regression.) **No Google key currently in the scan set
is missing from the render set besides `festivals`** — the bigger gap vs Alex's
ask is the categories that **never existed as their own scannable keys**: **Gyms**
and **Groceries** (see §3).

## 2. Current active categories (cited)

- **`getActiveScanCategories([], '')`** (`travelCOA.ts:297-325`) iterates
  `TRAVEL_COA` (`:26-250`) and skips: `flights` (`:302`),
  `communication`/`insurance_fees` (`:304`), `conferences` (`:311`),
  `adventure`/`arts_culture`/`wellness`/`bucket_list` (`:317`), and
  `business_meals` unless business/mixed (`:319`). **Active result:**
  `accommodation, brunch_coffee, dinner, activities, nightlife, festivals,
  coworking, ground_transport, shopping`.
- **`CAROUSEL_ORDER`** renders only 8 of those (drops `festivals`).
- **`TripPlacesSection`** merges the Google subset:
  `brunch_coffee, dinner, nightlife, coworking, shopping` (the `source==='google'`
  members of `CAROUSEL_ORDER`, per `getSource`).

## 3. Per-category: source, def-exists, valid-key (no 400)

A key resolves **valid** (no PR-24 400) iff `isValidCategory` is true —
`!!TRAVEL_COA[key] || !!CATEGORY_SEARCHES[key] || !!ACTIVITY_SEARCH_EXPANSIONS[key]`
(`route.ts:113-114`). Google COA keys get queries via `getCOAScanQueries`
(`route.ts:374-375`, `travelCOA.ts:265-291`).

### Google Places targets (places you GO)
| Target | Maps to key | Source (`SOURCE_BY_CATEGORY`) | Def exists? | Valid key? |
|---|---|---|---|---|
| **Coffee + Brunch** | `brunch_coffee` | google (`registry:` brunch_coffee) | ✅ `scanQueries` `travelCOA.ts:58` | ✅ COA key |
| **Dinner** | `dinner` | google | ✅ `travelCOA.ts:69` | ✅ |
| **Coworking** | `coworking` | google | ✅ `travelCOA.ts:176` | ✅ |
| **Groceries/Shopping** | `shopping` | google | ✅ `travelCOA.ts:212` (`shopping mall, local market, convenience store, pharmacy drugstore`) | ✅ |
| **Gyms** | *(none today)* | — | ❌ **no dedicated COA key** | needs add |

- **Coffee/Brunch, Dinner, Coworking, Shopping**: all four are **already active +
  rendered** (in Places). **Reactivate-only is moot — they're live.** Note
  "Groceries" ≈ `shopping`'s existing `local market / convenience store` queries;
  if Alex wants groceries as a *distinct* section, that's a new key (see §6).
- **Gyms**: there is **no `gym` COA key**. Gym queries exist only inside the
  *legacy* `CATEGORY_SEARCHES.wellness` (`placesSearch.ts:347` `gym fitness center
  crossfit`) — but `wellness` routes to **Viator** in the registry
  (`travelSourceRegistry.ts`), and `wellness` is skipped from the scan set
  (`travelCOA.ts:317`). To surface **Gyms on Google**, a **new COA key**
  (e.g. `fitness`/`gyms`, `source: google`, `scanQueries: ['gym fitness center',
  'crossfit box', 'climbing gym', 'yoga pilates studio']`) is needed. Adding it to
  `TRAVEL_COA` makes it valid automatically (`isValidCategory` via `TRAVEL_COA`).

### Viator targets (things you DO)
| Target | Maps to | Source | Def exists? | Valid key? |
|---|---|---|---|---|
| **Sports Activities** | `activities` (unified Viator) | viator | ✅ unified bucket (`travelCOA.ts:92`, `viatorClient.ts:373` pulls ALL products) | ✅ |
| **Cultural Activities** | `activities` (unified) | viator | ✅ same bucket | ✅ |
| **Entertainment** | `activities` (unified) **or** `nightlife` (Google) | viator/google | partial | ✅ |

- Post-PR-11, Viator is **one `activities` carousel** that pulls the destination's
  **entire** product pool (`viatorClient.ts:366-389` — no intent partitioning).
  So "Sports", "Cultural", "Entertainment" Viator inventory **already surfaces**
  inside the single Activities section — they are **not separate sections today**.
- To give them **distinct sections** (Alex's framing), the cleanest path is to
  **un-collapse** the legacy Viator keys: reactivate `adventure` (Sports),
  `arts_culture` (Cultural) — both already have `COA_TO_VIATOR_SEARCH` terms
  (`viatorClient.ts:209-210`), are in `VIATOR_CATEGORIES` (`:559-563`), and are
  valid COA keys. That means **editing `getActiveScanCategories:317`** to stop
  skipping them + adding them to `CAROUSEL_ORDER`. **Reactivate-only, no new def.**
- **Entertainment**: ambiguous — Viator has "shows/entertainment" products, but
  the registry deliberately moved `nightlife` (bars/clubs/live-music venues) to
  **Google** (`travelSourceRegistry.ts` "Moved OFF Viator … Google Places is fine
  for discovery"). If "Entertainment" = bookable shows → Viator (a new
  `entertainment` Viator key, needs `COA_TO_VIATOR_SEARCH` terms); if =
  venues/nightlife → the existing Google `nightlife` (already live). **Needs Alex
  disambiguation.**

## 4. Google vs Viator split + which section renders each

| Target | Source | Renders in |
|---|---|---|
| Coffee+Brunch, Dinner, Coworking, Shopping/Groceries, **Gyms (new)** | **Google** | **Places** combined section (`TripPlacesSection`) — any `source==='google'` COA key in `CAROUSEL_ORDER` is auto-merged (`TripPlannerAI.tsx:899-901`) |
| Sports (`adventure`), Cultural (`arts_culture`) | **Viator** | a Viator `TripApiSection` — today everything Viator funnels through the single **Activities** section; distinct sections require un-collapsing + their own `TripApiSection` entries |
| Entertainment | Viator or Google (TBD §3) | Activities (Viator) or Places (Google `nightlife`) |

**Key correctness note:** because `TripPlacesSection` derives its members
**dynamically** from `CAROUSEL_ORDER` × `source==='google'`, restoring a Google
category is a **one-line `CAROUSEL_ORDER` add** (it auto-joins Places). Viator
categories render via `TripApiSection` only if **un-collapsed**, since the
single `activities` bucket already pulls all Viator inventory.

## 5. Quota reality

- **Google Places**: live but quota-limited. When the daily quota is exhausted the
  scan route surfaces the upstream error as the per-category inline **red banner**
  (`categoryErrors[catKey]` → `TravelCarousel`), i.e. an **honest 429** — never a
  fabricated empty. Google calls are cache-first (`route.ts:397-408`,
  `isCacheFresh`/`getCachedPlaces`) so a fresh cache serves 0 calls. The combined
  Places section forwards the **first** Google category error (28e1b,
  `TripPlannerAI.tsx` `TripPlacesSection` `err = …find(Boolean)`), so a 429 is
  shown, not masked.
- **Viator**: live now (`isSourceImplemented` true for viator,
  `travelSourceRegistry.ts`), `activities` pulls real inventory
  (`viatorClient.ts:373-389`). hardBookable → empty/error stays loud
  (`route.ts:355-357`), no Google masking.

## 6. Scope — per-category reactivate vs new-def

| Target | Action | Files / lines |
|---|---|---|
| Coffee+Brunch, Dinner, Coworking, Shopping | **none** — already active+rendered in Places | — |
| **festivals** (dropped regression) | **render-only:** add `'festivals'` to `CAROUSEL_ORDER` (it's already scanned + google). Confirm `festivals` source — it's **not** in `SOURCE_BY_CATEGORY` so `getSource` returns the **Google default** (`travelSourceRegistry.ts` `DEFAULT_ASSIGNMENT`); it has interest-driven queries (`travelCOA.ts:149-150`, empty `scanQueries` → label fallback). **1 line** in `CAROUSEL_ORDER`; consider adding an explicit `festivals: { google, false }` registry entry for clarity. | `TripPlannerAI.tsx:1047-1065` (+ optional `travelSourceRegistry.ts`) |
| **Groceries** (if distinct from shopping) | **new COA key** `groceries` (google) `scanQueries: ['supermarket grocery store', 'local food market', 'organic health food store']` + registry entry + `CAROUSEL_ORDER`. Else fold into existing `shopping`. | `travelCOA.ts`, `travelSourceRegistry.ts`, `TripPlannerAI.tsx` |
| **Gyms** | **new COA key** `fitness`/`gyms` (google) + `scanQueries` (gym/crossfit/climbing/pilates) + registry `{google,false}` + `CAROUSEL_ORDER`. | `travelCOA.ts`, `travelSourceRegistry.ts`, `TripPlannerAI.tsx` |
| **Sports (Viator)** = `adventure` | **reactivate:** remove `adventure` from the `:317` skip + add to `CAROUSEL_ORDER` (its own `TripApiSection`). Def + Viator terms already exist (`viatorClient.ts:209`). | `travelCOA.ts:317`, `TripPlannerAI.tsx`, + page `TripApiSection` |
| **Cultural (Viator)** = `arts_culture` | **reactivate:** same pattern; terms at `viatorClient.ts:210`. | same |
| **Entertainment** | **decide source first** (§3). If Viator-bookable → new `entertainment` key + `COA_TO_VIATOR_SEARCH` terms; if nightlife/venues → already-live Google `nightlife`. | TBD |

**Common render wiring (per restored section):** each Google key auto-joins the
**Places** combined section once in `CAROUSEL_ORDER`. Each Viator key needs (a)
un-skip in `getActiveScanCategories`, (b) a `CAROUSEL_ORDER` entry, and (c) a
`<TripApiSection catKey=… title=…>` in `page.tsx` (28e1b pattern). **No route
change** — the route already dispatches any valid COA key via the registry. **No
PR-24 400** as long as every new key is added to `TRAVEL_COA` (which makes
`isValidCategory` true).

**Estimate:** mostly reactivation + a few new COA keys. ~1 file for the pure
`festivals` regression fix; ~3 files (`travelCOA.ts`, `travelSourceRegistry.ts`,
`TripPlannerAI.tsx` + `page.tsx` for Viator sections) for the full Alex set.
**0 schema, 0 deps.**

## What needs Alex sign-off
1. **Groceries**: distinct new `groceries` Google section, or just the existing
   `shopping` (which already queries markets/convenience stores)?
2. **Gyms**: confirm new Google `fitness` key (gym/crossfit/climbing/pilates
   queries) — and whether it overlaps the Viator `wellness` bucket.
3. **Sports & Cultural as distinct Viator sections** (un-collapse `adventure` +
   `arts_culture`) vs leaving them inside the single unified **Activities**
   carousel (which already surfaces all Viator inventory).
4. **Entertainment** source: bookable Viator shows (new key + terms) vs the
   already-live Google `nightlife` (bars/clubs/live-music venues).
5. Whether to also restore **conferences** (needs a real event API, per PR-10) or
   keep it dropped.

---

**READ-ONLY audit. No implementation performed.**
