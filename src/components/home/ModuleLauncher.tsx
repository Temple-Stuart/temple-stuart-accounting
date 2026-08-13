'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Script from 'next/script';
import {
  Calendar, Plane, Repeat, FolderKanban, TrendingUp, BookOpen, Receipt, ShieldCheck, Clapperboard, Lock,
  // TRADE-BAND: the trade band-mode icons + the trust-chip check.
  Check,
  type LucideIcon,
} from 'lucide-react';
import { BAND_BG, SECTION_HEADER, STATE } from '@/lib/ds';
import CreateTripForm from '@/components/trips/CreateTripForm';
import TripBookings from '@/components/trips/TripBookings';
import UnattachedBookings from '@/components/trips/UnattachedBookings';
import AllTripsList, { type TripRow } from '@/components/trips/AllTripsList';
import TripFormModal from '@/components/trips/TripFormModal';
import TripBudgetActual from '@/components/trips/TripBudgetActual';
import HubCalendar from '@/components/hub/HubCalendar';
import RunwayDataProvider from '@/components/hub/RunwayDataProvider';
import RunwayBudgetPanel from '@/components/hub/RunwayBudgetPanel';
import MatchReviewSection from '@/components/hub/MatchReviewSection';
import { travelStripModes, TRAVEL_TRUST_CHIPS } from '@/components/trips/travelStripModes';
import PublicCategorySearch from '@/components/trips/PublicCategorySearch';
import { TRAVEL_INPUT_CLASS, TRAVEL_BUTTON_CLASS } from '@/components/trips/travelSection';
import { HOMEPAGE_PAID_CATEGORIES } from '@/lib/categoryKeys';
// DS-1: the travel tab is rebuilt from the design system — the SAME ToggleStrip
// primitive the landing consumes (one strip, chip-selected panels, all mounted).
import ToggleStrip, { type ToggleMode } from '@/components/ui/ToggleStrip';
import ScanFilterForm from '@/components/trading/ScanFilterForm';
// LANG-1: persistent data-not-advice disclaimer, mounted at the top of the Trade tab.
import TradingDataDisclaimer from '@/components/trading/TradingDataDisclaimer';
// RISK-1: coverage declaration — states what has actually synced (self-fetches /api/trading/coverage).
import CoverageDeclaration from '@/components/trading/CoverageDeclaration';
// TRACK-1: the scanner's public track record (claimed vs actual, honest win rate). Self-fetches
// /api/trade-cards + /api/trading/coverage.
import TradeRecord, { type RecordStats } from '@/components/trading/TradeRecord';
// PIPE-FRAME-1: the shared frame components (Trade is the first consumer).
import StageStrip, { type StagePhase } from '@/components/ui/StageStrip';
import SectionHeader from '@/components/ui/SectionHeader';
import ProofStrip from '@/components/ui/ProofStrip';
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
// MOD-2: the decks exited the app — guest/locked tab bodies render the slim
// pointer-card to /modules/<pillar> instead of mounting full decks; the nine
// deck imports (five thesis decks + the four TabShowcases wrappers) are gone.
import ModulePointerCard from '@/components/home/ModulePointerCard';
// HB-4e-mount: the real routine builder (workbench CRUD) + its self-fetching entity provider.
// Logged-out gets the pointer-card to /modules/routines (MOD-2).
import { OperationsEntityProvider } from '@/components/workbench/operations/EntitySelector';
import SectionE_Routines from '@/components/workbench/operations/SectionE_Routines';
// Projects-mount: the real Projects CRUD (Bridgewater backlog). Authed users get this verbatim,
// wrapped in the same self-fetching OperationsEntityProvider as SectionE_Routines; logged-out
// gets the pointer-card to /modules/projects (MOD-2).
import SectionD_ProjectBacklog from '@/components/workbench/operations/SectionD_ProjectBacklog';
// Content-mount: the real content pipeline (sources → scenify → grid → script). Authed users get
// this verbatim, wrapped in the same self-fetching OperationsEntityProvider; logged-out gets the
// pointer-card to /modules/content (MOD-2).
import ContentPipeline from '@/components/workbench/operations/content/ContentPipeline';
// TAB-SHOW-AND-GATE / MOD-3: the per-tab purchase CTA from its own leaf —
// the last transitive deck thread (TabShowcases and its slide-section
// modules) is out of the app graph; locked viewers get pointer-card +
// LockedTabCard.
import { LockedTabCard } from '@/components/home/LockedTabCard';
import { isTabLocked } from '@/lib/categoryLock';
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
// TRADE-BAND: one trust chip — check + a short verified fact, mirroring the
// travel strip's TrustChip (travelStripModes.tsx:68-75) exactly: white/80
// check on the band.
function TradeTrustChip({ fact }: { fact: string }) {
  return (
    <span className="flex items-center gap-1">
      <Check className="h-3.5 w-3.5 shrink-0 text-white/80" strokeWidth={2.5} aria-hidden="true" />
      {fact}
    </span>
  );
}

// TRADE-BAND: the trade band's trust row — VERIFIED FACTS ONLY, the
// TRAVEL_TRUST_CHIPS shape verbatim (travelStripModes.tsx:92-102). Per-chip
// basis: live TastyTrade prices (tastytrade.ts client + api/tastytrade/
// quotes), broker sync (api/tastytrade/positions — the coverage declaration
// beneath states exactly what synced), trades commit to the ledger
// (api/trading/commit-to-ledger), and the LANG-1 data-not-advice stance
// (TradingDataDisclaimer, mounted below this band).
const TRADE_TRUST_CHIPS = (
  <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 font-mono text-[11px] text-white/80">
    <TradeTrustChip fact="Live prices from TastyTrade" />
    <span className="text-white/30" aria-hidden="true">|</span>
    <TradeTrustChip fact="Synced from your broker" />
    <span className="text-white/30" aria-hidden="true">|</span>
    <TradeTrustChip fact="Every trade lands in your books" />
    <span className="text-white/30" aria-hidden="true">|</span>
    <TradeTrustChip fact="Data, not advice" />
  </div>
);

// MODULE-BANDS: the static band — every module tab opens like the home page.
// The ToggleStrip band anatomy (ToggleStrip.tsx:169-177) WITHOUT the mode
// tabs: these modules have no mode state to hoist (SHOT-READY audit). pb-6 =
// BAND-FAT's own visible-apron math (ToggleStrip.tsx:165-168: apron = pb −
// card overlap = 24px; no floating card here, so pb-6 IS that same 24px).
// Chips reuse the TradeTrustChip idiom + separators byte-exact. Renders ABOVE
// each section's lock gate BY RULING — the pitch shows even when locked.
// SHELL-CONNECT: the apron went DEEP (pb-6 → pb-12 sm:pb-14, ToggleStrip.tsx:169
// verbatim) because the content card now pulls up INTO it (MODULE_SHELL_CARD's
// -mt-6 sm:-mt-8 — the strip's :178 overlap), leaving the same 24px visible.
function ModuleBand({ plain, bullets }: { plain: string; bullets: readonly [string, string, string] }) {
  return (
    <div className="rounded-2xl pt-8 px-3 pb-12 sm:pt-10 sm:pb-14" style={{ background: BAND_BG }}>
      <h3 className="text-2xl sm:text-3xl font-bold text-white text-center">{plain}</h3>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 font-mono text-[11px] text-white/80">
        <TradeTrustChip fact={bullets[0]} />
        <span className="text-white/30" aria-hidden="true">|</span>
        <TradeTrustChip fact={bullets[1]} />
        <span className="text-white/30" aria-hidden="true">|</span>
        <TradeTrustChip fact={bullets[2]} />
      </div>
    </div>
  );
}

