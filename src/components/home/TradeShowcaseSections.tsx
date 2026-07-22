'use client';

/**
 * TRADE-SHOWCASE-FULL: the slide sections of the logged-out Trade showcase,
 * per the TRADE-FULL-INVENTORY rulings.
 *
 * SLIDES-1 → SLIDES-2 (Alex's rulings, override the Jul-16 faithful-mirror
 * design): the deck is NARRATIVE SLIDES ONLY. SLIDES-1 removed the real-
 * component demos (ScannerPanelDemo's ScanFilterForm; RealCockpitDemo's
 * ScannerResultsTable + TickerChapter); SLIDES-2 removed the static
 * product-replicas too (TrackRecordMirror, GradedCardMirror) — anything that
 * visually replicates product UI is a pipe regardless of being static JSX.
 * What remains: the dark hero terminal + the eight slide panels (engine-real
 * values from the declared example payload, tradeShowcasePayload.ts) + the
 * unlock CTA.
 *
 * SHOW discipline: ZERO fetches, zero paid calls, nothing personal, no
 * auth/gate logic. All example values labeled.
 */

import { DEFAULT_FILTERS, AVAILABLE_STRATEGIES } from '@/lib/convergence/filter-types';
import { ExampleTag } from '@/components/home/TabShowcaseTemplate';
import {
  SHOWCASE_RESULTS,
  SHOWCASE_REJECTIONS,
  SHOWCASE_PROGRESS,
  SHOWCASE_DEEP_DIVE,
} from '@/components/home/tradeShowcasePayload';

/** id the Scan button scrolls to for logged-in-but-locked viewers. */
export const TRADE_UNLOCK_CTA_ID = 'trade-unlock-cta';

// ── BLOOMBERG-STYLE DARK PIECES ──────────────────────────────────────────────
// Styling/framing only: every number below comes from the existing payload
// (tradeShowcasePayload.ts) or the constants already on the pipe rail — no
// new figures. Dark surfaces use the config's panel token family
// (tailwind.config.ts:34-40) + the brand purple family for the hero glow.

/** The hero CTA — routes to the existing signup/checkout flow (same recipe as
 *  the Scan button: logged-out → signup modal; locked → the Unlock CTA). */
