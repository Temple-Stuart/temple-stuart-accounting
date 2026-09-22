/**
 * The Phuket hotel payload (HOTEL-01, 2026-09-22) — the answer searchHotelRates
 * returns: the vendor's /hotels/rates data[] items (hotelId + roomTypes[] ×
 * rates[]) JOINED with the /data/hotels catalog row as `hotel`, stamped with
 * nights and the dates the rates were quoted for (liteapiClient.ts:352-371).
 *
 * NO CAPTURED LIVE PAYLOAD EXISTS IN THE REPOSITORY (STEP 0.2): the arrivals
 * store lands book answers, not search answers; the only hotel-rates shapes are
 * the client's loose type and the vendor's documentation. This fixture follows
 * the vendor's DOCUMENTED /hotels/rates sample (docs.liteapi.travel/reference/
 * post_hotels-rates: rateId, name, boardType/boardName, retailRate.total /
 * taxesAndFees[{included}], cancellationPolicies.refundableTag + cancelPolicyInfos
 * [{cancelTime}], maxOccupancy) and the /data/hotels catalog item (stars, rating,
 * reviewCount, address, city, main_photo) — with the founder's problem in it: a
 * hotel with MANY rates (room × board × cancellation), the same hotel arriving
 * twice, a property that states no stars and no rating, a rate that states no
 * room, no board and no cancellation policy. Kata Rocks alone carries the
 * per-hotel content's checkinCheckoutTimes, so the stated-time path is walked.
 */

import type { RawHotelRates } from '../hotels/rates';

const money = (amount: number) => [{ amount, currency: 'USD' }];
const STAY = { nights: 3, checkinDate: '2026-11-10', checkoutDate: '2026-11-13' };

