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
 *
 * HOME-TRAVEL-01 (Alex's brief, 2026-11-12; the board approved on the design canvas at 20:26: "ok I approve the travel market place") —
 * THE SAME COMPONENT, WORDS AND BEHAVIOUR, IN THE NEW LOOK (design-refs/home-travel-01/Section-Reference.html, .tm-lookup__form; its rules
 * ported to src/app/globals.css): the legend in the heading violet; each field's label over it; the fields 46px with a 12px radius in the
 * house's own field line, side by side while there is room (760px across at most) and stacked on a phone; Look up the QUIET PILL, full width
 * under 480px; the hint; the failure line in brand red. The look is the component's own, so both mounts take it — the home page, under the
 * trip, and /booking/manage, which draws it outside the travel section: the form carries its own focus ring and hiding rule there
 * (.ts-tm-lookup__form). LOOK UP LEAVES PRIMARY_CTA (src/lib/ds.ts): it wore the public page's one filled button by Alex's ruling of
 * 2026-11-08 (HOME-FINISH-01: "like lookup, purple"); the board he approved draws it as the quiet pill, beside Create free account — this
 * reverses that ruling for this one button. Until then: the form 'max-w-2xl'; the fieldset 'space-y-3'; the legend 'text-sm font-semibold
 * text-text-primary'; the fields' row 'flex flex-col gap-3 sm:flex-row sm:items-end'; each label 'block min-w-0 flex-1 text-sm font-medium
 * text-text-secondary', its words before its input; the inputs FIELD, 'mt-1 block w-full rounded border border-border bg-white px-3 py-2
 * text-sm text-text-primary'; Look up `${PRIMARY_CTA} shrink-0 disabled:opacity-60`; the hint 'text-xs text-text-faint'; the failure
 * 'text-sm text-brand-red'.
 */

import { useState, useSyncExternalStore, type FormEvent } from 'react';

const NO_SUBSCRIPTION = () => () => {};

/** HOME-TRAVEL-01 (2026-11-12): the two fields' class — the reference's .tm-input (46px, a 12px radius, the house's field line). */
const FIELD = 'ts-tm-input';

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
    <form onSubmit={submit} className="ts-tm-lookup__form" data-guest-lookup>
      <fieldset className="ts-tm-lookup__set" disabled={!live}>
        <legend className="ts-tm-lookup__legend">Booked without an account? Look up your booking</legend>
        <div className="ts-tm-lookup__fields">
          <label className="ts-tm-field">
            <span className="ts-tm-field__label">Manage reference</span>
            <input name="reference" value={reference} onChange={(e) => setReference(e.target.value)} autoComplete="off" spellCheck={false} maxLength={120} required className={FIELD} data-guest-reference />
          </label>
          <label className="ts-tm-field">
            <span className="ts-tm-field__label">Manage code</span>
            <input name="code" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" spellCheck={false} maxLength={16} required className={FIELD} data-guest-code />
          </label>
          <button type="submit" disabled={busy} className="ts-tm-quiet ts-tm-lookup__button" data-guest-open>
            Look up
          </button>
        </div>
        <p className="ts-tm-lookup__hint" data-guest-lookup-hint>Your reference and manage code are in your booking email.</p>
        {failure && <p className="ts-tm-lookup__failure" role="alert" data-guest-failure>{failure}</p>}
      </fieldset>
    </form>
  );
}
