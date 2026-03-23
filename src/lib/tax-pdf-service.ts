import PDFDocument from 'pdfkit';
import type { Form1040 } from './form-1040-service';
import type { ScheduleC, ScheduleSE } from './schedule-c-service';
import type { TaxReport, Form8949Entry, ScheduleD } from './tax-report-service';

// ═══════════════════════════════════════════════════════════════
// Tax PDF Generation Service
// Generates IRS-style tax form PDFs from calculated data
// ═══════════════════════════════════════════════════════════════

const MARGIN = 50;
const PAGE_WIDTH = 612; // Letter size
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

function fmt(val: number | null | undefined): string {
  if (val === null || val === undefined) return '--';
  if (val === 0) return '-';
  const abs = Math.abs(val);
  const formatted = abs >= 1000
    ? `$${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$${abs.toFixed(2)}`;
  return val < 0 ? `(${formatted})` : formatted;
}

function fmtDate(d: string): string {
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });
}

// ── PDF Builder helpers ──

class TaxPDFBuilder {
  private doc: InstanceType<typeof PDFDocument>;
  private y: number = MARGIN;
  private pageNum: number = 1;
  private taxYear: number;
  private isDraft: boolean;

  constructor(taxYear: number, isDraft: boolean = true) {
    this.doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
      bufferPages: true,
    });
    this.taxYear = taxYear;
    this.isDraft = isDraft;
    this.y = MARGIN;
  }

  getDoc() { return this.doc; }

  private checkPage(needed: number = 40) {
    if (this.y > 720) {
      this.newPage();
    }
  }

  newPage() {
    this.addFooter();
    this.doc.addPage();
    this.pageNum++;
    this.y = MARGIN;
    if (this.isDraft) this.addWatermark();
  }

  private addWatermark() {
    this.doc.save();
    this.doc.fontSize(60).fillColor('#e5e5e5').opacity(0.3);
    this.doc.rotate(-45, { origin: [306, 396] });
    this.doc.text('DRAFT — NOT FOR FILING', 80, 350, { width: 500, align: 'center' });
    this.doc.restore();
  }

  private addFooter() {
    this.doc.save();
    this.doc.fontSize(7).fillColor('#999999');
    this.doc.text(
      `TAX YEAR ${this.taxYear}  |  Page ${this.pageNum}  |  Temple Stuart Accounting  |  ESTIMATE ONLY — NOT FOR FILING`,
      MARGIN, 760,
      { width: CONTENT_WIDTH, align: 'center' }
    );
    this.doc.restore();
  }

  finalize() {
    this.addFooter();
    if (this.isDraft) {
      // Add watermark to first page
      const pages = this.doc.bufferedPageRange();
      for (let i = pages.start; i < pages.start + pages.count; i++) {
        this.doc.switchToPage(i);
        this.addWatermark();
      }
    }
    this.doc.end();
  }

  // ── Drawing primitives ──

  formTitle(title: string, subtitle?: string) {
    this.doc.fontSize(16).fillColor('#1a1a1a').font('Helvetica-Bold');
    this.doc.text(title, MARGIN, this.y, { width: CONTENT_WIDTH, align: 'center' });
    this.y += 20;
    if (subtitle) {
      this.doc.fontSize(9).fillColor('#666666').font('Helvetica');
      this.doc.text(subtitle, MARGIN, this.y, { width: CONTENT_WIDTH, align: 'center' });
      this.y += 14;
    }
    this.y += 5;
  }

  sectionHeader(text: string, color: string = '#1a1a1a') {
    this.checkPage(30);
    this.doc.save();
    this.doc.rect(MARGIN, this.y, CONTENT_WIDTH, 18).fill(color);
    this.doc.fontSize(9).fillColor('#ffffff').font('Helvetica-Bold');
    this.doc.text(text, MARGIN + 6, this.y + 4, { width: CONTENT_WIDTH - 12 });
    this.doc.restore();
    this.y += 22;
  }

  lineItem(lineNum: string, description: string, amount: string, options?: { bold?: boolean; indent?: number; color?: string }) {
    this.checkPage();
    const indent = options?.indent || 0;
    const font = options?.bold ? 'Helvetica-Bold' : 'Helvetica';
    const color = options?.color || '#1a1a1a';

    this.doc.fontSize(8.5).font(font).fillColor(color);

    // Line number
    if (lineNum) {
      this.doc.text(lineNum, MARGIN + indent, this.y, { width: 40 });
    }

    // Description
    this.doc.text(description, MARGIN + 42 + indent, this.y, { width: CONTENT_WIDTH - 160 - indent });

    // Amount (right-aligned, monospace-style)
    this.doc.font('Courier').text(amount, MARGIN + CONTENT_WIDTH - 110, this.y, { width: 110, align: 'right' });
    this.doc.font(font);

    this.y += 14;
  }

  lineItemMultiCol(cols: { text: string; width: number; align?: 'left' | 'right' | 'center'; font?: string }[]) {
    this.checkPage();
    let x = MARGIN;
    for (const col of cols) {
      this.doc.font(col.font || 'Helvetica').fontSize(7.5).fillColor('#1a1a1a');
      this.doc.text(col.text, x, this.y, { width: col.width, align: col.align || 'left' });
      x += col.width;
    }
    this.y += 12;
  }

  separator() {
    this.doc.save();
    this.doc.moveTo(MARGIN, this.y).lineTo(MARGIN + CONTENT_WIDTH, this.y).strokeColor('#cccccc').lineWidth(0.5).stroke();
    this.doc.restore();
    this.y += 4;
  }

  thickSeparator() {
    this.doc.save();
    this.doc.moveTo(MARGIN, this.y).lineTo(MARGIN + CONTENT_WIDTH, this.y).strokeColor('#333333').lineWidth(1.5).stroke();
    this.doc.restore();
    this.y += 6;
  }

  blankLine(height: number = 8) { this.y += height; }

  tableHeader(cols: { text: string; width: number; align?: 'left' | 'right' | 'center' }[]) {
    this.checkPage(25);
    this.doc.save();
    this.doc.rect(MARGIN, this.y, CONTENT_WIDTH, 16).fill('#4a3875');
    let x = MARGIN;
    this.doc.fontSize(6.5).fillColor('#ffffff').font('Helvetica-Bold');
    for (const col of cols) {
      this.doc.text(col.text, x + 3, this.y + 4, { width: col.width - 6, align: col.align || 'left' });
      x += col.width;
    }
    this.doc.restore();
    this.y += 18;
  }

  tableRow(cols: { text: string; width: number; align?: 'left' | 'right' | 'center'; font?: string }[], highlight?: boolean) {
    this.checkPage(14);
    if (highlight) {
      this.doc.save();
      this.doc.rect(MARGIN, this.y - 1, CONTENT_WIDTH, 13).fill('#f5f5f5');
      this.doc.restore();
    }
    let x = MARGIN;
    for (const col of cols) {
      this.doc.fontSize(7).fillColor('#1a1a1a').font(col.font || 'Helvetica');
      this.doc.text(col.text, x + 3, this.y + 1, { width: col.width - 6, align: col.align || 'left' });
      x += col.width;
    }
    this.y += 13;
  }

  infoBox(text: string) {
    this.checkPage(30);
    this.doc.save();
    this.doc.rect(MARGIN, this.y, CONTENT_WIDTH, 22).fill('#f8f8f0').stroke('#cccc88');
    this.doc.fontSize(7.5).fillColor('#666600').font('Helvetica');
    this.doc.text(text, MARGIN + 8, this.y + 6, { width: CONTENT_WIDTH - 16 });
    this.doc.restore();
    this.y += 28;
  }
}

