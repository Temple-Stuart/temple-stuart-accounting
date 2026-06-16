'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calendar, Plane, Repeat, FolderKanban, TrendingUp, BookOpen, Receipt, ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import CreateTripForm from '@/components/trips/CreateTripForm';
import AllTripsList, { type TripRow } from '@/components/trips/AllTripsList';
import TripFormModal from '@/components/trips/TripFormModal';
import TripBudgetActual from '@/components/trips/TripBudgetActual';
import HubCalendar from '@/components/hub/HubCalendar';
import { demoCalendar } from '@/components/hub/showroom/demoCalendar';
import PublicFlightSearch from '@/components/trips/PublicFlightSearch';
import PublicHotelSearch from '@/components/trips/PublicHotelSearch';
import PublicActivitySearch from '@/components/trips/PublicActivitySearch';
import PublicVisaCheck from '@/components/trips/PublicVisaCheck';
import ComingSoonSection from '@/components/home/ComingSoonSection';
import ScanFilterForm from '@/components/trading/ScanFilterForm';
import OperationsPipelineShowroom from '@/components/workbench/operations/showroom/OperationsPipelineShowroom';
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
];

// PR-Mobile2 + PR-Edge-A: the phone tabs — ONE per module (no grouping). On mobile one
// panel shows at a time (the bottom bar switches activeModule); on desktop every panel
// stays visible (md:block) and the bar is hidden (md:hidden). The bar horizontal-scrolls
// so 7 tabs stay clean on a narrow phone.
const TABS: { key: string; label: string; icon: LucideIcon }[] = [
  { key: 'calendar',   label: 'Calendar',   icon: Calendar },
  { key: 'travel',     label: 'Travel',     icon: Plane },
  { key: 'routines',   label: 'Routines',   icon: Repeat },
  { key: 'projects',   label: 'Projects',   icon: FolderKanban },
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
  tax: 'tax',
  compliance: 'compliance',
};

// PR-PerTab-Descriptor: one plain descriptor line per tab, shown under the tab row and
// swapped by activeModule (this replaces the old per-panel "How it works" collapsibles).
// Keyed by TAB key (the activeModule values). Calendar + Travel are the lines we wrote;
// the rest are the first sentence of each module's prior intro copy.
export const TAB_DESCRIPTORS: Record<string, string> = {
  calendar: 'Your whole life lands here — trips, projects, routines, trades, and every dollar you plan or spend.',
  travel: 'Book your flights, hotels, things to do, and ground transportation — competitive prices, real times, real data.',
  trade: "Tell the scanner what you're hunting, and it pulls live prices from TastyTrade, company numbers from Finnhub, economy data from FRED, official filings from SEC EDGAR, and the mood online from Grok.",
  routines: 'Build your recurring routines and watch them land on your calendar — the rhythms that run your day.',
  projects: "Type the big messy goal that's rattling around your head — plain, rambly, however it actually lives up there.",
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
  const router = useRouter();
  // Auth state: null = unknown (initial), true/false once /api/auth/me resolves.
  const [authed, setAuthed] = useState<boolean | null>(null);
  // TRADING-PR-2: admin status (server-computed via /api/auth/me isAdmin). The
  // Trading scan is admin-gated (requireAdmin), so only the admin sees the working
  // ScanFilterForm; everyone else keeps the paid stub.
  const [isAdmin, setIsAdmin] = useState(false);
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
      // PR-A-Tabs: the Projects tab keeps the existing Operations project showroom (the
      // component file/path stays 'operations' — backend untouched; this is a home label
      // rename only). Project → Day → Script, fetch-free, every action → onRequireAuth.
      return <OperationsPipelineShowroom onRequireAuth={onRequireAuth} />;
    }
    if (m.key === 'routines') {
      // PR-A-Tabs: placeholder for the new Routines tab. PR-B mounts the real, fetch-free
      // routine builder (home/RoutineCreateForm). Time-block routines only for now.
      return (
        <div>
          <p className="text-sm font-semibold text-text-primary mb-1">Routines</p>
          <p className="text-sm text-text-muted">
            Build recurring routines that land on your calendar — the rhythms that run your day.
            The routine builder lands here next.
          </p>
        </div>
      );
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

  // PR-TG1: the Travel ModuleDef, fed to renderBody from Travel's own dedicated block
  // (now that Travel is pulled out of MODULES.map). label/live/blurb are unchanged.
  const travelModule = MODULES.find((m) => m.key === 'travel')!;

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
          </div>
        </section>
      )}
      {authed === false && (
        <section className={`w-full bg-white border-b border-border ${activeModule === 'calendar' ? 'block' : 'hidden'}`}>
          <div className="max-w-7xl mx-auto">
            <HubCalendar demoEvents={demoCalendar} onRequireAuth={onRequireAuth} />
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
            <ComingSoonSection
              title="Getting around"
              explainer="Airport rides and transfers, booked and budgeted with your trip."
            />
            <PublicActivitySearch onRequireAuth={onRequireAuth} />
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
          </div>
        </div>
      </section>
      {MODULES.map((m, i) => {
        // PR-TG1: Travel now renders in its own flush, edge-to-edge block above (out of
        // this map, no purple band). Skip it here so it never double-renders. Returning
        // null keeps the index `i` stable for the other 5 modules, so their alternating
        // bg (bg-row / white) is byte-identical to before.
        if (m.key === 'travel') return null;
        return (
        <section key={m.key} className={`w-full py-10 ${i % 2 === 1 ? 'bg-bg-row' : 'bg-white'} border-b border-border ${activeModule === (MODULE_TO_TAB[m.key] ?? m.key) ? 'block' : 'hidden'}`}>
          <div className="max-w-7xl mx-auto px-4 lg:px-8 space-y-6">
            <div className="rounded-lg overflow-hidden border border-gray-200/50 shadow-sm">
              <div className="bg-brand-purple/80 text-white px-4 py-2.5 text-sm font-semibold flex items-center justify-between">
                <span>{m.label}</span>
                <span className="text-[10px] uppercase tracking-wider font-normal text-white/80">
                  {m.key === 'projects' || m.key === 'routines' ? 'Live demo · log in to use' : m.live ? 'Free · guest ok' : 'Paid'}
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
