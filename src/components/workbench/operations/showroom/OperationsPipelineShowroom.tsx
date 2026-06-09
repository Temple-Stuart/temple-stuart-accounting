/**
 * OperationsPipelineShowroom — the FULL public Operations story for the home
 * page, stacked top-to-bottom as one continuous arc for Maria's food truck:
 *
 *   PANEL 1 · PROJECT  — scope the work, break it into tasks, watch it evolve
 *                        (the existing ProjectsPipelineShowroom, reused as-is).
 *   PANEL 2 · DAY      — those tasks mapped into a real day (DayCalendarView).
 *   PANEL 3 · SCRIPT   — the AI narrates what actually happened (ScriptGeneratorView).
 *
 * "Locked but visible": every panel renders the REAL pure view fed the PR6/PR D
 * static demo seed, and EVERY action — including the PAID Anthropic generate-script
 * trigger — is bound to one inert `lock` handler that does ONLY onRequireAuth().
 * No fetch, no paid call, no live container is reachable under any panel, so the
 * whole subtree is fetch-free at runtime (the Layer-1 guardrail asserts it, and
 * the Layer-2 guardShowroomRender wraps this render for defense-in-depth).
 *
 * Replaces the Projects-only Operations panel that ModuleLauncher rendered before.
 * Narrative copy between the panels lands in PR F (slots marked below).
 */

'use client';

import ProjectsPipelineShowroom from '@/components/workbench/operations/projects/showroom/ProjectsPipelineShowroom';
import DayCalendarView from '@/components/workbench/operations/content/DayCalendarView';
import ScriptGeneratorView from '@/components/workbench/operations/content/ScriptGeneratorView';
import {
  demoDay,
  demoDayEntities,
  demoDayDate,
  demoScript,
  demoExecNotes,
} from '@/components/workbench/operations/content/showroom/demoData';
import { guardShowroomRender } from '@/lib/showroom/renderGuard';

interface Props {
  /** Opens the existing home register/login modal (the same UI-only trigger the
   *  rest of the showroom uses). Never fetches. */
  onRequireAuth: () => void;
}

// Functional helper text for the script panel's day-audit box (a required view
// prop, NOT the cross-panel narrative beat — PR F may relocate it to the copy
// module). Plain, 5th-grade.
const DEMO_DAY_AUDIT_PROMPT =
  'At the end of the day, write down what you actually got done — the real ' +
  'receipts. The app turns these notes into your script, so it only talks about ' +
  'stuff that really happened.';

export default function OperationsPipelineShowroom({ onRequireAuth }: Props) {
  // One inert handler for every action across all three panels: it does ONLY
  // onRequireAuth() — never a fetch, never the paid generate-script call.
  const lock = () => onRequireAuth();

  return guardShowroomRender(() => (
    <div className="space-y-8">
      {/* ── PANEL 1 · PROJECT (scope → tasks → evolution) ─────────────────── */}
      {/* narrative beat slot — copy lands in PR F */}
      <ProjectsPipelineShowroom onRequireAuth={onRequireAuth} />

      {/* ── PANEL 2 · DAY CALENDAR (her tasks mapped into the day) ────────── */}
      {/* narrative beat slot — copy lands in PR F */}
      <DayCalendarView
        date={demoDayDate}
        onDateChange={lock}
        timeline={demoDay}
        loading={false}
        error={null}
        entities={demoDayEntities}
      />

      {/* ── PANEL 3 · SCRIPT (AI narrates what actually happened) ─────────── */}
      {/* narrative beat slot — copy lands in PR F */}
      <ScriptGeneratorView
        dayAuditPrompt={DEMO_DAY_AUDIT_PROMPT}
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
        // PAID generate-script trigger — LOCKED, never fires the paid POST here.
        onGenerate={lock}
        onSave={lock}
        onSaveNotes={lock}
        onCopyPrompt={lock}
        onDraftChange={lock}
        onExecNotesChange={lock}
      />
    </div>
  ));
}
