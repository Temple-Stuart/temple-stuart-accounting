'use client';

/**
 * RECEIPT-01 (2026-09-26) — /booking/[id]/receipt, the owner's printable receipt.
 *
 * One page, one authed GET of /api/reservations/<id>/receipt, rendered as the
 * leaf's words: this page types no money word, no status word and no absence
 * of its own — every line comes from src/lib/receipts/bookingReceipt.ts. It is
 * NOT in PUBLIC_PATHS: the middleware's cookie check gates it, and the API does
 * the ownership (a foreign or guest booking is a 404 there).
 *
 * "Downloadable" is the browser's Print / Save as PDF (window.print()) — no PDF
 * library, nothing generated on the server; the header says so in the leaf's
 * own note.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type { BookingReceipt, ReceiptLine } from '@/lib/receipts/bookingReceipt';

type Loaded = { state: 'loading' } | { state: 'error'; message: string } | { state: 'done'; receipt: BookingReceipt };

function Line({ line }: { line: ReceiptLine }) {
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

export default function BookingReceiptPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === 'string' ? params.id : '';
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });

  useEffect(() => {
    let alive = true;
    if (!id) { setLoaded({ state: 'error', message: 'no booking id in the address' }); return; }
    (async () => {
      try {
        const res = await fetch(`/api/reservations/${encodeURIComponent(id)}/receipt`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `the receipt read answered ${res.status}`);
        if (alive) setLoaded({ state: 'done', receipt: data.receipt as BookingReceipt });
      } catch (err) {
        if (alive) setLoaded({ state: 'error', message: err instanceof Error ? err.message : 'the receipt could not be read' });
      }
    })();
    return () => { alive = false; };
  }, [id]);

  return (
    <main className="mx-auto max-w-3xl bg-white px-6 py-8 text-text-primary print:max-w-none print:px-0 print:py-0" data-receipt-page={id}>
      <style>{`@media print { .no-print { display: none !important; } body { background: #fff; } }`}</style>
      {loaded.state === 'loading' && <p className="text-sm text-text-faint">reading the receipt…</p>}
      {loaded.state === 'error' && <p className="text-sm text-brand-red" role="alert" data-receipt-error>{loaded.message}</p>}
      {loaded.state === 'done' && (() => {
        const r = loaded.receipt;
        return (
          <article className="space-y-6">
            <header className="border-b border-border pb-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h1 className="text-xl font-bold">{r.header.laneWord} receipt · {r.header.name}</h1>
                <button type="button" onClick={() => window.print()} className="no-print rounded bg-brand-purple px-3 py-1.5 text-xs font-semibold text-white" data-receipt-print>
                  Print / Save as PDF
                </button>
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

            <section className="space-y-2" data-receipt-section="bank">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">Bank</h2>
              {r.bank.line ? (
                <dl className="divide-y divide-border-light"><Line line={r.bank.line} /></dl>
              ) : (
                <p className="text-sm text-text-secondary" data-receipt-bank-absent>{r.bank.words}</p>
              )}
            </section>

            <section className="space-y-2" data-receipt-section="ledger">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">Ledger</h2>
              {r.ledger.entry ? (
                <dl className="divide-y divide-border-light">
                  <Line line={r.ledger.entry} />
                  {r.ledger.lines.map((l, i) => <Line key={`${l.label}-${i}`} line={l} />)}
                </dl>
              ) : (
                <p className="text-sm text-text-secondary" data-receipt-ledger-absent>{r.ledger.words}</p>
              )}
            </section>

            <section className="space-y-2" data-receipt-section="refunds">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">Refunds and fees the vendor stated</h2>
              <p className="text-xs text-text-faint" data-receipt-refunds-words>{r.refundsWords}</p>
              {r.refunds.length > 0 && (
                <ul className="space-y-1 text-sm" data-receipt-refunds>
                  {r.refunds.map((f) => (
                    <li key={f.raw.id} data-money-event={f.raw.id} data-figure-source={f.figure.source} data-figure-evidence={f.figure.evidence}>
                      <span className="font-medium">{f.kind}</span> · {f.amount} · {f.statedAt} · {f.settlement}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </article>
        );
      })()}
    </main>
  );
}
