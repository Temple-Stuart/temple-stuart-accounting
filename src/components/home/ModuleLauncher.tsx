'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Script from 'next/script';
import {
  Calendar, Plane, Repeat, FolderKanban, TrendingUp, BookOpen, Receipt, ShieldCheck, Clapperboard,
  type LucideIcon,
} from 'lucide-react';
import CreateTripForm from '@/components/trips/CreateTripForm';
import AllTripsList, { type TripRow } from '@/components/trips/AllTripsList';
import TripFormModal from '@/components/trips/TripFormModal';
import TripBudgetActual from '@/components/trips/TripBudgetActual';
import HubCalendar from '@/components/hub/HubCalendar';
import RunwayDataProvider from '@/components/hub/RunwayDataProvider';
import RunwayBudgetPanel from '@/components/hub/RunwayBudgetPanel';
import PublicFlightSearch from '@/components/trips/PublicFlightSearch';
import PublicHotelSearch from '@/components/trips/PublicHotelSearch';
import PublicActivitySearch from '@/components/trips/PublicActivitySearch';
import PublicCategorySearch from '@/components/trips/PublicCategorySearch';
import PublicTransferSearch from '@/components/trips/PublicTransferSearch';
import PublicVisaCheck from '@/components/trips/PublicVisaCheck';
import ComingSoonSection from '@/components/home/ComingSoonSection';
import { TRAVEL_INPUT_CLASS, TRAVEL_BUTTON_CLASS } from '@/components/trips/travelSection';
import { HOMEPAGE_PAID_CATEGORIES } from '@/lib/categoryKeys';
import ScanFilterForm from '@/components/trading/ScanFilterForm';
// LANG-1: persistent data-not-advice disclaimer, mounted at the top of the Trade tab.
import TradingDataDisclaimer from '@/components/trading/TradingDataDisclaimer';
// TRADE-1: the queue viewer + reconcile/link/grade surface. Mounted BELOW the scanner on
// the homepage Trade tab so the scan → queue → RECONCILE loop is complete here (was only on
// standalone /trading). Reused verbatim — no restyle (that is TRADE-2).
import TradeLabPanel from '@/components/trading/TradeLabPanel';
import ConvergenceIntelligence from '@/components/convergence/ConvergenceIntelligence';
// BOOKS-1: cockpit bar + the 5 zero-prop, self-fetching Books surfaces (Option A — cockpit +
// drop-ins only; the parent-fed engines are BOOKS-2). All reused verbatim, no restyle.
import BookkeepingCockpitBar from '@/components/bookkeeping/BookkeepingCockpitBar';
// BOOKS-2: the full bookkeeping pipe (SRC → categorize → journal → ledger → TB → recon →
// adjusting → statements → wash-sales → close → year-end → positions → CPA export), in the
// dashboard's canonical order. It owns its own data layer; the 5 BOOKS-1 drop-ins now render
// inside it at their dashboard positions (no longer standalone here).
import BooksPipeline from '@/components/home/BooksPipeline';
// TAX-1: the closed-books handoff gate — shows the tax wizard only once a period is
// closed, otherwise a "close your books first" screen that jumps to the Books tab.
import TaxHandoffGate from '@/components/home/TaxHandoffGate';
// COMP-1: the Compliance A–J institutional workbench (Section A → sub-page link row →
// Sections B…J), bare (no AppLayout — the homepage tab supplies the shell).
import ComplianceWorkbench from '@/components/home/ComplianceWorkbench';
import OperationsPipelineShowroom from '@/components/workbench/operations/showroom/OperationsPipelineShowroom';
// HB-4e-mount: the real routine builder (workbench CRUD) + its self-fetching entity provider, plus
// the fetch-free logged-out teaser. Mounted verbatim on the homepage Routines tab — no restyle yet.
import { OperationsEntityProvider } from '@/components/workbench/operations/EntitySelector';
import SectionE_Routines from '@/components/workbench/operations/SectionE_Routines';
// Projects-mount: the real Projects CRUD (Bridgewater backlog). Authed users get this verbatim,
// wrapped in the same self-fetching OperationsEntityProvider as SectionE_Routines; logged-out
// keeps the rich OperationsPipelineShowroom (Option B).
import SectionD_ProjectBacklog from '@/components/workbench/operations/SectionD_ProjectBacklog';
// Content-mount: the real content pipeline (sources → scenify → grid → script). Authed users get
// this verbatim, wrapped in the same self-fetching OperationsEntityProvider; logged-out reuses the
// OperationsPipelineShowroom (which already renders the content Day + Script demo panels).
import ContentPipeline from '@/components/workbench/operations/content/ContentPipeline';
import HomeRoutineCreateForm from '@/components/home/RoutineCreateForm';
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

// Order per HOME-PR-9: Travel, Trading, Operations, Bookkeeping, Tax, Compliance
// (Travel + Trading + Operations are the input build-outs — surfaced first).
const MODULES: ModuleDef[] = [
  { key: 'travel',      label: 'Travel',      live: true,  blurb: 'AI trip & flight planning — free to use.' },
  { key: 'trading',     label: 'Trading',     live: false, blurb: 'AI vol scanner + options strategy builder.' },
  // PR-A-Tabs: the home "Operations" tab is renamed to "Projects" (label/key only — the
  // backend /operations routes + operations_routines table are unchanged). Routines is a
  // new sibling tab (its real surface lands in PR-B).
  { key: 'projects',    label: 'Projects',    live: false, blurb: 'Brain-dump a goal → a scoped project → tasks on your calendar.' },
  { key: 'routines',    label: 'Routines',    live: false, blurb: 'Recurring routines that land on your calendar.' },
  { key: 'bookkeeping', label: 'Bookkeeping', live: false, blurb: 'GAAP accounting engine, Plaid bank sync, period close.' },
  { key: 'tax',         label: 'Tax',         live: false, blurb: 'Form 1040, Schedule C/D/SE, Form 8949.' },
  { key: 'compliance',  label: 'Compliance',  live: false, blurb: 'Monitoring, attestations, audit trail.' },
  // Content-mount: appended LAST so the existing modules keep their MODULES index (the MODULES.map
  // alternating bg is index-driven). Tab-bar order is set by TABS below, not by this position;
  // content renders in its own flush block (skipped from the band map).
  { key: 'content',     label: 'Content',     live: false, blurb: 'Turn your day into a reel — sources → scenes → script.' },
];

