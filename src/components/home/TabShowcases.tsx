'use client';

/**
 * TAB-SHOW-AND-GATE: the SHOW surfaces for the four paid tabs (Trade, Books,
 * Tax, Compliance) + the shared per-tab locked CTA.
 *
 * SHOW discipline (mirrors OperationsPipelineShowroom): every panel renders
 * STATIC seed data — zero fetches, zero paid calls, nothing personal — and is
 * labeled EXAMPLE DATA so a demo can never read as a live number. The demo
 * entities are fictional (Maria's food truck — the same persona the Projects/
 * Content showroom uses — and fictional tickers).
 *
 * LOCK discipline (mirrors Travel's LockedCategoryCard): "Subscribe to unlock"
 * POSTs /api/stripe/checkout-entitlement with this tab's key; the signature-
 * verified webhook writes the entitlement row. Logged-out → the sign-up modal
 * first. Fail-loud checkout errors. FALLBACK TRIPWIRE: nothing here unlocks
 * anything — the gate lives in ModuleLauncher via isTabLocked, and these
 * surfaces render ONLY for locked viewers.
 */

import { useState } from 'react';
import { Lock } from 'lucide-react';

// ── shared chrome ────────────────────────────────────────────────────────────

function DemoTag() {
  return (
    <span className="inline-block rounded border border-brand-amber/40 bg-brand-amber/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-amber">
      Example data
    </span>
  );
}

function ShowcaseHeader({ title, line }: { title: string; line: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <h3 className="text-lg font-bold text-brand-purple">{title}</h3>
      <DemoTag />
      <p className="w-full text-sm text-text-muted">{line}</p>
    </div>
  );
}

