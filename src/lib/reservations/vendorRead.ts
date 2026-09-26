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
 *   3. in ONE transaction: LOCK THE ROW (STATUS-01b, 2026-09-26 — re-select it by
 *      id FOR UPDATE, every VENDOR_READ_SELECT column, and apply to THAT row: the
 *      caller's row chose the GET and contributes nothing else), land the
 *      answer's bytes and its snapshot (liteapi · booking_read), parse the state
 *      FROM THE TABLE, and apply it through the one apply leaf — a hotel through
 *      applyVendorState directly, a flight through refreshFlightReservation
 *      (which keeps LANE-01's name and day and hands the status to the same
 *      leaf). The email markers ride the same write;
 *   4. AFTER the commit, make the one attempt at each email the apply owes
 *      (sendLifecycleEmail — a failed send is audit-logged by name, not retried).
 *
 * WHY THE LOCK. Two overlapping reads of the same booking — a duplicate delivery
 * racing itself (the vendor retries on a timeout while the first is still
 * running), or a webhook overlapping the cron — would both see a null marker,
 * both send, both move the commission. The lock serialises them: the second
 * waits for the first commit, then sees the marker set and the status already
 * final → 'unchanged', no email, no second commission move. A row deleted
 * between the GET and the lock → throw → 'read_failed' by name.
 *
 * NO FALLBACK. A GET that fails, a landing that throws, an apply that throws:
 * the row is untouched and the outcome is 'read_failed' with the reason named.
 * A dry run (the retro's --dry-run) reads the vendor and reports what WOULD be
 * written; it opens no transaction and therefore takes NO lock — it applies to
 * the caller's row over recording ports, lands nothing, writes nothing and
 * sends nothing.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getHotelBooking, parseHotelBookingState } from '@/lib/liteapiClient';
import { getFlightBooking, parseFlightBookingDetails } from '@/lib/liteapiFlightsClient';
import { bookingGuestRef, landLiteApiBookingRead, type BookingReadPorts } from '@/lib/arrivals/liteapiBooking';
import { prismaLanding } from '@/lib/arrivals/prismaLanding';
import { prismaBookingCalendar } from '@/lib/calendar/prismaBookingCalendar';
import { reserveTravelSearch, TravelSearchQuotaError } from '@/lib/travelSearchQuota';
import { applyVendorState, type ApplyOutcome, type ApplyPorts, type CommissionFigures, type CommissionLockOutcome, type LifecycleEmailRequest, type ReservationPatch } from './applyVendorState';
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

/** The same columns, for the locking re-select (SELECT ... FOR UPDATE) — a code constant, never input. */
const LOCK_COLUMNS = Prisma.raw(Object.keys(VENDOR_READ_SELECT).map((c) => `"${c}"`).join(', '));

/** The vendor's answer: the bytes as received and the booking object inside them. */
export interface VendorAnswer {
  answer: { httpStatus: number; body: Buffer; asked: Date; arrived: Date; json: unknown };
  object: Record<string, unknown>;
}

/** What the caller's row contributes: which GET to make. Everything applied comes from the LOCKED row. */
export interface CallerRow {
  id: string;
  lane: 'hotel' | 'flight';
  providerBookingId: string;
}

export interface LockedReadPorts {
  /** SELECT ... FOR UPDATE by id, inside the caller's transaction; null when the row is gone. */
  lock(id: string): Promise<VendorReadRow | null>;
  landing: BookingReadPorts;
  apply: ApplyPorts;
  /** The CAL-01 port for the flight lane (find / insert / markCancelled). */
  calendar: FlightRefreshPorts['calendar'];
}

export interface LockedReadResult {
  /** The row as the transaction held it — what was applied to, and what the emails read. */
  locked: VendorReadRow;
  arrivalId: string;
  changes: string[];
  status: ApplyOutcome['status'];
  statusValue: string;
  providerStatus: string | null;
  emails: LifecycleEmailRequest[];
  flight: { calendar: 'inserted' | 'already_there' | 'no_row'; day: string | null; name: 'set' | 'unchanged' | 'not_stated' } | null;
  /** COMM-01: what the lock did on this read (a flight: not_applicable). */
  commissionLock: CommissionLockOutcome;
}

/**
 * Inside ONE transaction: lock the row, land the answer, apply to the LOCKED row —
 * never the caller's. Pure over ports, so node:test drives the race: a locked row
 * whose marker is already set owes no email; a locked row already cancelled
 * leaves the commission and the calendar alone.
 */
export async function applyLockedRead(ports: LockedReadPorts, caller: CallerRow, read: VendorAnswer, readAt: Date): Promise<LockedReadResult> {
  const locked = await ports.lock(caller.id);
  if (locked === null) throw new Error(`reservation ${caller.id} is gone — deleted between the GET and the lock; nothing landed, nothing applied`);
  const guestRef = locked.userId === null ? bookingGuestRef(caller.providerBookingId) : null;
  if (caller.lane === 'hotel') {
    const landed = await landLiteApiBookingRead(ports.landing, { answer: read.answer, bookingId: caller.providerBookingId, payload: read.object, parse: parseHotelBookingState, userId: locked.userId, guestRef });
    const out = await applyVendorState(ports.apply, locked, {
      lane: 'hotel',
      bookingId: landed.parsed.bookingId,
      status: landed.parsed.status,
      hotelConfirmationCode: landed.parsed.hotelConfirmationCode,
      // COMM-01: the documented figures, verbatim, and the read's arrival — the lock's evidence.
      commission: landed.parsed.commission,
      distributorCommission: landed.parsed.distributorCommission,
      clientCommission: landed.parsed.clientCommission,
      processingFee: landed.parsed.processingFee,
      arrivalId: landed.arrivalId,
      readAt,
    });
    return { locked, arrivalId: landed.arrivalId, changes: out.changes, status: out.status, statusValue: out.statusValue, providerStatus: out.providerStatus, emails: out.emails, flight: null, commissionLock: out.commissionLock };
  }
  const landed = await landLiteApiBookingRead(ports.landing, { answer: read.answer, bookingId: caller.providerBookingId, payload: read.object, parse: parseFlightBookingDetails, userId: locked.userId, guestRef });
  const out = await refreshFlightReservation({ ...ports.apply, calendar: ports.calendar, fetchBooking: async () => ({ ...landed.parsed, readAt }) }, locked);
  if (!out.fetched) throw new Error(out.reason);
  return { locked, arrivalId: landed.arrivalId, changes: out.changes, status: out.status === 'unmapped' ? 'unlisted' : out.status, statusValue: out.statusValue, providerStatus: out.providerStatus, emails: out.emails, flight: { calendar: out.calendar, day: out.day, name: out.name }, commissionLock: { outcome: 'not_applicable' } };
}

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
      flight: LockedReadResult['flight'];
      /** COMM-01: what the lock did (or, on a dry run, would do). */
      commissionLock: CommissionLockOutcome;
      /** The one attempt at each email the apply owed — empty on a dry run and when nothing was owed. */
      emails: LifecycleEmailStatus[];
      /** On a dry run: the emails that WOULD have been attempted. */
      emailsOwed: LifecycleEmailRequest[];
      /** On a dry run: the write that WOULD have been made. */
      wouldWrite: FlightReservationPatch | null;
    }
  | {
      outcome: 'read_failed';
      /** 'quota' — the daily cap refused the read (a caller stops its batch); 'vendor' — the GET failed; 'apply' — the lock, the landing or the apply threw. */
      kind: 'quota' | 'vendor' | 'apply' | 'lane';
      reason: string;
    };

