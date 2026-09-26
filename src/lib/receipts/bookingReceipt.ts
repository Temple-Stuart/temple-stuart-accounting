/**
 * RECEIPT-01 (2026-09-26) — THE RECEIPT IS THE VENDOR'S LANDED WORDS.
 *
 * A receipt SHOWS what the vendor stated (the landed book answer and the latest
 * landed booking read), what the bank recorded (the accepted charge link's bank
 * row) and what the ledger recorded (the posted entry that documents the
 * booking), each figure naming its source and its evidence. It COMPUTES NOTHING:
 * no total, no tax, no fee, no conversion — the vendor's price IS the total line,
 * a ledger line is shown in the cents the ledger holds, a bank amount as the bank
 * recorded it. A figure the vendor did not state reads "not stated by the vendor".
 * Commission never appears: it is Temple Stuart's book, not the customer's.
 *
 * THE FIELDS READ ARE THE DOCUMENTED ONES, from the LANDED payload only:
 *   · hotel book answer (docs.liteapi.travel/reference/post_rates-book, data.*):
 *     bookingId, status, hotelConfirmationCode, checkin, checkout, hotel.name,
 *     bookedRooms[].roomType.name / boardName / board / adults / children,
 *     holder.firstName / lastName / email, cancellationPolicies.cancelPolicyInfos[]
 *     {cancelTime, amount, currency, type, timezone}, cancellationPolicies.
 *     hotelRemarks[], cancellationPolicies.refundableTag, price, currency,
 *     sellingPrice (a string), createdAt.
 *     NOT DOCUMENTED on the book answer: mandatoryFees, optionalFees, taxesAndFees,
 *     checkinInstructions — never read from it.
 *   · hotel booking read (reference/get_bookings-bookingid, data.*): the same, plus
 *     checkinInstructions {instructions, idRequired, propertyContact.email/phone,
 *     arrivalTimeRequested}, paymentStatus, amountRefunded, refundType, refundedAt,
 *     cancelledAt, knowBeforeYouGo, hotelRemarks, remarks.
 *     NOT DOCUMENTED on the read: mandatoryFees, optionalFees, taxesAndFees.
 *   · flight book answer and read (reference/get_flights-bookings-bookingid,
 *     data[0].booking — the landed object): bookingId, bookingRef, status,
 *     timestamp, journey.segments[] {carrier.marketingName, carrier.marketingCode,
 *     flight.marketingNumber, originCode, destinationCode, departureTime,
 *     arrivalTime}, journey.cabinClass, journey.price {base, taxes, fees, total,
 *     currency}, pricing {subtotal, totalAmount, currency}, passengers[] {firstName,
 *     lastName, type}, contact {firstName, email}, order.reference.provider.pnr,
 *     order.reference.airlineBookings[].pnr, ticketData {ticketedAt, confirmationId},
 *     ticketLimitTime, paymentStatus.
 *     NOT DOCUMENTED: tickets[] (no ticket-number array), holder (the flight answer
 *     states `contact`), a booking-level price (it lives at journey.price / pricing).
 *
 * THIS FILE IS PURE: no prisma, no fetch, no clock, no React, no env. node:test
 * drives it with fixtures shaped by the documented answers.
 */
import { LANE_WORD, reservationIdentity, type ReservationIdentityRow } from '../reservations/lane';

// ─── inputs ──────────────────────────────────────────────────────────────────

export interface ReceiptReservation extends ReservationIdentityRow {
  id: string;
  status: string;
  createdAt: Date | string;
  checkinDate: Date | string | null;
  checkoutDate: Date | string | null;
}

/** An arrivals row: the landed object (`payload`) and when it arrived. */
export interface ReceiptArrival {
  id: string;
  arrived: Date | string | null;
  payload: unknown;
}

