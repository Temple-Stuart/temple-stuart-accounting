/**
 * SceneHeaderRow — the bold header row for one scene in ContentTable.
 *
 * Scene-level columns (Scene, Title, Focus, Hours, Day, Loc Base,
 * Script) are filled; take-level columns are rendered as empty cells
 * — they belong to the TakeRow children below.
 */

import type { Scene, Routine } from './ContentTable';
import { formatDay, formatHours, truncateScript, dashOrValue } from './ContentTable';

export default function SceneHeaderRow({
  scene,
  routine,
}: {
  scene: Scene;
  routine: Routine;
}) {
  return (
    <tr className="border-t border-border-light bg-bg-row font-semibold text-text-primary">
      <td className="py-1 px-2">{scene.scene_number}</td>
      <td className="py-1 px-2">{scene.scene_title}</td>
      <td className="py-1 px-2">{dashOrValue(scene.focus_category)}</td>
      <td className="py-1 px-2">{formatHours(scene.estimated_hours)}</td>
      <td className="py-1 px-2">{formatDay(routine.schedule_rrule)}</td>
      <td className="py-1 px-2">{dashOrValue(scene.filming_location_base)}</td>
      <td className="py-1 px-2" />
      <td className="py-1 px-2" />
      <td className="py-1 px-2" />
      <td className="py-1 px-2" />
      <td className="py-1 px-2" />
      <td className="py-1 px-2" />
      <td className="py-1 px-2" />
      <td className="py-1 px-2">{truncateScript(scene.script)}</td>
    </tr>
  );
}
