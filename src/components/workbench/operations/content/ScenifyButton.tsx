/**
 * ScenifyButton — the 🎬 Scenify affordance for a routine.
 *
 * If the routine already has a scene, renders a non-interactive
 * "🎬 Scenified" badge. Otherwise renders a button that toggles the
 * inline ScenifyModal form. On a successful POST the modal calls
 * onScenify with the new scene so the parent can update state.
 *
 * Used on the Routines tab (via RoutineRow) and the Content tab
 * (via AvailableRoutinesList).
 */

'use client';

import { useState } from 'react';
import type { Scene } from './ContentTable';
import ScenifyModal from './ScenifyModal';

type ScenifyRoutine = {
  id: string;
  name: string;
  content_scene?: { id: string } | null;
};

export default function ScenifyButton({
  routine,
  onScenify,
}: {
  routine: ScenifyRoutine;
  onScenify: (newScene: Scene) => void;
}) {
  const [open, setOpen] = useState(false);

  if (routine.content_scene) {
    return (
      <span
        className="px-2 py-1 border border-border rounded bg-purple-50 text-brand-purple text-xs font-mono"
        title="this routine already has a scene"
      >
        🎬 Scenified
      </span>
    );
  }

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
          onSuccess={onScenify}
        />
      )}
    </>
  );
}
