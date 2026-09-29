/**
 * GUEST-01 (2026-09-29) — THE ONE RECEIPT RENDERER.
 *
 * A booking's receipt as both pages that show one render it: the header lines, the
 * Stay, the Flight, the Vendor money and the Refunds and fees the vendor stated.
 *   · the owner's /booking/[id]/receipt mounts it with its own header actions (Add to
 *     calendar, Print / Save as PDF), its Bank and Ledger after the Vendor section, and
 *     its History at the foot — its output unchanged;
 *   · a guest's /booking/manage mounts it with the guest projection (guestReceiptOf):
 *     the vendor's side only — no Bank, no Ledger, no History, and a refund carries no
 *     settlement words.
 * Every word comes from src/lib/receipts/bookingReceipt.ts; this file types no money
 * word and no status word of its own.
 */
import type { ReactNode } from 'react';
import type { BookingReceipt, GuestReceipt, ReceiptLine } from '@/lib/receipts/bookingReceipt';

export function Line({ line }: { line: ReceiptLine }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-x-3 py-1" data-receipt-line={line.label} data-figure-source={line.figure?.source ?? ''} data-figure-evidence={line.figure?.evidence ?? ''}>
      <dt className="text-xs uppercase tracking-wider text-text-faint">{line.label}</dt>
      <dd className="text-sm text-text-primary">
        {line.value}
        {line.note && <span className="ml-2 text-xs text-text-faint">— {line.note}</span>}
      </dd>
    </div>
  );
}

function Words({ items, tag }: { items: string[]; tag: string }) {
  return (
    <ul className="list-disc space-y-0.5 pl-5 text-sm text-text-primary" data-receipt-list={tag}>
      {items.map((w, i) => <li key={`${tag}-${i}`}>{w}</li>)}
    </ul>
  );
}

export default function ReceiptBody({ receipt, actions, afterVendor, children }: {
  receipt: BookingReceipt | GuestReceipt;
  /** The header's own controls — they do not print. */
  actions: ReactNode;
  /** What follows the Vendor section, before the Refunds (the owner's Bank and Ledger). */
  afterVendor?: ReactNode;
  /** What closes the receipt (the owner's History). */
  children?: ReactNode;
}) {
  const r = receipt;
  return (
    <article className="space-y-6">
      <header className="border-b border-border pb-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-xl font-bold">{r.header.laneWord} receipt · {r.header.name}</h1>
          <div className="no-print flex items-center gap-2">
            {actions}
          </div>
        </div>
        <dl className="mt-3 divide-y divide-border-light">
          <Line line={{ label: 'Vendor booking id', value: r.header.vendorBookingId, note: null, figure: null }} />
          <Line line={{ label: 'Confirmation code', value: r.header.confirmationCode, note: null, figure: null }} />
          <Line line={{ label: 'Status', value: r.header.statusWord, note: null, figure: null }} />
          <Line line={{ label: 'Vendor status', value: r.header.vendorStatus, note: null, figure: null }} />
          <Line line={{ label: 'Booked at', value: r.header.bookedAt, note: null, figure: null }} />
          <Line line={{ label: 'Holder', value: r.header.holder, note: null, figure: null }} />
        </dl>
        <ul className="mt-3 space-y-1 text-xs text-text-faint" data-receipt-notes>
          {r.notes.map((n, i) => <li key={i}>{n}</li>)}
        </ul>
      </header>

      {r.hotel && (
        <section className="space-y-2" data-receipt-section="hotel">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">Stay</h2>
          <Words items={r.hotel.rooms} tag="rooms" />
          <dl className="divide-y divide-border-light">
            <Line line={{ label: 'Check-in', value: r.hotel.checkin, note: null, figure: null }} />
            <Line line={{ label: 'Check-out', value: r.hotel.checkout, note: null, figure: null }} />
          </dl>
          <h3 className="text-xs uppercase tracking-wider text-text-faint">Check-in instructions</h3>
          <Words items={r.hotel.checkinInstructions} tag="checkin-instructions" />
          <h3 className="text-xs uppercase tracking-wider text-text-faint">Cancellation policy</h3>
          <Words items={r.hotel.cancellationPolicy} tag="cancellation-policy" />
        </section>
      )}

      {r.flight && (
        <section className="space-y-2" data-receipt-section="flight">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">Flight</h2>
          <Words items={r.flight.segments} tag="segments" />
          <h3 className="text-xs uppercase tracking-wider text-text-faint">Passengers</h3>
          <Words items={r.flight.passengers} tag="passengers" />
          <dl className="divide-y divide-border-light">
            <Line line={{ label: 'PNR', value: r.flight.pnr, note: null, figure: null }} />
            <Line line={{ label: 'Ticketing', value: r.flight.ticketing, note: null, figure: null }} />
          </dl>
        </section>
      )}

      <section className="space-y-2" data-receipt-section="vendor">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">Vendor</h2>
        <dl className="divide-y divide-border-light">
          <Line line={r.vendor.total} />
          {r.vendor.lines.map((l) => <Line key={l.label} line={l} />)}
        </dl>
      </section>

      {afterVendor}

      <section className="space-y-2" data-receipt-section="refunds">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">Refunds and fees the vendor stated</h2>
        <p className="text-xs text-text-faint" data-receipt-refunds-words>{r.refundsWords}</p>
        {r.refunds.length > 0 && (
          <ul className="space-y-1 text-sm" data-receipt-refunds>
            {r.refunds.map((f) => (
              <li key={f.raw.id} data-money-event={f.raw.id} data-figure-source={f.figure.source} data-figure-evidence={f.figure.evidence}>
                <span className="font-medium">{f.kind}</span> · {f.amount} · {f.statedAt}{'settlement' in f ? <> · {f.settlement}</> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {children}
    </article>
  );
}
