/**
 * ContentTable — read-only spreadsheet view of scenes and their takes.
 *
 * 14-column layout: one bold scene header row per scene followed by
 * one take row per routine step (ordered by step_order ASC). Scene-
 * level columns are filled on the header row and empty on take rows;
 * take-level columns are the inverse.
 *
 * Data is stitched client-side: routines (with their nested steps)
 * and takes arrive as flat arrays; lookup maps join them to each
 * scene. A scene whose routine_id is absent from the routines map is
 * skipped with a console.warn — no placeholder row.
 *
 * The Day column derives from the routine's RFC 5545 schedule_rrule
 * via rruleFromString — operations_routines has no weekday column.
 */

import { Fragment } from 'react';
import { rruleFromString } from '@/lib/operations/rruleHelpers';
import {
  WEEKDAY_LABELS,
  WEEKDAY_ORDER,
} from '@/components/workbench/operations/routines/types';
import SceneHeaderRow from './SceneHeaderRow';
import TakeRow from './TakeRow';

export type Step = {
  id: string;
  activity: string;
  sub_activity: string | null;
  time_of_day: string | null;
  step_order: number;
  /** Present when the step has been take-ified; null/absent otherwise. */
  content_take?: { id: string } | null;
};

export type Routine = {
  id: string;
  name: string;
  entity_id: string;
  schedule_rrule: string | null;
  steps: Step[];
  /** Present when the routine has been scenified; null/absent otherwise. */
  content_scene?: { id: string } | null;
};

export type Scene = {
  id: string;
  routine_id: string;
  entity_id: string;
  scene_number: number;
  scene_title: string;
  focus_category: string | null;
  filming_location_base: string | null;
  estimated_hours: string | number | null;
  script: string | null;
};

export type Take = {
  id: string;
  routine_step_id: string;
  entity_id: string;
  filming_location_specific: string | null;
  camera_needed: string | null;
  filming_angle: string | null;
  notes: string | null;
};

/**
 * Derive the Day column from a routine's RRULE. Returns "—" when the
 * rule has no explicit BYDAY weekday set (e.g. plain FREQ=DAILY, or a
 * monthly nth-weekday rule) — no fallback to a coarse cadence label.
 */
export function formatDay(schedule_rrule: string | null): string {
  if (!schedule_rrule) return '—';
  let byweekday: number[] | null;
  try {
    byweekday = rruleFromString(schedule_rrule).options.byweekday;
  } catch (e) {
    console.warn('[ContentTable] malformed schedule_rrule:', schedule_rrule, e);
    return '—';
  }
  if (!byweekday || byweekday.length === 0) return '—';
  if (byweekday.length === 7) return 'Daily';
  // rrule.js byweekday integers are 0=Mon … 6=Sun — same index as WEEKDAY_ORDER.
  const present = new Set(byweekday);
  return WEEKDAY_ORDER.filter((_, idx) => present.has(idx))
    .map((code) => WEEKDAY_LABELS[code])
    .join(', ');
}

/** Extract HH:MM from a @db.Time value serialized as an ISO datetime string. */
export function formatTime(time_of_day: string | null): string {
  if (!time_of_day) return '—';
  return time_of_day.slice(11, 16);
}

export function formatHours(estimated_hours: string | number | null): string {
  if (estimated_hours === null || estimated_hours === undefined) return '—';
  return `${String(estimated_hours)}h`;
}

export function truncateScript(script: string | null): string {
  if (!script) return '—';
  return script.length <= 50 ? script : `${script.slice(0, 50)}…`;
}

export function dashOrValue(v: string | null): string {
  if (v === null || v === undefined || v === '') return '—';
  return v;
}

const HEADERS = [
  'Scene',
  'Title',
  'Focus',
  'Hours',
  'Day',
  'Loc (Base)',
  'Time',
  'Activity',
  'Sub-Activity',
  'Loc (Specific)',
  'Camera',
  'Angle',
  'Notes',
  'Script',
];

export default function ContentTable({
  scenes,
  takes,
  routines,
  onSceneUpdate,
  onTakeUpdate,
  onScriptClick,
}: {
  scenes: Scene[];
  takes: Take[];
  routines: Routine[];
  onSceneUpdate: (
    sceneId: string,
    field: string,
    value: string | number | null
  ) => Promise<void>;
  onTakeUpdate: (
    takeId: string,
    field: string,
    value: string | number | null
  ) => Promise<void>;
  onScriptClick: (scene: Scene) => void;
}) {
  const routinesById = new Map(routines.map((r) => [r.id, r]));
  const takesByStepId = new Map(takes.map((t) => [t.routine_step_id, t]));

  const orderedScenes = [...scenes].sort((a, b) => a.scene_number - b.scene_number);

  return (
    <div className="text-xs font-mono overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="text-text-faint uppercase tracking-wide">
            {HEADERS.map((h) => (
              <th key={h} className="text-left pb-1 px-2 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orderedScenes.map((scene) => {
            const routine = routinesById.get(scene.routine_id);
            if (!routine) {
              console.warn(
                `[ContentTable] scene ${scene.id} references missing routine ` +
                  `${scene.routine_id} — row skipped`
              );
              return null;
            }
            const steps = [...routine.steps].sort(
              (a, b) => a.step_order - b.step_order
            );
            return (
              <Fragment key={scene.id}>
                <SceneHeaderRow
                  scene={scene}
                  routine={routine}
                  onSceneUpdate={onSceneUpdate}
                  onScriptClick={onScriptClick}
                />
                {steps.map((step) => (
                  <TakeRow
                    key={step.id}
                    step={step}
                    take={takesByStepId.get(step.id)}
                    onTakeUpdate={onTakeUpdate}
                  />
                ))}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
