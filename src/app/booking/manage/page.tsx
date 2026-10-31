'use client';

/**
 * GUEST-01 (2026-09-29) — /booking/manage: a guest manages a booking made without an account.
 *
 * PUBLIC, and standalone like the receipt page — no AppLayout, which sends a guest to
 * '/' (src/components/ui/AppLayout.tsx). The guest types the Manage reference and the
 * Manage code from their own booking email into the one lookup box
 * (src/components/guest/GuestBookingLookup.tsx — the home page mounts the same box,
 * Alex's ruling 17:04); POST /api/guest/session opens a signed,
 * one-hour session for that ONE booking and GET /api/guest/booking reads it: the
 * vendor's side, read-only, drawn by the one receipt renderer
 * (src/components/receipts/ReceiptBody.tsx) — no Bank, no Ledger, no History, no
 * settlement. "Close this booking" ends the session (POST /api/guest/session/end).
 *
 * The reference may arrive prefilled from the email's link (?ref=). The code never
 * goes in a URL — it is posted in the body — and nothing is kept in the browser's
 * storage. On arrival the page asks once whether a session is already open (a reload
 * within the hour); no session is simply the form.
 *
 * "Downloadable" is the browser's Print / Save as PDF (window.print()), as on the
 * owner's receipt.
 *
 * GUEST-02 (2026-09-30): the guest cancels here. When the booking's answer carries a cancel
 * offer (guestCancelOffer — a confirmed LiteAPI hotel or flight), "Cancel booking" sits beside
 * Print and Close and opens the ONE cancel dialog (src/components/trips/CancelBookingDialog.tsx)
 * with the guest's own route as its quote URL. Confirm posts /api/guest/booking/cancel — the
 * same cancel flow the account runs, behind the guest's gate; the dialog closes when it answers.
 * A success reads the booking again and says, in one line, what happened and whether the
 * confirmation email went; a failure is the answer's own error on the failure line.
 */

import { useEffect, useState } from 'react';
import type { GuestReceipt } from '@/lib/receipts/bookingReceipt';
import type { GuestCancelOffer } from '@/lib/guest/guestSession';
import ReceiptBody from '@/components/receipts/ReceiptBody';
import GuestBookingLookup from '@/components/guest/GuestBookingLookup';
import CancelBookingDialog from '@/components/trips/CancelBookingDialog';

type View = { state: 'checking' } | { state: 'form' } | { state: 'open'; receipt: GuestReceipt; cancel: GuestCancelOffer | null };
type Read = { ok: true; receipt: GuestReceipt; cancel: GuestCancelOffer | null } | { ok: false; status: number; error: string };

