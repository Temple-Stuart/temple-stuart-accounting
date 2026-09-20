'use client';

/**
 * TRADE-SPLIT — BROKERAGE (registry tool 17) — its own page, its own pipe.
 *
 * TOOL-LAW-01 rules one tool, one page. /trading was the last grandfathered
 * exception: Brokerage (17) and Trade Log (18) shared it. THE SORT already drew
 * the line (src/lib/nav.ts THE_SORT) — trade 01 SETUP, 02 SCAN, 03 REVIEW are
 * Brokerage's; 04 LAB, 05 RECORD, 06 COMMIT are Trade Log's, now on /trade-log.
 *
 * Everything here MOVED WHOLE from src/app/trading/page.tsx — the scan form
 * (:800-808), the Market Intelligence block (:901-923) and the Data Observatory
 * (:1069-1074), with the identity read (:110-132), the TastyTrade connection
 * status effect (:253-262) and fetchTtData (:299-327) that gate them. Nothing
 * is rewritten.
 *
 * The strip is this tool's OWN three phases (PIPE_PHASES.trade 01-03) through
 * the shared StageStrip. 01-03 are one continuous surface — the ratified
 * cockpit idiom (ModuleLauncher.tsx:1058-1061 renders setup/scan/review as one
 * block with a phase label), not a new invention.
 *
 * TT-01 is UNCHANGED: the scanner is the founder's broker only. isOwner gates
 * the block exactly as it did on /trading (:902), and everyone else reads the
 * one stated line (src/lib/tastytrade/founderBroker.ts FOUNDER_BROKER_LINE) —
 * on the scan form as before, and now on the SCAN phase itself so the phase is
 * never silently empty.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { AppLayout } from '@/components/ui';
// LOCK-01: this page renders a paid module — it asks the tab's own question first.
import RoomLock, { useTabLock } from '@/components/shell/RoomLock';
import ToolOpener from '@/components/shell/ToolOpener';
import { navToolsOfScreen } from '@/lib/nav';
import { TOOL_GATE } from '@/lib/offer';
import ConvergenceIntelligence from '@/components/convergence/ConvergenceIntelligence';
import DataObservatory from '@/components/data-observatory/DataObservatory';
import type { ScannerFilters } from '@/lib/convergence/filter-types';
import { DEFAULT_FILTERS } from '@/lib/convergence/filter-types';
import ScanFilterForm from '@/components/trading/ScanFilterForm';
import StageStrip, { type StagePhase } from '@/components/ui/StageStrip';
import { PIPE_PHASES } from '@/lib/pipePhases';
import { FOUNDER_BROKER_LINE } from '@/lib/tastytrade/founderBroker';
import { STATE } from '@/lib/ds';

// This tool's three phases, read from the shared pipe — never a retyped list.
const [PIPE_SETUP, PIPE_SCAN, PIPE_REVIEW] = PIPE_PHASES.trade;

type BrokeragePhase = 'setup' | 'scan' | 'review';

export default function BrokeragePage() {
  // LOCK-01: the same check the tab makes (isTabLocked over /api/auth/me).
  const roomLock = useTabLock('tab:trade');
  // Identity from the cookie-auth read the rest of the app uses (/api/auth/me),
  // not from the NextAuth session — a password login mints only the signed
  // userEmail cookie (api/auth/login/route.ts:56-62), so that session is empty
  // and this gate could never pass. Ported verbatim from owner/page.tsx:87-120.
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [identityLoading, setIdentityLoading] = useState(true);
  const ownerEmail = process.env.NEXT_PUBLIC_OWNER_EMAIL;
  const isOwner = !!ownerEmail && userEmail?.toLowerCase() === ownerEmail.toLowerCase();

  // Fail-closed, NOT a fallback: any non-200 or network error leaves the email
  // null, so the gate denies and the owner-only sections stay unmounted. There
  // is no alternate identity path and no degraded mode — the failure is logged,
  // never swallowed.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (!res.ok) {
          console.error(`[brokerage] identity read failed (${res.status})`);
          if (!cancelled) setUserEmail(null);
          return;
        }
        const data = await res.json();
        if (!cancelled) setUserEmail(data?.user?.email ?? null);
      } catch (err) {
        console.error('[brokerage] identity read failed (network error)', err);
        if (!cancelled) setUserEmail(null);
      } finally {
        if (!cancelled) setIdentityLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // The phase this tool's strip has selected. 01-03 are one surface (the
  // cockpit idiom) — the selection names the phase, it does not hide the work.
  const [phase, setPhase] = useState<BrokeragePhase>('setup');

  // Lifted scanner filter state (shared between search bar and ConvergenceIntelligence)
  const [scannerFilters, setScannerFilters] = useState<ScannerFilters>(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('scanner-filters') : null;
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_FILTERS;
  });
  const [scannerUniverse, setScannerUniverse] = useState('sp500');
  const scanTriggerRef = useRef<(() => void) | null>(null);
  const scanningRef = useRef<boolean>(false);

  const handleFiltersChange = useCallback((next: ScannerFilters) => {
    setScannerFilters(next);
    try { localStorage.setItem('scanner-filters', JSON.stringify(next)); } catch {}
  }, []);

  // Tastytrade connection state
  const [ttConnected, setTtConnected] = useState<boolean | null>(null);
  const [ttAccounts, setTtAccounts] = useState<string[]>([]);

  // Tastytrade live data state
  const [ttPositions, setTtPositions] = useState<any[]>([]);
  const [ttBalances, setTtBalances] = useState<any[]>([]);
  const [ttLoading, setTtLoading] = useState(false);
  const [ttDataError, setTtDataError] = useState<string | null>(null);

  // Check Tastytrade connection status on load
  useEffect(() => {
    if (!isOwner) return;
    fetch('/api/tastytrade/status')
      .then(res => res.json())
      .then(data => {
        setTtConnected(data.connected || false);
        setTtAccounts(data.accountNumbers || []);
      })
      .catch(() => setTtConnected(false));
  }, [isOwner]);

  const fetchTtData = async () => {
    setTtLoading(true);
    setTtDataError(null);
    try {
      const [posRes, balRes] = await Promise.all([
        fetch('/api/tastytrade/positions'),
        fetch('/api/tastytrade/balances'),
      ]);
      if (posRes.status === 401 || balRes.status === 401) {
        setTtDataError('Session expired — please reconnect');
        setTtConnected(false);
        return;
      }
      const [posData, balData] = await Promise.all([posRes.json(), balRes.json()]);
      setTtPositions(posData.positions || []);
      setTtBalances(balData.balances || []);
    } catch {
      setTtDataError('Failed to load account data');
    } finally {
      setTtLoading(false);
    }
  };

  // Fetch positions + balances when connected
  useEffect(() => {
    if (ttConnected) {
      fetchTtData();
    }
  }, [ttConnected]);

  if (identityLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  const phaseNum = phase === 'setup' ? PIPE_SETUP.num : phase === 'scan' ? PIPE_SCAN.num : PIPE_REVIEW.num;

  return (
    <AppLayout>
      <RoomLock locked={roomLock.locked} stepName="Trading">
      <div className="min-h-screen bg-bg-terminal text-text-primary">
        <div className="p-4 lg:p-6 max-w-[1800px] mx-auto">
          {/* TRADE-SPLIT: ONE tool's screen — Brokerage (17). Its name, number,
              status and phases; no second tool, no grouping layer. */}
          <ToolOpener tools={navToolsOfScreen('/brokerage', TOOL_GATE)} />

          {/* This tool's own pipe: trade 01-03 from PIPE_PHASES.trade. */}
          <div className="mb-3">
            <StageStrip
              phases={([
                { key: 'setup', num: PIPE_SETUP.num, label: PIPE_SETUP.name, subLabel: PIPE_SETUP.subLabel,
                  state: phase === 'setup' ? 'active' : 'done' },
                { key: 'scan', num: PIPE_SCAN.num, label: PIPE_SCAN.name, subLabel: PIPE_SCAN.subLabel,
                  state: phase === 'scan' ? 'active' : 'pending' },
                { key: 'review', num: PIPE_REVIEW.num, label: PIPE_REVIEW.name, subLabel: PIPE_REVIEW.subLabel,
                  state: phase === 'review' ? 'active' : 'pending' },
              ] as StagePhase[])}
              onSelect={(k) => setPhase(k as BrokeragePhase)}
            />
            <div className="mt-1 text-right font-mono text-[10px] uppercase tracking-wider text-text-faint">
              PHASE {phaseNum} OF 06 — {phase.toUpperCase()}
            </div>
          </div>

          {/* TRADING-PR-3: the sticky/backdrop-blur "Purple Background Zone" is
              dissolved — the scan form is a full-height SectionCard in normal flow
              (nothing pinned/clipped). Travel-style stacked cards. ── */}
          <ScanFilterForm
            scannerUniverse={scannerUniverse}
            setScannerUniverse={setScannerUniverse}
            scannerFilters={scannerFilters}
            onFiltersChange={handleFiltersChange}
            scanTriggerRef={scanTriggerRef}
            ttConnected={ttConnected}
            founderBroker={!isOwner}
          />

          <div className="space-y-3 mt-4">
            {/* ── Market Intelligence ── */}
            {isOwner && ttConnected && (
              <div className="mb-4">
                {ttLoading ? (
                  <div className={`overflow-hidden border-x border-b border-border bg-white ${STATE.loading}`}>Loading account data...</div>
                ) : ttDataError ? (
                  <div className={STATE.errorCard}>
                    <div className="text-sm text-status-danger mb-3">{ttDataError}</div>
                    <button onClick={fetchTtData} className="text-xs text-brand-purple hover:underline font-medium">Retry</button>
                  </div>
                ) : (
                  <ConvergenceIntelligence
                    externalFilters={scannerFilters}
                    onFiltersChange={handleFiltersChange}
                    externalUniverse={scannerUniverse}
                    onUniverseChange={setScannerUniverse}
                    hideControls={true}
                    scanTriggerRef={scanTriggerRef}
                    scanningRef={scanningRef}
                  />
                )}
              </div>
            )}

            {/* TT-01: the scan phase is the founder's broker only. The gate is
                unchanged — this states WHY the phase is empty instead of
                showing a viewer nothing. One const, the same line the route
                refuses with (src/lib/tastytrade/founderBroker.ts). */}
            {!isOwner && (
              <div className="overflow-hidden border-x border-b border-border bg-white px-4 py-3">
                <div className="font-mono text-[10px] uppercase tracking-wider text-text-faint mb-1">
                  PHASE {PIPE_SCAN.num} {PIPE_SCAN.name} · PHASE {PIPE_REVIEW.num} {PIPE_REVIEW.name}
                </div>
                <p role="status" data-founder-broker className="font-mono text-[11px] text-brand-amber">{FOUNDER_BROKER_LINE}</p>
              </div>
            )}

            {/* ── Data Observatory ── the scan's own feed census, owner-only */}
            {isOwner && (
              <div className="mb-4">
                <DataObservatory />
              </div>
            )}
          </div>

        </div>
      </div>
      </RoomLock>
    </AppLayout>
  );
}
