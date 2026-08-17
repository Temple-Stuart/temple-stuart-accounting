'use client';

/**
 * MatchReviewSection (PR-MATCH-2) — the Runway booking↔bank match review
 * queue. "Find matches" runs the MATCH-1 matcher server-side (propose route);
 * each PROPOSED link renders as one row — transaction vs reservation,
 * confidence, and the FULL matcher rationale (visible, not tucked in a
 * tooltip — the CPA-auditable bar) — with per-row Accept / Reject. One human
 * decision per click; nothing links silently.
 *
 * Absence is honest: no proposals → a plain empty state, never placeholder
 * rows. Errors render verbatim — including the expected 500 while the
 * MATCH-0 table hasn't landed in Azure yet.
 *
 * Styling: the RunwayBudgetPanel idiom — ... over the
 * light-token vocabulary (RunwayBudgetPanel.tsx:121-131), dark runway surface.
 */

import { useCallback, useEffect, useState } from 'react';


interface QueueRow {
  id: string;
  confidence: number | null;
  rationale: string | null;
  proposedAt: string;
  transaction: { name: string; merchantName: string | null; amount: number; date: string; pending: boolean };
  reservation: {
    provider: string; hotelName: string | null; finalPriceCents: number; currency: string;
    createdAt: string; checkinDate: string | null; checkoutDate: string | null;
  };
}

const day = (s: string | null) => (s ? s.slice(0, 10) : '—');

// RUNWAY-PIPE: onTotals — the Books report-up idiom: the pending-review count,
// fired at the EXISTING queue-fetch success (mount + every reload after a
// propose/accept/reject), zero new fetches. The parent passes a stable
// setState setter; the strip renders it as a DERIVED INDICATOR, never a lock.
export default function MatchReviewSection({
  onTotals,
}: {
  onTotals?: (t: { pending: number }) => void;
} = {}) {
  const [queue, setQueue] = useState<QueueRow[]>([]);
  // POLISH-4: user-scoped bookings count from the queue route — the truthful
  // basis for collapse-when-empty ("no bookings yet" is a COUNTED claim).
  const [reservationCount, setReservationCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [proposing, setProposing] = useState(false);
  const [runSummary, setRunSummary] = useState('');
  const [busyLink, setBusyLink] = useState<string | null>(null);

  // RUNWAY-PIPE: useCallback on [onTotals] so the mount effect can depend on
  // it honestly (the parent passes a stable setState setter — one run, no
  // refetch churn; the exhaustive-deps idiom).
  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/runway/match/queue');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Queue failed (HTTP ${res.status})`);
      const rows = (data.queue || []) as QueueRow[];
      setQueue(rows);
      setReservationCount(typeof data.reservationCount === 'number' ? data.reservationCount : null);
      onTotals?.({ pending: rows.length });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the match queue.');
    } finally {
      setLoading(false);
    }
  }, [onTotals]);

  useEffect(() => { void loadQueue(); }, [loadQueue]);

  const runPropose = async () => {
    setProposing(true);
    setError('');
    setRunSummary('');
    try {
      const res = await fetch('/api/runway/match/propose', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Match run failed (HTTP ${res.status})`);
      setRunSummary(
        `Scanned ${data.reservations} booking(s): ${data.proposed} new proposal(s), ` +
        `${data.refreshed} refreshed, ${data.skippedReviewed} already reviewed.`
      );
      await loadQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Match run failed.');
    } finally {
      setProposing(false);
    }
  };

  const review = async (linkId: string, action: 'accept' | 'reject') => {
    setBusyLink(linkId);
    setError('');
    try {
      const res = await fetch('/api/runway/match/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkId, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Review failed (HTTP ${res.status})`);
      setQueue((prev) => prev.filter((q) => q.id !== linkId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Review failed.');
    } finally {
      setBusyLink(null);
    }
  };

  // POLISH-4: collapse-when-empty — zero bookings AND zero proposals means the
  // full bordered panel is pure noise for non-travel users; a single quiet row
  // keeps the door visible. The full panel returns the moment ANYTHING exists
  // (a booking, a proposal, a run summary, or an error to declare).
  if (!loading && !error && !runSummary && queue.length === 0 && reservationCount === 0) {
    return (
      <div className="mx-4 my-4">
        <p className="font-mono text-[11px] text-white/60">
          Booking ↔ bank matching — no bookings yet ·{' '}
          <button
            type="button"
            onClick={runPropose}
            disabled={proposing}
            className="text-brand-purple hover:underline disabled:opacity-50"
          >
            {proposing ? 'Scanning…' : 'Find matches'}
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-4 my-4 rounded-lg border border-border bg-bg-row/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-text-primary">Booking ↔ bank match review</h3>
          <p className="text-xs text-text-muted">
            Proposed matches between your bookings and bank transactions. Nothing links until you accept it.
          </p>
        </div>
        <button
          type="button"
          onClick={runPropose}
          disabled={proposing}
          className="rounded bg-brand-purple px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {proposing ? 'Scanning…' : 'Find matches'}
        </button>
      </div>

      {runSummary && (
        <p className="mt-2 font-mono text-xs text-text-secondary">{runSummary}</p>
      )}
      {error && <p className="mt-2 text-sm text-brand-red">{error}</p>}

      {loading ? (
        <div className="mt-3 h-10 animate-pulse rounded bg-bg-row" aria-busy="true" />
      ) : queue.length === 0 ? (
        <p className="mt-3 text-xs text-text-muted">
          No match proposals waiting. &ldquo;Find matches&rdquo; scans your bookings against bank transactions.
        </p>
      ) : (
        <div className="mt-3 divide-y divide-border rounded border border-border">
          {queue.map((q) => {
            const resLabel = q.reservation.hotelName ?? `${q.reservation.provider} booking`;
            const resPrice = (q.reservation.finalPriceCents / 100).toFixed(2);
            return (
              <div key={q.id} className="space-y-1.5 p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <div className="min-w-0">
                    <span className="font-mono text-sm text-text-primary tabular-nums">
                      ${q.transaction.amount.toFixed(2)}
                    </span>
                    <span className="ml-2 text-sm text-text-primary">{q.transaction.name}</span>
                    <span className="ml-2 text-xs text-text-muted">
                      {day(q.transaction.date)}{q.transaction.pending ? ' · pending' : ''}
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-text-secondary">
                    {q.confidence != null ? `${Math.round(q.confidence * 100)}% match` : 'unscored'}
                  </span>
                </div>
                <div className="text-xs text-text-secondary">
                  ↔ {resLabel} · {q.reservation.currency} {resPrice} · booked {day(q.reservation.createdAt)}
                  {q.reservation.checkinDate ? ` · stay ${day(q.reservation.checkinDate)}–${day(q.reservation.checkoutDate)}` : ''}
                </div>
                {/* The full matcher rationale — always visible (CPA bar). */}
                <p className="font-mono text-[10px] leading-relaxed text-text-muted">
                  {q.rationale ?? 'no rationale recorded'}
                </p>
                <div className="flex gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => review(q.id, 'accept')}
                    disabled={busyLink === q.id}
                    className="rounded bg-brand-green px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => review(q.id, 'reject')}
                    disabled={busyLink === q.id}
                    className="rounded border border-border px-3 py-1 text-xs font-medium text-text-secondary disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
