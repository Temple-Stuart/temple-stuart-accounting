'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AppLayout from '@/components/ui/AppLayout';
import OpsSubNav from '@/components/ops/OpsSubNav';
import ChipMultiSelect from '@/components/profile/ChipMultiSelect';
import ListBuilder from '@/components/profile/ListBuilder';
import ProductsPicker from '@/components/profile/ProductsPicker';
import { JURISDICTIONS } from '@/lib/constants/jurisdictions';

interface Entity {
  id: string;
  name: string;
  entity_type: string;
  is_default?: boolean;
}

interface ProfileForm {
  business_description: string;
  primary_entity_id: string;
  operating_jurisdictions: string[];
  customer_jurisdictions: string[];
  products_services: string[];
  handles_personal_data: boolean;
  handles_financial_data: boolean;
  handles_health_data: boolean;
  ai_use_in_product: boolean;
  ai_use_description: string;
  revenue_stage: string;
  employee_count: number | '';
  planned_actions_24mo: string[];
  known_completed_filings: string[];
  notes: string;
}

const REVENUE_STAGES = [
  { value: 'pre_revenue', label: 'Pre-revenue' },
  { value: 'pre_charging', label: 'Pre-charging' },
  { value: 'charging_under_50k', label: 'Charging under $50K' },
  { value: 'charging_50k_500k', label: 'Charging $50K–$500K' },
  { value: 'charging_500k_5m', label: 'Charging $500K–$5M' },
  { value: 'charging_over_5m', label: 'Charging over $5M' },
];

const defaultForm: ProfileForm = {
  business_description: '',
  primary_entity_id: '',
  operating_jurisdictions: [],
  customer_jurisdictions: [],
  products_services: [],
  handles_personal_data: false,
  handles_financial_data: false,
  handles_health_data: false,
  ai_use_in_product: false,
  ai_use_description: '',
  revenue_stage: 'pre_revenue',
  employee_count: '',
  planned_actions_24mo: [],
  known_completed_filings: [],
  notes: '',
};