/** The per-tab locked CTA — Travel's LockedCategoryCard pattern, keyed tab:X. */
export function LockedTabCard({
  tabKey,
  label,
  valueLine,
  currentUserId,
  onRequireAuth,
}: {
  tabKey: string;
  label: string;
  valueLine: string;
  currentUserId: string;
  onRequireAuth: () => void;
}) {
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  const onRequestUnlock = async () => {
    if (!currentUserId) {
      onRequireAuth(); // logged out → create an account first (checkout is auth-gated)
      return;
    }
    setError('');
    setStarting(true);
    try {
      const res = await fetch('/api/stripe/checkout-entitlement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: tabKey }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        throw new Error(data.error || 'Could not start checkout');
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start checkout');
      setStarting(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-brand-purple/15 bg-bg-row px-6 py-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-purple/10 text-brand-purple">
        <Lock className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <p className="text-base font-bold text-text-primary">{label} — built and running</p>
        <p className="text-sm text-text-muted">{valueLine}</p>
      </div>
      <button
        type="button"
        onClick={onRequestUnlock}
        disabled={starting}
        className="rounded-lg bg-brand-purple px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-purple/90 disabled:opacity-60"
      >
        {starting ? 'Starting checkout…' : `Subscribe to unlock ${label}`}
      </button>
      {error && <p className="text-sm text-brand-red">{error}</p>}
    </div>
  );
}

interface ShowcaseProps {
  currentUserId: string;
  onRequireAuth: () => void;
}

// ── TRADE ────────────────────────────────────────────────────────────────────

const DEMO_SCAN_ROWS = [
  { t: 'ACME', ve: 72, q: 61, r: 58, ie: 66, comp: 65, strat: 'Iron Condor · 45 DTE' },
  { t: 'GLOBEX', ve: 58, q: 45, r: 58, ie: 52, comp: 54, strat: 'Short Put Spread · 45 DTE' },
  { t: 'INITECH', ve: 41, q: 68, r: 58, ie: 38, comp: null, strat: 'NO TRADE — 1/4 gates above 50' },
];

export function TradeShowcase({ currentUserId, onRequireAuth }: ShowcaseProps) {
  return (
    <div className="space-y-5">
      <ShowcaseHeader
        title="The scanner, end to end"
        line="Live prices from TastyTrade, company numbers from Finnhub, macro from FRED, filings from SEC EDGAR, the mood from Grok — scored through four gates into a suggested trade. Below is what a finished scan looks like, on example tickers."
      />
      <div className="overflow-x-auto rounded-lg border border-border bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-text-muted">
              <th className="px-3 py-2 font-medium">Ticker</th>
              <th className="px-3 py-2 font-medium text-right">Vol edge</th>
              <th className="px-3 py-2 font-medium text-right">Quality</th>
              <th className="px-3 py-2 font-medium text-right">Regime</th>
              <th className="px-3 py-2 font-medium text-right">Info edge</th>
              <th className="px-3 py-2 font-medium text-right">Composite</th>
              <th className="px-3 py-2 font-medium">Suggestion</th>
            </tr>
          </thead>
          <tbody>
            {DEMO_SCAN_ROWS.map((r) => (
              <tr key={r.t} className="border-b border-border-light last:border-0">
                <td className="px-3 py-2 font-mono font-semibold text-text-primary">{r.t}</td>
                <td className="px-3 py-2 text-right">{r.ve}</td>
                <td className="px-3 py-2 text-right">{r.q}</td>
                <td className="px-3 py-2 text-right">{r.r}</td>
                <td className="px-3 py-2 text-right">{r.ie}</td>
                <td className="px-3 py-2 text-right font-semibold">{r.comp ?? '—'}</td>
                <td className="px-3 py-2 text-xs text-text-secondary">{r.strat}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-3 sm:grid-cols-3 text-xs text-text-secondary">
        <div className="rounded-lg border border-border bg-white p-3">
          <p className="font-semibold text-text-primary">Honest by construction</p>
          <p className="mt-1">Every score declares its inputs — &quot;computed from 14/16 signals&quot; — and missing data is excluded, never faked.</p>
        </div>
        <div className="rounded-lg border border-border bg-white p-3">
          <p className="font-semibold text-text-primary">The survival brake</p>
          <p className="mt-1">Backwardation or elevated VVIX cuts short-vol suggestions automatically — declared on every card, e.g. <span className="font-mono">REGIME BRAKE: OFF</span>.</p>
        </div>
        <div className="rounded-lg border border-border bg-white p-3">
          <p className="font-semibold text-text-primary">Graded against reality</p>
          <p className="mt-1">Every scan is snapshotted and later scored against what actually happened — a public, self-graded track record.</p>
        </div>
      </div>
      <p className="text-xs text-text-faint">Data, not directives — analytics you act on independently. Example tickers; nothing above is a live price or a recommendation.</p>
      <LockedTabCard
        tabKey="tab:trade"
        label="Trading"
        valueLine="Run live scans on real market data, with the reconcile queue and the self-graded record."
        currentUserId={currentUserId}
        onRequireAuth={onRequireAuth}
      />
    </div>
  );
}

// ── BOOKS ────────────────────────────────────────────────────────────────────

const DEMO_JOURNAL = [
  { d: 'Jun 03', memo: 'Coffee beans — Riverside Roasters', dr: '5010 Supplies', cr: '1010 Cash', amt: '$84.12' },
  { d: 'Jun 05', memo: 'Farmers market sales', dr: '1010 Cash', cr: '4010 Sales', amt: '$412.00' },
  { d: 'Jun 09', memo: 'Truck fuel', dr: '5040 Vehicle', cr: '2010 Card', amt: '$61.35' },
];

export function BooksShowcase({ currentUserId, onRequireAuth }: ShowcaseProps) {
  return (
    <div className="space-y-5">
      <ShowcaseHeader
        title="Double-entry books, from bank feed to closed period"
        line="Connect your bank through Plaid and every transaction flows in, gets categorized, and lands as a real journal entry — through to a trial balance that must balance, statements, and a period close. Below: Maria's food-truck books, as an example."
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[['Assets', '$12,400'], ['Liabilities', '$3,100'], ['Equity', '$9,300'], ['Trial balance', 'BALANCED ✓']].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-border bg-white p-3">
            <p className="text-[10px] uppercase tracking-wider text-text-muted">{k}</p>
            <p className={`text-base font-bold ${v === 'BALANCED ✓' ? 'text-brand-green' : 'text-text-primary'}`}>{v}</p>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto rounded-lg border border-border bg-white">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-text-muted">
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Memo</th>
              <th className="px-3 py-2 font-medium">Debit</th>
              <th className="px-3 py-2 font-medium">Credit</th>
              <th className="px-3 py-2 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {DEMO_JOURNAL.map((j) => (
              <tr key={j.memo} className="border-b border-border-light last:border-0">
                <td className="px-3 py-2 text-text-muted">{j.d}</td>
                <td className="px-3 py-2 text-text-primary">{j.memo}</td>
                <td className="px-3 py-2 font-mono text-xs">{j.dr}</td>
                <td className="px-3 py-2 font-mono text-xs">{j.cr}</td>
                <td className="px-3 py-2 text-right">{j.amt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-text-secondary">
        The full pipe: import → categorize → journal → ledger → trial balance → reconcile → adjusting entries → statements → period close → year-end → CPA export.
      </p>
      <LockedTabCard
        tabKey="tab:books"
        label="Bookkeeping"
        valueLine="Your real accounts, synced and closed month after month — GAAP double-entry, not a spreadsheet."
        currentUserId={currentUserId}
        onRequireAuth={onRequireAuth}
      />
    </div>
  );
}

// ── TAX ──────────────────────────────────────────────────────────────────────

export function TaxShowcase({ currentUserId, onRequireAuth }: ShowcaseProps) {
  return (
    <div className="space-y-5">
      <ShowcaseHeader
        title="Taxes that start from closed books"
        line="Because the books are already clean, the tax estimate is derived — not re-typed. Below: an example year for Maria's food truck."
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Schedule C net profit', '$23,400'],
          ['Self-employment tax', '$3,306'],
          ['Estimated federal tax', '$5,120'],
          ['Form 8949 lots', '12 exported'],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-border bg-white p-3">
            <p className="text-[10px] uppercase tracking-wider text-text-muted">{k}</p>
            <p className="text-base font-bold text-text-primary">{v}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-text-secondary">
        The pipe: closed period → account-to-tax-line mapping → Form 1040 estimate with Schedule C/D/SE → wash-sale detection → Form 8949 + CPA export package (PDF).
      </p>
      <p className="text-xs text-text-faint">
        Estimates for informational purposes only — verified by a qualified tax professional before filing, always. Example numbers above.
      </p>
      <LockedTabCard
        tabKey="tab:tax"
        label="Tax"
        valueLine="Your 1040 estimate and schedules, derived from your actual closed books — plus the CPA-ready export."
        currentUserId={currentUserId}
        onRequireAuth={onRequireAuth}
      />
    </div>
  );
}

// ── COMPLIANCE ───────────────────────────────────────────────────────────────

export function ComplianceShowcase({ currentUserId, onRequireAuth }: ShowcaseProps) {
  return (
    <div className="space-y-5">
      <ShowcaseHeader
        title="A regulatory workbench with receipts"
        line="Real regulation text (eCFR, US Code, Federal Register, IRS) ingested and searchable, citations verified and pinned, and every action in a tamper-evident audit chain. Below: what a verified citation and an audit row look like."
      />
      <div className="rounded-lg border border-border bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-semibold text-text-primary">26 U.S.C. §162(a)</span>
          <span className="rounded-full bg-brand-green/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-brand-green">Verified</span>
        </div>
        <p className="mt-1 text-sm text-text-secondary">
          &quot;There shall be allowed as a deduction all the ordinary and necessary expenses paid or incurred during the taxable year in carrying on any trade or business…&quot;
        </p>
        <p className="mt-2 text-[11px] text-text-muted">Pinned to the ingested US Code corpus · re-verified on ingest updates (example row)</p>
      </div>
      <div className="rounded-lg border border-border bg-white p-4">
        <p className="font-mono text-xs text-text-secondary">
          audit_log #4812 · permission_granted · hash-chained to #4811 · actor: stripe-webhook (example row)
        </p>
        <p className="mt-1 text-[11px] text-text-muted">Every grant, edit, and attestation lands in a hash-linked chain — tampering breaks the chain visibly.</p>
      </div>
      <p className="text-xs text-text-secondary">
        Sections A–J: identity → registry → citations → discovery → missions → tasks → attestations → evidence → audit chain → SOC 2 view.
      </p>
      <LockedTabCard
        tabKey="tab:compliance"
        label="Compliance"
        valueLine="The live workbench: corpus search, citation verification, missions, and the audit registry."
        currentUserId={currentUserId}
        onRequireAuth={onRequireAuth}
      />
    </div>
  );
}
