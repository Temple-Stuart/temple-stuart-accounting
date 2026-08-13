'use client';

// PR-STRIP-DESIGN-2: presentational-only imports (icon-inside-field) — no
// data, no network; the pure-view contract below holds.
import { Plane, Calendar } from 'lucide-react';
import { TravelField } from './travelSection';
// TRAVEL-RESULTS-TABLE: the results wear the deck-table anatomy — the
// DATA.columnHeader micro-label is the one shared class string (ds.ts:225).
import { DATA } from '@/lib/ds';

/**
 * FlightPickerView — the PURE, props-only render of the flight picker.
 *
 * Extracted from FlightPicker (T1). It owns NO data and NO network: no fetch, no
 * API call, no data-loading effect, no context, no server import, and it does NOT
 * import the Duffel lib or name any /api or /air route. It is FULLY CONTROLLED —
 * the `legs` array (search offers + committed flights), the `committing` flag and
 * `liveSearchEnabled` arrive as props, and EVERY action — search, select, manual
 * entry, and the BOOK/commit + uncommit — arrives as a callback the container
 * owns. The view just calls `onSearchLeg`/`onCommitLeg`/…; the container is the
 * only place the paid Duffel search or any order can fire. The rendered markup is
 * byte-for-byte equivalent to the pre-extraction FlightPicker output.
 *
 * NOTE: the two "Duffel" strings below ("Searching … via Duffel", "Powered by
 * Duffel") and the "DUFFEL_API_TOKEN" note are byte-for-byte UI brand labels, not
 * code references — this view imports nothing from the Duffel lib and fetches
 * nothing.
 */

