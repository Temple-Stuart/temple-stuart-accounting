'use client';

import { useState, useEffect, useCallback } from 'react';
import type { StepProps } from '../TaxFilingWizard';
import type { LifeEvents } from '../TaxFilingWizard';

// ═══════════════════════════════════════════════════════════════════
// Step 1 — Documents
//
// Structured intake for W-2, 1099-R, 1098-E, 1098-T. Each type can hold
// multiple entries (e.g., multiple W-2 employers) via the `label` field
// on tax_documents. Schedule C and 1099-B are shown as AUTO-POPULATED
// cards (read-only) because that data is already in the ledger and
// trading positions.
// ═══════════════════════════════════════════════════════════════════

type EditableDocKey = 'w2' | '1099r' | '1098e' | '1098t';

interface FieldDef {
  key: string;
  label: string;
  box?: string;
  type: 'text' | 'number' | 'ein' | 'select' | 'checkbox';
  required?: boolean;
  options?: { value: string; label: string }[];
}

interface DocTypeDef {
  key: EditableDocKey;
  label: string;        // "W-2"
  fullName: string;     // "Wage and Tax Statement"
  fields: FieldDef[];
  labelField: string;   // which field doubles as `tax_documents.label`
  labelPrompt: string;  // "Employer"
  shownWhen: keyof LifeEvents;
}

// ─── Canonical field schemas ────────────────────────────────────────

const W2_FIELDS: FieldDef[] = [
  { key: 'employer_name', label: 'Employer name', type: 'text', required: true },
  { key: 'employer_ein', label: 'Employer EIN', type: 'ein' },
  { key: 'gross_wages', label: 'Gross wages', box: 'Box 1', type: 'number' },
  { key: 'federal_withheld', label: 'Federal income tax withheld', box: 'Box 2', type: 'number' },
  { key: 'social_security_wages', label: 'Social Security wages', box: 'Box 3', type: 'number' },
  { key: 'social_security_tax', label: 'Social Security tax withheld', box: 'Box 4', type: 'number' },
  { key: 'medicare_wages', label: 'Medicare wages', box: 'Box 5', type: 'number' },
  { key: 'medicare_tax', label: 'Medicare tax withheld', box: 'Box 6', type: 'number' },
  { key: 'state_wages', label: 'State wages', box: 'Box 16', type: 'number' },
  { key: 'state_withheld', label: 'State income tax withheld', box: 'Box 17', type: 'number' },
];

const R1099_FIELDS: FieldDef[] = [
  { key: 'payer_name', label: 'Payer name', type: 'text', required: true },
  { key: 'gross_distribution', label: 'Gross distribution', box: 'Box 1', type: 'number' },
  { key: 'taxable_amount', label: 'Taxable amount', box: 'Box 2a', type: 'number' },
  { key: 'federal_withheld', label: 'Federal income tax withheld', box: 'Box 4', type: 'number' },
  {
    key: 'distribution_code',
    label: 'Distribution code',
    box: 'Box 7',
    type: 'select',
    options: [
      { value: '', label: '— select —' },
      { value: '1', label: '1 — Early distribution, no known exception' },
      { value: '2', label: '2 — Early distribution, exception applies' },
      { value: '3', label: '3 — Disability' },
      { value: '4', label: '4 — Death' },
      { value: '7', label: '7 — Normal distribution' },
      { value: 'G', label: 'G — Direct rollover' },
    ],
  },
  { key: 'is_ira_sep_simple', label: 'IRA / SEP / SIMPLE', box: 'Box 7', type: 'checkbox' },
];

const E1098_FIELDS: FieldDef[] = [
  { key: 'lender_name', label: 'Lender name', type: 'text', required: true },
  { key: 'interest_paid', label: 'Student loan interest paid', box: 'Box 1', type: 'number' },
];

const T1098_FIELDS: FieldDef[] = [
  { key: 'school_name', label: 'School name', type: 'text', required: true },
  { key: 'amounts_billed', label: 'Qualified tuition and fees', box: 'Box 1', type: 'number' },
  { key: 'scholarships', label: 'Scholarships / grants', box: 'Box 5', type: 'number' },
];

