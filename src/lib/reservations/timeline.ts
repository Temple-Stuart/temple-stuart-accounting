/**
 * AUDIT-01 (2026-09-26) — A BOOKING SHOWS ITS OWN HISTORY: ONE WORDS LEAF.
 *
 * Two things live here, and nowhere else:
 *
 *   1. bookingEventWords(kind, facts) — the ONE line an audit row carries as its
 *      action_description. The audit port (src/lib/reservations/auditTrail.ts)
 *      renders every description through it; no call site types a description.
 *
 *   2. timelineOf(input) — the booking's history, read from the PRIMARY tables
 *      (the landed arrivals, the webhook deliveries, the money events, the
 *      commission rows, the posted entries, the calendar rows) AND the audit rows,
 *      so a missing audit row can hide nothing. Each item: { at, kind, words,
 *      evidence: { table, id } }, ordered by `at`, then by kind, then by evidence.
 *
 * Every kind has words here. An audit action this leaf does not know renders AS
 * ITSELF — the stored action type and the stored description, verbatim — never as
 * a guess. A value the source did not state is said to be not stated; nothing is
 * computed, converted or summed.
 *
 * THIS FILE IS PURE: no prisma, no fetch, no clock, no React, no env.
 */

/** The sixteen booking kinds (AuditActionType values added by AUDIT-01). */
export const BOOKING_EVENT_KINDS = [
  'reservation_booked',
  'reservation_status_changed',
  'reservation_confirmation_code_arrived',
  'reservation_ticketed',
  'reservation_ticket_limit_stated',
  'reservation_cancel_quoted',
  'reservation_cancel_requested',
  'reservation_cancel_pending',
  'reservation_cancelled',
  'reservation_cancel_refused',
  'reservation_email_sent',
  'reservation_email_failed',
  'reservation_posted',
  'money_event_stated',
  'money_event_settled',
  'commission_locked',
] as const;

export type BookingEventKind = (typeof BOOKING_EVENT_KINDS)[number];

export function isBookingEventKind(v: string): v is BookingEventKind {
  return (BOOKING_EVENT_KINDS as readonly string[]).includes(v);
}

export interface Evidence {
  table: string;
  id: string;
}

