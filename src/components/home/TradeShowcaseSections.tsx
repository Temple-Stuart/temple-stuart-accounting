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
import { DEFAULT_FILTERS } from '@/lib/convergence/filter-types';
import { ExampleTag } from '@/components/home/TabShowcaseTemplate';
import {
  SHOWCASE_RESULTS,
  SHOWCASE_REJECTIONS,
  SHOWCASE_PROGRESS,
  SHOWCASE_DEEP_DIVE,
} from '@/components/home/tradeShowcasePayload';

/** id the Scan button scrolls to for logged-in-but-locked viewers. */
export const TRADE_UNLOCK_CTA_ID = 'trade-unlock-cta';

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
    <div className="rounded-lg border border-border bg-white">
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
      <div className="rounded-lg border border-border bg-white">
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
      <div className="rounded-lg border border-border bg-white">
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
    <div className="rounded-lg border border-border bg-white">
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
