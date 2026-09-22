'use client';

// LANDING-V5: the trip.com icon-input imports (Plane/Calendar + TravelField)
// retired with the form's move to the spec's segmented hairline bar.
// TRAVEL-RESULTS-TABLE: the results wear the deck-table anatomy — the
// DATA.columnHeader micro-label is the one shared class string (ds.ts:225).
import { useState } from 'react';
import { DATA } from '@/lib/ds';
// HOTEL-01 (2026-09-22): the session search count is one shared control.
import SearchCount from './SearchCount';
import {
  CABIN_LABEL, CABIN_OPTIONS, DEPARTURE_OPTIONS, NOT_STATED, SORT_OPTIONS, STOPS_OPTIONS,
  carrierLineOf, countLine, fareDifference, filtersStatement, groupFlights, lowestFare, lowestFareLine, money, statedText,
  type FareAttributes, type FlightSegmentView, type FlightUiFilters,
} from '@/lib/flights/fares';

/**
 * FlightPickerView — the PURE, props-only render of the flight picker.
 *
 * Extracted from FlightPicker (T1). It owns NO data and NO network: no fetch, no
 * API call, no data-loading effect, no context, no server import, and it does NOT
 * import any provider client or name any /api route. It is FULLY CONTROLLED —
 * the `legs` array (search offers + committed flights), the `committing` flag and
 * `liveSearchEnabled` arrive as props, and EVERY action — search, select, manual
 * entry, and the BOOK/commit + uncommit — arrives as a callback the container
 * owns. The view just calls `onSearchLeg`/`onCommitLeg`/…; the container is the
 * only place the paid provider search or any order can fire.
 *
 * NOTE: the provider name in the brand strings ("Searching … via X", "Powered by
 * X") is the `providerLabel` prop — LAUNCH-01 RETIRE-01: LiteAPI is the only
 * flights lane, so it defaults to 'LiteAPI'; the containers pass it explicitly.
 */

export interface FlightOffer {
  id: string;
  price: number;
  currency: string;
  outbound: {
    // PR-tz-0b: timeZone = the airport's IANA zone (from the provider's airport data). Captured +
    // carried to the commit payload; not yet stored (tz-1) or rendered (tz-3).
    departure: { airport: string; airportName?: string; localTime: string; date: string; timeZone?: string | null };
    arrival: { airport: string; airportName?: string; localTime: string; date: string; timeZone?: string | null };
    duration: string;
    durationMinutes?: number;
    stops: number;
    carriers: string[];
    segments?: any[];
  } | null;
  return: {
    departure: { airport: string; airportName?: string; localTime: string; date: string; timeZone?: string | null };
    arrival: { airport: string; airportName?: string; localTime: string; date: string; timeZone?: string | null };
    duration: string;
    stops: number;
    carriers: string[];
  } | null;
  /** FLIGHT-01 (2026-09-22): what the fare buys, TRI-STATE — null is the carrier's
   *  silence and renders "not stated by the carrier"; nothing here is inferred. */
  fare?: FareAttributes;
  /** FLIGHT-01: the segments as the row shows them (marketing AND operating carrier,
   *  flight numbers, airports with the names the payload gives, the clock). */
  outboundSegments?: FlightSegmentView[];
  returnSegments?: FlightSegmentView[];
  /** FLIGHT-01: the identity the results group by — marketing carrier + flight
   *  number + departure instant per segment; null when the payload cannot identify it. */
  flightKey?: string | null;
  isManual?: boolean;
  /** BOOK-1: the offer's TTL when the provider states one — the Book pre-check
   *  routes already-dead offers to re-search, never a doomed checkout.
   *  Optional: absent on manual offers. */
  expiresAt?: string | null;
}

export interface FlightLeg {
  id: string;
  origin: string;
  destination: string;
  departureDate: string;
  returnDate: string;
  tripType: 'roundtrip' | 'oneway';
  offers: FlightOffer[];
  selectedOffer: FlightOffer | null;
  committed: boolean;
  commitId: string | null; // vendorOptionId for uncommit
  loading: boolean;
  error: string;
  expanded: boolean;
  // Manual entry fields
  manualAirline: string;
  manualPrice: string;
  manualDepartTime: string;
  manualArriveTime: string;
  manualArriveDate: string;
  /** FLIGHT-01: the screen's filters and sort. Changing one changes the LEG only —
   *  the search re-runs on the SEARCH press alone (each is a metered call). */
  filters: FlightUiFilters;
}

