'use client';

/**
 * RUNWAY-SHOWCASE-BLOOMBERG: the logged-out RUNWAY deck — THE THESIS DECK —
 * on the proven Trade/Books/Tax/Projects/Content template, grounded in
 * RUNWAY-FULL-INVENTORY (audit-reports/…, dbd263cf).
 *
 * The story: every number on the Runway tab comes from another module. The
 * deck shows the linkage literally, on the Books-derived example set.
 *
 * THE COMPUTED EXAMPLE SET (inventory §example-scenario — every figure ran
 * through the real formula, runway/route.ts:94-233, by hand):
 *   cash = SUM(accounts.currentBalance) over the Books deck's 3 linked feeds
 *        = 9,400 + 2,500 + 3,100 = $15,000 (accountsLinked 3; the formula
 *        sums stored balances without netting account types — flagged).
 *   6mo window (Jan–Jun) = the Books H1 totals verbatim:
 *        expenses 5,100 − income 8,400 = netBurnTotal −3,300 → −$550/mo
 *        → state 'cashflow_positive' ("Cash-flow positive" / "no burn").
 *   3mo window (Apr–Jun) = the declared seasonal split, consistent with the
 *        Books H1 totals AND the Books deck's June journal (June revenue
 *        $412; Apr 400 + May 388 + Jun 412 = 1,200):
 *        expenses 3,000 − income 1,200 = netBurnTotal 1,800 → $600/mo
 *        → state 'ok' → runway = 15,000 ÷ 600 = 25.0 months
 *        → zero date ≈ today + 25 × 30.436875 d ≈ 2028-08-14.
 *   THE TWO WINDOWS DISAGREE — that is the demo: the half-year says
 *   cash-flow positive; the recent quarter says 25.0 months. Entity split:
 *   the Books set is all Business → Business carries the burn; Personal $0.
 *   Budget (June, Business): three declared MONTHLY budgeted routines —
 *        Commissary rent $400 + Supplies run $300 + Fuel & maintenance $150
 *        = budget $850.00; June actuals 400.00 + 312.45 + 138.20 = $850.65
 *        (variances per the real formula ((actual/budget)−1)×100: 0.0% /
 *        +4.2% / −7.9%; total +0.1%). June actuals sum with Jan–May into the
 *        Books H1 totals (supplies 1,800: Jun 312.45 + Jan–May 1,487.55;
 *        car & truck 900: 138.20 + 761.80; rent 2,400: 400 + 5 × 400).
 *   Drill (Supplies · June): 84.12 (Riverside Roasters — the Books deck's
 *        EXACT June coffee-beans journal entry) + 145.90 + 82.43 = 312.45 ✓.
 *
 * VERBATIM strings carried from the real tab (inventory §disclaimers):
 *   the on-screen formula line (RunwayBudgetPanel.tsx:276-280), the source
 *   labels ("Plaid balance · operating (excl. trading)", "trailing ledger
 *   actuals", "trading ledger, realized (4100 gains − 5100 losses)",
 *   "separate from operating runway"), the four state strings ("No bank
 *   linked" / "Need N full months" / "Cash-flow positive" / "no burn" /
 *   "insufficient history"), the declared-error line, and the locked
 *   cross-sell ("Trade module locked — subscribe on the Trade tab…").
 *
 * CTA RULING (the Projects lesson, checked): categoryKeys.ts:23-28 defines
 * tab:travel/trade/books/tax/operations/compliance — there is NO
 * tab:runway/calendar entitlement, and ModuleLauncher gates this tab by
 * AUTH only (authed → real, guest → this deck). A "Subscribe to unlock"
 * card would advertise a paywall that doesn't exist → the CTA is the honest
 * "Make my free account".
 *
 * MOUNTABILITY (inventory §Phase-2):
 *   • HubCalendar — MOUNTED LIVE on a declared demoEvents seed: the
 *     production-proven truthy-guard (HubCalendar.tsx:173,:180) fires ZERO
 *     fetches and renders the seed; clicking any event opens the REAL
 *     EventDetailPanel (pure props, zero fetch) — the component's own demo
 *     behavior (:224-232). The seed is one coherent example day: Projects
 *     blocks, Routines, a Travel trip — and one block added from Content's
 *     "+ add to day" (both write the same daily-plan tables). NO trade
 *     events (the trade layer is fed by nothing on the live path — banned).
 *   • The populated runway/budget panels have NO data seam (preview yields
 *     only empty shells) → faithful STATIC MIRRORS with per-block
 *     correspondence cites below.
 *   • RunwayDataProvider is dead-but-firing (context unconsumed) — NOT
 *     imported here, deliberately.
 *
 * BANNED (inventory's 10 — zero rendered hits): runway scenario modeling,
 * the Trading budget ("route pending"), capital/drawdown figures, the unfed
 * Trade calendar layer, the inert BUDGET-cell drill (only ACTUAL cells read
 * as clickable here).
 *
 * SHOW discipline: ZERO fetches in this file; all mirror actions → signup.
 */

