'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/ui';

// ═══════════════════════════════════════════════════════════════
// Types matching /api/tax/calculate response
// ═══════════════════════════════════════════════════════════════

interface SourceEntry {
  date: string;
  description: string;
  amount: number;
  journal_entry_id?: string;
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

interface TaxData {
  tax_year: number;
  disclaimer: string;
  schedule_c: Record<string, TracedLine>;
  schedule_d: Record<string, TracedLine>;
  form_8949: { short_term: any[]; long_term: any[]; summary: { total_dispositions: number; short_term_count: number; long_term_count: number } };
  form_1040: Record<string, TracedLine>;
  form_8863: Record<string, TracedLine>;
  student_loan_deduction: TracedLine;
  computed_totals: { total_income: number; total_withholding: number; education_credit: number; student_loan_deduction: number };
  form_1040_full: { line15: number; totalTax: number; totalPayments: number; amountOwed: number; isRefund: boolean; filingStatus: string; standardDeduction: number; bracketBreakdown: any[] };
  missing_documents: string[];
  data_quality: Record<string, boolean>;
}

// Document form field definitions
const DOC_FIELDS: Record<string, Array<{ key: string; label: string; type: 'text' | 'number' | 'select'; options?: { value: string; label: string }[] }>> = {
  w2: [
    { key: 'employer_name', label: 'Employer Name', type: 'text' },
    { key: 'employer_ein', label: 'Employer EIN', type: 'text' },
    { key: 'wages', label: 'Wages (Box 1)', type: 'number' },
    { key: 'federal_tax_withheld', label: 'Federal Tax Withheld (Box 2)', type: 'number' },
    { key: 'social_security_wages', label: 'Social Security Wages (Box 3)', type: 'number' },
    { key: 'social_security_tax', label: 'Social Security Tax (Box 4)', type: 'number' },
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
      { value: '2', label: '2 - Early distribution, exception applies' },
      { value: '7', label: '7 - Normal distribution' },
    ]},
  ],
  '1098t': [
    { key: 'institution', label: 'Institution Name', type: 'text' },
    { key: 'qualified_tuition', label: 'Qualified Tuition (Box 1)', type: 'number' },
    { key: 'scholarships', label: 'Scholarships/Grants (Box 5)', type: 'number' },
  ],
  '1098e': [
    { key: 'lender', label: 'Lender Name', type: 'text' },
    { key: 'interest_paid', label: 'Student Loan Interest Paid (Box 1)', type: 'number' },
  ],
};

const DOC_LABELS: Record<string, string> = {
  w2: 'W-2',
  '1099r': '1099-R',
  '1098t': '1098-T',
  '1098e': '1098-E',
};

// ═══════════════════════════════════════════════════════════════
// Formatting helpers
// ═══════════════════════════════════════════════════════════════

function fmt(n: number | null | undefined): string {
  if (n == null) return '--';
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `($${formatted})` : `$${formatted}`;
}

function amtColor(n: number | null | undefined): string {
  if (n == null) return 'text-text-muted';
  if (n > 0) return 'text-green-600';
  if (n < 0) return 'text-red-600';
  return 'text-text-primary';
}

// ═══════════════════════════════════════════════════════════════
// Main Page Component
// ═══════════════════════════════════════════════════════════════

