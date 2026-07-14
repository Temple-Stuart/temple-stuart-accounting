'use client';

/**
 * BOOKS-SHOWCASE-BLOOMBERG: the logged-out Books showcase sections — the
 * Bloomberg slide deck on the proven Trade template, grounded in
 * BOOKS-FULL-INVENTORY (audit-reports/BOOKS-FULL-INVENTORY.md).
 *
 * BOOKS-LIVE-PIPE-COMPLETE: the live section under the slides is the FULL
 * 13-stage pipe in the dashboard's canonical order (BooksPipeline.tsx:180-181):
 * SRC → CAT → JE → LDG → TB → REC → ADJ → STMT → TAX-LOT → CLOSE → CLOSE-YE →
 * POS → EXP, headed by the cockpit bar exactly as the real tab mounts it
 * (ModuleLauncher Books branch → BookkeepingCockpitBar → BooksPipeline).
 *
 * MOUNTABILITY RULINGS APPLIED (inventory Phase 2):
 *  • BookkeepingCockpitBar — DIRECT REUSE: pure props, zero fetches
 *    (BookkeepingCockpitBar.tsx:3-17); mounted with the example totals below;
 *    Sync / + Account route to signup/CTA.
 *  • BookkeepingSection — DIRECT REUSE: pure props + local collapse state,
 *    zero fetches (BookkeepingSection.tsx:1-58); every stage below sits in the
 *    REAL section chrome with the real pipelineKey/subtitle/status props.
 *  • JournalEntryEngine / BankReconciliation / PeriodClose — EXAMPLE-FED:
 *    zero fetches each (typed props seams at JournalEntryEngine.tsx:46-51,
 *    BankReconciliation.tsx:44-50, PeriodClose.tsx:27-35); mounted on the
 *    example books; every action callback routes to signup/CTA.
 *  • SpendingTab — RULED OUT of live mount: its 4 fetches are internal
 *    ACTION handlers (commit :1185/:1218, uncommit :1246, create-COA :366),
 *    not routable props — a click would fire a real POST. The CAT stage is a
 *    faithful static mirror of its pending table instead.
 *  • Every stage that fetches on mount — GeneralLedger (:126,:138-156),
 *    TrialBalanceSection (:46-49), AdjustingEntriesTab (:28-34),
 *    FinancialStatementsTab (:22-29), WashSaleReportTab (:60-67),
 *    CloseBooksTab (:26,:37), PositionReportTab (:107-114), CPAExport
 *    (:316,:329) — is NOT mounted; it appears as a faithful STATIC MIRROR of
 *    the real screen (per-block JSX correspondence cites in comments, the
 *    Trade graded-card discipline), rendering the same coherent books.
 *  • Each stage section is labeled REAL or MIRROR on its face + example-tagged.
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

import { Fragment } from 'react';
import BookkeepingCockpitBar from '@/components/bookkeeping/BookkeepingCockpitBar';
import BookkeepingSection from '@/components/bookkeeping/BookkeepingSection';
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

// ── the pipe extension of the SAME books (BOOKS-LIVE-PIPE-COMPLETE) ─────────
// The entity persona is the repo's established demo persona (Maria's food
// truck — TabShowcases.tsx header). All values below are the SAME set as the
// header-comment math: nothing new is asserted, only re-presented per stage.
const ENTITY_NAME = "Maria's Food Truck";

// The 9 ledger accounts at their June-close normal balances — identical to
// the TrialBalancePanel slide rows. Reconciliation: debits 9,400 + 2,500 +
// 500 + 900 + 2,400 + 1,800 = 17,500 = credits 3,100 + 6,000 + 8,400 ✓.
// `side` = the account's normal balance side (balanceType), which is both
// the TB displaySide and the GL summary's sign convention.
const EX_LEDGER: { code: string; name: string; type: string; side: 'D' | 'C'; balance: number }[] = [
  { code: '1010', name: 'Business Checking', type: 'Asset', side: 'D', balance: EX.checking },
  { code: '1020', name: 'Business Savings', type: 'Asset', side: 'D', balance: EX.savings },
  { code: '1400', name: 'Equipment', type: 'Asset', side: 'D', balance: EX.equipment },
  { code: '2020', name: 'Credit Card (Business)', type: 'Liability', side: 'C', balance: EX.liabilities },
  { code: '3000', name: "Owner's Equity", type: 'Equity', side: 'C', balance: EX.contributed },
  { code: '4100', name: 'Product Revenue', type: 'Revenue', side: 'C', balance: EX.revenue },
  { code: '6010', name: 'Car & Truck Expenses', type: 'Expense', side: 'D', balance: EX.expenses.carTruck },
  { code: '6100', name: 'Rent (Business)', type: 'Expense', side: 'D', balance: EX.expenses.rent },
  { code: '6120', name: 'Supplies', type: 'Expense', side: 'D', balance: EX.expenses.supplies },
];
const EX_TB_DEBITS = EX_LEDGER.filter((a) => a.side === 'D').reduce((s, a) => s + a.balance, 0);
const EX_TB_CREDITS = EX_LEDGER.filter((a) => a.side === 'C').reduce((s, a) => s + a.balance, 0);

// The categorize queue — the SAME three June transactions as EX_JOURNAL /
// EX_REC_TXNS, shown at the moment they arrived (pending, prediction
// preselected). The live section walks these three through the pipe: pending
// here, posted from the JE stage onward — the same framing the hero terminal
// uses ("categorize queue: 3 pending" next to posted DR/CR lines).
// SpendingTab's default sort is date desc, so newest first.
// Amount sign follows SpendingTab.tsx:901-905 (Plaid convention: positive =
// outflow → red "-", negative = inflow → green "+").
const EX_CAT_ROWS = [
  { id: 'cat-1', date: '06/09/2026', merchant: 'Shell Oil #4471', desc: 'Truck fuel', amount: '-$61.35', inflow: false, account: 'Business Card', inst: 'Meridian Card Services', predicted: '6010 - Car & Truck Expenses' },
  { id: 'cat-2', date: '06/05/2026', merchant: 'Farmers Market POS', desc: 'Farmers market sales', amount: '+$412.00', inflow: true, account: 'Business Checking', inst: 'First Harbor Bank', predicted: '4100 - Product Revenue' },
  { id: 'cat-3', date: '06/03/2026', merchant: 'Riverside Roasters', desc: 'Coffee beans — Riverside Roasters', amount: '-$84.12', inflow: false, account: 'Business Checking', inst: 'First Harbor Bank', predicted: '6120 - Supplies' },
];

// $ with 2 decimals + thousands separators (GeneralLedger.tsx fmtMoney
// :67-74 / TrialBalanceSection.tsx fmtCents :34-39 render this shape).
const usd2 = (n: number) =>
  '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

// ── THE LIVE SECTION — the FULL 13-stage pipe (BOOKS-LIVE-PIPE-COMPLETE) ─────
//
// Canonical order = the real dashboard order (BooksPipeline.tsx:180-181):
// SRC → CAT → JE → LDG → TB → REC → ADJ → STMT → TAX-LOT → CLOSE → CLOSE-YE →
// POS → EXP, with the cockpit bar heading the section as the real tab has it.
// Every stage sits in the REAL BookkeepingSection chrome (zero fetches,
// BookkeepingSection.tsx:1-58) with the real pipe's pipelineKey / subtitle /
// status props, resolved for the example books. Stages whose real component
// self-fetches are faithful STATIC MIRRORS (per-block correspondence cites);
// the truth strip on each section says which is which.

/** Showcase chrome (not part of the real screen): declares on each stage's
 *  face whether what follows is the real component mounted live or a faithful
 *  static mirror — the same honesty labeling the slides use. */
