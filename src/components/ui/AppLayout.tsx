'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useEffect, useState } from 'react';
import Link from 'next/link';

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
}

interface CookieUser {
  email: string;
  name: string;
}

// ─── Route Groups ────────────────────────────────────────────────────────────

const BOOKKEEPING_PREFIXES = [
  '/dashboard', '/accounts', '/chart-of-accounts',
  '/journal-entries', '/ledger', '/statements',
  '/transactions', '/net-worth',
];

const PERSONAL_PREFIXES = [
  '/personal', '/home', '/auto', '/shopping',
  '/health', '/growth', '/income', '/hub/itinerary',
];

const BUSINESS_PREFIXES = ['/business'];

const TRAVEL_PREFIXES = ['/budgets/trips', '/trips'];

const TRADING_PREFIXES = ['/trading'];

// Primary nav tabs — order matters (left to right)
const NAV_TABS = [
  { name: 'Bookkeeping', href: '/dashboard', icon: '📒', prefixes: BOOKKEEPING_PREFIXES },
  { name: 'Personal', href: '/personal', icon: '👤', prefixes: PERSONAL_PREFIXES },
  { name: 'Business', href: '/business', icon: '💼', prefixes: BUSINESS_PREFIXES },
  { name: 'Travel', href: '/budgets/trips', icon: '✈️', prefixes: TRAVEL_PREFIXES },
  { name: 'Trading', href: '/trading', icon: '📈', prefixes: TRADING_PREFIXES },
];

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