export interface VendorReadOptions {
  source: VendorReadSource;
  /** Read the vendor, land nothing, write nothing, send nothing — report what would change. Takes NO lock. */
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

  // 2. THE GET, by lane — the caller's row chose it, and contributes nothing else.
  let read: VendorAnswer;
  try {
    read = lane === 'hotel' ? await getHotelBooking(row.providerBookingId) : await getFlightBooking(row.providerBookingId);
  } catch (err) {
    return { outcome: 'read_failed', kind: 'vendor', reason: `${tag}: GET of ${lane} booking ${row.providerBookingId} failed (${nameErr(err)}) — row untouched, 'read_failed'` };
  }
  const readAt = read.answer.arrived;

  // 3. LOCK, LAND AND APPLY — one transaction; a dry run takes no lock and lands nothing.
  const writes: FlightReservationPatch[] = [];
  const wouldLock: CommissionFigures[] = [];
  type Applied = Omit<LockedReadResult, 'arrivalId'> & { arrivalId: string | null };
  const applied: Applied | { failed: string } = await (async () => {
    try {
      if (opts.dryRun) {
        // NO LOCK, NO TRANSACTION: nothing is landed or written, so the caller's row is
        // the only row there is; the same leaf runs over recording ports.
        const recording: ApplyPorts = {
          writeReservation: async (_id, patch: ReservationPatch) => { writes.push(patch); },
          calendar: { async markCancelled() { return 0; } },
          cancelCommission: async () => 0,
          // A dry run answers 1 so the leaf reports what it WOULD lock; nothing is written.
          lockCommission: async (_id, figures) => { wouldLock.push(figures); return 1; },
          log,
        };
        if (lane === 'hotel') {
          const parsed = parseHotelBookingState(read.object);
          const out = await applyVendorState(recording, row, {
            lane: 'hotel', bookingId: parsed.bookingId, status: parsed.status, hotelConfirmationCode: parsed.hotelConfirmationCode,
            commission: parsed.commission, distributorCommission: parsed.distributorCommission, clientCommission: parsed.clientCommission, processingFee: parsed.processingFee,
            arrivalId: null, readAt,
          });
          return { locked: row, arrivalId: null, changes: out.changes, status: out.status, statusValue: out.statusValue, providerStatus: out.providerStatus, emails: out.emails, flight: null, commissionLock: out.commissionLock };
        }
        const live = prismaBookingCalendar(prisma);
        const parsed = parseFlightBookingDetails(read.object);
        const out = await refreshFlightReservation({
          ...recording,
          calendar: { find: live.find, async insert() {}, async markCancelled() { return 0; } },
          writeReservation: async (_id, patch) => { writes.push(patch); },
          fetchBooking: async () => ({ ...parsed, readAt }),
        }, row);
        if (!out.fetched) return { failed: out.reason };
        return { locked: row, arrivalId: null, changes: out.changes, status: out.status === 'unmapped' ? 'unlisted' : out.status, statusValue: out.statusValue, providerStatus: out.providerStatus, emails: out.emails, flight: { calendar: out.calendar, day: out.day, name: out.name }, commissionLock: { outcome: 'not_applicable' } };
      }
      return await prisma.$transaction(async (tx) => applyLockedRead(
        {
          // STATUS-01b: ONE READ HOLDS THE ROW — re-selected by id FOR UPDATE, every
          // VENDOR_READ_SELECT column, before anything is landed or applied.
          lock: async (id) => (await tx.$queryRaw<VendorReadRow[]>`SELECT ${LOCK_COLUMNS} FROM reservations WHERE id = ${id}::uuid FOR UPDATE`)[0] ?? null,
          landing: { landing: prismaLanding(tx), log },
          apply: {
            writeReservation: async (id, patch: ReservationPatch) => { writes.push(patch); await tx.reservations.update({ where: { id }, data: patch }); },
            calendar: prismaBookingCalendar(tx),
            cancelCommission: async (reservationId) => (await tx.commission_ledger.updateMany({ where: { reservationId, status: 'estimated' }, data: { status: 'cancelled' } })).count,
            // COMM-01: the lock — 'estimated' → 'confirmed' with the vendor's figures, the read instant and its arrival.
            lockCommission: async (reservationId, figures, lockedAt, arrivalId) => (await tx.commission_ledger.updateMany({
              where: { reservationId, status: 'estimated' },
              data: {
                status: 'confirmed',
                lockedCommissionCents: figures.lockedCommissionCents,
                distributorCommissionCents: figures.distributorCommissionCents,
                clientCommissionCents: figures.clientCommissionCents,
                processingFeeCents: figures.processingFeeCents,
                lockedAt,
                lockArrivalId: arrivalId,
              },
            })).count,
            log,
          },
          calendar: prismaBookingCalendar(tx),
        },
        { id: row.id, lane, providerBookingId: row.providerBookingId },
        read,
        readAt,
      ));
    } catch (err) {
      return { failed: `${tag}: the ${opts.dryRun ? 'dry-run apply' : 'lock, the landing or the apply'} threw (${nameErr(err)}) — rolled back, row untouched, 'read_failed'` };
    }
  })();
  if ('failed' in applied) return { outcome: 'read_failed', kind: 'apply', reason: applied.failed };

