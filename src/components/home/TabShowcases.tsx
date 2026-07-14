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
import TabShowcaseTemplate from '@/components/home/TabShowcaseTemplate';
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
// BOOKS-SHOWCASE-BLOOMBERG: the Books slide deck sections — hero terminal,
// 8 causal slide panels, and the LIVE section. BOOKS-LIVE-PIPE-COMPLETE: the
// live section is the FULL 13-stage pipe in the dashboard's canonical order
// (BooksPipeline.tsx:180-181) — the real CockpitBar / JournalEntryEngine /
// BankReconciliation / PeriodClose mounted live on the example books, and a
// faithful static mirror for every stage whose real component self-fetches
// (per the BOOKS-FULL-INVENTORY mountability rulings).
import {
  UnlockBooksButton,
  BooksHeroTerminal,
  SourceAccountsPanel,
  CategorizePanel,
  JournalPanel,
  TrialBalancePanel,
  ReconcilePanel,
  StatementsPanel,
  ClosePanel,
  CpaExportPanel,
  LiveBooksSection,
  BOOKS_UNLOCK_CTA_ID,
} from '@/components/home/BooksShowcaseSections';
// TAX-SHOWCASE-BLOOMBERG: the Tax slide deck sections — hero terminal, 8
// causal slides (the TAX-FULL-INVENTORY flow: handoff gate → life events →
// documents → income → deductions → trading → 1040 review → file), and the
// LIVE section where the ONLY real mount is LifeEventsStep (the inventory's
// sole zero-fetch seam) and every other step is a labeled faithful mirror.
// All figures are the engine-executed 2025 set; disclaimers verbatim.
import {
  UnlockTaxButton,
  TaxHeroTerminal,
  HandoffGatePanel,
  LifeEventsPanel,
  DocumentsPanel,
  IncomePanel,
  DeductionsPanel,
  TradingPanel,
  Form1040Panel,
  FileReadyPanel,
  LiveTaxSection,
  TAX_UNLOCK_CTA_ID,
} from '@/components/home/TaxShowcaseSections';

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

