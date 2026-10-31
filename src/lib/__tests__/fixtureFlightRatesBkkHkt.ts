/**
 * The BKK→HKT rates payload FLIGHT-01's tests and walk run on (2026-10-25, one way).
 *
 * NO CAPTURED LIVE PAYLOAD EXISTS IN THE REPOSITORY (STEP 0.2): the arrivals
 * store lands book answers, not search answers, and no search fixture was ever
 * checked in. This fixture follows the vendor's DOCUMENTED response shape —
 * docs.liteapi.travel/reference/post_flights-rates: data[].journeys[] with
 * segments (marketing AND operating carrier, flight numbers, airport codes and
 * names, local ISO times, direction) and offers (pricing.display, fare, baggage
 * with included[], terms with fees and summary, segmentFares with cabin and
 * fareBasisCode) — populated with the rows the founder's screen reported: the
 * Vietjet 06:50 six times across two journeys, a Hahn Air-ticketed row whose
 * operating airline is Vietjet, Thai AirAsia 14:15 at $41.46 (the lowest fare),
 * a Thai Airways business fare, a Bangkok Airways fare, and a one-stop Nok Air.
 * Two offers deliberately carry NO baggage or NO terms, as the documented
 * optionals allow, so "not stated by the carrier" is exercised. Nothing here
 * is a metered call.
 */

import type { FlightJourney, FlightOffer, FlightSearchResult, FlightSegment } from '../liteapiFlightsClient';

const seg = (
  key: string, mCode: string, mName: string, oCode: string, oName: string, number: string,
  from: [string, string], to: [string, string], dep: string, arr: string, minutes: number,
): FlightSegment => ({
  segmentKey: key,
  originCode: from[0], originName: from[1],
  destinationCode: to[0], destinationName: to[1],
  departureTime: dep, arrivalTime: arr,
  direction: 'OUTBOUND',
  duration: { iso8601: `PT${Math.floor(minutes / 60)}H${minutes % 60}M`, minutes },
  flight: { marketingNumber: number, operatingNumber: number },
  carrier: { marketingCode: mCode, marketingName: mName, operatingCode: oCode, operatingName: oName },
});

const DMK: [string, string] = ['DMK', 'Don Mueang International Airport'];
const BKK: [string, string] = ['BKK', 'Suvarnabhumi Airport'];
const HKT: [string, string] = ['HKT', 'Phuket International Airport'];
const KBV: [string, string] = ['KBV', 'Krabi International Airport'];

const price = (total: number) => ({ display: { total, currency: 'USD', base: Math.round(total * 0.8 * 100) / 100, taxes: Math.round(total * 0.2 * 100) / 100, fees: 0 }, converted: false });

interface Bag { carry?: boolean; carryKg?: number; checked?: boolean; checkedKg?: number }
const baggage = (b: Bag): FlightOffer['baggage'] => ({
  hasCarryOnBag: b.carry,
  hasCheckedBag: b.checked,
  included: [
    ...(b.carry && b.carryKg ? [{ bagType: 'cabin' as const, pieces: 1, weightKg: b.carryKg, unit: 'kg', passengerType: 'ADT' as const, description: `1 carry-on bag up to ${b.carryKg} kg` }] : []),
    ...(b.checked && b.checkedKg ? [{ bagType: 'checked' as const, pieces: 1, weightKg: b.checkedKg, unit: 'kg', passengerType: 'ADT' as const, description: `1 checked bag up to ${b.checkedKg} kg` }] : []),
  ],
});

const terms = (changeable: boolean, refundable: boolean, changeFeeUsd?: number, refundFeeUsd?: number): FlightOffer['terms'] => ({
  changeable,
  refundable,
  changeFee: changeable && changeFeeUsd !== undefined ? { pricing: { display: { amount: changeFeeUsd, currency: 'USD' } }, applicability: 'beforeDeparture', label: 'Change fee (before departure)' } : null,
  refundFee: refundable && refundFeeUsd !== undefined ? { pricing: { display: { amount: refundFeeUsd, currency: 'USD' } }, applicability: 'beforeDeparture', label: 'Refund fee (before departure)' } : null,
  summary: [
    { level: changeable ? 'info' : 'warning', message: changeable ? 'Changes allowed' : 'No changes' },
    { level: refundable ? 'info' : 'danger', message: refundable ? 'Refundable' : 'Non-refundable' },
  ],
});

