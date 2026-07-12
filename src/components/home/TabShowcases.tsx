'use client';

/**
 * TAB-SHOW-AND-GATE: the SHOW surfaces for the four paid tabs (Trade, Books,
 * Tax, Compliance) + the shared per-tab locked CTA.
 *
 * SHOW discipline (mirrors OperationsPipelineShowroom): every panel renders
 * STATIC declared data — zero fetches, zero paid calls, nothing personal — and
 * is labeled EXAMPLE DATA so a demo can never read as a live number. The demo
 * entities are fictional (Maria's food truck — the same persona the Projects/
 * Content showroom uses — and fictional tickers).
 *
 * SHOWROOM-TRUTH-FIX: the Trade rows are no longer hand-typed — they are
 * COMPUTED by the real pure scorer on declared fictional inputs
 * (tradeShowcaseRows.ts), so scores, gate captions, position sizes, and the
 * brake state are engine output and cannot drift from the engine. Books uses
 * the real seeded chart-of-account codes; Tax figures are derived with the
 * real tax-engine formulas; Compliance shows the real audit actor enum value.
 *
 * LOCK discipline (mirrors Travel's LockedCategoryCard): "Subscribe to unlock"
 * POSTs /api/stripe/checkout-entitlement with this tab's key; the signature-
 * verified webhook writes the entitlement row. Logged-out → the sign-up modal
 * first. Fail-loud checkout errors. FALLBACK TRIPWIRE: nothing here unlocks
 * anything — the gate lives in ModuleLauncher via isTabLocked, and these
 * surfaces render ONLY for locked viewers.
 */

import { useState } from 'react';
import { Lock } from 'lucide-react';
// TRADE-SHOWCASE-BUILD: the reusable Plaid-style showcase template (hero band +
// real pipe rail + optional concept cards + sample/CTA slots) — tabs 2–9 reuse it.
import TabShowcaseTemplate, { type ShowcaseStep } from '@/components/home/TabShowcaseTemplate';
// TRADE-SHOWCASE-FULL: the full-product sections (real interactive filter
// panel + track-record / graded-card / deep-dive mirrors per the
// TRADE-FULL-INVENTORY rulings). Engine-real values come from the scoreAll
// fixture inside these sections.
import {
  ScannerPanelDemo,
  RealCockpitDemo,
  TrackRecordMirror,
  GradedCardMirror,
  UnlockTradeButton,
  HeroTerminalPanel,
  PipelinePanelDark,
  RecordPanelDark,
  ScannerPanelDark,
  ResultsTablePanelDark,
  DeepDivePanelDark,
  TradeCardPanelDark,
  GradedPanelDark,
  BrakePanelDark,
  TRADE_UNLOCK_CTA_ID,
} from '@/components/home/TradeShowcaseSections';

// ── shared chrome ────────────────────────────────────────────────────────────

function DemoTag() {
  return (
    <span className="inline-block rounded border border-brand-amber/40 bg-brand-amber/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-amber">
      Example data
    </span>
  );
}

function ShowcaseHeader({ title, line }: { title: string; line: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <h3 className="text-lg font-bold text-brand-purple">{title}</h3>
      <DemoTag />
      <p className="w-full text-sm text-text-muted">{line}</p>
    </div>
  );
}