export interface FlightPickerViewProps {
  legs: FlightLeg[];
  committing: string | null;
  /** True when live flight search is configured (container reads the env). */
  liveSearchEnabled: boolean;
  // ── Actions (the container owns behavior; search + commit fire from there) ──
  onUpdateLeg: (legId: string, updates: Partial<FlightLeg>) => void;
  onRemoveLeg: (legId: string) => void;
  onAddLeg: () => void;
  /** Triggers the PAID provider search (container-owned). */
  onSearchLeg: (legId: string) => void;
  /** Optional — only needed when the manual-entry block is shown (see enableManualEntry). */
  onSubmitManual?: (legId: string) => void;
  /** The "Save to trip" action (container-owned). */
  onCommitLeg: (legId: string) => void;
  onUncommitLeg: (legId: string) => void;
  /** "Book" (pay now) — opens the LiteAPI flight checkout for the leg's selected
   *  offer (container-owned). Optional: only shown when wired (the public flight
   *  search passes it). Guest-ok, mirroring the hotel Book. */
  onBookLeg?: (legId: string) => void;
  /** PR-Travel-Cleanup: show the manual "enter flight details" block (Airline/Price/times
   *  + "Use This"). Default true (the authed in-trip picker keeps it for "booked
   *  elsewhere"). The public home flight search passes false — guests use the live search only. */
  enableManualEntry?: boolean;
  /** PR-FL-6a: the provider name rendered in the brand strings ("Searching …
   *  via X", "Powered by X"). LAUNCH-01: defaults to 'LiteAPI', the only lane;
   *  containers pass it so the label never lies about whose fares these are
   *  (no-drift). */
  providerLabel?: string;
  /** FLIGHT-01: how many metered searches the container has sent this session — shown beside SEARCH. */
  searchCount?: number;
}

const formatStops = (stops: number) => {
  if (stops === 0) return 'Nonstop';
  if (stops === 1) return '1 stop';
  return `${stops} stops`;
};

