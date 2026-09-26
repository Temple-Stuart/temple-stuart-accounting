/**
 * The cancel law's CANCEL-02 clause, seeded (2026-09-26).
 *
 * CANCEL-02 made the cancellation email a requirement of the cancel law (clause 6:
 * the named absence became the send). These seeds put back, one at a time, each
 * shape the ruling forbids:
 *
 *   · the hotel cancel stops emailing (clause 6);
 *   · the flight cancel emails BEFORE the transaction commits (clause 6);
 *   · a missing recipient falls back to the account holder (clause 6);
 *   · an email failure fails the cancel (clause 6);
 *   · the figures come from the answer instead of the rows (clause 6);
 *   · a caller fires the STATUS-01 'ticketed' slot (clause 6).
 *
 * Each must fail THE CANCEL LAW by name. The anchors occur exactly once in their
 * file, which the harness enforces before it runs anything.
 */
import type { Seed } from '../prove';

const ROUTE = 'src/app/api/reservations/[id]/cancel/route.ts';
const LEAF = 'src/lib/reservations/cancellation.ts';

const SEEDS: Seed[] = [
  {
    name: 'cancel02-a the hotel cancel stops emailing (clause 6)',
    file: ROUTE,
    find: "  const emailStatus = await sendCancellationEmail(owned, accountEmail, { kind: 'cancelled', moneyEvents, vouchers: [], providerStatus: landed.parsed.status });",
    replace: "  const emailStatus = { sent: false as const, error: 'not sent' };",
    expect: 'the hotel cancel does not email the customer AFTER the transaction commits',
  },
  {
    name: 'cancel02-b the flight cancel emails before the transaction commits (clause 6)',
    file: ROUTE,
    find: "  // ─── Land, then persist — ONE transaction ────────────────────────────────\n  // The answer lands as an arrival (liteapi · cancellation, composed id), and",
    replace: "  await sendCancellationEmail(owned, accountEmail, { kind: 'cancel_pending' });\n  // ─── Land, then persist — ONE transaction ────────────────────────────────\n  // The answer lands as an arrival (liteapi · cancellation, composed id), and",
    expect: 'the flight cancel does not email the customer AFTER the transaction commits',
  },
  {
    name: 'cancel02-c a missing recipient falls back to the account holder (clause 6)',
    file: LEAF,
    find: "  return guest.length > 0 ? { to: guest } : { to: null, reason: 'no_recipient_stated' };",
    replace: "  return guest.length > 0 ? { to: guest } : { to: accountEmail ?? '', reason: 'no_recipient_stated' } as unknown as CancelRecipient;",
    expect: 'cancelRecipient does not send an account row to the account and a guest row to its stated guestEmail, else nobody by name',
  },
  {
    name: 'cancel02-d an email failure fails the cancel (clause 6)',
    file: ROUTE,
    find: '    return { sent: false, error: errorClass };\n  }\n}',
    replace: '    throw emailErr;\n  }\n}',
    expect: 'an email failure would fail the cancel',
  },
  {
    name: 'cancel02-e the figures come from the answer instead of the rows (clause 6)',
    file: ROUTE,
    find: "      ? lifecycleEmail({ kind: 'cancelled', ...common, ...cancellationEmailFacts(outcome.moneyEvents, outcome.vouchers), providerStatus: outcome.providerStatus })",
    replace: "      ? lifecycleEmail({ kind: 'cancelled', ...common, refund: { amountCents: null, currency: null }, fee: { amountCents: null, currency: null }, destination: null, vouchers: [], providerStatus: outcome.providerStatus })",
    expect: 'the email figures are not read from the rows',
  },
  {
    name: "cancel02-f a caller fires the STATUS-01 'ticketed' slot (clause 6)",
    file: 'src/lib/reservations/refreshFlightReservation.ts',
    find: "  if (row.lane !== 'flight') {",
    replace: "  void lifecycleEmail({ kind: 'ticketed', name: '', lane: 'flight', reference: '', checkinDate: null, checkoutDate: null, manageUrl: null, pnr: null });\n  if (row.lane !== 'flight') {",
    expect: 'fires the ticketed lifecycle email — STATUS-01 owns that',
  },
];

export default SEEDS;
