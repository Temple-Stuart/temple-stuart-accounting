'use client';

/**
 * ROUTINES-SHOWCASE-BLOOMBERG — the logged-out Routines showcase: THE RECURRENCE
 * ENGINE DECK. Dark hero → 7 causal slides (alternating L/R) → connective line →
 * live section (the REAL in-browser builder, genuinely usable) → honest
 * free-account CTA. Grounded in audit-reports/ROUTINES-FULL-INVENTORY.md
 * (merged 4303b430). The story: build it once, it shows up everywhere.
 *
 * ── THE CARRIED EXAMPLE UNIVERSE (inventory §11 — cross-deck coherence) ──────
 * The three worked-example routines ARE the Runway deck's budget lines,
 * value-for-value (RunwayShowcaseSections.tsx:92-99):
 *   Pay the rent        → COA 6100 Rent (Business)      · $400/occ · monthly (day 1)
 *                          planned 400 = 400 × 1 occurrence · actual 400.00 (0.0%)
 *   Restock supplies    → COA 6120 Supplies             · $300/occ · monthly (day 15)
 *                          planned 300 = 300 × 1 · actual 312.45 (+4.2% — the Runway
 *                          drill: 84.12 + 145.90 + 82.43)
 *   Service the truck   → COA 6010 Car & Truck Expenses · $150/occ · monthly (day 20)
 *                          planned 150 = 150 × 1 · actual 138.20 (−7.9%)
 *   Totals: planned 850.00 · actual 850.65 — identical to the Runway slide-6 table.
 * They render ONLY as labeled pre-built mirrors — never guest-buildable: the
 * teaser's static starter chart (DEFAULT_COA, coaDefaults.ts:14-52) lacks
 * 6120/6010 and its 6100 is "Meals & Dining" (inventory §11).
 *
 * Plus the two demo-day time-block routines carried from the Runway deck's
 * calendar seed (RunwayShowcaseSections.tsx:136,139):
 *   Morning coffee and plan the day   07:00–07:30 · daily        · streak 12 ✓ / 0 ✗
 *   Prep the truck for the lunch rush 10:30–11:30 · weekly Mo–Fr · streak 4 ✓ / 1 ✗
 * Streak/next-due values are declared demo-day narrative data (like the Runway
 * deck's merchants/dates) — never presented as anyone's real history. The
 * monthly routines' streaks (6/0, 3/0, 5/1) are likewise declared here.
 *
 * ── VERBATIM STRINGS CARRIED (inventory §3, §8) ──────────────────────────────
 *   "N done · N due · N missed"            TodaysStrip.tsx:135
 *   status pills pending/completed/missed/upcoming
 *                                          TodaysStrip.tsx:41-53, today/route.ts:14-22
 *   "✓ mark done"                          TodaysStrip.tsx:181
 *   "Δ N min"                              TodaysStrip.tsx:166-170
 *   "🔥 N ✓ / N ✗"                          RoutineRow.tsx:216
 *   "next: <datetime>"                     RoutineRow.tsx:218-219
 *   cadence groups Daily…Custom            types.ts:220-231
 *   "no routines scheduled for today."     TodaysStrip.tsx:126
 *   "show inactive"                        RoutineList.tsx:149
 *   "+ new routine"                        RoutineList.tsx:159
 *   the five cadence modes                 types.ts:206-212, RRULEBuilder.tsx:27-33
 *   custom placeholder FREQ=YEARLY;BYMONTH=3,6,9,12;BYMONTHDAY=15
 *                                          RRULEBuilder.tsx:150
 *
 * ── CTA RULING (inventory §12, pre-verified) ────────────────────────────────
 * No tab:routines entitlement exists (categoryKeys.ts:23-28); tab:operations is
 * defined but checked nowhere; the tab mount carries no lock
 * (ModuleLauncher.tsx:513-531). Auth-only tab → honest "Make my free account".
 * NO subscribe card.
 *
 * ── SLIDES-1 → SLIDES-2 (Alex's rulings, override the Jul-16 design) ────────
 * The deck is NARRATIVE SLIDES ONLY. SLIDES-1 removed the live mount
 * (home/RoutineCreateForm, the real logged-out builder); SLIDES-2 removed the
 * worked-example static mirror — anything that visually replicates product UI
 * is a pipe regardless of being static JSX. What remains: hero terminal + the
 * seven slide panels + the free-account CTA. This file contains NO fetch
 * calls and imports NO data provider.
 *
 * ── BANNED (inventory §8 — zero rendered hits) ──────────────────────────────
 * "3 patterns" · any next-N-occurrences preview (the /upcoming route has zero
 * UI consumers) · hub_scheduled_items · automation dashboards / Inngest
 * evaluator UI (only its OUTPUTS render: pills, streaks) · "Claude Code
 * Routines" naming · Scenify-as-free (it is Pro+-gated; mirrored inert +
 * labeled) · travel-COA budget claims · retired content surfaces
 * (AvailableRoutinesList/SectionG/ContentTable) · guest-transfer claims ·
 * one-click quarterly (custom escape hatch only).
 */