const DOC_TYPES: DocTypeDef[] = [
  {
    key: 'w2',
    label: 'W-2',
    fullName: 'Wage and Tax Statement',
    fields: W2_FIELDS,
    labelField: 'employer_name',
    labelPrompt: 'Employer',
    shownWhen: 'hasW2',
  },
  {
    key: '1099r',
    label: '1099-R',
    fullName: 'Distributions From Pensions, Annuities, Retirement',
    fields: R1099_FIELDS,
    labelField: 'payer_name',
    labelPrompt: 'Payer',
    shownWhen: 'hasRetirement',
  },
  {
    key: '1098e',
    label: '1098-E',
    fullName: 'Student Loan Interest Statement',
    fields: E1098_FIELDS,
    labelField: 'lender_name',
    labelPrompt: 'Lender',
    shownWhen: 'hasStudentLoan',
  },
  {
    key: '1098t',
    label: '1098-T',
    fullName: 'Tuition Statement',
    fields: T1098_FIELDS,
    labelField: 'school_name',
    labelPrompt: 'School',
    shownWhen: 'hasEducation',
  },
];

interface AutoDocTypeDef {
  key: string;
  label: string;
  fullName: string;
  source: string;
  shownWhen: keyof LifeEvents;
}

const AUTO_DOC_TYPES: AutoDocTypeDef[] = [
  {
    key: 'schedule_c',
    label: 'Schedule C',
    fullName: 'Profit or Loss From Business',
    source: 'Your ledger (sole-prop entity)',
    shownWhen: 'hasBusiness',
  },
  {
    key: '1099b',
    label: '1099-B',
    fullName: 'Proceeds From Broker Transactions',
    source: 'Your trading positions & lot dispositions',
    shownWhen: 'hasTrading',
  },
];

// ─── Entry state ───────────────────────────────────────────────────

interface DocEntry {
  id?: string;
  label: string;
  data: Record<string, unknown>;
  saved: boolean;
  dirty: boolean;
  saving?: boolean;
  error?: string;
}

type EntriesByType = Record<EditableDocKey, DocEntry[]>;

const EMPTY_ENTRIES: EntriesByType = {
  w2: [],
  '1099r': [],
  '1098e': [],
  '1098t': [],
};

// ─── EIN formatter: XX-XXXXXXX ─────────────────────────────────────