const offer = (id: string, total: number, family: string, cabin: string, basis: string, opts: { baggage?: FlightOffer['baggage']; terms?: FlightOffer['terms'] }, segmentKeys: string[]): FlightOffer => ({
  offerId: id,
  expiration: '2026-10-24T23:59:00Z',
  pricing: price(total),
  fare: { family, mixedCabin: false, seatsRemaining: 5 },
  ...(opts.baggage !== undefined ? { baggage: opts.baggage } : {}),
  ...(opts.terms !== undefined ? { terms: opts.terms } : {}),
  segmentFares: segmentKeys.map((segmentKey) => ({ segmentKey, bookingCode: basis[0], cabin, fareBasisCode: basis, fareFamily: family, seatsRemaining: 5 })),
});

const journey = (key: string, segments: FlightSegment[], offers: FlightOffer[]): FlightJourney => {
  const minutes = segments.reduce((n, s) => n + (s.duration?.minutes ?? 0), 0) + (segments.length > 1 ? 40 : 0);
  return {
    journeyKey: key,
    timestamp: '2026-10-25T00:00:00Z',
    totalDuration: { iso8601: `PT${Math.floor(minutes / 60)}H${minutes % 60}M`, minutes },
    legDurations: [{ direction: 'OUTBOUND', duration: { iso8601: `PT${Math.floor(minutes / 60)}H${minutes % 60}M`, minutes }, dayChange: 0, overnightFlight: false }],
    parameters: { adults: 1, children: 0, infants: 0 },
    segments,
    offers,
    connections: [],
  };
};

// The Vietjet 06:50 — one physical flight, six fares across two journeys (two distributors).
const VZ300 = seg('vz300', 'VZ', 'Thai Vietjet Air', 'VZ', 'Thai Vietjet Air', '300', DMK, HKT, '2026-10-25T06:50:00', '2026-10-25T08:20:00', 90);
const VZ300_AGAIN = { ...VZ300, segmentKey: 'vz300-b' };
// Hahn Air Systems ticketing the same aircraft under its own number — the marketing carrier hides the airline.
const H1_5300 = seg('h15300', 'H1', 'Hahn Air Systems', 'VZ', 'Thai Vietjet Air', '5300', DMK, HKT, '2026-10-25T06:50:00', '2026-10-25T08:20:00', 90);
// Thai AirAsia 14:15 — the lowest fare on the day.
const FD3011 = seg('fd3011', 'FD', 'Thai AirAsia', 'FD', 'Thai AirAsia', '3011', DMK, HKT, '2026-10-25T14:15:00', '2026-10-25T15:40:00', 85);
// Thai Airways from Suvarnabhumi — economy and business.
const TG203 = seg('tg203', 'TG', 'Thai Airways International', 'TG', 'Thai Airways International', '203', BKK, HKT, '2026-10-25T08:00:00', '2026-10-25T09:25:00', 85);
// Bangkok Airways.
const PG275 = seg('pg275', 'PG', 'Bangkok Airways', 'PG', 'Bangkok Airways', '275', BKK, HKT, '2026-10-25T10:15:00', '2026-10-25T11:40:00', 85);
// Nok Air, one stop in Krabi.
const DD401 = seg('dd401', 'DD', 'Nok Air', 'DD', 'Nok Air', '401', DMK, KBV, '2026-10-25T12:10:00', '2026-10-25T13:30:00', 80);
const DD7310 = seg('dd7310', 'DD', 'Nok Air', 'DD', 'Nok Air', '7310', KBV, HKT, '2026-10-25T14:10:00', '2026-10-25T14:50:00', 40);

