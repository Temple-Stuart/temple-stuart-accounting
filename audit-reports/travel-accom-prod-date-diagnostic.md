# TRAVEL — Accommodation Prod Date Diagnostic: far-date window vs mode-not-live

**Branch:** `claude/travel-accom-prod-date-diagnostic`
**Date:** 2026-05-30
**Mode:** READ-ONLY. No secrets printed.
**Question:** Prod key set + redeployed, but Bali Accommodation still shows the
**dashed empty state**. Is it (1) the search date window (Jul 2026, a year out)
returning zero real rates, or (2) prod mode not actually live (still
sandbox-empty)?

---

## 1. Exact checkin/checkout sent for Bali

`src/app/api/trips/[id]/ai-assistant/route.ts:217-222`:
```ts
const STOPGAP_NIGHTS = 7;
const stopgapCheckin  = new Date(trip.startDate);          // :218 — the trip's STORED start date
const stopgapCheckout = new Date(stopgapCheckin);
stopgapCheckout.setDate(stopgapCheckout.getDate() + STOPGAP_NIGHTS);  // :220  +7 days
const checkin  = stopgapCheckin.toISOString().slice(0, 10);   // :221
const checkout = stopgapCheckout.toISOString().slice(0, 10);  // :222
```
**`checkin` is the trip's `startDate` (departure), NOT today+N.** `trip.startDate`
is read at `route.ts:196-199` (`prisma.trips.findFirst … select:{startDate}`),
schema type `DateTime?` (`prisma/schema.prisma:535`). For the Bali trip whose
departure is **2026-07-01**, the window sent is **`2026-07-01 → 2026-07-08`** — a
checkin **~13 months in the future**.

> This is the crux of hypothesis (1): real LiteAPI production inventory often is
> **not yet loaded/priced ~13 months out** for many properties. A far-future
> checkin can legitimately return **zero rates** from real inventory — an empty
> 200, which renders as the dashed empty state, exactly like the sandbox case.

## 2. Date format vs LiteAPI spec

`.toISOString().slice(0, 10)` → **`YYYY-MM-DD`** (e.g. `"2026-07-01"`) — matches
LiteAPI's documented `checkin`/`checkout` format. **Format is correct**; not a
malformation-induced empty.

> Minor caveat (not the cause): `toISOString()` is **UTC**. If `trip.startDate`
> is stored as midnight in a timezone east of UTC, the UTC calendar date could
> roll back one day — still a valid `YYYY-MM-DD`, just possibly off-by-one. For
> US-stored midnight it stays on or moves forward, so this is a flag-only note,
> not the empty-result cause.

## 3. The PR-7 diagnostic log — exact lines to grep in Vercel

Two log lines carry the ground truth (both `console.log`, visible in Vercel
runtime logs):

**(a) The request params (dates that went out)** — `route.ts:229`:
```
[LiteAPI] accommodation: Bali (Canggu), Indonesia (2026-07-01 → 2026-07-08, N adults) coords=-8.6478,115.1385
```
→ **grep Vercel for `[LiteAPI] accommodation:`** to read the exact
checkin → checkout sent.

**(b) The response shape (was it empty?)** — `liteapiClient.ts:252-258`:
```ts
console.log('[LiteAPI rates] response shape:', {
  topKeys, dataLen, hotelsLen, hotelsKeys, firstRateKeys
});
```
→ **grep Vercel for `[LiteAPI rates] response shape:`** and read **`dataLen`**:
- **`dataLen: 0`** → LiteAPI returned **no priced rate items** for that window
  (recommendations build only from `data.data` — `liteapiClient.ts:265`), so the
  carousel is legitimately empty. (`hotelsLen > 0` alongside = catalog exists but
  unpriced — the metadata-only signature.)
- **`dataLen > 0`** → real rates came back; the carousel should populate. If it's
  still empty in the UI with `dataLen > 0`, that's a *different* downstream bug
  (mapping/render), not this one.

There's also `liteapiClient.ts:232` `[LiteAPI rates] mode=coords lat=… radius=…` —
but note **"mode" here = the SEARCH mode (coords vs cityName), NOT
sandbox/production** (see §4).

## 4. Is runtime sandbox-vs-production observable? **NO — and that's the gap.**

`getMode()` / `getApiKey()` (`liteapiClient.ts:35-46`) are **never logged**. The
only "mode" string in any log is the **coords-vs-cityName search mode**
(`:232`) — easy to mistake for the env mode, but unrelated. **Nothing in the
runtime logs states whether sandbox or production key is active.** (No code added
here, per the read-only mandate.)

**Smallest read-only ways to confirm prod is live without new code:**
1. **Vercel config check (not a log):** confirm the deployed environment shows
   `LITEAPI_MODE=production` in Environment Variables, and that the **current
   deployment was built/redeployed after** that var was set (env changes only
   apply to deployments created after the change).
2. **Indirect runtime signal:** a **`dataLen > 0`** on *any* search proves the
   prod key authenticates against real inventory (sandbox was metadata-only/
   empty). The near-date test in §5 is the clean way to force this signal.

> Note for a future PR (do NOT add now): a one-line `console.log` of `getMode()`
> in `searchHotelRates` would make this directly observable. Out of scope here.

## 5. Near-term-date test (read-only, no code change)

`checkin` is driven entirely by **`trip.startDate`** (`route.ts:218`). So Alex
can isolate "dates too far out" from "mode wrong" **without touching code**:

1. Create a **scratch trip** (or edit a test trip's Start/End) with a **near
   checkin — ~2 weeks out** (e.g. start 2026-06-13) and a **high-inventory
   destination** with guaranteed availability (e.g. a major city — London, NYC,
   Bangkok — rather than a beach-town neighborhood).
2. Open that trip's planner and run the **Accommodation** scan (read-only — it
   calls `/hotels/rates`, makes **no** booking).
3. Read the two Vercel log lines from §3 for that scan.

Drive it via `trips.startDate`; no other field controls the window.

## 6. VERDICT framing — what each outcome means

| Vercel `dataLen` | Far date (Jul 2026, Bali) | Near date (~2 wks, major city) | Conclusion |
|---|---|---|---|
| — | **0** | **> 0** | **Hypothesis (1): dates too far out.** Prod IS live; Jul-2026 simply has no priced inventory yet for that window/area. Not a bug — revisit when dates are closer, or PR-11 per-leg dates will help. |
| — | **0** | **0** | **Hypothesis (2): prod not actually live** (still sandbox-empty), or a key/host/redeploy gap. Re-check §4.1 (env set + redeployed after). |
| — | **> 0** | — | Prod working & inventory exists. If UI still shows empty, it's a **downstream mapping/render bug**, not dates or mode — new investigation. |

**Most likely (given the audit trail):** a checkin **13 months out** for a
specific Bali neighborhood returning `dataLen: 0` is the leading explanation — a
far-future window with thin real-inventory pricing. The near-date test
disambiguates it definitively. Reading `[LiteAPI rates] response shape:`
`dataLen` in Vercel is the single ground-truth check.

---

**READ-ONLY audit. No implementation performed. No secrets printed.**
