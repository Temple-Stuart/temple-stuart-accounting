'use client';

import { useState, useEffect, useCallback } from 'react';
import type { StepProps } from '../TaxFilingWizard';

// ═══════════════════════════════════════════════════════════════════
// Step 5 — Review (Form 1040 complete return)
//
// Read-only line-by-line review of the full return. All numbers come
// from /api/tax/calculate; nothing is computed client-side. Each line
// is traced back to the W-2 / 1099-R / Schedule C / Schedule D / Form
// 8863 it flowed from, and the bracket breakdown under Line 16 shows
// the per-bracket tax math.
// ═══════════════════════════════════════════════════════════════════

// ─── Wire types (loose — API is JSON) ──────────────────────────────

interface TaxBracketBreakdown {
  bracket: string;
  rate: number;
  taxableInBracket: number;
  taxForBracket: number;
}

interface ScheduleC {
  line1: number;
  line28: number;
  line31: number;
  businessName: string;
  unmappedAccounts: Array<{ code: string; name: string; amount: number }>;
  data_quality_warnings?: Array<{
    account_code: string;
    account_name: string;
    warning: string;
  }>;
}

interface ScheduleSE {
  line12: number;
  line13: number;
}

interface Form1040Full {
  taxYear: number;
  filingStatus: string;
  disclaimer: string;
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
  standardDeduction: number;
  line15: number;
  incomeTax: number;
  bracketBreakdown: TaxBracketBreakdown[];
  ltcgTax: number;
  ltcgBracketBreakdown: TaxBracketBreakdown[];
  earlyWithdrawalPenalty: number;
  selfEmploymentTax: number;
  totalTax: number;
  educationCredit: number;
  educationCreditType: string;
  aotcAmount: number;
  llcAmount: number;
  aotcRefundable: number;
  w2Withheld: number;
  retirementWithheld: number;
  estimatedPayments: number;
  totalPayments: number;
  amountOwed: number;
  isRefund: boolean;
  scheduleC: ScheduleC;
  scheduleSE: ScheduleSE;
  overridesUsed: string[];
}