// ═══════════════════════════════════════════════════════════════
// Form generators
// ═══════════════════════════════════════════════════════════════

export function generateForm1040PDF(
  data: Form1040,
  scheduleD: ScheduleD | null,
): TaxPDFBuilder {
  const b = new TaxPDFBuilder(data.taxYear);

  b.formTitle(
    'Form 1040 — U.S. Individual Income Tax Return',
    `Tax Year ${data.taxYear}  |  Filing Status: ${data.filingStatus.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}`
  );

  b.infoBox('TAX ESTIMATE ONLY — All figures must be verified by a licensed CPA or tax professional before filing. Temple Stuart is not a tax preparer.');

  // INCOME
  b.sectionHeader('Income', '#2d6a2d');
  b.lineItem('1', 'Wages, salaries, tips (W-2)', fmt(data.line1));
  b.lineItem('', `  Source: ${data.line1Source}`, '', { color: '#888888' });
  b.separator();
  b.lineItem('5a', 'Pensions and annuities (gross)', fmt(data.line5a));
  b.lineItem('5b', 'Taxable amount', fmt(data.line5b));
  b.separator();
  b.lineItem('7', 'Capital gain or (loss) — from Schedule D', fmt(data.line7));
  b.separator();
  b.lineItem('8', 'Other income — Schedule C net profit/(loss)', fmt(data.line8));
  b.thickSeparator();
  b.lineItem('9', 'Total income', fmt(data.line9), { bold: true });
  b.blankLine();

  // ADJUSTMENTS
  b.sectionHeader('Adjustments to Income', '#2d4a7a');
  b.lineItem('', 'Deductible half of self-employment tax', fmt(data.seTaxDeduction));
  b.lineItem('', 'Student loan interest deduction', fmt(data.studentLoanDeduction));
  b.thickSeparator();
  b.lineItem('11', 'Adjusted gross income (AGI)', fmt(data.line11), { bold: true });
  b.blankLine();

  // DEDUCTIONS
  b.sectionHeader('Deductions', '#4a3875');
  b.lineItem('12', `Standard deduction (${data.filingStatus.replace(/_/g, ' ')})`, fmt(data.standardDeduction));
  b.thickSeparator();
  b.lineItem('15', 'Taxable income', fmt(data.line15), { bold: true });
  b.blankLine();

  // TAX COMPUTATION
  b.sectionHeader('Tax Computation', '#8a5a1a');
  for (const bracket of data.bracketBreakdown) {
    b.lineItem('', `${bracket.bracket} @ ${(bracket.rate * 100).toFixed(0)}%`, fmt(bracket.taxForBracket), { indent: 10, color: '#555555' });
  }
  b.thickSeparator();
  b.lineItem('16', 'Income tax', fmt(data.incomeTax), { bold: true });

  if (data.ltcgTax > 0) {
    b.lineItem('', 'Long-term capital gains tax', fmt(data.ltcgTax));
  }
  b.blankLine();

  // EDUCATION CREDITS
  if (data.educationCredit > 0) {
    b.sectionHeader('Credits (Form 8863)', '#1a6a4a');
    b.lineItem('', `American Opportunity Credit (AOTC)`, fmt(data.aotcAmount));
    b.lineItem('', `Lifetime Learning Credit (LLC)`, fmt(data.llcAmount));
    b.lineItem('29', `Education credit applied (${data.educationCreditType.toUpperCase()})`, `(${fmt(data.educationCredit)})`, { bold: true });
    b.blankLine();
  }

  // ADDITIONAL TAXES
  b.sectionHeader('Additional Taxes', '#8a2222');
  b.lineItem('', 'Self-employment tax (Schedule SE)', fmt(data.selfEmploymentTax));
  if (data.earlyWithdrawalPenalty > 0) {
    b.lineItem('', 'Early withdrawal penalty (10% of 403(b))', fmt(data.earlyWithdrawalPenalty));
  }
  b.thickSeparator();
  b.lineItem('24', 'Total tax', fmt(data.totalTax), { bold: true });
  b.blankLine();

  // PAYMENTS
  b.sectionHeader('Payments & Credits', '#1a6a6a');
  b.lineItem('', 'W-2 federal tax withheld', fmt(data.w2Withheld));
  b.lineItem('', '1099-R tax withheld', fmt(data.retirementWithheld));
  b.lineItem('', 'Estimated tax payments', fmt(data.estimatedPayments));
  if (data.aotcRefundable > 0) {
    b.lineItem('', 'Refundable education credit (AOTC)', fmt(data.aotcRefundable));
  }
  b.thickSeparator();
  b.lineItem('33', 'Total payments', fmt(data.totalPayments), { bold: true });
  b.blankLine(12);

  // BOTTOM LINE
  const bottomColor = data.isRefund ? '#2d6a2d' : '#8a2222';
  b.sectionHeader(data.isRefund ? 'ESTIMATED REFUND' : 'ESTIMATED AMOUNT OWED', bottomColor);
  b.lineItem('', data.isRefund ? 'Overpayment (refund)' : 'Amount you owe', fmt(Math.abs(data.amountOwed)), { bold: true, color: bottomColor });

  return b;
}

