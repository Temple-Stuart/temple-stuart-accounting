/**
 * LINK-02 (2026-09-27) — A BOOKING IS LINKED TO THE BUDGET LINE IT FULFILS, BY A HUMAN.
 *
 * The decisions of POST / DELETE /api/reservations/[id]/budget-link, over ports, so
 * node:test drives them against a store that keeps the database's rules. The route
 * (src/app/api/reservations/[id]/budget-link/route.ts) is the thin prisma adapter.
 *
 * THE RULE: a link is made only by the owner's explicit action — the owner NAMES the
 * line (budgetLineItemId) and exactly that is written. No matcher, no score, no
 * suggestion, no auto-link: nothing here reads a name or an amount to choose a line.
 * One booking fulfils at most one line (the UNIQUE on reservationId — an existing link
 * is refused by name, unlink first); one line may carry several bookings. Unlinking is
 * allowed and recorded. Nothing else is touched: no amount, no status, no ledger.
 *
 * THE ORDER (the reservations/[id] auth pattern, then the link's own rules):
 *   no verified email → 401; no user row → 404; the booking by { id, userId } → 404
 *   (the defensive 404; a guest row, userId null, never matches); [POST] a body
 *   without budgetLineItemId → 400; the line by { id, userId } → 404 by name; not the
 *   booking's own trip (both on a trip, the same one) → 409 by name; a link already
 *   there → 409 by name; then the write, then the audit row through the ONE port.
 *   [DELETE] no link → 404 by name; the delete, then the audit row.
 */
import type { AuditOutcome, BookingEventInput } from './auditTrail';

export interface BudgetLinkPorts {
  findUser(email: string): Promise<{ id: string } | null>;
  /** The caller's own reservation — { id, userId: the caller } — or null. */
  findReservation(id: string, userId: string): Promise<{ id: string; tripId: string | null } | null>;
  /** The caller's own budget line — { id, userId: the caller } — or null. */
  findLine(id: string, userId: string): Promise<{ id: string; tripId: string | null; description: string | null } | null>;
  /** The booking's link (one per booking), with its line's description, or null. */
  findLink(reservationId: string, userId: string): Promise<{ id: string; budgetLineItemId: string; description: string | null } | null>;
  /** Writes the link. Throws LinkExistsError when the booking already has one (the UNIQUE). */
  createLink(row: { userId: string; reservationId: string; budgetLineItemId: string; linkedAt: Date; linkedBy: string }): Promise<{ id: string; budgetLineItemId: string; linkedAt: Date }>;
  /** Deletes exactly that link of the caller's; answers how many rows went (0 or 1). */
  deleteLink(id: string, userId: string): Promise<number>;
  /** The ONE audit port (recordBookingEvent). */
  record(input: BookingEventInput): Promise<AuditOutcome>;
  now(): Date;
}

/** The store refused a second link for a booking (reservation_budget_links UNIQUE on reservationId). */
export class LinkExistsError extends Error {
  constructor() {
    super('reservation_budget_links: this booking already has a link');
    this.name = 'LinkExistsError';
  }
}

export interface BudgetLinkAnswer {
  status: number;
  body: Record<string, unknown>;
}

export const LINK_WORDS = {
  unauthorized: 'Unauthorized',
  userNotFound: 'User not found',
  reservationNotFound: 'Reservation not found',
  lineRequired: 'budgetLineItemId is required — the budget line this booking fulfils',
  lineNotFound: 'Budget line not found',
  otherTrip: 'A booking fulfils a line of its own trip — this line is not on the trip this booking is attached to.',
  linkExists: 'This booking is already linked to a budget line — unlink it first.',
  noLink: 'This booking has no budget link to remove.',
} as const;

type Owned = { user: { id: string }; email: string; owned: { id: string; tripId: string | null } };

/** The reservations/[id] pattern: the verified caller and the booking they own — or the refusal. */
async function ownedBooking(ports: BudgetLinkPorts, userEmail: string | null, reservationId: string): Promise<Owned | BudgetLinkAnswer> {
  if (!userEmail) return { status: 401, body: { error: LINK_WORDS.unauthorized } };
  const user = await ports.findUser(userEmail);
  if (!user) return { status: 404, body: { error: LINK_WORDS.userNotFound } };
  const owned = await ports.findReservation(reservationId, user.id);
  if (!owned) return { status: 404, body: { error: LINK_WORDS.reservationNotFound } };
  return { user, email: userEmail, owned };
}

