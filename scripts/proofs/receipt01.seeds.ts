/**
 * The receipt law's seeded regressions (RECEIPT-01, 2026-09-26).
 *
 * The ruling says one thing: THE RECEIPT IS THE VENDOR'S LANDED WORDS, AND THE
 * EXPORT CARRIES THE LEDGER SHAPE. These seeds put back, one at a time, each
 * shape the ruling forbids:
 *
 *   · the leaf does arithmetic on money (clause 1);
 *   · the leaf reaches for the clock (clause 1);
 *   · commission appears on the receipt (clause 2);
 *   · the receipt route imports a vendor client (clause 3);
 *   · the receipt route writes (clause 3);
 *   · the receipt route gains a tier gate (clause 3);
 *   · the page types a money word of its own (clause 4);
 *   · the receipt page becomes public (clause 4);
 *   · the receipt page loses its listed door (clause 4);
 *   · a list loses the Receipt link (clause 5);
 *   · the export's CSV drops a column (clause 6);
 *   · the export gains a gate (clause 6).
 *
 * Each must fail THE RECEIPT LAW by name. The anchors occur exactly once in their
 * file, which the harness enforces before it runs anything.
 */
import type { Seed } from '../prove';

const LEAF = 'src/lib/receipts/bookingReceipt.ts';
const CSV_LEAF = 'src/lib/receipts/bookingsLedgerCsv.ts';
const ROUTE = 'src/app/api/reservations/[id]/receipt/route.ts';
const PAGE = 'src/app/booking/[id]/receipt/page.tsx';
const EXPORT_ROUTE = 'src/app/api/export/route.ts';
const TRIP_LIST = 'src/components/trips/TripBookings.tsx';
const MIDDLEWARE = 'src/middleware.ts';
const LAW = 'scripts/assert-tool-registry.ts';

const SEEDS: Seed[] = [
  {
    name: 'receipt01-a the leaf does arithmetic on money (clause 1)',
    file: LEAF,
    find: '  const amount = numWord(book.price);\n  const currency = str(book.currency);',
    replace: '  const amount = numWord(book.price) === null ? null : String(Number(numWord(book.price)) * 1);\n  const currency = str(book.currency);',
    expect: 'does arithmetic on money',
  },
  {
    name: 'receipt01-b the leaf reaches for the clock (clause 1)',
    file: LEAF,
    find: 'export function receiptOf(input: ReceiptInput): BookingReceipt {',
    replace: 'export function receiptOf(input: ReceiptInput): BookingReceipt {\n  void Date.now();',
    expect: 'reads the clock',
  },
  {
    name: 'receipt01-c commission appears on the receipt (clause 2)',
    file: LEAF,
    find: "  lines.push({ label: 'Taxes and fees',",
    replace: "  lines.push({ label: 'Commission', value: numWord(book.commission) ?? NOT_STATED, note, figure });\n  lines.push({ label: 'Taxes and fees',",
    expect: 'commission appears on the receipt path',
  },
  {
    name: 'receipt01-d the receipt route imports a vendor client (clause 3)',
    file: ROUTE,
    find: "import { receiptOf, type ReceiptArrival } from '@/lib/receipts/bookingReceipt';",
    replace: "import { receiptOf, type ReceiptArrival } from '@/lib/receipts/bookingReceipt';\nimport { bookingObjectOf } from '@/lib/liteapiClient';\nvoid bookingObjectOf;",
    expect: 'imports a vendor client',
  },
  {
    name: 'receipt01-e the receipt route writes (clause 3)',
    file: ROUTE,
    find: '  const receipt = receiptOf({ reservation, bookArrival, latestReadArrival, chargeLink, journalEntry, moneyEvents });',
    replace: "  await prisma.reservations.update({ where: { id: reservation.id }, data: { lastVendorReadAt: new Date() } });\n  const receipt = receiptOf({ reservation, bookArrival, latestReadArrival, chargeLink, journalEntry, moneyEvents });",
    expect: 'the receipt route is read-only',
  },
  {
    name: 'receipt01-f the receipt route gains a tier gate (clause 3)',
    file: ROUTE,
    find: "  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });",
    replace: "  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });\n  const gate = await requireTabAccess(user.id, 'tab:travel');\n  if (gate) return gate;",
    expect: 'adds a tier gate',
  },
  {
    name: 'receipt01-g the page types a money word of its own (clause 4)',
    file: PAGE,
    find: '<p className="text-sm text-text-secondary" data-receipt-bank-absent>{r.bank.words}</p>',
    replace: "<p className=\"text-sm text-text-secondary\" data-receipt-bank-absent>{'not yet matched to a bank row'}</p>",
    expect: 'types "not yet matched"',
  },
  {
    name: 'receipt01-h the receipt page becomes public (clause 4)',
    file: MIDDLEWARE,
    find: "  '/booking/confirm',",
    replace: "  '/booking',\n  '/booking/confirm',",
    expect: 'the receipt page is public',
  },
  {
    name: 'receipt01-i the receipt page loses its listed door (clause 4)',
    file: LAW,
    find: "  { route: '/booking/[id]/receipt', why: 'RECEIPT-01: the Receipt link beside Cancel on both bookings lists (TripBookings.tsx, UnattachedBookings.tsx); owner-only — NOT in PUBLIC_PATHS (the middleware cookie gate), and /api/reservations/[id]/receipt does the ownership (findFirst { id, userId } → 404)' },\n",
    replace: '',
    expect: 'no listed door of its own',
  },
  {
    name: 'receipt01-j a list loses the Receipt link (clause 5)',
    file: TRIP_LIST,
    find: '                        href={`/booking/${r.id}/receipt`}',
    replace: '                        href={`/booking/${r.id}`}',
    expect: 'has no Receipt link beside Cancel',
  },
  {
    name: 'receipt01-k the export CSV drops a column (clause 6)',
    file: CSV_LEAF,
    find: "  'refund_count', 'refunds_stated_cents', 'refunds_settled_cents',\n  'refund_currency',\n] as const;",
    replace: "  'refund_count', 'refunds_stated_cents', 'refunds_settled_cents',\n] as const;",
    expect: 'the fixed column list',
  },
  {
    name: 'receipt01-l the export gains a gate (clause 6)',
    file: EXPORT_ROUTE,
    find: '  const uid = user.id;\n',
    replace: "  const uid = user.id;\n  const tabGate = await requireTabAccess(uid, 'tab:books');\n  if (tabGate) return tabGate;\n",
    expect: 'the export is never paywalled',
  },
];

export default SEEDS;