import TabShowcaseTemplate, { ExampleTag } from '@/components/home/TabShowcaseTemplate';

interface Props {
  /** Opens the existing home register/login modal. Never fetches. */
  onRequireAuth: () => void;
}

// ── the carried example universe (derivations in the header comment) ─────────

const EX = {
  // The Runway deck's three budget lines as routines (values identical to
  // RunwayShowcaseSections.tsx:92-99; mapping declared in the header comment).
  monthly: [
    { routine: 'Pay the rent', coa: '6100', coaName: 'Rent (Business)', budget: 400, cadence: 'monthly (day of month) · day 1', rrule: 'FREQ=MONTHLY;BYMONTHDAY=1;BYHOUR=9;BYMINUTE=0;BYSECOND=0', planned: 400, actual: 400.0, pct: '0.0%', done: 6, missed: 0, next: 'Aug 1, 9:00 AM' },
    { routine: 'Restock supplies', coa: '6120', coaName: 'Supplies', budget: 300, cadence: 'monthly (day of month) · day 15', rrule: 'FREQ=MONTHLY;BYMONTHDAY=15;BYHOUR=9;BYMINUTE=0;BYSECOND=0', planned: 300, actual: 312.45, pct: '+4.2%', done: 3, missed: 0, next: 'Jul 15, 9:00 AM' },
    { routine: 'Service the truck', coa: '6010', coaName: 'Car & Truck Expenses', budget: 150, cadence: 'monthly (day of month) · day 20', rrule: 'FREQ=MONTHLY;BYMONTHDAY=20;BYHOUR=8;BYMINUTE=0;BYSECOND=0', planned: 150, actual: 138.2, pct: '-7.9%', done: 5, missed: 1, next: 'Jul 20, 8:00 AM' },
  ],
  totalPlanned: 850.0,
  totalActual: 850.65,
  // The Runway deck's demo-day time-block routines (RunwayShowcaseSections.tsx:136,139).
  daily: [
    { routine: 'Morning coffee and plan the day', time: '07:00–07:30', cadence: 'daily', done: 12, missed: 0 },
    { routine: 'Prep the truck for the lunch rush', time: '10:30–11:30', cadence: 'weekly · Mo Tu We Th Fr', done: 4, missed: 1 },
  ],
  // The prep-truck routine's ordered steps (slide 2) — auto-filled at 15-min
  // intervals from the 10:30 start (RoutineStepList.tsx:20,71-81).
  steps: [
    { time: '10:30', activity: 'Stock the fridge', extra: '15 min' },
    { time: '10:45', activity: 'Fill the water tank', extra: '15 min' },
    { time: '11:00', activity: 'Drive to the lot', extra: '@ Riverside lot' },
    { time: '11:15', activity: 'Set up the window', extra: '15 min' },
  ],
};

const usd0 = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const usd2 = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ── dark slide shell (panel token family — same look as the six prior decks) ─

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

// The real status-pill palette (TodaysStrip.tsx:41-46), dark-panel rendition.
const PILL = {
  pending: 'border-amber-400/40 text-amber-300',
  completed: 'border-green-400/40 text-green-300',
  missed: 'border-red-400/40 text-red-300',
  upcoming: 'border-blue-400/40 text-blue-300',
};
function Pill({ status }: { status: keyof typeof PILL }) {
  return <span className={`rounded-full border px-1.5 text-[10px] ${PILL[status]}`}>{status}</span>;
}

// ── HERO ─────────────────────────────────────────────────────────────────────

/** One routine's journey — the four feeds off a single definition (inventory
 *  §4 feeds map) + the real strip line format (TodaysStrip.tsx:135). */
