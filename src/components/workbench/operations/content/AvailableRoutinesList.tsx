/**
 * AvailableRoutinesList — interactive list of not-yet-scenified routines.
 *
 * Filters the supplied routines to those without a content_scene_group and
 * renders each with a ScenifyButton. Mounted on the Content tab below
 * the ContentTable. When every routine has a scene, shows a done state.
 */

'use client';

import type { Scene, Routine } from './ContentTable';
import ScenifyButton from './ScenifyButton';
import { themed, type Surface } from '@/lib/ds';

export default function AvailableRoutinesList({ surface = 'light',
  routines,
  onScenify,
}: { surface?: Surface;
  routines: Routine[];
  onScenify: (newScene: Scene) => void;
}) {
  const dk = surface === 'dark';
  const available = routines.filter((r) => !r.content_scene_group);

  return (
    <div className="space-y-2">
      <h3 className={themed('text-xs font-mono text-text-faint uppercase tracking-wide', dk)}>
        Available Routines
      </h3>
      {available.length === 0 ? (
        <p className={themed('text-sm text-text-secondary', dk)}>All routines scenified. 🎬</p>
      ) : (
        <ul className="space-y-1">
          {available.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2">
              <span className={themed('text-sm text-text-secondary', dk)}>{r.name}</span>
              <ScenifyButton surface={surface} routine={r} onScenify={onScenify} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
