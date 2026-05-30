# TRAVEL — PR-19 Audit: Per-Location Check-in/Check-out on the Scan Row

**Branch:** `claude/travel-pr-19-audit`
**Date:** 2026-05-30
**Mode:** READ-ONLY. Audit before action. No code changed.
**Goal:** Give each destination its own check-in/check-out (set at the scan row),
driving that location's LiteAPI search — replacing the trip-wide `startDate` +
7-night stopgap. Plus a truth-first proof that real rates return before we ship
a picker over a still-empty search.

---

## 1. Scan-row anatomy + where the date inputs land

**The "Scan:" chips** — `src/app/budgets/trips/[id]/page.tsx:1052-1064`:
```tsx
<span className="text-xs text-gray-500">Scan:</span>
{destinations.map((d) => {
  const isActive = name === trip.destination;          // :1057
  return <button onClick={() => selectDestination(d.resortId, name)} …>{name}</button>;  // :1059
})}
```
One chip per `destinations[]` entry; clicking calls `selectDestination`
(`page.tsx:323-331`), which PATCHes `trip.destination` (the **active**
destination marker) and updates local state.

**TripPlannerAI is rendered once, for the ACTIVE destination** —
`page.tsx:1098-1108`:
```tsx
<TripPlannerAI city={selectedDest?.resort?.name || trip.destination}   // :1100
               country={selectedDest?.resort?.country || null}
               daysTravel={trip.daysTravel} tripDates={tripDates} … />  // :1105-1106  TRIP-GLOBAL dates
```

**The header row inside TripPlannerAI** — `TripPlannerAI.tsx:742-762`:
```tsx
<div className="… justify-between …">                       // :742
  <div>… {city}, {country}  ·  {tripDates.departure} → {tripDates.return} · {daysTravel} nights …</div>  // :744-746
  <div className="flex items-center gap-2 shrink-0">          // :751  ← date inputs land HERE
    …Loading…  <button onClick={rescanAll}>Refresh</button>   // :757-760
  </div>
</div>
```
**Where the check-in/check-out inputs belong:** the right-side controls div at
**`TripPlannerAI.tsx:751`**, immediately left of the Refresh button — two
`<input type="date">` for the **active** destination. (The "185 nights" label at
`:746` is the trip-global span and can stay as context, or be superseded by the
per-location window once set.)

## 2. Current date flow (the thing we're replacing)

| Step | File:line | Note |
|---|---|---|
| Refresh click | `TripPlannerAI.tsx:757` → `rescanAll` (`:365`) | |
| Scan dispatch | `rescanAll` → `autoScanCategoriesFor` (`:317`) → `scanSingleCategory` (`:295`) | |
| **Request body** | `TripPlannerAI.tsx:299` | `{ city, country, activities, activity, month, year, daysTravel, minRating, minReviews, maxPriceLevel, category, maxResults }` — **carries NO checkin/checkout** |
| Route body read | `route.ts:130-141` | destructures body; **does not read any date** |
| **Dates derived server-side** | `route.ts:217-222` | `checkin = new Date(trip.startDate)`, `checkout = +7` — **the stopgap, same window for every location** |
| Passed to search | `route.ts:231-236` | `searchHotelRates({ city, country, checkin, checkout, … })` |

So today the **client never sends dates**; the route hardcodes them from
`trip.startDate`. That's exactly the single-window problem (≈13 months out for
Bali → empty).

## 3. Per-location date state — shape proposal

**Today there is NO per-destination date state.** Dates are trip-global
(`tripDates` prop = `trip.startDate/endDate`). The `trip_destinations` model
(`prisma/schema.prisma:698-714`) has **no date columns** — only
`name/country/latitude/longitude/isSelected/estimatedTotal`.

**Proposed (Scope A — client state, ephemeral):** a record keyed by the active
destination, held in `TripPlannerAI`:
```ts
const [perLocationDates, setPerLocationDates] =
  useState<Record<string, { checkin: string; checkout: string }>>({});
// keyed by `city` (the active destination identity TripPlannerAI already has)
```
TripPlannerAI is **not remounted** on chip switch (the parent only changes the
`city` prop — `page.tsx:1100`), so a city-keyed record persists across
destination switches within a session. `rescanAll` reads
`perLocationDates[city]` for the active scan.

> Alternative (more robust): own the record in the parent `page.tsx` keyed by
> `resortId`, pass the active dest's dates down as props. Survives a TripPlannerAI
> remount. Slightly more wiring (callbacks up). **Recommend the city-keyed
> in-component record for v1** (fewest files); note it resets on full reload (§8).

## 4. Threading chain (input → state → request → route → search)

| Handoff | Where (proposed) |
|---|---|
| ① Date input change | new `<input type="date">` at `TripPlannerAI.tsx:751` → `setPerLocationDates(prev => ({…, [city]: {checkin, checkout}}))` |
| ② Read on scan | `scanSingleCategory` / `rescanAll` reads `perLocationDates[city]` |
| ③ Add to request body | extend `TripPlannerAI.tsx:299` body with `checkin, checkout` (only when set) |
| ④ Route reads body | add `checkin`/`checkout` to the `route.ts:130-141` destructure |
| ⑤ Route precedence | `route.ts:217-222`: **use `body.checkin/checkout` when present; fall to `trip.startDate+7` only when absent** |
| ⑥ Search uses them | `route.ts:231-236` `searchHotelRates({ checkin, checkout })` already takes them — no change |