  const wouldWrite = writes[0] ?? null;
  const changed = applied.changes.length > 0 || applied.flight?.calendar === 'inserted';

  // 4. THE EMAILS — after the commit, one attempt each, from the row as it was locked; never on a dry run.
  const emails: LifecycleEmailStatus[] = [];
  if (!opts.dryRun) {
    const emailRow = { ...applied.locked, providerConfirmationCode: wouldWrite?.providerConfirmationCode ?? applied.locked.providerConfirmationCode, displayName: wouldWrite?.displayName ?? applied.locked.displayName };
    for (const request of applied.emails) emails.push(await sendLifecycleEmail(emailRow, request));
  }

  log(`${tag}: ${lane} ${row.providerBookingId} read (${applied.providerStatus ?? 'no status'}) — ${changed ? `APPLIED: ${applied.changes.join('; ')}` : 'unchanged'}${applied.emails.length ? `; emails ${opts.dryRun ? 'owed' : 'attempted'}: ${applied.emails.map((e) => e.kind).join(', ')}` : ''}${opts.dryRun ? ' (dry run — no lock, nothing landed, written or sent)' : ''}`);
  return {
    outcome: changed ? 'applied' : 'unchanged',
    changes: applied.changes,
    status: applied.status,
    statusValue: applied.statusValue,
    providerStatus: applied.providerStatus,
    readAt,
    arrivalId: applied.arrivalId,
    flight: applied.flight,
    commissionLock: applied.commissionLock,
    emails,
    emailsOwed: applied.emails,
    wouldWrite: opts.dryRun ? wouldWrite : null,
  };
}
