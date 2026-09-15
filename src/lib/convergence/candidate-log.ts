/**
 * LOG-01 — EVERY SCANNED CANDIDATE IS LOGGED, TAKEN OR NOT.
 *
 * Pure logic with ports. The Prisma- and TastyTrade-backed ports live in
 * candidate-log.prisma.ts so this file (and its tests) import no database and
 * no vendor SDK.
 *
 * persistScanCandidates — called by pipeline.ts with the per-ticker card list
 *   the scan is about to return. It stamps a candidate_id on EVERY card, writes
 *   one scan_runs row and one scan_candidates row per card, and returns the
 *   SAME list (stamped). The pipeline assigns the returned list back to the
 *   variable the response is built from — the write and the response are one
 *   list (the candidate log law in scripts/assert-tool-registry.ts). A write
 *   that fails throws; the pipeline then WITHHOLDS every candidate and
 *   declares it — it never returns a scored candidate it did not persist.
 *
 * settleCandidateOutcomes — at or after expiry. A TAKEN candidate's outcome
 *   comes from its linked position (trade_card_links.actual_pl, the same
 *   number EDGE-01 reads); an UNTAKEN candidate's outcome is the
 *   counterfactual P&L of holding the structure to expiry, from the free
 *   TastyTrade daily close on the expiration date (the same candle path and
 *   the same 5-day staleness tripwire as the EDGE-5 outcome closer). A price
 *   that cannot be obtained leaves outcome_pl null with a stated reason —
 *   never imputed, never 0. `taken` and `outcome_source` say which path wrote
 *   the number; the two are never confused.
 */
import { randomUUID } from 'node:crypto';
import type { CandleData, Catalyst, PremiumSide, ScanSide, ScoreModel, TradeCardData } from './types';
import type { FullScoringResult } from './composite';
import { CURRENT_MODEL_ERA } from '../edge-read/eras';

// ── the write ────────────────────────────────────────────────────────────

export interface CandidateLeg {
  type: 'call' | 'put';
  side: 'buy' | 'sell';
  strike: number;
  /** mid price per share at scan (strategy-builder.ts mid(bid, ask)) */
  price: number;
}

export interface ScanRunRow {
  id: string;
  userId: string;
  started_at: Date;
  universe: string | null;
  limit_requested: number;
  model_era: string;
  tickers_scored: number;
  candidates_written: number;
  /** MODEL-01: the mode the run was requested in (SELL / BUY / BOTH). */
  side: ScanSide;
}

export interface CandidateRow {
  id: string;
  run_id: string;
  symbol: string;
  strategy_name: string;
  label: string | null;
  legs: CandidateLeg[];
  expiration: Date;
  dte: number;
  net_credit: number | null;
  net_debit: number | null;
  max_profit: number | null;
  max_loss: number | null;
  is_unlimited: boolean;
  pop: number | null;
  pop_method: string | null;
  ev: number | null;
  ev_per_risk: number | null;
  spot_at_scan: number | null;
  iv30_at_scan: number | null;
  composite_score: number | null;
  vol_edge_score: number | null;
  quality_score: number | null;
  regime_score: number | null;
  info_edge_score: number | null;
  data_confidence: number | null;
  imputed_count: number | null;
  excluded_fields: string[];
  model_era: string;
  generated_at: Date;
  taken: false;
  // MODEL-01: the side the candidate came through, the model that scored it,
  // its catalysts (non-empty on every BUY row — the law), the earnings-window
  // line, and the cap check that let an unbounded structure exist.
  side: PremiumSide;
  score_model: ScoreModel;
  catalyst: Catalyst[];
  earnings_window: string;
  undefined_risk_cap: string | null;
}

export interface CandidateLogStore {
  /** Writes the run and its candidates; resolves to the number of candidate rows written. */
  write(run: ScanRunRow, candidates: CandidateRow[]): Promise<number>;
}

export interface PersistScanInput {
  userId: string;
  universe: string | undefined;
  limit: number;
  /** MODEL-01: the scan mode. */
  side: ScanSide;
  tickersScored: number;
  /** The scan's per-ticker card list — the list the response is built from. */
  cards: Record<string, TradeCardData[]>;
  /** Per ticker: the locked scoring, and the price context at scan. */
  context: Record<string, { scoring: FullScoringResult; spotAtScan: number | null; iv30AtScan: number | null }>;
  now: Date;
}

