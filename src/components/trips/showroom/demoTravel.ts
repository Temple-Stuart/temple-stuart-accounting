// ─── demoTravel — static showroom seed for the Travel pipe ───────────────────
// Maria's Oaxaca food trip. She runs a food truck (see the Operations showroom);
// here she flies to the street-food capital to learn mole at the source. PURE
// STATIC DATA, consumed only by the Travel showroom (a later PR) — NOT a fallback,
// never wired to a live path. No I/O: no fetch, no effect, no server import.
//
// Every literal is typed against the SAME contracts the views use:
//   • flights  → FlightOffer / FlightLeg (FlightPickerView, exported)
//   • hotels   → HotelPicker's option shape (extracted via Parameters — the type
//                isn't exported, so we read it off the component prop, NOT redefine)
//   • transfer → TransferPicker's option shape (same Parameters technique)
//   • itinerary→ TripItineraryRow (TripTimeline / TripTimelineView, exported)
// The category list is SOURCED from src/lib/travelCOA.ts (TRAVEL_COA): the four
// keys with a real vendorApi (flights/accommodation/ground_transport/activities)
// are BOOK+BUDGET; the rest are BUDGET-ONLY. The `_check` block at the bottom
// proves each export conforms.

import type { FlightOffer, FlightLeg, FlightPickerViewProps } from '../FlightPickerView';
import type { TripItineraryRow } from '../TripTimeline';
import HotelPicker from '../HotelPicker';
import TransferPicker from '../TransferPicker';

// The views don't export their option types — read them off the component props
// (no redefinition, no live-code change). Used only in type position (elided).
type HotelOption = NonNullable<Parameters<typeof HotelPicker>[0]['selectedHotel']>;
type TransferOption = NonNullable<Parameters<typeof TransferPicker>[0]['selectedArrival']>;

/** A static activity card (no live component contract — TripPlannerAI is caged). */
export interface DemoActivityCard {
  title: string;
  vendor: string;
  price: number;
  currency: string;
  durationLabel: string;
  blurb: string;
  bookLabel: string;
}

/** One category chip for the scroll row. `key` is a real TRAVEL_COA key. */
export interface DemoCategoryCard {
  key: string;
  label: string;
  kind: 'book' | 'budget';
}

// ── Trip dates ──────────────────────────────────────────────────────────────
export const demoTripStart = '2026-07-20';
export const demoTripEnd = '2026-07-25';

// ── Flights: LAX ⇄ OAX (Oaxaca), round-trip ─────────────────────────────────
export const demoFlightOffers: FlightOffer[] = [
  {
    id: 'demo-flight-1',
    price: 412,
    currency: 'USD',
    outbound: {
      departure: { airport: 'LAX', airportName: 'Los Angeles', localTime: '06:30', date: '2026-07-20' },
      arrival: { airport: 'OAX', airportName: 'Oaxaca', localTime: '13:45', date: '2026-07-20' },
      duration: '7h 15m',
      stops: 1,
      carriers: ['Volaris'],
    },
    return: {
      departure: { airport: 'OAX', airportName: 'Oaxaca', localTime: '15:10', date: '2026-07-25' },
      arrival: { airport: 'LAX', airportName: 'Los Angeles', localTime: '21:40', date: '2026-07-25' },
      duration: '6h 30m',
      stops: 1,
      carriers: ['Volaris'],
    },
    conditions: { refundable: false, changeable: true },
  },
  {
    id: 'demo-flight-2',
    price: 538,
    currency: 'USD',
    outbound: {
      departure: { airport: 'LAX', airportName: 'Los Angeles', localTime: '08:05', date: '2026-07-20' },
      arrival: { airport: 'OAX', airportName: 'Oaxaca', localTime: '14:20', date: '2026-07-20' },
      duration: '6h 15m',
      stops: 1,
      carriers: ['Aeroméxico'],
    },
    return: {
      departure: { airport: 'OAX', airportName: 'Oaxaca', localTime: '16:00', date: '2026-07-25' },
      arrival: { airport: 'LAX', airportName: 'Los Angeles', localTime: '22:05', date: '2026-07-25' },
      duration: '6h 05m',
      stops: 1,
      carriers: ['Aeroméxico'],
    },
    conditions: { refundable: true, changeable: true },
  },
];

