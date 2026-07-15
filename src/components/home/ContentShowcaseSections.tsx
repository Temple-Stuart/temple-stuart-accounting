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
 * MOUNTABILITY (inventory §B4):
 *  • MOUNTED LIVE (the two DIRECT-REUSE pure views, showroom-proven):
 *    DayCalendarView (props :128-137, "owns NO data … no fetch") and
 *    ScriptGeneratorView (props :27-53, "NEVER names the paid generate
 *    route") — fed by the EXISTING type-checked content seed
 *    (content/showroom/demoData.ts, `_check` proofs :215-223). Every
 *    callback — including the paid onGenerate — is one inert lock → signup.
 *  • MIRRORED (self-fetching containers): the INPUTS pickers
 *    (ContentPipeline.tsx:322-448), ScenifyDraft (ruled never-mountable — its
 *    paid enrich is an INTERNAL handler, :236-293), DailyLog, PieceGrid.
 *
 * EXAMPLE DATA — one day's story end-to-end: the seed day 2026-06-09 (Maria's
 * food truck) from content/showroom/demoData.ts, reused verbatim so the live
 * mounts and the slide panels tell the SAME day.
 */

import DayCalendarView from '@/components/workbench/operations/content/DayCalendarView';
import ScriptGeneratorView from '@/components/workbench/operations/content/ScriptGeneratorView';
import {
  demoDay,
  demoDayEntities,
  demoDayDate,
  demoScript,
  demoExecNotes,
} from '@/components/workbench/operations/content/showroom/demoData';
import TabShowcaseTemplate, { ExampleTag } from '@/components/home/TabShowcaseTemplate';

interface Props {
  /** Opens the existing home register/login modal. Never fetches. */
  onRequireAuth: () => void;
}

// The plain-language day-audit helper the script panel requires (a view prop;
// the same 5th-grade voice the old showroom used for it).
const DAY_AUDIT_PROMPT =
  'At the end of the day, write down what you actually got done — the real ' +
  'receipts. The app turns these notes into your script, so it only talks about ' +
  'stuff that really happened.';

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

// ── THE LIVE/MIRROR SECTION — pipeline order: DAY (real) → INPUTS (mirror) →
//    SCRIPT MAP (mirror) → ANSWER + RECORD (mirror) → SCRIPT (real) ───────────

function TruthStrip({ real, label }: { real: boolean; label: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-bg-row/60 px-3 py-1.5">
      <span className={`text-[10px] font-bold uppercase tracking-wider ${real ? 'text-brand-green' : 'text-text-muted'}`}>
        {real ? 'Real component — mounted live' : 'Faithful mirror of the real screen'}
      </span>
      <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">{label}</span>
      <ExampleTag text="Example day" />
    </div>
  );
}

