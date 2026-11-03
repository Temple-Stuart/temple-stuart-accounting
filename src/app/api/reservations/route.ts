import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { bookingRowOf } from '@/lib/reservations/bookingRow';
import { LEDGER_MONEY_EVENT_KINDS } from '@/lib/reservations/travelLedger';
import { bookingCalendarRowsWhere, reservationIdOfCalendarSourceId } from '@/lib/calendar/bookingEvent';

/**
 * BOOKINGS-01 (2026-09-27) — GET /api/reservations: every booking of the caller, newest first.
 *
 * ONE list for all of a user's bookings — attached to a trip or not — each row built
 * by ONE pure leaf (src/lib/reservations/bookingRow.ts bookingRowOf) from facts already
 * recorded: the reservation (STATUS-01's ticketing, cancel intent and last read), the
 * flight's calendar day (CAL-01), the ACCEPTED CHARGE link (MATCH), the POSTED entry
 * that documents the charge (POST-01), the owner's budget-line link (LINK-02).
 *
 * AUTH, the reservations/[id] pattern: getVerifiedEmail → 401; the user row → 404.
 * Every query is scoped to that user: reservations WHERE userId = user.id — a guest
 * row (userId null) and another user's row are never returned. READ-ONLY: zero
 * writes, and no vendor client — nothing here calls a provider.
 *
 * CAL-02 (2026-09-27): a flight now has one calendar row PER SEGMENT (source_id
 * `<id>:seg:<n>`). The rows are read through the one where (bookingCalendarRowsWhere)
 * and folded back to their reservation, so a booking with several rows is still ONE
 * booking here: its day is the earliest stated start_date among its rows (the rows
 * arrive ordered by start_date; the first one kept per reservation).
 *
 * TRAVEL-02a (Alex, 2026-11-02, ruling E) — THE READ, ADDITIVE. The answer keeps `bookings`
 * (bookingRowOf's words) and gains `ledger`: the FACTS the travel ledger's leaf
 * (src/lib/reservations/travelLedger.ts) words — per reservation its id, createdAt, lane,
 * provider, displayName, providerBookingId, confirmation, status, finalPriceCents, currency,
 * checkinDate / checkoutDate, the flight's calendar day, trip { id, name } | null, budgetLine
 * { coaCode } | null, charge { matched, posted, bank { amount, currency, date } | null, postedDay,
 * postedEntryId }, receipts (current source_documents receipts on the posted entry — read with
 * user_id), moneyEvents[] (kind refund | cancellation_fee | voucher_issued — each with its
 * settled bank row). The links by the caller's reservation ids AND the reservation's owner;
 * the same bank join the travel-day route uses. This route words nothing: every word is the
 * leaf's. A second accepted charge link or a second posted charge entry on one booking is a
 * contradiction named by name, never one picked.
 */
const isoDayOf = (d: Date): string => d.toISOString().slice(0, 10);