export const demoFlightLegs: FlightLeg[] = [
  {
    id: 'demo-leg-1',
    origin: 'LAX',
    destination: 'OAX',
    departureDate: '2026-07-20',
    returnDate: '2026-07-25',
    tripType: 'roundtrip',
    offers: demoFlightOffers,
    selectedOffer: null,
    committed: false,
    commitId: null,
    loading: false,
    error: '',
    expanded: true,
    manualAirline: '',
    manualPrice: '',
    manualDepartTime: '',
    manualArriveTime: '',
    manualArriveDate: '',
  },
];

// ── Hotels: a couple of plausible Oaxaca stays (5 nights) ───────────────────
export const demoHotels: HotelOption[] = [
  {
    hotelId: 'demo-hotel-1',
    name: 'Casa de las Bugambilias',
    rating: '4.7',
    cityName: 'Oaxaca de Juárez',
    totalPrice: 475,
    currency: 'USD',
    perNight: 95,
    perPersonPerNight: 95,
    nights: 5,
    roomDescription: 'Cozy room off a flower-filled courtyard, two blocks from the market',
    bedType: 'Queen',
    beds: 1,
  },
  {
    hotelId: 'demo-hotel-2',
    name: 'Hotel Parador del Convento',
    rating: '4.5',
    cityName: 'Oaxaca de Juárez',
    totalPrice: 390,
    currency: 'USD',
    perNight: 78,
    perPersonPerNight: 78,
    nights: 5,
    roomDescription: 'Simple room in an old stone building near Santo Domingo',
    bedType: 'Double',
    beds: 1,
  },
];

// ── Transfer: airport → hotel ground ride ───────────────────────────────────
export const demoTransfer: TransferOption = {
  id: 'demo-transfer-1',
  type: 'PRIVATE',
  direction: 'arrival',
  vehicle: {
    code: 'SEDAN',
    category: 'Private Car',
    description: 'Sedan · up to 3 people · 3 bags',
    seats: 3,
    bags: 3,
  },
  provider: { code: 'MOZIO', name: 'Oaxaca Airport Cars' },
  price: 28,
  currency: 'USD',
  distance: '8 km',
  pickupTime: '2026-07-20T14:00:00',
  dropoffTime: '2026-07-20T14:30:00',
};

// ── Activity: a static "things to do" card ──────────────────────────────────
export const demoActivity: DemoActivityCard = {
  title: 'Mole & Market Cooking Class',
  vendor: 'Oaxaca Cocina',
  price: 65,
  currency: 'USD',
  durationLabel: '4 hours',
  blurb:
    'Walk the big market with a local cook. Pick your chiles, then make mole and ' +
    'tortillas from scratch. Best part — you eat what you make.',
  bookLabel: 'Book on Viator',
};

// ── Category map: four BOOK+BUDGET cards + the BUDGET-ONLY rest ──────────────
// Keys sourced from travelCOA.ts TRAVEL_COA (:25). The four with a real vendorApi
// (flights :35, accommodation :46 'lodging', ground_transport :190 'vehicles',
// activities :101) are bookable; everything else is budget-only.
export const demoCategoryMap: DemoCategoryCard[] = [
  { key: 'flights', label: 'Flights', kind: 'book' },
  { key: 'accommodation', label: 'Hotel', kind: 'book' },
  { key: 'ground_transport', label: 'Getting around', kind: 'book' },
  { key: 'activities', label: 'Things to do', kind: 'book' },
  { key: 'dinner', label: 'Food', kind: 'budget' },
  { key: 'groceries', label: 'Snacks & water', kind: 'budget' },
  { key: 'insurance_fees', label: 'Travel insurance', kind: 'budget' },
  { key: 'communication', label: 'Phone & eSIM', kind: 'budget' },
  { key: 'shopping', label: 'Shopping', kind: 'budget' },
];

