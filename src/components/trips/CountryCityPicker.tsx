'use client';

/**
 * CountryCityPicker — a linked country → city picker for the hotel search
 * (PR-loc-2). The COUNTRY dropdown is loaded once from
 * /api/travel/locations/countries; picking a country loads THAT country's cities
 * from /api/travel/locations/cities?countryCode=XX into a TYPE-AHEAD field that
 * filters the in-memory list as you type (no fetch per keystroke). The city MUST
 * be chosen from the list — there is no free-text path — so every selection is a
 * real LiteAPI city that resolves in the two-step search (kills the "Libson" typo).
 *
 * It reports the picked { city, country } up via onChange. `country` is the
 * country NAME (what /api/travel/hotels/search expects — it maps name → ISO-2
 * internally). onChange(null) whenever there is no valid, list-confirmed city.
 */

import { useEffect, useRef, useState } from 'react';
import { TRAVEL_LABEL_CLASS } from './travelSection';

interface Country { code: string; name: string }

interface Props {
  /** Called with the list-confirmed selection, or null when there isn't one.
   *  `country` is the country NAME; `countryCode` is its ISO-2 (PR-loc-3: passed
   *  end-to-end so the hotel search resolves every country, not just the ~60 the
   *  name→code map knows). */
  onChange: (selection: { city: string; country: string; countryCode: string } | null) => void;
}

const inputClass =
  'bg-white/10 border border-white/20 rounded px-3 py-2 text-sm text-white placeholder-white/40 ' +
  'focus:outline-none focus:ring-2 focus:ring-white/40';

export default function CountryCityPicker({ onChange }: Props) {
  const [countries, setCountries] = useState<Country[]>([]);
  const [countriesLoading, setCountriesLoading] = useState(true);
  const [countriesError, setCountriesError] = useState('');

  const [countryCode, setCountryCode] = useState('');
  const [cities, setCities] = useState<string[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [citiesError, setCitiesError] = useState('');

  const [cityQuery, setCityQuery] = useState('');
  const [cityChosen, setCityChosen] = useState(''); // '' until picked FROM the list
  const [showDropdown, setShowDropdown] = useState(false);
  const cityBoxRef = useRef<HTMLDivElement>(null);

  const countryName = countries.find((c) => c.code === countryCode)?.name ?? '';

  // Load the country list once on mount. ONE fetch.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/travel/locations/countries');
        if (!res.ok) throw new Error('countries');
        const data = await res.json();
        if (!cancelled) setCountries((data.countries || []) as Country[]);
      } catch {
        if (!cancelled) setCountriesError('Could not load countries. Please try again later.');
      } finally {
        if (!cancelled) setCountriesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Close the city dropdown on an outside click.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (cityBoxRef.current && !cityBoxRef.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  // Pick a country → load THAT country's cities (ONE fetch per country) + reset city.
  const onPickCountry = async (code: string) => {
    setCountryCode(code);
    setCities([]);
    setCityQuery('');
    setCityChosen('');
    setCitiesError('');
    setShowDropdown(false);
    onChange(null); // no valid city yet
    if (!code) return;
    setCitiesLoading(true);
    try {
      const res = await fetch(`/api/travel/locations/cities?countryCode=${encodeURIComponent(code)}`);
      if (!res.ok) throw new Error('cities');
      const data = await res.json();
      const list = ((data.cities || []) as Array<{ city: string }>)
        .map((c) => c.city)
        .filter((c): c is string => typeof c === 'string' && c.length > 0);
      setCities(list);
    } catch {
      setCitiesError('Could not load cities for that country. Please try again later.');
    } finally {
      setCitiesLoading(false);
    }
  };

  // Type-ahead: filter the HELD city list (no fetch). Top 10 substring matches.
  const matches =
    cityQuery.trim().length === 0
      ? []
      : cities.filter((c) => c.toLowerCase().includes(cityQuery.trim().toLowerCase())).slice(0, 10);

  const onTypeCity = (val: string) => {
    setCityQuery(val);
    setCityChosen('');     // typing invalidates any prior list pick
    onChange(null);        // ...and the parent's selection
    setShowDropdown(val.trim().length > 0);
  };

  const onPickCity = (city: string) => {
    setCityQuery(city);
    setCityChosen(city);
    setShowDropdown(false);
    onChange({ city, country: countryName, countryCode }); // list-confirmed → report up (name + ISO-2)
  };

  return (
    // COMPACT-1: two labelled cells in the teaser form factor — mono micro-labels
    // above each field, 2-up on mobile, spanning 3 of the hotel form's 5 lg columns.
    <div className="col-span-2 grid grid-cols-2 gap-2 lg:col-span-3">
      {/* Country dropdown (label = name, value = code). */}
      <label className="flex flex-col gap-1">
        <span className={TRAVEL_LABEL_CLASS}>Country</span>
        <select
          value={countryCode}
          onChange={(e) => onPickCountry(e.target.value)}
          disabled={countriesLoading || !!countriesError}
          className={inputClass}
          aria-label="Destination country"
        >
          <option value="">
            {countriesLoading ? 'Loading countries…' : countriesError ? 'Countries unavailable' : 'Select a country…'}
          </option>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>{c.name}</option>
          ))}
        </select>
      </label>

      {/* City type-ahead (enabled once a country is chosen). */}
      <div className="flex flex-col gap-1" ref={cityBoxRef}>
        <span className={TRAVEL_LABEL_CLASS}>City</span>
        <div className="relative">
          <input
            type="text"
            value={cityQuery}
            onChange={(e) => onTypeCity(e.target.value)}
            onFocus={() => { if (cityQuery.trim().length > 0) setShowDropdown(true); }}
            disabled={!countryCode || citiesLoading}
            placeholder={
              !countryCode ? 'Pick a country first'
              : citiesLoading ? 'Loading cities…'
              : 'Type a city (e.g. Lis)'
            }
            className={`${inputClass} w-full ${cityChosen ? 'border-brand-green' : ''}`}
            aria-label="Destination city"
          />
          {showDropdown && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[260px] overflow-y-auto rounded-lg border border-panel-border bg-panel-surface shadow-lg">
              {matches.length > 0 ? (
                matches.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onPickCity(c)}
                    className="block w-full px-3 py-2 text-left text-sm text-white hover:bg-white/10"
                  >
                    {c}
                  </button>
                ))
              ) : (
                <div className="px-3 py-2 text-sm text-white/50">No matching cities — try a different spelling.</div>
              )}
            </div>
          )}
          {citiesError && <p className="mt-1 text-xs text-brand-red">{citiesError}</p>}
        </div>
      </div>
    </div>
  );
}
