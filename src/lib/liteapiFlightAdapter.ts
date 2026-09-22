// ─── LiteAPI journeys → the picker's FlightOffer shape (PR-FL-6a) ────────────
// The STEP-0 ruled choice: an ADAPTER, not a parallel results view — the pure
// FlightPickerView stays untouched,
// and this one mapping function is strictly smaller than a second results UI +
// selection state machine.
//
// PURE + CLIENT-SAFE: type-only imports (erased at compile), no env, no fetch.
// Maps ONLY documented fields (FLIGHT-LITE-1 recon shapes); absent fields map
// to null/absent — never invented. Segments are split by their documented
// `direction` tag (OUTBOUND/INBOUND; untagged segments — the one-way case —
// count as outbound). Offers WITHOUT a display price cannot render in the
// picker (price is required) and are skipped with a loud count — never shown
// with a fabricated price.
//
// FLIGHT-01 (2026-09-22): A FARE SAYS WHAT IT BUYS. Each offer now carries
// `fare` — cabin, fare family, fare basis, checked bag, carry-on, changeable,
// refundable, the stated fees — as TRI-STATE values: a field the payload did
// not carry is null (the picker renders "not stated by the carrier"), never a
// coerced false. The old `conditions` (`!!terms.refundable`, which turned the
// carrier's silence into "not refundable") is no longer written here. Each
// offer also carries its segments as the row shows them (marketing AND
// operating carrier, flight numbers, airports with the names the payload
// gives) and `flightKey`, the identity src/lib/flights/fares.ts groups by.

import type { FlightSearchResult, FlightSegment, FlightJourney, FlightOffer as LiteApiOffer } from './liteapiFlightsClient';
import type { FlightOffer } from '@/components/trips/FlightPickerView';
import type { FareAttributes, FlightSegmentView, Stated } from '@/lib/flights/fares';
import { flightIdentityOf } from '@/lib/flights/fares';

/** "PT7H45M" → "7h 45m"; falls back to minutes; '' when neither exists. */
function formatDuration(iso8601?: string, minutes?: number): string {
  if (iso8601) {
    const m = /^PT(?:(\d+)H)?(?:(\d+)M)?/.exec(iso8601);
    if (m && (m[1] || m[2])) {
      return [m[1] ? `${m[1]}h` : '', m[2] ? `${m[2]}m` : ''].filter(Boolean).join(' ');
    }
  }
  if (typeof minutes === 'number' && minutes > 0) {
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  }
  return '';
}

/** ISO "2026-08-24T09:35:00" → { date: "2026-08-24", localTime: "09:35" }. */
function splitIso(iso?: string): { date: string; localTime: string } {
  if (!iso) return { date: '', localTime: '' };
  const [d, t] = iso.split('T');
  return { date: d ?? '', localTime: (t ?? '').slice(0, 5) };
}

/** One direction's segments → the picker's outbound/return block. */
function directionBlock(
  segs: FlightSegment[],
  duration: string,
  durationMinutes: number | undefined,
): NonNullable<FlightOffer['outbound']> | null {
  if (segs.length === 0) return null;
  const first = segs[0];
  const last = segs[segs.length - 1];
  const dep = splitIso(first.departureTime);
  const arr = splitIso(last.arrivalTime);
  const carriers = [...new Set(
    segs.map((s) => s.carrier?.marketingName || s.carrier?.marketingCode || '').filter(Boolean)
  )];
  return {
    departure: {
      airport: first.originCode ?? '',
      airportName: first.originName,
      localTime: dep.localTime,
      date: dep.date,
      // LiteAPI segments carry no IANA zone field — null, never a guessed zone
      // (the tz-0b convention).
      timeZone: null,
    },
    arrival: {
      airport: last.destinationCode ?? '',
      airportName: last.destinationName,
      localTime: arr.localTime,
      date: arr.date,
      timeZone: null,
    },
    duration,
    ...(durationMinutes !== undefined ? { durationMinutes } : {}),
    stops: segs.length - 1,
    carriers,
  };
}

function journeyDirectionDuration(j: FlightJourney, direction: 'OUTBOUND' | 'INBOUND'): {
  duration: string;
  durationMinutes?: number;
} {
  const entry = (j.legDurations ?? []).find((l) => l.direction === direction);
  if (entry?.duration) {
    return {
      duration: formatDuration(entry.duration.iso8601, entry.duration.minutes),
      durationMinutes: entry.duration.minutes,
    };
  }
  // One-way journeys: the journey total IS the outbound duration.
  if (direction === 'OUTBOUND' && j.totalDuration) {
    return {
      duration: formatDuration(j.totalDuration.iso8601, j.totalDuration.minutes),
      durationMinutes: j.totalDuration.minutes,
    };
  }
  return { duration: '' };
}

// ─── FLIGHT-01: the stated attributes, tri-state ─────────────────────────────

const statedString = (v: unknown): Stated<string> => (typeof v === 'string' && v.trim() !== '' ? v : null);
const statedBoolean = (v: unknown): Stated<boolean> => (typeof v === 'boolean' ? v : null);

