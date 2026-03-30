'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { BookOpen, User, Briefcase, Plane, TrendingUp, LayoutGrid, Menu, X } from 'lucide-react';
import TripCreationBar from '@/components/trips/TripCreationBar';

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
  { name: 'Bookkeeping', href: '/dashboard', Icon: BookOpen, prefixes: BOOKKEEPING_PREFIXES },
  { name: 'Personal', href: '/personal', Icon: User, prefixes: PERSONAL_PREFIXES },
  { name: 'Business', href: '/business', Icon: Briefcase, prefixes: BUSINESS_PREFIXES },
  { name: 'Travel', href: '/budgets/trips', Icon: Plane, prefixes: TRAVEL_PREFIXES },
  { name: 'Trading', href: '/trading', Icon: TrendingUp, prefixes: TRADING_PREFIXES },
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

export default function AppLayout({ children, ledgerMetrics, engineMetrics, onOpenTaxSettings, bookkeepingBar }: AppLayoutProps) {
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

  const showTravelSearch = TRAVEL_PREFIXES.some(r => pathname?.startsWith(r));

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-bg-terminal">
      <header className="sticky top-0 z-50">
        {/* ROW 1 — Top Bar (logo + user) */}
        <div className="bg-brand-purple">
          <div className="max-w-[1800px] mx-auto flex items-center justify-between px-6 py-4">
            <Link href="/hub" className="flex items-center gap-2 flex-shrink-0">
              <div className="w-7 h-7 rounded-md bg-white/10 flex items-center justify-center">
                <span className="text-white font-bold text-[10px] font-mono leading-none">TS</span>
              </div>
              <span className="hidden sm:inline text-lg font-semibold text-white">Temple Stuart</span>
            </Link>
            <div className="flex items-center gap-3">
              <Link href="/hub" className={`hidden lg:flex items-center px-2.5 py-1.5 rounded-full transition-colors ${isHubActive ? 'text-white bg-white/15' : 'text-white/70 hover:text-white hover:bg-white/10'}`} title="Hub Dashboard">
                <LayoutGrid className="w-4 h-4" />
              </Link>
              <span className="hidden sm:inline text-sm text-white/60">{currentUser?.name || currentUser?.email?.split('@')[0]}</span>
              <button onClick={handleSignOut} className="text-sm text-white/40 hover:text-white transition-colors">sign out</button>
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="lg:hidden p-1.5 hover:bg-white/10 rounded-md">
                {mobileMenuOpen ? <X className="w-5 h-5 text-white/70" /> : <Menu className="w-5 h-5 text-white/70" />}
              </button>
            </div>
          </div>
        </div>

        {/* ROW 2 — Tab Bar (pill-shaped tabs) */}
        <div className="bg-brand-purple/90 border-t border-white/[.06]">
          <div className="max-w-[1800px] mx-auto hidden lg:flex items-center gap-2 px-6 py-3">
            {NAV_TABS.map(tab => {
              const active = isTabActive(tab.prefixes);
              return (
                <Link key={tab.href} href={tab.href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    active
                      ? 'border border-white bg-white/10 text-white'
                      : 'border border-transparent text-white/70 hover:border-white/40 hover:text-white'
                  }`}>
                  <tab.Icon className="w-4 h-4" />
                  <span>{tab.name}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* ROW 3 — Travel Search Bar (only on Travel routes) */}
        {showTravelSearch && (
          <div className="bg-brand-purple/80 border-t border-white/[.06]">
            <div className="max-w-[1800px] mx-auto px-6 py-4">
              <Suspense><TripCreationBar /></Suspense>
            </div>
          </div>
        )}

        {/* ROW 3 — Bookkeeping Cockpit Bar (same pattern as Travel) */}
        {bookkeepingBar && (
          <div className="bg-brand-purple/80 border-t border-white/[.06]">
            <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-4">
              {bookkeepingBar}
            </div>
          </div>
        )}

        {/* Ledger Metrics Bar */}
        {ledgerMetrics && (
          <div className="bg-gray-50 border-b border-gray-200">
            <div className="max-w-[1800px] mx-auto flex items-center px-6 py-2 text-xs">
              <span className="text-gray-400 uppercase tracking-wider text-[10px] font-medium mr-3">Ledger</span>

              <span className="text-gray-500 mr-1">BAL</span>
              <span className={`font-semibold ${ledgerMetrics.balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmtDollars(ledgerMetrics.balance)}</span>
              <span className="mx-2 w-px h-3 bg-gray-200" />

              <span className="text-gray-500 mr-1">EXP</span>
              <span className="text-red-600 font-medium">{fmtDollars(ledgerMetrics.expYtd)}</span>
              <span className="mx-2 w-px h-3 bg-gray-200" />

              <span className="text-gray-500 mr-1">REV</span>
              <span className="text-emerald-600 font-medium">{fmtDollars(ledgerMetrics.revYtd)}</span>
              <span className="mx-2 w-px h-3 bg-gray-200" />

              <span className="text-gray-500 mr-1">NET</span>
              <span className={`font-semibold ${ledgerMetrics.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmtDollars(ledgerMetrics.net)}</span>
              <span className="mx-2 w-px h-3 bg-gray-200" />

              <span className="text-gray-500 mr-1">BIZ</span>
              <span className="text-brand-purple font-medium">{fmtPct(ledgerMetrics.bizPercent)}</span>
              <span className="mx-2 w-px h-3 bg-gray-200" />

              <span className="text-gray-500 mr-1">DONE</span>
              <span className={`font-medium ${ledgerMetrics.donePercent > 80 ? 'text-emerald-600' : ledgerMetrics.donePercent < 50 ? 'text-amber-600' : 'text-amber-500'}`}>{fmtPct(ledgerMetrics.donePercent)}</span>
              <span className="mx-2 w-px h-3 bg-gray-200" />

              <span className="text-gray-500 mr-1">{'\u0394'}</span>
              <span className={`font-medium ${ledgerMetrics.momChange <= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmtMom(ledgerMetrics.momChange)}</span>
            </div>
          </div>
        )}

        {/* Engine / Tax Metrics Bar */}
        {engineMetrics && (
          <div className="bg-white border-b border-gray-200">
            <div className="max-w-[1800px] mx-auto flex items-center px-6 py-2 text-xs">
              <span className="text-gray-400 uppercase tracking-wider text-[10px] font-medium mr-3">Tax Engine</span>

              <span className="text-gray-500 mr-1">EST TAX</span>
              <span className="text-amber-600 font-semibold">{fmtDollars(engineMetrics.totalEstimatedTax)}</span>
              <span className="mx-2 w-px h-3 bg-gray-200" />

              <span className="text-gray-500 mr-1">Q DUE</span>
              <span className="text-amber-600 font-medium">{fmtDollars(engineMetrics.quarterlyDue)}</span>
              <span className="mx-2 w-px h-3 bg-gray-200" />

              <span className="text-gray-500 mr-1">EFF</span>
              <span className="text-gray-700 font-medium">{fmtPct(engineMetrics.effectiveRate)}</span>
              <span className="mx-2 w-px h-3 bg-gray-200" />

              <span className="text-gray-500 mr-1">DEDUCT</span>
              <span className="text-emerald-600 font-medium">{fmtDollars(engineMetrics.totalDeductions)}</span>
              <span className="mx-2 w-px h-3 bg-gray-200" />

              <span className="text-gray-500 mr-1">SAFE</span>
              <span className={`font-medium ${engineMetrics.safeHarborPercent >= 100 ? 'text-emerald-600' : 'text-red-600'}`}>{fmtPct(engineMetrics.safeHarborPercent)}</span>

              {onOpenTaxSettings && (
                <>
                  <span className="mx-2 w-px h-3 bg-gray-200" />
                  <button onClick={onOpenTaxSettings} className="text-gray-400 hover:text-gray-700 transition-colors" title="Tax Settings">{'\u2699'}</button>
                </>
              )}

              <span className="ml-auto text-gray-300 text-[10px] uppercase tracking-wider">Estimate</span>
            </div>
          </div>
        )}

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-brand-purple-deep border-t border-white/10 px-4 py-3">
            <div className="flex flex-col gap-1">
              {NAV_TABS.map(tab => {
                const active = isTabActive(tab.prefixes);
                return (
                  <Link key={tab.href} href={tab.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? 'bg-white/10 text-white border-l-2 border-white'
                        : 'text-white/70 hover:bg-white/[.05] hover:text-white border-l-2 border-transparent'
                    }`}>
                    <tab.Icon className="w-4 h-4" />
                    <span>{tab.name}</span>
                  </Link>
                );
              })}
              <div className="border-t border-white/10 mt-2 pt-2">
                <Link href="/hub"
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    isHubActive ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/[.05] hover:text-white'
                  }`}>
                  <LayoutGrid className="w-4 h-4" />
                  <span>Hub Dashboard</span>
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="max-w-[1800px] mx-auto">{children}</main>
    </div>
  );
}
