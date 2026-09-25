'use client';

/**
 * CancelBookingDialog (PR-Cancel-1) — the pre-confirm step of in-app
 * cancellation, shared by TripBookings and UnattachedBookings.
 *
 * HOTEL: it renders the STORED cancellationPolicyJson (written at book time by
 * liteapi/book) truthfully: only the fields that actually exist — refundableTag
 * ('RFN'/'NRFN', same vocabulary CheckoutPanel renders pre-purchase), the
 * cancelPolicyInfos deadline rows, and hotelRemarks. When the stored policy is
 * null or unparseable, the one honest line renders instead — NEVER a fabricated
 * policy. The vendor has no quote endpoint for a hotel.
 *
 * FLIGHT — CANCEL-01 (2026-09-26): THE QUOTE COMES FIRST. On open the dialog
 * reads GET /api/reservations/{id}/cancel — the vendor's cancellation quote —
 * and shows the refund, the penalty, the currency, the CONFIDENCE in its own
 * word and what that word means ("estimated" is not "confirmed"), where the
 * refund goes in plain words, and any vouchers. The Cancel control is not
 * rendered until the quote has; a quote that cannot be fetched is a named
 * failure and the only control left is Keep booking. A customer is never asked
 * to confirm blind.
 *
 * The dialog only collects the explicit confirm / abort; the parent owns the
 * POST and the result rendering (the outcome line lives inline in the row,
 * which REMAINS after cancellation — record-keeping).
 */

import { useEffect, useState } from 'react';
import TripFormModal from './TripFormModal';
import { confidenceWords, destinationWords, moneyWords } from '@/lib/reservations/cancellationWords';

// The stored shape (see CheckoutPanel's CancellationData twin, :117-121):
// { refundableTag?: 'RFN'|'NRFN', cancelPolicyInfos?: [...], hotelRemarks?: [...] }
interface PolicyShape {
  refundableTag?: string;
  cancelPolicyInfos?: unknown[];
  hotelRemarks?: unknown[];
}

/** The quote route's envelope — names and nullability exactly as the flights
 *  client parses the vendor (liteapiFlightsClient.ts FlightCancellationQuote). */
interface QuoteMoney { amount: number; currency: string | null }
interface QuoteVoucher {
  vendorVoucherId: string | null; code: string | null; airline: string | null; amount: QuoteMoney | null;
  validFrom: string | null; expiresAt: string | null; passengerNames: string[] | null; notes: string | null;
}
interface Quote {
  confidence: string;
  isRefundable: boolean | null;
  isVoidable: boolean | null;
  refund: QuoteMoney | null;
  penalty: QuoteMoney | null;
  penalties: Array<{ type: string | null; description: string | null; amount: QuoteMoney | null }>;
  currency: string | null;
  destination: string | null;
  vouchers: QuoteVoucher[];
  expiresAt: string | null;
}

type QuoteState =
  | { state: 'quoting' }
  | { state: 'quoted'; quote: Quote }
  | { state: 'quote_failed'; message: string };

interface Props {
  /** The reservation row's id — the quote is read for it (flights). */
  reservationId: string;
  /** The lane, through the one reader (the row's `type`): 'hotel' | 'flight' | 'activity'. */
  lane: string;
  /** Row display context — name + dates, so the user confirms the RIGHT booking. */
  bookingName: string;
  checkIn: string | null;
  checkOut: string | null;
  /** The reservation row's stored cancellationPolicyJson, verbatim (hotels). */
  policy: unknown;
  /** True while the cancel POST is in flight — locks both buttons. */
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/** One cancelPolicyInfos row → a truthful line from ONLY its present fields. */
function policyInfoLine(info: unknown): string | null {
  if (typeof info !== 'object' || info === null) return null;
  const o = info as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof o.cancelTime === 'string' && o.cancelTime) parts.push(`from ${o.cancelTime}`);
  if (typeof o.amount === 'number') {
    const cur = typeof o.currency === 'string' && o.currency ? `${o.currency} ` : '';
    parts.push(`fee ${cur}${o.amount.toFixed(2)}`);
  }
  if (typeof o.type === 'string' && o.type) parts.push(`(${o.type})`);
  return parts.length > 0 ? parts.join(' ') : null;
}