export function UnlockTradeButton({
  currentUserId,
  onRequireAuth,
}: {
  currentUserId: string;
  onRequireAuth: () => void;
}) {
  const go = () => {
    if (!currentUserId) {
      onRequireAuth();
    } else {
      document.getElementById(TRADE_UNLOCK_CTA_ID)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };
  return (
    <button
      type="button"
      onClick={go}
      className="rounded-lg bg-brand-purple px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-purple-hover"
    >
      Unlock Trade
    </button>
  );
}

/** The hero's dark terminal panel — REAL rows from the existing payload:
 *  the GLOBEX condor card values, ACME's no-strategies rejection, INITECH's
 *  engine NO-TRADE caption, and the funnel line already on the pipe rail. */
export function HeroTerminalPanel() {
  const condor = SHOWCASE_DEEP_DIVE.trade_cards![0].setup;
  const initechReason = SHOWCASE_REJECTIONS.INITECH[0].reason; // the engine's own caption
  return (
    <div className="rounded-lg border border-panel-border bg-panel/90 p-4 font-mono text-[11px] leading-relaxed shadow-2xl">
      <div className="flex items-center justify-between border-b border-panel-border pb-2">
        <span className="font-bold uppercase tracking-wider text-white/60">Scan · S&amp;P 500</span>
        <ExampleTag text="Example scan" />
      </div>
      <p className="mt-2 text-white/50">475 → 52 → 40 → 20 → 9 · 128 Finnhub calls · ~94s</p>
      <div className="mt-2 space-y-1.5">
        <p>
          <span className="font-bold text-white">GLOBEX</span>{' '}
          <span className="text-white/60">{condor.strategy_name} · {condor.dte} DTE</span>
          <br />
          <span className="text-brand-green">COLLECT ${((condor.net_credit ?? 0) * 100).toFixed(0)}</span>
          <span className="text-white/50"> · MAX L </span><span className="text-brand-red">${condor.max_loss}</span>
          <span className="text-white/50"> · POP </span><span className="text-white/90">{Math.round((condor.probability_of_profit ?? 0) * 100)}%</span>
        </p>
        <p>
          <span className="font-bold text-white">ACME</span>{' '}
          <span className="text-white/50">No strategies passed — {SHOWCASE_REJECTIONS.ACME[0].gate}</span>
        </p>
        <p>
          <span className="font-bold text-white">INITECH</span>{' '}
          <span className="text-brand-red">{initechReason}</span>
        </p>
      </div>
      <p className="mt-2 border-t border-panel-border pt-2 text-white/40">
        The engine says no more often than yes — and shows its work either way.
      </p>
    </div>
  );
}

/** Editorial pipeline panel — ALL 20 real steps A–T (the pipeline's own
 *  step_a…step_t labels; TRADE-SHOWCASE-FINAL moved the full list here and
 *  the standalone rail was removed). Real defaults stated as real (475
 *  universe, 40 = 2× scan size, 20 scored, 9 selected); illustrative counts
 *  say "(example)". */
const PIPE_STEPS_FULL: [string, string, string?][] = [
  ['A', 'TT Scanner', '475 symbols fetched (S&P 500 example run)'],
  ['B', 'Pre-Filter', 'ranked by IV rank, IV–HV spread, liquidity'],
  ['C', 'Hard Exclusions', 'no premium or illiquid → out'],
  ['D', 'Top-N Selection', 'top 40 carried forward (20 × 2)'],
  ['E', 'Hard Filters', '>$2B cap, ≥2/5 liquidity, IV present, earnings >7d, Reg SHO'],
  ['F', 'Peer Grouping', 'Finnhub peers → industry → sector'],
  ['G', 'Pre-Score', '40 selected for full enrichment'],
  ['H', 'Macro & Regime Data', 'FRED: VIX, VIX3M, VVIX, yield curve, credit'],
  ['I', 'Data Enrichment', '128 Finnhub calls (example)'],
  ['J', 'Candles & Cross-Asset Correlations'],
  ['K', '4-Gate Scoring', 'vol edge · quality · regime · info edge'],
  ['L', 'Re-Score With Technicals'],
  ['M', 'Final Selection', '9 selected, sector-capped (max 2)'],
  ['N', 'Chain Fetch', 'live TastyTrade option chains'],
  ['O', 'Live Greeks Subscription', '2,208 events across 9 symbols (example)'],
  ['P', 'Strategy Scoring', 'spreads, condors, calendars — scored'],
  ['Q', 'Live Options Flow & GEX'],
  ['R', 'Re-Score With Live Data'],
  ['S', 'Trade Cards', 'sized suggestions — or NO TRADE'],
  ['T', 'Save & Return', 'snapshot saved for the self-graded record'],
];

export function PipelinePanelDark() {
  return (
    <div className="rounded-lg border border-panel-border bg-panel p-4 font-mono text-[11px] leading-relaxed">
      <div className="flex items-center justify-between border-b border-panel-border pb-2">
        <span className="font-bold uppercase tracking-wider text-white/60">Hit Scan, and this runs — 20 steps, A to T</span>
        <ExampleTag text="Example scan" />
      </div>
      <div className="mt-2 grid gap-x-5 gap-y-1 sm:grid-cols-2">
        {PIPE_STEPS_FULL.map(([code, label, summary]) => (
          <p key={code}>
            <span className="font-bold text-brand-amber">{code}</span>{' '}
            <span className="text-white/90">{label}</span>
            {summary && <span className="text-white/50"> — {summary}</span>}
          </p>
        ))}
      </div>
      <p className="mt-2 border-t border-panel-border pt-2 text-white/50">
        Funnel (S&amp;P 500 run): <span className="text-white/90">475 → 52 → 40 → 20 → 9</span> · 128 Finnhub calls · ~94s. 475, 40, 20 and 9 are the real defaults; the rest are sample counts.
      </p>
    </div>
  );
}

/** Editorial row B panel: the record, dark — the same values the
 *  track-record mirror below carries. */
export function RecordPanelDark() {
  return (
    <div className="rounded-lg border border-panel-border bg-panel p-4 font-mono text-[11px] leading-relaxed">
      <div className="flex items-center justify-between border-b border-panel-border pb-2">
        <span className="font-bold uppercase tracking-wider text-white/60">Track record</span>
        <ExampleTag text="Example data" />
      </div>
      <div className="mt-2 space-y-1 text-white/70">
        <p><span className="text-white">7</span> linked · <span className="text-white">3</span> unlinked (excluded) · <span className="text-white">2</span> queued</p>
        <p><span className="font-bold text-brand-green">7W – 0L – 0BE</span> of <span className="text-white">7</span> decided</p>
        <p>Net P&amp;L <span className="font-bold text-brand-green">$1,284</span> <span className="text-white/40">(linked only)</span></p>
        <p>Max-loss model: <span className="text-white">7 of 7</span> stayed within the claim</p>
        <p>Grades A <span className="text-white">3</span> · B <span className="text-white">3</span> · C <span className="text-white">1</span> · D <span className="text-white">0</span> · F <span className="text-white">0</span></p>
      </div>
    </div>
  );
}

// The declared example graded trade the GradedPanelDark slide renders — the
// SAME GLOBEX Iron Condor the card slide prices: entry credit $1.20, closed
// at $0.35 → P&L = (1.20 − 0.35) × 100 = +$85, inside the claimed $380 max
// loss → graded. Predicted values identical to the card slide (COLLECT $120 /
// MAX LOSS $380 / POP 78% / R:R 0.32). (Data only — the JSX replica that once
// consumed it died in SLIDES-2.)
const REPLICA = {
  symbol: 'GLOBEX',
  strategy: 'Iron Condor',
  direction: 'NEUTRAL',
  legs: [
    { side: 'SELL', type: 'PUT', strike: 90, price: 1.15 },
    { side: 'BUY', type: 'PUT', strike: 85, price: 0.55 },
    { side: 'SELL', type: 'CALL', strike: 105, price: 1.05 },
    { side: 'BUY', type: 'CALL', strike: 110, price: 0.45 },
  ],
  meta: 'Queued Jul 12, 9:41 AM · 30 DTE · Exp Aug 11 · Trade #1042 · Linked Jul 13',
  predicted: { maxProfit: '$120', maxLoss: '-$380', pop: '78.0%', rr: '0.32', entry: '$1.20' },
  actual: { pl: '+$85', entry: '$1.20', exit: '$0.35', grade: 'B' },
  thesis: [
    { point: 'Price stays inside the 90–105 range through expiration', result: true },
    { point: 'IV bleeds off after the macro print — premium decays our way', result: true },
    { point: 'Volume returns to the sector and lifts the floor', result: false },
  ],
  notes: 'Closed at 70% of max profit on day 19 — mechanical take-profit.',
};

// ── TRADE-SHOWCASE-SLIDES: the six product-piece slide panels ────────────────
// Each is a dark, self-contained "slide" panel (screengrab-ready). Values come
// ONLY from the existing payload (tradeShowcasePayload.ts), the real constants
// (DEFAULT_FILTERS / AVAILABLE_STRATEGIES, filter-types.ts), and the engine's
// own strings — nothing newly invented.

function SlideShell({ title, tag, children }: { title: string; tag?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-panel-border bg-panel p-4 font-mono text-[11px] leading-relaxed">
      <div className="flex items-center justify-between gap-2 border-b border-panel-border pb-2">
        <span className="font-bold uppercase tracking-wider text-white/60">{title}</span>
        {tag && <ExampleTag text={tag} />}
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

/** Slide a — the scanner's real controls, from DEFAULT_FILTERS (filter-types.ts:53-78)
 *  and AVAILABLE_STRATEGIES (:85-102). The interactive real panel lives below. */
export function ScannerPanelDark() {
  const f = DEFAULT_FILTERS;
  return (
    <SlideShell title="Scan filters — the real defaults">
      <div className="space-y-1 text-white/70">
        <p>Universe <span className="text-white">S&amp;P 500 | Nasdaq 100</span> · Direction <span className="text-white">All</span><span className="text-white/40">/Bull/Bear/Ntrl</span> · Premium <span className="text-white">Both</span><span className="text-white/40">/Sell/Buy</span> · Risk <span className="text-white">Defined</span><span className="text-white/40">/Unlimited</span></p>
        <p>DTE <span className="text-white">{f.risk.minDte}–{f.risk.maxDte}</span> · Width <span className="text-white">${f.risk.minSpreadWidth}–${f.risk.maxSpreadWidth}</span></p>
        <p className="text-white/50">Liquidity gates (4): min OI <span className="text-white/80">{f.liquidity.minOpenInterest}</span> · max bid-ask spread <span className="text-white/80">{f.liquidity.maxBidAskSpreadPct}%</span> · min volume <span className="text-white/80">{(f.liquidity.minUnderlyingVolume / 1000).toFixed(0)}K</span> · min TT rating <span className="text-white/80">{f.liquidity.minLiquidityRating}★</span></p>
        <p className="text-white/50">Edge metrics (6): min PoP <span className="text-white/80">{f.edge.minPop}%</span> · min EV <span className="text-white/80">${f.edge.minEv}</span> · min EV/Risk <span className="text-white/80">{f.edge.minEvPerRisk.toFixed(2)}</span> · vol edge <span className="text-white/80">Any</span> · min IV rank <span className="text-white/80">{f.edge.minIvRank}%</span> · min sentiment <span className="text-white/80">{(f.edge.minSentiment / 100).toFixed(1)}</span></p>
        <p className="mt-1.5 flex flex-wrap gap-1">
          {AVAILABLE_STRATEGIES.map((s) => (
            <span key={s} className="rounded border border-panel-border bg-panel-hover px-1.5 py-0.5 text-[10px] text-white/70">{s}</span>
          ))}
        </p>
      </div>
    </SlideShell>
  );
}

/** Slide b — the results table, from the payload rows (engine composites,
 *  the condor card values, the rejection gates, the engine NO-TRADE caption). */
export function ResultsTablePanelDark() {
  const globex = SHOWCASE_RESULTS[0];
  const condor = globex.trade_cards![0].setup;
  const acme = SHOWCASE_RESULTS[1];
  const initech = SHOWCASE_RESULTS[2];
  return (
    <SlideShell title="Results — every ticker scored" tag="Example scan">
      <div className="space-y-2">
        <div>
          <p>
            <span className="font-bold text-white">GLOBEX</span> <span className="text-white/50">score</span> <span className="text-white">{globex.scores.composite.score}</span>
            <span className="text-white/50"> · </span><span className="text-white/80">{globex.scores.composite.direction}</span>
            <span className="text-white/50"> · </span><span className="text-white/90">{condor.strategy_name}</span>
            <span className="text-white/50"> · {condor.dte} DTE</span>
          </p>
          <p className="text-white/60">
            {condor.legs.map((l) => `${l.side.toUpperCase()} ${l.type.toUpperCase()} $${l.strike}`).join(' / ')}
          </p>
          <p>
            <span className="text-brand-green">COLLECT ${((condor.net_credit ?? 0) * 100).toFixed(0)}</span>
            <span className="text-white/50"> · MAX P </span><span className="text-brand-green">${condor.max_profit}</span>
            <span className="text-white/50"> · MAX L </span><span className="text-brand-red">${condor.max_loss}</span>
            <span className="text-white/50"> · POP </span><span className="text-white/90">{Math.round((condor.probability_of_profit ?? 0) * 100)}%</span>
            <span className="text-white/50"> · EV </span><span className="text-brand-green">+${condor.ev}</span>
            <span className="text-white/50"> · EV/RISK </span><span className="text-white/90">{condor.ev_per_risk.toFixed(3)}</span>
            <span className="text-white/50"> · R:R </span><span className="text-white/90">{condor.risk_reward_ratio?.toFixed(2)}</span>
          </p>
        </div>
        <p>
          <span className="font-bold text-white">ACME</span> <span className="text-white/50">score</span> <span className="text-white">{acme.scores.composite.score}</span>
          <span className="text-white/50"> · </span><span className="text-white/80">{acme.scores.composite.direction}</span>
          <br />
          <span className="text-white/50">No strategies — {SHOWCASE_REJECTIONS.ACME[0].strategy}: {SHOWCASE_REJECTIONS.ACME[0].gate}; {SHOWCASE_REJECTIONS.ACME[1].strategy}: {SHOWCASE_REJECTIONS.ACME[1].gate}</span>
        </p>
        <p>
          <span className="font-bold text-white">INITECH</span> <span className="text-white/50">score</span> <span className="text-white">{initech.scores.composite.score}</span>
          <span className="text-white/50"> · </span><span className="text-white/80">{initech.scores.composite.direction}</span>
          <br />
          <span className="text-brand-red">{SHOWCASE_REJECTIONS.INITECH[0].reason}</span>
        </p>
      </div>
    </SlideShell>
  );
}

/** Slide c — the deep dive, from the payload's engine-real GLOBEX gate scores
 *  + the engine's convergence-gate string + the rejection reasons. */
export function DeepDivePanelDark() {
  const c = SHOWCASE_DEEP_DIVE.scores.composite;
  const g = c.category_scores;
  // The rank/sector the deep dive really shows (SHOWCASE_PROGRESS step_k —
  // the same rankings the real deep dive reads).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rankings: any[] = SHOWCASE_PROGRESS.step_k.data.rankings;
  const rankIdx = rankings.findIndex((r) => r.symbol === 'GLOBEX');
  const rankRow = rankings[rankIdx];
  // The real terminal card's 10-char bar (termBar, ConvergenceIntelligence.tsx:394-395).
  const bar = (score: number) => '█'.repeat(Math.round((score / 100) * 10)).padEnd(10, '░');
  const gates: [string, number][] = [
    ['Vol Edge', g.vol_edge],
    ['Quality', g.quality],
    ['Regime', g.regime],
    ['Info Edge', g.info_edge],
  ];
  const forGates = gates.filter(([, s]) => s > 50);
  const againstGates = gates.filter(([, s]) => s <= 50);
  return (
    <SlideShell title="Deep dive — GLOBEX" tag="Example data">
      <div className="space-y-1 text-white/70">
        <p className="text-white/50">WHY THIS TICKER</p>
        <p>Composite <span className="text-white">{c.score}</span> — ranked <span className="text-white">#{rankIdx + 1}</span> of all scored · Sector <span className="text-white/90">{rankRow.sector}</span> · Direction <span className="text-white/90">{c.direction}</span></p>
        <div className="space-y-0.5">
          {gates.map(([name, score]) => (
            <p key={name}>
              <span className={score > 50 ? 'text-brand-green' : 'text-brand-red'}>{bar(score)}</span>{' '}
              <span className="text-white/90">{score}</span> <span className="text-white/60">{name}</span>
            </p>
          ))}
        </div>
        <p><span className="text-white/90">&ldquo;{c.convergence_gate}&rdquo;</span></p>
        <p className="mt-1.5 text-white/50">FOR</p>
        {forGates.map(([name, score]) => (
          <p key={name}>• <span className="text-brand-green">{name} {score}</span> — above 50: the gate found edge.</p>
        ))}
        <p className="mt-1.5 text-white/50">AGAINST</p>
        {againstGates.length > 0 ? (
          againstGates.map(([name, score]) => (
            <p key={name}>• <span className="text-brand-red">{name} {score}</span> — at or below 50: no edge claimed.</p>
          ))
        ) : (
          <p className="text-white/50">• None — all four gates cleared 50 in this example (a marginal but unanimous 4/4).</p>
        )}
        <p className="mt-1.5 text-white/50">AND WHY NOT THE OTHERS</p>
        <p><span className="text-white">ACME</span> — {SHOWCASE_REJECTIONS.ACME[0].strategy}: {SHOWCASE_REJECTIONS.ACME[0].reason} ({SHOWCASE_REJECTIONS.ACME[0].gate})</p>
        <p><span className="text-white">INITECH</span> — <span className="text-brand-red">{SHOWCASE_REJECTIONS.INITECH[0].reason}</span></p>
      </div>
    </SlideShell>
  );
}

/** Slide d — the full priced trade card, from the payload condor setup.
 *  KELLY is computed here with the SAME quarter-Kelly formula the live card
 *  uses (ConvergenceIntelligence.tsx:704-708): winRate = hv_pop, ratio =
 *  max_profit/max_loss → max(0, (w·r − (1−w))/r × 0.25). */
export function TradeCardPanelDark() {
  const s = SHOWCASE_DEEP_DIVE.trade_cards![0].setup;
  const w = s.hv_pop ?? s.probability_of_profit ?? 0;
  const ratio = s.max_profit != null && s.max_loss ? s.max_profit / s.max_loss : 0;
  const kellyPct = ratio > 0 ? Math.round(Math.max(0, ((w * ratio - (1 - w)) / ratio) * 0.25) * 1000) / 10 : 0;
  return (
    <SlideShell title="The trade card — GLOBEX Iron Condor" tag="Example data">
      <div className="space-y-0.5">
        <p className="text-white/50">Exp <span className="text-white/80">{s.expiration_date}</span> · <span className="text-white/80">{s.dte} DTE</span></p>
        {s.legs.map((leg) => (
          <p key={`${leg.side}-${leg.type}-${leg.strike}`}>
            <span className={leg.side === 'sell' ? 'font-bold text-brand-red' : 'font-bold text-brand-green'}>{leg.side.toUpperCase().padEnd(4)}</span>
            <span className="text-white/50"> {leg.type.toUpperCase().padEnd(4)} </span>
            <span className="text-white">${leg.strike}</span>
            <span className="text-white/40">  ${leg.price.toFixed(2)}</span>
          </p>
        ))}
        <p className="pt-1.5">
          <span className="font-bold text-brand-green">COLLECT ${((s.net_credit ?? 0) * 100).toFixed(0)}</span>
          <span className="text-white/50"> · MAX LOSS </span><span className="text-brand-red">${s.max_loss}</span>
          <span className="text-white/50"> · POP </span><span className="text-white/90">{Math.round((s.probability_of_profit ?? 0) * 100)}%</span><span className="text-white/40"> (N(d2))</span>
          <span className="text-white/50"> · EV </span><span className="text-brand-green">+${s.ev}</span>
          <span className="text-white/50"> · EV/RISK </span><span className="text-white/90">{s.ev_per_risk.toFixed(3)}</span>
          <span className="text-white/50"> · R:R </span><span className="text-white/90">{s.risk_reward_ratio?.toFixed(2)}</span>
        </p>
        <p className="text-white/50">
          B/E <span className="text-white/80">{s.breakevens.map((b) => `$${b.toFixed(2)}`).join(' / ')}</span> · HV POP <span className="text-white/80">{Math.round((s.hv_pop ?? 0) * 100)}%</span> · THETA <span className="text-brand-green">+${s.greeks.theta_per_day.toFixed(2)}/day</span> · VEGA/pt <span className="text-brand-red">-${Math.abs(s.greeks.vega * 100).toFixed(2)}</span> · KELLY <span className="text-white/80">{kellyPct.toFixed(1)}%</span>
        </p>
      </div>
    </SlideShell>
  );
}

/** Slide e — graded against reality, from the REPLICA values (the same
 *  condor: entry 1.20, exit 0.35 → +$85, grade B, thesis 2✓ 1✗). */
export function GradedPanelDark() {
  return (
    <SlideShell title="Graded against reality — GLOBEX" tag="Example data">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-0.5">
          <p className="text-white/50">PREDICTED</p>
          <p className="text-white/70">Max Profit <span className="text-brand-green">{REPLICA.predicted.maxProfit}</span></p>
          <p className="text-white/70">Max Loss <span className="text-brand-red">{REPLICA.predicted.maxLoss}</span></p>
          <p className="text-white/70">Est. PoP <span className="text-white">{REPLICA.predicted.pop}</span></p>
          <p className="text-white/70">R:R <span className="text-white">{REPLICA.predicted.rr}</span></p>
          <p className="text-white/70">Entry <span className="text-white">{REPLICA.predicted.entry}</span></p>
        </div>
        <div className="space-y-0.5">
          <p className="text-white/50">ACTUAL</p>
          <p className="text-white/70">P&amp;L <span className="font-bold text-brand-green">{REPLICA.actual.pl}</span></p>
          <p className="text-white/70">Entry <span className="text-white">{REPLICA.actual.entry}</span></p>
          <p className="text-white/70">Exit <span className="text-white">{REPLICA.actual.exit}</span></p>
          <p className="text-white/70">Grade <span className="rounded px-1.5 py-0.5 font-black" style={{ background: '#2563EB', color: '#EFF6FF' }}>{REPLICA.actual.grade}</span></p>
        </div>
      </div>
      <div className="mt-2 space-y-0.5 border-t border-panel-border pt-2">
        {REPLICA.thesis.map((t) => (
          <p key={t.point}>
            {t.result ? <span className="text-brand-green">✓</span> : <span className="text-brand-red">✗</span>}{' '}
            <span className="text-white/70">{t.point}</span>
          </p>
        ))}
      </div>
      {/* Regime — the engine's own brake declaration (payload), as on the real card. */}
      <p className="mt-2 border-t border-panel-border pt-2 text-white/50">
        Regime: <span className="text-brand-green">{SHOWCASE_DEEP_DIVE.scores.regime.breakdown.survival_brake.declaration}</span>
      </p>
    </SlideShell>
  );
}

/** Slide f — the survival brake: the engine's own declaration (payload) and
 *  the real rule constants (regime.ts:72-73; fail-safe UNVERIFIED :104-115). */
export function BrakePanelDark() {
  const brake = SHOWCASE_DEEP_DIVE.scores.regime.breakdown.survival_brake;
  return (
    <SlideShell title="The survival brake" tag="Example data">
      <div className="space-y-1.5 text-white/70">
        <p>Rule: <span className="text-white">VIX/VIX3M &gt; 1.0</span> (backwardation) <span className="text-white/50">or</span> <span className="text-white">VVIX ≥ 110</span> → short-vol suggestions cut automatically.</p>
        <p className="text-white/50">Missing inputs → <span className="text-brand-amber">UNVERIFIED</span> — treated like ON. It never assumes safety.</p>
        <p className="border-t border-panel-border pt-1.5 text-brand-green">{brake.declaration}</p>
      </div>
    </SlideShell>
  );
}
