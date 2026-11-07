import type { PrismaClient } from '@prisma/client';
import { bookingRowOf } from '@/lib/reservations/bookingRow';
import { LEDGER_MONEY_EVENT_KINDS } from '@/lib/reservations/travelLedger';
import { bookingCalendarRowsWhere, reservationIdOfCalendarSourceId } from '@/lib/calendar/bookingEvent';

/**
 * READS-01a (Alex, 2026-11-07, ruling B) — THE RESERVATIONS ANSWER, AS A FUNCTION.
 *
 * GET /api/reservations' body (BOOKINGS-01, CAL-02, TRAVEL-02a — its header keeps the story), moved here VERBATIM:
 * the caller's reservations newest first, the five per-id facts, the money events, the current receipts, bookingRowOf's
 * rows and the travel ledger's facts — returning the exact `{ bookings, ledger }` object the route serializes. The route
 * is the gate and `NextResponse.json(await reservationsAnswerOf(prisma, user.id))`; /api/home-ledger calls this function
 * directly instead of the route (no route calls a route — HOME-LEDGER-01's in-process call retired here).
 *
 * The caller's id is the parameter: every where names it (userId / user_id: userId — the bookings law's scan binds to
 * it). No read is reordered, renamed, widened or narrowed. READ-ONLY: zero writes, no vendor client, no clock. The
 * answer is WIRE-SHAPED as built — every Date passes through isoDayOf or toISOString, the amounts are Float and Int
 * columns, no Decimal, no BigInt, no undefined — so the leaf that reads it in-process (travelLedger.ts travelLedgerReadsOf)
 * sees exactly what it saw through the JSON wire (reads01a.test.ts round-trips a fixture answer).
 */

type Db = Pick<PrismaClient, 'reservations' | 'transaction_reservation_links' | 'journal_entries' | 'reservation_budget_links' | 'calendar_events' | 'money_events' | 'source_documents'>;

const isoDayOf = (d: Date): string => d.toISOString().slice(0, 10);

/** The answer GET /api/reservations serializes — { bookings, ledger } — for the caller userId. */
export async function reservationsAnswerOf(db: Db, userId: string) {
  const reservations = await db.reservations.findMany({
    where: { userId: userId },
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
        db.transaction_reservation_links.findMany({
          where: { userId: userId, status: 'accepted', moneyEventId: null, reservationId: { in: ids } },
          select: { reservationId: true, transaction: { select: { amount: true, date: true, accounts: { select: { isoCurrencyCode: true } } } } },
        }),
        // The ledger: a POSTED entry that documents the charge — TRAVEL-02a: with its id and its day.
        db.journal_entries.findMany({
          where: { userId: userId, document_money_event_id: null, status: 'posted', document_reservation_id: { in: ids } },
          select: { id: true, date: true, document_reservation_id: true },
        }),
        // The owner's budget-line link, with the line's description — TRAVEL-02a: and its COA code.
        db.reservation_budget_links.findMany({
          where: { userId: userId, reservationId: { in: ids } },
          select: { reservationId: true, budgetLineItem: { select: { description: true, coaCode: true } } },
        }),
        // A flight's service day: its calendar rows — CAL-02: the bare key and every segment key.
        db.calendar_events.findMany({
          where: { user_id: userId, ...bookingCalendarRowsWhere(ids) },
          orderBy: { start_date: 'asc' },
          select: { source_id: true, start_date: true },
        }),
        // TRAVEL-02a: the money events that are rows of the ledger, scoped to the caller's own reservations, with the settled bank row.
        db.money_events.findMany({
          where: { reservation: { userId: userId }, reservationId: { in: ids }, kind: { in: [...LEDGER_MONEY_EVENT_KINDS] } },
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
    : await db.source_documents.findMany({
        where: { user_id: userId, kind: 'receipt', superseded_by: null, journal_entry_id: { in: entryIds } },
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
  return { bookings, ledger };
}

export type ReservationsAnswer = Awaited<ReturnType<typeof reservationsAnswerOf>>;