// MODULE-BANDS copy — byte-exact lockstep copies of the deck's PILLAR_CARDS
// (Landing.tsx:241-318): each card's `plain` = the headline, its 3 `bullets`
// = the ✓ chips. ZERO new strings; a copy change in the deck re-fires here.
const MODULE_BANDS = {
  // TRADE-BAND-WHEN-LOCKED: used ONLY in the locked branch — unlocked keeps
  // its ToggleStrip band (mounting this above the ternary would double the
  // pitch for unlocked viewers; the locked-arm mount is the smaller diff AND
  // keeps the unlocked markup byte-identical).
  trade: {
    plain: 'Find trades worth taking — and get told when to skip.',
    bullets: ['Scanner on live market data', 'Trading journal & realized P&L', 'Eighteen controls, sixteen strategies'],
  },
  runway: {
    plain: 'See how many months your money lasts.',
    bullets: ['Every system you’re juggling', 'Burn: Personal vs. Business', 'Strays surfaced, never dropped'],
  },
  routines: {
    plain: 'Set up a habit once — it lands on your calendar and your budget.',
    bullets: ['Build once, shows up everywhere', 'Executable steps you actually run', 'What’s due, done, slipped'],
  },
  projects: {
    plain: 'Type a goal — get a plan you can actually run.',
    bullets: ['Goals in, audited tasks out', 'AI planning pipeline', 'Capped at 20 runs/day'],
  },
  content: {
    plain: 'Turn what you did today into a ready-to-film script.',
    bullets: ['Your day becomes the script', 'Every step: shot, question, purpose', 'AI script generation (paid)'],
  },
  books: {
    plain: 'Know where every dollar went — synced straight from your bank.',
    bullets: ['Plaid bank sync', 'Double-entry journal & ledger', 'Hand your CPA a package'],
  },
  tax: {
    plain: 'Your return builds itself from your records.',
    bullets: ['1040 estimate from closed books', 'Wash sales + Form 8949', 'CPA export'],
  },
  compliance: {
    plain: 'Every number keeps its receipt — proof you can show later.',
    bullets: ['Regulatory corpus search', 'Citation verification', 'Tamper-evident audit registry'],
  },
} as const;

// SHELL-CONNECT: the straddle card — every module body wears the trade/travel
// band+card anatomy (ToggleStrip.tsx:169/:178/:85). space-y-6 lives INSIDE the
// card (a space-y PARENT would out-specificity the -mt pull and kill the
// overlap); each band+card pair rides in one plain <div> for the same reason.
// APP-GLOW → REPAINT-3: the glow standing-law inverted under Direction C —
// the shell card is FLAT card-cream + lavender hairline (MODULE_SHELL_STYLE
// died with ds.CARD_BG).
const MODULE_SHELL_CARD =
  'relative -mt-6 sm:-mt-8 rounded-xl border border-border bg-ts-white p-4 sm:p-5 space-y-6';

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

