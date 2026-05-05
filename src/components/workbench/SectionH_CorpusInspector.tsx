/**
 * src/components/workbench/SectionH_CorpusInspector.tsx
 *
 * Section H of the institutional workbench: hybrid retrieval over
 * the regulatory corpus.
 *
 * Three modes:
 *   - Keyword (BM25 only)
 *   - Semantic (dense vector only)
 *   - Hybrid (BM25 + dense + RRF + Voyage rerank-2) — default
 *
 * Posts to /api/workbench/search. Renders ranked results with
 * citation, source, snippet, score, and expandable full text.
 */

'use client';

import { useState } from 'react';

type RetrievalMode = 'keyword' | 'semantic' | 'hybrid';

interface RetrievalResult {
  chunk_id: string;
  document_id: string;
  text: string;
  rerank_score: number | null;
  fusion_score: number;
  bm25_score: number | null;
  dense_score: number | null;
  citation_key: string;
  doc_type: string;
  jurisdiction: string;
  source_domain: string;
  title: string;
  effective_date: string | null;
  canonical_url: string;
  structural_path: string;
  pinpoint: string | null;
}

interface SearchResponse {
  results: RetrievalResult[];
  duration_ms: number;
  mode: string;
}

const MODE_LABELS: Record<RetrievalMode, string> = {
  keyword: 'Keyword (BM25)',
  semantic: 'Semantic (vectors)',
  hybrid: 'Hybrid (BM25 + vectors + rerank)',
};

export function SectionH_CorpusInspector() {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<RetrievalMode>('hybrid');
  const [results, setResults] = useState<RetrievalResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);
    setExpandedId(null);

    try {
      const response = await fetch('/api/workbench/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, mode, topK: 8 }),
      });
      if (!response.ok) {
        const errBody = (await response.json()) as { error?: string };
        throw new Error(errBody.error ?? 'search failed');
      }
      const data = (await response.json()) as SearchResponse;
      setResults(data.results);
      setDuration(data.duration_ms);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      setError(msg);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }

  function formatScore(s: number | null): string {
    if (s === null) return '—';
    return s.toFixed(4);
  }

  return (
    <section className="border border-border bg-white">
      <div className="bg-brand-purple text-white px-4 py-2 text-sm font-semibold">
        H · Corpus Inspector
      </div>

      <div className="p-4 space-y-4">
        <form onSubmit={handleSearch} className="space-y-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. substantiation requirements for business meal expenses"
            className="w-full px-3 py-2 text-sm font-mono border border-border focus:border-brand-purple focus:outline-none"
            disabled={isLoading}
          />
          <div className="flex items-center gap-2">
            {(['keyword', 'semantic', 'hybrid'] as RetrievalMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`px-3 py-1 text-[10px] uppercase tracking-wider border ${
                  mode === m
                    ? 'bg-brand-purple text-white border-brand-purple'
                    : 'bg-white text-text-secondary border-border hover:border-brand-purple'
                }`}
                disabled={isLoading}
              >
                {MODE_LABELS[m]}
              </button>
            ))}
            <div className="flex-1" />
            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="px-4 py-1 text-xs bg-brand-purple text-white font-medium hover:bg-brand-purple/90 disabled:opacity-50"
            >
              {isLoading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </form>

        {error && (
          <div className="text-xs text-red-600 border border-red-200 bg-red-50 px-3 py-2">
            {error}
          </div>
        )}

        {duration !== null && results.length > 0 && (
          <div className="text-[10px] text-text-muted uppercase tracking-wider">
            {results.length} results · {duration}ms · mode: {mode}
          </div>
        )}

        <div className="space-y-2">
          {results.map((r) => {
            const isExpanded = expandedId === r.chunk_id;
            return (
              <div
                key={r.chunk_id}
                className="border border-border bg-bg-row hover:border-brand-purple"
              >
                <div className="px-3 py-2 flex items-center gap-2 text-xs">
                  <span className="px-2 py-0.5 bg-brand-purple text-white text-[9px] uppercase tracking-wider">
                    {r.doc_type}
                  </span>
                  <span className="font-mono text-text-primary">
                    {r.citation_key}
                  </span>
                  <span className="text-text-muted">·</span>
                  <span className="text-[10px] text-text-muted">
                    {r.source_domain}
                  </span>
                  <div className="flex-1" />
                  <span className="text-[10px] font-mono text-text-muted">
                    rerank: {formatScore(r.rerank_score)} · rrf: {formatScore(r.fusion_score)}
                  </span>
                </div>
                <div className="px-3 pb-2">
                  <div className="text-xs text-text-primary font-medium mb-1">
                    {r.title}
                  </div>
                  <div className="text-[10px] text-text-muted font-mono mb-2">
                    {r.structural_path}
                    {r.pinpoint ? ` · ${r.pinpoint}` : ''}
                  </div>
                  <div className="text-xs text-text-secondary leading-relaxed">
                    {isExpanded ? r.text : r.text.slice(0, 300) + (r.text.length > 300 ? '…' : '')}
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedId(isExpanded ? null : r.chunk_id)
                      }
                      className="text-[10px] text-brand-purple hover:underline"
                    >
                      {isExpanded ? 'collapse' : 'expand'}
                    </button>
                    <a
                      href={r.canonical_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-text-muted hover:text-brand-purple"
                    >
                      source ↗
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {!isLoading && results.length === 0 && query && !error && duration !== null && (
          <div className="text-xs text-text-muted text-center py-4">
            No results for &quot;{query}&quot;.
          </div>
        )}
      </div>
    </section>
  );
}
