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

// ─── Document form definitions ────────────────────────────────

const DOC_FORM_FIELDS: Record<string, Array<{ key: string; label: string; type: 'text' | 'number' | 'select'; options?: { value: string; label: string }[] }>> = {
  w2: [
    { key: 'employer_name', label: 'Employer Name', type: 'text' },
    { key: 'wages', label: 'Wages (Box 1)', type: 'number' },
    { key: 'federal_tax_withheld', label: 'Federal Tax Withheld (Box 2)', type: 'number' },
    { key: 'social_security_wages', label: 'SS Wages (Box 3)', type: 'number' },
    { key: 'social_security_tax', label: 'SS Tax (Box 4)', type: 'number' },
    { key: 'medicare_wages', label: 'Medicare Wages (Box 5)', type: 'number' },
    { key: 'medicare_tax', label: 'Medicare Tax (Box 6)', type: 'number' },
    { key: 'state', label: 'State', type: 'text' },
    { key: 'state_wages', label: 'State Wages', type: 'number' },
    { key: 'state_tax_withheld', label: 'State Tax Withheld', type: 'number' },
  ],
  '1099r': [
    { key: 'payer_name', label: 'Payer Name', type: 'text' },
    { key: 'gross_distribution', label: 'Gross Distribution (Box 1)', type: 'number' },
    { key: 'taxable_amount', label: 'Taxable Amount (Box 2a)', type: 'number' },
    { key: 'federal_tax_withheld', label: 'Federal Tax Withheld (Box 4)', type: 'number' },
    { key: 'distribution_code', label: 'Distribution Code (Box 7)', type: 'select', options: [
      { value: '1', label: '1 - Early distribution' },
      { value: '2', label: '2 - Early, exception applies' },
      { value: '7', label: '7 - Normal distribution' },
    ]},
  ],
  '1098t': [
    { key: 'institution', label: 'Institution Name', type: 'text' },
    { key: 'qualified_tuition', label: 'Qualified Tuition (Box 1)', type: 'number' },
    { key: 'scholarships', label: 'Scholarships (Box 5)', type: 'number' },
  ],
  '1098e': [
    { key: 'lender', label: 'Lender Name', type: 'text' },
    { key: 'interest_paid', label: 'Interest Paid (Box 1)', type: 'number' },
  ],
};

