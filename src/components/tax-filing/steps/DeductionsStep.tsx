'use client';

import { useState, useEffect, useCallback } from 'react';
import type { StepProps } from '../TaxFilingWizard';

// ═══════════════════════════════════════════════════════════════════
// Step 3 — Deductions (Schedule C)
//
// Business-income and business-expense review. All numbers come from
// /api/tax/calculate which internally calls generateScheduleC() so the
// heavy lifting (ledger aggregation, wash-sale merging, data-quality
// warnings) already happened server-side. This component is purely a
// 3-level drill-down (line → account → ledger entry) plus a Schedule SE
// preview. Read-only.
// ═══════════════════════════════════════════════════════════════════

// ─── Wire types ────────────────────────────────────────────────────

interface SourceEntry {
  date: string;
  description: string;
  amount: number;
  journal_entry_id?: string;
  id?: string;
}

interface LineSource {
  type: string;
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
  line2: number;
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

interface ScheduleSE {
  line2: number;
  line3: number;
  line12: number;
  line13: number;
}

interface Form1040Full {
  scheduleC: ScheduleCFull;
  scheduleSE: ScheduleSE;
}

interface CalculateResponse {
  tax_year: number;
  disclaimer: string;
  schedule_c: Record<string, TracedLine>;
  form_1040_full: Form1040Full;
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

// ─── Component ─────────────────────────────────────────────────────

export default function DeductionsStep({
  taxYear,
  onComplete,
  lifeEvents,
}: StepProps) {
  const [calc, setCalc] = useState<CalculateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const loadCalc = useCallback(async () => {
    if (!lifeEvents.hasBusiness) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tax/calculate?year=${taxYear}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const json = (await res.json()) as CalculateResponse;
      setCalc(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load Schedule C');
    } finally {
      setLoading(false);
    }
  }, [taxYear, lifeEvents.hasBusiness]);

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

  // ── Non-business short-circuit ───────────────────────────────────

  if (!lifeEvents.hasBusiness) {
    return (
      <div className="space-y-4">
        <div className="px-4 py-4 bg-gray-50 border border-gray-200 rounded">
          <p className="text-sm text-gray-800">
            No business income or expenses for {taxYear}. Skip to the next step.
          </p>
          <p className="text-xs text-gray-500 mt-1">
            If you have business activity, go back to Step 1 and check "I ran a
            business or side gig".
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
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
        Failed to load Schedule C: {error}
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

  if (!calc || !calc.form_1040_full) {
    return (
      <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded text-sm text-gray-700">
        No Schedule C data available for {taxYear}.
      </div>
    );
  }

  const scheduleC = calc.form_1040_full.scheduleC;
  const scheduleSE = calc.form_1040_full.scheduleSE;
  const netProfit = scheduleC.line31;
  const hasNetLoss = netProfit < 0;

  // Build sorted expense lines (biggest first) and pull traced entries from schedule_c map
  const sortedExpenses = [...scheduleC.expenses].sort(
    (a, b) => b.amount - a.amount
  );

  const hasWarnings =
    scheduleC.unmappedAccounts.length > 0 ||
    (scheduleC.data_quality_warnings?.length ?? 0) > 0;

  // SE tax eligibility — IRS $400 threshold
  const seApplies = netProfit > 400;

  const handleNext = () => {
    if (hasWarnings) {
      const ok = confirm(
        `You have ${
          scheduleC.unmappedAccounts.length +
          (scheduleC.data_quality_warnings?.length ?? 0)
        } warning(s) on Schedule C. Continue anyway?`
      );
      if (!ok) return;
    }
    onComplete();
  };

  // ─── Render ──────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-600">
        Review your business income and expenses. Click any line to drill into
        the contributing accounts and individual ledger entries.
      </p>

      {/* ═══ Overview card ═══ */}
      <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-900">
                {scheduleC.businessName}
              </div>
              <div className="text-xs text-gray-500">
                Schedule C — Profit or Loss From Business · Tax year {taxYear}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">
                {hasNetLoss ? 'Net Loss' : 'Net Profit'}
              </div>
              <div
                className={`text-xl font-mono font-bold ${amountClass(netProfit)}`}
              >
                {fmtMoney(netProfit)}
              </div>
            </div>
          </div>
        </div>
        <div className="px-4 py-3 space-y-1">
          <Row
            label="Line 1 — Gross receipts"
            value={fmtMoney(scheduleC.line1)}
          />
          {scheduleC.line2 !== 0 && (
            <Row
              label="Line 2 — Returns and allowances"
              value={fmtMoney(scheduleC.line2)}
              muted
            />
          )}
          <Row
            label="Line 7 — Gross profit"
            value={fmtMoney(scheduleC.line7)}
          />
          <Row
            label="Line 28 — Total expenses"
            value={fmtMoney(scheduleC.line28)}
          />
          <div className="pt-2 border-t border-gray-100">
            <Row
              label="Line 31 — Net profit/(loss)"
              value={fmtMoney(netProfit)}
              bold
            />
          </div>
        </div>
        {hasNetLoss && (
          <div className="px-4 py-2 bg-amber-50 border-t border-amber-200 text-xs text-amber-800">
            This loss offsets your other income on Form 1040 Line 8 via
            Schedule 1.
          </div>
        )}
      </div>

      {/* ═══ Gross receipts drill-down ═══ */}
      {scheduleC.revenueAccounts.length > 0 && (
        <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
          <button
            type="button"
            onClick={() => toggle('revenue')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">
                {expanded.has('revenue') ? '▼' : '▶'}
              </span>
              <span className="text-sm font-semibold text-gray-900">
                Line 1 — Gross receipts
              </span>
              <span className="text-xs text-gray-500">
                {scheduleC.revenueAccounts.length} revenue account
                {scheduleC.revenueAccounts.length === 1 ? '' : 's'}
              </span>
            </div>
            <span className="font-mono text-sm text-gray-900">
              {fmtMoney(scheduleC.line1)}
            </span>
          </button>
          {expanded.has('revenue') && (
            <div className="px-4 pb-3 border-t border-gray-100 pt-2 space-y-0.5">
              {scheduleC.revenueAccounts.map((acct) => (
                <Row
                  key={acct.code}
                  indent={1}
                  label={
                    <span>
                      <span className="font-mono text-xs text-gray-400">
                        {acct.code}
                      </span>{' '}
                      {acct.name}
                    </span>
                  }
                  value={fmtMoney(acct.amount)}
                  muted
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ Expense lines — 3-level drill-down ═══ */}
      <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <span className="text-sm font-semibold text-gray-900">
            Part II — Expenses
          </span>
          <span className="ml-2 text-xs text-gray-500">
            sorted by amount · click any line to drill down
          </span>
        </div>
        <div className="divide-y divide-gray-100">
          {sortedExpenses.length === 0 && (
            <div className="px-4 py-4 text-sm text-gray-500">
              No expenses recorded for {taxYear}.
            </div>
          )}
          {sortedExpenses.map((exp) => {
            const lineKey = `exp:${exp.line}`;
            const isOpen = expanded.has(lineKey);
            const tracedLine = calc.schedule_c[`line_${exp.line}`];
            const tracedSources = tracedLine?.sources || [];

            return (
              <div key={exp.line}>
                <button
                  type="button"
                  onClick={() => toggle(lineKey)}
                  className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-gray-50"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-3">
                      {isOpen ? '▼' : '▶'}
                    </span>
                    <span className="text-sm text-gray-900">
                      <span className="font-mono text-xs text-gray-400 mr-1">
                        Line {exp.line}
                      </span>
                      {exp.label}
                    </span>
                  </div>
                  <span className="font-mono text-sm font-semibold text-gray-900">
                    {fmtMoney(exp.amount)}
                  </span>
                </button>

                {isOpen && (
                  <div className="border-l-2 border-blue-100 ml-6 pl-3 pb-2">
                    {exp.accounts.map((acct) => {
                      const acctKey = `${lineKey}:${acct.code}`;
                      const acctOpen = expanded.has(acctKey);
                      // Find the traced-source row for this account so we can
                      // grab entry_count + individual entries
                      const tracedForAcct = tracedSources.find(
                        (s) => s.account_code === acct.code
                      );
                      const entryCount = tracedForAcct?.entry_count ?? 0;
                      const entries = tracedForAcct?.entries ?? [];

                      return (
                        <div key={acct.code}>
                          <button
                            type="button"
                            onClick={() => toggle(acctKey)}
                            className="w-full py-1.5 flex items-center justify-between hover:bg-gray-50"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-400 w-3">
                                {acctOpen ? '▼' : '▶'}
                              </span>
                              <span className="font-mono text-xs text-gray-400">
                                {acct.code}
                              </span>
                              <span className="text-sm text-gray-700">
                                {acct.name}
                              </span>
                              {entryCount > 0 && (
                                <span className="text-[10px] text-gray-400">
                                  {entryCount}{' '}
                                  {entryCount === 1 ? 'entry' : 'entries'}
                                </span>
                              )}
                            </div>
                            <span className="font-mono text-sm text-gray-900">
                              {fmtMoney(acct.amount)}
                            </span>
                          </button>

                          {acctOpen && (
                            <div className="border-l border-dashed border-gray-200 ml-3 pl-3 pb-2 space-y-0">
                              {entries.length === 0 ? (
                                <p className="py-1 text-xs text-gray-400 italic">
                                  No individual entries available (amount was
                                  aggregated directly).
                                </p>
                              ) : (
                                <>
                                  {entries.map((entry, idx) => (
                                    <div
                                      key={
                                        entry.id ||
                                        `${entry.journal_entry_id}-${idx}`
                                      }
                                      className="flex items-center justify-between py-0.5 text-[11px] font-mono"
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className="text-gray-400 shrink-0">
                                          {entry.date}
                                        </span>
                                        <span className="text-gray-700 truncate">
                                          {entry.description}
                                        </span>
                                      </div>
                                      <span
                                        className={`shrink-0 ${
                                          entry.amount < 0
                                            ? 'text-red-600'
                                            : 'text-gray-700'
                                        }`}
                                      >
                                        {fmtMoney(entry.amount)}
                                      </span>
                                    </div>
                                  ))}
                                  <div className="pt-1 mt-1 border-t border-dashed border-gray-200 flex justify-between text-[11px]">
                                    <span className="text-emerald-600">
                                      ✓ {entries.length} entries ={' '}
                                      {fmtMoney(
                                        entries.reduce(
                                          (s, e) => s + e.amount,
                                          0
                                        )
                                      )}
                                    </span>
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══ Unmapped accounts warning ═══ */}
      {scheduleC.unmappedAccounts.length > 0 && (
        <div className="border border-amber-200 bg-amber-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-amber-700 font-semibold text-sm">
              {scheduleC.unmappedAccounts.length} account
              {scheduleC.unmappedAccounts.length === 1 ? '' : 's'} without a
              Schedule C line mapping
            </span>
          </div>
          <p className="text-xs text-amber-800 mb-2">
            These accounts have expenses but no Schedule C line mapping — they
            default to Line 27a (Other). You can map them to specific Schedule C
            lines in the Chart of Accounts settings.
          </p>
          <div className="space-y-0.5">
            {scheduleC.unmappedAccounts.map((a) => (
              <div
                key={a.code}
                className="flex items-center justify-between text-xs"
              >
                <span>
                  <span className="font-mono text-amber-900">{a.code}</span>
                  <span className="text-amber-800 ml-2">{a.name}</span>
                </span>
                <span className="font-mono text-amber-900">
                  {fmtMoney(a.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ Data quality warnings ═══ */}
      {scheduleC.data_quality_warnings &&
        scheduleC.data_quality_warnings.length > 0 && (
          <div className="border border-amber-200 bg-amber-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-amber-700 font-semibold text-sm">
                {scheduleC.data_quality_warnings.length} data quality warning
                {scheduleC.data_quality_warnings.length === 1 ? '' : 's'}
              </span>
            </div>
            <p className="text-xs text-amber-800 mb-2">
              These accounts had no ledger entries for {taxYear} but carry a
              non-zero lifetime balance — the lifetime amount was excluded from
              Schedule C to avoid overstating this year's expenses.
            </p>
            <ul className="space-y-1 text-xs text-amber-900">
              {scheduleC.data_quality_warnings.map((w, i) => (
                <li key={i}>
                  <span className="font-mono">{w.account_code}</span>{' '}
                  <span className="font-semibold">{w.account_name}</span>:{' '}
                  {w.warning}
                </li>
              ))}
            </ul>
          </div>
        )}

      {/* ═══ Schedule SE preview ═══ */}
      <div className="border-2 border-blue-200 bg-blue-50 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-900 uppercase tracking-wider mb-3">
          Schedule SE — Self-Employment Tax Preview
        </h3>
        {seApplies ? (
          <div className="space-y-0.5">
            <Row
              label="Line 2 — Net profit from Schedule C"
              value={fmtMoney(scheduleSE.line2)}
            />
            <Row
              label="Line 3 — Net earnings (Line 2 × 92.35%)"
              value={fmtMoney(scheduleSE.line3)}
              muted
            />
            <div className="pt-2 border-t border-blue-200">
              <Row
                label="Line 12 — Self-employment tax (15.3%)"
                value={fmtMoney(scheduleSE.line12)}
                bold
              />
            </div>
            <Row
              label="Line 13 — Deductible half of SE tax"
              value={fmtMoney(scheduleSE.line13)}
              muted
            />
            <p className="pt-2 text-xs text-blue-800">
              Line 13 flows to Schedule 1 as an adjustment to income, reducing
              your AGI.
            </p>
          </div>
        ) : (
          <p className="text-sm text-blue-900">
            No self-employment tax — net profit is {fmtMoney(netProfit)}{' '}
            {netProfit <= 0
              ? '(net loss)'
              : `(below the $400 SE threshold)`}
            .
          </p>
        )}
      </div>

      {/* ═══ Continue action ═══ */}
      <div className="flex items-center justify-between pt-2">
        <div className="text-xs text-gray-500">
          {hasWarnings
            ? `${
                scheduleC.unmappedAccounts.length +
                (scheduleC.data_quality_warnings?.length ?? 0)
              } warning(s) — review before continuing.`
            : 'No warnings — Schedule C is ready.'}
        </div>
        <button
          type="button"
          onClick={handleNext}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
        >
          {hasWarnings ? 'Continue anyway' : 'Confirm Schedule C'}
        </button>
      </div>

      <p className="text-xs text-gray-400 italic">{calc.disclaimer}</p>
    </div>
  );
}

// ─── Row helper ────────────────────────────────────────────────────

function Row({
  label,
  value,
  indent = 0,
  muted,
  bold,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  indent?: number;
  muted?: boolean;
  bold?: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between py-1 text-sm"
      style={{ paddingLeft: indent * 12 }}
    >
      <span
        className={`${
          muted ? 'text-gray-500' : bold ? 'text-gray-900 font-semibold' : 'text-gray-700'
        }`}
      >
        {label}
      </span>
      <span
        className={`font-mono ${
          muted ? 'text-gray-500' : bold ? 'text-gray-900 font-bold' : 'text-gray-900'
        }`}
      >
        {value}
      </span>
    </div>
  );
}
