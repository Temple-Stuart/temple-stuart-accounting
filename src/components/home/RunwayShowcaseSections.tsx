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
 * SLIDES-1 → SLIDES-2 (Alex's rulings, override the Jul-16 faithful-mirror
 * design): the deck is NARRATIVE SLIDES ONLY. SLIDES-1 removed the live
 * HubCalendar mount; SLIDES-2 removed the three static mirrors (readout /
 * trading strip / budget table) — anything that visually replicates product
 * UI is a pipe regardless of being static JSX. What remains: hero terminal +
 * the eight slide panels + the free-account CTA.
 *   • RunwayDataProvider is dead-but-firing (context unconsumed) — NOT
 *     imported here, deliberately.
 *
 * BANNED (inventory's 10 — zero rendered hits): runway scenario modeling,
 * the Trading budget ("route pending"), capital/drawdown figures, the unfed
 * Trade calendar layer, the inert BUDGET-cell drill (only ACTUAL cells read
 * as clickable here).
 *
 * SHOW discipline: ZERO fetches in this file; all actions → signup.
 */

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
      // SLIDES-2: narrative slides only — the mirrors died with the ruling;
      // the deck ends at the slides and the free-account CTA.
      cta={<FreeAccountCta onRequireAuth={onRequireAuth} />}
    />
  );
}
