'use client';

/**
 * OWNER-DASH: /owner — the owner's cockpit. Accounts + Proposals panels.
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

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CONTROL,
  DATA,
  SECTION_HEADER,
  SEGMENT,
  STATE,
  SURFACE,
  chip,
  toggleChip,
  type ChipVariant,
} from '@/lib/ds';

interface AccountRow {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  tier: string;
  bookkeeping_initialized: boolean;
  scanner_start_date: string | null;
  accountCode: string | null;
  hasStripe: boolean;
  counts: { plaid_items: number; trade_cards: number; trips: number; reservations: number };
  entitlements: Array<{ categoryKey: string; status: string; currentPeriodEnd: string | null }>;
}

interface ProposalRow {
  id: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  email: string;
  business: string;
  currentStack: string;
  need: string;
  modules: string[];
  startWindow: string;
  budgetRange: string;
  notesFromThem: string;
  hardDeadline: string | null;
  deadlineDriver: string | null;
  links: string[] | null;
  teamSize: string | null;
  referralSource: string | null;
  status: string;
  ownerNotes: string | null;
}

const PROPOSAL_STATUSES = ['new', 'reviewing', 'sent', 'won', 'lost'] as const;
type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

// The ruled status → chip-variant map.
const STATUS_VARIANT: Record<ProposalStatus, ChipVariant> = {
  new: 'info',
  reviewing: 'warning',
  sent: 'accent',
  won: 'success',
  lost: 'danger',
};

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
  const [proposals, setProposals] = useState<ProposalRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Presentation state only (client-side sort — the envelope's ruling).
  const [sortKey, setSortKey] = useState<'joined' | 'email'>('joined');
  const [sortAsc, setSortAsc] = useState(false);

  const [statusFilter, setStatusFilter] = useState<'all' | ProposalStatus>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<ProposalStatus>('new');
  const [draftNotes, setDraftNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const loadProposals = useCallback(async () => {
    const res = await fetch('/api/owner/proposals', { credentials: 'include' });
    if (!res.ok) throw new Error(`Proposals load failed (${res.status})`);
    setProposals(await res.json());
  }, []);

  useEffect(() => {
    // The gate: no fetch fires unless the client courtesy check passes.
    if (!isOwner) return;
    (async () => {
      try {
        const [accountsRes] = await Promise.all([
          fetch('/api/owner/accounts', { credentials: 'include' }),
          loadProposals(),
        ]);
        if (!accountsRes.ok) throw new Error(`Accounts load failed (${accountsRes.status})`);
        setAccounts(await accountsRes.json());
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Load failed');
      }
    })();
  }, [isOwner, loadProposals]);

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

  const tierCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of accounts ?? []) m.set(a.tier, (m.get(a.tier) ?? 0) + 1);
    return [...m.entries()].sort((x, y) => y[1] - x[1]);
  }, [accounts]);

  const visibleProposals = useMemo(
    () => (proposals ?? []).filter((p) => statusFilter === 'all' || p.status === statusFilter),
    [proposals, statusFilter],
  );

  const toggleSort = (key: 'joined' | 'email') => {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(key === 'email');
    }
  };

  const expandRow = (p: ProposalRow) => {
    if (expandedId === p.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(p.id);
    setDraftStatus((PROPOSAL_STATUSES as readonly string[]).includes(p.status) ? (p.status as ProposalStatus) : 'new');
    setDraftNotes(p.ownerNotes ?? '');
    setSaveError(null);
  };

  const saveTriage = async (id: string) => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/owner/proposals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: draftStatus, ownerNotes: draftNotes }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `Save failed (${res.status})`);
      }
      // Optimistic off BY RULING — refetch on success.
      await loadProposals();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
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
                {tierCounts.map(([tier, n]) => (
                  <span key={tier} className={chip(tier === 'free' ? 'neutral' : 'accent')}>
                    {tier} × {n}
                  </span>
                ))}
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
                      <th className={`${DATA.columnHeader} p-2`}>tier</th>
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
                        <td className="p-2">
                          <span className={chip(u.tier === 'free' ? 'neutral' : 'accent')}>{u.tier}</span>
                        </td>
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

        {/* ── PROPOSALS ── */}
        <section className={`${SURFACE.card} overflow-hidden`}>
          <div className={SECTION_HEADER}>
            <span>Proposals</span>
          </div>
          {!proposals && !loadError ? (
            <div className={STATE.loading}>Loading…</div>
          ) : proposals && proposals.length === 0 ? (
            <div className={STATE.empty}>No proposals yet — the form is live at /work-with-me.</div>
          ) : proposals ? (
            <div className="p-4">
              <div className="flex flex-wrap gap-1.5">
                {(['all', ...PROPOSAL_STATUSES] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatusFilter(s)}
                    className={toggleChip(statusFilter === s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
              {visibleProposals.length === 0 ? (
                <div className={STATE.empty}>No proposals with this status.</div>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left">
                        <th className={`${DATA.columnHeader} p-2`}>received</th>
                        <th className={`${DATA.columnHeader} p-2`}>name</th>
                        <th className={`${DATA.columnHeader} p-2`}>email</th>
                        <th className={`${DATA.columnHeader} p-2`}>need</th>
                        <th className={`${DATA.columnHeader} p-2`}>budget</th>
                        <th className={`${DATA.columnHeader} p-2`}>start</th>
                        <th className={`${DATA.columnHeader} p-2`}>referral</th>
                        <th className={`${DATA.columnHeader} p-2`}>status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleProposals.map((p) => (
                        <FragmentRow
                          key={p.id}
                          p={p}
                          expanded={expandedId === p.id}
                          onToggle={() => expandRow(p)}
                          draftStatus={draftStatus}
                          setDraftStatus={setDraftStatus}
                          draftNotes={draftNotes}
                          setDraftNotes={setDraftNotes}
                          saving={saving}
                          saveError={saveError}
                          onSave={() => saveTriage(p.id)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function FragmentRow({
  p,
  expanded,
  onToggle,
  draftStatus,
  setDraftStatus,
  draftNotes,
  setDraftNotes,
  saving,
  saveError,
  onSave,
}: {
  p: ProposalRow;
  expanded: boolean;
  onToggle: () => void;
  draftStatus: ProposalStatus;
  setDraftStatus: (s: ProposalStatus) => void;
  draftNotes: string;
  setDraftNotes: (s: string) => void;
  saving: boolean;
  saveError: string | null;
  onSave: () => void;
}) {
  const statusVariant: ChipVariant =
    (STATUS_VARIANT as Record<string, ChipVariant>)[p.status] ?? 'neutral';
  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer border-t border-border transition-colors hover:bg-bg-row"
        aria-expanded={expanded}
      >
        <td className="p-2 font-mono text-text-muted">{dateOnly(p.createdAt)}</td>
        <td className="p-2 text-text-primary">{p.name}</td>
        <td className="p-2 text-text-muted">{p.email}</td>
        <td className="p-2">
          <span className={chip()}>{p.need}</span>
        </td>
        <td className="p-2 text-text-secondary">{p.budgetRange}</td>
        <td className="p-2 text-text-secondary">{p.startWindow}</td>
        <td className="p-2 text-text-muted">{p.referralSource ?? '—'}</td>
        <td className="p-2">
          <span className={chip(statusVariant)}>{p.status}</span>
        </td>
      </tr>
      {expanded && (
        <tr className="border-t border-border bg-bg-row">
          <td colSpan={8} className="p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="business" value={p.business} />
              <Field label="current stack" value={p.currentStack} />
              <div>
                <div className={DATA.columnHeader}>modules</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {p.modules.length === 0 ? (
                    <span className="text-xs text-text-faint">—</span>
                  ) : (
                    p.modules.map((m) => (
                      <span key={m} className={chip()}>
                        {m}
                      </span>
                    ))
                  )}
                </div>
              </div>
              <Field label="anything else" value={p.notesFromThem || '—'} />
              <Field
                label="hard deadline"
                value={p.hardDeadline ? dateOnly(p.hardDeadline) : '—'}
              />
              <Field label="deadline driver" value={p.deadlineDriver ?? '—'} />
              <div>
                <div className={DATA.columnHeader}>links</div>
                {p.links && p.links.length > 0 ? (
                  <ul className="mt-1 space-y-0.5">
                    {p.links.map((l) => (
                      <li key={l}>
                        <a
                          href={l}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-brand-purple hover:underline break-all"
                        >
                          {l}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-1 text-xs text-text-faint">—</div>
                )}
              </div>
              <Field label="team size" value={p.teamSize ?? '—'} />
              <Field label="referral source" value={p.referralSource ?? '—'} />
              <Field label="last updated" value={dateOnly(p.updatedAt)} />
            </div>

            <div className="mt-4 border-t border-border pt-4">
              <div className={DATA.columnHeader}>status</div>
              <div className={`${SEGMENT.wrap} mt-1`}>
                {PROPOSAL_STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setDraftStatus(s)}
                    className={SEGMENT.item(draftStatus === s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div className="mt-3">
                <label htmlFor={`notes-${p.id}`} className={DATA.columnHeader}>
                  owner notes
                </label>
                <textarea
                  id={`notes-${p.id}`}
                  maxLength={5000}
                  value={draftNotes}
                  onChange={(e) => setDraftNotes(e.target.value)}
                  className={`${CONTROL.input} mt-1 min-h-[72px] w-full resize-y`}
                />
              </div>
              {saveError && <div className={`${STATE.errorCard} mt-3`}>{saveError}</div>}
              <button
                type="button"
                onClick={onSave}
                disabled={saving}
                className={`${CONTROL.primaryButton} mt-3`}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className={DATA.columnHeader}>{label}</div>
      <p className="mt-1 whitespace-pre-wrap break-words text-xs text-text-secondary">{value}</p>
    </div>
  );
}