export default function AppLayout({ children, ledgerMetrics, engineMetrics, onOpenTaxSettings }: AppLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

  useEffect(() => {
    if (!checkingAuth && status !== 'loading' && !isAuthenticated) {
      router.push('/');
    }
  }, [checkingAuth, status, isAuthenticated, router]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

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

  if (!isAuthenticated) {
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

  const isHubActive = pathname === '/hub';

  const isTabActive = (prefixes: string[]) =>
    prefixes.some(p => pathname?.startsWith(p));

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-bg-terminal">
      <header className="sticky top-0 z-50">
        {/* ROW 1 — Navigation */}
        <div className="bg-brand-purple">
          <div className="max-w-[1800px] mx-auto flex items-center px-4">
            {/* Logo */}
            <Link href="/hub" className="flex items-center gap-2 mr-6 py-3 flex-shrink-0">
              <div className="w-6 h-6 rounded bg-white/10 flex items-center justify-center">
                <span className="text-white font-bold text-[9px] font-mono leading-none">TS</span>
              </div>
              <span className="hidden sm:inline text-sm font-semibold text-white">Temple Stuart</span>
            </Link>

            {/* Desktop Nav — 5 primary tabs */}
            <nav className="hidden lg:flex items-center h-full">
              {NAV_TABS.map(tab => {
                const active = isTabActive(tab.prefixes);
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={`relative flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors ${
                      active
                        ? 'text-white'
                        : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <span>{tab.icon}</span>
                    <span>{tab.name}</span>
                    {active && (
                      <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-brand-gold rounded-full" />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Right side — Hub icon + user */}
            <div className="ml-auto flex items-center gap-3">
              {/* Hub icon */}
              <Link
                href="/hub"
                className={`hidden lg:flex items-center gap-1 px-2 py-1.5 rounded transition-colors text-sm ${
                  isHubActive
                    ? 'text-white bg-white/10'
                    : 'text-white/60 hover:text-white hover:bg-white/10'
                }`}
                title="Hub"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </Link>

              <span className="hidden sm:inline text-xs text-white/50">
                {currentUser?.name || currentUser?.email?.split('@')[0]}
              </span>
              <button
                onClick={handleSignOut}
                className="text-xs text-white/40 hover:text-white transition-colors"
              >
                sign out
              </button>

              {/* Mobile hamburger */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-1.5 hover:bg-white/10 rounded"
              >
                <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {mobileMenuOpen
                    ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  }
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* ROW 2 — LEDGER (facts from /api/metrics) */}
        {ledgerMetrics && (
          <div className="bg-brand-purple border-t border-white/[.05]" style={{ height: 20 }}>
            <div className="max-w-[1800px] mx-auto flex items-center h-full px-3 text-[9px] font-mono">
              <span className="text-white/25 uppercase tracking-wider text-[7px] mr-2">LEDGER</span>

              <span className="text-white/40 mr-1">BAL</span>
              <span className={`font-semibold ${ledgerMetrics.balance >= 0 ? 'text-brand-green' : 'text-brand-red'}`}>{fmtDollars(ledgerMetrics.balance)}</span>
              <span className="mx-1.5 w-px h-2.5 bg-white/[.07]" />

              <span className="text-white/40 mr-1">EXP</span>
              <span className="text-brand-red font-medium">{fmtDollars(ledgerMetrics.expYtd)}</span>
              <span className="mx-1.5 w-px h-2.5 bg-white/[.07]" />

              <span className="text-white/40 mr-1">REV</span>
              <span className="text-brand-green font-medium">{fmtDollars(ledgerMetrics.revYtd)}</span>
              <span className="mx-1.5 w-px h-2.5 bg-white/[.07]" />

              <span className="text-white/40 mr-1">NET</span>
              <span className={`font-semibold ${ledgerMetrics.net >= 0 ? 'text-brand-green' : 'text-brand-red'}`}>{fmtDollars(ledgerMetrics.net)}</span>
              <span className="mx-1.5 w-px h-2.5 bg-white/[.07]" />

              <span className="text-white/40 mr-1">BIZ</span>
              <span className="text-brand-purple-light font-medium">{fmtPct(ledgerMetrics.bizPercent)}</span>
              <span className="mx-1.5 w-px h-2.5 bg-white/[.07]" />

              <span className="text-white/40 mr-1">DONE</span>
              <span className={`font-medium ${ledgerMetrics.donePercent > 80 ? 'text-brand-green' : ledgerMetrics.donePercent < 50 ? 'text-brand-gold' : 'text-brand-amber'}`}>{fmtPct(ledgerMetrics.donePercent)}</span>
              <span className="mx-1.5 w-px h-2.5 bg-white/[.07]" />

              <span className="text-white/40 mr-1">{'\u0394'}</span>
              <span className={`font-medium ${ledgerMetrics.momChange <= 0 ? 'text-brand-green' : 'text-brand-red'}`}>{fmtMom(ledgerMetrics.momChange)}</span>
            </div>
          </div>
        )}

        {/* ROW 3 — ENGINE (estimates from /api/tax-estimate) */}
        {engineMetrics && (
          <div className="bg-brand-purple/80 border-t border-white/[.03]" style={{ height: 20 }}>
            <div className="max-w-[1800px] mx-auto flex items-center h-full px-3 text-[9px] font-mono">
              <span className="text-white/25 uppercase tracking-wider text-[7px] mr-2">ENGINE</span>

              <span className="text-white/40 mr-1">EST TAX</span>
              <span className="text-brand-amber font-semibold">{fmtDollars(engineMetrics.totalEstimatedTax)}</span>
              <span className="mx-1.5 w-px h-2.5 bg-white/[.07]" />

              <span className="text-white/40 mr-1">Q DUE</span>
              <span className="text-brand-amber font-medium">{fmtDollars(engineMetrics.quarterlyDue)}</span>
              <span className="mx-1.5 w-px h-2.5 bg-white/[.07]" />

              <span className="text-white/40 mr-1">EFF</span>
              <span className="text-white/70 font-medium">{fmtPct(engineMetrics.effectiveRate)}</span>
              <span className="mx-1.5 w-px h-2.5 bg-white/[.07]" />

              <span className="text-white/40 mr-1">DEDUCT</span>
              <span className="text-brand-green font-medium">{fmtDollars(engineMetrics.totalDeductions)}</span>
              <span className="mx-1.5 w-px h-2.5 bg-white/[.07]" />

              <span className="text-white/40 mr-1">SAFE</span>
              <span className={`font-medium ${engineMetrics.safeHarborPercent >= 100 ? 'text-brand-green' : 'text-brand-red'}`}>{fmtPct(engineMetrics.safeHarborPercent)}</span>

              {onOpenTaxSettings && (
                <>
                  <span className="mx-1.5 w-px h-2.5 bg-white/[.07]" />
                  <button onClick={onOpenTaxSettings} className="text-white/40 hover:text-white transition-colors" title="Tax Settings">{'\u2699'}</button>
                </>
              )}

              <span className="ml-auto text-white/20 text-[7px] uppercase tracking-wider">ESTIMATE</span>
            </div>
          </div>
        )}

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-brand-purple-deep border-t border-white/10 px-3 py-2">
            <div className="flex flex-col gap-0.5">
              {NAV_TABS.map(tab => {
                const active = isTabActive(tab.prefixes);
                return (
                  <Link key={tab.href} href={tab.href}
                    className={`flex items-center gap-2 px-3 py-2.5 text-sm font-medium rounded transition-colors ${
                      active
                        ? 'bg-white/10 text-white border-l-2 border-brand-gold'
                        : 'text-white/70 hover:bg-white/[.05] hover:text-white border-l-2 border-transparent'
                    }`}>
                    <span>{tab.icon}</span>
                    <span>{tab.name}</span>
                  </Link>
                );
              })}
              <Link href="/hub"
                className={`flex items-center gap-2 px-3 py-2.5 text-sm font-medium rounded transition-colors mt-1 border-t border-white/10 pt-3 ${
                  isHubActive
                    ? 'bg-white/10 text-white'
                    : 'text-white/60 hover:bg-white/[.05] hover:text-white'
                }`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                <span>Hub Dashboard</span>
              </Link>
            </div>
          </div>
        )}
      </header>

      <main className="max-w-[1800px] mx-auto">{children}</main>
    </div>
  );
}
