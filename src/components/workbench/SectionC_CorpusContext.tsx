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
import { themed, type Surface } from '@/lib/ds';

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

export function SectionC_CorpusContext({ surface = 'light' }: { surface?: Surface } = {}) {
  const dk = surface === 'dark';
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
    <section className={themed('bg-white rounded border border-border shadow-sm p-5', dk)}>
      <div className="flex items-center justify-between mb-3">
        <h2 className={themed('font-mono text-sm font-bold tracking-wide text-text-primary', dk)}>
          C · CORPUS CONTEXT
        </h2>
        <span className={themed('text-xs font-mono text-text-muted', dk)}>refresh 30s</span>
      </div>

      {loading && !data ? (
        <div className={themed('text-xs font-mono text-text-muted', dk)}>loading…</div>
      ) : data ? (
        <div className="space-y-4 text-xs font-mono">
          <div className="grid grid-cols-3 gap-3">
            <Stat dk={dk} label="documents" value={data.total_documents.toLocaleString()} />
            <Stat dk={dk} label="chunks" value={data.total_chunks.toLocaleString()} />
            <Stat dk={dk} label="superseded" value={data.superseded_documents.toLocaleString()} />
          </div>

          <div>
            <div className={themed('text-text-faint uppercase tracking-wide mb-1', dk)}>
              last ingestion event
            </div>
            <div className={themed('text-text-primary', dk)}>
              {data.last_ingest_event
                ? `${data.last_ingest_event.description} · ${relTime(
                    data.last_ingest_event.timestamp
                  )}`
                : 'no ingestion runs yet — first cron at 06:00 UTC'}
            </div>
          </div>

          {data.per_source.length > 0 && (
            <div>
              <div className={themed('text-text-faint uppercase tracking-wide mb-1', dk)}>
                per source
              </div>
              <table className="w-full">
                <thead>
                  <tr className={themed('text-text-muted', dk)}>
                    <th className="text-left pb-1">domain</th>
                    <th className="text-right pb-1">documents</th>
                    <th className="text-right pb-1">last fetched</th>
                  </tr>
                </thead>
                <tbody>
                  {data.per_source.map((s) => (
                    <tr key={s.domain} className={themed('border-t border-border-light', dk)}>
                      <td className={themed('py-1 text-text-primary', dk)}>{s.domain}</td>
                      <td className="py-1 text-right tabular-nums">
                        {s.document_count.toLocaleString()}
                      </td>
                      <td className={themed('py-1 text-right text-text-muted', dk)}>
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
        <div className={themed('text-xs font-mono text-text-muted', dk)}>
          unable to load corpus context
        </div>
      )}
    </section>
  );
}

function Stat({ dk = false, label, value }: { dk?: boolean; label: string; value: string }) {
  return (
    <div>
      <div className={themed('text-text-faint uppercase tracking-wide mb-1', dk)}>{label}</div>
      <div className={themed('text-2xl font-mono text-text-primary tabular-nums', dk)}>{value}</div>
    </div>
  );
}
