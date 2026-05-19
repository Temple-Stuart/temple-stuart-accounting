/**
 * SceneHeaderRow — the bold header row for one scene in ContentTable.
 *
 * Scene-level columns (Scene, Title, Focus, Hours, Day, Loc Base,
 * Script) are filled; take-level columns are rendered as empty cells
 * — they belong to the TakeRow children below.
 *
 * Editable cells (PR-Ops-4.9.3e): scene_title, focus_category,
 * filming_location_base, estimated_hours. Click → input. Script stays
 * read-only here (drawer in 4.9.3f); scene_number and Day are derived
 * and never editable.
 */

import type { Scene, Routine } from './ContentTable';
import { formatDay, formatHours, truncateScript } from './ContentTable';
import EditableCell from './EditableCell';

export default function SceneHeaderRow({
  scene,
  routine,
  onSceneUpdate,
  onScriptClick,
}: {
  scene: Scene;
  routine: Routine;
  onSceneUpdate: (
    sceneId: string,
    field: string,
    value: string | number | null
  ) => Promise<void>;
  onScriptClick: (scene: Scene) => void;
}) {
  const cellClass = 'py-1 px-2';
  return (
    <tr className="border-t border-border-light bg-bg-row font-semibold text-text-primary">
      <td className={cellClass}>{scene.scene_number}</td>
      <EditableCell
        value={scene.scene_title}
        type="text"
        required
        maxLength={500}
        onSave={(v) => onSceneUpdate(scene.id, 'scene_title', v)}
        cellClassName={cellClass}
      />
      <EditableCell
        value={scene.focus_category}
        type="text"
        maxLength={200}
        onSave={(v) => onSceneUpdate(scene.id, 'focus_category', v)}
        cellClassName={cellClass}
      />
      <EditableCell
        value={scene.estimated_hours}
        type="number"
        min={0.01}
        max={999.99}
        step={0.01}
        renderValue={(v) => formatHours(v as string | number | null)}
        onSave={(v) => onSceneUpdate(scene.id, 'estimated_hours', v)}
        cellClassName={cellClass}
      />
      <td className={cellClass}>{formatDay(routine.schedule_rrule)}</td>
      <EditableCell
        value={scene.filming_location_base}
        type="text"
        maxLength={200}
        onSave={(v) => onSceneUpdate(scene.id, 'filming_location_base', v)}
        cellClassName={cellClass}
      />
      <td className={cellClass} />
      <td className={cellClass} />
      <td className={cellClass} />
      <td className={cellClass} />
      <td className={cellClass} />
      <td className={cellClass} />
      <td className={cellClass} />
      <td className={cellClass}>
        <button
          type="button"
          onClick={() => onScriptClick(scene)}
          className="block w-full text-left cursor-pointer hover:text-brand-purple"
          title="click to edit script"
        >
          {truncateScript(scene.script)}
        </button>
      </td>
    </tr>
  );
}
