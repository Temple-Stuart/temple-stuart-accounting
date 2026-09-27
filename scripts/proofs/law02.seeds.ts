/**
 * The LAW-02 laws' seeded regressions (LAW-02, 2026-09-27).
 *
 * The ruling: no fabricated default, no dead config, no schema drift. These seeds
 * put back, one at a time, each shape it closes:
 *
 *   · the stated-figure law — the prebook's $0 USD, the panel taking a card for an
 *     unstated price, the returnUrl's dead commission param, a hotel rating of 0, a
 *     planner printing it, the rating words reading 0 as a rating, Plaid's 'USD', a
 *     new default at the boundary, a stale allowance, the "nonstop" claim;
 *   · the document-freeze law — a field un-frozen, a set document replaceable, a
 *     trigger dropped;
 *   · the status law — the dead cron re-registered;
 *   · the audit law — the timeline's false note back;
 *   · the calendar law — DTSTAMP read naively again.
 *
 * (The commission grace is seeded in comm01.seeds.ts, comm01-f2.) Each must fail its
 * law by name. The anchors occur exactly once in their file, which the harness
 * enforces before it runs anything.
 */
import type { Seed } from '../prove';

const CLIENT = 'src/lib/liteapiClient.ts';
const PANEL = 'src/components/trips/CheckoutPanel.tsx';
const PLANNER = 'src/components/trips/TripPlannerAI.tsx';
const WORDS = 'src/lib/travel/ratingWords.ts';
const GATE = 'src/lib/checkout/prebookGate.ts';
const FREEZE = 'prisma/migrations/20260927210000_law_02_document_freeze/migration.sql';
const PORTS = 'src/lib/calendar/prismaIcsPorts.ts';