export interface EventFacts {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

// ─── helpers: the stated value, verbatim, or the named absence ──────────────

const NOT_STATED = 'not stated';

function word(v: unknown): string {
  if (v === null || v === undefined || v === '') return NOT_STATED;
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function field(facts: Record<string, unknown> | null, key: string): unknown {
  return facts === null ? undefined : facts[key];
}

/** Cents as stated, with the currency when stated — never divided, never converted. */
function centsWords(cents: unknown, currency: unknown): string {
  if (cents === null || cents === undefined) return 'no amount stated';
  return `${String(cents)} cents${currency ? ` ${String(currency)}` : ''}`;
}

/** An amount in the vendor's own unit (a quote's display figure), verbatim. */
function amountWords(amount: unknown, currency: unknown): string {
  if (amount === null || amount === undefined) return NOT_STATED;
  return `${String(amount)}${currency ? ` ${String(currency)}` : ''}`;
}

/** The email a row names — its kind, the words a customer knows it by. */
export const EMAIL_WORDS: Readonly<Record<string, string>> = {
  booking_confirmation: 'the booking confirmation',
  flight_confirmation: 'the flight confirmation',
  cancellation: 'the cancellation confirmation',
  cancel_pending: 'the cancellation-requested notice',
  ticketed: 'the ticketed notice',
  hotel_confirmation_arrived: 'the confirmation-number notice',
};

function emailWords(kind: unknown): string {
  return typeof kind === 'string' && EMAIL_WORDS[kind] ? EMAIL_WORDS[kind] : `the email "${word(kind)}"`;
}

// ─── 1. the description of an audit row ─────────────────────────────────────

/** ONE line for a booking change — the audit row's action_description and the timeline's words. */
export function bookingEventWords(kind: BookingEventKind, facts: EventFacts): string {
  const b = facts.before;
  const a = facts.after;
  switch (kind) {
    case 'reservation_booked':
      return `Booked with the vendor — booking ${word(field(a, 'providerBookingId'))}, status ${word(field(a, 'status'))}`;
    case 'reservation_status_changed':
      return `Status ${word(field(b, 'status'))} → ${word(field(a, 'status'))}${field(a, 'providerStatus') ? ` (the vendor said ${word(field(a, 'providerStatus'))})` : ''}`;
    case 'reservation_confirmation_code_arrived':
      return `Confirmation code arrived: ${word(field(a, 'providerConfirmationCode'))}`;
    case 'reservation_ticketed':
      return `Ticketed at ${word(field(a, 'ticketedAt'))}`;
    case 'reservation_ticket_limit_stated':
      return `Ticketing deadline stated: ${word(field(a, 'ticketLimitTime'))}`;
    case 'reservation_cancel_quoted':
      return `Cancellation quoted — refund ${amountWords(field(a, 'refundAmount'), field(a, 'refundCurrency'))}, penalty ${amountWords(field(a, 'penaltyAmount'), field(a, 'penaltyCurrency'))}`;
    case 'reservation_cancel_requested':
      return `Cancellation requested — status was ${word(field(b, 'status'))}`;
    case 'reservation_cancel_pending':
      return `Cancellation accepted by the vendor, awaiting the airline${field(a, 'cancelIntentAt') ? ` — requested at ${word(field(a, 'cancelIntentAt'))}` : ''}`;
    case 'reservation_cancelled':
      return `Cancelled — status ${word(field(b, 'status'))} → cancelled${field(a, 'providerStatus') ? ` (the vendor said ${word(field(a, 'providerStatus'))})` : ''}`;
    case 'reservation_cancel_refused':
      return `Cancellation refused by the vendor${field(a, 'providerMessage') ? `: ${word(field(a, 'providerMessage'))}` : ''}${field(a, 'providerCode') !== undefined && field(a, 'providerCode') !== null ? ` (code ${word(field(a, 'providerCode'))})` : ''} — nothing changed`;
    case 'reservation_email_sent':
      return `Emailed ${emailWords(field(a, 'email'))} — message ${word(field(a, 'messageId'))}`;
    case 'reservation_email_failed':
      return `NOT emailed: ${emailWords(field(a, 'email'))} — ${word(field(a, 'errorClass'))}`;
    case 'reservation_posted':
      return `Posted to the ledger — entry ${word(field(a, 'entryId'))}${field(a, 'moneyEventId') ? ` (the refund ${word(field(a, 'moneyEventId'))})` : ' (the charge)'}`;
    case 'money_event_stated':
      return `The vendor stated a ${word(field(a, 'kind'))}: ${centsWords(field(a, 'amountCents'), field(a, 'currency'))}`;
    case 'money_event_settled':
      return `The ${word(field(a, 'kind'))} settled — bank row ${word(field(a, 'settledTransactionId'))}`;
    case 'commission_locked':
      return `Commission locked at ${centsWords(field(a, 'lockedCommissionCents'), field(a, 'currency'))}`;
  }
}

// ─── 2. the timeline ─────────────────────────────────────────────────────────

export interface TimelineArrival {
  id: string;
  /** 'booking' (the book answer) · 'booking_read' (a read) · 'cancellation' (the cancel answer). */
  resource: string;
  arrived: Date | string | null;
  asked: Date | string;
  payload: unknown;
}

export interface TimelineWebhookEvent {
  id: string;
  eventType: string;
  outcome: string;
  receivedAt: Date | string;
}

export interface TimelineAuditRow {
  id: string;
  created_at: Date | string;
  action_type: string;
  action_description: string;
  payload_before: unknown;
  payload_after: unknown;
}

export interface TimelineMoneyEvent {
  id: string;
  kind: string;
  amountCents: number | null;
  currency: string | null;
  status: string;
  statedAt: Date | string;
  settledTransactionId: string | null;
  settledAt: Date | string | null;
}

export interface TimelineCommission {
  id: string;
  status: string;
  currency: string;
  createdAt: Date | string;
  lockedCommissionCents: number | null;
  lockedAt: Date | string | null;
}

export interface TimelineEntry {
  id: string;
  date: Date | string;
  status: string;
  created_at: Date | string;
  document_money_event_id: string | null;
}

export interface TimelineCalendarRow {
  id: string;
  start_date: Date | string;
  status: string | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
}

export interface TimelineInput {
  arrivals: TimelineArrival[];
  webhookEvents: TimelineWebhookEvent[];
  auditRows: TimelineAuditRow[];
  moneyEvents: TimelineMoneyEvent[];
  commission: TimelineCommission[];
  journalEntries: TimelineEntry[];
  calendarRows: TimelineCalendarRow[];
}

export interface TimelineItem {
  at: string;
  kind: string;
  words: string;
  evidence: Evidence;
}

/** The order a kind takes when two items share an instant — the cause before its record. */
const KIND_ORDER: readonly string[] = [
  'arrival_booking', 'arrival_booking_read', 'arrival_cancellation', 'arrival',
  'webhook',
  ...BOOKING_EVENT_KINDS,
  'money_event', 'money_event_settlement',
  'commission', 'commission_lock',
  'journal_entry',
  'calendar', 'calendar_cancelled',
  'audit',
];

const rank = (kind: string): number => {
  const i = KIND_ORDER.indexOf(kind);
  return i < 0 ? KIND_ORDER.length : i;
};

function iso(d: Date | string): string {
  return typeof d === 'string' ? d : d.toISOString();
}

function day(d: Date | string): string {
  return iso(d).slice(0, 10);
}

function payloadStatus(payload: unknown): string | null {
  const p = payload !== null && typeof payload === 'object' && !Array.isArray(payload) ? (payload as Record<string, unknown>) : null;
  return p !== null && typeof p.status === 'string' && p.status.length > 0 ? p.status : null;
}

function asFacts(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** The arrival's words by resource; a resource this leaf does not know renders as itself. */
function arrivalWords(a: TimelineArrival): { kind: string; words: string } {
  const status = payloadStatus(a.payload);
  const stated = status === null ? 'no status stated' : `status ${status}`;
  switch (a.resource) {
    case 'booking': return { kind: 'arrival_booking', words: `The vendor's book answer landed — ${stated}` };
    case 'booking_read': return { kind: 'arrival_booking_read', words: `The vendor was read — ${stated}` };
    case 'cancellation': return { kind: 'arrival_cancellation', words: `The vendor answered the cancellation — ${stated}` };
    default: return { kind: 'arrival', words: `${a.resource} landed` };
  }
}

export function timelineOf(input: TimelineInput): TimelineItem[] {
  const items: TimelineItem[] = [];

  for (const a of input.arrivals) {
    const { kind, words } = arrivalWords(a);
    items.push({ at: iso(a.arrived ?? a.asked), kind, words, evidence: { table: 'arrivals', id: a.id } });
  }
  for (const w of input.webhookEvents) {
    items.push({ at: iso(w.receivedAt), kind: 'webhook', words: `The vendor sent ${w.eventType} — ${w.outcome}`, evidence: { table: 'webhook_events', id: w.id } });
  }
  for (const r of input.auditRows) {
    const known = isBookingEventKind(r.action_type);
    items.push({
      at: iso(r.created_at),
      kind: known ? r.action_type : 'audit',
      // A known kind is rendered by this leaf from its stated before/after; anything else AS ITSELF.
      words: known
        ? bookingEventWords(r.action_type as BookingEventKind, { before: asFacts(r.payload_before), after: asFacts(r.payload_after) })
        : `${r.action_type}: ${r.action_description}`,
      evidence: { table: 'audit_log', id: r.id },
    });
  }
  for (const m of input.moneyEvents) {
    items.push({ at: iso(m.statedAt), kind: 'money_event', words: bookingEventWords('money_event_stated', { before: null, after: { kind: m.kind, amountCents: m.amountCents, currency: m.currency } }), evidence: { table: 'money_events', id: m.id } });
    if (m.status === 'settled' && m.settledAt !== null) {
      items.push({ at: iso(m.settledAt), kind: 'money_event_settlement', words: bookingEventWords('money_event_settled', { before: null, after: { kind: m.kind, settledTransactionId: m.settledTransactionId } }), evidence: { table: 'money_events', id: m.id } });
    }
  }
  for (const c of input.commission) {
    items.push({ at: iso(c.createdAt), kind: 'commission', words: `Commission recorded — ${c.status}`, evidence: { table: 'commission_ledger', id: c.id } });
    if (c.lockedAt !== null) {
      items.push({ at: iso(c.lockedAt), kind: 'commission_lock', words: bookingEventWords('commission_locked', { before: null, after: { lockedCommissionCents: c.lockedCommissionCents, currency: c.currency } }), evidence: { table: 'commission_ledger', id: c.id } });
    }
  }
  for (const e of input.journalEntries) {
    items.push({
      at: iso(e.created_at),
      kind: 'journal_entry',
      words: `${bookingEventWords('reservation_posted', { before: null, after: { entryId: e.id, moneyEventId: e.document_money_event_id } })} — dated ${day(e.date)}, ${e.status}`,
      evidence: { table: 'journal_entries', id: e.id },
    });
  }
  for (const c of input.calendarRows) {
    if (c.created_at !== null) items.push({ at: iso(c.created_at), kind: 'calendar', words: `On your calendar from ${day(c.start_date)}`, evidence: { table: 'calendar_events', id: c.id } });
    if (c.status === 'cancelled' && c.updated_at !== null) items.push({ at: iso(c.updated_at), kind: 'calendar_cancelled', words: 'The calendar day marked cancelled', evidence: { table: 'calendar_events', id: c.id } });
  }

  items.sort((x, y) =>
    x.at.localeCompare(y.at) ||
    rank(x.kind) - rank(y.kind) ||
    x.evidence.table.localeCompare(y.evidence.table) ||
    x.evidence.id.localeCompare(y.evidence.id));
  return items;
}

/** The History section's own words — so the page types none. */
export const HISTORY_WORDS = {
  heading: 'History',
  reading: 'reading the history…',
  unreadable: 'the history could not be read',
  none: 'no history recorded for this booking yet',
  evidence: 'from',
  note: 'Each line names the record it was read from — the vendor’s landed answers, its webhook deliveries, the money it stated, the ledger, your calendar, and the tamper-evident audit log.',
} as const;
