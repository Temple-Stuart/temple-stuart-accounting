/**
 * MATCH-02 (2026-09-26) — THE WORDS OF A REFUND PROPOSAL, in one place.
 *
 * The review queue renders a refund proposal AS A REFUND — never as a charge —
 * and types none of these words itself: "Refund of <booking name>: vendor stated
 * <amount currency> on <date>". A refund the vendor did not quantify says so; a
 * currency the vendor did not state is left out, never invented.
 *
 * THIS FILE IS PURE: no fetch, no env, no clock, no React, no Prisma.
 */

/** The money event fields the queue puts on the wire for a refund proposal. */
export interface RefundProposalEvent {
  kind: string;
  /** Integer cents the vendor stated, or NULL — the vendor did not quantify it. */
  amountCents: number | null;
  currency: string | null;
  /** ISO instant the vendor stated the refund. */
  statedAt: string | Date;
  refundDestination: string | null;
}

/** The stated figure, in the vendor's words: "250.00 USD", "250.00" (no currency stated), or "no amount stated". */
export function statedRefundAmount(event: Pick<RefundProposalEvent, 'amountCents' | 'currency'>): string {
  if (event.amountCents === null) return 'no amount stated';
  const figure = (event.amountCents / 100).toFixed(2);
  return event.currency ? `${figure} ${event.currency.toUpperCase()}` : figure;
}

/** The calendar day (UTC) of the vendor's statement. */
export function statedRefundDay(statedAt: string | Date): string {
  const iso = typeof statedAt === 'string' ? statedAt : statedAt.toISOString();
  return iso.slice(0, 10);
}

/**
 * ONE line for a refund proposal: "Refund of <booking name>: vendor stated
 * <amount currency> on <YYYY-MM-DD>". The booking name is the lane leaf's word
 * (reservationIdentity), handed in by the caller.
 */
export function refundProposalLine(bookingName: string, event: RefundProposalEvent): string {
  return `Refund of ${bookingName}: vendor stated ${statedRefundAmount(event)} on ${statedRefundDay(event.statedAt)}`;
}