export function generateScheduleCPDF(
  data: Form1040,
): TaxPDFBuilder {
  const sc = data.scheduleC;
  const se = data.scheduleSE;
  const b = new TaxPDFBuilder(data.taxYear);

  b.formTitle(
    'Schedule C — Profit or Loss From Business',
    `Tax Year ${data.taxYear}  |  ${sc.businessName}  |  (Sole Proprietorship)`
  );

  // Part I: Income
  b.sectionHeader('Part I — Income', '#2d6a2d');
  b.lineItem('1', 'Gross receipts or sales', fmt(sc.line1));
  for (const ra of sc.revenueAccounts) {
    b.lineItem('', `  ${ra.code} — ${ra.name}`, fmt(ra.amount), { indent: 10, color: '#666666' });
  }
  if (sc.line2 !== 0) {
    b.lineItem('2', 'Returns and allowances', fmt(sc.line2));
  }
  b.thickSeparator();
  b.lineItem('7', 'Gross income', fmt(sc.line7), { bold: true });
  b.blankLine();

  // Part II: Expenses
  b.sectionHeader('Part II — Expenses', '#8a2222');
  for (const exp of sc.expenses) {
    b.lineItem(exp.line, exp.label, fmt(exp.amount));
    for (const acct of exp.accounts) {
      b.lineItem('', `  ${acct.code} — ${acct.name}`, fmt(acct.amount), { indent: 15, color: '#666666' });
    }
    b.separator();
  }
  b.thickSeparator();
  b.lineItem('28', 'Total expenses', fmt(sc.line28), { bold: true });
  b.blankLine();

  // Net profit
  const plColor = sc.line31 >= 0 ? '#2d6a2d' : '#8a2222';
  b.sectionHeader(sc.line31 >= 0 ? 'Net Profit' : 'Net Loss', plColor);
  b.lineItem('31', 'Net profit or (loss)', fmt(sc.line31), { bold: true, color: plColor });
  b.blankLine();

  // Schedule SE
  b.sectionHeader('Schedule SE — Self-Employment Tax', '#4a3875');
  b.lineItem('2', 'Net earnings from self-employment', fmt(se.line2));
  b.lineItem('3', '92.35% of Line 2', fmt(se.line3));
  b.lineItem('12', 'Self-employment tax (15.3%)', fmt(se.line12));
  b.lineItem('13', 'Deductible half of SE tax', fmt(se.line13));

  if (sc.unmappedAccounts.length > 0) {
    b.blankLine();
    b.infoBox(`Note: ${sc.unmappedAccounts.length} account(s) were auto-mapped to Line 27a (Other): ${sc.unmappedAccounts.map(a => `${a.code} ${a.name}`).join(', ')}`);
  }

  return b;
}

