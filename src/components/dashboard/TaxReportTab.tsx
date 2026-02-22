'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// ─── Existing interfaces (Schedule D + Form 8949) ──────────────

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
  box: string;
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
  partI: { line1a: ScheduleDLine; line1b: ScheduleDLine; line1c: ScheduleDLine; line7: ScheduleDLine };
  partII: { line8a: ScheduleDLine; line8b: ScheduleDLine; line8c: ScheduleDLine; line15: ScheduleDLine };
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
  };
  availableYears: number[];
}

// ─── New interfaces (Schedule C, SE, Form 1040) ────────────────

interface ScheduleCExpenseLine {
  line: string;
  label: string;
  amount: number;
  accounts: { code: string; name: string; amount: number }[];
}

interface ScheduleCData {
  taxYear: number;
  businessName: string;
  line1: number;
  line2: number;
  line7: number;
  expenses: ScheduleCExpenseLine[];
  line28: number;
  line31: number;
  unmappedAccounts: { code: string; name: string; amount: number }[];
  revenueAccounts: { code: string; name: string; amount: number }[];
}

interface ScheduleSEData {
  line2: number;
  line3: number;
  line12: number;
  line13: number;
}

interface TaxBracketBreakdown {
  bracket: string;
  rate: number;
  taxableInBracket: number;
  taxForBracket: number;
}

interface Form1040Data {
  taxYear: number;
  filingStatus: string;
  disclaimer: string;
  line1: number;
  line1Source: string;
  line5a: number;
  line5b: number;
  line7: number;
  line8: number;
  line9: number;
  seTaxDeduction: number;
  line11: number;
  standardDeduction: number;
  line15: number;
  incomeTax: number;
  bracketBreakdown: TaxBracketBreakdown[];
  earlyWithdrawalPenalty: number;
  selfEmploymentTax: number;
  totalTax: number;
  w2Withheld: number;
  retirementWithheld: number;
  estimatedPayments: number;
  totalPayments: number;
  amountOwed: number;
  isRefund: boolean;
  scheduleC: ScheduleCData;
  scheduleSE: ScheduleSEData;
  overridesUsed: string[];
}

// ─── View type ─────────────────────────────────────────────────

type ViewType = 'form1040' | 'scheduleC' | 'scheduleD' | 'form8949';

// ─── Filing status options ─────────────────────────────────────

const FILING_STATUSES = [
  { value: 'single', label: 'Single' },
  { value: 'married_joint', label: 'Married Filing Jointly' },
  { value: 'married_separate', label: 'Married Filing Separately' },
  { value: 'head_of_household', label: 'Head of Household' },
];

// ════════════════════════════════════════════════════════════════
// Component
// ════════════════════════════════════════════════════════════════

