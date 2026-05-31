# TRAVEL — PR-28f-2 Implementation: expand `sports` to a robust ~15-term query set

**Branch:** `claude/travel-pr-28f-2`
**Date:** 2026-05-31
**Scope:** Expand the `sports` category's Google query list from 6 terms to a
curated 15-term set covering the full membership/recreation-PLACE spectrum.
**Query list only** — COA key, source, COA code, and section are all exactly as
PR-28f set them. Per the task. 1 file + this report. **0 schema, 0 deps.**

---

## STEP 1 — Sports query location

The 6 PR-28f `sports` queries lived in **`src/lib/travelCOA.ts:257`** as the
`scanQueries` array on the `sports` COA entry (`:250-260`). Confirmed unchanged
context: `source: google` (via `SOURCE_BY_CATEGORY.sports`,
`travelSourceRegistry.ts:106`), `coaPersonal: 'P-9530'` (`travelCOA.ts:254`,
recurring-membership line), `coaBusiness: null`, `googlePlacesType: null`,
`multiDay: true`. (These are membership PLACES — Google Places — not Viator
activities.)

## STEP 2 — Expanded to the robust set (format matched)

Replaced the 6-term inline array with the curated **15-term** set
(`travelCOA.ts:257-273`):

```
tennis court club · pickleball court · padel club · squash court ·
golf club course · surf school spot · kitesurfing center ·
ski snowboard resort · ice skating rink · climbing gym bouldering ·
boxing martial arts gym · yoga pilates studio · crossfit box ·
swimming pool aquatic center · skate park
```

Spectrum coverage: **racket** (tennis/pickleball/padel/squash) → **golf** →
**water** (surf/kite/swimming) → **snow/ice** (ski-snowboard/ice-rink) →
**climbing** → **combat** (boxing/martial arts) → **studios** (yoga-pilates/
crossfit) → **skate**.

**Format matched:** the file's existing style is **single-quoted multi-word
qualifier strings** in a JS array (e.g. `shopping.scanQueries` `:212`
`['shopping mall', 'local market', …]`, `gyms` `['gym fitness center', 'crossfit
box', …]`). Each term is a multi-word phrase — **not** a bare Google Place-Type
slug — which the file's other entries deliberately use to dodge the
`INVALID_REQUEST` parser quirk (cited in `shopping`/`coworking`/`nightlife`
comments). The longer list is written multi-line, mirroring how the file's larger
query sets (e.g. `dinner` `:62-72`, `nightlife`) are formatted. 15 terms keeps the
per-scan Google call budget bounded (each query = one call → quota/cost); good
multi-word terms expand naturally via Google's place-matching.

## STEP 3 — No regression

- **`sports` still in `TRAVEL_COA`** (`:250`) → `isValidCategory` true
  (`route.ts` checks `!!TRAVEL_COA[key]`) → **no PR-24 alias→dead-key 400.**
- **Still Google source** — `SOURCE_BY_CATEGORY.sports = { source: 'google',
  hardBookable: false }` (`travelSourceRegistry.ts:106`), unchanged.
- **Still P-9530** (`travelCOA.ts:254`), `coaBusiness: null`, unchanged.
- **Still renders in the combined Places section** — `sports` remains in
  `CAROUSEL_ORDER` (`TripPlannerAI.tsx:1066`); `TripPlacesSection` derives Google
  members dynamically (`source==='google'`), so it auto-includes `sports`.
- **Only the query LIST changed** — verified by `git diff`: the sole content
  delta is the `scanQueries` array (+ an explanatory comment). COA key, source,
  code, section, frequency, vendorApi all untouched.

## Hard-constraint compliance

| Constraint | Status |
|---|---|
| Query list expansion ONLY (no new key/source/code/section) | ✅ diff = `scanQueries` array + comment only |
| Match existing query string format | ✅ single-quoted multi-word phrases, mirroring `shopping`/`gyms` |
| Google quota → honest 429 (expected) | ✅ unchanged behavior; `sports` still flows through the same Google scan/error path |
| 0 schema, 0 deps | ✅ COA scanQueries is in-code data |
| `tsc --noEmit` | ✅ exit 0 |
| eslint (JSON, branch vs base) | ✅ travelCOA 0e/1w == base → **+0e/+0w** |
| git diff scoped | ✅ `travelCOA.ts` only (+ this report) |

---

## Result
The `sports` category now scans **15** curated membership/recreation-PLACE queries
(racket → golf → water → snow/ice → climbing → combat → studios → skate) instead
of 6, matching the file's multi-word single-quoted query style. Everything else is
byte-for-byte unchanged: still a Google-Places category (P-9530, recurring
membership) rendering in the combined Places section, still a valid COA key (no
400), still showing an honest 429 when Google quota is exhausted. tsc + lint clean,
0 schema, 0 deps.
