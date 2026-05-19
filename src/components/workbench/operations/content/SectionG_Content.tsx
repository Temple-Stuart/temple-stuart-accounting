/**
 * Section G · Content.
 *
 * Shell for the Content production tab. Fetches the three data
 * pipelines the tab is built on — scenes, takes, routines — and
 * renders loading / error / empty / populated states.
 *
 * Populated state renders the spreadsheet-style ContentTable plus an
 * Available Routines list (routines not yet scenified). Loading,
 * error and empty states stay as plain text.
 *
 * "Scenified" status is derived client-side: GET /api/operations/
 * routines does not include the content_scene relation, so we join
 * on routine_id against the scenes list.
 */

'use client';

import { useEffect, useState } from 'react';
import ContentTable, { type Scene, type Take, type Routine } from './ContentTable';
import AvailableRoutinesList from './AvailableRoutinesList';

export default function SectionG_Content() {
  const [scenes, setScenes] = useState<Scene[] | null>(null);
  const [takes, setTakes] = useState<Take[] | null>(null);
  const [routines, setRoutines] = useState<Routine[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [scenesRes, takesRes, routinesRes] = await Promise.all([
          fetch('/api/operations/content/scenes', { credentials: 'include' }),
          fetch('/api/operations/content/takes', { credentials: 'include' }),
          fetch('/api/operations/routines', { credentials: 'include' }),
        ]);

        const parse = async (res: Response, label: string) => {
          if (!res.ok) {
            const body = await res.text();
            throw new Error(`${label} request failed (${res.status}): ${body}`);
          }
          return res.json();
        };

        const [scenesBody, takesBody, routinesBody] = await Promise.all([
          parse(scenesRes, 'scenes'),
          parse(takesRes, 'takes'),
          parse(routinesRes, 'routines'),
        ]);

        if (cancelled) return;
        setScenes(scenesBody.scenes);
        setTakes(takesBody.takes);
        setRoutines(routinesBody.routines);
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'failed to load content');
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Optimistic update — a successful scenify POST adds the new scene to
  // the table and marks its routine scenified, without a refetch.
  const handleScenify = (newScene: Scene) => {
    setScenes((prev) => [...(prev ?? []), newScene]);
    setRoutines((prev) =>
      prev
        ? prev.map((r) =>
            r.id === newScene.routine_id
              ? { ...r, content_scene: { id: newScene.id } }
              : r
          )
        : prev
    );
  };

  return (
    <section className="bg-white rounded border border-border shadow-sm p-5 space-y-4">
      <h2 className="font-mono text-sm font-bold tracking-wide text-text-primary">
        G · CONTENT
      </h2>

      {loading ? (
        <p className="text-sm font-mono text-text-faint">Loading content...</p>
      ) : error ? (
        <div className="text-xs font-mono px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800">
          {error}
        </div>
      ) : !scenes || !routines || !takes ? (
        <p className="text-sm font-mono text-text-faint">Data missing.</p>
      ) : (
        <ContentSummary
          scenes={scenes}
          takes={takes}
          routines={routines}
          onScenify={handleScenify}
        />
      )}
    </section>
  );
}

function ContentSummary({
  scenes,
  takes,
  routines,
  onScenify,
}: {
  scenes: Scene[];
  takes: Take[];
  routines: Routine[];
  onScenify: (newScene: Scene) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-text-secondary">
        {scenes.length} scenes · {takes.length} takes · {routines.length} routines
      </p>

      {scenes.length === 0 ? (
        <>
          <p className="text-sm text-text-secondary">
            No scenes yet. Pick a routine to start filming.
          </p>
          <AvailableRoutinesList routines={routines} onScenify={onScenify} />
        </>
      ) : (
        <>
          <ContentTable scenes={scenes} takes={takes} routines={routines} />
          <AvailableRoutinesList routines={routines} onScenify={onScenify} />
        </>
      )}
    </div>
  );
}
