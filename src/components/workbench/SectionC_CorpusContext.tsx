/**
 * src/components/workbench/SectionC_CorpusContext.tsx
 *
 * Live corpus state: total documents, total chunks, superseded count,
 * last ingestion event, per-source breakdown. Polls every 30s while
 * the workbench is open.
 *
 * Wires to /api/workbench/corpus-context.
 */

'use client';

import { useEffect, useState } from 'react';

interface CorpusContextData {
  total_documents: number;
  total_chunks: number;
  superseded_documents: number;
  last_ingest_event: {
    timestamp: string;
    description: string;
  } | null;
  per_source: Array<{
    domain: string;
    source_name: string;
    document_count: number;
    last_retrieved_at: string | null;
  }>;
}

function relTime(iso: string | null): string {
  if (!iso) return 'never';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'just now';
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

export function SectionC_CorpusContext() {
  const [data, setData] = useState<CorpusContextData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/workbench/corpus-context');
        if (res.ok) {
          setData(await res.json());
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const id = setInterval(fetchData, 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="bg-white rounded border border-border shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-mono text-sm font-bold tracking-wide text-text-primary">
          C · CORPUS CONTEXT
        </h2>
        <span className="text-xs font-mono text-text-muted">refresh 30s</span>
      </div>

      {loading && !data ? (
        <div className="text-xs font-mono text-text-muted">loading…</div>
      ) : data ? (
        <div className="space-y-4 text-xs font-mono">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="documents" value={data.total_documents.toLocaleString()} />
            <Stat label="chunks" value={data.total_chunks.toLocaleString()} />
            <Stat label="superseded" value={data.superseded_documents.toLocaleString()} />
          </div>

          <div>
            <div className="text-text-faint uppercase tracking-wide mb-1">
              last ingestion event
            </div>
            <div className="text-text-primary">
              {data.last_ingest_event
                ? `${data.last_ingest_event.description} · ${relTime(
                    data.last_ingest_event.timestamp
                  )}`
                : 'no ingestion runs yet — first cron at 06:00 UTC'}
            </div>
          </div>

          {data.per_source.length > 0 && (
            <div>
              <div className="text-text-faint uppercase tracking-wide mb-1">
                per source
              </div>
              <table className="w-full">
                <thead>
                  <tr className="text-text-muted">
                    <th className="text-left pb-1">domain</th>
                    <th className="text-right pb-1">documents</th>
                    <th className="text-right pb-1">last fetched</th>
                  </tr>
                </thead>
                <tbody>
                  {data.per_source.map((s) => (
                    <tr key={s.domain} className="border-t border-border-light">
                      <td className="py-1 text-text-primary">{s.domain}</td>
                      <td className="py-1 text-right tabular-nums">
                        {s.document_count.toLocaleString()}
                      </td>
                      <td className="py-1 text-right text-text-muted">
                        {relTime(s.last_retrieved_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="text-xs font-mono text-text-muted">
          unable to load corpus context
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-text-faint uppercase tracking-wide mb-1">{label}</div>
      <div className="text-2xl font-mono text-text-primary tabular-nums">{value}</div>
    </div>
  );
}
