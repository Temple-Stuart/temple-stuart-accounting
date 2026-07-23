'use client';

// LAND-SEARCH-1: the booking.com-style hero teaser — a slim Flights | Hotels
// form that ONLY builds a handoff URL and navigates into the live travel
// tools with fields prefilled. NO search execution, NO API calls, NO
// search-stack imports (grep-provable): the real search runs only when the
// guest presses the real Search button in the tool (the guest API caps stay
// unburned by curiosity clicks).
//
// Param schema (namespaced — F2's writeTabParam touches only the 'tab' key,
// ModuleLauncher.tsx:191-198, so these coexist):
//   flights: /?tab=travel&ls=flights&lsFrom=LAX&lsTo=DPS&lsDepart=YYYY-MM-DD[&lsReturn=YYYY-MM-DD]
//   hotels:  /?tab=travel&ls=hotels&lsCheckin=YYYY-MM-DD&lsCheckout=YYYY-MM-DD
// Consumption: PublicFlightSearch / PublicHotelSearch read these once on
// mount (guarded + validated; absent params = byte-identical default path).
//
// HOTEL DESTINATION (the audit's honest boundary): the hotel tool's
// destination is LIST-CONFIRMED from live LiteAPI country/city lists
// (CountryCityPicker — PR-loc-2 killed free-text on purpose), and the picker
// has no prefill seam. A landing text field whose value could not land
// anywhere honest is a lie — so hotel mode carries the DATES and says
// plainly that the destination is picked from the live list on the next
// screen. Adding a picker prefill seam is LAND-SEARCH-2 if Alex rules it.
//
// Field shapes mirror the audited tools exactly: IATA inputs (maxLength 3,
// mono, LAX/DPS placeholders — FlightPickerView.tsx:181/:187) and the tools'
// own default dates (depart +30/+37 — PublicFlightSearch.tsx:47-48; check-in
// +30 / check-out +33 — PublicHotelSearch.tsx:46-47). Token-native Bloomberg
// chrome; zero fetches; zero new hex.

import { useState } from 'react';

function defaultDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

const FIELD_CLASS =
  'w-full rounded border border-white/20 bg-white/10 px-3 py-2 text-sm text-white ' +
  'placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/40';
const LABEL_CLASS = 'font-mono text-[10px] font-semibold uppercase tracking-wider text-white/50';

export default function LandingSearchTeaser() {
  const [mode, setMode] = useState<'flights' | 'hotels'>('flights');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [depart, setDepart] = useState(defaultDate(30));
  const [ret, setRet] = useState('');
  const [checkin, setCheckin] = useState(defaultDate(30));
  const [checkout, setCheckout] = useState(defaultDate(33));

  const go = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams({ tab: 'travel', ls: mode });
    if (mode === 'flights') {
      if (from.trim()) params.set('lsFrom', from.trim().toUpperCase());
      if (to.trim()) params.set('lsTo', to.trim().toUpperCase());
      if (depart) params.set('lsDepart', depart);
      if (ret) params.set('lsReturn', ret);
    } else {
      if (checkin) params.set('lsCheckin', checkin);
      if (checkout) params.set('lsCheckout', checkout);
    }
    window.location.href = `/?${params.toString()}`;
  };

  const toggleClass = (active: boolean) =>
    `px-3 py-1.5 font-mono text-xs font-medium ${
      active ? 'bg-white text-brand-purple' : 'border border-white/30 text-white/70 hover:bg-white/10'
    }`;

  return (
    <form
      onSubmit={go}
      className="mt-8 max-w-3xl rounded-lg border border-white/20 bg-white/5 p-4"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={() => setMode('flights')} className={toggleClass(mode === 'flights')}>
          Flights
        </button>
        <button type="button" onClick={() => setMode('hotels')} className={toggleClass(mode === 'hotels')}>
          Hotels
        </button>
        <span className="ml-1 font-mono text-[10px] uppercase tracking-wider text-white/40">
          Live searches · no account needed
        </span>
      </div>

      {mode === 'flights' ? (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
          <label className="block">
            <span className={LABEL_CLASS}>From</span>
            <input
              type="text"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              maxLength={3}
              placeholder="LAX"
              className={`${FIELD_CLASS} font-mono uppercase`}
              aria-label="From airport code"
            />
          </label>
          <label className="block">
            <span className={LABEL_CLASS}>To</span>
            <input
              type="text"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              maxLength={3}
              placeholder="DPS"
              className={`${FIELD_CLASS} font-mono uppercase`}
              aria-label="To airport code"
            />
          </label>
          <label className="block">
            <span className={LABEL_CLASS}>Depart</span>
            <input
              type="date"
              value={depart}
              onChange={(e) => setDepart(e.target.value)}
              className={FIELD_CLASS}
              aria-label="Departure date"
            />
          </label>
          <label className="block">
            <span className={LABEL_CLASS}>Return</span>
            <input
              type="date"
              value={ret}
              onChange={(e) => setRet(e.target.value)}
              className={FIELD_CLASS}
              aria-label="Return date (optional)"
            />
          </label>
          <button
            type="submit"
            className="col-span-2 self-end bg-white px-4 py-2 text-sm font-medium text-brand-purple hover:bg-bg-row sm:col-span-4 lg:col-span-1"
          >
            Search →
          </button>
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-3">
          <label className="block">
            <span className={LABEL_CLASS}>Check-in</span>
            <input
              type="date"
              value={checkin}
              onChange={(e) => setCheckin(e.target.value)}
              className={FIELD_CLASS}
              aria-label="Check-in date"
            />
          </label>
          <label className="block">
            <span className={LABEL_CLASS}>Check-out</span>
            <input
              type="date"
              value={checkout}
              onChange={(e) => setCheckout(e.target.value)}
              className={FIELD_CLASS}
              aria-label="Check-out date"
            />
          </label>
          <button
            type="submit"
            className="col-span-2 self-end bg-white px-4 py-2 text-sm font-medium text-brand-purple hover:bg-bg-row lg:col-span-1"
          >
            Search →
          </button>
          <p className="col-span-2 text-xs text-white/50 lg:col-span-3">
            You&rsquo;ll pick your destination from the live city list on the next screen — dates
            come along prefilled.
          </p>
        </div>
      )}
    </form>
  );
}
