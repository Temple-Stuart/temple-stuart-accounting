/**
 * TakeRow — one routine-step row beneath a SceneHeaderRow.
 *
 * Take-level columns (Time, Activity, Sub-Activity, Loc Specific,
 * Camera, Angle, Notes) are filled; scene-level columns are empty.
 * When no take is attached to the step, the take-owned editable
 * columns render as plain en-dash placeholders — the user must
 * explicitly 🎬 Take the step via the Routines tab before those
 * cells become editable (PR-Ops-4.9.3e).
 */

import type { Step, Take } from './ContentTable';
import { formatTime, dashOrValue } from './ContentTable';
import EditableCell from './EditableCell';

export default function TakeRow({
  step,
  take,
  onTakeUpdate,
}: {
  step: Step;
  take: Take | undefined;
  onTakeUpdate: (
    takeId: string,
    field: string,
    value: string | number | null
  ) => Promise<void>;
}) {
  const cellClass = 'py-1 px-2';
  return (
    <tr className="border-t border-border-light text-text-muted">
      <td className={cellClass} />
      <td className={cellClass} />
      <td className={cellClass} />
      <td className={cellClass} />
      <td className={cellClass} />
      <td className={cellClass} />
      <td className="py-1 px-2 pl-4">{formatTime(step.time_of_day)}</td>
      <td className={cellClass}>{step.activity}</td>
      <td className={cellClass}>{dashOrValue(step.sub_activity)}</td>
      {take ? (
        <>
          <EditableCell
            value={take.filming_location_specific}
            type="text"
            maxLength={200}
            onSave={(v) => onTakeUpdate(take.id, 'filming_location_specific', v)}
            cellClassName={cellClass}
          />
          <EditableCell
            value={take.camera_needed}
            type="text"
            maxLength={200}
            onSave={(v) => onTakeUpdate(take.id, 'camera_needed', v)}
            cellClassName={cellClass}
          />
          <EditableCell
            value={take.filming_angle}
            type="text"
            maxLength={200}
            onSave={(v) => onTakeUpdate(take.id, 'filming_angle', v)}
            cellClassName={cellClass}
          />
          <EditableCell
            value={take.notes}
            type="text"
            onSave={(v) => onTakeUpdate(take.id, 'notes', v)}
            cellClassName={cellClass}
          />
        </>
      ) : (
        <>
          <td className={cellClass}>—</td>
          <td className={cellClass}>—</td>
          <td className={cellClass}>—</td>
          <td className={cellClass}>—</td>
        </>
      )}
      <td className={cellClass} />
    </tr>
  );
}
