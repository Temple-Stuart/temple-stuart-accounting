'use client';

/**
 * GUEST-01 (2026-09-29; the door, Alex's ruling 17:04) — THE ONE LOOKUP BOX.
 *
 * A guest who booked without an account types the Manage reference and the Manage
 * code from their own booking email. Two mounts, one component:
 *   · the home page (src/components/landing/Landing.tsx), directly under the booking
 *     section — a match goes to /booking/manage, which shows the booking;
 *   · /booking/manage itself — a match shows the booking in place.
 * Either way a failure is the lookup's one line, under the box.
 *
 * It asks nothing on load: its one call is the user-submitted POST to
 * /api/guest/session (same route, same rules — src/lib/guest/guestSession.ts). The
 * code is posted in the body and cleared once the booking opens; it never goes in a
 * URL and nothing is kept in the browser's storage. The fields stack on a phone.
 *
 * The fields are disabled until the page is live (hydrated): the server's HTML is a
 * plain <form>, and a code typed and submitted before the script runs would be sent
 * by the browser itself as a GET — ?reference=…&code=… in the URL. `live` comes from
 * useSyncExternalStore (false in the server's render and the hydrating one, true
 * after), so there is no effect and nothing is asked on load.
 */

import { useState, useSyncExternalStore, type FormEvent } from 'react';

const NO_SUBSCRIPTION = () => () => {};

const FIELD = 'mt-1 block w-full rounded border border-border bg-white px-3 py-2 text-sm text-text-primary';

export default function GuestBookingLookup({ initialReference = '', initialFailure = null, onOpened }: {
  /** The reference to start with — /booking/manage passes the email link's ?ref=. */
  initialReference?: string;
  /** A line the mounting page has to say before anything is typed (its own read failed). */
  initialFailure?: string | null;
  /** What a match does: the home page goes to /booking/manage; the page shows the booking. */
  onOpened: () => void | Promise<void>;
}) {
  const [reference, setReference] = useState(initialReference);
  const [code, setCode] = useState('');
  const [failure, setFailure] = useState<string | null>(initialFailure);
  const [busy, setBusy] = useState(false);
  const live = useSyncExternalStore(NO_SUBSCRIPTION, () => true, () => false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFailure(null);
    try {
      const res = await fetch('/api/guest/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setFailure(typeof data.error === 'string' ? data.error : `the lookup answered ${res.status}`); return; }
      await onOpened();
      setCode('');
    } catch (err) {
      setFailure(err instanceof Error ? err.message : 'the booking could not be looked up');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="max-w-2xl" data-guest-lookup>
      <fieldset className="space-y-3" disabled={!live}>
        <legend className="text-sm font-semibold text-text-primary">Booked without an account? Look up your booking</legend>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block min-w-0 flex-1 text-sm font-medium text-text-secondary">
            Manage reference
            <input name="reference" value={reference} onChange={(e) => setReference(e.target.value)} autoComplete="off" spellCheck={false} maxLength={120} required className={FIELD} data-guest-reference />
          </label>
          <label className="block min-w-0 flex-1 text-sm font-medium text-text-secondary">
            Manage code
            <input name="code" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" spellCheck={false} maxLength={16} required className={FIELD} data-guest-code />
          </label>
          <button type="submit" disabled={busy} className="shrink-0 rounded bg-brand-purple px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" data-guest-open>
            Look up
          </button>
        </div>
        <p className="text-xs text-text-faint" data-guest-lookup-hint>Your reference and manage code are in your booking email.</p>
        {failure && <p className="text-sm text-brand-red" role="alert" data-guest-failure>{failure}</p>}
      </fieldset>
    </form>
  );
}
