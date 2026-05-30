# TRAVEL — PR-19 Implementation: Per-Location Check-in/Check-out Date Control

**Branch:** `claude/travel-pr-19`
**Date:** 2026-05-30
**Scope:** Search-only (0 schema, 0 migration). Two files: `TripPlannerAI.tsx`
(scan-row date control) + `ai-assistant/route.ts` (precedence). Viator/Google
flows untouched.

---

## STEP 1 — Per-location date state

`TripPlannerAI.tsx:232-236` — keyed by the active `city`:
```ts
const [perLocationDates, setPerLocationDates] =
  useState<Record<string, { checkin: string; checkout: string }>>({});
```
Ephemeral search params (not stored — `trip_destinations` has no date columns,
audit §8). The component isn't remounted on chip switch, so it persists per
session (audit §3).

## STEP 2 — Date inputs + prefill (header row, left of Refresh)

Resolved active dates with simple prefill — `TripPlannerAI.tsx:748-756`:
```ts
const activeCity = city || '';
const defaultCheckin  = tripDates?.departure || '';
const defaultCheckout = tripDates?.departure ? (+7 days from departure) : '';
const checkinVal  = perLocationDates[activeCity]?.checkin  ?? defaultCheckin;
const checkoutVal = perLocationDates[activeCity]?.checkout ?? defaultCheckout;
```
Two `<input type="date">` in the header controls div — `TripPlannerAI.tsx:776-795`
(`aria-label="Check-in"` / `"Check-out"`), each writing
`setPerLocationDates(prev => ({ …, [activeCity]: {checkin, checkout} }))`. Prefill
= `trip.startDate` for check-in, `+7` for check-out (audit §5; flight-aware
default deferred). User edits override per city.

## STEP 3 — Validation (checkout > checkin, nights ≥ 1)

`TripPlannerAI.tsx:760`:
```ts
const datesValid = !(checkinVal && checkoutVal) || checkoutVal > checkinVal;
```
(String compare on `YYYY-MM-DD` is chronological.) When invalid: an inline note
renders (`:797-799` "Check-out must be after check-in") and **Refresh is
disabled** — `:805` `disabled={loading || !city || !datesValid}`. This keeps
PR-15's per-night fail-loud assert (`nights >= 1`) from ever firing.

## STEP 4 — Thread dates into the request body

`TripPlannerAI.tsx:302-310` — only sends dates when the active city has them set:
```ts
const loc = perLocationDates[city || ''];
const dateParams = loc?.checkin && loc?.checkout ? { checkin: loc.checkin, checkout: loc.checkout } : {};
// …body: JSON.stringify({ …existing…, ...dateParams })
```
Untouched destinations send no dates → the route applies its default (STEP 5).
(Prefill equals the stopgap, so untouched behavior is unchanged.)

## STEP 5 — Route precedence (explicit if/else, not a silent `||`)

Body destructure — `route.ts:142-144` adds `checkin: bodyCheckin, checkout: bodyCheckout`.

LiteAPI block — `route.ts:219-237` replaces the unconditional stopgap with a
**visible if/else**:
```ts
// PR-19: per-location dates supplied by the scan row take precedence.
// The else-branch stopgap is a CONSCIOUS UX DEFAULT for the untouched case
// — NOT a silent fallback masking a date the user actually chose.
let checkin: string; let checkout: string;
if (bodyCheckin && bodyCheckout) {        // :227
  checkin = bodyCheckin; checkout = bodyCheckout;
} else {
  // Default: 7-night stopgap from trip.startDate (PR-10 Fix 5).
  const STOPGAP_NIGHTS = 7; …
}
```
The chosen `checkin`/`checkout` pass to `searchHotelRates` at `route.ts:248-253`
(unchanged call).

> **⚠ Conscious-default note (per the mandate):** I read the else-branch as a
> UX default (the untouched case prefills + defaults to the same stopgap),
> **not** a data fallback that hides a user-set date — so I coded it as an
> explicit, commented `if/else` rather than halting. If Alex wants *no* default
> (require dates before Stays loads), that's a one-line change to the condition.

## STEP 6 — Nights flows through (confirmed, no code change)

`searchHotelRates` computes nights from exactly the supplied window —
`liteapiClient.ts:289`:
```ts
const nights = Math.max(0, Math.round((Date.parse(params.checkout) - Date.parse(params.checkin)) / msPerDay)) || undefined;
```
So user-set dates → `nights` → PR-15 `pricePerNight = priceTotal / nights`
stays correct for the real window. The client `datesValid` guard guarantees
`nights ≥ 1`.

---

## Hard-constraint compliance

| Constraint | Status |
|---|---|
| Search-only — 0 schema / 0 migration | ✅ dates are request params; no Prisma/schema touched |
| Viator/Google flows unchanged | ✅ `dateParams` is sent for all categories but **only the LiteAPI block reads `bodyCheckin/bodyCheckout`**; Viator/Google branches ignore them |
| 0 new deps | ✅ native `<input type="date">` |
| `tsc --noEmit` | ✅ exit 0 |
| eslint changed files | ✅ identical error count to main (TPA 2, route 11 — all pre-existing; **0 added**) |
| PR-20 diagnostic logs + the 400 (route.ts:163) | ✅ untouched (not in diff regions) |
| git diff = TripPlannerAI.tsx + route.ts + report | ✅ confirmed via `git diff --name-only main` |

## Behavior

- Each destination chip shows its own check-in/check-out (prefilled to the trip
  start window), editable; Refresh searches that exact window for the active city.
- Untouched destinations default to the existing 7-night stopgap — no regression.
- A near-future window (e.g. set Bali to ~2 weeks out) now drives the LiteAPI
  search, addressing the 13-months-out empty result (search-side; the prod-key
  prerequisite from the no-outgoing audit is separate).