/** The accepted CHARGE link's bank row (transaction_reservation_links, moneyEventId null, status accepted). */
export interface ReceiptChargeLink {
  id: string;
  transaction: { id: string; name: string; merchantName: string | null; amount: number; date: Date | string };
}

export interface ReceiptLedgerLine {
  id: string;
  entry_type: string;
  /** Cents as the ledger holds them (BigInt on the wire) — rendered verbatim, never divided. */
  amount: bigint | number | string;
  account: { code: string; name: string };
}

/** The posted entry that documents the booking's charge (journal_entries.document_reservation_id, no money event, status posted). */
export interface ReceiptJournalEntry {
  id: string;
  date: Date | string;
  status: string;
  ledger_entries: ReceiptLedgerLine[];
}

export interface ReceiptMoneyEvent {
  id: string;
  kind: string;
  amountCents: number | null;
  currency: string | null;
  status: string;
  statedAt: Date | string;
  settledTransactionId: string | null;
  settledAt: Date | string | null;
  /** The settling bank row when loaded (MATCH-02 evidence). */
  settledTransaction?: { name: string; date: Date | string } | null;
}

export interface ReceiptInput {
  reservation: ReceiptReservation;
  /** The landed book answer (reservations.arrival_id), or null when none was landed (a row before REBUILD-01 PR-5). */
  bookArrival: ReceiptArrival | null;
  /** The LATEST landed booking read (resource booking_read, their_id read:<bookingId>, arrived DESC), or null. */
  latestReadArrival: ReceiptArrival | null;
  chargeLink: ReceiptChargeLink | null;
  journalEntry: ReceiptJournalEntry | null;
  moneyEvents: ReceiptMoneyEvent[];
}

// ─── output ──────────────────────────────────────────────────────────────────

export type FigureSource = 'vendor' | 'bank' | 'ledger';

/** Where a figure came from and the row that proves it: an arrival id, a transaction id or a journal entry id. */
export interface Figure {
  source: FigureSource;
  evidence: string;
}

export interface ReceiptLine {
  label: string;
  /** The words, verbatim from the source or the named absence. */
  value: string;
  /** "stated by the vendor on <arrived>", "recorded by your bank", "posted to the ledger". */
  note: string | null;
  figure: Figure | null;
}

export interface ReceiptHeader {
  laneWord: string;
  name: string;
  vendorBookingId: string;
  confirmationCode: string;
  statusWord: string;
  /** The vendor's own status word on the latest read, or the named absence. */
  vendorStatus: string;
  bookedAt: string;
  holder: string;
}

export interface HotelBody {
  rooms: string[];
  checkin: string;
  checkout: string;
  checkinInstructions: string[];
  cancellationPolicy: string[];
}

export interface FlightBody {
  segments: string[];
  passengers: string[];
  pnr: string;
  ticketing: string;
}

export interface VendorMoney {
  /** The vendor's price and currency — THE total line; nothing is summed into it. */
  total: ReceiptLine;
  /** Every other documented figure the landed bytes state, each its own line. */
  lines: ReceiptLine[];
  /** The raw figures for the export: the recorded strings, never converted. */
  raw: { amount: string | null; currency: string | null; arrivalId: string | null };
}

export interface BankMoney {
  line: ReceiptLine | null;
  words: string;
  raw: { transactionId: string | null; descriptor: string | null; amount: string | null; date: string | null };
}

export interface LedgerMoney {
  entry: ReceiptLine | null;
  lines: ReceiptLine[];
  words: string;
  raw: { entryId: string | null; date: string | null; accountCode: string | null; accountName: string | null; debitCents: string | null; creditCents: string | null };
}

export interface RefundRow {
  kind: string;
  amount: string;
  statedAt: string;
  settlement: string;
  figure: Figure;
  raw: { id: string; kind: string; status: string; amountCents: string | null; currency: string | null; settledTransactionId: string | null };
}

