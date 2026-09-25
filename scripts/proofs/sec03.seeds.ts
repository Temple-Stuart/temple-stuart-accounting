/**
 * The privacy-and-money law's seeded regressions (SEC-03, 2026-09-25).
 *
 * The ruling says two things: no PII in a URL, no fabricated number in a ledger.
 * These seeds put back, one at a time, each shape the ruling removed or forbade:
 *
 *   · the customer email rides the returnUrl again (clause 1);
 *   · the confirm page reads it off the query string again (clause 1);
 *   · the prebook route stops writing the contact row (clause 2);
 *   · a failed contact write hands the browser the secretKey anyway (clause 2);
 *   · the book route reserves quota before it has read the contact (clause 3);
 *   · the recipient is substituted (clause 3);
 *   · a retry sends a second email (clause 3);
 *   · a price the vendor did not state becomes 0 — flights, and hotels (clause 4);
 *   · a currency is invented with a literal — flights, and hotels (clause 4);
 *   · the hotel confirm page posts the price it displayed into the ledger (clause 4);
 *   · the hotel confirm page defaults the currency (clause 4);
 *   · reservations.finalPriceCents is NOT NULL again (clause 5);
 *   · the migration stops opening commission_ledger.grossAmountCents (clause 5);
 *   · a reader divides a NULL price with no guard (clause 6);
 *   · the bookings total sums a NULL as 0 (clause 6);
 *   · the export drops the Dollars twin of a NULL cents column (clause 6);
 *   · a template refuses a NULL total (clause 6);
 *   · the matcher reads 0 as unknown again (clause 7);
 *   · CANCELLED_WITH_CHARGES is unmapped again (clause 8).
 *
 * Each must fail THE PRIVACY-AND-MONEY LAW by name. The anchors occur exactly once
 * in their file, which the harness enforces before it runs anything.
 */
import type { Seed } from '../prove';

const PANEL = 'src/components/trips/LiteApiFlightCheckoutPanel.tsx';
const FCONFIRM = 'src/app/booking/flight-confirm/page.tsx';
const HCONFIRM = 'src/app/booking/confirm/page.tsx';
const PREBOOK = 'src/app/api/travel/liteapi/flights/prebook/route.ts';
const FBOOK = 'src/app/api/travel/liteapi/flights/book/route.ts';
const HBOOK = 'src/app/api/travel/liteapi/book/route.ts';
const MIGRATION = 'prisma/migrations/20260925130000_sec_03_no_pii_no_fabricated_number/migration.sql';