export function generateScheduleDPDF(
  report: TaxReport,
  taxYear: number,
): TaxPDFBuilder {
  const b = new TaxPDFBuilder(taxYear);
  const sd = report.scheduleD;

  b.formTitle(
    'Schedule D — Capital Gains and Losses',
    `Tax Year ${taxYear}`
  );

  const sdCols = [
    { text: 'Line', width: 60 },
    { text: 'Description', width: 170 },
    { text: '(d) Proceeds', width: 80, align: 'right' as const },
    { text: '(e) Cost Basis', width: 80, align: 'right' as const },
    { text: '(g) Adjustments', width: 72, align: 'right' as const },
    { text: '(h) Gain/Loss', width: 50, align: 'right' as const },
  ];

  // Part I
  b.sectionHeader('Part I — Short-Term Capital Gains and Losses (held 1 year or less)', '#8a7a22');
  b.tableHeader(sdCols);

  const renderSDLine = (line: typeof sd.partI.line1a, highlight: boolean = false) => {
    b.tableRow([
      { text: `Line ${line.line}`, width: 60 },
      { text: line.description, width: 170 },
      { text: fmt(line.proceeds), width: 80, align: 'right', font: 'Courier' },
      { text: fmt(line.costBasis), width: 80, align: 'right', font: 'Courier' },
      { text: fmt(line.adjustments), width: 72, align: 'right', font: 'Courier' },
      { text: fmt(line.gainOrLoss), width: 50, align: 'right', font: 'Courier' },
    ], highlight);
  };

  renderSDLine(sd.partI.line1a);
  renderSDLine(sd.partI.line1b);
  renderSDLine(sd.partI.line1c);
  renderSDLine(sd.partI.line7, true);
  b.blankLine();

  // Part II
  b.sectionHeader('Part II — Long-Term Capital Gains and Losses (held more than 1 year)', '#2255aa');
  b.tableHeader(sdCols);
  renderSDLine(sd.partII.line8a);
  renderSDLine(sd.partII.line8b);
  renderSDLine(sd.partII.line8c);
  renderSDLine(sd.partII.line15, true);
  b.blankLine();

  // Summary
  b.sectionHeader('Part III — Summary', '#1a1a1a');
  b.tableHeader(sdCols);
  renderSDLine(sd.line16, true);
  b.blankLine();

  // Disposition summary
  b.sectionHeader('Disposition Summary', '#4a3875');
  b.lineItem('', 'Total dispositions', String(report.summary.totalDispositions));
  b.lineItem('', 'Short-term', String(report.summary.shortTermCount));
  b.lineItem('', 'Long-term', String(report.summary.longTermCount));
  b.lineItem('', 'Wash sales', String(report.summary.washSaleCount));
  b.lineItem('', 'Wash sale amount disallowed', fmt(report.summary.washSaleDisallowed));

  return b;
}