const SEEDS: Seed[] = [
  {
    name: 'law02-a the prebook parser defaults an unstated price to 0 again (stated-figure 2)',
    file: CLIENT,
    find: "    price: typeof d.price === 'number' && Number.isFinite(d.price) ? d.price : null,",
    replace: '    price: d.price ?? 0,',
    expect: 'prebookRate does not state price and currency as stated or NULL',
  },
  {
    name: "law02-b the prebook parser defaults an unstated currency to 'USD' again (stated-figure 2)",
    file: CLIENT,
    find: "    currency: typeof d.currency === 'string' && d.currency.length > 0 ? d.currency : null,",
    replace: "    currency: d.currency ?? 'USD',",
    expect: 'prebookRate does not state price and currency as stated or NULL',
  },
  {
    name: 'law02-c the checkout takes a card for a hold with no stated price (stated-figure 2)',
    file: PANEL,
    find: '        const unstatedMoney = prebookUnstatedMoney(p);',
    replace: '        const unstatedMoney = null as string | null;',
    expect: 'the hold is not gated on a stated price and currency BEFORE the pay phase',
  },
  {
    name: 'law02-d the returnUrl carries the dead commission param again (stated-figure 2)',
    file: PANEL,
    find: '      price: String(prebook.price),\n',
    replace: '      price: String(prebook.price),\n      commission: String(prebook.commission),\n',
    expect: 'the returnUrl carries a commission param',
  },
  {
    name: 'law02-e the hotel mapper defaults an unstated review count to 0 again (stated-figure 1/3)',
    file: CLIENT,
    find: "  const reviewCount = typeof h.reviewCount === 'number' && Number.isFinite(h.reviewCount) ? h.reviewCount : null;",
    replace: '  const reviewCount = h.reviewCount ?? 0;',
    expect: 'defaults a figure',
  },
  {
    name: 'law02-f the planner prints an unstated rating as a bare number again (stated-figure 3)',
    file: PLANNER,
    find: '<span className="text-text-primary">{ratingValue(rec.googleRating)}</span>',
    replace: '<span className="text-text-primary">{rec.googleRating || \'—\'}</span>',
    expect: 'prints an unstated rating as a number',
  },
  {
    name: 'law02-g the rating words read the old 0 default as a rating (stated-figure 3)',
    file: WORDS,
    find: "  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;",
    replace: "  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;",
    expect: 'the rating words do not say "not rated"',
  },
  {
    name: "law02-h Plaid's unstated account currency becomes 'USD' again (stated-figure 4)",
    file: 'src/app/api/plaid/exchange-token/route.ts',
    find: '          isoCurrencyCode: account.balances.iso_currency_code ?? null,',
    replace: "          isoCurrencyCode: account.balances.iso_currency_code || 'USD',",
    expect: 'the account currency is not stored as Plaid states it',
  },
  {
    name: 'law02-i a new default appears at the boundary (stated-figure 1)',
    file: GATE,
    find: "  const price = typeof p?.price === 'number' && Number.isFinite(p.price);",
    replace: "  const price = typeof (p?.price ?? 0) === 'number';",
    expect: 'defaults a figure',
  },
  {
    name: 'law02-j an allowance outlives its default — the list must shrink (stated-figure 1)',
    file: 'src/app/api/plaid/attach-item/route.ts',
    find: '${report?.pairs.length ?? 0} account(s) attached',
    replace: "${report ? report.pairs.length : 'no'} account(s) attached",
    expect: 'is stale; the list only shrinks',
  },
  {
    name: 'law02-k a flight with no outbound is called "nonstop" again (stated-figure 4)',
    file: 'src/lib/flights/fares.ts',
    find: '  const stops = rep.outbound ? stopsText(rep.outbound.stops) : null;',
    replace: '  const stops = stopsText(rep.outbound?.stops ?? 0);',
    expect: 'is called "nonstop" again',
  },
  {
    name: 'law02-l the freeze un-freezes a field the trigger froze (document-freeze)',
    file: FREEZE,
    find: '     OR NEW.metadata IS DISTINCT FROM OLD.metadata\n',
    replace: '',
    expect: 'the freeze un-freezes metadata',
  },
  {
    name: 'law02-m a set document may be replaced (document-freeze)',
    file: FREEZE,
    find: '  IF (OLD.document_reservation_id IS NOT NULL AND NEW.document_reservation_id IS DISTINCT FROM OLD.document_reservation_id)',
    replace: '  IF (OLD.document_reservation_id IS NULL AND NEW.document_reservation_id IS DISTINCT FROM OLD.document_reservation_id)',
    expect: 'document_reservation_id is not frozen once set',
  },
  {
    name: 'law02-n the freeze drops the trigger instead of replacing its function (document-freeze)',
    file: FREEZE,
    find: 'CREATE OR REPLACE FUNCTION prevent_journal_entry_mutation()',
    replace: 'DROP TRIGGER IF EXISTS protect_journal_entry_fields ON journal_entries;\nCREATE OR REPLACE FUNCTION prevent_journal_entry_mutation()',
    expect: 'drops a trigger or function',
  },
  {
    name: 'law02-o the dead auto-categorize cron is registered again (status law, clause 7)',
    file: 'vercel.json',
    find: '  "crons": [\n',
    replace: '  "crons": [\n    {\n      "path": "/api/cron/auto-categorize",\n      "schedule": "0 2 * * *"\n    },\n',
    expect: 'registers /api/cron/auto-categorize again',
  },
  {
    name: "law02-p the timeline note claims commission is readable from the owner's audit log (audit law)",
    file: 'src/app/api/reservations/[id]/timeline/route.ts',
    find: ' * commission_locked rows stay in audit_log.\n',
    replace: " * commission_locked rows stay in audit_log, readable from the owner's audit log.\n",
    expect: "readable from the owner's audit log",
  },
  {
    name: 'law02-q the export reads updated_at naively again (calendar law)',
    file: PORTS,
    find: '        select: { id: true, title: true, status: true, start_date: true, end_date: true, start_time: true, end_time: true, start_at: true, end_at: true },',
    replace: '        select: { id: true, title: true, status: true, start_date: true, end_date: true, start_time: true, end_time: true, start_at: true, end_at: true, updated_at: true },',
    expect: 'the typed read selects updated_at',
  },
  {
    name: 'law02-r DTSTAMP loses its explicit conversion (calendar law)',
    file: PORTS,
    find: "        SELECT id::text AS id, (updated_at AT TIME ZONE current_setting('TimeZone')) AS updated_at",
    replace: '        SELECT id::text AS id, updated_at',
    expect: 'DTSTAMP is not read as an instant',
  },
];

export default SEEDS;
