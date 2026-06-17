/**
 * ScenifyModal — turn a routine's STEPS into grid scene-rows.
 *
 * Reshaped (PR-Ops-grid-6): Scenify loads the routine's steps
 * (GET /api/operations/routines/{id}) and, for each step, lets Alex fill the
 * STABLE shot fields, then upserts one scene-ROW per step
 * (POST /api/operations/content/scene-rows, keyed by routine_step_id).
 *
 * OPS-CE-3 (Stage-1 AI enrich): an "✨ AI suggest" action calls
 * POST /api/operations/content/enrich-routine and PREFILLS each step's
 * angle / shot type / b-roll plus the best-fit QUESTION (assigned from Alex's
 * library, or proposed-new when none fits). The prefills are fully EDITABLE —
 * this modal IS the human gate; nothing is written until Alex clicks "save
 * scenes". The accepted question is persisted as a snapshot
 * (assigned_question_text) plus the live library id (assigned_question_id, null
 * for proposed-new).
 *
 * Per-day SCRIPT lives in the grid's take-cells, not here. On success it
 * broadcasts a window event so the PieceGrid refetches.
 */

'use client';

import { useEffect, useState } from 'react';

export const CONTENT_SCENES_CHANGED_EVENT = 'operations:content-scenes-changed';
// OPS-CE-8D: a task was assigned to / changed on the day's plan — the day map (S2)
// and the answer timeline (S3) re-read the day's tasks.
export const CONTENT_DAY_PLAN_CHANGED_EVENT = 'operations:content-day-plan-changed';

// Table styling matches the PieceGrid below it (PieceGrid.tsx:288-393) so the two
// read as one family: border-collapse text-xs, border-border-light grid
// lines, gray header band. Per the contrast standard, column headers are purple
// labels; editable cells are white fields with a purple focus state — borderless so
// the cell border IS the field boundary (spreadsheet feel, like Alex's Excel).
const headerCellClass =
  'sticky top-0 z-10 bg-bg-row border border-border-light px-2 py-1.5 text-left text-brand-purple font-semibold uppercase tracking-wide whitespace-nowrap';
const cellInputClass =
  'w-full px-2 py-1 bg-white text-text-primary placeholder:text-text-faint focus:outline-none focus:bg-purple-50/40 focus:ring-1 focus:ring-inset focus:ring-brand-purple';

interface StepSceneRow {
  camera_needed: string | null;
  filming_angle: string | null;
  shot_type: string | null;
  b_roll: string | null;
  narrative_purpose: string | null;
  assigned_question_id: string | null;
  assigned_question_text: string | null;
}

interface RoutineStep {
  id: string;
  step_order: number;
  activity: string;
  time_of_day: string | null;
  content_scene: StepSceneRow | null;
}

interface Draft {
  camera_needed: string;
  filming_angle: string;
  shot_type: string;
  b_roll: string;
  narrative_purpose: string;
  // Question assignment (CE-3): id is the live library link (null = proposed-new
  // or none); text is the snapshot always persisted; proposed_new flags AI's
  // newly-proposed wording so the gate shows it distinctly.
  assigned_question_id: string | null;
  assigned_question_text: string;
  proposed_new: boolean;
}

// AI enrichment response shape (per step).
interface EnrichedStep {
  routine_step_id: string;
  filming_angle: string | null;
  shot_type: string | null;
  b_roll: string | null;
  question_id: string | null;
  question_text: string;
  proposed_new: boolean;
}

const draftFromStep = (step: RoutineStep): Draft => ({
  camera_needed: step.content_scene?.camera_needed ?? '',
  filming_angle: step.content_scene?.filming_angle ?? '',
  shot_type: step.content_scene?.shot_type ?? '',
  b_roll: step.content_scene?.b_roll ?? '',
  narrative_purpose: step.content_scene?.narrative_purpose ?? '',
  assigned_question_id: step.content_scene?.assigned_question_id ?? null,
  assigned_question_text: step.content_scene?.assigned_question_text ?? '',
  // An existing assignment is not a fresh AI proposal.
  proposed_new: false,
});

const fmtTime = (t: string | null): string => {
  if (!t) return '';
  // Prisma @db.Time serializes as an ISO timestamp on the 1970 epoch.
  const m = t.match(/T(\d{2}:\d{2})/);
  if (m) return m[1];
  return t.length >= 5 ? t.slice(0, 5) : t;
};