// PR-Mobile2 + PR-Edge-A: the phone tabs — ONE per module (no grouping). On mobile one
// panel shows at a time (the bottom bar switches activeModule); on desktop every panel
// stays visible (md:block) and the bar is hidden (md:hidden). The bar horizontal-scrolls
// so 7 tabs stay clean on a narrow phone.
const TABS: { key: string; label: string; icon: LucideIcon }[] = [
  { key: 'calendar',   label: 'Runway',     icon: Calendar },
  { key: 'travel',     label: 'Travel',     icon: Plane },
  { key: 'routines',   label: 'Routines',   icon: Repeat },
  { key: 'projects',   label: 'Projects',   icon: FolderKanban },
  { key: 'content',    label: 'Content',    icon: Clapperboard },
  { key: 'trade',      label: 'Trade',      icon: TrendingUp },
  { key: 'books',      label: 'Books',      icon: BookOpen },
  { key: 'tax',        label: 'Tax',        icon: Receipt },
  { key: 'compliance', label: 'Compliance', icon: ShieldCheck },
];
// Which tab each module section belongs to — 1:1, every module its own tab (the
// calendar is its own 'calendar' tab, rendered separately).
const MODULE_TO_TAB: Record<string, string> = {
  travel: 'travel',
  trading: 'trade',
  bookkeeping: 'books',
  projects: 'projects',
  routines: 'routines',
  content: 'content',
  tax: 'tax',
  compliance: 'compliance',
};

// PR-PerTab-Descriptor: one plain descriptor line per tab, shown under the tab row and
// swapped by activeModule (this replaces the old per-panel "How it works" collapsibles).
// Keyed by TAB key (the activeModule values). Calendar + Travel are the lines we wrote;
// the rest are the first sentence of each module's prior intro copy.
export const TAB_DESCRIPTORS: Record<string, string> = {
  calendar: 'Runway — how long your money buys you. Your planned and actual spend, mapped to the day, so your runway is never a guess.',
  travel: 'Book your flights, hotels, things to do, and ground transportation — competitive prices, real times, real data.',
  trade: "Tell the scanner what you're hunting, and it pulls live prices from TastyTrade, company numbers from Finnhub, economy data from FRED, official filings from SEC EDGAR, and the mood online from Grok.",
  routines: 'Build your recurring routines and watch them land on your calendar — the rhythms that run your day.',
  projects: "Type the big messy goal that's rattling around your head — plain, rambly, however it actually lives up there.",
  content: 'Turn what you actually did today into a reel — sources to scenes to a ready-to-record script.',
  books: 'Connect your bank through Plaid and every transaction flows in.',
  tax: 'Your books are already clean, so your taxes are half-done before you start.',
  compliance: "This one's for when things get serious.",
};

interface Props {
  /** Opens the existing register/login modal on the home page. Called when a
   *  guest tries to save a trip, or clicks a paid module's "Launch" button. */
  onRequireAuth: () => void;
  /** PR-Hero-PerTab: notifies the parent (page.tsx) of the active tab so the hero
   *  subhead up top can swap to that tab's descriptor. Optional/additive. */
  onTabChange?: (tab: string) => void;
}

