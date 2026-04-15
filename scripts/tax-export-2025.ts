/*
 * ═══════════════════════════════════════════════════════════════════════
 * Temple Stuart — 2025 Tax Export Script
 *
 * READ-ONLY: this script performs zero writes (no insert / update /
 * delete / upsert). It connects to the database specified by
 * DATABASE_URL, aggregates ledger + trading data for tax year 2025,
 * and writes CSVs + a plain-text summary to ./exports/.
 *
 * Run:
 *   npm run tax:export:2025
 *
 * Output files:
 *   exports/schedule-c-2025-lines.csv
 *   exports/schedule-c-2025-detail.csv
 *   exports/form-8949-2025.csv          (TaxAct import format)
 *   exports/schedule-d-2025-summary.csv
 *   exports/tax-filing-summary-2025.txt
 * ═══════════════════════════════════════════════════════════════════════
 */

import { PrismaClient } from '@prisma/client';
import { promises as fs } from 'fs';
import path from 'path';

// ─── Configuration ──────────────────────────────────────────────────────

const TAX_YEAR = 2025;
const USER_ID = 'cmfi3rcrl0000zcj0ajbj4za5';
const ENTITIES = {
  business: '9e8ee102-5b75-445b-a1ba-b7226a208b4a', // sole_prop
  trading: '972658cc-c1ca-4178-b77e-fad32a89a823',
  personal: 'e83f5b3a-0b46-4c73-8b91-1b736ecdd3eb',
};

const YEAR_START = new Date(`${TAX_YEAR}-01-01T00:00:00.000Z`);
const YEAR_END = new Date(`${TAX_YEAR + 1}-01-01T00:00:00.000Z`);

const OUTPUT_DIR = path.resolve(process.cwd(), 'exports');

// Schedule C line labels (mirror of src/lib/schedule-c-service.ts LINE_LABELS)
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

// Form 8949 CSV columns (must match src/lib/tax-report-service.ts generateForm8949CSV)
const FORM_8949_HEADERS = [
  'Description',
  'Date Acquired',
  'Date Sold',
  'Proceeds',
  'Cost Basis',
  'Adjustment Code',
  'Adjustment Amount',
  'Gain or Loss',
  'Short/Long Term',
  'Box',
];

const BROKER_SOURCES = new Set(['plaid', 'tastytrade', 'robinhood']);

// ─── Helpers ────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function fmtMoney(n: number): string {
  return n.toFixed(2);
}

function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function rowsToCSV(rows: unknown[][]): string {
  return rows.map((r) => r.map(csvEscape).join(',')).join('\n');
}

function determineBox(isLongTerm: boolean, source: string | null): string {
  const normalized = source ? source.toLowerCase() : null;
  const isBrokerImported =
    normalized !== null && BROKER_SOURCES.has(normalized);
  if (isLongTerm) return isBrokerImported ? 'D' : 'E';
  return isBrokerImported ? 'A' : 'B';
}

function log(msg: string): void {
  // eslint-disable-next-line no-console
  console.log(msg);
}

function fmtISODate(d: Date): string {
  return d.toISOString().split('T')[0];
}

async function ensureOutputDir(): Promise<void> {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
}

async function writeFile(name: string, content: string): Promise<void> {
  const p = path.join(OUTPUT_DIR, name);
  await fs.writeFile(p, content, 'utf8');
}

// ─── Script body ────────────────────────────────────────────────────────