export interface BookingReceipt {
  header: ReceiptHeader;
  hotel: HotelBody | null;
  flight: FlightBody | null;
  vendor: VendorMoney;
  bank: BankMoney;
  ledger: LedgerMoney;
  refunds: RefundRow[];
  /** The refunds section's own words: the named absence when the vendor stated none. */
  refundsWords: string;
  /** What this receipt is and is not — the words, so the page types none. */
  notes: string[];
}

// ─── words ───────────────────────────────────────────────────────────────────

export const NOT_STATED = 'not stated by the vendor';
export const NOT_YET_STATED_CODE = 'not yet stated by the vendor';
export const NO_BOOK_ANSWER = 'no book answer was landed for this booking';
export const NO_READ_YET = 'no booking read has been landed yet';
export const NOT_MATCHED = 'not yet matched to a bank row';
export const NOT_POSTED = 'not posted';
export const NOT_YET_TICKETED = 'not yet ticketed';
export const STATED_NOT_IN_BANK = 'stated by the vendor, not yet in the bank';
export const NO_REFUNDS = 'no refund or fee stated by the vendor';
export const REFUNDS_AS_STATED = 'as the vendor stated them';
export const RECORDED_BY_BANK = 'recorded by your bank';
export const POSTED_TO_LEDGER = 'posted to the ledger';
export const RECEIPT_NOTES: readonly string[] = [
  'Every figure names its source: the vendor (its landed answer), your bank (the matched row) or the ledger (the posted entry). Nothing on this receipt is computed — the vendor’s price is the total line as the vendor stated it.',
  'A figure the vendor did not state is shown as not stated. Taxes and fees are not a documented field of the hotel book answer and are shown only when the vendor states them on a flight.',
  'Downloadable means your browser’s Print / Save as PDF — no file is generated on the server.',
];

// ─── helpers (no arithmetic on money anywhere below) ─────────────────────────

type Obj = Record<string, unknown>;

function obj(v: unknown): Obj | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : null;
}
function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}
/** A stated number, verbatim as a string — never rounded, converted or formatted. */
function numWord(v: unknown): string | null {
  return typeof v === 'number' && Number.isFinite(v) ? String(v) : null;
}
function intWord(v: unknown): string | null {
  return typeof v === 'number' && Number.isInteger(v) ? String(v) : null;
}
function iso(d: Date | string | null | undefined): string | null {
  if (d === null || d === undefined) return null;
  return typeof d === 'string' ? d : d.toISOString();
}
function isoDay(d: Date | string | null | undefined): string | null {
  const s = iso(d);
  return s === null ? null : s.slice(0, 10);
}
function statedOn(arrival: ReceiptArrival): string {
  return `stated by the vendor on ${iso(arrival.arrived) ?? 'an arrival with no arrived instant'}`;
}
function vendorFigure(arrival: ReceiptArrival): Figure {
  return { source: 'vendor', evidence: arrival.id };
}
function moneyWords(amount: string | null, currency: string | null): string {
  if (amount === null) return NOT_STATED;
  return currency === null ? `${amount} (currency ${NOT_STATED})` : `${amount} ${currency}`;
}

// ─── the header ──────────────────────────────────────────────────────────────

function holderOf(lane: string, book: Obj | null, read: Obj | null): string {
  // The book answer states the holder at booking; a read may restate it. The first answer that states one is quoted.
  for (const src of [book, read]) {
    if (src === null) continue;
    if (lane === 'flight') {
      // The flight answer documents `contact` (firstName, email); `holder` is not documented.
      const contact = obj(src.contact);
      const parts = [str(contact?.firstName), str(contact?.email)].filter((p): p is string => p !== null);
      if (parts.length > 0) return parts.join(' · ');
      continue;
    }
    const holder = obj(src.holder);
    const name = [str(holder?.firstName), str(holder?.lastName)].filter((p): p is string => p !== null).join(' ');
    const email = str(holder?.email);
    const parts = [name.length > 0 ? name : null, email].filter((p): p is string => p !== null);
    if (parts.length > 0) return parts.join(' · ');
  }
  return NOT_STATED;
}

