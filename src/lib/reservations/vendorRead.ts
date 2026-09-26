/**
 * STATUS-01 (2026-09-26) — ONE READ OF THE VENDOR, LANDED, APPLIED, EMAILED.
 *
 * A WEBHOOK IS A HINT. THE GET IS THE TRUTH. Every path that brings the vendor's
 * current state onto a reservation — the webhook receiver, the scheduled
 * refresh, the retro — comes through here, and this does exactly one thing per
 * row:
 *
 *   1. reserve the read against its daily cap ('liteapi' — the vendor documents
 *      no cost for the GET, so it is treated as metered; a refusal is named and
 *      NOTHING is read);
 *   2. GET the booking by the row's lane (getHotelBooking / getFlightBooking);
 *   3. in ONE transaction: land the answer's bytes and its snapshot
 *      (liteapi · booking_read), parse the state FROM THE TABLE, and apply it
 *      through the one apply leaf — a hotel through applyVendorState directly, a
 *      flight through refreshFlightReservation (which keeps LANE-01's name and
 *      day and hands the status to the same leaf). The email markers ride the
 *      same write;
 *   4. AFTER the commit, make the one attempt at each email the apply owes
 *      (sendLifecycleEmail — a failed send is audit-logged by name, not retried).
 *
 * NO FALLBACK. A GET that fails, a landing that throws, an apply that throws:
 * the row is untouched and the outcome is 'read_failed' with the reason named.
 * A dry run (the retro's --dry-run) reads the vendor and reports what WOULD be
 * written; it lands nothing, writes nothing and sends nothing.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getHotelBooking, parseHotelBookingState } from '@/lib/liteapiClient';
import { getFlightBooking, parseFlightBookingDetails } from '@/lib/liteapiFlightsClient';
import { bookingGuestRef, landLiteApiBookingRead } from '@/lib/arrivals/liteapiBooking';
import { prismaLanding } from '@/lib/arrivals/prismaLanding';
import { prismaBookingCalendar } from '@/lib/calendar/prismaBookingCalendar';
import { reserveTravelSearch, TravelSearchQuotaError } from '@/lib/travelSearchQuota';
import { applyVendorState, type ApplyOutcome, type ApplyPorts, type LifecycleEmailRequest, type ReservationPatch } from './applyVendorState';
import { refreshFlightReservation, type FlightReservationPatch, type FlightRefreshPorts } from './refreshFlightReservation';
import { sendLifecycleEmail, type LifecycleEmailStatus } from './lifecycleSend';

/** Who asked for the read — named in every log line. */
export type VendorReadSource = 'webhook' | 'cron' | 'retro';

/** The one select every reader uses: the apply leaf's columns, the refresh's, and the email's. */
export const VENDOR_READ_SELECT = {
  id: true,
  userId: true,
  bookingType: true,
  guestEmail: true,
  provider: true,
  lane: true,
  displayName: true,
  providerBookingId: true,
  providerConfirmationCode: true,
  status: true,
  checkinDate: true,
  checkoutDate: true,
  cancelIntentAt: true,
  ticketedAt: true,
  ticketLimitTime: true,
  lastVendorReadAt: true,
  ticketedEmailSentAt: true,
  confirmationEmailSentAt: true,
  createdAt: true,
} as const;

export type VendorReadRow = Prisma.reservationsGetPayload<{ select: typeof VENDOR_READ_SELECT }>;

export type VendorReadOutcome =
  | {
      outcome: 'applied' | 'unchanged';
      /** Every fact that changed, by name — empty for 'unchanged'. */
      changes: string[];
      status: ApplyOutcome['status'];
      statusValue: string;
      providerStatus: string | null;
      /** When the answer arrived — what lastVendorReadAt now holds (or would, on a dry run). */
      readAt: Date;
      /** The arrival the state was parsed from; null on a dry run (nothing landed). */
      arrivalId: string | null;
      /** The flight lane's day and name, when the refresh ran. */
      flight: { calendar: 'inserted' | 'already_there' | 'no_row'; day: string | null; name: 'set' | 'unchanged' | 'not_stated' } | null;
      /** The one attempt at each email the apply owed — empty on a dry run and when nothing was owed. */
      emails: LifecycleEmailStatus[];
      /** On a dry run: the emails that WOULD have been attempted. */
      emailsOwed: LifecycleEmailRequest[];
      /** On a dry run: the write that WOULD have been made. */
      wouldWrite: FlightReservationPatch | null;
    }
  | {
      outcome: 'read_failed';
      /** 'quota' — the daily cap refused the read (a caller stops its batch); 'vendor' — the GET failed; 'apply' — the landing or the apply threw. */
      kind: 'quota' | 'vendor' | 'apply' | 'lane';
      reason: string;
    };