interface CalculateResponse {
  tax_year: number;
  disclaimer: string;
  form_1040_full: Form1040Full;
  missing_documents: string[];
  data_quality: Record<string, boolean>;
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

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

// Which tax forms are available as PDFs (mirrors
// generateSingleFormPDF in tax-pdf-service.ts).
const PDF_FORMS: Array<{ slug: string; label: string; description: string }> = [
  { slug: 'all', label: 'All Forms', description: 'Combined PDF package' },
  { slug: '1040', label: 'Form 1040', description: 'Individual Income Tax Return' },
  { slug: 'schedule-1', label: 'Schedule 1', description: 'Additional Income & Adjustments' },
  { slug: 'schedule-c', label: 'Schedule C', description: 'Profit or Loss From Business' },
  { slug: 'schedule-d', label: 'Schedule D', description: 'Capital Gains and Losses' },
  { slug: '8949', label: 'Form 8949', description: 'Sales & Dispositions' },
  { slug: '8863', label: 'Form 8863', description: 'Education Credits' },
];

// ─── Source badge ──────────────────────────────────────────────────

function SourceBadge({ source }: { source: string }) {
  const lower = source.toLowerCase();
  const status: 'verified' | 'warning' | 'neutral' =
    lower.includes('w-2') ||
    lower.includes('1099') ||
    lower.includes('schedule') ||
    lower.includes('form 88')
      ? 'verified'
      : lower.includes('override')
        ? 'warning'
        : 'neutral';
  const styles = {
    verified: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    warning: 'text-amber-700 bg-amber-50 border-amber-200',
    neutral: 'text-gray-600 bg-gray-50 border-gray-200',
  }[status];
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium border rounded ${styles}`}
    >
      {source}
    </span>
  );
}

// ─── Line row ──────────────────────────────────────────────────────

function LineRow({
  num,
  label,
  amount,
  source,
  note,
  bold,
  large,
  muted,
  expandable,
  expanded,
  onToggle,
  children,
}: {
  num: string;
  label: React.ReactNode;
  amount: number | null;
  source?: string;
  note?: React.ReactNode;
  bold?: boolean;
  large?: boolean;
  muted?: boolean;
  expandable?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  children?: React.ReactNode;
}) {
  const labelClass = bold
    ? 'font-semibold text-gray-900'
    : muted
      ? 'text-gray-500'
      : 'text-gray-800';
  const amountClass = large
    ? 'font-mono text-lg font-bold text-gray-900'
    : bold
      ? 'font-mono text-sm font-semibold text-gray-900'
      : muted
        ? 'font-mono text-sm text-gray-500'
        : 'font-mono text-sm text-gray-900';

  return (
    <div>
      <div
        className={`flex items-start py-1.5 gap-3 ${
          expandable ? 'cursor-pointer hover:bg-gray-50' : ''
        }`}
        onClick={expandable ? onToggle : undefined}
      >
        {/* chevron + line number */}
        <div className="flex items-center gap-1 shrink-0 w-16">
          {expandable && (
            <span className="text-[10px] text-gray-400 w-2">
              {expanded ? '▼' : '▶'}
            </span>
          )}
          <span className="font-mono text-[11px] text-gray-400">{num}</span>
        </div>
        {/* label + source */}
        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
          <span className={`text-sm ${labelClass}`}>{label}</span>
          {source && <SourceBadge source={source} />}
        </div>
        {/* amount */}
        <div className="shrink-0 text-right">
          <div className={amountClass}>{fmtMoney(amount)}</div>
        </div>
      </div>
      {note && <div className="pl-[84px] text-[11px] text-gray-500">{note}</div>}
      {expanded && children && (
        <div className="pl-[84px] pr-2 pb-2">{children}</div>
      )}
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 pb-1 pt-2">
      {title}
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────

export default function ReviewStep({
  taxYear,
  onComplete,
  lifeEvents,
}: StepProps) {
  const [calc, setCalc] = useState<CalculateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [confirmed, setConfirmed] = useState(false);

  const loadCalc = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tax/calculate?year=${taxYear}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setCalc((await res.json()) as CalculateResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tax return');
    } finally {
      setLoading(false);
    }
  }, [taxYear]);

  useEffect(() => {
    loadCalc();
  }, [loadCalc]);

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-16 bg-gray-50 border border-gray-200 rounded animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
        Failed to load your return: {error}
        <button
          type="button"
          onClick={loadCalc}
          className="ml-2 underline hover:no-underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!calc?.form_1040_full) {
    return (
      <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded text-sm text-gray-700">
        No tax return data for {taxYear}.
      </div>
    );
  }

  const f = calc.form_1040_full;

  // ── Derived fields ───────────────────────────────────────────────

  const line10 = f.seTaxDeduction + f.studentLoanDeduction;
  const qbiDeduction = 0; // not yet supported
  const line14 = f.standardDeduction + qbiDeduction;
  const grossTaxLine16 = f.incomeTax + f.ltcgTax;
  const additionalTaxes = f.selfEmploymentTax + f.earlyWithdrawalPenalty;
  const effectiveRate = f.line15 > 0 ? f.totalTax / f.line15 : 0;
  const refundableEducation = f.educationCreditType === 'aotc' ? f.aotcRefundable : 0;

  // Source attribution for wages
  const wagesSourceLabel =
    f.wagesSource === 'w2_document'
      ? 'W-2'
      : f.wagesSource === 'override'
        ? 'Override'
        : f.wagesSource === 'ledger_personal'
          ? 'COA 4000 (Personal)'
          : 'Not set';

  // ── Warnings ─────────────────────────────────────────────────────

  interface Warning {
    text: string;
    fixStep?: string; // label for which step the user can fix this on
  }
  const warnings: Warning[] = [];
  for (const m of calc.missing_documents) {
    warnings.push({
      text: `Missing: ${m.toUpperCase()} — expected but no document entered`,
      fixStep: 'Documents',
    });
  }
  if (f.scheduleC?.unmappedAccounts.length > 0) {
    warnings.push({
      text: `Schedule C: ${f.scheduleC.unmappedAccounts.length} unmapped account(s) defaulted to Line 27a`,
      fixStep: 'Deductions',
    });
  }
  if (f.scheduleC?.data_quality_warnings && f.scheduleC.data_quality_warnings.length > 0) {
    warnings.push({
      text: `Schedule C: ${f.scheduleC.data_quality_warnings.length} account(s) with excluded lifetime balances`,
      fixStep: 'Deductions',
    });
  }
  // Surface life-event/document mismatches the user already saw in Income Review
  if (lifeEvents.hasW2 && f.line1 === 0) {
    warnings.push({
      text: 'W-2 life event checked but no wages reported on Line 1',
      fixStep: 'Documents',
    });
  }

  const canConfirm = confirmed;

  // ─── Render ──────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* ═══ Header ═══ */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Review your {taxYear} return
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Filing status:{' '}
            <span className="capitalize">
              {f.filingStatus.replace(/_/g, ' ')}
            </span>
          </p>
        </div>
        <div className="shrink-0">
          {warnings.length === 0 ? (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded">
              ✓ All data verified
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded">
              ! {warnings.length} item{warnings.length === 1 ? '' : 's'} need
              attention
            </span>
          )}
        </div>
      </div>

      {/* ═══ Warnings banner ═══ */}
      {warnings.length > 0 && (
        <div className="border border-amber-200 bg-amber-50 rounded-lg p-3">
          <div className="text-sm font-semibold text-amber-900 mb-1">
            Review these before filing
          </div>
          <ul className="space-y-1">
            {warnings.map((w, i) => (
              <li
                key={i}
                className="flex items-center justify-between text-xs text-amber-900"
              >
                <span>• {w.text}</span>
                {w.fixStep && (
                  <span className="text-amber-700 italic ml-2 shrink-0">
                    → fix in {w.fixStep} step
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ═══ Form 1040 ═══ */}
      <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-900">
                Form 1040 — U.S. Individual Income Tax Return
              </div>
              <div className="text-xs text-gray-500">
                Tax year {taxYear} · line-by-line
              </div>
            </div>
          </div>
        </div>
        <div className="px-4 py-3 space-y-0">
          {/* ── INCOME ── */}
          <SectionHeader title="Income" />
          <LineRow
            num="1"
            label="Wages, salaries, tips (W-2 Box 1)"
            amount={f.line1}
            source={wagesSourceLabel}
            note={f.line1Source && `Source: ${f.line1Source}`}
          />
          {f.line5a !== 0 && (
            <LineRow
              num="5a"
              label="Pensions / annuities — gross"
              amount={f.line5a}
              source="1099-R"
              muted
            />
          )}
          <LineRow
            num="5b"
            label="Pensions / annuities — taxable"
            amount={f.line5b}
            source={f.line5b > 0 ? '1099-R' : undefined}
          />
          <LineRow
            num="7"
            label="Capital gain or (loss)"
            amount={f.line7}
            source="Schedule D"
            expandable
            expanded={expanded.has('line7')}
            onToggle={() => toggle('line7')}
            note={
              f.line7 !== 0
                ? `Short-term ${fmtMoney(f.line7_stcg)} + Long-term ${fmtMoney(f.line7_ltcg)} = Schedule D Line 16`
                : undefined
            }
          >
            <div className="text-xs text-gray-600 border-l-2 border-blue-100 pl-3 space-y-0.5 py-1">
              <div className="flex justify-between">
                <span>Short-term (Schedule D Line 7)</span>
                <span className="font-mono">{fmtMoney(f.line7_stcg)}</span>
              </div>
              <div className="flex justify-between">
                <span>Long-term (Schedule D Line 15)</span>
                <span className="font-mono">{fmtMoney(f.line7_ltcg)}</span>
              </div>
              {f.line7 < -3000 && (
                <p className="text-amber-700 pt-1">
                  Net loss capped at $3,000 this year.{' '}
                  {fmtMoney(Math.abs(f.line7) - 3000)} will carry forward.
                </p>
              )}
            </div>
          </LineRow>
          <LineRow
            num="8"
            label="Other income (Schedule 1)"
            amount={f.line8}
            source="Schedule C"
            expandable
            expanded={expanded.has('line8')}
            onToggle={() => toggle('line8')}
            note={
              f.line8 !== 0
                ? `Schedule C Line 31: ${f.scheduleC.businessName} ${f.line8 < 0 ? 'net loss' : 'net profit'}`
                : undefined
            }
          >
            <div className="text-xs text-gray-600 border-l-2 border-blue-100 pl-3 space-y-0.5 py-1">
              <div className="flex justify-between">
                <span>Schedule C Line 1 — Gross receipts</span>
                <span className="font-mono">{fmtMoney(f.scheduleC.line1)}</span>
              </div>
              <div className="flex justify-between">
                <span>Schedule C Line 28 — Total expenses</span>
                <span className="font-mono">{fmtMoney(f.scheduleC.line28)}</span>
              </div>
              <div className="flex justify-between font-semibold pt-0.5">
                <span>Schedule C Line 31 — Net</span>
                <span className="font-mono">{fmtMoney(f.scheduleC.line31)}</span>
              </div>
            </div>
          </LineRow>
          <div className="pt-1 border-t border-gray-100 mt-1">
            <LineRow
              num="9"
              label="Total income"
              amount={f.line9}
              bold
            />
          </div>

          {/* ── ADJUSTMENTS ── */}
          <SectionHeader title="Adjustments to income" />
          <LineRow
            num="10"
            label="Adjustments from Schedule 1"
            amount={line10}
            source="Schedule 1"
            expandable
            expanded={expanded.has('line10')}
            onToggle={() => toggle('line10')}
          >
            <div className="text-xs text-gray-600 border-l-2 border-blue-100 pl-3 space-y-0.5 py-1">
              <div className="flex justify-between">
                <span>Schedule 1 Line 15 — Deductible half of SE tax</span>
                <span className="font-mono">{fmtMoney(f.seTaxDeduction)}</span>
              </div>
              <div className="flex justify-between">
                <span>Schedule 1 Line 21 — Student loan interest</span>
                <span className="font-mono">
                  {fmtMoney(f.studentLoanDeduction)}
                </span>
              </div>
              {f.studentLoanDeduction === 0 && lifeEvents.hasStudentLoan && (
                <p className="text-gray-500 italic pt-0.5">
                  Deduction may be $0 due to income phaseout or missing 1098-E.
                </p>
              )}
            </div>
          </LineRow>
          <div className="pt-1 border-t-2 border-gray-200 mt-1 mb-2">
            <LineRow
              num="11"
              label="Adjusted Gross Income (AGI)"
              amount={f.line11}
              bold
              large
            />
          </div>

          {/* ── DEDUCTIONS ── */}
          <SectionHeader title="Deductions" />
          <LineRow
            num="12"
            label={`Standard deduction (${f.filingStatus.replace(/_/g, ' ')})`}
            amount={f.standardDeduction}
            source="Standard"
          />
          <LineRow
            num="13"
            label="Qualified business income deduction"
            amount={qbiDeduction}
            muted
            note="QBI deduction (§199A) is not yet supported — showing $0."
          />
          <LineRow num="14" label="Total deductions" amount={line14} />
          <div className="pt-1 border-t-2 border-gray-200 mt-1 mb-2">
            <LineRow
              num="15"
              label="Taxable income"
              amount={f.line15}
              bold
              large
            />
          </div>

          {/* ── TAX ── */}
          <SectionHeader title="Tax computation" />
          <LineRow
            num="16"
            label="Tax (from brackets)"
            amount={grossTaxLine16}
            source="Brackets"
            expandable
            expanded={expanded.has('line16')}
            onToggle={() => toggle('line16')}
            note={
              effectiveRate > 0
                ? `Effective rate on taxable income: ${fmtPct(effectiveRate)}`
                : undefined
            }
          >
            <div className="text-xs text-gray-700 border-l-2 border-blue-100 pl-3 py-1 space-y-2">
              <div>
                <div className="font-semibold text-gray-700 mb-1">
                  Ordinary income brackets
                </div>
                {f.bracketBreakdown.length === 0 ? (
                  <p className="text-gray-500 italic">
                    No taxable ordinary income.
                  </p>
                ) : (
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="text-gray-500">
                        <th className="text-left font-medium pb-1">Bracket</th>
                        <th className="text-right font-medium pb-1">Rate</th>
                        <th className="text-right font-medium pb-1">
                          In bracket
                        </th>
                        <th className="text-right font-medium pb-1">Tax</th>
                      </tr>
                    </thead>
                    <tbody>
                      {f.bracketBreakdown.map((b, i) => (
                        <tr key={i}>
                          <td className="py-0.5 font-mono">{b.bracket}</td>
                          <td className="py-0.5 text-right font-mono">
                            {fmtPct(b.rate)}
                          </td>
                          <td className="py-0.5 text-right font-mono">
                            {fmtMoney(b.taxableInBracket)}
                          </td>
                          <td className="py-0.5 text-right font-mono">
                            {fmtMoney(b.taxForBracket)}
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t border-gray-200">
                        <td colSpan={3} className="py-1 text-right font-semibold">
                          Ordinary tax
                        </td>
                        <td className="py-1 text-right font-mono font-semibold">
                          {fmtMoney(f.incomeTax)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </div>

              {f.ltcgBracketBreakdown.length > 0 && (
                <div>
                  <div className="font-semibold text-gray-700 mb-1">
                    Long-term capital gains brackets
                  </div>
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="text-gray-500">
                        <th className="text-left font-medium pb-1">Bracket</th>
                        <th className="text-right font-medium pb-1">Rate</th>
                        <th className="text-right font-medium pb-1">
                          In bracket
                        </th>
                        <th className="text-right font-medium pb-1">Tax</th>
                      </tr>
                    </thead>
                    <tbody>
                      {f.ltcgBracketBreakdown.map((b, i) => (
                        <tr key={i}>
                          <td className="py-0.5 font-mono">{b.bracket}</td>
                          <td className="py-0.5 text-right font-mono">
                            {fmtPct(b.rate)}
                          </td>
                          <td className="py-0.5 text-right font-mono">
                            {fmtMoney(b.taxableInBracket)}
                          </td>
                          <td className="py-0.5 text-right font-mono">
                            {fmtMoney(b.taxForBracket)}
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t border-gray-200">
                        <td
                          colSpan={3}
                          className="py-1 text-right font-semibold"
                        >
                          LTCG tax
                        </td>
                        <td className="py-1 text-right font-mono font-semibold">
                          {fmtMoney(f.ltcgTax)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </LineRow>

          {f.selfEmploymentTax > 0 && (
            <LineRow
              num="23"
              label="Self-employment tax"
              amount={f.selfEmploymentTax}
              source="Schedule SE"
            />
          )}
          {f.earlyWithdrawalPenalty > 0 && (
            <LineRow
              num="Sch 2"
              label="Early withdrawal penalty (10% of 403(b))"
              amount={f.earlyWithdrawalPenalty}
              source="1099-R code 1"
            />
          )}
          {additionalTaxes > 0 && (
            <div className="pl-[84px] text-[11px] text-gray-500">
              Additional taxes: {fmtMoney(additionalTaxes)}
            </div>
          )}

          <div className="pt-1 border-t-2 border-gray-200 mt-1 mb-2">
            <LineRow
              num="24"
              label="Total tax"
              amount={f.totalTax}
              bold
              large
              note={
                f.educationCredit > 0
                  ? `Includes ${fmtMoney(f.educationCredit)} non-refundable education credit applied (${f.educationCreditType.toUpperCase()})`
                  : undefined
              }
            />
          </div>

          {/* ── PAYMENTS & CREDITS ── */}
          <SectionHeader title="Payments and credits" />
          <LineRow
            num="25a"
            label="Federal income tax withheld from W-2"
            amount={f.w2Withheld}
            source="W-2"
          />
          {f.retirementWithheld > 0 && (
            <LineRow
              num="25b"
              label="Federal income tax withheld from 1099-R"
              amount={f.retirementWithheld}
              source="1099-R"
            />
          )}
          {f.estimatedPayments > 0 && (
            <LineRow
              num="26"
              label="Estimated tax payments"
              amount={f.estimatedPayments}
              source="Override"
            />
          )}
          {refundableEducation > 0 && (
            <LineRow
              num="29"
              label="Refundable American Opportunity Credit"
              amount={refundableEducation}
              source="Form 8863"
            />
          )}
          <div className="pt-1 border-t border-gray-200 mt-1">
            <LineRow
              num="33"
              label="Total payments"
              amount={f.totalPayments}
              bold
            />
          </div>
        </div>

        {/* ── RESULT ── */}
        <div
          className={`px-6 py-5 border-t-2 ${
            f.isRefund
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-red-50 border-red-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <div
                className={`text-xs font-semibold uppercase tracking-wider ${
                  f.isRefund ? 'text-emerald-700' : 'text-red-700'
                }`}
              >
                {f.isRefund ? 'Estimated refund' : 'Estimated amount owed'}
              </div>
              <div
                className={`text-xs mt-0.5 ${
                  f.isRefund ? 'text-emerald-600' : 'text-red-600'
                }`}
              >
                Total tax {fmtMoney(f.totalTax)} − Payments{' '}
                {fmtMoney(f.totalPayments)}
              </div>
            </div>
            <div
              className={`font-mono text-3xl font-bold ${
                f.isRefund ? 'text-emerald-700' : 'text-red-700'
              }`}
            >
              {fmtMoney(Math.abs(f.amountOwed))}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ PDF downloads ═══ */}
      <div className="border border-gray-200 rounded-lg bg-white p-4">
        <h3 className="text-sm font-semibold text-gray-900">
          Draft PDF downloads
        </h3>
        <p className="text-xs text-gray-500 mb-3">
          Every PDF is watermarked DRAFT — these are for review only, not for
          filing. The final export happens in the File step.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {PDF_FORMS.map((form) => {
            const href = `/api/tax/generate-pdf?year=${taxYear}&form=${form.slug}`;
            return (
              <a
                key={form.slug}
                href={href}
                className="block border border-gray-200 rounded px-3 py-2 hover:bg-gray-50 hover:border-blue-300"
              >
                <div className="text-xs font-semibold text-gray-900">
                  {form.label}
                </div>
                <div className="text-[10px] text-gray-500 mt-0.5">
                  {form.description}
                </div>
                <div className="text-[10px] text-blue-600 mt-1">
                  Download PDF →
                </div>
              </a>
            );
          })}
        </div>
      </div>

      {/* ═══ Confirmation & continue ═══ */}
      <div className="border-2 border-blue-200 bg-blue-50 rounded-lg p-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-blue-600"
          />
          <div className="text-sm text-gray-800">
            I have reviewed my {taxYear} return and the numbers are correct.
            {warnings.length > 0 && (
              <div className="text-xs text-amber-700 mt-1">
                You have {warnings.length} unresolved warning
                {warnings.length === 1 ? '' : 's'}. Review them before
                confirming.
              </div>
            )}
          </div>
        </label>
        <div className="mt-3 flex items-center justify-end">
          <button
            type="button"
            onClick={onComplete}
            disabled={!canConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Continue to File
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-400 italic">{calc.disclaimer}</p>
    </div>
  );
}