export default function ModuleLauncher({ onRequireAuth, onTabChange }: Props) {
  // Auth state: null = unknown (initial), true/false once /api/auth/me resolves.
  const [authed, setAuthed] = useState<boolean | null>(null);
  // TRADING-PR-2: admin status (server-computed via /api/auth/me isAdmin). The
  // Trading scan is admin-gated (requireAdmin), so only the admin sees the working
  // ScanFilterForm; everyone else keeps the paid stub.
  const [isAdmin, setIsAdmin] = useState(false);
  // PR-2b: per-category entitlements + user id (server-computed via /api/auth/me). Drive the
  // homepage Travel-tab category-section locks (isCategoryLocked). Logged-out → [] / '' → all
  // 9 sections render locked. Loaded from the SAME auth/me effect below (no extra fetch).
  const [entitledCategories, setEntitledCategories] = useState<string[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
  // PR-3: unified Travel-tab destination. The top "Search all" bar writes city/country here
  // and bumps the nonce; each destination-based section (Transfers, Activities, the unlocked
  // categories) reads them on a nonce change and runs ITS OWN search. Locked categories never
  // mount their search child, so fan-out can't fire them (zero spend). Flights are excluded.
  const [travelCity, setTravelCity] = useState('');
  const [travelCountry, setTravelCountry] = useState('');
  const [travelSearchNonce, setTravelSearchNonce] = useState(0);
  // PR-HCR-Trips1: bumped after a create so the All Trips list re-fetches in place.
  const [tripsRefresh, setTripsRefresh] = useState(0);
  // PR-HCR-Trips2: the selected trip, lifted out of AllTripsList so later budget
  // actions in the Travel section can read which trip they attach to. Selection +
  // context only — no budget writes here.
  const [currentTrip, setCurrentTrip] = useState<TripRow | null>(null);
  // PR-Trip-Modal: the create-trip form now lives in a modal off the "Your trips"
  // table (the table is the primary view; creating is one tap → modal). This is open
  // when the "+ Create a trip" button is tapped; a successful create closes it.
  const [showCreate, setShowCreate] = useState(false);
  // PR-Mobile2 + PR-Edge-B: which tab is active — now on BOTH mobile (bottom bar) and
  // desktop (top tab row); one module panel shows at a time on each. Additive — does
  // not touch any existing state (authed/currentTrip/tripsRefresh/scanner). Default the
  // master calendar.
  const [activeModule, setActiveModule] = useState('calendar');
  // PR-Hero-PerTab: switch the active tab AND tell the parent, so the hero subhead up top
  // (page.tsx) reflects the same tab. Both tab bars (desktop + mobile) route through this.
  const selectTab = (key: string) => { setActiveModule(key); onTabChange?.(key); };

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me')
      .then(async res => {
        if (cancelled) return;
        setAuthed(res.ok);
        if (res.ok) {
          const data = await res.json().catch(() => null);
          setIsAdmin(!!data?.user?.isAdmin);
          // PR-2b: feed the homepage category-section locks (no extra fetch).
          setEntitledCategories(Array.isArray(data?.user?.entitledCategories) ? data.user.entitledCategories : []);
          setCurrentUserId(data?.user?.id || '');
        }
      })
      .catch(() => { if (!cancelled) setAuthed(false); });
    return () => { cancelled = true; };
  }, []);

  // TRADING-PR-2 / PR-Trade-inline: launcher-owned scan filter state (mirrors the
  // dashboard's lifted state + the same localStorage 'scanner-filters' key). The Trade
  // tab now mounts the full ConvergenceIntelligence INLINE (admin-gated), so the scan
  // runs here on the tab — no redirect to /trading.
  const [scannerFilters, setScannerFilters] = useState<ScannerFilters>(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('scanner-filters') : null;
      return saved ? JSON.parse(saved) : DEFAULT_FILTERS;
    } catch { return DEFAULT_FILTERS; }
  });
  const [scannerUniverse, setScannerUniverse] = useState('sp500');
  // PR-Trade-inline: ScanFilterForm's Scan reads scanTriggerRef.current, which the
  // inline ConvergenceIntelligence registers as its scanMarket (mirrors trading/page.tsx
  // :119-120, :867-868). scanningRef mirrors the component's scanning flag.
  const scanTriggerRef = useRef<(() => void) | null>(null);
  const scanningRef = useRef(false);

  const handleFiltersChange = (next: ScannerFilters) => {
    setScannerFilters(next);
    try { localStorage.setItem('scanner-filters', JSON.stringify(next)); } catch {}
  };

  // ── BOOKS-1: cockpit data layer ───────────────────────────────────────────────
  // The BookkeepingCockpitBar needs 10 props, sourced from three ALREADY-AUTHED,
  // user-scoped routes (no new routes): /api/trial-balance, /api/accounts,
  // /api/closing-periods. selectedYear defaults to the current year (no picker in
  // BOOKS-1). TRUTH-FIRST: the cockpit bar's API is plain booleans/numbers with no
  // loading/unknown state, so we do NOT feed it a `?? true` fallback. Instead the
  // section renders a loading OR an explicit error state and only mounts the cockpit
  // bar with REAL numbers when all three fetches succeed and isBalanced is a real
  // boolean. Never fake "Balanced", never fake zeros.
  const [booksYear] = useState(new Date().getFullYear());
  const [booksState, setBooksState] = useState<'loading' | 'error' | 'ok'>('loading');
  const [booksData, setBooksData] = useState<{
    totalAssets: number; totalLiabilities: number; totalEquity: number;
    isBalanced: boolean; connectedAccounts: number; periodStatus: 'open' | 'closed';
  } | null>(null);
  const [booksSyncing, setBooksSyncing] = useState(false);
  // Plaid Link token for onLinkAccount (fetched from the auth-gated /api/plaid/link-token).
  const [booksLinkToken, setBooksLinkToken] = useState<string | null>(null);

  const loadBooksCockpit = useCallback(async () => {
    setBooksState('loading');
    try {
      const [tbRes, accRes, cpRes] = await Promise.all([
        fetch('/api/trial-balance'),
        fetch('/api/accounts'),
        fetch(`/api/closing-periods?year=${booksYear}`),
      ]);
      // Fail-loud: any non-OK response → explicit error state (NOT balanced, NOT zeros).
      if (!tbRes.ok || !accRes.ok || !cpRes.ok) throw new Error('books cockpit fetch failed');
      const tb = await tbRes.json();
      const acc = await accRes.json();
      const cp = await cpRes.json();
      // isBalanced MUST come from the real trial balance — if it's absent, that's an
      // error we surface, never a silent "true".
      if (typeof tb?.totals?.isBalanced !== 'boolean') throw new Error('trial balance missing isBalanced');
      const tbAccounts: any[] = Array.isArray(tb.accounts) ? tb.accounts : []; // eslint-disable-line @typescript-eslint/no-explicit-any
      const sumBy = (type: string) =>
        tbAccounts.filter((a) => a.accountType === type)
          .reduce((s: number, a) => s + Math.abs(Number(a.normalBalance) || 0), 0);
      // connectedAccounts mirrors the dashboard: flatten items[].accounts[] and count.
      const connectedAccounts = (acc.items || [])
        .reduce((n: number, it: any) => n + ((it.accounts || []).length), 0); // eslint-disable-line @typescript-eslint/no-explicit-any
      const month = new Date().getMonth() + 1;
      const periodStatus: 'open' | 'closed' =
        (cp.periods || []).some((p: any) => p.year === booksYear && p.month === month && p.status === 'closed') // eslint-disable-line @typescript-eslint/no-explicit-any
          ? 'closed' : 'open';
      setBooksData({
        totalAssets: sumBy('asset'),
        totalLiabilities: sumBy('liability'),
        totalEquity: sumBy('equity'),
        isBalanced: tb.totals.isBalanced,
        connectedAccounts,
        periodStatus,
      });
      setBooksState('ok');
    } catch {
      setBooksData(null);
      setBooksState('error');
    }
  }, [booksYear]);

  // Load the cockpit (and a Plaid Link token) only for the admin who actually sees the
  // Books surface — guests/non-admins get the stub and fire zero Books fetches.
  useEffect(() => {
    if (!isAdmin) return;
    loadBooksCockpit();
    fetch('/api/plaid/link-token', { method: 'POST' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.link_token) setBooksLinkToken(d.link_token); })
      .catch(() => { /* no token → onLinkAccount guards on it, fail-loud (button no-ops until ready) */ });
  }, [isAdmin, loadBooksCockpit]);

  // onSync — faithful to dashboard/page.tsx:348 (syncAccounts): POST the auth-gated
  // /api/transactions/sync-complete, then re-read the cockpit. No auth weakened.
  const booksSyncAccounts = async () => {
    setBooksSyncing(true);
    try {
      await fetch('/api/transactions/sync-complete', { method: 'POST' });
      await loadBooksCockpit();
    } finally {
      setBooksSyncing(false);
    }
  };

  // onLinkAccount — faithful to dashboard/page.tsx:334 (openPlaidLink): open Plaid Link
  // with the auth-gated link token; on success POST the auth-gated /api/plaid/exchange-token
  // then re-read the cockpit. The dashboard's free-tier upgrade-modal branch is intentionally
  // omitted: this surface is admin-only (isAdmin gate below), so that branch is unreachable
  // here. Guards on token + window.Plaid exactly like the dashboard (no fallback).
  const booksLinkAccount = () => {
    if (!booksLinkToken || !(window as any).Plaid) return; // eslint-disable-line @typescript-eslint/no-explicit-any
    (window as any).Plaid.create({ // eslint-disable-line @typescript-eslint/no-explicit-any
      token: booksLinkToken,
      onSuccess: async (publicToken: string, metadata: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        await fetch('/api/plaid/exchange-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            publicToken,
            institutionId: metadata.institution?.institution_id,
            institutionName: metadata.institution?.name,
            entityId: 'personal',
          }),
        });
        await loadBooksCockpit();
      },
      onExit: () => {},
    }).open();
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
      // PR-Trip-Modal: "Your trips" is the primary view — the create form moved off
      // the top and into a modal opened by the "+ Create a trip" button in the table
      // header (data on the surface; creating on demand). The guest gate is unchanged:
      // gateGuestCreate (onUnauthenticated) opens the sign-up popup for logged-out
      // guests, so a guest's "Create trip" still nudges to register instead of POSTing.
      const createTripButton = (
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="shrink-0 rounded-lg bg-brand-purple px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-purple/90"
        >
          + Create a trip
        </button>
      );
      return (
        <div className="space-y-3">
          {/* PR-HCR-Trips1: the All Trips list is personal — only mounted when logged
              in (same gate as the calendar), so it never fetches for a guest. A new
              trip bumps tripsRefresh, which re-fetches the list in place. The "+ Create
              a trip" button rides in its header (upper-right, next to the count).
              PR-HCR-Trips2: clicking a row sets currentTrip (lifted here), so later
              budget actions know which trip to attach to. */}
          {authed === true ? (
            <>
              <AllTripsList
                refreshSignal={tripsRefresh}
                onSelect={setCurrentTrip}
                selectedTripId={currentTrip?.id ?? null}
                onDeleted={(deletedId) => {
                  // PR-Trips3: refresh the list, and drop the selection if the
                  // deleted trip was the current one (so nothing points at it).
                  setTripsRefresh((n) => n + 1);
                  setCurrentTrip((cur) => (cur?.id === deletedId ? null : cur));
                }}
                headerAction={createTripButton}
              />
              {currentTrip && (
                <p className="text-sm text-text-secondary">
                  Selected: <span className="font-semibold text-brand-purple">{currentTrip.name}</span>
                  <span className="text-text-muted"> — pick a trip to budget flights, hotels, and more into it (coming next).</span>
                </p>
              )}
              {/* PR-Trips5: the selected trip's Budgeted + Actual rows. Only mounted
                  when a trip is picked, so it never fetches with no trip / no login. */}
              {/* Keyed by tripsRefresh so a flight commit (which bumps it via
                  onCommitted) remounts this and re-fetches the budget + actual rows. */}
              {currentTrip && <TripBudgetActual key={tripsRefresh} trip={currentTrip} />}
            </>
          ) : (
            // Guest (or auth still resolving): no personal table to fetch, but the
            // "Your trips" header + button still show so a guest can start one — the
            // create attempt then nudges to sign up (gateGuestCreate), unchanged.
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-lg font-bold text-brand-purple">Your trips</p>
                {createTripButton}
              </div>
              <p className="rounded-lg border border-border bg-bg-row p-4 text-sm text-text-muted">
                Sign up free to save trips here — tap &ldquo;+ Create a trip&rdquo; to start one.
              </p>
            </div>
          )}

          {/* The create form, unchanged, in a centered phone-first modal. On a
              successful create it closes + bumps tripsRefresh so the table re-fetches. */}
          {showCreate && (
            <TripFormModal
              title="Create a trip"
              subtitle="Start a trip and we'll help you plan, book, and budget it — sign up free to save it."
              onClose={() => setShowCreate(false)}
            >
              <CreateTripForm
                onUnauthenticated={gateGuestCreate}
                showHeader={false}
                onCreated={() => {
                  setTripsRefresh((n) => n + 1);
                  setShowCreate(false);
                }}
              />
            </TripFormModal>
          )}
        </div>
      );
    }
    if (m.key === 'projects') {
      // Projects-mount (Option B): authed users get the REAL project builder — the workbench
      // SectionD_ProjectBacklog (self-fetching project list + create form + edit) wrapped in its
      // OperationsEntityProvider (self-fetches /api/entities). Reused VERBATIM — no CRUD rewrite,
      // /operations/projects untouched. This kills the "logged-in kick to login/operations": authed
      // users now author projects inline instead of every click → onRequireAuth. Logged-out KEEPS
      // the rich fetch-free showroom (the marketing demo, unchanged). Auth resolving → nothing.
      // (Styling aligns to the homepage tab contract in PR-Projects-style — terminal for now.)
      if (authed === true) {
        return (
          <OperationsEntityProvider>
            <SectionD_ProjectBacklog />
          </OperationsEntityProvider>
        );
      }
      if (authed === false) {
        return <OperationsPipelineShowroom onRequireAuth={onRequireAuth} />;
      }
      return null; // authed === null → resolving
    }
    if (m.key === 'content') {
      // Content-mount (mirrors Projects-mount, Option B): authed users get the REAL content
      // pipeline — the workbench ContentPipeline (sources → scenify → grid → script, self-fetching
      // the existing /api/operations/content/* routes) wrapped in OperationsEntityProvider. Reused
      // VERBATIM — no rewrite, /operations/content untouched. Logged-out keeps the rich
      // OperationsPipelineShowroom (which already renders the content Day + Script demo panels).
      // Auth resolving → nothing. (Styling aligns in PR-Content-style — terminal for now.)
      if (authed === true) {
        return (
          <OperationsEntityProvider>
            <ContentPipeline />
          </OperationsEntityProvider>
        );
      }
      if (authed === false) {
        return <OperationsPipelineShowroom onRequireAuth={onRequireAuth} />;
      }
      return null; // authed === null → resolving
    }
    if (m.key === 'routines') {
      // HB-4e-mount: authed users get the REAL routine builder — the workbench SectionE_Routines
      // (create form w/ HB-4b COA picker + budget input, self-fetching routine list, edit) wrapped
      // in its OperationsEntityProvider (which self-fetches /api/entities). Reused VERBATIM — no
      // CRUD rewrite, /operations/routines untouched. Logged-out keeps the fetch-free teaser
      // ("create" → login modal). Auth resolving → nothing. (Styling aligns to the homepage tab
      // contract in HB-4e-style — it reads workbench/terminal for now, intentionally.)
      if (authed === true) {
        return (
          <OperationsEntityProvider>
            <SectionE_Routines />
          </OperationsEntityProvider>
        );
      }
      if (authed === false) {
        return <HomeRoutineCreateForm onRequireAuth={onRequireAuth} />;
      }
      return null; // authed === null → resolving
    }
    // TRADE-1: the admin Trade scanner + reconcile surface now lives in its own flush
    // <section> below (mirroring Travel), so it is no longer rendered from renderBody.
    // renderBody('trading') for a non-admin still falls through to the shared paid stub.
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

  // PR-TG1: the Travel ModuleDef, fed to renderBody from Travel's own dedicated block
  // (now that Travel is pulled out of MODULES.map). label/live/blurb are unchanged.
  const travelModule = MODULES.find((m) => m.key === 'travel')!;
  const routinesModule = MODULES.find((m) => m.key === 'routines')!;
  const projectsModule = MODULES.find((m) => m.key === 'projects')!;
  const contentModule = MODULES.find((m) => m.key === 'content')!;
  // TRADE-1: Trade gets its own flush block (below). Non-admins render the shared paid stub
  // via renderBody(tradingModule) — the SAME stub bookkeeping/tax/compliance use — so there
  // is one stub, not a duplicate.
  const tradingModule = MODULES.find((m) => m.key === 'trading')!;
  // BOOKS-1: Books gets its own flush block (below). Non-admins render the shared paid
  // stub via renderBody(bookkeepingModule) — the SAME stub Trade/Tax/Compliance use.
  const bookkeepingModule = MODULES.find((m) => m.key === 'bookkeeping')!;
  // TAX-1: Tax gets its own flush block (below). Non-admins render the shared paid stub
  // via renderBody(taxModule) — the SAME stub Trade/Books/Compliance use.
  const taxModule = MODULES.find((m) => m.key === 'tax')!;
  // COMP-1: Compliance gets its own flush block (below). Non-admins render the shared
  // paid stub via renderBody(complianceModule) — the SAME stub Trade/Books/Tax use.
  const complianceModule = MODULES.find((m) => m.key === 'compliance')!;

  return (
    <>
      {/* PR-Mobile2: bottom padding so the fixed mobile tab bar never covers the last
          content; removed on desktop (md:pb-0), where there is no bar. */}
      <div className="pb-20 md:pb-0">
      {/* PR-Edge-B: the DESKTOP top tab row — desktop only (hidden md:block). It mirrors
          the mobile bottom bar (same TABS, same setActiveModule) so desktop also shows
          one module panel at a time. Sticky so it stays while a panel scrolls. The
          phone uses the bottom bar instead (md:hidden). */}
      <nav className="sticky top-0 z-30 hidden border-b border-border bg-white md:block">
        <div className="max-w-7xl mx-auto flex px-4 lg:px-8">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => selectTab(t.key)}
              aria-current={activeModule === t.key ? 'page' : undefined}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${activeModule === t.key ? 'border-brand-purple text-brand-purple' : 'border-transparent text-text-muted hover:text-text-primary'}`}
            >
              <t.icon className="h-4 w-4" aria-hidden="true" />
              {t.label}
            </button>
          ))}
        </div>
      </nav>
      {/* HOME-PR-7: each module is its own FULL-WIDTH band with an ALTERNATING
          background (white / light-gray bg-bg-row) + generous vertical padding,
          so the six read as distinct breathing sections (the old marketing
          rhythm). The card content + its single purple band header are unchanged —
          the separation comes from the full-width bg, NOT a second purple. */}
      {/* PR-HCR1.1 + PR-HCR-DEMO: the shared master calendar is the TOP of the
          module stack — ABOVE the Travel/Create-trip section and everything else.
          It links across travel, operations, routines, and bookkeeping, so it sits
          first under the hero. Logged in → the real calendar (fetches the viewer's
          data). Logged out → a LIVING DEMO fed a static fictional seed, which
          fetches NOTHING (zero personal-route calls — fake by construction). Auth
          still resolving (authed === null) → nothing. /hub is untouched. */}
      {/* PR-Calendar-Flush: Calendar tab is flush — no purple band, no card chrome (the
          highlighted Calendar tab already says you're here). The grid toolbar sits right
          under the tab row, one continuous surface. Other modules keep their bands. */}
      {authed === true && (
        <section className={`w-full bg-white border-b border-border ${activeModule === 'calendar' ? 'block' : 'hidden'}`}>
          <div className="max-w-7xl mx-auto">
            <HubCalendar />
            {/* PR-HB-1: month-scoped budget section under the calendar (authed only, so the
                logged-out demo below never renders it → no personal data, no fake numbers). */}
            <RunwayDataProvider>
              {/* ONE-BUDGET-TOGGLE: one panel with a Month/Year toggle — shows
                  HubBudgetSection (month) OR BudgetComparison (year) one at a time
                  (RunwayBudgetPanel owns the toggle; neither component is modified). */}
              <RunwayBudgetPanel />
            </RunwayDataProvider>
          </div>
        </section>
      )}
      {authed === false && (
        <section className={`w-full bg-white border-b border-border ${activeModule === 'calendar' ? 'block' : 'hidden'}`}>
          <div className="max-w-7xl mx-auto">
            {/* Guest Runway calendar: a REAL empty grid (no fake demo data). The empty array
                is TRUTHY, so HubCalendar's demo guard stays active — zero authed fetches for a
                guest (HubCalendar.tsx:173,180) — and the grid renders with no events. */}
            <HubCalendar demoEvents={[]} onRequireAuth={onRequireAuth} />
            {/* PR-C: the SAME Runway Budget panel the authed user sees, in PREVIEW mode — renders the
                real empty shells (cash "No bank linked", net burn "—", trading "not tracked", empty
                budget table) and fires ZERO authed fetches (RunwayBudgetPanel guards every fetch on
                `preview`, :187/:198 + budget children). Deliberately NOT wrapped in
                <RunwayDataProvider>: that provider self-fetches the authed budget routes
                (year-calendar/business-budget/nomad-budget) and would 401 for a guest — and it is
                unconsumed (nothing calls useRunwayData), so omitting it is safe. */}
            <RunwayBudgetPanel preview={true} />
          </div>
        </section>
      )}
      {/* PR-TG1: Travel gets its own dedicated block (mirrors the calendar above) — pulled
          OUT of MODULES.map so it sheds the generic purple band + rounded card + wide
          container inset + py-10 gap. It sits FLUSH under the tab row and runs EDGE-TO-EDGE
          full width, same as the calendar (centered max-w only on huge desktop). The
          1-2-3-4 body order (renderBody) is unchanged; the search stack follows. The other
          5 modules stay in MODULES.map with their bands. */}
      <section className={`w-full bg-white border-b border-border ${activeModule === 'travel' ? 'block' : 'hidden'}`}>
        <div className="max-w-7xl mx-auto">
          <div className="px-4 py-4 space-y-6">
            {/* 1·Create-a-trip → 2·Your trips → 3·Budgeted+Actual (renderBody, order
                unchanged). */}
            <div>
              {renderBody(travelModule)}
            </div>

            {/* PR-3: unified destination bar — search once, fill every destination-based
                section below (Transfers, Activities, the unlocked categories). On "Search all"
                we bump a nonce; each section reads {travelCity, travelCountry} and runs its OWN
                search. Flights stay independent (they need origin airport + dates). */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!travelCity.trim() || !travelCountry.trim()) return;
                setTravelSearchNonce((n) => n + 1);
              }}
              className="rounded-lg border border-brand-purple/20 bg-brand-purple/5 p-4 space-y-3"
            >
              <div>
                <p className="text-lg font-bold text-brand-purple">Search your destination</p>
                <p className="text-sm text-text-muted">Search once — fill every section below for your destination.</p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <input
                  type="text"
                  value={travelCountry}
                  onChange={(e) => setTravelCountry(e.target.value)}
                  placeholder="Country (e.g. Portugal)"
                  className={TRAVEL_INPUT_CLASS}
                  aria-label="Destination country"
                />
                <input
                  type="text"
                  value={travelCity}
                  onChange={(e) => setTravelCity(e.target.value)}
                  placeholder="City (e.g. Lisbon)"
                  className={`${TRAVEL_INPUT_CLASS} lg:col-span-2`}
                  aria-label="Destination city"
                />
                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={!travelCity.trim() || !travelCountry.trim()}
                    className={`${TRAVEL_BUTTON_CLASS} w-full`}
                  >
                    Search all
                  </button>
                </div>
              </div>
            </form>

            {/* 4·The search tools, stacked: flights → hotels → [Ground, coming soon] →
                activities → visa (live) → [Insurance, eSIM, Events — coming soon]. The
                live searches keep their own explainers + logic; the ComingSoonSection
                rows are STATIC promises (no fetch/state). */}
            <PublicFlightSearch
              onRequireAuth={onRequireAuth}
              authed={authed}
              currentTrip={currentTrip}
              onCommitted={() => setTripsRefresh((n) => n + 1)}
            />
            <PublicHotelSearch
              onRequireAuth={onRequireAuth}
              authed={authed}
              currentTrip={currentTrip}
              onCommitted={() => setTripsRefresh((n) => n + 1)}
            />
            <PublicTransferSearch
              onRequireAuth={onRequireAuth}
              sharedCity={travelCity}
              sharedCountry={travelCountry}
              searchNonce={travelSearchNonce}
            />
            <PublicActivitySearch
              onRequireAuth={onRequireAuth}
              sharedCity={travelCity}
              sharedCountry={travelCountry}
              searchNonce={travelSearchNonce}
            />
            <PublicVisaCheck />
            <ComingSoonSection
              title="Travel insurance"
              explainer="Cover your trip — medical, delays, lost bags — priced into your budget."
            />
            <ComingSoonSection
              title="Stay connected"
              explainer="Get data the moment you land, no hunting for a SIM."
            />
            <ComingSoonSection
              title="Events"
              explainer="Concerts, shows, and live events wherever you're headed."
            />

            {/* PR-2c: premium divider — a clear free→paid break. The sections above are free;
                the categories below are subscription-gated local discovery. */}
            <div className="mt-12 border-t-2 border-brand-purple/20 pt-8">
              <div className="flex items-baseline gap-x-3">
                <h3 className="text-lg font-bold text-brand-purple">Premium categories</h3>
                <span className="rounded-full bg-brand-purple/10 px-2.5 py-0.5 text-xs font-semibold text-brand-purple">
                  Subscription
                </span>
              </div>
              <p className="mt-1 text-sm text-text-muted">
                Unlock local picks with ratings and prices — subscribe to access.
              </p>
            </div>

            {/* PR-2c: the homepage paid Google categories (HOMEPAGE_PAID_CATEGORIES — a curated
                subset of GOOGLE_CATEGORY_KEYS, gate still covers them). Locked unless entitled:
                admin/entitled → search form; otherwise a 🔒 card that mounts no fetch → zero
                Google spend. The category-search route also gates per-category server-side. */}
            {HOMEPAGE_PAID_CATEGORIES.map((catKey) => (
              <PublicCategorySearch
                key={catKey}
                catKey={catKey}
                entitledCategories={entitledCategories}
                currentUserId={currentUserId}
                onRequireAuth={onRequireAuth}
                sharedCity={travelCity}
                sharedCountry={travelCountry}
                searchNonce={travelSearchNonce}
              />
            ))}
          </div>
        </div>
      </section>
      {/* HB-4e-style: Routines renders in its own FLUSH block (mirrors Calendar/Travel) — out of
          the MODULES.map purple-band card, so the real builder reads as the app, not a demo card.
          renderBody handles the authed-builder / logged-out-teaser branch. */}
      <section className={`w-full bg-white border-b border-border ${activeModule === 'routines' ? 'block' : 'hidden'}`}>
        <div className="max-w-7xl mx-auto">
          <div className="px-4 py-4 lg:px-8 space-y-6">
            {renderBody(routinesModule)}
          </div>
        </div>
      </section>
      {/* Projects-style-1: Projects renders in its own FLUSH block (mirrors Calendar/Travel/
          Routines) — out of the MODULES.map purple-band card, so the authed builder reads as the
          app. renderBody handles the authed-builder / logged-out-showroom branch. */}
      <section className={`w-full bg-white border-b border-border ${activeModule === 'projects' ? 'block' : 'hidden'}`}>
        <div className="max-w-7xl mx-auto">
          <div className="px-4 py-4 lg:px-8 space-y-6">
            {renderBody(projectsModule)}
          </div>
        </div>
      </section>
      {/* Content-mount: Content renders in its own FLUSH block (mirrors Projects/Routines) — out of
          the MODULES.map purple-band card. renderBody handles the authed-pipeline / logged-out-
          showroom branch. */}
      <section className={`w-full bg-white border-b border-border ${activeModule === 'content' ? 'block' : 'hidden'}`}>
        <div className="max-w-7xl mx-auto">
          <div className="px-4 py-4 lg:px-8 space-y-6">
            {renderBody(contentModule)}
          </div>
        </div>
      </section>
      {/* TRADE-1: Trade renders in its own FLUSH block (mirrors Travel/Content) — pulled OUT of
          the MODULES.map purple-band card, so the real scanner + reconcile surface read as the
          app, not a demo card. Active-module check uses the TAB key 'trade' (TABS :88; selectTab
          sets activeModule to the tab key, :167) — same contract as Travel's 'travel'. STRUCTURE
          only; the terminal styling of ScanFilterForm/ConvergenceIntelligence/TradeLabPanel is
          UNCHANGED (that is TRADE-2). Admin gate preserved: only isAdmin sees the real surface;
          everyone else falls through to renderBody(tradingModule) → the shared paid stub. */}
      <section className={`w-full bg-white border-b border-border ${activeModule === 'trade' ? 'block' : 'hidden'}`}>
        <div className="max-w-7xl mx-auto">
          <div className="px-4 py-4 space-y-6">
            {isAdmin ? (
              <>
                {/* LANG-1: disclaimer at the top of the Trade tab (persistent, visible). */}
                <TradingDataDisclaimer />
                {/* Option A — scanner first, reconcile below. Same props the inline branch used. */}
                <ScanFilterForm
                  scannerUniverse={scannerUniverse}
                  setScannerUniverse={setScannerUniverse}
                  scannerFilters={scannerFilters}
                  onFiltersChange={handleFiltersChange}
                  scanTriggerRef={scanTriggerRef}
                  showHeader={false}
                />
                <ConvergenceIntelligence
                  externalFilters={scannerFilters}
                  onFiltersChange={handleFiltersChange}
                  externalUniverse={scannerUniverse}
                  onUniverseChange={setScannerUniverse}
                  hideControls={true}
                  scanTriggerRef={scanTriggerRef}
                  scanningRef={scanningRef}
                />
                {/* TRADE-1: closes the loop — queue viewer + link-to-reality + grade. Self-fetches
                    /api/trade-cards + /api/trade-card-links (0 required props, TradeLabPanel.tsx:50). */}
                <TradeLabPanel />
              </>
            ) : (
              renderBody(tradingModule)
            )}
          </div>
        </div>
      </section>
      {/* BOOKS-1: Books renders in its own FLUSH block (mirrors Travel/Trade) — pulled OUT of
          the MODULES.map purple-band card. Active-module check uses the TAB key 'books'
          (TABS :93; MODULE_TO_TAB bookkeeping→'books' :102; selectTab sets activeModule to the
          tab key). Gated exactly like Trade: isAdmin sees the real surface, everyone else falls
          through to renderBody(bookkeepingModule) → the shared paid stub. STRUCTURE + cockpit +
          drop-ins only; the parent-fed engines are BOOKS-2. */}
      <section className={`w-full bg-white border-b border-border ${activeModule === 'books' ? 'block' : 'hidden'}`}>
        <div className="max-w-7xl mx-auto">
          <div className="px-4 py-4 space-y-6">
            {isAdmin ? (
              <>
                {/* Plaid Link script — loaded only for the admin who sees this surface (guests
                    never pull Plaid). Mirrors dashboard/page.tsx:454. */}
                <Script src="https://cdn.plaid.com/link/v2/stable/link-initialize.js" strategy="lazyOnload" />
                {/* Cockpit — TRUTH-FIRST: loading / explicit-error / real-data only. Never a
                    fake "Balanced" or zeros. */}
                {booksState === 'loading' && (
                  <div className="rounded-xl border-2 border-border bg-white px-4 py-3 text-sm text-text-muted">
                    Loading your books…
                  </div>
                )}
                {booksState === 'error' && (
                  <div role="alert" className="rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between gap-3">
                    <span>Couldn&rsquo;t load your books right now. Nothing is assumed — the balance sheet is hidden until it loads.</span>
                    <button
                      type="button"
                      onClick={loadBooksCockpit}
                      className="shrink-0 rounded-lg border border-red-400 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                    >
                      Retry
                    </button>
                  </div>
                )}
                {booksState === 'ok' && booksData && (
                  <BookkeepingCockpitBar
                    totalAssets={booksData.totalAssets}
                    totalLiabilities={booksData.totalLiabilities}
                    totalEquity={booksData.totalEquity}
                    isBalanced={booksData.isBalanced}
                    connectedAccounts={booksData.connectedAccounts}
                    periodLabel={`${new Date().toLocaleString('en-US', { month: 'long' })} ${booksYear}`}
                    periodStatus={booksData.periodStatus}
                    onSync={booksSyncAccounts}
                    syncing={booksSyncing}
                    onLinkAccount={booksLinkAccount}
                  />
                )}
                {/* BOOKS-2: the full pipe below the cockpit — import → categorize/COA →
                    journal → ledger → trial balance → reconcile → adjusting → statements →
                    wash-sales → close → year-end → positions → CPA export (dashboard order).
                    The 5 BOOKS-1 drop-ins are interleaved inside BooksPipeline at their
                    dashboard positions; the cockpit above keeps its own BOOKS-1 wiring. */}
                <BooksPipeline />
              </>
            ) : (
              renderBody(bookkeepingModule)
            )}
          </div>
        </div>
      </section>
      {/* TAX-1: Tax renders in its own FLUSH block (mirrors Books/Trade). Active-module check
          uses the TAB key 'tax' (TABS :103; MODULE_TO_TAB tax→'tax' :115 — module key and tab
          key both 'tax'; selectTab sets activeModule to the tab key). Gated exactly like
          Books/Trade: isAdmin sees the closed-books handoff gate (wizard once a period is
          closed, else a "close your books first" screen that jumps to the Books tab);
          everyone else falls through to renderBody(taxModule) → the shared paid stub. */}
      <section className={`w-full bg-white border-b border-border ${activeModule === 'tax' ? 'block' : 'hidden'}`}>
        <div className="max-w-7xl mx-auto">
          <div className="px-4 py-4 space-y-6">
            {isAdmin ? (
              <TaxHandoffGate onGoToBooks={() => selectTab('books')} />
            ) : (
              renderBody(taxModule)
            )}
          </div>
        </div>
      </section>
      {/* COMP-1: Compliance renders in its own FLUSH block (mirrors Books/Tax). Active-module
          check uses the TAB key 'compliance' (TABS :107; MODULE_TO_TAB compliance→'compliance'
          :119 — module key and tab key both 'compliance'; selectTab sets activeModule to the tab
          key). Gated exactly like Tax: isAdmin sees the A–J workbench (Section A → sub-page link
          row → Sections B…J, bare — no AppLayout chrome inside the tab); everyone else falls
          through to renderBody(complianceModule) → the shared paid stub. */}
      <section className={`w-full bg-white border-b border-border ${activeModule === 'compliance' ? 'block' : 'hidden'}`}>
        <div className="max-w-7xl mx-auto">
          <div className="px-4 py-4 space-y-6">
            {isAdmin ? (
              <ComplianceWorkbench />
            ) : (
              renderBody(complianceModule)
            )}
          </div>
        </div>
      </section>
      {MODULES.map((m, i) => {
        // PR-TG1: Travel now renders in its own flush, edge-to-edge block above (out of
        // this map, no purple band). Skip it here so it never double-renders. Returning
        // null keeps the index `i` stable for the other modules, so their alternating
        // bg (bg-row / white) is byte-identical to before. HB-4e-style: Routines is now
        // ALSO flush (its own block above) → skip it here too.
        // TRADE-1: 'trading' now renders in its own flush block above → skip here (module key
        // 'trading', not tab key 'trade'). Returning null keeps index `i` stable, so the
        // bg-bg-row/bg-white parity of bookkeeping(i=4)/tax(i=5)/compliance(i=6) is unchanged.
        // BOOKS-1: 'bookkeeping' now renders in its own flush block above → skip here (module
        // key 'bookkeeping', not tab key 'books'). Index `i` stays stable, so the
        // bg-bg-row/bg-white parity of tax(i=5)/compliance(i=6)/content(i=7) is unchanged.
        // TAX-1: 'tax' now renders in its own flush block above → skip here. Index `i` stays
        // stable, so the only remaining band-rendered module (compliance, i=6 → bg-white) is
        // unchanged.
        // COMP-1: 'compliance' now renders in its own flush block above → skip here. With this,
        // every module renders in its own flush block and the band map below renders NOTHING
        // (no module remains → nothing to flip). The map code is left in place intentionally;
        // removing it is a separate cleanup PR.
        if (m.key === 'travel' || m.key === 'routines' || m.key === 'projects' || m.key === 'content' || m.key === 'trading' || m.key === 'bookkeeping' || m.key === 'tax' || m.key === 'compliance') return null;
        return (
        <section key={m.key} className={`w-full py-10 ${i % 2 === 1 ? 'bg-bg-row' : 'bg-white'} border-b border-border ${activeModule === (MODULE_TO_TAB[m.key] ?? m.key) ? 'block' : 'hidden'}`}>
          <div className="max-w-7xl mx-auto px-4 lg:px-8 space-y-6">
            <div className="rounded-lg overflow-hidden border border-gray-200/50 shadow-sm">
              <div className="bg-brand-purple/80 text-white px-4 py-2.5 text-sm font-semibold flex items-center justify-between">
                <span>{m.label}</span>
                <span className="text-[10px] uppercase tracking-wider font-normal text-white/80">
                  {/* HB-4e-mount + Projects-mount: an authed user on Routines OR Projects sees the
                      REAL builder, not a demo — drop the "Live demo" tag for them. Logged-out keeps
                      it (still a showroom/teaser). */}
                  {(m.key === 'routines' || m.key === 'projects') && authed === true ? '' : (m.key === 'projects' || m.key === 'routines' ? 'Live demo · log in to use' : m.live ? 'Free · guest ok' : 'Paid')}
                </span>
              </div>
              <div className="bg-white p-4">
                {renderBody(m)}
              </div>
            </div>
          </div>
        </section>
        );
      })}
      </div>

      {/* PR-Mobile2 + PR-Edge-A: the fixed mobile bottom tab bar — phone only
          (md:hidden), one tab per module. It horizontal-scrolls (overflow-x-auto + a
          hidden scrollbar) so the 7 tabs stay clean and tappable on a narrow phone —
          each tab is a fixed min-w-[64px], never crushed. Desktop uses the top tab row
          instead (PR-Edge-B). Safe-area padding lifts it above the iOS home indicator. */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex overflow-x-auto border-t border-border bg-white pb-[env(safe-area-inset-bottom)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:hidden">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => selectTab(t.key)}
            aria-current={activeModule === t.key ? 'page' : undefined}
            className={`flex min-h-[44px] min-w-[64px] flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-medium transition-colors ${activeModule === t.key ? 'text-brand-purple' : 'text-text-muted'}`}
          >
            <t.icon className="h-5 w-5" aria-hidden="true" />
            {t.label}
          </button>
        ))}
      </nav>
    </>
  );
}
