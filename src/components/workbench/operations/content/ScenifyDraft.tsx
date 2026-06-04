/**
 * ScenifyDraft — STEP 2: THE DAY'S MAP (OPS-CE-8D). The inline scene-map draft now
 * shows the whole selected DAY in chronological order: the selected routines' steps
 * (editable scene rows) INTERLEAVED with the day's committed/planned project TASKS
 * (read-only amber bands), positioned by the CE-8B shared dayOrder comparator —
 * routines and tasks both have times; projects are done BETWEEN routines.
 *
 * Scene rows are unchanged (editable shot fields + assigned question; "✨ AI suggest"
 * per-routine; "save scenes" → the EXISTING /content/scene-rows upsert, payload
 * byte-identical). Task rows are READ-ONLY (time · full wrapped title · project ·
 * status), loaded via the EXISTING GET /daily-plan/items for the selected date.
 *
 * Chronology wins the ordering; each scene keeps its routine name as a secondary
 * label. Tasks get NO shot fields this PR (a "shotify a task" concept needs schema —
 * flagged follow-up). 0-schema, zero new write paths.
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CONTENT_DAY_PLAN_CHANGED_EVENT, CONTENT_SCENES_CHANGED_EVENT } from './ScenifyModal';
import TaskTimeCommit from './TaskTimeCommit';
import {
  compareDayOrder,
  minuteOfDayFromInstant,
  minuteOfDayFromTime,
} from '@/lib/content/dayOrder';

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
interface CalendarBlock {
  id: string;
  scheduled_start: string;
  scheduled_end: string;
  actual_start: string | null;
  actual_end: string | null;
  status: string;
}
interface PlanItem {
  id: string;
  ad_hoc_title: string | null;
  task: { id: string; title: string; project_id: string; status: string } | null;
  calendar_blocks: CalendarBlock[];
}
// A read-only task band in the day map.
interface TaskView {
  id: string;
  itemId?: string; // the daily_plan_item id — present on planned (block-less) rows
  title: string;
  projectName: string | null;
  status: string;
  label: string;
  planned: boolean;
}

const headerCellClass =
  'sticky top-0 z-10 bg-bg-row border border-border-light px-2 py-1.5 text-left text-brand-purple font-semibold uppercase tracking-wide whitespace-nowrap';
const cellInputClass =
  'w-full px-2 py-1 bg-white text-text-primary placeholder:text-text-muted focus:outline-none focus:bg-purple-50/40 focus:ring-1 focus:ring-inset focus:ring-brand-purple';
// Untimed/planned task rows sink after the untimed scenes (whose order is small).
const UNTIMED_TASK_ORDER_BASE = 100000;

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
const fmtClock = (iso: string): string => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export default function ScenifyDraft({
  routines,
  date,
  onSaved,
}: {
  routines: { id: string; name: string }[];
  date: string;
  onSaved?: () => void;
}) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [planItems, setPlanItems] = useState<PlanItem[]>([]);
  const [projectNameById, setProjectNameById] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // OPS-CE-8: Alex's actual gear, passed per-call to enrich (no persistence yet —
  // the gear library is the schema follow-up). Default iPhone.
  const [cameras, setCameras] = useState('iPhone');

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

  // The day's project tasks (read-only) — the EXISTING GET; items + their blocks are
  // already returned. Re-load on date change. + project names for labels.
  const loadDay = useCallback(async () => {
    try {
      const [itemsRes, projRes] = await Promise.all([
        fetch(`/api/operations/daily-plan/items?from=${date}&to=${date}`, { credentials: 'include' }),
        fetch('/api/operations/projects', { credentials: 'include' }),
      ]);
      if (itemsRes.ok) setPlanItems((await itemsRes.json()).items ?? []);
      if (projRes.ok) {
        const map: Record<string, string> = {};
        for (const p of (await projRes.json()).projects ?? []) map[p.id] = p.title;
        setProjectNameById(map);
      }
    } catch {
      /* leave prior tasks on a transient failure */
    }
  }, [date]);
  useEffect(() => {
    void loadDay();
  }, [loadDay]);
  // Re-read the day's tasks when one is added to the day (S1 add-to-day).
  useEffect(() => {
    const refresh = () => void loadDay();
    window.addEventListener(CONTENT_DAY_PLAN_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(CONTENT_DAY_PLAN_CHANGED_EVENT, refresh);
  }, [loadDay]);

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
          body: JSON.stringify({ routine_id: g.routineId, cameras }),
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

  // THE DAY'S MAP: scenes (all routines) + tasks, sorted chronologically by the ONE
  // shared dayOrder comparator. Untimed scenes sink by selection-then-step order;
  // planned (block-less) tasks sink after them; timed rows interleave by clock.
  type MapRow =
    | { kind: 'scene'; minute: number | null; order: number; step: RoutineStep; routineName: string }
    | { kind: 'task'; minute: number | null; order: number; task: TaskView };
  const dayMap = useMemo<MapRow[]>(() => {
    const rows: MapRow[] = [];
    groups.forEach((g, gi) => {
      for (const s of g.steps) {
        rows.push({
          kind: 'scene',
          minute: minuteOfDayFromTime(s.time_of_day),
          order: gi * 1000 + s.step_order,
          step: s,
          routineName: g.routineName,
        });
      }
    });
    let plannedIndex = 0;
    for (const item of planItems) {
      const title = item.task?.title ?? item.ad_hoc_title ?? 'Untitled';
      const projectName = item.task?.project_id ? projectNameById[item.task.project_id] ?? null : null;
      if (item.calendar_blocks.length === 0) {
        rows.push({
          kind: 'task',
          minute: null,
          order: UNTIMED_TASK_ORDER_BASE + plannedIndex++,
          task: {
            id: `item-${item.id}`,
            itemId: item.id,
            title,
            projectName,
            status: 'planned',
            label: 'planned · no time yet',
            planned: true,
          },
        });
        continue;
      }
      for (const b of item.calendar_blocks) {
        const useActual = !!b.actual_start;
        const start = useActual ? (b.actual_start as string) : b.scheduled_start;
        const end = useActual ? b.actual_end : b.scheduled_end;
        const minute = minuteOfDayFromInstant(start);
        rows.push({
          kind: 'task',
          minute,
          order: minute,
          task: {
            id: b.id,
            title,
            projectName,
            status: b.status,
            label: `${fmtClock(start)}–${end ? fmtClock(end) : '…'} ${useActual ? '(actual)' : '(scheduled)'}`,
            planned: false,
          },
        });
      }
    }
    rows.sort(compareDayOrder);
    return rows;
  }, [groups, planItems, projectNameById]);

  const taskCount = dayMap.filter((r) => r.kind === 'task').length;

  const renderSceneRow = (step: RoutineStep, routineName: string, n: number) => {
    const d = drafts[step.id];
    if (!d) return null;
    const time = fmtTime(step.time_of_day);
    const hasQuestion = d.assigned_question_text.trim().length > 0;
    return (
      <tr key={`scene-${step.id}`}>
        <td className="border border-border-light px-2 py-1 align-top text-center text-text-muted">{n}</td>
        <th
          scope="row"
          className="border border-border-light px-2 py-1 align-top text-left font-normal text-text-primary min-w-[140px]"
        >
          <div className="font-medium">{step.activity}</div>
          {time && <div className="text-text-muted">{time}</div>}
          <div className="text-text-muted text-[10px]">🎬 {routineName}</div>
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
  };

  // Read-only task band (S3's style), spanning the table; full title WRAPPED.
  const renderTaskRow = (task: TaskView) => (
    <tr key={`task-${task.id}`}>
      <td colSpan={8} className="border border-border-light border-l-4 border-l-amber-400 bg-amber-50/50 px-3 py-1.5 align-top">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-amber-700" aria-hidden="true">▦</span>
          <span className={task.planned ? 'text-text-muted' : 'text-text-primary font-semibold tabular-nums'}>{task.label}</span>
          <span className="text-text-primary break-words">{task.title}</span>
          {task.projectName && <span className="text-text-muted">· {task.projectName}</span>}
          {/* OPS-CE-8E: set the time inline (first commit) for block-less rows. */}
          {task.planned && task.itemId && <TaskTimeCommit itemId={task.itemId} date={date} />}
          <span className="ml-auto shrink-0 px-1.5 py-0.5 rounded border border-amber-300 bg-white text-amber-700 text-[10px] uppercase tracking-wide">
            {task.status}
          </span>
        </div>
      </td>
    </tr>
  );

  let sceneNo = 0;

  return (
    <div className="bg-white rounded border border-brand-purple shadow-sm p-5 space-y-3 text-xs font-mono">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-medium tracking-wide text-brand-purple text-sm">
          2 · AI SCRIPT MAP
          <span className="ml-2 font-normal text-text-muted">
            the day in order · {allSteps.length} scene{allSteps.length === 1 ? '' : 's'} · {taskCount} task{taskCount === 1 ? '' : 's'}
          </span>
        </h2>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-brand-purple font-medium">
            cameras available
            <input
              type="text"
              value={cameras}
              onChange={(e) => setCameras(e.target.value)}
              placeholder="iPhone"
              className="w-40 px-2 py-1 bg-white border border-brand-purple/40 rounded text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple"
            />
          </label>
          <button
            type="button"
            onClick={handleEnrich}
            disabled={enriching || submitting || loading || allSteps.length === 0}
            className="px-2 py-1 border border-brand-purple rounded text-brand-purple hover:bg-purple-100/50 disabled:opacity-50"
          >
            {enriching ? 'thinking…' : '✨ AI suggest'}
          </button>
        </div>
      </div>
      <p className="text-text-muted">
        The whole day in clock order — routine scenes (editable) with the day&rsquo;s project tasks
        slotted between them (read-only; commit times on the Daily Plan tab). AI suggest tunes the
        scenes for virality using your cameras; everything on the scene rows stays editable.
      </p>

      {notice && (
        <div className="px-3 py-2 rounded border bg-purple-50 border-brand-purple/40 text-text-primary">{notice}</div>
      )}
      {error && (
        <div className="px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800">{error}</div>
      )}

      {loading ? (
        <p className="text-text-muted">Loading steps…</p>
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
              {dayMap.map((row) =>
                row.kind === 'scene'
                  ? renderSceneRow(row.step, row.routineName, ++sceneNo)
                  : renderTaskRow(row.task)
              )}
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
        <span className="text-text-muted">saved scenes appear in the confirmed grid below · task rows are read-only</span>
      </div>
    </div>
  );
}