export interface PersistScanResult {
  runId: string;
  /** The SAME cards, each stamped with candidate_id. */
  cards: Record<string, TradeCardData[]>;
  written: number;
}

const finite = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);

function legsOf(card: TradeCardData): CandidateLeg[] {
  return card.setup.legs.map((l) => {
    const type = l.type === 'call' || l.type === 'put' ? l.type : null;
    const side = l.side === 'buy' || l.side === 'sell' ? l.side : null;
    if (type === null || side === null || !Number.isFinite(l.strike) || !Number.isFinite(l.price)) {
      throw new Error(`LOG-01: ${card.symbol} ${card.setup.strategy_name} carries a leg the log cannot store (type=${l.type} side=${l.side} strike=${l.strike} price=${l.price})`);
    }
    return { type, side, strike: l.strike, price: l.price };
  });
}

export async function persistScanCandidates(input: PersistScanInput, store: CandidateLogStore): Promise<PersistScanResult> {
  const runId = randomUUID();
  // MODEL-01: the era is the running model's, not the calendar's — the code
  // that scored the candidate knows which model it is.
  const era = CURRENT_MODEL_ERA.id;
  const rows: CandidateRow[] = [];
  const stamped: Record<string, TradeCardData[]> = {};
  for (const [symbol, cards] of Object.entries(input.cards)) {
    const ctx = input.context[symbol];
    if (!ctx && cards.length > 0) throw new Error(`LOG-01: ${symbol} has ${cards.length} card(s) but no scoring context — cannot lock its scores`);
    stamped[symbol] = cards.map((card) => {
      const id = randomUUID();
      const dc = ctx.scoring.composite.data_confidence;
      const cs = ctx.scoring.composite.category_scores;
      // MODEL-01 (the runtime half of the laws): the row carries side, model,
      // catalyst and cap check from the card; a BUY row with no catalyst and an
      // unbounded row with no cap check are refused — they must not exist.
      const why = card.why;
      if (why.side !== 'SELL' && why.side !== 'BUY') throw new Error(`MODEL-01: ${symbol} ${card.setup.strategy_name} carries no side`);
      if (why.score_model !== 'seller' && why.score_model !== 'buyer') throw new Error(`MODEL-01: ${symbol} ${card.setup.strategy_name} carries no score_model`);
      if (!why.model_era) throw new Error(`MODEL-01: ${symbol} ${card.setup.strategy_name} carries no model_era`);
      if ((why.side === 'BUY') !== (why.score_model === 'buyer')) throw new Error(`MODEL-01: ${symbol} ${card.setup.strategy_name} is ${why.side} but scored by the ${why.score_model} model`);
      if (why.side === 'BUY' && (!Array.isArray(why.catalysts) || why.catalysts.length === 0)) throw new Error(`MODEL-01: ${symbol} ${card.setup.strategy_name} is a BUY candidate with no catalyst — refused`);
      if (card.setup.is_unlimited_risk === true && !why.undefined_risk_cap) throw new Error(`MODEL-01: ${symbol} ${card.setup.strategy_name} is unbounded with no cap check recorded — refused`);
      rows.push({
        id,
        run_id: runId,
        symbol,
        strategy_name: card.setup.strategy_name,
        label: card.label ?? null,
        legs: legsOf(card),
        expiration: new Date(`${card.setup.expiration_date}T00:00:00Z`),
        dte: card.setup.dte,
        net_credit: finite(card.setup.net_credit),
        net_debit: finite(card.setup.net_debit),
        max_profit: finite(card.setup.max_profit),
        max_loss: finite(card.setup.max_loss),
        is_unlimited: card.setup.is_unlimited_risk === true,
        pop: finite(card.setup.probability_of_profit),
        pop_method: card.setup.pop_method ?? null,
        ev: finite(card.setup.ev),
        ev_per_risk: finite(card.setup.ev_per_risk),
        spot_at_scan: ctx.spotAtScan,
        iv30_at_scan: ctx.iv30AtScan,
        composite_score: finite(ctx.scoring.composite.score),
        vol_edge_score: finite(cs.vol_edge),
        quality_score: finite(cs.quality),
        regime_score: finite(cs.regime),
        info_edge_score: finite(cs.info_edge),
        data_confidence: finite(dc.confidence),
        imputed_count: finite(dc.imputed_sub_scores),
        excluded_fields: [...(dc.excluded_fields ?? [])],
        model_era: why.model_era,
        generated_at: input.now,
        taken: false,
        side: why.side,
        score_model: why.score_model,
        catalyst: why.catalysts.map((c) => ({ ...c })),
        earnings_window: why.earnings_window?.detail ?? 'earnings window not evaluated',
        undefined_risk_cap: why.undefined_risk_cap ?? null,
      });
      return { ...card, candidate_id: id };
    });
  }
  const run: ScanRunRow = {
    id: runId,
    userId: input.userId,
    started_at: input.now,
    universe: input.universe ?? null,
    limit_requested: input.limit,
    model_era: era,
    tickers_scored: input.tickersScored,
    candidates_written: rows.length,
    side: input.side,
  };
  const written = await store.write(run, rows);
  if (written !== rows.length) throw new Error(`LOG-01: the store wrote ${written} candidate rows for ${rows.length} cards — refusing to return an unpersisted candidate`);
  // The candidate log law: every returned card carries candidate_id.
  for (const cards of Object.values(stamped)) for (const c of cards) if (!c.candidate_id) throw new Error('LOG-01: a card left the log without a candidate_id');
  return { runId, cards: stamped, written };
}