function RoutinesHeroTerminal() {
  const rent = EX.monthly[0];
  return (
    <div className="rounded-lg border border-panel-border bg-panel/90 p-4 font-mono text-[11px] leading-relaxed shadow-2xl">
      <div className="flex items-center justify-between border-b border-panel-border pb-2">
        <span className="font-bold uppercase tracking-wider text-white/60">Routines · one definition, four feeds</span>
        <ExampleTag text="Example set" />
      </div>
      <div className="mt-2 space-y-0.5 text-white/70">
        <p>
          <span className="text-white/40">ROUTINE</span> {rent.routine}
          <span className="float-right text-white">{rent.coa} · {usd0(rent.budget)}/occ</span>
        </p>
        <p className="break-all text-white/50">{rent.rrule}</p>
        <p><span className="text-white/40">→ CALENDAR</span> <span className="text-teal-300">🔁 Aug 1 · teal tile</span> <span className="float-right text-white/80">{usd0(rent.budget)} riding on it</span></p>
        <p><span className="text-white/40">→ BUDGET</span> {rent.coaName} <span className="float-right text-white/80">planned {usd0(rent.planned)} = {usd0(rent.budget)} × 1</span></p>
        <p><span className="text-white/40">→ CONTENT</span> scene group <span className="float-right text-white/80">one scene per step</span></p>
        <p><span className="text-white/40">→ YOUR DAY</span> today&rsquo;s strip <span className="float-right text-white/80">read-only, beside the plan</span></p>
      </div>
      {/* The strip line — verbatim format, TodaysStrip.tsx:135. */}
      <p className="mt-2 border-t border-panel-border pt-2 text-white/70">
        today · <span className="text-green-300">1 done</span> · <span className="text-amber-300">1 due</span> · <span className="text-white/60">0 missed</span>
      </p>
    </div>
  );
}

// ── THE 7 SLIDE PANELS (the approved sequence) ───────────────────────────────

/** 1. BUILD A ROUTINE — mirrors the real create form + the structured cadence
 *  builder (workbench RoutineCreateForm.tsx:106-216; RRULEBuilder.tsx:27-33;
 *  server compile compileFormToRRule, rruleHelpers.ts:26-69). */
function BuilderPanel() {
  const rent = EX.monthly[0];
  return (
    <DarkSlide title="The builder — what a routine is made of">
      <div className="space-y-1 text-white/70">
        <p><span className="text-white/40">name</span> <span className="float-right text-white">{rent.routine}</span></p>
        <p><span className="text-white/40">entity</span> <span className="float-right text-white/80">Business</span></p>
        <p><span className="text-white/40">budget / occurrence</span> <span className="float-right text-white">{usd0(rent.budget)}</span></p>
        <p><span className="text-white/40">COA</span> <span className="float-right text-white/80">{rent.coa} — {rent.coaName}</span></p>
        <p className="border-t border-panel-border pt-1"><span className="text-white/40">cadence</span> <span className="float-right text-white/80">{rent.cadence}</span></p>
        {/* The five structured modes + the escape hatch (types.ts:206-212). */}
        <div className="flex flex-wrap gap-1 pt-1">
          {['daily', 'weekly', 'monthly (day of month)', 'monthly (Nth weekday)', 'custom (raw RRULE)'].map((m) => (
            <span key={m} className={`rounded border px-1.5 py-0.5 text-[10px] ${m.startsWith('monthly (day') ? 'border-brand-purple bg-brand-purple/30 text-white' : 'border-panel-border text-white/50'}`}>{m}</span>
          ))}
        </div>
        <p className="pt-1 text-white/50">compiled server-side →</p>
        <p className="break-all text-white">{rent.rrule}</p>
        <p className="text-[10px] italic text-white/50">You never type RRULE (custom is the labeled escape hatch — e.g. quarterly). The server compiles and validates every schedule.</p>
      </div>
    </DarkSlide>
  );
}

/** 2. STEPS, IN ORDER — mirrors RoutineStepList (steps count header :227-233,
 *  row shape :342-380, "+ add step" :235-242, 15-min auto-fill :20,71-81). */
function StepsPanel() {
  return (
    <DarkSlide title="Steps — the runbook under the routine">
      <div className="space-y-1 text-white/70">
        <p className="text-white/40">Prep the truck for the lunch rush <span className="float-right">steps · {EX.steps.length}</span></p>
        {EX.steps.map((s, i) => (
          <p key={s.time} className="border-t border-panel-border/50 pt-1">
            <span className="text-white/40">{i + 1} ·</span> <span className="text-white/60">{s.time}</span>{' '}
            <span className="text-white">{s.activity}</span>
            <span className="float-right text-white/50">{s.extra} <span aria-hidden>↑↓</span></span>
          </p>
        ))}
        <p className="pt-1 text-white/50">+ add step <span className="float-right text-[10px] italic">times auto-fill 15 min apart from the start</span></p>
      </div>
    </DarkSlide>
  );
}