// ─── the hotel body ──────────────────────────────────────────────────────────

function roomWords(room: Obj): string {
  const roomType = obj(room.roomType);
  const name = str(roomType?.name) ?? `room type ${NOT_STATED}`;
  const board = str(room.boardName) ?? str(room.board) ?? `board ${NOT_STATED}`;
  const adults = intWord(room.adults);
  const children = intWord(room.children);
  const occupancy = adults === null && children === null
    ? `occupancy ${NOT_STATED}`
    : `${adults ?? '?'} adult(s), ${children ?? '?'} child(ren)`;
  return `${name} · ${board} · ${occupancy}`;
}

function cancellationPolicyLines(policies: unknown): string[] {
  const p = obj(policies);
  if (p === null) return [];
  const out: string[] = [];
  const tag = str(p.refundableTag);
  if (tag !== null) out.push(`refundable tag: ${tag}`);
  const infos = Array.isArray(p.cancelPolicyInfos) ? p.cancelPolicyInfos : [];
  for (const raw of infos) {
    const info = obj(raw);
    if (info === null) continue;
    const when = str(info.cancelTime) ?? `deadline ${NOT_STATED}`;
    const tz = str(info.timezone);
    const penalty = moneyWords(numWord(info.amount), str(info.currency));
    const type = str(info.type);
    out.push(`cancel by ${when}${tz ? ` ${tz}` : ''}: ${penalty}${type ? ` (${type})` : ''}`);
  }
  const remarks = Array.isArray(p.hotelRemarks) ? p.hotelRemarks : [];
  for (const r of remarks) if (typeof r === 'string' && r.length > 0) out.push(`hotel remark: ${r}`);
  return out;
}

function checkinInstructionLines(read: Obj | null): string[] {
  if (read === null) return [];
  const ci = obj(read.checkinInstructions);
  if (ci === null) return [];
  const out: string[] = [];
  const text = str(ci.instructions);
  if (text !== null) out.push(text);
  if (typeof ci.idRequired === 'boolean') out.push(`ID required at check-in: ${ci.idRequired ? 'yes' : 'no'}`);
  if (typeof ci.arrivalTimeRequested === 'boolean') out.push(`arrival time requested by the property: ${ci.arrivalTimeRequested ? 'yes' : 'no'}`);
  const contact = obj(ci.propertyContact);
  const contactParts = [str(contact?.email), str(contact?.phone)].filter((p): p is string => p !== null);
  if (contactParts.length > 0) out.push(`property contact: ${contactParts.join(' · ')}`);
  return out;
}

function hotelBody(book: Obj | null, read: Obj | null, hasRead: boolean): HotelBody {
  const src = book ?? read;
  const rooms = Array.isArray(src?.bookedRooms) ? src!.bookedRooms.map((r) => obj(r)).filter((r): r is Obj => r !== null).map(roomWords) : [];
  const instructions = checkinInstructionLines(read);
  return {
    rooms: rooms.length > 0 ? rooms : [`rooms ${NOT_STATED}`],
    checkin: str(src?.checkin) ?? NOT_STATED,
    checkout: str(src?.checkout) ?? NOT_STATED,
    checkinInstructions: instructions.length > 0 ? instructions : [hasRead ? `check-in instructions ${NOT_STATED} on the latest read` : NO_READ_YET],
    cancellationPolicy: (() => {
      const lines = cancellationPolicyLines(src?.cancellationPolicies);
      return lines.length > 0 ? lines : [`cancellation policy ${NOT_STATED}`];
    })(),
  };
}

// ─── the flight body ─────────────────────────────────────────────────────────

