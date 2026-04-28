'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AppLayout from '@/components/ui/AppLayout';
import OpsSubNav from '@/components/ops/OpsSubNav';

interface ProfileForm {
  business_description: string;
  primary_entity_id: string;
  operating_jurisdictions: string;
  customer_jurisdictions: string;
  products_services: string;
  handles_personal_data: boolean;
  handles_financial_data: boolean;
  handles_health_data: boolean;
  ai_use_in_product: boolean;
  ai_use_description: string;
  revenue_stage: string;
  employee_count: number | '';
  planned_actions_24mo: string;
  known_completed_filings: string;
  notes: string;
}

const REVENUE_STAGES = [
  { value: 'pre_revenue', label: 'Pre-revenue' },
  { value: 'pre_charging', label: 'Pre-charging' },
  { value: 'charging_under_50k', label: 'Charging under $50k' },
  { value: 'charging_50k_500k', label: 'Charging $50k–$500k' },
  { value: 'charging_500k_5m', label: 'Charging $500k–$5M' },
  { value: 'charging_over_5m', label: 'Charging over $5M' },
];

const defaultForm: ProfileForm = {
  business_description: '',
  primary_entity_id: '',
  operating_jurisdictions: '',
  customer_jurisdictions: '',
  products_services: '',
  handles_personal_data: false,
  handles_financial_data: false,
  handles_health_data: false,
  ai_use_in_product: false,
  ai_use_description: '',
  revenue_stage: 'pre_revenue',
  employee_count: '',
  planned_actions_24mo: '',
  known_completed_filings: '',
  notes: '',
};

function toCommaString(arr: string[] | undefined): string {
  if (!arr || arr.length === 0) return '';
  return arr.join(', ');
}

function toLineString(arr: string[] | undefined): string {
  if (!arr || arr.length === 0) return '';
  return arr.join('\n');
}

export default function ProfilePage() {
  const [form, setForm] = useState<ProfileForm>(defaultForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');

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
              operating_jurisdictions: toCommaString(p.operating_jurisdictions),
              customer_jurisdictions: toCommaString(p.customer_jurisdictions),
              products_services: toCommaString(p.products_services),
              handles_personal_data: p.handles_personal_data || false,
              handles_financial_data: p.handles_financial_data || false,
              handles_health_data: p.handles_health_data || false,
              ai_use_in_product: p.ai_use_in_product || false,
              ai_use_description: p.ai_use_description || '',
              revenue_stage: p.revenue_stage || 'pre_revenue',
              employee_count: p.employee_count ?? '',
              planned_actions_24mo: toLineString(p.planned_actions_24mo),
              known_completed_filings: toLineString(p.known_completed_filings),
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMessage('');
    setError('');

    try {
      const payload = {
        business_description: form.business_description,
        primary_entity_id: form.primary_entity_id || null,
        operating_jurisdictions: form.operating_jurisdictions
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        customer_jurisdictions: form.customer_jurisdictions
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        products_services: form.products_services
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        handles_personal_data: form.handles_personal_data,
        handles_financial_data: form.handles_financial_data,
        handles_health_data: form.handles_health_data,
        ai_use_in_product: form.ai_use_in_product,
        ai_use_description: form.ai_use_in_product ? form.ai_use_description : '',
        revenue_stage: form.revenue_stage,
        employee_count: form.employee_count === '' ? null : Number(form.employee_count),
        planned_actions_24mo: form.planned_actions_24mo
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        known_completed_filings: form.known_completed_filings
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        notes: form.notes,
      };

      const res = await fetch('/api/discovery/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSuccessMessage('Profile saved');
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to save profile');
      }
    } catch (err) {
      console.error('Failed to save profile:', err);
      setError('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof ProfileForm, value: string | boolean | number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

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

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Business Overview */}
          <div className="bg-white rounded border border-border shadow-sm p-5 space-y-4">
            <h2 className="text-terminal-base font-bold text-text-primary font-mono">Business Overview</h2>
            <div>
              <label className={labelClass}>Business Description</label>
              <textarea
                value={form.business_description}
                onChange={(e) => updateField('business_description', e.target.value)}
                rows={4}
                className={inputClass}
                placeholder="Describe your business, what it does, and how it operates..."
              />
            </div>
            <div>
              <label className={labelClass}>Primary Entity ID</label>
              <input
                type="text"
                value={form.primary_entity_id}
                onChange={(e) => updateField('primary_entity_id', e.target.value)}
                className={inputClass}
                placeholder="UUID of your primary legal entity"
              />
            </div>
          </div>

          {/* Jurisdictions */}
          <div className="bg-white rounded border border-border shadow-sm p-5 space-y-4">
            <h2 className="text-terminal-base font-bold text-text-primary font-mono">Jurisdictions</h2>
            <div>
              <label className={labelClass}>Operating Jurisdictions</label>
              <input
                type="text"
                value={form.operating_jurisdictions}
                onChange={(e) => updateField('operating_jurisdictions', e.target.value)}
                className={inputClass}
                placeholder="US-CA, US-NY, US-DE"
              />
              <p className={hintClass}>Comma-separated jurisdiction codes (e.g. US-CA, US-NY, US-DE)</p>
            </div>
            <div>
              <label className={labelClass}>Customer Jurisdictions</label>
              <input
                type="text"
                value={form.customer_jurisdictions}
                onChange={(e) => updateField('customer_jurisdictions', e.target.value)}
                className={inputClass}
                placeholder="US-CA, US-NY, US-DE"
              />
              <p className={hintClass}>Comma-separated jurisdiction codes (e.g. US-CA, US-NY, US-DE)</p>
            </div>
          </div>

          {/* Products & Services */}
          <div className="bg-white rounded border border-border shadow-sm p-5 space-y-4">
            <h2 className="text-terminal-base font-bold text-text-primary font-mono">Products & Services</h2>
            <div>
              <label className={labelClass}>Products / Services</label>
              <input
                type="text"
                value={form.products_services}
                onChange={(e) => updateField('products_services', e.target.value)}
                className={inputClass}
                placeholder="SaaS platform, API service, mobile app"
              />
              <p className={hintClass}>Comma-separated list of your products and services</p>
            </div>
          </div>

          {/* Data Handling */}
          <div className="bg-white rounded border border-border shadow-sm p-5 space-y-4">
            <h2 className="text-terminal-base font-bold text-text-primary font-mono">Data Handling</h2>
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
                  onChange={(e) => updateField('ai_use_in_product', e.target.checked)}
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
            <h2 className="text-terminal-base font-bold text-text-primary font-mono">Stage & Size</h2>
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
            <h2 className="text-terminal-base font-bold text-text-primary font-mono">Plans & History</h2>
            <div>
              <label className={labelClass}>Planned Actions (next 24 months)</label>
              <textarea
                value={form.planned_actions_24mo}
                onChange={(e) => updateField('planned_actions_24mo', e.target.value)}
                rows={4}
                className={inputClass}
                placeholder="One planned action per line..."
              />
              <p className={hintClass}>One item per line</p>
            </div>
            <div>
              <label className={labelClass}>Known Completed Filings</label>
              <textarea
                value={form.known_completed_filings}
                onChange={(e) => updateField('known_completed_filings', e.target.value)}
                rows={4}
                className={inputClass}
                placeholder="One filing per line..."
              />
              <p className={hintClass}>One item per line</p>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white rounded border border-border shadow-sm p-5 space-y-4">
            <h2 className="text-terminal-base font-bold text-text-primary font-mono">Notes</h2>
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
            {error && <span className="font-mono text-terminal-sm text-red-600">{error}</span>}
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