export async function GET() {
  const userEmail = await getVerifiedEmail();
  if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await prisma.users.findFirst({
    where: { email: { equals: userEmail, mode: 'insensitive' } },
    select: { id: true },
  });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const reservations = await prisma.reservations.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, lane: true, provider: true, displayName: true, providerConfirmationCode: true, providerBookingId: true,
      status: true, tripId: true, checkinDate: true, checkoutDate: true,
      ticketedAt: true, ticketLimitTime: true, cancelIntentAt: true, lastVendorReadAt: true,
      finalPriceCents: true, currency: true, createdAt: true,
      trip: { select: { id: true, name: true } },
    },
  });
  const ids = reservations.map((r) => r.id);

  const [chargeLinks, postedEntries, budgetLinks, calendarRows, moneyEvents] = ids.length === 0
    ? [[], [], [], [], []]
    : await Promise.all([
        // The bank: an ACCEPTED CHARGE link (a refund's link carries its money event) — TRAVEL-02a: with its bank row.
        prisma.transaction_reservation_links.findMany({
          where: { userId: user.id, status: 'accepted', moneyEventId: null, reservationId: { in: ids } },
          select: { reservationId: true, transaction: { select: { amount: true, date: true, accounts: { select: { isoCurrencyCode: true } } } } },
        }),
        // The ledger: a POSTED entry that documents the charge — TRAVEL-02a: with its id and its day.
        prisma.journal_entries.findMany({
          where: { userId: user.id, document_money_event_id: null, status: 'posted', document_reservation_id: { in: ids } },
          select: { id: true, date: true, document_reservation_id: true },
        }),
        // The owner's budget-line link, with the line's description — TRAVEL-02a: and its COA code.
        prisma.reservation_budget_links.findMany({
          where: { userId: user.id, reservationId: { in: ids } },
          select: { reservationId: true, budgetLineItem: { select: { description: true, coaCode: true } } },
        }),
        // A flight's service day: its calendar rows — CAL-02: the bare key and every segment key.
        prisma.calendar_events.findMany({
          where: { user_id: user.id, ...bookingCalendarRowsWhere(ids) },
          orderBy: { start_date: 'asc' },
          select: { source_id: true, start_date: true },
        }),
        // TRAVEL-02a: the money events that are rows of the ledger, scoped to the caller's own reservations, with the settled bank row.
        prisma.money_events.findMany({
          where: { reservation: { userId: user.id }, reservationId: { in: ids }, kind: { in: [...LEDGER_MONEY_EVENT_KINDS] } },
          orderBy: { statedAt: 'asc' },
          select: {
            id: true, reservationId: true, kind: true, amountCents: true, currency: true, status: true, statedAt: true, settledAt: true,
            settledTransaction: { select: { amount: true, date: true, accounts: { select: { isoCurrencyCode: true } } } },
          },
        }),
      ]);

  // One accepted charge per booking carries one bank figure; a second is refused by name — never one picked over the other.
  const bankOf = new Map<string, { amount: number; currency: string | null; date: string }>();
  for (const l of chargeLinks) {
    if (bankOf.has(l.reservationId)) throw new Error(`reservation ${l.reservationId} carries two accepted charge links — one bank figure cannot be named`);
    bankOf.set(l.reservationId, { amount: l.transaction.amount, currency: l.transaction.accounts.isoCurrencyCode, date: isoDayOf(l.transaction.date) });
  }
  const matched = new Set(chargeLinks.map((l) => l.reservationId));
  // One posted entry documents a booking's charge; a second is a contradiction named by name (a reversal carries no document — POST-01).
  const postingOf = new Map<string, { id: string; day: string }>();
  for (const e of postedEntries) {
    if (e.document_reservation_id === null) continue;
    if (postingOf.has(e.document_reservation_id)) throw new Error(`reservation ${e.document_reservation_id} carries two posted charge entries — one posting cannot be named`);
    postingOf.set(e.document_reservation_id, { id: e.id, day: isoDayOf(e.date) });
  }
  const posted = new Set(postedEntries.map((e) => e.document_reservation_id));
  const lineOf = new Map(budgetLinks.map((b) => [b.reservationId, { description: b.budgetLineItem.description }]));
  const coaOf = new Map(budgetLinks.map((b) => [b.reservationId, { coaCode: b.budgetLineItem.coaCode }]));
  // CAL-02: one day per RESERVATION, never per row — the first (earliest) row of each.
  const dayOf = new Map<string, Date>();
  for (const c of calendarRows) {
    if (c.source_id === null) continue;
    const rid = reservationIdOfCalendarSourceId(c.source_id);
    if (!dayOf.has(rid)) dayOf.set(rid, c.start_date);
  }

  // TRAVEL-02a: the current receipts on each posted entry — the documents route's own read (kind 'receipt', not superseded), by user_id.
  const entryIds = [...postingOf.values()].map((p) => p.id);
  const receipts = entryIds.length === 0
    ? []
    : await prisma.source_documents.findMany({
        where: { user_id: user.id, kind: 'receipt', superseded_by: null, journal_entry_id: { in: entryIds } },
        select: { journal_entry_id: true },
      });
  const receiptsOf = new Map<string, number>();
  for (const d of receipts) {
    if (d.journal_entry_id === null) continue;
    receiptsOf.set(d.journal_entry_id, (receiptsOf.has(d.journal_entry_id) ? receiptsOf.get(d.journal_entry_id)! : 0) + 1);
  }
  const eventsOf = new Map<string, typeof moneyEvents>();
  for (const e of moneyEvents) {
    const list = eventsOf.get(e.reservationId);
    if (list === undefined) eventsOf.set(e.reservationId, [e]);
    else list.push(e);
  }

  const bookings = reservations.map((r) =>
    bookingRowOf({
      reservation: r,
      calendarDay: dayOf.has(r.id) ? dayOf.get(r.id)! : null,
      chargeMatched: matched.has(r.id),
      chargePosted: posted.has(r.id),
      budgetLine: lineOf.has(r.id) ? lineOf.get(r.id)! : null,
    }),
  );
  const ledger = reservations.map((r) => {
    const posting = postingOf.has(r.id) ? postingOf.get(r.id)! : null;
    const events = eventsOf.has(r.id) ? eventsOf.get(r.id)! : [];
    return {
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      lane: r.lane,
      provider: r.provider,
      displayName: r.displayName,
      providerBookingId: r.providerBookingId,
      confirmation: r.providerConfirmationCode,
      status: r.status,
      finalPriceCents: r.finalPriceCents,
      currency: r.currency,
      checkinDate: r.checkinDate === null ? null : isoDayOf(r.checkinDate),
      checkoutDate: r.checkoutDate === null ? null : isoDayOf(r.checkoutDate),
      calendarDay: dayOf.has(r.id) ? isoDayOf(dayOf.get(r.id)!) : null,
      trip: r.trip === null ? null : { id: r.trip.id, name: r.trip.name },
      budgetLine: coaOf.has(r.id) ? coaOf.get(r.id)! : null,
      charge: {
        matched: matched.has(r.id),
        posted: posted.has(r.id),
        bank: bankOf.has(r.id) ? bankOf.get(r.id)! : null,
        postedDay: posting === null ? null : posting.day,
        postedEntryId: posting === null ? null : posting.id,
      },
      receipts: posting !== null && receiptsOf.has(posting.id) ? receiptsOf.get(posting.id)! : 0,
      moneyEvents: events.map((e) => ({
        id: e.id,
        kind: e.kind,
        amountCents: e.amountCents,
        currency: e.currency,
        status: e.status,
        statedAt: e.statedAt.toISOString(),
        settledAt: e.settledAt === null ? null : e.settledAt.toISOString(),
        settledBank: e.settledTransaction === null
          ? null
          : { amount: e.settledTransaction.amount, currency: e.settledTransaction.accounts.isoCurrencyCode, date: isoDayOf(e.settledTransaction.date) },
      })),
    };
  });
  return NextResponse.json({ bookings, ledger });
}