/** 3. TODAY'S STRIP — mirrors TodaysStrip: the summary line (:135), rows
 *  (:145-187), pills (:41-53), Δ minutes (:166-170), ✓ mark done (:173-183).
 *  Live-pill semantics from today/route.ts:14-22; durable misses + streaks are
 *  written by the nightly evaluator (routine-evaluator.ts:34,103-153). */
function TodayPanel() {
  return (
    <DarkSlide title="Today — what's due, done, slipped">
      <div className="space-y-1 text-white/70">
        <p className="text-white/50"><span className="text-green-300">1 done</span> · <span className="text-amber-300">1 due</span> · 0 missed</p>
        <p className="border-t border-panel-border pt-1">
          <span className="text-white/60">07:00</span> <span className="text-white/50 line-through">Morning coffee and plan the day</span>{' '}
          <Pill status="completed" /> <span className="float-right text-white/50">Δ 2 min</span>
        </p>
        <p>
          <span className="text-white/60">10:30</span> <span className="text-white">Prep the truck for the lunch rush</span>{' '}
          <Pill status="pending" /> <span className="float-right rounded border border-green-400/40 px-1.5 text-green-300">✓ mark done</span>
        </p>
        <p className="pt-1 text-[10px] italic text-white/50">
          Past its grace window the pill turns <span className="not-italic"><Pill status="missed" /></span> on the spot; each night the evaluator writes the miss durably and the streak feels it. Nothing is forgotten.
        </p>
      </div>
    </DarkSlide>
  );
}

/** 4. STREAKS — mirrors RoutineList's cadence groups (:190-213) + RoutineRow's
 *  compact row: 🔥 streaks (:214-217) and next-due (:218-219). */
function StreaksPanel() {
  return (
    <DarkSlide title="The list — cadence-grouped, streaks both ways">
      <div className="space-y-1 text-white/70">
        <p className="text-white/50">5 routines <span className="float-right">☐ show inactive</span></p>
        <p className="border-t border-panel-border pt-1 text-[10px] uppercase tracking-wide text-white/40">Daily (1)</p>
        <p><span className="text-white">Morning coffee and plan the day</span> <span className="float-right text-white/60">🔥 12 ✓ / 0 ✗</span></p>
        <p className="text-[10px] uppercase tracking-wide text-white/40">Weekly (1)</p>
        <p><span className="text-white">Prep the truck for the lunch rush</span> <span className="float-right text-white/60">🔥 4 ✓ / <span className="text-red-300">1 ✗</span></span></p>
        <p className="text-[10px] uppercase tracking-wide text-white/40">Monthly (3)</p>
        {EX.monthly.map((r) => (
          <p key={r.coa}>
            <span className="text-white">{r.routine}</span>
            <span className="float-right text-white/60">🔥 {r.done} ✓ / {r.missed > 0 ? <span className="text-red-300">{r.missed} ✗</span> : `${r.missed} ✗`} · next: {r.next}</span>
          </p>
        ))}
        <p className="pt-1 text-[10px] italic text-white/50">Completions increment ✓ and zero ✗; the nightly evaluator does the reverse on a miss. The counter can&rsquo;t flatter you.</p>
      </div>
    </DarkSlide>
  );
}

/** 5. FEED 1 — THE CALENDAR: mirrors the operations-routines expansion (route
 *  :104-189 — occurrences + coa_code/budget_amount on every entry) and the
 *  teal 🔁 layer (HubCalendar.tsx:76; mapOperationsRoutines.ts:94-112). */
function CalendarFeedPanel() {
  return (
    <DarkSlide title="Feed 1 · the calendar — every occurrence, priced">
      <div className="space-y-1 text-white/70">
        <p className="text-white/40">this week</p>
        <p><span className="text-white/60">Mon 07:00</span> <span className="text-teal-300">🔁 Morning coffee and plan the day</span></p>
        <p><span className="text-white/60">Mon 10:30</span> <span className="text-teal-300">🔁 Prep the truck for the lunch rush</span></p>
        <p><span className="text-white/60">Tue 07:00</span> <span className="text-teal-300">🔁 Morning coffee and plan the day</span></p>
        <p className="border-t border-panel-border pt-1"><span className="text-white/60">Jul 15</span> <span className="text-teal-300">🔁 Restock supplies</span> <span className="float-right text-white">6120 · {usd0(300)}</span></p>
        <p><span className="text-white/60">Jul 20</span> <span className="text-teal-300">🔁 Service the truck</span> <span className="float-right text-white">6010 · {usd0(150)}</span></p>
        <p><span className="text-white/60">Aug 1</span> <span className="text-teal-300">🔁 Pay the rent</span> <span className="float-right text-white">6100 · {usd0(400)}</span></p>
        <p className="pt-1 text-[10px] italic text-white/50">The RRULE expands server-side into dated tiles; the budget and category ride on each one. Over-cap windows say &ldquo;truncated&rdquo; — never a silent drop.</p>
      </div>
    </DarkSlide>
  );
}