export default function ProfilePage() {
  const [form, setForm] = useState<ProfileForm>(defaultForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState<string>('');

  const [entities, setEntities] = useState<Entity[]>([]);
  const [entitiesLoading, setEntitiesLoading] = useState(true);
  const [entitiesError, setEntitiesError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/discovery/profile');
        if (res.ok) {
          const data = await res.json();
          if (data.profile) {
            const p = data.profile;
            setForm({
              business_description: p.business_description || '',
              primary_entity_id: p.primary_entity_id || '',
              operating_jurisdictions: Array.isArray(p.operating_jurisdictions) ? p.operating_jurisdictions : [],
              customer_jurisdictions: Array.isArray(p.customer_jurisdictions) ? p.customer_jurisdictions : [],
              products_services: Array.isArray(p.products_services) ? p.products_services : [],
              handles_personal_data: p.handles_personal_data || false,
              handles_financial_data: p.handles_financial_data || false,
              handles_health_data: p.handles_health_data || false,
              ai_use_in_product: p.ai_use_in_product || false,
              ai_use_description: p.ai_use_description || '',
              revenue_stage: p.revenue_stage || 'pre_revenue',
              employee_count: p.employee_count ?? '',
              planned_actions_24mo: Array.isArray(p.planned_actions_24mo) ? p.planned_actions_24mo : [],
              known_completed_filings: Array.isArray(p.known_completed_filings) ? p.known_completed_filings : [],
              notes: p.notes || '',
            });
          }
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/entities');
        if (res.ok) {
          const data = await res.json();
          setEntities(Array.isArray(data.entities) ? data.entities : []);
        } else {
          const data = await res.json().catch(() => ({}));
          setEntitiesError(data.error || `Failed to load entities (HTTP ${res.status})`);
        }
      } catch (err) {
        setEntitiesError(err instanceof Error ? err.message : 'Failed to load entities');
      } finally {
        setEntitiesLoading(false);
      }
    })();
  }, []);

  // Auto-clear the success badge after 3 seconds.
  useEffect(() => {
    if (!successMessage) return;
    const t = setTimeout(() => setSuccessMessage(''), 3000);
    return () => clearTimeout(t);
  }, [successMessage]);

  const updateField = <K extends keyof ProfileForm>(field: K, value: ProfileForm[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAiToggle = (checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      ai_use_in_product: checked,
      ai_use_description: checked ? prev.ai_use_description : '',
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMessage('');
    setError('');
    setFieldError('');

    try {
      const payload = {
        business_description: form.business_description,
        primary_entity_id: form.primary_entity_id || null,
        operating_jurisdictions: form.operating_jurisdictions,
        customer_jurisdictions: form.customer_jurisdictions,
        products_services: form.products_services,
        handles_personal_data: form.handles_personal_data,
        handles_financial_data: form.handles_financial_data,
        handles_health_data: form.handles_health_data,
        ai_use_in_product: form.ai_use_in_product,
        ai_use_description: form.ai_use_in_product ? form.ai_use_description : '',
        revenue_stage: form.revenue_stage,
        employee_count: form.employee_count === '' ? null : Number(form.employee_count),
        planned_actions_24mo: form.planned_actions_24mo,
        known_completed_filings: form.known_completed_filings,
        notes: form.notes,
      };

      const res = await fetch('/api/discovery/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSuccessMessage('Profile saved ✓');
      } else {
        const data = await res.json().catch(() => ({}));
        const msg =
          data.message ||
          data.error ||
          `Save failed (HTTP ${res.status}). No error details returned.`;
        setError(msg);
        if (typeof data.field === 'string') {
          setFieldError(data.field);
        }
      }
    } catch (err) {
      console.error('Failed to save profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const entityOptions = useMemo(
    () =>
      entities.map((e) => ({
        value: e.id,
        label: `${e.name} (${e.entity_type})`,
      })),
    [entities],
  );

  if (loading) {
    return (
      <AppLayout>
        <OpsSubNav />
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
            <span className="text-text-muted font-mono text-terminal-base">Loading profile...</span>
          </div>
        </div>
      </AppLayout>
    );
  }

  const inputClass =
    'font-mono text-sm bg-transparent border border-border rounded-md px-3 py-1.5 w-full focus:border-brand-purple outline-none transition-colors placeholder:text-text-faint';
  const labelClass = 'block text-terminal-sm font-mono font-semibold text-text-secondary mb-1';
  const hintClass = 'text-terminal-sm text-text-faint font-mono mt-0.5';
  const sectionHelpClass = 'text-terminal-sm text-text-muted font-mono';

  return (
    <AppLayout>
      <OpsSubNav />
      <div className="max-w-[1600px] mx-auto px-4 pt-4 pb-8 space-y-4">
        <div className="bg-white rounded border border-border shadow-sm p-5">
          <h1 className="text-xl font-bold text-text-primary font-mono">Compliance Profile</h1>
          <p className="text-terminal-sm text-text-muted font-mono mt-1">
            Define your business context for compliance discovery.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-300 rounded p-3 font-mono text-terminal-sm text-red-800 whitespace-pre-wrap">
            <span className="font-semibold">Save failed:</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Business Overview */}
          <div className="bg-white rounded border border-border shadow-sm p-5 space-y-4">
            <div>
              <h2 className="text-terminal-base font-bold text-text-primary font-mono">Business Overview</h2>
              <p className={sectionHelpClass}>
                What your business does, and which entity is the primary subject of this profile.
              </p>
            </div>
            <div>
              <label className={labelClass}>Business Description</label>
              <textarea
                value={form.business_description}
                onChange={(e) => updateField('business_description', e.target.value)}
                rows={4}
                className={inputClass}
                placeholder="Describe your business, what it does, and how it operates..."
              />
              <p className={hintClass}>Required, minimum 10 characters.</p>
              {fieldError === 'business_description' && (
                <p className="font-mono text-terminal-sm text-red-600 mt-1">{error}</p>
              )}
            </div>
            <div>
              <label className={labelClass}>Primary Entity</label>
              {entitiesLoading ? (
                <div className="font-mono text-terminal-sm text-text-faint">Loading entities…</div>
              ) : entitiesError ? (
                <div className="font-mono text-terminal-sm text-red-600">{entitiesError}</div>
              ) : (
                <select
                  value={form.primary_entity_id}
                  onChange={(e) => updateField('primary_entity_id', e.target.value)}
                  className={inputClass}
                >
                  <option value="">— None / Cross-entity —</option>
                  {entityOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )}
              <p className={hintClass}>
                The legal entity this profile primarily applies to. Choose &quot;None&quot; for cross-entity profiles.
              </p>
              {fieldError === 'primary_entity_id' && (
                <p className="font-mono text-terminal-sm text-red-600 mt-1">{error}</p>
              )}
            </div>
          </div>

          {/* Jurisdictions */}
          <div className="bg-white rounded border border-border shadow-sm p-5 space-y-4">
            <div>
              <h2 className="text-terminal-base font-bold text-text-primary font-mono">Jurisdictions</h2>
              <p className={sectionHelpClass}>
                Where you operate (offices, employees, infrastructure) and where your customers are located.
              </p>
            </div>
            <div>
              <label className={labelClass}>Operating Jurisdictions</label>
              <ChipMultiSelect
                options={JURISDICTIONS}
                value={form.operating_jurisdictions}
                onChange={(next) => updateField('operating_jurisdictions', next)}
                placeholder="Add operating jurisdiction…"
                ariaLabel="Add operating jurisdiction"
              />
              <p className={hintClass}>
                Where your business has offices, employees, or operational presence.
              </p>
            </div>
            <div>
              <label className={labelClass}>Customer Jurisdictions</label>
              <ChipMultiSelect
                options={JURISDICTIONS}
                value={form.customer_jurisdictions}
                onChange={(next) => updateField('customer_jurisdictions', next)}
                placeholder="Add customer jurisdiction…"
                ariaLabel="Add customer jurisdiction"
              />
              <p className={hintClass}>Where your paying customers are located.</p>
            </div>
          </div>

          {/* Products & Services */}
          <div className="bg-white rounded border border-border shadow-sm p-5 space-y-4">
            <div>
              <h2 className="text-terminal-base font-bold text-text-primary font-mono">Products &amp; Services</h2>
              <p className={sectionHelpClass}>
                What you sell. Check the categories that apply, and add anything custom below.
              </p>
            </div>
            <ProductsPicker
              value={form.products_services}
              onChange={(next) => updateField('products_services', next)}
            />
          </div>

          {/* Data Handling */}
          <div className="bg-white rounded border border-border shadow-sm p-5 space-y-4">
            <div>
              <h2 className="text-terminal-base font-bold text-text-primary font-mono">Data Handling</h2>
              <p className={sectionHelpClass}>
                What categories of sensitive data your product touches. Drives privacy/compliance scope.
              </p>
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 font-mono text-terminal-sm text-text-primary cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.handles_personal_data}
                  onChange={(e) => updateField('handles_personal_data', e.target.checked)}
                  className="rounded border-border"
                />
                Handles personal data
              </label>
              <label className="flex items-center gap-2 font-mono text-terminal-sm text-text-primary cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.handles_financial_data}
                  onChange={(e) => updateField('handles_financial_data', e.target.checked)}
                  className="rounded border-border"
                />
                Handles financial data
              </label>
              <label className="flex items-center gap-2 font-mono text-terminal-sm text-text-primary cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.handles_health_data}
                  onChange={(e) => updateField('handles_health_data', e.target.checked)}
                  className="rounded border-border"
                />
                Handles health data
              </label>
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 font-mono text-terminal-sm text-text-primary cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.ai_use_in_product}
                  onChange={(e) => handleAiToggle(e.target.checked)}
                  className="rounded border-border"
                />
                AI used in product
              </label>
              {form.ai_use_in_product && (
                <div className="ml-6">
                  <label className={labelClass}>AI Use Description</label>
                  <textarea
                    value={form.ai_use_description}
                    onChange={(e) => updateField('ai_use_description', e.target.value)}
                    rows={3}
                    className={inputClass}
                    placeholder="Describe how AI is used in your product..."
                  />
                </div>
              )}
            </div>
          </div>

          {/* Stage & Size */}
          <div className="bg-white rounded border border-border shadow-sm p-5 space-y-4">
            <div>
              <h2 className="text-terminal-base font-bold text-text-primary font-mono">Stage &amp; Size</h2>
              <p className={sectionHelpClass}>
                Revenue stage and headcount. Determines which compliance regimes apply.
              </p>
            </div>
            <div>
              <label className={labelClass}>Revenue Stage</label>
              <select
                value={form.revenue_stage}
                onChange={(e) => updateField('revenue_stage', e.target.value)}
                className={inputClass}
              >
                {REVENUE_STAGES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              {fieldError === 'revenue_stage' && (
                <p className="font-mono text-terminal-sm text-red-600 mt-1">{error}</p>
              )}
            </div>
            <div>
              <label className={labelClass}>Employee Count</label>
              <input
                type="number"
                value={form.employee_count}
                onChange={(e) => updateField('employee_count', e.target.value === '' ? '' : Number(e.target.value))}
                className={inputClass}
                placeholder="Number of employees"
                min={0}
              />
            </div>
          </div>

          {/* Plans & History */}
          <div className="bg-white rounded border border-border shadow-sm p-5 space-y-4">
            <div>
              <h2 className="text-terminal-base font-bold text-text-primary font-mono">Plans &amp; History</h2>
              <p className={sectionHelpClass}>
                Forward-looking plans (24 months) and filings already completed.
              </p>
            </div>
            <div>
              <label className={labelClass}>Planned Actions (next 24 months)</label>
              <ListBuilder
                value={form.planned_actions_24mo}
                onChange={(next) => updateField('planned_actions_24mo', next)}
                placeholder="e.g. Hire engineers in NY"
                ariaLabel="Add planned action"
              />
            </div>
            <div>
              <label className={labelClass}>Known Completed Filings</label>
              <ListBuilder
                value={form.known_completed_filings}
                onChange={(next) => updateField('known_completed_filings', next)}
                placeholder="e.g. Delaware Annual Franchise Tax 2024"
                ariaLabel="Add completed filing"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white rounded border border-border shadow-sm p-5 space-y-4">
            <div>
              <h2 className="text-terminal-base font-bold text-text-primary font-mono">Notes</h2>
              <p className={sectionHelpClass}>Anything else worth flagging for the discovery engine.</p>
            </div>
            <div>
              <textarea
                value={form.notes}
                onChange={(e) => updateField('notes', e.target.value)}
                rows={4}
                className={inputClass}
                placeholder="Any additional notes or context..."
              />
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={saving}
              className="font-mono text-terminal-sm px-4 py-2 rounded border border-brand-purple bg-brand-purple text-white hover:bg-brand-purple/90 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Profile'}
            </button>

            {successMessage && (
              <span className="font-mono text-terminal-sm text-emerald-700">
                {successMessage} —{' '}
                <Link href="/ops/discovery" className="underline hover:text-emerald-900">
                  Run Discovery &rarr;
                </Link>
              </span>
            )}
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
