'use client';

import { useState, useEffect, useCallback } from 'react';
import type { StepProps } from '../TaxFilingWizard';

// ═══════════════════════════════════════════════════════════════════
// Step 6 — File (export & filing instructions)
//
// The terminal step. The user has reviewed the return in Step 5; this
// step hands them the artifacts + step-by-step instructions for filing
// through a 3rd-party (TaxAct is the primary path — it supports 8949
// CSV import). Nothing is submitted from here; Temple Stuart is not a
// tax preparer.
// ═══════════════════════════════════════════════════════════════════

// ─── Wire types ────────────────────────────────────────────────────

interface ScheduleCExpenseLine {
  line: string;
  label: string;
  amount: number;
  accounts?: Array<{ code: string; name: string; amount: number }>;
}

interface ScheduleCFull {
  businessName: string;
  line1: number;
  line28: number;
  line31: number;
  expenses: ScheduleCExpenseLine[];
  revenueAccounts?: Array<{ code: string; name: string; amount: number }>;
}

interface Form1040Full {
  taxYear: number;
  filingStatus: string;
  line1: number;
  line5a: number;
  line5b: number;
  line7: number;
  line8: number;
  line11: number;
  line15: number;
  incomeTax: number;
  selfEmploymentTax: number;
  totalTax: number;
  w2Withheld: number;
  retirementWithheld: number;
  estimatedPayments: number;
  educationCredit: number;
  educationCreditType: string;
  totalPayments: number;
  amountOwed: number;
  isRefund: boolean;
  scheduleC: ScheduleCFull;
}

interface CalculateResponse {
  tax_year: number;
  disclaimer: string;
  form_1040_full: Form1040Full;
  form_8949: {
    summary: {
      total_dispositions: number;
      short_term_count: number;
      long_term_count: number;
    };
  };
}

