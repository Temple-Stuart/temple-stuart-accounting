/**
 * ScenifyDraft — STEP 2 of the Content pipeline (OPS-CE-7): the inline, multi-routine
 * scene-map DRAFT table. This is the CE-3B Scenify table, DE-MODALIZED — it renders
 * in the page flow under the sources (never an overlay), and spans MULTIPLE selected
 * routines in selection order into ONE combined editable table.
 *
 * Rows = the selected routines' active steps, grouped by routine in selection order,
 * each group preceded by a routine separator band. The # column is the COMBINED scene
 * number across the whole table. Per row: editable shot fields (camera/angle/shot/
 * b-roll/narrative) + the assigned QUESTION (library purple / proposed-new amber).
 *
 * "✨ AI suggest" enriches the whole selection by calling the EXISTING enrich route
 * once PER routine, in order (recordUsage stays per-call — clean attribution). "Save
 * scenes" upserts every step via the EXISTING /content/scene-rows route, then
 * broadcasts CONTENT_SCENES_CHANGED_EVENT so the confirmed grid refetches.
 *
 * 0-schema, zero new write paths. Flat: no modal/drawer/expander.
 */

'use client';

import { useEffect, useState } from 'react';
import { CONTENT_SCENES_CHANGED_EVENT } from './ScenifyModal';

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
  assigned_question_id: string | null;
  assigned_question_text: string;
  proposed_new: boolean;
}
interface EnrichedStep {
  routine_step_id: string;
  camera_needed: string | null;
  filming_angle: string | null;
  shot_type: string | null;
  b_roll: string | null;
  question_id: string | null;
  question_text: string;
  proposed_new: boolean;
}
interface Group {
  routineId: string;
  routineName: string;
  steps: RoutineStep[];
}

const headerCellClass =
  'sticky top-0 z-10 bg-bg-row border border-border-light px-2 py-1.5 text-left text-brand-purple font-semibold uppercase tracking-wide whitespace-nowrap';
const cellInputClass =
  'w-full px-2 py-1 bg-white text-text-primary placeholder:text-text-faint focus:outline-none focus:bg-purple-50/40 focus:ring-1 focus:ring-inset focus:ring-brand-purple';

const draftFromStep = (step: RoutineStep): Draft => ({
  camera_needed: step.content_scene?.camera_needed ?? '',
  filming_angle: step.content_scene?.filming_angle ?? '',
  shot_type: step.content_scene?.shot_type ?? '',
  b_roll: step.content_scene?.b_roll ?? '',
  narrative_purpose: step.content_scene?.narrative_purpose ?? '',
  assigned_question_id: step.content_scene?.assigned_question_id ?? null,
  assigned_question_text: step.content_scene?.assigned_question_text ?? '',
  proposed_new: false,
});

const fmtTime = (t: string | null): string => {
  if (!t) return '';
  const m = t.match(/T(\d{2}:\d{2})/);
  if (m) return m[1];
  return t.length >= 5 ? t.slice(0, 5) : t;
};

