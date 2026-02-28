'use client';

import { useState, useEffect } from 'react';

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DC','DE','FL','GA','HI','ID','IL','IN',
  'IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH',
  'NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT',
  'VT','VA','WA','WV','WI','WY',
];

export interface TaxSettingsValues {
  filingStatus: 'single' | 'married_joint' | 'married_separate' | 'head_of_household';
  state: string;
  selfEmployed: boolean;
  priorYearLiability: number;
  priorYearAgi: number;
  estimatedPaymentsMade: number;
  standardDeduction: boolean;
  additionalDeductions: number;
  dependents: number;
}

const DEFAULT_SETTINGS: TaxSettingsValues = {
  filingStatus: 'single',
  state: 'CA',
  selfEmployed: false,
  priorYearLiability: 0,
  priorYearAgi: 0,
  estimatedPaymentsMade: 0,
  standardDeduction: true,
  additionalDeductions: 0,
  dependents: 0,
};

const STORAGE_KEY = 'temple-stuart-tax-settings';

export function loadTaxSettings(): TaxSettingsValues {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveTaxSettings(settings: TaxSettingsValues) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function centsToDisplay(cents: number): string {
  return (cents / 100).toFixed(0);
}

function displayToCents(display: string): number {
  const n = parseFloat(display.replace(/,/g, ''));
  return isNaN(n) ? 0 : Math.round(n * 100);
}

export default function TaxSettings({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (settings: TaxSettingsValues) => void;
}) {
  const [settings, setSettings] = useState<TaxSettingsValues>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSettings(loadTaxSettings());
  }, []);

  const handleSave = async () => {
    setSaving(true);
    saveTaxSettings(settings);
    onSave(settings);
    setSaving(false);
  };

  const update = <K extends keyof TaxSettingsValues>(key: K, val: TaxSettingsValues[K]) =>
    setSettings(prev => ({ ...prev, [key]: val }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white border border-border w-full max-w-md max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="bg-brand-purple-deep text-white px-4 py-2.5 flex items-center justify-between">
          <span className="text-sm font-semibold font-mono">Tax Variables</span>
          <button onClick={onClose} className="text-white/60 hover:text-white text-sm">{'\u00D7'}</button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-3">
          {/* Filing Status */}
          <div>
            <label className="block text-[10px] text-text-muted uppercase font-semibold font-mono mb-1">Filing Status</label>
            <select value={settings.filingStatus} onChange={e => update('filingStatus', e.target.value as TaxSettingsValues['filingStatus'])}
              className="w-full h-7 px-2 text-terminal-sm font-mono border border-border rounded bg-bg-surface">
              <option value="single">Single</option>
              <option value="married_joint">Married Filing Jointly</option>
              <option value="married_separate">Married Filing Separately</option>
              <option value="head_of_household">Head of Household</option>
            </select>
          </div>

          {/* State */}
          <div>
            <label className="block text-[10px] text-text-muted uppercase font-semibold font-mono mb-1">State</label>
            <select value={settings.state} onChange={e => update('state', e.target.value)}
              className="w-full h-7 px-2 text-terminal-sm font-mono border border-border rounded bg-bg-surface">
              {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Self-Employed */}
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={settings.selfEmployed} onChange={e => update('selfEmployed', e.target.checked)}
              className="w-3.5 h-3.5 rounded" />
            <label className="text-terminal-sm font-mono text-text-primary">Self-Employed (Schedule C)</label>
          </div>

          {/* Prior Year Tax Liability */}
          <div>
            <label className="block text-[10px] text-text-muted uppercase font-semibold font-mono mb-1">Prior Year Tax Liability ($)</label>
            <input type="number" value={centsToDisplay(settings.priorYearLiability)}
              onChange={e => update('priorYearLiability', displayToCents(e.target.value))}
              className="w-full h-7 px-2 text-terminal-sm font-mono border border-border rounded bg-bg-surface" placeholder="0" />
          </div>

          {/* Prior Year AGI */}
          <div>
            <label className="block text-[10px] text-text-muted uppercase font-semibold font-mono mb-1">Prior Year AGI ($)</label>
            <input type="number" value={centsToDisplay(settings.priorYearAgi)}
              onChange={e => update('priorYearAgi', displayToCents(e.target.value))}
              className="w-full h-7 px-2 text-terminal-sm font-mono border border-border rounded bg-bg-surface" placeholder="0" />
          </div>

          {/* Estimated Payments Made YTD */}
          <div>
            <label className="block text-[10px] text-text-muted uppercase font-semibold font-mono mb-1">Estimated Payments Made YTD ($)</label>
            <input type="number" value={centsToDisplay(settings.estimatedPaymentsMade)}
              onChange={e => update('estimatedPaymentsMade', displayToCents(e.target.value))}
              className="w-full h-7 px-2 text-terminal-sm font-mono border border-border rounded bg-bg-surface" placeholder="0" />
          </div>

          {/* Deduction Method */}
          <div>
            <label className="block text-[10px] text-text-muted uppercase font-semibold font-mono mb-1">Deduction Method</label>
            <div className="flex items-center border border-border rounded overflow-hidden">
              <button onClick={() => update('standardDeduction', true)}
                className={`flex-1 h-7 text-terminal-sm font-mono ${settings.standardDeduction ? 'bg-brand-purple text-white' : 'bg-bg-surface text-text-muted hover:bg-bg-row'}`}>
                Standard
              </button>
              <button onClick={() => update('standardDeduction', false)}
                className={`flex-1 h-7 text-terminal-sm font-mono border-l border-border ${!settings.standardDeduction ? 'bg-brand-purple text-white' : 'bg-bg-surface text-text-muted hover:bg-bg-row'}`}>
                Itemized
              </button>
            </div>
          </div>

          {/* Additional Deductions (if itemizing) */}
          {!settings.standardDeduction && (
            <div>
              <label className="block text-[10px] text-text-muted uppercase font-semibold font-mono mb-1">Itemized Deductions ($)</label>
              <input type="number" value={centsToDisplay(settings.additionalDeductions)}
                onChange={e => update('additionalDeductions', displayToCents(e.target.value))}
                className="w-full h-7 px-2 text-terminal-sm font-mono border border-border rounded bg-bg-surface" placeholder="0" />
            </div>
          )}

          {/* Dependents */}
          <div>
            <label className="block text-[10px] text-text-muted uppercase font-semibold font-mono mb-1">Dependents</label>
            <input type="number" min="0" max="20" value={settings.dependents}
              onChange={e => update('dependents', parseInt(e.target.value) || 0)}
              className="w-20 h-7 px-2 text-terminal-sm font-mono border border-border rounded bg-bg-surface" />
          </div>
        </div>

        <div className="border-t border-border px-4 py-2.5 flex items-center justify-between">
          <span className="text-[9px] text-text-faint font-mono">Saved to browser. Not tax advice.</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1 text-terminal-sm font-mono border border-border rounded hover:bg-bg-row">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="px-3 py-1 text-terminal-sm font-mono bg-brand-purple-deep text-white rounded hover:bg-brand-purple-hover disabled:opacity-50">
              {saving ? 'Saving...' : 'Save & Calculate'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
