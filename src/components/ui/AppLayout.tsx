'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useEffect, useState, Suspense } from 'react';
import TripCreationBar from '@/components/trips/TripCreationBar';
import Sidebar from '@/components/ui/Sidebar';

export interface LedgerMetrics {
  balance: number;
  expYtd: number;
  revYtd: number;
  net: number;
  bizExpYtd: number;
  persExpYtd: number;
  bizPercent: number;
  committed: number;
  total: number;
  donePercent: number;
  currentMonth: number;
  priorMonth: number;
  momChange: number;
  deductible: number;
}

export interface EngineMetrics {
  totalEstimatedTax: number;
  quarterlyDue: number;
  effectiveRate: number;
  totalDeductions: number;
  selfEmploymentTax: number;
  federalIncomeTax: number;
  stateTax: number;
  safeHarborPercent: number;
  remainingDue: number;
  brackets?: { rate: number; taxableInRange: number; tax: number }[];
}

export interface AppLayoutProps {
  children: React.ReactNode;
  ledgerMetrics?: LedgerMetrics | null;
  engineMetrics?: EngineMetrics | null;
  onOpenTaxSettings?: () => void;
  bookkeepingBar?: React.ReactNode;
}

interface CookieUser {
  email: string;
  name: string;
}

// ─── Route Groups ────────────────────────────────────────────────────────────
// Nav route config now lives in Sidebar.tsx (same hrefs/prefixes). Only the
// Travel prefixes remain here, to gate the Travel search bar below.

const TRAVEL_PREFIXES = ['/budgets/trips', '/trips'];