function segmentWords(seg: Obj): string {
  const carrier = obj(seg.carrier);
  const flight = obj(seg.flight);
  const carrierName = str(carrier?.marketingName) ?? str(carrier?.marketingCode) ?? `carrier ${NOT_STATED}`;
  const number = str(flight?.marketingNumber);
  const route = `${str(seg.originCode) ?? '?'} → ${str(seg.destinationCode) ?? '?'}`;
  const dep = str(seg.departureTime) ?? `departure ${NOT_STATED}`;
  const arr = str(seg.arrivalTime) ?? `arrival ${NOT_STATED}`;
  return `${carrierName}${number ? ` ${number}` : ''} · ${route} · departs ${dep} · arrives ${arr}`;
}

function passengerWords(p: Obj): string {
  const name = [str(p.firstName), str(p.lastName)].filter((x): x is string => x !== null).join(' ');
  const type = str(p.type);
  return `${name.length > 0 ? name : `name ${NOT_STATED}`}${type ? ` (${type})` : ''}`;
}

function pnrOf(src: Obj | null): string | null {
  const order = obj(src?.order);
  const reference = obj(order?.reference);
  const provider = obj(reference?.provider);
  const fromProvider = str(provider?.pnr);
  if (fromProvider !== null) return fromProvider;
  const airlines = Array.isArray(reference?.airlineBookings) ? reference!.airlineBookings : [];
  for (const a of airlines) {
    const pnr = str(obj(a)?.pnr);
    if (pnr !== null) return pnr;
  }
  return null;
}

function flightBody(book: Obj | null, read: Obj | null): FlightBody {
  // The latest read carries the current state; the book answer is the same documented object.
  const src = read ?? book;
  const journey = obj(src?.journey);
  const segments = Array.isArray(journey?.segments) ? journey!.segments.map((s) => obj(s)).filter((s): s is Obj => s !== null).map(segmentWords) : [];
  const passengers = Array.isArray(src?.passengers) ? src!.passengers.map((p) => obj(p)).filter((p): p is Obj => p !== null).map(passengerWords) : [];
  const ticketData = obj(src?.ticketData);
  const ticketedAt = str(ticketData?.ticketedAt);
  const confirmationId = str(ticketData?.confirmationId);
  return {
    segments: segments.length > 0 ? segments : [`segments ${NOT_STATED}`],
    passengers: passengers.length > 0 ? passengers : [`passengers ${NOT_STATED}`],
    pnr: pnrOf(src) ?? NOT_YET_STATED_CODE,
    // tickets[] is NOT DOCUMENTED; ticketing is ticketData.ticketedAt (+ confirmationId) as the vendor states it.
    ticketing: ticketedAt === null ? NOT_YET_TICKETED : `ticketed at ${ticketedAt}${confirmationId ? ` · confirmation ${confirmationId}` : ''}`,
  };
}

// ─── money — the vendor ──────────────────────────────────────────────────────

