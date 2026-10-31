'use client';

/**
 * SELL-03b — the verification link's DECLARED failure, on the front door.
 * GET /api/auth/verify lands a bad link on `/?verify=expired|used|invalid`;
 * this banner names what happened and offers the resend — a form that posts
 * to /api/auth/verify/resend and shows that route's one line (the same words
 * whatever the address is; the route is rate-limited and non-enumerating).
 * useSearchParams rides inside its own <Suspense> (the Next.js requirement).
 */

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const LINES: Record<string, string> = {
  expired: 'That sign-in link has expired — links last 24 hours.',
  used: 'That sign-in link was already used — links work once.',
  invalid: "That sign-in link isn't one we issued.",
};

function BannerInner() {
  const params = useSearchParams();
  const router = useRouter();
  const state = params.get('verify');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  if (!state || !LINES[state]) return null;

  const dismiss = () => {
    const next = new URLSearchParams(params.toString());
    next.delete('verify');
    const qs = next.toString();
    router.replace(`${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`);
  };

  const resend = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setNotice('');
    setError('');
    try {
      const res = await fetch('/api/auth/verify/resend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : `Resend failed (HTTP ${res.status})`);
      setNotice(typeof data?.message === 'string' ? data.message : 'Sent.');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pt-4 lg:px-8">
      <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900" data-verify-banner={state}>
        <div className="flex items-center justify-between gap-3">
          <span>{LINES[state]}</span>
          <button type="button" onClick={dismiss} aria-label="Dismiss" className="shrink-0 text-current opacity-60 hover:opacity-100">×</button>
        </div>
        <form onSubmit={resend} className="mt-2 flex flex-wrap items-center gap-2" data-verify-resend>
          <label className="sr-only" htmlFor="verify-resend-email">Email address</label>
          <input
            id="verify-resend-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Your email address"
            className="min-w-[220px] flex-1 border border-amber-300 bg-white px-2 py-1.5 text-xs text-text-primary"
          />
          <button type="submit" disabled={busy} className="bg-brand-purple px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-purple-hover disabled:opacity-50">
            {busy ? 'Sending…' : 'Send a new link'}
          </button>
          {notice && <span role="status" className="text-emerald-800" data-verify-resend-notice>{notice}</span>}
          {error && <span role="alert" className="text-brand-red">{error}</span>}
        </form>
      </div>
    </div>
  );
}

export default function VerifyResultBanner() {
  return (
    <Suspense fallback={null}>
      <BannerInner />
    </Suspense>
  );
}
