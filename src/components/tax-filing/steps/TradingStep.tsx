'use client';

import { useState, useEffect, useCallback } from 'react';
import type { StepProps } from '../TaxFilingWizard';
import WashSaleReport from '../WashSaleReport';

// ═══════════════════════════════════════════════════════════════════
// Step 4 — Trading (Schedule D + Form 8949)
//
// Capital gains/losses review. All numbers come from:
//   • /api/tax/calculate — Form 1040 Line 7 components, 8949 summary counts
//   • /api/tax/report    — full 8949 entries with box_reasoning + wash sale
//                          summary + warnings (from Step 2 fix)
//   • /api/tax/wash-sales — per-violation detail (symbol → violations)
//
// Read-only. Actual export CSV is produced in the File step.
// ═══════════════════════════════════════════════════════════════════

// ─── Wire types (loose) ────────────────────────────────────────────

interface Form8949Entry {
  description: string;
  dateAcquired: string;
  dateSold: string;
  proceeds: number;
  costBasis: number;
  adjustmentCode: string;
  adjustmentAmount: number;
  gainOrLoss: number;
  isLongTerm: boolean;
  holdingDays: number;
  symbol: string;
  assetType: 'stock' | 'option';
  box: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  box_reasoning?: string;
}

interface ScheduleDLine {
  line: string;
  description: string;
  proceeds: number;
  costBasis: number;
  adjustments: number;
  gainOrLoss: number;
}

interface ScheduleD {
  partI: {
    line1a: ScheduleDLine;
    line1b: ScheduleDLine;
    line1c: ScheduleDLine;
    line7: ScheduleDLine;
  };
  partII: {
    line8a: ScheduleDLine;
    line8b: ScheduleDLine;
    line8c: ScheduleDLine;
    line15: ScheduleDLine;
  };
  line16: ScheduleDLine;
}

interface TaxReport {
  taxYear: number;
  form8949: { shortTerm: Form8949Entry[]; longTerm: Form8949Entry[] };
  scheduleD: ScheduleD;
  summary: {
    totalDispositions: number;
    shortTermCount: number;
    longTermCount: number;
    totalProceeds: number;
    totalCostBasis: number;
    totalAdjustments: number;
    netGainOrLoss: number;
    washSaleCount: number;
    washSaleDisallowed: number;
    washSalesApplied?: number;
  };
  warnings?: string[];
}

interface WashViolation {
  dispositionId: string;
  symbol: string;
  saleDate: string;
  quantitySold: number;
  realizedLoss: number;
  replacementType: 'stock' | 'option';
  replacementDate: string;
  disallowedLoss: number;
  sharesAffected: number;
}

interface WashSalesResponse {
  violations: WashViolation[];
  summary: {
    totalDisallowedLosses: number;
    totalViolations: number;
    symbolsAffected: string[];
  };
  bySymbol: Array<{
    symbol: string;
    violations: WashViolation[];
    totalDisallowed: number;
    count: number;
  }>;
}

// ─── Helpers ───────────────────────────────────────────────────────

function filterWashSalesByYear(
  data: WashSalesResponse | null,
  year: number
): WashSalesResponse | null {
  if (!data) return null;
  const yearStr = String(year);
  const filtered = data.violations.filter((v) =>
    v.saleDate.startsWith(yearStr)
  );
  const bySymMap = new Map<
    string,
    {
      symbol: string;
      violations: WashViolation[];
      totalDisallowed: number;
      count: number;
    }
  >();
  for (const v of filtered) {
    let entry = bySymMap.get(v.symbol);
    if (!entry) {
      entry = { symbol: v.symbol, violations: [], totalDisallowed: 0, count: 0 };
      bySymMap.set(v.symbol, entry);
    }
    entry.violations.push(v);
    entry.totalDisallowed += v.disallowedLoss;
    entry.count += 1;
  }
  return {
    ...data,
    violations: filtered,
    summary: {
      ...data.summary,
      totalViolations: filtered.length,
      totalDisallowedLosses: filtered.reduce(
        (s, v) => s + v.disallowedLoss,
        0
      ),
      symbolsAffected: [...bySymMap.keys()],
    },
    bySymbol: Array.from(bySymMap.values()).sort(
      (a, b) => b.totalDisallowed - a.totalDisallowed
    ),
  };
}

function fmtMoney(n: number | null | undefined): string {
  if (n == null) return '—';
  const abs = Math.abs(n);
  const s = abs.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return n < 0 ? `($${s})` : `$${s}`;
}