const money = (m: QuoteMoney | null) => moneyWords(m === null ? null : m.amount, m === null ? null : m.currency);

export default function CancelBookingDialog({ reservationId, lane, bookingName, checkIn, checkOut, policy, busy, onConfirm, onClose }: Props) {
  const isFlight = lane === 'flight';
  const [quote, setQuote] = useState<QuoteState>({ state: 'quoting' });

  // CANCEL-01: the flight quote, read once on open. A hotel never fetches.
  useEffect(() => {
    if (!isFlight) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/reservations/${reservationId}/cancel`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok || !data?.quote || typeof data.quote.confidence !== 'string') {
          setQuote({ state: 'quote_failed', message: typeof data?.error === 'string' && data.error ? data.error : `The airline did not answer with a quote (HTTP ${res.status}).` });
          return;
        }
        setQuote({ state: 'quoted', quote: data.quote as Quote });
      } catch (err) {
        if (cancelled) return;
        setQuote({ state: 'quote_failed', message: err instanceof Error ? err.message : 'The cancellation quote could not be fetched.' });
      }
    })();
    return () => { cancelled = true; };
  }, [isFlight, reservationId]);

  const p: PolicyShape | null =
    policy && typeof policy === 'object' && !Array.isArray(policy) ? (policy as PolicyShape) : null;
  const isNonRefundable = p?.refundableTag === 'NRFN';
  const isRefundable = p?.refundableTag === 'RFN';
  const infoLines = (Array.isArray(p?.cancelPolicyInfos) ? p!.cancelPolicyInfos! : [])
    .map(policyInfoLine)
    .filter((l): l is string => l !== null);
  const remarks = (Array.isArray(p?.hotelRemarks) ? p!.hotelRemarks! : [])
    .filter((r): r is string => typeof r === 'string' && r.trim().length > 0);
  const hasAnyPolicy = isNonRefundable || isRefundable || infoLines.length > 0 || remarks.length > 0;

  const dates =
    checkIn && checkOut ? `${String(checkIn).slice(0, 10)} → ${String(checkOut).slice(0, 10)}` : null;

  // The Cancel control exists only when the customer can see what it does: a
  // hotel's stored terms (always renderable — absence is its own honest line), or
  // a flight's QUOTE once it has rendered. Never before, never on a failed quote.
  const canConfirm = !isFlight || quote.state === 'quoted';

  return (
    <TripFormModal
      title="Cancel this booking?"
      subtitle={`${bookingName}${dates ? ` · ${dates}` : ''}`}
      onClose={onClose}
    >
      <div className="space-y-3" data-cancel-dialog-lane={lane} data-cancel-quote={isFlight ? quote.state : 'stored_policy'}>
        {isFlight ? (
          // ── CANCEL-01: the vendor's quote, BEFORE any control ──
          quote.state === 'quoting' ? (
            <p className="rounded border border-border bg-bg-row px-3 py-2 text-sm text-text-muted" aria-busy="true">
              Asking the airline what cancelling would do…
            </p>
          ) : quote.state === 'quote_failed' ? (
            <div className="rounded border border-brand-red/40 bg-brand-red/5 p-3 text-sm text-brand-red" role="alert">
              <p className="font-semibold">The cancellation quote could not be fetched.</p>
              <p className="mt-1 text-xs">{quote.message}</p>
              <p className="mt-1 text-xs">Nothing was cancelled. Without the airline&apos;s quote you are not asked to confirm — try again later, or contact support.</p>
            </div>
          ) : (
            <div className="rounded border border-border p-3 text-sm">
              <p className="text-xs text-text-muted">{confidenceWords(quote.quote.confidence)}</p>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="text-text-muted">Refund</dt>
                <dd className="font-medium text-text-primary" data-quote-refund>{money(quote.quote.refund)}</dd>
                <dt className="text-text-muted">Penalty</dt>
                <dd className="font-medium text-text-primary" data-quote-penalty>{money(quote.quote.penalty)}</dd>
                <dt className="text-text-muted">Currency</dt>
                <dd className="font-medium text-text-primary">{quote.quote.currency ?? 'not stated by the airline'}</dd>
                <dt className="text-text-muted">Confidence</dt>
                <dd className="font-medium text-text-primary" data-quote-confidence>{quote.quote.confidence}</dd>
                <dt className="text-text-muted">Refund goes</dt>
                <dd className="font-medium text-text-primary" data-quote-destination>{destinationWords(quote.quote.destination)}</dd>
                {quote.quote.isRefundable !== null && (
                  <>
                    <dt className="text-text-muted">Refundable</dt>
                    <dd className="text-text-primary">{quote.quote.isRefundable ? 'yes' : 'no'}{quote.quote.isVoidable ? ' · within the void window (no penalty)' : ''}</dd>
                  </>
                )}
              </dl>
              {quote.quote.penalties.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-xs text-text-muted">
                  {quote.quote.penalties.map((pen, i) => (
                    <li key={i}>{pen.type ?? 'penalty'}{pen.description ? ` — ${pen.description}` : ''}: {money(pen.amount)}</li>
                  ))}
                </ul>
              )}
              {quote.quote.vouchers.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-xs text-text-muted" data-quote-vouchers>
                  {quote.quote.vouchers.map((v, i) => (
                    <li key={i}>
                      Voucher {v.code ?? '(no code stated)'}{v.airline ? ` · ${v.airline}` : ''}: {money(v.amount)}
                      {v.validFrom || v.expiresAt ? ` · ${v.validFrom ?? '?'} → ${v.expiresAt ?? '?'}` : ''}
                      {v.passengerNames && v.passengerNames.length > 0 ? ` · ${v.passengerNames.join(', ')}` : ''}
                    </li>
                  ))}
                </ul>
              )}
              {quote.quote.expiresAt && <p className="mt-2 text-xs text-text-faint">This quote expires {quote.quote.expiresAt}.</p>}
            </div>
          )
        ) : hasAnyPolicy ? (
          // ── The stored policy, truthfully — or the one honest absence line ──
          <div className="rounded border border-border p-3 text-sm">
            {isNonRefundable && (
              <p className="font-semibold text-brand-red">
                Non-refundable — the rate&apos;s terms say this booking can&apos;t be refunded.
              </p>
            )}
            {isRefundable && <p className="font-semibold text-brand-green">Refundable rate</p>}
            {infoLines.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-xs text-text-muted">
                {infoLines.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            )}
            {remarks.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-xs text-text-muted">
                {remarks.slice(0, 4).map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p className="rounded border border-border bg-bg-row px-3 py-2 text-sm text-text-muted">
            Cancellation terms unavailable here — fees may apply per the rate&apos;s terms.
          </p>
        )}

        <p className="text-sm text-text-secondary">
          {isFlight
            ? 'The airline decides the final refund — what it states after cancellation shows here. If the airline needs time, the booking stays confirmed until it answers. This can’t be undone.'
            : 'The hotel decides the refund per these terms — the actual refund and any fee show here after cancellation. This can’t be undone.'}
        </p>

        <div className="flex gap-2">
          {canConfirm && (
            <button
              type="button"
              onClick={onConfirm}
              disabled={busy}
              className="flex-1 rounded bg-brand-red px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-red/90 disabled:opacity-50"
            >
              {busy ? 'Cancelling…' : 'Cancel booking'}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex-1 rounded border border-border px-4 py-2 text-sm font-semibold text-text-secondary transition-colors hover:bg-bg-row disabled:opacity-50"
          >
            Keep booking
          </button>
        </div>
      </div>
    </TripFormModal>
  );
}
