/**
 * The budget-link law's seeded regressions (LINK-02, 2026-09-27).
 *
 * The ruling says one thing: A BOOKING IS LINKED TO THE BUDGET LINE IT FULFILS, BY
 * A HUMAN, AND THE LINE READS BOOKED. These seeds put back, one at a time, each
 * shape the ruling forbids:
 *
 *   · another file writes the link table (clause 1);
 *   · a line is chosen by a name, the select pre-selects, or the lines are ranked (clause 2);
 *   · the status leaf does money arithmetic or reads the wrong way, the ledger types
 *     its status, or the old honesty note comes back (clause 3);
 *   · the unlink skips the audit port, or the route writes audit_log by hand (clause 4);
 *   · the same-trip rule or the one-link rule goes (clause 5);
 *   · the migration loses its UNIQUE, a RESTRICT, or gains a DEFAULT (clause 6);
 *   · a writer stops asking before it deletes or moves (clause 7).
 *
 * Each must fail THE BUDGET-LINK LAW by name. The anchors occur exactly once in their
 * file, which the harness enforces before it runs anything.
 */
import type { Seed } from '../prove';

const ROUTE = 'src/app/api/reservations/[id]/budget-link/route.ts';
const LEAF = 'src/lib/reservations/budgetLink.ts';
const STATUS_LEAF = 'src/lib/trips/lineStatus.ts';
const ACTUALS = 'src/app/api/trips/[id]/actuals/route.ts';
const LEDGER = 'src/components/trips/TripBudgetActual.tsx';
const CONTROL = 'src/components/trips/TripBookings.tsx';
const TRIP_ROUTE = 'src/app/api/trips/[id]/route.ts';
const ATTACH_ROUTE = 'src/app/api/reservations/[id]/route.ts';
const MIGRATION = 'prisma/migrations/20260927120000_link_02_reservation_budget_links/migration.sql';