export default function TaxReportTab() {
  // Existing state (Schedule D + Form 8949)
  const [data, setData] = useState<TaxReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [view, setView] = useState<ViewType>('form1040');
  const [exporting, setExporting] = useState(false);

  // New state (Schedule C, Form 1040, overrides)
  const [scheduleCData, setScheduleCData] = useState<{ scheduleC: ScheduleCData; scheduleSE: ScheduleSEData } | null>(null);
  const [scheduleCLoading, setScheduleCLoading] = useState(false);
  const [form1040Data, setForm1040Data] = useState<Form1040Data | null>(null);
  const [form1040Loading, setForm1040Loading] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [savingOverride, setSavingOverride] = useState<string | null>(null);
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({});

  // ── Load existing Schedule D / Form 8949 data ──

  useEffect(() => {
    loadData(year);
  }, [year]);

  const loadData = async (y: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tax/report?year=${y}`);
      if (res.ok) {
        const report = await res.json();
        setData(report);
        if (report.availableYears?.length > 0 && !report.availableYears.includes(y)) {
          // Year is valid but has no data — keep it
        }
      }
    } catch (error) {
      console.error('Error loading tax report:', error);
    }
    setLoading(false);
  };

  // ── Load Schedule C data ──

  const loadScheduleC = useCallback(async (y: number) => {
    setScheduleCLoading(true);
    try {
      const res = await fetch(`/api/tax/report?year=${y}&form=schedule-c`);
      if (res.ok) {
        const result = await res.json();
        setScheduleCData(result);
      }
    } catch (error) {
      console.error('Error loading Schedule C:', error);
    }
    setScheduleCLoading(false);
  }, []);

  // ── Load Form 1040 data ──

  const loadForm1040 = useCallback(async (y: number) => {
    setForm1040Loading(true);
    try {
      const [f1040Res, overridesRes] = await Promise.all([
        fetch(`/api/tax/report?year=${y}&form=1040`),
        fetch(`/api/tax/overrides?year=${y}`),
      ]);
      if (f1040Res.ok) {
        setForm1040Data(await f1040Res.json());
      }
      if (overridesRes.ok) {
        const ov = await overridesRes.json();
        setOverrides(ov.overrides || {});
      }
    } catch (error) {
      console.error('Error loading Form 1040:', error);
    }
    setForm1040Loading(false);
  }, []);

  // ── Lazy-load new tabs on first switch or year change ──

  useEffect(() => {
    if (view === 'scheduleC') loadScheduleC(year);
    if (view === 'form1040') loadForm1040(year);
  }, [view, year, loadScheduleC, loadForm1040]);

  // ── Save override with debounce ──

  const saveOverride = useCallback((key: string, value: string) => {
    // Update local state immediately
    setOverrides((prev: Record<string, string>) => ({ ...prev, [key]: value }));

    // Clear existing debounce timer for this key
    if (debounceTimers.current[key]) {
      clearTimeout(debounceTimers.current[key]);
    }

    // Debounce the actual POST
    debounceTimers.current[key] = setTimeout(async () => {
      setSavingOverride(key);
      try {
        await fetch('/api/tax/overrides', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ year, overrides: { [key]: value } }),
        });
        // Re-fetch 1040 to recalculate
        const res = await fetch(`/api/tax/report?year=${year}&form=1040`);
        if (res.ok) setForm1040Data(await res.json());
      } catch (error) {
        console.error('Error saving override:', error);
      }
      setSavingOverride(null);
    }, 1000);
  }, [year]);

  // ── Export CSV ──

  const exportCSV = async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/tax/export?year=${year}&format=8949`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Form8949_${year}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export error:', error);
    }
    setExporting(false);
  };

  // ── Formatting helpers (unchanged) ──

  const fmt = (val: number) => {
    if (val === 0) return '-';
    const abs = Math.abs(val);
    const formatted = abs >= 1000
      ? `$${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : `$${abs.toFixed(2)}`;
    return val < 0 ? `(${formatted})` : formatted;
  };

  const plColor = (val: number) => val >= 0 ? 'text-green-700' : 'text-red-700';

  const fmtDate = (d: string) => {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
  };

  const fmtPct = (val: number) => `${(val * 100).toFixed(0)}%`;

  // ── Loading / error states ──

  if (loading) {
    return <div className="p-8 text-center text-sm text-gray-500">Generating tax report...</div>;
  }

  if (!data) {
    return <div className="p-8 text-center text-sm text-red-600">Failed to load tax report</div>;
  }

  const { summary, scheduleD } = data;
  const availableYears = data.availableYears.length > 0 ? data.availableYears : [year];

  // ── Tab definitions ──

  const tabs: { key: ViewType; label: string }[] = [
    { key: 'form1040', label: 'Form 1040' },
    { key: 'scheduleC', label: 'Schedule C' },
    { key: 'scheduleD', label: 'Schedule D' },
    { key: 'form8949', label: `Form 8949 (${summary.totalDispositions})` },
  ];

  // ════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════

  return (
    <div>
      {/* Header */}
      <div className="bg-[#2d1b4e] text-white px-4 py-2 flex items-center justify-between">
        <span className="text-sm font-semibold">Tax Reports</span>
        <div className="flex items-center gap-2">
          <select
            value={year}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setYear(Number(e.target.value))}
            className="bg-[#3d2b5e] text-white border-0 text-xs px-2 py-1 rounded"
          >
            {availableYears.map((y: number) => <option key={y} value={y}>{y}</option>)}
          </select>
          {(view === 'scheduleD' || view === 'form8949') && (
            <button
              onClick={exportCSV}
              disabled={exporting}
              className="text-xs bg-emerald-600 px-3 py-1 rounded hover:bg-emerald-700 disabled:opacity-50"
            >
              {exporting ? 'Exporting...' : 'Export CSV'}
            </button>
          )}
        </div>
      </div>

      {/* ─── DISCLAIMER BANNER ─── */}
      <div className="bg-amber-50 border-b-2 border-amber-300 px-4 py-3 text-xs text-amber-900">
        <span className="font-bold">TAX ESTIMATE ONLY</span> — This report organizes your ledger
        data into IRS form structure for review purposes. It is NOT a tax filing. All figures must
        be verified by a licensed CPA or tax professional before filing. Temple Stuart is not a tax
        preparer and does not provide tax advice.
      </div>

      {/* Sub-tabs */}
      <div className="flex border-b border-gray-200">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setView(tab.key)}
            className={`px-4 py-2 text-xs font-medium ${
              view === tab.key ? 'bg-[#2d1b4e] text-white' : 'bg-gray-50 text-gray-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* SCHEDULE D VIEW (existing — unchanged) */}
      {/* ────────────────────────────────────────────────────────── */}
      {view === 'scheduleD' && (
        <div className="p-4 space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-5 gap-3">
            <div className="border rounded-lg p-3">
              <div className="text-[10px] text-gray-500 uppercase">Net Capital Gain/Loss</div>
              <div className={`text-xl font-bold font-mono ${plColor(summary.netGainOrLoss)}`}>
                {fmt(summary.netGainOrLoss)}
              </div>
            </div>
            <div className="border rounded-lg p-3">
              <div className="text-[10px] text-gray-500 uppercase">Short-Term</div>
              <div className={`text-lg font-bold font-mono ${plColor(scheduleD.partI.line7.gainOrLoss)}`}>
                {fmt(scheduleD.partI.line7.gainOrLoss)}
              </div>
              <div className="text-[10px] text-gray-400">{summary.shortTermCount} dispositions</div>
            </div>
            <div className="border rounded-lg p-3">
              <div className="text-[10px] text-gray-500 uppercase">Long-Term</div>
              <div className={`text-lg font-bold font-mono ${plColor(scheduleD.partII.line15.gainOrLoss)}`}>
                {fmt(scheduleD.partII.line15.gainOrLoss)}
              </div>
              <div className="text-[10px] text-gray-400">{summary.longTermCount} dispositions</div>
            </div>
            <div className="border rounded-lg p-3">
              <div className="text-[10px] text-gray-500 uppercase">Wash Sales</div>
              <div className="text-lg font-bold font-mono text-amber-700">
                {summary.washSaleCount}
              </div>
              <div className="text-[10px] text-gray-400">{fmt(summary.washSaleDisallowed)} disallowed</div>
            </div>
            <div className="border rounded-lg p-3">
              <div className="text-[10px] text-gray-500 uppercase">Total Dispositions</div>
              <div className="text-lg font-bold font-mono">{summary.totalDispositions}</div>
            </div>
          </div>

          {/* Part I: Short-Term */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-yellow-50 px-4 py-2 text-sm font-semibold text-yellow-800">
              Part I — Short-Term Capital Gains and Losses (held 1 year or less)
            </div>
            <table className="w-full text-xs">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-3 py-2 text-left w-[280px]">Line</th>
                  <th className="px-3 py-2 text-right">(d) Proceeds</th>
                  <th className="px-3 py-2 text-right">(e) Cost Basis</th>
                  <th className="px-3 py-2 text-right">(g) Adjustments</th>
                  <th className="px-3 py-2 text-right">(h) Gain or Loss</th>
                </tr>
              </thead>
              <tbody>
                {renderScheduleDLine(scheduleD.partI.line1a)}
                {renderScheduleDLine(scheduleD.partI.line1b)}
                {renderScheduleDLine(scheduleD.partI.line1c)}
                <tr className="bg-yellow-50 font-semibold border-t-2 border-yellow-300">
                  <td className="px-3 py-2 text-yellow-800">Line {scheduleD.partI.line7.line}: {scheduleD.partI.line7.description}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmt(scheduleD.partI.line7.proceeds)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmt(scheduleD.partI.line7.costBasis)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmt(scheduleD.partI.line7.adjustments)}</td>
                  <td className={`px-3 py-2 text-right font-mono ${plColor(scheduleD.partI.line7.gainOrLoss)}`}>
                    {fmt(scheduleD.partI.line7.gainOrLoss)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Part II: Long-Term */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800">
              Part II — Long-Term Capital Gains and Losses (held more than 1 year)
            </div>
            <table className="w-full text-xs">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-3 py-2 text-left w-[280px]">Line</th>
                  <th className="px-3 py-2 text-right">(d) Proceeds</th>
                  <th className="px-3 py-2 text-right">(e) Cost Basis</th>
                  <th className="px-3 py-2 text-right">(g) Adjustments</th>
                  <th className="px-3 py-2 text-right">(h) Gain or Loss</th>
                </tr>
              </thead>
              <tbody>
                {renderScheduleDLine(scheduleD.partII.line8a)}
                {renderScheduleDLine(scheduleD.partII.line8b)}
                {renderScheduleDLine(scheduleD.partII.line8c)}
                <tr className="bg-blue-50 font-semibold border-t-2 border-blue-300">
                  <td className="px-3 py-2 text-blue-800">Line {scheduleD.partII.line15.line}: {scheduleD.partII.line15.description}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmt(scheduleD.partII.line15.proceeds)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmt(scheduleD.partII.line15.costBasis)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmt(scheduleD.partII.line15.adjustments)}</td>
                  <td className={`px-3 py-2 text-right font-mono ${plColor(scheduleD.partII.line15.gainOrLoss)}`}>
                    {fmt(scheduleD.partII.line15.gainOrLoss)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Net Total */}
          <div className="border-2 border-gray-800 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <tbody>
                <tr className="bg-gray-100 font-bold">
                  <td className="px-3 py-3 w-[280px]">Line {scheduleD.line16.line}: {scheduleD.line16.description}</td>
                  <td className="px-3 py-3 text-right font-mono">{fmt(scheduleD.line16.proceeds)}</td>
                  <td className="px-3 py-3 text-right font-mono">{fmt(scheduleD.line16.costBasis)}</td>
                  <td className="px-3 py-3 text-right font-mono">{fmt(scheduleD.line16.adjustments)}</td>
                  <td className={`px-3 py-3 text-right font-mono text-lg ${plColor(scheduleD.line16.gainOrLoss)}`}>
                    {fmt(scheduleD.line16.gainOrLoss)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* FORM 8949 VIEW (existing — unchanged) */}
      {/* ────────────────────────────────────────────────────────── */}
      {view === 'form8949' && (
        <div className="p-4 space-y-4">
          {data.form8949.shortTerm.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-yellow-50 px-4 py-2 text-sm font-semibold text-yellow-800">
                Short-Term — Held 1 Year or Less ({data.form8949.shortTerm.length} dispositions)
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-2 py-2 text-left">(a) Description</th>
                      <th className="px-2 py-2 text-left">(b) Acquired</th>
                      <th className="px-2 py-2 text-left">(c) Sold</th>
                      <th className="px-2 py-2 text-right">(d) Proceeds</th>
                      <th className="px-2 py-2 text-right">(e) Cost Basis</th>
                      <th className="px-2 py-2 text-center">(f) Code</th>
                      <th className="px-2 py-2 text-right">(g) Adjustment</th>
                      <th className="px-2 py-2 text-right">(h) Gain/Loss</th>
                      <th className="px-2 py-2 text-right">Days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.form8949.shortTerm.map((e, i) => renderForm8949Row(e, i))}
                    {renderForm8949Totals(data.form8949.shortTerm)}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {data.form8949.longTerm.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800">
                Long-Term — Held More Than 1 Year ({data.form8949.longTerm.length} dispositions)
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-2 py-2 text-left">(a) Description</th>
                      <th className="px-2 py-2 text-left">(b) Acquired</th>
                      <th className="px-2 py-2 text-left">(c) Sold</th>
                      <th className="px-2 py-2 text-right">(d) Proceeds</th>
                      <th className="px-2 py-2 text-right">(e) Cost Basis</th>
                      <th className="px-2 py-2 text-center">(f) Code</th>
                      <th className="px-2 py-2 text-right">(g) Adjustment</th>
                      <th className="px-2 py-2 text-right">(h) Gain/Loss</th>
                      <th className="px-2 py-2 text-right">Days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.form8949.longTerm.map((e, i) => renderForm8949Row(e, i))}
                    {renderForm8949Totals(data.form8949.longTerm)}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {summary.totalDispositions === 0 && (
            <div className="text-center text-sm text-gray-500 py-8">
              No dispositions found for tax year {year}
            </div>
          )}
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* SCHEDULE C VIEW (new) */}
      {/* ────────────────────────────────────────────────────────── */}
      {view === 'scheduleC' && (
        <div className="p-4 space-y-4">
          {scheduleCLoading ? (
            <div className="p-8 text-center text-sm text-gray-500">Loading Schedule C...</div>
          ) : !scheduleCData ? (
            <div className="p-8 text-center text-sm text-red-600">Failed to load Schedule C</div>
          ) : (
            <>
              {/* Business name */}
              <div className="text-xs text-gray-500">
                Schedule C — Profit or Loss From Business: <span className="font-semibold text-gray-700">{scheduleCData.scheduleC.businessName}</span>
              </div>

              {/* Part I: Income */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-green-50 px-4 py-2 text-sm font-semibold text-green-800">
                  Part I — Income
                </div>
                <table className="w-full text-xs">
                  <tbody>
                    <tr className="border-b">
                      <td className="px-4 py-2 w-2/3">Line 1: Gross receipts or sales</td>
                      <td className="px-4 py-2 text-right font-mono font-semibold">{fmt(scheduleCData.scheduleC.line1)}</td>
                    </tr>
                    {scheduleCData.scheduleC.revenueAccounts.map(ra => (
                      <tr key={ra.code} className="border-b text-gray-500">
                        <td className="px-4 py-1 pl-8 text-[11px]">{ra.code} — {ra.name}</td>
                        <td className="px-4 py-1 text-right font-mono text-[11px]">{fmt(ra.amount)}</td>
                      </tr>
                    ))}
                    {scheduleCData.scheduleC.line2 !== 0 && (
                      <tr className="border-b">
                        <td className="px-4 py-2">Line 2: Returns and allowances</td>
                        <td className="px-4 py-2 text-right font-mono">{fmt(scheduleCData.scheduleC.line2)}</td>
                      </tr>
                    )}
                    <tr className="bg-green-50 font-semibold border-t-2 border-green-300">
                      <td className="px-4 py-2 text-green-800">Line 7: Gross income</td>
                      <td className="px-4 py-2 text-right font-mono text-green-800">{fmt(scheduleCData.scheduleC.line7)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Part II: Expenses */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-red-50 px-4 py-2 text-sm font-semibold text-red-800">
                  Part II — Expenses
                </div>
                <table className="w-full text-xs">
                  <tbody>
                    {scheduleCData.scheduleC.expenses.map(exp => (
                      <tr key={exp.line} className="border-b">
                        <td className="px-4 py-2 w-2/3">
                          <span className="font-medium">Line {exp.line}: {exp.label}</span>
                          {exp.accounts.length > 1 && (
                            <span className="text-gray-400 text-[10px] ml-2">({exp.accounts.length} accounts)</span>
                          )}
                          {exp.accounts.map(a => (
                            <div key={a.code} className="text-[10px] text-gray-400 pl-4">{a.code} — {a.name}: {fmt(a.amount)}</div>
                          ))}
                        </td>
                        <td className="px-4 py-2 text-right font-mono align-top">{fmt(exp.amount)}</td>
                      </tr>
                    ))}
                    {scheduleCData.scheduleC.expenses.length === 0 && (
                      <tr className="border-b">
                        <td className="px-4 py-4 text-gray-400 text-center" colSpan={2}>No business expenses recorded</td>
                      </tr>
                    )}
                    <tr className="bg-red-50 font-semibold border-t-2 border-red-300">
                      <td className="px-4 py-2 text-red-800">Line 28: Total expenses</td>
                      <td className="px-4 py-2 text-right font-mono text-red-800">{fmt(scheduleCData.scheduleC.line28)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Line 31: Net profit */}
              <div className={`border-2 rounded-lg p-4 text-center ${scheduleCData.scheduleC.line31 >= 0 ? 'border-green-600 bg-green-50' : 'border-red-600 bg-red-50'}`}>
                <div className="text-xs text-gray-600 mb-1">Line 31: Net profit or (loss)</div>
                <div className={`text-2xl font-bold font-mono ${plColor(scheduleCData.scheduleC.line31)}`}>
                  {fmt(scheduleCData.scheduleC.line31)}
                </div>
              </div>

              {/* Schedule SE summary */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-purple-50 px-4 py-2 text-sm font-semibold text-purple-800">
                  Schedule SE — Self-Employment Tax
                </div>
                <table className="w-full text-xs">
                  <tbody>
                    <tr className="border-b">
                      <td className="px-4 py-2">Line 2: Net earnings from self-employment</td>
                      <td className="px-4 py-2 text-right font-mono">{fmt(scheduleCData.scheduleSE.line2)}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="px-4 py-2">Line 3: 92.35% of Line 2</td>
                      <td className="px-4 py-2 text-right font-mono">{fmt(scheduleCData.scheduleSE.line3)}</td>
                    </tr>
                    <tr className="border-b font-semibold">
                      <td className="px-4 py-2">Line 12: Self-employment tax (15.3%)</td>
                      <td className="px-4 py-2 text-right font-mono text-red-700">{fmt(scheduleCData.scheduleSE.line12)}</td>
                    </tr>
                    <tr className="bg-purple-50 font-semibold">
                      <td className="px-4 py-2 text-purple-800">Line 13: Deductible half of SE tax</td>
                      <td className="px-4 py-2 text-right font-mono text-purple-800">{fmt(scheduleCData.scheduleSE.line13)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Unmapped accounts warning */}
              {scheduleCData.scheduleC.unmappedAccounts.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                  <span className="font-semibold">Note:</span> {scheduleCData.scheduleC.unmappedAccounts.length} account(s) could not be
                  auto-mapped and were placed in Line 27a (Other):
                  {scheduleCData.scheduleC.unmappedAccounts.map(a => (
                    <span key={a.code} className="ml-2 font-mono">{a.code} {a.name}</span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* FORM 1040 VIEW (new) */}
      {/* ────────────────────────────────────────────────────────── */}
      {view === 'form1040' && (
        <div className="p-4 space-y-4">
          {form1040Loading ? (
            <div className="p-8 text-center text-sm text-gray-500">Loading Form 1040...</div>
          ) : !form1040Data ? (
            <div className="p-8 text-center text-sm text-red-600">Failed to load Form 1040</div>
          ) : (
            <>
              {/* INCOME */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-green-50 px-4 py-2 text-sm font-semibold text-green-800">
                  Income
                </div>
                <table className="w-full text-xs">
                  <tbody>
                    <tr className="border-b">
                      <td className="px-4 py-2">Line 1: Wages, salaries, tips (W-2)</td>
                      <td className="px-4 py-2 text-right font-mono">{fmt(form1040Data.line1)}</td>
                      <td className="px-4 py-1 text-right text-[10px] text-gray-400 w-28">{form1040Data.line1Source}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="px-4 py-2">Line 5a: Pensions and annuities (gross)</td>
                      <td className="px-4 py-2 text-right font-mono">{fmt(form1040Data.line5a)}</td>
                      <td className="px-4 py-1 text-right text-[10px] text-gray-400">403(b)/DCP</td>
                    </tr>
                    <tr className="border-b">
                      <td className="px-4 py-2">Line 5b: Taxable amount</td>
                      <td className="px-4 py-2 text-right font-mono">{fmt(form1040Data.line5b)}</td>
                      <td></td>
                    </tr>
                    <tr className="border-b">
                      <td className="px-4 py-2">Line 7: Capital gain or (loss) — Schedule D</td>
                      <td className={`px-4 py-2 text-right font-mono ${plColor(form1040Data.line7)}`}>{fmt(form1040Data.line7)}</td>
                      <td></td>
                    </tr>
                    <tr className="border-b">
                      <td className="px-4 py-2">Line 8: Other income — Schedule C net profit</td>
                      <td className={`px-4 py-2 text-right font-mono ${plColor(form1040Data.line8)}`}>{fmt(form1040Data.line8)}</td>
                      <td></td>
                    </tr>
                    <tr className="bg-green-50 font-semibold border-t-2 border-green-300">
                      <td className="px-4 py-2 text-green-800">Line 9: Total income</td>
                      <td className="px-4 py-2 text-right font-mono text-green-800">{fmt(form1040Data.line9)}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* ADJUSTMENTS */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800">
                  Adjustments to Income
                </div>
                <table className="w-full text-xs">
                  <tbody>
                    <tr className="border-b">
                      <td className="px-4 py-2">Deductible half of self-employment tax</td>
                      <td className="px-4 py-2 text-right font-mono">{fmt(form1040Data.seTaxDeduction)}</td>
                    </tr>
                    <tr className="bg-blue-50 font-semibold border-t-2 border-blue-300">
                      <td className="px-4 py-2 text-blue-800">Line 11: Adjusted gross income (AGI)</td>
                      <td className="px-4 py-2 text-right font-mono text-blue-800">{fmt(form1040Data.line11)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* DEDUCTIONS */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-800 flex items-center justify-between">
                  <span>Deductions</span>
                  <select
                    value={overrides['filing_status'] || form1040Data.filingStatus}
                    onChange={(e) => saveOverride('filing_status', e.target.value)}
                    className="text-xs border border-indigo-300 rounded px-2 py-1 bg-white text-indigo-800"
                  >
                    {FILING_STATUSES.map(fs => (
                      <option key={fs.value} value={fs.value}>{fs.label}</option>
                    ))}
                  </select>
                </div>
                <table className="w-full text-xs">
                  <tbody>
                    <tr className="border-b">
                      <td className="px-4 py-2">Standard deduction ({FILING_STATUSES.find(f => f.value === form1040Data.filingStatus)?.label || 'Single'})</td>
                      <td className="px-4 py-2 text-right font-mono">{fmt(form1040Data.standardDeduction)}</td>
                    </tr>
                    <tr className="bg-indigo-50 font-semibold border-t-2 border-indigo-300">
                      <td className="px-4 py-2 text-indigo-800">Line 15: Taxable income</td>
                      <td className="px-4 py-2 text-right font-mono text-indigo-800">{fmt(form1040Data.line15)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* TAX COMPUTATION — Bracket Breakdown */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-800">
                  Tax Computation — {year} Brackets
                </div>
                <table className="w-full text-xs">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-2 text-left">Bracket</th>
                      <th className="px-4 py-2 text-right">Rate</th>
                      <th className="px-4 py-2 text-right">Taxable in Bracket</th>
                      <th className="px-4 py-2 text-right">Tax</th>
                    </tr>
                  </thead>
                  <tbody>
                    {form1040Data.bracketBreakdown.map(b => (
                      <tr key={b.bracket} className="border-b">
                        <td className="px-4 py-1.5 font-mono">{b.bracket}</td>
                        <td className="px-4 py-1.5 text-right">{fmtPct(b.rate)}</td>
                        <td className="px-4 py-1.5 text-right font-mono">{fmt(b.taxableInBracket)}</td>
                        <td className="px-4 py-1.5 text-right font-mono">{fmt(b.taxForBracket)}</td>
                      </tr>
                    ))}
                    <tr className="bg-orange-50 font-semibold border-t-2 border-orange-300">
                      <td className="px-4 py-2 text-orange-800" colSpan={3}>Line 16: Income tax</td>
                      <td className="px-4 py-2 text-right font-mono text-orange-800">{fmt(form1040Data.incomeTax)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* ADDITIONAL TAXES */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-red-50 px-4 py-2 text-sm font-semibold text-red-800">
                  Additional Taxes
                </div>
                <table className="w-full text-xs">
                  <tbody>
                    <tr className="border-b">
                      <td className="px-4 py-2">Self-employment tax (Schedule SE)</td>
                      <td className="px-4 py-2 text-right font-mono">{fmt(form1040Data.selfEmploymentTax)}</td>
                    </tr>
                    {form1040Data.earlyWithdrawalPenalty > 0 && (
                      <tr className="border-b">
                        <td className="px-4 py-2">Early withdrawal penalty (10% of 403(b) — Schedule 2 Line 8)</td>
                        <td className="px-4 py-2 text-right font-mono text-red-700">{fmt(form1040Data.earlyWithdrawalPenalty)}</td>
                      </tr>
                    )}
                    <tr className="bg-red-50 font-semibold border-t-2 border-red-300">
                      <td className="px-4 py-2 text-red-800">Line 23: Total tax</td>
                      <td className="px-4 py-2 text-right font-mono text-red-800">{fmt(form1040Data.totalTax)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* PAYMENTS & CREDITS */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-800">
                  Payments &amp; Credits
                </div>
                <table className="w-full text-xs">
                  <tbody>
                    <tr className="border-b">
                      <td className="px-4 py-2">W-2 federal tax withheld</td>
                      <td className="px-4 py-2 text-right font-mono">{fmt(form1040Data.w2Withheld)}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="px-4 py-2">1099-R tax withheld</td>
                      <td className="px-4 py-2 text-right font-mono">{fmt(form1040Data.retirementWithheld)}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="px-4 py-2">Estimated tax payments made</td>
                      <td className="px-4 py-2 text-right font-mono">{fmt(form1040Data.estimatedPayments)}</td>
                    </tr>
                    <tr className="bg-teal-50 font-semibold border-t-2 border-teal-300">
                      <td className="px-4 py-2 text-teal-800">Line 24: Total payments</td>
                      <td className="px-4 py-2 text-right font-mono text-teal-800">{fmt(form1040Data.totalPayments)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* BOTTOM LINE */}
              <div className={`border-2 rounded-lg p-6 text-center ${form1040Data.isRefund ? 'border-green-600 bg-green-50' : 'border-red-600 bg-red-50'}`}>
                <div className="text-xs text-gray-600 mb-1">
                  {form1040Data.isRefund ? 'Estimated Refund' : 'Estimated Amount Owed'}
                </div>
                <div className={`text-3xl font-bold font-mono ${form1040Data.isRefund ? 'text-green-700' : 'text-red-700'}`}>
                  {fmt(Math.abs(form1040Data.amountOwed))}
                </div>
                <div className="text-[10px] text-gray-400 mt-2">ESTIMATE ONLY — verify with CPA before filing</div>
              </div>

              {/* ── MANUAL TAX DATA ENTRY ── */}
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 flex items-center justify-between">
                  <span>Manual Tax Data Entry</span>
                  {savingOverride && <span className="text-[10px] text-blue-500 animate-pulse">Saving {savingOverride}...</span>}
                </div>
                <div className="p-4 space-y-3">
                  {/* W-2 fields */}
                  <div className="text-xs font-semibold text-gray-600 border-b pb-1">W-2 Information</div>
                  <div className="grid grid-cols-2 gap-3">
                    {renderOverrideField('w2_gross_wages', 'Gross wages')}
                    {renderOverrideField('w2_federal_withheld', 'Federal tax withheld')}
                    {renderOverrideField('w2_state_withheld', 'State tax withheld')}
                  </div>

                  {/* 1099-R fields */}
                  <div className="text-xs font-semibold text-gray-600 border-b pb-1 pt-2">1099-R Information (403(b)/DCP)</div>
                  <div className="grid grid-cols-2 gap-3">
                    {renderOverrideField('retirement_distribution_gross', 'Gross distribution')}
                    {renderOverrideField('retirement_distribution_taxable', 'Taxable amount')}
                    {renderOverrideField('retirement_distribution_withheld', 'Federal tax withheld')}
                    <div>
                      <label className="text-[10px] text-gray-500 block mb-0.5">Distribution code</label>
                      <select
                        value={overrides['retirement_distribution_code'] || '1'}
                        onChange={(e) => saveOverride('retirement_distribution_code', e.target.value)}
                        className="w-full text-xs border rounded px-2 py-1.5"
                      >
                        <option value="1">1 — Early distribution (10% penalty)</option>
                        <option value="2">2 — Early exception applies</option>
                        <option value="7">7 — Normal distribution</option>
                      </select>
                    </div>
                  </div>

                  {/* Estimated payments */}
                  <div className="text-xs font-semibold text-gray-600 border-b pb-1 pt-2">Estimated Tax Payments</div>
                  <div className="grid grid-cols-2 gap-3">
                    {renderOverrideField('estimated_payments_made', 'Total estimated payments made')}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );

  // ════════════════════════════════════════════════════════════════
  // Render helpers (existing — unchanged)
  // ════════════════════════════════════════════════════════════════

  function renderScheduleDLine(line: ScheduleDLine) {
    const isEmpty = line.proceeds === 0 && line.costBasis === 0 && line.gainOrLoss === 0;
    return (
      <tr key={line.line} className={`border-b ${isEmpty ? 'text-gray-300' : ''}`}>
        <td className="px-3 py-2">Line {line.line}: {line.description}</td>
        <td className="px-3 py-2 text-right font-mono">{isEmpty ? '-' : fmt(line.proceeds)}</td>
        <td className="px-3 py-2 text-right font-mono">{isEmpty ? '-' : fmt(line.costBasis)}</td>
        <td className="px-3 py-2 text-right font-mono">{isEmpty ? '-' : fmt(line.adjustments)}</td>
        <td className={`px-3 py-2 text-right font-mono ${isEmpty ? '' : plColor(line.gainOrLoss)}`}>
          {isEmpty ? '-' : fmt(line.gainOrLoss)}
        </td>
      </tr>
    );
  }

  function renderForm8949Row(e: Form8949Entry, i: number) {
    return (
      <tr key={`${e.dateSold}-${e.description}-${i}`} className={`border-b hover:bg-gray-50 ${e.adjustmentCode === 'W' ? 'bg-amber-50' : ''}`}>
        <td className="px-2 py-1.5">
          <span className="font-medium">{e.description}</span>
          {e.assetType === 'option' && (
            <span className="ml-1 text-[10px] px-1 py-0.5 bg-blue-100 text-blue-700 rounded">OPT</span>
          )}
        </td>
        <td className="px-2 py-1.5 font-mono">{fmtDate(e.dateAcquired)}</td>
        <td className="px-2 py-1.5 font-mono">{fmtDate(e.dateSold)}</td>
        <td className="px-2 py-1.5 text-right font-mono">{fmt(e.proceeds)}</td>
        <td className="px-2 py-1.5 text-right font-mono">{fmt(e.costBasis)}</td>
        <td className="px-2 py-1.5 text-center">
          {e.adjustmentCode && (
            <span className="px-1.5 py-0.5 bg-amber-200 text-amber-900 text-[10px] font-bold rounded">
              {e.adjustmentCode}
            </span>
          )}
        </td>
        <td className="px-2 py-1.5 text-right font-mono">
          {e.adjustmentAmount !== 0 ? fmt(e.adjustmentAmount) : ''}
        </td>
        <td className={`px-2 py-1.5 text-right font-mono font-semibold ${plColor(e.gainOrLoss)}`}>
          {fmt(e.gainOrLoss)}
        </td>
        <td className="px-2 py-1.5 text-right font-mono text-gray-400">{e.holdingDays}</td>
      </tr>
    );
  }

  function renderForm8949Totals(entries: Form8949Entry[]) {
    const totProceeds = entries.reduce((s, e) => s + e.proceeds, 0);
    const totCost = entries.reduce((s, e) => s + e.costBasis, 0);
    const totAdj = entries.reduce((s, e) => s + e.adjustmentAmount, 0);
    const totGL = entries.reduce((s, e) => s + e.gainOrLoss, 0);
    return (
      <tr className="bg-gray-100 font-semibold border-t-2">
        <td className="px-2 py-2" colSpan={3}>Totals</td>
        <td className="px-2 py-2 text-right font-mono">{fmt(totProceeds)}</td>
        <td className="px-2 py-2 text-right font-mono">{fmt(totCost)}</td>
        <td className="px-2 py-2"></td>
        <td className="px-2 py-2 text-right font-mono">{fmt(totAdj)}</td>
        <td className={`px-2 py-2 text-right font-mono ${plColor(totGL)}`}>{fmt(totGL)}</td>
        <td className="px-2 py-2"></td>
      </tr>
    );
  }

  // ─── New render helper: override input field ──

  function renderOverrideField(key: string, label: string) {
    return (
      <div>
        <label className="text-[10px] text-gray-500 block mb-0.5">{label}</label>
        <div className="relative">
          <span className="absolute left-2 top-1.5 text-xs text-gray-400">$</span>
          <input
            type="number"
            step="0.01"
            value={overrides[key] || ''}
            onChange={(e) => saveOverride(key, e.target.value)}
            placeholder="0.00"
            className="w-full text-xs border rounded px-2 py-1.5 pl-5 font-mono"
          />
          {savingOverride === key && (
            <span className="absolute right-2 top-1.5 text-[10px] text-blue-500">saving...</span>
          )}
        </div>
      </div>
    );
  }
}
