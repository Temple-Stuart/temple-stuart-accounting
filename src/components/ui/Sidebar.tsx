'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  BookOpen, Plane, TrendingUp, Rocket, Activity, LayoutGrid,
  Menu, X, PanelLeftClose, PanelLeftOpen, LogOut,
} from 'lucide-react';

// Route config — SAME hrefs/prefixes as the former top-nav (relocated, not changed).
const TRAVEL_PREFIXES = ['/budgets/trips', '/trips'];
const TRADING_PREFIXES = ['/trading'];
const COMPLIANCE_PREFIXES = ['/compliance'];
const OPERATIONS_PREFIXES = ['/operations'];
const BOOKKEEPING_PREFIXES = [
  '/dashboard', '/accounts', '/chart-of-accounts',
  '/journal-entries', '/ledger', '/statements',
  '/transactions', '/net-worth',
];

const MODULES = [
  { name: 'Bookkeeping', href: '/dashboard', Icon: BookOpen, prefixes: BOOKKEEPING_PREFIXES },
  { name: 'Trading', href: '/trading', Icon: TrendingUp, prefixes: TRADING_PREFIXES },
  { name: 'Travel', href: '/budgets/trips', Icon: Plane, prefixes: TRAVEL_PREFIXES },
  { name: 'Compliance', href: '/compliance', Icon: Rocket, prefixes: COMPLIANCE_PREFIXES },
  { name: 'Operations', href: '/operations', Icon: Activity, prefixes: OPERATIONS_PREFIXES },
] as const;

const COLLAPSE_KEY = 'sidebar-collapsed';

interface SidebarProps {
  pathname: string | null;
  userLabel: string;
  onSignOut: () => void;
}

export default function Sidebar({ pathname, userLabel, onSignOut }: SidebarProps) {
  // SSR-safe: default expanded, hydrate persisted state after mount (mirrors the
  // localStorage pattern used by OperationsEntityProvider).
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(COLLAPSE_KEY) === '1') setCollapsed(true);
    } catch {}
  }, []);

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0'); } catch {}
      return next;
    });
  };

  // Close the mobile drawer on navigation.
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const isHubActive = pathname === '/hub';
  const isActive = (prefixes: readonly string[]) => prefixes.some(p => pathname?.startsWith(p));

  const itemBase = 'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors border-l-2';
  const itemInactive = 'border-transparent text-white/70 hover:bg-brand-purple/40 hover:text-white';
  const itemActive = 'border-ts-aqua bg-white/10 text-ts-aqua';

  // Nav list, shared by the desktop rail and the mobile drawer.
  const navList = (showLabels: boolean) => (
    <nav className="flex flex-col gap-1">
      <Link
        href="/hub"
        title="Hub"
        className={`${itemBase} ${isHubActive ? itemActive : itemInactive}`}
      >
        <LayoutGrid className="w-4 h-4 flex-shrink-0" />
        {showLabels && <span>Hub</span>}
      </Link>

      <div className="my-2 border-t border-white/10" />

      {MODULES.map(m => (
        <Link
          key={m.href}
          href={m.href}
          title={m.name}
          className={`${itemBase} ${isActive(m.prefixes) ? itemActive : itemInactive}`}
        >
          <m.Icon className="w-4 h-4 flex-shrink-0" />
          {showLabels && <span>{m.name}</span>}
        </Link>
      ))}
    </nav>
  );

  const logo = (showLabel: boolean) => (
    <Link href="/hub" className="flex items-center gap-2 flex-shrink-0" title="Temple Stuart">
      <div className="w-7 h-7 rounded-md bg-white/10 flex items-center justify-center flex-shrink-0">
        <span className="text-white font-bold text-[10px] font-mono leading-none">TS</span>
      </div>
      {showLabel && <span className="text-lg font-semibold text-white">Temple Stuart</span>}
    </Link>
  );

  const userBlock = (showLabel: boolean) => (
    <div className="mt-auto border-t border-white/10 pt-3 flex flex-col gap-2">
      {showLabel && <span className="px-3 text-xs text-white/60 truncate">{userLabel}</span>}
      <button
        onClick={onSignOut}
        title="Sign out"
        className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-white/50 hover:bg-brand-purple/40 hover:text-white transition-colors"
      >
        <LogOut className="w-4 h-4 flex-shrink-0" />
        {showLabel && <span>Sign out</span>}
      </button>
    </div>
  );

  return (
    <>
      {/* ── Mobile top bar (below lg) ── */}
      <div className="lg:hidden sticky top-0 z-40 flex items-center justify-between bg-brand-purple-deep px-4 py-3">
        {logo(true)}
        <button
          onClick={() => setMobileOpen(true)}
          className="p-1.5 rounded-md text-white/70 hover:bg-white/10"
          aria-label="Open navigation"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* ── Mobile drawer overlay ── */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="relative z-10 flex w-64 max-w-[80%] flex-col bg-brand-purple-deep px-3 py-4">
            <div className="flex items-center justify-between mb-4">
              {logo(true)}
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1.5 rounded-md text-white/70 hover:bg-white/10"
                aria-label="Close navigation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {navList(true)}
            {userBlock(true)}
          </div>
        </div>
      )}

      {/* ── Desktop rail (lg+) ── */}
      <aside
        className={`hidden lg:flex lg:sticky lg:top-0 lg:h-screen flex-col bg-brand-purple-deep px-3 py-4 transition-[width] duration-150 ${collapsed ? 'w-16' : 'w-60'}`}
      >
        <div className={`flex items-center mb-4 ${collapsed ? 'justify-center' : 'justify-between'}`}>
          {logo(!collapsed)}
          <button
            onClick={toggleCollapsed}
            className="p-1.5 rounded-md text-white/60 hover:bg-white/10 hover:text-white"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>
        {navList(!collapsed)}
        {userBlock(!collapsed)}
      </aside>
    </>
  );
}
