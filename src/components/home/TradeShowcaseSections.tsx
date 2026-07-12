'use client';

/**
 * TRADE-SHOWCASE-FULL / TRADE-SHOWCASE-REAL-COMPONENTS: the full-product
 * sections of the logged-out Trade showcase, per the TRADE-FULL-INVENTORY
 * rulings and the Phase-1 mountability audit:
 *
 *  • ScannerPanelDemo — REAL ScanFilterForm mounted (props+callbacks only,
 *    zero fetches — ScanFilterForm.tsx:10-12). Scan NEVER fires a scan.
 *  • RealCockpitDemo — the REAL ScannerResultsTable (zero fetches/effects,
 *    fully props-driven — ScannerResultsTable.tsx:58-69) and the REAL
 *    TickerChapter deep dive (exported, ConvergenceIntelligence.tsx:212;
 *    AccountSizeContext defaults to 0 = the honest "no dollar math" state,
 *    CI:23) mounted on the declared example payload
 *    (tradeShowcasePayload.ts). Gate results are ENGINE-REAL (scoreAll
 *    fixture); chain/card values are declared examples, tagged. The
 *    Queue-Card / save callbacks route to signup — nothing persists.
 *  • TrackRecordMirror — STATIC MIRROR ruling: TradeRecord self-fetches
 *    (TradeRecord.tsx:47-50); mirrors its exact section order (:131-181).
 *  • GradedCardMirror — STATIC REPLICA ruling: TradeLabPanel self-fetches
 *    (TradeLabPanel.tsx:118-135) and its card rows are inline JSX (no props
 *    seam), so it cannot mount; this replica follows the real JSX structure
 *    — row header (:404-419), legs line (:421-429), meta row (:432-438),
 *    right-rail numbers (:442-462), expanded scorecard PREDICTED vs ACTUAL
 *    (:565-639), thesis ✓/✗ (:641-661), regime (:663-669), notes (:671-677)
 *    — on the SAME GLOBEX Iron Condor the cockpit above generates, so the
 *    generate→link→grade story is one trade end to end.
 *
 * SHOW discipline: ZERO fetches, zero paid calls, nothing personal, no
 * auth/gate logic. All example values labeled.
 */

import { useRef, useState } from 'react';
import ScanFilterForm from '@/components/trading/ScanFilterForm';
import ScannerResultsTable from '@/components/convergence/ScannerResultsTable';
import { TickerChapter } from '@/components/convergence/ConvergenceIntelligence';
import type { ScannerFilters } from '@/lib/convergence/filter-types';
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

/** TRADE-SHOWCASE-BLOOMBERG: anchor ids the dark product tiles scroll to. */
export const TRADE_SECTION_IDS = {
  scanner: 'trade-scanner',
  cockpit: 'trade-cockpit',
  deepDive: 'trade-deep-dive',
  gradedCard: 'trade-graded-card',
} as const;

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

/** Editorial row A panel: the pipe, dark — the same step highlights and
 *  counts the full rail below carries (475/9 real; 128/2,208 example). */
