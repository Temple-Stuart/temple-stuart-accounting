'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import CreateTripForm from '@/components/trips/CreateTripForm';
import ScanFilterForm from '@/components/trading/ScanFilterForm';
import type { ScannerFilters } from '@/lib/convergence/filter-types';
import { DEFAULT_FILTERS } from '@/lib/convergence/filter-types';

// HOME-PR-3: the home-page module launcher = SIX separate stacked module
// SectionCards (no toggle pills) — Travel (live, free, guest-ok) + Trading,
// Bookkeeping, Tax, Operations, Compliance (paid). Each is its own SectionCard
// (one purple band w/ module name + tag, white body). Travel renders the shared
// CreateTripForm (guest register-gated save); Trading renders the admin
// ScanFilterForm for admins, a stub otherwise; the rest are stubs. Reuses
// CreateTripForm + ScanFilterForm unchanged.

interface ModuleDef {
  key: string;
  label: string;
  live: boolean;
  /** One-line description shown under the module name in the stub body. */
  blurb: string;
}

// Order per HOME-PR-3: Travel, Trading, Bookkeeping, Tax, Operations, Compliance.
const MODULES: ModuleDef[] = [
  { key: 'travel',      label: 'Travel',      live: true,  blurb: 'AI trip & flight planning — free to use.' },
  { key: 'trading',     label: 'Trading',     live: false, blurb: 'AI vol scanner + options strategy builder.' },
  { key: 'bookkeeping', label: 'Bookkeeping', live: false, blurb: 'GAAP accounting engine, Plaid bank sync, period close.' },
  { key: 'tax',         label: 'Tax',         live: false, blurb: 'Form 1040, Schedule C/D/SE, Form 8949.' },
  { key: 'operations',  label: 'Operations',  live: false, blurb: 'Routines, daily plan, command center.' },
  { key: 'compliance',  label: 'Compliance',  live: false, blurb: 'Monitoring, attestations, audit trail.' },
];

interface Props {
  /** Opens the existing register/login modal on the home page. Called when a
   *  guest tries to save a trip, or clicks a paid module's "Launch" button. */
  onRequireAuth: () => void;
}

export default function ModuleLauncher({ onRequireAuth }: Props) {
  const router = useRouter();
  // Auth state: null = unknown (initial), true/false once /api/auth/me resolves.
  const [authed, setAuthed] = useState<boolean | null>(null);
  // TRADING-PR-2: admin status (server-computed via /api/auth/me isAdmin). The
  // Trading scan is admin-gated (requireAdmin), so only the admin sees the working
  // ScanFilterForm; everyone else keeps the paid stub.
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me')
      .then(async res => {
        if (cancelled) return;
        setAuthed(res.ok);
        if (res.ok) {
          const data = await res.json().catch(() => null);
          setIsAdmin(!!data?.user?.isAdmin);
        }
      })
      .catch(() => { if (!cancelled) setAuthed(false); });
    return () => { cancelled = true; };
  }, []);

  // TRADING-PR-2: launcher-owned scan filter state (mirrors the dashboard's lifted
  // state + the same localStorage 'scanner-filters' key the dashboard reads). The
  // home form can't host the full ConvergenceIntelligence results view, so its
  // Scan persists the filters and routes the admin to /trading (the full dashboard
  // runs the scan there). No half-wired scan.
  const [scannerFilters, setScannerFilters] = useState<ScannerFilters>(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('scanner-filters') : null;
      return saved ? JSON.parse(saved) : DEFAULT_FILTERS;
    } catch { return DEFAULT_FILTERS; }
  });
  const [scannerUniverse, setScannerUniverse] = useState('sp500');
  // The home Scan routes to the full dashboard, where the admin-gated scan runs.
  // Filters carry over via the shared localStorage 'scanner-filters' key, which
  // the dashboard reads on init (trading/page.tsx loads it into scannerFilters).
  const scanTriggerRef = useRef<(() => void) | null>(null);
  scanTriggerRef.current = () => router.push('/trading');

  const handleFiltersChange = (next: ScannerFilters) => {
    setScannerFilters(next);
    try { localStorage.setItem('scanner-filters', JSON.stringify(next)); } catch {}
  };

  // Travel register-gate: guests fill the form freely, but "Create trip" while
  // unauthenticated opens the register modal instead of POSTing. Returns true
  // ("handled — don't POST") for guests. POST /api/trips is unchanged.
  const gateGuestCreate = (): boolean => {
    if (authed === false) {
      onRequireAuth();
      return true;
    }
    return false; // authed (or unknown→optimistic): let CreateTripForm POST; a
                  // 401 there surfaces as its inline error (fail-loud).
  };

  // One module SectionCard: purple band (name + tag) + white body. Travel's form
  // and the admin Trading form render bandless inside (showHeader={false}) so each
  // card has exactly ONE purple band (the app design rule).
  const renderBody = (m: ModuleDef) => {
    if (m.key === 'travel') {
      return <CreateTripForm onUnauthenticated={gateGuestCreate} showHeader={false} />;
    }
    if (m.key === 'trading' && isAdmin) {
      // TRADING-PR-2/3: admin sees the working ScanFilterForm (Scan routes to
      // /trading, where the admin-gated scan runs). Non-admins fall to the stub.
      return (
        <ScanFilterForm
          scannerUniverse={scannerUniverse}
          setScannerUniverse={setScannerUniverse}
          scannerFilters={scannerFilters}
          onFiltersChange={handleFiltersChange}
          scanTriggerRef={scanTriggerRef}
          showHeader={false}
        />
      );
    }
    // Paid stub (Trading non-admin + Bookkeeping/Tax/Operations/Compliance).
    return (
      <div>
        <p className="text-sm text-text-primary mb-1">{m.label} — coming soon.</p>
        <p className="text-xs text-text-muted mb-4">{m.blurb} Requires an account.</p>
        <button
          type="button"
          onClick={onRequireAuth}
          className="px-6 py-2 bg-brand-gold hover:bg-brand-gold-bright text-white font-semibold text-sm rounded"
        >
          Launch {m.label} Module
        </button>
      </div>
    );
  };

  return (
    <section className="py-10 bg-bg-terminal">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 space-y-3">
        {MODULES.map(m => (
          <div key={m.key} className="rounded-lg overflow-hidden border border-gray-200/50 shadow-sm">
            <div className="bg-brand-purple/80 text-white px-4 py-2.5 text-sm font-semibold flex items-center justify-between">
              <span>{m.label}</span>
              <span className="text-[10px] uppercase tracking-wider font-normal text-white/80">
                {m.live ? 'Free · guest ok' : 'Paid'}
              </span>
            </div>
            <div className="bg-white p-4">
              {renderBody(m)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
