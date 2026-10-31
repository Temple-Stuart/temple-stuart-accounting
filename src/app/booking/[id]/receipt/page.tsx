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
 *
 * AUDIT-01 (2026-09-26): a "History" section — one more authed GET, of
 * /api/reservations/<id>/timeline, rendered as the timeline leaf's items
 * (src/lib/reservations/timeline.ts): each line its instant, its words and the
 * record it was read from. The section's own words are the leaf's HISTORY_WORDS;
 * the page types none. It prints with the receipt.
 *
 * CAL-02 (2026-09-27): an "Add to calendar" link — the booking's iCalendar file
 * (GET /api/reservations/<id>/ics, the same href and word the bookings list uses,
 * from src/lib/reservations/bookingRow.ts). The route answers it as an attachment; it does not print.
 *
 * GUEST-01 (2026-09-29): the header lines, Stay, Flight, Vendor and Refunds are ONE
 * component now (src/components/receipts/ReceiptBody.tsx), which a guest's
 * /booking/manage mounts too. This page hands it its own header actions (Add to
 * calendar, Print / Save as PDF), its Bank and Ledger after the Vendor section and its
 * History at the foot — the owner's output is unchanged.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type { BookingReceipt } from '@/lib/receipts/bookingReceipt';
import { HISTORY_WORDS, type TimelineItem } from '@/lib/reservations/timeline';
import { BOOKING_WORDS, bookingIcsHref } from '@/lib/reservations/bookingRow';
import ReceiptBody, { Line } from '@/components/receipts/ReceiptBody';

type Loaded = { state: 'loading' } | { state: 'error'; message: string } | { state: 'done'; receipt: BookingReceipt };
type History = { state: 'loading' } | { state: 'error'; message: string } | { state: 'done'; items: TimelineItem[] };

/** AUDIT-01: the booking's history — the timeline leaf's items, verbatim. */
function HistorySection({ history }: { history: History }) {
  return (
    <section className="space-y-2" data-receipt-section="history">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">{HISTORY_WORDS.heading}</h2>
      <p className="text-xs text-text-faint" data-history-note>{HISTORY_WORDS.note}</p>
      {history.state === 'loading' && <p className="text-sm text-text-faint">{HISTORY_WORDS.reading}</p>}
      {history.state === 'error' && <p className="text-sm text-brand-red" role="alert" data-history-error>{history.message}</p>}
      {history.state === 'done' && history.items.length === 0 && <p className="text-sm text-text-secondary" data-history-none>{HISTORY_WORDS.none}</p>}
      {history.state === 'done' && history.items.length > 0 && (
        <ol className="space-y-1 text-sm" data-history>
          {history.items.map((item) => (
            <li key={`${item.evidence.table}-${item.evidence.id}-${item.kind}-${item.at}`} data-history-kind={item.kind} data-evidence-table={item.evidence.table} data-evidence-id={item.evidence.id}>
              <span className="font-mono text-xs text-text-faint">{item.at}</span> · {item.words}
              <span className="ml-2 text-xs text-text-faint">— {HISTORY_WORDS.evidence} {item.evidence.table} {item.evidence.id}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export default function BookingReceiptPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === 'string' ? params.id : '';
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });
  const [history, setHistory] = useState<History>({ state: 'loading' });

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

  // AUDIT-01: the history, from the owner's timeline route — read-only, like the receipt.
  useEffect(() => {
    let alive = true;
    if (!id) return;
    (async () => {
      try {
        const res = await fetch(`/api/reservations/${encodeURIComponent(id)}/timeline`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `${HISTORY_WORDS.unreadable} (${res.status})`);
        if (alive) setHistory({ state: 'done', items: data.timeline as TimelineItem[] });
      } catch (err) {
        if (alive) setHistory({ state: 'error', message: err instanceof Error ? err.message : HISTORY_WORDS.unreadable });
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
          <ReceiptBody
            receipt={r}
            actions={(
              <>
                <a href={bookingIcsHref(id)} className="rounded border border-border px-3 py-1.5 text-xs font-semibold text-text-secondary" data-receipt-ics>
                  {BOOKING_WORDS.addToCalendar}
                </a>
                <button type="button" onClick={() => window.print()} className="rounded bg-brand-purple px-3 py-1.5 text-xs font-semibold text-white" data-receipt-print>
                  Print / Save as PDF
                </button>
              </>
            )}
            afterVendor={(
              <>
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
              </>
            )}
          >
            <HistorySection history={history} />
          </ReceiptBody>
        );
      })()}
    </main>
  );
}