export const BKK_HKT_RATES: FlightSearchResult[] = [{
  journeys: [
    journey('j-vz300-a', [VZ300], [
      offer('vz300-eco', 41.95, 'Eco', 'Economy', 'VZECO', { baggage: baggage({ carry: true, carryKg: 7, checked: false }), terms: terms(false, false) }, ['vz300']),
      offer('vz300-deluxe', 65.34, 'Deluxe', 'Economy', 'VZDLX', { baggage: baggage({ carry: true, carryKg: 7, checked: true, checkedKg: 20 }), terms: terms(true, false, 25) }, ['vz300']),
      // The carrier states NO baggage on this fare — the payload carries none.
      offer('vz300-deluxe-nobag', 68.21, 'Deluxe', 'Economy', 'VZDLX', { terms: terms(true, false, 25) }, ['vz300']),
      offer('vz300-skyboss', 116.09, 'SkyBoss', 'Economy', 'VZSKY', { baggage: baggage({ carry: true, carryKg: 10, checked: true, checkedKg: 30 }), terms: terms(true, true, 0, 30) }, ['vz300']),
    ]),
    journey('j-vz300-b', [VZ300_AGAIN], [
      // The same fare through a second distributor, its terms unstated.
      offer('vz300-deluxe-noterms', 68.21, 'Deluxe', 'Economy', 'VZDLX', { baggage: baggage({ carry: true, carryKg: 7, checked: true, checkedKg: 20 }) }, ['vz300-b']),
      offer('vz300-skyboss-plus', 179.30, 'SkyBoss Plus', 'Economy', 'VZSKP', { baggage: baggage({ carry: true, carryKg: 10, checked: true, checkedKg: 40 }), terms: terms(true, true, 0, 0) }, ['vz300-b']),
    ]),
    journey('j-h15300', [H1_5300], [
      offer('h15300-y', 72.10, 'Economy', 'Economy', 'YHAHN', { baggage: baggage({ carry: true, carryKg: 7 }), terms: terms(true, false, 40) }, ['h15300']),
    ]),
    journey('j-fd3011', [FD3011], [
      offer('fd3011-low', 41.46, 'Low fare', 'Economy', 'FDLOW', { baggage: baggage({ carry: true, carryKg: 7, checked: false }), terms: terms(true, false, 30) }, ['fd3011']),
      offer('fd3011-value', 58.90, 'Value pack', 'Economy', 'FDVAL', { baggage: baggage({ carry: true, carryKg: 7, checked: true, checkedKg: 20 }), terms: terms(true, false, 30) }, ['fd3011']),
    ]),
    journey('j-tg203', [TG203], [
      offer('tg203-y', 95.00, 'Economy Saver', 'Economy', 'YSAVER', { baggage: baggage({ carry: true, carryKg: 7, checked: true, checkedKg: 25 }), terms: terms(true, false, 50) }, ['tg203']),
      offer('tg203-c', 210.00, 'Royal Silk', 'Business', 'CFLEX', { baggage: baggage({ carry: true, carryKg: 14, checked: true, checkedKg: 40 }), terms: terms(true, true, 0, 0) }, ['tg203']),
    ]),
    journey('j-pg275', [PG275], [
      offer('pg275-y', 88.00, 'Economy', 'Economy', 'YPG', { baggage: baggage({ carry: true, carryKg: 7, checked: true, checkedKg: 20 }), terms: terms(true, false, 35) }, ['pg275']),
    ]),
    journey('j-dd401', [DD401, DD7310], [
      offer('dd401-y', 70.00, 'Nok Lite', 'Economy', 'DDLITE', { baggage: baggage({ carry: true, carryKg: 7, checked: false }), terms: terms(false, false) }, ['dd401', 'dd7310']),
    ]),
  ],
  sortMetadata: {
    price: { journeyKey: 'j-fd3011', offerId: 'fd3011-low', price: 41.46, currency: 'USD' },
    duration: { journeyKey: 'j-fd3011', offerId: 'fd3011-low', price: 41.46, currency: 'USD' },
  },
}];

/** The founder's example: what the screen names the flights. */
export const BKK_HKT_EXPECTED = {
  flights: 6,
  fares: 13,
  vietjetFares: 6,
  lowest: { offerId: 'fd3011-low', price: 41.46, line: 'Lowest fare meeting your filters: $41.46 — Thai AirAsia 14:15 nonstop.' },
  skyboss: { offerId: 'vz300-skyboss', price: 116.09, difference: '+$74.63 over the lowest fare for: refundable, checked bag.' },
};
