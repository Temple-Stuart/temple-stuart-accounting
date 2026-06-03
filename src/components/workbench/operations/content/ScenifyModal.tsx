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

const inputClass =
  'w-full px-2 py-1 border border-border rounded text-xs font-mono text-text-primary focus:outline-none focus:border-brand-purple';
const labelClass = 'text-text-faint uppercase tracking-wide mb-1 text-xs font-mono';

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
    <div className="w-full border border-brand-purple rounded p-3 bg-purple-50/30 text-xs font-mono space-y-3">
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
        <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
          {steps.map((step) => {
            const d = drafts[step.id];
            const time = fmtTime(step.time_of_day);
            const hasQuestion = d.assigned_question_text.trim().length > 0;
            return (
              <div key={step.id} className="border border-border-light rounded p-2 space-y-2 bg-white">
                <div className="text-text-primary font-semibold">
                  {step.step_order}. {step.activity}
                  {time && <span className="ml-2 font-normal text-text-muted">{time}</span>}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <div className={labelClass}>camera</div>
                    <input
                      type="text"
                      maxLength={200}
                      value={d.camera_needed}
                      onChange={(e) => setField(step.id, 'camera_needed', e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <div className={labelClass}>angle</div>
                    <input
                      type="text"
                      maxLength={200}
                      value={d.filming_angle}
                      onChange={(e) => setField(step.id, 'filming_angle', e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <div className={labelClass}>shot type</div>
                    <input
                      type="text"
                      maxLength={200}
                      value={d.shot_type}
                      onChange={(e) => setField(step.id, 'shot_type', e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div className="col-span-3">
                    <div className={labelClass}>b-roll</div>
                    <textarea
                      value={d.b_roll}
                      onChange={(e) => setField(step.id, 'b_roll', e.target.value)}
                      rows={2}
                      className={inputClass}
                    />
                  </div>
                  <div className="col-span-3">
                    <div className={labelClass}>narrative purpose</div>
                    <textarea
                      value={d.narrative_purpose}
                      onChange={(e) => setField(step.id, 'narrative_purpose', e.target.value)}
                      rows={2}
                      className={inputClass}
                    />
                  </div>
                  <div className="col-span-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`${labelClass} mb-0`}>question</span>
                      {hasQuestion &&
                        (d.assigned_question_id ? (
                          <span className="px-1.5 py-0.5 rounded bg-brand-purple text-white text-[10px] tracking-wide">
                            from library
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded border border-amber-400 bg-amber-50 text-amber-700 text-[10px] tracking-wide">
                            proposed new
                          </span>
                        ))}
                    </div>
                    <textarea
                      value={d.assigned_question_text}
                      onChange={(e) => setQuestionText(step.id, e.target.value)}
                      rows={2}
                      placeholder="the on-camera question for this scene (AI suggest assigns the best fit)"
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
            );
          })}
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