export async function linkBooking(
  ports: BudgetLinkPorts,
  input: { userEmail: string | null; reservationId: string; readBody: () => Promise<unknown> },
): Promise<BudgetLinkAnswer> {
  const who = await ownedBooking(ports, input.userEmail, input.reservationId);
  if ('status' in who) return who;
  const { user, email, owned } = who;

  let body: unknown;
  try {
    body = await input.readBody();
  } catch {
    return { status: 400, body: { error: 'Invalid JSON body' } };
  }
  const named = body !== null && typeof body === 'object' ? (body as { budgetLineItemId?: unknown }).budgetLineItemId : undefined;
  const budgetLineItemId = typeof named === 'string' ? named.trim() : '';
  if (budgetLineItemId === '') return { status: 400, body: { error: LINK_WORDS.lineRequired } };

  // The line the owner NAMED, and only it — the caller's own (defensive 404, by name).
  const line = await ports.findLine(budgetLineItemId, user.id);
  if (!line) return { status: 404, body: { error: LINK_WORDS.lineNotFound } };

  // A booking fulfils a line of its OWN trip — both on a trip, the same one.
  if (owned.tripId === null || line.tripId === null || owned.tripId !== line.tripId) {
    return { status: 409, body: { error: LINK_WORDS.otherTrip, code: 'budget_line_other_trip' } };
  }

  // One line per booking — an existing link is refused by name: unlink first.
  const existing = await ports.findLink(owned.id, user.id);
  if (existing) return { status: 409, body: { error: LINK_WORDS.linkExists, code: 'budget_link_exists', budgetLineItemId: existing.budgetLineItemId } };

  let link: { id: string; budgetLineItemId: string; linkedAt: Date };
  try {
    link = await ports.createLink({ userId: user.id, reservationId: owned.id, budgetLineItemId: line.id, linkedAt: ports.now(), linkedBy: email });
  } catch (err) {
    // Two links raced: the UNIQUE refused the second — the same answer, by name.
    if (err instanceof LinkExistsError) return { status: 409, body: { error: LINK_WORDS.linkExists, code: 'budget_link_exists' } };
    throw err;
  }

  // The link is a booking event — after the write, through the one port (a failure there is named, never undoes the link).
  await ports.record({
    reservation: { id: owned.id, userId: user.id },
    kind: 'reservation_budget_linked',
    actor: { type: 'human_user', userId: user.id, email },
    before: null,
    after: { budgetLineItemId: line.id, description: line.description },
    evidence: { table: 'reservation_budget_links', id: link.id },
  });

  return { status: 201, body: { link: { id: link.id, reservationId: owned.id, budgetLineItemId: link.budgetLineItemId, linkedAt: link.linkedAt } } };
}

export async function unlinkBooking(
  ports: BudgetLinkPorts,
  input: { userEmail: string | null; reservationId: string },
): Promise<BudgetLinkAnswer> {
  const who = await ownedBooking(ports, input.userEmail, input.reservationId);
  if ('status' in who) return who;
  const { user, email, owned } = who;

  const none: BudgetLinkAnswer = { status: 404, body: { error: LINK_WORDS.noLink, code: 'no_budget_link' } };
  const link = await ports.findLink(owned.id, user.id);
  if (!link) return none;
  // Exactly that one row — a concurrent unlink that got there first is the same "none".
  if ((await ports.deleteLink(link.id, user.id)) === 0) return none;

  // The unlink is a booking event — the removed link its evidence (its id, now gone), after the write.
  await ports.record({
    reservation: { id: owned.id, userId: user.id },
    kind: 'reservation_budget_unlinked',
    actor: { type: 'human_user', userId: user.id, email },
    before: { budgetLineItemId: link.budgetLineItemId, description: link.description },
    after: null,
    evidence: { table: 'reservation_budget_links', id: link.id },
  });

  return { status: 200, body: { unlinked: { id: link.id, reservationId: owned.id, budgetLineItemId: link.budgetLineItemId } } };
}
