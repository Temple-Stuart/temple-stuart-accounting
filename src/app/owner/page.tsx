'use client';

/**
 * OWNER-DASH: /owner — the owner's cockpit. The Accounts panel.
 * CRM-01b (Alex, 2026-11-07, ruling C): the Proposals panel retired — the CRM owns the stage and the next step, one
 * truth (/crm, src/app/api/crm/contacts/route.ts); the two /api/owner/proposals routes are deleted with it.
 *
 * Auth is the audit's ruled two-half pattern:
 *   - SERVER TRUTH: every /api/owner/* route opens with requireAdmin
 *     (require-admin.ts:8-20 — OWNER_EMAIL vs the verified cookie email; the
 *     18-route precedent). A client bug can never leak data.
 *   - CLIENT COURTESY: NEXT_PUBLIC_OWNER_EMAIL vs the email returned by
 *     GET /api/auth/me (api/auth/me/route.ts:7 — the signed userEmail
 *     cookie verified server-side, 401 without it). That is the app's
 *     canonical client identity read (AppLayout.tsx:95-112,
 *     HomeClient.tsx:69-83); the NextAuth session hook is NOT — a password
 *     login mints only the cookie (api/auth/login/route.ts:56-62), so that
 *     session is empty and the gate could never pass. A non-owner gets a
 *     plain 404-style card and NO data fetch ever fires (the defensive-404
 *     posture: don't confirm what exists).
 *
 * /owner is deliberately NOT in middleware PUBLIC_PATHS — the login wall
 * stands in front of both gates.
 */

import { useEffect, useMemo, useState } from 'react';
import { DATA, SECTION_HEADER, STATE, SURFACE, chip } from '@/lib/ds';

interface AccountRow {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  bookkeeping_initialized: boolean;
  scanner_start_date: string | null;
  accountCode: string | null;
  hasStripe: boolean;
  counts: { plaid_items: number; trade_cards: number; trips: number; reservations: number };
  entitlements: Array<{ categoryKey: string; status: string; currentPeriodEnd: string | null }>;
}

const dateOnly = (iso: string) => new Date(iso).toISOString().slice(0, 10);

