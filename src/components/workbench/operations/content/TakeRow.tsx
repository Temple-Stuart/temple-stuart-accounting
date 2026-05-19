/**
 * TakeRow — one routine-step row beneath a SceneHeaderRow.
 *
 * Take-level columns (Time, Activity, Sub-Activity, Loc Specific,
 * Camera, Angle, Notes) are filled; scene-level columns are empty.
 * When no take is attached to the step, the take-owned columns
 * render as en-dash placeholders.
 */

import type { Step, Take } from './ContentTable';
import { formatTime, dashOrValue } from './ContentTable';

export default function TakeRow({
  step,
  take,
}: {
  step: Step;
  take: Take | undefined;
}) {
  return (
    <tr className="border-t border-border-light text-text-muted">
      <td className="py-1 px-2" />
      <td className="py-1 px-2" />
      <td className="py-1 px-2" />
      <td className="py-1 px-2" />
      <td className="py-1 px-2" />
      <td className="py-1 px-2" />
      <td className="py-1 px-2 pl-4">{formatTime(step.time_of_day)}</td>
      <td className="py-1 px-2">{step.activity}</td>
      <td className="py-1 px-2">{dashOrValue(step.sub_activity)}</td>
      <td className="py-1 px-2">
        {take ? dashOrValue(take.filming_location_specific) : '—'}
      </td>
      <td className="py-1 px-2">{take ? dashOrValue(take.camera_needed) : '—'}</td>
      <td className="py-1 px-2">{take ? dashOrValue(take.filming_angle) : '—'}</td>
      <td className="py-1 px-2">{take ? dashOrValue(take.notes) : '—'}</td>
      <td className="py-1 px-2" />
    </tr>
  );
}