// TRADE-SHOWCASE-FINAL: the 20-step data moved into PipelinePanelDark
// (TradeShowcaseSections.tsx PIPE_STEPS_FULL) — the standalone rail below the
// slides was redundant and is gone; the template's steps slot is now optional
// and Trade passes no steps.

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
      // TRADE-SHOWCASE-FINAL: the slides run in the REAL causal order — the
      // scanner drives the pipeline, the pipeline produces results, results
      // become cards, cards get graded, grades accumulate into the record,
      // and the brake guards all of it. Panel sides alternate 1-8.
      editorialRows={[
        {
          title: 'Eighteen real controls. Sixteen strategies.',
          copy:
            'It starts here: universe, direction, premium, defined risk, DTE and width, four liquidity gates, six edge metrics, sixteen strategy chips. Set your filters, hit Scan — and the pipeline below runs.',
          panel: <ScannerPanelDark />,
          panelSide: 'left',
        },
        {
          title: 'Hit Scan, and this runs.',
          copy:
            'A scan is not a spinner — it is 20 named steps you watch happen: what was fetched, what was excluded and why, what survived. Nothing happens off-screen.',
          panel: <PipelinePanelDark />,
          panelSide: 'right',
        },
        {
          title: 'Every ticker scored. Strategies only where the gates pass.',
          copy:
            'The pipe ends in a table that shows all of it: the composite, the built strategy with its price and odds — and, just as loudly, the tickers where no strategy survived and exactly which gate stopped them.',
          panel: <ResultsTablePanelDark />,
          panelSide: 'left',
        },
        {
          title: 'Why — and why not.',
          copy:
            'Each selected ticker gets a deep dive: the four gate scores, the convergence verdict in the engine’s own words, and the rejection reasons for everything that did not make it. No black box.',
          panel: <DeepDivePanelDark />,
          panelSide: 'right',
        },
        {
          title: 'The whole trade, written down.',
          copy:
            'Legs at live prices, what you collect, the most you can lose, the odds two ways, expected value, breakevens, the Greeks, and how big Kelly says to size it. A priced claim you can hold it to.',
          panel: <TradeCardPanelDark />,
          panelSide: 'left',
        },
        {
          title: 'Linked to the real position. Graded after the outcome.',
          copy:
            'Predicted sits next to actual, forever. Each thesis point is checked true or false after the trade closes — a wrong call stays ✗ on the record. That is the grade you keep.',
          panel: <GradedPanelDark />,
          panelSide: 'right',
        },
        {
          title: 'The grades accumulate. Denominators first.',
          copy:
            'Every graded card lands in a record that leads with what it excludes: unlinked positions are counted and declared, a win rate never appears without its n, and any trade that breaks its claimed max loss is named. Your record starts at zero.',
          panel: <RecordPanelDark />,
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
      // TRADE-SHOWCASE-FINAL: no steps rail — the full 20-step pipe lives in
      // the pipeline slide above (PipelinePanelDark).
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
// BOOKS-SHOWCASE-BLOOMBERG: the Books slide deck on the proven Trade template
// (dark hero -> 8 causal slides -> connective line -> LIVE mounted real
// components -> Unlock CTA), grounded in BOOKS-FULL-INVENTORY. The slides run
// the inventory's causal flow: link banks -> categorize (the queue that
// LEARNS, pure DB — no AI claim; the OpenAI insights route is dead UI per the
// inventory) -> commit = double entry -> trial balance -> reconcile ->
// statements -> period close -> CPA export. All example values are ONE
// coherent set of books (reconciliation math in BooksShowcaseSections.tsx).

export function BooksShowcase({ currentUserId, onRequireAuth }: ShowcaseProps) {
  return (
    <TabShowcaseTemplate
      darkHero={{
        eyebrow: 'Books — double-entry bookkeeping',
        headline: 'Every transaction becomes a journal entry. Every period must balance.',
        subcopy:
          'Your banks flow in through Plaid. Every transaction gets categorized by a queue that learns from your commits, then lands as real double-entry — through a trial balance that must balance, reconciliation against the bank, statements, and a period close that locks the month. Fail-loud at every step: the books error before they ever lie.',
        cta: <UnlockBooksButton currentUserId={currentUserId} onRequireAuth={onRequireAuth} />,
        panel: <BooksHeroTerminal />,
      }}
      editorialTitle="Go further with the Books tab"
      editorialRows={[
        {
          title: 'Link your banks. Assign every account.',
          copy:
            'Plaid brings the accounts in, every transaction flows automatically, and each account gets an entity — personal, business, or trading — so the books know whose money is whose.',
          panel: <SourceAccountsPanel />,
          panelSide: 'left',
        },
        {
          title: 'The queue that learns.',
          copy:
            'Every synced transaction arrives with a predicted account preselected. Correct it once and commit — the prediction table retrains on your own ledger. No AI, no black box: your books learning your business.',
          panel: <CategorizePanel />,
          panelSide: 'right',
        },
        {
          title: 'Commit is double-entry. Unbalanced refuses to save.',
          copy:
            'A commit writes the journal entry and its ledger lines in one stroke — debits equal credits, every time, or the engine throws instead of saving. That is the whole discipline, enforced by code.',
          panel: <JournalPanel />,
          panelSide: 'left',
        },
        {
          title: 'The trial balance must balance.',
          copy:
            'Every account, every total, debits against credits. The cockpit never silently claims balanced — the verdict is computed from the real trial balance or the page shows an error.',
          panel: <TrialBalancePanel />,
          panelSide: 'right',
        },
        {
          title: 'Reconcile against the bank\u2019s truth.',
          copy:
            'Statement balance on one side, your books on the other, cleared item by cleared item — down to a difference of exactly zero.',
          panel: <ReconcilePanel />,
          panelSide: 'left',
        },
        {
          title: 'Statements from real entries. Never re-typed.',
          copy:
            'The income statement and balance sheet are derived from committed journal entries — the same numbers as the cockpit, because they are the same books.',
          panel: <StatementsPanel />,
          panelSide: 'right',
        },
        {
          title: 'Closed means closed.',
          copy:
            'A closed period locks the month. Reopening one demands a typed reason that lands on the audit trail permanently — no quiet edits to history.',
          panel: <ClosePanel />,
          panelSide: 'left',
        },
        {
          title: 'Hand your CPA a package, not a shoebox.',
          copy:
            'Trial balance, statements, the full ledger and journal, closed periods — one export, already balanced, already reconciled.',
          panel: <CpaExportPanel />,
          panelSide: 'right',
        },
      ]}
      // BOOKS-LIVE-PIPE-COMPLETE: the connective line states EXACTLY what the
      // live section is — which pieces are the real components mounted live
      // and which stages are static mirrors. The claim may not exceed the
      // composition (4 real mounts: cockpit + JE + REC + CLOSE; 10 mirrored
      // stages; zero fetches; actions route to sign-up).
      preSteps={
        <p className="text-center text-sm text-text-secondary">
          Below the slides: the real pipe — all thirteen stages, in the dashboard&rsquo;s exact
          order. The cockpit bar and three of the stages (journal entries, bank reconciliation,
          period close) are the real components mounted live on the declared example books; the
          other ten stages fetch your data when you&rsquo;re signed in, so here they are faithful
          static mirrors of the real screens — each section is labeled real or mirror. Nothing on
          this page fetches; every action takes you to sign-up.
        </p>
      }
      sample={<LiveBooksSection currentUserId={currentUserId} onRequireAuth={onRequireAuth} />}
      cta={
        <div id={BOOKS_UNLOCK_CTA_ID}>
          <LockedTabCard
            tabKey="tab:books"
            label="Bookkeeping"
            valueLine="Your real accounts, synced and closed month after month — GAAP double-entry, not a spreadsheet."
            currentUserId={currentUserId}
            onRequireAuth={onRequireAuth}
          />
        </div>
      }
    />
  );
}

// ── TAX ──────────────────────────────────────────────────────────────────────
// TAX-SHOWCASE-BLOOMBERG: the Tax slide deck on the proven Trade/Books
// template (dark hero -> 8 causal slides -> connective line -> LIVE section
// -> Unlock CTA), grounded in TAX-FULL-INVENTORY. The slides run the
// inventory's causal flow: the closed-books handoff gate -> life events
// auto-detected -> documents (half already filled from the ledger) -> income
// source-traced -> Schedule C deductions with the entry-level drill-down ->
// Form 8949 with box reasoning + wash sales -> the 1040 line by line (DRAFT)
// -> the file-ready package. THE SCENARIO: Maria's COMPLETED 2025 year — the
// wizard's real default filing year — reconciling with the Books deck's
// running 2026 books. Every figure is the engine-executed set (derivation in
// TaxShowcaseSections.tsx); disclaimers verbatim per the inventory; the
// not-live list (1099-INT/DIV, QBI, Schedule E, in-app e-filing) is
// advertised nowhere. (This replaces the old 4-tile static panel — its
// $23,400 scenario is retained and extended, engine-true.)

export function TaxShowcase({ currentUserId, onRequireAuth }: ShowcaseProps) {
  return (
    <TabShowcaseTemplate
      darkHero={{
        eyebrow: 'Tax — from closed books to a filed return',
        headline: 'Your books are already clean. Your taxes are half-done before you start.',
        subcopy:
          'The filing wizard opens only once your books have closed periods — because tax figures are only trustworthy when the ledger under them is. Then income, deductions, and trading derive from your actual ledger, line by line, into a Form 1040 estimate you hand your CPA. Derived, not re-typed — and disclaimed at every step.',
        cta: <UnlockTaxButton currentUserId={currentUserId} onRequireAuth={onRequireAuth} />,
        panel: <TaxHeroTerminal />,
      }}
      editorialTitle="Go further with the Tax tab"
      editorialRows={[
        {
          title: 'Tax begins at completed books.',
          copy:
            'No closed period, no wizard — the numbers must be real first. The gate checks your closing periods, and if it can’t confirm them it stays locked rather than guess. Books closes INTO Tax; that’s the whole design.',
          panel: <HandoffGatePanel />,
          panelSide: 'left',
        },
        {
          title: 'It reads your books and knows your year.',
          copy:
            'A sole-prop entity checks "I ran a business." Investment activity checks "I bought or sold investments." The wizard pre-fills your year from data you already have — badged, never locked, yours to correct.',
          panel: <LifeEventsPanel />,
          panelSide: 'right',
        },
        {
          title: 'What others type in, your ledger already knows.',
          copy:
            'Schedule C and your broker activity arrive as already-captured cards, auto-populated from the ledger and your lot dispositions. Structured, box-labeled intake appears only for the documents your year actually needs.',
          panel: <DocumentsPanel />,
          panelSide: 'left',
        },
        {
          title: 'Every income line traces to its source.',
          copy:
            'Business income carries a badge naming the ledger it came from; capital gains name the positions and dispositions behind them. The cards roll up to AGI the same way Form 1040 does — because it is Form 1040.',
          panel: <IncomePanel />,
          panelSide: 'right',
        },
        {
          title: 'Every deduction drills to the entry behind it.',
          copy:
            'Tax line to account to individual ledger entries, with the sum checked on screen. The mapper assigns each expense account to its Schedule C line — and anything unmapped is flagged to Line 27a instead of silently placed. The SE tax preview shows the 15.3% math before you ever see the 1040.',
          panel: <DeductionsPanel />,
          panelSide: 'left',
        },
        {
          title: 'Every lot boxed. Every box explained.',
          copy:
            'Each disposition lands in its IRS Form 8949 box with the reasoning written down — and the wash-sale scan runs the 30-day window from IRS Pub 550, telling you exactly what loss is disallowed and what it might cost.',
          panel: <TradingPanel />,
          panelSide: 'right',
        },
        {
          title: 'The whole return, derived — not typed.',
          copy:
            'The 1040 line by line, with the bracket-by-bracket tax math open for inspection. And it’s watermarked DRAFT because the product means it: a licensed CPA or tax professional verifies before anything is filed.',
          panel: <Form1040Panel />,
          panelSide: 'left',
        },
        {
          title: 'Hand your CPA a package, not a shoebox.',
          copy:
            'Form 8949 CSV for import, Schedule C exports, a plain-text summary with every number, the DRAFT PDF set, and the ledger-verified CPA package — plus a TaxAct walkthrough filled with your figures and a ±$50 sanity check against the estimate.',
          panel: <FileReadyPanel />,
          panelSide: 'right',
        },
      ]}
      // TAX-SHOWCASE-BLOOMBERG: the connective line states EXACTLY what the
      // live section is. The claim may not exceed the composition (1 real
      // mount: LifeEventsStep — the inventory's sole zero-fetch seam; the
      // gate + shell chrome + steps 2-7 are labeled mirrors; zero fetches;
      // actions route to sign-up).
      preSteps={
        <p className="text-center text-sm text-text-secondary">
          Below the slides: the handoff gate and the wizard&rsquo;s seven steps, in order, on the
          declared 2025 example return. Signed in, every step fetches your real ledger — so on this
          page exactly one piece is the real component mounted live: the Life events step, the one
          step that fetches nothing. Everything else is a faithful static mirror of the real screen,
          labeled on its face. Nothing on this page fetches; every action takes you to sign-up.
        </p>
      }
      sample={<LiveTaxSection currentUserId={currentUserId} onRequireAuth={onRequireAuth} />}
      cta={
        <div id={TAX_UNLOCK_CTA_ID}>
          <LockedTabCard
            tabKey="tab:tax"
            label="Tax"
            valueLine="Your 1040 estimate and schedules, derived from your actual closed books — plus the CPA-ready export."
            currentUserId={currentUserId}
            onRequireAuth={onRequireAuth}
          />
        </div>
      }
    />
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
