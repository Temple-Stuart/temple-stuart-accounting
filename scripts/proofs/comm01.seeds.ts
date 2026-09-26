/**
 * The commission law's seeded regressions (COMM-01, 2026-09-26).
 *
 * The ruling says one thing: THE COMMISSION IS THE VENDOR'S STATED FIGURE, NEVER
 * A ZERO, AND IT LOCKS WHEN THE VENDOR SAYS IT LOCKS. These seeds put back, one
 * at a time, each shape the ruling removed or forbade:
 *
 *   · the hotel book route defaults the commission to 0 (clause 2);
 *   · the flight book route writes a literal 0 (clause 2);
 *   · the prebook parser defaults CONFIRMED-style 0 again (clause 2);
 *   · the book body accepts a browser commission again (clause 4);
 *   · the confirm page posts one again (clause 4);
 *   · the lock ignores the check-out date (clause 3);
 *   · the lock runs without a stated commission (clause 3);
 *   · the lock takes our clock (clause 3);
 *   · a third file writes the locked figure (clause 1);
 *   · the checkout panel hides NULL as if zero (clause 5);
 *   · the cron stops re-reading the checked-out stay (clause 7);
 *   · the migration loses its CHECK (clause 6).
 *
 * Each must fail THE COMMISSION LAW by name. The anchors occur exactly once in
 * their file, which the harness enforces before it runs anything.
 */
import type { Seed } from '../prove';

const HOTEL_BOOK = 'src/app/api/travel/liteapi/book/route.ts';
const FLIGHT_BOOK = 'src/app/api/travel/liteapi/flights/book/route.ts';
const HOTEL_CLIENT = 'src/lib/liteapiClient.ts';
const CONFIRM_PAGE = 'src/app/booking/confirm/page.tsx';
const APPLY = 'src/lib/reservations/applyVendorState.ts';
const CRON_ROUTE = 'src/app/api/cron/reservations-refresh/route.ts';
const PANEL = 'src/components/trips/CheckoutPanel.tsx';
const MIGRATION = 'prisma/migrations/20260926150000_comm_01_vendor_commission/migration.sql';

const SEEDS: Seed[] = [
  {
    name: 'comm01-a the hotel book route defaults the commission to 0 (clause 2)',
    file: HOTEL_BOOK,
    find: "                commissionAmountCents: statedCommission === null ? null : Math.round(statedCommission * 100),",
    replace: "                commissionAmountCents: Math.round((statedCommission ?? 0) * 100),",
    expect: 'defaults a commission',
  },
  {
    name: 'comm01-b the flight book route writes a literal 0 (clause 2)',
    file: FLIGHT_BOOK,
    find: '                commissionAmountCents: null,',
    replace: '                commissionAmountCents: 0,',
    expect: 'writes a literal 0 commission',
  },
  {
    name: 'comm01-c the prebook parser defaults the commission again (clause 2)',
    file: HOTEL_CLIENT,
    find: "    commission: typeof d.commission === 'number' ? d.commission : null,",
    replace: "    commission: d.commission ?? 0,",
    expect: 'the prebook parser defaults the commission',
  },
  {
    name: 'comm01-d the book body accepts a browser commission again (clause 4)',
    file: HOTEL_BOOK,
    find: "    if (Object.prototype.hasOwnProperty.call(body, 'commissionAmountCents')) {",
    replace: "    if (false) {",
    expect: 'accepts a commission from the client',
  },
  {
    name: 'comm01-e the confirm page posts a commission again (clause 4)',
    file: CONFIRM_PAGE,
    find: "          ...(currency ? { currency } : {}),\n",
    replace: "          ...(currency ? { currency } : {}),\n          commissionAmountCents: 0,\n",
    expect: 'the confirm page posts a ledger amount',
  },
  {
    name: 'comm01-f the lock ignores the check-out date (clause 3)',
    file: APPLY,
    find: '    const afterCheckout = row.checkoutDate !== null && row.checkoutDate < vendor.readAt;',
    replace: '    const afterCheckout = true;',
    expect: 'does not require checkoutDate < readAt',
  },
  {
    name: 'comm01-g the lock runs without a stated commission (clause 3)',
    file: APPLY,
    find: "    } else if (vendor.commission === null) {\n      commissionLock = { outcome: 'not_stated' };",
    replace: "    } else if (false) {\n      commissionLock = { outcome: 'not_stated' };",
    expect: 'locks without a stated commission',
  },
  {
    name: 'comm01-h the lock takes our clock (clause 3)',
    file: APPLY,
    find: '      const locked = await ports.lockCommission(row.id, figures, vendor.readAt, vendor.arrivalId);',
    replace: '      const locked = await ports.lockCommission(row.id, figures, new Date(), vendor.arrivalId);',
    expect: 'reads the clock',
  },
  {
    name: 'comm01-i a third file writes the locked figure (clause 1)',
    file: CRON_ROUTE,
    find: 'const BATCH = 20;',
    replace: "const BATCH = 20;\nexport async function relock(id: string) { await prisma.commission_ledger.updateMany({ where: { reservationId: id }, data: { status: 'confirmed', lockedCommissionCents: 0 } }); }",
    expect: 'writes a locked commission figure',
  },
  {
    name: 'comm01-j the checkout panel hides NULL as if zero (clause 5)',
    file: PANEL,
    find: "                <span>{prebook.commission === null ? 'not stated' : money(prebook.commission, prebook.currency)}</span>",
    replace: "                <span>{money(prebook.commission ?? 0, prebook.currency)}</span>",
    expect: 'does not render a NULL commission as not stated',
  },
  {
    name: 'comm01-k the cron stops re-reading the checked-out stay (clause 7)',
    file: CRON_ROUTE,
    find: "          { lane: 'hotel', status: 'confirmed', checkoutDate: { lt: new Date() }, commission_ledger: { some: { status: 'estimated' } } },\n",
    replace: '',
    expect: 'does not re-read a checked-out stay',
  },
  {
    name: 'comm01-l the migration loses its CHECK (clause 6)',
    file: MIGRATION,
    find: `    CHECK ("status" IN ('estimated', 'confirmed', 'paid', 'cancelled'));`,
    replace: `    CHECK ("status" IN ('estimated', 'confirmed', 'paid', 'cancelled', 'bogus'));`,
    expect: 'four-word CHECK',
  },
];

export default SEEDS;
