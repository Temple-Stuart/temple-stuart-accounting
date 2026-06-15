'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import CreateTripForm from '@/components/trips/CreateTripForm';
import AllTripsList, { type TripRow } from '@/components/trips/AllTripsList';
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
  { key: 'operations',  label: 'Operations',  live: false, blurb: 'Routines, daily plan, command center.' },
  { key: 'bookkeeping', label: 'Bookkeeping', live: false, blurb: 'GAAP accounting engine, Plaid bank sync, period close.' },
  { key: 'tax',         label: 'Tax',         live: false, blurb: 'Form 1040, Schedule C/D/SE, Form 8949.' },
  { key: 'compliance',  label: 'Compliance',  live: false, blurb: 'Monitoring, attestations, audit trail.' },
];

// PR-MODULE-INTROS: a short, sellable plain-language intro for each module — what you
// put in, what it does, what comes out, how it maps to your calendar, and a soft
// signup nudge. One array of paragraphs per module key, rendered ABOVE the module's
// body (demo/stub/content). Copy is fixed (5th-grade voice) — render verbatim.
const MODULE_INTROS: Record<string, string[]> = {
  travel: [
    'Type where you want to go, and book your flights from the Duffel API, hotels from LiteAPI, things to do from Viator, and ground transportation from Mozio. Competitive prices, actual times, real data.',
    "You find something you like, you do one of two things: save it as a plan (your budget), or pay for it right now (your actual). That's accounting, sneakily — you just learned it without trying. Either way it drops onto your calendar: the day, the time, what it cost, who got paid, which trip it belongs to. Your hotel shows up check-in to check-out. Your flight shows up wheels-up to wheels-down.",
    "So now you can look at any day and actually see it: here's what I planned, here's what I actually spent. No more 'wait, where did my trip money go.' It's right there.",
    'Make a free account if you want to save your trips.',
  ],
  trading: [
    "Tell the scanner what you're hunting, and it pulls live prices from TastyTrade, company numbers from Finnhub, economy data from FRED, official filings from SEC EDGAR, and the mood online from Grok. Real data, every feed.",
    'It runs all of it through a 12-step gauntlet — volatility, quality, timing, edge — and only the trades that survive come out the other side. You see why it liked each one. No black box.',
    'Every trade you take drops onto your calendar: when you opened it, when you closed it, what it made or lost. So you can look back and actually see your wins and your bleeds, laid out by day.',
    'Make an account to run the scanner on your own watchlist.',
  ],
  operations: [
    "Type the big messy goal that's rattling around your head — plain, rambly, however it actually lives up there. The tool turns that mess into a real plan: the goal, the problem, why it's stuck, and a step-by-step list of small to-dos you can actually finish.",
    'Change your mind? Re-run it. It writes a fresh plan and keeps the old one, so you watch your thinking grow.',
    "Then those to-dos drop onto your calendar with times. A giant scary project becomes 'do this one thing at 2pm.' Small steps, on a calendar, moving.",
    'Make a free account to keep your plans.',
  ],
  bookkeeping: [
    'Connect your bank through Plaid and every transaction flows in. The tool sorts them — income, expense, what category each thing belongs to — using a real double-entry engine, the same kind big firms use, minus the headache.',
    'You get clean books without touching a spreadsheet. What you make, what you spend, where it goes.',
    "And it all drops onto your calendar: not just 'I spent $4,000 this month,' but which day each dollar left, what it bought, and whether you planned for it. Your money, on a timeline, finally making sense.",
    'Make an account to connect your bank.',
  ],
  tax: [
    'Your books are already clean, so your taxes are half-done before you start. The tool takes your real income and expenses and maps them onto the actual forms — the 1040, the Schedule C, the D, the 8949 — as the year goes.',
    "What comes out: a running count of what you'll likely owe, instead of a spring surprise. No shoebox, no last-minute panic, because the work already happened quietly in the background.",
    "It builds on your calendar month by month, so you watch your tax picture grow. (I'm a tool, not your CPA — have a real tax pro check the numbers before you file.)",
    'Make an account to start your year clean.',
  ],
  compliance: [
    "This one's for when things get serious. The tool watches the rules that apply to you — pulled straight from the government's own regulation library — and keeps a clean record of what got done and when. Monitoring, attestations, an audit trail.",
    'What you get: proof. A tidy, timestamped record that you did things right, ready the second someone official asks.',
    'It lives on your calendar with everything else, so your whole world — money, trips, work, rules — sits in one honest timeline.',
    "Made for folks who need to show their work. Make an account when that's you.",
  ],
};

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
  // PR-HCR-Trips1: bumped after a create so the All Trips list re-fetches in place.
  const [tripsRefresh, setTripsRefresh] = useState(0);
  // PR-HCR-Trips2: the selected trip, lifted out of AllTripsList so later budget
  // actions in the Travel section can read which trip they attach to. Selection +
  // context only — no budget writes here.
  const [currentTrip, setCurrentTrip] = useState<TripRow | null>(null);

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
      // PR-T-Layout: the Create-a-trip bar is now the FIRST travel section, with a
      // plain explainer above it; the two live searches follow below (see the
      // MODULES map). The guest Create-trip gate is unchanged — gateGuestCreate
      // (passed as onUnauthenticated) opens the login popup for logged-out guests.
      return (
        <div className="space-y-3">
          <p className="text-sm text-text-muted">
            Start a trip and we&apos;ll help you plan, book, and budget it — sign up free to save it.
          </p>
          <CreateTripForm
            onUnauthenticated={gateGuestCreate}
            showHeader={false}
            onCreated={() => setTripsRefresh((n) => n + 1)}
          />
          {/* PR-HCR-Trips1: the All Trips list is personal — only mounted when logged
              in (same gate as the calendar), so it never fetches for a guest. A new
              trip bumps tripsRefresh, which re-fetches the list in place.
              PR-HCR-Trips2: clicking a row sets currentTrip (lifted here), so later
              budget actions know which trip to attach to. */}
          {authed === true && (
            <>
              <AllTripsList
                refreshSignal={tripsRefresh}
                onSelect={setCurrentTrip}
                selectedTripId={currentTrip?.id ?? null}
              />
              {currentTrip && (
                <p className="text-sm text-text-secondary">
                  Selected: <span className="font-semibold text-brand-purple">{currentTrip.name}</span>
                  <span className="text-text-muted"> — pick a trip to budget flights, hotels, and more into it (coming next).</span>
                </p>
              )}
            </>
          )}
        </div>
      );
    }
    if (m.key === 'operations') {
      // PR E: the FULL locked-but-visible Operations story — Project → Day → Script,
      // three REAL pure views fed static demo seed, every action (incl. the PAID
      // generate-script) bound to onRequireAuth. No live container, no fetch at any
      // depth (PR5–PR10 + guardrail). Safe by construction: nothing to call.
      return <OperationsPipelineShowroom onRequireAuth={onRequireAuth} />;
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
    <>
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
      {authed === true && (
        <section className="w-full py-10 bg-white border-b border-border">
          <div className="max-w-7xl mx-auto px-4 lg:px-8">
            <div className="rounded-lg overflow-hidden border border-gray-200/50 shadow-sm">
              <div className="bg-brand-purple/80 text-white px-4 py-2.5 text-sm font-semibold flex items-center justify-between">
                <span>Calendar</span>
                <span className="text-[10px] uppercase tracking-wider font-normal text-white/80">Your data</span>
              </div>
              <div className="bg-white p-4">
                <HubCalendar />
              </div>
            </div>
          </div>
        </section>
      )}
      {authed === false && (
        <section className="w-full py-10 bg-white border-b border-border">
          <div className="max-w-7xl mx-auto px-4 lg:px-8">
            <div className="rounded-lg overflow-hidden border border-gray-200/50 shadow-sm">
              <div className="bg-brand-purple/80 text-white px-4 py-2.5 text-sm font-semibold flex items-center justify-between">
                <span>Calendar</span>
                <span className="text-[10px] uppercase tracking-wider font-normal text-white/80">Live demo · log in to use</span>
              </div>
              <div className="bg-white p-4">
                <HubCalendar demoEvents={demoCalendar} onRequireAuth={onRequireAuth} />
              </div>
            </div>
          </div>
        </section>
      )}
      {MODULES.map((m, i) => (
        <section key={m.key} className={`w-full py-10 ${i % 2 === 1 ? 'bg-bg-row' : 'bg-white'} border-b border-border`}>
          <div className="max-w-7xl mx-auto px-4 lg:px-8 space-y-6">
            <div className="rounded-lg overflow-hidden border border-gray-200/50 shadow-sm">
              <div className="bg-brand-purple/80 text-white px-4 py-2.5 text-sm font-semibold flex items-center justify-between">
                <span>{m.label}</span>
                <span className="text-[10px] uppercase tracking-wider font-normal text-white/80">
                  {m.key === 'operations' ? 'Live demo · log in to use' : m.live ? 'Free · guest ok' : 'Paid'}
                </span>
              </div>
              <div className="bg-white p-4">
                {MODULE_INTROS[m.key] && (
                  <div className="mb-4 space-y-2 border-b border-border pb-4">
                    {MODULE_INTROS[m.key].map((para, i) => (
                      <p key={i} className="text-sm leading-relaxed text-text-secondary">{para}</p>
                    ))}
                  </div>
                )}
                {renderBody(m)}
              </div>
            </div>
            {/* PR-T-Layout + PR-A3 + PR-T-Placeholders: top-to-bottom travel stack
                is Create-a-trip bar (the card above) → flights → hotels → [Ground,
                coming soon] → activities → [Visa, Insurance, eSIM, Events — coming
                soon]. The live searches keep their own explainers + logic; the
                ComingSoonSection rows are STATIC promises (no fetch/state). */}
            {m.key === 'travel' && <PublicFlightSearch onRequireAuth={onRequireAuth} />}
            {m.key === 'travel' && <PublicHotelSearch onRequireAuth={onRequireAuth} />}
            {/* GROUND placeholder — slots between Hotels and Activities (the live
                ground search, Mozio, lands here in a future PR). */}
            {m.key === 'travel' && (
              <ComingSoonSection
                title="Getting around"
                explainer="Airport rides and transfers, booked and budgeted with your trip."
              />
            )}
            {m.key === 'travel' && <PublicActivitySearch onRequireAuth={onRequireAuth} />}
            {/* PR-V4: the live visa check replaces the "Visas & entry" placeholder.
                Post-Activities order: Visa (live) → Insurance → eSIM → Events. */}
            {m.key === 'travel' && <PublicVisaCheck />}
            {m.key === 'travel' && (
              <ComingSoonSection
                title="Travel insurance"
                explainer="Cover your trip — medical, delays, lost bags — priced into your budget."
              />
            )}
            {m.key === 'travel' && (
              <ComingSoonSection
                title="Stay connected"
                explainer="Get data the moment you land, no hunting for a SIM."
              />
            )}
            {m.key === 'travel' && (
              <ComingSoonSection
                title="Events"
                explainer="Concerts, shows, and live events wherever you're headed."
              />
            )}
          </div>
        </section>
      ))}
    </>
  );
}