export interface VendorReadOptions {
  source: VendorReadSource;
  /** Read the vendor, land nothing, write nothing, send nothing — report what would change. */
  dryRun?: boolean;
  log?: (line: string) => void;
}

const nameErr = (err: unknown): string => (err instanceof Error ? `${err.name}: ${err.message}` : String(err));

export async function readAndApplyReservation(row: VendorReadRow, opts: VendorReadOptions): Promise<VendorReadOutcome> {
  const log = opts.log ?? ((line: string) => console.log(line));
  const tag = `[vendor read · ${opts.source}] reservation ${row.id}`;
  if (row.provider !== 'liteapi' || (row.lane !== 'hotel' && row.lane !== 'flight')) {
    return { outcome: 'read_failed', kind: 'lane', reason: `${tag}: provider "${row.provider}" lane "${row.lane}" — there is no LiteAPI booking read for it; row untouched` };
  }
  const lane: 'hotel' | 'flight' = row.lane;

  // 1. THE CAP.
  try {
    await reserveTravelSearch('liteapi');
  } catch (err) {
    if (err instanceof TravelSearchQuotaError) {
      return { outcome: 'read_failed', kind: 'quota', reason: `${tag}: the daily cap for liteapi is spent — not read; row untouched` };
    }
    return { outcome: 'read_failed', kind: 'quota', reason: `${tag}: the cap could not be reserved (${nameErr(err)}) — not read; row untouched` };
  }

  // 2. THE GET, by lane.
  let read: { answer: { httpStatus: number; body: Buffer; asked: Date; arrived: Date; json: unknown }; object: Record<string, unknown> };
  try {
    read = lane === 'hotel' ? await getHotelBooking(row.providerBookingId) : await getFlightBooking(row.providerBookingId);
  } catch (err) {
    return { outcome: 'read_failed', kind: 'vendor', reason: `${tag}: GET of ${lane} booking ${row.providerBookingId} failed (${nameErr(err)}) — row untouched, 'read_failed'` };
  }
  const readAt = read.answer.arrived;

  // 3. LAND AND APPLY — one transaction; a dry run runs the same leaf over recording ports and lands nothing.
  const writes: FlightReservationPatch[] = [];
  const guestRef = row.userId === null ? bookingGuestRef(row.providerBookingId) : null;
  const applyHotel = async (parsed: ReturnType<typeof parseHotelBookingState>, ports: ApplyPorts) =>
    applyVendorState(ports, row, { lane: 'hotel', bookingId: parsed.bookingId, status: parsed.status, hotelConfirmationCode: parsed.hotelConfirmationCode, readAt });
  const applyFlight = async (parsed: ReturnType<typeof parseFlightBookingDetails>, ports: Omit<FlightRefreshPorts, 'fetchBooking'>) =>
    refreshFlightReservation({ ...ports, fetchBooking: async () => ({ ...parsed, readAt }) }, row);

  type Applied = { arrivalId: string | null; changes: string[]; status: ApplyOutcome['status']; statusValue: string; providerStatus: string | null; emails: LifecycleEmailRequest[]; flight: Extract<VendorReadOutcome, { outcome: 'applied' | 'unchanged' }>['flight'] };
  const applied: Applied | { failed: string } = await (async () => {
    try {
      if (opts.dryRun) {
        const recording: ApplyPorts = {
          writeReservation: async (_id, patch: ReservationPatch) => { writes.push(patch); },
          calendar: { async markCancelled() { return 0; } },
          cancelCommission: async () => 0,
          log,
        };
        if (lane === 'hotel') {
          const out = await applyHotel(parseHotelBookingState(read.object), recording);
          return { arrivalId: null, changes: out.changes, status: out.status, statusValue: out.statusValue, providerStatus: out.providerStatus, emails: out.emails, flight: null };
        }
        const live = prismaBookingCalendar(prisma);
        const out = await applyFlight(parseFlightBookingDetails(read.object), {
          ...recording,
          calendar: { find: live.find, async insert() {}, async markCancelled() { return 0; } },
          writeReservation: async (_id, patch) => { writes.push(patch); },
        });
        if (!out.fetched) return { failed: out.reason };
        return { arrivalId: null, changes: out.changes, status: out.status === 'unmapped' ? 'unlisted' : out.status, statusValue: out.statusValue, providerStatus: out.providerStatus, emails: out.emails, flight: { calendar: out.calendar, day: out.day, name: out.name } };
      }
      return await prisma.$transaction(async (tx) => {
        const ports: ApplyPorts = {
          writeReservation: async (id, patch: ReservationPatch) => { writes.push(patch); await tx.reservations.update({ where: { id }, data: patch }); },
          calendar: prismaBookingCalendar(tx),
          cancelCommission: async (reservationId) => (await tx.commission_ledger.updateMany({ where: { reservationId, status: 'estimated' }, data: { status: 'cancelled' } })).count,
          log,
        };
        const landing = { landing: prismaLanding(tx), log };
        if (lane === 'hotel') {
          const landed = await landLiteApiBookingRead(landing, { answer: read.answer, bookingId: row.providerBookingId, payload: read.object, parse: parseHotelBookingState, userId: row.userId, guestRef });
          const out = await applyHotel(landed.parsed, ports);
          return { arrivalId: landed.arrivalId, changes: out.changes, status: out.status, statusValue: out.statusValue, providerStatus: out.providerStatus, emails: out.emails, flight: null };
        }
        const landed = await landLiteApiBookingRead(landing, { answer: read.answer, bookingId: row.providerBookingId, payload: read.object, parse: parseFlightBookingDetails, userId: row.userId, guestRef });
        const out = await applyFlight(landed.parsed, {
          ...ports,
          calendar: prismaBookingCalendar(tx),
          writeReservation: async (id, patch) => { writes.push(patch); await tx.reservations.update({ where: { id }, data: patch }); },
        });
        if (!out.fetched) throw new Error(out.reason);
        return { arrivalId: landed.arrivalId, changes: out.changes, status: out.status === 'unmapped' ? 'unlisted' : out.status, statusValue: out.statusValue, providerStatus: out.providerStatus, emails: out.emails, flight: { calendar: out.calendar, day: out.day, name: out.name } };
      });
    } catch (err) {
      return { failed: `${tag}: the ${opts.dryRun ? 'dry-run apply' : 'landing or the apply'} threw (${nameErr(err)}) — rolled back, row untouched, 'read_failed'` };
    }
  })();
  if ('failed' in applied) return { outcome: 'read_failed', kind: 'apply', reason: applied.failed };

  const wouldWrite = writes[0] ?? null;
  const changed = applied.changes.length > 0 || applied.flight?.calendar === 'inserted';

  // 4. THE EMAILS — after the commit, one attempt each; never on a dry run.
  const emails: LifecycleEmailStatus[] = [];
  if (!opts.dryRun) {
    const emailRow = { ...row, providerConfirmationCode: wouldWrite?.providerConfirmationCode ?? row.providerConfirmationCode, displayName: wouldWrite?.displayName ?? row.displayName };
    for (const request of applied.emails) emails.push(await sendLifecycleEmail(emailRow, request));
  }

  log(`${tag}: ${lane} ${row.providerBookingId} read (${applied.providerStatus ?? 'no status'}) — ${changed ? `APPLIED: ${applied.changes.join('; ')}` : 'unchanged'}${applied.emails.length ? `; emails ${opts.dryRun ? 'owed' : 'attempted'}: ${applied.emails.map((e) => e.kind).join(', ')}` : ''}${opts.dryRun ? ' (dry run — nothing landed, written or sent)' : ''}`);
  return {
    outcome: changed ? 'applied' : 'unchanged',
    changes: applied.changes,
    status: applied.status,
    statusValue: applied.statusValue,
    providerStatus: applied.providerStatus,
    readAt,
    arrivalId: applied.arrivalId,
    flight: applied.flight,
    emails,
    emailsOwed: applied.emails,
    wouldWrite: opts.dryRun ? wouldWrite : null,
  };
}