export function PipelinePanelDark() {
  const lines: [string, string][] = [
    ['A', 'TT Scanner — 475 symbols fetched'],
    ['I', 'Data Enrichment — 128 Finnhub calls (example)'],
    ['M', 'Final Selection — 9 selected, sector-capped'],
    ['O', 'Live Greeks — 2,208 events across 9 symbols (example)'],
    ['T', 'Save & Return — snapshot saved for the self-graded record'],
  ];
  return (
    <div className="rounded-lg border border-panel-border bg-panel p-4 font-mono text-[11px] leading-relaxed">
      <div className="flex items-center justify-between border-b border-panel-border pb-2">
        <span className="font-bold uppercase tracking-wider text-white/60">Pipeline — 20 steps, A to T</span>
        <ExampleTag text="Example scan" />
      </div>
      <div className="mt-2 space-y-1">
        {lines.map(([code, text]) => (
          <p key={code}>
            <span className="font-bold text-brand-amber">{code}</span>{' '}
            <span className="text-white/70">{text}</span>
          </p>
        ))}
        <p className="text-white/40">… all 20, in full, below ↓</p>
      </div>
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

function SectionTitle({ title, tag }: { title: string; tag?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
      <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">{title}</p>
      {tag && <ExampleTag text={tag} />}
    </div>
  );
}

// ── THE SCANNER — the REAL filter panel, interactive ────────────────────────

export function ScannerPanelDemo({
  currentUserId,
  onRequireAuth,
}: {
  currentUserId: string;
  onRequireAuth: () => void;
}) {
  const [universe, setUniverse] = useState('sp500');
  const [filters, setFilters] = useState<ScannerFilters>(DEFAULT_FILTERS);
  // The real form calls scanTriggerRef.current() on Scan. Here that NEVER
  // fires a scan: logged-out → signup modal; logged-in (locked) → the CTA.
  const scanRef = useRef<(() => void) | null>(null);
  scanRef.current = () => {
    if (!currentUserId) {
      onRequireAuth();
    } else {
      document.getElementById(TRADE_UNLOCK_CTA_ID)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <div id={TRADE_SECTION_IDS.scanner} className="scroll-mt-4 rounded-lg border border-border bg-white">
      <SectionTitle title="The scanner — every control is real. Set your filters, hit Scan." />
      <div className="p-4">
        <ScanFilterForm
          scannerUniverse={universe}
          setScannerUniverse={setUniverse}
          scannerFilters={filters}
          onFiltersChange={setFilters}
          scanTriggerRef={scanRef}
          showHeader={false}
        />
      </div>
      <p className="border-t border-border px-4 py-2 text-xs text-text-muted">
        This is the live tab&rsquo;s actual filter panel — 4 liquidity gates, 6 edge metrics, 16
        strategies, DTE and width — not a mockup. Scan here takes you to sign-up; no scan runs
        until you&rsquo;re in.
      </p>
    </div>
  );
}

// ── THE COCKPIT — the REAL results table + REAL deep dive, example payload ──

export function RealCockpitDemo({
  currentUserId,
  onRequireAuth,
}: {
  currentUserId: string;
  onRequireAuth: () => void;
}) {
  // Queue-Card / save actions route to signup (logged-out) or the CTA
  // (logged-in but locked) — nothing is persisted from the showcase.
  const routeAway = async () => {
    if (!currentUserId) {
      onRequireAuth();
    } else {
      document.getElementById(TRADE_UNLOCK_CTA_ID)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <div className="space-y-4">
      <div id={TRADE_SECTION_IDS.cockpit} className="scroll-mt-4 rounded-lg border border-border bg-white">
        <SectionTitle
          title="The results — the real table, the real deep dive"
          tag="Example scan — engine-real gate scores, declared example chain/card values"
        />
        <div className="p-3">
          {/* The REAL power table (13 sortable columns, expandable rows).
              GLOBEX carries the full Iron Condor card; ACME and INITECH show
              the honest no-card cases with their rejection reasons. */}
          <ScannerResultsTable
            results={SHOWCASE_RESULTS}
            rejectionMap={SHOWCASE_REJECTIONS}
            savedCards={new Map()}
            savingCards={new Set()}
            saveErrors={new Map()}
            onSaveCard={routeAway}
            onRemoveCard={routeAway}
            pipelineProgress={SHOWCASE_PROGRESS}
          />
        </div>
      </div>
      <div id={TRADE_SECTION_IDS.deepDive} className="scroll-mt-4 rounded-lg border border-border bg-white">
        <SectionTitle
          title="Every selected ticker gets this — the full deep dive"
          tag="Example data"
        />
        <div className="p-3">
          {/* The REAL TickerChapter: WHY THIS TICKER / CHAIN FETCH / STRATEGY
              SCORING / THE TRADE card with COLLECT · MAX LOSS · POP · EV ·
              EV/RISK · R:R · B/E · HV POP · THETA · VEGA · KELLY, then gate
              bars, vol detail, company & macro, info signals — rendered by
              the live component from the payload. */}
          <TickerChapter
            detail={SHOWCASE_DEEP_DIVE}
            savedCards={new Map()}
            savingCards={new Set()}
            saveErrors={new Map()}
            onSave={routeAway}
            onRemove={routeAway}
            pipelineProgress={SHOWCASE_PROGRESS}
          />
        </div>
      </div>
      <p className="text-xs text-text-muted">
        Everything above is the real cockpit UI, rendered from a declared example scan: the four
        gate scores were computed by the real scoring engine on the declared inputs; option-chain
        and card values are internally-coherent examples (a logged-out page fetches nothing). When
        convergence fails, the row says so — no trade is manufactured to fill the table.
      </p>
    </div>
  );
}

// ── TRACK RECORD — faithful static mirror of TradeRecord.tsx ────────────────

export function TrackRecordMirror() {
  return (
    <div className="rounded-lg border border-border bg-white text-xs text-text-secondary">
      <SectionTitle title="The track record — self-graded, denominator first" tag="Example data" />
      {/* Mirrors TradeRecord.tsx section order exactly (:131-181). */}
      <div className="border-b border-border px-4 py-2">
        Record: <span className="font-mono font-semibold text-text-primary">7</span> linked trades
        {' · '}<span className="font-mono font-semibold text-text-primary">3</span> closed positions unlinked (excluded)
        {' · '}<span className="font-mono font-semibold text-text-primary">2</span> cards queued, not yet linked
      </div>
      <div className="border-b border-border px-4 py-2">
        <span className="font-mono font-semibold text-text-primary">7W – 0L – 0BE</span> of{' '}
        <span className="font-mono font-semibold text-text-primary">7</span> decided
      </div>
      <div className="border-b border-border px-4 py-2">
        Net P&amp;L: <span className="font-mono font-semibold text-brand-green">$1,284</span>
        <span className="text-text-faint"> (linked trades only)</span>
      </div>
      <div className="border-b border-border px-4 py-2">
        Max-loss model: <span className="font-mono font-semibold text-text-primary">7</span> of{' '}
        <span className="font-mono font-semibold text-text-primary">7</span> linked trades stayed within their card&rsquo;s stated max loss.
      </div>
      <div className="border-b border-border px-4 py-2">
        Grades:{' '}
        <span className="font-mono">A <span className="font-semibold text-text-primary">3</span></span>
        {' · '}<span className="font-mono">B <span className="font-semibold text-text-primary">3</span></span>
        {' · '}<span className="font-mono">C <span className="font-semibold text-text-primary">1</span></span>
        {' · '}<span className="font-mono">D <span className="font-semibold text-text-primary">0</span></span>
        {' · '}<span className="font-mono">F <span className="font-semibold text-text-primary">0</span></span>
      </div>
      <p className="px-4 py-2 text-text-muted">
        No cherry-picking: the record leads with what it excludes (unlinked positions are counted and
        declared, never hidden), a win rate never appears without its denominator, and every trade
        that breaks its claimed max loss is listed by name. Example numbers — your record starts at
        zero and only ever shows what actually happened.
      </p>
    </div>
  );
}

// ── GRADED TRADE CARD — structural replica of the Trade Lab card ────────────
// Cannot mount the real component (self-fetching, inline rows); this replica
// follows TradeLabPanel's JSX structure line for line (cites in the header
// comment above). SAME trade as the cockpit's Iron Condor: entry credit
// $1.20, closed at $0.35 → P&L = (1.20 − 0.35) × 100 = +$85, inside the
// claimed $380 max loss → graded. Predicted values identical to the card
// above (COLLECT $120 / MAX LOSS $380 / POP 78% / R:R 0.32).

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

export function GradedCardMirror() {
  return (
    <div id={TRADE_SECTION_IDS.gradedCard} className="scroll-mt-4 rounded-lg border border-border bg-white">
      <SectionTitle title="After the trade — the card grades itself against reality" tag="Example data" />
      {/* Row container: graded + positive P&L → green tint (TradeLabPanel.tsx:394-398). */}
      <div className="bg-green-50 px-4 py-3">
        {/* Header row — mirrors :404-419. */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-base font-bold text-text-primary">{REPLICA.symbol}</span>
          <span className="text-xs font-medium text-text-secondary">{REPLICA.strategy}</span>
          <span className="rounded px-1.5 py-0.5 text-[9px] font-bold" style={{ background: '#334155', color: '#94A3B8' }}>{REPLICA.direction}</span>
          <span className="rounded px-1.5 py-0.5 text-[9px] font-bold text-white" style={{ background: '#7C3AED' }}>Graded</span>
          <span className="rounded px-2 py-0.5 text-sm font-black" style={{ background: '#2563EB', color: '#EFF6FF' }}>{REPLICA.actual.grade}</span>
        </div>
        {/* Legs line — mirrors :421-429. */}
        <div className="mt-1 flex flex-wrap gap-3 font-mono text-[11px] text-text-muted">
          {REPLICA.legs.map((leg) => (
            <span key={`${leg.side}-${leg.type}-${leg.strike}`}>
              <span className={leg.side === 'SELL' ? 'text-brand-red' : 'text-brand-green'}>{leg.side}</span>
              {' '}{leg.type} ${leg.strike} @ ${leg.price.toFixed(2)}
            </span>
          ))}
        </div>
        {/* Meta row — mirrors :432-438. */}
        <p className="mt-1 text-[10px] text-text-faint">{REPLICA.meta}</p>
        {/* Right-rail numbers as the expanded scorecard — mirrors :565-639. */}
        <div className="mt-3 grid grid-cols-2 gap-4 border-t border-border pt-3 text-xs">
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-text-muted">Predicted</p>
            <div className="space-y-1">
              <div className="flex justify-between"><span className="text-text-muted">Max Profit</span><span className="font-mono font-bold text-brand-green">{REPLICA.predicted.maxProfit}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Max Loss</span><span className="font-mono font-bold text-brand-red">{REPLICA.predicted.maxLoss}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Est. PoP</span><span className="font-mono font-bold">{REPLICA.predicted.pop}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">R:R</span><span className="font-mono font-bold">{REPLICA.predicted.rr}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Entry Price</span><span className="font-mono font-bold">{REPLICA.predicted.entry}</span></div>
            </div>
          </div>
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-text-muted">Actual</p>
            <div className="space-y-1">
              <div className="flex justify-between"><span className="text-text-muted">P&amp;L</span><span className="font-mono font-bold text-brand-green">{REPLICA.actual.pl}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Entry Price</span><span className="font-mono font-bold">{REPLICA.actual.entry}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Exit Price</span><span className="font-mono font-bold">{REPLICA.actual.exit}</span></div>
              <div className="mt-1 flex items-center justify-between"><span className="text-text-muted">Grade</span><span className="rounded px-3 py-1 font-black" style={{ background: '#2563EB', color: '#EFF6FF' }}>{REPLICA.actual.grade}</span></div>
            </div>
          </div>
        </div>
        {/* Thesis ✓/✗ — mirrors :641-661. */}
        <div className="mt-3 border-t border-border pt-3">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">Thesis — graded after the outcome</p>
          <div className="space-y-1 text-xs">
            {REPLICA.thesis.map((t) => (
              <div key={t.point} className="flex gap-2">
                <span className="w-4 shrink-0 text-center">
                  {t.result ? <span className="text-brand-green">✓</span> : <span className="text-brand-red">✗</span>}
                </span>
                <span className="text-text-secondary">{t.point}</span>
              </div>
            ))}
          </div>
        </div>
        {/* Regime — mirrors :663-669; the ENGINE's own declaration via the payload. */}
        <div className="mt-3 border-t border-border pt-3">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-text-muted">Regime</p>
          <p className="font-mono text-xs text-text-secondary">{SHOWCASE_DEEP_DIVE.scores.regime.breakdown.survival_brake.declaration}</p>
        </div>
        {/* Notes — mirrors :671-677. */}
        <div className="mt-3 border-t border-border pt-3">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-text-muted">Notes</p>
          <p className="text-xs text-text-secondary">{REPLICA.notes}</p>
        </div>
        <p className="mt-3 text-xs text-text-muted">
          Every card writes its claim down BEFORE the trade — max loss, probability, the thesis in
          plain language — then gets linked to the real closed position and graded against what
          happened. A wrong thesis point stays ✗ on the record forever.
        </p>
      </div>
    </div>
  );
}

// ── TRADE-SHOWCASE-SLIDES: the six product-piece slide panels ────────────────
// Each is a dark, self-contained "slide" panel (screengrab-ready). Values come
// ONLY from the existing payload (tradeShowcasePayload.ts), the real constants
// (DEFAULT_FILTERS / AVAILABLE_STRATEGIES, filter-types.ts), the graded
// REPLICA above, and the engine's own strings — nothing newly invented.

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
        <p>Universe <span className="text-white">S&amp;P 500 | Nasdaq 100</span> · Direction <span className="text-white">All/Bull/Bear/Ntrl</span> · Premium <span className="text-white">Sell/Buy/Both</span> · Risk <span className="text-white">Defined/Unlimited</span></p>
        <p>DTE <span className="text-white">{f.risk.minDte}–{f.risk.maxDte}</span> · Width <span className="text-white">${f.risk.minSpreadWidth}–${f.risk.maxSpreadWidth}</span></p>
        <p className="text-white/50">Liquidity gates: min OI <span className="text-white/80">{f.liquidity.minOpenInterest}</span> · max spread <span className="text-white/80">{f.liquidity.maxBidAskSpreadPct}%</span> · min volume <span className="text-white/80">500K</span> · min rating <span className="text-white/80">{f.liquidity.minLiquidityRating}★</span></p>
        <p className="text-white/50">Edge metrics: min PoP <span className="text-white/80">{f.edge.minPop}%</span> · min EV <span className="text-white/80">${f.edge.minEv}</span> · min EV/Risk <span className="text-white/80">{f.edge.minEvPerRisk}</span> · vol edge <span className="text-white/80">Any</span> · min IV rank <span className="text-white/80">{f.edge.minIvRank}</span> · sentiment <span className="text-white/80">{(f.edge.minSentiment / 100).toFixed(1)}</span></p>
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
      <div className="space-y-1.5">
        <p>
          <span className="font-bold text-white">GLOBEX</span> <span className="text-white/50">score</span> <span className="text-white">{globex.scores.composite.score}</span>{' '}
          <span className="text-white/70">{condor.strategy_name}</span>
          <br />
          <span className="text-brand-green">COLLECT ${((condor.net_credit ?? 0) * 100).toFixed(0)}</span>
          <span className="text-white/50"> · MAX L </span><span className="text-brand-red">${condor.max_loss}</span>
          <span className="text-white/50"> · POP </span><span className="text-white/90">{Math.round((condor.probability_of_profit ?? 0) * 100)}%</span>
          <span className="text-white/50"> · EV </span><span className="text-brand-green">+${condor.ev}</span>
        </p>
        <p>
          <span className="font-bold text-white">ACME</span> <span className="text-white/50">score</span> <span className="text-white">{acme.scores.composite.score}</span>{' '}
          <span className="text-white/50">No strategies — {SHOWCASE_REJECTIONS.ACME[0].gate}</span>
        </p>
        <p>
          <span className="font-bold text-white">INITECH</span> <span className="text-white/50">score</span> <span className="text-white">{initech.scores.composite.score}</span>{' '}
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
  return (
    <SlideShell title="Deep dive — GLOBEX" tag="Example data">
      <div className="space-y-1 text-white/70">
        <p className="text-white/50">WHY THIS TICKER</p>
        <p>Gates: <span className="text-brand-green">{g.vol_edge}</span> Vol Edge · <span className="text-brand-green">{g.quality}</span> Quality · <span className="text-brand-green">{g.regime}</span> Regime · <span className="text-brand-green">{g.info_edge}</span> Info Edge</p>
        <p>Composite <span className="text-white">{c.score}</span> — <span className="text-white/90">&ldquo;{c.convergence_gate}&rdquo;</span></p>
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
          <p className="text-white/70">Entry <span className="text-white">{REPLICA.predicted.entry}</span></p>
        </div>
        <div className="space-y-0.5">
          <p className="text-white/50">ACTUAL</p>
          <p className="text-white/70">P&amp;L <span className="font-bold text-brand-green">{REPLICA.actual.pl}</span></p>
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
