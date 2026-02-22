import { prisma } from '@/lib/prisma';

// ============================================
// Schedule C — Profit or Loss From Business
// (Sole Proprietorship / Single-Member LLC)
// ============================================

export interface ScheduleCLineItem {
  accountCode: string;
  accountName: string;
  amount: number;
  scheduleCLine: string;
}

export interface ScheduleCExpenseLine {
  line: string;
  label: string;
  amount: number;
  accounts: { code: string; name: string; amount: number }[];
}

export interface ScheduleC {
  taxYear: number;
  businessName: string;

  // Part I — Income
  line1: number;   // Gross receipts or sales
  line2: number;   // Returns and allowances
  line7: number;   // Gross income (line 1 - line 2)

  // Part II — Expenses
  expenses: ScheduleCExpenseLine[];
  line28: number;  // Total expenses
  line31: number;  // Net profit or (loss): line 7 - line 28

  // Unmapped accounts (logged, placed in Line 27a Other)
  unmappedAccounts: { code: string; name: string; amount: number }[];

  // All revenue accounts found
  revenueAccounts: { code: string; name: string; amount: number }[];
}

export interface ScheduleSE {
  line2: number;   // Net profit from Schedule C (Line 31)
  line3: number;   // Line 2 × 0.9235
  line12: number;  // SE tax = Line 3 × 0.153
  line13: number;  // Deductible half = Line 12 × 0.50
}

// ─── Name-pattern → Schedule C line mapping ────────────────────

interface LineMapping {
  line: string;
  label: string;
  patterns: string[];
}

const EXPENSE_LINE_MAPPINGS: LineMapping[] = [
  { line: '8', label: 'Advertising', patterns: ['advertising', 'marketing'] },
  { line: '13', label: 'Depreciation', patterns: ['depreciation', 'amortization'] },
  { line: '15', label: 'Insurance', patterns: ['insurance'] },
  { line: '16a', label: 'Interest (mortgage)', patterns: [] },
  { line: '16b', label: 'Interest (other)', patterns: ['interest expense', 'interest'] },
  { line: '17', label: 'Legal and professional services', patterns: ['legal', 'professional', 'accounting', 'cpa', 'attorney', 'lawyer'] },
  { line: '18', label: 'Office expense', patterns: ['office'] },
  { line: '20b', label: 'Rent (other business property)', patterns: ['rent'] },
  { line: '21', label: 'Repairs and maintenance', patterns: ['repair', 'maintenance'] },
  { line: '22', label: 'Supplies', patterns: ['supplies', 'supply'] },
  { line: '24a', label: 'Travel', patterns: ['travel'] },
  { line: '24b', label: 'Deductible meals', patterns: ['meal', 'entertainment', 'dining'] },
  { line: '25', label: 'Utilities', patterns: ['utilit', 'telephone', 'internet', 'phone'] },
  { line: '26', label: 'Wages', patterns: ['wage', 'salar', 'payroll'] },
  { line: '27a', label: 'Other expenses', patterns: [] }, // Catch-all
];

function mapAccountToLine(accountName: string): string {
  const lower = accountName.toLowerCase();
  for (const mapping of EXPENSE_LINE_MAPPINGS) {
    if (mapping.line === '27a') continue; // Skip catch-all
    if (mapping.patterns.some(p => lower.includes(p))) {
      return mapping.line;
    }
  }
  return '27a'; // Default to Other
}

// ─── Year-filtered account balance calculation ─────────────────

async function getAccountYearBalance(
  accountId: string,
  balanceType: string,
  yearStart: Date,
  yearEnd: Date
): Promise<number> {
  const entries = await prisma.ledger_entries.findMany({
    where: {
      account_id: accountId,
      journal_transactions: {
        transaction_date: { gte: yearStart, lt: yearEnd },
      },
    },
    select: { amount: true, entry_type: true },
  });

  let net = BigInt(0);
  for (const e of entries) {
    // For credit-normal accounts (revenue): credits increase, debits decrease
    // For debit-normal accounts (expense): debits increase, credits decrease
    if (balanceType === 'C') {
      net += e.entry_type === 'C' ? e.amount : -e.amount;
    } else {
      net += e.entry_type === 'D' ? e.amount : -e.amount;
    }
  }

  const yearBalance = Number(net) / 100;

  // If no ledger entries exist for the year, fall back to settled_balance
  // (only if there were truly no entries — the balance might be from prior years)
  if (entries.length === 0) {
    const account = await prisma.chart_of_accounts.findUnique({
      where: { id: accountId },
      select: { settled_balance: true },
    });
    if (account && account.settled_balance !== BigInt(0)) {
      return Number(account.settled_balance) / 100;
    }
  }

  return yearBalance;
}

