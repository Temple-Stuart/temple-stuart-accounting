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

interface Country { code: string; name: string }

interface Props {
  /** Called with the list-confirmed selection, or null when there isn't one. */
  onChange: (selection: { city: string; country: string } | null) => void;
}

const inputClass =
  'bg-white border border-border rounded px-3 py-2 text-sm text-text-primary ' +
  'focus:outline-none focus:ring-2 focus:ring-brand-purple/40';

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
    onChange({ city, country: countryName }); // list-confirmed → report up
  };

  return (
    <div className="lg:col-span-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
      {/* Country dropdown (label = name, value = code). */}
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

      {/* City type-ahead (enabled once a country is chosen). */}
      <div className="relative" ref={cityBoxRef}>
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
          <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[260px] overflow-y-auto rounded-lg border border-border bg-white shadow-lg">
            {matches.length > 0 ? (
              matches.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onPickCity(c)}
                  className="block w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-bg-row"
                >
                  {c}
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-sm text-text-muted">No matching cities — try a different spelling.</div>
            )}
          </div>
        )}
        {citiesError && <p className="mt-1 text-xs text-brand-red">{citiesError}</p>}
      </div>
    </div>
  );
}