export default function OwnerPage() {
  // R1: identity from the cookie-auth read the rest of the app uses
  // (/api/auth/me), not from the NextAuth session — see the docblock above.
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [identityLoading, setIdentityLoading] = useState(true);
  const ownerEmail = process.env.NEXT_PUBLIC_OWNER_EMAIL;
  const isOwner = !!ownerEmail && userEmail?.toLowerCase() === ownerEmail.toLowerCase();

  // Fail-closed, NOT a fallback: any non-200 or network error leaves the email
  // null, so the gate denies and the 404 card renders. There is no alternate
  // identity path and no degraded mode — the failure is logged, never swallowed.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (!res.ok) {
          console.error(`[owner] identity read failed (${res.status})`);
          if (!cancelled) setUserEmail(null);
          return;
        }
        const data = await res.json();
        if (!cancelled) setUserEmail(data?.user?.email ?? null);
      } catch (err) {
        console.error('[owner] identity read failed (network error)', err);
        if (!cancelled) setUserEmail(null);
      } finally {
        if (!cancelled) setIdentityLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const [accounts, setAccounts] = useState<AccountRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Presentation state only (client-side sort — the envelope's ruling).
  const [sortKey, setSortKey] = useState<'joined' | 'email'>('joined');
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    // The gate: no fetch fires unless the client courtesy check passes.
    if (!isOwner) return;
    (async () => {
      try {
        const accountsRes = await fetch('/api/owner/accounts', { credentials: 'include' });
        if (!accountsRes.ok) throw new Error(`Accounts load failed (${accountsRes.status})`);
        setAccounts(await accountsRes.json());
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Load failed');
      }
    })();
  }, [isOwner]);

  const sortedAccounts = useMemo(() => {
    if (!accounts) return null;
    const list = [...accounts];
    list.sort((a, b) => {
      const cmp =
        sortKey === 'email'
          ? a.email.localeCompare(b.email)
          : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [accounts, sortKey, sortAsc]);

  const toggleSort = (key: 'joined' | 'email') => {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(key === 'email');
    }
  };

  if (identityLoading) {
    return (
      <div className={`min-h-screen ${SURFACE.page}`}>
        <div className={STATE.loading}>Loading…</div>
      </div>
    );
  }

  if (!isOwner) {
    // The defensive-404 card — same posture as cross-user API reads: don't
    // confirm what lives here. No data fetch has fired.
    return (
      <div className={`min-h-screen ${SURFACE.page} flex items-center justify-center px-4`}>
        <div className={`${SURFACE.card} p-8 text-center`}>
          <div className="font-mono text-2xl text-text-primary">404</div>
          <p className="mt-2 text-xs text-text-faint">This page could not be found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${SURFACE.page} px-4 py-8 lg:px-8`}>
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        {loadError && <div className={STATE.errorCard}>{loadError}</div>}

        {/* ── ACCOUNTS ── */}
        <section className={`${SURFACE.card} overflow-hidden`}>
          <div className={SECTION_HEADER}>
            <span>Accounts ({accounts ? accounts.length : '…'} &amp; counting)</span>
          </div>
          {!accounts && !loadError ? (
            <div className={STATE.loading}>Loading…</div>
          ) : accounts && accounts.length === 0 ? (
            <div className={STATE.empty}>No accounts.</div>
          ) : accounts ? (
            <div className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-text-muted">{accounts.length} accounts</span>
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left">
                      <th className="p-2">
                        <button type="button" onClick={() => toggleSort('email')} className={DATA.columnHeader}>
                          email{sortKey === 'email' ? (sortAsc ? ' ↑' : ' ↓') : ''}
                        </button>
                      </th>
                      <th className={`${DATA.columnHeader} p-2`}>name</th>
                      <th className="p-2">
                        <button type="button" onClick={() => toggleSort('joined')} className={DATA.columnHeader}>
                          joined{sortKey === 'joined' ? (sortAsc ? ' ↑' : ' ↓') : ''}
                        </button>
                      </th>
                      <th className={`${DATA.columnHeader} p-2`}>books</th>
                      <th className={`${DATA.columnHeader} p-2 text-right`}>plaid</th>
                      <th className={`${DATA.columnHeader} p-2 text-right`}>cards</th>
                      <th className={`${DATA.columnHeader} p-2 text-right`}>trips</th>
                      <th className={`${DATA.columnHeader} p-2 text-right`}>reservations</th>
                      <th className={`${DATA.columnHeader} p-2`}>entitlements</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(sortedAccounts ?? []).map((u) => (
                      <tr key={u.id} className="border-t border-border align-top">
                        <td className="p-2 text-text-primary">{u.email}</td>
                        <td className="p-2 text-text-muted">{u.name}</td>
                        <td className="p-2 font-mono text-text-muted">{dateOnly(u.createdAt)}</td>
                        <td className="p-2 text-text-muted">{u.bookkeeping_initialized ? '✓' : '—'}</td>
                        <td className={`${DATA.numeral} p-2 text-text-secondary`}>{u.counts.plaid_items}</td>
                        <td className={`${DATA.numeral} p-2 text-text-secondary`}>{u.counts.trade_cards}</td>
                        <td className={`${DATA.numeral} p-2 text-text-secondary`}>{u.counts.trips}</td>
                        <td className={`${DATA.numeral} p-2 text-text-secondary`}>{u.counts.reservations}</td>
                        <td className="p-2">
                          <div className="flex flex-wrap gap-1">
                            {u.entitlements.map((e) => (
                              <span
                                key={e.categoryKey}
                                className={chip(e.status === 'active' ? 'success' : 'neutral')}
                              >
                                {e.categoryKey}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