import HubCalendar from '@/components/hub/HubCalendar';
import type { CalendarEvent as GridEvent } from '@/components/shared/CalendarGrid';
import TabShowcaseTemplate, { ExampleTag } from '@/components/home/TabShowcaseTemplate';

interface Props {
  /** Opens the existing home register/login modal. Never fetches. */
  onRequireAuth: () => void;
}

// ── the computed example set (derivations in the header comment) ─────────────

const EX = {
  cash: 15_000,
  window3: { expenses: 3_000, income: 1_200, netBurnPerMonth: 600, runway: '25.0', zeroDate: 'Aug 14, 2028' },
  window6: { expenses: 5_100, income: 8_400, netBurnPerMonth: -550 },
  budget: {
    rows: [
      { name: 'Rent (Business)', code: '6100', budget: 400, actual: 400.0, variance: 0.0, pct: '0.0%' },
      { name: 'Supplies', code: '6120', budget: 300, actual: 312.45, variance: 12.45, pct: '+4.2%' },
      { name: 'Car & Truck Expenses', code: '6010', budget: 150, actual: 138.2, variance: -11.8, pct: '-7.9%' },
    ],
    totalBudget: 850.0,
    totalActual: 850.65,
  },
  drill: [
    { date: '2026-06-03', merchant: 'Riverside Roasters', desc: 'Coffee beans — bulk', amount: 84.12 },
    { date: '2026-06-12', merchant: 'Harbor Restaurant Supply', desc: 'Packaging & cups', amount: 145.9 },
    { date: '2026-06-24', merchant: 'Riverside Roasters', desc: 'Coffee beans — bulk', amount: 82.43 },
  ],
};

// The tab's REAL on-screen formula line — verbatim (RunwayBudgetPanel.tsx:276-280).
const FORMULA_LINE =
  'Net burn = expenses − income over the trailing full calendar months (trailing ledger actuals); runway = cash ÷ net burn/mo.';