// ── Itinerary: Maria's days in Oaxaca (block times in @db.Time ISO) ──────────
export const demoTripItinerary: TripItineraryRow[] = [
  {
    id: 'demo-itin-flight-out',
    day: 1,
    homeDate: '2026-07-20T00:00:00.000Z',
    destDate: '2026-07-20T00:00:00.000Z',
    category: 'flights',
    vendor: 'LAX → OAX',
    vendor_name: 'Volaris · LAX → OAX',
    cost: 206,
    recurrence: 'once',
    block_start_time: '1970-01-01T06:30:00.000Z',
    block_end_time: '1970-01-01T13:45:00.000Z',
    coa_code: 'P-9100',
    location: 'Oaxaca',
    vendorOptionType: 'flight',
  },
  {
    id: 'demo-itin-transfer',
    day: 1,
    homeDate: '2026-07-20T00:00:00.000Z',
    destDate: '2026-07-20T00:00:00.000Z',
    category: 'ground_transport',
    vendor: 'Airport → hotel',
    vendor_name: 'Oaxaca Airport Cars',
    cost: 28,
    recurrence: 'once',
    block_start_time: '1970-01-01T14:00:00.000Z',
    block_end_time: '1970-01-01T14:30:00.000Z',
    coa_code: 'P-9200',
    vendorOptionType: 'vehicle',
  },
  {
    id: 'demo-itin-hotel',
    day: 1,
    homeDate: '2026-07-20T00:00:00.000Z',
    destDate: '2026-07-25T00:00:00.000Z',
    category: 'accommodation',
    vendor: 'Casa de las Bugambilias',
    vendor_name: 'Casa de las Bugambilias',
    cost: 475,
    recurrence: 'daily',
    coa_code: 'P-9110',
    vendorOptionType: 'lodging',
  },
  {
    id: 'demo-itin-class',
    day: 2,
    homeDate: '2026-07-21T00:00:00.000Z',
    destDate: '2026-07-21T00:00:00.000Z',
    category: 'activities',
    vendor: 'Oaxaca Cocina',
    vendor_name: 'Mole & Market Cooking Class',
    cost: 65,
    recurrence: 'once',
    block_start_time: '1970-01-01T09:00:00.000Z',
    block_end_time: '1970-01-01T13:00:00.000Z',
    coa_code: 'P-9400',
    vendorOptionType: 'activity',
  },
  {
    id: 'demo-itin-market',
    day: 3,
    homeDate: '2026-07-22T00:00:00.000Z',
    destDate: '2026-07-22T00:00:00.000Z',
    category: 'activities',
    vendor: 'Mercado 20 de Noviembre',
    vendor_name: 'Market food crawl',
    cost: 20,
    recurrence: 'once',
    block_start_time: '1970-01-01T11:00:00.000Z',
    block_end_time: '1970-01-01T13:00:00.000Z',
    coa_code: 'P-9400',
    vendorOptionType: 'activity',
  },
  {
    id: 'demo-itin-dinner',
    day: 3,
    homeDate: '2026-07-22T00:00:00.000Z',
    destDate: '2026-07-22T00:00:00.000Z',
    category: 'dinner',
    vendor: 'Tlayuda stand',
    vendor_name: 'Tlayudas for dinner',
    cost: 12,
    recurrence: 'once',
    block_start_time: '1970-01-01T19:00:00.000Z',
    block_end_time: '1970-01-01T20:00:00.000Z',
    coa_code: 'P-9320',
    vendorOptionType: 'activity',
  },
  {
    id: 'demo-itin-flight-back',
    day: 6,
    homeDate: '2026-07-25T00:00:00.000Z',
    destDate: '2026-07-25T00:00:00.000Z',
    category: 'flights',
    vendor: 'OAX → LAX',
    vendor_name: 'Volaris · OAX → LAX',
    cost: 206,
    recurrence: 'once',
    block_start_time: '1970-01-01T15:10:00.000Z',
    block_end_time: '1970-01-01T21:40:00.000Z',
    coa_code: 'P-9100',
    location: 'Los Angeles',
    vendorOptionType: 'flight',
  },
];

/**
 * Type-conformance proofs. Each line fails to compile if the matching export
 * drifts from the view contract. Not exported; erased by the compiler.
 */
const _checkFlightOffers: FlightOffer[] = demoFlightOffers;
const _checkFlightLegs: FlightLeg[] = demoFlightLegs;
const _checkFlightLegsProp: FlightPickerViewProps['legs'] = demoFlightLegs;
const _checkHotels: HotelOption[] = demoHotels;
const _checkTransfer: TransferOption = demoTransfer;
const _checkItinerary: TripItineraryRow[] = demoTripItinerary;
void [_checkFlightOffers, _checkFlightLegs, _checkFlightLegsProp, _checkHotels, _checkTransfer, _checkItinerary];
