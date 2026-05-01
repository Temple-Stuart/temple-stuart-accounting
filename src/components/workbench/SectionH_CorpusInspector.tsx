/**
 * src/components/workbench/SectionH_CorpusInspector.tsx
 *
 * Corpus inspector: search box (BM25 keyword now, HNSW similarity once
 * PR-J brings embeddings online), recently retrieved chunks list with
 * parent document context.
 *
 * Wires to /api/workbench/recent-chunks.
 */

'use client';

import { useEffect, useState } from 'react';

interface ChunkRow {
  id: string;
  document_id: string;
  citation_key: string;
  document_title: string;
  jurisdiction: string;
  pinpoint: string | null;
  structural_path: string;
  text_snippet: string;
  ingested_at: string;
}

export function SectionH_CorpusInspector() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<ChunkRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const url = debouncedQuery
          ? `/api/workbench/recent-chunks?q=${encodeURIComponent(debouncedQuery)}&limit=20`
          : '/api/workbench/recent-chunks?limit=20';
        const res = await fetch(url);
        if (res.ok) {
          const body = await res.json();
          setResults(body?.results ?? []);
        } else {
          setResults([]);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [debouncedQuery]);

  return (
    <section className="bg-white rounded border border-border shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-mono text-sm font-bold tracking-wide text-text-primary">
          H · CORPUS INSPECTOR
        </h2>
        <span className="text-xs font-mono text-text-muted">
          BM25 keyword (HNSW after PR-J)
        </span>
      </div>

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="search corpus (e.g., 'trade or business expenses')"
        className="w-full px-3 py-2 text-xs font-mono border border-border rounded mb-3 focus:outline-none focus:border-brand-purple"
      />

      {loading ? (
        <div className="text-xs font-mono text-text-muted">loading…</div>
      ) : results.length > 0 ? (
        <div className="space-y-2 text-xs font-mono max-h-96 overflow-y-auto">
          {results.map((r) => (
            <div
              key={r.id}
              className="border border-border-light rounded p-2 hover:bg-bg-row"
            >
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-text-primary font-bold">
                  {r.citation_key}
                  {r.pinpoint && <span className="text-text-muted"> {r.pinpoint}</span>}
                </span>
                <span className="text-text-faint">{r.jurisdiction}</span>
              </div>
              <div className="text-text-muted truncate">{r.document_title}</div>
              <div className="text-text-secondary mt-1 leading-relaxed">
                {r.text_snippet}
                {r.text_snippet.length >= 400 && '…'}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs font-mono text-text-muted leading-relaxed">
          {debouncedQuery
            ? 'No results for that query.'
            : 'No chunks ingested yet. The eCFR worker runs at 06:00 UTC daily; first run will populate this section. Or invoke the function manually from the Inngest dashboard to backfill now.'}
        </div>
      )}
    </section>
  );
}