// PR-PerTab-Descriptor → FD-1d: the descriptor strings moved to the shared
// leaf module src/lib/tabDescriptors.ts (three consumers: this launcher via
// page.tsx's import, the Landing, the /modules pages — one source, no
// lockstep copies). Re-exported here so page.tsx's existing named import
// keeps working unchanged.
export { TAB_DESCRIPTORS } from '@/lib/tabDescriptors';

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
  // PR-2b: per-category entitlements + user id (server-computed via /api/auth/me). Drive the
  // homepage Travel-tab category-section locks (isCategoryLocked). Logged-out → [] / '' → all
  // 9 sections render locked. Loaded from the SAME auth/me effect below (no extra fetch).
  const [entitledCategories, setEntitledCategories] = useState<string[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
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
  // F2 → ROUTE-1: the active tab lives in the URL as a REAL PATH (/runway,
  // /travel, …) so reload and deep links restore it. Still written with NATIVE
  // history.replaceState — a shallow URL update: no Next.js navigation, no RSC
  // refetch, no scroll jump, no remount (tab panels are CSS block/hidden
  // anyway; the App Router syncs usePathname from native replaceState). Other
  // params + hash survive; any legacy 'tab' param is dropped (the path IS the
  // truth now). CARVE-OUT: 'compliance' keeps the legacy /?tab=compliance URL —
  // /compliance is the standalone cockpit page (static-beats-dynamic; out of
  // ROUTE-1 scope), pending Alex's ruling on the collision.
  const TAB_PATH_BY_KEY: Record<string, string> = {
    calendar: '/runway', travel: '/travel', routines: '/routines',
    projects: '/projects', content: '/content', trade: '/trade',
    books: '/books', tax: '/tax',
  };
  const writeTabParam = (key: string) => {
    const params = new URLSearchParams(window.location.search);
    params.delete('tab');
    let path = TAB_PATH_BY_KEY[key];
    if (!path) {
      // compliance (the carve-out) — legacy param on the root path.
      params.set('tab', key);
      path = '/';
    }
    const qs = params.toString();
    window.history.replaceState(null, '', `${path}${qs ? `?${qs}` : ''}${window.location.hash}`);
  };
  // PR-Hero-PerTab: switch the active tab AND tell the parent, so the hero subhead up top
  // (page.tsx) reflects the same tab. Both tab bars (desktop + mobile) route through this.
  // F2: the same funnel also writes the URL, so state and URL can never drift.
  const selectTab = (key: string) => { setActiveModule(key); onTabChange?.(key); writeTabParam(key); };

  // F2 → ROUTE-1: on mount the URL is the source of truth — the PATH first
  // (/runway → calendar, /travel → travel, …; the [tab] route already 404'd
  // anything else), then the legacy ?tab= param (only reachable on '/' now:
  // the front door 307s every valid param to its real path EXCEPT the
  // compliance carve-out). An invalid leftover param is STRIPPED in place
  // (never a lying URL). Bare '/' → the 'calendar' default stands, URL
  // untouched (the FD-2 front door renders as today). Effect-only read keeps
  // hydration safe: first paint is 'calendar' on server and client alike.
  useEffect(() => {
    const seg = window.location.pathname.split('/')[1] ?? '';
    const fromPath = seg === 'runway' ? 'calendar' : TABS.some((t) => t.key === seg) ? seg : null;
    if (fromPath) { selectTab(fromPath); return; }
    const raw = new URLSearchParams(window.location.search).get('tab');
    if (raw === null) return;
    if (TABS.some((t) => t.key === raw)) selectTab(raw);
    else {
      // Strip the invalid param in place — path and hash stay as they are.
      const params = new URLSearchParams(window.location.search);
      params.delete('tab');
      const qs = params.toString();
      window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me')
      .then(async res => {
        if (cancelled) return;
        setAuthed(res.ok);
        if (res.ok) {
          const data = await res.json().catch(() => null);
          // PR-2b: feed the homepage category-section locks (no extra fetch).
          // TAB-SHOW-AND-GATE: the same payload carries tab:/bundle: entitlement
          // keys (getEntitledCategories returns every active key unfiltered), so
          // the per-tab locks below need no extra endpoint.
          setEntitledCategories(Array.isArray(data?.user?.entitledCategories) ? data.user.entitledCategories : []);
          setCurrentUserId(data?.user?.id || '');
        }
      })
      .catch(() => { if (!cancelled) setAuthed(false); });
    return () => { cancelled = true; };
  }, []);

  // TAB-SHOW-AND-GATE: the four paid-tab locks. isTabLocked is the client twin
  // of hasTabAccess — specific tab key OR bundle:all unlocks; admin (by user id,
  // the same comparison the server's isAdmin used) is never locked. Logged out
  // (entitledCategories=[] and currentUserId='') → locked. FALLBACK TRIPWIRE:
  // there is no default-unlock — no key match means the SHOW surface, always.
  const tradeLocked = isTabLocked('tab:trade', entitledCategories, currentUserId);
  const booksLocked = isTabLocked('tab:books', entitledCategories, currentUserId);
  const taxLocked = isTabLocked('tab:tax', entitledCategories, currentUserId);
  const complianceLocked = isTabLocked('tab:compliance', entitledCategories, currentUserId);

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
    setTradeFiltersTouched(true);
    try { localStorage.setItem('scanner-filters', JSON.stringify(next)); } catch {}
  };

  // ── PIPE-FRAME-1: the Trade stage strip's derived state. Every phase state
  //    derives from audited existing state — never hardcoded:
  //    · SETUP done  ⇐ filters saved before (localStorage 'scanner-filters',
  //      the :381-385 initializer's own source) or touched this session
  //      (handleFiltersChange above);
  //    · SCAN done   ⇐ tradeScanMeta (ConvergenceIntelligence onScanMeta —
  //      fires on scan completion with its own pipeline_summary fields);
  //    · REVIEW      ⇐ no "reviewed" event exists in state — DECLARED GAP:
  //      renders pending unless selected;
  //    · LAB done    ⇐ tradeRecordStats.linkedCount > 0 (TradeRecord
  //      computeRecordStats — links are the lab's output);
  //    · RECORD done ⇐ tradeRecordStats.decidedCount > 0 (graded outcomes).
  //    Active = the user's selection, initialized from the same localStorage
  //    presence (saved filters → land on SCAN; fresh user → SETUP). */
  const [tradePhase, setTradePhase] = useState<'setup' | 'scan' | 'review' | 'lab' | 'record'>(() => {
    try {
      return typeof window !== 'undefined' && localStorage.getItem('scanner-filters') ? 'scan' : 'setup';
    } catch { return 'setup'; }
  });
  const [tradeFiltersTouched, setTradeFiltersTouched] = useState<boolean>(() => {
    try {
      return typeof window !== 'undefined' && !!localStorage.getItem('scanner-filters');
    } catch { return false; }
  });
  const [tradeScanMeta, setTradeScanMeta] = useState<{ completedAt: string | null; runtimeMs: number | null; results: number } | null>(null);
  // RESULTS-ANATOMY: the results table's derived TRADE/SKIP tally (rows with
  // a real card vs stored-rejection rows — ScannerResultsTable's own counts).
  const [tradeTally, setTradeTally] = useState<{ trade: number; skip: number } | null>(null);
  const [tradeRecordStats, setTradeRecordStats] = useState<(RecordStats & { unlinkedClosed: number }) | null>(null);
  const [tradeCoverage, setTradeCoverage] = useState<{ investment_txn_count: number; earliest_txn_date: string | null; latest_txn_date: string | null } | null>(null);

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
    isBalanced: boolean; hasActivity: boolean; connectedAccounts: number; periodStatus: 'open' | 'closed';
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
      // isBalanced + hasActivity MUST come from the real trial balance — if
      // either is absent, that's an error we surface, never a silent "true".
      if (typeof tb?.totals?.isBalanced !== 'boolean' || typeof tb?.totals?.hasActivity !== 'boolean') throw new Error('trial balance missing isBalanced/hasActivity');
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
        hasActivity: tb.totals.hasActivity,
        connectedAccounts,
        periodStatus,
      });
      setBooksState('ok');
    } catch {
      setBooksData(null);
      setBooksState('error');
    }
  }, [booksYear]);

  // Load the cockpit (and a Plaid Link token) only for a viewer who actually sees the
  // Books surface (tab entitled, or admin via the lock helper) — locked viewers get the
  // SHOW surface and fire zero Books fetches.
  useEffect(() => {
    if (booksLocked) return;
    loadBooksCockpit();
    fetch('/api/plaid/link-token', { method: 'POST' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.link_token) setBooksLinkToken(d.link_token); })
      .catch(() => { /* no token → onLinkAccount guards on it, fail-loud (button no-ops until ready) */ });
  }, [booksLocked, loadBooksCockpit]);

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
  // omitted: this surface and the server routes it calls are both tab:books-gated
  // (TAB-SHOW-AND-GATE client-side; TAB-SERVER-GATE flipped /api/plaid/link-token +
  // exchange-token to requireTabAccess('tab:books')) — an unentitled user gets no link
  // token, so this button no-ops. Guards on token + window.Plaid exactly like the
  // dashboard (no fallback).
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
          className="shrink-0 rounded-lg bg-brand-purple px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-purple-hover"
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
                  Selected: <span className="font-semibold text-text-primary">{currentTrip.name}</span>
                  <span className="text-text-faint"> — hotel and flight bookings attach to this trip, and saved flights budget into it.</span>
                </p>
              )}
              {/* T3: the selected trip's REAL bookings (reservations read-back) —
                  above the planned ledger so a user returning from a booking sees
                  it first. Same gate (authed + currentTrip) and the same
                  tripsRefresh key so in-tab commits refetch it; returning from
                  /booking/confirm is a fresh mount (fetch-on-mount covers it). */}
              {currentTrip && (
                <TripBookings
                  key={`bk-${tripsRefresh}`}
                  tripId={currentTrip.id}
                  onChanged={() => setTripsRefresh((n) => n + 1)}
                />
              )}
              {/* PR-Trips5: the selected trip's Budgeted + Actual rows. Only mounted
                  when a trip is picked, so it never fetches with no trip / no login. */}
              {/* Keyed by tripsRefresh so a flight commit (which bumps it via
                  onCommitted) remounts this and re-fetches the budget + actual rows. */}
              {currentTrip && <TripBudgetActual key={tripsRefresh} trip={currentTrip} />}
              {/* T4: the user's adoptable orphans — NOT gated on currentTrip (they
                  exist independently of any selection; the block itself explains
                  how to attach when no trip is picked). Hidden when zero rows.
                  Same tripsRefresh key + bump so attach moves rows into the
                  Booked block above in one refresh. */}
              <UnattachedBookings
                key={`ub-${tripsRefresh}`}
                selectedTrip={currentTrip}
                onChanged={() => setTripsRefresh((n) => n + 1)}
              />
            </>
          ) : (
            // Guest (or auth still resolving): no personal table to fetch, but the
            // create button still shows so a guest can start one — the create
            // attempt then nudges to sign up (gateGuestCreate), unchanged.
            // TRAVEL-RESTRUCTURE dedupe: the inner "Your trips" heading died —
            // the attached panel's SECTION_HEADER above already says it; the
            // button keeps its right-side seat (justify-end).
            <div>
              <div className="mb-2 flex items-center justify-end gap-3">
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
                stacked
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
      // users now author projects inline instead of every click → onRequireAuth. Logged-out gets
      // the pointer-card to /modules/projects (MOD-2). Auth resolving → nothing.
      // (Styling aligns to the homepage tab contract in PR-Projects-style — terminal for now.)
      if (authed === true) {
        return (
          <OperationsEntityProvider>
            <SectionD_ProjectBacklog />
          </OperationsEntityProvider>
        );
      }
      if (authed === false) {
        // MOD-2: the deck lives at /modules/projects — the tab points there.
        return <ModulePointerCard pillarId="projects" />;
      }
      return null; // authed === null → resolving
    }
    if (m.key === 'content') {
      // Content-mount (mirrors Projects-mount, Option B): authed users get the REAL content
      // pipeline — the workbench ContentPipeline (sources → scenify → grid → script, self-fetching
      // the existing /api/operations/content/* routes) wrapped in OperationsEntityProvider. Reused
      // VERBATIM — no rewrite, /operations/content untouched. Logged-out gets the
      // pointer-card to /modules/content (MOD-2).
      // Auth resolving → nothing. (Styling aligns in PR-Content-style — terminal for now.)
      if (authed === true) {
        return (
          <OperationsEntityProvider>
            <ContentPipeline />
          </OperationsEntityProvider>
        );
      }
      if (authed === false) {
        // MOD-2: the deck lives at /modules/content — the tab points there.
        return <ModulePointerCard pillarId="content" />;
      }
      return null; // authed === null → resolving
    }
    if (m.key === 'routines') {
      // HB-4e-mount: authed users get the REAL routine builder — the workbench SectionE_Routines
      // (create form w/ HB-4b COA picker + budget input, self-fetching routine list, edit) wrapped
      // in its OperationsEntityProvider (which self-fetches /api/entities). Reused VERBATIM — no
      // CRUD rewrite, /operations/routines untouched. Logged-out gets the pointer-card to
      // /modules/routines (MOD-2). Auth resolving → nothing. (Authed styling reads workbench/terminal for now, intentionally.)
      if (authed === true) {
        return (
          <OperationsEntityProvider>
            <SectionE_Routines />
          </OperationsEntityProvider>
        );
      }
      if (authed === false) {
        // MOD-2: the deck lives at /modules/routines — the tab points there.
        return <ModulePointerCard pillarId="routines" />;
      }
      return null; // authed === null → resolving
    }
    // TAB-SHOW-AND-GATE: the old "coming soon" paid stub is GONE — it mislabeled
    // live software as unbuilt (FRONTEND-PAYWALL-AUDIT lie #1). Trade/Books/Tax/
    // Compliance now render showcase-or-real in their own flush blocks below;
    // renderBody handles only travel/projects/content/routines, so this is
    // unreachable and returns nothing rather than a false label.
    return null;
  };

  // PR-TG1: the Travel ModuleDef, fed to renderBody from Travel's own dedicated block
  // (now that Travel is pulled out of MODULES.map). label/live/blurb are unchanged.
  const travelModule = MODULES.find((m) => m.key === 'travel')!;
  const routinesModule = MODULES.find((m) => m.key === 'routines')!;
  const projectsModule = MODULES.find((m) => m.key === 'projects')!;
  const contentModule = MODULES.find((m) => m.key === 'content')!;
  // TAB-SHOW-AND-GATE: Trade/Books/Tax/Compliance render in their own flush blocks
  // below — entitled (or admin) → the real module; locked → the SHOW surface + the
  // per-tab "Subscribe to unlock" CTA (TabShowcases). The old per-module stub consts
  // are gone with the stub itself.

  return (
    <>
      {/* PR-Mobile2: bottom padding so the fixed mobile tab bar never covers the last
          content; removed on desktop (md:pb-0), where there is no bar. */}
      <div className="pb-20 md:pb-0">
      {/* PR-Edge-B: the DESKTOP top tab row — desktop only (hidden md:block). It mirrors
          the mobile bottom bar (same TABS, same setActiveModule) so desktop also shows
          one module panel at a time. Sticky so it stays while a panel scrolls. The
          phone uses the bottom bar instead (md:hidden). */}
      {/* SHELL-SPEC (the landing is the spec): the desktop tab bar sits on the
          light shell — bg-white + border-border hairline (HomeClient.tsx:138
          idiom), mono uppercase labels. Active = brand-purple ink + underline;
          inactive = text-muted → text-primary on hover (the ds.ts iconTab
          ink pair). Structure/behavior untouched. */}
      <nav className="sticky top-0 z-30 hidden border-b border-border bg-white md:block">
        <div className="max-w-7xl mx-auto flex px-4 lg:px-8">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => selectTab(t.key)}
              aria-current={activeModule === t.key ? 'page' : undefined}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 font-mono text-xs uppercase tracking-wider transition-colors ${activeModule === t.key ? 'border-brand-purple text-brand-purple' : 'border-transparent text-text-muted hover:text-text-primary'}`}
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
      {/* PR-HCR1.1 + PR-HCR-DEMO: the calendar tab is the TOP of the module
          stack — ABOVE the Travel/Create-trip section and everything else.
          It links across travel, operations, routines, and bookkeeping, so it sits
          first under the hero. Logged in → the real calendar (fetches the viewer's
          data). Logged out → a LIVING DEMO fed a static fictional seed, which
          fetches NOTHING (zero personal-route calls — fake by construction). Auth
          still resolving (authed === null) → nothing. /hub is untouched.
          RUNWAY-UX-1: WITHIN the authed tab the zero-date hero + budget panel
          now lead and the calendar grid follows (order ruling, shape b). */}
      {/* PR-Calendar-Flush: Calendar tab is flush — no purple band, no card chrome (the
          highlighted Calendar tab already says you're here). The grid toolbar sits right
          under the tab row, one continuous surface. Other modules keep their bands. */}
      {authed === true && (
        <section className={`w-full bg-bg-terminal border-b border-border ${activeModule === 'calendar' ? 'block' : 'hidden'}`}>
          <div className="max-w-7xl mx-auto">
            {/* MODULE-BANDS: the deck's own words open the tab. */}
            <div className="px-4 py-4">
              <ModuleBand {...MODULE_BANDS.runway} />
              <div className={MODULE_SHELL_CARD}>
            {/* RUNWAY-UX-1 (order ruling, audit-decided shape b): hero → budget
                tables → calendar. The zero-date HERO STRIP is the tab's
                headline — it renders at the top of RunwayBudgetPanel (the
                component that already owns the /api/runway state; mounting it
                anywhere else would need a second fetch or a state lift). So
                the provider block leads and the calendar follows. PR-HB-1's
                authed-only guard unchanged (the logged-out branch below never
                renders this → no personal data, no fake numbers). */}
            <RunwayDataProvider>
              {/* ONE-BUDGET-TOGGLE: one panel with a Month/Year toggle — shows
                  HubBudgetSection (month) OR BudgetComparison (year) one at a time
                  (RunwayBudgetPanel owns the toggle; neither component is modified). */}
              <RunwayBudgetPanel />
            </RunwayDataProvider>
            {/* PR-MATCH-2: booking↔bank match review — a SIBLING between the
                budget panel and the calendar (no existing panel touched).
                Authed-only by this section's own guard; matching lives in
                Runway per the VISION-AUDIT-1 ruling. */}
            <MatchReviewSection />
            <HubCalendar />
              </div>
            </div>
          </div>
        </section>
      )}
      {authed === false && (
        <section className={`w-full bg-bg-terminal border-b border-border ${activeModule === 'calendar' ? 'block' : 'hidden'}`}>
          <div className="max-w-7xl mx-auto">
            <div className="px-4 py-4 space-y-6">
              <div>
                <ModuleBand {...MODULE_BANDS.runway} />
                <div className={MODULE_SHELL_CARD}>
                  {/* MOD-2: the Runway deck lives at /modules/runway — the guest tab
                      points there instead of mounting it. */}
                  <ModulePointerCard pillarId="runway" />
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
      {/* PR-TG1: Travel gets its own dedicated block (mirrors the calendar above) — pulled
          OUT of MODULES.map so it sheds the generic purple band + rounded card + wide
          container inset + py-10 gap. It sits FLUSH under the tab row and runs EDGE-TO-EDGE
          full width, same as the calendar (centered max-w only on huge desktop). The
          1-2-3-4 body order (renderBody) is unchanged; the search stack follows. The other
          5 modules stay in MODULES.map with their bands. */}
      {/* LOBBY-FIX-1 (readability P0): the travel tab hosts the now-DARK shared
          search strips (PublicFlightSearch/… render bg-white/5 panels with white
          text — BOOK-1b/COMPACT-1). On the old bg-white surface those were
          white-on-white ("can't see shit"). The section surface + the ML-owned
          wrappers/text below flip to the dark panel family (the lobby's own
          classes); the mounted components are NOT restyled — they're correct.
          The trip-management components (AllTripsList/TripBookings/
          TripBudgetActual/UnattachedBookings) are their own light cards and stay
          readable islands (untouched — a separate ruling if full dark parity is
          wanted). */}
      <section className={`w-full bg-bg-terminal border-b border-border ${activeModule === 'travel' ? 'block' : 'hidden'}`}>
        <div className="max-w-7xl mx-auto">
          <div className="px-4 py-4 space-y-6">
            {/* MOD-2 (TRAVEL EXCEPTION): only the deck mount is replaced by the
                pointer-card — the LIVE guest tools below (create-a-trip, the
                search stacks) are NOT decks and stay exactly as-is: the real
                searches work logged-out through PUBLIC_PATHS + the quota guards,
                and per the standing ruling (ToS-obligated + revenue-bearing)
                they must never be walled behind login without a vendor-terms
                review. Auth resolving (null) → no card. */}
            {authed === false && <ModulePointerCard pillarId="travel" />}

            {/* DS-1: the consolidated toggle — the SAME <ToggleStrip> the landing
                consumes (LandingBookingSection). One surface visible at a time, all
                panels mounted (results survive toggling). Five live searches +
                Premium as a sixth chip. Every panel keeps its exact props/handlers
                from the old stacked layout — composition-only, zero logic change. */}
            <ToggleStrip
              // PR-STRIP-DESIGN-2: the same band composition the landing
              // strip wears — one shared component, both surfaces inherit.
              // PR-STRIP-DESIGN-3: + the shared verified trust chips.
              band
              trust={TRAVEL_TRUST_CHIPS}
              modes={([
                // PR-ELEV-1: the 8 shared travel modes (5 live + 3 "Soon") from
                // the ONE builder both surfaces consume — same keys, same
                // panels, same props as the old inline mounts. Premium stays
                // this surface's own chip, appended LAST (it moved from 6th to
                // 9th position — the paid upsell closes the row).
                ...travelStripModes({
                  onRequireAuth,
                  authed,
                  currentTrip,
                  onCommitted: () => setTripsRefresh((n) => n + 1),
                }),
                // PREMIUM (honest label): the paid Google-Places categories. Gate =
                // isCategoryLocked(catKey, entitledCategories, currentUserId)
                // (PublicCategorySearch.tsx:65). Locked → each card renders the
                // EXISTING upgrade path (LockedCategoryCard "Subscribe to unlock" →
                // the real checkout-entitlement flow); entitled/admin → the live
                // search. Copy is the existing PR-2c divider copy, not invented.
                // PR-STRIP-DESIGN-1: the Premium chip joins the icon-tab row
                // (Lock = the paid-gate vocabulary, LockedTabCard precedent);
                // its old in-panel intro line moved UP verbatim as the mode
                // explainer — the Kayak line the shared strip renders.
                { key: 'premium', label: 'Premium',
                  icon: <Lock className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />,
                  headline: 'Unlock local picks.',
                  explainer: 'Subscription — unlock local picks with ratings and prices to access.',
                  panel: (
                  <div className="space-y-3">
                    {HOMEPAGE_PAID_CATEGORIES.map((catKey) => (
                      <PublicCategorySearch
                        key={catKey}
                        catKey={catKey}
                        entitledCategories={entitledCategories}
                        currentUserId={currentUserId}
                        onRequireAuth={onRequireAuth}
                      />
                    ))}
                  </div>
                ) },
              ]) as ToggleMode[]}
            />

            {/* TRAVEL-RESTRUCTURE: TRIP CONTEXT attaches UNDER the booking card —
                the Market-Intelligence-under-scanner anatomy from the trade tab
                (TradeLabPanel.tsx:349: SECTION_HEADER + rounded-t-lg on the
                panel-surface card). renderBody(travelModule) markup is
                byte-identical — only the wrapper moved and gained the house
                header. The destination bar is RETIRED this PR: every panel owns
                its city/country inputs (PublicTransferSearch:48-49 etc.), so the
                bar was a second trigger, not the only one. */}
            <div className="rounded-lg border border-border bg-ts-white">
              <div className={`${SECTION_HEADER} rounded-t-lg`}>YOUR TRIPS</div>
              <div className="p-4">{renderBody(travelModule)}</div>
            </div>

            {/* PR-ELEV-1: the coming-soon tiles became badged "Soon" CHIPS inside
                the strip above (travelStripModes) — the tile row is gone. */}
          </div>
        </div>
      </section>
      {/* HB-4e-style: Routines renders in its own FLUSH block (mirrors Calendar/Travel) — out of
          the MODULES.map purple-band card, so the real builder reads as the app, not a demo card.
          renderBody handles the authed-builder / logged-out pointer-card branch (MOD-2). */}
      <section className={`w-full bg-bg-terminal border-b border-border ${activeModule === 'routines' ? 'block' : 'hidden'}`}>
        <div className="max-w-7xl mx-auto">
          <div className="px-4 py-4 lg:px-8 space-y-6">
            <div>
              <ModuleBand {...MODULE_BANDS.routines} />
              <div className={MODULE_SHELL_CARD}>{renderBody(routinesModule)}</div>
            </div>
          </div>
        </div>
      </section>
      {/* Projects-style-1: Projects renders in its own FLUSH block (mirrors Calendar/Travel/
          Routines) — out of the MODULES.map purple-band card, so the authed builder reads as the
          app. renderBody handles the authed-builder / logged-out-showroom branch. */}
      <section className={`w-full bg-bg-terminal border-b border-border ${activeModule === 'projects' ? 'block' : 'hidden'}`}>
        <div className="max-w-7xl mx-auto">
          <div className="px-4 py-4 lg:px-8 space-y-6">
            <div>
              <ModuleBand {...MODULE_BANDS.projects} />
              <div className={MODULE_SHELL_CARD}>{renderBody(projectsModule)}</div>
            </div>
          </div>
        </div>
      </section>
      {/* Content-mount: Content renders in its own FLUSH block (mirrors Projects/Routines) — out of
          the MODULES.map purple-band card. renderBody handles the authed-pipeline / logged-out-
          showroom branch. */}
      <section className={`w-full bg-bg-terminal border-b border-border ${activeModule === 'content' ? 'block' : 'hidden'}`}>
        <div className="max-w-7xl mx-auto">
          <div className="px-4 py-4 lg:px-8 space-y-6">
            <div>
              <ModuleBand {...MODULE_BANDS.content} />
              <div className={MODULE_SHELL_CARD}>{renderBody(contentModule)}</div>
            </div>
          </div>
        </div>
      </section>
      {/* TRADE-1: Trade renders in its own FLUSH block (mirrors Travel/Content) — pulled OUT of
          the MODULES.map purple-band card, so the real scanner + reconcile surface read as the
          app, not a demo card. Active-module check uses the TAB key 'trade' (TABS :88; selectTab
          sets activeModule to the tab key, :167) — same contract as Travel's 'travel'. STRUCTURE
          only; the terminal styling of ScanFilterForm/ConvergenceIntelligence/TradeLabPanel is
          UNCHANGED (that is TRADE-2). TAB-SHOW-AND-GATE: the gate is the tab:trade
          entitlement (isTabLocked — admin bypass inside); locked viewers get the
          pointer-card + unlock CTA (MOD-2). Server-side the
          scan API is tab:trade-gated too (TAB-SERVER-GATE flipped it off requireAdmin,
          api/trading/convergence/route.ts) — an entitled non-admin's scan runs, with the
          per-user run quota from SCAN-SPEND-QUOTA on top. */}
      {/* TRADE-DS-1 → REPAINT-3: the dark surface passes died — the shared
          workbench components render their light defaults everywhere
          (themed()'s byte-identical light originals). */}
      <section className={`w-full bg-bg-terminal border-b border-border ${activeModule === 'trade' ? 'block' : 'hidden'}`}>
        <div className="max-w-7xl mx-auto">
          <div className="px-4 py-4 space-y-6">
            {!tradeLocked ? (
              <>
                {/* TRADE-UX-1: the tab's sections consolidate on the shared
                    <ToggleStrip> (the travel/books precedent) — one phase
                    visible, ALL mounted (CSS show/hide), so a running scan and
                    the lab queue survive switching. Audit grouping (the sketch's
                    SCAN/RESULTS merged): ScanFilterForm + ConvergenceIntelligence
                    are ONE phase — they're ref-coupled (scanTriggerRef fires the
                    scan the results render; splitting them would hide the
                    results the Scan button produces). Phase selection is
                    ToggleStrip's own state — zero other semantics changed.
                    TRADE-BAND: the strip adopts the travel band anatomy —
                    band + trust props (the LandingBookingSection mount
                    mirrored), icon/headline on each mode. The disclaimers
                    moved directly BELOW the strip (ruled this PR; they stay
                    persistent — outside the strip, every phase — in the
                    quiet idiom), copy byte-identical. */}
                {/* PIPE-FRAME-1: the ratified Pipe Frame — the StageStrip
                    REPLACES the 3-icon-tab ToggleStrip (one phase control,
                    never two). Phase→surface: SETUP/SCAN/REVIEW all activate
                    the existing scan surface (ScanFilterForm + CI, one mount,
                    ref-coupled as before); LAB → TradeLabPanel; RECORD →
                    TradeRecord + CoverageDeclaration. ALL surfaces stay
                    mounted (CSS show/hide — the TRADE-UX-1 survival contract
                    unchanged). The band keeps its exact copy: the scan
                    headline + TRADE_TRUST_CHIPS on the ToggleStrip band
                    anatomy (ToggleStrip.tsx:167-181 shapes, byte-reused); the
                    lab/record per-phase headlines retire (strings in git
                    history). COMMIT is the link chip → the existing
                    selectTab('books') mechanism (:320) — no new routing. */}
                <div className="rounded-2xl pt-8 px-3 pb-12 sm:pt-10 sm:pb-14" style={{ background: BAND_BG }}>
                  <h3 className="text-center text-3xl font-bold tracking-tight text-white sm:text-4xl">
                    Find trades worth taking — and get told when to skip.
                  </h3>
                  <div className="mt-4">{TRADE_TRUST_CHIPS}</div>
                </div>
                <div className={MODULE_SHELL_CARD}>
                  {/* R2 sub-labels — each derived FROM its surface's real
                      machinery (cites in the R2 PR report): SETUP = universe
                      + filter groups (ScanFilterForm); SCAN = fires the
                      convergence pipeline (scanTriggerRef → scanMarket,
                      steps A–T); REVIEW = pick candidates / queue cards
                      (results table + Queue Card — the mock's one truthful
                      candidate); LAB = link to position + check grade
                      (TradeLabPanel's real actions — the mock's "PAPER-TEST"
                      is fiction, replaced); RECORD = the graded results
                      (TradeRecord's W–L/P&L hero — the mock's "GRADE IT"
                      happens in LAB, replaced). */}
                  <StageStrip
                    phases={([
                      { key: 'setup', num: '01', label: 'SETUP', subLabel: 'UNIVERSE + FILTERS',
                        state: tradePhase === 'setup' ? 'active' : tradeFiltersTouched ? 'done' : 'pending' },
                      { key: 'scan', num: '02', label: 'SCAN', subLabel: 'RUN THE PIPELINE',
                        state: tradePhase === 'scan' ? 'active' : tradeScanMeta ? 'done' : 'pending' },
                      { key: 'review', num: '03', label: 'REVIEW', subLabel: 'PICK CANDIDATES',
                        state: tradePhase === 'review' ? 'active' : 'pending' },
                      { key: 'lab', num: '04', label: 'LAB', subLabel: 'LINK + GRADE',
                        state: tradePhase === 'lab' ? 'active' : (tradeRecordStats?.linkedCount ?? 0) > 0 ? 'done' : 'pending' },
                      { key: 'record', num: '05', label: 'RECORD', subLabel: 'GRADED RESULTS',
                        state: tradePhase === 'record' ? 'active' : (tradeRecordStats?.decidedCount ?? 0) > 0 ? 'done' : 'pending' },
                    ] as StagePhase[])}
                    onSelect={(k) => setTradePhase(k as typeof tradePhase)}
                    link={{ num: '06', label: 'COMMIT', chip: 'IN BOOKS →', onClick: () => selectTab('books') }}
                  />

                  {/* 01–03 → the scan surface (one mount, as-is). */}
                  <div className={['setup', 'scan', 'review'].includes(tradePhase) ? 'block space-y-6' : 'hidden'}>
                    <SectionHeader
                      kicker="01 / SCAN CONTROLS"
                      right={`PHASE ${tradePhase === 'setup' ? '01' : tradePhase === 'scan' ? '02' : '03'} OF 06 — ${tradePhase.toUpperCase()}`}
                    />
                    {/* Option A — scanner first, reconcile below. Same props the inline branch used. */}
                    <ScanFilterForm
                      scannerUniverse={scannerUniverse}
                      setScannerUniverse={setScannerUniverse}
                      scannerFilters={scannerFilters}
                      onFiltersChange={handleFiltersChange}
                      scanTriggerRef={scanTriggerRef}
                      showHeader={false}
                    />
                    <SectionHeader
                      kicker="02 / RESULTS"
                      right={[
                        tradeScanMeta?.completedAt
                          ? `COMPLETED ${new Date(tradeScanMeta.completedAt).toLocaleTimeString()}${tradeScanMeta.runtimeMs != null ? ` · ${(tradeScanMeta.runtimeMs / 1000).toFixed(1)}S` : ''}`
                          : null,
                        tradeTally ? `${tradeTally.trade} TRADE · ${tradeTally.skip} SKIP` : null,
                      ].filter(Boolean).join(' — ') || undefined}
                    />
                    <ConvergenceIntelligence
                      externalFilters={scannerFilters}
                      onFiltersChange={handleFiltersChange}
                      externalUniverse={scannerUniverse}
                      onUniverseChange={setScannerUniverse}
                      hideControls={true}
                      scanTriggerRef={scanTriggerRef}
                      scanningRef={scanningRef}
                      onScanMeta={setTradeScanMeta}
                      onResultsTally={setTradeTally}
                    />
                  </div>

                  {/* 04 → the lab. */}
                  <div className={tradePhase === 'lab' ? 'block space-y-6' : 'hidden'}>
                    <SectionHeader kicker="01 / TRADE LAB" right="PHASE 04 OF 06 — LAB" />
                    {/* TRADE-1: closes the loop — queue viewer + link-to-reality + grade. Self-fetches
                        /api/trade-cards + /api/trade-card-links (0 required props, TradeLabPanel.tsx:50). */}
                    <TradeLabPanel />
                  </div>

                  {/* 05 → the record + coverage. */}
                  <div className={tradePhase === 'record' ? 'block space-y-6' : 'hidden'}>
                    <SectionHeader kicker="01 / TRACK RECORD" right="PHASE 05 OF 06 — RECORD" />
                    {/* TRACK-1: the self-graded track record (claimed vs actual). */}
                    <TradeRecord onStats={setTradeRecordStats} />
                    <SectionHeader kicker="02 / COVERAGE" />
                    <CoverageDeclaration onCoverage={setTradeCoverage} />
                  </div>

                  {/* PIPE-FRAME-1: the receipts rail — values ONLY from the
                      wired child state above; absent → the honest empty
                      treatment, never a faked value. */}
                  <ProofStrip
                    receipts={[
                      {
                        label: 'Last scan',
                        value: tradeScanMeta?.completedAt
                          ? `${new Date(tradeScanMeta.completedAt).toLocaleTimeString()}${tradeScanMeta.runtimeMs != null ? ` · ${(tradeScanMeta.runtimeMs / 1000).toFixed(1)}s` : ''}`
                          : undefined,
                        sub: 'pipeline timestamp · this session',
                        emptyLabel: 'no scan yet this session',
                      },
                      {
                        label: 'Results',
                        value: tradeScanMeta ? String(tradeScanMeta.results) : undefined,
                        sub: 'top-ranked tickers, last scan',
                        emptyLabel: 'no scan yet this session',
                      },
                      {
                        label: 'Queued',
                        value: tradeRecordStats ? String(tradeRecordStats.queuedNotLinked) : undefined,
                        sub: 'cards without a linked position',
                        emptyLabel: 'not loaded yet',
                      },
                      {
                        label: 'Realized P&L',
                        value: tradeRecordStats
                          ? `${tradeRecordStats.netPl < 0 ? '-' : '+'}$${Math.abs(Math.round(tradeRecordStats.netPl)).toLocaleString('en-US')}`
                          : undefined,
                        sub: 'decided linked trades only',
                        emptyLabel: 'not loaded yet',
                      },
                      {
                        label: 'Win rate',
                        value: tradeRecordStats && tradeRecordStats.decidedCount > 0
                          ? `${tradeRecordStats.wins}W–${tradeRecordStats.losses}L–${tradeRecordStats.breakevens}BE`
                          : undefined,
                        sub: tradeRecordStats
                          ? `over ${tradeRecordStats.decidedCount} decided · excludes ${tradeRecordStats.openLinked} open, ${tradeRecordStats.unlinkedClosed} unlinked closed`
                          : 'denominator: decided linked trades',
                        emptyLabel: tradeRecordStats ? 'no decided trades yet' : 'not loaded yet',
                      },
                      {
                        label: 'Coverage',
                        value: tradeCoverage ? `${tradeCoverage.investment_txn_count} txns` : undefined,
                        sub: tradeCoverage
                          ? `${(tradeCoverage.earliest_txn_date || '').slice(0, 10)} → ${(tradeCoverage.latest_txn_date || '').slice(0, 10)}`
                          : 'synced broker window',
                        emptyLabel: 'not loaded yet',
                      },
                    ]}
                  />
                </div>
                {/* LANG-1 (TRADE-BAND relocation): the persistent disclaimer —
                    same copy, quiet idiom, every phase. (RISK-1's coverage
                    declaration moved INTO phase 05 per the Pipe Frame.) */}
                <TradingDataDisclaimer />
              </>
            ) : (
              <div>
                <ModuleBand {...MODULE_BANDS.trade} />
                <div className={MODULE_SHELL_CARD}>
                {/* MOD-2: pointer-card to /modules/trade + the surviving purchase
                    path. label/valueLine are VERBATIM lockstep copies of
                    TabShowcases' TradeShowcase cta (extraction = MOD-3). */}
                <ModulePointerCard pillarId="trade" />
                <LockedTabCard
                  tabKey="tab:trade"
                  label="Trading"
                  valueLine="Run live scans on real market data, with the reconcile queue and the self-graded record."
                  currentUserId={currentUserId}
                  onRequireAuth={onRequireAuth}
                />
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
      {/* BOOKS-1: Books renders in its own FLUSH block (mirrors Travel/Trade) — pulled OUT of
          the MODULES.map purple-band card. Active-module check uses the TAB key 'books'
          (TABS :93; MODULE_TO_TAB bookkeeping→'books' :102; selectTab sets activeModule to the
          tab key). TAB-SHOW-AND-GATE: gate is the tab:books entitlement (isTabLocked —
          admin bypass inside); locked viewers get the pointer-card + unlock CTA (MOD-2).
          STRUCTURE + cockpit + drop-ins only; the parent-fed engines are BOOKS-2. */}
      {/* BOOKS-DS-1 → REPAINT-3: the dark surface passes died — the cockpit,
          pipeline, and locked card render their light defaults (themed()'s
          byte-identical light originals). */}
      <section className={`w-full bg-bg-terminal border-b border-border ${activeModule === 'books' ? 'block' : 'hidden'}`}>
        <div className="max-w-7xl mx-auto">
          <div className="px-4 py-4 space-y-6">
            <div>
              <ModuleBand {...MODULE_BANDS.books} />
              <div className={MODULE_SHELL_CARD}>
            {!booksLocked ? (
              <>
                {/* Plaid Link script — loaded only for a viewer who sees this surface (locked
                    viewers never pull Plaid). Mirrors dashboard/page.tsx:454. */}
                <Script src="https://cdn.plaid.com/link/v2/stable/link-initialize.js" strategy="lazyOnload" />
                {/* Cockpit — TRUTH-FIRST: loading / explicit-error / real-data only. Never a
                    fake "Balanced" or zeros. */}
                {booksState === 'loading' && (
                  <div className="rounded-xl border-2 border-border bg-bg-row px-4 py-3 text-sm text-text-muted">
                    Loading your books…
                  </div>
                )}
                {booksState === 'error' && (
                  <div role="alert" className={`${STATE.errorCard} flex items-center justify-between gap-3`}>
                    <span>Couldn&rsquo;t load your books right now. Nothing is assumed — the balance sheet is hidden until it loads.</span>
                    <button
                      type="button"
                      onClick={loadBooksCockpit}
                      className="shrink-0 rounded-lg border border-status-danger/40 px-3 py-1.5 text-xs font-semibold text-status-danger hover:bg-status-danger/10"
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
                    hasActivity={booksData.hasActivity}
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
              <>
                {/* MOD-2: pointer-card to /modules/books + the surviving purchase
                    path. label/valueLine are VERBATIM lockstep copies of
                    TabShowcases' BooksShowcase cta (extraction = MOD-3). */}
                <ModulePointerCard pillarId="books" />
                <LockedTabCard
                  tabKey="tab:books"
                  label="Bookkeeping"
                  valueLine="Your real accounts, synced and closed month after month — GAAP double-entry, not a spreadsheet."
                  currentUserId={currentUserId}
                  onRequireAuth={onRequireAuth}
                />
              </>
            )}
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* TAX-1: Tax renders in its own FLUSH block (mirrors Books/Trade). Active-module check
          uses the TAB key 'tax' (TABS :103; MODULE_TO_TAB tax→'tax' :115 — module key and tab
          key both 'tax'; selectTab sets activeModule to the tab key). TAB-SHOW-AND-GATE:
          gate is the tab:tax entitlement (isTabLocked — admin bypass inside). Entitled →
          the closed-books handoff gate (wizard once a period is closed, else a "close your
          books first" screen that jumps to the Books tab); locked → pointer-card + CTA (MOD-2). */}
      <section className={`w-full bg-bg-terminal border-b border-border ${activeModule === 'tax' ? 'block' : 'hidden'}`}>
        <div className="max-w-7xl mx-auto">
          <div className="px-4 py-4 space-y-6">
            <div>
              <ModuleBand {...MODULE_BANDS.tax} />
              <div className={MODULE_SHELL_CARD}>
            {!taxLocked ? (
              <TaxHandoffGate onGoToBooks={() => selectTab('books')} />
            ) : (
              <>
                {/* MOD-2: pointer-card to /modules/tax + the surviving purchase
                    path. label/valueLine are VERBATIM lockstep copies of
                    TabShowcases' TaxShowcase cta (extraction = MOD-3). */}
                <ModulePointerCard pillarId="tax" />
                <LockedTabCard
                  tabKey="tab:tax"
                  label="Tax"
                  valueLine="Your 1040 estimate and schedules, derived from your actual closed books — plus the CPA-ready export."
                  currentUserId={currentUserId}
                  onRequireAuth={onRequireAuth}
                />
              </>
            )}
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* COMP-1: Compliance renders in its own FLUSH block (mirrors Books/Tax). Active-module
          check uses the TAB key 'compliance' (TABS :107; MODULE_TO_TAB compliance→'compliance'
          :119 — module key and tab key both 'compliance'; selectTab sets activeModule to the tab
          key). TAB-SHOW-AND-GATE: gate is the tab:compliance entitlement (isTabLocked —
          admin bypass inside). Entitled → the A–J workbench (Section A → sub-page link
          row → Sections B…J, bare — no AppLayout chrome inside the tab); locked →
          pointer-card + unlock CTA (MOD-2). */}
      <section className={`w-full bg-bg-terminal border-b border-border ${activeModule === 'compliance' ? 'block' : 'hidden'}`}>
        <div className="max-w-7xl mx-auto">
          <div className="px-4 py-4 space-y-6">
            <div>
              <ModuleBand {...MODULE_BANDS.compliance} />
              <div className={MODULE_SHELL_CARD}>
            {!complianceLocked ? (
              <ComplianceWorkbench />
            ) : (
              <>
                {/* MOD-2: pointer-card to /modules/compliance + the surviving
                    purchase path. label/valueLine are VERBATIM lockstep copies of
                    TabShowcases' ComplianceShowcase cta (extraction = MOD-3). */}
                <ModulePointerCard pillarId="compliance" />
                <LockedTabCard
                  tabKey="tab:compliance"
                  label="Compliance"
                  valueLine="The live workbench: corpus search, citation verification, missions, and the audit registry."
                  currentUserId={currentUserId}
                  onRequireAuth={onRequireAuth}
                />
              </>
            )}
              </div>
            </div>
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
            <div className="rounded-lg overflow-hidden border border-border shadow-sm">
              <div className="bg-brand-purple text-white px-4 py-2.5 text-sm font-semibold flex items-center justify-between">
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
      {/* SHELL-SPEC: the mobile bottom bar sits on the light shell — bg-white +
          border-border hairline; active = brand-purple, inactive = text-muted
          (readable on white; mirrors the desktop bar). */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex overflow-x-auto border-t border-border bg-white pb-[env(safe-area-inset-bottom)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:hidden">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => selectTab(t.key)}
            aria-current={activeModule === t.key ? 'page' : undefined}
            className={`flex min-h-[44px] min-w-[64px] flex-1 flex-col items-center justify-center gap-0.5 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-colors ${activeModule === t.key ? 'text-brand-purple' : 'text-text-muted'}`}
          >
            <t.icon className="h-5 w-5" aria-hidden="true" />
            {t.label}
          </button>
        ))}
      </nav>
    </>
  );
}