const SEEDS: Seed[] = [
  {
    name: 'link02-a the actuals route writes a link (clause 1)',
    file: ACTUALS,
    find: '    const paidIds = new Set(chargeAccepted.map((c) => c.reservationId));',
    replace: "    const paidIds = new Set(chargeAccepted.map((c) => c.reservationId));\n    if (reservations[0] && budgetLines[0]) await prisma.reservation_budget_links.create({ data: { userId: user.id, reservationId: reservations[0].id, budgetLineItemId: budgetLines[0].id, linkedAt: new Date(), linkedBy: 'auto' } });",
    expect: 'writes reservation_budget_links — the budget-link route is its only writer',
  },
  {
    name: 'link02-b the line is found by its description, not the id the owner named (clause 2)',
    file: ROUTE,
    find: 'findLine: (id, userId) => prisma.budget_line_items.findFirst({ where: { id, userId }, select: { id: true, tripId: true, description: true } }),',
    replace: "findLine: (id, userId) => prisma.budget_line_items.findFirst({ where: { OR: [{ id }, { description: { contains: 'Lodging' } }], userId }, select: { id: true, tripId: true, description: true } }),",
    expect: 'does not read the line by its id and its owner alone',
  },
  {
    name: 'link02-c the Budget line select pre-selects the first line (clause 2)',
    file: CONTROL,
    find: '<select\n                                value=""',
    replace: '<select\n                                value={lines[0].budgetLineItemId}',
    expect: 'the Budget line select pre-selects a line',
  },
  {
    name: 'link02-d the lines are ranked by amount (clause 2)',
    file: CONTROL,
    find: '                                {lines.map((l) => (',
    replace: '                                {[...lines].sort((a, b) => Number(a.amount) - Number(b.amount)).map((l) => (',
    expect: 'sorts or narrows the trip\'s lines',
  },
  {
    name: 'link02-e the status leaf does money arithmetic (clause 3)',
    file: STATUS_LEAF,
    find: '  if (mine.length === 0) return LINE_STATUS.saved;',
    replace: '  if (mine.length * 1 === 0) return LINE_STATUS.saved;',
    expect: 'lineStatusOf does arithmetic or reads money',
  },
  {
    name: 'link02-f one paid booking makes the whole line paid (clause 3)',
    file: STATUS_LEAF,
    find: 'return mine.every((l) => l.bankConfirmed) ? LINE_STATUS.paid : LINE_STATUS.booked;',
    replace: 'return mine.some((l) => l.bankConfirmed) ? LINE_STATUS.paid : LINE_STATUS.booked;',
    expect: 'lineStatusOf with two linked bookings, one unpaid reads',
  },
  {
    name: 'link02-g the ledger types its status instead of deriving it (clause 3)',
    file: LEDGER,
    find: '                      const status = lineStatusOf({ id: it.id }, statusLinks);',
    replace: '                      const status = LINE_STATUS.saved;',
    expect: "a line's status does not come from lineStatusOf",
  },
  {
    name: 'link02-h the old honesty note comes back (clause 3)',
    file: ACTUALS,
    find: '// HONESTY NOTE: a line with no link is "Saved" — the planned figure alone. A',
    replace: '// HONESTY NOTE: per-budget-line "booked" mapping is structurally impossible. A',
    expect: "honesty note still says a line cannot read Booked",
  },
  {
    name: 'link02-i the unlink skips the audit port (clause 4)',
    file: LEAF,
    find: "    kind: 'reservation_budget_unlinked',",
    replace: "    kind: 'reservation_budget_linked',",
    expect: 'the unlink is not recorded through the audit port after the delete',
  },
  {
    name: 'link02-j the route writes audit_log by hand (clause 4)',
    file: ROUTE,
    find: "import { recordBookingEvent } from '@/lib/reservations/auditTrail';",
    replace: "import { recordBookingEvent } from '@/lib/reservations/auditTrail';\nimport { writeAuditLog } from '@/lib/audit/writeAuditLog';\nvoid writeAuditLog;",
    expect: 'writes audit_log by hand — through the audit port',
  },
  {
    name: 'link02-k a line of another trip is linked (clause 5)',
    file: LEAF,
    find: '  if (owned.tripId === null || line.tripId === null || owned.tripId !== line.tripId) {',
    replace: '  if (line.tripId === null) {',
    expect: 'a line of another trip (or a booking on none) is not refused 409 by name',
  },
  {
    name: 'link02-l a second link is not refused (clause 5)',
    file: LEAF,
    find: '  const existing = await ports.findLink(owned.id, user.id);',
    replace: '  const existing = null as null | { budgetLineItemId: string };',
    expect: 'a second link for a booking is not refused 409 by name',
  },
  {
    name: 'link02-m the migration loses one-line-per-booking (clause 6)',
    file: MIGRATION,
    find: 'CREATE UNIQUE INDEX "reservation_budget_links_reservationId_key"',
    replace: 'CREATE INDEX "reservation_budget_links_reservationId_key"',
    expect: 'does not make one line per booking',
  },
  {
    name: 'link02-n the line foreign key cascades (clause 6)',
    file: MIGRATION,
    find: 'REFERENCES "budget_line_items"("id") ON DELETE RESTRICT',
    replace: 'REFERENCES "budget_line_items"("id") ON DELETE CASCADE',
    expect: 'the budgetLineItemId foreign key is not ON DELETE RESTRICT',
  },
  {
    name: 'link02-o linkedAt gains a DEFAULT (clause 6)',
    file: MIGRATION,
    find: '"linkedAt"         TIMESTAMPTZ(6) NOT NULL,',
    replace: '"linkedAt"         TIMESTAMPTZ(6) NOT NULL DEFAULT now(),',
    expect: '"linkedAt" carries a DEFAULT',
  },
  {
    name: 'link02-p the trip delete stops asking first (clause 7)',
    file: TRIP_ROUTE,
    find: '    const linked = await tripLinesLinkedRefusal(user.id, id);\n    if (linked) return linked;\n',
    replace: '    void tripLinesLinkedRefusal;\n',
    expect: 'the trip delete does not refuse a linked trip BEFORE its first delete',
  },
  {
    name: 'link02-q a linked booking can be moved off its trip (clause 7)',
    file: ATTACH_ROUTE,
    find: '    if (tripId !== owned.tripId) {\n      const linked = await bookingLinkedRefusal(user.id, owned.id);\n      if (linked) return linked;\n    }\n',
    replace: '    void bookingLinkedRefusal;\n',
    expect: 'a linked booking can be moved off its trip',
  },
];

export default SEEDS;