export function generateForm8949PDF(
  report: TaxReport,
  taxYear: number,
  summaryOnly: boolean = false,
): TaxPDFBuilder {
  const b = new TaxPDFBuilder(taxYear);

  b.formTitle(
    'Form 8949 — Sales and Other Dispositions of Capital Assets',
    `Tax Year ${taxYear}  |  ${report.summary.totalDispositions} dispositions`
  );

  if (summaryOnly) {
    b.infoBox('SUMMARY VERSION — Individual entries omitted for brevity. Use the full version for complete detail.');
    b.blankLine();
  }

  const cols = [
    { text: '(a) Description', width: 130 },
    { text: '(b) Acq.', width: 50, align: 'right' as const },
    { text: '(c) Sold', width: 50, align: 'right' as const },
    { text: '(d) Proceeds', width: 72, align: 'right' as const },
    { text: '(e) Basis', width: 72, align: 'right' as const },
    { text: '(f)', width: 20, align: 'center' as const },
    { text: '(g) Adj.', width: 52, align: 'right' as const },
    { text: '(h) Gain/Loss', width: 66, align: 'right' as const },
  ];

  const renderEntries = (entries: Form8949Entry[], label: string, headerColor: string) => {
    if (entries.length === 0) return;

    // Group by box
    const byBox: Record<string, Form8949Entry[]> = {};
    for (const e of entries) {
      const box = e.box || 'A';
      if (!byBox[box]) byBox[box] = [];
      byBox[box].push(e);
    }

    for (const [box, boxEntries] of Object.entries(byBox)) {
      b.sectionHeader(`${label} — Box ${box} (${boxEntries.length} entries)`, headerColor);
      b.tableHeader(cols);

      if (!summaryOnly) {
        for (let i = 0; i < boxEntries.length; i++) {
          const e = boxEntries[i];
          b.tableRow([
            { text: e.description.substring(0, 28), width: 130 },
            { text: fmtDate(e.dateAcquired), width: 50, align: 'right', font: 'Courier' },
            { text: fmtDate(e.dateSold), width: 50, align: 'right', font: 'Courier' },
            { text: fmt(e.proceeds), width: 72, align: 'right', font: 'Courier' },
            { text: fmt(e.costBasis), width: 72, align: 'right', font: 'Courier' },
            { text: e.adjustmentCode || '', width: 20, align: 'center' },
            { text: e.adjustmentAmount ? fmt(e.adjustmentAmount) : '', width: 52, align: 'right', font: 'Courier' },
            { text: fmt(e.gainOrLoss), width: 66, align: 'right', font: 'Courier' },
          ], i % 2 === 1);
        }
      }

      // Totals row
      const totProceeds = boxEntries.reduce((s, e) => s + e.proceeds, 0);
      const totCost = boxEntries.reduce((s, e) => s + e.costBasis, 0);
      const totAdj = boxEntries.reduce((s, e) => s + e.adjustmentAmount, 0);
      const totGL = boxEntries.reduce((s, e) => s + e.gainOrLoss, 0);
      b.tableRow([
        { text: `TOTALS (${boxEntries.length})`, width: 130, font: 'Helvetica-Bold' },
        { text: '', width: 50 },
        { text: '', width: 50 },
        { text: fmt(totProceeds), width: 72, align: 'right', font: 'Courier' },
        { text: fmt(totCost), width: 72, align: 'right', font: 'Courier' },
        { text: '', width: 20 },
        { text: fmt(totAdj), width: 52, align: 'right', font: 'Courier' },
        { text: fmt(totGL), width: 66, align: 'right', font: 'Courier' },
      ], true);
      b.blankLine();
    }
  };

  renderEntries(report.form8949.shortTerm, 'Short-Term (held 1 year or less)', '#8a7a22');
  renderEntries(report.form8949.longTerm, 'Long-Term (held more than 1 year)', '#2255aa');

  return b;
}

