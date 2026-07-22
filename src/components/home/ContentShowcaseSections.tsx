'use client';

/**
 * PROJECTS-CONTENT-SHOWCASE: the logged-out CONTENT deck — Bloomberg slides on
 * the proven Trade/Books/Tax template, grounded in
 * PROJECTS-CONTENT-FULL-INVENTORY (audit-reports/…, f7324067).
 *
 * v1 BASELINE: clean articulation of the real four-section pipeline
 * (ContentPipeline.tsx:1-22 — DAY → INPUTS → AI SCRIPT MAP → ANSWER + RECORD →
 * SCRIPT). It supersedes OperationsPipelineShowroom's Content usage
 * (ModuleLauncher renders this instead for logged-out; the showroom file is
 * untouched and has no other consumer).
 *
 * TRUTH GUARDS (inventory):
 *  • NO budget-cap claim on Content AI — the two content AI routes carry NO
 *    daily counter (inventory §B3); this deck never says "capped".
 *  • NO free-signup-can-fire-it implication — the ✨ actions are presented as
 *    the product's mechanics; the AI routes are tier-gated (tiers.ts:19-21).
 *  • BANNED (zero rendered hits): the Reddit narrative writer (NOT BUILT),
 *    draft→published states, platform posting/scheduling, the unmounted
 *    QuestionLibrary manager as a feature. Content has NO publish workflow —
 *    the deck describes a data-completeness progression, nothing more.
 *  • CTA truth: no tab:content entitlement exists (categoryKeys.ts:23-28); a
 *    FREE account gets the real Content tab (ModuleLauncher.tsx:489-494) —
 *    the CTA is the free-account signup, not a subscription card.
 *
 * SLIDES-1 → SLIDES-2 (Alex's rulings, override the Jul-16 faithful-mirror
 * design): the deck is NARRATIVE SLIDES ONLY. SLIDES-1 removed the live
 * mounts (DayCalendarView + ScriptGeneratorView); SLIDES-2 removed the three
 * static mirrors (inputs / script map / answer + record) — anything that
 * visually replicates product UI is a pipe regardless of being static JSX.
 * What remains: hero terminal + the five slide panels + the free-account CTA.
 *
 * EXAMPLE DATA — one day's story end-to-end: the seed day 2026-06-09 (Maria's
 * food truck), the same day the slide panels tell.
 */

import TabShowcaseTemplate, { ExampleTag } from '@/components/home/TabShowcaseTemplate';

interface Props {
  /** Opens the existing home register/login modal. Never fetches. */
  onRequireAuth: () => void;
}

// ── dark slide shell (panel token family, same look as the other decks) ──────