const SEEDS: Seed[] = [
  {
    name: 'sec03-a the customer email rides the returnUrl again (clause 1)',
    file: PANEL,
    find: '      transactionId: prebook.transactionId,\n      // LANE-01: the owner\'s trip, only when the surface gave one.',
    replace: '      transactionId: prebook.transactionId,\n      contactEmail: email.trim(),\n      // LANE-01: the owner\'s trip, only when the surface gave one.',
    expect: 'builds a URL whose query carries an email (contactEmail)',
  },
  {
    name: 'sec03-b the confirm page reads the email off the query string again (clause 1)',
    file: FCONFIRM,
    find: "  const transactionId = params.get('transactionId') ?? '';",
    replace: "  const transactionId = params.get('transactionId') ?? '';\n  const contactEmail = params.get('contactEmail') ?? '';",
    expect: 'reads an email off a query string (contactEmail)',
  },
  {
    name: 'sec03-c the prebook route stops writing the contact row (clause 2)',
    file: PREBOOK,
    find: '      await prisma.prebook_contacts.create({',
    replace: '      await Promise.resolve({',
    expect: 'does not write the contact row',
  },
  {
    name: 'sec03-d a failed contact write hands the browser the secretKey anyway (clause 2)',
    file: PREBOOK,
    find: "          code: 'contact_not_stored',\n        },\n        { status: 500 }",
    replace: "          code: 'contact_not_stored',\n          secretKey: prebook.secretKey,\n        },\n        { status: 500 }",
    expect: 'carries a secretKey',
  },
  {
    name: 'sec03-e the book route reserves quota before it has read the contact (clause 3)',
    file: FBOOK,
    find: '    const contact = await prisma.prebook_contacts.findUnique({ where: { prebookId } });',
    replace: "    await reserveTravelSearch('liteapiflightbooking');\n    const contact = await prisma.prebook_contacts.findUnique({ where: { prebookId } });",
    expect: 'does not read the stored contact before the quota reservation',
  },
  {
    name: 'sec03-f the recipient is substituted (clause 3)',
    file: FBOOK,
    find: '            to: contact.contactEmail,',
    replace: '            to: userEmail ?? contact.contactEmail,',
    expect: 'the recipient is not the stored contact',
  },
  {
    name: 'sec03-g a retry sends a second email (clause 3)',
    file: FBOOK,
    find: "      if (landed.reservationOutcome === 'existing') {\n        emailStatus = { sent: 'earlier' };",
    replace: "      if (false) {\n        emailStatus = { sent: 'earlier' };",
    expect: 'does not keep one email attempt per booking',
  },
  {
    name: 'sec03-h a flight price the vendor did not state becomes 0 (clause 4)',
    file: FBOOK,
    find: '                finalPriceCents: statedCents,',
    replace: '                finalPriceCents: statedCents ?? 0,',
    expect: 'writes ?? 0',
  },
  {
    name: 'sec03-i a hotel price the vendor did not state becomes 0 (clause 4)',
    file: HBOOK,
    find: '                grossAmountCents: statedCents,',
    replace: '                grossAmountCents: statedCents ?? 0,',
    expect: 'writes ?? 0',
  },
  {
    name: 'sec03-j a flight currency is invented with a literal (clause 4)',
    file: FBOOK,
    find: '            const resolvedCurrency = parsed.currency ?? contact.searchCurrency;',
    replace: "            const resolvedCurrency = parsed.currency ?? contact.searchCurrency ?? 'USD';",
    expect: 'invents a currency with a literal',
  },
  {
    name: 'sec03-k a hotel currency is invented with a literal (clause 4)',
    file: HBOOK,
    find: '            const resolvedCurrency = parsed.currency ?? currency;',
    replace: "            const resolvedCurrency = parsed.currency ?? currency ?? 'USD';",
    expect: 'invents a currency with a literal',
  },
  {
    name: 'sec03-l the hotel confirm page posts the price it displayed into the ledger (clause 4)',
    file: HCONFIRM,
    find: '          guestCount: 1,\n',
    replace: '          guestCount: 1,\n          finalPriceCents: Math.round((price ?? 0) * 100),\n',
    expect: 'posts the price it displayed into the ledger',
  },
  {
    name: 'sec03-m the hotel confirm page defaults the currency (clause 4)',
    file: HCONFIRM,
    find: "  const currency = params.get('currency') ?? '';",
    replace: "  const currency = params.get('currency') || 'USD';",
    expect: 'carries a currency literal',
  },
  {
    name: 'sec03-n reservations.finalPriceCents is NOT NULL again (clause 5)',
    file: 'prisma/schema.prisma',
    find: '  finalPriceCents          Int? // integer cents to avoid float math',
    replace: '  finalPriceCents          Int // integer cents to avoid float math',
    expect: 'reservations.finalPriceCents is not nullable',
  },
  {
    name: 'sec03-o the migration stops opening commission_ledger.grossAmountCents (clause 5)',
    file: MIGRATION,
    find: 'ALTER TABLE "commission_ledger" ALTER COLUMN "grossAmountCents" DROP NOT NULL;',
    replace: '-- (grossAmountCents left NOT NULL)',
    expect: 'the SEC-03 migration lacks',
  },
  {
    name: 'sec03-p a reader divides a NULL price with no guard (clause 6)',
    file: 'src/app/api/reservations/unattached/route.ts',
    find: '      amountUsd: r.finalPriceCents === null ? null : r.finalPriceCents / 100,',
    replace: '      amountUsd: r.finalPriceCents / 100,',
    expect: 'does not pass a NULL price through as null',
  },
  {
    name: 'sec03-q the bookings total sums a NULL as 0 (clause 6)',
    file: 'src/components/trips/TripBookings.tsx',
    find: '  const cents = rows.reduce((s, r) => s + (r.amountUsd === null ? 0 : Math.round(r.amountUsd * 100)), 0);',
    replace: '  const cents = rows.reduce((s, r) => s + Math.round((r.amountUsd ?? 0) * 100), 0);',
    expect: 'sums a NULL price',
  },
  {
    name: 'sec03-r the export drops the Dollars twin of a NULL cents column (clause 6)',
    file: 'src/app/api/export/route.ts',
    find: "      if (/Cents$/.test(k)) out[k.replace(/Cents$/, 'Dollars')] = '';",
    replace: '      // (no twin)',
    expect: 'drops the Dollars twin',
  },
  {
    name: 'sec03-s a template refuses a NULL total (clause 6)',
    file: 'src/lib/emailTemplates/flightConfirmation.ts',
    find: '  totalAmountCents: number | null;',
    replace: '  totalAmountCents: number;',
    expect: 'the template does not accept a NULL total',
  },
  {
    name: 'sec03-t the matcher reads 0 as unknown again (clause 7)',
    file: 'src/lib/runway/reservationMatcher.ts',
    find: '    const amountKnown = r.finalPriceCents !== null;',
    replace: '    const amountKnown = r.finalPriceCents !== null && r.finalPriceCents > 0;',
    expect: 'reads 0 as unknown',
  },
  {
    name: 'sec03-u CANCELLED_WITH_CHARGES is unmapped again (clause 8)',
    file: 'src/lib/reservations/flightStatus.ts',
    find: "  if (s === 'CANCELLED' || s === 'CANCELLED_WITH_CHARGES') return 'cancelled';",
    replace: "  if (s === 'CANCELLED') return 'cancelled';",
    expect: 'does not map CANCELLED_WITH_CHARGES',
  },
];

export default SEEDS;
export { SEEDS };
