/**
 * Section G · Content.
 *
 * Shell for the Content production tab. Fetches the three data
 * pipelines the tab is built on — scenes, takes, routines — and
 * renders loading / error / empty / populated states.
 *
 * Render here is intentionally minimal: plain counts + a routine
 * name list with scenified status. The spreadsheet-style table
 * (ContentTable, SceneHeaderRow, TakeRow) lands in PR-Ops-4.9.3b.
 *
 * "Scenified" status is derived client-side: GET /api/operations/
 * routines does not include the content_scene relation, so we join
 * on routine_id against the scenes list.
 */

'use client';

import { useEffect, useState } from 'react';

type Scene = {
  id: string;
  routine_id: string;
  scene_number: number;
  scene_title: string;
};

type Take = {
  id: string;
  routine_step_id: string;
};

type Routine = {
  id: string;
  name: string;
};

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
        <ContentSummary scenes={scenes} takes={takes} routines={routines} />
      )}
    </section>
  );
}

function ContentSummary({
  scenes,
  takes,
  routines,
}: {
  scenes: Scene[];
  takes: Take[];
  routines: Routine[];
}) {
  const scenifiedRoutineIds = new Set(scenes.map((s) => s.routine_id));

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
          <h3 className="text-xs font-mono text-text-faint uppercase tracking-wide">
            Available Routines
          </h3>
          <ul className="text-sm text-text-secondary list-disc pl-5">
            {routines.map((r) => (
              <li key={r.id}>{r.name} (not scenified)</li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <h3 className="text-xs font-mono text-text-faint uppercase tracking-wide">
            Scenified Routines
          </h3>
          <ul className="text-sm text-text-secondary list-disc pl-5">
            {routines.map((r) => (
              <li key={r.id}>
                {r.name} ({scenifiedRoutineIds.has(r.id) ? 'scenified' : 'not scenified'})
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