function vendorMoney(lane: string, bookArrival: ReceiptArrival | null, readArrival: ReceiptArrival | null): VendorMoney {
  const none: VendorMoney = {
    total: { label: 'Total (the vendor’s price)', value: NO_BOOK_ANSWER, note: null, figure: null },
    lines: [],
    raw: { amount: null, currency: null, arrivalId: null },
  };
  if (bookArrival === null) return none;
  const book = obj(bookArrival.payload);
  if (book === null) return { ...none, total: { ...none.total, value: `${NOT_STATED} — the landed book answer holds no object` } };
  const note = statedOn(bookArrival);
  const figure = vendorFigure(bookArrival);
  const lines: ReceiptLine[] = [];

  if (lane === 'flight') {
    // pricing.totalAmount is "Grand total charged"; journey.price states base / taxes / fees / total.
    const pricing = obj(book.pricing);
    const amount = numWord(pricing?.totalAmount);
    const currency = str(pricing?.currency);
    const journey = obj(book.journey);
    const price = obj(journey?.price);
    const priceCurrency = str(price?.currency);
    for (const [key, label] of [['base', 'Base fare'], ['taxes', 'Taxes'], ['fees', 'Fees'], ['total', 'Journey total']] as const) {
      const v = numWord(price?.[key]);
      lines.push({ label, value: v === null ? NOT_STATED : moneyWords(v, priceCurrency), note: v === null ? null : note, figure: v === null ? null : figure });
    }
    const subtotal = numWord(pricing?.subtotal);
    lines.push({ label: 'Subtotal before ancillaries', value: subtotal === null ? NOT_STATED : moneyWords(subtotal, currency), note: subtotal === null ? null : note, figure: subtotal === null ? null : figure });
    return {
      total: { label: 'Total (the vendor’s price)', value: amount === null ? NOT_STATED : moneyWords(amount, currency), note: amount === null ? null : note, figure: amount === null ? null : figure },
      lines,
      raw: { amount, currency, arrivalId: bookArrival.id },
    };
  }

  // Hotel: price + currency is the total; sellingPrice is a documented string; taxes and fees are not documented on either answer.
  const amount = numWord(book.price);
  const currency = str(book.currency);
  const selling = str(book.sellingPrice) ?? numWord(book.sellingPrice);
  lines.push({ label: 'Selling price (as the vendor states it)', value: selling === null ? NOT_STATED : moneyWords(selling, currency), note: selling === null ? null : note, figure: selling === null ? null : figure });
  lines.push({ label: 'Taxes and fees', value: `${NOT_STATED} (not a documented field of the hotel book answer or the booking read)`, note: null, figure: null });
  const read = obj(readArrival?.payload);
  if (readArrival !== null && read !== null) {
    const readNote = statedOn(readArrival);
    const readFigure = vendorFigure(readArrival);
    const paymentStatus = str(read.paymentStatus);
    if (paymentStatus !== null) lines.push({ label: 'Payment status (vendor)', value: paymentStatus, note: readNote, figure: readFigure });
    const refunded = numWord(read.amountRefunded);
    if (refunded !== null) lines.push({ label: 'Amount refunded (vendor)', value: moneyWords(refunded, str(read.currency) ?? currency), note: readNote, figure: readFigure });
  }
  return {
    total: { label: 'Total (the vendor’s price)', value: amount === null ? NOT_STATED : moneyWords(amount, currency), note: amount === null ? null : note, figure: amount === null ? null : figure },
    lines,
    raw: { amount, currency, arrivalId: bookArrival.id },
  };
}

// ─── money — the bank and the ledger ─────────────────────────────────────────

function bankMoney(link: ReceiptChargeLink | null): BankMoney {
  if (link === null) return { line: null, words: NOT_MATCHED, raw: { transactionId: null, descriptor: null, amount: null, date: null } };
  const t = link.transaction;
  const amount = String(t.amount);
  const date = isoDay(t.date) ?? 'date not recorded';
  const descriptor = t.merchantName ? `${t.name} (${t.merchantName})` : t.name;
  return {
    line: { label: 'Bank row', value: `${descriptor} · ${amount} · ${date}`, note: RECORDED_BY_BANK, figure: { source: 'bank', evidence: t.id } },
    words: `${RECORDED_BY_BANK} — matched by an accepted link (${link.id})`,
    raw: { transactionId: t.id, descriptor: t.name, amount, date },
  };
}

