'use client';

/**
 * CancelBookingDialog (PR-Cancel-1) — the pre-confirm step of in-app hotel
 * cancellation, shared by TripBookings and UnattachedBookings.
 *
 * It renders the STORED cancellationPolicyJson (written at book time by
 * liteapi/book:187) truthfully: only the fields that actually exist —
 * refundableTag ('RFN'/'NRFN', same vocabulary CheckoutPanel renders pre-
 * purchase), the cancelPolicyInfos deadline rows, and hotelRemarks. When the
 * stored policy is null or unparseable, the one honest line renders instead —
 * NEVER a fabricated policy. The dialog only collects the explicit confirm /
 * abort; the parent owns the POST and the result rendering (the outcome line
 * lives inline in the row, which REMAINS after cancellation — record-keeping).
 */

import TripFormModal from './TripFormModal';

// The stored shape (see CheckoutPanel's CancellationData twin, :117-121):
// { refundableTag?: 'RFN'|'NRFN', cancelPolicyInfos?: [...], hotelRemarks?: [...] }
interface PolicyShape {
  refundableTag?: string;
  cancelPolicyInfos?: unknown[];
  hotelRemarks?: unknown[];
}

interface Props {
  /** Row display context — name + dates, so the user confirms the RIGHT booking. */
  bookingName: string;
  checkIn: string | null;
  checkOut: string | null;
  /** The reservation row's stored cancellationPolicyJson, verbatim. */
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

export default function CancelBookingDialog({ bookingName, checkIn, checkOut, policy, busy, onConfirm, onClose }: Props) {
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

  return (
    <TripFormModal
      title="Cancel this booking?"
      subtitle={`${bookingName}${dates ? ` · ${dates}` : ''}`}
      onClose={onClose}
    >
      <div className="space-y-3">
        {/* ── The stored policy, truthfully — or the one honest absence line ── */}
        {hasAnyPolicy ? (
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
          The hotel decides the refund per these terms — the actual refund and any fee show here
          after cancellation. This can&apos;t be undone.
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 rounded bg-brand-red px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-red/90 disabled:opacity-50"
          >
            {busy ? 'Cancelling…' : 'Cancel booking'}
          </button>
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
