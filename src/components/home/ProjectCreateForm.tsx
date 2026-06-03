'use client';

// HOME-OPS-PR-4: the REAL 5-step project input form, extracted FETCH-FREE for the
// public home page — same pattern as RoutineCreateForm (HOME-OPS-PR-1). This is the
// ONLY paid surface on the showroom, so it carries a HARD SECURITY LINE:
//
//   *** A logged-out visitor must NEVER be able to fire a paid AI call. ***
//
//   - NO fetch on mount, NO fetch ANYWHERE (unlike the real SectionD_ProjectBacklog,
//     which self-fetches GET /api/operations/projects on mount (SectionD:252) via the
//     useOperationsEntity context that fetches /api/entities, and whose two paid AI
//     buttons call /api/operations/ai/generate-design (SectionD:93) and
//     /api/operations/ai/generate-tasks (SectionD:154)).
//   - EVERY action here — "generate plan", "preview tasks", "create project" — calls
//     onRequireAuth and returns. There is NO generate-design / generate-tasks / any
//     fetch in this file. The paid AI endpoints are unreachable from this component.
//   - Reuses the REAL ListManager (pure, fetch-free) for the goal/problem/diagnosis
//     lists, and renders the real task OUTPUT table structure EMPTY.
//
// Logged-out, a visitor sees the genuine 5-step form + empty task table and fires
// zero server calls (especially zero AI) — there is no fetch code here to fire one.

import { useState } from 'react';
import ListManager from '@/components/workbench/operations/projects/ListManager';
import type { ProjectForm } from '@/components/workbench/operations/projects/types';
import { DEFAULT_PROJECT_FORM } from '@/components/workbench/operations/projects/types';

interface Props {
  /** The existing home login-modal trigger (ModuleLauncher's onRequireAuth) — the
   *  same one Travel/Trading gate their submit to. */
  onRequireAuth: () => void;
}

export default function ProjectCreateForm({ onRequireAuth }: Props) {
  // Local form state only — same shape the real SectionD_ProjectBacklog uses. No
  // fetch seeds it.
  const [form, setForm] = useState<ProjectForm>(DEFAULT_PROJECT_FORM);

  const inputClass =
    'w-full px-2 py-1 border border-border rounded text-xs font-mono text-text-primary focus:outline-none focus:border-brand-purple';
  const labelClass = 'text-text-faint uppercase tracking-wide mb-1 text-xs font-mono';

  // THE HARD LINE: every action gates to the login modal and returns. There is no
  // fetch (and specifically no generate-design / generate-tasks) on any path here.
  const gate = () => {
    onRequireAuth();
  };

  return (
    <div className="space-y-4">
      {/* ── REAL 5-step input form (fields mirror SectionD_ProjectBacklog:344-578) ── */}
      <div className="border border-border rounded p-3 bg-white space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <div className={labelClass}>title</div>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={inputClass}
              maxLength={500}
              placeholder="short, distinctive, unique within your projects"
            />
          </div>
          <div>
            <div className={labelClass}>entity</div>
            {/* Logged-out has no entity list (no /api/entities fetch here). A neutral
                placeholder stands in; the real entity is chosen after login. */}
            <select className={inputClass} value="preview" disabled>
              <option value="preview">Your workspace · set after login</option>
            </select>
          </div>
          <div>
            <div className={labelClass}>target date (optional)</div>
            <input
              type="date"
              value={form.target_completion_date}
              onChange={(e) => setForm({ ...form, target_completion_date: e.target.value })}
              className={inputClass}
            />
          </div>
        </div>

        {/* The REAL ListManager (pure, fetch-free) for each of the 3 scoping lists. */}
        <div>
          <div className={labelClass}>1 · goal — what success looks like</div>
          <ListManager
            items={form.goalItems}
            onChange={(next) => setForm({ ...form, goalItems: next })}
            verbPrefix="I WANT to "
            placeholder="get loans approved"
          />
        </div>
        <div>
          <div className={labelClass}>2 · problem — gap between current and goal</div>
          <ListManager
            items={form.problemItems}
            onChange={(next) => setForm({ ...form, problemItems: next })}
            verbPrefix="I HAVE NOT "
            altVerbPrefix="I KEEP "
            placeholder="created an FSA ID yet"
          />
        </div>
        <div>
          <div className={labelClass}>3 · diagnosis — root cause of the gap</div>
          <ListManager
            items={form.diagnosisItems}
            onChange={(next) => setForm({ ...form, diagnosisItems: next })}
            verbPrefix="Because "
            altVerbPrefix="The root cause is "
            placeholder="I never blocked dedicated time for it"
          />
        </div>

        {/* 4 · design — the real "generate plan" button is a PAID AI call in the
            dashboard; here it gates to login and NEVER fetches. */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className={labelClass}>4 · design — the plan (AI-generated)</div>
            <button
              type="button"
              onClick={gate}
              className="px-2 py-0.5 border border-brand-purple text-brand-purple rounded text-xs font-mono hover:bg-purple-50"
            >
              ↑ generate plan <span aria-hidden>→</span> log in
            </button>
          </div>
          <div className="text-text-muted text-xs font-mono italic p-3 bg-bg-row border border-border-light rounded">
            (no design yet — fill in goal/problem/diagnosis items above, then generate
            the plan after you log in)
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className={labelClass}>est. minutes (optional)</div>
            <input
              type="number"
              min={0}
              value={form.estimated_total_minutes}
              onChange={(e) => setForm({ ...form, estimated_total_minutes: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <div className={labelClass}>est. cost usd (optional)</div>
            <input
              type="text"
              value={form.estimated_total_cost_usd}
              onChange={(e) => setForm({ ...form, estimated_total_cost_usd: e.target.value })}
              className={inputClass}
              placeholder="0.00"
            />
          </div>
        </div>

        {/* Both the create and the PAID "preview tasks" (generate-tasks) actions gate
            to login and NEVER fetch. */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border-light">
          <button
            type="button"
            onClick={gate}
            className="px-3 py-1 border border-brand-purple bg-brand-purple text-white rounded text-xs font-mono hover:opacity-90"
          >
            Create project <span aria-hidden>→</span> log in
          </button>
          <button
            type="button"
            onClick={gate}
            className="px-3 py-1 border border-brand-purple text-brand-purple rounded text-xs font-mono hover:bg-purple-50"
          >
            ↑ preview tasks <span aria-hidden>→</span> log in
          </button>
        </div>
      </div>

      {/* ── REAL task OUTPUT structure, EMPTY (step 5 · execute — the task list).
          No data, no fetch. ── */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className={labelClass}>5 · execute (tasks)</span>
          <span className="text-text-faint text-[10px] font-mono">0 tasks</span>
        </div>
        <div className="border border-gray-200 rounded overflow-hidden">
          <div className="grid grid-cols-[1.5rem_3fr_1fr_1fr] gap-2 bg-gray-50 border-b border-gray-200 px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-text-faint">
            <span>#</span>
            <span>Task</span>
            <span>Status</span>
            <span>Due</span>
          </div>
          <div className="px-3 py-6 text-center text-xs font-mono text-text-muted italic">
            Your tasks appear here once you generate or add them — after you log in.
          </div>
        </div>
      </div>
    </div>
  );
}
