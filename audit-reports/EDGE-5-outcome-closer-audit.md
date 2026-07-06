# EDGE-5 Audit — outcome-closer: updateSnapshotOutcome had zero callers

**Date:** 2026-07-06 · **Branch:** `claude/edge-5-outcome-closer` · **Base:** main @ `028e7b14` (EDGE-4 `8157ea6f` verified present)

Read-only audit performed BEFORE implementation. Citations are pre-change `file:line`.

## 1. The dead writer

- `src/lib/convergence/outcome-tracker.ts:13-34` — `updateSnapshotOutcome(snapshotId, outcome)` writes `outcomeDate = new Date()`, `outcomePnl`, `outcomeSpotPrice`, `outcomeIV`, `ivCompressed`, `stayedInRange`. It is a **pure writer — it contains NO math** for any field; its doc comment promises "Called by a scheduled job after DTE expiry" but grep found **zero callers** (the only match in the repo was the definition itself).

## 2. Snapshot row + horizon derivation

- `prisma/schema.prisma:1764-1810` — a row stores `userId`, `ticker`, `scanDate` (default now), scan-time context (`spotPrice`, `iv30`, `hv30`, `ivPercentile`), the five gate scores, sizing, `suggestedStrategy`, `suggestedDTE Int?`, the outcome columns, and `fullTrace Json?`.
- **No horizon field is stored.** The schema's own comment (`schema.prisma:1800` — "filled in later by scheduled job after DTE expiry") fixes the meaning: **horizon = scanDate + suggestedDTE days**, derived per row. `suggestedDTE` is nullable (`:1798`) → rows without it are permanently unclosable and must be declared, not guessed.

## 3. Realized-data source ruling

- **Spot: TastyTrade daily candles — RULED IN.** `fetchTTCandlesBatch(symbols, days)` (`data-fetchers.ts:2146-2257`) is already integrated and authed (shared TT client via `getTastytradeClient()`), takes an arbitrary lookback, returns dated daily closes, dedupes by date, and **never throws** — failures land in `stats.symbols_failed` with empty arrays (`:2248-2253`), mapping directly onto "unclosable + reason". The close on the last trading day ≤ horizon is the actual realized price as of the horizon (weekend/holiday tolerance 5 days; a larger gap is refused as a stale close).
- **IV: TastyTrade market-metrics `implied-volatility-30-day` — RULED IN with a window.** No integrated source provides *historical* IV (market-metrics is current-only; Finnhub fetchers have no IV history). A live observation is honestly "IV at close" only while the closer runs ≤ 5 days after the horizon; outside the window `outcomeIV` stays **null with a declared reason**. Same TT field family as the stored scan-time `iv30`, so `ivCompressed = outcomeIV < iv30` compares two real, unit-consistent observations.
- **Declared-null fields (no honest source or stored inputs; the tracker has no math to reuse):** `outcomePnl` (no historical option-price source) and `stayedInRange` (no explicit expected range stored on the row; deriving one from `fullTrace` trade cards would be improvised). Left null and declared in every run summary.
- **Label requirement:** met without a migration — provenance (`source_spot`, `source_iv`, `horizon_date`, `spot_candle_date`, `iv_observed_at`/`iv_null_reason`, `declared_null_fields`) is merged into the row's `fullTrace.outcome_meta`; the run summary carries the source label too. A dedicated `outcomeSource` column would require an ALTER TABLE (Alex-only via psql) — out of this PR's one-concept scope.

## 4. Trigger ruling

- `/api/cron/auto-categorize/route.ts:5-24` — the cron pattern: `Bearer ${CRON_SECRET}`, 500 when unconfigured, 401 on mismatch. Viable, but it exists because a scheduler (not a person) must call that route.
- `/api/trading/convergence/route.ts:41-52` + `src/lib/require-admin.ts:8-20` — the trading surface is admin-gated: `requireAdmin()` (401 guest / 403 non-owner vs `OWNER_EMAIL`) **before any paid call**.
- **RULED: (a) admin-POST manual fire for v1.** Evidence: the closer spends the shared firm TT account exactly like the scanner (same trust boundary → same gate); v1's surface is "Alex fires it and reads the JSON" (no scheduler exists to hold a secret); a secret-guarded public cron adds attack surface with no v1 caller. Route: `POST /api/trading/convergence/close-outcomes`, `requireAdmin` first, **not** added to PUBLIC_PATHS (signed-cookie middleware stays in front). Cron + secret can be a later PR when scheduling is wanted.

## 5. Idempotency shape

- Select `WHERE userId = ? AND outcomeDate IS NULL`, derive horizon in code, close only rows with `horizon <= now` **and** a real candle observation. `updateSnapshotOutcome` sets `outcomeDate` on every write → closed rows can never be reselected. Skipped rows keep `outcome = null` and retry next run. Re-run with nothing new qualifying closes 0.

## Security

One new internal route (authorized by the mandate), auth first lines, admin-gated, user-scoped queries (`WHERE userId = authedUser.id`), no PUBLIC_PATHS change, no new external integrations (TT candles + market-metrics were already integrated), no migration.