interface TaxDocument {
  id: string;
  doc_type: string;
  label: string | null;
  data: Record<string, unknown>;
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

function num(data: Record<string, unknown>, key: string): number {
  const v = data[key];
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

function str(data: Record<string, unknown>, key: string): string {
  const v = data[key];
  return typeof v === 'string' ? v : '';
}

function filingDeadlineFor(taxYear: number): Date {
  // IRS personal income tax filing deadline: April 15 of the following year.
  // Ignoring weekend/Emancipation-Day shifts; the banner is heuristic, not authoritative.
  return new Date(Date.UTC(taxYear + 1, 3, 15));
}

function daysBetween(a: Date, b: Date): number {
  return Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

// ─── Client-side download helpers ──────────────────────────────────

function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function generateAndDownloadCSV(
  filename: string,
  headers: string[],
  rows: unknown[][]
) {
  const lines = [
    headers.map(csvEscape).join(','),
    ...rows.map((r) => r.map(csvEscape).join(',')),
  ];
  downloadBlob(lines.join('\n'), filename, 'text/csv');
}

function generateAndDownloadTxt(filename: string, content: string) {
  downloadBlob(content, filename, 'text/plain');
}

// ─── Component ─────────────────────────────────────────────────────

export default function FileStep({ taxYear, onComplete, lifeEvents }: StepProps) {
  const [calc, setCalc] = useState<CalculateResponse | null>(null);
  const [docs, setDocs] = useState<TaxDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<Set<string>>(new Set());

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [calcRes, docsRes] = await Promise.all([
        fetch(`/api/tax/calculate?year=${taxYear}`),
        fetch(`/api/tax/documents?year=${taxYear}`),
      ]);
      if (!calcRes.ok) {
        const body = await calcRes.json().catch(() => ({}));
        throw new Error(body.error || `tax/calculate HTTP ${calcRes.status}`);
      }
      if (!docsRes.ok) {
        const body = await docsRes.json().catch(() => ({}));
        throw new Error(body.error || `tax/documents HTTP ${docsRes.status}`);
      }
      setCalc((await calcRes.json()) as CalculateResponse);
      const d = (await docsRes.json()) as { documents: TaxDocument[] };
      setDocs(d.documents || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load filing data');
    } finally {
      setLoading(false);
    }
  }, [taxYear]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const toggleCheck = (key: string) => {
    setChecklist((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

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

  if (error || !calc?.form_1040_full) {
    return (
      <div className="px-4 py-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
        {error || `No tax data available for ${taxYear}.`}
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

  const f = calc.form_1040_full;
  const w2Docs = docs.filter((d) => d.doc_type === 'w2');
  const r1099Docs = docs.filter((d) => d.doc_type === '1099r');
  const e1098Docs = docs.filter((d) => d.doc_type === '1098e');
  const t1098Docs = docs.filter((d) => d.doc_type === '1098t');

  // ── Forms included in this return ────────────────────────────────

  const formsIncluded: Array<{ name: string; description: string }> = [];
  formsIncluded.push({ name: 'Form 1040', description: 'Individual Income Tax Return' });
  if (f.selfEmploymentTax > 0 || lifeEvents.hasStudentLoan) {
    formsIncluded.push({
      name: 'Schedule 1',
      description: 'Additional Income and Adjustments',
    });
  }
  if (f.selfEmploymentTax > 0) {
    formsIncluded.push({
      name: 'Schedule 2',
      description: 'Additional Taxes (includes SE tax)',
    });
  }
  if (lifeEvents.hasBusiness) {
    formsIncluded.push({
      name: 'Schedule C',
      description: 'Profit or Loss From Business',
    });
    if (f.selfEmploymentTax > 0) {
      formsIncluded.push({
        name: 'Schedule SE',
        description: 'Self-Employment Tax',
      });
    }
  }
  if (lifeEvents.hasTrading && calc.form_8949.summary.total_dispositions > 0) {
    formsIncluded.push({
      name: 'Schedule D',
      description: 'Capital Gains and Losses',
    });
    formsIncluded.push({
      name: 'Form 8949',
      description: `Sales & Dispositions (${calc.form_8949.summary.total_dispositions} entries)`,
    });
  }
  if (f.educationCredit > 0) {
    formsIncluded.push({
      name: 'Form 8863',
      description: 'Education Credits',
    });
  }

  // ── Deadline banner ──────────────────────────────────────────────

  const deadline = filingDeadlineFor(taxYear);
  const today = new Date();
  const daysUntil = daysBetween(today, deadline);
  const showExtensionBanner = daysUntil <= 7;
  const deadlinePassed = daysUntil < 0;

  // ── CSV column format (matches generateForm8949CSV) ──────────────

  const csvColumns = [
    'Description',
    'Date Acquired',
    'Date Sold',
    'Proceeds',
    'Cost Basis',
    'Adjustment Code',
    'Adjustment Amount',
    'Gain/Loss',
    'Short/Long Term',
    'Box',
  ];

  // ── Estimated amount string for instructions step 11 ─────────────

  const estimatedResultText = f.isRefund
    ? `approximately ${fmtMoney(Math.abs(f.amountOwed))} refund`
    : `approximately ${fmtMoney(Math.abs(f.amountOwed))} owed`;

  // ─── Render ──────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* ═══ Extension banner ═══ */}
      {showExtensionBanner && (
        <div className="border border-amber-300 bg-amber-50 rounded-lg p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-amber-900">
                {deadlinePassed
                  ? `Filing deadline was ${fmtDate(deadline)}.`
                  : `Filing deadline is ${fmtDate(deadline)}${
                      daysUntil === 0
                        ? ' — today'
                        : daysUntil === 1
                          ? ' — tomorrow'
                          : ` — ${daysUntil} days away`
                    }.`}
              </div>
              <p className="text-xs text-amber-800 mt-1">
                Need more time? File Form 4868 for an automatic 6-month
                extension. Extensions extend the filing deadline, not the
                payment deadline — pay estimated taxes to avoid penalties.
              </p>
            </div>
            <a
              href="https://www.freetaxusa.com/tax-extension"
              target="_blank"
              rel="noreferrer"
              className="shrink-0 px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 rounded hover:bg-amber-700"
            >
              File free extension
            </a>
          </div>
        </div>
      )}

      {/* ═══ Filing summary ═══ */}
      <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-semibold text-gray-900">
                {taxYear} Federal Tax Return
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                Filing status:{' '}
                <span className="capitalize">
                  {f.filingStatus.replace(/_/g, ' ')}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div
          className={`px-5 py-4 ${
            f.isRefund
              ? 'bg-emerald-50 border-b border-emerald-200'
              : 'bg-red-50 border-b border-red-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <div
                className={`text-[10px] font-semibold uppercase tracking-wider ${
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
        <div className="px-5 py-3">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Forms included
          </h4>
          <ul className="space-y-1">
            {formsIncluded.map((form) => (
              <li
                key={form.name}
                className="flex items-center gap-2 text-sm"
              >
                <span className="text-emerald-600">✓</span>
                <span className="font-medium text-gray-900">{form.name}</span>
                <span className="text-gray-500 text-xs">
                  — {form.description}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ═══ Export tools ═══ */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-2">
          Export your data
        </h3>

        {/* Row 1 — Tax-filing exports */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          {/* A. Form 8949 CSV */}
          <div className="border border-gray-200 rounded-lg bg-white p-4 flex flex-col">
            <div className="text-sm font-semibold text-gray-900">
              Form 8949 CSV
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">
              For TaxAct Premier+ import.
            </div>
            <div className="mt-3 flex-1 text-[11px] text-gray-600">
              <div className="font-mono">
                {calc.form_8949.summary.total_dispositions} transaction
                {calc.form_8949.summary.total_dispositions === 1 ? '' : 's'}
              </div>
              <div className="text-gray-500 mt-1">
                {calc.form_8949.summary.short_term_count} short-term ·{' '}
                {calc.form_8949.summary.long_term_count} long-term
              </div>
              <div className="text-gray-400 mt-2 leading-snug">
                Columns: {csvColumns.join(', ')}
              </div>
            </div>
            <a
              href={`/api/tax/export?year=${taxYear}`}
              className="mt-3 inline-flex items-center justify-center px-3 py-2 text-xs font-semibold text-white bg-blue-600 rounded hover:bg-blue-700"
            >
              Download CSV
            </a>
          </div>

          {/* B. Schedule C Export */}
          <div className="border border-gray-200 rounded-lg bg-white p-4 flex flex-col">
            <div className="text-sm font-semibold text-gray-900">
              Schedule C Export
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">
              Business income + expense reference for TaxAct entry.
            </div>
            <div className="mt-3 flex-1 text-[11px] text-gray-600">
              {f.scheduleC.expenses.length > 0 ? (
                <>
                  <div className="font-mono">
                    {f.scheduleC.expenses.length} expense line
                    {f.scheduleC.expenses.length === 1 ? '' : 's'}
                  </div>
                  <div className="text-gray-500 mt-1">
                    Gross: {fmtMoney(f.scheduleC.line1)} · Net:{' '}
                    {fmtMoney(f.scheduleC.line31)}
                  </div>
                </>
              ) : (
                <div className="text-gray-400">No Schedule C data.</div>
              )}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => downloadScheduleCLines(f.scheduleC, taxYear)}
                className="px-2 py-1.5 text-[10px] font-semibold text-center text-blue-700 border border-blue-200 rounded hover:bg-blue-50"
              >
                Line Summary
              </button>
              <button
                type="button"
                onClick={() => downloadScheduleCDetail(f.scheduleC, taxYear)}
                className="px-2 py-1.5 text-[10px] font-semibold text-center text-blue-700 border border-blue-200 rounded hover:bg-blue-50"
              >
                Account Detail
              </button>
            </div>
          </div>

          {/* C. Tax Filing Summary */}
          <div className="border border-gray-200 rounded-lg bg-white p-4 flex flex-col">
            <div className="text-sm font-semibold text-gray-900">
              Tax Filing Summary
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">
              Every number you need for TaxAct in one document.
            </div>
            <div className="mt-3 flex-1 text-[11px] text-gray-600">
              W-2, 1099-R, Schedule C lines, Schedule D totals, Form 1040 key
              lines, and warnings — all in plain text.
            </div>
            <button
              type="button"
              onClick={() =>
                downloadTaxSummary(f, calc, w2Docs, r1099Docs, e1098Docs, t1098Docs, taxYear)
              }
              className="mt-3 inline-flex items-center justify-center px-3 py-2 text-xs font-semibold text-white bg-blue-600 rounded hover:bg-blue-700"
            >
              Download Summary
            </button>
          </div>
        </div>

        {/* Row 2 — Reference exports */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* D. All Forms PDF */}
          <div className="border border-gray-200 rounded-lg bg-white p-4 flex flex-col">
            <div className="text-sm font-semibold text-gray-900">
              All Forms PDF
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">
              Draft watermark — review and reference only.
            </div>
            <div className="mt-3 flex-1 text-[11px] text-gray-600">
              Combined package including 1040, Schedules, Form 8949, and 8863 as
              applicable.
            </div>
            <a
              href={`/api/tax/generate-pdf?year=${taxYear}&form=all`}
              className="mt-3 inline-flex items-center justify-center px-3 py-2 text-xs font-semibold text-white bg-blue-600 rounded hover:bg-blue-700"
            >
              Download PDF
            </a>
          </div>

          {/* E. CPA Export Package */}
          <div className="border border-gray-200 rounded-lg bg-white p-4 flex flex-col">
            <div className="text-sm font-semibold text-gray-900">
              CPA Export Package
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">
              Ledger-sourced, double-entry verified.
            </div>
            <div className="mt-3 flex-1 text-[11px] text-gray-600">
              Trial Balance, Income Statement, Balance Sheet, and General Ledger
              CSV files.
            </div>
            <div className="mt-3 grid grid-cols-2 gap-1.5">
              {[
                { slug: 'trial-balance', label: 'Trial Balance' },
                { slug: 'income-statement', label: 'Income Stmt' },
                { slug: 'balance-sheet', label: 'Balance Sheet' },
                { slug: 'general-ledger', label: 'Gen Ledger' },
              ].map((item) => (
                <a
                  key={item.slug}
                  href={`/api/cpa-export?year=${taxYear}&format=${item.slug}`}
                  className="px-2 py-1.5 text-[10px] font-semibold text-center text-blue-700 border border-blue-200 rounded hover:bg-blue-50"
                >
                  {item.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ TaxAct filing instructions ═══ */}
      <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <div className="text-sm font-semibold text-gray-900">
            How to file using TaxAct
          </div>
          <div className="text-xs text-gray-500">
            Primary recommended path · TaxAct Premier+ supports Form 8949 CSV
            import
          </div>
        </div>
        <ol className="divide-y divide-gray-100">
          <Step n={1}>
            Go to{' '}
            <a
              href="https://www.taxact.com"
              target="_blank"
              rel="noreferrer"
              className="text-blue-700 underline"
            >
              taxact.com
            </a>{' '}
            and create an account (or sign in).
          </Step>
          <Step n={2}>
            Select the <strong>Premier+</strong> tier — this is required for CSV
            import of trades.
          </Step>
          <Step n={3}>
            Enter your personal info: name, SSN, address, and filing status
            (<span className="capitalize">{f.filingStatus.replace(/_/g, ' ')}</span>).
          </Step>

          {lifeEvents.hasW2 && w2Docs.length > 0 && (
            <Step n={4}>
              <div>Enter W-2 data from each employer:</div>
              <ul className="mt-2 space-y-1.5 text-xs">
                {w2Docs.map((d) => (
                  <li key={d.id} className="border border-gray-100 rounded p-2">
                    <div className="font-semibold text-gray-800">
                      {str(d.data, 'employer_name') || d.label || 'Employer'}
                    </div>
                    <div className="font-mono text-gray-600 mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5">
                      <span>
                        EIN: {str(d.data, 'employer_ein') || '—'}
                      </span>
                      <span>
                        Box 1 (wages): {fmtMoney(num(d.data, 'gross_wages'))}
                      </span>
                      <span>
                        Box 2 (fed WH):{' '}
                        {fmtMoney(num(d.data, 'federal_withheld'))}
                      </span>
                      <span>
                        Box 3 (SS wages):{' '}
                        {fmtMoney(num(d.data, 'social_security_wages'))}
                      </span>
                      <span>
                        Box 4 (SS tax):{' '}
                        {fmtMoney(num(d.data, 'social_security_tax'))}
                      </span>
                      <span>
                        Box 5 (Medicare wages):{' '}
                        {fmtMoney(num(d.data, 'medicare_wages'))}
                      </span>
                      <span>
                        Box 6 (Medicare tax):{' '}
                        {fmtMoney(num(d.data, 'medicare_tax'))}
                      </span>
                      <span>
                        Box 16 (state wages):{' '}
                        {fmtMoney(num(d.data, 'state_wages'))}
                      </span>
                      <span>
                        Box 17 (state WH):{' '}
                        {fmtMoney(num(d.data, 'state_withheld'))}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </Step>
          )}

          {lifeEvents.hasRetirement && r1099Docs.length > 0 && (
            <Step n={5}>
              <div>Enter 1099-R data from each payer:</div>
              <ul className="mt-2 space-y-1.5 text-xs">
                {r1099Docs.map((d) => (
                  <li key={d.id} className="border border-gray-100 rounded p-2">
                    <div className="font-semibold text-gray-800">
                      {str(d.data, 'payer_name') || d.label || 'Payer'}
                    </div>
                    <div className="font-mono text-gray-600 mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5">
                      <span>
                        Box 1 (gross): {fmtMoney(num(d.data, 'gross_distribution'))}
                      </span>
                      <span>
                        Box 2a (taxable): {fmtMoney(num(d.data, 'taxable_amount'))}
                      </span>
                      <span>
                        Box 4 (fed WH):{' '}
                        {fmtMoney(num(d.data, 'federal_withheld'))}
                      </span>
                      <span>
                        Box 7 (code): {str(d.data, 'distribution_code') || '—'}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </Step>
          )}

          {lifeEvents.hasTrading &&
            calc.form_8949.summary.total_dispositions > 0 && (
              <Step n={6}>
                <div>
                  <strong>Import Form 8949:</strong> In TaxAct's Capital Gains
                  section, click <em>Import</em> and upload the Form 8949 CSV
                  you downloaded above. TaxAct will auto-populate Schedule D
                  from the import.
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  Total dispositions imported:{' '}
                  {calc.form_8949.summary.total_dispositions} (
                  {calc.form_8949.summary.short_term_count} short-term,{' '}
                  {calc.form_8949.summary.long_term_count} long-term).
                </div>
              </Step>
            )}

          {lifeEvents.hasBusiness && f.scheduleC && (
            <Step n={7}>
              <div>Enter Schedule C business data:</div>
              <div className="mt-2 text-xs text-gray-600">
                Business name: <strong>{f.scheduleC.businessName}</strong>
              </div>
              <ul className="mt-2 space-y-0.5 text-xs font-mono">
                <li className="flex justify-between">
                  <span className="text-gray-600">
                    Line 1 (Gross receipts)
                  </span>
                  <span className="text-gray-900">
                    {fmtMoney(f.scheduleC.line1)}
                  </span>
                </li>
                {f.scheduleC.expenses
                  .filter((e) => e.amount !== 0)
                  .map((exp) => (
                    <li
                      key={exp.line}
                      className="flex justify-between pl-3"
                    >
                      <span className="text-gray-600">
                        Line {exp.line} ({exp.label})
                      </span>
                      <span className="text-gray-900">
                        {fmtMoney(exp.amount)}
                      </span>
                    </li>
                  ))}
                <li className="flex justify-between pt-1 border-t border-gray-100">
                  <span className="text-gray-600">
                    Line 28 (Total expenses)
                  </span>
                  <span className="text-gray-900">
                    {fmtMoney(f.scheduleC.line28)}
                  </span>
                </li>
                <li className="flex justify-between font-semibold">
                  <span className="text-gray-800">Line 31 (Net profit/loss)</span>
                  <span className="text-gray-900">
                    {fmtMoney(f.scheduleC.line31)}
                  </span>
                </li>
              </ul>
              <p className="mt-2 text-xs text-gray-500">
                TaxAct will compute Schedule SE automatically from Schedule C
                net profit.
              </p>
            </Step>
          )}

          {lifeEvents.hasEducation && t1098Docs.length > 0 && (
            <Step n={8}>
              <div>Enter 1098-T education data for Form 8863:</div>
              <ul className="mt-2 space-y-1 text-xs">
                {t1098Docs.map((d) => (
                  <li key={d.id} className="border border-gray-100 rounded p-2">
                    <div className="font-semibold text-gray-800">
                      {str(d.data, 'school_name') || d.label || 'School'}
                    </div>
                    <div className="font-mono text-gray-600 mt-1">
                      Box 1 (tuition):{' '}
                      {fmtMoney(num(d.data, 'amounts_billed'))} · Box 5
                      (scholarships):{' '}
                      {fmtMoney(num(d.data, 'scholarships'))}
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-2 text-xs text-gray-500">
                Estimated credit ({f.educationCreditType.toUpperCase()}):{' '}
                {fmtMoney(f.educationCredit)}
              </div>
            </Step>
          )}

          {lifeEvents.hasStudentLoan && e1098Docs.length > 0 && (
            <Step n={9}>
              <div>Enter 1098-E student loan interest:</div>
              <ul className="mt-2 space-y-1 text-xs">
                {e1098Docs.map((d) => (
                  <li key={d.id} className="border border-gray-100 rounded p-2">
                    <div className="font-semibold text-gray-800">
                      {str(d.data, 'lender_name') || d.label || 'Lender'}
                    </div>
                    <div className="font-mono text-gray-600 mt-1">
                      Box 1: {fmtMoney(num(d.data, 'interest_paid'))}
                    </div>
                  </li>
                ))}
              </ul>
            </Step>
          )}

          {f.estimatedPayments > 0 && (
            <Step n={10}>
              Enter estimated tax payments:{' '}
              <strong className="font-mono">
                {fmtMoney(f.estimatedPayments)}
              </strong>
              .
            </Step>
          )}

          <Step n={11}>
            <div>Review TaxAct's computed return.</div>
            <p className="mt-1 text-xs text-gray-600">
              TaxAct should compute {estimatedResultText}. If the number differs
              by more than <strong>$50</strong>, review each section for data-
              entry errors. Common discrepancies: state tax calculations,
              rounding differences, and life-event flags that affect phaseouts.
            </p>
          </Step>

          <Step n={12}>
            E-file through TaxAct. You'll get confirmation emails from both
            TaxAct and the IRS (typically within 24-48 hours of submission).
          </Step>
        </ol>
      </div>

      {/* ═══ Alternative filing options ═══ */}
      <div className="border border-gray-200 rounded-lg bg-white p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">
          Alternative filing paths
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="border border-gray-100 rounded p-3">
            <div className="font-semibold text-gray-800">
              FreeTaxUSA + Form8949.com
            </div>
            <p className="text-gray-600 mt-1">
              Free federal filing. For trades, use Form8949.com to convert your
              CSV to their import format first, then enter other data manually
              in FreeTaxUSA.
            </p>
          </div>
          <div className="border border-gray-100 rounded p-3">
            <div className="font-semibold text-gray-800">TurboTax</div>
            <p className="text-gray-600 mt-1">
              TurboTax Premier supports Form 8949 CSV import. More expensive
              than TaxAct but has stronger state tax support.
            </p>
          </div>
          <div className="border border-gray-100 rounded p-3">
            <div className="font-semibold text-gray-800">File by mail</div>
            <p className="text-gray-600 mt-1">
              Print the All Forms PDF above, attach W-2s, sign, and mail to the
              IRS address listed in the Form 1040 instructions. Allow 6-8 weeks
              for processing.
            </p>
          </div>
          <div className="border border-gray-100 rounded p-3 opacity-60">
            <div className="font-semibold text-gray-800 flex items-center gap-2">
              File directly from Temple Stuart
              <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-semibold text-gray-600 bg-gray-100 border border-gray-200 rounded">
                coming soon
              </span>
            </div>
            <p className="text-gray-600 mt-1">
              E-file integration via Column Tax — full MeF submission without
              leaving the app. Planned for a future release.
            </p>
          </div>
        </div>
      </div>

      {/* ═══ Filing checklist ═══ */}
      <div className="border border-gray-200 rounded-lg bg-white p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">
          Before filing, verify
        </h3>
        <ul className="space-y-2">
          {[
            { key: 'w2', label: 'All W-2 data entered correctly' },
            { key: 'r1099', label: '1099-R data matches your form' },
            {
              key: 'schedc',
              label: 'Schedule C expenses match your bank statements',
            },
            {
              key: 'form8949',
              label: 'Form 8949 trades match your broker 1099-B',
            },
            {
              key: 'match',
              label: `TaxAct's computed tax matches Temple Stuart's estimate (±$50 of ${fmtMoney(
                Math.abs(f.amountOwed)
              )})`,
            },
          ].map((item) => {
            const checked = checklist.has(item.key);
            return (
              <li key={item.key}>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleCheck(item.key)}
                    className="mt-0.5 w-4 h-4 accent-blue-600"
                  />
                  <span
                    className={`text-sm ${
                      checked ? 'text-gray-500 line-through' : 'text-gray-800'
                    }`}
                  >
                    {item.label}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>

      {/* ═══ Post-filing ═══ */}
      <div className="border border-gray-200 rounded-lg bg-gray-50 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">
          After you file
        </h3>
        <ul className="space-y-1 text-xs text-gray-700 list-disc list-inside">
          <li>
            Save your Form 8949 CSV and All Forms PDF in a safe place for your
            records (IRS recommends keeping tax records for 3 years, or 7 years
            if you claimed a loss from worthless securities).
          </li>
          <li>
            Download your CPA Export Package for recordkeeping and handoff to
            your accountant if needed.
          </li>
          <li>
            Track your refund at{' '}
            <a
              href="https://www.irs.gov/refunds"
              target="_blank"
              rel="noreferrer"
              className="text-blue-700 underline"
            >
              irs.gov/refunds
            </a>{' '}
            (available 24-48 hours after e-filing).
          </li>
          <li>
            If you need to amend: Form 1040-X support is coming soon. For now,
            use your filing software's amendment flow.
          </li>
        </ul>
      </div>

      {/* ═══ Finish ═══ */}
      <div className="flex items-center justify-between pt-2">
        <div className="text-xs text-gray-500">
          {checklist.size === 5
            ? 'Checklist complete — ready to file.'
            : `Checklist: ${checklist.size} of 5 items verified.`}
        </div>
        <button
          type="button"
          onClick={onComplete}
          className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700"
        >
          Finish
        </button>
      </div>

      <p className="text-xs text-gray-400 italic">{calc.disclaimer}</p>
    </div>
  );
}

// ─── Step list item ───────────────────────────────────────────────

function Step({
  n,
  children,
}: {
  n: number;
  children: React.ReactNode;
}) {
  return (
    <li className="px-4 py-3 flex gap-3">
      <span className="shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white font-mono text-xs font-bold flex items-center justify-center">
        {n}
      </span>
      <div className="flex-1 text-sm text-gray-800">{children}</div>
    </li>
  );
}

// ─── Client-side CSV/TXT generators ────────────────────────────────
//
// Column formats match scripts/tax-export-2025.ts so the browser-generated
// files are identical to the CLI-generated ones.

function downloadScheduleCLines(sc: ScheduleCFull, year: number) {
  const rows: unknown[][] = [];
  if (sc.line1 !== 0) {
    rows.push([
      '1',
      'Gross receipts',
      sc.line1.toFixed(2),
      String(sc.revenueAccounts?.length ?? 0),
    ]);
  }
  for (const exp of sc.expenses) {
    rows.push([
      exp.line,
      exp.label,
      exp.amount.toFixed(2),
      String(exp.accounts?.length ?? 0),
    ]);
  }
  rows.push(['28', 'Total expenses', sc.line28.toFixed(2), '']);
  rows.push(['31', 'Net profit or (loss)', sc.line31.toFixed(2), '']);
  generateAndDownloadCSV(
    `schedule-c-${year}-lines.csv`,
    ['Schedule C Line', 'IRS Label', 'Total Amount', 'Account Count'],
    rows
  );
}

function downloadScheduleCDetail(sc: ScheduleCFull, year: number) {
  const rows: unknown[][] = [];
  // Revenue accounts (Line 1)
  for (const a of sc.revenueAccounts ?? []) {
    rows.push(['1', a.code, a.name, a.amount.toFixed(2), '']);
  }
  // Expense lines → accounts
  for (const exp of sc.expenses) {
    for (const a of exp.accounts ?? []) {
      rows.push([exp.line, a.code, a.name, a.amount.toFixed(2), '']);
    }
  }
  generateAndDownloadCSV(
    `schedule-c-${year}-detail.csv`,
    ['Schedule C Line', 'Account Code', 'Account Name', 'Amount', 'Entry Count'],
    rows
  );
}

function downloadTaxSummary(
  f: Form1040Full,
  calc: CalculateResponse,
  w2s: TaxDocument[],
  r1099s: TaxDocument[],
  e1098s: TaxDocument[],
  t1098s: TaxDocument[],
  year: number
) {
  const m = (n: number) => `$${Math.abs(n).toFixed(2)}${n < 0 ? ' (loss)' : ''}`;
  const lines: string[] = [
    `=== Temple Stuart Tax Filing Summary — ${year} ===`,
    `Generated: ${new Date().toISOString()}`,
    `Filing status: ${f.filingStatus.replace(/_/g, ' ')}`,
    '',
  ];

  // W-2
  if (w2s.length > 0) {
    lines.push('--- W-2 Wages ---');
    for (const d of w2s) {
      const data = d.data as Record<string, unknown>;
      lines.push(`  ${(data.employer_name as string) || d.label || 'Employer'}`);
      lines.push(`    EIN: ${(data.employer_ein as string) || '—'}`);
      lines.push(`    Box 1  Wages:        ${m(Number(data.gross_wages) || 0)}`);
      lines.push(`    Box 2  Fed withheld:  ${m(Number(data.federal_withheld) || 0)}`);
      lines.push(`    Box 3  SS wages:      ${m(Number(data.social_security_wages) || 0)}`);
      lines.push(`    Box 5  Medicare wages: ${m(Number(data.medicare_wages) || 0)}`);
      lines.push(`    Box 16 State wages:   ${m(Number(data.state_wages) || 0)}`);
      lines.push(`    Box 17 State WH:      ${m(Number(data.state_withheld) || 0)}`);
    }
    lines.push('');
  }

  // 1099-R
  if (r1099s.length > 0) {
    lines.push('--- 1099-R Retirement ---');
    for (const d of r1099s) {
      const data = d.data as Record<string, unknown>;
      lines.push(`  ${(data.payer_name as string) || d.label || 'Payer'}`);
      lines.push(`    Box 1  Gross:    ${m(Number(data.gross_distribution) || 0)}`);
      lines.push(`    Box 2a Taxable:  ${m(Number(data.taxable_amount) || 0)}`);
      lines.push(`    Box 4  Fed WH:   ${m(Number(data.federal_withheld) || 0)}`);
      lines.push(`    Box 7  Code:     ${(data.distribution_code as string) || '—'}`);
    }
    lines.push('');
  }

  // 1098-T
  if (t1098s.length > 0) {
    lines.push('--- 1098-T Education ---');
    for (const d of t1098s) {
      const data = d.data as Record<string, unknown>;
      lines.push(`  ${(data.school_name as string) || d.label || 'School'}`);
      lines.push(`    Box 1  Tuition:      ${m(Number(data.amounts_billed) || 0)}`);
      lines.push(`    Box 5  Scholarships: ${m(Number(data.scholarships) || 0)}`);
    }
    lines.push('');
  }

  // 1098-E
  if (e1098s.length > 0) {
    lines.push('--- 1098-E Student Loan ---');
    for (const d of e1098s) {
      const data = d.data as Record<string, unknown>;
      lines.push(`  ${(data.lender_name as string) || d.label || 'Lender'}`);
      lines.push(`    Box 1  Interest: ${m(Number(data.interest_paid) || 0)}`);
    }
    lines.push('');
  }

  // Schedule C
  if (f.scheduleC.expenses.length > 0 || f.scheduleC.line1 !== 0) {
    lines.push('--- Schedule C (Business) ---');
    lines.push(`  Business: ${f.scheduleC.businessName}`);
    lines.push(`  Line 1  Gross receipts:  ${m(f.scheduleC.line1)}`);
    for (const exp of f.scheduleC.expenses.filter((e) => e.amount !== 0)) {
      lines.push(`  Line ${exp.line.padEnd(4)} ${exp.label.padEnd(30)} ${m(exp.amount)}`);
    }
    lines.push(`  Line 28 Total expenses:  ${m(f.scheduleC.line28)}`);
    lines.push(`  Line 31 Net profit/loss: ${m(f.scheduleC.line31)}`);
    lines.push('');
  }

  // Schedule D
  const disp = calc.form_8949.summary;
  if (disp.total_dispositions > 0) {
    lines.push('--- Schedule D / Form 8949 ---');
    lines.push(`  Dispositions: ${disp.total_dispositions} (${disp.short_term_count} ST, ${disp.long_term_count} LT)`);
    lines.push(`  Line 7 net ST:  ${m(f.line7 - (f as unknown as Record<string, number>).line7_ltcg || f.line7)}`);
    lines.push(`  Line 15 net LT: ${m((f as unknown as Record<string, number>).line7_ltcg || 0)}`);
    lines.push(`  Line 16 net:    ${m(f.line7)}`);
    lines.push('');
  }

  // Form 1040
  lines.push('--- Form 1040 Key Lines ---');
  lines.push(`  Line 1   Wages:              ${m(f.line1)}`);
  lines.push(`  Line 5b  Pensions taxable:   ${m(f.line5b)}`);
  lines.push(`  Line 7   Capital gain/loss:  ${m(f.line7)}`);
  lines.push(`  Line 8   Other income:       ${m(f.line8)}`);
  lines.push(`  Line 11  AGI:                ${m(f.line11)}`);
  lines.push(`  Line 15  Taxable income:     ${m(f.line15)}`);
  lines.push(`  Line 16  Income tax:         ${m(f.incomeTax)}`);
  if (f.selfEmploymentTax > 0) {
    lines.push(`          SE tax:             ${m(f.selfEmploymentTax)}`);
  }
  lines.push(`  Line 24  Total tax:          ${m(f.totalTax)}`);
  lines.push(`  Line 25a W-2 fed withheld:   ${m(f.w2Withheld)}`);
  if (f.retirementWithheld > 0) {
    lines.push(`  Line 25b 1099-R fed WH:     ${m(f.retirementWithheld)}`);
  }
  if (f.estimatedPayments > 0) {
    lines.push(`  Line 26  Est. payments:     ${m(f.estimatedPayments)}`);
  }
  lines.push(`  Line 33  Total payments:     ${m(f.totalPayments)}`);
  lines.push('');
  lines.push(
    f.isRefund
      ? `  >>> ESTIMATED REFUND:    ${m(Math.abs(f.amountOwed))}`
      : `  >>> ESTIMATED AMOUNT OWED: ${m(Math.abs(f.amountOwed))}`
  );
  lines.push('');
  lines.push(calc.disclaimer);
  lines.push('');
  lines.push('This summary was generated from Temple Stuart. All figures must be');
  lines.push('verified by a licensed CPA or tax professional before filing.');

  generateAndDownloadTxt(`tax-filing-summary-${year}.txt`, lines.join('\n'));
}
