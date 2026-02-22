'use client';

import { useState, useEffect } from 'react';

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

type ViewType = 'scheduleD' | 'form8949';

export default function TaxReportTab() {
  const [data, setData] = useState<TaxReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [view, setView] = useState<ViewType>('scheduleD');
  const [exporting, setExporting] = useState(false);

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
        // Update year selector if we got available years
        if (report.availableYears?.length > 0 && !report.availableYears.includes(y)) {
          // Year is valid but has no data — keep it
        }
      }
    } catch (error) {
      console.error('Error loading tax report:', error);
    }
    setLoading(false);
  };

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

  if (loading) {
    return <div className="p-8 text-center text-sm text-gray-500">Generating tax report...</div>;
  }

  if (!data) {
    return <div className="p-8 text-center text-sm text-red-600">Failed to load tax report</div>;
  }

  const { summary, scheduleD } = data;
  const availableYears = data.availableYears.length > 0 ? data.availableYears : [year];

  return (
    <div>
      {/* Header */}
      <div className="bg-[#2d1b4e] text-white px-4 py-2 flex items-center justify-between">
        <span className="text-sm font-semibold">Schedule D &amp; Form 8949</span>
        <div className="flex items-center gap-2">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="bg-[#3d2b5e] text-white border-0 text-xs px-2 py-1 rounded"
          >
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button
            onClick={exportCSV}
            disabled={exporting}
            className="text-xs bg-emerald-600 px-3 py-1 rounded hover:bg-emerald-700 disabled:opacity-50"
          >
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex border-b border-gray-200">
        {[
          { key: 'scheduleD', label: 'Schedule D' },
          { key: 'form8949', label: `Form 8949 (${summary.totalDispositions})` },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setView(tab.key as ViewType)}
            className={`px-4 py-2 text-xs font-medium ${
              view === tab.key ? 'bg-[#2d1b4e] text-white' : 'bg-gray-50 text-gray-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="p-4 space-y-4">
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

        {/* Schedule D View */}
        {view === 'scheduleD' && (
          <div className="space-y-4">
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

        {/* Form 8949 View */}
        {view === 'form8949' && (
          <div className="space-y-4">
            {/* Short-Term Section */}
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

            {/* Long-Term Section */}
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
      </div>
    </div>
  );

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
}