function gainLossClass(n: number): string {
  if (n > 0) return 'text-emerald-700';
  if (n < 0) return 'text-red-600';
  return 'text-gray-700';
}

function fmtDate(iso: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${m}/${d}/${y.slice(2)}`;
}

// IRS Form 8949 box descriptions (Pub 550)
const BOX_DESCRIPTIONS: Record<Form8949Entry['box'], string> = {
  A: 'Short-term transactions reported on Form 1099-B showing basis was reported to the IRS',
  B: 'Short-term transactions reported on Form 1099-B showing basis was NOT reported to the IRS',
  C: 'Short-term transactions for which you did not receive a Form 1099-B',
  D: 'Long-term transactions reported on Form 1099-B showing basis was reported to the IRS',
  E: 'Long-term transactions reported on Form 1099-B showing basis was NOT reported to the IRS',
  F: 'Long-term transactions for which you did not receive a Form 1099-B',
};

const BOX_ORDER: Form8949Entry['box'][] = ['A', 'B', 'C', 'D', 'E', 'F'];

// CSV column order matches generateForm8949CSV in tax-report-service.ts
const CSV_HEADERS = [
  'Description of Property',
  'Date Acquired',
  'Date Sold',
  'Proceeds',
  'Cost or Other Basis',
  'Adjustment Code',
  'Adjustment Amount',
  'Gain or Loss',
  'Short/Long Term',
  'Box',
];

// ─── Component ─────────────────────────────────────────────────────

export default function TradingStep({
  taxYear,
  onComplete,
  lifeEvents,
}: StepProps) {
  const [report, setReport] = useState<TaxReport | null>(null);
  const [washSales, setWashSales] = useState<WashSalesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showWashReport, setShowWashReport] = useState(false);

  const loadAll = useCallback(async () => {
    if (!lifeEvents.hasTrading) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [reportRes, washRes] = await Promise.all([
        fetch(`/api/tax/report?year=${taxYear}`),
        fetch('/api/tax/wash-sales').catch(() => null),
      ]);
      if (!reportRes.ok) {
        const body = await reportRes.json().catch(() => ({}));
        throw new Error(body.error || `tax/report HTTP ${reportRes.status}`);
      }
      setReport((await reportRes.json()) as TaxReport);
      if (washRes?.ok) {
        setWashSales((await washRes.json()) as WashSalesResponse);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load trading data');
    } finally {
      setLoading(false);
    }
  }, [taxYear, lifeEvents.hasTrading]);

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

  // ── Non-trading short-circuit ────────────────────────────────────

  if (!lifeEvents.hasTrading) {
    return (
      <div className="space-y-4">
        <div className="px-4 py-4 bg-gray-50 border border-gray-200 rounded">
          <p className="text-sm text-gray-800">
            No trading activity for {taxYear}. Skip to the next step.
          </p>
          <p className="text-xs text-gray-500 mt-1">
            If you bought or sold investments, go back to Step 1 and check "I
            bought or sold investments".
          </p>
        </div>
      </div>
    );
  }

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
        Failed to load trading data: {error}
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

  if (!report) {
    return (
      <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded text-sm text-gray-700">
        No trading data available for {taxYear}.
      </div>
    );
  }

  const allEntries: Form8949Entry[] = [
    ...report.form8949.shortTerm,
    ...report.form8949.longTerm,
  ];

  // Group by box
  const entriesByBox: Record<string, Form8949Entry[]> = {};
  for (const e of allEntries) {
    (entriesByBox[e.box] = entriesByBox[e.box] || []).push(e);
  }
  // Sort each box's entries by date sold descending
  for (const box of Object.keys(entriesByBox)) {
    entriesByBox[box].sort((a, b) => b.dateSold.localeCompare(a.dateSold));
  }

  const { scheduleD, summary, warnings } = report;

  // ── Year-scoped wash sale filtering ──────────────────────────────
  //
  // /api/tax/wash-sales returns ALL-TIME violations. The TradingStep is
  // for a specific taxYear, so only show violations whose saleDate falls
  // within that year. The report summary (washSaleCount, etc.) is already
  // year-scoped since it derives from the 8949 entries.
  const yearWashSales = filterWashSalesByYear(washSales, taxYear);
  const hasYearWashSales =
    summary.washSaleCount > 0 || (yearWashSales?.violations.length ?? 0) > 0;

  // ── Trade stats ──────────────────────────────────────────────────

  const winCount = allEntries.filter((e) => e.gainOrLoss > 0).length;
  const lossCount = allEntries.filter((e) => e.gainOrLoss < 0).length;
  const winRate =
    allEntries.length > 0 ? (winCount / allEntries.length) * 100 : 0;
  // Use filter + reduce so the result is only defined when real gains/losses
  // exist. Previous version seeded the accumulator with 0, which masked the
  // absence of any gains or losses as "$0.00" in the UI.
  const gainEntries = allEntries.filter((e) => e.gainOrLoss > 0);
  const lossEntries = allEntries.filter((e) => e.gainOrLoss < 0);
  const largestGain =
    gainEntries.length > 0
      ? gainEntries.reduce((m, e) => Math.max(m, e.gainOrLoss), -Infinity)
      : 0;
  const largestLoss =
    lossEntries.length > 0
      ? lossEntries.reduce((m, e) => Math.min(m, e.gainOrLoss), Infinity)
      : 0;

  const hasWashSaleWarning =
    (summary.washSalesApplied ?? 0) > 0 ||
    (warnings ?? []).some((w) => w.toLowerCase().includes('wash'));

  const handleNext = () => {
    if (hasWashSaleWarning) {
      const ok = confirm(
        `You have wash-sale adjustments applied in-memory only. They will appear on Form 8949, but the stock_lots cost-basis adjustments are NOT persisted to the database. Continue anyway?`
      );
      if (!ok) return;
    }
    onComplete();
  };

  // ─── Render ──────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-600">
        Review every closed position for {taxYear}. Each entry is classified by
        IRS Form 8949 box and contributes to Schedule D Parts I and II.
      </p>

      {/* ═══ Schedule D summary ═══ */}
      <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-gray-900">
              Schedule D — Capital Gains and Losses
            </div>
            <div className="text-xs text-gray-500">Tax year {taxYear}</div>
          </div>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded">
            ✓ from trading positions & lot dispositions
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-200">
          {/* Part I */}
          <div className="px-4 py-3">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Part I — Short-term (held 1 year or less)
            </h4>
            <ScheduleDRow line={scheduleD.partI.line1a} label="Line 1a — Box A" />
            <ScheduleDRow line={scheduleD.partI.line1b} label="Line 1b — Box B" />
            <ScheduleDRow line={scheduleD.partI.line1c} label="Line 1c — Box C" />
            <div className="pt-2 mt-2 border-t border-gray-100">
              <ScheduleDRow
                line={scheduleD.partI.line7}
                label="Line 7 — Net ST"
                bold
              />
            </div>
          </div>
          {/* Part II */}
          <div className="px-4 py-3">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Part II — Long-term (held more than 1 year)
            </h4>
            <ScheduleDRow line={scheduleD.partII.line8a} label="Line 8a — Box D" />
            <ScheduleDRow line={scheduleD.partII.line8b} label="Line 8b — Box E" />
            <ScheduleDRow line={scheduleD.partII.line8c} label="Line 8c — Box F" />
            <div className="pt-2 mt-2 border-t border-gray-100">
              <ScheduleDRow
                line={scheduleD.partII.line15}
                label="Line 15 — Net LT"
                bold
              />
            </div>
          </div>
        </div>
        {/* Line 16 combined */}
        <div className="px-4 py-3 bg-blue-50 border-t border-blue-200">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-blue-900">
              Line 16 — Net capital gain/(loss)
            </span>
            <span
              className={`font-mono text-lg font-bold ${gainLossClass(
                scheduleD.line16.gainOrLoss
              )}`}
            >
              {fmtMoney(scheduleD.line16.gainOrLoss)}
            </span>
          </div>
          {scheduleD.line16.gainOrLoss < -3000 && (
            <p className="text-xs text-amber-700 mt-1">
              Net loss exceeds the $3,000 annual deduction limit.{' '}
              {fmtMoney(Math.abs(scheduleD.line16.gainOrLoss) - 3000)} will be
              carried forward to future tax years.
            </p>
          )}
        </div>
      </div>

      {/* ═══ Wash sale summary (year-scoped) ═══ */}
      {hasYearWashSales && (
        <div className="border border-amber-200 bg-amber-50 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-amber-200">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-amber-900">
                Wash sales detected
              </span>
              <span className="text-sm font-mono text-amber-900">
                {fmtMoney(summary.washSaleDisallowed)} disallowed
              </span>
            </div>
            <p className="text-xs text-amber-800 mt-1">
              {summary.washSaleCount} violation
              {summary.washSaleCount === 1 ? '' : 's'}
              {(summary.washSalesApplied ?? 0) > 0 && (
                <>
                  {' '}
                  · {summary.washSalesApplied} applied in-memory only (not
                  persisted to DB)
                </>
              )}
            </p>
          </div>

          {(summary.washSalesApplied ?? 0) > 0 && (
            <div className="px-4 py-2 bg-amber-100 text-xs text-amber-900 border-b border-amber-200">
              Wash-sale adjustments are shown in your 8949 but not yet persisted
              to the database. They will be included in your export. Call{' '}
              <code className="font-mono bg-white/60 px-1 rounded">
                POST /api/tax/wash-sales
              </code>{' '}
              to persist the cost-basis adjustments to stock_lots.
            </div>
          )}

          {yearWashSales && yearWashSales.bySymbol.length > 0 && (
            <div className="px-4 py-2">
              <ul className="space-y-1 text-xs">
                {yearWashSales.bySymbol.map((s) => (
                  <li
                    key={s.symbol}
                    className="flex items-center justify-between"
                  >
                    <span>
                      <span className="font-mono font-semibold text-amber-900">
                        {s.symbol}
                      </span>
                      <span className="text-amber-800 ml-2">
                        {s.count} violation{s.count === 1 ? '' : 's'}
                      </span>
                    </span>
                    <span className="font-mono text-amber-900">
                      {fmtMoney(s.totalDisallowed)} disallowed
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="px-4 py-2 border-t border-amber-200 bg-amber-100/50">
            <button
              type="button"
              onClick={() => setShowWashReport((v) => !v)}
              className="text-xs font-semibold text-amber-900 underline hover:no-underline"
            >
              {showWashReport
                ? 'Hide detailed wash sale report'
                : 'View detailed wash sale report →'}
            </button>
          </div>
        </div>
      )}

      {/* ═══ Detailed wash sale report (toggle) ═══ */}
      {showWashReport && (
        <div className="border border-gray-200 rounded-lg bg-gray-50/40 p-4">
          <WashSaleReport taxYear={taxYear} />
        </div>
      )}

      {/* ═══ Form 8949 entries by box ═══ */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">
            Form 8949 — Sales and Dispositions
          </h3>
          <span className="text-xs text-gray-500">
            {allEntries.length} entr{allEntries.length === 1 ? 'y' : 'ies'}
          </span>
        </div>

        {allEntries.length === 0 && (
          <div className="px-4 py-4 bg-gray-50 border border-gray-200 rounded text-sm text-gray-700">
            No dispositions recorded for {taxYear}.
          </div>
        )}

        {BOX_ORDER.map((box) => {
          const entries = entriesByBox[box] || [];
          if (entries.length === 0) return null;

          const boxKey = `box:${box}`;
          const isBoxOpen = expanded.has(boxKey);
          const boxProceeds = entries.reduce((s, e) => s + e.proceeds, 0);
          const boxBasis = entries.reduce((s, e) => s + e.costBasis, 0);
          const boxGL = entries.reduce((s, e) => s + e.gainOrLoss, 0);
          const washCount = entries.filter(
            (e) => e.adjustmentCode === 'W'
          ).length;

          return (
            <div
              key={box}
              className="border border-gray-200 rounded-lg bg-white overflow-hidden"
            >
              <button
                type="button"
                onClick={() => toggle(boxKey)}
                className="w-full px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between hover:bg-gray-100"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs text-gray-400 w-3">
                    {isBoxOpen ? '▼' : '▶'}
                  </span>
                  <div className="text-left min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded font-mono text-xs font-bold text-white bg-blue-600">
                        {box}
                      </span>
                      <span className="text-sm font-semibold text-gray-900">
                        Box {box}
                      </span>
                      <span className="text-xs text-gray-500">
                        {entries.length} entr{entries.length === 1 ? 'y' : 'ies'}
                      </span>
                      {washCount > 0 && (
                        <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 bg-amber-100 border border-amber-200 rounded">
                          W × {washCount}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5 truncate">
                      {BOX_DESCRIPTIONS[box]}
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">
                    Gain/Loss
                  </div>
                  <div
                    className={`font-mono text-sm font-semibold ${gainLossClass(boxGL)}`}
                  >
                    {fmtMoney(boxGL)}
                  </div>
                </div>
              </button>

              {isBoxOpen && (
                <div>
                  <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 grid grid-cols-12 gap-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                    <span className="col-span-3">Symbol / Description</span>
                    <span className="col-span-2">Acquired</span>
                    <span className="col-span-2">Sold</span>
                    <span className="col-span-2 text-right">Proceeds</span>
                    <span className="col-span-2 text-right">Basis</span>
                    <span className="col-span-1 text-right">G/L</span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {entries.map((entry, idx) => {
                      const entryKey = `${boxKey}:${idx}`;
                      const isEntryOpen = expanded.has(entryKey);
                      const isWash = entry.adjustmentCode === 'W';
                      return (
                        <div key={entryKey}>
                          <button
                            type="button"
                            onClick={() => toggle(entryKey)}
                            className={`w-full px-4 py-2 grid grid-cols-12 gap-2 items-center text-xs hover:bg-gray-50 ${
                              isWash ? 'bg-amber-50/40' : ''
                            }`}
                          >
                            <span className="col-span-3 flex items-center gap-1 min-w-0">
                              <span className="text-gray-400 text-[10px]">
                                {isEntryOpen ? '▼' : '▶'}
                              </span>
                              <span className="font-mono font-semibold text-gray-900">
                                {entry.symbol}
                              </span>
                              {isWash && (
                                <span className="inline-flex items-center px-1 py-0 text-[9px] font-bold text-amber-800 bg-amber-100 border border-amber-200 rounded">
                                  W
                                </span>
                              )}
                              {entry.assetType === 'option' && (
                                <span className="text-[9px] text-gray-400">
                                  opt
                                </span>
                              )}
                            </span>
                            <span className="col-span-2 font-mono text-gray-600">
                              {fmtDate(entry.dateAcquired)}
                            </span>
                            <span className="col-span-2 font-mono text-gray-600">
                              {fmtDate(entry.dateSold)}
                            </span>
                            <span className="col-span-2 text-right font-mono text-gray-700">
                              {fmtMoney(entry.proceeds)}
                            </span>
                            <span className="col-span-2 text-right font-mono text-gray-700">
                              {fmtMoney(entry.costBasis)}
                            </span>
                            <span
                              className={`col-span-1 text-right font-mono font-semibold ${gainLossClass(entry.gainOrLoss)}`}
                            >
                              {fmtMoney(entry.gainOrLoss)}
                            </span>
                          </button>

                          {isEntryOpen && (
                            <div className="px-4 pb-3 bg-gray-50/60 text-xs space-y-1">
                              <DetailRow
                                label="Description"
                                value={entry.description}
                              />
                              <DetailRow
                                label="Holding period"
                                value={`${entry.holdingDays} day${entry.holdingDays === 1 ? '' : 's'} · ${entry.isLongTerm ? 'long-term' : 'short-term'}`}
                              />
                              <DetailRow
                                label="Asset type"
                                value={entry.assetType}
                              />
                              <DetailRow
                                label="Box reasoning"
                                value={
                                  entry.box_reasoning ||
                                  BOX_DESCRIPTIONS[entry.box]
                                }
                              />
                              {isWash && (
                                <>
                                  <DetailRow
                                    label="Adjustment code"
                                    value="W — Wash sale loss disallowed"
                                  />
                                  <DetailRow
                                    label="Adjustment amount"
                                    value={fmtMoney(entry.adjustmentAmount)}
                                  />
                                  <p className="text-amber-800 pt-1">
                                    The wash sale loss is disallowed on this
                                    sale and must be added to the cost basis of
                                    the replacement security.
                                  </p>
                                </>
                              )}
                              <DetailRow
                                label="Source"
                                value={
                                  entry.assetType === 'option'
                                    ? 'trading_positions'
                                    : 'lot_dispositions'
                                }
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 grid grid-cols-12 gap-2 text-xs font-semibold">
                    <span className="col-span-7 text-gray-600">
                      Box {box} totals
                    </span>
                    <span className="col-span-2 text-right font-mono text-gray-800">
                      {fmtMoney(boxProceeds)}
                    </span>
                    <span className="col-span-2 text-right font-mono text-gray-800">
                      {fmtMoney(boxBasis)}
                    </span>
                    <span
                      className={`col-span-1 text-right font-mono ${gainLossClass(boxGL)}`}
                    >
                      {fmtMoney(boxGL)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ═══ Trade statistics ═══ */}
      {allEntries.length > 0 && (
        <div className="border border-gray-200 rounded-lg bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            Trade statistics
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Metric
              label="Transactions"
              value={summary.totalDispositions.toLocaleString()}
            />
            <Metric
              label="Short / Long"
              value={`${summary.shortTermCount} / ${summary.longTermCount}`}
            />
            <Metric label="Win rate" value={`${winRate.toFixed(1)}%`} />
            <Metric
              label="Wins / Losses"
              value={`${winCount} / ${lossCount}`}
            />
            <Metric
              label="Largest gain"
              value={winCount > 0 ? fmtMoney(largestGain) : '—'}
              valueClass={winCount > 0 ? 'text-emerald-700' : 'text-gray-400'}
            />
            <Metric
              label="Largest loss"
              value={lossCount > 0 ? fmtMoney(largestLoss) : '—'}
              valueClass={lossCount > 0 ? 'text-red-600' : 'text-gray-400'}
            />
            <Metric
              label="Total proceeds"
              value={fmtMoney(summary.totalProceeds)}
            />
            <Metric
              label="Total basis"
              value={fmtMoney(summary.totalCostBasis)}
            />
          </div>
        </div>
      )}

      {/* ═══ CSV export preview ═══ */}
      {allEntries.length > 0 && (
        <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-900">
                Form 8949 CSV preview
              </div>
              <div className="text-xs text-gray-500">
                First 5 rows · full CSV will be available in the File step for
                TaxAct / TurboTax import
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] font-mono">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {CSV_HEADERS.map((h) => (
                    <th
                      key={h}
                      className="px-2 py-1.5 text-left text-gray-500 font-semibold whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {allEntries.slice(0, 5).map((e, i) => (
                  <tr key={i} className="text-gray-800">
                    <td className="px-2 py-1 whitespace-nowrap">
                      {e.description.length > 24
                        ? e.description.slice(0, 23) + '…'
                        : e.description}
                    </td>
                    <td className="px-2 py-1">{fmtDate(e.dateAcquired)}</td>
                    <td className="px-2 py-1">{fmtDate(e.dateSold)}</td>
                    <td className="px-2 py-1 text-right">
                      {e.proceeds.toFixed(2)}
                    </td>
                    <td className="px-2 py-1 text-right">
                      {e.costBasis.toFixed(2)}
                    </td>
                    <td className="px-2 py-1 text-center">
                      {e.adjustmentCode || ''}
                    </td>
                    <td className="px-2 py-1 text-right">
                      {e.adjustmentAmount !== 0
                        ? e.adjustmentAmount.toFixed(2)
                        : ''}
                    </td>
                    <td
                      className={`px-2 py-1 text-right ${gainLossClass(e.gainOrLoss)}`}
                    >
                      {e.gainOrLoss.toFixed(2)}
                    </td>
                    <td className="px-2 py-1">
                      {e.isLongTerm ? 'Long-term' : 'Short-term'}
                    </td>
                    <td className="px-2 py-1 text-center">{e.box}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {allEntries.length > 5 && (
            <div className="px-4 py-1.5 text-[11px] text-gray-400 text-center border-t border-gray-100">
              + {allEntries.length - 5} more rows
            </div>
          )}
        </div>
      )}

      {/* ═══ Continue action ═══ */}
      <div className="flex items-center justify-between pt-2">
        <div className="text-xs text-gray-500">
          {hasWashSaleWarning
            ? 'Wash-sale adjustments pending DB persistence.'
            : 'No warnings — Schedule D is ready.'}
        </div>
        <button
          type="button"
          onClick={handleNext}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
        >
          {hasWashSaleWarning ? 'Continue anyway' : 'Confirm Schedule D'}
        </button>
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────

function ScheduleDRow({
  line,
  label,
  bold,
}: {
  line: ScheduleDLine;
  label: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1 text-xs">
      <span className={bold ? 'font-semibold text-gray-900' : 'text-gray-600'}>
        {label}
      </span>
      <span
        className={`font-mono ${bold ? 'font-bold' : ''} ${gainLossClass(line.gainOrLoss)}`}
      >
        {fmtMoney(line.gainOrLoss)}
      </span>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-0.5">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="text-gray-800 text-right">{value}</span>
    </div>
  );
}

function Metric({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="border border-gray-100 rounded px-3 py-2">
      <div className="text-[10px] text-gray-500 uppercase tracking-wider">
        {label}
      </div>
      <div
        className={`font-mono text-sm font-semibold mt-0.5 ${valueClass || 'text-gray-900'}`}
      >
        {value}
      </div>
    </div>
  );
}
