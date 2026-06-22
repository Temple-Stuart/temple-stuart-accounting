'use client';

/**
 * PublicVisaCheck — the LIVE, logged-out visa-requirements surface (PR-V4). A
 * guest picks their passport country + a destination from two STATIC dropdowns
 * (no API call to populate — the Travel Buddy free tier is tiny), and sees real
 * visa requirements from the PUBLIC /api/travel/visa/check route (PR-V2: no auth,
 * bounded by per-IP rate-limit + a small daily cap). Results render through the
 * pure <VisaResultView/> (PR-V3).
 *
 * Everything here is PUBLIC: the check is free public value and the "Apply" link
 * in the result is the official government/eVisa site (no gating, no fake result).
 * The route 400s on an identical passport/destination, so the form blocks that
 * case before it can fire.
 */

import { useState } from 'react';
import VisaResultView from './VisaResultView';
import type { VisaRequirement } from '@/lib/travelBuddyClient';
import TravelSectionShell, { TRAVEL_INPUT_CLASS, TRAVEL_BUTTON_CLASS } from './travelSection';

// Static {name, iso2} country list — carries ISO-2 directly (the dropdown value),
// so no name→code lookup and no live /passports or /destinations call. Curated to
// the common passport + destination set; extend as needed.
const COUNTRIES: { name: string; iso2: string }[] = [
  { name: 'Argentina', iso2: 'AR' }, { name: 'Australia', iso2: 'AU' },
  { name: 'Austria', iso2: 'AT' }, { name: 'Belgium', iso2: 'BE' },
  { name: 'Brazil', iso2: 'BR' }, { name: 'Canada', iso2: 'CA' },
  { name: 'Chile', iso2: 'CL' }, { name: 'China', iso2: 'CN' },
  { name: 'Colombia', iso2: 'CO' }, { name: 'Croatia', iso2: 'HR' },
  { name: 'Czechia', iso2: 'CZ' }, { name: 'Denmark', iso2: 'DK' },
  { name: 'Egypt', iso2: 'EG' }, { name: 'Finland', iso2: 'FI' },
  { name: 'France', iso2: 'FR' }, { name: 'Germany', iso2: 'DE' },
  { name: 'Greece', iso2: 'GR' }, { name: 'Hong Kong', iso2: 'HK' },
  { name: 'Hungary', iso2: 'HU' }, { name: 'Iceland', iso2: 'IS' },
  { name: 'India', iso2: 'IN' }, { name: 'Indonesia', iso2: 'ID' },
  { name: 'Ireland', iso2: 'IE' }, { name: 'Israel', iso2: 'IL' },
  { name: 'Italy', iso2: 'IT' }, { name: 'Japan', iso2: 'JP' },
  { name: 'Kenya', iso2: 'KE' }, { name: 'Malaysia', iso2: 'MY' },
  { name: 'Mexico', iso2: 'MX' }, { name: 'Morocco', iso2: 'MA' },
  { name: 'Netherlands', iso2: 'NL' }, { name: 'New Zealand', iso2: 'NZ' },
  { name: 'Norway', iso2: 'NO' }, { name: 'Peru', iso2: 'PE' },
  { name: 'Philippines', iso2: 'PH' }, { name: 'Poland', iso2: 'PL' },
  { name: 'Portugal', iso2: 'PT' }, { name: 'Qatar', iso2: 'QA' },
  { name: 'Saudi Arabia', iso2: 'SA' }, { name: 'Singapore', iso2: 'SG' },
  { name: 'South Africa', iso2: 'ZA' }, { name: 'South Korea', iso2: 'KR' },
  { name: 'Spain', iso2: 'ES' }, { name: 'Sweden', iso2: 'SE' },
  { name: 'Switzerland', iso2: 'CH' }, { name: 'Thailand', iso2: 'TH' },
  { name: 'Turkey', iso2: 'TR' }, { name: 'United Arab Emirates', iso2: 'AE' },
  { name: 'United Kingdom', iso2: 'GB' }, { name: 'United States', iso2: 'US' },
  { name: 'Vietnam', iso2: 'VN' },
];

export default function PublicVisaCheck() {
  const [passport, setPassport] = useState('US');
  const [destination, setDestination] = useState('');

  const [result, setResult] = useState<VisaRequirement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  const sameCountry = !!passport && passport === destination;
  const canCheck = !!passport && !!destination && !sameCountry && !loading;

  const check = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCheck) return;

    setLoading(true);
    setError('');
    setResult(null);
    setSearched(true);

    try {
      const params = new URLSearchParams({ passport, destination });
      const res = await fetch(`/api/travel/visa/check?${params}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to check visa requirements');
      }
      const data = (await res.json()) as VisaRequirement;
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Visa check failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <TravelSectionShell
      title="Check if you need a visa — free, no account needed."
      explainer="Pick your passport and where you're going to see the rule, how long you can stay, and the official place to apply."
    >
      <form onSubmit={check} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-text-muted">Passport</span>
          <select value={passport} onChange={(e) => setPassport(e.target.value)} className={TRAVEL_INPUT_CLASS} aria-label="Passport country">
            {COUNTRIES.map((c) => (
              <option key={c.iso2} value={c.iso2}>{c.name}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-text-muted">Going to</span>
          <select value={destination} onChange={(e) => setDestination(e.target.value)} className={TRAVEL_INPUT_CLASS} aria-label="Destination country">
            <option value="">Select a country…</option>
            {COUNTRIES.map((c) => (
              <option key={c.iso2} value={c.iso2}>{c.name}</option>
            ))}
          </select>
        </label>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={!canCheck}
            className={`${TRAVEL_BUTTON_CLASS} w-full`}
          >
            {loading ? 'Checking…' : 'Check'}
          </button>
        </div>
      </form>

      {sameCountry && (
        <p className="text-xs text-brand-amber">Pick two different countries to check entry rules.</p>
      )}

      {searched && <VisaResultView result={result} loading={loading} error={error} />}
    </TravelSectionShell>
  );
}
