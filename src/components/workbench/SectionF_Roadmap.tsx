/**
 * src/components/workbench/SectionF_Roadmap.tsx
 *
 * Compact roadmap summary: missions/projects/workstreams/compliance_tasks
 * count per status, list of recent missions. Full editing lives at
 * /ops/missions.
 */

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface MissionRow {
  id: string;
  title: string;
  status: string;
  updated_at: string;
}

interface RoadmapData {
  missions: MissionRow[];
  total_missions: number;
}

function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'just now';
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

export function SectionF_Roadmap() {
  const [data, setData] = useState<RoadmapData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/missions?limit=10');
        if (res.ok) {
          const body = await res.json();
          const allMissions: MissionRow[] = (body?.missions ?? []).map(
            (m: { id: string; title: string; status: string; updated_at: string }) => ({
              id: m.id,
              title: m.title,
              status: m.status,
              updated_at: m.updated_at,
            })
          );
          // /api/missions ignores ?limit and returns up to 100; trim client-side.
          const missions = allMissions.slice(0, 10);
          setData({
            missions,
            total_missions: body?.count ?? allMissions.length,
          });
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <section className="bg-white rounded border border-border shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-mono text-sm font-bold tracking-wide text-text-primary">
          F · ROADMAP
        </h2>
        <Link
          href="/ops/missions"
          className="text-xs font-mono text-brand-purple hover:underline"
        >
          full view →
        </Link>
      </div>

      {loading ? (
        <div className="text-xs font-mono text-text-muted">loading…</div>
      ) : data && data.missions.length > 0 ? (
        <div className="space-y-1 text-xs font-mono">
          <div className="text-text-faint uppercase tracking-wide mb-2">
            {data.total_missions.toLocaleString()} mission(s)
          </div>
          {data.missions.map((m) => (
            <Link
              key={m.id}
              href={`/ops/missions/${m.id}`}
              className="flex items-center justify-between py-1 px-2 -mx-2 rounded hover:bg-bg-row"
            >
              <span className="text-text-primary truncate">{m.title}</span>
              <span className="text-text-muted ml-3 shrink-0">
                {m.status} · {relTime(m.updated_at)}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-xs font-mono text-text-muted leading-relaxed">
          No missions yet. Once Phase 2 (PRs 16-25) ships the multi-model
          ensemble, discovery runs will populate this section automatically
          from the founder profile + corpus retrieval. Until then, missions
          can be created manually at{' '}
          <Link href="/ops/missions" className="text-brand-purple hover:underline">
            /ops/missions
          </Link>
          .
        </div>
      )}
    </section>
  );
}
