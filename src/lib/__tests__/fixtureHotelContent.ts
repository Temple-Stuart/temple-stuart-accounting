/**
 * The vendor's GET /data/hotel content — SYNTHESIZED to the documented shape
 * (docs.liteapi.travel/reference/get_data-hotel: `data.checkinCheckoutTimes
 * { checkout "11:00 AM", checkin_start "04:00 PM", checkin_end "12:00 AM",
 * instructions[], special_instructions }`, `rating` 4.x beside `starRating` 4).
 * NO CAPTURED LIVE CONTENT PAYLOAD EXISTS IN THE REPOSITORY (HOTEL-02, 2026-09-22):
 * three properties model the three answers a commit can meet — a clock stated,
 * a clock not stated, a clock stated in words the reader cannot read.
 */
import type { HotelContent } from '../liteapiClient';

/** Kata Rocks states its clock: check-in from 02:00 PM, check-out 12:00 PM. */
export const KATA_ROCKS_CONTENT: HotelContent = {
  id: 'lp-kata-rocks', name: 'Kata Rocks', starRating: 5, rating: 4.7, reviewCount: 812,
  checkinCheckoutTimes: { checkout: '12:00 PM', checkin_start: '02:00 PM', checkin_end: '12:00 AM', instructions: [], special_instructions: '' },
};

/** The guesthouse states no clock at all — the object is absent. */
export const GUESTHOUSE_CONTENT: HotelContent = { id: 'lp-guesthouse', name: 'Kata Guesthouse', hotelDescription: 'A guesthouse.' };

/** A property whose check-in is stated in words the reader cannot read. */
export const UNREADABLE_CONTENT: HotelContent = {
  id: 'lp-odd', name: 'Odd Hours Inn', checkinCheckoutTimes: { checkin_start: 'from 16h', checkout: '11:00 AM' },
};

export const CONTENT_EXPECTED = {
  kataRocks: { checkin: '14:00', checkout: '12:00', statement: 'check-in 14:00 stated by the property; check-out 12:00 stated by the property' },
  guesthouse: { checkin: null, checkout: null, statement: 'check-in time not stated by the property; check-out time not stated by the property' },
  unreadable: 'the property stated a check-in time this reader cannot read: "from 16h"',
} as const;
