# TRAVEL — PR-35-COA-READ: Google category COA codes (travelCOA vs getCOACode)

**Branch:** `claude/travel-pr-35-coa-read`
**Date:** 2026-05-31
**Mode:** READ-ONLY. No edits, no assumptions — actual values read from the files.

**Question:** For each of the 9 Google travel categories, what canonical COA code
does `travelCOA.ts` define, and what does `getCOACode(key)`
(`src/lib/travelCategories.ts`) actually return today?

**How `getCOACode` resolves** (`travelCategories.ts:72-74`):
```ts
export function getCOACode(key: string): string {
  return TRAVEL_CATEGORIES[resolve(key)]?.coaCode || '9950';
}
```
`resolve(key) = ALIASES[key] || key` (`:64-66`). So a key returns its
`TRAVEL_CATEGORIES` entry's `coaCode`, or **`9950`** if the (resolved) key is in
neither the `TRAVEL_CATEGORIES` table (`:13-30`) nor `ALIASES` (`:33-60`).
Note `getCOACode` returns the **bare number** (no `P-`/`B-` prefix); the
`travelCOA.ts` values carry the `P-`/`B-` prefix.

---

## The 9-row table (every value cited from the actual files)

| Category | travelCOA.ts code (cite) | getCOACode returns today (cite) | Match? |
|---|---|---|---|
| **brunch_coffee** | `P-9310` / `B-9310` (`travelCOA.ts:52`) | `9310` (in table, `travelCategories.ts:15`) | **Y** |
| **dinner** | `P-9320` / `B-9320` (`travelCOA.ts:66`) | `9320` (in table, `:16`) | **Y** |
| **nightlife** | `P-9430` / `null` (`travelCOA.ts:131`) | `9430` (in table, `:24`) | **Y** |
| **coworking** | `P-9510` / `B-9510` (`travelCOA.ts:170`) | **`9950`** (absent from table + aliases) | **N** |
| **gyms** | `P-9520` / `null` (`travelCOA.ts:239`) | **`9950`** (absent from table + aliases) | **N** |
| **sports** | `P-9530` / `null` (`travelCOA.ts:254`) | **`9950`** (absent from table + aliases) | **N** |
| **groceries** | `P-9830` / `B-9830` (`travelCOA.ts:224`) | **`9950`** (absent from table + aliases) | **N** |
| **shopping** | `P-9800` / `B-9800` (`travelCOA.ts:207`) | `9800` (in table, `:28`) | **Y** |
| **festivals** | `P-9440` / `null` (`travelCOA.ts:146`) | `9440` (in table, `:25`) | **Y** |

(Match = the `getCOACode` number equals the numeric part of the `travelCOA.ts`
code.)

---

## Summary

- **Already match (5):** `brunch_coffee` (9310), `dinner` (9320), `nightlife`
  (9430), `shopping` (9800), `festivals` (9440). Each has a `TRAVEL_CATEGORIES`
  entry whose `coaCode` equals the `travelCOA.ts` numeric code.
- **Fall to `9950` (4):** `coworking` (canonical P-9510), `gyms` (P-9520),
  `sports` (P-9530), `groceries` (P-9830). These four keys are **absent from both**
  the `TRAVEL_CATEGORIES` table (`travelCategories.ts:13-30`) and the `ALIASES`
  map (`:33-60`), so `getCOACode` returns its `'9950'` default
  (`:73`) — i.e. they do **not** map to their canonical `travelCOA.ts` codes today.

Verification (presence check):
- `coworking`, `gyms`, `sports`, `groceries`: `in_table=0`, `in_alias=0` → `9950`.
- `brunch_coffee`, `dinner`, `nightlife`, `shopping`, `festivals`: `in_table=1` →
  their listed code.

---

**READ-ONLY. No edits made. No codes assumed — all values read from
`src/lib/travelCOA.ts` and `src/lib/travelCategories.ts`.**