// ─── Main Schedule C generator ─────────────────────────────────

export async function generateScheduleC(
  userId: string,
  taxYear: number
): Promise<ScheduleC> {
  const yearStart = new Date(`${taxYear}-01-01T00:00:00.000Z`);
  const yearEnd = new Date(`${taxYear + 1}-01-01T00:00:00.000Z`);

  // Fetch all B- accounts for this user
  const bAccounts = await prisma.chart_of_accounts.findMany({
    where: {
      userId,
      code: { startsWith: 'B-' },
      is_archived: false,
    },
    orderBy: { code: 'asc' },
  });

  // Separate revenue vs expense accounts
  const revenueAccounts = bAccounts.filter((a: { account_type: string }) => a.account_type === 'revenue');
  const expenseAccounts = bAccounts.filter((a: { account_type: string }) => a.account_type === 'expense');

  // Calculate year balances for revenue accounts
  const revenueItems: { code: string; name: string; amount: number }[] = [];
  for (const acct of revenueAccounts) {
    const balance = await getAccountYearBalance(acct.id, acct.balance_type, yearStart, yearEnd);
    if (balance !== 0) {
      revenueItems.push({ code: acct.code, name: acct.name, amount: round2(Math.abs(balance)) });
    }
  }

  // Line 1: Gross receipts
  const line1 = round2(revenueItems.reduce((sum, r) => sum + r.amount, 0));
  const line2 = 0; // Returns/allowances — not tracked separately yet
  const line7 = round2(line1 - line2);

  // Calculate year balances for expense accounts and map to Schedule C lines
  const expenseLineMap = new Map<string, { accounts: { code: string; name: string; amount: number }[]; total: number }>();
  const unmappedAccounts: { code: string; name: string; amount: number }[] = [];

  // Initialize all lines
  for (const mapping of EXPENSE_LINE_MAPPINGS) {
    expenseLineMap.set(mapping.line, { accounts: [], total: 0 });
  }

  for (const acct of expenseAccounts) {
    const balance = await getAccountYearBalance(acct.id, acct.balance_type, yearStart, yearEnd);
    if (balance === 0) continue;

    const amount = round2(Math.abs(balance));
    const line = mapAccountToLine(acct.name);

    const lineData = expenseLineMap.get(line) || { accounts: [], total: 0 };
    lineData.accounts.push({ code: acct.code, name: acct.name, amount });
    lineData.total = round2(lineData.total + amount);
    expenseLineMap.set(line, lineData);

    if (line === '27a') {
      unmappedAccounts.push({ code: acct.code, name: acct.name, amount });
      console.log(`[Schedule C] Unmapped account → Line 27a: ${acct.code} "${acct.name}" $${amount}`);
    }
  }

  // Build expense lines array
  const expenses: ScheduleCExpenseLine[] = [];
  for (const mapping of EXPENSE_LINE_MAPPINGS) {
    const lineData = expenseLineMap.get(mapping.line);
    if (lineData && lineData.total > 0) {
      expenses.push({
        line: mapping.line,
        label: mapping.label,
        amount: lineData.total,
        accounts: lineData.accounts,
      });
    }
  }

  const line28 = round2(expenses.reduce((sum, e) => sum + e.amount, 0));
  const line31 = round2(line7 - line28);

  return {
    taxYear,
    businessName: 'Temple Stuart LLC',
    line1,
    line2,
    line7,
    expenses,
    line28,
    line31,
    unmappedAccounts,
    revenueAccounts: revenueItems,
  };
}

// ─── Schedule SE generator ─────────────────────────────────────

export function generateScheduleSE(scheduleCNetProfit: number): ScheduleSE {
  const line2 = round2(scheduleCNetProfit);
  const line3 = round2(line2 * 0.9235);
  const line12 = round2(line3 * 0.153);
  const line13 = round2(line12 * 0.50);

  return { line2, line3, line12, line13 };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
