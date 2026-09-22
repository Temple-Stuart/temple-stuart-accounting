/**
 * travelBookingFlow — THE BOOKING FLOW IS BYTE-IDENTICAL (TRAVEL-01, 2026-09-19).
 *
 * TRAVEL-01 rebuilt the travel tab as plain sections and gave a committed item
 * its time on the day. It changed NOTHING in the booking flow — search →
 * prebook → pay, the provider calls, the reservation routes, the checkout
 * panels, the clients — and the travel law proves it at build: every file below
 * is pinned by the sha256 of its WHOLE text (code and comments alike, through
 * rejoin(code(f), comments(f)) — a whole-artefact equality, never a pattern),
 * as it stood on main at b9eac34a (2026-09-19, the merge of GRID-01).
 *
 * The list is the audit's census of the flow, not a guess: every route under
 * src/app/api/travel (fifteen), the reservation routes (four), the surfaces the
 * Search section mounts and the panels they open, and the provider clients and
 * their helpers. A change to any of them is a change to the booking flow and
 * needs its own ruling — the ruling that changes it re-pins it here, dated.
 *
 * HOTEL-02 (2026-09-22): THE STAY'S TIMES ARE THE PROPERTY'S, NOT OURS. vendor-commit
 * (unpinned, below) now makes the ONE content call for a stay that names its hotel
 * and writes the property's clock or null; five pinned files are re-dated for the
 * paint and the plumbing around it (a hotel id sent, a scale named, a dead constant
 * gone, a type). No booking call changed — the hotel law hashes them body-for-body.
 *
 * vendor-commit (POST/DELETE /api/trips/[id]/vendor-commit) is NOT in the
 * list: it is the itinerary and calendar WRITER a committed option lands
 * through, not a booking, a prebook, a payment or a provider call. TRAVEL-01
 * did not touch it either, but it is not the booking flow's file.
 *
 * FLIGHT-01 (2026-09-22) — SEARCH IS NOT BOOKING. The pin protects what moves
 * money and holds: prebook, verify, book, pay, cancel, the reservation routes
 * and the checkout panels. The flights SEARCH route and the picker that renders
 * its answer are on the list because the census named every travel route and
 * surface, not because a search is a booking; FLIGHT-01 changed the search's
 * request body (the vendor's own filters and sort, validated) and the picker
 * (one row per flight, its fares) and re-pinned those five files below, each
 * dated with the reason. No prebook, verify, book, pay or cancel file changed.
 */

import { createHash } from 'node:crypto';

export const BOOKING_FLOW_BASE = 'main @ b9eac34a (2026-09-19); UnattachedBookings.tsx re-pinned by REPAINT-04 (2026-09-21), paint only; the flights search route, the adapter and the two flight pickers re-pinned by FLIGHT-01 (2026-09-22), search is not booking; the hotels search route, the two hotel surfaces, the showroom picker, the client, the flight adapter and the flight view re-pinned by HOTEL-01 (2026-09-22), search and display are not booking; the two hotel surfaces, the checkout panel, the planner and the client re-dated by HOTEL-02 (2026-09-22), the stay\'s clock is the property\'s';

export interface BookingFlowPin {
  readonly file: string;
  readonly sha256: string;
}