export default function FlightPickerView({
  legs,
  committing,
  liveSearchEnabled,
  onUpdateLeg,
  onRemoveLeg,
  onAddLeg,
  onSearchLeg,
  onSubmitManual,
  onCommitLeg,
  onUncommitLeg,
  onBookLeg,
  enableManualEntry = true,
  providerLabel = 'LiteAPI',
  searchCount = 0,
}: FlightPickerViewProps) {
  const totalCommitted = legs.filter(l => l.committed).reduce((s, l) => s + (l.selectedOffer?.price || 0), 0);
  // FLIGHT-01: which flight rows are open to their fare options — presentation
  // only (no data, no network); a row holding the selected fare is always open.
  const [openRows, setOpenRows] = useState<Record<string, boolean>>({});
  const setFilters = (leg: FlightLeg, patch: Partial<FlightUiFilters>) => onUpdateLeg(leg.id, { filters: { ...leg.filters, ...patch } });

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      {totalCommitted > 0 && (
        <div className="flex items-center justify-between px-3 py-2 bg-brand-green/10 border border-brand-green/40 rounded text-sm">
          <span className="text-brand-green font-medium">
            {legs.filter(l => l.committed).length} flight{legs.filter(l => l.committed).length !== 1 ? 's' : ''} saved
          </span>
          <span className="font-bold text-brand-green">${totalCommitted.toLocaleString()}</span>
        </div>
      )}

      {/* Flight legs */}
      {legs.map((leg, legIdx) => (
        // PR-STRIP-DESIGN-1: the shell card elevated to bg-panel-surface, so
        // the leg block steps DOWN to the inset token (bg-white/5) to keep
        // its separation — same ds.ts surface family, no new colors.
        // LANDING-V5: the leg card whitens to the spec's one-white-card
        // surface (was the bg-bg-row inset).
        <div key={leg.id} className="bg-white border border-border rounded-lg overflow-hidden">
          {/* Leg header — BAR-COMMITTED-ONLY (the BAR-KILL gate ruling,
              variant b): the bar renders ONLY for committed legs, where it IS
              the saved-flight summary card and the toggle for the 8
              programmatic collapse paths (setters untouched). Uncommitted
              legs render no bar — their form is always open (body gate
              below). PR-DEAD-FALLBACK: the placeholder route-title fallback
              DIED — MANUAL-ROUTE-GUARD closed the forward path (FlightPicker
              submitManual parity guard + commitLeg route guard: no commit
              without origin+destination), and Alex's psql zero-proof
              (2026-08-09, trip_itinerary vendorOptionType='flight') found no
              routeless committed flight in prod, so the branch was
              unreachable. The "$X selected" line died earlier — the bar
              requires committed; the Saved badge's committed check was
              tautological and dropped. */}
          {leg.committed && (
            <div
              className="flex items-center justify-between px-3 py-2 bg-bg-row border-b border-border cursor-pointer hover:bg-bg-row transition-colors"
              onClick={() => onUpdateLeg(leg.id, { expanded: !leg.expanded })}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">✈️</span>
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
                    {legs.length > 1 && <span className="text-text-faint">Leg {legIdx + 1}:</span>}
                    {`${leg.origin} → ${leg.destination}`}
                    <span className="px-2 py-0.5 bg-brand-green/20 text-brand-green text-[10px] font-medium rounded">Saved</span>
                  </div>
                  <div className="text-xs text-text-faint">
                    {leg.departureDate}{leg.tripType === 'roundtrip' && leg.returnDate ? ` — ${leg.returnDate}` : ''} • {leg.tripType === 'roundtrip' ? 'Round-trip' : 'One-way'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {leg.selectedOffer && <span className="text-sm font-bold text-brand-gold">${leg.selectedOffer.price}</span>}
                <span className="text-xs text-text-faint">{leg.expanded ? '▲' : '▼'}</span>
              </div>
            </div>
          )}

          {/* Leg body — always open while uncommitted; committed legs keep
              the expanded toggle (the bar above). */}
          {(leg.expanded || !leg.committed) && (
            <div className="p-4 space-y-4">
              {/* Committed state */}
              {leg.committed ? (
                <div className="flex items-center justify-between">
                  <div className="text-sm">
                    <span className="font-medium">{leg.selectedOffer?.outbound?.carriers[0] || 'Flight'}</span>
                    <span className="text-text-faint ml-2">{leg.origin} → {leg.destination}</span>
                    <span className="ml-2 font-bold text-brand-gold">${leg.selectedOffer?.price}</span>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); onUncommitLeg(leg.id); }} className="text-xs text-text-faint hover:text-red-600">Remove</button>
                </div>
              ) : (
                <>
                  {/* LANDING-V5 (spec :101-124): the spec's card anatomy —
                      the caption bar tops the card ('TRAVEL / FLIGHT SEARCH —
                      LIVE PRICES VIA {vendor}' left · '▪ LIVE · SEARCHING IS
                      ALWAYS FREE' right, :101-104), then the SEGMENTED
                      hairline field bar (:105-124): mono micro-label over
                      mono value per cell, hairline-divided, gold mono SEARCH
                      at the right end. Same state, same handlers — chrome
                      only. The trip.com icon-input form factor (TravelField +
                      lucide) retired on this form; the vendor rides the
                      lane-proven providerLabel (PR-FL-6a no-drift). */}
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 font-mono text-xs lg:text-[10px] tracking-wider">
                    <span className="text-text-muted">TRAVEL / FLIGHT SEARCH — LIVE PRICES VIA {providerLabel.toUpperCase()}</span>
                    <span className="flex gap-4">
                      <span className="font-semibold text-brand-purple">▪ LIVE</span>
                      <span className="text-text-faint">SEARCHING IS ALWAYS FREE</span>
                    </span>
                  </div>
                  <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-white lg:flex-row lg:items-stretch lg:divide-x lg:divide-border">
                    <div className="px-4 py-2.5">
                      <div className="mb-1 font-mono text-xs lg:text-[9.5px] tracking-widest text-text-faint">FROM</div>
                      <input type="text" value={leg.origin} onChange={e => onUpdateLeg(leg.id, { origin: e.target.value.toUpperCase() })}
                        className="w-full border-0 bg-transparent px-0 py-2.5 lg:py-0 font-mono text-[13px] uppercase text-brand-purple placeholder-text-faint focus:outline-none lg:w-20" maxLength={3} placeholder="LAX" />
                    </div>
                    <div className="px-4 py-2.5">
                      <div className="mb-1 font-mono text-xs lg:text-[9.5px] tracking-widest text-text-faint">TO</div>
                      <input type="text" value={leg.destination} onChange={e => onUpdateLeg(leg.id, { destination: e.target.value.toUpperCase() })}
                        className="w-full border-0 bg-transparent px-0 py-2.5 lg:py-0 font-mono text-[13px] uppercase text-brand-purple placeholder-text-faint focus:outline-none lg:w-20" maxLength={3} placeholder="DPS" />
                    </div>
                    <div className="px-4 py-2.5">
                      <div className="mb-1 font-mono text-xs lg:text-[9.5px] tracking-widest text-text-faint">DEPART</div>
                      <input type="date" value={leg.departureDate} onChange={e => onUpdateLeg(leg.id, { departureDate: e.target.value })}
                        className="w-full border-0 bg-transparent px-0 py-2.5 lg:py-0 font-mono text-[13px] text-brand-purple focus:outline-none" />
                    </div>
                    {leg.tripType === 'roundtrip' && (
                      <div className="px-4 py-2.5">
                        <div className="mb-1 font-mono text-xs lg:text-[9.5px] tracking-widest text-text-faint">RETURN</div>
                        <input type="date" value={leg.returnDate} onChange={e => onUpdateLeg(leg.id, { returnDate: e.target.value })}
                          className="w-full border-0 bg-transparent px-0 py-2.5 lg:py-0 font-mono text-[13px] text-brand-purple focus:outline-none" />
                      </div>
                    )}
                    <div className="px-4 py-2.5">
                      <div className="mb-1 font-mono text-xs lg:text-[9.5px] tracking-widest text-text-faint">TRIP</div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => onUpdateLeg(leg.id, { tripType: 'roundtrip' })}
                          className={`py-3.5 lg:py-0 font-mono text-xs lg:text-[11px] transition-colors ${leg.tripType === 'roundtrip' ? 'font-semibold text-brand-purple' : 'text-text-faint hover:text-text-secondary'}`}>
                          ROUND-TRIP
                        </button>
                        <span className="text-text-faint" aria-hidden="true">·</span>
                        <button onClick={() => onUpdateLeg(leg.id, { tripType: 'oneway' })}
                          className={`py-3.5 lg:py-0 font-mono text-xs lg:text-[11px] transition-colors ${leg.tripType === 'oneway' ? 'font-semibold text-brand-purple' : 'text-text-faint hover:text-text-secondary'}`}>
                          ONE-WAY
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-1 items-center justify-end gap-2 px-3 py-2.5">
                      {legs.length > 1 && !leg.committed && (
                        <button onClick={() => onRemoveLeg(leg.id)} className="px-2 py-1.5 text-xs text-text-faint hover:text-red-600">✕</button>
                      )}
                      {/* FLIGHT-01: the ONLY control that fires a search — a filter change never does.
                          The count beside it is how many metered searches this session has sent. */}
                      <SearchCount count={searchCount} />
                      <button onClick={() => onSearchLeg(leg.id)} disabled={leg.loading}
                        className="bg-brand-gold px-5 py-3.5 lg:py-2.5 font-mono text-xs lg:text-[10.5px] font-semibold tracking-widest text-white hover:bg-brand-gold/90 disabled:opacity-50">
                        {leg.loading ? 'SEARCHING…' : 'SEARCH'}
                      </button>
                    </div>
                  </div>

                  {/* FLIGHT-01 (2026-09-22): SORT AND FILTER, ON THE PAGE. Each control sets the
                      LEG's filters only; the vendor applies them on the next SEARCH press. A control
                      at "any" sends nothing, so the vendor's own default applies — the line beneath
                      says exactly what is asked and where the vendor's default stands. */}
                  <div className="space-y-1" data-flight-filters>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[11px] text-text-secondary">
                      <label className="flex items-center gap-1.5">
                        <span className="text-text-faint uppercase tracking-wider text-[9.5px]">Cabin</span>
                        <select value={leg.filters.cabin} onChange={e => setFilters(leg, { cabin: e.target.value as FlightUiFilters['cabin'] })}
                          data-flight-filter="cabin" className="rounded border border-border bg-white px-1.5 py-1 text-[11px] text-text-primary">
                          {CABIN_OPTIONS.map(c => <option key={c} value={c}>{c === 'any' ? 'any' : CABIN_LABEL[c]}</option>)}
                        </select>
                      </label>
                      <label className="flex items-center gap-1.5">
                        <span className="text-text-faint uppercase tracking-wider text-[9.5px]">Stops</span>
                        <select value={leg.filters.stops} onChange={e => setFilters(leg, { stops: e.target.value as FlightUiFilters['stops'] })}
                          data-flight-filter="stops" className="rounded border border-border bg-white px-1.5 py-1 text-[11px] text-text-primary">
                          {STOPS_OPTIONS.map(o => <option key={o} value={o}>{o === 'any' ? 'any' : o === 'nonstop' ? 'nonstop' : '≤ 1 stop'}</option>)}
                        </select>
                      </label>
                      <label className="flex items-center gap-1.5">
                        <input type="checkbox" checked={leg.filters.refundableOnly} onChange={e => setFilters(leg, { refundableOnly: e.target.checked })} data-flight-filter="refundableOnly" />
                        <span>refundable only</span>
                      </label>
                      <label className="flex items-center gap-1.5">
                        <input type="checkbox" checked={leg.filters.checkedBag} onChange={e => setFilters(leg, { checkedBag: e.target.checked })} data-flight-filter="checkedBag" />
                        <span>checked bag included</span>
                      </label>
                      <label className="flex items-center gap-1.5">
                        <span className="text-text-faint uppercase tracking-wider text-[9.5px]">Departure</span>
                        <select value={leg.filters.departure} onChange={e => setFilters(leg, { departure: e.target.value as FlightUiFilters['departure'] })}
                          data-flight-filter="departure" className="rounded border border-border bg-white px-1.5 py-1 text-[11px] text-text-primary">
                          {DEPARTURE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </label>
                      <label className="flex items-center gap-1.5">
                        <span className="text-text-faint uppercase tracking-wider text-[9.5px]">Sort</span>
                        <select value={leg.filters.sort} onChange={e => setFilters(leg, { sort: e.target.value as FlightUiFilters['sort'] })}
                          data-flight-filter="sort" className="rounded border border-border bg-white px-1.5 py-1 text-[11px] text-text-primary">
                          {SORT_OPTIONS.map(o => <option key={o} value={o}>{o === 'vendor' ? "the vendor's order" : o}</option>)}
                        </select>
                      </label>
                    </div>
                    <div className="font-mono text-[10px] text-text-faint" data-flight-filters-stated>
                      Asked on the next search: {filtersStatement(leg.filters)}
                    </div>
                  </div>

                  {leg.error && (
                    <div className="p-2 bg-white border border-border rounded text-brand-red text-xs">{leg.error}</div>
                  )}

                  {/* Manual entry (booked elsewhere) — PR-Travel-Cleanup: the Google
                      Flights / Kayak competitor links are removed everywhere; the whole
                      block is hidden on the public home (enableManualEntry={false}), kept
                      on the authed in-trip picker. */}
                  {enableManualEntry && (
                  <div className="p-3 bg-bg-row border border-border rounded">
                    <div className="mb-2">
                      <div className="text-xs text-text-secondary font-medium">
                        {leg.offers.length === 0 && !leg.loading ? 'Enter flight details manually:' : 'Or enter manually (booked elsewhere):'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <input type="text" value={leg.manualAirline} onChange={e => onUpdateLeg(leg.id, { manualAirline: e.target.value })}
                        placeholder="Airline" className="flex-1 min-w-[100px] bg-bg-row border border-border text-text-primary rounded px-2 py-1.5 text-xs" />
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-text-faint">$</span>
                        <input type="number" value={leg.manualPrice} onChange={e => onUpdateLeg(leg.id, { manualPrice: e.target.value })}
                          placeholder="Price" className="w-24 bg-bg-row border border-border text-text-primary rounded px-2 py-1.5 text-xs" />
                      </div>
                      <input type="time" value={leg.manualDepartTime} onChange={e => onUpdateLeg(leg.id, { manualDepartTime: e.target.value })}
                        className="w-[100px] bg-bg-row border border-border text-text-primary rounded px-2 py-1.5 text-xs" title="Departure time" placeholder="Depart" />
                      <input type="time" value={leg.manualArriveTime} onChange={e => onUpdateLeg(leg.id, { manualArriveTime: e.target.value })}
                        className="w-[100px] bg-bg-row border border-border text-text-primary rounded px-2 py-1.5 text-xs" title="Arrival time" placeholder="Arrive" />
                      <input type="date" value={leg.manualArriveDate} onChange={e => onUpdateLeg(leg.id, { manualArriveDate: e.target.value })}
                        min={leg.departureDate}
                        className="w-[130px] bg-bg-row border border-border text-text-primary rounded px-2 py-1.5 text-xs" title="Arrival date (if next day)" />
                      <button onClick={() => onSubmitManual?.(leg.id)} disabled={!leg.manualPrice}
                        className="px-3 py-1.5 bg-brand-green text-white text-xs rounded hover:opacity-90 disabled:opacity-50">
                        Use This
                      </button>
                    </div>
                  </div>
                  )}

                  {/* Search results */}
                  {leg.loading ? (
                    <div className="py-6 text-center">
                      <div className="animate-spin inline-block w-6 h-6 border-3 border-brand-purple border-t-transparent rounded-full mb-1"></div>
                      <div className="text-xs text-text-faint">Searching 300+ airlines via {providerLabel}...</div>
                    </div>
                  ) : leg.offers.length > 0 ? (() => {
                    // FLIGHT-01 (2026-09-22): ONE FLIGHT, ITS FARES. The vendor's rows are grouped
                    // by the flight's identity (src/lib/flights/fares.ts) — one row per flight,
                    // its fares beneath it, the cheapest as the headline — and the lowest fare
                    // meeting the filters stands above them as the benchmark.
                    const groups = groupFlights(leg.offers);
                    const low = lowestFare(groups);
                    const llf = lowestFareLine(low);
                    const isOpen = (key: string) => openRows[`${leg.id}:${key}`] === true;
                    return (
                    <div className="space-y-2" data-flight-results>
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs text-text-faint">
                        <span data-flight-count>{countLine(groups)} — click a flight for its fares</span>
                      </div>
                      {llf && (
                        <div className="rounded border border-border bg-bg-row px-3 py-2 font-mono text-[11px] text-text-primary" data-flight-llf>
                          {llf}
                        </div>
                      )}
                      {/* TRAVEL-RESULTS-TABLE (spec design-refs/landing-direction-c
                          .dc.html:100-170 — the 01-demo table anatomy): mono
                          column headers on bg-bg-row, hairline rows, zebra, wash
                          hover; fares gold right-mono. The caption names the
                          lane-proven vendor (providerLabel, PR-FL-6a — the same
                          no-drift rail as the two brand strings). VIA renders the
                          REAL field (stops via formatStops) — the offer shape
                          carries no connecting-airport code (FlightOffer :27-58).
                          Round trips stack the return leg as the faint second
                          line of each cell (field parity with the old two-block
                          card). Selection: the row's onClick is the SAME
                          setter; selected = border-l-2 border-brand-purple +
                          bg-brand-purple-wash/40. */}
                      {/* LANDING-V5: the caption bar moved to the card top
                          (spec :101 — one caption per card); the table
                          renders beneath it uncaptioned. */}
                      <div className="overflow-x-auto rounded-lg border border-border bg-white">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border bg-bg-row text-left">
                              <th className={`px-3 py-2 font-semibold ${DATA.columnHeader}`}>Flight</th>
                              <th className={`px-3 py-2 font-semibold ${DATA.columnHeader}`}>Dep</th>
                              <th className={`px-3 py-2 font-semibold ${DATA.columnHeader}`}>Arr</th>
                              <th className={`px-3 py-2 font-semibold ${DATA.columnHeader}`}>Via</th>
                              <th className={`px-3 py-2 font-semibold ${DATA.columnHeader}`}>Duration</th>
                              <th className={`px-3 py-2 text-right font-semibold ${DATA.columnHeader}`}>From</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {groups.map(group => {
                              const rep = group.representative;
                              const outSegs = rep.outboundSegments ?? [];
                              const first = outSegs[0];
                              const last = outSegs[outSegs.length - 1];
                              const carrier = carrierLineOf(first);
                              const numbers = outSegs.map(sg => [sg.marketingCode, sg.marketingNumber].filter(Boolean).join(' ')).filter(Boolean).join(' · ');
                              const via = outSegs.length > 1 ? outSegs.slice(0, -1).map(sg => sg.destinationCode).filter(Boolean).join(', ') : '';
                              const holdsSelected = !!leg.selectedOffer && group.fares.some(f => f.id === leg.selectedOffer!.id);
                              const open = isOpen(group.key) || holdsSelected;
                              const rows = [
                                <tr key={group.key}
                                  data-flight-row={group.key}
                                  data-fare-count={group.fares.length}
                                  onClick={() => setOpenRows(prev => ({ ...prev, [`${leg.id}:${group.key}`]: !isOpen(group.key) }))}
                                  className={`cursor-pointer transition-colors ${holdsSelected ? 'bg-brand-purple-wash/40' : 'odd:bg-bg-row hover:bg-brand-purple-wash/40'}`}>
                                  <td className={`border-l-2 px-3 py-2.5 ${holdsSelected ? 'border-brand-purple' : 'border-transparent'}`}>
                                    <div className="text-sm font-medium text-brand-purple" data-flight-carrier>{carrier.name}</div>
                                    {carrier.operatedBy && (
                                      <div className="text-[10px] text-text-secondary" data-flight-operated-by>operated by {carrier.operatedBy}</div>
                                    )}
                                    {numbers && <div className="font-mono text-[10px] text-text-faint" data-flight-numbers>{numbers}</div>}
                                    {(rep.outbound?.carriers.length ?? 0) > 1 && (
                                      <div className="text-[10px] text-text-faint">{rep.outbound?.carriers.slice(1).join(', ')}</div>
                                    )}
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2.5">
                                    <div className="font-bold text-sm text-text-primary">{rep.outbound?.departure.localTime}</div>
                                    <div className="text-[10px] text-text-faint" data-flight-origin>{first?.originCode ?? rep.outbound?.departure.airport}{first?.originName ? ` · ${first.originName}` : ''}</div>
                                    {rep.return && (
                                      <div className="mt-1 text-[10px] text-text-faint">{rep.return.departure.localTime} {rep.return.departure.airport}</div>
                                    )}
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2.5">
                                    <div className="font-bold text-sm text-text-primary">{rep.outbound?.arrival.localTime}</div>
                                    <div className="text-[10px] text-text-faint" data-flight-destination>{last?.destinationCode ?? rep.outbound?.arrival.airport}{last?.destinationName ? ` · ${last.destinationName}` : ''}</div>
                                    {rep.return && (
                                      <div className="mt-1 text-[10px] text-text-faint">{rep.return.arrival.localTime} {rep.return.arrival.airport}</div>
                                    )}
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2.5">
                                    <div className="text-xs text-text-secondary">{formatStops(rep.outbound?.stops || 0)}{via ? ` via ${via}` : ''}</div>
                                    {rep.return && (
                                      <div className="mt-1 text-[10px] text-text-faint">{formatStops(rep.return.stops)}</div>
                                    )}
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2.5">
                                    <div className="text-xs text-text-secondary">{rep.outbound?.duration}</div>
                                    {rep.return && (
                                      <div className="mt-1 text-[10px] text-text-faint">{rep.return.duration}</div>
                                    )}
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2.5 text-right">
                                    <div className="font-mono text-sm font-semibold text-brand-gold" data-flight-headline>{money(group.cheapest.price, group.cheapest.currency)}</div>
                                    <div className="text-[10px] text-text-faint">{group.fares.length} fare{group.fares.length === 1 ? '' : 's'} · per person {open ? '▲' : '▼'}</div>
                                  </td>
                                </tr>,
                              ];
                              if (open) {
                                rows.push(
                                  <tr key={`${group.key}:fares`} className="bg-white">
                                    <td colSpan={6} className="px-3 pb-3 pt-1">
                                      {/* A FARE SAYS WHAT IT BUYS: each option shows its price, cabin, checked bag,
                                          carry-on, changes and refunds — every value the payload carried, and
                                          "not stated by the carrier" where it carried none. Never inferred. */}
                                      <table className="w-full text-xs" data-fare-options={group.key}>
                                        <thead>
                                          <tr className="text-left">
                                            <th className={`px-2 py-1 ${DATA.columnHeader}`}>Fare</th>
                                            <th className={`px-2 py-1 ${DATA.columnHeader}`}>Cabin</th>
                                            <th className={`px-2 py-1 ${DATA.columnHeader}`}>Checked bag</th>
                                            <th className={`px-2 py-1 ${DATA.columnHeader}`}>Carry-on</th>
                                            <th className={`px-2 py-1 ${DATA.columnHeader}`}>Changes</th>
                                            <th className={`px-2 py-1 ${DATA.columnHeader}`}>Refunds</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                          {group.fares.map(fare => {
                                            const selected = leg.selectedOffer?.id === fare.id;
                                            const f = fare.fare;
                                            const label = [f?.fareFamily, f?.fareBasisCode].filter(Boolean).join(' · ');
                                            return (
                                              <tr key={fare.id}
                                                data-fare-row={fare.id}
                                                onClick={(e) => { e.stopPropagation(); onUpdateLeg(leg.id, { selectedOffer: fare }); }}
                                                className={`cursor-pointer transition-colors ${selected ? 'bg-brand-purple-wash/40' : 'hover:bg-brand-purple-wash/40'}`}>
                                                <td className={`border-l-2 px-2 py-1.5 ${selected ? 'border-brand-purple' : 'border-transparent'}`}>
                                                  <div className="font-mono font-semibold text-brand-gold" data-fare-field="price">{money(fare.price, fare.currency)}</div>
                                                  {label && <div className="text-[10px] text-text-faint" data-fare-field="family">{label}</div>}
                                                </td>
                                                <td className="px-2 py-1.5 text-text-secondary" data-fare-field="cabin">{f?.cabin ?? NOT_STATED}</td>
                                                <td className="px-2 py-1.5 text-text-secondary" data-fare-field="checkedBag">{statedText(f?.checkedBag, f?.checkedBagDetail ?? 'included', 'not included')}</td>
                                                <td className="px-2 py-1.5 text-text-secondary" data-fare-field="carryOnBag">{statedText(f?.carryOnBag, f?.carryOnDetail ?? 'included', 'not included')}</td>
                                                <td className="px-2 py-1.5 text-text-secondary" data-fare-field="changeable">{statedText(f?.changeable, f?.changeFee ? `changeable (${f.changeFee})` : 'changeable', 'not changeable')}</td>
                                                <td className="px-2 py-1.5 text-text-secondary" data-fare-field="refundable">{statedText(f?.refundable, f?.refundFee ? `refundable (${f.refundFee})` : 'refundable', 'non-refundable')}</td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </td>
                                  </tr>,
                                );
                              }
                              return rows;
                            })}
                          </tbody>
                        </table>
                      </div>
                      <div className="text-[10px] text-text-faint text-center pt-1">Powered by {providerLabel} &middot; Prices include all taxes &amp; fees</div>
                    </div>
                    );
                  })() : null}

                  {/* Selected offer → Save button */}
                  {leg.selectedOffer && !leg.committed && (
                    <div className="flex items-center justify-between p-3 bg-bg-row border border-border rounded">
                      <div className="text-sm">
                        <span className="font-medium">{carrierLineOf(leg.selectedOffer.outboundSegments?.[0]).name !== 'Flight' ? carrierLineOf(leg.selectedOffer.outboundSegments?.[0]).name : (leg.selectedOffer.outbound?.carriers[0] || 'Flight')}</span>
                        <span className="text-text-faint ml-2">{leg.origin} → {leg.destination}</span>
                        {leg.selectedOffer.outbound?.duration && <span className="text-text-faint ml-2">{leg.selectedOffer.outbound.duration}</span>}
                        <span className="ml-2 font-bold text-brand-gold">${leg.selectedOffer.price}</span>
                        {/* FLIGHT-01: THE BENCHMARK — the selection against the lowest fare meeting the
                            filters, explained from the two fares' STATED attributes; an unstated one
                            is named as unstated, never inferred from the price. */}
                        {(() => {
                          const low = leg.offers.length > 0 ? lowestFare(groupFlights(leg.offers)) : null;
                          if (!low) return null;
                          const diff = fareDifference(leg.selectedOffer!, low.fare);
                          return <div className="mt-1 font-mono text-[11px] text-text-secondary" data-fare-difference={diff.delta}>{diff.line}</div>;
                        })()}
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => onUpdateLeg(leg.id, { selectedOffer: null })} className="px-2 py-1 text-xs border border-border text-text-secondary rounded hover:bg-bg-row">Clear</button>
                        <button onClick={() => onCommitLeg(leg.id)} disabled={committing === leg.id}
                          className="px-3 py-1.5 text-xs font-semibold rounded border border-brand-purple bg-white text-brand-purple transition-colors hover:bg-bg-row disabled:opacity-50">
                          {committing === leg.id ? 'Saving…' : 'Save to trip'}
                        </button>
                        {/* Book = pay now (primary, solid), alongside Save to trip = plan it.
                            Real provider offers only (not manual entries). Guest-ok. */}
                        {onBookLeg && !leg.selectedOffer.isManual && (
                          <button onClick={() => onBookLeg(leg.id)}
                            className="px-3 py-1.5 text-xs font-semibold rounded bg-brand-gold text-white transition-colors hover:bg-brand-gold/90">
                            Book
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Add another leg — COMPACT-1: a small inline control, not a full-width banner. */}
      <button onClick={onAddLeg}
        className="rounded border border-border px-3 py-3 lg:px-2 lg:py-1 font-mono text-xs lg:text-[10px] font-semibold uppercase tracking-wider text-text-faint transition-colors hover:bg-bg-row hover:text-text-primary">
        + Leg
      </button>

      {!liveSearchEnabled && (
        <div className="text-[10px] text-text-faint text-center">
          Note: live flight search is off on this surface. Manual entry always works.
        </div>
      )}
    </div>
  );
}
