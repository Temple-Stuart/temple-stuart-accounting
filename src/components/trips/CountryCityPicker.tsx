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
 *
 * HOME-BRIEF-05 (Alex, 2026-11-10 19:00; 2026-11-09 17:45) — A STARTING PLACE. The picker reads
 * StartingPlaceContext (./startingPlace.ts). Null — the default, and every mount but the landing's
 * Hotels panel — and it is exactly the picker above. A place (an event's country code, country and
 * city, set when "Stay near it →" is pressed), once the country list has loaded:
 *   · the country is chosen by its code, and its cities come from the ONE loader below — the same
 *     public, rate-limited list call a visitor's own country pick makes; none when that country's
 *     list is already held;
 *   · a city the list holds under the same name (matchCity: exact once trimmed, lower-cased and
 *     stripped of accents; one match only) is chosen and reported up exactly as a click on that city
 *     reports it — { city: the list's own string, country: the list's country name, countryCode };
 *   · no such city → the event's city is typed into the City field, NOT chosen, the list not opened,
 *     with one line under it; nothing is reported but null. There is still no free-text path;
 *   · a code the country list does not hold → nothing is chosen, and one line says so.
 * A newer place, or the visitor's own pick, wins over an answer still in flight (every pick of a
 * country takes a number; an answer that comes back to an older number is dropped). The same place
 * handed in again — a new object — is applied again. The visitor changes either field afterwards
 * exactly as before. Never a date and never a search: this file calls the two list routes and
 * nothing else.
 */

import { useContext, useEffect, useRef, useState } from 'react';
import { TRAVEL_LABEL_CLASS } from './travelSection';
import { StartingPlaceContext, cityNotInListLine, countryNotInListLine, matchCity, type StartingPlace } from './startingPlace';

interface Country { code: string; name: string }

interface Props {
  /** Called with the list-confirmed selection, or null when there isn't one.
   *  `country` is the country NAME; `countryCode` is its ISO-2 (PR-loc-3: passed
   *  end-to-end so the hotel search resolves every country, not just the ~60 the
   *  name→code map knows). */
  onChange: (selection: { city: string; country: string; countryCode: string } | null) => void;
}

const inputClass =
  'bg-bg-row border border-border rounded px-3 py-2 text-sm text-text-primary placeholder-text-faint ' +
  'focus:outline-none focus:ring-2 focus:ring-brand-purple';

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

  // HOME-BRIEF-05: the starting place (null → none of what follows ever runs or renders).
  const place = useContext(StartingPlaceContext);
  /** The one line a starting place leaves when the hotel list does not hold it, and the field it stands under. */
  const [placeLine, setPlaceLine] = useState<{ under: 'country' | 'city'; words: string } | null>(null);
  /** The place last applied — by identity, so each one is applied once and the same event pressed again (a new object) is applied again. */
  const appliedPlace = useRef<StartingPlace | null>(null);
  /** Every pick of a country — the visitor's or a starting place's — takes the next number; an answer for an older number is dropped. */
  const pickNumber = useRef(0);
  /** The country whose city list is held, with that list — null until a load succeeds, and again from the moment another pick starts. */
  const heldCities = useRef<{ code: string; list: string[] } | null>(null);
  /** The parent's onChange as of the latest render — a starting place reports after an awaited load. */
  const report = useRef(onChange);
  useEffect(() => { report.current = onChange; });

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
  // HOME-BRIEF-05: THE ONE LOADER — the visitor's own pick and a starting place both come through here. It answers with
  // the list it loaded, or with null: no country was picked, the load failed (said under the City field), or a newer
  // pick overtook this one (its answer is dropped — the newest pick wins).
  const onPickCountry = async (code: string): Promise<string[] | null> => {
    const mine = ++pickNumber.current;
    heldCities.current = null;
    setCountryCode(code);
    setCities([]);
    setCityQuery('');
    setCityChosen('');
    setCitiesError('');
    setShowDropdown(false);
    setPlaceLine(null);
    onChange(null); // no valid city yet
    if (!code) {
      setCitiesLoading(false); // a load this pick overtook no longer clears it itself
      return null;
    }
    setCitiesLoading(true);
    try {
      const res = await fetch(`/api/travel/locations/cities?countryCode=${encodeURIComponent(code)}`);
      if (!res.ok) throw new Error('cities');
      const data = await res.json();
      const list = ((data.cities || []) as Array<{ city: string }>)
        .map((c) => c.city)
        .filter((c): c is string => typeof c === 'string' && c.length > 0);
      if (mine !== pickNumber.current) return null;
      setCities(list);
      heldCities.current = { code, list };
      return list;
    } catch {
      if (mine === pickNumber.current) setCitiesError('Could not load cities for that country. Please try again later.');
      return null;
    } finally {
      if (mine === pickNumber.current) setCitiesLoading(false);
    }
  };

  // HOME-BRIEF-05: start from a place — the country by its code, its cities from the loader above (or the list already
  // held: no call), then the city by an exact match, or typed in and left to the visitor.
  const startFrom = async (from: StartingPlace) => {
    const country = countries.find((c) => c.code === from.countryCode);
    if (!country) {
      // The country list does not hold this code: nothing is chosen, and one line says so.
      void onPickCountry('');
      setPlaceLine({ under: 'country', words: countryNotInListLine(from.country) });
      return;
    }
    const held = heldCities.current;
    const list = held !== null && held.code === country.code ? held.list : await onPickCountry(country.code);
    if (list === null) return; // overtaken by a newer pick, or the list did not load
    const city = matchCity(from.city, list);
    setShowDropdown(false);
    if (city === null) {
      // Not in the list under that name: typed in, NOT chosen — the visitor picks the nearest from the list.
      setCityQuery(from.city);
      setCityChosen('');
      setPlaceLine({ under: 'city', words: cityNotInListLine(from.city) });
      report.current(null);
      return;
    }
    // In the list: chosen and reported exactly as a click on that city reports it.
    setCityQuery(city);
    setCityChosen(city);
    setPlaceLine(null);
    report.current({ city, country: country.name, countryCode: country.code });
  };

  // HOME-BRIEF-05: once the country list has loaded, apply each starting place once. It runs after every render and acts
  // only when the place is one it has not applied — so nothing the visitor does afterwards re-applies it.
  useEffect(() => {
    if (place === null || countriesLoading || countriesError !== '' || appliedPlace.current === place) return;
    appliedPlace.current = place;
    void startFrom(place);
  });

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
    setPlaceLine(null); // HOME-BRIEF-05: the visitor has picked from the list — the starting place's line has done its work
    onChange({ city, country: countryName, countryCode }); // list-confirmed → report up (name + ISO-2)
  };

  return (
    // COMPACT-1: two labelled cells in the teaser form factor — mono micro-labels
    // above each field, 2-up on mobile, spanning 3 of the hotel form's 5 lg columns.
    <div className="col-span-full grid grid-cols-1 gap-2 sm:col-span-2 sm:grid-cols-2 lg:col-span-3">
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
        {placeLine !== null && placeLine.under === 'country' && <span role="status" className="text-xs text-text-secondary" data-starting-place-line="country">{placeLine.words}</span>}
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
                <div className="px-3 py-2 text-sm text-text-faint">No matching cities — try a different spelling.</div>
              )}
            </div>
          )}
          {citiesError && <p className="mt-1 text-xs text-brand-red">{citiesError}</p>}
        </div>
        {placeLine !== null && placeLine.under === 'city' && <p role="status" className="text-xs text-text-secondary" data-starting-place-line="city">{placeLine.words}</p>}
      </div>
    </div>
  );
}