export function generateSchedule1PDF(
  data: Form1040,
): TaxPDFBuilder {
  const b = new TaxPDFBuilder(data.taxYear);

  b.formTitle(
    'Schedule 1 — Additional Income and Adjustments to Income',
    `Tax Year ${data.taxYear}`
  );

  // Part I: Additional Income
  b.sectionHeader('Part I — Additional Income', '#2d6a2d');
  b.lineItem('3', 'Business income or (loss) — from Schedule C, line 31', fmt(data.line8));
  b.lineItem('7', 'Capital gain or (loss) — from Schedule D', fmt(data.line7));
  b.thickSeparator();
  b.lineItem('10', 'Total additional income', fmt(data.line7 + data.line8), { bold: true });
  b.blankLine();

  // Part II: Adjustments
  b.sectionHeader('Part II — Adjustments to Income', '#2d4a7a');
  b.lineItem('15', 'Deductible half of self-employment tax', fmt(data.seTaxDeduction));
  b.lineItem('21', 'Student loan interest deduction', fmt(data.studentLoanDeduction));
  b.thickSeparator();
  b.lineItem('26', 'Total adjustments', fmt(data.seTaxDeduction + data.studentLoanDeduction), { bold: true });

  return b;
}

export function generateForm8863PDF(
  data: Form1040,
): TaxPDFBuilder {
  const b = new TaxPDFBuilder(data.taxYear);

  b.formTitle(
    'Form 8863 — Education Credits',
    `Tax Year ${data.taxYear}`
  );

  if (data.educationCredit === 0) {
    b.infoBox('No education credits calculated. Enter 1098-T data to calculate education credits.');
    return b;
  }

  // Part I — Refundable credit
  b.sectionHeader('Part I — Refundable American Opportunity Credit', '#1a6a4a');
  b.lineItem('', 'American Opportunity Credit (AOTC)', fmt(data.aotcAmount));
  b.lineItem('', '40% refundable portion (max $1,000)', fmt(data.aotcRefundable));
  b.lineItem('8', 'Refundable American Opportunity Credit', fmt(data.educationCreditType === 'aotc' ? data.aotcRefundable : 0), { bold: true });
  b.blankLine();

  // Part II — Nonrefundable credit
  b.sectionHeader('Part II — Nonrefundable Education Credits', '#2d4a7a');
  b.lineItem('', 'Lifetime Learning Credit (LLC)', fmt(data.llcAmount));
  const nonrefundable = data.educationCreditType === 'aotc'
    ? data.educationCredit - data.aotcRefundable
    : data.educationCredit;
  b.lineItem('19', 'Nonrefundable education credit', fmt(nonrefundable), { bold: true });
  b.blankLine();

  // Summary
  b.sectionHeader('Credit Selection', '#4a3875');
  b.lineItem('', `Selected credit: ${data.educationCreditType.toUpperCase()}`, fmt(data.educationCredit), { bold: true });
  b.lineItem('', `(The ${data.educationCreditType === 'aotc' ? 'AOTC' : 'LLC'} provides the greater benefit)`, '');

  return b;
}

