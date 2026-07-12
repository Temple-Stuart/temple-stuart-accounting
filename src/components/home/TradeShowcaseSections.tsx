'use client';

/**
 * TRADE-SHOWCASE-FULL: the full-product sections of the logged-out Trade
 * showcase, built to the TRADE-FULL-INVENTORY rulings (audit-reports/
 * TRADE-FULL-INVENTORY.md, Phase 2 table):
 *
 *  • ScannerPanelDemo — DIRECT REUSE ruling: the REAL ScanFilterForm mounts
 *    presentationally (it is props+callbacks only, zero fetches —
 *    ScanFilterForm.tsx:10-12). Local state, DEFAULT_FILTERS; the Scan button
 *    NEVER fires a scan — logged-out it opens the signup modal, logged-in
 *    (but locked) it scrolls to the Unlock CTA.
 *  • TrackRecordMirror — STATIC MIRROR ruling: TradeRecord self-fetches
 *    (TradeRecord.tsx:47-50) so it cannot mount logged-out; this mirrors its
 *    exact section order (denominator-first counts, W–L–BE of decided, net
 *    P&L, the max-loss integrity line, A–F grades) with labeled example values.
 *  • GradedCardMirror — STATIC MIRROR ruling: TradeLabPanel self-fetches
 *    (TradeLabPanel.tsx:118-131); this mirrors the expanded scorecard layout
 *    (:565-679): legs, PREDICTED vs ACTUAL, actual P&L, grade badge, thesis
 *    ✓/✗ mechanic, regime line. Example values are internally coherent
 *    (credit 1.85 on a $5-wide spread → max profit $185 / max loss $315 /
 *    R:R 0.59; exit 0.43 → P&L +$142 ≤ max profit) and labeled EXAMPLE.
 *    The regime line is the ENGINE's own brake declaration (engine-real).
 *  • DeepDiveMirror — EXAMPLE-FED ruling: gate scores are ENGINE-REAL from
 *    the scoreAll fixture (tradeShowcaseRows.ts); FOR vs AGAINST is DERIVED
 *    from those engine gates (>50 = for, ≤50 = against — the engine's own
 *    above-50 convention); the strategy-rejection line mirrors the real
 *    rejection_reasons shape (ConvergenceIntelligence.tsx:71-76) as a labeled
 *    example; the NO-TRADE teaching quotes the engine's caption verbatim.
 *
 * SHOW discipline: ZERO fetches, zero paid calls, nothing personal, no
 * auth/gate logic. All example values labeled.
 */

import { useRef, useState } from 'react';
import ScanFilterForm from '@/components/trading/ScanFilterForm';
import type { ScannerFilters } from '@/lib/convergence/filter-types';
import { DEFAULT_FILTERS } from '@/lib/convergence/filter-types';
import { TRADE_SHOWCASE_ROWS, TRADE_SHOWCASE_BRAKE } from '@/components/home/tradeShowcaseRows';
import { ExampleTag } from '@/components/home/TabShowcaseTemplate';

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

// ── 3. THE SCANNER — the REAL filter panel, interactive ─────────────────────

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

// ── 4. TRACK RECORD — faithful static mirror of TradeRecord.tsx ─────────────

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

// ── 4b. THE TRADE CARD — faithful mirror of the scanner's generated card ────
// Mirrors the deep-dive "Trade Setup" card (ConvergenceIntelligence.tsx:729-764):
// legs, then COLLECT · MAX LOSS · POP (method) · EV · EV/RISK · R:R, then
// B/E · HV POP · THETA/day · VEGA/pt · KELLY — exactly the metrics the real
// card carries (plus DTE/Exp from the Trade Lab queued row, TradeLabPanel.tsx:432-435).
//
// EXAMPLE NUMBER RECONCILIATION (same ACME trade the graded card below shows,
// so the generate→link→grade story is one trade end to end):
//   COLLECT $185   = (4.20 − 2.35) × 100
//   MAX LOSS $315  = ($5 width − $1.85 credit) × 100
//   R:R 0.59       = 185 / 315
//   B/E $173.15    = 175 short strike − 1.85 credit
//   EV +$40        = 0.71×185 − 0.29×315 (two-outcome sanity math; the real
//                    card's EV comes from the engine's three-outcome model)
//   EV/RISK 0.127  = 40 / 315
//   KELLY 3.4%     = computed with the REAL quarter-Kelly formula the live
//                    card uses (CI:704-708): winRate = HV POP 0.68, ratio =
//                    185/315 → (0.68×0.587 − 0.32)/0.587 × 0.25 = 0.0338
//   POP 71% (N(d2)), HV POP 68%, THETA +$3.10/day, VEGA/pt −$9.00 are labeled
//   example model outputs (signs correct for a credit spread: +theta, −vega).