export default function TaxDashboard() {
  const [data, setData] = useState<TaxData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [docModal, setDocModal] = useState<string | null>(null);
  const [docForm, setDocForm] = useState<Record<string, string>>({});
  const [docLabel, setDocLabel] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/tax/calculate?year=2025');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggle = (id: string) => {
    setExpanded((prev: Set<string>) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const openDocForm = (docType: string) => {
    setDocModal(docType);
    setDocForm({});
    setDocLabel('');
  };

  const saveDocument = async () => {
    if (!docModal) return;
    setSaving(true);
    try {
      const formData: Record<string, unknown> = {};
      for (const field of DOC_FIELDS[docModal] || []) {
        const val = docForm[field.key] || '';
        formData[field.key] = field.type === 'number' ? (val ? parseFloat(val) : 0) : val;
      }
      const res = await fetch('/api/tax/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tax_year: 2025,
          doc_type: docModal,
          label: docLabel || DOC_LABELS[docModal] || docModal,
          data: formData,
        }),
      });
      if (!res.ok) throw new Error('Failed to save');
      setDocModal(null);
      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────

  return (
    <AppLayout>
      <div className="px-4 py-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-lg font-semibold text-text-primary font-mono">2025 Tax Return</h1>
          <p className="text-xs text-text-muted mt-1">Estimated tax calculation with audit trail drill-down</p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-bg-card border border-border animate-pulse rounded" />
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-4 mb-4">
            <p className="text-sm text-red-700 font-mono">{error}</p>
            <button onClick={fetchData} className="mt-2 px-3 py-1 text-xs font-mono bg-red-100 hover:bg-red-200 text-red-800 rounded">
              Retry
            </button>
          </div>
        )}

        {data && !loading && (
          <>
            {/* Disclaimer */}
            <div className="bg-amber-50 border border-amber-200 rounded p-3 mb-4">
              <p className="text-xs text-amber-800 font-mono">{data.disclaimer}</p>
            </div>

            {/* ═══ OVERVIEW CARD ═══ */}
            <div className="bg-bg-card border border-border rounded p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-xs text-text-muted font-mono">Filing Status</span>
                  <span className="ml-2 text-sm font-mono font-semibold text-text-primary capitalize">{data.form_1040_full.filingStatus}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-text-muted font-mono block">Estimated</span>
                  <span className={`text-lg font-mono font-bold ${data.form_1040_full.isRefund ? 'text-green-600' : 'text-red-600'}`}>
                    {data.form_1040_full.isRefund ? 'Refund ' : 'Owed '}{fmt(Math.abs(data.form_1040_full.amountOwed))}
                  </span>
                </div>
              </div>

              {/* Data Quality Badges */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(Object.entries(data.data_quality) as [string, boolean][]).map(([key, ok]) => (
                  <span key={key} className={`inline-flex items-center px-2 py-0.5 text-[10px] font-mono rounded ${ok ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {ok ? '\u2713' : '\u25CB'} {key.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>

              {/* Missing Documents */}
              {data.missing_documents.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-[10px] text-text-muted font-mono mb-1.5">Missing Documents:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {data.missing_documents.map((doc: string) => (
                      <button
                        key={doc}
                        onClick={() => openDocForm(doc)}
                        className="inline-flex items-center px-2.5 py-1 text-xs font-mono bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 rounded transition-colors"
                      >
                        + Enter {DOC_LABELS[doc] || doc.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ═══ FORM 1040 ═══ */}
            <Section title="Form 1040 — Income Tax Return" defaultOpen>
              <div className="divide-y divide-border">
                {(Object.entries(data.form_1040) as [string, TracedLine][]).map(([key, line]) => (
                  <div key={key} className="py-2 px-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-text-muted">{formatLineKey(key)}</span>
                      <span className={`text-xs font-mono font-semibold ${amtColor(line.amount)}`}>
                        {line.amount != null ? fmt(line.amount) : <span className="text-text-faint italic">--</span>}
                      </span>
                    </div>
                    {line.source && (
                      <p className="text-[10px] text-text-faint font-mono mt-0.5">
                        {line.source}
                        {line.source.includes('not yet entered') && (
                          <button
                            onClick={() => openDocForm(line.source!.includes('W-2') ? 'w2' : line.source!.includes('1099-R') ? '1099r' : line.source!.includes('1098-T') ? '1098t' : '1098e')}
                            className="ml-2 text-brand-purple hover:underline"
                          >
                            [Enter]
                          </button>
                        )}
                      </p>
                    )}
                    {line.calculation && <p className="text-[10px] text-text-faint font-mono mt-0.5">{line.calculation}</p>}
                    {line.note && <p className="text-[10px] text-text-faint font-mono mt-0.5">{line.note}</p>}
                  </div>
                ))}
              </div>
            </Section>

            {/* ═══ SCHEDULE C ═══ */}
            <Section title="Schedule C — Business Profit or Loss">
              <div className="divide-y divide-border">
                {(Object.entries(data.schedule_c) as [string, TracedLine][]).map(([key, line]) => (
                  <div key={key}>
                    <button
                      onClick={() => line.sources && line.sources.length > 0 ? toggle(`sc-${key}`) : undefined}
                      className="w-full py-2 px-1 flex items-center justify-between hover:bg-bg-row transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {line.sources && line.sources.length > 0 && (
                          <span className="text-[10px] text-text-faint">{expanded.has(`sc-${key}`) ? '\u25BC' : '\u25B6'}</span>
                        )}
                        <span className="text-xs font-mono text-text-muted">{formatLineKey(key)}</span>
                      </div>
                      <span className={`text-xs font-mono font-semibold ${amtColor(line.amount)}`}>{fmt(line.amount)}</span>
                    </button>

                    {line.calculation && <p className="text-[10px] text-text-faint font-mono px-1 pb-1">{line.calculation}</p>}

                    {/* Level 2: Account sources */}
                    {expanded.has(`sc-${key}`) && line.sources && (
                      <div className="ml-5 border-l-2 border-border pl-3 pb-2">
                        {line.sources.map((src, si) => (
                          <div key={si}>
                            <button
                              onClick={() => src.entries && src.entries.length > 0 ? toggle(`sc-${key}-${si}`) : undefined}
                              className="w-full py-1 flex items-center justify-between hover:bg-bg-row transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                {src.entries && src.entries.length > 0 && (
                                  <span className="text-[10px] text-text-faint">{expanded.has(`sc-${key}-${si}`) ? '\u25BC' : '\u25B6'}</span>
                                )}
                                <span className="text-[10px] font-mono text-text-muted">
                                  {src.account_code} {src.account_name}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                {src.entry_count != null && <span className="text-[9px] text-text-faint font-mono">{src.entry_count} entries</span>}
                                <span className="text-[10px] font-mono font-semibold text-text-primary">{fmt(src.amount)}</span>
                              </div>
                            </button>

                            {/* Level 3: Individual ledger entries */}
                            {expanded.has(`sc-${key}-${si}`) && src.entries && (
                              <div className="ml-5 border-l border-dashed border-border pl-3 pb-1">
                                {src.entries.map((entry, ei) => (
                                  <div key={ei} className="py-0.5 flex items-center justify-between text-[10px] font-mono">
                                    <div className="flex items-center gap-2 text-text-faint truncate">
                                      <span className="shrink-0">{entry.date}</span>
                                      <span className="truncate">{entry.description}</span>
                                    </div>
                                    <span className="shrink-0 text-text-muted">{fmt(entry.amount)}</span>
                                  </div>
                                ))}
                                {/* Verification total */}
                                <div className="pt-1 mt-1 border-t border-dashed border-border flex justify-between text-[10px] font-mono">
                                  <span className="text-green-600">
                                    {'\u2713'} {src.entries.length} entries = {fmt(src.entries.reduce((s, e) => s + e.amount, 0))}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Section>

            {/* ═══ SCHEDULE D ═══ */}
            <Section title="Schedule D — Capital Gains and Losses">
              <div className="divide-y divide-border">
                {(Object.entries(data.schedule_d) as [string, TracedLine][]).map(([key, line]) => (
                  <div key={key}>
                    <button
                      onClick={() => line.sources && line.sources.length > 0 ? toggle(`sd-${key}`) : undefined}
                      className="w-full py-2 px-1 flex items-center justify-between hover:bg-bg-row transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {line.sources && line.sources.length > 0 && (
                          <span className="text-[10px] text-text-faint">{expanded.has(`sd-${key}`) ? '\u25BC' : '\u25B6'}</span>
                        )}
                        <span className="text-xs font-mono text-text-muted">{formatLineKey(key)}</span>
                      </div>
                      <span className={`text-xs font-mono font-semibold ${amtColor(line.amount)}`}>{fmt(line.amount)}</span>
                    </button>
                    {line.note && <p className="text-[10px] text-text-faint font-mono px-1 pb-1">{line.note}</p>}

                    {expanded.has(`sd-${key}`) && line.sources && (
                      <div className="ml-5 border-l-2 border-border pl-3 pb-2">
                        {line.sources.map((src, si) => (
                          <div key={si} className="py-1 flex items-center justify-between">
                            <span className="text-[10px] font-mono text-text-muted">
                              {src.description}
                              {src.position_count != null && <span className="text-text-faint"> ({src.position_count} positions)</span>}
                              {src.disposition_count != null && <span className="text-text-faint"> ({src.disposition_count} dispositions)</span>}
                            </span>
                            <span className={`text-[10px] font-mono font-semibold ${amtColor(src.amount)}`}>{fmt(src.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Section>

            {/* ═══ FORM 8949 SUMMARY ═══ */}
            <Section title="Form 8949 — Capital Asset Dispositions">
              <div className="px-1 py-2">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-lg font-mono font-bold text-text-primary">{data.form_8949.summary.total_dispositions}</p>
                    <p className="text-[10px] font-mono text-text-muted">Total Dispositions</p>
                  </div>
                  <div>
                    <p className="text-lg font-mono font-bold text-text-primary">{data.form_8949.summary.short_term_count}</p>
                    <p className="text-[10px] font-mono text-text-muted">Short-term</p>
                  </div>
                  <div>
                    <p className="text-lg font-mono font-bold text-text-primary">{data.form_8949.summary.long_term_count}</p>
                    <p className="text-[10px] font-mono text-text-muted">Long-term</p>
                  </div>
                </div>
              </div>
            </Section>

            {/* ═══ FORM 8863 / EDUCATION ═══ */}
            <Section title="Form 8863 — Education Credits">
              {(Object.entries(data.form_8863) as [string, TracedLine][]).map(([key, line]) => (
                <div key={key} className="py-2 px-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-text-muted">{formatLineKey(key)}</span>
                    <span className={`text-xs font-mono font-semibold ${amtColor(line.amount)}`}>
                      {line.amount != null ? fmt(line.amount) : <span className="text-text-faint italic">--</span>}
                    </span>
                  </div>
                  {line.source && (
                    <p className="text-[10px] text-text-faint font-mono mt-0.5">
                      {line.source}
                      {line.source.includes('not yet entered') && (
                        <button onClick={() => openDocForm('1098t')} className="ml-2 text-brand-purple hover:underline">[Enter]</button>
                      )}
                    </p>
                  )}
                </div>
              ))}
            </Section>
          </>
        )}

        {/* ═══ DOCUMENT ENTRY MODAL ═══ */}
        {docModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-bg-card border border-border rounded-lg shadow-xl max-w-md w-full max-h-[80vh] overflow-y-auto">
              <div className="p-4 border-b border-border">
                <h2 className="text-sm font-semibold font-mono text-text-primary">
                  Enter {DOC_LABELS[docModal] || docModal.toUpperCase()}
                </h2>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <label className="block text-[10px] font-mono text-text-muted mb-1">Label (optional)</label>
                  <input
                    type="text"
                    value={docLabel}
                    onChange={e => setDocLabel(e.target.value)}
                    placeholder={`e.g. "${DOC_LABELS[docModal]} - Employer Name"`}
                    className="w-full px-2 py-1.5 text-xs font-mono border border-border rounded bg-bg-input text-text-primary placeholder:text-text-faint focus:outline-none focus:ring-1 focus:ring-brand-purple"
                  />
                </div>
                {(DOC_FIELDS[docModal] || []).map(field => (
                  <div key={field.key}>
                    <label className="block text-[10px] font-mono text-text-muted mb-1">{field.label}</label>
                    {field.type === 'select' ? (
                      <select
                        value={docForm[field.key] || ''}
                        onChange={e => setDocForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                        className="w-full px-2 py-1.5 text-xs font-mono border border-border rounded bg-bg-input text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-purple"
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
                        onChange={e => setDocForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                        className="w-full px-2 py-1.5 text-xs font-mono border border-border rounded bg-bg-input text-text-primary placeholder:text-text-faint focus:outline-none focus:ring-1 focus:ring-brand-purple"
                      />
                    )}
                  </div>
                ))}
              </div>
              <div className="p-4 border-t border-border flex justify-end gap-2">
                <button
                  onClick={() => setDocModal(null)}
                  className="px-3 py-1.5 text-xs font-mono text-text-muted border border-border hover:bg-bg-row rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveDocument}
                  disabled={saving}
                  className="px-3 py-1.5 text-xs font-mono font-medium bg-brand-purple text-white hover:bg-brand-purple-hover rounded transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save & Recalculate'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

// ═══════════════════════════════════════════════════════════════
// Section — Expandable card component
// ═══════════════════════════════════════════════════════════════

function Section({ title, children, defaultOpen = false }: { title: string; children: any; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-bg-card border border-border rounded mb-3">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-bg-row transition-colors"
      >
        <span className="text-sm font-semibold font-mono text-text-primary">{title}</span>
        <span className="text-xs text-text-faint">{open ? '\u25BC' : '\u25B6'}</span>
      </button>
      {open && <div className="px-4 pb-3 border-t border-border">{children}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Helper: Format line keys for display
// ═══════════════════════════════════════════════════════════════

function formatLineKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\bline\b/i, 'Line')
    .replace(/^Line /, 'Line ')
    .replace(/\b\w/g, c => c.toUpperCase());
}
