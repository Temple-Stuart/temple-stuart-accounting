'use client';

import { useState, useEffect, useCallback } from 'react';
import type { StepProps } from '../TaxFilingWizard';

// ═══════════════════════════════════════════════════════════════════
// Step 2 — Income Review
//
// Shows every income source for the tax year, sourced from:
//   • /api/tax/calculate — Form 1040 / Schedule C / Schedule D traced
//     line items (includes wages_source, data_quality_warnings)
//   • /api/tax/documents — raw W-2 / 1099-R / 1098-E / 1098-T rows
//   • /api/tax/report    — 8949 summary (wash-sale count + disallowed)
//
// Read-only review. Editing happens back in the Documents step.
// ═══════════════════════════════════════════════════════════════════

// ─── Wire-format types (loose — treat API as JSON) ─────────────────

interface TracedLine {
  amount: number | null;
  source?: string;
  calculation?: string;
  note?: string;
  sources?: Array<Record<string, unknown>>;
}

interface ScheduleCExpenseLine {
  line: string;
  label: string;
  amount: number;
  accounts: Array<{ code: string; name: string; amount: number }>;
}

interface ScheduleCFull {
  taxYear: number;
  businessName: string;
  line1: number;
  line7: number;
  line28: number;
  line31: number;
  expenses: ScheduleCExpenseLine[];
  revenueAccounts: Array<{ code: string; name: string; amount: number }>;
  unmappedAccounts: Array<{ code: string; name: string; amount: number }>;
  data_quality_warnings?: Array<{
    account_code: string;
    account_name: string;
    warning: string;
  }>;
}

interface Form1040Full {
  taxYear: number;
  filingStatus: string;
  line1: number;
  line1Source: string;
  wagesSource?: 'override' | 'w2_document' | 'ledger_personal' | 'none';
  line5a: number;
  line5b: number;
  line7: number;
  line7_stcg: number;
  line7_ltcg: number;
  line8: number;
  line9: number;
  seTaxDeduction: number;
  studentLoanDeduction: number;
  line11: number;
  w2Withheld: number;
  retirementWithheld: number;
  estimatedPayments: number;
  educationCredit: number;
  educationCreditType: string;
  aotcAmount: number;
  llcAmount: number;
  scheduleC: ScheduleCFull;
}

interface CalculateResponse {
  tax_year: number;
  disclaimer: string;
  schedule_c: Record<string, TracedLine>;
  schedule_d: Record<string, TracedLine>;
  form_8949: {
    short_term: unknown[];
    long_term: unknown[];
    summary: {
      total_dispositions: number;
      short_term_count: number;
      long_term_count: number;
    };
  };
  form_1040: Record<string, TracedLine>;
  form_8863: Record<string, TracedLine>;
  form_1040_full: Form1040Full;
  missing_documents: string[];
  data_quality: Record<string, boolean>;
}

interface TaxDocument {
  id: string;
  doc_type: string;
  label: string | null;
  data: Record<string, unknown>;
}

interface TaxReportResponse {
  summary?: {
    washSaleCount?: number;
    washSaleDisallowed?: number;
    washSalesApplied?: number;
  };
  warnings?: string[];
}

// ─── Helpers ───────────────────────────────────────────────────────

function fmtMoney(n: number | null | undefined): string {
  if (n == null) return '—';
  const abs = Math.abs(n);
  const s = abs.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return n < 0 ? `($${s})` : `$${s}`;
}

function amountClass(n: number | null | undefined): string {
  if (n == null || n === 0) return 'text-gray-900';
  return n < 0 ? 'text-red-600' : 'text-gray-900';
}