/** The vendor's included-bag line for one bag type, as it states it — pieces · weight, or its own description. */
function includedBagDetail(o: LiteApiOffer, bagType: 'cabin' | 'checked'): Stated<string> {
  const rows = (o.baggage?.included ?? []).filter((b) => b?.bagType === bagType);
  if (rows.length === 0) return null;
  const parts = rows.map((b) => {
    if (typeof b.description === 'string' && b.description.trim()) return b.description.trim();
    const pieces = typeof b.pieces === 'number' ? `${b.pieces} piece${b.pieces === 1 ? '' : 's'}` : null;
    const weight = typeof b.weightKg === 'number' ? `${b.weightKg} ${b.unit ?? 'kg'}` : null;
    return [pieces, weight].filter(Boolean).join(' · ');
  }).filter((s) => s.length > 0);
  return parts.length ? parts.join('; ') : null;
}

/** A fee the vendor states — its amount and currency, or its label. Null when unstated. */
function statedFee(fee: unknown): Stated<string> {
  if (!fee || typeof fee !== 'object') return null;
  const f = fee as { pricing?: { display?: { amount?: unknown; currency?: unknown } }; label?: unknown; applicability?: unknown };
  const amount = f.pricing?.display?.amount;
  const currency = f.pricing?.display?.currency;
  const money = typeof amount === 'number' && typeof currency === 'string' ? `${amount} ${currency}` : null;
  const label = typeof f.label === 'string' ? f.label : (typeof f.applicability === 'string' ? f.applicability : null);
  if (money && label) return `${money} (${label})`;
  return money ?? label;
}

/** The cabin the segment fares state — one value, 'mixed' when the segments differ, null when unstated. */
function statedCabin(o: LiteApiOffer): Stated<string> {
  const cabins = [...new Set((o.segmentFares ?? []).map((f) => statedString(f?.cabin)).filter((c): c is string => c !== null))];
  if (cabins.length === 0) return null;
  return cabins.length === 1 ? cabins[0] : 'mixed';
}

export function fareAttributesOf(o: LiteApiOffer): FareAttributes {
  return {
    cabin: statedCabin(o),
    fareFamily: statedString(o.fare?.family),
    fareBasisCode: statedString(o.segmentFares?.[0]?.fareBasisCode),
    checkedBag: statedBoolean(o.baggage?.hasCheckedBag),
    checkedBagDetail: includedBagDetail(o, 'checked'),
    carryOnBag: statedBoolean(o.baggage?.hasCarryOnBag),
    carryOnDetail: includedBagDetail(o, 'cabin'),
    changeable: statedBoolean(o.terms?.changeable),
    refundable: statedBoolean(o.terms?.refundable),
    changeFee: statedFee(o.terms?.changeFee),
    refundFee: statedFee(o.terms?.refundFee),
  };
}

export function segmentViewOf(s: FlightSegment): FlightSegmentView {
  return {
    marketingCode: statedString(s.carrier?.marketingCode),
    marketingName: statedString(s.carrier?.marketingName),
    operatingCode: statedString(s.carrier?.operatingCode),
    operatingName: statedString(s.carrier?.operatingName),
    marketingNumber: statedString(s.flight?.marketingNumber),
    operatingNumber: statedString(s.flight?.operatingNumber),
    originCode: statedString(s.originCode),
    originName: statedString(s.originName),
    destinationCode: statedString(s.destinationCode),
    destinationName: statedString(s.destinationName),
    departureTime: statedString(s.departureTime),
    arrivalTime: statedString(s.arrivalTime),
  };
}

/** Flatten LiteAPI search results into picker-consumable offers. Each journey's
 *  offers become one FlightOffer per offer, sharing that journey's segment
 *  blocks. Insertion order is preserved (the API's own ranking). */
export function liteApiResultsToFlightOffers(results: FlightSearchResult[]): FlightOffer[] {
  const out: FlightOffer[] = [];
  let skippedNoPrice = 0;

  for (const r of results) {
    for (const j of r.journeys ?? []) {
      const segs = j.segments ?? [];
      const outSegs = segs.filter((s) => s.direction !== 'INBOUND');
      const inSegs = segs.filter((s) => s.direction === 'INBOUND');
      const outDur = journeyDirectionDuration(j, 'OUTBOUND');
      const inDur = journeyDirectionDuration(j, 'INBOUND');
      const outboundSegments = outSegs.map(segmentViewOf);
      const returnSegments = inSegs.map(segmentViewOf);
      const flightKey = flightIdentityOf(outboundSegments, returnSegments);

      for (const o of j.offers ?? []) {
        const total = o.pricing?.display?.total;
        const currency = o.pricing?.display?.currency;
        if (typeof total !== 'number' || !currency) {
          skippedNoPrice++;
          continue;
        }
        const outbound = directionBlock(outSegs, outDur.duration, outDur.durationMinutes);
        const ret = inSegs.length > 0 ? directionBlock(inSegs, inDur.duration, inDur.durationMinutes) : null;
        out.push({
          id: o.offerId,
          price: total,
          currency,
          outbound,
          // The picker's return block has no durationMinutes field — drop it.
          return: ret
            ? {
                departure: ret.departure,
                arrival: ret.arrival,
                duration: ret.duration,
                stops: ret.stops,
                carriers: ret.carriers,
              }
            : null,
          expiresAt: o.expiration ?? null,
          fare: fareAttributesOf(o),
          outboundSegments,
          returnSegments,
          flightKey,
        });
      }
    }
  }

  if (skippedNoPrice > 0) {
    // Loud, honest: these offers exist upstream but cannot render without a
    // price — they are dropped, not faked.
    console.warn(`[LiteAPI flights] adapter: ${skippedNoPrice} offer(s) skipped — no display price in the response`);
  }
  return out;
}