function formatEIN(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 9);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}-${digits.slice(2)}`;
}

// ─── Component ─────────────────────────────────────────────────────

export default function DocumentsStep({ taxYear, onComplete, lifeEvents }: StepProps) {
  const [entries, setEntries] = useState<EntriesByType>(EMPTY_ENTRIES);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const visibleTypes = DOC_TYPES.filter((t) => lifeEvents[t.shownWhen]);
  const visibleAutoTypes = AUTO_DOC_TYPES.filter((t) => lifeEvents[t.shownWhen]);

  // ── Load existing documents on mount ─────────────────────────────

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/tax/documents?year=${taxYear}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const { documents } = (await res.json()) as {
        documents: Array<{
          id: string;
          doc_type: string;
          label: string | null;
          data: Record<string, unknown>;
        }>;
      };
      const next: EntriesByType = { w2: [], '1099r': [], '1098e': [], '1098t': [] };
      for (const doc of documents) {
        if (doc.doc_type in next) {
          next[doc.doc_type as EditableDocKey].push({
            id: doc.id,
            label: doc.label || '',
            data: doc.data || {},
            saved: true,
            dirty: false,
          });
        }
      }
      setEntries(next);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [taxYear]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // ── Entry mutations ──────────────────────────────────────────────

  const updateEntry = (
    docKey: EditableDocKey,
    index: number,
    patch: Partial<DocEntry>
  ) => {
    setEntries((prev) => {
      const list = [...prev[docKey]];
      list[index] = { ...list[index], ...patch, dirty: true };
      return { ...prev, [docKey]: list };
    });
  };

  const updateField = (
    docKey: EditableDocKey,
    index: number,
    fieldKey: string,
    value: unknown
  ) => {
    setEntries((prev) => {
      const list = [...prev[docKey]];
      const entry = list[index];
      list[index] = {
        ...entry,
        data: { ...entry.data, [fieldKey]: value },
        dirty: true,
      };
      return { ...prev, [docKey]: list };
    });
  };

  const addEntry = (docKey: EditableDocKey) => {
    setEntries((prev) => ({
      ...prev,
      [docKey]: [...prev[docKey], { label: '', data: {}, saved: false, dirty: true }],
    }));
    setExpanded((prev) => {
      const next = new Set(prev);
      next.add(`${docKey}:${entries[docKey].length}`);
      return next;
    });
  };

  const saveEntry = async (docKey: EditableDocKey, index: number) => {
    const typeDef = DOC_TYPES.find((t) => t.key === docKey)!;
    const entry = entries[docKey][index];
    const label =
      (entry.data[typeDef.labelField] as string | undefined)?.trim() || '';

    if (!label) {
      updateEntry(docKey, index, {
        error: `${typeDef.labelPrompt} name is required before saving.`,
      });
      return;
    }

    updateEntry(docKey, index, { saving: true, error: undefined });

    try {
      const res = await fetch('/api/tax/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tax_year: taxYear,
          doc_type: docKey,
          label,
          data: entry.data,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const { document } = (await res.json()) as {
        document: { id: string; label: string | null };
      };
      updateEntry(docKey, index, {
        id: document.id,
        label: document.label || label,
        saved: true,
        dirty: false,
        saving: false,
        error: undefined,
      });
    } catch (e) {
      updateEntry(docKey, index, {
        saving: false,
        error: e instanceof Error ? e.message : 'Save failed',
      });
    }
  };

  const deleteEntry = async (docKey: EditableDocKey, index: number) => {
    const entry = entries[docKey][index];
    if (entry.id) {
      try {
        const res = await fetch('/api/tax/documents', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: entry.id }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
      } catch (e) {
        // Show on the card but still remove locally
        console.warn('Delete failed:', e);
      }
    }
    setEntries((prev) => ({
      ...prev,
      [docKey]: prev[docKey].filter((_, i) => i !== index),
    }));
  };

  const toggleExpanded = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // ── Completion check ─────────────────────────────────────────────

  const requiredTypeKeys = visibleTypes.map((t) => t.key);
  const completedTypeKeys = requiredTypeKeys.filter((k) =>
    entries[k].some((e) => e.saved)
  );
  const allDone =
    requiredTypeKeys.length === 0 ||
    completedTypeKeys.length === requiredTypeKeys.length;

  // ── Render helpers ───────────────────────────────────────────────

  const renderField = (
    docKey: EditableDocKey,
    index: number,
    field: FieldDef
  ) => {
    const entry = entries[docKey][index];
    const raw = entry.data[field.key];
    const value = raw == null ? '' : String(raw);

    const inputClass =
      'w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500';

    if (field.type === 'select') {
      return (
        <select
          value={value}
          onChange={(e) => updateField(docKey, index, field.key, e.target.value)}
          className={inputClass}
        >
          {(field.options || []).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    }

    if (field.type === 'checkbox') {
      return (
        <input
          type="checkbox"
          checked={!!raw}
          onChange={(e) => updateField(docKey, index, field.key, e.target.checked)}
          className="w-4 h-4 accent-blue-600"
        />
      );
    }

    if (field.type === 'ein') {
      return (
        <input
          type="text"
          value={value}
          onChange={(e) =>
            updateField(docKey, index, field.key, formatEIN(e.target.value))
          }
          placeholder="XX-XXXXXXX"
          maxLength={10}
          className={inputClass}
        />
      );
    }

    if (field.type === 'number') {
      return (
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
            $
          </span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={value}
            onChange={(e) => {
              const v = e.target.value;
              updateField(docKey, index, field.key, v === '' ? '' : parseFloat(v));
            }}
            className={`${inputClass} pl-6`}
          />
        </div>
      );
    }

    return (
      <input
        type="text"
        value={value}
        onChange={(e) => updateField(docKey, index, field.key, e.target.value)}
        placeholder={field.required ? 'Required' : ''}
        className={inputClass}
      />
    );
  };

  const renderEditableCard = (typeDef: DocTypeDef) => {
    const list = entries[typeDef.key];

    return (
      <div
        key={typeDef.key}
        className="border border-gray-200 rounded-lg overflow-hidden"
      >
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900">
                {typeDef.label}
              </span>
              <span className="text-xs text-gray-500">{typeDef.fullName}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {list.length === 0 ? (
              <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold text-gray-600 bg-white border border-gray-300 rounded">
                empty
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded">
                {list.filter((e) => e.saved).length} saved
                {list.some((e) => e.dirty && !e.saved) ? ' · unsaved' : ''}
              </span>
            )}
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {list.map((entry, index) => {
            const expandKey = `${typeDef.key}:${index}`;
            const isOpen = expanded.has(expandKey) || !entry.saved;
            const title =
              (entry.data[typeDef.labelField] as string | undefined) ||
              entry.label ||
              `New ${typeDef.label}`;

            return (
              <div key={expandKey} className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => toggleExpanded(expandKey)}
                  className="w-full flex items-center justify-between hover:opacity-80"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">
                      {isOpen ? '▼' : '▶'}
                    </span>
                    <span className="text-sm font-medium text-gray-900">
                      {title}
                    </span>
                    {entry.saved && !entry.dirty && (
                      <span className="text-[10px] font-semibold text-emerald-700">
                        ✓ saved
                      </span>
                    )}
                    {entry.dirty && (
                      <span className="text-[10px] font-semibold text-amber-700">
                        unsaved changes
                      </span>
                    )}
                  </div>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteEntry(typeDef.key, index);
                    }}
                    className="text-xs text-gray-400 hover:text-red-600 cursor-pointer px-1"
                  >
                    remove
                  </span>
                </button>

                {isOpen && (
                  <div className="mt-3 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {typeDef.fields.map((field) => (
                        <div key={field.key}>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            {field.label}
                            {field.box && (
                              <span className="ml-1 text-[10px] text-gray-400">
                                ({field.box})
                              </span>
                            )}
                            {field.required && (
                              <span className="ml-1 text-red-500">*</span>
                            )}
                          </label>
                          {renderField(typeDef.key, index, field)}
                        </div>
                      ))}
                    </div>

                    {entry.error && (
                      <div className="px-3 py-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded">
                        {entry.error}
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => saveEntry(typeDef.key, index)}
                        disabled={entry.saving}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                      >
                        {entry.saving
                          ? 'Saving...'
                          : entry.saved
                            ? 'Save changes'
                            : 'Save'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="px-4 py-2 bg-gray-50 border-t border-gray-200">
          <button
            type="button"
            onClick={() => addEntry(typeDef.key)}
            className="text-xs font-medium text-blue-700 hover:text-blue-900"
          >
            + Add {list.length === 0 ? typeDef.label : `another ${typeDef.label}`}
          </button>
        </div>
      </div>
    );
  };

  const renderAutoCard = (auto: AutoDocTypeDef) => (
    <div
      key={auto.key}
      className="border border-gray-200 rounded-lg border-l-4 border-l-emerald-500 overflow-hidden"
    >
      <div className="px-4 py-3 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">
              {auto.label}
            </span>
            <span className="text-xs text-gray-500">{auto.fullName}</span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Auto-populated from: {auto.source}
          </p>
        </div>
        <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded">
          from your data
        </span>
      </div>
    </div>
  );

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-gray-600">
          Enter each tax document you received. Only the forms relevant to the
          life events you checked are shown here.
        </p>
      </div>

      {loading && (
        <div className="px-3 py-2 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded">
          Loading saved documents…
        </div>
      )}

      {loadError && (
        <div className="px-3 py-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded">
          Failed to load documents: {loadError}
          <button
            onClick={loadDocuments}
            className="ml-2 underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && visibleTypes.length === 0 && visibleAutoTypes.length === 0 && (
        <div className="px-3 py-3 text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded">
          No documents needed based on your life events. You can go back to
          Step 1 to add events, or proceed to the next step.
        </div>
      )}

      {/* Auto-populated cards first — these are the "already done" reassurance */}
      {visibleAutoTypes.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Already captured
          </h3>
          {visibleAutoTypes.map(renderAutoCard)}
        </div>
      )}

      {/* Editable cards */}
      {visibleTypes.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Enter these forms
          </h3>
          <div className="space-y-3">{visibleTypes.map(renderEditableCard)}</div>
        </div>
      )}

      {/* Completion checklist */}
      {visibleTypes.length > 0 && (
        <div className="border border-gray-200 rounded-lg bg-gray-50 p-4">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Checklist
          </h4>
          <ul className="space-y-1">
            {visibleTypes.map((t) => {
              const done = entries[t.key].some((e) => e.saved);
              return (
                <li
                  key={t.key}
                  className="flex items-center gap-2 text-sm"
                >
                  <span
                    className={
                      done ? 'text-emerald-600' : 'text-gray-400'
                    }
                  >
                    {done ? '✓' : '○'}
                  </span>
                  <span
                    className={
                      done ? 'text-gray-700' : 'text-gray-500'
                    }
                  >
                    {done ? `${t.label} entered` : `${t.label} needed`}
                  </span>
                </li>
              );
            })}
          </ul>
          {allDone ? (
            <p className="mt-3 text-sm text-emerald-700 font-medium">
              All required documents entered — you're ready to continue.
            </p>
          ) : (
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-gray-500">
                You can come back and enter these later.
              </p>
              <button
                type="button"
                onClick={onComplete}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded hover:bg-white"
              >
                Skip for now
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