function numField(data: Record<string, unknown>, key: string): number {
  const v = data[key];
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

function strField(data: Record<string, unknown>, key: string): string {
  const v = data[key];
  return typeof v === 'string' ? v : '';
}

const DISTRIBUTION_CODE_HINTS: Record<string, string> = {
  '1': 'Early distribution, no known exception — may be subject to 10% penalty.',
  '2': 'Early distribution, exception applies — penalty waived.',
  '3': 'Disability distribution — no penalty.',
  '4': 'Death distribution to beneficiary.',
  '7': 'Normal distribution — no penalty.',
  G: 'Direct rollover — typically non-taxable.',
};

// ─── Source badge ──────────────────────────────────────────────────

function SourceBadge({
  status,
  label,
}: {
  status: 'verified' | 'warning' | 'missing';
  label: string;
}) {
  const styles = {
    verified: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    warning: 'text-amber-700 bg-amber-50 border-amber-200',
    missing: 'text-red-700 bg-red-50 border-red-200',
  }[status];
  const icon = { verified: '✓', warning: '!', missing: '✗' }[status];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold border rounded ${styles}`}
    >
      <span>{icon}</span>
      {label}
    </span>
  );
}

// ─── Reusable card shell ───────────────────────────────────────────

function IncomeCard({
  title,
  subtitle,
  total,
  totalLabel = 'Total',
  badge,
  expandKey,
  expanded,
  onToggle,
  detail,
  highlight,
}: {
  title: string;
  subtitle?: string;
  total: number | null;
  totalLabel?: string;
  badge: React.ReactNode;
  expandKey: string;
  expanded: Set<string>;
  onToggle: (key: string) => void;
  detail: React.ReactNode;
  highlight?: boolean;
}) {
  const isOpen = expanded.has(expandKey);
  return (
    <div
      className={`border rounded-lg overflow-hidden ${
        highlight ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200 bg-white'
      }`}
    >
      <button
        type="button"
        onClick={() => onToggle(expandKey)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xs text-gray-400 w-3">
            {isOpen ? '▼' : '▶'}
          </span>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900">
                {title}
              </span>
              {badge}
            </div>
            {subtitle && (
              <div className="text-xs text-gray-500 mt-0.5">{subtitle}</div>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">
            {totalLabel}
          </div>
          <div
            className={`text-lg font-mono font-semibold ${amountClass(total)}`}
          >
            {fmtMoney(total)}
          </div>
        </div>
      </button>
      {isOpen && (
        <div className="px-4 pb-4 border-t border-gray-100 bg-white">
          {detail}
        </div>
      )}
    </div>
  );
}

// ─── Nested detail row ─────────────────────────────────────────────

function DetailRow({
  label,
  value,
  indent = 0,
  muted,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  indent?: number;
  muted?: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between py-1.5 text-sm"
      style={{ paddingLeft: indent * 12 }}
    >
      <span className={muted ? 'text-gray-500' : 'text-gray-700'}>{label}</span>
      <span
        className={`font-mono ${
          muted ? 'text-gray-500' : 'text-gray-900'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────

export default function IncomeReviewStep({
  taxYear,
  lifeEvents,
}: StepProps) {
  const [calc, setCalc] = useState<CalculateResponse | null>(null);
  const [docs, setDocs] = useState<TaxDocument[]>([]);
  const [report, setReport] = useState<TaxReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [calcRes, docsRes, reportRes] = await Promise.all([
        fetch(`/api/tax/calculate?year=${taxYear}`),
        fetch(`/api/tax/documents?year=${taxYear}`),
        fetch(`/api/tax/report?year=${taxYear}`).catch(() => null),
      ]);

      if (!calcRes.ok) {
        const body = await calcRes.json().catch(() => ({}));
        throw new Error(body.error || `tax/calculate HTTP ${calcRes.status}`);
      }
      const calcJson = (await calcRes.json()) as CalculateResponse;

      if (!docsRes.ok) {
        const body = await docsRes.json().catch(() => ({}));
        throw new Error(body.error || `tax/documents HTTP ${docsRes.status}`);
      }
      const docsJson = (await docsRes.json()) as { documents: TaxDocument[] };

      let reportJson: TaxReportResponse | null = null;
      if (reportRes?.ok) {
        reportJson = (await reportRes.json()) as TaxReportResponse;
      }

      setCalc(calcJson);
      setDocs(docsJson.documents || []);
      setReport(reportJson);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load income data');
    } finally {
      setLoading(false);
    }
  }, [taxYear]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // ── Derived data ─────────────────────────────────────────────────

  const w2Docs = docs.filter((d) => d.doc_type === 'w2');
  const r1099Docs = docs.filter((d) => d.doc_type === '1099r');
  const e1098Docs = docs.filter((d) => d.doc_type === '1098e');
  const t1098Docs = docs.filter((d) => d.doc_type === '1098t');

  const form1040 = calc?.form_1040_full;
  const scheduleC = form1040?.scheduleC;

  const w2TotalWages = w2Docs.reduce(
    (s, d) => s + numField(d.data, 'gross_wages'),
    0
  );
  const w2TotalFedWH = w2Docs.reduce(
    (s, d) => s + numField(d.data, 'federal_withheld'),
    0
  );
  const w2TotalStateWH = w2Docs.reduce(
    (s, d) => s + numField(d.data, 'state_withheld'),
    0
  );
  const effectiveWithholdingPct =
    w2TotalWages > 0 ? (w2TotalFedWH / w2TotalWages) * 100 : 0;

  const retTotalGross = r1099Docs.reduce(
    (s, d) => s + numField(d.data, 'gross_distribution'),
    0
  );
  const retTotalTaxable = r1099Docs.reduce(
    (s, d) => s + numField(d.data, 'taxable_amount'),
    0
  );
  const retTotalWH = r1099Docs.reduce(
    (s, d) => s + numField(d.data, 'federal_withheld'),
    0
  );

  const slTotalInterest = e1098Docs.reduce(
    (s, d) => s + numField(d.data, 'interest_paid'),
    0
  );
  const edTotalBilled = t1098Docs.reduce(
    (s, d) => s + numField(d.data, 'amounts_billed'),
    0
  );
  const edTotalScholarships = t1098Docs.reduce(
    (s, d) => s + numField(d.data, 'scholarships'),
    0
  );
  const edQualifiedExpenses = Math.max(0, edTotalBilled - edTotalScholarships);

  const stockCount = calc?.form_8949.summary.short_term_count ?? 0;
  const ltCount = calc?.form_8949.summary.long_term_count ?? 0;
  const totalDispositions = calc?.form_8949.summary.total_dispositions ?? 0;
  const washSaleCount = report?.summary?.washSaleCount ?? 0;
  const washSaleDisallowed = report?.summary?.washSaleDisallowed ?? 0;

  // ── Warnings (aggregate) ─────────────────────────────────────────

  const warnings: string[] = [];

  if (lifeEvents.hasW2 && w2Docs.length === 0) {
    warnings.push(
      'You marked "I had a W-2 job" but no W-2 documents are entered. Go back to Documents to add yours.'
    );
  }
  if (lifeEvents.hasRetirement && r1099Docs.length === 0) {
    warnings.push(
      'You marked retirement activity but no 1099-R documents are entered.'
    );
  }
  if (lifeEvents.hasStudentLoan && e1098Docs.length === 0) {
    warnings.push(
      'You marked student loan interest but no 1098-E documents are entered.'
    );
  }
  if (lifeEvents.hasEducation && t1098Docs.length === 0) {
    warnings.push(
      'You marked education expenses but no 1098-T documents are entered.'
    );
  }
  if (scheduleC?.data_quality_warnings) {
    for (const w of scheduleC.data_quality_warnings) {
      warnings.push(
        `Schedule C: ${w.account_code} ${w.account_name} — ${w.warning}`
      );
    }
  }
  if (report?.warnings) {
    for (const w of report.warnings) warnings.push(w);
  }

  // ── Wages source badge ───────────────────────────────────────────

  const wagesSource = form1040?.wagesSource || 'none';
  const w2SourceBadge = (() => {
    if (w2Docs.length > 0 && wagesSource === 'w2_document') {
      return <SourceBadge status="verified" label="from W-2 document(s)" />;
    }
    if (wagesSource === 'override') {
      return <SourceBadge status="warning" label="from manual override" />;
    }
    if (wagesSource === 'ledger_personal') {
      return (
        <SourceBadge status="warning" label="from COA 4000 (Personal)" />
      );
    }
    if (lifeEvents.hasW2) {
      return <SourceBadge status="missing" label="no W-2 entered" />;
    }
    return <SourceBadge status="warning" label="none" />;
  })();

  // ─── Render ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-20 bg-gray-50 border border-gray-200 rounded animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
        Failed to load income data: {error}
        <button
          type="button"
          onClick={loadAll}
          className="ml-2 underline hover:no-underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!calc || !form1040) {
    return (
      <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded text-sm text-gray-700">
        No tax data available for {taxYear}.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-600">
        Every income number below is traced back to its source. Click any
        card to see the underlying documents, ledger entries, or trading
        positions.
      </p>

      {/* Warnings banner */}
      {warnings.length > 0 && (
        <div className="border border-amber-200 bg-amber-50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-amber-700 font-semibold text-sm">
              {warnings.length} item(s) need attention
            </span>
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-xs text-amber-800">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* A. W-2 Wages */}
      {lifeEvents.hasW2 && (
        <IncomeCard
          title="W-2 Wages"
          subtitle={
            w2Docs.length === 0
              ? 'No W-2 entered'
              : `${w2Docs.length} employer${w2Docs.length === 1 ? '' : 's'}`
          }
          total={form1040.line1}
          badge={w2SourceBadge}
          expandKey="w2"
          expanded={expanded}
          onToggle={toggle}
          detail={
            <div className="pt-3 space-y-3">
              {w2Docs.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No W-2 documents entered. Go back to Documents to add one.
                </p>
              ) : (
                <>
                  {w2Docs.map((d) => {
                    const key = `w2:${d.id}`;
                    const isOpen = expanded.has(key);
                    const wages = numField(d.data, 'gross_wages');
                    const employer =
                      strField(d.data, 'employer_name') || d.label || 'Employer';
                    return (
                      <div
                        key={d.id}
                        className="border border-gray-100 rounded"
                      >
                        <button
                          type="button"
                          onClick={() => toggle(key)}
                          className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-50"
                        >
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-gray-400 text-xs">
                              {isOpen ? '▼' : '▶'}
                            </span>
                            <span className="text-gray-800">{employer}</span>
                          </div>
                          <span className="font-mono text-sm text-gray-900">
                            {fmtMoney(wages)}
                          </span>
                        </button>
                        {isOpen && (
                          <div className="px-3 pb-2">
                            <DetailRow
                              indent={1}
                              label="Employer EIN"
                              value={strField(d.data, 'employer_ein') || '—'}
                            />
                            <DetailRow
                              indent={1}
                              label="Gross wages (Box 1)"
                              value={fmtMoney(
                                numField(d.data, 'gross_wages')
                              )}
                            />
                            <DetailRow
                              indent={1}
                              label="Federal withheld (Box 2)"
                              value={fmtMoney(
                                numField(d.data, 'federal_withheld')
                              )}
                            />
                            <DetailRow
                              indent={1}
                              label="SS wages (Box 3)"
                              value={fmtMoney(
                                numField(d.data, 'social_security_wages')
                              )}
                            />
                            <DetailRow
                              indent={1}
                              label="SS tax (Box 4)"
                              value={fmtMoney(
                                numField(d.data, 'social_security_tax')
                              )}
                            />
                            <DetailRow
                              indent={1}
                              label="Medicare wages (Box 5)"
                              value={fmtMoney(
                                numField(d.data, 'medicare_wages')
                              )}
                            />
                            <DetailRow
                              indent={1}
                              label="State wages (Box 16)"
                              value={fmtMoney(
                                numField(d.data, 'state_wages')
                              )}
                            />
                            <DetailRow
                              indent={1}
                              label="State withheld (Box 17)"
                              value={fmtMoney(
                                numField(d.data, 'state_withheld')
                              )}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div className="pt-2 border-t border-gray-100 space-y-0.5">
                    <DetailRow
                      label="Total federal withholding"
                      value={`${fmtMoney(w2TotalFedWH)}${
                        effectiveWithholdingPct > 0
                          ? `  (${effectiveWithholdingPct.toFixed(1)}% effective)`
                          : ''
                      }`}
                    />
                    <DetailRow
                      label="Total state withholding"
                      value={fmtMoney(w2TotalStateWH)}
                      muted
                    />
                  </div>
                </>
              )}
            </div>
          }
        />
      )}

      {/* B. Business Income (Schedule C) */}
      {lifeEvents.hasBusiness && scheduleC && (
        <IncomeCard
          title="Business Income (Schedule C)"
          subtitle={scheduleC.businessName}
          total={scheduleC.line31}
          totalLabel={scheduleC.line31 < 0 ? 'Net Loss' : 'Net Profit'}
          badge={
            <SourceBadge
              status="verified"
              label="from your Business entity ledger"
            />
          }
          expandKey="business"
          expanded={expanded}
          onToggle={toggle}
          detail={
            <div className="pt-3 space-y-2">
              {scheduleC.line31 < 0 && (
                <p className="text-xs text-red-600">
                  This loss reduces your taxable income on Form 1040 Line 8.
                </p>
              )}
              <DetailRow
                label="Line 1 — Gross receipts"
                value={fmtMoney(scheduleC.line1)}
              />
              {scheduleC.expenses.map((exp) => {
                const key = `sc:${exp.line}`;
                const isOpen = expanded.has(key);
                return (
                  <div key={exp.line}>
                    <button
                      type="button"
                      onClick={() => toggle(key)}
                      className="w-full flex items-center justify-between py-1 text-sm hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 text-xs">
                          {isOpen ? '▼' : '▶'}
                        </span>
                        <span className="text-gray-700">
                          Line {exp.line} — {exp.label}
                        </span>
                      </div>
                      <span className="font-mono text-gray-900">
                        {fmtMoney(exp.amount)}
                      </span>
                    </button>
                    {isOpen && (
                      <div className="pl-6 pb-1">
                        {exp.accounts.map((a) => (
                          <DetailRow
                            key={a.code}
                            indent={1}
                            label={`${a.code} ${a.name}`}
                            value={fmtMoney(a.amount)}
                            muted
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="pt-2 border-t border-gray-100">
                <DetailRow
                  label="Line 28 — Total expenses"
                  value={fmtMoney(scheduleC.line28)}
                />
                <DetailRow
                  label="Line 31 — Net profit/(loss)"
                  value={fmtMoney(scheduleC.line31)}
                />
              </div>
              {scheduleC.unmappedAccounts.length > 0 && (
                <p className="pt-2 text-xs text-amber-700">
                  {scheduleC.unmappedAccounts.length} unmapped account(s)
                  auto-routed to Line 27a (Other).
                </p>
              )}
            </div>
          }
        />
      )}

      {/* C. Retirement Distributions (1099-R) */}
      {lifeEvents.hasRetirement && (
        <IncomeCard
          title="Retirement Distributions"
          subtitle={
            r1099Docs.length === 0
              ? 'No 1099-R entered'
              : `${r1099Docs.length} payer${r1099Docs.length === 1 ? '' : 's'}`
          }
          total={retTotalTaxable}
          totalLabel="Taxable"
          badge={
            r1099Docs.length > 0 ? (
              <SourceBadge status="verified" label="from 1099-R document(s)" />
            ) : (
              <SourceBadge status="missing" label="no 1099-R entered" />
            )
          }
          expandKey="retirement"
          expanded={expanded}
          onToggle={toggle}
          detail={
            <div className="pt-3 space-y-2">
              {r1099Docs.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No 1099-R documents entered. Go back to Documents to add one.
                </p>
              ) : (
                <>
                  {r1099Docs.map((d) => {
                    const payer =
                      strField(d.data, 'payer_name') || d.label || 'Payer';
                    const code = strField(d.data, 'distribution_code');
                    const codeHint = code
                      ? DISTRIBUTION_CODE_HINTS[code]
                      : undefined;
                    return (
                      <div
                        key={d.id}
                        className="border border-gray-100 rounded px-3 py-2"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-800">
                            {payer}
                          </span>
                          <span className="font-mono text-sm text-gray-900">
                            {fmtMoney(
                              numField(d.data, 'gross_distribution')
                            )}
                          </span>
                        </div>
                        <DetailRow
                          label="Gross distribution (Box 1)"
                          value={fmtMoney(
                            numField(d.data, 'gross_distribution')
                          )}
                          indent={1}
                        />
                        <DetailRow
                          label="Taxable amount (Box 2a)"
                          value={fmtMoney(numField(d.data, 'taxable_amount'))}
                          indent={1}
                        />
                        <DetailRow
                          label="Federal withheld (Box 4)"
                          value={fmtMoney(
                            numField(d.data, 'federal_withheld')
                          )}
                          indent={1}
                        />
                        <DetailRow
                          label="Distribution code (Box 7)"
                          value={code || '—'}
                          indent={1}
                        />
                        {codeHint && (
                          <p className="text-xs text-gray-500 pl-3 mt-1">
                            {codeHint}
                          </p>
                        )}
                      </div>
                    );
                  })}
                  <div className="pt-2 border-t border-gray-100">
                    <DetailRow
                      label="Total gross distribution"
                      value={fmtMoney(retTotalGross)}
                    />
                    <DetailRow
                      label="Total taxable"
                      value={fmtMoney(retTotalTaxable)}
                    />
                    <DetailRow
                      label="Total federal withholding"
                      value={fmtMoney(retTotalWH)}
                    />
                  </div>
                </>
              )}
            </div>
          }
        />
      )}

      {/* D. Capital Gains/Losses */}
      {lifeEvents.hasTrading && (
        <IncomeCard
          title="Capital Gains & Losses"
          subtitle={`${totalDispositions} disposition${totalDispositions === 1 ? '' : 's'}`}
          total={form1040.line7}
          totalLabel={form1040.line7 < 0 ? 'Net Loss' : 'Net Gain'}
          badge={
            <SourceBadge
              status="verified"
              label="from trading positions & lot dispositions"
            />
          }
          expandKey="trading"
          expanded={expanded}
          onToggle={toggle}
          detail={
            <div className="pt-3 space-y-2">
              <DetailRow
                label={`Short-term gain/(loss) — ${stockCount} disposition(s)`}
                value={fmtMoney(form1040.line7_stcg)}
              />
              <DetailRow
                label={`Long-term gain/(loss) — ${ltCount} disposition(s)`}
                value={fmtMoney(form1040.line7_ltcg)}
              />
              <div className="pt-2 border-t border-gray-100">
                <DetailRow
                  label="Net capital gain/(loss)"
                  value={fmtMoney(form1040.line7)}
                />
              </div>
              {form1040.line7 < -3000 && (
                <p className="text-xs text-amber-700 pt-1">
                  Net loss exceeds the $3,000 annual deduction limit.{' '}
                  {fmtMoney(Math.abs(form1040.line7) - 3000)} will be carried
                  forward to future years.
                </p>
              )}
              {washSaleCount > 0 && (
                <div className="mt-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                  <div className="font-semibold mb-1">
                    {washSaleCount} wash sale(s) detected
                  </div>
                  <div>
                    Total disallowed loss: {fmtMoney(washSaleDisallowed)}
                  </div>
                </div>
              )}
            </div>
          }
        />
      )}

      {/* E. Interest & Dividends (placeholder) */}
      {lifeEvents.hasInterestDividends && (
        <IncomeCard
          title="Interest & Dividends"
          subtitle="1099-INT / 1099-DIV"
          total={null}
          badge={
            <SourceBadge status="warning" label="not yet wired" />
          }
          expandKey="intdiv"
          expanded={expanded}
          onToggle={toggle}
          detail={
            <div className="pt-3 text-sm text-gray-600">
              Enter your 1099-INT and 1099-DIV in the Documents step. Full
              wiring for these document types is coming in a later release.
            </div>
          }
        />
      )}

      {/* F. Student Loan Interest (1098-E) */}
      {lifeEvents.hasStudentLoan && (
        <IncomeCard
          title="Student Loan Interest"
          subtitle={
            e1098Docs.length === 0
              ? 'No 1098-E entered'
              : `${e1098Docs.length} lender${e1098Docs.length === 1 ? '' : 's'}`
          }
          total={slTotalInterest}
          totalLabel="Interest Paid"
          badge={
            e1098Docs.length > 0 ? (
              <SourceBadge status="verified" label="from 1098-E document(s)" />
            ) : (
              <SourceBadge status="missing" label="no 1098-E entered" />
            )
          }
          expandKey="studentloan"
          expanded={expanded}
          onToggle={toggle}
          detail={
            <div className="pt-3 space-y-2">
              <p className="text-xs text-gray-500">
                Deduction up to $2,500 — reduces your adjusted gross income.
              </p>
              {e1098Docs.map((d) => (
                <div
                  key={d.id}
                  className="border border-gray-100 rounded px-3 py-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-800">
                      {strField(d.data, 'lender_name') || d.label || 'Lender'}
                    </span>
                    <span className="font-mono text-sm text-gray-900">
                      {fmtMoney(numField(d.data, 'interest_paid'))}
                    </span>
                  </div>
                </div>
              ))}
              {e1098Docs.length > 0 && (
                <DetailRow
                  label="Estimated deduction (capped at $2,500)"
                  value={fmtMoney(Math.min(slTotalInterest, 2500))}
                />
              )}
            </div>
          }
        />
      )}

      {/* G. Education Credits (1098-T) */}
      {lifeEvents.hasEducation && (
        <IncomeCard
          title="Education Credits"
          subtitle={
            t1098Docs.length === 0
              ? 'No 1098-T entered'
              : `${t1098Docs.length} school${t1098Docs.length === 1 ? '' : 's'}`
          }
          total={form1040.educationCredit}
          totalLabel="Credit"
          badge={
            t1098Docs.length > 0 ? (
              <SourceBadge status="verified" label="from 1098-T document(s)" />
            ) : (
              <SourceBadge status="missing" label="no 1098-T entered" />
            )
          }
          expandKey="education"
          expanded={expanded}
          onToggle={toggle}
          detail={
            <div className="pt-3 space-y-2">
              {t1098Docs.map((d) => (
                <div
                  key={d.id}
                  className="border border-gray-100 rounded px-3 py-2"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-800">
                      {strField(d.data, 'school_name') ||
                        d.label ||
                        'School'}
                    </span>
                  </div>
                  <DetailRow
                    indent={1}
                    label="Qualified tuition (Box 1)"
                    value={fmtMoney(numField(d.data, 'amounts_billed'))}
                  />
                  <DetailRow
                    indent={1}
                    label="Scholarships (Box 5)"
                    value={fmtMoney(numField(d.data, 'scholarships'))}
                  />
                </div>
              ))}
              {t1098Docs.length > 0 && (
                <div className="pt-2 border-t border-gray-100">
                  <DetailRow
                    label="Total billed"
                    value={fmtMoney(edTotalBilled)}
                  />
                  <DetailRow
                    label="Less scholarships"
                    value={fmtMoney(edTotalScholarships)}
                    muted
                  />
                  <DetailRow
                    label="Qualified expenses"
                    value={fmtMoney(edQualifiedExpenses)}
                  />
                  <div className="pt-2">
                    <DetailRow
                      label="AOTC"
                      value={fmtMoney(form1040.aotcAmount)}
                      muted
                    />
                    <DetailRow
                      label="LLC"
                      value={fmtMoney(form1040.llcAmount)}
                      muted
                    />
                    <DetailRow
                      label={`Selected credit (${form1040.educationCreditType.toUpperCase()})`}
                      value={fmtMoney(form1040.educationCredit)}
                    />
                  </div>
                </div>
              )}
            </div>
          }
        />
      )}

      {/* AGI SUMMARY */}
      <div className="border-2 border-blue-200 bg-blue-50 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-900 uppercase tracking-wider mb-3">
          Form 1040 — Income Summary
        </h3>
        <div className="space-y-0.5">
          <DetailRow
            label="Line 1 — W-2 wages"
            value={fmtMoney(form1040.line1)}
          />
          {form1040.line5a !== 0 && (
            <DetailRow
              label="Line 5a — Pension / IRA gross"
              value={fmtMoney(form1040.line5a)}
              muted
            />
          )}
          <DetailRow
            label="Line 5b — Pension / IRA taxable"
            value={fmtMoney(form1040.line5b)}
          />
          <DetailRow
            label="Line 7 — Capital gain/(loss)"
            value={fmtMoney(form1040.line7)}
          />
          <DetailRow
            label="Line 8 — Schedule C net profit/(loss)"
            value={fmtMoney(form1040.line8)}
          />
          <div className="pt-2 border-t border-blue-200">
            <DetailRow
              label="Line 9 — Total income"
              value={fmtMoney(form1040.line9)}
            />
          </div>
          <DetailRow
            label="Less: deductible half of SE tax"
            value={fmtMoney(form1040.seTaxDeduction)}
            muted
          />
          <DetailRow
            label="Less: student loan interest deduction"
            value={fmtMoney(form1040.studentLoanDeduction)}
            muted
          />
          <div className="pt-2 border-t border-blue-200">
            <div className="flex items-center justify-between py-1">
              <span className="text-sm font-semibold text-blue-900">
                Line 11 — Adjusted Gross Income
              </span>
              <span className="font-mono text-lg font-bold text-blue-900">
                {fmtMoney(form1040.line11)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-400 italic">
        {calc.disclaimer}
      </p>
    </div>
  );
}
