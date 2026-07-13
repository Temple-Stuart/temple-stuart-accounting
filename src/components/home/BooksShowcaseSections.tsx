'use client';

/**
 * BOOKS-SHOWCASE-BLOOMBERG: the logged-out Books showcase sections — the
 * Bloomberg slide deck on the proven Trade template, grounded in
 * BOOKS-FULL-INVENTORY (audit-reports/BOOKS-FULL-INVENTORY.md).
 *
 * MOUNTABILITY RULINGS APPLIED (inventory Phase 2):
 *  • BookkeepingCockpitBar — DIRECT REUSE: pure props, zero fetches
 *    (BookkeepingCockpitBar.tsx:3-17); mounted with the example totals below;
 *    Sync / + Account route to signup/CTA.
 *  • JournalEntryEngine / BankReconciliation / PeriodClose — EXAMPLE-FED:
 *    zero fetches each (typed props seams at JournalEntryEngine.tsx:46-51,
 *    BankReconciliation.tsx:44-50, PeriodClose.tsx:27-35); mounted on the
 *    example books; every action callback routes to signup/CTA.
 *  • SpendingTab — RULED OUT of the live section: its 4 fetches are internal
 *    ACTION handlers (commit :1185/:1218, uncommit :1246, create-COA :366),
 *    not routable props — a click would fire a real POST. The categorize
 *    mechanic is shown in slide 2 as a faithful static panel instead.
 *  • Everything that fetches on mount (ledger, TB, statements, wash sales,
 *    year-end, positions, CPA export) appears as slide panels only.
 *
 * ONE COHERENT SET OF EXAMPLE BOOKS (a CPA must find zero errors):
 *   Balance sheet   ASSETS $12,400 = LIABILITIES $3,100 + EQUITY $9,300 ✓
 *     assets:      1010 Business Checking 9,400 + 1020 Business Savings 2,500
 *                  + 1400 Equipment 500                     = 12,400
 *     liabilities: 2020 Credit Card (Business)              =  3,100
 *     equity:      3000 Owner's Equity 6,000 + net income 3,300 = 9,300
 *   P&L             4100 Product Revenue 8,400 − (6120 Supplies 1,800 +
 *                   6010 Car & Truck 900 + 6100 Rent 2,400 = 5,100)
 *                   = NET INCOME $3,300 ✓ (feeds equity above)
 *   Trial balance   debits 9,400 + 2,500 + 500 + 1,800 + 900 + 2,400 = 17,500
 *                   credits 3,100 + 6,000 + 8,400               = 17,500 ✓
 *   Journal rows    each entry debits = credits exactly (412.00/412.00,
 *                   84.12/84.12, 61.35/61.35)
 *   Reconciliation  statement 9,400.00 = book 9,400.00 → difference $0.00 ✓
 *   All account codes/names are the REAL seeded sole-prop chart
 *   (src/lib/seed-coa-templates.ts:89-121). "BALANCED ✓" (CPAExport.tsx:143)
 *   and "✓ RECONCILED" (BankReconciliation.tsx:273) are the real product
 *   strings. NO AI-insights claim anywhere — the categorizer is pure DB that
 *   learns from commits (commit-to-ledger/route.ts:123-195); the OpenAI
 *   insights route is dead UI (inventory finding) and is not advertised.
 *
 * SHOW discipline: ZERO fetches, zero paid calls, nothing personal, no
 * auth/gate logic. All example values labeled.
 */

import BookkeepingCockpitBar from '@/components/bookkeeping/BookkeepingCockpitBar';
import JournalEntryEngine from '@/components/dashboard/JournalEntryEngine';
import BankReconciliation from '@/components/dashboard/BankReconciliation';
import PeriodClose from '@/components/dashboard/PeriodClose';
import { ExampleTag } from '@/components/home/TabShowcaseTemplate';

/** id the actions scroll to for logged-in-but-locked viewers. */
export const BOOKS_UNLOCK_CTA_ID = 'books-unlock-cta';