export const BOOKING_FLOW_FILES: readonly BookingFlowPin[] = [
  // the provider routes — search, content, prebook, book, verify, cancel
  { file: 'src/app/api/travel/activities/search/route.ts', sha256: '8d147c3988d5ec89efd4961128e0a45cd2980358e2fb46843771dbbe4194cb48' },
  { file: 'src/app/api/travel/flights/lane/route.ts', sha256: '9ad617a3320f5abf6c0fc24ef2b38308f100389e4b98cf9a68a50ef9f2ab6b1e' },
  { file: 'src/app/api/travel/hotels/content/route.ts', sha256: '7923035f88437325994e957e73943cd4817ee72b2a9bf2908b0afba0803503e7' },
  { file: 'src/app/api/travel/hotels/reviews/route.ts', sha256: 'c548e5cc1f16808c119711395144ddbc0f4307d22bd67890185b59479000d39d' },
  // HOTEL-01 (2026-09-22): re-pinned — the query gains the vendor's filters and sort, validated by name between the two guards; the answer gains the cards and the env. Search and display are not booking; no prebook/book/pay/cancel call changed.
  // Was 1a677c1ed803b4af213e8d2358f98058613aeffdd98228cb00c585fc59a0c617 at main d56b2cc9.
  { file: 'src/app/api/travel/hotels/search/route.ts', sha256: 'e9d4be8a37f2ca3ef80568c387c53a1378cba2401de8724a1a736dfcf6e97ca4' },
  { file: 'src/app/api/travel/liteapi/book/route.ts', sha256: '69abc595d70da025ac088ec85dc136ca6d6a6576a504d3c4b441e0434508b567' },
  { file: 'src/app/api/travel/liteapi/flights/book/route.ts', sha256: 'cd8fa37b2d950f98063b7562d3d5347dc1c5e1edcf04df695db41306f8400ab3' },
  { file: 'src/app/api/travel/liteapi/flights/prebook/route.ts', sha256: 'ed9b0d2afe376769e42a99a80fc3ce33755324add6a25e4104a5f5c193289c7a' },
  // FLIGHT-01 (2026-09-22): re-pinned — the request body gains the vendor's filters and sort, validated by name between the two guards. Search is not booking; no prebook/verify/book/pay/cancel call changed.
  // Was cbd59f8394b0f9fb52b3df446ba5183e99eb8b62c07cbb4afdbf63d50b6b86d1 at main b9eac34a.
  { file: 'src/app/api/travel/liteapi/flights/search/route.ts', sha256: 'e4535e859762c570a894e9fdf2e5e0ca452e395f6a5e8ab51b55221bc9c2fa0b' },
  { file: 'src/app/api/travel/liteapi/flights/verify/route.ts', sha256: '5143ffafee8ed954d5edc7c639857622375c6b177b9ac067f79553794674d589' },
  { file: 'src/app/api/travel/liteapi/prebook/route.ts', sha256: 'dd6e8c9a0f1437a0661283bb91dc00aeb6dcaf6c227cefc180a3e01f1a60f351' },
  { file: 'src/app/api/travel/locations/cities/route.ts', sha256: 'b6329f0a6c24ee53a683467800f91692fa17ca210f7e31db7dc54b73157e731a' },
  { file: 'src/app/api/travel/locations/countries/route.ts', sha256: '2097ff199301d1b7cbe4f2661164d3fb31287c606da1370e91d05c76b0c3e965' },
  { file: 'src/app/api/travel/transfers/search/route.ts', sha256: 'b55f3bd99f64b07f64d078063f3b408028f2531eae69ddbd82f939687ff2a66e' },
  { file: 'src/app/api/travel/visa/check/route.ts', sha256: '7ce03029e9f50915f673a6aebf28dd0a916631ef24d46862d60780dd93108ab9' },
  // the reservation routes — what a paid booking lands as, and how it is cancelled or adopted
  { file: 'src/app/api/reservations/[id]/cancel/route.ts', sha256: 'c9885c190fd4452be45d06f5a1de052b1f2732d7f0a4b2b8c925a978981d9d33' },
  { file: 'src/app/api/reservations/[id]/route.ts', sha256: 'bf98a65cb2feed22731b09e1d6b3d21f4935fc5f021637e83884b23a9e30767f' },
  { file: 'src/app/api/reservations/unattached/route.ts', sha256: '632107557b1fb4b7de840fb2ff0785bf643a3a28f3e5a2a6d337fed4c71720d0' },
  { file: 'src/app/api/trips/[id]/reservations/route.ts', sha256: '4d58cfc052f756c30c749383654a5de88184d8cda068a3c00342abba4dbf07da' },
  // the surfaces the Search section mounts, and the panels they open
  { file: 'src/components/trips/travelStripModes.tsx', sha256: '4eaae575daae7dcbf0795a40547cf1613af7aa03e2e675bf4aed9ad182642522' },
  // HOTEL-01 (2026-09-22): re-pinned — the filters on the screen, sent on Search, counted; Book and Save act on the selected rate; the property's stated clock on commit. Search and display are not booking; no prebook/book/pay/cancel call changed.
  // Was f2c48b9a3e8aff1ec2fd64a3ead5b1d03f6e4d9f66a60777b25ec1b37da3bb27 at main d56b2cc9.
  // HOTEL-02 (2026-09-22): re-dated — Save names the vendor's hotel and sends no clock; the note repeats what the commit stored. The stay's clock is the property's, read once at commit; no prebook/book/pay/cancel call changed.
  // Was 1924a700c5f1e412a019ccaf09804eb1f8ab39984f9c2343f07d8e50aed6fced at main 81045434.
  { file: 'src/components/trips/PublicHotelSearch.tsx', sha256: 'b397182c40ff6f5e96c712f1bbbfefe5d27993c7c2480138b0a00a2cee8ea062' },
  // FLIGHT-01 (2026-09-22): re-pinned — the leg carries the screen's filters; the search request carries them; a session search count. Search is not booking; no prebook/verify/book/pay/cancel call changed.
  // Was fac335657e50b3fda3be9cf82053fce7f56f04f2c079a1f1a6c6f2c125d11359 at main b9eac34a.
  { file: 'src/components/trips/PublicFlightSearch.tsx', sha256: '4d7573d8600f0502fa42bfaadec3375d4d220dfaf2c357a9ceef2244ec9c7099' },
  { file: 'src/components/trips/PublicActivitySearch.tsx', sha256: '0251b470ea74f8cd787f0b5f6436f32e44615c29f00b6a757ea70bf79c1e2e03' },
  { file: 'src/components/trips/PublicTransferSearch.tsx', sha256: 'b508381f1a7c388eded9c139e7d5b76bd560e36d8db085e440a2eac0cb84a9c4' },
  { file: 'src/components/trips/PublicVisaCheck.tsx', sha256: 'd18df6a909cbd6bbb4332ce84648f7f87b7df6936b2523223f8f5575fb40b507' },
  { file: 'src/components/trips/PublicCategorySearch.tsx', sha256: '26c51b4c613f0011b5aa7d7015d839eceb26c10616960c82010986b708023771' },
  // HOTEL-01 (2026-09-22): re-pinned — one card per hotel with its rates, the filter bar, the lowest-rate line, the difference line, the env-honest footer. Search and display are not booking; no prebook/book/pay/cancel call changed.
  // Was c73147fe7242acc8a3f70e9471beaafa43b65a479e1ee6b02019c37187734a95 at main d56b2cc9.
  // HOTEL-02 (2026-09-22): re-dated — the catalog's guest rating names its documented scale (/10). The stay's clock is the property's, read once at commit; no prebook/book/pay/cancel call changed.
  // Was 3520aeb26fb0be39ee4c108583cb92da4a6e843f91029411bd63030a26924f20 at main 81045434.
  { file: 'src/components/trips/HotelResultsView.tsx', sha256: '54594766ceda7c43d3caa055c91490ed4202896eea92ce3d1254c815f6876122' },
  // HOTEL-01 (2026-09-22): re-pinned — the dead provider's two lines deleted; a null rating says so (the showroom's picker, mounted nowhere). Search and display are not booking; no prebook/book/pay/cancel call changed.
  // Was 91e32a6df274f9f92a39329181d5ba3c7980c2a389a49044126f819f1e55284a at main d56b2cc9.
  { file: 'src/components/trips/HotelPicker.tsx', sha256: 'e869b851fb14b80d4a73e01f8113a902004498822d0f2af128f1215394972c41' },
  { file: 'src/components/trips/HotelGallery.tsx', sha256: '64e34a08a092e0b8aed934fdf1fe5dc4416212bcc4cc4a2d3dcd855ab011b810' },
  { file: 'src/components/trips/HotelMap.tsx', sha256: '59b57e947baaec731a14f226b9f95434445e56286cebfd5f0ac1e234aa0cac3a' },
  // FLIGHT-01 (2026-09-22): re-pinned — the same as PublicFlightSearch — filters on the leg, sent on Search, counted. Search is not booking; no prebook/verify/book/pay/cancel call changed.
  // Was 6495e6f8900cf80d357eb8b0b09d09bf91019b48882bf697c559136eb46ecbea at main b9eac34a.
  { file: 'src/components/trips/FlightPicker.tsx', sha256: 'fab753b0ba0166c634fd82b95c69fa009965c170ca7f07f795105214c5429d73' },
  // FLIGHT-01 (2026-09-22): re-pinned — one row per flight with its fares, the filter bar, the lowest-fare line, the difference line. Search is not booking; no prebook/verify/book/pay/cancel call changed.
  // Was d0f24e94fc1714dc514a18b3b84e445f1d9b75c150252f46c8b76698e9bc9587 at main b9eac34a.
  // HOTEL-01 (2026-09-22): re-pinned — the session search count is the shared SearchCount control; no other change. Search and display are not booking; no prebook/book/pay/cancel call changed.
  // Was 5ec7d6289a40f4f78457e5c381609d9d65686148b352eef4a1c9f5f55a1176a3 at main d56b2cc9.
  { file: 'src/components/trips/FlightPickerView.tsx', sha256: 'e85e7187bed9099999b041ae6a05a9d87f0672ebca1b5ae4fc1451df8d64e853' },
  { file: 'src/components/trips/ActivityResultsView.tsx', sha256: 'f389031ad67caa345a912a41b45aeced4538fb407a91dea89acb98f6f515c97b' },
  // HOTEL-02 (2026-09-22): re-dated — the content rating renders on the scale the client types (/5, was /10) — paint only. The stay's clock is the property's, read once at commit; no prebook/book/pay/cancel call changed.
  // Was 417cf3e6cfced5f38dda66fc047218437703edbc2fd5b459a9d5f0189f15c3b6 at main 81045434.
  { file: 'src/components/trips/CheckoutPanel.tsx', sha256: '77564ce7471de9c4cb8dee188e596f3fe0b82f3526ba8fb39858e9831f992ff5' },
  { file: 'src/components/trips/LiteApiFlightCheckoutPanel.tsx', sha256: 'c018712700fe9e24c0ff51b417ab3658060f8dbe8784a459b33da4eb6a70365d' },
  { file: 'src/components/trips/CancelBookingDialog.tsx', sha256: '7e50c4ece72171929446f4734622ccdf8b6b75bb87c2c6c3c5aa101ec26fd95d' },
  { file: 'src/components/trips/TripBookings.tsx', sha256: '1c74ce7438ea6ce7013a4c8de4bbd685f2865e2fe0f8d3c3a7f4a119435cc5bd' },
  // REPAINT-04 (2026-09-21): re-pinned — one class on the "Add to <trip>" ghost button
  // (text-white → text-brand-purple, invisible on cream). Paint only; no call changed.
  // Was d5f8e0be428de6054eb756c0301c1e064e825f6ddb013d45cc332b7ca6157492 at main b9eac34a.
  { file: 'src/components/trips/UnattachedBookings.tsx', sha256: '09d7767b9a1679d0481efd506da7002b4ecfa4ee6a68f539a53e997726bda44b' },
  // HOTEL-02 (2026-09-22): re-dated — the dead lodging default constant deleted; the lodging commit names the vendor's hotel. The stay's clock is the property's, read once at commit; no prebook/book/pay/cancel call changed.
  // Was 8c5bf217bf1a2c2b65f3f969be5c02016455d53d9977fa5406600d14cb894ed5 at main 81045434.
  { file: 'src/components/trips/TripPlannerAI.tsx', sha256: '9cdf491def14615d0f5b0d8ba168bb7026131b05c12b3d3a113be0b3ee3ddf9d' },
  // the provider clients and their helpers
  // HOTEL-01 (2026-09-22): re-pinned — the search half carries the vendor's filter and sort fields; every booking function is byte-identical (the hotel law pins each body). Search and display are not booking; no prebook/book/pay/cancel call changed.
  // Was 9806e3b58ab2b8d4845e7870f89078d473d27007cae0adb247af0673907f176a at main d56b2cc9.
  // HOTEL-02 (2026-09-22): re-dated — HotelContent types the vendor's documented check-in / check-out object; the two rating comments name their scales — types and comments only, no function body changed. The stay's clock is the property's, read once at commit; no prebook/book/pay/cancel call changed.
  // Was bbb4c9afb8a5cd6237088ce3a750bb9a22c2ef4fcbbadb25bf99db9b17413ac2 at main 81045434.
  { file: 'src/lib/liteapiClient.ts', sha256: '9840759972a7b97231ddaf0a3b51e766d78cd4922621f38519a5cbd81234f8cf' },
  { file: 'src/lib/liteapiFlightsClient.ts', sha256: 'f5ecffcfa0b71b8cbe4ba8868a2f8aabd4e326129bacbf9a675e79b17e63fd2f' },
  // FLIGHT-01 (2026-09-22): re-pinned — tri-state fare attributes, segment views with the operating carrier, the flight identity; the `!!terms` coercion gone. Search is not booking; no prebook/verify/book/pay/cancel call changed.
  // Was d851de5d68fada3cffddd88ddcc38005b5a9c739e73c0920c213f282c30fa879 at main b9eac34a.
  // HOTEL-01 (2026-09-22): re-pinned — the tri-state readers come from the one helper, src/lib/travel/stated.ts; no other change. Search and display are not booking; no prebook/book/pay/cancel call changed.
  // Was e808226d162022fce929170a104ee63dd715825c933bf9d7b371e754c533aef7 at main d56b2cc9.
  { file: 'src/lib/liteapiFlightAdapter.ts', sha256: 'dbd95eb79c6a0bd2f561e8b8a9a537f71533e6e2ad22b65893ffd174482fa31a' },
  { file: 'src/lib/viatorClient.ts', sha256: '4232b6fc9b14e860ad3c5f9a9e6777152f2ef5b3b98ae920b58952dd0a65ce14' },
  { file: 'src/lib/travelBuddyClient.ts', sha256: 'b745272d633d5322d7768c755fa96571a76f7e170e182474e4660fd94f2351f1' },
  { file: 'src/lib/flightsLane.ts', sha256: 'c39972d6fd517124ca841487c994013583f5faeb05e2001080f1bf80d6352cee' },
  { file: 'src/lib/arrivals/liteapiBooking.ts', sha256: '2297a1c8cf1e0de4e3255545835a909b367cc27aeaf18bf14533803f1f954aff' },
  { file: 'src/lib/travelSearchQuota.ts', sha256: 'd85603f7cc6567c02769ac997bfdc8d6112855249b44f4bde9fdd8f35ffeeeea' },
  { file: 'src/lib/travelErrors.ts', sha256: '21461573d159b13444b054b736b659f728d5ae30cf2c3ddccb0ddc1f1fd7ee7d' },
  { file: 'src/lib/travelSourceRegistry.ts', sha256: '93646472a2376cecc49695c98626b04f9f8caa5e8fcdf80d015bbdae05dfae65' },
];

/** The pin: the sha256 hex of a file's whole text, UTF-8. */
export function bookingFlowSha256(wholeText: string): string {
  return createHash('sha256').update(wholeText, 'utf8').digest('hex');
}