const DOC_TYPE_LABELS: Record<string, string> = {
  w2: 'W-2', '1099r': '1099-R', '1098t': '1098-T', '1098e': '1098-E',
};

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

  // Drill-down state
  const [expandedLines, setExpandedLines] = useState<Set<string>>(new Set());
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [auditData, setAuditData] = useState<any>(null);

  // Document entry modal state
  const [docModal, setDocModal] = useState<string | null>(null);
  const [docForm, setDocForm] = useState<Record<string, string>>({});
  const [docLabel, setDocLabel] = useState('');
  const [savingDoc, setSavingDoc] = useState(false);

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

  // ── Load audit trail data from /api/tax/calculate ──

  const loadAuditData = useCallback(async (y: number) => {
    try {
      const res = await fetch(`/api/tax/calculate?year=${y}`);
      if (res.ok) setAuditData(await res.json());
    } catch (error) {
      console.error('Error loading audit data:', error);
    }
  }, []);

  // ── Toggle helpers ──

  const toggleLine = (id: string) => {
    setExpandedLines((prev: Set<string>) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAccount = (id: string) => {
    setExpandedAccounts((prev: Set<string>) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ── Document entry helpers ──

  const openDocForm = (docType: string) => {
    setDocModal(docType);
    setDocForm({});
    setDocLabel('');
  };

  const saveDocument = async () => {
    if (!docModal) return;
    setSavingDoc(true);
    try {
      const formData: Record<string, unknown> = {};
      const fields = DOC_FORM_FIELDS[docModal] || [];
      for (const field of fields) {
        const val = docForm[field.key] || '';
        formData[field.key] = field.type === 'number' ? (val ? parseFloat(val) : 0) : val;
      }
      const res = await fetch('/api/tax/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tax_year: year,
          doc_type: docModal,
          label: docLabel || DOC_TYPE_LABELS[docModal] || docModal,
          data: formData,
        }),
      });
      if (!res.ok) throw new Error('Failed to save');
      setDocModal(null);
      // Refresh data
      loadForm1040(year);
      loadAuditData(year);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingDoc(false);
    }
  };

  // ── Lazy-load new tabs on first switch or year change ──

  useEffect(() => {
    if (view === 'scheduleC') { loadScheduleC(year); loadAuditData(year); }
    if (view === 'scheduleD') { loadAuditData(year); }
    if (view === 'form1040') loadForm1040(year);
  }, [view, year, loadScheduleC, loadForm1040, loadAuditData]);

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

  const plColor = (val: number) => val >= 0 ? 'text-brand-green' : 'text-brand-red';

  const fmtDate = (d: string) => {
    const dt = new Date(d + 'T00:00:00');
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
  };

  const fmtPct = (val: number) => `${(val * 100).toFixed(0)}%`;

  // ── Loading / error states ──

  if (loading) {
    return <div className="p-8 text-center text-terminal-sm text-text-muted">Generating tax report...</div>;
  }

  if (!data) {
    return <div className="p-8 text-center text-terminal-sm text-brand-red">Failed to load tax report</div>;
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
      <div className="bg-brand-purple text-white px-3 py-1.5 flex items-center justify-between">
        <span className="text-terminal-lg font-semibold">Tax Reports</span>
        <div className="flex items-center gap-2">
          <select
            value={year}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setYear(Number(e.target.value))}
            className="bg-brand-purple-hover text-white border-0 text-terminal-sm px-2 py-1 rounded"
          >
            {availableYears.map((y: number) => <option key={y} value={y}>{y}</option>)}
          </select>
          {(view === 'scheduleD' || view === 'form8949') && (
            <button
              onClick={exportCSV}
              disabled={exporting}
              className="text-terminal-sm bg-emerald-600 px-3 py-1 rounded hover:bg-emerald-700 disabled:opacity-50"
            >
              {exporting ? 'Exporting...' : 'Export CSV'}
            </button>
          )}
        </div>
      </div>

      {/* ─── DISCLAIMER BANNER ─── */}
      <div className="bg-amber-50 border-b-2 border-amber-300 px-3 py-1.5 text-terminal-base text-amber-900">
        <span className="font-bold">TAX ESTIMATE ONLY</span> — This report organizes your ledger
        data into IRS form structure for review purposes. It is NOT a tax filing. All figures must
        be verified by a licensed CPA or tax professional before filing. Temple Stuart is not a tax
        preparer and does not provide tax advice.
      </div>

      {/* Sub-tabs */}
      <div className="flex border-b border-border">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setView(tab.key)}
            className={`px-3 py-1 text-terminal-sm font-medium ${
              view === tab.key ? 'bg-brand-purple text-white' : 'bg-bg-row text-text-muted'
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
            <div className="border border-border rounded p-2">
              <div className="text-terminal-xs text-text-muted uppercase tracking-widest">Net Capital Gain/Loss</div>
              <div className={`text-terminal-lg font-bold font-mono ${plColor(summary.netGainOrLoss)}`}>
                {fmt(summary.netGainOrLoss)}
              </div>
            </div>
            <div className="border border-border rounded p-2">
              <button onClick={() => toggleLine('sd-st')} className="w-full text-left">
                <div className="text-terminal-xs text-text-muted uppercase tracking-widest flex items-center gap-1">
                  <span>{expandedLines.has('sd-st') ? '\u25BC' : '\u25B6'}</span> Short-Term
                </div>
                <div className={`text-terminal-lg font-bold font-mono ${plColor(scheduleD.partI.line7.gainOrLoss)}`}>
                  {fmt(scheduleD.partI.line7.gainOrLoss)}
                </div>
                <div className="text-terminal-xs text-text-faint">{summary.shortTermCount} dispositions</div>
              </button>
              {expandedLines.has('sd-st') && auditData?.schedule_d?.short_term_gain_loss?.sources && (
                <div className="mt-2 pt-2 border-t border-border space-y-1">
                  {auditData.schedule_d.short_term_gain_loss.sources.map((s: { description: string; amount: number; position_count?: number; disposition_count?: number }, i: number) => (
                    <div key={i} className="flex justify-between text-terminal-xs font-mono">
                      <span className="text-text-muted">
                        {s.description}
                        {s.position_count != null && <span className="text-text-faint"> ({s.position_count})</span>}
                        {s.disposition_count != null && <span className="text-text-faint"> ({s.disposition_count})</span>}
                      </span>
                      <span className={plColor(s.amount)}>{fmt(s.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="border border-border rounded p-2">
              <button onClick={() => toggleLine('sd-lt')} className="w-full text-left">
                <div className="text-terminal-xs text-text-muted uppercase tracking-widest flex items-center gap-1">
                  <span>{expandedLines.has('sd-lt') ? '\u25BC' : '\u25B6'}</span> Long-Term
                </div>
                <div className={`text-terminal-lg font-bold font-mono ${plColor(scheduleD.partII.line15.gainOrLoss)}`}>
                  {fmt(scheduleD.partII.line15.gainOrLoss)}
                </div>
                <div className="text-terminal-xs text-text-faint">{summary.longTermCount} dispositions</div>
              </button>
              {expandedLines.has('sd-lt') && auditData?.schedule_d?.long_term_gain_loss?.sources && (
                <div className="mt-2 pt-2 border-t border-border space-y-1">
                  {auditData.schedule_d.long_term_gain_loss.sources.map((s: { description: string; amount: number; position_count?: number; disposition_count?: number }, i: number) => (
                    <div key={i} className="flex justify-between text-terminal-xs font-mono">
                      <span className="text-text-muted">
                        {s.description}
                        {s.position_count != null && <span className="text-text-faint"> ({s.position_count})</span>}
                        {s.disposition_count != null && <span className="text-text-faint"> ({s.disposition_count})</span>}
                      </span>
                      <span className={plColor(s.amount)}>{fmt(s.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="border border-border rounded p-2">
              <div className="text-terminal-xs text-text-muted uppercase tracking-widest">Wash Sales</div>
              <div className="text-terminal-lg font-bold font-mono text-brand-amber">
                {summary.washSaleCount}
              </div>
              <div className="text-terminal-xs text-text-faint">{fmt(summary.washSaleDisallowed)} disallowed</div>
            </div>
            <div className="border border-border rounded p-2">
              <div className="text-terminal-xs text-text-muted uppercase tracking-widest">Total Dispositions</div>
              <div className="text-terminal-lg font-bold font-mono">{summary.totalDispositions}</div>
            </div>
          </div>

          {/* Part I: Short-Term */}
          <div className="border border-border rounded overflow-hidden">
            <div className="bg-yellow-50 px-3 py-1.5 text-terminal-lg font-semibold text-yellow-800">
              Part I — Short-Term Capital Gains and Losses (held 1 year or less)
            </div>
            <table className="w-full text-terminal-base">
              <thead className="bg-brand-purple text-white/70">
                <tr>
                  <th className="py-1 px-2 text-left w-[280px] text-terminal-xs uppercase tracking-widest font-mono">Line</th>
                  <th className="py-1 px-2 text-right text-terminal-xs uppercase tracking-widest font-mono">(d) Proceeds</th>
                  <th className="py-1 px-2 text-right text-terminal-xs uppercase tracking-widest font-mono">(e) Cost Basis</th>
                  <th className="py-1 px-2 text-right text-terminal-xs uppercase tracking-widest font-mono">(g) Adjustments</th>
                  <th className="py-1 px-2 text-right text-terminal-xs uppercase tracking-widest font-mono">(h) Gain or Loss</th>
                </tr>
              </thead>
              <tbody>
                {renderScheduleDLine(scheduleD.partI.line1a)}
                {renderScheduleDLine(scheduleD.partI.line1b)}
                {renderScheduleDLine(scheduleD.partI.line1c)}
                <tr className="bg-yellow-50 font-semibold border-t-2 border-yellow-300">
                  <td className="py-1 px-2 text-yellow-800">Line {scheduleD.partI.line7.line}: {scheduleD.partI.line7.description}</td>
                  <td className="py-1 px-2 text-right font-mono">{fmt(scheduleD.partI.line7.proceeds)}</td>
                  <td className="py-1 px-2 text-right font-mono">{fmt(scheduleD.partI.line7.costBasis)}</td>
                  <td className="py-1 px-2 text-right font-mono">{fmt(scheduleD.partI.line7.adjustments)}</td>
                  <td className={`py-1 px-2 text-right font-mono ${plColor(scheduleD.partI.line7.gainOrLoss)}`}>
                    {fmt(scheduleD.partI.line7.gainOrLoss)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Part II: Long-Term */}
          <div className="border border-border rounded overflow-hidden">
            <div className="bg-blue-50 px-3 py-1.5 text-terminal-lg font-semibold text-blue-800">
              Part II — Long-Term Capital Gains and Losses (held more than 1 year)
            </div>
            <table className="w-full text-terminal-base">
              <thead className="bg-brand-purple text-white/70">
                <tr>
                  <th className="py-1 px-2 text-left w-[280px] text-terminal-xs uppercase tracking-widest font-mono">Line</th>
                  <th className="py-1 px-2 text-right text-terminal-xs uppercase tracking-widest font-mono">(d) Proceeds</th>
                  <th className="py-1 px-2 text-right text-terminal-xs uppercase tracking-widest font-mono">(e) Cost Basis</th>
                  <th className="py-1 px-2 text-right text-terminal-xs uppercase tracking-widest font-mono">(g) Adjustments</th>
                  <th className="py-1 px-2 text-right text-terminal-xs uppercase tracking-widest font-mono">(h) Gain or Loss</th>
                </tr>
              </thead>
              <tbody>
                {renderScheduleDLine(scheduleD.partII.line8a)}
                {renderScheduleDLine(scheduleD.partII.line8b)}
                {renderScheduleDLine(scheduleD.partII.line8c)}
                <tr className="bg-blue-50 font-semibold border-t-2 border-blue-300">
                  <td className="py-1 px-2 text-blue-800">Line {scheduleD.partII.line15.line}: {scheduleD.partII.line15.description}</td>
                  <td className="py-1 px-2 text-right font-mono">{fmt(scheduleD.partII.line15.proceeds)}</td>
                  <td className="py-1 px-2 text-right font-mono">{fmt(scheduleD.partII.line15.costBasis)}</td>
                  <td className="py-1 px-2 text-right font-mono">{fmt(scheduleD.partII.line15.adjustments)}</td>
                  <td className={`py-1 px-2 text-right font-mono ${plColor(scheduleD.partII.line15.gainOrLoss)}`}>
                    {fmt(scheduleD.partII.line15.gainOrLoss)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Net Total */}
          <div className="border-2 border-text-primary rounded overflow-hidden">
            <table className="w-full text-terminal-base">
              <tbody>
                <tr className="bg-bg-row font-bold">
                  <td className="px-3 py-3 w-[280px]">Line {scheduleD.line16.line}: {scheduleD.line16.description}</td>
                  <td className="px-3 py-3 text-right font-mono">{fmt(scheduleD.line16.proceeds)}</td>
                  <td className="px-3 py-3 text-right font-mono">{fmt(scheduleD.line16.costBasis)}</td>
                  <td className="px-3 py-3 text-right font-mono">{fmt(scheduleD.line16.adjustments)}</td>
                  <td className={`px-3 py-3 text-right font-mono text-terminal-lg ${plColor(scheduleD.line16.gainOrLoss)}`}>
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
            <div className="border border-border rounded overflow-hidden">
              <div className="bg-yellow-50 px-3 py-1.5 text-terminal-lg font-semibold text-yellow-800">
                Short-Term — Held 1 Year or Less ({data.form8949.shortTerm.length} dispositions)
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-terminal-base">
                  <thead className="bg-brand-purple text-white/70">
                    <tr>
                      <th className="py-1 px-2 text-left text-terminal-xs uppercase tracking-widest font-mono">(a) Description</th>
                      <th className="py-1 px-2 text-left text-terminal-xs uppercase tracking-widest font-mono">(b) Acquired</th>
                      <th className="py-1 px-2 text-left text-terminal-xs uppercase tracking-widest font-mono">(c) Sold</th>
                      <th className="py-1 px-2 text-right text-terminal-xs uppercase tracking-widest font-mono">(d) Proceeds</th>
                      <th className="py-1 px-2 text-right text-terminal-xs uppercase tracking-widest font-mono">(e) Cost Basis</th>
                      <th className="py-1 px-2 text-center text-terminal-xs uppercase tracking-widest font-mono">(f) Code</th>
                      <th className="py-1 px-2 text-right text-terminal-xs uppercase tracking-widest font-mono">(g) Adjustment</th>
                      <th className="py-1 px-2 text-right text-terminal-xs uppercase tracking-widest font-mono">(h) Gain/Loss</th>
                      <th className="py-1 px-2 text-right text-terminal-xs uppercase tracking-widest font-mono">Days</th>
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
            <div className="border border-border rounded overflow-hidden">
              <div className="bg-blue-50 px-3 py-1.5 text-terminal-lg font-semibold text-blue-800">
                Long-Term — Held More Than 1 Year ({data.form8949.longTerm.length} dispositions)
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-terminal-base">
                  <thead className="bg-brand-purple text-white/70">
                    <tr>
                      <th className="py-1 px-2 text-left text-terminal-xs uppercase tracking-widest font-mono">(a) Description</th>
                      <th className="py-1 px-2 text-left text-terminal-xs uppercase tracking-widest font-mono">(b) Acquired</th>
                      <th className="py-1 px-2 text-left text-terminal-xs uppercase tracking-widest font-mono">(c) Sold</th>
                      <th className="py-1 px-2 text-right text-terminal-xs uppercase tracking-widest font-mono">(d) Proceeds</th>
                      <th className="py-1 px-2 text-right text-terminal-xs uppercase tracking-widest font-mono">(e) Cost Basis</th>
                      <th className="py-1 px-2 text-center text-terminal-xs uppercase tracking-widest font-mono">(f) Code</th>
                      <th className="py-1 px-2 text-right text-terminal-xs uppercase tracking-widest font-mono">(g) Adjustment</th>
                      <th className="py-1 px-2 text-right text-terminal-xs uppercase tracking-widest font-mono">(h) Gain/Loss</th>
                      <th className="py-1 px-2 text-right text-terminal-xs uppercase tracking-widest font-mono">Days</th>
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
            <div className="text-center text-terminal-sm text-text-muted py-8">
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
            <div className="p-8 text-center text-terminal-sm text-text-muted">Loading Schedule C...</div>
          ) : !scheduleCData ? (
            <div className="p-8 text-center text-terminal-sm text-brand-red">Failed to load Schedule C</div>
          ) : (
            <>
              {/* Business name */}
              <div className="text-terminal-base text-text-muted">
                Schedule C — Profit or Loss From Business: <span className="font-semibold text-text-secondary">{scheduleCData.scheduleC.businessName}</span>
              </div>

              {/* Part I: Income */}
              <div className="border border-border rounded overflow-hidden">
                <div className="bg-green-50 px-3 py-1.5 text-terminal-lg font-semibold text-green-800">
                  Part I — Income
                </div>
                <table className="w-full text-terminal-base">
                  <tbody>
                    <tr className="border-b">
                      <td className="py-1 px-2 w-2/3">Line 1: Gross receipts or sales</td>
                      <td className="py-1 px-2 text-right font-mono font-semibold">{fmt(scheduleCData.scheduleC.line1)}</td>
                    </tr>
                    {scheduleCData.scheduleC.revenueAccounts.map(ra => (
                      <tr key={ra.code} className="border-b text-text-muted">
                        <td className="py-1 px-2 pl-8 text-terminal-sm">{ra.code} — {ra.name}</td>
                        <td className="py-1 px-2 text-right font-mono text-terminal-sm">{fmt(ra.amount)}</td>
                      </tr>
                    ))}
                    {scheduleCData.scheduleC.line2 !== 0 && (
                      <tr className="border-b">
                        <td className="py-1 px-2">Line 2: Returns and allowances</td>
                        <td className="py-1 px-2 text-right font-mono">{fmt(scheduleCData.scheduleC.line2)}</td>
                      </tr>
                    )}
                    <tr className="bg-green-50 font-semibold border-t-2 border-green-300">
                      <td className="py-1 px-2 text-green-800">Line 7: Gross income</td>
                      <td className="py-1 px-2 text-right font-mono text-green-800">{fmt(scheduleCData.scheduleC.line7)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Part II: Expenses */}
              <div className="border border-border rounded overflow-hidden">
                <div className="bg-red-50 px-3 py-1.5 text-terminal-lg font-semibold text-red-800">
                  Part II — Expenses
                </div>
                <table className="w-full text-terminal-base">
                  <tbody>
                    {scheduleCData.scheduleC.expenses.map(exp => {
                      const lineId = `sc-${exp.line}`;
                      const isLineOpen = expandedLines.has(lineId);
                      // Find matching audit data for this line
                      const auditLine = auditData?.schedule_c?.[`line_${exp.line}`];
                      return (
                        <tr key={exp.line} className="border-b align-top">
                          <td className="py-1 px-2 w-2/3">
                            <button
                              onClick={() => toggleLine(lineId)}
                              className="w-full text-left flex items-center gap-1.5 hover:text-text-primary transition-colors"
                            >
                              <span className="text-terminal-xs text-text-faint shrink-0">{isLineOpen ? '\u25BC' : '\u25B6'}</span>
                              <span className="font-medium">Line {exp.line}: {exp.label}</span>
                              {exp.accounts.length > 1 && (
                                <span className="text-text-faint text-terminal-xs ml-1">({exp.accounts.length} accounts)</span>
                              )}
                            </button>

                            {/* Level 2: Expanded accounts */}
                            {isLineOpen && exp.accounts.map((a, ai) => {
                              const acctId = `sc-${exp.line}-${a.code}`;
                              const isAcctOpen = expandedAccounts.has(acctId);
                              // Find entries from audit data
                              const auditSource = auditLine?.sources?.find(
                                (s: { account_code?: string }) => s.account_code === a.code
                              );
                              const entries = auditSource?.entries || [];
                              return (
                                <div key={a.code} className="pl-5 mt-0.5">
                                  <button
                                    onClick={() => entries.length > 0 ? toggleAccount(acctId) : undefined}
                                    className="w-full text-left flex items-center gap-1.5 py-0.5 text-terminal-xs text-text-muted hover:text-text-primary transition-colors"
                                  >
                                    {entries.length > 0 && (
                                      <span className="text-text-faint shrink-0">{isAcctOpen ? '\u25BC' : '\u25B6'}</span>
                                    )}
                                    <span>{a.code} — {a.name}</span>
                                    <span className="ml-auto font-mono">{fmt(a.amount)}</span>
                                  </button>

                                  {/* Level 3: Individual ledger entries */}
                                  {isAcctOpen && entries.length > 0 && (
                                    <div className="pl-5 border-l border-dashed border-border ml-1.5 mt-0.5">
                                      {entries.map((entry: { date: string; description: string; amount: number }, ei: number) => (
                                        <div key={ei} className="flex items-center justify-between py-0.5 text-terminal-xs font-mono text-text-faint">
                                          <div className="flex items-center gap-2 truncate">
                                            <span className="shrink-0">{entry.date}</span>
                                            <span className="truncate">{entry.description}</span>
                                          </div>
                                          <span className="shrink-0 ml-2">{fmt(entry.amount)}</span>
                                        </div>
                                      ))}
                                      <div className="pt-0.5 mt-0.5 border-t border-dashed border-border flex justify-between text-terminal-xs font-mono">
                                        <span className="text-brand-green">
                                          {'\u2713'} {entries.length} entries = {fmt(entries.reduce((s: number, e: { amount: number }) => s + e.amount, 0))}
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </td>
                          <td className="py-1 px-2 text-right font-mono">{fmt(exp.amount)}</td>
                        </tr>
                      );
                    })}
                    {scheduleCData.scheduleC.expenses.length === 0 && (
                      <tr className="border-b">
                        <td className="py-1 px-2 text-text-faint text-center" colSpan={2}>No business expenses recorded</td>
                      </tr>
                    )}
                    <tr className="bg-red-50 font-semibold border-t-2 border-red-300">
                      <td className="py-1 px-2 text-red-800">Line 28: Total expenses</td>
                      <td className="py-1 px-2 text-right font-mono text-red-800">{fmt(scheduleCData.scheduleC.line28)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Line 31: Net profit */}
              <div className={`border-2 rounded p-2 text-center ${scheduleCData.scheduleC.line31 >= 0 ? 'border-brand-green bg-green-50' : 'border-brand-red bg-red-50'}`}>
                <div className="text-terminal-base text-text-secondary mb-1">Line 31: Net profit or (loss)</div>
                <div className={`text-sm font-bold font-mono ${plColor(scheduleCData.scheduleC.line31)}`}>
                  {fmt(scheduleCData.scheduleC.line31)}
                </div>
              </div>

              {/* Schedule SE summary */}
              <div className="border border-border rounded overflow-hidden">
                <div className="bg-purple-50 px-3 py-1.5 text-terminal-lg font-semibold text-purple-800">
                  Schedule SE — Self-Employment Tax
                </div>
                <table className="w-full text-terminal-base">
                  <tbody>
                    <tr className="border-b">
                      <td className="py-1 px-2">Line 2: Net earnings from self-employment</td>
                      <td className="py-1 px-2 text-right font-mono">{fmt(scheduleCData.scheduleSE.line2)}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-1 px-2">Line 3: 92.35% of Line 2</td>
                      <td className="py-1 px-2 text-right font-mono">{fmt(scheduleCData.scheduleSE.line3)}</td>
                    </tr>
                    <tr className="border-b font-semibold">
                      <td className="py-1 px-2">Line 12: Self-employment tax (15.3%)</td>
                      <td className="py-1 px-2 text-right font-mono text-brand-red">{fmt(scheduleCData.scheduleSE.line12)}</td>
                    </tr>
                    <tr className="bg-purple-50 font-semibold">
                      <td className="py-1 px-2 text-purple-800">Line 13: Deductible half of SE tax</td>
                      <td className="py-1 px-2 text-right font-mono text-purple-800">{fmt(scheduleCData.scheduleSE.line13)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Unmapped accounts warning */}
              {scheduleCData.scheduleC.unmappedAccounts.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded p-2 text-terminal-base text-amber-800">
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
            <div className="p-8 text-center text-terminal-sm text-text-muted">Loading Form 1040...</div>
          ) : !form1040Data ? (
            <div className="p-8 text-center text-terminal-sm text-brand-red">Failed to load Form 1040</div>
          ) : (
            <>
              {/* INCOME */}
              <div className="border border-border rounded overflow-hidden">
                <div className="bg-green-50 px-3 py-1.5 text-terminal-lg font-semibold text-green-800">
                  Income
                </div>
                <table className="w-full text-terminal-base">
                  <tbody>
                    <tr className="border-b">
                      <td className="py-1 px-2">Line 1: Wages, salaries, tips (W-2)</td>
                      <td className="py-1 px-2 text-right font-mono">{form1040Data.line1 > 0 ? fmt(form1040Data.line1) : <span className="text-text-faint italic">--</span>}</td>
                      <td className="py-1 px-2 text-right text-terminal-xs text-text-faint w-36">
                        {form1040Data.line1 > 0 ? form1040Data.line1Source : (
                          <button onClick={() => openDocForm('w2')} className="text-brand-purple hover:underline">+ Enter W-2</button>
                        )}
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-1 px-2">Line 5a: Pensions and annuities (gross)</td>
                      <td className="py-1 px-2 text-right font-mono">{form1040Data.line5a > 0 ? fmt(form1040Data.line5a) : <span className="text-text-faint italic">--</span>}</td>
                      <td className="py-1 px-2 text-right text-terminal-xs text-text-faint">
                        {form1040Data.line5a > 0 ? '403(b)/DCP' : (
                          <button onClick={() => openDocForm('1099r')} className="text-brand-purple hover:underline">+ Enter 1099-R</button>
                        )}
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-1 px-2">Line 5b: Taxable amount</td>
                      <td className="py-1 px-2 text-right font-mono">{form1040Data.line5b > 0 ? fmt(form1040Data.line5b) : <span className="text-text-faint italic">--</span>}</td>
                      <td></td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-1 px-2">
                        Line 7: Capital gain or (loss)
                        <span className="text-terminal-xs text-text-faint ml-1">from Schedule D</span>
                      </td>
                      <td className={`py-1 px-2 text-right font-mono ${plColor(form1040Data.line7)}`}>{fmt(form1040Data.line7)}</td>
                      <td></td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-1 px-2">
                        Line 8: Other income
                        <span className="text-terminal-xs text-text-faint ml-1">from Schedule C ({fmt(form1040Data.line8)})</span>
                      </td>
                      <td className={`py-1 px-2 text-right font-mono ${plColor(form1040Data.line8)}`}>{fmt(form1040Data.line8)}</td>
                      <td></td>
                    </tr>
                    <tr className="bg-green-50 font-semibold border-t-2 border-green-300">
                      <td className="py-1 px-2 text-green-800">Line 9: Total income</td>
                      <td className="py-1 px-2 text-right font-mono text-green-800">{fmt(form1040Data.line9)}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* ADJUSTMENTS */}
              <div className="border border-border rounded overflow-hidden">
                <div className="bg-blue-50 px-3 py-1.5 text-terminal-lg font-semibold text-blue-800">
                  Adjustments to Income
                </div>
                <table className="w-full text-terminal-base">
                  <tbody>
                    <tr className="border-b">
                      <td className="py-1 px-2">Deductible half of self-employment tax</td>
                      <td className="py-1 px-2 text-right font-mono">{fmt(form1040Data.seTaxDeduction)}</td>
                    </tr>
                    <tr className="bg-blue-50 font-semibold border-t-2 border-blue-300">
                      <td className="py-1 px-2 text-blue-800">Line 11: Adjusted gross income (AGI)</td>
                      <td className="py-1 px-2 text-right font-mono text-blue-800">{fmt(form1040Data.line11)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* DEDUCTIONS */}
              <div className="border border-border rounded overflow-hidden">
                <div className="bg-indigo-50 px-3 py-1.5 text-terminal-lg font-semibold text-indigo-800 flex items-center justify-between">
                  <span>Deductions</span>
                  <select
                    value={overrides['filing_status'] || form1040Data.filingStatus}
                    onChange={(e) => saveOverride('filing_status', e.target.value)}
                    className="text-terminal-base font-mono border border-indigo-300 rounded h-7 px-2 bg-white text-indigo-800"
                  >
                    {FILING_STATUSES.map(fs => (
                      <option key={fs.value} value={fs.value}>{fs.label}</option>
                    ))}
                  </select>
                </div>
                <table className="w-full text-terminal-base">
                  <tbody>
                    <tr className="border-b">
                      <td className="py-1 px-2">Standard deduction ({FILING_STATUSES.find(f => f.value === form1040Data.filingStatus)?.label || 'Single'})</td>
                      <td className="py-1 px-2 text-right font-mono">{fmt(form1040Data.standardDeduction)}</td>
                    </tr>
                    <tr className="bg-indigo-50 font-semibold border-t-2 border-indigo-300">
                      <td className="py-1 px-2 text-indigo-800">Line 15: Taxable income</td>
                      <td className="py-1 px-2 text-right font-mono text-indigo-800">{fmt(form1040Data.line15)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* TAX COMPUTATION — Bracket Breakdown */}
              <div className="border border-border rounded overflow-hidden">
                <div className="bg-orange-50 px-3 py-1.5 text-terminal-lg font-semibold text-orange-800">
                  Tax Computation — {year} Brackets
                </div>
                <table className="w-full text-terminal-base">
                  <thead className="bg-brand-purple text-white/70">
                    <tr>
                      <th className="py-1 px-2 text-left text-terminal-xs uppercase tracking-widest font-mono">Bracket</th>
                      <th className="py-1 px-2 text-right text-terminal-xs uppercase tracking-widest font-mono">Rate</th>
                      <th className="py-1 px-2 text-right text-terminal-xs uppercase tracking-widest font-mono">Taxable in Bracket</th>
                      <th className="py-1 px-2 text-right text-terminal-xs uppercase tracking-widest font-mono">Tax</th>
                    </tr>
                  </thead>
                  <tbody>
                    {form1040Data.bracketBreakdown.map(b => (
                      <tr key={b.bracket} className="border-b">
                        <td className="py-1 px-2 font-mono">{b.bracket}</td>
                        <td className="py-1 px-2 text-right">{fmtPct(b.rate)}</td>
                        <td className="py-1 px-2 text-right font-mono">{fmt(b.taxableInBracket)}</td>
                        <td className="py-1 px-2 text-right font-mono">{fmt(b.taxForBracket)}</td>
                      </tr>
                    ))}
                    <tr className="bg-orange-50 font-semibold border-t-2 border-orange-300">
                      <td className="py-1 px-2 text-orange-800" colSpan={3}>Line 16: Income tax</td>
                      <td className="py-1 px-2 text-right font-mono text-orange-800">{fmt(form1040Data.incomeTax)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* ADDITIONAL TAXES */}
              <div className="border border-border rounded overflow-hidden">
                <div className="bg-red-50 px-3 py-1.5 text-terminal-lg font-semibold text-red-800">
                  Additional Taxes
                </div>
                <table className="w-full text-terminal-base">
                  <tbody>
                    <tr className="border-b">
                      <td className="py-1 px-2">Self-employment tax (Schedule SE)</td>
                      <td className="py-1 px-2 text-right font-mono">{fmt(form1040Data.selfEmploymentTax)}</td>
                    </tr>
                    {form1040Data.earlyWithdrawalPenalty > 0 && (
                      <tr className="border-b">
                        <td className="py-1 px-2">Early withdrawal penalty (10% of 403(b) — Schedule 2 Line 8)</td>
                        <td className="py-1 px-2 text-right font-mono text-brand-red">{fmt(form1040Data.earlyWithdrawalPenalty)}</td>
                      </tr>
                    )}
                    <tr className="bg-red-50 font-semibold border-t-2 border-red-300">
                      <td className="py-1 px-2 text-red-800">Line 23: Total tax</td>
                      <td className="py-1 px-2 text-right font-mono text-red-800">{fmt(form1040Data.totalTax)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* PAYMENTS & CREDITS */}
              <div className="border border-border rounded overflow-hidden">
                <div className="bg-teal-50 px-3 py-1.5 text-terminal-lg font-semibold text-teal-800">
                  Payments &amp; Credits
                </div>
                <table className="w-full text-terminal-base">
                  <tbody>
                    <tr className="border-b">
                      <td className="py-1 px-2">W-2 federal tax withheld</td>
                      <td className="py-1 px-2 text-right font-mono">{fmt(form1040Data.w2Withheld)}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-1 px-2">1099-R tax withheld</td>
                      <td className="py-1 px-2 text-right font-mono">{fmt(form1040Data.retirementWithheld)}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-1 px-2">Estimated tax payments made</td>
                      <td className="py-1 px-2 text-right font-mono">{fmt(form1040Data.estimatedPayments)}</td>
                    </tr>
                    <tr className="bg-teal-50 font-semibold border-t-2 border-teal-300">
                      <td className="py-1 px-2 text-teal-800">Line 24: Total payments</td>
                      <td className="py-1 px-2 text-right font-mono text-teal-800">{fmt(form1040Data.totalPayments)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* BOTTOM LINE */}
              <div className={`border-2 rounded p-2 text-center ${form1040Data.isRefund ? 'border-brand-green bg-green-50' : 'border-brand-red bg-red-50'}`}>
                <div className="text-terminal-base text-text-secondary mb-1">
                  {form1040Data.isRefund ? 'Estimated Refund' : 'Estimated Amount Owed'}
                </div>
                <div className={`text-3xl font-bold font-mono ${form1040Data.isRefund ? 'text-brand-green' : 'text-brand-red'}`}>
                  {fmt(Math.abs(form1040Data.amountOwed))}
                </div>
                <div className="text-terminal-xs text-text-faint mt-2">ESTIMATE ONLY — verify with CPA before filing</div>
              </div>

              {/* ── MANUAL TAX DATA ENTRY ── */}
              <div className="border border-border rounded overflow-hidden">
                <div className="bg-bg-row px-3 py-1.5 text-terminal-lg font-semibold text-text-secondary flex items-center justify-between">
                  <span>Manual Tax Data Entry</span>
                  {savingOverride && <span className="text-terminal-xs text-brand-purple animate-pulse">Saving {savingOverride}...</span>}
                </div>
                <div className="p-4 space-y-3">
                  {/* W-2 fields */}
                  <div className="text-terminal-base font-semibold text-text-secondary border-b pb-1">W-2 Information</div>
                  <div className="grid grid-cols-2 gap-3">
                    {renderOverrideField('w2_gross_wages', 'Gross wages')}
                    {renderOverrideField('w2_federal_withheld', 'Federal tax withheld')}
                    {renderOverrideField('w2_state_withheld', 'State tax withheld')}
                  </div>

                  {/* 1099-R fields */}
                  <div className="text-terminal-base font-semibold text-text-secondary border-b pb-1 pt-2">1099-R Information (403(b)/DCP)</div>
                  <div className="grid grid-cols-2 gap-3">
                    {renderOverrideField('retirement_distribution_gross', 'Gross distribution')}
                    {renderOverrideField('retirement_distribution_taxable', 'Taxable amount')}
                    {renderOverrideField('retirement_distribution_withheld', 'Federal tax withheld')}
                    <div>
                      <label className="text-terminal-xs text-text-muted block mb-0.5">Distribution code</label>
                      <select
                        value={overrides['retirement_distribution_code'] || '1'}
                        onChange={(e) => saveOverride('retirement_distribution_code', e.target.value)}
                        className="w-full text-terminal-base font-mono border border-border rounded h-7 px-2"
                      >
                        <option value="1">1 — Early distribution (10% penalty)</option>
                        <option value="2">2 — Early exception applies</option>
                        <option value="7">7 — Normal distribution</option>
                      </select>
                    </div>
                  </div>

                  {/* Estimated payments */}
                  <div className="text-terminal-base font-semibold text-text-secondary border-b pb-1 pt-2">Estimated Tax Payments</div>
                  <div className="grid grid-cols-2 gap-3">
                    {renderOverrideField('estimated_payments_made', 'Total estimated payments made')}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
      {/* ═══ DOCUMENT ENTRY MODAL ═══ */}
      {docModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-border rounded-lg shadow-xl max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="px-4 py-3 border-b border-border bg-bg-row">
              <span className="text-terminal-lg font-semibold">Enter {DOC_TYPE_LABELS[docModal] || docModal.toUpperCase()}</span>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-terminal-xs text-text-muted block mb-0.5">Label (optional)</label>
                <input
                  type="text"
                  value={docLabel}
                  onChange={(e) => setDocLabel(e.target.value)}
                  placeholder={`e.g. "${DOC_TYPE_LABELS[docModal]} - Employer"`}
                  className="w-full text-terminal-base font-mono border border-border rounded h-7 px-2"
                />
              </div>
              {(DOC_FORM_FIELDS[docModal] || []).map(field => (
                <div key={field.key}>
                  <label className="text-terminal-xs text-text-muted block mb-0.5">{field.label}</label>
                  {field.type === 'select' ? (
                    <select
                      value={docForm[field.key] || ''}
                      onChange={(e) => setDocForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                      className="w-full text-terminal-base font-mono border border-border rounded h-7 px-2"
                    >
                      <option value="">Select...</option>
                      {field.options?.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type}
                      step={field.type === 'number' ? '0.01' : undefined}
                      value={docForm[field.key] || ''}
                      onChange={(e) => setDocForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                      className="w-full text-terminal-base font-mono border border-border rounded h-7 px-2"
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="px-4 py-3 border-t border-border flex justify-end gap-2">
              <button
                onClick={() => setDocModal(null)}
                className="px-3 py-1 text-terminal-sm text-text-muted border border-border rounded hover:bg-bg-row"
              >
                Cancel
              </button>
              <button
                onClick={saveDocument}
                disabled={savingDoc}
                className="px-3 py-1 text-terminal-sm font-medium bg-brand-purple text-white rounded hover:bg-brand-purple-hover disabled:opacity-50"
              >
                {savingDoc ? 'Saving...' : 'Save & Recalculate'}
              </button>
            </div>
          </div>
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
      <tr key={line.line} className={`border-b ${isEmpty ? 'text-text-faint' : ''}`}>
        <td className="py-1 px-2">Line {line.line}: {line.description}</td>
        <td className="py-1 px-2 text-right font-mono">{isEmpty ? '-' : fmt(line.proceeds)}</td>
        <td className="py-1 px-2 text-right font-mono">{isEmpty ? '-' : fmt(line.costBasis)}</td>
        <td className="py-1 px-2 text-right font-mono">{isEmpty ? '-' : fmt(line.adjustments)}</td>
        <td className={`py-1 px-2 text-right font-mono ${isEmpty ? '' : plColor(line.gainOrLoss)}`}>
          {isEmpty ? '-' : fmt(line.gainOrLoss)}
        </td>
      </tr>
    );
  }

  function renderForm8949Row(e: Form8949Entry, i: number) {
    return (
      <tr key={`${e.dateSold}-${e.description}-${i}`} className={`border-b hover:bg-bg-row ${e.adjustmentCode === 'W' ? 'bg-amber-50' : ''}`}>
        <td className="px-2 py-1.5">
          <span className="font-medium">{e.description}</span>
          {e.assetType === 'option' && (
            <span className="ml-1 text-terminal-xs px-1 py-0.5 bg-brand-purple-wash text-brand-purple rounded">OPT</span>
          )}
        </td>
        <td className="px-2 py-1.5 font-mono">{fmtDate(e.dateAcquired)}</td>
        <td className="px-2 py-1.5 font-mono">{fmtDate(e.dateSold)}</td>
        <td className="px-2 py-1.5 text-right font-mono">{fmt(e.proceeds)}</td>
        <td className="px-2 py-1.5 text-right font-mono">{fmt(e.costBasis)}</td>
        <td className="px-2 py-1.5 text-center">
          {e.adjustmentCode && (
            <span className="px-1.5 py-0.5 bg-amber-200 text-amber-900 text-terminal-xs font-bold rounded">
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
        <td className="px-2 py-1.5 text-right font-mono text-text-faint">{e.holdingDays}</td>
      </tr>
    );
  }

  function renderForm8949Totals(entries: Form8949Entry[]) {
    const totProceeds = entries.reduce((s, e) => s + e.proceeds, 0);
    const totCost = entries.reduce((s, e) => s + e.costBasis, 0);
    const totAdj = entries.reduce((s, e) => s + e.adjustmentAmount, 0);
    const totGL = entries.reduce((s, e) => s + e.gainOrLoss, 0);
    return (
      <tr className="bg-bg-row font-semibold border-t-2">
        <td className="px-2 py-1.5" colSpan={3}>Totals</td>
        <td className="px-2 py-1.5 text-right font-mono">{fmt(totProceeds)}</td>
        <td className="px-2 py-1.5 text-right font-mono">{fmt(totCost)}</td>
        <td className="px-2 py-1.5"></td>
        <td className="px-2 py-1.5 text-right font-mono">{fmt(totAdj)}</td>
        <td className={`px-2 py-1.5 text-right font-mono ${plColor(totGL)}`}>{fmt(totGL)}</td>
        <td className="px-2 py-1.5"></td>
      </tr>
    );
  }

  // ─── New render helper: override input field ──

  function renderOverrideField(key: string, label: string) {
    return (
      <div>
        <label className="text-terminal-xs text-text-muted block mb-0.5">{label}</label>
        <div className="relative">
          <span className="absolute left-2 top-1.5 text-terminal-base text-text-faint">$</span>
          <input
            type="number"
            step="0.01"
            value={overrides[key] || ''}
            onChange={(e) => saveOverride(key, e.target.value)}
            placeholder="0.00"
            className="w-full text-terminal-base font-mono border border-border rounded h-7 px-2 pl-5"
          />
          {savingOverride === key && (
            <span className="absolute right-2 top-1.5 text-terminal-xs text-brand-purple">saving...</span>
          )}
        </div>
      </div>
    );
  }
}