### ⚠️ The "default when not set" — flagged as a CONSCIOUS UX default, not a silent data fallback
The `trip.startDate + 7` path at `route.ts:217-222` becomes the value used **only
when the client omits dates** (e.g. a stale bundle, or a location the user hasn't
touched). This is a **render/UX prefill default + explicit precedence** (body
date wins when present), **not** hidden fallback logic that masks missing data.

I read this as a UX default, not error-swallowing — so I am **not** halting to
ask. But I am flagging it explicitly per the mandate: PR-19 must make the
precedence a *visible, conscious branch* (`if (body.checkin) use it; else
stopgap`), with a comment that the stopgap is a deliberate default for the
untouched case — never a silent substitution for a date the user *did* set.
**If Alex wants NO default at all** (require the user to set dates before Stays
loads), that's a different choice — surface it to him.

## 5. Default dates (prefill) — recommendation

**Recommend the SIMPLE prefill:** when a location has no dates yet, prefill
`checkin = trip.startDate` (and `checkout = +7`) — i.e. today's stopgap value,
now editable per location. This preserves current behavior as the starting point
and the user overrides per chip. Mechanical, zero new data dependencies.

**Flight-aware prefill = ENHANCEMENT (defer).** Flight legs live in
`FlightPicker.tsx` — each leg carries `arrival.{airport,date}` and
`destination` airport (`:15, :24, :86`); committed flights persist to
`trip_itinerary` (`homeDate`/`destDate`). A destination would map to its arriving
leg by matching **leg.destination airport == the destination's airport** (the
Image's Leg1 LAX→DPS 2026-07-01 ⇒ Bali check-in 2026-07-01; Leg2 DPS→SIN
2026-08-01 ⇒ Singapore check-in 2026-08-01). But that requires a
destination↔airport map + reading committed legs/itinerary — non-trivial and
brittle. **Recommend shipping the simple `trip.startDate` prefill in PR-19 and
treating flight-aware auto-fill as a follow-up** once the picker proves out.

## 6. Validation + nights→per-night correctness

- **Rule:** `checkout > checkin` (nights ≥ 1). Enforce client-side before the
  scan (disable Refresh / show inline message when violated).
- **Nights is computed from exactly these dates** — `searchHotelRates`
  (`liteapiClient.ts:274-278`):
  ```ts
  const nights = Math.max(0, Math.round((Date.parse(params.checkout) - Date.parse(params.checkin)) / msPerDay)) || undefined;
  ```
  stamped onto each hotel (`:280-285`). PR-15's per-night
  (`pricePerNight = priceTotal / nights`, `liteapiClient.ts:451-453`) and its
  fail-loud `nights < 1` assert consume that same value. **So user-set dates flow
  straight into nights → per-night pricing with no extra wiring** — and the
  client-side `checkout > checkin` guard keeps the PR-15 assert from ever firing.

## 7. Truth-first rates proof (do this BEFORE/WHILE building)

Two Vercel log lines prove whether a **near-date** search returns real rates,
independent of the UI:
- **`[LiteAPI] accommodation:`** — `route.ts:229` — prints the exact
  `checkin → checkout` + coords sent.
- **`[LiteAPI rates] response shape:`** — `liteapiClient.ts:252-258` — read
  **`dataLen`**: `> 0` = real priced rates; `0` (with `hotelsLen > 0`) =
  metadata-only/empty.

**Exact near-date manual test (no code change):** set the **active** destination
to a high-inventory city (London/Bangkok/NYC) and the trip's `startDate` to
**~2 weeks out**, hit Refresh on Accommodation, then grep Vercel for the two
lines above. `dataLen > 0` confirms production returns real inventory for a near
window — proving the picker will have data to show. If `dataLen` stays `0` even
near-term, the empty is a mode/key problem (see the prod-date diagnostic), and
the picker would ship over a dead search — **fix that first.**

## 8. Scope + storage confirmation

**Q8 — Are search dates stored anywhere? NO.** `trip_scanner_results` upsert
persists only `recommendations/scannedBy/minRating/minReviews`
(`route.ts:247-251`) — no dates. `trip_destinations` has no date columns
(`schema.prisma:698-714`). Dates are **purely search params**. → **Scope A is
search-only: 0 schema, 0 migration.**

| | |
|---|---|
| Files touched | **2** — `TripPlannerAI.tsx` (date inputs + state + body) and `ai-assistant/route.ts` (read body dates + precedence). Optional: the scan request type if one is shared. |
| Schema / migration | **0** (dates not stored) |
| New deps | **0** (native `<input type="date">`) |
| Line estimate | **~40-70 lines** |
| tsc + lint | clean |

**MECHANICAL (safe):** add the two date inputs; city-keyed state; thread
`checkin/checkout` into the body; route precedence (body dates win, stopgap is
the untouched-default); `checkout > checkin` guard. nights→per-night is automatic.

**TASTE CALLS (confirm with Alex):**
- Prefill default: `trip.startDate` (recommended) vs blank vs require-before-load.
- **Flight-aware auto-fill** (§5) — enhancement, recommend deferring.
- **Persistence:** ephemeral client state resets on reload. If per-location dates
  must survive reloads, that needs `checkin/checkout` columns on
  `trip_destinations` (a migration) — **a separate Scope B**, not PR-19.
- Whether the per-location window replaces or coexists with the "185 nights"
  trip-global label (`TripPlannerAI.tsx:746`).

---

## VERDICT framing
The wiring is straightforward and search-only (no schema): the one real
dependency is **§7 — confirm a near-date production search returns `dataLen > 0`
first**, so PR-19 ships a picker over a *working* search rather than masking a
mode/availability problem with a nicer date UI.

---

**READ-ONLY audit. No implementation performed.**