/** 6. FEED 2 — THE BUDGET: the SAME table the Runway deck's slide 6 mirrored —
 *  identical rows/numbers (RunwayShowcaseSections.tsx:92-99). Planned =
 *  routinesMonthlyByCoa = budget × occurrences (routineBudget.ts:41-77), the
 *  SOLE planned source (year-calendar/route.ts:66-73). */
function BudgetFeedPanel() {
  return (
    <DarkSlide title="Feed 2 · the budget — the Runway tab's planned column">
      <div className="space-y-1 text-white/70">
        <p className="text-white/40">June · Business <span className="float-right">planned / actual</span></p>
        {EX.monthly.map((r) => (
          <p key={r.coa} className="border-t border-panel-border/50 pt-1">
            <span className="text-white">{r.coaName}</span> <span className="text-white/40">{r.coa}</span>
            <span className="float-right">
              <span className="text-white">{usd2(r.planned)}</span>
              <span className="text-white/50"> / {usd2(r.actual)} </span>
              <span className={r.pct.startsWith('+') ? 'text-amber-300' : 'text-white/60'}>{r.pct}</span>
            </span>
          </p>
        ))}
        <p className="border-t border-panel-border pt-1 text-white">
          total <span className="float-right">{usd2(EX.totalPlanned)} / {usd2(EX.totalActual)}</span>
        </p>
        <p className="pt-1 text-[10px] italic text-white/50">Planned = each routine&rsquo;s amount × its real occurrence count that month — budgeted routines are the only planned source. Actuals stay the ledger&rsquo;s. These are the exact rows the Runway deck showed.</p>
      </div>
    </DarkSlide>
  );
}

/** 7. FEED 3 — CONTENT + YOUR DAY: mirrors the live ContentPipeline INPUTS
 *  picker (ContentPipeline.tsx:414-445 — numbered selection, name/entity/step
 *  count) + scene-per-step (schema: scene_groups 1:1 routine :3133, scenes 1:1
 *  step :3156) + the daily-plan strip (SectionC_DailyPlan.tsx:90,322-323).
 *  ✨ AI suggest is mirrored INERT and labeled Pro+ (enrich-routine gate,
 *  tiers.ts:57-65) — no free-AI implication. */
function ContentDayPanel() {
  return (
    <DarkSlide title="Feed 3 · content — steps become scenes">
      <div className="space-y-1 text-white/70">
        <p className="text-white/40">INPUTS — pick routines, in order</p>
        <p><span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-brand-purple text-[10px] text-white">1</span> <span className="text-white">Prep the truck for the lunch rush</span> <span className="float-right text-white/50">Business · 4 steps</span></p>
        <p><span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-panel-border text-[10px] text-white/40"> </span> <span className="text-white/60">Morning coffee and plan the day</span> <span className="float-right text-white/50">Personal · 0 steps</span></p>
        <p className="border-t border-panel-border pt-1 text-white/40">one scene per step →</p>
        <p><span className="text-white/60">10:30</span> Stock the fridge <span className="float-right text-white/50">scene 1</span></p>
        <p><span className="text-white/60">10:45</span> Fill the water tank <span className="float-right text-white/50">scene 2</span></p>
        <p className="pt-1"><span className="rounded border border-panel-border px-1.5 py-0.5 text-white/40">✨ AI suggest — Pro+ · preview only</span> <span className="float-right text-[10px] italic text-white/50">prefills shot notes; nothing auto-saves</span></p>
        <p className="border-t border-panel-border pt-1 text-white/40">and on your day plan, read-only:</p>
        <p><span className="text-white/60">10:30</span> <span className="text-white">Prep the truck for the lunch rush</span> <Pill status="pending" /></p>
      </div>
    </DarkSlide>
  );
}


// ── CTA (per the pre-verified ruling: honest free account, no subscribe card) ─