// INPUTS mirror — ContentPipeline.tsx:322-448 (routine picker :407-448, task
// list with + add to day / ✓ on day :333-404; strings verbatim).
function InputsMirror({ lock }: { lock: () => void }) {
  return (
    <div className="p-3 grid gap-3 md:grid-cols-2 text-xs">
      <div className="rounded border border-border p-2">
        <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">Project tasks</div>
        <div className="flex items-center justify-between py-1 border-b border-border-light">
          <span>Call the bank about the business account <span className="text-text-muted">· Maria&rsquo;s Food Truck</span> <span className="rounded bg-bg-row px-1 text-[10px] uppercase text-text-secondary">open</span></span>
          <button type="button" onClick={lock} className="rounded border border-brand-purple px-2 py-0.5 text-[11px] text-brand-purple hover:bg-purple-50">+ add to day</button>
        </div>
        <div className="flex items-center justify-between py-1">
          <span>Add up the food and gas costs <span className="text-text-muted">· Maria&rsquo;s Food Truck</span> <span className="rounded bg-bg-row px-1 text-[10px] uppercase text-text-secondary">open</span></span>
          <button type="button" onClick={lock} className="rounded border border-emerald-300 px-2 py-0.5 text-[11px] text-emerald-700 hover:bg-emerald-50">✓ on day</button>
        </div>
        <p className="mt-1 text-[11px] text-text-muted">Adds the task to the day (commit times on the Daily Plan tab).</p>
      </div>
      <div className="rounded border border-border p-2">
        <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">Routines — click to select, in order</div>
        {[
          ['1', 'Morning routine', 'Maria (home) · 1 step(s)'],
          ['2', 'Truck routine', "Maria's Food Truck · 1 step(s)"],
        ].map(([n, name, meta]) => (
          <button key={name} type="button" onClick={lock} className="flex w-full items-center gap-2 py-1 text-left hover:bg-bg-row">
            <span className="rounded bg-brand-purple px-1.5 text-[10px] font-bold text-white">{n}</span>
            <span className="text-text-primary">{name}</span>
            <span className="text-text-muted">{meta}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// SCRIPT MAP mirror — ScenifyDraft (mirror-only ruling: internal paid enrich,
// :236-293). Scene rows :417-500 with the question badges :479-488; the amber
// task band; the AI-suggest control :546-553; the footer :610.
function ScriptMapMirror({ lock }: { lock: () => void }) {
  return (
    <div className="p-3 space-y-2 text-xs">
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider text-text-muted">cameras available</span>
        <input value="iPhone" readOnly onMouseDown={(e) => { e.preventDefault(); lock(); }} className="w-28 rounded border border-border px-2 py-0.5 font-mono text-[11px]" />
        <button type="button" onClick={lock} className="rounded border border-brand-purple px-2 py-0.5 text-[11px] text-brand-purple hover:bg-purple-50">✨ AI suggest</button>
      </div>
      <div className="rounded border border-border p-2">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-text-primary">07:00 · Morning coffee and plan the day</span>
          <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-purple-700">from library</span>
        </div>
        <p className="mt-1 text-text-secondary">Q: What is the one thing that has to get done today?</p>
        <p className="text-text-muted">b-roll: coffee on the counter, notebook open · camera: iPhone</p>
      </div>
      <div className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-amber-800">
        08:00 · task — Sort the receipts into one folder <span className="text-amber-600">(read-only, in clock order)</span>
      </div>
      <div className="rounded border border-border p-2">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-text-primary">10:30 · Prep the truck for the lunch rush</span>
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700">proposed new</span>
        </div>
        <p className="mt-1 text-text-secondary">Q: What did you cook first?</p>
        <p className="text-text-muted">b-roll: onions on the flat top, order tickets · camera: iPhone</p>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-text-muted">saved scenes appear in the confirmed grid below · task rows are read-only</span>
        <button type="button" onClick={lock} className="rounded bg-brand-purple px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-brand-purple/90">save scenes</button>
      </div>
    </div>
  );
}

// ANSWER + RECORD mirror — DailyLog :133-205 (the ✓ badge + inline answer +
// Save answer) and PieceGrid :290-455 (scenes × days cells, + answer, + day).
function AnswerRecordMirror({ lock }: { lock: () => void }) {
  return (
    <div className="p-3 space-y-3 text-xs">
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">Answer — the day, top to bottom · 2 of 2 answered</div>
        <div className="rounded border border-border p-2 space-y-1">
          <p><span className="text-emerald-600">✓</span> <span className="font-semibold">07:00 · Morning coffee and plan the day</span></p>
          <p className="pl-4 text-text-secondary">&ldquo;Fix my food truck money. Every receipt in one folder.&rdquo;</p>
          <div className="pl-4 flex items-center gap-2">
            <input readOnly value="answer the question in your own words…" onMouseDown={(e) => { e.preventDefault(); lock(); }} className="flex-1 rounded border border-border px-2 py-0.5 text-[11px] text-text-muted" />
            <button type="button" onClick={lock} className="rounded border border-brand-purple px-2 py-0.5 text-[11px] text-brand-purple hover:bg-purple-50">Save answer</button>
          </div>
        </div>
      </div>
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">Day-to-day record — scenes × days</div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-gray-50 text-text-secondary">
                <th className="px-2 py-1 text-left font-medium">scene</th>
                <th className="px-2 py-1 text-left font-medium">Jun 08</th>
                <th className="px-2 py-1 text-left font-medium">Jun 09</th>
                <th className="px-2 py-1 text-left font-medium"><button type="button" onClick={lock} className="text-brand-purple hover:underline">+ day</button></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="px-2 py-1 text-text-primary">Morning coffee and plan the day</td>
                <td className="px-2 py-1 text-emerald-700">&ldquo;Get the permit paperwork out the door.&rdquo;</td>
                <td className="px-2 py-1 text-emerald-700">&ldquo;Fix my food truck money…&rdquo;</td>
                <td className="px-2 py-1" />
              </tr>
              <tr>
                <td className="px-2 py-1 text-text-primary">Prep the truck for the lunch rush</td>
                <td className="px-2 py-1"><button type="button" onClick={lock} className="text-brand-purple hover:underline">+ answer</button></td>
                <td className="px-2 py-1 text-emerald-700">&ldquo;Onions, then tacos — lunch rush prep.&rdquo;</td>
                <td className="px-2 py-1" />
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function LiveContentSection({ onRequireAuth }: Props) {
  const lock = () => onRequireAuth();
  return (
    <div className="space-y-4">
      {/* DAY — the REAL DayCalendarView (pure props :128-137) on the seed day.
          Showroom-proven mount; date nav routes to signup. */}
      <div className="rounded-lg border border-border bg-white overflow-hidden">
        <TruthStrip real={true} label="· DAY — time blocks" />
        <div className="p-3">
          <DayCalendarView
            date={demoDayDate}
            onDateChange={lock}
            timeline={demoDay}
            loading={false}
            error={null}
            entities={demoDayEntities}
          />
        </div>
      </div>

      {/* 1 · INPUTS — mirror (the container self-fetches routines + tasks). */}
      <div className="rounded-lg border border-border bg-white overflow-hidden">
        <TruthStrip real={false} label="1 · INPUTS — pick routines · add tasks to the day" />
        <InputsMirror lock={lock} />
      </div>

      {/* 2 · AI SCRIPT MAP — mirror (ScenifyDraft is never mountable: its paid
          enrich is an internal handler, inventory ruling). */}
      <div className="rounded-lg border border-border bg-white overflow-hidden">
        <TruthStrip real={false} label="2 · AI SCRIPT MAP — the day in order" />
        <ScriptMapMirror lock={lock} />
      </div>

      {/* 3 · ANSWER + RECORD — mirror (DailyLog + PieceGrid self-fetch). */}
      <div className="rounded-lg border border-border bg-white overflow-hidden">
        <TruthStrip real={false} label="3 · ANSWER + RECORD — answer the day → the record" />
        <AnswerRecordMirror lock={lock} />
      </div>

      {/* 4 · SCRIPT — the REAL ScriptGeneratorView (pure props :27-53) on the
          seed script + notes. The PAID generate trigger is a locked prop —
          it routes to signup, never the paid POST (showroom-proven). */}
      <div className="rounded-lg border border-border bg-white overflow-hidden">
        <TruthStrip real={true} label="4 · SCRIPT — the reel voiceover" />
        <div className="p-3">
          <ScriptGeneratorView
            dayAuditPrompt={DAY_AUDIT_PROMPT}
            hasPiece={true}
            disabledReason={null}
            draft={demoScript}
            execNotes={demoExecNotes}
            generating={false}
            saving={false}
            execSaving={false}
            error={null}
            notice={null}
            copied={false}
            onGenerate={lock}
            onSave={lock}
            onSaveNotes={lock}
            onCopyPrompt={lock}
            onDraftChange={lock}
            onExecNotesChange={lock}
          />
        </div>
      </div>

      <p className="text-xs text-text-muted">
        The day calendar and the script generator above are the real components mounted live on the
        declared example day — they fetch nothing; every action routes to sign-up. The three
        sections between them are labeled mirrors of screens that fetch your data when signed in.
      </p>
    </div>
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
      // The connective line — claim = composition exactly (2 real mounts:
      // DayCalendarView + ScriptGeneratorView; 3 labeled mirrors between;
      // zero fetches).
      preSteps={
        <p className="text-center text-sm text-text-secondary">
          Below, the day calendar and the script generator are the real components mounted live on
          the declared example day — they fetch nothing; every action routes to sign-up. The
          sections between them (inputs, the AI script map, answer + record) fetch your data when
          you&rsquo;re signed in, so here they are faithful static mirrors of the real screens,
          labeled on their faces. Nothing on this page fetches.
        </p>
      }
      sample={<LiveContentSection onRequireAuth={onRequireAuth} />}
      cta={<FreeAccountCta onRequireAuth={onRequireAuth} />}
    />
  );
}
