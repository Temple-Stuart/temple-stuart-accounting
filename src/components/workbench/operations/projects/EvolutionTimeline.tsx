/**
 * EvolutionTimeline — the LIVE, authed container for a project's read-only
 * trajectory (AI re-runs / versions, the append-only loop made visible).
 *
 * PR2 split: this file keeps the EXACT live behavior it had before (self-fetch
 * GET /api/operations/projects/[projectId]/evolution on mount) and now renders
 * the pure <EvolutionTimelineView/> with the live loading/error/data as props.
 * The public name + prop shape ({ projectId }) are unchanged, so the existing
 * call site (ProjectRow.tsx:530) is untouched and /operations/projects behaves
 * identically. READ-ONLY: no edit/delete/create. NO new behavior, NO demo data.
 *
 * The evolution endpoint reads operations_project_tasks grouped by their
 * source_ai_usage_id "version" and hydrates from operations_ai_usage
 * (evolution/route.ts:60,84).
 */

'use client';

import { useEffect, useState } from 'react';
import EvolutionTimelineView, { type EvolutionResponse } from './EvolutionTimelineView';

interface Props {
  projectId: string;
}

export default function EvolutionTimeline({ projectId }: Props) {
  const [data, setData] = useState<EvolutionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/operations/projects/${projectId}/evolution`);
        const body = await res.json();
        if (!res.ok) {
          if (!cancelled) setError(body?.message ?? body?.error ?? 'failed to load evolution');
          return;
        }
        if (!cancelled) setData(body as EvolutionResponse);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'failed to load evolution');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return <EvolutionTimelineView loading={loading} error={error} data={data} />;
}