// FD-4: routes that RENDER for guests despite mounting AppLayout. EMPTY since
// PR-PRICE-3: '/pricing' (the only entry) no longer mounts AppLayout — it is
// a permanent redirect to /#modules, and the deck's buy flow (GuestLanding
// onBuyModule) owns the guest resume PricingClient used to. The mechanism
// stays for the next guest-renderable AppLayout consumer.
const GUEST_OK_PATHS: string[] = [];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDollars(cents: number | undefined): string {
  if (cents == null) return '\u2014';
  const dollars = Math.abs(cents) / 100;
  return '$' + dollars.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtPct(n: number | undefined): string {
  if (n == null) return '\u2014';
  return n.toFixed(1) + '%';
}

function fmtMom(n: number | undefined): string {
  if (n == null || n === 0) return '\u2014';
  const prefix = n < 0 ? '\u25BC' : '\u25B2';
  return prefix + Math.abs(n) + '%';
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AppLayout({ children, ledgerMetrics, engineMetrics, onOpenTaxSettings, bookkeepingBar }: AppLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [cookieUser, setCookieUser] = useState<CookieUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // ─── Auth ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    const checkCookieAuth = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setCookieUser(data.user);
          }
        }
      } catch (e) {
        // No cookie auth
      } finally {
        setCheckingAuth(false);
      }
    };
    checkCookieAuth();
  }, []);

  const isAuthenticated = session?.user || cookieUser;
  const currentUser = session?.user || cookieUser;
  // FD-4: same match shape as the middleware allowlist (middleware.ts:115).
  const guestOk = GUEST_OK_PATHS.some(p => pathname === p || pathname?.startsWith(p + '/'));

  useEffect(() => {
    if (!checkingAuth && status !== 'loading' && !isAuthenticated && !guestOk) {
      router.push('/');
    }
  }, [checkingAuth, status, isAuthenticated, guestOk, router]);

  // ─── Auth Guards ───────────────────────────────────────────────────────────

  if (status === 'loading' || checkingAuth) {
    return (
      <div className="min-h-screen bg-bg-terminal flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
          <span className="text-text-muted font-mono text-terminal-base">Loading...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated && !guestOk) {
    return null;
  }

  const handleSignOut = async () => {
    document.cookie = 'userEmail=; path=/; max-age=0';
    if (session) {
      await signOut({ callbackUrl: '/' });
    } else {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/');
    }
  };

  // ─── Active State Detection ────────────────────────────────────────────────

  // PR-29: the search/create bar shows on travel routes EXCEPT a committed trip's
  // detail page (/budgets/trips/{id} or /trips/{id}, but not .../new) — there the
  // detail page renders the editable TripHeader instead. Landing (/budgets/trips)
  // and /new keep the search/create bar.
  // PR-32: also suppress on the discover detail route
  // (/budgets/trips/{id}/discover/{category}/{rank}) — the `(\/discover\/.*)?`
  // group lets the match extend past {id} into the detail page, which the old
  // `$`-anchored single-segment pattern missed. Landing (/budgets/trips) and
  // /new still show the search/create bar.
  const isTripDetail = /^\/(budgets\/)?trips\/[^/]+(\/discover\/.*)?\/?$/.test(pathname || '') && !(pathname || '').endsWith('/new');
  // PR-37a: the trips INDEX (/budgets/trips or /trips) now renders its own
  // in-page create-trip form, so suppress the global search/create bar there too
  // (it would double up). /budgets/trips/new still shows the bar (create page).
  const isTripIndex = /^\/(budgets\/)?trips\/?$/.test(pathname || '');
  const showTravelSearch = TRAVEL_PREFIXES.some(r => pathname?.startsWith(r)) && !isTripDetail && !isTripIndex;
  const userLabel = currentUser?.name || currentUser?.email?.split('@')[0] || '';

  // ─── Render ────────────────────────────────────────────────────────────────
  // Sidebar shell replaces the former top-nav (Overhaul-PR-1). The prop-driven
  // context bars (Travel search, bookkeeping, ledger, engine) are preserved and
  // relocated to the top of the main content column — page {children} unchanged.

  return (
    <div className="min-h-screen bg-bg-terminal lg:flex">
      <Sidebar pathname={pathname} userLabel={userLabel} onSignOut={handleSignOut} />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Travel Search Bar (only on Travel routes) */}
        {showTravelSearch && (
          <div className="bg-brand-purple border-t border-white/[.06]">
            <div className="max-w-[1800px] mx-auto px-6 py-4">
              <Suspense><TripCreationBar /></Suspense>
            </div>
          </div>
        )}

        {/* ROW 3 — Bookkeeping Cockpit Bar (same pattern as Travel) */}
        {bookkeepingBar && (
          <div className="bg-brand-purple border-t border-white/[.06]">
            <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-4">
              {bookkeepingBar}
            </div>
          </div>
        )}

        {/* Ledger Metrics Bar */}
        {ledgerMetrics && (
          <div className="bg-bg-row border-b border-border">
            <div className="max-w-[1800px] mx-auto flex items-center px-6 py-2 text-xs">
              <span className="text-text-faint uppercase tracking-wider text-[10px] font-medium mr-3">Ledger</span>

              <span className="text-text-muted mr-1">BAL</span>
              <span className={`font-semibold ${ledgerMetrics.balance >= 0 ? 'text-brand-green' : 'text-brand-red'}`}>{fmtDollars(ledgerMetrics.balance)}</span>
              <span className="mx-2 w-px h-3 bg-border" />

              <span className="text-text-muted mr-1">EXP</span>
              <span className="text-brand-red font-medium">{fmtDollars(ledgerMetrics.expYtd)}</span>
              <span className="mx-2 w-px h-3 bg-border" />

              <span className="text-text-muted mr-1">REV</span>
              <span className="text-brand-green font-medium">{fmtDollars(ledgerMetrics.revYtd)}</span>
              <span className="mx-2 w-px h-3 bg-border" />

              <span className="text-text-muted mr-1">NET</span>
              <span className={`font-semibold ${ledgerMetrics.net >= 0 ? 'text-brand-green' : 'text-brand-red'}`}>{fmtDollars(ledgerMetrics.net)}</span>
              <span className="mx-2 w-px h-3 bg-border" />

              <span className="text-text-muted mr-1">BIZ</span>
              <span className="text-brand-purple font-medium">{fmtPct(ledgerMetrics.bizPercent)}</span>
              <span className="mx-2 w-px h-3 bg-border" />

              <span className="text-text-muted mr-1">DONE</span>
              <span className={`font-medium ${ledgerMetrics.donePercent > 80 ? 'text-brand-green' : ledgerMetrics.donePercent < 50 ? 'text-amber-600' : 'text-amber-500'}`}>{fmtPct(ledgerMetrics.donePercent)}</span>
              <span className="mx-2 w-px h-3 bg-border" />

              <span className="text-text-muted mr-1">{'\u0394'}</span>
              <span className={`font-medium ${ledgerMetrics.momChange <= 0 ? 'text-brand-green' : 'text-brand-red'}`}>{fmtMom(ledgerMetrics.momChange)}</span>
            </div>
          </div>
        )}

        {/* Engine / Tax Metrics Bar */}
        {engineMetrics && (
          <div className="bg-white border-b border-border">
            <div className="max-w-[1800px] mx-auto flex items-center px-6 py-2 text-xs">
              <span className="text-text-faint uppercase tracking-wider text-[10px] font-medium mr-3">Tax Engine</span>

              <span className="text-text-muted mr-1">EST TAX</span>
              <span className="text-amber-600 font-semibold">{fmtDollars(engineMetrics.totalEstimatedTax)}</span>
              <span className="mx-2 w-px h-3 bg-border" />

              <span className="text-text-muted mr-1">Q DUE</span>
              <span className="text-amber-600 font-medium">{fmtDollars(engineMetrics.quarterlyDue)}</span>
              <span className="mx-2 w-px h-3 bg-border" />

              <span className="text-text-muted mr-1">EFF</span>
              <span className="text-text-secondary font-medium">{fmtPct(engineMetrics.effectiveRate)}</span>
              <span className="mx-2 w-px h-3 bg-border" />

              <span className="text-text-muted mr-1">DEDUCT</span>
              <span className="text-brand-green font-medium">{fmtDollars(engineMetrics.totalDeductions)}</span>
              <span className="mx-2 w-px h-3 bg-border" />

              <span className="text-text-muted mr-1">SAFE</span>
              <span className={`font-medium ${engineMetrics.safeHarborPercent >= 100 ? 'text-brand-green' : 'text-brand-red'}`}>{fmtPct(engineMetrics.safeHarborPercent)}</span>

              {onOpenTaxSettings && (
                <>
                  <span className="mx-2 w-px h-3 bg-border" />
                  <button onClick={onOpenTaxSettings} className="text-text-faint hover:text-text-primary transition-colors" title="Tax Settings">{'\u2699'}</button>
                </>
              )}

              <span className="ml-auto text-text-faint text-[10px] uppercase tracking-wider">Estimate</span>
            </div>
          </div>
        )}

        <main className="max-w-[1800px] mx-auto w-full">{children}</main>
      </div>
    </div>
  );
}