function StageTruthStrip({ real }: { real: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-bg-row/60 px-3 py-1.5">
      <span className={`text-[10px] font-bold uppercase tracking-wider ${real ? 'text-brand-green' : 'text-text-muted'}`}>
        {real ? 'Real component — mounted live' : 'Faithful mirror of the real screen'}
      </span>
      <ExampleTag text="Example books" />
    </div>
  );
}

/** Kills the native control and routes the click to signup/CTA — mirrors stay
 *  visually faithful while every action leaves for sign-up. */
const interceptTo = (away: () => void) => (e: React.SyntheticEvent) => {
  e.preventDefault();
  away();
};

// 1. SRC — mirror of the pipe's inline source-accounts table
// (BooksPipeline.tsx:184-242). It can't mount live: that JSX is owned by the
// self-fetching BooksPipeline, and the entity select POSTs
// /api/accounts/update-entity (:137-149) — here it routes away instead.
function SourceAccountsStage({ away }: { away: () => void }) {
  const block = interceptTo(away);
  // Feed total mirrors the pipe's footer sum over account.balance (:156,:233-238):
  // 9,400 + 2,500 + 3,100 = 15,000. The books' ASSETS stay 12,400 = 9,400 +
  // 2,500 + 500 (1400 Equipment is book-only, no bank feed — the slide-1 note),
  // and the card's 3,100 is the LIABILITY side of the same set.
  const feedTotal = EX_ACCOUNTS.reduce((s, a) => s + a.balance, 0);
  const fmt0 = (n: number) => '$' + Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
  return (
    <div className="overflow-x-auto">
      {/* Table shell + columns — mirrors :190-199. */}
      <table className="w-full text-xs">
        <thead className="bg-gray-50 text-text-secondary">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Institution</th>
            <th className="px-3 py-2 text-left font-medium">Account</th>
            <th className="px-3 py-2 text-left font-medium">Type</th>
            <th className="px-3 py-2 text-left font-medium">Entity</th>
            <th className="px-3 py-2 text-right font-medium">Balance</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {/* Rows — mirrors :202-228: institution / ••••mask / type chip /
              entity select (business = the purple pill, :204-207) / balance. */}
          {EX_ACCOUNTS.map((acc) => (
            <tr key={acc.id} className="hover:bg-bg-row">
              <td className="px-3 py-2 font-medium text-text-primary">{acc.institutionName}</td>
              <td className="px-3 py-2 text-text-secondary font-mono">{'••••'} {acc.mask}</td>
              <td className="px-3 py-2"><span className="px-2 py-0.5 bg-bg-row text-text-secondary text-[10px] uppercase">{acc.type}</span></td>
              <td className="px-3 py-2">
                <select
                  value="business"
                  onMouseDown={block}
                  onChange={away}
                  className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase border-0 cursor-pointer bg-purple-100 text-purple-700"
                >
                  <option value="personal">Personal</option>
                  <option value="business">Business</option>
                  <option value="trading">Trading</option>
                </select>
              </td>
              <td className="px-3 py-2 text-right font-mono font-semibold">{fmt0(acc.balance)}</td>
            </tr>
          ))}
        </tbody>
        {/* Total footer — mirrors :233-238. */}
        <tfoot className="bg-bg-row border-t border-border">
          <tr>
            <td colSpan={4} className="px-3 py-2 font-semibold text-text-primary">Total</td>
            <td className="px-3 py-2 text-right font-mono font-bold text-text-primary">{fmt0(feedTotal)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// 2. CAT — mirror of the categorize stage: the pipe's Spending|Investments
// strip (BooksPipeline.tsx:249-263) + SpendingTab's pending table
// (SpendingTab.tsx:833-925). SpendingTab is RULED OUT of live mount (its
// commit/uncommit/create-COA fetches are internal handlers, inventory Phase
// 2) — mirrored instead. Investments 0 is coherent: the example set has no
// trading accounts.
function CategorizeStage({ away }: { away: () => void }) {
  const block = interceptTo(away);
  return (
    <div>
      {/* Queue strip — mirrors BooksPipeline.tsx:249-263 (active tab wash +
          gold pending counts). */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-b border-border">
        <div className="flex items-center border border-border bg-white">
          <button onClick={away} className="px-2 py-0.5 text-[10px] font-mono font-medium bg-brand-purple-wash text-brand-purple">
            Spending <span className="font-bold text-brand-gold">3</span>
          </button>
          <button onClick={away} className="px-2 py-0.5 text-[10px] font-mono font-medium border-l border-border text-text-muted">
            Investments <span className="font-bold text-brand-gold">0</span>
          </button>
        </div>
      </div>
      <div className="p-4">
        <div className="overflow-x-auto">
          {/* Pending table headers — mirrors SpendingTab.tsx:836-847 (checkbox,
              Date, Merchant, Desc, Amount, Account, Inst, COA). */}
          <table className="w-full text-xs border-collapse min-w-[900px]">
            <thead className="bg-gray-50 text-text-secondary">
              <tr>
                <th className="px-2 py-1 w-10"><input type="checkbox" onMouseDown={block} onChange={away} className="w-3 h-3 rounded" /></th>
                <th className="px-2 py-1 text-left text-terminal-xs font-semibold font-mono uppercase tracking-widest w-24">Date</th>
                <th className="px-2 py-1 text-left text-terminal-xs font-semibold font-mono uppercase tracking-widest min-w-[130px]">Merchant</th>
                <th className="px-2 py-1 text-left text-terminal-xs font-semibold font-mono uppercase tracking-widest min-w-[200px]">Desc</th>
                <th className="px-2 py-1 text-terminal-xs font-semibold font-mono uppercase tracking-widest w-24 text-right">Amount</th>
                <th className="px-2 py-1 text-left text-terminal-xs font-semibold font-mono uppercase tracking-widest w-28">Account</th>
                <th className="px-2 py-1 text-left text-terminal-xs font-semibold font-mono uppercase tracking-widest w-28">Inst</th>
                <th className="px-2 py-1 text-left text-terminal-xs font-semibold font-mono uppercase tracking-widest min-w-[180px]">COA</th>
              </tr>
            </thead>
            <tbody>
              {/* Rows — mirror SpendingTab.tsx:878-938: zebra rows; amount
                  colored by direction (:901-905); the COA select PRESELECTS
                  the predicted code as "code - name" (:918) — the mechanic
                  slide 2 teaches. Selects route away (real change would arm a
                  commit POST). */}
              {EX_CAT_ROWS.map((r, idx) => (
                <tr key={r.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-bg-row'} border-b border-border-light`}>
                  <td className="py-1 px-2"><input type="checkbox" onMouseDown={block} onChange={away} className="w-3 h-3 rounded" /></td>
                  <td className="py-1 px-2 text-text-muted whitespace-nowrap font-mono text-terminal-base">{r.date}</td>
                  <td className="py-1 px-2"><span className="truncate font-medium text-terminal-base">{r.merchant}</span></td>
                  <td className="py-1 px-2 text-text-secondary text-terminal-sm truncate">{r.desc}</td>
                  <td className="py-1 px-2 text-right font-mono font-semibold whitespace-nowrap text-terminal-base">
                    <span className={r.inflow ? 'text-brand-green' : 'text-brand-red'}>{r.amount}</span>
                  </td>
                  <td className="py-1 px-2 font-mono text-terminal-sm text-text-muted truncate">{r.account}</td>
                  <td className="py-1 px-2 font-mono text-terminal-sm text-text-muted truncate">{r.inst}</td>
                  <td className="py-1 px-2">
                    <select
                      value=""
                      onMouseDown={block}
                      onChange={away}
                      className="w-full text-terminal-sm font-mono border border-border rounded px-1 py-0.5 bg-white"
                    >
                      <option value="">{r.predicted}</option>
                      <option value="__NEW__">+ Add Category</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Commit affordance — mirrors SpendingTab.tsx:1308-1309 ("Commit N
            Rows"); here it routes to signup. */}
        <div className="mt-2 flex justify-end">
          <button onClick={away} className="rounded-lg bg-brand-gold px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-gold-bright">
            Commit 3 Rows
          </button>
        </div>
      </div>
    </div>
  );
}

// 4. LDG — mirror of GeneralLedger's mount-time view (self-fetches
// /api/ledger + /api/entities on mount, GeneralLedger.tsx:126,:138-156 → not
// mountable): entity tabs (:370-394), controls bar (:397-510), and the
// no-account-selected summary grid (:526-590). Closing balances are the SAME
// nine TB balances — June activity is the three committed entries plus the
// ADJ reclass; balances include the opening carried from the closed Jan–May
// periods (the component's openingBalance/closingBalance model, :44-46).
function GeneralLedgerStage({ away }: { away: () => void }) {
  const block = interceptTo(away);
  return (
    <div className="bg-white overflow-hidden">
      {/* Entity tabs — mirrors :370-394 ("All" active + one entity). */}
      <div className="flex border-b border-border">
        <button onClick={away} className="px-3 py-1.5 text-terminal-base font-mono font-medium border-b-2 border-brand-purple text-brand-purple">All</button>
        <button onClick={away} className="px-3 py-1.5 text-terminal-base font-mono font-medium border-b-2 border-transparent text-text-muted">{ENTITY_NAME}</button>
      </div>
      {/* Controls bar — mirrors :397-510 (account search, date range, keyword,
          Reload). Inert: interaction routes away. */}
      <div className="p-2 border-b bg-bg-row flex flex-wrap gap-2 items-center">
        <input type="text" readOnly onMouseDown={block} placeholder="Search accounts..." className="min-w-[260px] h-7 px-2 border border-border rounded text-terminal-base font-mono" />
        <input type="date" readOnly onMouseDown={block} className="h-7 px-2 border border-border rounded text-terminal-base font-mono" />
        <input type="date" readOnly onMouseDown={block} className="h-7 px-2 border border-border rounded text-terminal-base font-mono" />
        <input type="text" readOnly onMouseDown={block} placeholder="Search descriptions..." className="flex-1 min-w-[150px] h-7 px-2 border border-border rounded text-terminal-base font-mono" />
        <button onClick={away} className="h-7 px-2 text-terminal-base font-mono border border-border rounded hover:bg-bg-row">Reload</button>
      </div>
      {/* Summary grid — mirrors :526-590: entity header row (:540-548), type
          header rows (:552-559), zebra account rows with 2-dp balances
          (fmtMoney :67-74). */}
      <div className="overflow-x-auto">
        <table className="w-full text-terminal-base min-w-[700px]">
          <thead>
            <tr className="bg-gray-50 text-text-secondary">
              <th className="text-terminal-xs uppercase tracking-widest font-mono py-1 px-2 text-left">Account Code</th>
              <th className="text-terminal-xs uppercase tracking-widest font-mono py-1 px-2 text-left">Account Name</th>
              <th className="text-terminal-xs uppercase tracking-widest font-mono py-1 px-2 text-left">Type</th>
              <th className="text-terminal-xs uppercase tracking-widest font-mono py-1 px-2 text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={4} className="py-2 px-2 text-xs uppercase text-text-muted font-semibold tracking-wider border-b border-border-light bg-bg-row">{ENTITY_NAME}</td>
            </tr>
            {(['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'] as const).map((type) => (
              <Fragment key={type}>
                <tr>
                  <td colSpan={4} className="py-1 px-2 text-terminal-xs font-bold text-text-muted bg-bg-row/60 uppercase tracking-wider pl-4">{type}</td>
                </tr>
                {EX_LEDGER.filter((a) => a.type === type).map((a, idx) => (
                  <tr key={a.code} className={`cursor-pointer hover:bg-brand-purple/[.07] ${idx % 2 === 0 ? 'bg-white' : 'bg-bg-row'}`} onClick={away}>
                    <td className="py-1 px-2 font-medium">{a.code}</td>
                    <td className="py-1 px-2 text-text-secondary">{a.name}</td>
                    <td className="py-1 px-2 text-text-muted">{a.type}</td>
                    <td className="py-1 px-2 text-right font-mono tabular-nums">{usd2(a.balance)}</td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// 5. TB — mirror of TrialBalanceSection (self-fetches /api/trial-balance on
// mount, TrialBalanceSection.tsx:46-49 → not mountable): the "✓ Balanced"
// pill is the component's REAL verdict string (:87-89), fed by the same
// totals.isBalanced field the cockpit guard requires. Totals: debits
// $17,500.00 = credits $17,500.00 (EX_TB_DEBITS/EX_TB_CREDITS, computed).
function TrialBalanceStage() {
  return (
    <div>
      {/* Status pill row — mirrors :84-96. */}
      <div className="px-4 py-2 border-b border-border flex items-center gap-2">
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{'✓'} Balanced</span>
        <span className="text-terminal-sm text-text-muted font-mono">{EX_LEDGER.length} accounts</span>
      </div>
      {/* Table — mirrors :98-137: Code / Name / Type / Entity / Debit /
          Credit, one side filled per displaySide (:120-125), zebra rows,
          Totals footer (:130-135). */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-text-secondary">Account Code</th>
              <th className="px-3 py-2 text-left font-medium text-text-secondary">Account Name</th>
              <th className="px-3 py-2 text-left font-medium text-text-secondary">Type</th>
              <th className="px-3 py-2 text-left font-medium text-text-secondary">Entity</th>
              <th className="px-3 py-2 text-right font-medium text-text-secondary">Debit</th>
              <th className="px-3 py-2 text-right font-medium text-text-secondary">Credit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {EX_LEDGER.map((a, idx) => (
              <tr key={a.code} className={idx % 2 === 1 ? 'bg-bg-row' : ''}>
                <td className="px-3 py-2 font-mono text-text-secondary">{a.code}</td>
                <td className="px-3 py-2 text-text-primary">{a.name}</td>
                <td className="px-3 py-2 text-text-muted capitalize">{a.type.toLowerCase()}</td>
                <td className="px-3 py-2 text-text-muted">{ENTITY_NAME}</td>
                <td className="px-3 py-2 text-right font-mono text-text-primary">{a.side === 'D' ? usd2(a.balance) : ''}</td>
                <td className="px-3 py-2 text-right font-mono text-text-primary">{a.side === 'C' ? usd2(a.balance) : ''}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50 border-t-2 border-border">
            <tr className="font-semibold">
              <td colSpan={4} className="px-3 py-2 text-text-primary">Totals</td>
              <td className="px-3 py-2 text-right font-mono text-text-primary">{usd2(EX_TB_DEBITS)}</td>
              <td className="px-3 py-2 text-right font-mono text-text-primary">{usd2(EX_TB_CREDITS)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// 7. ADJ — mirror of AdjustingEntriesTab (fetches the COA on mount,
// AdjustingEntriesTab.tsx:28-34 → not mountable): the New Adjusting Entry
// form (:143-276) filled with an example that is INSIDE the established set —
// a Jun 30 reclass moving $150 of truck fuel misfiled as supplies:
//   DR 6010 Car & Truck 150.00 / CR 6120 Supplies 150.00
// Before the reclass 6120 ran 1,950 and 6010 ran 750; after: 1,800 / 900 —
// the exact TB/GL balances above. A debit-to-debit reclass leaves the TB
// debit total unchanged (17,500 = 17,500 ✓) and net income unchanged
// (expenses still total 5,100 → NI 3,300 ✓). Dated Jun 30, entered BEFORE
// June closed on Jul 02 (EX_PERIOD_CLOSES closedAt) — no locked-month edit.
function AdjustingEntriesStage({ away }: { away: () => void }) {
  const block = interceptTo(away);
  return (
    <div className="p-4">
      <div className="bg-white">
        {/* Header + date/description — mirrors :146-169. */}
        <h3 className="text-terminal-lg font-semibold mb-4">New Adjusting Entry</h3>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Date</label>
            <input type="date" value="2026-06-30" readOnly onMouseDown={block} className="w-full px-3 py-2 border rounded" />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Description</label>
            <input type="text" value="Reclass — truck fuel misfiled as supplies" readOnly onMouseDown={block} className="w-full px-3 py-2 border rounded" />
          </div>
        </div>
        {/* Entry lines — mirrors :171-235 (account select / D-C select /
            amount, "+ Add Line"). */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-text-secondary">Journal Entry Lines</label>
            <button onClick={away} className="px-3 py-1 bg-brand-purple text-white rounded text-sm">+ Add Line</button>
          </div>
          <div className="space-y-2">
            {[
              { account: '6010 - Car & Truck Expenses', side: 'Debit' },
              { account: '6120 - Supplies', side: 'Credit' },
            ].map((line) => (
              <div key={line.account} className="flex gap-2 items-center">
                <div className="flex-1">
                  <select value={line.account} onMouseDown={block} onChange={away} className="w-full px-3 py-2 border rounded text-sm">
                    <option value={line.account}>{line.account}</option>
                  </select>
                </div>
                <div className="w-32">
                  <select value={line.side} onMouseDown={block} onChange={away} className="w-full px-3 py-2 border rounded text-sm">
                    <option value="Debit">Debit</option>
                    <option value="Credit">Credit</option>
                  </select>
                </div>
                <div className="w-40">
                  <input type="number" value="150.00" readOnly onMouseDown={block} className="w-full px-3 py-2 border rounded text-sm" />
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Totals + balanced verdict — mirrors :237-260; "✓ Entry is
            balanced" is the component's real string (:257). 150.00 = 150.00,
            difference 0.00. */}
        <div className="border-t pt-4 mb-4">
          <div className="flex justify-end gap-8 text-sm">
            <div><span className="text-text-secondary">Total Debits:</span><span className="ml-2 font-semibold text-brand-purple">$150.00</span></div>
            <div><span className="text-text-secondary">Total Credits:</span><span className="ml-2 font-semibold text-brand-green">$150.00</span></div>
            <div><span className="text-text-secondary">Difference:</span><span className="ml-2 font-semibold text-brand-green">$0.00</span></div>
          </div>
          <div className="text-right mt-2">
            <span className="text-sm text-brand-green font-medium">✓ Entry is balanced</span>
          </div>
        </div>
        {/* Submit — mirrors :262-275; routes away. */}
        <div className="flex justify-end">
          <button onClick={away} className="px-6 py-2 rounded text-sm font-medium bg-brand-purple text-white hover:bg-brand-accent-dark">
            Create Adjusting Entry
          </button>
        </div>
      </div>
      {/* Help box — mirrors :278-286 (the component's real copy). */}
      <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
        <h3 className="text-sm font-semibold text-yellow-900 mb-2">About Adjusting Entries</h3>
        <p className="text-sm text-yellow-800">
          Adjusting entries are manual journal entries used to record accruals, deferrals, corrections, and other
          adjustments that aren&apos;t captured by automatic transaction imports. Common examples include depreciation,
          prepaid expenses, accrued revenues, and error corrections.
        </p>
      </div>
    </div>
  );
}

// 8. STMT — mirror of FinancialStatementsTab (self-fetches /api/statements on
// mount, FinancialStatementsTab.tsx:22-29 → not mountable). Values are
// COMPUTED here with the component's own formulas so they cannot drift:
// revenue 8,400 − expenses 5,100 = NI 3,300; assets 12,400 = liabilities
// 3,100 + equity 9,300; profit margin (3,300/8,400)·100 → 39.3% (:152-155);
// current ratio 12,400/3,100 → 4.00 (:162-164); ROE (3,300/9,300)·100 →
// 35.5% (:172-174). The real component renders toFixed(2) dollars — no
// thousands separators ("$8400.00") — mirrored exactly (:82,:114).
function StatementsStage() {
  const netIncome = EX.revenue - EX.expenses.total;
  const liabPlusEquity = EX.liabilities + EX.equity;
  const profitMargin = ((netIncome / EX.revenue) * 100).toFixed(1);
  const currentRatio = (EX.assets / EX.liabilities).toFixed(2);
  const roe = ((netIncome / EX.equity) * 100).toFixed(1);
  const fx = (n: number) => '$' + n.toFixed(2);
  return (
    <div className="p-4 space-y-6">
      <div className="grid grid-cols-2 gap-6">
        {/* Income statement card — mirrors :74-104. */}
        <div className="bg-white border rounded p-6">
          <h3 className="text-sm font-semibold mb-6">Income Statement</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-text-secondary">Revenue</span>
              <span className="text-terminal-lg font-semibold text-brand-green">{fx(EX.revenue)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-text-secondary">Expenses</span>
              <span className="text-terminal-lg font-semibold text-brand-red">{fx(EX.expenses.total)}</span>
            </div>
            <div className="border-t pt-4 mt-4">
              <div className="flex justify-between items-center">
                <span className="text-terminal-lg font-bold">Net Income</span>
                <span className="text-sm font-bold text-brand-green">{fx(netIncome)}</span>
              </div>
            </div>
          </div>
        </div>
        {/* Balance sheet card — mirrors :106-142; "✓ Books balanced" is the
            real verdict string (:137). */}
        <div className="bg-white border rounded p-6">
          <h3 className="text-sm font-semibold mb-6">Balance Sheet</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-text-secondary">Assets</span>
              <span className="text-terminal-lg font-semibold">{fx(EX.assets)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-text-secondary">Liabilities</span>
              <span className="text-terminal-lg font-semibold">{fx(EX.liabilities)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-text-secondary">Equity</span>
              <span className="text-terminal-lg font-semibold">{fx(EX.equity)}</span>
            </div>
            <div className="border-t pt-4 mt-4">
              <div className="text-sm text-text-secondary space-y-1">
                <div>Balance Check: Assets = {fx(EX.assets)}</div>
                <div>Liabilities + Equity = {fx(liabPlusEquity)}</div>
                <div className="font-semibold text-brand-green">✓ Books balanced</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Quick ratios — mirrors :145-178, same formulas. */}
      <div className="bg-white border rounded p-6">
        <h3 className="text-terminal-lg font-semibold mb-4">Quick Ratios</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="border rounded p-4 text-center">
            <div className="text-sm text-text-secondary mb-1">Profit Margin</div>
            <div className="text-sm font-bold">{profitMargin}%</div>
          </div>
          <div className="border rounded p-4 text-center">
            <div className="text-sm text-text-secondary mb-1">Current Ratio</div>
            <div className="text-sm font-bold">{currentRatio}</div>
          </div>
          <div className="border rounded p-4 text-center">
            <div className="text-sm text-text-secondary mb-1">ROE</div>
            <div className="text-sm font-bold">{roe}%</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 9. TAX-LOT — mirror of WashSaleReportTab (self-fetches /api/tax/wash-sales
// on mount, WashSaleReportTab.tsx:60-67 → not mountable). The coherent
// example books hold ONLY the three business feeds — no brokerage account, no
// securities dispositions — so the truthful render is the component's REAL
// zero-state (:136-142): a populated violation row would require trading
// history the declared A = L + E set does not contain. "Apply Adjustments"
// is correctly absent (it renders only when violations > 0, :122).
function WashSalesStage({ away }: { away: () => void }) {
  return (
    <div>
      {/* Actions row — mirrors :115-132 (IRS Publication 550 + Re-scan). */}
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <span className="text-terminal-sm text-text-muted font-mono">IRS Publication 550</span>
        <button onClick={away} className="px-3 py-1 text-xs border border-border text-text-secondary rounded-lg hover:bg-bg-row transition-colors">Re-scan</button>
      </div>
      {/* Zero-state — mirrors :136-142 (the real strings). */}
      <div className="p-3">
        <div className="text-center py-8">
          <div className="text-terminal-lg mb-2">No wash sale violations detected</div>
          <div className="text-terminal-sm text-text-muted">
            All losing dispositions have been scanned against the 30-day replacement window.
          </div>
        </div>
      </div>
    </div>
  );
}

// 11. CLOSE-YE — mirror of CloseBooksTab (self-fetches /api/year-end-close on
// mount, CloseBooksTab.tsx:26,:37 → not mountable) in its not-closed state
// (:127-154): coherent because only Jan–Jun of the required 12 months are
// period-closed (EX_PERIOD_CLOSES). At close, the net income to transfer to
// Retained Earnings (3900) would be the same 3,300 the statements show.
function YearEndCloseStage({ away }: { away: () => void }) {
  return (
    <div className="p-4 space-y-6">
      {/* Header row — mirrors :96-105. */}
      <div className="flex items-center justify-between">
        <span className="text-terminal-sm text-text-muted font-mono">GAAP year-end closing entries for 2026</span>
        <button onClick={away} className="px-3 py-1 text-xs border border-border text-text-secondary rounded-lg hover:bg-bg-row transition-colors">Refresh</button>
      </div>
      {/* Not-closed card — mirrors :127-154 (checklist strings verbatim). */}
      <div className="bg-white border rounded p-6">
        <h3 className="text-terminal-lg font-semibold mb-4">Close Year 2026</h3>
        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
            <h4 className="text-sm font-semibold text-yellow-900 mb-2">Pre-Closing Checklist</h4>
            <ul className="text-sm text-yellow-800 space-y-1">
              <li>All 12 months must be period-closed</li>
              <li>All transactions for the year have been recorded</li>
              <li>Bank accounts have been reconciled</li>
              <li>All adjusting entries have been made</li>
              <li>Financial statements have been reviewed</li>
            </ul>
          </div>
          <button onClick={away} className="w-full py-3 rounded text-sm font-medium bg-red-600 text-white hover:bg-red-700">
            Close Books for 2026
          </button>
        </div>
      </div>
      {/* Info box — mirrors :158-165 (the component's real copy). */}
      <div className="bg-brand-purple-wash border border-blue-200 rounded p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">About Year-End Close</h3>
        <p className="text-sm text-blue-800">
          Year-end close is the final step in the annual accounting cycle. It creates closing journal entries that
          zero out all revenue and expense accounts, transferring the net income (or loss) to Retained Earnings (3900).
          This ensures clean income statement balances for the next fiscal year while preserving the cumulative
          equity position on the balance sheet.
        </p>
      </div>
    </div>
  );
}

// 12. POS — mirror of PositionReportTab (self-fetches /api/positions/summary
// on mount, PositionReportTab.tsx:107-114 → not mountable) in its P&L
// Summary view (the mount default, :105). Zero-state throughout: the example
// set has no trading accounts, so every P&L renders the component's own
// fmt(0) = '-' (:124-131), win rate 0%, Open (0) / Closed (0), and the
// By Strategy table is absent (renders only when byStrategy.length > 0,
// :232). Nothing here exceeds the declared books.
function PositionReportStage({ away }: { away: () => void }) {
  return (
    <div>
      {/* Sub-tabs + Refresh — mirrors :152-174. */}
      <div className="flex items-center border-b border-border">
        <button onClick={away} className="px-3 py-1.5 text-terminal-base font-mono font-medium border-b-2 border-brand-purple text-brand-purple">P&amp;L Summary</button>
        <button onClick={away} className="px-3 py-1.5 text-terminal-base font-mono font-medium border-b-2 border-transparent text-text-muted">Open (0)</button>
        <button onClick={away} className="px-3 py-1.5 text-terminal-base font-mono font-medium border-b-2 border-transparent text-text-muted">Closed (0)</button>
        <button onClick={away} className="ml-auto mr-2 px-3 py-1 text-xs border border-border text-text-secondary rounded-lg hover:bg-bg-row transition-colors">Refresh</button>
      </div>
      <div className="p-3 space-y-3">
        {/* Top metric tiles — mirrors :180-209; fmt(0) = '-' and
            plColor(0) = green (:124-133). */}
        <div className="grid grid-cols-5 gap-2">
          {[
            ['Total Realized P&L', '-', 'text-brand-green'],
            ['Short-Term P&L', '-', 'text-brand-green'],
            ['Long-Term P&L', '-', 'text-brand-green'],
            ['Win Rate', '0%', ''],
            ['Profit Factor', '0.00', ''],
          ].map(([label, value, tone]) => (
            <div key={label} className="border border-border rounded p-2">
              <div className="text-terminal-xs text-text-muted uppercase tracking-widest">{label}</div>
              <div className={`text-terminal-lg font-bold font-mono ${tone}`}>{value}</div>
            </div>
          ))}
        </div>
        {/* Options vs stocks — mirrors :212-229. */}
        <div className="grid grid-cols-2 gap-3">
          <div className="border border-border rounded p-3">
            <h4 className="text-terminal-lg font-semibold mb-2">Options P&amp;L</h4>
            <div className="text-sm font-bold font-mono text-brand-green">-</div>
          </div>
          <div className="border border-border rounded p-3">
            <h4 className="text-terminal-lg font-semibold mb-2">Stocks P&amp;L</h4>
            <div className="text-sm font-bold font-mono text-brand-green">-</div>
            <div className="flex gap-4 mt-2 text-terminal-sm text-text-muted">
              <span>ST: <span className="font-mono text-brand-green">-</span></span>
              <span>LT: <span className="font-mono text-brand-green">-</span></span>
            </div>
          </div>
        </div>
        {/* Avg win/loss — mirrors :267-276. */}
        <div className="grid grid-cols-2 gap-3">
          <div className="border border-border rounded p-2">
            <div className="text-terminal-xs text-text-muted uppercase tracking-widest">Avg Win</div>
            <div className="text-base font-bold font-mono text-brand-green">-</div>
          </div>
          <div className="border border-border rounded p-2">
            <div className="text-terminal-xs text-text-muted uppercase tracking-widest">Avg Loss</div>
            <div className="text-base font-bold font-mono text-brand-red">-</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 13. EXP — mirror of CPAExport (self-fetches /api/cpa-export on mount,
// CPAExport.tsx:316,:329 → not mountable): header + status bar + the four
// export cards. Derivable stats tie to the set: Accounts 9 (the TB rows),
// Trial Balance ✓ / Balance Sheet ✓ (17,500 = 17,500; 12,400 = 3,100 +
// 9,300), Net Income $3300.00 — the real bar renders toFixed(2) with NO
// thousands separator (fmtMoney :103-105, :434), mirrored exactly. "Ledger
// lines: 96" is a DECLARED example count, labeled by the section's example
// tag (the Tax showcase's "12 exported" precedent — no formula exists for a
// year's posting count from balances alone); even, because postings land in
// DR/CR pairs.
function CpaExportStage({ away }: { away: () => void }) {
  const cards = [
    // Card copy verbatim from :445-448, :463-466, :481-484, :499-502.
    { title: '📊 Trial Balance', desc: 'Per-account debit/credit balances from the ledger. Debits must equal credits.' },
    { title: '📈 Income Statement', desc: 'Revenue minus expenses. Revenue nets credits − debits; expenses net debits − credits.' },
    { title: '📋 Balance Sheet', desc: 'Assets = Liabilities + Equity. Retained earnings rolls net income into equity.' },
    { title: '📒 General Ledger', desc: 'Every posted ledger entry in chronological order. Full audit trail.' },
  ];
  return (
    <div className="bg-white overflow-hidden">
      {/* Header — mirrors :386-397 (Export All is the gold button). */}
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <span className="text-terminal-sm text-text-muted font-mono">Export accountant-ready reports (sourced from the general ledger)</span>
        <button onClick={away} className="px-4 py-2 text-sm bg-brand-gold hover:bg-brand-gold-bright text-white font-semibold rounded-lg transition-colors">Export All</button>
      </div>
      {/* Status bar — mirrors :400-438 ("Trial Balance ✓" / "Balance Sheet ✓"
          are the real verdict spans, :424,:431). */}
      <div className="px-4 py-2 border-b border-border bg-bg-row flex items-center gap-6 text-sm">
        <span className="text-text-secondary">Year: <strong>2026</strong></span>
        <span className="text-text-secondary">Accounts: <strong>{EX_LEDGER.length}</strong></span>
        <span className="text-text-secondary">Ledger lines: <strong>96</strong></span>
        <span className="text-brand-green">Trial Balance ✓</span>
        <span className="text-brand-green">Balance Sheet ✓</span>
        <span className="text-text-secondary">Net Income: <strong>${(EX.revenue - EX.expenses.total).toFixed(2)}</strong></span>
      </div>
      {/* Export cards — mirrors :441-513. */}
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map((c) => (
          <div key={c.title} className="border rounded p-4 hover:bg-bg-row">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-medium">{c.title}</h4>
                <p className="text-xs text-text-muted mt-1">{c.desc}</p>
              </div>
              <button onClick={away} className="px-3 py-1.5 border rounded text-sm hover:bg-bg-row">Export CSV</button>
            </div>
          </div>
        ))}
      </div>
      {/* Footer — mirrors :516-518 (the component's real copy). */}
      <div className="px-4 py-3 border-t bg-bg-row text-xs text-text-muted">
        💡 Sourced from journal_entries + ledger_entries (reversals excluded). Open CSV files in Excel or Google Sheets.
      </div>
    </div>
  );
}

export function LiveBooksSection({ currentUserId, onRequireAuth }: { currentUserId: string; onRequireAuth: () => void }) {
  const away = routeAway(currentUserId, onRequireAuth);
  const awayAsync = async () => { away(); };
  const noop = () => {};
  return (
    <div className="space-y-3">
      {/* THE COCKPIT — heads the pipe exactly as the real tab mounts it
          (ModuleLauncher Books branch: BookkeepingCockpitBar above
          BooksPipeline, inventory §"Entry point"). DIRECT REUSE: pure props,
          zero fetches (BookkeepingCockpitBar.tsx:3-17). Cents in (fmtDollars
          divides by 100, :19-20). Totals reconcile: 1,240,000 = 310,000 +
          930,000. Sync / + Account route to signup/CTA. */}
      <div className="rounded-lg border border-border bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-green">Real component — mounted live</span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">The cockpit bar — heads the Books tab, A = L + E</span>
          <ExampleTag text="Example books" />
        </div>
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

      {/* Section wrappers below are the REAL BookkeepingSection chrome with
          the real pipe's props, resolved for the example books:
          SRC :185-188 ("3 connected", complete, collapsible), CAT :245-247
          ("3 pending", action-needed), JE :273-275 ("3 entries", complete),
          LDG :282-284 (committedCount×2 = 3×2 = "6 entries" — the formula
          counts committed FEED transactions, so the ADJ manual entry is not
          in it, exactly as the real subtitle behaves), TB :291 → EXP :382
          (status "pending", hardcoded in the real pipe). */}

      {/* 1. SRC — mirrors BooksPipeline.tsx:184-242. */}
      <BookkeepingSection title="Source Accounts" pipelineKey="SRC" subtitle="3 connected" status="complete" collapsible defaultCollapsed={false}>
        <StageTruthStrip real={false} />
        <SourceAccountsStage away={away} />
      </BookkeepingSection>

      {/* 2. CAT — mirrors BooksPipeline.tsx:244-270 + SpendingTab's pending
          table (see CategorizeStage cites). */}
      <BookkeepingSection title="Categorize Transactions" pipelineKey="CAT" subtitle="3 pending" status="action-needed">
        <StageTruthStrip real={false} />
        <CategorizeStage away={away} />
      </BookkeepingSection>

      {/* 3. JE — REAL MOUNT (BooksPipeline.tsx:272-279): zero fetches,
          props-driven (JournalEntryEngine.tsx:46-51); save routes away. The
          same three transactions from CAT, now posted. */}
      <BookkeepingSection title="Journal Entries" pipelineKey="JE" subtitle="3 entries" status="complete">
        <StageTruthStrip real={true} />
        <div className="p-4">
          <JournalEntryEngine journalTransactions={EX_JOURNAL} coaOptions={COA} onSave={awayAsync} onReload={noop} />
        </div>
      </BookkeepingSection>

      {/* 4. LDG — mirrors BooksPipeline.tsx:281-288 wrapping GeneralLedger. */}
      <BookkeepingSection title="General Ledger" pipelineKey="LDG" subtitle="6 entries" status="complete">
        <StageTruthStrip real={false} />
        <div className="p-4">
          <GeneralLedgerStage away={away} />
        </div>
      </BookkeepingSection>

      {/* 5. TB — mirrors BooksPipeline.tsx:290-293 wrapping TrialBalanceSection. */}
      <BookkeepingSection title="Trial Balance" pipelineKey="TB" status="pending">
        <StageTruthStrip real={false} />
        <TrialBalanceStage />
      </BookkeepingSection>

      {/* 6. REC — REAL MOUNT (BooksPipeline.tsx:295-314): zero fetches,
          props-driven (BankReconciliation.tsx:44-50); save routes away. */}
      <BookkeepingSection title="Bank Reconciliation" pipelineKey="REC" status="pending">
        <StageTruthStrip real={true} />
        <div className="p-2">
          <BankReconciliation
            accounts={EX_ACCOUNTS}
            transactions={EX_REC_TXNS}
            reconciliations={EX_RECONCILIATION}
            onSave={awayAsync}
            onReload={noop}
          />
        </div>
      </BookkeepingSection>

      {/* 7. ADJ — mirrors BooksPipeline.tsx:316-319 wrapping AdjustingEntriesTab. */}
      <BookkeepingSection title="Adjusting Entries" pipelineKey="ADJ" status="pending">
        <StageTruthStrip real={false} />
        <AdjustingEntriesStage away={away} />
      </BookkeepingSection>

      {/* 8. STMT — mirrors BooksPipeline.tsx:321-324 wrapping FinancialStatementsTab. */}
      <BookkeepingSection title="Financial Statements" pipelineKey="STMT" status="pending">
        <StageTruthStrip real={false} />
        <StatementsStage />
      </BookkeepingSection>

      {/* 9. TAX-LOT — mirrors BooksPipeline.tsx:326-329 wrapping WashSaleReportTab. */}
      <BookkeepingSection title="Tax Lot Accounting & Wash Sales" pipelineKey="TAX-LOT" status="pending">
        <StageTruthStrip real={false} />
        <WashSalesStage away={away} />
      </BookkeepingSection>

      {/* 10. CLOSE — REAL MOUNT (BooksPipeline.tsx:331-366): zero fetches,
          props-driven (PeriodClose.tsx:27-35); close/reopen route away. */}
      <BookkeepingSection title="Period Close" pipelineKey="CLOSE" status="pending">
        <StageTruthStrip real={true} />
        <div className="p-2">
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
      </BookkeepingSection>

      {/* 11. CLOSE-YE — mirrors BooksPipeline.tsx:368-373 wrapping CloseBooksTab. */}
      <BookkeepingSection title="Year-End Close" pipelineKey="CLOSE-YE" status="pending">
        <StageTruthStrip real={false} />
        <div className="p-2">
          <YearEndCloseStage away={away} />
        </div>
      </BookkeepingSection>

      {/* 12. POS — mirrors BooksPipeline.tsx:375-378 wrapping PositionReportTab. */}
      <BookkeepingSection title="Position Report" pipelineKey="POS" status="pending">
        <StageTruthStrip real={false} />
        <PositionReportStage away={away} />
      </BookkeepingSection>

      {/* 13. EXP — mirrors BooksPipeline.tsx:380-386 wrapping CPAExport. */}
      <BookkeepingSection title="CPA Export" pipelineKey="EXP" status="pending">
        <StageTruthStrip real={false} />
        <div className="p-4">
          <CpaExportStage away={away} />
        </div>
      </BookkeepingSection>

      <p className="text-xs text-text-muted">
        The thirteen stages above are the dashboard&rsquo;s pipe in its real order (SRC → CAT → JE →
        LDG → TB → REC → ADJ → STMT → TAX-LOT → CLOSE → CLOSE-YE → POS → EXP). The cockpit bar and
        three of the stages — journal entries, bank reconciliation, and period close — are the real
        components mounted live on the declared example books; the other ten stages are faithful
        static mirrors of the real screens, each labeled on its section. Same reconciling numbers
        everywhere: assets $12,400 = liabilities $3,100 + equity $9,300; trial balance $17,500 =
        $17,500. A logged-out page fetches nothing; every action takes you to sign-up.
      </p>
    </div>
  );
}