export function TradeCardMirror() {
  return (
    <div className="rounded-lg border border-border bg-white">
      <SectionTitle title="The trade card — every selected ticker becomes one: the full trade, priced and sized" tag="Example data" />
      <div className="p-4">
        {/* Header — mirrors the queued Trade Lab row meta (TradeLabPanel.tsx:404-435). */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-base font-bold text-text-primary">ACME</span>
          <span className="text-xs font-medium text-text-secondary">Bull Put Spread</span>
          <span className="rounded bg-brand-green/10 px-1.5 py-0.5 text-[9px] font-bold text-brand-green">BULLISH</span>
          <span className="rounded bg-brand-amber px-1.5 py-0.5 text-[9px] font-bold text-white">Queued</span>
          <span className="text-[10px] text-text-faint">21 DTE · Exp Jul 31</span>
        </div>
        {/* Trade Setup — mirrors CI:729-740. */}
        <div className="mt-3">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-text-muted">Trade Setup</p>
          <div className="font-mono text-xs">
            <div><span className="font-bold text-brand-red">SELL</span><span className="text-text-muted"> PUT </span><span className="text-text-primary">$175</span><span className="text-text-faint">  $4.20</span></div>
            <div><span className="font-bold text-brand-green">BUY </span><span className="text-text-muted"> PUT </span><span className="text-text-primary">$170</span><span className="text-text-faint">  $2.35</span></div>
          </div>
          {/* Metrics line 1 — mirrors CI:741-761. */}
          <p className="mt-2 text-xs">
            <span className="font-bold text-brand-green">COLLECT $185</span>
            <span className="text-text-muted"> · MAX LOSS </span><span className="text-brand-red">-$315</span>
            <span className="text-text-muted"> · POP </span><span className="text-text-primary">71%</span><span className="text-text-faint"> (N(d2))</span>
            <span className="text-text-muted"> · EV </span><span className="text-brand-green">+$40</span>
            <span className="text-text-muted"> · EV/RISK </span><span className="text-text-primary">0.127</span>
            <span className="text-text-muted"> · R:R </span><span className="text-text-primary">0.59</span>
          </p>
          {/* Metrics line 2 — mirrors CI:762-764. */}
          <p className="mt-0.5 text-xs text-text-muted">
            B/E <span className="text-text-primary">$173.15</span> · HV POP <span className="text-text-primary">68%</span> · THETA <span className="text-brand-green">+$3.10/day</span> · VEGA/pt <span className="text-brand-red">-$9.00</span> · KELLY <span className="text-text-primary">3.4%</span>
          </p>
        </div>
        <p className="mt-3 text-xs text-text-muted">
          The scanner writes the whole trade down: the exact legs at live prices, what you collect,
          the most you can lose, the odds two ways (option-implied and history-implied), the
          expected value, and how big Kelly says to size it. No vibes — a priced claim you can
          hold it to.
        </p>
      </div>
    </div>
  );
}

// ── 5. GRADED TRADE CARD — faithful mirror of the Trade Lab scorecard ───────

// Internally coherent example (labeled): a $5-wide bull put spread sold for a
// 1.85 credit → max profit $185, max loss $315, R:R 0.59; closed at 0.43 →
// actual P&L +$142 (inside the claimed max loss, hence the A).
const EXAMPLE_CARD = {
  symbol: 'ACME',
  strategy: 'Bull Put Spread',
  direction: 'BULLISH',
  status: 'Graded',
  legs: [
    { side: 'SELL', type: 'PUT', strike: 175, price: 4.2 },
    { side: 'BUY', type: 'PUT', strike: 170, price: 2.35 },
  ],
  predicted: { maxProfit: '$185', maxLoss: '-$315', pop: '71.0%', rr: '0.59', entry: '$1.85' },
  actual: { pl: '+$142', entry: '$1.85', exit: '$0.43', grade: 'A' },
  thesis: [
    { point: 'IV is rich vs realized — premium seller gets paid to wait', result: true },
    { point: 'Support holds above the short strike through expiration', result: true },
    { point: 'Earnings drift continues after the beat', result: false },
  ],
};

export function GradedCardMirror() {
  return (
    <div className="rounded-lg border border-border bg-white">
      <SectionTitle title="A graded trade card — predicted vs what actually happened" tag="Example data" />
      <div className="p-4">
        {/* Card header row — mirrors TradeLabPanel.tsx:401-419. */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-base font-bold text-text-primary">{EXAMPLE_CARD.symbol}</span>
          <span className="text-xs font-medium text-text-secondary">{EXAMPLE_CARD.strategy}</span>
          <span className="rounded bg-brand-green/10 px-1.5 py-0.5 text-[9px] font-bold text-brand-green">{EXAMPLE_CARD.direction}</span>
          <span className="rounded bg-brand-purple px-1.5 py-0.5 text-[9px] font-bold text-white">{EXAMPLE_CARD.status}</span>
          <span className="rounded bg-brand-green px-2 py-0.5 text-sm font-black text-white">{EXAMPLE_CARD.actual.grade}</span>
        </div>
        {/* Legs — mirrors :421-429. */}
        <div className="mt-1.5 flex flex-wrap gap-3 font-mono text-[11px] text-text-muted">
          {EXAMPLE_CARD.legs.map((leg) => (
            <span key={`${leg.side}-${leg.strike}`}>
              <span className={leg.side === 'SELL' ? 'text-brand-red' : 'text-brand-green'}>{leg.side}</span>
              {' '}{leg.type} ${leg.strike} @ ${leg.price.toFixed(2)}
            </span>
          ))}
        </div>
        {/* PREDICTED vs ACTUAL — mirrors the expanded scorecard :565-639. */}
        <div className="mt-3 grid grid-cols-2 gap-4 border-t border-border pt-3 text-xs">
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-text-muted">Predicted</p>
            <div className="space-y-1">
              <div className="flex justify-between"><span className="text-text-muted">Max Profit</span><span className="font-mono font-bold text-brand-green">{EXAMPLE_CARD.predicted.maxProfit}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Max Loss</span><span className="font-mono font-bold text-brand-red">{EXAMPLE_CARD.predicted.maxLoss}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Est. PoP</span><span className="font-mono font-bold">{EXAMPLE_CARD.predicted.pop}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">R:R</span><span className="font-mono font-bold">{EXAMPLE_CARD.predicted.rr}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Entry Price</span><span className="font-mono font-bold">{EXAMPLE_CARD.predicted.entry}</span></div>
            </div>
          </div>
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-text-muted">Actual</p>
            <div className="space-y-1">
              <div className="flex justify-between"><span className="text-text-muted">P&amp;L</span><span className="font-mono font-bold text-brand-green">{EXAMPLE_CARD.actual.pl}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Entry Price</span><span className="font-mono font-bold">{EXAMPLE_CARD.actual.entry}</span></div>
              <div className="flex justify-between"><span className="text-text-muted">Exit Price</span><span className="font-mono font-bold">{EXAMPLE_CARD.actual.exit}</span></div>
              <div className="mt-1 flex items-center justify-between"><span className="text-text-muted">Grade</span><span className="rounded bg-brand-green px-3 py-1 font-black text-white">{EXAMPLE_CARD.actual.grade}</span></div>
            </div>
          </div>
        </div>
        {/* Thesis with ✓/✗ grading — mirrors :641-661. */}
        <div className="mt-3 border-t border-border pt-3">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">Thesis — graded after the outcome</p>
          <div className="space-y-1 text-xs">
            {EXAMPLE_CARD.thesis.map((t) => (
              <div key={t.point} className="flex gap-2">
                <span className="w-4 shrink-0 text-center">
                  {t.result ? <span className="text-brand-green">✓</span> : <span className="text-brand-red">✗</span>}
                </span>
                <span className="text-text-secondary">{t.point}</span>
              </div>
            ))}
          </div>
        </div>
        {/* Regime — the ENGINE's own brake declaration (engine-real). */}
        <div className="mt-3 border-t border-border pt-3">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-text-muted">Regime</p>
          <p className="font-mono text-xs text-text-secondary">{TRADE_SHOWCASE_BRAKE.declaration}</p>
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

// ── 6. DEEP DIVE — engine-real gates + derived FOR/AGAINST ──────────────────

const GATE_META: { key: 'volEdge' | 'quality' | 'regime' | 'infoEdge'; name: string; asks: string }[] = [
  { key: 'volEdge', name: 'Vol Edge', asks: 'Are these options priced rich vs how the stock actually moves?' },
  { key: 'quality', name: 'Quality', asks: 'Is the company underneath actually healthy?' },
  { key: 'regime', name: 'Regime', asks: 'Does today’s macro backdrop favor this trade?' },
  { key: 'infoEdge', name: 'Info Edge', asks: 'Do the people with better information seem to know something?' },
];

export function DeepDiveMirror() {
  // Engine-real: the fixture row the engine sized largest is the deep-dive
  // subject; the NO-TRADE teaching row is whichever the engine sized at zero.
  const rows = [...TRADE_SHOWCASE_ROWS].sort((a, b) => b.positionSizePct - a.positionSizePct);
  const subject = rows[0];
  const noTrade = TRADE_SHOWCASE_ROWS.find((r) => r.positionSizePct === 0);
  // FOR vs AGAINST derived from the engine's own gates (>50 = for, else against
  // — the engine's above-50 convention, composite.ts:141-145).
  const gates = GATE_META.map((g) => ({ ...g, score: subject[g.key] }));
  const forGates = gates.filter((g) => g.score != null && g.score > 50);
  const againstGates = gates.filter((g) => g.score == null || g.score <= 50);

  return (
    <div className="rounded-lg border border-border bg-white">
      <SectionTitle title={`The deep dive — why ${subject.ticker}, and why NOT everything else`} tag="Example data" />
      <div className="space-y-4 p-4 text-xs">
        {/* WHY THIS TICKER — mirrors TickerChapter (CI:256-257); scores engine-real. */}
        <div>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-brand-purple">Why this ticker</p>
          <p className="text-sm text-text-secondary">
            {subject.ticker} led this example scan: the engine scored it{' '}
            <span className="font-mono">&ldquo;{subject.gate}&rdquo;</span> and suggested{' '}
            <span className="font-semibold text-text-primary">{subject.strategy}</span> at {subject.suggestedDte} DTE.
            Every number below was computed by the real scoring engine on the declared example inputs.
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-4">
            {gates.map((g) => (
              <div key={g.key} className="rounded border border-border-light bg-bg-row p-2">
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold text-text-primary">{g.name}</span>
                  <span className={`font-mono font-bold ${g.score != null && g.score > 50 ? 'text-brand-green' : 'text-text-muted'}`}>{g.score ?? '—'}</span>
                </div>
                <p className="mt-1 text-[11px] leading-snug text-text-muted">{g.asks}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-text-muted">
            Composite <span className="font-mono font-semibold text-text-primary">{subject.composite ?? '—'}</span> — above 50 means the gate found edge; missing data is excluded and declared, never scored as neutral.
          </p>
        </div>

        {/* FOR vs AGAINST — mirrors the card section (CI:465), derived from engine gates. */}
        <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-brand-green">For</p>
            <ul className="space-y-1 text-text-secondary">
              {forGates.map((g) => (
                <li key={g.key}>• {g.name} {g.score} — {g.asks.replace(/\?$/, '')}: the engine says yes.</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-brand-red">Against</p>
            <ul className="space-y-1 text-text-secondary">
              {againstGates.length > 0 ? (
                againstGates.map((g) => (
                  <li key={g.key}>• {g.name} {g.score ?? '—'} — at or below 50: no edge claimed here, and it drags the composite.</li>
                ))
              ) : (
                <li className="text-text-muted">• All four gates cleared 50 in this example.</li>
              )}
            </ul>
          </div>
        </div>

        {/* Why NOT other strategies — mirrors the rejection_reasons shape (CI:71-76). */}
        <div className="border-t border-border pt-3">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-text-muted">Why not the others</p>
          <p className="text-text-secondary">
            Strategies that fail a gate are rejected with the failing rule and numbers, e.g.{' '}
            <span className="font-mono">Short Strangle — rejected: unlimited risk vs your DEFINED_ONLY filter</span>{' '}
            (example). And when convergence itself fails, the engine says so
            {noTrade && (
              <>
                {' '}— in this example scan {noTrade.ticker} came out{' '}
                <span className="font-mono">&ldquo;{noTrade.gate}&rdquo;</span>
              </>
            )}
            . It will not manufacture a trade just to have something to sell.
          </p>
        </div>
      </div>
    </div>
  );
}
