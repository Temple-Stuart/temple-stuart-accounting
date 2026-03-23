import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { generateScheduleC, generateScheduleSE } from '@/lib/schedule-c-service';
import { generateForm8949, generateScheduleD } from '@/lib/tax-report-service';
import { generateForm1040 } from '@/lib/form-1040-service';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ═══════════════════════════════════════════════════════════════
// Source-traced line item — every dollar amount links to its origin
// ═══════════════════════════════════════════════════════════════

interface SourceEntry {
  date: string;
  description: string;
  amount: number;
  journal_entry_id?: string;
  id?: string;
}

interface LineSource {
  type: string;        // 'ledger_entries', 'trading_positions', 'lot_dispositions', 'tax_document', 'calculated'
  account_code?: string;
  account_name?: string;
  description?: string;
  entry_count?: number;
  amount: number;
  entries?: SourceEntry[];
  position_count?: number;
  disposition_count?: number;
}

interface TracedLine {
  amount: number | null;
  source?: string;
  sources?: LineSource[];
  calculation?: string;
  note?: string;
}

export async function GET(request: Request) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year') || '2025';
    const taxYear = parseInt(yearParam, 10);

    // Load tax documents
    const taxDocs = await prisma.tax_documents.findMany({
      where: { userId: user.id, tax_year: taxYear },
    });
    const docsByType = new Map<string, Array<{ label: string | null; data: Record<string, unknown> }>>();
    for (const doc of taxDocs) {
      const list = docsByType.get(doc.doc_type) || [];
      list.push({ label: doc.label, data: doc.data as Record<string, unknown> });
      docsByType.set(doc.doc_type, list);
    }

    // ═══════════════════════════════════════════════════════════
    // SCHEDULE C — from existing service + ledger drill-down
    // ═══════════════════════════════════════════════════════════

    const scheduleC = await generateScheduleC(user.id, taxYear);
    const scheduleCTraced: Record<string, TracedLine> = {};

    // Revenue lines
    scheduleCTraced['line_1_gross_receipts'] = {
      amount: scheduleC.line1,
      sources: scheduleC.revenueAccounts.map(a => ({
        type: 'ledger_entries',
        account_code: a.code,
        account_name: a.name,
        amount: a.amount,
      })),
    };

    // Expense lines with ledger entry drill-down
    const yearStart = new Date(`${taxYear}-01-01T00:00:00.000Z`);
    const yearEnd = new Date(`${taxYear + 1}-01-01T00:00:00.000Z`);

    for (const expense of scheduleC.expenses) {
      const lineKey = `line_${expense.line}`;
      const sources: LineSource[] = [];

      for (const acct of expense.accounts) {
        // Fetch individual ledger entries for this account
        const coaAccount = await prisma.chart_of_accounts.findFirst({
          where: { userId: user.id, code: acct.code, entity: { entity_type: 'sole_prop' } },
        });

        const entries: SourceEntry[] = [];
        if (coaAccount) {
          const ledgerEntries = await prisma.ledger_entries.findMany({
            where: {
              account_id: coaAccount.id,
              journal_entry: {
                date: { gte: yearStart, lt: yearEnd },
                status: 'posted',
              },
            },
            include: {
              journal_entry: { select: { id: true, date: true, description: true } },
            },
            orderBy: { created_at: 'asc' },
          });

          for (const le of ledgerEntries) {
            // For expense accounts (debit-normal): debits are positive, credits are negative (refunds)
            const sign = le.entry_type === 'D' ? 1 : -1;
            entries.push({
              date: le.journal_entry.date.toISOString().split('T')[0],
              description: le.journal_entry.description,
              amount: round2(Number(le.amount) / 100 * sign),
              journal_entry_id: le.journal_entry.id,
            });
          }
        }

        sources.push({
          type: 'ledger_entries',
          account_code: acct.code,
          account_name: acct.name,
          entry_count: entries.length,
          amount: acct.amount,
          entries,
        });
      }

      scheduleCTraced[lineKey] = { amount: expense.amount, sources };
    }

    scheduleCTraced['line_28_total_expenses'] = {
      amount: scheduleC.line28,
      calculation: `Sum of all expense lines`,
    };

    scheduleCTraced['line_31_net_profit_loss'] = {
      amount: scheduleC.line31,
      calculation: `line_1 (${scheduleC.line1}) - total_expenses (${scheduleC.line28})`,
    };

    // ═══════════════════════════════════════════════════════════
    // SCHEDULE D / FORM 8949 — from existing service
    // ═══════════════════════════════════════════════════════════

    const form8949Entries = await generateForm8949(user.id, taxYear);
    const scheduleD = generateScheduleD(form8949Entries);

    const shortTermEntries = form8949Entries.filter(e => !e.isLongTerm);
    const longTermEntries = form8949Entries.filter(e => e.isLongTerm);
    const stockEntries = form8949Entries.filter(e => e.assetType === 'stock');
    const optionEntries = form8949Entries.filter(e => e.assetType === 'option');

    const scheduleDTraced: Record<string, TracedLine> = {
      short_term_gain_loss: {
        amount: scheduleD.partI.line7.gainOrLoss,
        sources: [
          {
            type: 'trading_positions',
            description: 'Options realized P&L (short-term)',
            amount: round2(optionEntries.filter(e => !e.isLongTerm).reduce((s, e) => s + e.gainOrLoss, 0)),
            position_count: optionEntries.filter(e => !e.isLongTerm).length,
          },
          {
            type: 'lot_dispositions',
            description: 'Stock realized gain/loss (short-term)',
            amount: round2(stockEntries.filter(e => !e.isLongTerm).reduce((s, e) => s + e.gainOrLoss, 0)),
            disposition_count: stockEntries.filter(e => !e.isLongTerm).length,
          },
        ],
      },
      long_term_gain_loss: {
        amount: scheduleD.partII.line15.gainOrLoss,
        sources: [
          {
            type: 'trading_positions',
            description: 'Options realized P&L (long-term)',
            amount: round2(optionEntries.filter(e => e.isLongTerm).reduce((s, e) => s + e.gainOrLoss, 0)),
            position_count: optionEntries.filter(e => e.isLongTerm).length,
          },
          {
            type: 'lot_dispositions',
            description: 'Stock realized gain/loss (long-term)',
            amount: round2(stockEntries.filter(e => e.isLongTerm).reduce((s, e) => s + e.gainOrLoss, 0)),
            disposition_count: stockEntries.filter(e => e.isLongTerm).length,
          },
        ],
      },
      capital_loss_deduction: {
        amount: Math.max(scheduleD.line16.gainOrLoss, -3000),
        note: scheduleD.line16.gainOrLoss < -3000
          ? `Net loss of $${Math.abs(scheduleD.line16.gainOrLoss).toFixed(2)} exceeds $3,000 limit; $${Math.abs(scheduleD.line16.gainOrLoss + 3000).toFixed(2)} carried forward`
          : scheduleD.line16.gainOrLoss < 0
            ? `Under $3,000 limit, fully deductible`
            : `Net gain, no limitation`,
      },
    };

    // ═══════════════════════════════════════════════════════════
    // FORM 1040 — from existing service + tax document data
    // ═══════════════════════════════════════════════════════════

    const form1040 = await generateForm1040(user.id, taxYear);

    // Overlay tax document data
    const w2Docs = docsByType.get('w2') || [];
    const doc1099r = docsByType.get('1099r') || [];
    const doc1098t = docsByType.get('1098t') || [];
    const doc1098e = docsByType.get('1098e') || [];

    const totalW2Wages = w2Docs.reduce((s, d) => s + (Number(d.data.wages) || 0), 0);
    const totalW2FedWithheld = w2Docs.reduce((s, d) => s + (Number(d.data.federal_tax_withheld) || 0), 0);

    const total1099rGross = doc1099r.reduce((s, d) => s + (Number(d.data.gross_distribution) || 0), 0);
    const total1099rTaxable = doc1099r.reduce((s, d) => s + (Number(d.data.taxable_amount) || 0), 0);
    const total1099rWithheld = doc1099r.reduce((s, d) => s + (Number(d.data.federal_tax_withheld) || 0), 0);

    const totalTuition = doc1098t.reduce((s, d) => s + (Number(d.data.qualified_tuition) || 0), 0);
    const totalScholarships = doc1098t.reduce((s, d) => s + (Number(d.data.scholarships) || 0), 0);

    const totalStudentLoanInterest = doc1098e.reduce((s, d) => s + (Number(d.data.interest_paid) || 0), 0);

    // Education credit (American Opportunity): 100% of first $2,000 + 25% of next $2,000 = max $2,500
    const qualifiedEducationExpense = Math.max(0, totalTuition - totalScholarships);
    const educationCredit = qualifiedEducationExpense > 0
      ? round2(Math.min(2000, qualifiedEducationExpense) + Math.min(500, Math.max(0, qualifiedEducationExpense - 2000) * 0.25))
      : 0;

    const form1040Traced: Record<string, TracedLine> = {
      line_1_wages: {
        amount: w2Docs.length > 0 ? totalW2Wages : (form1040.line1 || null),
        source: w2Docs.length > 0
          ? `W-2: ${w2Docs.map(d => `${d.label || 'W-2'} ($${Number(d.data.wages).toLocaleString()})`).join(' + ')}`
          : form1040.line1 > 0 ? form1040.line1Source : 'W-2 not yet entered',
      },
      line_4a_ira_distributions: {
        amount: doc1099r.length > 0 ? total1099rGross : (form1040.line5a || null),
        source: doc1099r.length > 0
          ? `1099-R: ${doc1099r.map(d => `${d.label || '1099-R'} ($${Number(d.data.gross_distribution).toLocaleString()})`).join(' + ')}`
          : '1099-R not yet entered',
      },
      line_4b_taxable_distributions: {
        amount: doc1099r.length > 0 ? total1099rTaxable : (form1040.line5b || null),
        source: doc1099r.length > 0 ? '1099-R taxable amount' : '1099-R not yet entered',
      },
      line_7_capital_gain_loss: {
        amount: form1040.line7,
        source: 'Schedule D',
      },
      line_8_schedule_1: {
        amount: form1040.line8,
        source: 'Schedule C net profit/loss',
      },
      line_12_standard_deduction: {
        amount: form1040.standardDeduction,
        note: `${taxYear} standard deduction for ${form1040.filingStatus} filer`,
      },
      line_15_taxable_income: {
        amount: form1040.line15,
        calculation: `AGI (${form1040.line11}) - standard deduction (${form1040.standardDeduction})`,
      },
    };

    // Form 8863 — Education Credits
    const form8863: Record<string, TracedLine> = {
      education_credit: {
        amount: doc1098t.length > 0 ? educationCredit : null,
        source: doc1098t.length > 0
          ? `1098-T: ${totalTuition} tuition - ${totalScholarships} scholarships = ${qualifiedEducationExpense} qualified. AOTC = $${educationCredit}`
          : '1098-T not yet entered',
      },
    };

    // Student loan interest deduction
    const studentLoanDeduction: TracedLine = {
      amount: doc1098e.length > 0 ? Math.min(totalStudentLoanInterest, 2500) : null,
      source: doc1098e.length > 0
        ? `1098-E: $${totalStudentLoanInterest} interest paid (max deduction $2,500)`
        : '1098-E not yet entered',
    };

    // Missing documents detection
    const missingDocuments: string[] = [];
    if (w2Docs.length === 0 && form1040.line1 === 0) missingDocuments.push('w2');
    if (doc1099r.length === 0 && form1040.line5a === 0) missingDocuments.push('1099r');
    if (doc1098t.length === 0) missingDocuments.push('1098t');
    if (doc1098e.length === 0) missingDocuments.push('1098e');

    // Data quality
    const dataQuality = {
      schedule_c_complete: scheduleC.line28 > 0 || scheduleC.line1 > 0,
      schedule_d_complete: form8949Entries.length > 0,
      form_8949_complete: form8949Entries.length > 0,
      w2_entered: w2Docs.length > 0,
      retirement_entered: doc1099r.length > 0,
      education_entered: doc1098t.length > 0,
      student_loan_entered: doc1098e.length > 0,
    };

    return NextResponse.json({
      tax_year: taxYear,
      disclaimer: 'TAX ESTIMATE ONLY — All figures must be verified by a licensed CPA or tax professional before filing.',

      schedule_c: scheduleCTraced,

      schedule_d: scheduleDTraced,

      form_8949: {
        short_term: shortTermEntries,
        long_term: longTermEntries,
        summary: {
          total_dispositions: form8949Entries.length,
          short_term_count: shortTermEntries.length,
          long_term_count: longTermEntries.length,
        },
      },

      form_1040: form1040Traced,

      form_8863: form8863,

      student_loan_deduction: studentLoanDeduction,

      // Computed totals using tax document data when available
      computed_totals: {
        total_income: round2(
          (w2Docs.length > 0 ? totalW2Wages : form1040.line1) +
          (doc1099r.length > 0 ? total1099rTaxable : form1040.line5b) +
          form1040.line7 +
          form1040.line8
        ),
        total_withholding: round2(
          (w2Docs.length > 0 ? totalW2FedWithheld : form1040.w2Withheld) +
          (doc1099r.length > 0 ? total1099rWithheld : form1040.retirementWithheld)
        ),
        education_credit: educationCredit,
        student_loan_deduction: doc1098e.length > 0 ? Math.min(totalStudentLoanInterest, 2500) : 0,
      },

      // Full Form 1040 from existing service (for bracket breakdown, etc.)
      form_1040_full: form1040,

      missing_documents: missingDocuments,
      data_quality: dataQuality,
    });
  } catch (error) {
    console.error('Tax calculate error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error',
    }, { status: 500 });
  }
}