function routeAway(currentUserId: string, onRequireAuth: () => void) {
  return () => {
    if (!currentUserId) {
      onRequireAuth();
    } else {
      document.getElementById(BOOKS_UNLOCK_CTA_ID)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };
}

// ── the example books (see reconciliation math in the header comment) ────────

const EX = {
  assets: 12_400,
  liabilities: 3_100,
  equity: 9_300,
  contributed: 6_000,
  netIncome: 3_300,
  revenue: 8_400,
  expenses: { supplies: 1_800, carTruck: 900, rent: 2_400, total: 5_100 },
  checking: 9_400,
  savings: 2_500,
  equipment: 500,
};

const COA = [
  { id: 'coa-1010', code: '1010', name: 'Business Checking', accountType: 'asset', balanceType: 'D' },
  { id: 'coa-1020', code: '1020', name: 'Business Savings', accountType: 'asset', balanceType: 'D' },
  { id: 'coa-1400', code: '1400', name: 'Equipment', accountType: 'asset', balanceType: 'D' },
  { id: 'coa-2020', code: '2020', name: 'Credit Card (Business)', accountType: 'liability', balanceType: 'C' },
  { id: 'coa-3000', code: '3000', name: "Owner's Equity", accountType: 'equity', balanceType: 'C' },
  { id: 'coa-4100', code: '4100', name: 'Product Revenue', accountType: 'revenue', balanceType: 'C' },
  { id: 'coa-6010', code: '6010', name: 'Car & Truck Expenses', accountType: 'expense', balanceType: 'D' },
  { id: 'coa-6100', code: '6100', name: 'Rent (Business)', accountType: 'expense', balanceType: 'D' },
  { id: 'coa-6120', code: '6120', name: 'Supplies', accountType: 'expense', balanceType: 'D' },
];

const coaAcct = (code: string) => {
  const c = COA.find((x) => x.code === code)!;
  return { code: c.code, name: c.name, account_type: c.accountType };
};

// Balanced example journal entries (cents) — debits = credits in every entry.
const EX_JOURNAL = [
  {
    id: 'je-1', date: '2026-06-05', description: 'Farmers market sales',
    is_reversal: false, reverses_journal_id: null, reversed_by_transaction_id: null,
    reversal_date: null, account_code: '1010', amount: 41_200, strategy: null,
    trade_num: null, created_at: '2026-06-05T18:12:00Z', posted_at: '2026-06-05T18:12:00Z',
    ledger_entries: [
      { id: 'le-1a', account_id: 'coa-1010', amount: 41_200, entry_type: 'D', account: coaAcct('1010') },
      { id: 'le-1b', account_id: 'coa-4100', amount: 41_200, entry_type: 'C', account: coaAcct('4100') },
    ],
  },
  {
    id: 'je-2', date: '2026-06-03', description: 'Coffee beans — Riverside Roasters',
    is_reversal: false, reverses_journal_id: null, reversed_by_transaction_id: null,
    reversal_date: null, account_code: '6120', amount: 8_412, strategy: null,
    trade_num: null, created_at: '2026-06-03T14:03:00Z', posted_at: '2026-06-03T14:03:00Z',
    ledger_entries: [
      { id: 'le-2a', account_id: 'coa-6120', amount: 8_412, entry_type: 'D', account: coaAcct('6120') },
      { id: 'le-2b', account_id: 'coa-1010', amount: 8_412, entry_type: 'C', account: coaAcct('1010') },
    ],
  },
  {
    id: 'je-3', date: '2026-06-09', description: 'Truck fuel',
    is_reversal: false, reverses_journal_id: null, reversed_by_transaction_id: null,
    reversal_date: null, account_code: '6010', amount: 6_135, strategy: null,
    trade_num: null, created_at: '2026-06-09T09:41:00Z', posted_at: '2026-06-09T09:41:00Z',
    ledger_entries: [
      { id: 'le-3a', account_id: 'coa-6010', amount: 6_135, entry_type: 'D', account: coaAcct('6010') },
      { id: 'le-3b', account_id: 'coa-2020', amount: 6_135, entry_type: 'C', account: coaAcct('2020') },
    ],
  },
];

const EX_ACCOUNTS = [
  { id: 'acc-1', name: 'Business Checking', mask: '4821', type: 'checking', balance: EX.checking, institutionName: 'First Harbor Bank' },
  { id: 'acc-2', name: 'Business Savings', mask: '4839', type: 'savings', balance: EX.savings, institutionName: 'First Harbor Bank' },
  { id: 'acc-3', name: 'Business Card', mask: '7702', type: 'credit', balance: EX.liabilities, institutionName: 'Meridian Card Services' },
];

const EX_REC_TXNS = [
  { id: 't-1', date: '2026-06-05', name: 'Farmers market sales', amount: 412, accountCode: '4100' },
  { id: 't-2', date: '2026-06-03', name: 'Coffee beans — Riverside Roasters', amount: -84.12, accountCode: '6120' },
  { id: 't-3', date: '2026-06-09', name: 'Truck fuel', amount: -61.35, accountCode: '6010' },
];

const EX_RECONCILIATION = [
  {
    id: 'rec-1', accountId: 'acc-1', periodEnd: '2026-06-30',
    statementBalance: EX.checking, bookBalance: EX.checking,
    adjustedBankBalance: EX.checking, adjustedBookBalance: EX.checking,
    difference: 0, status: 'completed',
    items: [
      { id: 'ri-1', type: 'deposit_in_transit', description: 'Farmers market sales', amount: '412.00', cleared: true },
      { id: 'ri-2', type: 'outstanding_check', description: 'Coffee beans — Riverside Roasters', amount: '84.12', cleared: true },
    ],
    account: EX_ACCOUNTS[0],
  },
];

// Jan–Jun 2026 closed; Jul open — matches the cockpit's "July 2026 · open".
const EX_PERIOD_CLOSES = Array.from({ length: 6 }, (_, i) => ({
  id: `pc-${i + 1}`, year: 2026, month: i + 1, status: 'closed',
  closedAt: `2026-0${i + 2 > 7 ? i + 2 : i + 2}-02T09:00:00Z`.replace('010', '10'),
  closedBy: 'you',
}));

// ── dark slide shell (panel token family, same look as the Trade deck) ───────

function DarkSlide({ title, tag = 'Example data', children }: { title: string; tag?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-panel-border bg-panel p-4 font-mono text-[11px] leading-relaxed">
      <div className="flex items-center justify-between gap-2 border-b border-panel-border pb-2">
        <span className="font-bold uppercase tracking-wider text-white/60">{title}</span>
        <ExampleTag text={tag} />
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

const usd = (n: number) => '$' + n.toLocaleString('en-US');

// ── HERO ─────────────────────────────────────────────────────────────────────

export function UnlockBooksButton({ currentUserId, onRequireAuth }: { currentUserId: string; onRequireAuth: () => void }) {
  return (
    <button
      type="button"
      onClick={routeAway(currentUserId, onRequireAuth)}
      className="rounded-lg bg-brand-purple px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-purple-hover"
    >
      Unlock Books
    </button>
  );
}

export function BooksHeroTerminal() {
  return (
    <div className="rounded-lg border border-panel-border bg-panel/90 p-4 font-mono text-[11px] leading-relaxed shadow-2xl">
      <div className="flex items-center justify-between border-b border-panel-border pb-2">
        <span className="font-bold uppercase tracking-wider text-white/60">Books · June 2026</span>
        <ExampleTag text="Example books" />
      </div>
      <p className="mt-2">
        <span className="text-white/50">ASSETS </span><span className="text-white">{usd(EX.assets)}</span>
        <span className="text-white/50"> · LIABILITIES </span><span className="text-white">{usd(EX.liabilities)}</span>
        <span className="text-white/50"> · EQUITY </span><span className="text-white">{usd(EX.equity)}</span>
      </p>
      <p className="text-brand-green">A = L + E ✓ BALANCED — {usd(EX.assets)} = {usd(EX.liabilities)} + {usd(EX.equity)}</p>
      <div className="mt-2 border-t border-panel-border pt-2 text-white/70">
        <p className="text-white/50">Jun 05 · Farmers market sales</p>
        <p><span className="text-brand-green">DR</span> 1010 Business Checking <span className="text-white">$412.00</span></p>
        <p><span className="text-brand-red">CR</span> 4100 Product Revenue <span className="text-white">$412.00</span></p>
      </div>
      <p className="mt-2 border-t border-panel-border pt-2 text-white/50">
        3 linked accounts · categorize queue: <span className="text-brand-amber">3 pending</span>
      </p>
    </div>
  );
}

// ── THE 8 SLIDE PANELS (causal order) ────────────────────────────────────────

/** 1. LINK YOUR BANKS — mirrors the pipe's source-accounts table
 *  (BooksPipeline.tsx:184-242): institution / masked account / type / entity
 *  pill / balance, balances summing to the cockpit's assets − the card is the
 *  liability side. */
export function SourceAccountsPanel() {
  return (
    <DarkSlide title="Source accounts — 3 connected">
      <div className="space-y-1 text-white/70">
        <p><span className="text-white">First Harbor Bank</span> ···· 4821 <span className="text-white/40">checking</span> <span className="rounded bg-brand-purple/40 px-1 text-[10px] text-white">BUSINESS</span> <span className="float-right text-white">{usd(EX.checking)}</span></p>
        <p><span className="text-white">First Harbor Bank</span> ···· 4839 <span className="text-white/40">savings</span> <span className="rounded bg-brand-purple/40 px-1 text-[10px] text-white">BUSINESS</span> <span className="float-right text-white">{usd(EX.savings)}</span></p>
        <p><span className="text-white">Meridian Card Services</span> ···· 7702 <span className="text-white/40">credit</span> <span className="rounded bg-brand-purple/40 px-1 text-[10px] text-white">BUSINESS</span> <span className="float-right text-brand-red">{usd(EX.liabilities)}</span></p>
        <p className="mt-1 border-t border-panel-border pt-1 text-white/50">
          Equipment (on the books, not a feed): 1400 Equipment <span className="float-right text-white/80">{usd(EX.equipment)}</span>
        </p>
        <p className="text-white/50">Assets {usd(EX.checking)} + {usd(EX.savings)} + {usd(EX.equipment)} = <span className="text-white">{usd(EX.assets)}</span> · every account assigned to an entity (personal / business / trading)</p>
      </div>
    </DarkSlide>
  );
}

/** 2. THE QUEUE THAT LEARNS — mirrors the categorize queue: merchant, amount,
 *  PREDICTED COA preselected with confidence (predicted_coa_code +
 *  prediction_confidence, api/transactions/route.ts:129; learning loop at
 *  commit-to-ledger:123-195). Pure DB — no AI, and no AI is claimed. */
export function CategorizePanel() {
  const rows = [
    { m: 'Riverside Roasters', amt: '-$84.12', code: '6120 Supplies', conf: '92%' },
    { m: 'Shell Oil #4471', amt: '-$61.35', code: '6010 Car & Truck Expenses', conf: '88%' },
    { m: 'Farmers Market POS', amt: '+$412.00', code: '4100 Product Revenue', conf: '95%' },
  ];
  return (
    <DarkSlide title="Categorize — 3 pending, predictions preselected">
      <div className="space-y-1.5 text-white/70">
        {rows.map((r) => (
          <p key={r.m}>
            <span className="text-white">{r.m}</span> <span className={r.amt.startsWith('+') ? 'text-brand-green' : 'text-white/80'}>{r.amt}</span>
            <br />
            <span className="text-white/50">predicted → </span><span className="text-brand-amber">{r.code}</span>
            <span className="text-white/50"> · confidence </span><span className="text-white/80">{r.conf}</span>
          </p>
        ))}
        <p className="border-t border-panel-border pt-1.5 text-white/50">
          Predictions come from YOUR ledger — a user-scoped merchant→account table that commits
          reinforce and corrections retrain. No AI. Just your books learning your business.
        </p>
      </div>
    </DarkSlide>
  );
}

/** 3. COMMIT = DOUBLE ENTRY — a full balanced journal entry, real COA codes. */
export function JournalPanel() {
  return (
    <DarkSlide title="Journal entry — debits must equal credits">
      <div className="space-y-1 text-white/70">
        <p className="text-white/50">Jun 05, 2026 · Farmers market sales · POSTED</p>
        <p><span className="font-bold text-brand-green">DR</span> 1010 Business Checking <span className="float-right text-white">$412.00</span></p>
        <p><span className="font-bold text-brand-red">CR</span> 4100 Product Revenue <span className="float-right text-white">$412.00</span></p>
        <p className="border-t border-panel-border pt-1 text-white/50">Entry total: debits $412.00 = credits $412.00 ✓</p>
        <p className="text-brand-red">An unbalanced entry refuses to commit — &ldquo;UNBALANCED JOURNAL ENTRY&rdquo; is a hard error, not a warning.</p>
      </div>
    </DarkSlide>
  );
}

/** 4. THE TRIAL BALANCE MUST BALANCE — full TB, totals equal, real verdict
 *  string ("BALANCED ✓", CPAExport.tsx:143). */
export function TrialBalancePanel() {
  const rows: [string, string, number, 'D' | 'C'][] = [
    ['1010', 'Business Checking', EX.checking, 'D'],
    ['1020', 'Business Savings', EX.savings, 'D'],
    ['1400', 'Equipment', EX.equipment, 'D'],
    ['6120', 'Supplies', EX.expenses.supplies, 'D'],
    ['6010', 'Car & Truck Expenses', EX.expenses.carTruck, 'D'],
    ['6100', 'Rent (Business)', EX.expenses.rent, 'D'],
    ['2020', 'Credit Card (Business)', EX.liabilities, 'C'],
    ['3000', "Owner's Equity", EX.contributed, 'C'],
    ['4100', 'Product Revenue', EX.revenue, 'C'],
  ];
  const debits = rows.filter(([, , , t]) => t === 'D').reduce((s, [, , v]) => s + v, 0);
  const credits = rows.filter(([, , , t]) => t === 'C').reduce((s, [, , v]) => s + v, 0);
  return (
    <DarkSlide title="Trial balance — June 2026">
      <div className="space-y-0.5 text-white/70">
        {rows.map(([code, name, v, t]) => (
          <p key={code}>
            <span className="text-white/50">{code}</span> {name}
            <span className="float-right">
              {t === 'D' ? <span className="text-white">{usd(v)}</span> : <span className="text-white/40">—</span>}
              <span className="inline-block w-16 text-right">{t === 'C' ? <span className="text-white">{usd(v)}</span> : <span className="text-white/40">—</span>}</span>
            </span>
          </p>
        ))}
        <p className="border-t border-panel-border pt-1">
          <span className="text-white/50">Totals</span>
          <span className="float-right text-white">{usd(debits)} <span className="inline-block w-16 text-right">{usd(credits)}</span></span>
        </p>
        <p className="text-brand-green">BALANCED ✓ — debits {usd(debits)} = credits {usd(credits)}</p>
        <p className="text-white/50">If this can&rsquo;t be computed, the cockpit shows an error — never a silent &ldquo;balanced&rdquo;.</p>
      </div>
    </DarkSlide>
  );
}

/** 5. RECONCILE — statement vs book, difference $0.00, real verdict string
 *  ("✓ RECONCILED", BankReconciliation.tsx:273). */
export function ReconcilePanel() {
  return (
    <DarkSlide title="Bank reconciliation — Business Checking ···· 4821">
      <div className="space-y-1 text-white/70">
        <p>Statement balance (bank) <span className="float-right text-white">{usd(EX.checking)}.00</span></p>
        <p>Book balance (your ledger) <span className="float-right text-white">{usd(EX.checking)}.00</span></p>
        <p className="text-white/50">Cleared: 14 items · deposits in transit $412.00 · outstanding checks $84.12 (both cleared)</p>
        <p className="border-t border-panel-border pt-1">Difference <span className="float-right text-brand-green">$0.00</span></p>
        <p className="text-brand-green">✓ RECONCILED</p>
      </div>
    </DarkSlide>
  );
}

/** 6. STATEMENTS — P&L + balance-sheet line, SAME numbers as the cockpit. */
export function StatementsPanel() {
  return (
    <DarkSlide title="Financial statements — June 2026">
      <div className="space-y-1 text-white/70">
        <p className="text-white/50">INCOME STATEMENT</p>
        <p>4100 Product Revenue <span className="float-right text-white">{usd(EX.revenue)}</span></p>
        <p>6120 Supplies <span className="float-right text-white/80">({usd(EX.expenses.supplies)})</span></p>
        <p>6010 Car &amp; Truck Expenses <span className="float-right text-white/80">({usd(EX.expenses.carTruck)})</span></p>
        <p>6100 Rent (Business) <span className="float-right text-white/80">({usd(EX.expenses.rent)})</span></p>
        <p className="border-t border-panel-border pt-1">Net income <span className="float-right text-brand-green">{usd(EX.netIncome)}</span></p>
        <p className="mt-1.5 text-white/50">BALANCE SHEET</p>
        <p>Assets <span className="float-right text-white">{usd(EX.assets)}</span></p>
        <p>Liabilities + Equity <span className="float-right text-white">{usd(EX.liabilities)} + {usd(EX.equity)} = {usd(EX.assets)}</span></p>
        <p className="text-brand-green">BALANCED ✓ — equity = {usd(EX.contributed)} contributed + {usd(EX.netIncome)} net income</p>
      </div>
    </DarkSlide>
  );
}

/** 7. CLOSE THE PERIOD — locked months + the reopen-requires-reason mechanic
 *  (BooksPipeline.tsx:352-353). */
export function ClosePanel() {
  return (
    <DarkSlide title="Period close — 2026">
      <div className="space-y-1 text-white/70">
        <p>Jan · Feb · Mar · Apr · May · Jun <span className="text-brand-green">CLOSED ✓</span> <span className="text-white/50">· Jul</span> <span className="text-brand-amber">OPEN</span></p>
        <p className="text-white/50">A closed month is locked — entries in it cannot change.</p>
        <p className="border-t border-panel-border pt-1 text-white/80">Reopen June?</p>
        <p className="text-brand-amber">&ldquo;Reason for reopening (required for audit trail):&rdquo;</p>
        <p className="text-white/50">No reason, no reopen. The reason lands on the record, permanently.</p>
      </div>
    </DarkSlide>
  );
}

/** 8. CPA-READY — the export package. */
export function CpaExportPanel() {
  return (
    <DarkSlide title="CPA export — year to date">
      <div className="space-y-1 text-white/70">
        <p className="text-white/50">PACKAGE CONTENTS</p>
        <p>· Trial balance <span className="text-brand-green">BALANCED ✓</span></p>
        <p>· Income statement — net income <span className="text-white">{usd(EX.netIncome)}</span></p>
        <p>· Balance sheet — {usd(EX.assets)} = {usd(EX.liabilities)} + {usd(EX.equity)} <span className="text-brand-green">✓</span></p>
        <p>· General ledger + journal entries (every debit and credit)</p>
        <p>· Closed periods: <span className="text-white">6 of 6</span> through June</p>
        <p className="border-t border-panel-border pt-1 text-white/50">One clean package for your CPA — not a shoebox of receipts.</p>
      </div>
    </DarkSlide>
  );
}

// ── THE LIVE SECTION — real components on the example books ──────────────────

export function LiveBooksSection({ currentUserId, onRequireAuth }: { currentUserId: string; onRequireAuth: () => void }) {
  const away = routeAway(currentUserId, onRequireAuth);
  const awayAsync = async () => { away(); };
  const noop = () => {};
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">The real cockpit bar — A = L + E, live component</p>
          <ExampleTag text="Example books" />
        </div>
        {/* DIRECT REUSE: pure props, zero fetches (BookkeepingCockpitBar.tsx:3-17).
            Cents in (fmtDollars divides by 100, :19-20). Totals reconcile:
            1,240,000 = 310,000 + 930,000. Sync / + Account route to signup/CTA. */}
        <BookkeepingCockpitBar
          totalAssets={1_240_000}
          totalLiabilities={310_000}
          totalEquity={930_000}
          isBalanced={true}
          connectedAccounts={3}
          periodLabel="July 2026"
          periodStatus="open"
          onSync={away}
          syncing={false}
          onLinkAccount={away}
        />
      </div>
      <div className="rounded-lg border border-border bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">The real journal engine — the three example entries, live component</p>
          <ExampleTag text="Example books" />
        </div>
        {/* EXAMPLE-FED: zero fetches (JournalEntryEngine.tsx:46-51); save routes away. */}
        <JournalEntryEngine
          journalTransactions={EX_JOURNAL}
          coaOptions={COA}
          onSave={awayAsync}
          onReload={noop}
        />
      </div>
      <div className="rounded-lg border border-border bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">The real reconciliation engine — live component</p>
          <ExampleTag text="Example books" />
        </div>
        {/* EXAMPLE-FED: zero fetches (BankReconciliation.tsx:44-50); save routes away. */}
        <BankReconciliation
          accounts={EX_ACCOUNTS}
          transactions={EX_REC_TXNS}
          reconciliations={EX_RECONCILIATION}
          onSave={awayAsync}
          onReload={noop}
        />
      </div>
      <div className="rounded-lg border border-border bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">The real period-close engine — live component</p>
          <ExampleTag text="Example books" />
        </div>
        {/* EXAMPLE-FED: zero fetches (PeriodClose.tsx:27-35); close/reopen route away. */}
        <PeriodClose
          transactions={EX_JOURNAL.map((j) => ({ id: j.id, date: j.date, accountCode: j.account_code }))}
          reconciliations={EX_RECONCILIATION.map((r) => ({ id: r.id, accountId: r.accountId, periodEnd: r.periodEnd, status: r.status }))}
          periodCloses={EX_PERIOD_CLOSES}
          selectedYear={2026}
          onClose={awayAsync}
          onReopen={awayAsync}
          onReload={noop}
        />
      </div>
      <p className="text-xs text-text-muted">
        Everything above is the real product UI on a declared set of example books — the same
        reconciling numbers the slides show. A logged-out page fetches nothing; every action takes
        you to sign-up.
      </p>
    </div>
  );
}