export default function ScenifyModal({
  routine,
  open,
  onClose,
  onSuccess,
}: {
  routine: { id: string; name: string };
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [steps, setSteps] = useState<RoutineStep[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setNotice(null);
    (async () => {
      try {
        const res = await fetch(`/api/operations/routines/${routine.id}`, {
          credentials: 'include',
        });
        if (!res.ok) throw new Error(`Failed to load steps (${res.status})`);
        const body = await res.json();
        const loaded: RoutineStep[] = (body.routine?.steps ?? body.steps ?? [])
          .slice()
          .sort((a: RoutineStep, b: RoutineStep) => a.step_order - b.step_order);
        if (cancelled) return;
        setSteps(loaded);
        setDrafts(Object.fromEntries(loaded.map((s) => [s.id, draftFromStep(s)])));
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'failed to load steps');
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, routine.id]);

  if (!open) return null;

  const setField = (stepId: string, field: keyof Draft, value: string) => {
    setError(null);
    setDrafts((prev) => ({ ...prev, [stepId]: { ...prev[stepId], [field]: value } }));
  };

  // Editing the question text by hand detaches it from the library link and
  // marks it as a (manual) proposed-new wording — the snapshot is what counts.
  const setQuestionText = (stepId: string, value: string) => {
    setError(null);
    setDrafts((prev) => ({
      ...prev,
      [stepId]: { ...prev[stepId], assigned_question_text: value, assigned_question_id: null, proposed_new: true },
    }));
  };

  const handleEnrich = async () => {
    if (enriching || submitting || !steps || steps.length === 0) return;
    setEnriching(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/operations/content/enrich-routine', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routine_id: routine.id }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body?.message ?? body?.error ?? `enrich failed (${res.status})`);
      }
      const enriched: EnrichedStep[] = body.steps ?? [];
      const byId = new Map(enriched.map((e) => [e.routine_step_id, e]));
      // Prefill suggestions — fully editable (the human gate). Only overwrite a
      // craft field when the AI offered one; leave Alex's existing value otherwise.
      setDrafts((prev) => {
        const next = { ...prev };
        for (const step of steps) {
          const e = byId.get(step.id);
          if (!e) continue;
          const d = next[step.id];
          next[step.id] = {
            ...d,
            filming_angle: e.filming_angle ?? d.filming_angle,
            shot_type: e.shot_type ?? d.shot_type,
            b_roll: e.b_roll ?? d.b_roll,
            assigned_question_id: e.question_id,
            assigned_question_text: e.question_text ?? d.assigned_question_text,
            proposed_new: e.proposed_new,
          };
        }
        return next;
      });
      const proposedCount = enriched.filter((e) => e.proposed_new).length;
      setNotice(
        `AI suggested ${enriched.length} scene${enriched.length === 1 ? '' : 's'}` +
          (body.library_size === 0
            ? ' — your question library is empty, so all questions are newly proposed. Review, then add the keepers to your library.'
            : proposedCount > 0
              ? ` — ${proposedCount} use newly-proposed wording (no library fit). Review all before saving.`
              : ' — all questions assigned from your library. Review/tweak, then save.')
      );
      setEnriching(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to get AI suggestions');
      setEnriching(false);
    }
  };

  const handleSubmit = async () => {
    if (submitting || !steps) return;
    setSubmitting(true);
    setError(null);
    try {
      // One scene-row per step (upsert by routine_step_id), so every step
      // becomes a grid row — bare rows are valid, shot fields fill in.
      for (const step of steps) {
        const d = drafts[step.id];
        const res = await fetch('/api/operations/content/scene-rows', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            routine_step_id: step.id,
            camera_needed: d.camera_needed,
            filming_angle: d.filming_angle,
            shot_type: d.shot_type,
            b_roll: d.b_roll,
            narrative_purpose: d.narrative_purpose,
            // Persist the snapshot always; the library id only when still linked.
            assigned_question_id: d.assigned_question_id,
            assigned_question_text: d.assigned_question_text,
          }),
        });
        if (!res.ok) {
          let msg = `Request failed (${res.status})`;
          try {
            const b = await res.json();
            msg = b.message ?? b.error ?? msg;
          } catch {
            /* non-JSON */
          }
          throw new Error(`Step "${step.activity}": ${msg}`);
        }
      }
      // Tell the PieceGrid (sibling) to refetch its rows.
      window.dispatchEvent(new Event(CONTENT_SCENES_CHANGED_EVENT));
      onSuccess?.();
      setSubmitting(false);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to save scenes');
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full border border-border rounded p-3 bg-white text-xs space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="font-bold text-text-primary">🎬 Scenify &ldquo;{routine.name}&rdquo;</div>
        <button
          type="button"
          onClick={handleEnrich}
          disabled={enriching || submitting || loading || !steps || steps.length === 0}
          className="px-2 py-1 border border-brand-purple rounded text-brand-purple hover:bg-purple-100/50 disabled:opacity-50"
        >
          {enriching ? 'thinking…' : '✨ AI suggest'}
        </button>
      </div>
      <p className="text-text-muted">
        One scene-row per step — fill the shot fields (the per-day script lives in the grid cells).
        AI suggest prefills angle / shot type / b-roll and the best-fit question; everything stays editable.
      </p>

      {notice && (
        <div className="px-3 py-2 rounded border bg-purple-50 border-brand-purple/40 text-text-primary">
          {notice}
        </div>
      )}
      {error && (
        <div className="px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-text-faint">Loading steps…</p>
      ) : !steps || steps.length === 0 ? (
        <p className="text-text-muted">
          This routine has no steps yet — add steps on the Routines tab first.
        </p>
      ) : (
        // One ROW per step, columns for the editable shot fields — a single table
        // that reads as one family with the PieceGrid below. Horizontal scroll on
        // narrow widths rather than squashing the cells.
        <div className="overflow-x-auto max-h-[460px] overflow-y-auto border border-border-light rounded">
          <table className="border-collapse text-xs w-full">
            <thead>
              <tr>
                <th className={`${headerCellClass} text-center`}>#</th>
                <th className={headerCellClass}>Activity</th>
                <th className={headerCellClass}>Camera</th>
                <th className={headerCellClass}>Angle</th>
                <th className={headerCellClass}>Shot Type</th>
                <th className={headerCellClass}>B-Roll</th>
                <th className={headerCellClass}>Narrative</th>
                <th className={headerCellClass}>Question</th>
              </tr>
            </thead>
            <tbody>
              {steps.map((step) => {
                const d = drafts[step.id];
                const time = fmtTime(step.time_of_day);
                const hasQuestion = d.assigned_question_text.trim().length > 0;
                return (
                  <tr key={step.id}>
                    {/* # + Activity: prefilled from the step, read-only / de-emphasized */}
                    <td className="border border-border-light px-2 py-1 align-top text-center text-text-muted">
                      {step.step_order}
                    </td>
                    <th
                      scope="row"
                      className="border border-border-light px-2 py-1 align-top text-left font-normal text-text-primary min-w-[140px]"
                    >
                      <div className="font-medium">{step.activity}</div>
                      {time && <div className="text-text-muted">{time}</div>}
                    </th>
                    <td className="border border-border-light p-0 align-top min-w-[110px]">
                      <input
                        type="text"
                        maxLength={200}
                        value={d.camera_needed}
                        onChange={(e) => setField(step.id, 'camera_needed', e.target.value)}
                        className={cellInputClass}
                      />
                    </td>
                    <td className="border border-border-light p-0 align-top min-w-[110px]">
                      <input
                        type="text"
                        maxLength={200}
                        value={d.filming_angle}
                        onChange={(e) => setField(step.id, 'filming_angle', e.target.value)}
                        className={cellInputClass}
                      />
                    </td>
                    <td className="border border-border-light p-0 align-top min-w-[110px]">
                      <input
                        type="text"
                        maxLength={200}
                        value={d.shot_type}
                        onChange={(e) => setField(step.id, 'shot_type', e.target.value)}
                        className={cellInputClass}
                      />
                    </td>
                    <td className="border border-border-light p-0 align-top min-w-[180px]">
                      <textarea
                        value={d.b_roll}
                        onChange={(e) => setField(step.id, 'b_roll', e.target.value)}
                        rows={2}
                        className={`${cellInputClass} block resize-y`}
                      />
                    </td>
                    <td className="border border-border-light p-0 align-top min-w-[180px]">
                      <textarea
                        value={d.narrative_purpose}
                        onChange={(e) => setField(step.id, 'narrative_purpose', e.target.value)}
                        rows={2}
                        className={`${cellInputClass} block resize-y`}
                      />
                    </td>
                    <td className="border border-border-light p-1 align-top min-w-[200px]">
                      {hasQuestion && (
                        <div className="mb-1">
                          {d.assigned_question_id ? (
                            <span className="px-1.5 py-0.5 rounded bg-brand-purple text-white text-[10px] tracking-wide">
                              from library
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-medium tracking-wide">
                              proposed new
                            </span>
                          )}
                        </div>
                      )}
                      <textarea
                        value={d.assigned_question_text}
                        onChange={(e) => setQuestionText(step.id, e.target.value)}
                        rows={2}
                        placeholder="the on-camera question (AI suggest assigns the best fit)"
                        className={`${cellInputClass} block resize-y`}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center gap-2 pt-2 border-t border-border-light">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || enriching || loading || !steps || steps.length === 0}
          className="px-3 py-1 border border-brand-purple bg-brand-purple text-white rounded hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? 'saving…' : 'save scenes'}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="px-3 py-1 border border-border rounded hover:bg-bg-row disabled:opacity-50"
        >
          cancel
        </button>
      </div>
    </div>
  );
}
