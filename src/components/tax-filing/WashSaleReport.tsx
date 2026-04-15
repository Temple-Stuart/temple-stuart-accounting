'use client';

import { useState, useEffect, useCallback } from 'react';

// ═══════════════════════════════════════════════════════════════════
// WashSaleReport — surface the wash-sale endpoint in the UI.
//
// Data sources:
//   • GET  /api/tax/wash-sales — full violation detail (all-time)
//   • GET  /api/tax/report?year=X — exposes `summary.washSalesApplied`
//     which is the count of in-memory-merged (i.e. NOT yet persisted)
//     wash sales for the given tax year. We use this to decide whether
//     the "Apply adjustments" button needs to be shown.
//   • POST /api/tax/wash-sales — DESTRUCTIVE — applyWashSaleAdjustments
//     mutates stock_lots.cost_per_share + total_cost_basis, and is NOT
//     idempotent. A confirmation dialog is required before this fires.
// ═══════════════════════════════════════════════════════════════════

// ─── Wire types ────────────────────────────────────────────────────

interface WashSaleViolation {
  dispositionId: string;
  symbol: string;
  saleDate: string;
  quantitySold: number;
  proceedsPerShare: number;
  costBasisPerShare: number;
  realizedLoss: number;
  replacementType: 'stock' | 'option';
  replacementDate: string;
  replacementQuantity: number;
  replacementCostPerShare: number;
  replacementLotId: string | null;
  replacementPositionId: string | null;
  disallowedLoss: number;
  adjustedCostBasis: number;
  sharesAffected: number;
}

interface WashSalesSummary {
  totalDisallowedLosses: number;
  totalViolations: number;
  symbolsAffected: string[];
  stockToStockCount: number;
  stockToOptionCount: number;
  optionToStockCount: number;
  optionToOptionCount: number;
}

interface WashSalesBySymbol {
  symbol: string;
  violations: WashSaleViolation[];
  totalDisallowed: number;
  count: number;
}

interface WashSalesResponse {
  violations: WashSaleViolation[];
  summary: WashSalesSummary;
  bySymbol: WashSalesBySymbol[];
  taxImpact: {
    totalDisallowedLosses: number;
    estimatedAdditionalTax: number;
    note: string;
  };
}

interface TaxReportResponse {
  summary?: { washSalesApplied?: number };
  warnings?: string[];
}

interface ApplyResponse {
  success: boolean;
  message?: string;
  updated?: number;
  totalDisallowedLosses?: number;
  symbolsAffected?: string[];
}

interface Props {
  taxYear: number;
}

// ─── Helpers ───────────────────────────────────────────────────────

function fmtMoney(n: number): string {
  const abs = Math.abs(n);
  const s = abs.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return n < 0 ? `($${s})` : `$${s}`;
}

function fmtDate(iso: string): string {
  if (!iso) return '—';
  const d = iso.split('T')[0];
  const [y, m, day] = d.split('-');
  return `${m}/${day}/${y.slice(2)}`;
}

