# TRAVEL — PR-20 Implementation: LiteAPI Runtime Observability

**Branch:** `claude/travel-pr-20`
**Date:** 2026-05-30
**Scope:** Logging only. Zero behavior change. One file: `src/lib/liteapiClient.ts`.

---

## STEP 1 — Why the response-shape log wasn't firing (control-flow finding)

The PR-7 diagnostic `console.log('[LiteAPI rates] response shape:', …)` lives at
**`liteapiClient.ts:252-258` (now shifted by the added lines)** — and it sits
**after** the early throw:

```
:240  const res = await fetch(url, …);
:251  if (!res.ok) {
:252    throw new LiteApiError('/v3.0/hotels/rates', res.status, await res.text());   ← EARLY THROW
      }
:254  const data = await res.json();
:258  console.log('[LiteAPI rates] response shape:', { … dataLen … });               ← only runs on 2xx
```

**Finding:** the response-shape log executes **only on a 2xx response** — a
non-2xx LiteAPI reply (auth/mode/bad-request) throws at the `!res.ok` line first,
so it never logs. Two consequences explain its absence in Vercel:
1. On any **non-2xx**, the line is skipped entirely (the route then surfaces an
   error, not "0 hotels").
2. On a **2xx**, it *does* run, but it logs a **multi-line object** — easy for
   Vercel's viewer to collapse/sample and easy to miss when grepping for a flat
   string. (A stale deploy predating the log is also possible.)

PR-20 removes the ambiguity by adding **flat, greppable** lines — one **before**
the throw (fires even on non-2xx) and one **after** parse (fires on every 2xx,
empty or not). The existing object log is left intact.

## The 3 new log lines (cited)

1. **Mode + key prefix** — `liteapiClient.ts:232-236`:
   ```ts
   const liteMode = getMode();
   const liteKeyPrefix = (liteMode === 'production' ? process.env.LITEAPI_PRODUCTION_KEY : process.env.LITEAPI_SANDBOX_KEY)?.slice(0, 4) ?? 'none';
   console.log(`[LiteAPI] mode=${liteMode} keyPrefix=${liteKeyPrefix}`);
   ```
   → `[LiteAPI] mode=production keyPrefix=prod` (or `mode=sandbox keyPrefix=sand`).
   Makes "is production actually live" readable on every search.

2. **HTTP status (before the throw)** — `liteapiClient.ts:249`:
   ```ts
   console.log(`[LiteAPI] rates http: status=${res.status} ok=${res.ok}`);
   ```
   → fires even on a non-2xx, so auth/mode/bad-request is visible.

3. **Raw counts (after parse, every 2xx)** — `liteapiClient.ts:258`:
   ```ts
   console.log(`[LiteAPI] rates raw: dataLen=${Array.isArray(data?.data) ? data.data.length : 'n/a'} hotelsLen=${Array.isArray(data?.hotels) ? data.hotels.length : 'n/a'} status=${res.status}`);
   ```
   → `[LiteAPI] rates raw: dataLen=0 hotelsLen=12 status=200` — separates
   upstream-empty (`dataLen=0`) from a mode/key problem, flat and greppable.

## STEP 4 — Dates already logged (no change)

`route.ts:229` already logs the window:
```
[LiteAPI] accommodation: Bali (Canggu), Indonesia (2026-07-01 → 2026-07-08, N adults) coords=…
```
No edit needed; `route.ts` is **not** touched (keeps the diff scoped to
`liteapiClient.ts`).

## Secret safety

The full key is **never** logged — only `…?.slice(0, 4)` (`liteapiClient.ts:235`)
→ 4 chars (`prod`/`sand`), enough to confirm environment. Guard-grep confirmed
**no `console.log` references `LITEAPI_PRODUCTION_KEY`, `LITEAPI_SANDBOX_KEY`, or
`getApiKey()`**.

## Hard-constraint compliance

| Constraint | Status |
|---|---|
| Logging only, zero behavior change | ✅ `!res.ok` throw + `res.json()` + merge/return all unchanged; only `console.log`s added |
| Never log full keys/secrets | ✅ 4-char prefix only (`:235`) |
| No new deps | ✅ |
| `tsc --noEmit` | ✅ exit 0 |
| eslint changed file | ✅ 0 errors / 0 warnings |
| The 400 (route.ts:163) not touched | ✅ route.ts not in diff |
| Diff scoped to `liteapiClient.ts` | ✅ `git diff --numstat main` = `liteapiClient.ts` only (+18 / −3) |

> Note: a stray uncommitted `pricePerNight?` edit in the discover detail page
> (leftover from earlier PR-15 work) had ridden along the branch switches; it was
> **reverted to main** so PR-20's diff is `liteapiClient.ts` only.

## How Alex reads it after deploy

Grep Vercel runtime logs for:
- `[LiteAPI] mode=` → confirms sandbox vs production + key prefix.
- `[LiteAPI] rates http:` → the HTTP status (even on failures).
- `[LiteAPI] rates raw:` → `dataLen` / `hotelsLen` for the actual search.

`dataLen=0` with `mode=production keyPrefix=prod` ⇒ upstream-empty (dates/
availability). `dataLen=0` with `mode=sandbox` ⇒ prod not actually live.
