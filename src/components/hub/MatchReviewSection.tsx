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
 * Styling: the RunwayBudgetPanel idiom — themed(..., true) over the
 * light-token vocabulary (RunwayBudgetPanel.tsx:121-131), dark runway surface.
 */

import { useEffect, useState } from 'react';
import { themed } from '@/lib/ds';

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

export default function MatchReviewSection() {
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [proposing, setProposing] = useState(false);
  const [runSummary, setRunSummary] = useState('');
  const [busyLink, setBusyLink] = useState<string | null>(null);

  const loadQueue = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/runway/match/queue');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Queue failed (HTTP ${res.status})`);
      setQueue((data.queue || []) as QueueRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the match queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadQueue(); }, []);

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

  return (
    <div className={themed('mx-4 my-4 rounded-lg border border-border bg-bg-row/40 p-4', true)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className={themed('text-sm font-bold text-text-primary', true)}>Booking ↔ bank match review</h3>
          <p className={themed('text-xs text-text-muted', true)}>
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
        <p className={themed('mt-2 font-mono text-xs text-text-secondary', true)}>{runSummary}</p>
      )}
      {error && <p className="mt-2 text-sm text-brand-red">{error}</p>}

      {loading ? (
        <div className={themed('mt-3 h-10 animate-pulse rounded bg-bg-row', true)} aria-busy="true" />
      ) : queue.length === 0 ? (
        <p className={themed('mt-3 text-xs text-text-muted', true)}>
          No match proposals waiting. &ldquo;Find matches&rdquo; scans your bookings against bank transactions.
        </p>
      ) : (
        <div className={themed('mt-3 divide-y divide-border rounded border border-border', true)}>
          {queue.map((q) => {
            const resLabel = q.reservation.hotelName ?? `${q.reservation.provider} booking`;
            const resPrice = (q.reservation.finalPriceCents / 100).toFixed(2);
            return (
              <div key={q.id} className="space-y-1.5 p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <div className="min-w-0">
                    <span className={themed('font-mono text-sm text-text-primary tabular-nums', true)}>
                      ${q.transaction.amount.toFixed(2)}
                    </span>
                    <span className={themed('ml-2 text-sm text-text-primary', true)}>{q.transaction.name}</span>
                    <span className={themed('ml-2 text-xs text-text-muted', true)}>
                      {day(q.transaction.date)}{q.transaction.pending ? ' · pending' : ''}
                    </span>
                  </div>
                  <span className={themed('text-xs font-semibold text-text-secondary', true)}>
                    {q.confidence != null ? `${Math.round(q.confidence * 100)}% match` : 'unscored'}
                  </span>
                </div>
                <div className={themed('text-xs text-text-secondary', true)}>
                  ↔ {resLabel} · {q.reservation.currency} {resPrice} · booked {day(q.reservation.createdAt)}
                  {q.reservation.checkinDate ? ` · stay ${day(q.reservation.checkinDate)}–${day(q.reservation.checkoutDate)}` : ''}
                </div>
                {/* The full matcher rationale — always visible (CPA bar). */}
                <p className={themed('font-mono text-[10px] leading-relaxed text-text-muted', true)}>
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
                    className={themed('rounded border border-border px-3 py-1 text-xs font-medium text-text-secondary disabled:opacity-50', true)}
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
