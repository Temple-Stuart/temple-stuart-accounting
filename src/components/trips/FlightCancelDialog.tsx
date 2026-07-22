'use client';

/**
 * FlightCancelDialog (PR-Cancel-2) — step 2 of Duffel's quote-first cancel,
 * shared by TripBookings and UnattachedBookings. The parent has ALREADY fetched
 * the pending cancellation (step 1); this dialog shows THE QUOTE — Duffel's
 * actual refund_amount/refund_to/expires_at, never an invented number — and
 * collects the explicit confirm/abort. The non-negotiable truth stated here:
 * the refund goes to the DUFFEL BALANCE, not the customer's card.
 *
 * Stale quote (only the newest confirms): the parent passes the 409 copy via
 * `error` with `stale: true`, and this dialog offers Re-quote. The hotel
 * dialog (CancelBookingDialog) is untouched — different provider model.
 */

import TripFormModal from './TripFormModal';

export interface FlightCancelQuote {
  id: string | null;
  refundAmount: string | null;
  refundCurrency: string | null;
  refundTo: string | null;
  expiresAt: string | null;
}

interface Props {
  /** Row display context — so the user confirms the RIGHT booking. */
  bookingName: string;
  /** The pending cancellation from step 1 — Duffel's verbatim quote. */
  quote: FlightCancelQuote;
  /** True while the confirm (or re-quote) POST is in flight — locks buttons. */
  busy: boolean;
  /** A confirm failure to show in-dialog; stale=true adds the Re-quote action. */
  error: { message: string; stale: boolean } | null;
  onConfirm: () => void;
  onRequote: () => void;
  onClose: () => void;
}

export default function FlightCancelDialog({ bookingName, quote, busy, error, onConfirm, onRequote, onClose }: Props) {
  // "YYYY-MM-DDTHH:MM:SSZ" → "YYYY-MM-DD HH:MM UTC" — pure string ops, honest.
  const expires =
    quote.expiresAt && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(quote.expiresAt)
      ? `${quote.expiresAt.slice(0, 16).replace('T', ' ')} UTC`
      : null;

  return (
    <TripFormModal title="Cancel this flight?" subtitle={bookingName} onClose={onClose}>
      <div className="space-y-3">
        {/* ── THE QUOTE — Duffel's actual numbers, or the honest absence ── */}
        <div className="rounded border border-border p-3 text-sm">
          {quote.refundAmount !== null ? (
            <p className="text-text-primary">
              Duffel quotes a refund of{' '}
              <span className="font-semibold">
                {quote.refundCurrency ? `${quote.refundCurrency} ` : ''}{quote.refundAmount}
              </span>{' '}
              to the platform balance. Card refunds are processed separately.
            </p>
          ) : (
            <p className="text-text-primary">
              Duffel could not state a refund amount for this cancellation — the fare may be
              non-refundable, or the carrier didn&apos;t provide a quote. Any refund goes to the
              platform balance; card refunds are processed separately.
            </p>
          )}
          {quote.refundTo && quote.refundTo !== 'balance' && (
            <p className="mt-1 text-xs text-text-muted">Refund destination per Duffel: {quote.refundTo}</p>
          )}
          {expires && (
            <p className="mt-1 text-xs text-text-muted">
              This quote expires {expires}. Only the newest quote can be confirmed.
            </p>
          )}
        </div>

        {error && (
          <div className="rounded border border-brand-red/40 bg-bg-row px-3 py-2 text-sm text-brand-red">
            {error.message}
            {error.stale && (
              <button
                type="button"
                onClick={onRequote}
                disabled={busy}
                className="ml-2 font-semibold underline disabled:opacity-50"
              >
                {busy ? 'Re-quoting…' : 'Re-quote'}
              </button>
            )}
          </div>
        )}

        <p className="text-sm text-text-secondary">
          Confirming cancels the flight with the airline. This can&apos;t be undone.
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy || (error?.stale ?? false)}
            className="flex-1 rounded bg-brand-red px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-red/90 disabled:opacity-50"
          >
            {busy ? 'Cancelling…' : 'Confirm cancellation'}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex-1 rounded border border-border px-4 py-2 text-sm font-semibold text-text-secondary transition-colors hover:bg-bg-row disabled:opacity-50"
          >
            Keep flight
          </button>
        </div>
      </div>
    </TripFormModal>
  );
}