// ── the settle ───────────────────────────────────────────────────────────

/** Same tolerance as the EDGE-5 closer (outcome-tracker.ts SPOT_CANDLE_MAX_LAG_DAYS): a close more than this many days before expiry is a hole, refused. */
export const SETTLE_MAX_LAG_DAYS = 5;
export const PRICE_PATH_SOURCE = 'price_path:tastytrade-daily-candles (fetchTTCandlesBatch) — held to expiry, 1 contract, entry at scan mid';
export const POSITION_SOURCE = 'position:trade_card_links.actual_pl (the linked position, as EDGE-01 reads it)';

/**
 * P&L per contract of holding the legs to expiry at a settlement price — the
 * same per-leg intrinsic arithmetic strategy-builder.ts computePnlPoints uses
 * for the payoff diagram (:461-487): buy = (intrinsic − price) × 100, sell =
 * (price − intrinsic) × 100. No early exit, no assignment friction, no fees.
 */
export function pnlAtExpiry(legs: readonly CandidateLeg[], settlePrice: number): number {
  let pnl = 0;
  for (const leg of legs) {
    const intrinsic = leg.type === 'call' ? Math.max(0, settlePrice - leg.strike) : Math.max(0, leg.strike - settlePrice);
    pnl += leg.side === 'buy' ? (intrinsic - leg.price) * 100 : (leg.price - intrinsic) * 100;
  }
  return Math.round(pnl * 100) / 100;
}

export function parseLegs(raw: unknown): CandidateLeg[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: CandidateLeg[] = [];
  for (const l of raw) {
    const o = (l ?? {}) as Record<string, unknown>;
    const type = o.type === 'call' || o.type === 'put' ? o.type : null;
    const side = o.side === 'buy' || o.side === 'sell' ? o.side : null;
    const strike = finite(o.strike);
    const price = finite(o.price);
    if (type === null || side === null || strike === null || price === null) return null;
    out.push({ type, side, strike, price });
  }
  return out;
}

export interface DueCandidate {
  id: string;
  symbol: string;
  legs: unknown;
  expiration: Date;
  taken: boolean;
}

export type TakenOutcome =
  | { state: 'closed'; pl: number }
  | { state: 'open' }
  | { state: 'no_card' }
  | { state: 'no_link' };

export interface OutcomeWrite {
  outcome_pl: number | null;
  outcome_at: Date | null;
  outcome_source: string | null;
  outcome_reason: string | null;
  settle_price: number | null;
  settle_price_date: Date | null;
}

export interface SettlePorts {
  now(): Date;
  /** Unsettled (outcome_at null) candidates of this user's runs whose expiration is on/before `today`; and how many are not yet due. */
  loadDue(userId: string, today: Date): Promise<{ due: DueCandidate[]; pending: number }>;
  /** For a TAKEN candidate: the linked position's realized outcome, as the link route computed it. */
  loadTakenOutcome(candidateId: string): Promise<TakenOutcome>;
  /** Daily candles per symbol covering at least `lookbackDays` (the free TastyTrade path). */
  fetchCandles(symbols: string[], lookbackDays: number): Promise<Map<string, CandleData[]>>;
  writeOutcome(candidateId: string, data: OutcomeWrite): Promise<void>;
}

