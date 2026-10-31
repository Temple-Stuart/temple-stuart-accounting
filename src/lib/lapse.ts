// ─── LAUNCH-01 LAPSE-01 — a lapsed subscription is told, never a bare 403 ────
// Before this PR the webhook flipped an entitlement row to 'inactive' on
// customer.subscription.deleted and said nothing; invoice.payment_failed was
// not handled at all; the user met "Locked — sold as Books" with no reason.
//
// Now the row carries WHEN and WHY it ended (user_category_entitlements.ended_at
// / ended_reason — prisma/migrations/20260910000000_launch_01_lapse_and_tier),
// the webhook mails the user (src/lib/lapseMail.ts, declared on failure), and
// the locked card / the tab gate's 403 both say "Your subscription ended on
// <date>" with the offer door.
//
// This module is prisma-free and client-safe: the card (LockedTabCard) and the
// server (webhook, /api/auth/me, requireTabAccess) share ONE wording — no-drift.

export type LapseReason = 'canceled' | 'payment_failed';

/** The two ways a paid row ends. Stripe's customer.subscription.deleted → 'canceled'; invoice.payment_failed → 'payment_failed'. */
export const LAPSE_REASONS: readonly LapseReason[] = ['canceled', 'payment_failed'];

export function isLapseReason(v: unknown): v is LapseReason {
  return typeof v === 'string' && (LAPSE_REASONS as readonly string[]).includes(v);
}

/** A lapsed entitlement on the wire (/api/auth/me → the card): the key, when it ended (ISO), why. */
export interface LapsedEntitlement {
  key: string;
  endedAt: string;
  reason: LapseReason;
}

/** Thrown when a stored row carries an ended_reason this code never writes — corruption, declared. */
export class LapseRowError extends Error {
  constructor(key: string, reason: string) {
    super(`user_category_entitlements ${key}: ended_reason '${reason}' is not a lapse reason (${LAPSE_REASONS.join(' | ')})`);
    this.name = 'LapseRowError';
  }
}

/** The stored row → the wire shape. ended_at NULL → null (never lapsed, or re-granted); an unknown reason throws. */
export function lapsedFromRow(row: { categoryKey: string; ended_at: Date | null; ended_reason: string | null }): LapsedEntitlement | null {
  if (row.ended_at === null) return null;
  if (!isLapseReason(row.ended_reason)) throw new LapseRowError(row.categoryKey, String(row.ended_reason));
  return { key: row.categoryKey, endedAt: row.ended_at.toISOString(), reason: row.ended_reason };
}

/** What the row is written with when a subscription lapses. A later re-grant (grantEntitlement active) clears both fields. */
export function lapseWrite(reason: LapseReason, endedAt: Date): { status: 'inactive'; ended_at: Date; ended_reason: LapseReason } {
  return { status: 'inactive', ended_at: endedAt, ended_reason: reason };
}

/** 'September 9, 2026' — the calendar day in UTC (Stripe's timestamps are UTC; no viewer zone is known here). */
export function formatEndedOn(endedAt: string | Date): string {
  const d = typeof endedAt === 'string' ? new Date(endedAt) : endedAt;
  if (Number.isNaN(d.getTime())) throw new Error(`formatEndedOn: '${String(endedAt)}' is not a date`);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

export function reasonClause(reason: LapseReason): string {
  switch (reason) {
    case 'canceled': return 'it was canceled';
    case 'payment_failed': return 'a payment failed';
  }
}

/** THE line — the card, the 403 message and the mail all render this. */
export function lapsedLine(l: { endedAt: string | Date; reason: LapseReason }): string {
  return `Your subscription ended on ${formatEndedOn(l.endedAt)} — ${reasonClause(l.reason)}.`;
}

/** The most recent lapse among the keys that grant a tab (keysGranting, src/lib/offer.ts), or null. */
export function lapsedFor(keys: readonly string[], lapsed: readonly LapsedEntitlement[]): LapsedEntitlement | null {
  let best: LapsedEntitlement | null = null;
  for (const l of lapsed) {
    if (!keys.includes(l.key)) continue;
    if (best === null || Date.parse(l.endedAt) > Date.parse(best.endedAt)) best = l;
  }
  return best;
}

/**
 * The subscription an invoice bills, or null. Stripe's current API (the pinned
 * 2026-01-28.clover) carries it at invoice.parent.subscription_details.subscription;
 * older shapes carried a top-level `subscription`. Either may be the id string or
 * an expanded object. No subscription → null (a one-off invoice — not ours).
 */
export function subscriptionIdOfInvoice(invoice: unknown): string | null {
  const idOf = (v: unknown): string | null => {
    if (typeof v === 'string' && v) return v;
    if (typeof v === 'object' && v !== null && typeof (v as { id?: unknown }).id === 'string') return (v as { id: string }).id;
    return null;
  };
  if (typeof invoice !== 'object' || invoice === null) return null;
  const inv = invoice as { parent?: { subscription_details?: { subscription?: unknown } | null } | null; subscription?: unknown };
  return idOf(inv.parent?.subscription_details?.subscription) ?? idOf(inv.subscription);
}