export interface FlightOffer {
  id: string;
  price: number;
  currency: string;
  outbound: {
    // PR-tz-0b: timeZone = the airport's IANA zone (Duffel Airport.time_zone). Captured +
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
  conditions?: {
    refundable: boolean;
    changeable: boolean;
  };
  isManual?: boolean;
  /** BOOK-1: Duffel's offer TTL (parseOffer sends it; duffel.ts:478) — the
   *  Book pre-check routes already-dead offers to re-search, never a doomed
   *  checkout. Optional: absent on manual offers. */
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
  /** Triggers the PAID Duffel search (container-owned). */
  onSearchLeg: (legId: string) => void;
  /** Optional — only needed when the manual-entry block is shown (see enableManualEntry). */
  onSubmitManual?: (legId: string) => void;
  /** The "Save to trip" action (container-owned). */
  onCommitLeg: (legId: string) => void;
  onUncommitLeg: (legId: string) => void;
  /** PR-Duffel-Pay-3: "Book" (pay now) — opens the FlightCheckoutPanel for the leg's
   *  selected offer (container-owned). Optional: only shown when wired (the public flight
   *  search passes it). Guest-ok, mirroring the hotel Book. */
  onBookLeg?: (legId: string) => void;
  /** PR-Travel-Cleanup: show the manual "enter flight details" block (Airline/Price/times
   *  + "Use This"). Default true (the authed in-trip picker keeps it for "booked
   *  elsewhere"). The public home flight search passes false — guests use Duffel only. */
  enableManualEntry?: boolean;
  /** PR-FL-6a: the provider name rendered in the two brand strings ("Searching …
   *  via X", "Powered by X"). Defaults to 'Duffel' — every existing mount renders
   *  byte-identical output. The lane-flagged search passes 'LiteAPI' so the label
   *  never lies about whose fares these are (no-drift). */
  providerLabel?: string;
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
  providerLabel = 'Duffel',
}: FlightPickerViewProps) {
  const totalCommitted = legs.filter(l => l.committed).reduce((s, l) => s + (l.selectedOffer?.price || 0), 0);

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
        <div key={leg.id} className="bg-bg-row border border-border rounded overflow-hidden">
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
                  {/* Search form — PR-STRIP-DESIGN-1: the segmented bar. ONE
                      row at desktop (FROM | ⇄ | TO | dates | trip-type |
                      Search — the Kayak form factor), stacking cleanly on
                      mobile. Existing field vocabulary only (the
                      TRAVEL_INPUT_CLASS bg-bg-row border-border text-sm
                      py-2 scale); same handlers, same state — chrome only.
                      The 🔍 emoji left the Search button (clean chrome). */}
                  <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-end lg:gap-3">
                    <div className="flex items-end gap-2">
                      <div className="flex-1 lg:flex-none">
                        <label className="block mb-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-text-faint">From</label>
                        <TravelField icon={<Plane className="h-4 w-4" strokeWidth={1.75} />}>
                          <input type="text" value={leg.origin} onChange={e => onUpdateLeg(leg.id, { origin: e.target.value.toUpperCase() })}
                            className="w-full lg:w-28 pl-9 pr-2 py-3 border border-border bg-bg-row text-text-primary placeholder-text-faint rounded-lg text-sm font-mono text-center" maxLength={3} placeholder="LAX" />
                        </TravelField>
                      </div>
                      <span className="pb-2.5 text-text-faint" aria-hidden="true">⇄</span>
                      <div className="flex-1 lg:flex-none">
                        <label className="block mb-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-text-faint">To</label>
                        <TravelField icon={<Plane className="h-4 w-4" strokeWidth={1.75} />}>
                          <input type="text" value={leg.destination} onChange={e => onUpdateLeg(leg.id, { destination: e.target.value.toUpperCase() })}
                            className="w-full lg:w-28 pl-9 pr-2 py-3 border border-border bg-bg-row text-text-primary placeholder-text-faint rounded-lg text-sm font-mono text-center" maxLength={3} placeholder="DPS" />
                        </TravelField>
                      </div>
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="flex-1 lg:flex-none">
                        <label className="block mb-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-text-faint">Depart</label>
                        <TravelField icon={<Calendar className="h-4 w-4" strokeWidth={1.75} />}>
                          <input type="date" value={leg.departureDate} onChange={e => onUpdateLeg(leg.id, { departureDate: e.target.value })}
                            className="w-full pl-9 pr-2 py-3 border border-border bg-bg-row text-text-primary rounded-lg text-sm" />
                        </TravelField>
                      </div>
                      {leg.tripType === 'roundtrip' && (
                        <div className="flex-1 lg:flex-none">
                          <label className="block mb-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-text-faint">Return</label>
                          <TravelField icon={<Calendar className="h-4 w-4" strokeWidth={1.75} />}>
                            <input type="date" value={leg.returnDate} onChange={e => onUpdateLeg(leg.id, { returnDate: e.target.value })}
                              className="w-full pl-9 pr-2 py-3 border border-border bg-bg-row text-text-primary rounded-lg text-sm" />
                          </TravelField>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 self-start bg-bg-row rounded p-0.5 lg:self-auto">
                      <button onClick={() => onUpdateLeg(leg.id, { tripType: 'roundtrip' })}
                        className={`px-2 py-1 text-xs rounded transition-colors ${leg.tripType === 'roundtrip' ? 'bg-white shadow text-brand-purple font-medium' : 'text-text-secondary'}`}>
                        Round-trip
                      </button>
                      <button onClick={() => onUpdateLeg(leg.id, { tripType: 'oneway' })}
                        className={`px-2 py-1 text-xs rounded transition-colors ${leg.tripType === 'oneway' ? 'bg-white shadow text-brand-purple font-medium' : 'text-text-secondary'}`}>
                        One-way
                      </button>
                    </div>
                    <button onClick={() => onSearchLeg(leg.id)} disabled={leg.loading}
                      className="w-full lg:w-auto px-8 py-3 bg-brand-gold text-white text-sm font-medium rounded-lg hover:bg-brand-gold/90 disabled:opacity-50">
                      {leg.loading ? 'Searching...' : 'Search'}
                    </button>
                    {legs.length > 1 && !leg.committed && (
                      <button onClick={() => onRemoveLeg(leg.id)} className="px-2 py-1.5 text-xs text-text-faint hover:text-red-600">✕</button>
                    )}
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
                  ) : leg.offers.length > 0 ? (
                    <div className="space-y-2">
                      <div className="text-xs text-text-faint">{leg.offers.length} flights found — click to select:</div>
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
                      <div className="font-mono text-[10px] tracking-wider text-text-faint">
                        TRAVEL / FLIGHT SEARCH — LIVE PRICES VIA {providerLabel.toUpperCase()}
                      </div>
                      <div className="overflow-x-auto rounded-lg border border-border bg-white">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border bg-bg-row text-left">
                              <th className={`px-3 py-2 font-semibold ${DATA.columnHeader}`}>Carrier</th>
                              <th className={`px-3 py-2 font-semibold ${DATA.columnHeader}`}>Dep</th>
                              <th className={`px-3 py-2 font-semibold ${DATA.columnHeader}`}>Arr</th>
                              <th className={`px-3 py-2 font-semibold ${DATA.columnHeader}`}>Via</th>
                              <th className={`px-3 py-2 font-semibold ${DATA.columnHeader}`}>Duration</th>
                              <th className={`px-3 py-2 text-right font-semibold ${DATA.columnHeader}`}>Fare</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {leg.offers.map(offer => {
                              const selected = leg.selectedOffer?.id === offer.id;
                              return (
                                <tr key={offer.id}
                                  onClick={() => onUpdateLeg(leg.id, { selectedOffer: offer })}
                                  className={`cursor-pointer transition-colors ${
                                    selected ? 'bg-brand-purple-wash/40' : 'odd:bg-bg-row hover:bg-brand-purple-wash/40'
                                  }`}>
                                  <td className={`border-l-2 px-3 py-2.5 ${selected ? 'border-brand-purple' : 'border-transparent'}`}>
                                    <div className="text-sm font-medium text-brand-purple">{offer.outbound?.carriers[0] || 'Flight'}</div>
                                    {(offer.outbound?.carriers.length ?? 0) > 1 && (
                                      <div className="text-[10px] text-text-faint">{offer.outbound?.carriers.slice(1).join(', ')}</div>
                                    )}
                                    {offer.conditions?.refundable && <div className="text-[10px] text-brand-green">Refundable</div>}
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2.5">
                                    <div className="font-bold text-sm text-text-primary">{offer.outbound?.departure.localTime}</div>
                                    <div className="text-[10px] text-text-faint">{offer.outbound?.departure.airport}</div>
                                    {offer.return && (
                                      <div className="mt-1 text-[10px] text-text-faint">{offer.return.departure.localTime} {offer.return.departure.airport}</div>
                                    )}
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2.5">
                                    <div className="font-bold text-sm text-text-primary">{offer.outbound?.arrival.localTime}</div>
                                    <div className="text-[10px] text-text-faint">{offer.outbound?.arrival.airport}</div>
                                    {offer.return && (
                                      <div className="mt-1 text-[10px] text-text-faint">{offer.return.arrival.localTime} {offer.return.arrival.airport}</div>
                                    )}
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2.5">
                                    <div className="text-xs text-text-secondary">{formatStops(offer.outbound?.stops || 0)}</div>
                                    {offer.return && (
                                      <div className="mt-1 text-[10px] text-text-faint">{formatStops(offer.return.stops)}</div>
                                    )}
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2.5">
                                    <div className="text-xs text-text-secondary">{offer.outbound?.duration}</div>
                                    {offer.return && (
                                      <div className="mt-1 text-[10px] text-text-faint">{offer.return.duration}</div>
                                    )}
                                  </td>
                                  <td className="whitespace-nowrap px-3 py-2.5 text-right">
                                    <div className="font-mono text-sm font-semibold text-brand-gold">${offer.price}</div>
                                    <div className="text-[10px] text-text-faint">per person</div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <div className="text-[10px] text-text-faint text-center pt-1">Powered by {providerLabel} &middot; Prices include all taxes &amp; fees</div>
                    </div>
                  ) : null}

                  {/* Selected offer → Save button */}
                  {leg.selectedOffer && !leg.committed && (
                    <div className="flex items-center justify-between p-3 bg-bg-row border border-border rounded">
                      <div className="text-sm">
                        <span className="font-medium">{leg.selectedOffer.outbound?.carriers[0] || 'Flight'}</span>
                        <span className="text-text-faint ml-2">{leg.origin} → {leg.destination}</span>
                        {leg.selectedOffer.outbound?.duration && <span className="text-text-faint ml-2">{leg.selectedOffer.outbound.duration}</span>}
                        <span className="ml-2 font-bold text-brand-gold">${leg.selectedOffer.price}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => onUpdateLeg(leg.id, { selectedOffer: null })} className="px-2 py-1 text-xs border border-border text-text-secondary rounded hover:bg-bg-row">Clear</button>
                        <button onClick={() => onCommitLeg(leg.id)} disabled={committing === leg.id}
                          className="px-3 py-1.5 text-xs font-semibold rounded border border-brand-purple bg-white text-brand-purple transition-colors hover:bg-bg-row disabled:opacity-50">
                          {committing === leg.id ? 'Saving…' : 'Save to trip'}
                        </button>
                        {/* PR-Duffel-Pay-3: Book = pay now (primary, solid), alongside Save to
                            trip = plan it. Real Duffel offers only (not manual entries). Guest-ok. */}
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
        className="rounded border border-border px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-text-faint transition-colors hover:bg-bg-row hover:text-text-primary">
        + Leg
      </button>

      {!liveSearchEnabled && (
        <div className="text-[10px] text-text-faint text-center">
          Note: DUFFEL_API_TOKEN must be set for live flight search. Manual entry always works.
        </div>
      )}
    </div>
  );
}