// ═══════════════════════════════════════════════════════════════
// Multi-form combined PDF
// ═══════════════════════════════════════════════════════════════

export async function generateAllFormsPDF(
  form1040: Form1040,
  report: TaxReport,
): Promise<Buffer> {
  const b = new TaxPDFBuilder(form1040.taxYear);

  // Cover page
  b.formTitle('Federal Tax Return Package', `Tax Year ${form1040.taxYear}`);
  b.infoBox('TAX ESTIMATE ONLY — This package contains estimated tax forms generated from your accounting data. All figures must be verified by a licensed CPA or tax professional before filing.');

  b.blankLine(10);
  b.sectionHeader('Forms Included', '#4a3875');
  b.lineItem('', 'Form 1040 — U.S. Individual Income Tax Return', '');
  b.lineItem('', 'Schedule 1 — Additional Income and Adjustments', '');
  b.lineItem('', 'Schedule C — Profit or Loss From Business', '');
  b.lineItem('', 'Schedule SE — Self-Employment Tax', '');
  b.lineItem('', 'Schedule D — Capital Gains and Losses', '');
  b.lineItem('', `Form 8949 — Sales and Dispositions (${report.summary.totalDispositions} entries)`, '');
  if (form1040.educationCredit > 0) {
    b.lineItem('', 'Form 8863 — Education Credits', '');
  }

  b.blankLine(10);
  b.sectionHeader('Summary', '#1a1a1a');
  b.lineItem('', 'Total income', fmt(form1040.line9));
  b.lineItem('', 'Adjusted gross income', fmt(form1040.line11));
  b.lineItem('', 'Taxable income', fmt(form1040.line15));
  b.lineItem('', 'Total tax', fmt(form1040.totalTax));
  b.lineItem('', 'Total payments', fmt(form1040.totalPayments));
  b.lineItem('', form1040.isRefund ? 'ESTIMATED REFUND' : 'ESTIMATED AMOUNT OWED',
    fmt(Math.abs(form1040.amountOwed)),
    { bold: true, color: form1040.isRefund ? '#2d6a2d' : '#8a2222' }
  );

  b.finalize();

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    b.getDoc().on('data', (chunk: Buffer) => chunks.push(chunk));
    b.getDoc().on('end', () => resolve(Buffer.concat(chunks)));
    b.getDoc().on('error', reject);
  });
}

// ═══════════════════════════════════════════════════════════════
// Single-form PDF generator (returns Buffer)
// ═══════════════════════════════════════════════════════════════

export async function generateSingleFormPDF(
  formType: string,
  form1040: Form1040,
  report: TaxReport,
): Promise<Buffer> {
  let builder: TaxPDFBuilder;

  switch (formType) {
    case '1040':
      builder = generateForm1040PDF(form1040, report.scheduleD);
      break;
    case 'schedule-c':
      builder = generateScheduleCPDF(form1040);
      break;
    case 'schedule-d':
      builder = generateScheduleDPDF(report, form1040.taxYear);
      break;
    case '8949':
      builder = generateForm8949PDF(report, form1040.taxYear, report.summary.totalDispositions > 200);
      break;
    case 'schedule-1':
      builder = generateSchedule1PDF(form1040);
      break;
    case '8863':
      builder = generateForm8863PDF(form1040);
      break;
    default:
      builder = generateForm1040PDF(form1040, report.scheduleD);
  }

  builder.finalize();

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    builder.getDoc().on('data', (chunk: Buffer) => chunks.push(chunk));
    builder.getDoc().on('end', () => resolve(Buffer.concat(chunks)));
    builder.getDoc().on('error', reject);
  });
}