export interface SettleSummary {
  checked: number;
  due: number;
  settled_from_position: number;
  settled_from_price_path: number;
  pending_not_yet_expired: number;
  unsettled: { reason: string; count: number }[];
  source: string;
  timestamp: string;
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export async function settleCandidateOutcomes(userId: string, ports: SettlePorts): Promise<SettleSummary> {
  const now = ports.now();
  const { due, pending } = await ports.loadDue(userId, now);
  const unsettled = new Map<string, number>();
  const declare = (reason: string) => unsettled.set(reason, (unsettled.get(reason) ?? 0) + 1);
  let fromPosition = 0;
  let fromPricePath = 0;

  const untaken = due.filter((c) => !c.taken);
  let candles = new Map<string, CandleData[]>();
  if (untaken.length > 0) {
    const symbols = [...new Set(untaken.map((c) => c.symbol))];
    const oldest = Math.min(...untaken.map((c) => c.expiration.getTime()));
    const lookbackDays = Math.ceil((now.getTime() - oldest) / 86400000) + SETTLE_MAX_LAG_DAYS + 2;
    candles = await ports.fetchCandles(symbols, lookbackDays);
  }

  for (const c of due) {
    if (c.taken) {
      const r = await ports.loadTakenOutcome(c.id);
      if (r.state === 'closed') {
        await ports.writeOutcome(c.id, { outcome_pl: r.pl, outcome_at: now, outcome_source: POSITION_SOURCE, outcome_reason: null, settle_price: null, settle_price_date: null });
        fromPosition += 1;
      } else {
        const reason =
          r.state === 'open' ? 'taken — the linked position is still open (retried next run)'
            : r.state === 'no_link' ? 'taken — the card was unlinked; no position outcome exists'
              : 'taken — no card carries this candidate_id';
        await ports.writeOutcome(c.id, { outcome_pl: null, outcome_at: null, outcome_source: null, outcome_reason: reason, settle_price: null, settle_price_date: null });
        declare(reason);
      }
      continue;
    }
    const legs = parseLegs(c.legs);
    if (!legs) {
      const reason = 'legs unreadable — the stored legs are not [{type, side, strike, price}]';
      await ports.writeOutcome(c.id, { outcome_pl: null, outcome_at: null, outcome_source: null, outcome_reason: reason, settle_price: null, settle_price_date: null });
      declare(reason);
      continue;
    }
    const series = candles.get(c.symbol) ?? [];
    const expIso = isoDate(c.expiration);
    let close: CandleData | null = null;
    for (const k of series) if (k.date <= expIso && (close === null || k.date > close.date)) close = k;
    let reason: string | null = null;
    if (series.length === 0) reason = 'no candle data for symbol (TT candle fetch returned none)';
    else if (!close) reason = 'no candle on/before expiration (candle history does not reach back that far)';
    else if ((c.expiration.getTime() - Date.parse(`${close.date}T00:00:00Z`)) / 86400000 > SETTLE_MAX_LAG_DAYS) reason = `nearest candle > ${SETTLE_MAX_LAG_DAYS}d before expiration (refused: stale close)`;
    if (reason !== null || close === null) {
      await ports.writeOutcome(c.id, { outcome_pl: null, outcome_at: null, outcome_source: null, outcome_reason: reason, settle_price: null, settle_price_date: null });
      declare(reason ?? 'no close');
      continue;
    }
    await ports.writeOutcome(c.id, {
      outcome_pl: pnlAtExpiry(legs, close.close),
      outcome_at: now,
      outcome_source: PRICE_PATH_SOURCE,
      outcome_reason: null,
      settle_price: close.close,
      settle_price_date: new Date(`${close.date}T00:00:00Z`),
    });
    fromPricePath += 1;
  }

  return {
    checked: due.length + pending,
    due: due.length,
    settled_from_position: fromPosition,
    settled_from_price_path: fromPricePath,
    pending_not_yet_expired: pending,
    unsettled: [...unsettled.entries()].map(([reason, count]) => ({ reason, count })),
    source: `${PRICE_PATH_SOURCE}; ${POSITION_SOURCE}`,
    timestamp: now.toISOString(),
  };
}
