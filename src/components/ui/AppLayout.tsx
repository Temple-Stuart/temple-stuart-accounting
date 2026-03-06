'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useEffect, useState, useRef } from 'react';
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

const BUDGETING_ITEMS = [
  { name: 'Business', href: '/business' },
  { name: 'Home', href: '/home' },
  { name: 'Auto', href: '/auto' },
  { name: 'Shopping', href: '/shopping' },
  { name: 'Personal', href: '/personal' },
  { name: 'Health', href: '/health' },
  { name: 'Growth', href: '/growth' },
  { name: 'Trips', href: '/budgets/trips' },
  { name: 'Income', href: '/income' },
  { name: 'Budget', href: '/hub/itinerary' },
];

const BUDGETING_PREFIXES = BUDGETING_ITEMS.map(i => i.href);

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
  const [budgetingOpen, setBudgetingOpen] = useState(false);
  const [cookieUser, setCookieUser] = useState<CookieUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const budgetingRef = useRef<HTMLDivElement>(null);

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

  // Close budgeting dropdown on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (budgetingRef.current && !budgetingRef.current.contains(e.target as Node)) {
        setBudgetingOpen(false);
      }
    };
    if (budgetingOpen) {
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }
  }, [budgetingOpen]);

  // Close budgeting dropdown on route change
  useEffect(() => {
    setBudgetingOpen(false);
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
  const isBookkeepingActive = BOOKKEEPING_PREFIXES.some(p => pathname?.startsWith(p));
  const isTradingActive = pathname?.startsWith('/trading');
  const isBudgetingActive = BUDGETING_PREFIXES.some(p => pathname?.startsWith(p));

  const navTabClass = (active: boolean) =>
    `relative px-3 flex items-center text-terminal-lg font-medium transition-all h-full ${
      active
        ? 'text-white bg-white/[.07]'
        : 'text-white/60 hover:text-white hover:bg-white/[.04]'
    }`;

  const navTabBorder = (active: boolean) =>
    active ? 'absolute bottom-0 left-0 right-0 h-[2px] bg-brand-gold' : '';

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-bg-terminal">
      <header className="sticky top-0 z-50">
        {/* ROW 1 — Navigation (28px) */}
        <div className="bg-brand-purple" style={{ height: 28 }}>
          <div className="max-w-[1800px] mx-auto flex items-center h-full px-3">
            {/* Logo */}
            <Link href="/hub" className="flex items-center gap-1.5 mr-4 flex-shrink-0">
              <div className="w-4 h-4 rounded-sm bg-white/10 flex items-center justify-center">
                <span className="text-white font-bold text-[7px] font-mono leading-none">TS</span>
              </div>
              <span className="hidden sm:inline text-[11px] font-semibold text-white tracking-tight">Temple Stuart</span>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden lg:flex items-center h-full gap-0">
              {/* Hub */}
              <Link href="/hub" className={navTabClass(isHubActive)}>
                Hub
                <div className={navTabBorder(isHubActive)} />
              </Link>

              {/* Bookkeeping */}
              <Link href="/dashboard" className={navTabClass(isBookkeepingActive)}>
                Bookkeeping
                <div className={navTabBorder(isBookkeepingActive)} />
              </Link>

              {/* Trading */}
              <Link href="/trading" className={navTabClass(isTradingActive)}>
                Trading
                <div className={navTabBorder(isTradingActive)} />
              </Link>

              {/* Budgeting (with dropdown) */}
              <div ref={budgetingRef} className="relative h-full">
                <button
                  onClick={() => setBudgetingOpen(!budgetingOpen)}
                  className={navTabClass(isBudgetingActive)}
                >
                  Budgeting
                  <svg className="w-2.5 h-2.5 ml-1 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                  <div className={navTabBorder(isBudgetingActive)} />
                </button>

                {/* Budgeting Dropdown */}
                {budgetingOpen && (
                  <div className="absolute top-full left-0 mt-0 bg-brand-purple-deep border border-white/10 shadow-sm z-50 min-w-[140px]">
                    {BUDGETING_ITEMS.map(item => {
                      const isSubActive = pathname?.startsWith(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`block px-3 py-1.5 text-[10px] font-medium transition-colors ${
                            isSubActive
                              ? 'text-brand-gold bg-white/[.05]'
                              : 'text-white/70 hover:text-white hover:bg-white/[.05]'
                          }`}
                        >
                          {item.name}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            </nav>

            {/* Right side */}
            <div className="ml-auto flex items-center gap-2">
              <span className="hidden sm:inline text-[9px] text-white/50 font-mono">
                {currentUser?.name || currentUser?.email?.split('@')[0]}
              </span>
              <button
                onClick={handleSignOut}
                className="text-[9px] text-white/40 hover:text-white transition-colors font-mono"
              >
                sign out
              </button>
              {/* Mobile hamburger */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-1 hover:bg-white/10 rounded-sm"
              >
                <svg className="w-4 h-4 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            <div className="grid grid-cols-2 gap-0.5">
              <Link href="/hub" className={`px-2 py-1.5 text-[10px] font-medium text-center ${isHubActive ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/[.05] hover:text-white'}`}>
                Hub
              </Link>
              <Link href="/dashboard" className={`px-2 py-1.5 text-[10px] font-medium text-center ${isBookkeepingActive ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/[.05] hover:text-white'}`}>
                Bookkeeping
              </Link>
              <Link href="/trading" className={`px-2 py-1.5 text-[10px] font-medium text-center ${isTradingActive ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/[.05] hover:text-white'}`}>
                Trading
              </Link>
              {BUDGETING_ITEMS.map(item => {
                const isSubActive = pathname?.startsWith(item.href);
                return (
                  <Link key={item.href} href={item.href}
                    className={`px-2 py-1.5 text-[10px] font-medium text-center ${isSubActive ? 'text-brand-gold bg-white/[.05]' : 'text-white/60 hover:bg-white/[.05] hover:text-white'}`}>
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </header>

      <main className="max-w-[1800px] mx-auto">{children}</main>
    </div>
  );
}
