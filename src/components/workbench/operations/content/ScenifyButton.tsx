/**
 * ScenifyButton — the 🎬 Scenify affordance for a routine.
 *
 * Reshaped (PR-Ops-grid-6): always offers the Scenify form (it now creates/
 * edits grid scene-ROWS per step rather than a one-off container, so a
 * routine can be re-scenified to refine its shot fields). Toggles the
 * inline ScenifyModal, which upserts one scene-row per routine step and
 * broadcasts a refresh to the PieceGrid.
 *
 * Used on the Content tab (AvailableRoutinesList) and the Routines tab
 * (RoutineRow). `onScenify` is retained as an optional, no-longer-invoked
 * prop purely so those existing call sites compile unchanged — the grid
 * refresh is driven by the modal's window event, not this callback.
 */

'use client';

import { useState } from 'react';
import type { Scene } from './ContentTable';
import ScenifyModal from './ScenifyModal';

export default function ScenifyButton({
  routine,
}: {
  routine: { id: string; name: string };
  /** Legacy callback from the container-scene flow; no longer invoked. */
  onScenify?: (newScene: Scene) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="px-2 py-1 border border-border rounded hover:bg-bg-row text-xs font-mono"
      >
        🎬 Scenify
      </button>
      {open && (
        <ScenifyModal
          routine={{ id: routine.id, name: routine.name }}
          open={open}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
