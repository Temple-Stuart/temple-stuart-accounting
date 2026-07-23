'use client';

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
}: FlightPickerViewProps) {
  const totalCommitted = legs.filter(l => l.committed).reduce((s, l) => s + (l.selectedOffer?.price || 0), 0);

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      {totalCommitted > 0 && (
        <div className="flex items-center justify-between px-4 py-2 bg-emerald-50 border border-emerald-200 rounded text-sm">
          <span className="text-emerald-800 font-medium">
            {legs.filter(l => l.committed).length} flight{legs.filter(l => l.committed).length !== 1 ? 's' : ''} saved
          </span>
          <span className="font-bold text-emerald-700">${totalCommitted.toLocaleString()}</span>
        </div>
      )}

      {/* Flight legs */}
      {legs.map((leg, legIdx) => (
        <div key={leg.id} className="bg-white border border-border rounded overflow-hidden">
          {/* Leg header */}
          <div
            className="flex items-center justify-between px-4 py-3 bg-bg-row border-b border-border cursor-pointer hover:bg-gray-100 transition-colors"
            onClick={() => onUpdateLeg(leg.id, { expanded: !leg.expanded })}
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">✈️</span>
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
                  {legs.length > 1 && <span className="text-text-muted">Leg {legIdx + 1}:</span>}
                  {leg.origin || '???'} → {leg.destination || '???'}
                  {leg.committed && <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-medium rounded">Saved</span>}
                </div>
                <div className="text-xs text-text-muted">
                  {leg.departureDate}{leg.tripType === 'roundtrip' && leg.returnDate ? ` — ${leg.returnDate}` : ''} • {leg.tripType === 'roundtrip' ? 'Round-trip' : 'One-way'}
                  {leg.selectedOffer && !leg.committed && <span className="ml-2 text-brand-purple font-medium">${leg.selectedOffer.price} selected</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {leg.selectedOffer && <span className="text-sm font-bold text-brand-green">${leg.selectedOffer.price}</span>}
              <span className="text-xs text-text-muted">{leg.expanded ? '▲' : '▼'}</span>
            </div>
          </div>

          {/* Leg body */}
          {leg.expanded && (
            <div className="p-4 space-y-4">
              {/* Committed state */}
              {leg.committed ? (
                <div className="flex items-center justify-between">
                  <div className="text-sm">
                    <span className="font-medium">{leg.selectedOffer?.outbound?.carriers[0] || 'Flight'}</span>
                    <span className="text-text-muted ml-2">{leg.origin} → {leg.destination}</span>
                    <span className="ml-2 font-bold text-brand-green">${leg.selectedOffer?.price}</span>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); onUncommitLeg(leg.id); }} className="text-xs text-text-muted hover:text-red-600">Remove</button>
                </div>
              ) : (
                <>
                  {/* Search form */}
                  <div className="flex flex-wrap items-end gap-3">
                    <div>
                      <label className="text-[10px] text-text-muted block mb-0.5">From</label>
                      <input type="text" value={leg.origin} onChange={e => onUpdateLeg(leg.id, { origin: e.target.value.toUpperCase() })}
                        className="w-16 px-2 py-1.5 border border-border rounded text-xs font-mono text-center" maxLength={3} placeholder="LAX" />
                    </div>
                    <span className="text-text-muted pb-1.5">→</span>
                    <div>
                      <label className="text-[10px] text-text-muted block mb-0.5">To</label>
                      <input type="text" value={leg.destination} onChange={e => onUpdateLeg(leg.id, { destination: e.target.value.toUpperCase() })}
                        className="w-16 px-2 py-1.5 border border-border rounded text-xs font-mono text-center" maxLength={3} placeholder="DPS" />
                    </div>
                    <div>
                      <label className="text-[10px] text-text-muted block mb-0.5">Depart</label>
                      <input type="date" value={leg.departureDate} onChange={e => onUpdateLeg(leg.id, { departureDate: e.target.value })}
                        className="px-2 py-1.5 border border-border rounded text-xs" />
                    </div>
                    {leg.tripType === 'roundtrip' && (
                      <div>
                        <label className="text-[10px] text-text-muted block mb-0.5">Return</label>
                        <input type="date" value={leg.returnDate} onChange={e => onUpdateLeg(leg.id, { returnDate: e.target.value })}
                          className="px-2 py-1.5 border border-border rounded text-xs" />
                      </div>
                    )}
                    <div className="flex items-center gap-1 bg-bg-row rounded p-0.5">
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
                      className="px-3 py-1.5 bg-brand-purple text-white text-xs rounded hover:opacity-90 disabled:opacity-50">
                      {leg.loading ? 'Searching...' : '🔍 Search'}
                    </button>
                    {legs.length > 1 && !leg.committed && (
                      <button onClick={() => onRemoveLeg(leg.id)} className="px-2 py-1.5 text-xs text-text-muted hover:text-red-600">✕</button>
                    )}
                  </div>

                  {leg.error && (
                    <div className="p-2 bg-red-50 border border-red-200 rounded text-red-600 text-xs">{leg.error}</div>
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
                        placeholder="Airline" className="flex-1 min-w-[100px] bg-white border border-border rounded px-2 py-1.5 text-xs" />
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-text-muted">$</span>
                        <input type="number" value={leg.manualPrice} onChange={e => onUpdateLeg(leg.id, { manualPrice: e.target.value })}
                          placeholder="Price" className="w-24 bg-white border border-border rounded px-2 py-1.5 text-xs" />
                      </div>
                      <input type="time" value={leg.manualDepartTime} onChange={e => onUpdateLeg(leg.id, { manualDepartTime: e.target.value })}
                        className="w-[100px] bg-white border border-border rounded px-2 py-1.5 text-xs" title="Departure time" placeholder="Depart" />
                      <input type="time" value={leg.manualArriveTime} onChange={e => onUpdateLeg(leg.id, { manualArriveTime: e.target.value })}
                        className="w-[100px] bg-white border border-border rounded px-2 py-1.5 text-xs" title="Arrival time" placeholder="Arrive" />
                      <input type="date" value={leg.manualArriveDate} onChange={e => onUpdateLeg(leg.id, { manualArriveDate: e.target.value })}
                        min={leg.departureDate}
                        className="w-[130px] bg-white border border-border rounded px-2 py-1.5 text-xs" title="Arrival date (if next day)" />
                      <button onClick={() => onSubmitManual?.(leg.id)} disabled={!leg.manualPrice}
                        className="px-3 py-1.5 bg-emerald-600 text-white text-xs rounded hover:bg-emerald-700 disabled:opacity-50">
                        Use This
                      </button>
                    </div>
                  </div>
                  )}

                  {/* Search results */}
                  {leg.loading ? (
                    <div className="py-6 text-center">
                      <div className="animate-spin inline-block w-6 h-6 border-3 border-brand-purple border-t-transparent rounded-full mb-1"></div>
                      <div className="text-xs text-text-muted">Searching 300+ airlines via Duffel...</div>
                    </div>
                  ) : leg.offers.length > 0 ? (
                    <div className="space-y-2">
                      <div className="text-xs text-text-muted">{leg.offers.length} flights found — click to select:</div>
                      {leg.offers.map(offer => (
                        <div key={offer.id}
                          onClick={() => onUpdateLeg(leg.id, { selectedOffer: offer })}
                          className={`p-3 border rounded cursor-pointer transition-all ${
                            leg.selectedOffer?.id === offer.id ? 'border-brand-purple bg-brand-purple-wash' : 'border-border hover:bg-bg-row'
                          }`}>
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-4">
                                <div className="text-center">
                                  <div className="font-bold text-sm text-text-primary">{offer.outbound?.departure.localTime}</div>
                                  <div className="text-[10px] text-text-muted">{offer.outbound?.departure.airport}</div>
                                </div>
                                <div className="flex-1 text-center">
                                  <div className="text-[10px] text-text-faint">{offer.outbound?.duration}</div>
                                  <div className="relative"><div className="border-t border-border my-1"></div>
                                    {(offer.outbound?.stops || 0) > 0 && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-text-faint rounded-full"></div>}
                                  </div>
                                  <div className="text-[10px] text-text-muted">{formatStops(offer.outbound?.stops || 0)}</div>
                                </div>
                                <div className="text-center">
                                  <div className="font-bold text-sm text-text-primary">{offer.outbound?.arrival.localTime}</div>
                                  <div className="text-[10px] text-text-muted">{offer.outbound?.arrival.airport}</div>
                                </div>
                              </div>
                              <div className="mt-0.5 text-[10px] text-text-muted">{offer.outbound?.carriers.join(', ')}</div>
                            </div>
                            {offer.return && (
                              <>
                                <div className="mx-3 h-10 border-l border-border"></div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-4">
                                    <div className="text-center">
                                      <div className="font-bold text-sm text-text-primary">{offer.return.departure.localTime}</div>
                                      <div className="text-[10px] text-text-muted">{offer.return.departure.airport}</div>
                                    </div>
                                    <div className="flex-1 text-center">
                                      <div className="text-[10px] text-text-faint">{offer.return.duration}</div>
                                      <div className="relative"><div className="border-t border-border my-1"></div>
                                        {offer.return.stops > 0 && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-text-faint rounded-full"></div>}
                                      </div>
                                      <div className="text-[10px] text-text-muted">{formatStops(offer.return.stops)}</div>
                                    </div>
                                    <div className="text-center">
                                      <div className="font-bold text-sm text-text-primary">{offer.return.arrival.localTime}</div>
                                      <div className="text-[10px] text-text-muted">{offer.return.arrival.airport}</div>
                                    </div>
                                  </div>
                                </div>
                              </>
                            )}
                            <div className="ml-3 text-right">
                              <div className="text-sm font-bold text-brand-green">${offer.price}</div>
                              <div className="text-[10px] text-text-muted">per person</div>
                              {offer.conditions?.refundable && <div className="text-[10px] text-brand-green">Refundable</div>}
                            </div>
                          </div>
                        </div>
                      ))}
                      <div className="text-[10px] text-text-faint text-center pt-1">Powered by Duffel &middot; Prices include all taxes &amp; fees</div>
                    </div>
                  ) : null}

                  {/* Selected offer → Save button */}
                  {leg.selectedOffer && !leg.committed && (
                    <div className="flex items-center justify-between p-3 bg-purple-50 border border-purple-200 rounded">
                      <div className="text-sm">
                        <span className="font-medium">{leg.selectedOffer.outbound?.carriers[0] || 'Flight'}</span>
                        <span className="text-text-muted ml-2">{leg.origin} → {leg.destination}</span>
                        {leg.selectedOffer.outbound?.duration && <span className="text-text-muted ml-2">{leg.selectedOffer.outbound.duration}</span>}
                        <span className="ml-2 font-bold text-brand-green">${leg.selectedOffer.price}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => onUpdateLeg(leg.id, { selectedOffer: null })} className="px-2 py-1 text-xs border border-border rounded">Clear</button>
                        <button onClick={() => onCommitLeg(leg.id)} disabled={committing === leg.id}
                          className="px-3 py-1.5 text-xs font-semibold rounded border border-brand-purple bg-white text-brand-purple transition-colors hover:bg-brand-purple-wash disabled:opacity-50">
                          {committing === leg.id ? 'Saving…' : 'Save to trip'}
                        </button>
                        {/* PR-Duffel-Pay-3: Book = pay now (primary, solid), alongside Save to
                            trip = plan it. Real Duffel offers only (not manual entries). Guest-ok. */}
                        {onBookLeg && !leg.selectedOffer.isManual && (
                          <button onClick={() => onBookLeg(leg.id)}
                            className="px-3 py-1.5 text-xs font-semibold rounded bg-brand-purple text-white transition-colors hover:bg-brand-purple/90">
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

      {/* Add another leg */}
      <button onClick={onAddLeg}
        className="w-full py-2 text-sm text-purple-600 hover:text-purple-800 font-medium flex items-center justify-center gap-2 border border-dashed border-purple-300 rounded hover:bg-purple-50 transition-colors">
        <span className="w-5 h-5 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-xs">+</span>
        Add Another Flight Leg
      </button>

      {!liveSearchEnabled && (
        <div className="text-[10px] text-text-faint text-center">
          Note: DUFFEL_API_TOKEN must be set for live flight search. Manual entry always works.
        </div>
      )}
    </div>
  );
}