function daysBetween(iso1: string, iso2: string): number {
  const a = new Date(iso1).getTime();
  const b = new Date(iso2).getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

// ─── Component ─────────────────────────────────────────────────────

export default function WashSaleReport({ taxYear }: Props) {
  const [data, setData] = useState<WashSalesResponse | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<ApplyResponse | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showEducation, setShowEducation] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [washRes, reportRes] = await Promise.all([
        fetch('/api/tax/wash-sales'),
        fetch(`/api/tax/report?year=${taxYear}`).catch(() => null),
      ]);
      if (!washRes.ok) {
        const body = await washRes.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${washRes.status}`);
      }
      const wash = (await washRes.json()) as WashSalesResponse;
      setData(wash);

      let pending = 0;
      if (reportRes?.ok) {
        const report = (await reportRes.json()) as TaxReportResponse;
        pending = report?.summary?.washSalesApplied ?? 0;
      }
      setPendingCount(pending);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load wash sale data');
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

  const applyAdjustments = async () => {
    if (!data || data.violations.length === 0) return;
    const confirmed = confirm(
      'Apply wash sale adjustments?\n\n' +
        `${data.summary.totalViolations} violation(s) totaling ${fmtMoney(data.summary.totalDisallowedLosses)} disallowed.\n\n` +
        'This is destructive and NOT idempotent: it will\n' +
        '  • mark each affected disposition as is_wash_sale=true\n' +
        '  • set wash_sale_loss on each disposition\n' +
        '  • adjust cost_per_share and total_cost_basis on the replacement lots\n\n' +
        'Re-running this after applying once would double-adjust the cost basis. Continue?'
    );
    if (!confirmed) return;

    setApplying(true);
    setApplyResult(null);
    try {
      const res = await fetch('/api/tax/wash-sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const result = (await res.json()) as ApplyResponse;
      setApplyResult(result);
      // Refresh both data sets so the pending count drops to 0.
      await loadAll();
    } catch (e) {
      setApplyResult({
        success: false,
        message: e instanceof Error ? e.message : 'Apply failed',
      });
    } finally {
      setApplying(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="px-3 py-2 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded">
        Loading wash sale data…
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-3 py-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded">
        {error}
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

  if (!data) return null;

  const noViolations = data.violations.length === 0;
  const hasPending = pendingCount > 0;

  return (
    <div className="space-y-4">
      {/* ═══ Summary card ═══ */}
      <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-gray-900">
              Wash sale report
            </div>
            <div className="text-xs text-gray-500">
              All-time detection · per IRS Pub 550 (30-day window)
            </div>
          </div>
          <span
            className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold border rounded ${
              noViolations
                ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                : hasPending
                  ? 'text-amber-700 bg-amber-50 border-amber-200'
                  : 'text-emerald-700 bg-emerald-50 border-emerald-200'
            }`}
          >
            {noViolations
              ? 'No violations detected'
              : hasPending
                ? `${pendingCount} pending in ${taxYear}`
                : 'All applied'}
          </span>
        </div>

        {noViolations ? (
          <div className="px-4 py-4 text-sm text-gray-600">
            No wash sale violations detected for this user. Nothing to apply.
          </div>
        ) : (
          <div className="px-4 py-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Metric
              label="Total violations"
              value={data.summary.totalViolations.toLocaleString()}
            />
            <Metric
              label="Total disallowed"
              value={fmtMoney(data.summary.totalDisallowedLosses)}
            />
            <Metric
              label="Symbols affected"
              value={data.summary.symbolsAffected.length.toString()}
            />
            <Metric
              label="Est. additional tax"
              value={fmtMoney(data.taxImpact.estimatedAdditionalTax)}
              hint={data.taxImpact.note}
            />
            <Metric
              label="Stock → Stock"
              value={data.summary.stockToStockCount.toString()}
              muted
            />
            <Metric
              label="Stock → Option"
              value={data.summary.stockToOptionCount.toString()}
              muted
            />
            <Metric
              label="Option → Stock"
              value={data.summary.optionToStockCount.toString()}
              muted
            />
            <Metric
              label="Option → Option"
              value={data.summary.optionToOptionCount.toString()}
              muted
            />
          </div>
        )}
      </div>

      {/* ═══ Apply / status section ═══ */}
      {!noViolations && (
        <div
          className={`border rounded-lg p-4 ${
            hasPending
              ? 'border-amber-200 bg-amber-50'
              : 'border-emerald-200 bg-emerald-50'
          }`}
        >
          {hasPending ? (
            <>
              <div className="text-sm font-semibold text-amber-900 mb-1">
                {pendingCount} wash sale violation(s) detected for {taxYear} but
                NOT applied to your records
              </div>
              <p className="text-xs text-amber-800">
                Your Form 8949 already includes these adjustments in-memory (so
                the export is correct), but the underlying lot records still
                show the original cost basis. Applying writes them to the
                database.
              </p>
              <div className="mt-3 px-3 py-2 bg-white/60 border border-amber-200 rounded text-xs text-amber-900">
                <div className="font-semibold mb-1">Applying does:</div>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Mark each affected disposition as <code>is_wash_sale=true</code></li>
                  <li>Set <code>wash_sale_loss</code> on each disposition</li>
                  <li>
                    Adjust <code>cost_per_share</code> and{' '}
                    <code>total_cost_basis</code> on the replacement lots
                  </li>
                </ul>
                <div className="mt-2 text-amber-700">
                  This is a one-time operation. Re-running would{' '}
                  <strong>double-adjust</strong> the cost basis.
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-xs text-amber-700">
                  {applyResult && !applyResult.success && (
                    <>Error: {applyResult.message}</>
                  )}
                </span>
                <button
                  type="button"
                  onClick={applyAdjustments}
                  disabled={applying}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 rounded hover:bg-amber-700 disabled:opacity-50"
                >
                  {applying ? 'Applying…' : 'Apply adjustments'}
                </button>
              </div>
            </>
          ) : (
            <div className="text-sm text-emerald-800">
              ✓ All wash sale adjustments for {taxYear} have been applied to
              your records.
            </div>
          )}

          {applyResult?.success && (
            <div className="mt-3 px-3 py-2 bg-white/60 border border-emerald-200 rounded text-xs text-emerald-900">
              ✓ {applyResult.message ||
                `Applied ${applyResult.updated} wash sale adjustment(s)`}
              {applyResult.totalDisallowedLosses != null && (
                <> · {fmtMoney(applyResult.totalDisallowedLosses)} disallowed</>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══ By-symbol breakdown ═══ */}
      {!noViolations && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            By symbol
          </h4>
          {data.bySymbol.map((s) => {
            const symKey = `sym:${s.symbol}`;
            const isOpen = expanded.has(symKey);
            return (
              <div
                key={s.symbol}
                className="border border-gray-200 rounded-lg bg-white overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => toggle(symKey)}
                  className="w-full px-4 py-2 flex items-center justify-between hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 w-3">
                      {isOpen ? '▼' : '▶'}
                    </span>
                    <span className="font-mono font-semibold text-gray-900 text-sm">
                      {s.symbol}
                    </span>
                    <span className="text-xs text-gray-500">
                      {s.count} violation{s.count === 1 ? '' : 's'}
                    </span>
                  </div>
                  <span className="font-mono text-sm text-amber-900">
                    {fmtMoney(s.totalDisallowed)} disallowed
                  </span>
                </button>
                {isOpen && (
                  <div className="px-4 pb-3 border-t border-gray-100 divide-y divide-gray-100">
                    {s.violations.map((v, i) => {
                      const days = daysBetween(v.saleDate, v.replacementDate);
                      const before = days < 0;
                      return (
                        <div key={i} className="py-2 text-xs">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-0.5">
                            <DetailRow
                              label="Sale date"
                              value={fmtDate(v.saleDate)}
                            />
                            <DetailRow
                              label="Quantity sold"
                              value={String(v.quantitySold)}
                            />
                            <DetailRow
                              label="Sale price/share"
                              value={fmtMoney(v.proceedsPerShare)}
                            />
                            <DetailRow
                              label="Cost basis/share"
                              value={fmtMoney(v.costBasisPerShare)}
                            />
                            <DetailRow
                              label="Realized loss"
                              value={fmtMoney(v.realizedLoss)}
                              redIfNegative
                            />
                            <DetailRow
                              label="Disallowed amount"
                              value={fmtMoney(v.disallowedLoss)}
                              amber
                            />
                            <DetailRow
                              label="Replacement type"
                              value={v.replacementType}
                            />
                            <DetailRow
                              label="Replacement date"
                              value={fmtDate(v.replacementDate)}
                            />
                            <DetailRow
                              label="Replacement qty"
                              value={String(v.replacementQuantity)}
                            />
                            <DetailRow
                              label="Replacement price/share"
                              value={fmtMoney(v.replacementCostPerShare)}
                            />
                            <DetailRow
                              label="Shares affected"
                              value={String(v.sharesAffected)}
                            />
                            <DetailRow
                              label="Adjusted basis"
                              value={fmtMoney(v.adjustedCostBasis)}
                            />
                          </div>
                          <div className="mt-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded text-[11px] text-gray-700 font-mono">
                            Sale: {fmtDate(v.saleDate)} →
                            {' '}Replacement: {fmtDate(v.replacementDate)} →
                            {' '}{Math.abs(days)} day{Math.abs(days) === 1 ? '' : 's'}
                            {' '}{before ? 'before' : 'after'} sale (within
                            30-day wash sale window)
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ Educational section ═══ */}
      <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
        <button
          type="button"
          onClick={() => setShowEducation((v) => !v)}
          className="w-full px-4 py-2 flex items-center justify-between hover:bg-gray-50"
        >
          <span className="text-sm font-semibold text-gray-900">
            What is a wash sale?
          </span>
          <span className="text-xs text-gray-400">
            {showEducation ? '▼' : '▶'}
          </span>
        </button>
        {showEducation && (
          <div className="px-4 pb-4 border-t border-gray-100 text-sm text-gray-700 space-y-3 pt-3">
            <p>
              A <strong>wash sale</strong> happens when you sell a security at a
              loss and buy a substantially identical security within 30 days
              before or after the sale. The IRS disallows the loss on the sale
              for tax purposes — you don't get to claim it now.
            </p>
            <p>
              <strong>The 30-day rule.</strong> The window is 61 days total: 30
              days before your sale, the day of the sale, and 30 days after. If
              you replace the security anywhere in that window, the loss is
              disallowed.
            </p>
            <p>
              <strong>How it affects your taxes.</strong> The disallowed loss
              isn't gone — it's <em>deferred</em>. The amount gets added to the
              cost basis of the replacement security, so when you eventually
              sell the replacement, you recover the loss (or pay less gain). The
              holding period of the original sale also carries to the
              replacement.
            </p>
            <p>
              <strong>Options and wash sales.</strong> Temple Stuart takes a{' '}
              <strong>conservative</strong> stance: any option on the same
              underlying as a stock you sold at a loss is treated as
              substantially identical, and vice versa. The IRS hasn't published
              clear guidance on every options scenario, so we err on the side
              of disallowing more rather than missing one.
            </p>
            <p className="text-xs text-gray-500 italic">
              See IRS Publication 550 for the official rules.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────

function Metric({
  label,
  value,
  muted,
  hint,
}: {
  label: string;
  value: string;
  muted?: boolean;
  hint?: string;
}) {
  return (
    <div
      className={`border border-gray-100 rounded px-3 py-2 ${muted ? 'bg-gray-50/60' : ''}`}
    >
      <div className="text-[10px] text-gray-500 uppercase tracking-wider">
        {label}
      </div>
      <div
        className={`font-mono font-semibold mt-0.5 ${muted ? 'text-sm text-gray-700' : 'text-sm text-gray-900'}`}
      >
        {value}
      </div>
      {hint && (
        <div className="text-[10px] text-gray-400 mt-0.5 leading-tight">
          {hint}
        </div>
      )}
    </div>
  );
}

function DetailRow({
  label,
  value,
  redIfNegative,
  amber,
}: {
  label: string;
  value: string;
  redIfNegative?: boolean;
  amber?: boolean;
}) {
  let cls = 'text-gray-800';
  if (amber) cls = 'text-amber-900 font-semibold';
  else if (redIfNegative && value.startsWith('(')) cls = 'text-red-600';
  return (
    <div className="flex items-start justify-between gap-3 py-0.5">
      <span className="text-gray-500">{label}</span>
      <span className={`font-mono ${cls}`}>{value}</span>
    </div>
  );
}