function ledgerMoney(entry: ReceiptJournalEntry | null): LedgerMoney {
  if (entry === null) return { entry: null, lines: [], words: NOT_POSTED, raw: { entryId: null, date: null, accountCode: null, accountName: null, debitCents: null, creditCents: null } };
  const figure: Figure = { source: 'ledger', evidence: entry.id };
  const date = isoDay(entry.date) ?? 'date not recorded';
  const lines = entry.ledger_entries.map((l) => ({
    label: l.entry_type === 'D' ? 'Debit' : l.entry_type === 'C' ? 'Credit' : `Line ${l.entry_type}`,
    value: `${l.account.code} ${l.account.name} · ${String(l.amount)} cents`,
    note: POSTED_TO_LEDGER,
    figure,
  }));
  const debit = entry.ledger_entries.find((l) => l.entry_type === 'D') ?? null;
  const credit = entry.ledger_entries.find((l) => l.entry_type === 'C') ?? null;
  return {
    entry: { label: 'Journal entry', value: `${entry.id} · ${date} · ${entry.status}`, note: POSTED_TO_LEDGER, figure },
    lines,
    words: POSTED_TO_LEDGER,
    raw: {
      entryId: entry.id,
      date,
      accountCode: debit?.account.code ?? null,
      accountName: debit?.account.name ?? null,
      debitCents: debit === null ? null : String(debit.amount),
      creditCents: credit === null ? null : String(credit.amount),
    },
  };
}

function refundRows(events: ReceiptMoneyEvent[]): RefundRow[] {
  return events.map((e) => {
    const cents = e.amountCents === null ? null : String(e.amountCents);
    const amount = cents === null ? NOT_STATED : `${cents} cents${e.currency ? ` ${e.currency}` : ` (currency ${NOT_STATED})`}`;
    const settlement = e.status === 'settled' && e.settledTransactionId !== null
      ? `settled by bank row ${e.settledTransactionId}${e.settledTransaction ? ` (${e.settledTransaction.name} · ${isoDay(e.settledTransaction.date) ?? 'date not recorded'})` : ''} on ${iso(e.settledAt) ?? 'an instant not recorded'}`
      : STATED_NOT_IN_BANK;
    return {
      kind: e.kind,
      amount,
      statedAt: iso(e.statedAt) ?? 'instant not recorded',
      settlement,
      figure: { source: 'vendor', evidence: e.id },
      raw: { id: e.id, kind: e.kind, status: e.status, amountCents: cents, currency: e.currency, settledTransactionId: e.settledTransactionId },
    };
  });
}

// ─── the receipt ─────────────────────────────────────────────────────────────

export function receiptOf(input: ReceiptInput): BookingReceipt {
  const { reservation, bookArrival, latestReadArrival, chargeLink, journalEntry, moneyEvents } = input;
  const identity = reservationIdentity(reservation);
  const book = obj(bookArrival?.payload);
  const read = obj(latestReadArrival?.payload);
  const vendorStatus = str(read?.status);
  const header: ReceiptHeader = {
    laneWord: LANE_WORD[identity.type],
    name: identity.name,
    vendorBookingId: reservation.providerBookingId,
    confirmationCode: (typeof reservation.providerConfirmationCode === 'string' && reservation.providerConfirmationCode.trim().length > 0)
      ? reservation.providerConfirmationCode.trim()
      : NOT_YET_STATED_CODE,
    statusWord: reservation.status,
    vendorStatus: latestReadArrival === null
      ? NO_READ_YET
      : vendorStatus === null
        ? `${NOT_STATED} on the latest read (${iso(latestReadArrival.arrived) ?? 'no arrived instant'})`
        : `${vendorStatus} — as the vendor last stated on ${iso(latestReadArrival.arrived) ?? 'an arrival with no arrived instant'}`,
    bookedAt: iso(reservation.createdAt) ?? 'not recorded',
    holder: holderOf(identity.type, book, read),
  };
  return {
    header,
    hotel: identity.type === 'hotel' ? hotelBody(book, read, latestReadArrival !== null) : null,
    flight: identity.type === 'flight' ? flightBody(book, read) : null,
    vendor: vendorMoney(identity.type, bookArrival, latestReadArrival),
    bank: bankMoney(chargeLink),
    ledger: ledgerMoney(journalEntry),
    refunds: refundRows(moneyEvents),
    refundsWords: moneyEvents.length === 0 ? NO_REFUNDS : REFUNDS_AS_STATED,
    notes: [...RECEIPT_NOTES],
  };
}