const usd0 = (n: number) => `$${Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const usd2 = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ── the declared example day for the LIVE calendar mount ─────────────────────
// Dated relative to TODAY so the grid's default day view (which opens on
// today) shows the demo immediately. Local-date formatting mirrors
// HubCalendar's own range seeding (:113-116).
const pad = (n: number) => String(n).padStart(2, '0');
function ymd(offsetDays: number): string {
  const t = new Date();
  t.setDate(t.getDate() + offsetDays);
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
}

/** One coherent example day (the Books/Content demo world): Projects blocks
 *  (indigo 🎯 — incl. one added from Content's "+ add to day"; both paths
 *  write the same daily-plan tables), Routines (teal 🔁), and a Travel trip
 *  (cyan ✈️). Shapes follow the real mappers: project events carry the
 *  mapper's "<coa> · $<cost>" detail line (mapOperationsBlocks), routine
 *  events carry isRecurring (mapOperationsRoutines). NO trade events — that
 *  layer has no live source (inventory §NOT-LIVE 4). */
function buildDemoDay(): GridEvent[] {
  const today = ymd(0);
  return [
    { id: 'demo-routine-morning', source: 'routines', title: 'Morning coffee and plan the day', startDate: today, startTime: '07:00', endTime: '07:30', isRecurring: true },
    { id: 'demo-proj-receipts', source: 'project', title: 'Sort the receipts into one folder', startDate: today, startTime: '08:00', endTime: '08:30', details: ['5000 · $0'] },
    { id: 'demo-proj-sales', source: 'project', title: "Type last week's sales into the app", startDate: today, startTime: '09:00', endTime: '10:00', details: ['4000 · $0'] },
    { id: 'demo-routine-truck', source: 'routines', title: 'Prep the truck for the lunch rush', startDate: today, startTime: '10:30', endTime: '11:30', isRecurring: true },
    { id: 'demo-proj-costs', source: 'project', title: 'Add up the food and gas costs', startDate: today, startTime: '14:00', endTime: '14:45', details: ['5000 · $0'] },
    // Added from the Content tab's "+ add to day" — same daily-plan tables.
    { id: 'demo-proj-bank', source: 'project', title: 'Call the bank about the business account', startDate: today, startTime: '16:00', endTime: '16:15', details: ['5000 · $0'] },
    { id: 'demo-trip-festival', source: 'trip', title: 'Portland food-truck festival', startDate: ymd(3), endDate: ymd(5), budgetAmount: 450, location: 'Portland, OR' },
  ];
}

// ── dark slide shell (panel token family, same look as the five prior decks) ─

function DarkSlide({ title, tag = 'Example set', children }: { title: string; tag?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-panel-border bg-panel p-4 font-mono text-[11px] leading-relaxed">
      <div className="flex items-center justify-between gap-2 border-b border-panel-border pb-2">
        <span className="font-bold uppercase tracking-wider text-white/60">{title}</span>
        <ExampleTag text={tag} />
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

// ── HERO ─────────────────────────────────────────────────────────────────────

function RunwayHeroTerminal() {
  return (
    <div className="rounded-lg border border-panel-border bg-panel/90 p-4 font-mono text-[11px] leading-relaxed shadow-2xl">
      <div className="flex items-center justify-between border-b border-panel-border pb-2">
        <span className="font-bold uppercase tracking-wider text-white/60">Runway · the linkage</span>
        <ExampleTag text="Example set" />
      </div>
      {/* The linkage spine (inventory §linkage-map). */}
      <div className="mt-2 space-y-0.5 text-white/70">
        <p><span className="text-white/40">PLAID</span> → cash <span className="float-right text-white">{usd0(EX.cash)}</span></p>
        <p><span className="text-white/40">BOOKS</span> → burn <span className="float-right text-white/80">committed ledger, summed</span></p>
        <p><span className="text-white/40">ROUTINES</span> → budgets <span className="float-right text-white/80">budget × occurrences</span></p>
        <p><span className="text-white/40">TRAVEL</span> → trips <span className="float-right text-white/80">on the calendar + budget</span></p>
        <p><span className="text-white/40">TRADE</span> → its own strip <span className="float-right text-white/80">excluded from runway</span></p>
      </div>
      <p className="mt-2 border-t border-panel-border pt-2">
        <span className="text-white/50">trailing 3mo · </span>
        <span className="text-brand-green">Runway {EX.window3.runway} mo</span>
        <span className="text-white/50"> · zero date </span>
        <span className="text-white">{EX.window3.zeroDate}</span>
      </p>
      <p className="text-[10px] italic text-white/50">{FORMULA_LINE}</p>
    </div>
  );
}

// ── THE 8 SLIDE PANELS (the approved sequence) ───────────────────────────────

/** 1. CASH, FROM YOUR REAL BANKS — mirrors the cash card + its source label
 *  (RunwayBudgetPanel.tsx:262-270; runway/route.ts:94-109). */
function CashPanel() {
  return (
    <DarkSlide title="Cash — the number your banks report">
      <div className="space-y-1 text-white/70">
        <p className="text-white/40">CASH</p>
        <p className="text-lg text-white">{usd0(EX.cash)}</p>
        <p className="text-white/50">Plaid balance · operating (excl. trading) · 3 accounts linked</p>
        <p className="mt-1 border-t border-panel-border pt-1">First Harbor Bank ····4821 <span className="float-right text-white">$9,400</span></p>
        <p>First Harbor Bank ····4839 <span className="float-right text-white">$2,500</span></p>
        <p>Meridian Card Services ····7702 <span className="float-right text-white">$3,100</span></p>
        <p className="border-t border-panel-border pt-1 text-white/50">
          Summed from the same Plaid-synced balances the Books tab links. The Trading entity&rsquo;s
          cash is excluded — at-risk capital is not operating cash. No bank linked? It says
          <span className="text-white/80"> &ldquo;No bank linked&rdquo;</span> — never a fake zero.
        </p>
      </div>
    </DarkSlide>
  );
}

/** 2. BURN, FROM REAL BOOKS — the ledger derivation + the tab's verbatim
 *  formula line (runway/route.ts:123-144; RunwayBudgetPanel.tsx:276-280). */
function BurnPanel() {
  return (
    <DarkSlide title="Burn — your double-entry ledger, summed">
      <div className="space-y-1 text-white/70">
        <p><span className="text-white/40">expenses</span> = ledger debits on expense accounts <span className="float-right text-white/80">committed, non-reversed</span></p>
        <p><span className="text-white/40">income</span> = ledger credits on revenue accounts <span className="float-right text-white/80">same basis</span></p>
        <p><span className="text-white/40">window</span> = trailing FULL calendar months <span className="float-right text-white/80">never year-to-date</span></p>
        <p className="mt-1 border-t border-panel-border pt-1 text-white/80">&ldquo;{FORMULA_LINE}&rdquo;</p>
        <p className="text-white/50">
          That line renders on the real screen, under the real cards. The burn basis is the same
          committed ledger the Books tab closes — the books you keep are the burn you see.
        </p>
      </div>
    </DarkSlide>
  );
}

/** 3. FOUR HONEST STATES — the state machine verbatim (runway/route.ts:31-36,
 *  :197-212; the render strings RunwayBudgetPanel.tsx:82-99,:255-256). */
function StatesPanel() {
  return (
    <DarkSlide title="The runway number — four honest states">
      <div className="space-y-1 text-white/70">
        <p><span className="text-white/40">no_cash</span> <span className="float-right text-white/80">&ldquo;No bank linked&rdquo; — no numerator, no number</span></p>
        <p><span className="text-white/40">insufficient_history</span> <span className="float-right text-white/80">&ldquo;Need 3 full months&rdquo; · &ldquo;insufficient history&rdquo;</span></p>
        <p><span className="text-white/40">cashflow_positive</span> <span className="float-right text-white/80">&ldquo;Cash-flow positive&rdquo; · &ldquo;no burn&rdquo;</span></p>
        <p><span className="text-brand-green">ok</span> <span className="float-right text-white">runway {EX.window3.runway} mo · zero date {EX.window3.zeroDate}</span></p>
        <p className="mt-1 border-t border-panel-border pt-1 text-white/50">
          The number renders ONLY in <span className="text-brand-green">ok</span>. And if the data
          won&rsquo;t load, it declares it: <span className="text-white/80">&ldquo;Runway unavailable —
          could not load cash + burn.&rdquo;</span> Never zeros dressed up as an answer.
        </p>
      </div>
    </DarkSlide>
  );
}

/** 4. TWO WINDOWS THAT CAN DISAGREE — the inventory's computed math (header
 *  comment): 6mo = the Books H1 verbatim → cashflow_positive; 3mo = the
 *  declared seasonal split → ok 25.0 mo. */
function WindowsPanel() {
  return (
    <DarkSlide title="Two windows — and they disagree">
      <div className="space-y-1 text-white/70">
        <p className="text-white/40">TRAILING 6MO <span className="float-right">Jan – Jun</span></p>
        <p>expenses {usd0(EX.window6.expenses)} − income {usd0(EX.window6.income)} <span className="float-right text-brand-green">$550/mo in</span></p>
        <p className="text-brand-green">Cash-flow positive <span className="float-right text-white/50">zero date: no burn</span></p>
        <p className="mt-1 border-t border-panel-border pt-1 text-white/40">TRAILING 3MO <span className="float-right">Apr – Jun</span></p>
        <p>expenses {usd0(EX.window3.expenses)} − income {usd0(EX.window3.income)} <span className="float-right text-brand-red">$600/mo out</span></p>
        <p className="text-white">Runway {EX.window3.runway} mo <span className="float-right">zero date {EX.window3.zeroDate}</span></p>
        <p className="mt-1 border-t border-panel-border pt-1 text-white/50">
          Same books, two honest answers: the half-year was profitable; the recent quarter is
          burning $600 a month. {usd0(EX.cash)} ÷ $600 = 25.0 months. That divergence is why the
          screen shows both windows.
        </p>
      </div>
    </DarkSlide>
  );
}

/** 5. SPLIT BY ENTITY, NOTHING DROPPED — the additive breakdown + the amber
 *  bucket (runway/route.ts:146-194; RunwayBudgetPanel.tsx:128-145). */
function EntityPanel() {
  return (
    <DarkSlide title="Split by entity — nothing dropped">
      <div className="space-y-1 text-white/70">
        <p className="text-white/40">TRAILING 3MO · NET BURN {`$600/mo out`}</p>
        <p><span className="text-white/40">Personal</span> <span className="float-right text-white/80">$0/mo in</span></p>
        <p><span className="text-white/40">Business</span> <span className="float-right text-white">$600/mo out</span></p>
        <p><span className="text-amber-300">Unattributed</span> <span className="float-right text-white/50">— renders amber if any stray entity holds a dollar</span></p>
        <p className="mt-1 border-t border-panel-border pt-1 text-white/50">
          Personal + Business + Unattributed must equal the combined burn — the same filters, grouped
          by entity. A dollar that fits neither is surfaced in amber, never silently dropped. Trading
          is excluded from all of it, by design (slide 8).
        </p>
      </div>
    </DarkSlide>
  );
}

/** 6. BUDGETS FROM YOUR ACTUAL LIFE — routines × occurrences → planned;
 *  ledger actuals; the merchant drill (year-calendar/route.ts:66-139;
 *  HubBudgetSection.tsx:93-113; drill-down/route.ts:50-76). */
function BudgetPanel() {
  return (
    <DarkSlide title="Budgets — your routines ARE the budget">
      <div className="space-y-1 text-white/70">
        <p className="text-white/40">JUN 2026 · BUSINESS <span className="float-right">BUDGET · ACTUAL · VAR%</span></p>
        {EX.budget.rows.map((r) => (
          <p key={r.code}><span className="text-white/50">{r.code}</span> {r.name} <span className="float-right">{usd2(r.budget)} · <span className="text-white">{usd2(r.actual)}</span> · <span className={r.variance > 0 ? 'text-brand-red' : r.variance < 0 ? 'text-brand-green' : 'text-white/60'}>{r.pct}</span></span></p>
        ))}
        <p className="border-t border-panel-border pt-1">Total <span className="float-right text-white">{usd2(EX.budget.totalBudget)} · {usd2(EX.budget.totalActual)} · +0.1%</span></p>
        <p className="mt-1 text-white/50">Planned = your budgeted routines × their occurrences this month — set a $300/mo supplies routine and the budget row exists. Actuals = the committed ledger.</p>
        <p className="mt-1 border-t border-panel-border pt-1 text-white/40">CLICK THE ACTUAL → THE RECEIPTS</p>
        {EX.drill.map((d) => (
          <p key={d.date} className="text-white/50">{d.date} <span className="text-white/80">{d.merchant}</span> <span className="float-right text-white/80">{usd2(d.amount)}</span></p>
        ))}
        <p className="text-brand-green">✓ 3 transactions = {usd2(312.45)} — merchant names straight off the bank feed</p>
      </div>
    </DarkSlide>
  );
}

/** 7. THE WHOLE PLATFORM, ONE CALENDAR — the four layers + their sources
 *  (HubCalendar.tsx:73-88; inventory §5). */
function CalendarPanel() {
  return (
    <DarkSlide title="One calendar — everything you planned everywhere" tag="Example day">
      <div className="space-y-1 text-white/70">
        <p><span className="text-teal-300">🔁 07:00</span> Morning coffee and plan the day <span className="float-right text-white/40">Routines · RRULE</span></p>
        <p><span className="text-indigo-300">🎯 08:00</span> Sort the receipts into one folder <span className="float-right text-white/40">Projects · ↗ schedule</span></p>
        <p><span className="text-indigo-300">🎯 09:00</span> Type last week&rsquo;s sales into the app <span className="float-right text-white/40">Projects</span></p>
        <p><span className="text-teal-300">🔁 10:30</span> Prep the truck for the lunch rush <span className="float-right text-white/40">Routines</span></p>
        <p><span className="text-indigo-300">🎯 16:00</span> Call the bank about the business account <span className="float-right text-white/40">Content · + add to day</span></p>
        <p><span className="text-cyan-300">✈️ +3d</span> Portland food-truck festival <span className="float-right text-white/40">Travel · itinerary</span></p>
        <p className="mt-1 border-t border-panel-border pt-1 text-white/50">
          Projects&rsquo; &ldquo;↗ schedule&rdquo; and Content&rsquo;s &ldquo;+ add to day&rdquo; write the same
          daily-plan blocks; Routines expand from their real recurrence rules; Travel&rsquo;s itinerary
          lands as trip events. One day view, four systems.
        </p>
      </div>
    </DarkSlide>
  );
}

/** 8. TRADING, WALLED OFF ON PURPOSE — the separate strip + the exclusion
 *  (trading/realized-pnl/route.ts:12-16; runway/route.ts:51-65;
 *  RunwayBudgetPanel.tsx:283-294). */
function TradingWallPanel() {
  return (
    <DarkSlide title="Trading — walled off on purpose">
      <div className="space-y-1 text-white/70">
        <p className="text-white/40">TRADING <span className="float-right">separate from operating runway</span></p>
        <p>Realized P&amp;L <span className="float-right text-white/80">trading ledger, realized (4100 gains − 5100 losses)</span></p>
        <p className="text-white/50">Every closed trade posts to the Trading entity&rsquo;s own ledger — a WIN credits 4100, a LOSS debits 5100. That P&amp;L renders here as performance…</p>
        <p className="mt-1 border-t border-panel-border pt-1 text-white/80">…and the SAME entity is excluded from runway cash and burn, by its immutable entity id.</p>
        <p className="text-white/50">Trading money ≠ living money. A hot month never inflates your runway; a drawdown never fakes a burn. The wall is the feature.</p>
      </div>
    </DarkSlide>
  );
}

// ── THE LIVE/MIRROR SECTION ──────────────────────────────────────────────────
//
// Composition (the connective line's claim must equal exactly this):
//   • HubCalendar — REAL, mounted live on the declared example day (the
//     truthy demoEvents guard = zero fetches, HubCalendar.tsx:173,:180);
//     clicking an event opens the REAL EventDetailPanel (pure props, zero
//     fetch) — the component's own demo behavior.
//   • The runway readout, the trading strip, and the budget table + drill —
//     STATIC MIRRORS (the populated panels have no data seam; preview
//     renders only empty shells) with per-block correspondence cites.

function TruthStrip({ real, label }: { real: boolean; label: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-bg-row/60 px-3 py-1.5">
      <span className={`text-[10px] font-bold uppercase tracking-wider ${real ? 'text-brand-green' : 'text-text-muted'}`}>
        {real ? 'Real component — mounted live' : 'Faithful mirror of the real screen'}
      </span>
      <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">{label}</span>
      <ExampleTag text={real ? 'Example day' : 'Example set'} />
    </div>
  );
}

// THE RUNWAY READOUT mirror — RunwayBudgetPanel.tsx:251-281 (cash card
// :262-270, window cards via RunwayWindowCard :111-147, the formula line
// :276-280), populated with the computed set.
function RunwayReadoutMirror() {
  return (
    <div className="px-4 py-3">
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Cash card — mirrors :262-270 (source label verbatim). */}
        <div className="flex-1 min-w-[180px] rounded-lg border border-border bg-bg-row/40 px-3 py-2">
          <div className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Cash</div>
          <div className="mt-1 font-mono text-lg text-text-primary tabular-nums">{usd0(EX.cash)}</div>
          <div className="text-[10px] text-text-faint mt-0.5">Plaid balance · operating (excl. trading) · as of Jul 15, 2026</div>
        </div>
        {/* Trailing 3mo — mirrors RunwayWindowCard :111-147, state 'ok'
            (:83-85): runway + zero date render. Entity split :128-145. */}
        <div className="flex-1 min-w-[180px] rounded-lg border border-border bg-bg-row/40 px-3 py-2">
          <div className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Trailing 3mo</div>
          <div className="mt-1 flex items-baseline justify-between gap-2"><span className="text-xs text-text-muted">Net burn</span><span className="font-mono text-sm text-text-primary tabular-nums">$600/mo out</span></div>
          <div className="flex items-baseline justify-between gap-2"><span className="text-xs text-text-muted">Runway</span><span className="font-mono text-sm text-text-primary tabular-nums">25.0 mo</span></div>
          <div className="flex items-baseline justify-between gap-2"><span className="text-xs text-text-muted">Zero date</span><span className="font-mono text-sm text-text-primary tabular-nums">{EX.window3.zeroDate}</span></div>
          <div className="mt-1.5 pt-1.5 border-t border-border-light space-y-0.5">
            <div className="flex items-baseline justify-between gap-2"><span className="text-[10px] text-text-faint uppercase tracking-wide">Personal</span><span className="font-mono text-xs text-text-secondary tabular-nums">$0/mo in</span></div>
            <div className="flex items-baseline justify-between gap-2"><span className="text-[10px] text-text-faint uppercase tracking-wide">Business</span><span className="font-mono text-xs text-text-secondary tabular-nums">$600/mo out</span></div>
          </div>
        </div>
        {/* Trailing 6mo — state 'cashflow_positive' (:87-89): the real
            strings "Cash-flow positive" / "no burn"; burn shows "/mo in". */}
        <div className="flex-1 min-w-[180px] rounded-lg border border-border bg-bg-row/40 px-3 py-2">
          <div className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Trailing 6mo</div>
          <div className="mt-1 flex items-baseline justify-between gap-2"><span className="text-xs text-text-muted">Net burn</span><span className="font-mono text-sm text-text-primary tabular-nums">$550/mo in</span></div>
          <div className="flex items-baseline justify-between gap-2"><span className="text-xs text-text-muted">Runway</span><span className="font-mono text-sm text-text-primary tabular-nums">Cash-flow positive</span></div>
          <div className="flex items-baseline justify-between gap-2"><span className="text-xs text-text-muted">Zero date</span><span className="font-mono text-sm text-text-primary tabular-nums">no burn</span></div>
          <div className="mt-1.5 pt-1.5 border-t border-border-light space-y-0.5">
            <div className="flex items-baseline justify-between gap-2"><span className="text-[10px] text-text-faint uppercase tracking-wide">Personal</span><span className="font-mono text-xs text-text-secondary tabular-nums">$0/mo in</span></div>
            <div className="flex items-baseline justify-between gap-2"><span className="text-[10px] text-text-faint uppercase tracking-wide">Business</span><span className="font-mono text-xs text-text-secondary tabular-nums">$550/mo in</span></div>
          </div>
        </div>
      </div>
      {/* The formula line — verbatim (:276-280). */}
      <p className="text-[10px] text-text-faint mt-1">{FORMULA_LINE}</p>
    </div>
  );
}

// THE TRADING STRIP mirror — RunwayBudgetPanel.tsx:283-294: the header +
// "separate from operating runway" + the REAL locked cross-sell string (a
// logged-out viewer's truthful analog; the zero-state alternative is noted
// in the inventory).
function TradingStripMirror() {
  return (
    <div className="px-4 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Trading</h3>
        <span className="text-[10px] text-text-faint">separate from operating runway</span>
      </div>
      <p className="text-xs text-text-muted italic mt-1">
        Trade module locked — subscribe on the Trade tab to see realized P&amp;L here.
      </p>
    </div>
  );
}

// THE BUDGET TABLE + DRILL mirror — HubBudgetSection.tsx:117-231 (toggles
// :142-157, table :171-230, variance coloring :197-206) + BudgetDrillDown
// (the ledger rows with merchant names, drill-down/route.ts:50-76).
function BudgetMirror({ lock }: { lock: () => void }) {
  return (
    <div className="px-4 py-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-text-primary tracking-tight">Budget</h2>
          <p className="text-xs text-text-muted mt-0.5">Jun 2026 · Budget vs Actual · USD</p>
        </div>
        {/* 4-toggle — mirrors :142-157; Business active. */}
        <div className="flex flex-wrap gap-1.5">
          {['Personal', 'Business', 'Travel', 'Trading'].map((label) => (
            <button key={label} type="button" onClick={lock} className={`text-xs px-3 py-1 rounded border transition-colors font-medium ${label === 'Business' ? 'bg-brand-purple text-white border-brand-purple' : 'text-text-secondary border-border hover:bg-bg-row'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {/* Table — mirrors :171-230. Only ACTUAL cells read clickable (:190-196
          — the BUDGET drill is inert in the real product, banned to imply). */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border text-xs text-text-faint">
              <th className="py-2 px-3 text-left font-medium">Category</th>
              <th className="py-2 px-3 text-left font-medium">COA</th>
              <th className="py-2 px-3 text-right font-medium">Budget</th>
              <th className="py-2 px-3 text-right font-medium">Actual</th>
              <th className="py-2 px-3 text-right font-medium">Variance %</th>
            </tr>
          </thead>
          <tbody>
            {EX.budget.rows.map((r) => (
              <tr key={r.code} className="border-b border-border-light">
                <td className="py-1.5 px-3 text-text-primary">{r.name}</td>
                <td className="py-1.5 px-3 font-mono text-xs text-text-muted">{r.code}</td>
                <td className="py-1.5 px-3 text-right font-mono tabular-nums text-text-secondary">{usd2(r.budget)}</td>
                <td className="py-1.5 px-3 text-right font-mono tabular-nums cursor-pointer hover:underline text-text-primary" onClick={lock}>{usd2(r.actual)}</td>
                <td className={`py-1.5 px-3 text-right font-mono tabular-nums ${r.variance > 0 ? 'text-rose-600' : r.variance < 0 ? 'text-emerald-600' : 'text-text-secondary'}`}>{r.pct}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border font-semibold">
              <td className="py-2 px-3 text-text-primary" colSpan={2}>Total</td>
              <td className="py-2 px-3 text-right font-mono tabular-nums text-text-primary">{usd2(EX.budget.totalBudget)}</td>
              <td className="py-2 px-3 text-right font-mono tabular-nums text-text-primary">{usd2(EX.budget.totalActual)}</td>
              <td className="py-2 px-3 text-right font-mono tabular-nums text-rose-600">+0.1%</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {/* The drill — mirrors BudgetDrillDown's transaction list (merchant
          from the Plaid transaction joined via je.source_id). Supplies · Jun:
          84.12 + 145.90 + 82.43 = 312.45 ✓ (84.12 = the Books deck's exact
          June coffee-beans entry). */}
      <div className="rounded-lg border border-border bg-bg-row/30 p-3">
        <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">Supplies · Jun 2026 — the transactions behind the actual</div>
        {EX.drill.map((d) => (
          <div key={`${d.date}-${d.amount}`} className="flex items-center justify-between py-0.5 text-xs">
            <span><span className="font-mono text-text-muted">{d.date}</span> <span className="text-text-primary">{d.merchant}</span> <span className="text-text-muted">· {d.desc}</span></span>
            <span className="font-mono text-text-primary">{usd2(d.amount)}</span>
          </div>
        ))}
        <div className="mt-1 border-t border-border pt-1 flex items-center justify-between text-xs font-semibold">
          <span className="text-text-secondary">3 transactions</span>
          <span className="font-mono text-text-primary">{usd2(312.45)}</span>
        </div>
      </div>
      <p className="text-xs text-text-muted">
        Planned figures come from your budgeted routines (amount × occurrences each month); actuals
        come from the committed ledger; the drill shows the bank-fed merchants behind every number.
      </p>
    </div>
  );
}

function LiveRunwaySection({ onRequireAuth }: Props) {
  const lock = () => onRequireAuth();
  return (
    <div className="space-y-4">
      {/* THE CALENDAR — REAL, live on the declared example day. The truthy
          demoEvents guard fires ZERO fetches (HubCalendar.tsx:173,:180);
          clicking any event opens the REAL EventDetailPanel (pure props). */}
      <div className="rounded-lg border border-border bg-white overflow-hidden">
        <TruthStrip real={true} label="The whole platform, one calendar — click any event" />
        <HubCalendar demoEvents={buildDemoDay()} onRequireAuth={onRequireAuth} />
      </div>

      <div className="rounded-lg border border-border bg-white overflow-hidden">
        <TruthStrip real={false} label="The runway readout — cash · two windows · entity split" />
        <RunwayReadoutMirror />
      </div>

      <div className="rounded-lg border border-border bg-white overflow-hidden">
        <TruthStrip real={false} label="Trading — separate, by design" />
        <TradingStripMirror />
      </div>

      <div className="rounded-lg border border-border bg-white overflow-hidden">
        <TruthStrip real={false} label="Budget vs actual — with the receipts" />
        <BudgetMirror lock={lock} />
      </div>

      <p className="text-xs text-text-muted">
        The calendar above is the real component mounted live on a declared example day — its
        zero-fetch demo guard is the same one production uses, and clicking an event opens the real
        read-only detail panel. The runway readout, the trading strip, and the budget table are
        faithful static mirrors of the real screens rendering the same computed example set, labeled
        on their faces. Nothing on this page fetches; the mirrors&rsquo; actions route to sign-up.
      </p>
    </div>
  );
}

// ── CTA — the HONEST unlock (ruling in the header comment): free account. ───

function FreeAccountCta({ onRequireAuth }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-brand-purple/15 bg-bg-row px-6 py-8 text-center">
      <div className="space-y-1">
        <p className="text-base font-bold text-text-primary">Runway — built and running</p>
        <p className="text-sm text-text-muted">
          Free with your account — link your banks, keep your books, and the runway computes itself.
        </p>
      </div>
      <button
        type="button"
        onClick={onRequireAuth}
        className="rounded-lg bg-brand-purple px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-purple/90"
      >
        Make my free account
      </button>
    </div>
  );
}

// ── THE DECK ─────────────────────────────────────────────────────────────────

export default function RunwayShowcase({ onRequireAuth }: Props) {
  return (
    <TabShowcaseTemplate
      darkHero={{
        eyebrow: 'Runway — the whole platform, one question',
        headline: 'Every system you’re juggling. One question answered: how long can you keep going?',
        subcopy:
          'Founders drown in disconnected systems — banking here, books there, budgets in a spreadsheet, travel and trading somewhere else. Here they feed one tab: your banks supply the cash, your ledger supplies the burn, your routines supply the budget, and the runway number is computed honestly — or it tells you exactly why it can’t be.',
        cta: (
          <button
            type="button"
            onClick={onRequireAuth}
            className="rounded-lg bg-brand-purple px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-purple-hover"
          >
            Make my free account
          </button>
        ),
        panel: <RunwayHeroTerminal />,
      }}
      editorialTitle="Go further with the Runway tab"
      editorialRows={[
        {
          title: 'Not a number you typed — the number your banks report.',
          copy:
            'Cash is the sum of your Plaid-linked account balances, operating accounts only. The trading account is excluded on purpose, and if no bank is linked the screen says so instead of showing a zero it can’t stand behind.',
          panel: <CashPanel />,
          panelSide: 'left',
        },
        {
          title: 'Burn isn’t estimated. It’s your double-entry ledger, summed.',
          copy:
            'Expenses are your committed ledger debits; income is your committed credits; the window is trailing full calendar months, never a misleading year-to-date. The formula prints right on the screen — the same sentence, every day.',
          panel: <BurnPanel />,
          panelSide: 'right',
        },
        {
          title: 'If it can’t compute honestly, it says so.',
          copy:
            'Four states, one of which earns a number. No bank linked, not enough history, or cash-flow positive — each declares itself in plain words. A runway figure appears only when the division is real.',
          panel: <StatesPanel />,
          panelSide: 'left',
        },
        {
          title: 'Recent months tell a different story than the half-year — so it shows you both.',
          copy:
            'On the example books the trailing six months are cash-flow positive, but the recent quarter burns $600 a month — twenty-five months of runway. One window would have hidden the turn. Two make you look at it.',
          panel: <WindowsPanel />,
          panelSide: 'right',
        },
        {
          title: 'Every dollar attributed — or flagged amber. Never silently dropped.',
          copy:
            'The burn splits into Personal and Business, and the pieces must add back to the whole. Anything that fits neither shows up as an amber "Unattributed" line — the reconciliation is on the screen, not in a footnote.',
          panel: <EntityPanel />,
          panelSide: 'left',
        },
        {
          title: 'Your routines ARE the budget.',
          copy:
            'A budgeted routine — rent, supplies, fuel — becomes the plan: amount times occurrences, month by month. Actuals come from the committed ledger, and clicking one opens the bank-fed merchants behind it. Plan from life, actuals from books, receipts from the feed.',
          panel: <BudgetPanel />,
          panelSide: 'right',
        },
        {
          title: 'Everything you planned everywhere, on one day view.',
          copy:
            'Project tasks you scheduled, routines on their recurrence rules, travel from your itinerary, and the blocks Content added to your day — four systems, one calendar. That’s the platform doing what silos can’t.',
          panel: <CalendarPanel />,
          panelSide: 'left',
        },
        {
          title: 'Trading money ≠ living money. The wall is the feature.',
          copy:
            'Closed trades post to the Trading entity’s own ledger and render as realized P&L in their own strip — and that same entity is excluded from runway cash and burn by its immutable id. A hot month never inflates how long you can live; a drawdown never fakes your burn.',
          panel: <TradingWallPanel />,
          panelSide: 'right',
        },
      ]}
      // The connective line — claim = composition exactly (1 real live mount:
      // HubCalendar + its real detail panel on click; 3 labeled mirrors;
      // zero fetches).
      preSteps={
        <p className="text-center text-sm text-text-secondary">
          Below, the calendar is the real component mounted live on a declared example day — its
          zero-fetch demo guard is the same one production uses, and clicking any event opens the
          real read-only detail panel. The runway readout, the trading strip, and the budget table
          are faithful static mirrors of the real screens rendering the same computed example set,
          labeled on their faces. Nothing on this page fetches; the mirrors&rsquo; actions route to
          sign-up.
        </p>
      }
      sample={<LiveRunwaySection onRequireAuth={onRequireAuth} />}
      cta={<FreeAccountCta onRequireAuth={onRequireAuth} />}
    />
  );
}
