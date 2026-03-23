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

// ─── Schedule C line labels (for display) ────────────────────

const LINE_LABELS: Record<string, string> = {
  '8': 'Advertising',
  '13': 'Depreciation',
  '15': 'Insurance',
  '16a': 'Interest (mortgage)',
  '16b': 'Interest (other)',
  '17': 'Legal and professional services',
  '18': 'Office expense',
  '20b': 'Rent (other business property)',
  '21': 'Repairs and maintenance',
  '22': 'Supplies',
  '24a': 'Travel',
  '24b': 'Deductible meals',
  '25': 'Utilities',
  '26': 'Wages',
  '27a': 'Other expenses',
};

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
      journal_entry: {
        date: { gte: yearStart, lt: yearEnd },
        status: 'posted',
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

  // Find the sole_prop entity for this user
  const soleEntity = await prisma.entities.findFirst({
    where: { userId, entity_type: 'sole_prop' },
  });

  if (!soleEntity) {
    // Return zeroed-out Schedule C if no sole_prop entity exists
    return {
      taxYear,
      businessName: 'N/A',
      line1: 0, line2: 0, line7: 0,
      expenses: [], line28: 0, line31: 0,
      unmappedAccounts: [], revenueAccounts: [],
    };
  }

  // Fetch all COA accounts for this entity (no B- prefix — entity-scoped)
  const entityAccounts = await prisma.chart_of_accounts.findMany({
    where: {
      userId,
      entity_id: soleEntity.id,
      is_archived: false,
    },
    orderBy: { code: 'asc' },
  });

  // Separate revenue vs expense accounts
  const revenueAccounts = entityAccounts.filter(a => a.account_type === 'revenue');
  const expenseAccounts = entityAccounts.filter(a => a.account_type === 'expense');

  // Fetch account_tax_mappings for schedule_c and this tax year
  const accountIds = entityAccounts.map(a => a.id);
  const taxMappings = await prisma.account_tax_mappings.findMany({
    where: {
      account_id: { in: accountIds },
      tax_form: 'schedule_c',
      tax_year: taxYear,
    },
  });

  // Build map: account_id → { form_line, multiplier }
  const taxMappingByAccountId = new Map<string, { form_line: string; multiplier: number }>();
  for (const tm of taxMappings) {
    taxMappingByAccountId.set(tm.account_id, {
      form_line: tm.form_line,
      multiplier: tm.multiplier.toNumber(),
    });
  }

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
  for (const line of Object.keys(LINE_LABELS)) {
    expenseLineMap.set(line, { accounts: [], total: 0 });
  }

  for (const acct of expenseAccounts) {
    const balance = await getAccountYearBalance(acct.id, acct.balance_type, yearStart, yearEnd);
    if (balance === 0) continue;

    const rawAmount = round2(Math.abs(balance));

    // Use account_tax_mappings to determine Schedule C line
    // form_line values are stored as "line_8", "line_27a" etc. — strip the "line_" prefix
    // to match LINE_LABELS keys ("8", "27a")
    const mapping = taxMappingByAccountId.get(acct.id);
    const rawLine = mapping?.form_line || '27a';
    const line = rawLine.replace(/^line_/, '');
    const multiplier = mapping?.multiplier ?? 1.0;
    const amount = round2(rawAmount * multiplier);

    const lineData = expenseLineMap.get(line) || { accounts: [], total: 0 };
    lineData.accounts.push({ code: acct.code, name: acct.name, amount });
    lineData.total = round2(lineData.total + amount);
    expenseLineMap.set(line, lineData);

    if (!mapping) {
      unmappedAccounts.push({ code: acct.code, name: acct.name, amount });
      console.log(`[Schedule C] Unmapped account → Line 27a: ${acct.code} "${acct.name}" $${amount}`);
    }
  }

  // Build expense lines array
  const expenses: ScheduleCExpenseLine[] = [];
  for (const [line, lineData] of expenseLineMap) {
    if (lineData.total > 0) {
      expenses.push({
        line,
        label: LINE_LABELS[line] || `Line ${line}`,
        amount: lineData.total,
        accounts: lineData.accounts,
      });
    }
  }

  // Sort by line number
  expenses.sort((a, b) => {
    const numA = parseFloat(a.line);
    const numB = parseFloat(b.line);
    return numA - numB;
  });

  const line28 = round2(expenses.reduce((sum, e) => sum + e.amount, 0));
  const line31 = round2(line7 - line28);

  return {
    taxYear,
    businessName: soleEntity.name,
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
