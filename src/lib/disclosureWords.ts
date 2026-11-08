/**
 * BOOK-DISCLOSE-01 (Alex, 2026-11-08; board K tag 4) — the commission said out loud: one line directly under the
 * booking box on the home page (src/components/landing/Landing.tsx, right after the LandingBookingSection mount).
 * A pure leaf: it imports nothing, and the page renders these words, never types them.
 *
 * WHY "MAY" — what a booking here can pay, by the code (each path read on main ec91005):
 *   · hotels (LiteAPI): the vendor states a commission at prebook, or NULL — "not stated" at the checkout, never 0
 *     (src/lib/liteapiClient.ts:705-707 and :1137-1145; src/components/trips/CheckoutPanel.tsx:105-106 and :699-702);
 *   · flights (LiteAPI): the vendor documents no seller commission for a flight (a distributorCommission only, and not
 *     which party we are) — the commission_ledger row's commissionAmountCents is null, never 0, never inferred
 *     (src/app/api/travel/liteapi/flights/book/route.ts:273-289);
 *   · things to do and getting around (Viator): the validated affiliate link (src/config/affiliates.ts:76
 *     viatorAffiliateUrl, :116 validatedAffiliateUrl; src/app/api/travel/activities/search/route.ts:99;
 *     src/app/api/travel/transfers/search/route.ts:94);
 *   · visa: the official government link only, never an affiliate (src/components/trips/VisaResultView.tsx:8-12);
 *   · events: not sold here (src/components/landing/ExperiencesSection.tsx:81 CLOSING_LINE);
 *   · travel insurance and stay connected: SOON, nothing sold (src/components/trips/travelStripModes.tsx:194, :201).
 * A booking can pay a commission (a hotel's stated one, a Viator affiliate's), can pay none (a visa, an event), and
 * for a flight the seller's commission is not documented (null, never 0, never inferred) — so "may".
 * Board K's first draft, "I earn a commission", claimed more than the code shows.
 */
export const COMMISSION_LINE = 'When you book here, I may earn a commission.';