async function readBooking(): Promise<Read> {
  const res = await fetch('/api/guest/booking', { cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  if (res.ok) return { ok: true, receipt: data.receipt as GuestReceipt, cancel: data.cancel as GuestCancelOffer | null };
  return { ok: false, status: res.status, error: typeof data.error === 'string' ? data.error : `the booking read answered ${res.status}` };
}

export default function ManageBookingPage() {
  const [view, setView] = useState<View>({ state: 'checking' });
  const [prefill, setPrefill] = useState('');
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // GUEST-02: the cancel dialog, its POST in flight, and the one line a success leaves.
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelOutcome, setCancelOutcome] = useState<string | null>(null);

  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref !== null) setPrefill(ref);
    let alive = true;
    (async () => {
      try {
        const read = await readBooking();
        if (!alive) return;
        if (read.ok) { setView({ state: 'open', receipt: read.receipt, cancel: read.cancel }); return; }
        // 401 is no session — the form, with nothing to say. Anything else is said.
        if (read.status !== 401) setFailure(read.error);
        setView({ state: 'form' });
      } catch (err) {
        if (!alive) return;
        setFailure(err instanceof Error ? err.message : 'the booking could not be read');
        setView({ state: 'form' });
      }
    })();
    return () => { alive = false; };
  }, []);

  // A match in the lookup box: read the booking the session now names and show it. A
  // failed read throws, and the box says it on its one line.
  const showOpened = async () => {
    const read = await readBooking();
    if (!read.ok) throw new Error(read.error);
    setFailure(null);
    setCancelOutcome(null);
    setView({ state: 'open', receipt: read.receipt, cancel: read.cancel });
  };

  const close = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/guest/session/end', { method: 'POST' });
      if (!res.ok) throw new Error(`closing the booking answered ${res.status}`);
      setFailure(null);
      setCancelOutcome(null);
      setView({ state: 'form' });
    } catch (err) {
      setFailure(err instanceof Error ? err.message : 'the booking could not be closed');
    } finally {
      setBusy(false);
    }
  };

  // GUEST-02: the confirmed cancel. The dialog closes when the route answers. A success reads
  // the booking again and leaves one line — what happened, then whether the email went; a
  // failure is the answer's own error, verbatim.
  const doCancel = async () => {
    setCancelBusy(true);
    setCancelOutcome(null);
    try {
      const res = await fetch('/api/guest/booking/cancel', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      setCancelOpen(false);
      if (!res.ok) {
        setFailure(typeof data.error === 'string' ? data.error : `the cancel answered ${res.status}`);
        return;
      }
      const status = data.reservation?.status;
      const what = status === 'cancelled'
        ? 'Your booking is cancelled.'
        : status === 'cancel_pending'
          ? 'Your cancellation request is with the airline — the booking stays confirmed until it answers.'
          : null;
      if (what === null) {
        setFailure(`the cancel answered the status ${String(status)}`);
        return;
      }
      const told = data.email?.sent === true
        ? 'We emailed the confirmation to the address on this booking.'
        : 'No confirmation email was sent — print or save this page as your record.';
      const read = await readBooking();
      if (read.ok) {
        setFailure(null);
        setView({ state: 'open', receipt: read.receipt, cancel: read.cancel });
      } else {
        setFailure(read.error);
      }
      setCancelOutcome(`${what} ${told}`);
    } catch (err) {
      setCancelOpen(false);
      setFailure(err instanceof Error ? err.message : 'the booking could not be cancelled');
    } finally {
      setCancelBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl bg-white px-6 py-8 text-text-primary print:max-w-none print:px-0 print:py-0" data-guest-manage-page>
      <style>{`@media print { .no-print { display: none !important; } body { background: #fff; } }`}</style>
      {view.state === 'checking' && <p className="text-sm text-text-faint">checking for an open booking…</p>}
      {view.state === 'form' && (
        <section className="space-y-4" data-guest-manage-form>
          <h1 className="text-xl font-bold">Manage a booking</h1>
          <GuestBookingLookup initialReference={prefill} initialFailure={failure} onOpened={showOpened} />
        </section>
      )}
      {view.state === 'open' && (
        <>
          {failure && <p className="no-print mb-4 text-sm text-brand-red" role="alert" data-guest-failure>{failure}</p>}
          {cancelOutcome && <p className="mb-4 text-sm text-text-primary" role="status" data-guest-cancel-outcome>{cancelOutcome}</p>}
          <ReceiptBody
            receipt={view.receipt}
            actions={(
              <>
                <button type="button" onClick={() => window.print()} className="rounded bg-brand-purple px-3 py-1.5 text-xs font-semibold text-white" data-guest-print>
                  Print / Save as PDF
                </button>
                {view.cancel && (
                  <button type="button" onClick={() => setCancelOpen(true)} disabled={cancelBusy} className="rounded border border-brand-red/40 px-3 py-1.5 text-xs font-semibold text-brand-red hover:bg-brand-red/10 disabled:opacity-60" data-guest-cancel>
                    Cancel booking
                  </button>
                )}
                <button type="button" onClick={close} disabled={busy} className="rounded border border-border px-3 py-1.5 text-xs font-semibold text-text-secondary disabled:opacity-60" data-guest-close>
                  Close this booking
                </button>
              </>
            )}
          />
          {cancelOpen && view.cancel && (
            <CancelBookingDialog
              quoteUrl="/api/guest/booking/cancel"
              lane={view.cancel.lane}
              bookingName={view.receipt.header.name}
              checkIn={view.cancel.checkIn}
              checkOut={view.cancel.checkOut}
              policy={view.cancel.policy}
              busy={cancelBusy}
              onConfirm={doCancel}
              onClose={() => { if (!cancelBusy) setCancelOpen(false); }}
            />
          )}
        </>
      )}
    </main>
  );
}
