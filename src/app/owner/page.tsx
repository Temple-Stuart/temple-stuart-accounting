'use client';

/**
 * OWNER-DASH: /owner — the owner's cockpit. Accounts + Proposals panels.
 *
 * Auth is the audit's ruled two-half pattern:
 *   - SERVER TRUTH: every /api/owner/* route opens with requireAdmin
 *     (require-admin.ts:8-20 — OWNER_EMAIL vs the verified cookie email; the
 *     18-route precedent). A client bug can never leak data.
 *   - CLIENT COURTESY: the trading-page isOwner gate verbatim
 *     (trading/page.tsx:91-94 — NEXT_PUBLIC_OWNER_EMAIL vs the session
 *     email). A non-owner gets a plain 404-style card and NO data fetch
 *     ever fires (the defensive-404 posture: don't confirm what exists).
 *
 * /owner is deliberately NOT in middleware PUBLIC_PATHS — the login wall
 * stands in front of both gates.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
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
  // R1: the trading-page client gate, verbatim (trading/page.tsx:91-94).
  const { data: session, status: sessionStatus } = useSession();
  const userEmail = session?.user?.email || null;
  const ownerEmail = process.env.NEXT_PUBLIC_OWNER_EMAIL;
  const isOwner = !!ownerEmail && userEmail?.toLowerCase() === ownerEmail.toLowerCase();

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

  if (sessionStatus === 'loading') {
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
          <div className="font-mono text-2xl text-white/80">404</div>
          <p className="mt-2 text-xs text-white/50">This page could not be found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${SURFACE.page} px-4 py-8 lg:px-8`}>
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        {loadError && <div className={STATE.errorCard}>{loadError}</div>}

        {/* ── ACCOUNTS ── */}
        <section className={`${SURFACE.card} overflow-hidden text-white`}>
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
                <span className="font-mono text-xs text-white/60">{accounts.length} accounts</span>
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
                      <tr key={u.id} className="border-t border-panel-border align-top">
                        <td className="p-2 text-white/80">{u.email}</td>
                        <td className="p-2 text-white/60">{u.name}</td>
                        <td className="p-2 font-mono text-white/60">{dateOnly(u.createdAt)}</td>
                        <td className="p-2">
                          <span className={chip(u.tier === 'free' ? 'neutral' : 'accent')}>{u.tier}</span>
                        </td>
                        <td className="p-2 text-white/60">{u.bookkeeping_initialized ? '✓' : '—'}</td>
                        <td className={`${DATA.numeral} p-2 text-white/70`}>{u.counts.plaid_items}</td>
                        <td className={`${DATA.numeral} p-2 text-white/70`}>{u.counts.trade_cards}</td>
                        <td className={`${DATA.numeral} p-2 text-white/70`}>{u.counts.trips}</td>
                        <td className={`${DATA.numeral} p-2 text-white/70`}>{u.counts.reservations}</td>
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
        <section className={`${SURFACE.card} overflow-hidden text-white`}>
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
        className="cursor-pointer border-t border-panel-border transition-colors hover:bg-white/5"
        aria-expanded={expanded}
      >
        <td className="p-2 font-mono text-white/60">{dateOnly(p.createdAt)}</td>
        <td className="p-2 text-white/80">{p.name}</td>
        <td className="p-2 text-white/60">{p.email}</td>
        <td className="p-2">
          <span className={chip()}>{p.need}</span>
        </td>
        <td className="p-2 text-white/70">{p.budgetRange}</td>
        <td className="p-2 text-white/70">{p.startWindow}</td>
        <td className="p-2 text-white/60">{p.referralSource ?? '—'}</td>
        <td className="p-2">
          <span className={chip(statusVariant)}>{p.status}</span>
        </td>
      </tr>
      {expanded && (
        <tr className="border-t border-panel-border bg-white/5">
          <td colSpan={8} className="p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="business" value={p.business} />
              <Field label="current stack" value={p.currentStack} />
              <div>
                <div className={DATA.columnHeader}>modules</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {p.modules.length === 0 ? (
                    <span className="text-xs text-white/40">—</span>
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
                          className="text-xs text-brand-purple-pop hover:underline break-all"
                        >
                          {l}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-1 text-xs text-white/40">—</div>
                )}
              </div>
              <Field label="team size" value={p.teamSize ?? '—'} />
              <Field label="referral source" value={p.referralSource ?? '—'} />
              <Field label="last updated" value={dateOnly(p.updatedAt)} />
            </div>

            <div className="mt-4 border-t border-panel-border pt-4">
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
      <p className="mt-1 whitespace-pre-wrap break-words text-xs text-white/70">{value}</p>
    </div>
  );
}