function DarkSlide({ title, tag = 'Example day', children }: { title: string; tag?: string; children: React.ReactNode }) {
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

function ContentHeroTerminal() {
  return (
    <div className="rounded-lg border border-panel-border bg-panel/90 p-4 font-mono text-[11px] leading-relaxed shadow-2xl">
      <div className="flex items-center justify-between border-b border-panel-border pb-2">
        <span className="font-bold uppercase tracking-wider text-white/60">Content · Jun 09, 2026</span>
        <ExampleTag text="Example day" />
      </div>
      {/* The real pipeline order (ContentPipeline.tsx:281-284 subtitle:
          "inputs → script map → answer + record → script", headed by the DAY). */}
      <div className="mt-2 space-y-0.5 text-white/70">
        <p><span className="text-white/40">DAY</span> the whole day, one clock-ordered feed — scenes · tasks · travel</p>
        <p><span className="text-white/40">INPUTS</span> pick routines to scenify · add tasks to the day</p>
        <p><span className="text-white/40">SCRIPT MAP</span> every step gets a shot, a question, a purpose</p>
        <p><span className="text-white/40">RECORD</span> answer the day → the scenes × days record</p>
        <p><span className="text-white/40">SCRIPT</span> your answers + the task record → the reel voiceover</p>
      </div>
      <p className="mt-2 border-t border-panel-border pt-2 text-white/70">
        <span className="text-white/50">[scene 2 · sorting receipts]</span> First job: every receipt goes in one
        folder. No more shoebox.
      </p>
      <p className="text-white/50">The script only talks about what you actually logged. No receipts, no lines.</p>
    </div>
  );
}

// ── THE 5 SLIDE PANELS (the inventory's causal order) ────────────────────────

/** 1. THE DAY, ONE FEED — mirrors DayCalendarView on the seed day: scenes +
 *  tasks + travel clock-ordered, gap dividers, the unscheduled lane
 *  (DayCalendarView.tsx:295,:408-417; the seed rows demoData.ts:45-201). */
function DayFeedPanel() {
  return (
    <DarkSlide title="The day — one clock-ordered feed">
      <div className="space-y-0.5 text-white/70">
        <p><span className="text-white/40">07:00</span> <span className="text-teal-300">scene</span> Morning coffee and plan the day <span className="float-right text-white/40">30m</span></p>
        <p><span className="text-white/40">08:00</span> <span className="text-indigo-300">task</span> Sort the receipts into one folder <span className="float-right text-brand-green">done 08:05–08:35</span></p>
        <p><span className="text-white/40">09:00</span> <span className="text-indigo-300">task</span> Type last week&rsquo;s sales into the app <span className="float-right text-brand-amber">in process</span></p>
        <p className="text-white/40 text-center">— 30m open —</p>
        <p><span className="text-white/40">10:30</span> <span className="text-teal-300">scene</span> Prep the truck for the lunch rush <span className="float-right text-white/40">60m</span></p>
        <p><span className="text-white/40">11:30</span> <span className="text-cyan-300">travel</span> Drive to the farmers market spot <span className="float-right text-white/80">$15</span></p>
        <p><span className="text-white/40">14:00</span> <span className="text-indigo-300">task</span> Add up the food and gas costs</p>
        <p className="border-t border-panel-border pt-1"><span className="text-white/40">unscheduled</span> Call the bank about the business account</p>
        <p className="text-white/50">Scenes from your routines, tasks from your projects, travel from your trips — one feed, so the calendar and the answer log can never disagree.</p>
      </div>
    </DarkSlide>
  );
}

/** 2. INPUTS FEED THE MAP — mirrors the INPUTS section
 *  (ContentPipeline.tsx:322-448): the routine picker with order badges and the
 *  task list with + add to day / ✓ on day (:203-275). */
function InputsPanel() {
  return (
    <DarkSlide title="Inputs — pick routines · add tasks">
      <div className="space-y-1 text-white/70">
        <p className="text-white/40">ROUTINES — click to select, in order</p>
        <p><span className="rounded bg-brand-purple/40 px-1 text-[10px] text-white">1</span> Morning routine <span className="text-white/40">· Maria (home) · 1 step</span></p>
        <p><span className="rounded bg-brand-purple/40 px-1 text-[10px] text-white">2</span> Truck routine <span className="text-white/40">· Maria&rsquo;s Food Truck · 1 step</span></p>
        <p className="mt-1 border-t border-panel-border pt-1 text-white/40">PROJECT TASKS — unscheduled</p>
        <p>Call the bank about the business account <span className="float-right text-brand-amber">+ add to day</span></p>
        <p>Add up the food and gas costs <span className="float-right text-brand-green">✓ on day</span></p>
        <p className="text-white/50">Adds the task to the day; commit its times below. A task with committed time refuses silent removal — uncommit first.</p>
      </div>
    </DarkSlide>
  );
}

/** 3. THE AI SCRIPT MAP — mirrors ScenifyDraft (self-fetching + internal paid
 *  enrich → mirror-only per the inventory ruling): scene rows with shot fields
 *  + the question badges (ScenifyDraft.tsx:417-500,:479-488), ✨ AI suggest
 *  (:546-553), read-only amber task bands, the save footer (:610). */
function ScriptMapPanel() {
  return (
    <DarkSlide title="The AI script map — every step gets a shot">
      <div className="space-y-1 text-white/70">
        <p className="text-white/40">cameras available: <span className="text-white/80">iPhone</span> · <span className="text-brand-amber">✨ AI suggest</span> <span className="text-white/40">→ thinking…</span></p>
        <p className="mt-1"><span className="text-teal-300">scene</span> Morning coffee and plan the day</p>
        <p className="pl-4 text-white/50">b-roll: coffee on the counter, notebook open</p>
        <p className="pl-4">Q: &ldquo;What is the one thing that has to get done today?&rdquo; <span className="rounded bg-purple-400/20 px-1 text-[9px] uppercase text-purple-300">from library</span></p>
        <p className="mt-1"><span className="text-brand-amber">task</span> <span className="text-white/50">Sort the receipts into one folder — read-only band, in clock order</span></p>
        <p className="mt-1"><span className="text-teal-300">scene</span> Prep the truck for the lunch rush</p>
        <p className="pl-4 text-white/50">b-roll: onions on the flat top, order tickets</p>
        <p className="pl-4">Q: &ldquo;What did you cook first?&rdquo; <span className="rounded bg-amber-400/20 px-1 text-[9px] uppercase text-amber-300">proposed new</span></p>
        <p className="border-t border-panel-border pt-1 text-white/50">
          The model proposes a camera, angle, shot, b-roll, and the best-fit question per step — it
          never invents, merges, or reorders your steps. You edit, then save: saved scenes appear in
          the confirmed grid below · task rows are read-only.
        </p>
      </div>
    </DarkSlide>
  );
}

/** 4. ANSWER + RECORD — mirrors DailyLog (the answer timeline,
 *  DailyLog.tsx:133-205,:247-254) + PieceGrid (scenes × days,
 *  PieceGrid.tsx:290-293,:436-455). */
function AnswerRecordPanel() {
  return (
    <DarkSlide title="Answer the day → the record">
      <div className="space-y-1 text-white/70">
        <p className="text-white/40">ANSWER — the day, top to bottom · 2 of 2 answered</p>
        <p><span className="text-brand-green">✓</span> &ldquo;What is the one thing that has to get done today?&rdquo;</p>
        <p className="pl-4 text-white/80">&ldquo;Fix my food truck money. Every receipt in one folder.&rdquo;</p>
        <p><span className="text-brand-green">✓</span> &ldquo;What did you cook first?&rdquo;</p>
        <p className="pl-4 text-white/80">&ldquo;Onions, then tacos — lunch rush prep.&rdquo;</p>
        <p className="mt-1 border-t border-panel-border pt-1 text-white/40">DAY-TO-DAY RECORD — scenes × days</p>
        <p><span className="text-white/50">Morning coffee…</span> <span className="float-right"><span className="text-white/40">Jun 08</span> <span className="text-brand-green">●</span> · <span className="text-white/40">Jun 09</span> <span className="text-brand-green">●</span></span></p>
        <p><span className="text-white/50">Prep the truck…</span> <span className="float-right"><span className="text-white/40">Jun 08</span> <span className="text-white/40">+ answer</span> · <span className="text-white/40">Jun 09</span> <span className="text-brand-green">●</span></span></p>
        <p className="text-white/50">Every day is a column, every scene a row, every answer a take — the evolution record of you saying it, day after day.</p>
      </div>
    </DarkSlide>
  );
}

/** 5. THE SCRIPT — mirrors ScriptGenerator(View): the day-audit prompt +
 *  generate (ScriptGeneratorView.tsx:90-129), the fail-loud gates
 *  (ScriptGenerator.tsx:135-139; generate-script/route.ts:106-116), the reel
 *  voice, the save caption (View:177). */
function ScriptPanel() {
  return (
    <DarkSlide title="The script — built only from what you logged">
      <div className="space-y-1 text-white/70">
        <p><span className="text-brand-amber">✨ generate script</span> <span className="text-white/40">· ~1:00 read</span></p>
        <p className="text-brand-green">&ldquo;Generated from 2 answers + 3 task blocks. Edit, then save.&rdquo;</p>
        <p className="mt-1 text-white/80">[scene 1 · morning coffee] Okay, real talk. Today I finally fix my food truck money.</p>
        <p className="text-white/80">[scene 5 · drive to the market] Quick drive to the market spot. Fifteen bucks in gas, and yes, I wrote it down.</p>
        <p className="mt-1 border-t border-panel-border pt-1 text-white/50">
          No answers yet? It refuses: <span className="text-brand-red">&ldquo;Answer the day&rsquo;s scenes first — the script is
          built only from what you logged.&rdquo;</span>
        </p>
        <p className="text-white/50">edits are yours — saving overwrites the day&rsquo;s script (every run is logged)</p>
      </div>
    </DarkSlide>
  );
}


// ── CTA — the HONEST unlock: a free account (no tab:content entitlement
//    exists; the tab is auth-gated only — header comment). ───────────────────

function FreeAccountCta({ onRequireAuth }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-brand-purple/15 bg-bg-row px-6 py-8 text-center">
      <div className="space-y-1">
        <p className="text-base font-bold text-text-primary">Content — built and running</p>
        <p className="text-sm text-text-muted">
          Free with your account — your routines become scenes, your day becomes the record, and the
          record becomes the script.
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

export default function ContentShowcase({ onRequireAuth }: Props) {
  return (
    <TabShowcaseTemplate
      darkHero={{
        eyebrow: 'Content — day to script',
        headline: 'Your day becomes the script.',
        subcopy:
          'Your routines become scenes with a shot and a question. Your project tasks sit in the same clock-ordered day. You answer the day in your own words, the answers stack into a scenes-by-days record, and the record becomes a reel voiceover — built only from what you actually logged. No answers, no lines.',
        cta: (
          <button
            type="button"
            onClick={onRequireAuth}
            className="rounded-lg bg-brand-purple px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-purple-hover"
          >
            Make my free account
          </button>
        ),
        panel: <ContentHeroTerminal />,
      }}
      editorialTitle="Go further with the Content tab"
      editorialRows={[
        {
          title: 'The whole day, one feed.',
          copy:
            'Scenes from your routines, tasks from your projects, travel from your trips — merged into one clock-ordered timeline with honest gaps and an unscheduled lane. The calendar and the answer log read from the same feed, so they can never disagree.',
          panel: <DayFeedPanel />,
          panelSide: 'left',
        },
        {
          title: 'Inputs feed the map.',
          copy:
            'Pick the routines you want on camera — in order — and pull unscheduled project tasks onto the day. A task with committed time refuses silent removal; you uncommit it first. The day is deliberate before it is filmed.',
          panel: <InputsPanel />,
          panelSide: 'right',
        },
        {
          title: 'Every step gets a shot, a question, a purpose.',
          copy:
            'The script map lays your routine steps out in clock order and proposes a camera, an angle, b-roll, and the best-fit question for each — never inventing or reordering your steps. Library questions are badged; new proposals are badged louder. You edit, then save.',
          panel: <ScriptMapPanel />,
          panelSide: 'left',
        },
        {
          title: 'Answer the day. Keep the record.',
          copy:
            'Each scene asks its question and you answer in your own words, right on the timeline. Answers stack into a scenes-by-days grid — the evolution record of you saying it, day after day, take after take.',
          panel: <AnswerRecordPanel />,
          panelSide: 'right',
        },
        {
          title: 'The script only says what happened.',
          copy:
            'Generate turns the day’s answers and its task record into a reel voiceover in a locked plain voice — and it refuses to run on an unanswered day. Edit it, save it, and every run is logged. Anti-confabulation is the feature.',
          panel: <ScriptPanel />,
          panelSide: 'left',
        },
      ]}
      // SLIDES-2: narrative slides only — the mirrors died with the ruling;
      // the deck ends at the slides and the free-account CTA.
      cta={<FreeAccountCta onRequireAuth={onRequireAuth} />}
    />
  );
}
