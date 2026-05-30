# TRAVEL — PR-16 Audit: Production-Mode Key / Header / Host Wiring (pre-go-live)

**Branch:** `claude/travel-pr-16-audit`
**Date:** 2026-05-30
**Mode:** READ-ONLY. Verify before a real-money config flip. No secrets printed.
**Question:** When `LITEAPI_MODE=production`, does the client read
`LITEAPI_PRODUCTION_KEY` and send it correctly (key/header/host)?

---

## 1. Mode switch + key selection

`src/lib/liteapiClient.ts:35-46`:
```ts
function getMode(): LiteApiMode {
  return process.env.LITEAPI_MODE === 'production' ? 'production' : 'sandbox';   // :36
}
function getApiKey(): string {
  const mode = getMode();
  const key = mode === 'production'
    ? process.env.LITEAPI_PRODUCTION_KEY   // :42
    : process.env.LITEAPI_SANDBOX_KEY;     // :43
  if (!key) throw new MissingLiteApiKeyError(mode);   // :44  — fail-loud if unset
  return key;
}
```
**Confirmed:** `LITEAPI_MODE === 'production'` → reads **`LITEAPI_PRODUCTION_KEY`**.
Sandbox (any other value / unset) → **`LITEAPI_SANDBOX_KEY`**. Missing key throws
`MissingLiteApiKeyError` (`:44`) — it will not silently fall back to the other
mode's key. Default when `LITEAPI_MODE` unset = **sandbox**.

## 2. Base URL / host per mode — does NOT switch (and that's correct for LiteAPI)

Hosts are module constants, **not** mode-dependent — `liteapiClient.ts:22-23`:
```ts
const LITEAPI_BASE      = 'https://api.liteapi.travel/v3.0';   // search + prebook
const LITEAPI_BOOK_BASE = 'https://book.liteapi.travel/v3.0';  // final book
```
No code path swaps these by mode (grep: only definitions + uses at `:234, :574,
:654`).

**Assessment — NOT a bug, but VERIFY on the dashboard.** LiteAPI's Standard Auth
model is **key-determined, not host-determined**: the *same* hosts
(`api.liteapi.travel` / `book.liteapi.travel`) serve both sandbox and production,
and the **API key** (`sand_…` vs `prod_…`) selects the environment. So a single
constant host is the intended design — swapping hosts is unnecessary and would be
wrong. ⚠️ Because this is a real-money flip, **Alex should confirm on the LiteAPI
dashboard** that the production key is issued for these same hosts (it is, per
their docs, but confirm — this is the one external assumption the go-live rests
on). If LiteAPI ever required a distinct prod host, this would need a code change;
today it does not.

## 3. Header (Standard Auth) + mode-appropriate key

`liteapiClient.ts:48-54`:
```ts
function headers(): Record<string, string> {
  return {
    'X-API-Key': getApiKey(),          // :50  — Standard Auth header, mode-appropriate key
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
}
```
**Confirmed:** the key is sent in the **`X-API-Key`** header (Standard Auth), and
it's `getApiKey()` — so every request carries the **mode-appropriate** key. All
three LiteAPI calls use `headers()`:
- search `/hotels/rates` — `:237`
- prebook `/rates/prebook` — `:576`
- book `/rates/book` — `:656`

No call hardcodes or bypasses the key. Wiring is consistent.

## 4. Env var inventory (key names only — Alex sets these in Vercel)

The code reads exactly **three** LiteAPI env vars (`grep process.env.LITEAPI` →
only these):

| Env var | Read at | Purpose |
|---|---|---|
| `LITEAPI_MODE` | `liteapiClient.ts:36` | `'production'` to go live; anything else/unset = sandbox |
| `LITEAPI_PRODUCTION_KEY` | `liteapiClient.ts:42` | the `prod_…` key (read only in production mode) |
| `LITEAPI_SANDBOX_KEY` | `liteapiClient.ts:43` | the `sand_…` key (read in sandbox mode) |

**To go live:** set `LITEAPI_MODE=production` **and** `LITEAPI_PRODUCTION_KEY=<prod key>`
in Vercel. Keep `LITEAPI_SANDBOX_KEY` set too (harmless; lets you flip back).
No other LiteAPI env var exists in the code. (Values must never be printed.)

## 5. What flipping arms — the real-money path

In production mode the booking path makes **REAL bookings** — there is **no
mode gate** beyond the key:
- Client: `ReserveHotelButton.tsx` → `POST /api/travel/liteapi/prebook` →
  `POST /api/travel/liteapi/book`.
- `prebook` route → `prebookRate()` → `POST ${LITEAPI_BASE}/rates/prebook`
  (`liteapiClient.ts:574-576`). Locks an offer, returns the payment
  `transactionId`. `usePaymentSdk: true` default (`:572`) keeps card data off our
  servers (PCI scope minimised).
- `book` route → `bookRate()` → `POST ${LITEAPI_BOOK_BASE}/rates/book`
  (`liteapiClient.ts:654-656`). **This is the real charge/booking.** The route
  comment is explicit: *"Book at LiteAPI (real call — sandbox or production per
  env)"* (`book/route.ts:98`), and `bookRate` is called with no mode condition
  (`book/route.ts:101-106`).

**So flipping the two env vars arms:** the same prebook→book code path, now
hitting LiteAPI **production** with the `prod_` key → real reservations against
real inventory, real money, real commission. (PR-15 confirmed the charge amount
comes from the live `prebook.price`.) Nothing else in the app changes behavior by
mode — the env flip is the entire arming action.

## 6. Safe READ-ONLY production test (verify the key without booking)

**Use `searchHotelRates` → `POST ${LITEAPI_BASE}/hotels/rates`
(`liteapiClient.ts:234-237`).** It returns availability + rates and **creates no
booking, no hold, no charge** — purely a read. With `LITEAPI_MODE=production` +
the prod key set, trigger an Accommodation scan for a real destination/date
(e.g. Bali, a near-future 7-night window): a populated carousel (non-empty
`data.data`) proves the prod key authenticates and returns live inventory.

- **Do NOT** use `prebook` as the "read" test — it *locks an offer* (creates a
  prebook session); it doesn't charge, but it's a write-ish hold, not a clean read.
- **Never** call `book` to test — that's the real reservation.

Sequence for Alex: set env → run an Accommodation **search** (read-only) → confirm
hotels appear → only then consider a controlled prebook/book test with a known
refundable/cancellable offer.

---

## Verdict + gaps

**Wiring confirmed correct:** mode→key (`:41-43`), key→header `X-API-Key`
(`:50`), and all three calls use it. The only env vars are `LITEAPI_MODE`,
`LITEAPI_PRODUCTION_KEY`, `LITEAPI_SANDBOX_KEY`.

**No code change required before flipping** — the mode switch is complete:
- ✅ key selection by mode
- ✅ X-API-Key Standard Auth header
- ✅ fail-loud on missing key
- ✅ hosts are correct (LiteAPI is key-determined; single host serves both envs)

**One external check (not a code gap):** confirm on the LiteAPI dashboard that the
`prod_` key targets `api.liteapi.travel` / `book.liteapi.travel` (the hosts the
code uses). Per LiteAPI's auth model it does — but verify, since this flip arms
real money.

**Recommended go-live order:** (1) set the two env vars; (2) run a read-only
Accommodation **search** to prove the key (§6); (3) only then allow a real
prebook→book. The diagnostic log at `liteapiClient.ts:252-258` will show
`dataLen > 0` in production logs when the read succeeds.

---

**READ-ONLY audit. No implementation performed. No secrets printed.**