export default function ScenifyDraft({
  routines,
  onSaved,
}: {
  routines: { id: string; name: string }[];
  onSaved?: () => void;
}) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The selection key — re-load when the set OR order of selected routines changes.
  const key = routines.map((r) => r.id).join(',');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setNotice(null);
    (async () => {
      try {
        const loaded: Group[] = [];
        for (const r of routines) {
          const res = await fetch(`/api/operations/routines/${r.id}`, { credentials: 'include' });
          if (!res.ok) throw new Error(`Failed to load "${r.name}" (${res.status})`);
          const body = await res.json();
          const steps: RoutineStep[] = (body.routine?.steps ?? body.steps ?? [])
            .slice()
            .sort((a: RoutineStep, b: RoutineStep) => a.step_order - b.step_order);
          loaded.push({ routineId: r.id, routineName: r.name, steps });
        }
        if (cancelled) return;
        setGroups(loaded);
        // Merge: preserve in-progress edits for steps still present; seed new ones.
        setDrafts((prev) => {
          const next: Record<string, Draft> = {};
          for (const g of loaded) for (const s of g.steps) next[s.id] = prev[s.id] ?? draftFromStep(s);
          return next;
        });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const setField = (stepId: string, field: keyof Draft, value: string) => {
    setError(null);
    setDrafts((prev) => ({ ...prev, [stepId]: { ...prev[stepId], [field]: value } }));
  };
  // Hand-editing the question detaches the library link → proposed-new snapshot.
  const setQuestionText = (stepId: string, value: string) => {
    setError(null);
    setDrafts((prev) => ({
      ...prev,
      [stepId]: { ...prev[stepId], assigned_question_text: value, assigned_question_id: null, proposed_new: true },
    }));
  };

  const allSteps = groups.flatMap((g) => g.steps);

  // AI suggest across the whole selection: one enrich call PER routine, in order.
  const handleEnrich = async () => {
    if (enriching || submitting || allSteps.length === 0) return;
    setEnriching(true);
    setError(null);
    setNotice(null);
    try {
      let suggested = 0;
      let proposed = 0;
      let emptyLibrary = false;
      for (const g of groups) {
        if (g.steps.length === 0) continue;
        const res = await fetch('/api/operations/content/enrich-routine', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ routine_id: g.routineId }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(`"${g.routineName}": ${body?.message ?? body?.error ?? res.status}`);
        const enriched: EnrichedStep[] = body.steps ?? [];
        if (body.library_size === 0) emptyLibrary = true;
        const byId = new Map(enriched.map((e) => [e.routine_step_id, e]));
        setDrafts((prev) => {
          const next = { ...prev };
          for (const s of g.steps) {
            const e = byId.get(s.id);
            if (!e) continue;
            const d = next[s.id];
            next[s.id] = {
              ...d,
              camera_needed: e.camera_needed ?? d.camera_needed,
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
        suggested += enriched.length;
        proposed += enriched.filter((e) => e.proposed_new).length;
      }
      setNotice(
        `AI suggested ${suggested} scene${suggested === 1 ? '' : 's'} across ${groups.length} routine${groups.length === 1 ? '' : 's'}` +
          (emptyLibrary
            ? ' — your question library is empty, so questions are newly proposed. Add the keepers to your library.'
            : proposed > 0
              ? ` — ${proposed} use newly-proposed wording (no library fit). Review before saving.`
              : ' — all questions assigned from your library. Review/tweak, then save.')
      );
      setEnriching(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to get AI suggestions');
      setEnriching(false);
    }
  };

  const handleSubmit = async () => {
    if (submitting || allSteps.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      for (const g of groups) {
        for (const step of g.steps) {
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
            throw new Error(`"${g.routineName}" / "${step.activity}": ${msg}`);
          }
        }
      }
      window.dispatchEvent(new Event(CONTENT_SCENES_CHANGED_EVENT));
      setNotice('Saved — confirmed scenes updated below.');
      onSaved?.();
      setSubmitting(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to save scenes');
      setSubmitting(false);
    }
  };

  // Combined scene number across the whole table.
  let runningNumber = 0;

  return (
    <div className="bg-white rounded border border-brand-purple shadow-sm p-5 space-y-3 text-xs font-mono">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold tracking-wide text-text-primary text-sm">
          2 · SCENIFY DRAFT
          <span className="ml-2 font-normal text-text-faint">
            {groups.length} routine{groups.length === 1 ? '' : 's'} · {allSteps.length} scene{allSteps.length === 1 ? '' : 's'}
          </span>
        </h2>
        <button
          type="button"
          onClick={handleEnrich}
          disabled={enriching || submitting || loading || allSteps.length === 0}
          className="px-2 py-1 border border-brand-purple rounded text-brand-purple hover:bg-purple-100/50 disabled:opacity-50"
        >
          {enriching ? 'thinking…' : '✨ AI suggest'}
        </button>
      </div>
      <p className="text-text-muted">
        Selected routines, in order — fill the shot fields (the per-day script lives in the grid cells).
        AI suggest prefills angle / shot type / b-roll and the best-fit question; everything stays editable.
      </p>

      {notice && (
        <div className="px-3 py-2 rounded border bg-purple-50 border-brand-purple/40 text-text-primary">{notice}</div>
      )}
      {error && (
        <div className="px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800">{error}</div>
      )}

      {loading ? (
        <p className="text-text-faint">Loading steps…</p>
      ) : allSteps.length === 0 ? (
        <p className="text-text-muted">
          The selected routine{groups.length === 1 ? ' has' : 's have'} no steps yet — add steps on the Routines tab first.
        </p>
      ) : (
        <div className="overflow-x-auto max-h-[520px] overflow-y-auto border border-border-light rounded">
          <table className="border-collapse text-xs font-mono w-full">
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
              {groups.map((g, gi) => (
                <RoutineGroup
                  key={g.routineId}
                  group={g}
                  index={gi}
                  drafts={drafts}
                  startNumber={() => (runningNumber += 1)}
                  setField={setField}
                  setQuestionText={setQuestionText}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center gap-2 pt-2 border-t border-border-light">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || enriching || loading || allSteps.length === 0}
          className="px-3 py-1 border border-brand-purple bg-brand-purple text-white rounded hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? 'saving…' : 'save scenes'}
        </button>
        <span className="text-text-faint">saved scenes appear in the confirmed grid below</span>
      </div>
    </div>
  );
}

// A routine's separator band + its step rows (combined numbering via startNumber()).
function RoutineGroup({
  group,
  index,
  drafts,
  startNumber,
  setField,
  setQuestionText,
}: {
  group: Group;
  index: number;
  drafts: Record<string, Draft>;
  startNumber: () => number;
  setField: (stepId: string, field: keyof Draft, value: string) => void;
  setQuestionText: (stepId: string, value: string) => void;
}) {
  return (
    <>
      <tr>
        <td
          colSpan={8}
          className={`border border-border-light px-2 py-1 bg-purple-50/60 text-brand-purple font-semibold ${
            index > 0 ? 'border-t-2 border-t-brand-purple/40' : ''
          }`}
        >
          🎬 {group.routineName}
          <span className="ml-2 font-normal text-text-muted">
            {group.steps.length} step{group.steps.length === 1 ? '' : 's'}
          </span>
        </td>
      </tr>
      {group.steps.length === 0 ? (
        <tr>
          <td colSpan={8} className="border border-border-light px-2 py-1 text-text-faint">
            no steps — add them on the Routines tab
          </td>
        </tr>
      ) : (
        group.steps.map((step) => {
          const d = drafts[step.id];
          if (!d) return null;
          const n = startNumber();
          const time = fmtTime(step.time_of_day);
          const hasQuestion = d.assigned_question_text.trim().length > 0;
          return (
            <tr key={step.id}>
              <td className="border border-border-light px-2 py-1 align-top text-center text-text-muted">{n}</td>
              <th
                scope="row"
                className="border border-border-light px-2 py-1 align-top text-left font-normal text-text-primary min-w-[140px]"
              >
                <div className="font-medium">{step.activity}</div>
                {time && <div className="text-text-muted">{time}</div>}
              </th>
              <td className="border border-border-light p-0 align-top min-w-[120px]">
                <textarea
                  maxLength={200}
                  value={d.camera_needed}
                  onChange={(e) => setField(step.id, 'camera_needed', e.target.value)}
                  rows={2}
                  className={`${cellInputClass} block resize-y`}
                />
              </td>
              <td className="border border-border-light p-0 align-top min-w-[120px]">
                <textarea
                  maxLength={200}
                  value={d.filming_angle}
                  onChange={(e) => setField(step.id, 'filming_angle', e.target.value)}
                  rows={2}
                  className={`${cellInputClass} block resize-y`}
                />
              </td>
              <td className="border border-border-light p-0 align-top min-w-[120px]">
                <textarea
                  maxLength={200}
                  value={d.shot_type}
                  onChange={(e) => setField(step.id, 'shot_type', e.target.value)}
                  rows={2}
                  className={`${cellInputClass} block resize-y`}
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
                      <span className="px-1.5 py-0.5 rounded border border-amber-400 bg-amber-50 text-amber-700 text-[10px] tracking-wide">
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
        })
      )}
    </>
  );
}