function FreeAccountCta({ onRequireAuth }: Props) {
  return (
    <div className="rounded-lg border border-brand-purple/30 bg-brand-purple/5 p-5 text-center">
      <p className="text-sm font-semibold text-text-primary">
        One definition. Four systems fed. Nothing re-entered.
      </p>
      <p className="mx-auto mt-1 max-w-xl text-xs text-text-secondary">
        Routines are free with an account — build them once and watch them land on your calendar,
        your budget, your content plan, and your day.
      </p>
      <button
        type="button"
        onClick={onRequireAuth}
        className="mt-3 rounded bg-brand-purple px-5 py-2 text-sm font-semibold text-white hover:opacity-90"
      >
        Make my free account
      </button>
    </div>
  );
}

// ── THE DECK ─────────────────────────────────────────────────────────────────

export default function RoutinesShowcase({ onRequireAuth }: Props) {
  return (
    <TabShowcaseTemplate
      darkHero={{
        eyebrow: 'Routines — the recurrence engine',
        headline: 'Build it once. It shows up everywhere.',
        subcopy:
          'A routine here isn’t a reminder — it’s infrastructure. One definition, with a real schedule and a real cost, feeds the calendar, the budget, your content pipeline, and your daily plan. You define the rhythm; the platform does the bookkeeping of showing up.',
        cta: (
          <button
            type="button"
            onClick={onRequireAuth}
            className="rounded bg-white px-5 py-2 text-sm font-semibold text-brand-purple hover:opacity-90"
          >
            Make my free account
          </button>
        ),
        panel: <RoutinesHeroTerminal />,
      }}
      editorialTitle="One routine, end to end"
      editorialRows={[
        {
          title: 'You describe the rhythm. The machine writes the schedule.',
          copy:
            'A routine is a name, an entity, an optional cost per occurrence with its category, and a cadence — picked from five structured modes, never typed as code. The server compiles your choice into a validated RFC 5545 schedule, so “every month on the 1st” is math, not a sticky note.',
          panel: <BuilderPanel />,
          panelSide: 'left',
        },
        {
          title: 'A routine is executable — steps you actually run.',
          copy:
            'Under each routine sits an ordered runbook: timed steps with locations and durations, reorderable, times auto-filled from the start. It’s the difference between “prep the truck” and knowing exactly what 10:30 looks like.',
          panel: <StepsPanel />,
          panelSide: 'right',
        },
        {
          title: 'Every day answers: what’s due, what’s done, what slipped.',
          copy:
            'Today’s strip expands your schedules server-side and hydrates each occurrence with its truth: pending, completed with the minutes-off delta, missed past its grace window, or upcoming. Misses are written durably every night — a skipped morning doesn’t quietly disappear.',
          panel: <TodayPanel />,
          panelSide: 'left',
        },
        {
          title: 'The streak counts both ways.',
          copy:
            'Every routine carries a completion streak AND a miss streak — marking done bumps one and zeroes the other, and the nightly evaluation does the reverse when you slip. Grouped daily to custom, with the next occurrence always on the row. Honest scorekeeping, not gamification.',
          panel: <StreaksPanel />,
          panelSide: 'right',
        },
        {
          title: 'Feed one: every occurrence lands on the one calendar, priced.',
          copy:
            'The same schedule that runs your strip expands into dated tiles on the master calendar — teal, marked recurring, with the routine’s budget and category riding on every occurrence. When a window would overflow the cap, the feed says “truncated” instead of silently dropping.',
          panel: <CalendarFeedPanel />,
          panelSide: 'left',
        },
        {
          title: 'Feed two: your routines ARE the planned budget.',
          copy:
            'Each budgeted routine contributes amount × its real occurrence count to its category, month by month — and that is the only place the planned column comes from. These are the exact three lines, to the cent, that the Runway tab’s budget table showed. Same engine, same numbers.',
          panel: <BudgetFeedPanel />,
          panelSide: 'right',
        },
        {
          title: 'Feed three: the routine becomes scenes to film — and a plan for the day.',
          copy:
            'The content pipeline picks routines as its inputs: one scene group per routine, one scene per step, ready to shoot and script. And the daily plan shows today’s occurrences read-only beside your tasks. Four systems, zero re-entry.',
          panel: <ContentDayPanel />,
          panelSide: 'left',
        },
      ]}
      // SLIDES-2: narrative slides only — the worked-example mirror died with
      // the ruling; the deck ends at the slides and the free-account CTA.
      cta={<FreeAccountCta onRequireAuth={onRequireAuth} />}
    />
  );
}