/** The per-tab locked CTA — Travel's LockedCategoryCard pattern, keyed tab:X. */
export function LockedTabCard({
  tabKey,
  label,
  valueLine,
  currentUserId,
  onRequireAuth,
}: {
  tabKey: string;
  label: string;
  valueLine: string;
  currentUserId: string;
  onRequireAuth: () => void;
}) {
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  const onRequestUnlock = async () => {
    if (!currentUserId) {
      onRequireAuth(); // logged out → create an account first (checkout is auth-gated)
      return;
    }
    setError('');
    setStarting(true);
    try {
      const res = await fetch('/api/stripe/checkout-entitlement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: tabKey }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        throw new Error(data.error || 'Could not start checkout');
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start checkout');
      setStarting(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-brand-purple/15 bg-bg-row px-6 py-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-purple/10 text-brand-purple">
        <Lock className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <p className="text-base font-bold text-text-primary">{label} — built and running</p>
        <p className="text-sm text-text-muted">{valueLine}</p>
      </div>
      <button
        type="button"
        onClick={onRequestUnlock}
        disabled={starting}
        className="rounded-lg bg-brand-purple px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-purple/90 disabled:opacity-60"
      >
        {starting ? 'Starting checkout…' : `Subscribe to unlock ${label}`}
      </button>
      {error && <p className="text-sm text-brand-red">{error}</p>}
    </div>
  );
}

interface ShowcaseProps {
  currentUserId: string;
  onRequireAuth: () => void;
}

// ── TRADE ────────────────────────────────────────────────────────────────────
// TRADE-SHOWCASE-BUILD: Plaid-style showcase of the REAL pipe, composed on the
// reusable TabShowcaseTemplate (the pattern tabs 2–9 follow). Every element
// traces to the real product:
//   • the 20 steps are the pipeline's own step_a…step_t labels, in the same
//     A→T order the live pipeline-flow display presents them
//     (src/lib/convergence/pipeline.ts onProgress emissions;
//     ConvergenceIntelligence.tsx step panels);
//   • 475 = the real default S&P 500 universe size (pipeline.ts SP500 const);
//     40 = the real 2×-scan-size enrichment cut (pipeline.ts:521,626 at the
//     default scan size 20); 9 = the real top9 final selection (:1515-1523),
//     sector-capped max 2 (CI:4149). Counts that are merely illustrative
//     ("128 Finnhub calls", "2,208 Greeks events") say "(example)" inline and
//     mirror the live display's own summary formats (CI:2749, :3716);
//   • the four gate cards are drawn from the gates' real explainers
//     (ConvergenceIntelligence.tsx:874-877);
//   • the sample rows are computed by the real scoreAll() on declared
//     fictional inputs (tradeShowcaseRows.ts — SHOWROOM-TRUTH-FIX), with the
//     engine's convergence_gate caption verbatim (composite.ts:159-170).
// Static, zero fetches — no scan fires for a logged-out visitor.

const TRADE_PIPE_STEPS: ShowcaseStep[] = [
  { code: 'A', label: 'TT Scanner', summary: '475 symbols fetched (S&P 500 example run; Nasdaq 100 = 101)' },
  { code: 'B', label: 'Pre-Filter', summary: 'ranked by IV rank, IV–HV spread, liquidity' },
  { code: 'C', label: 'Hard Exclusions', summary: 'no premium (IV–HV ≤ 0) or illiquid → eliminated' },
  { code: 'D', label: 'Top-N Selection', summary: 'top 40 carried forward (scan size 20 × 2)' },
  { code: 'E', label: 'Hard Filters', summary: 'market cap >$2B, liquidity ≥2/5, IV present, earnings >7 days out, Reg SHO check' },
  { code: 'F', label: 'Peer Grouping', summary: 'Finnhub peers → industry → sector' },
  { code: 'G', label: 'Pre-Score', summary: '40 selected for full data enrichment' },
  { code: 'H', label: 'Macro & Regime Data', summary: 'FRED: VIX, VIX3M, VVIX, yield curve, credit spreads' },
  { code: 'I', label: 'Data Enrichment', summary: '128 Finnhub calls (example)' },
  { code: 'J', label: 'Candle Data & Cross-Asset Correlations' },
  { code: 'K', label: '4-Gate Scoring', summary: 'vol edge · quality · regime · info edge' },
  { code: 'L', label: 'Re-Score With Technicals' },
  { code: 'M', label: 'Final Selection', summary: '9 selected, sector-capped (max 2 per sector)' },
  { code: 'N', label: 'Chain Fetch', summary: 'live TastyTrade option chains' },
  { code: 'O', label: 'Live Greeks Subscription', summary: '2,208 Greeks events across 9 symbols (example)' },
  { code: 'P', label: 'Strategy Scoring', summary: 'credit spreads, condors, calendars — built and scored per ticker' },
  { code: 'Q', label: 'Live Options Flow & GEX' },
  { code: 'R', label: 'Re-Score With Live Data', summary: 'gates re-checked on live numbers' },
  { code: 'S', label: 'Trade Cards', summary: 'sized suggestions — or NO TRADE' },
  { code: 'T', label: 'Save & Return', summary: 'snapshot saved for the self-graded record' },
];

export function TradeShowcase({ currentUserId, onRequireAuth }: ShowcaseProps) {
  return (
    <TabShowcaseTemplate
      // TRADE-SHOWCASE-BLOOMBERG: dark cinematic hero replaces the purple band;
      // the terminal panel renders REAL payload rows (condor / no-strategies /
      // engine NO-TRADE caption / funnel).
      darkHero={{
        eyebrow: 'Trade — the scanner',
        headline: 'An entire index in full focus. One decision out.',
        subcopy:
          'Pick your universe — the S&P 500 (475 stocks) or the Nasdaq 100 (101), with more indexes already wired into the engine. Live prices from TastyTrade. Company numbers from Finnhub. Macro from FRED. Filings from SEC EDGAR. The mood from Grok. Twenty steps and four gates later you get a sized suggestion — or an honest NO TRADE.',
        cta: <UnlockTradeButton currentUserId={currentUserId} onRequireAuth={onRequireAuth} />,
        panel: <HeroTerminalPanel />,
      }}
      editorialTitle="Go further with the Trade tab"
      // TRADE-SHOWCASE-SLIDES: the full top-down slide sequence — one
      // self-contained dark panel per product piece, sides alternating,
      // every value from the payload / real constants / the graded replica.
      editorialRows={[
        {
          title: 'Watch every step run.',
          copy:
            'A scan is not a spinner — it is 20 named steps you watch happen: what was fetched, what was excluded and why, what survived. Nothing happens off-screen, and the full rail below shows all of it.',
          panel: <PipelinePanelDark />,
          panelSide: 'left',
        },
        {
          title: 'A track record that grades itself.',
          copy:
            'Denominators first: unlinked positions are counted and declared, a win rate never appears without its n, and any trade that breaks its claimed max loss is named. Example numbers — your record starts at zero and only ever shows what actually happened.',
          panel: <RecordPanelDark />,
          panelSide: 'right',
        },
        {
          title: 'Eighteen real controls. Sixteen strategies.',
          copy:
            'Universe, direction, premium, defined risk, DTE and width, four liquidity gates, six edge metrics, sixteen strategy chips — the live panel is below. Set your filters, hit Scan.',
          panel: <ScannerPanelDark />,
          panelSide: 'left',
        },
        {
          title: 'Every ticker scored. Strategies only where the gates pass.',
          copy:
            'The table shows all of it: the composite, the built strategy with its price and odds — and, just as loudly, the tickers where no strategy survived and exactly which gate stopped them.',
          panel: <ResultsTablePanelDark />,
          panelSide: 'right',
        },
        {
          title: 'Why — and why not.',
          copy:
            'Each selected ticker gets a deep dive: the four gate scores, the convergence verdict in the engine’s own words, and the rejection reasons for everything that did not make it. No black box.',
          panel: <DeepDivePanelDark />,
          panelSide: 'left',
        },
        {
          title: 'The whole trade, written down.',
          copy:
            'Legs at live prices, what you collect, the most you can lose, the odds two ways, expected value, breakevens, the Greeks, and how big Kelly says to size it. A priced claim you can hold it to.',
          panel: <TradeCardPanelDark />,
          panelSide: 'right',
        },
        {
          title: 'Linked to the real position. Graded after the outcome.',
          copy:
            'Predicted sits next to actual, forever. Each thesis point is checked true or false after the trade closes — a wrong call stays ✗ on the record. That is the grade you keep.',
          panel: <GradedPanelDark />,
          panelSide: 'left',
        },
        {
          title: 'The brake that says no for you.',
          copy:
            'Backwardation or a VVIX spike cuts short-vol suggestions automatically — and if the brake’s inputs are missing, it reads UNVERIFIED and acts as if it were on. It never assumes safety.',
          panel: <BrakePanelDark />,
          panelSide: 'right',
        },
      ]}
      // TRADE-SHOWCASE-ORDER: the scanner renders BEFORE the pipe (preSteps) —
      // in the real product you set filters and hit Scan, THEN the pipe runs.
      // TRADE-SHOWCASE-SLIDES: one connective line bridges the slides above
      // into the live cockpit below.
      preSteps={
        <>
          <p className="text-center text-sm text-text-secondary">
            Everything you just saw in the slides is live below — the real components, rendered
            from the same declared example scan. Try the controls.
          </p>
          <ScannerPanelDemo currentUserId={currentUserId} onRequireAuth={onRequireAuth} />
        </>
      }
      stepsTitle="Hit Scan, and this runs — 20 steps, A to T"
      stepsTag="Example scan — real steps, sample counts"
      steps={TRADE_PIPE_STEPS}
      stepsFooter={
        <p className="text-xs text-text-muted">
          Example funnel (S&P 500 run): <span className="font-mono text-text-primary">475 → 52 → 40 → 20 → 9</span>{' '}
          (universe → hard filters → enriched → scored → selected) · 128 Finnhub calls · ~94s runtime.
          475 is the S&P 500 list size; 40, 20 and 9 are the real defaults; the rest are sample counts.
        </p>
      }
      sample={
        <>
          <TrackRecordMirror />
          {/* TRADE-SHOWCASE-REAL-COMPONENTS: the REAL cockpit — the live
              ScannerResultsTable + TickerChapter deep dive mounted on the
              declared example payload. The generate→link→grade story is one
              GLOBEX Iron Condor end to end: the cockpit generates it, the
              replica below shows it linked and graded. */}
          <RealCockpitDemo currentUserId={currentUserId} onRequireAuth={onRequireAuth} />
          <p className="text-sm text-text-secondary">
            Queue that card, link it to the real position when you take the trade — and after it
            closes, it grades itself against what actually happened:
          </p>
          <GradedCardMirror />
        </>
      }
      cta={
        <div id={TRADE_UNLOCK_CTA_ID}>
          <LockedTabCard
            tabKey="tab:trade"
            label="Trading"
            valueLine="Run live scans on real market data, with the reconcile queue and the self-graded record."
            currentUserId={currentUserId}
            onRequireAuth={onRequireAuth}
          />
        </div>
      }
    />
  );
}

// ── BOOKS ────────────────────────────────────────────────────────────────────

// SHOWROOM-TRUTH-FIX: account codes/names below are the REAL seeded sole-prop
// chart of accounts (src/lib/seed-coa-templates.ts:89-121 — 1010 Business
// Checking, 4100 Product Revenue, 6120 Supplies, 6010 Car & Truck Expenses,
// 2020 Credit Card (Business)), not invented codes. Dates/memos/amounts are
// the labeled fictional example.
const DEMO_JOURNAL = [
  { d: 'Jun 03', memo: 'Coffee beans — Riverside Roasters', dr: '6120 Supplies', cr: '1010 Business Checking', amt: '$84.12' },
  { d: 'Jun 05', memo: 'Farmers market sales', dr: '1010 Business Checking', cr: '4100 Product Revenue', amt: '$412.00' },
  { d: 'Jun 09', memo: 'Truck fuel', dr: '6010 Car & Truck Expenses', cr: '2020 Credit Card (Business)', amt: '$61.35' },
];

export function BooksShowcase({ currentUserId, onRequireAuth }: ShowcaseProps) {
  return (
    <div className="space-y-5">
      <ShowcaseHeader
        title="Double-entry books, from bank feed to closed period"
        line="Connect your bank through Plaid and every transaction flows in, gets categorized, and lands as a real journal entry — through to a trial balance that must balance, statements, and a period close. Below: Maria's food-truck books, as an example."
      />
      {/* SHOWROOM-TRUTH-FIX: per-panel EXAMPLE label — a screenshot of just the
          tiles (or just the table below) still declares itself illustrative.
          "BALANCED ✓" is the real product string (CPAExport.tsx). */}
      <div className="rounded-lg border border-border-light bg-bg-row p-3 space-y-3">
        <DemoTag />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[['Assets', '$12,400'], ['Liabilities', '$3,100'], ['Equity', '$9,300'], ['Trial balance', 'BALANCED ✓']].map(([k, v]) => (
            <div key={k} className="rounded-lg border border-border bg-white p-3">
              <p className="text-[10px] uppercase tracking-wider text-text-muted">{k}</p>
              <p className={`text-base font-bold ${v === 'BALANCED ✓' ? 'text-brand-green' : 'text-text-primary'}`}>{v}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border bg-white">
        <div className="px-3 pt-3">
          <DemoTag />
        </div>
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-text-muted">
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Memo</th>
              <th className="px-3 py-2 font-medium">Debit</th>
              <th className="px-3 py-2 font-medium">Credit</th>
              <th className="px-3 py-2 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {DEMO_JOURNAL.map((j) => (
              <tr key={j.memo} className="border-b border-border-light last:border-0">
                <td className="px-3 py-2 text-text-muted">{j.d}</td>
                <td className="px-3 py-2 text-text-primary">{j.memo}</td>
                <td className="px-3 py-2 font-mono text-xs">{j.dr}</td>
                <td className="px-3 py-2 font-mono text-xs">{j.cr}</td>
                <td className="px-3 py-2 text-right">{j.amt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-text-secondary">
        The full pipe: import → categorize → journal → ledger → trial balance → reconcile → adjusting entries → statements → period close → year-end → CPA export.
      </p>
      <LockedTabCard
        tabKey="tab:books"
        label="Bookkeeping"
        valueLine="Your real accounts, synced and closed month after month — GAAP double-entry, not a spreadsheet."
        currentUserId={currentUserId}
        onRequireAuth={onRequireAuth}
      />
    </div>
  );
}

// ── TAX ──────────────────────────────────────────────────────────────────────

export function TaxShowcase({ currentUserId, onRequireAuth }: ShowcaseProps) {
  return (
    <div className="space-y-5">
      <ShowcaseHeader
        title="Taxes that start from closed books"
        line="Because the books are already clean, the tax estimate is derived — not re-typed. Below: an example year for Maria's food truck."
      />
      {/* SHOWROOM-TRUTH-FIX: every dollar figure below is computed with the
          REAL tax-engine formulas (api/tax-estimate/route.ts:200-221) for the
          DECLARED example inputs: single filer, standard deduction ($15,000,
          route.ts:24), self-employed, Schedule C net profit $23,400, no other
          income. SE tax = round(2,340,000¢ × 0.9235) × 0.153 = 330,631¢ →
          $3,306. Federal income tax: AGI = 2,340,000 − 165,316 (½ SE) =
          2,174,684¢; taxable = 674,684¢ after the standard deduction; all in
          the 10% bracket (route.ts:10) → 67,468¢ → $675. The old "$5,120" was
          invented and matched no formula — replaced with the engine's number.
          "12 exported" is a labeled example count (no formula exists for it). */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Schedule C net profit', '$23,400'],
          ['Self-employment tax', '$3,306'],
          ['Federal income tax', '$675'],
          ['Form 8949 lots', '12 exported'],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-border bg-white p-3">
            <p className="text-[10px] uppercase tracking-wider text-text-muted">{k}</p>
            <p className="text-base font-bold text-text-primary">{v}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-text-secondary">
        The pipe: closed period → account-to-tax-line mapping → Form 1040 estimate with Schedule C/D/SE → wash-sale detection → Form 8949 + CPA export package (PDF).
      </p>
      <p className="text-xs text-text-faint">
        Estimates for informational purposes only — verified by a qualified tax professional before filing, always. Example numbers above, for a declared scenario (single filer, standard deduction, self-employed) — the SE and federal figures are computed with the same formulas the tax engine runs.
      </p>
      <LockedTabCard
        tabKey="tab:tax"
        label="Tax"
        valueLine="Your 1040 estimate and schedules, derived from your actual closed books — plus the CPA-ready export."
        currentUserId={currentUserId}
        onRequireAuth={onRequireAuth}
      />
    </div>
  );
}

// ── COMPLIANCE ───────────────────────────────────────────────────────────────

export function ComplianceShowcase({ currentUserId, onRequireAuth }: ShowcaseProps) {
  return (
    <div className="space-y-5">
      <ShowcaseHeader
        title="A regulatory workbench with receipts"
        line="Real regulation text (eCFR, US Code, Federal Register, IRS) ingested and searchable, citations verified and pinned, and every action in a tamper-evident audit chain. Below: what a verified citation and an audit row look like."
      />
      <div className="rounded-lg border border-border bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-semibold text-text-primary">26 U.S.C. §162(a)</span>
          <span className="rounded-full bg-brand-green/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-brand-green">Verified</span>
        </div>
        <p className="mt-1 text-sm text-text-secondary">
          &quot;There shall be allowed as a deduction all the ordinary and necessary expenses paid or incurred during the taxable year in carrying on any trade or business…&quot;
        </p>
        <p className="mt-2 text-[11px] text-text-muted">Pinned to the ingested US Code corpus · re-verified on ingest updates (example row)</p>
      </div>
      <div className="rounded-lg border border-border bg-white p-4">
        {/* SHOWROOM-TRUTH-FIX: actor shows the REAL AuditActorType enum value
            (schema.prisma: human_user | ai_agent | system_automation |
            external_integration) — the Stripe webhook writes
            external_integration; "stripe-webhook" was not a storable value. */}
        <p className="font-mono text-xs text-text-secondary">
          audit_log #4812 · permission_granted · hash-chained to #4811 · actor: external_integration (Stripe webhook) (example row)
        </p>
        <p className="mt-1 text-[11px] text-text-muted">Every grant, edit, and attestation lands in a hash-linked chain — tampering breaks the chain visibly.</p>
      </div>
      <p className="text-xs text-text-secondary">
        Sections A–J: identity → registry → citations → discovery → missions → tasks → attestations → evidence → audit chain → SOC 2 view.
      </p>
      <LockedTabCard
        tabKey="tab:compliance"
        label="Compliance"
        valueLine="The live workbench: corpus search, citation verification, missions, and the audit registry."
        currentUserId={currentUserId}
        onRequireAuth={onRequireAuth}
      />
    </div>
  );
}