async function main() {
  log('=== Temple Stuart Tax Export 2025 ===');

  if (!process.env.DATABASE_URL) {
    // eslint-disable-next-line no-console
    console.error(
      'ERROR: DATABASE_URL is not set. Configure the connection string in your environment before running this script.'
    );
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
    log('Database connected.');
    log(`User: ${USER_ID}`);
    log(
      `Date window: ${fmtISODate(YEAR_START)} (inclusive) to ${fmtISODate(YEAR_END)} (exclusive)`
    );

    await ensureOutputDir();

    // ─── Schedule C (Business entity) ─────────────────────────────────
    log('--- Schedule C (Business Entity) ---');

    // Pull all posted, non-reversed ledger entries for this entity in the year.
    const ledgerRows: Array<{
      account_id: string;
      code: string;
      name: string;
      account_type: string;
      entry_type: string;
      amount: string; // BigInt → text
      date: Date;
    }> = await prisma.$queryRawUnsafe(
      `
        SELECT
          coa.id::text AS account_id,
          coa.code,
          coa.name,
          coa.account_type,
          le.entry_type,
          le.amount::text AS amount,
          je.date
        FROM ledger_entries le
        JOIN journal_entries je ON le.journal_entry_id = je.id
        JOIN chart_of_accounts coa ON le.account_id = coa.id
        WHERE je."userId" = $1
          AND je.is_reversal = false
          AND je.reversed_by_entry_id IS NULL
          AND je.entity_id = $2
          AND je.date >= $3
          AND je.date <  $4
        ORDER BY je.date, le.id
      `,
      USER_ID,
      ENTITIES.business,
      YEAR_START,
      YEAR_END
    );

    // Ledger balance check (debits must equal credits for a valid double-entry set).
    let totalDebitsCents = 0n;
    let totalCreditsCents = 0n;
    let minDate: Date | null = null;
    let maxDate: Date | null = null;
    for (const r of ledgerRows) {
      const cents = BigInt(r.amount);
      if (r.entry_type === 'D') totalDebitsCents += cents;
      else if (r.entry_type === 'C') totalCreditsCents += cents;
      if (!minDate || r.date < minDate) minDate = r.date;
      if (!maxDate || r.date > maxDate) maxDate = r.date;
    }

    const ledgerBalanced = totalDebitsCents === totalCreditsCents;
    log(
      `Ledger entries: ${ledgerRows.length.toLocaleString()}${
        minDate && maxDate
          ? ` (${fmtISODate(minDate)} to ${fmtISODate(maxDate)})`
          : ''
      }`
    );
    log(
      `Ledger balance check: ${ledgerBalanced ? '✓ (debits = credits)' : '✗ OUT OF BALANCE'}`
    );
    if (!ledgerBalanced) {
      log(
        `  debits=${(Number(totalDebitsCents) / 100).toFixed(2)}  credits=${(Number(totalCreditsCents) / 100).toFixed(2)}`
      );
    }

    // Fetch the account_tax_mappings that bind each account to a Schedule C line.
    const accountIds = Array.from(new Set(ledgerRows.map((r) => r.account_id)));
    const mappings: Array<{
      account_id: string;
      form_line: string;
      multiplier: string; // Decimal → text
    }> =
      accountIds.length === 0
        ? []
        : await prisma.$queryRawUnsafe(
            `
              SELECT account_id::text AS account_id,
                     form_line,
                     multiplier::text AS multiplier
              FROM account_tax_mappings
              WHERE tax_form = 'schedule_c'
                AND tax_year = $1
                AND account_id::text = ANY($2::text[])
            `,
            TAX_YEAR,
            accountIds
          );

    const mappingByAccount = new Map<
      string,
      { line: string; multiplier: number }
    >();
    for (const m of mappings) {
      const line = m.form_line.replace(/^line_/, '');
      mappingByAccount.set(m.account_id, {
        line,
        multiplier: parseFloat(m.multiplier),
      });
    }

    // Aggregate per account.
    interface AcctAgg {
      code: string;
      name: string;
      accountType: string;
      debitsCents: bigint;
      creditsCents: bigint;
      entryCount: number;
    }
    const acctAgg = new Map<string, AcctAgg>();
    for (const r of ledgerRows) {
      let a = acctAgg.get(r.account_id);
      if (!a) {
        a = {
          code: r.code,
          name: r.name,
          accountType: r.account_type,
          debitsCents: 0n,
          creditsCents: 0n,
          entryCount: 0,
        };
        acctAgg.set(r.account_id, a);
      }
      const c = BigInt(r.amount);
      if (r.entry_type === 'D') a.debitsCents += c;
      else if (r.entry_type === 'C') a.creditsCents += c;
      a.entryCount += 1;
    }

    // Schedule C Line 1: revenue accounts (credit-normal → credits − debits).
    let line1 = 0;
    const revenueItems: Array<{
      code: string;
      name: string;
      amount: number;
      entryCount: number;
    }> = [];
    for (const [, a] of acctAgg) {
      if (a.accountType !== 'revenue') continue;
      const net =
        Number(a.creditsCents - a.debitsCents) / 100; // credit-normal
      if (net === 0) continue;
      revenueItems.push({
        code: a.code,
        name: a.name,
        amount: round2(Math.abs(net)),
        entryCount: a.entryCount,
      });
      line1 = round2(line1 + Math.abs(net));
    }

    // Schedule C expenses: aggregate into lines via mappings; unmapped → 27a.
    interface LineAgg {
      line: string;
      label: string;
      amount: number;
      accounts: Array<{
        code: string;
        name: string;
        amount: number;
        entryCount: number;
      }>;
    }
    const lineAgg = new Map<string, LineAgg>();
    const unmappedAccounts: Array<{ code: string; name: string; amount: number }> = [];
    for (const line of Object.keys(LINE_LABELS)) {
      lineAgg.set(line, {
        line,
        label: LINE_LABELS[line],
        amount: 0,
        accounts: [],
      });
    }

    for (const [accountId, a] of acctAgg) {
      if (a.accountType !== 'expense') continue;
      // Expense accounts are debit-normal → debits − credits.
      const raw =
        Number(a.debitsCents - a.creditsCents) / 100;
      if (raw === 0) continue;
      const rawAmount = round2(Math.abs(raw));
      const mapping = mappingByAccount.get(accountId);
      const line = mapping?.line || '27a';
      const multiplier = mapping?.multiplier ?? 1.0;
      const contribution = round2(rawAmount * multiplier);
      const bucket =
        lineAgg.get(line) ||
        (lineAgg.set(line, {
          line,
          label: LINE_LABELS[line] || `Line ${line}`,
          amount: 0,
          accounts: [],
        }) && lineAgg.get(line)!);
      bucket.accounts.push({
        code: a.code,
        name: a.name,
        amount: contribution,
        entryCount: a.entryCount,
      });
      bucket.amount = round2(bucket.amount + contribution);
      if (!mapping) {
        unmappedAccounts.push({ code: a.code, name: a.name, amount: contribution });
      }
    }

    const activeLines = Array.from(lineAgg.values())
      .filter((l) => l.amount !== 0)
      .sort((x, y) => parseFloat(x.line) - parseFloat(y.line));

    const line28 = round2(
      activeLines.reduce((s, l) => s + l.amount, 0)
    );
    const line31 = round2(line1 - line28);

    log(`Expense lines: ${activeLines.length}`);
    log(`Unmapped accounts: ${unmappedAccounts.length}`);

    // schedule-c-2025-lines.csv
    {
      const rows: unknown[][] = [
        ['Schedule C Line', 'IRS Label', 'Total Amount', 'Account Count'],
      ];
      if (line1 !== 0) {
        rows.push([
          '1',
          'Gross receipts',
          fmtMoney(line1),
          String(revenueItems.length),
        ]);
      }
      for (const line of activeLines) {
        rows.push([
          line.line,
          line.label,
          fmtMoney(line.amount),
          String(line.accounts.length),
        ]);
      }
      rows.push(['28', 'Total expenses', fmtMoney(line28), '']);
      rows.push(['31', 'Net profit or (loss)', fmtMoney(line31), '']);
      await writeFile('schedule-c-2025-lines.csv', rowsToCSV(rows));
      log(`→ exports/schedule-c-2025-lines.csv (${rows.length - 1} rows)`);
    }

    // schedule-c-2025-detail.csv
    {
      const rows: unknown[][] = [
        [
          'Schedule C Line',
          'Account Code',
          'Account Name',
          'Amount',
          'Entry Count',
        ],
      ];
      for (const r of revenueItems.sort((a, b) => b.amount - a.amount)) {
        rows.push(['1', r.code, r.name, fmtMoney(r.amount), String(r.entryCount)]);
      }
      for (const line of activeLines) {
        const sorted = [...line.accounts].sort((a, b) => b.amount - a.amount);
        for (const a of sorted) {
          rows.push([
            line.line,
            a.code,
            a.name,
            fmtMoney(a.amount),
            String(a.entryCount),
          ]);
        }
      }
      await writeFile('schedule-c-2025-detail.csv', rowsToCSV(rows));
      log(`→ exports/schedule-c-2025-detail.csv (${rows.length - 1} rows)`);
    }

    // ─── Schedule D / Form 8949 (Trading Entity) ───────────────────────
    log('--- Schedule D / Form 8949 (Trading Entity) ---');

    // Stock dispositions (scoped by user; lots are user-owned)
    const stockDispRows: Array<{
      lot_id: string;
      symbol: string;
      acquired_date: Date;
      investment_txn_id: string;
      disposed_date: Date;
      quantity_disposed: number;
      proceeds_per_share: number;
      total_proceeds: number;
      cost_basis_disposed: number;
      realized_gain_loss: number;
      holding_period_days: number;
      is_long_term: boolean;
      is_wash_sale: boolean;
      wash_sale_loss: number;
    }> = await prisma.$queryRawUnsafe(
      `
        SELECT
          l.id::text             AS lot_id,
          l.symbol,
          l.acquired_date,
          l.investment_txn_id,
          d.disposed_date,
          d.quantity_disposed,
          d.proceeds_per_share,
          d.total_proceeds,
          d.cost_basis_disposed,
          d.realized_gain_loss,
          d.holding_period_days,
          d.is_long_term,
          d.is_wash_sale,
          d.wash_sale_loss
        FROM lot_dispositions d
        JOIN stock_lots l ON d.lot_id = l.id
        WHERE l.user_id = $1
          AND d.disposed_date >= $2
          AND d.disposed_date <  $3
        ORDER BY d.disposed_date
      `,
      USER_ID,
      YEAR_START,
      YEAR_END
    );

    // Stock lot source map (for Box coding: broker-reported vs manual)
    const lotTxnIds = Array.from(
      new Set(stockDispRows.map((r) => r.investment_txn_id).filter(Boolean))
    );
    const txnSourceRows: Array<{ id: string; source: string | null }> =
      lotTxnIds.length === 0
        ? []
        : await prisma.$queryRawUnsafe(
            `
              SELECT it.id, a.source
              FROM investment_transactions it
              JOIN accounts a ON it."accountId" = a.id
              WHERE it.id = ANY($1::text[])
            `,
            lotTxnIds
          );
    const sourceByTxnId = new Map<string, string | null>();
    for (const r of txnSourceRows) sourceByTxnId.set(r.id, r.source);

    // Closed option positions for this year (scoped by user via accounts)
    const closedPositions: Array<{
      id: string;
      symbol: string;
      option_type: string | null;
      strike_price: number | null;
      expiration_date: Date | null;
      position_type: string;
      quantity: number;
      open_date: Date;
      cost_basis: number;
      close_date: Date;
      proceeds: number | null;
      realized_pl: number | null;
      source: string | null;
    }> = await prisma.$queryRawUnsafe(
      `
        SELECT
          tp.id::text AS id,
          tp.symbol,
          tp.option_type,
          tp.strike_price,
          tp.expiration_date,
          tp.position_type,
          tp.quantity,
          tp.open_date,
          tp.cost_basis,
          tp.close_date,
          tp.proceeds,
          tp.realized_pl,
          tp.source
        FROM trading_positions tp
        JOIN investment_transactions it ON tp.open_investment_txn_id = it.id
        JOIN accounts a ON it."accountId" = a.id
        WHERE a."userId" = $1
          AND tp.status = 'CLOSED'
          AND tp.close_date >= $2
          AND tp.close_date <  $3
        ORDER BY tp.close_date
      `,
      USER_ID,
      YEAR_START,
      YEAR_END
    );

    log(`Closed option positions: ${closedPositions.length.toLocaleString()}`);
    log(`Lot dispositions: ${stockDispRows.length.toLocaleString()}`);

    if (stockDispRows.length === 0 && closedPositions.length === 0) {
      log('⚠ No trading data for 2025 — creating empty CSVs with headers');
    }

    interface F8949 {
      description: string;
      dateAcquired: string;
      dateSold: string;
      proceeds: number;
      costBasis: number;
      adjustmentCode: string;
      adjustmentAmount: number;
      gainOrLoss: number;
      isLongTerm: boolean;
      box: string;
    }

    const entries: F8949[] = [];

    for (const d of stockDispRows) {
      const adjustment = d.is_wash_sale ? Number(d.wash_sale_loss) : 0;
      const gl =
        Number(d.total_proceeds) -
        Number(d.cost_basis_disposed) +
        adjustment;
      const source = sourceByTxnId.get(d.investment_txn_id) ?? null;
      entries.push({
        description: `${d.quantity_disposed} sh ${d.symbol}`,
        dateAcquired: fmtISODate(d.acquired_date),
        dateSold: fmtISODate(d.disposed_date),
        proceeds: round2(Number(d.total_proceeds)),
        costBasis: round2(Number(d.cost_basis_disposed)),
        adjustmentCode: d.is_wash_sale ? 'W' : '',
        adjustmentAmount: round2(adjustment),
        gainOrLoss: round2(gl),
        isLongTerm: d.is_long_term,
        box: determineBox(d.is_long_term, source),
      });
    }

    for (const p of closedPositions) {
      const MS_PER_DAY = 24 * 60 * 60 * 1000;
      const holdingDays = Math.floor(
        (p.close_date.getTime() - p.open_date.getTime()) / MS_PER_DAY
      );
      const isLongTerm = holdingDays >= 366;
      const proceeds = Number(p.proceeds ?? 0);
      const costBasis = Number(p.cost_basis);
      const gl =
        p.realized_pl != null ? Number(p.realized_pl) : proceeds - costBasis;

      // Build option-style description: "1 AAPL Jan 20 2025 $150 Call"
      const qty = Math.abs(p.quantity);
      const strike = p.strike_price != null ? `$${p.strike_price}` : '';
      const exp = p.expiration_date
        ? p.expiration_date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
        : '';
      const type = p.option_type || 'Option';
      const underlying = p.symbol.split(/\s+/)[0] || p.symbol;
      const description =
        `${qty} ${underlying} ${exp} ${strike} ${type}`.replace(/\s+/g, ' ').trim();

      entries.push({
        description,
        dateAcquired: fmtISODate(p.open_date),
        dateSold: fmtISODate(p.close_date),
        proceeds: round2(proceeds),
        costBasis: round2(costBasis),
        adjustmentCode: '',
        adjustmentAmount: 0,
        gainOrLoss: round2(gl),
        isLongTerm,
        box: determineBox(isLongTerm, p.source),
      });
    }

    entries.sort((a, b) => a.dateSold.localeCompare(b.dateSold));

    // form-8949-2025.csv (TaxAct import format)
    {
      const rows: unknown[][] = [FORM_8949_HEADERS];
      for (const e of entries) {
        rows.push([
          e.description,
          e.dateAcquired,
          e.dateSold,
          fmtMoney(e.proceeds),
          fmtMoney(e.costBasis),
          e.adjustmentCode,
          e.adjustmentAmount !== 0 ? fmtMoney(e.adjustmentAmount) : '',
          fmtMoney(e.gainOrLoss),
          e.isLongTerm ? 'Long-term' : 'Short-term',
          e.box,
        ]);
      }
      await writeFile('form-8949-2025.csv', rowsToCSV(rows));
      log(`→ exports/form-8949-2025.csv (${entries.length} rows)`);
    }

    // Schedule D summary by Box
    interface SDBucket {
      part: string;
      box: string;
      description: string;
      proceeds: number;
      costBasis: number;
      adjustments: number;
      gainOrLoss: number;
    }
    const sdBuckets: Record<string, SDBucket> = {
      A: {
        part: 'I',
        box: 'A',
        description: 'Short-term, basis reported (Box A)',
        proceeds: 0,
        costBasis: 0,
        adjustments: 0,
        gainOrLoss: 0,
      },
      B: {
        part: 'I',
        box: 'B',
        description: 'Short-term, basis NOT reported (Box B)',
        proceeds: 0,
        costBasis: 0,
        adjustments: 0,
        gainOrLoss: 0,
      },
      C: {
        part: 'I',
        box: 'C',
        description: 'Short-term, no 1099-B (Box C)',
        proceeds: 0,
        costBasis: 0,
        adjustments: 0,
        gainOrLoss: 0,
      },
      D: {
        part: 'II',
        box: 'D',
        description: 'Long-term, basis reported (Box D)',
        proceeds: 0,
        costBasis: 0,
        adjustments: 0,
        gainOrLoss: 0,
      },
      E: {
        part: 'II',
        box: 'E',
        description: 'Long-term, basis NOT reported (Box E)',
        proceeds: 0,
        costBasis: 0,
        adjustments: 0,
        gainOrLoss: 0,
      },
      F: {
        part: 'II',
        box: 'F',
        description: 'Long-term, no 1099-B (Box F)',
        proceeds: 0,
        costBasis: 0,
        adjustments: 0,
        gainOrLoss: 0,
      },
    };
    for (const e of entries) {
      const b = sdBuckets[e.box];
      if (!b) continue;
      b.proceeds = round2(b.proceeds + e.proceeds);
      b.costBasis = round2(b.costBasis + e.costBasis);
      b.adjustments = round2(b.adjustments + e.adjustmentAmount);
      b.gainOrLoss = round2(b.gainOrLoss + e.gainOrLoss);
    }

    const stTotal = {
      proceeds: round2(
        sdBuckets.A.proceeds + sdBuckets.B.proceeds + sdBuckets.C.proceeds
      ),
      costBasis: round2(
        sdBuckets.A.costBasis + sdBuckets.B.costBasis + sdBuckets.C.costBasis
      ),
      adjustments: round2(
        sdBuckets.A.adjustments + sdBuckets.B.adjustments + sdBuckets.C.adjustments
      ),
      gainOrLoss: round2(
        sdBuckets.A.gainOrLoss + sdBuckets.B.gainOrLoss + sdBuckets.C.gainOrLoss
      ),
    };
    const ltTotal = {
      proceeds: round2(
        sdBuckets.D.proceeds + sdBuckets.E.proceeds + sdBuckets.F.proceeds
      ),
      costBasis: round2(
        sdBuckets.D.costBasis + sdBuckets.E.costBasis + sdBuckets.F.costBasis
      ),
      adjustments: round2(
        sdBuckets.D.adjustments + sdBuckets.E.adjustments + sdBuckets.F.adjustments
      ),
      gainOrLoss: round2(
        sdBuckets.D.gainOrLoss + sdBuckets.E.gainOrLoss + sdBuckets.F.gainOrLoss
      ),
    };
    const netGL = round2(stTotal.gainOrLoss + ltTotal.gainOrLoss);

    // schedule-d-2025-summary.csv
    {
      const rows: unknown[][] = [
        [
          'Part',
          'Box',
          'Description',
          'Proceeds',
          'Cost Basis',
          'Adjustments',
          'Gain/Loss',
        ],
      ];
      for (const key of ['A', 'B', 'C'] as const) {
        const b = sdBuckets[key];
        rows.push([
          b.part,
          b.box,
          b.description,
          fmtMoney(b.proceeds),
          fmtMoney(b.costBasis),
          fmtMoney(b.adjustments),
          fmtMoney(b.gainOrLoss),
        ]);
      }
      rows.push([
        'I',
        '',
        'Net short-term (Line 7)',
        fmtMoney(stTotal.proceeds),
        fmtMoney(stTotal.costBasis),
        fmtMoney(stTotal.adjustments),
        fmtMoney(stTotal.gainOrLoss),
      ]);
      for (const key of ['D', 'E', 'F'] as const) {
        const b = sdBuckets[key];
        rows.push([
          b.part,
          b.box,
          b.description,
          fmtMoney(b.proceeds),
          fmtMoney(b.costBasis),
          fmtMoney(b.adjustments),
          fmtMoney(b.gainOrLoss),
        ]);
      }
      rows.push([
        'II',
        '',
        'Net long-term (Line 15)',
        fmtMoney(ltTotal.proceeds),
        fmtMoney(ltTotal.costBasis),
        fmtMoney(ltTotal.adjustments),
        fmtMoney(ltTotal.gainOrLoss),
      ]);
      rows.push([
        '',
        '',
        'Net capital gain/(loss) — Line 16',
        fmtMoney(round2(stTotal.proceeds + ltTotal.proceeds)),
        fmtMoney(round2(stTotal.costBasis + ltTotal.costBasis)),
        fmtMoney(round2(stTotal.adjustments + ltTotal.adjustments)),
        fmtMoney(netGL),
      ]);
      await writeFile('schedule-d-2025-summary.csv', rowsToCSV(rows));
      log(`→ exports/schedule-d-2025-summary.csv (${rows.length - 1} rows)`);
    }

    // Wash sale aggregate
    const washCount = entries.filter((e) => e.adjustmentCode === 'W').length;
    const washDisallowed = round2(
      entries.reduce((s, e) => s + (e.adjustmentCode === 'W' ? e.adjustmentAmount : 0), 0)
    );

    // ─── Summary text ─────────────────────────────────────────────────
    log('--- Summary ---');

    const warnings: string[] = [];
    if (!ledgerBalanced) {
      warnings.push(
        `Ledger out of balance: debits ${(Number(totalDebitsCents) / 100).toFixed(2)} vs credits ${(Number(totalCreditsCents) / 100).toFixed(2)}`
      );
    }
    if (unmappedAccounts.length > 0) {
      warnings.push(
        `${unmappedAccounts.length} unmapped account(s) defaulted to Line 27a: ${unmappedAccounts.map((a) => `${a.code} ${a.name} ${fmtMoney(a.amount)}`).join('; ')}`
      );
    }
    if (stockDispRows.length === 0 && closedPositions.length === 0) {
      warnings.push('No trading data for 2025.');
    }
    if (ledgerRows.length === 0) {
      warnings.push('No business ledger entries for 2025.');
    }

    // Date ranges across all sources
    let tradingMin: Date | null = null;
    let tradingMax: Date | null = null;
    for (const d of stockDispRows) {
      if (!tradingMin || d.disposed_date < tradingMin) tradingMin = d.disposed_date;
      if (!tradingMax || d.disposed_date > tradingMax) tradingMax = d.disposed_date;
    }
    for (const p of closedPositions) {
      if (!tradingMin || p.close_date < tradingMin) tradingMin = p.close_date;
      if (!tradingMax || p.close_date > tradingMax) tradingMax = p.close_date;
    }

    const summaryLines = [
      '=== Temple Stuart Tax Filing Summary — 2025 ===',
      '',
      `Generated: ${new Date().toISOString()}`,
      `User: ${USER_ID}`,
      `Date window: ${fmtISODate(YEAR_START)} (incl.) to ${fmtISODate(YEAR_END)} (excl.)`,
      '',
      '--- Schedule C (Business) ---',
      `Entity ID: ${ENTITIES.business}`,
      `Ledger entries: ${ledgerRows.length.toLocaleString()}`,
      minDate && maxDate
        ? `Ledger date range: ${fmtISODate(minDate)} → ${fmtISODate(maxDate)}`
        : 'Ledger date range: —',
      `Ledger balance check: ${ledgerBalanced ? 'OK (debits = credits)' : 'OUT OF BALANCE'}`,
      `Line 1 — Gross receipts:   $${fmtMoney(line1)}`,
      `Line 28 — Total expenses:  $${fmtMoney(line28)}`,
      `Line 31 — Net profit/loss: $${fmtMoney(line31)}`,
      `Active expense lines: ${activeLines.length}`,
      `Unmapped accounts (→ Line 27a): ${unmappedAccounts.length}`,
      '',
      '--- Schedule D / Form 8949 (Trading) ---',
      `Entity ID: ${ENTITIES.trading}`,
      `Lot dispositions: ${stockDispRows.length.toLocaleString()}`,
      `Closed option positions: ${closedPositions.length.toLocaleString()}`,
      `Form 8949 entries (total): ${entries.length}`,
      tradingMin && tradingMax
        ? `Trading date range: ${fmtISODate(tradingMin)} → ${fmtISODate(tradingMax)}`
        : 'Trading date range: —',
      `Short-term gain/(loss): $${fmtMoney(stTotal.gainOrLoss)}`,
      `Long-term gain/(loss):  $${fmtMoney(ltTotal.gainOrLoss)}`,
      `Net capital gain/(loss) — Line 16: $${fmtMoney(netGL)}`,
      netGL < -3000
        ? `  → Net loss exceeds $3,000 limit. $${fmtMoney(Math.abs(netGL) - 3000)} carries forward.`
        : '',
      `Wash sales: ${washCount}  ·  Total disallowed: $${fmtMoney(washDisallowed)}`,
      '',
      '--- Warnings ---',
      warnings.length === 0 ? 'None.' : warnings.map((w) => `• ${w}`).join('\n'),
      '',
      '--- Output files ---',
      '• exports/schedule-c-2025-lines.csv',
      '• exports/schedule-c-2025-detail.csv',
      '• exports/form-8949-2025.csv',
      '• exports/schedule-d-2025-summary.csv',
      '• exports/tax-filing-summary-2025.txt  (this file)',
      '',
      'This export is READ-ONLY — no database writes were performed.',
    ].filter((s) => s !== '');

    await writeFile('tax-filing-summary-2025.txt', summaryLines.join('\n') + '\n');
    log('→ exports/tax-filing-summary-2025.txt');
    log('Done.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('ERROR:', err);
  process.exit(1);
});