export const PHUKET_RATES: RawHotelRates[] = [
  {
    hotelId: 'lp-ibis',
    hotel: { name: 'Ibis Phuket Kata', address: '88 Kata Road', city: 'Phuket', stars: 3, rating: 7.8, reviewCount: 1420, main_photo: 'https://img.example/ibis.jpg' },
    ...STAY,
    roomTypes: [
      { offerId: 'of-ibis-ro', rates: [{
        rateId: 'r-ibis-ro', offerId: 'of-ibis-ro', name: 'Standard Room', boardType: 'RO', boardName: 'Room Only', maxOccupancy: 2,
        retailRate: { total: money(114), taxesAndFees: [{ included: true, description: 'VAT', amount: 7.98, currency: 'USD' }] },
        cancellationPolicies: { refundableTag: 'NRFN', cancelPolicyInfos: [] },
      }] },
      { offerId: 'of-ibis-bi', rates: [{
        rateId: 'r-ibis-bi', offerId: 'of-ibis-bi', name: 'Standard Room', boardType: 'BI', boardName: 'Breakfast Included', maxOccupancy: 2,
        retailRate: { total: money(180), taxesAndFees: [{ included: true, description: 'VAT', amount: 12.6, currency: 'USD' }] },
        cancellationPolicies: { refundableTag: 'RFN', cancelPolicyInfos: [{ cancelTime: '2026-11-08 00:00:00', amount: 180, currency: 'USD', type: 'amount' }] },
      }] },
      { offerId: 'of-ibis-sea', rates: [{
        rateId: 'r-ibis-sea', offerId: 'of-ibis-sea', name: 'Superior Sea View', boardType: 'BI', boardName: 'Breakfast Included', maxOccupancy: 2,
        retailRate: { total: money(240), taxesAndFees: [{ included: true, description: 'VAT', amount: 16.8, currency: 'USD' }] },
        cancellationPolicies: { refundableTag: 'RFN', cancelPolicyInfos: [{ cancelTime: '2026-11-08 00:00:00', amount: 240, currency: 'USD', type: 'amount' }] },
      }] },
    ],
  },
  {
    hotelId: 'lp-kata-rocks',
    hotel: {
      name: 'Kata Rocks', address: '186/22 Kok Tanode Road', city: 'Phuket', stars: 5, rating: 9.2, reviewCount: 610, main_photo: 'https://img.example/katarocks.jpg',
      checkinCheckoutTimes: { checkin_start: '04:00 PM', checkout: '11:00 AM' },
    },
    ...STAY,
    roomTypes: [
      { offerId: 'of-kr-villa', rates: [
        {
          rateId: 'r-kr-villa', offerId: 'of-kr-villa', name: 'Sky Villa', boardType: 'BI', boardName: 'Breakfast Included', maxOccupancy: 2,
          retailRate: { total: money(1350), taxesAndFees: [{ included: true, description: 'VAT', amount: 94.5, currency: 'USD' }, { included: false, description: 'Facility fee', amount: 30, currency: 'USD' }] },
          cancellationPolicies: { refundableTag: 'RFN', cancelPolicyInfos: [{ cancelTime: '2026-11-03 00:00:00', amount: 1350, currency: 'USD', type: 'amount' }] },
        },
        {
          rateId: 'r-kr-villa-ro', offerId: 'of-kr-villa-ro', name: 'Sky Villa', boardType: 'RO', boardName: 'Room Only', maxOccupancy: 2,
          retailRate: { total: money(1200), taxesAndFees: [{ included: true, description: 'VAT', amount: 84, currency: 'USD' }, { included: false, description: 'Facility fee', amount: 30, currency: 'USD' }] },
          cancellationPolicies: { refundableTag: 'NRFN', cancelPolicyInfos: [] },
        },
      ] },
    ],
  },
  {
    // The catalog states no stars and no rating; the one rate states no room, no board and no policy.
    hotelId: 'lp-guesthouse',
    hotel: { name: 'Kata Guesthouse', city: 'Phuket' },
    ...STAY,
    roomTypes: [
      { offerId: 'of-gh-1', rates: [{ rateId: 'r-gh-1', retailRate: { total: money(150) } }] },
    ],
  },
  {
    hotelId: 'lp-marriott',
    hotel: { name: 'Phuket Marriott Resort Merlin Beach', address: '99 Muen-Ngern Road', city: 'Phuket', stars: 4, rating: 8.7, reviewCount: 2210, main_photo: 'https://img.example/marriott.jpg' },
    ...STAY,
    roomTypes: [
      { offerId: 'of-mar-dlx', rates: [{
        rateId: 'r-mar-dlx', offerId: 'of-mar-dlx', name: 'Deluxe Room', boardType: 'RO', boardName: 'Room Only', maxOccupancy: 3,
        retailRate: { total: money(420), taxesAndFees: [{ included: true, description: 'VAT', amount: 29.4, currency: 'USD' }] },
        cancellationPolicies: { refundableTag: 'RFN', cancelPolicyInfos: [{ cancelTime: '2026-11-07 00:00:00', amount: 420, currency: 'USD', type: 'amount' }] },
      }] },
      { offerId: 'of-mar-dlx-bi', rates: [{
        rateId: 'r-mar-dlx-bi', offerId: 'of-mar-dlx-bi', name: 'Deluxe Room', boardType: 'BI', boardName: 'Breakfast Included', maxOccupancy: 3,
        retailRate: { total: money(480), taxesAndFees: [{ included: true, description: 'VAT', amount: 33.6, currency: 'USD' }] },
        cancellationPolicies: { refundableTag: 'RFN', cancelPolicyInfos: [{ cancelTime: '2026-11-07 00:00:00', amount: 480, currency: 'USD', type: 'amount' }] },
      }] },
    ],
  },
  {
    // The same hotel arriving AGAIN (a second distributor's item): one rate already seen, one new.
    hotelId: 'lp-ibis',
    hotel: { name: 'Ibis Phuket Kata', address: '88 Kata Road', city: 'Phuket', stars: 3, rating: 7.8, reviewCount: 1420 },
    ...STAY,
    roomTypes: [
      { offerId: 'of-ibis-ro', rates: [{
        rateId: 'r-ibis-ro', offerId: 'of-ibis-ro', name: 'Standard Room', boardType: 'RO', boardName: 'Room Only', maxOccupancy: 2,
        retailRate: { total: money(114), taxesAndFees: [{ included: true, description: 'VAT', amount: 7.98, currency: 'USD' }] },
        cancellationPolicies: { refundableTag: 'NRFN', cancelPolicyInfos: [] },
      }] },
      { offerId: 'of-ibis-flex', rates: [{
        rateId: 'r-ibis-flex', offerId: 'of-ibis-flex', name: 'Standard Room', boardType: 'RO', boardName: 'Room Only', maxOccupancy: 2,
        retailRate: { total: money(150), taxesAndFees: [{ included: true, description: 'VAT', amount: 10.5, currency: 'USD' }] },
        cancellationPolicies: { refundableTag: 'RFN', cancelPolicyInfos: [{ cancelTime: '2026-11-09 00:00:00', amount: 150, currency: 'USD', type: 'amount' }] },
      }] },
    ],
  },
];

export const PHUKET_EXPECTED = {
  hotels: 4,
  rates: 9,
  ibisRates: 4,
  lowest: { rateId: 'r-ibis-ro', perNight: 38, line: 'Lowest rate meeting your filters: $38.00/night — Ibis Phuket Kata, 3★.' },
  breakfast: { rateId: 'r-ibis-bi', difference: '+$22.00/night over the lowest for: refundable, breakfast.' },
  villa: { rateId: 'r-kr-villa', difference: '+$412.00/night over the lowest for: refundable, breakfast, room: Sky Villa.' },
  guesthouse: { rateId: 'r-gh-1', difference: '+$12.00/night over the lowest — reason not stated by the property (refundable, breakfast, taxes included, room unstated).' },
  fourStarsLowest: { rateId: 'r-mar-dlx', line: 'Lowest rate meeting your filters: $140.00/night — Phuket Marriott Resort Merlin Beach, 4★.' },
};
