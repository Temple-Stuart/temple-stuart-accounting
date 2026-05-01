/**
 * src/components/workbench/SectionE_LiveStream.tsx
 *
 * Live discovery stream: per-query retrieval blocks, three proposer
 * columns with token streaming, critic block, judge block, verification
 * block. The "everything surfaced" heart of the workbench.
 *
 * Currently a placeholder — depends on:
 *   - PR-16-25 (multi-model ensemble)
 *   - PR-24 (discovery_run_events + SSE relay)
 *   - PR-26-35 (8-step verification)
 *
 * Once Phase 2 lands, this component will subscribe to
 * /api/runs/{run_id}/stream via EventSource (mirroring
 * src/app/api/trading/convergence/route.ts pattern) and render every
 * token as it streams.
 */

'use client';

const PHASE_2_BLOCKS = [
  {
    id: 'profile-signature',
    name: 'Profile signature',
    note: 'SHA-256 of profile JSON sent to the run',
  },
  {
    id: 'retrieval',
    name: 'Retrieval blocks (per query)',
    note: 'BM25 query + dense vector + RRF + reranker output, top-30 per query',
  },
  {
    id: 'proposers',
    name: 'Proposer A/B/C blocks',
    note: 'Claude · GPT · Gemini parallel columns, token-by-token streaming',
  },
  {
    id: 'critic',
    name: 'Critic block',
    note: 'Adversarial defect list streaming',
  },
  {
    id: 'judge',
    name: 'Judge block',
    note: 'Canonical roadmap with provenance trace',
  },
  {
    id: 'verification',
    name: 'Verification table (8 steps × N citations)',
    note: 'Existence · Currency · Groundedness · Pinpoint · Supersession · Jurisdiction · Source · Hash',
  },
];

export function SectionE_LiveStream() {
  return (
    <section className="bg-white rounded border border-border shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-mono text-sm font-bold tracking-wide text-text-primary">
          E · LIVE DISCOVERY STREAM
        </h2>
        <span className="text-xs font-mono text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
          UNBUILT · PHASE 2/3
        </span>
      </div>

      <div className="space-y-2 text-xs font-mono">
        <div className="text-text-muted leading-relaxed mb-3">
          Architecture doc § 6.2 E. Six blocks render in document-flow order
          while a discovery run is in progress. Each block remains visible
          after the run completes — nothing is hidden.
        </div>

        {PHASE_2_BLOCKS.map((b) => (
          <div
            key={b.id}
            className="border border-border-light rounded p-3 opacity-60"
          >
            <div className="text-text-primary font-bold">{b.name}</div>
            <div className="text-text-muted mt-0.5">{b.note}</div>
          </div>
        ))}

        <div className="text-text-muted leading-relaxed pt-3 border-t border-border-light">
          SSE relay implementation will mirror{' '}
          <code className="font-mono">
            src/app/api/trading/convergence/route.ts
          </code>{' '}
          (existing institutional pattern in the repo).
        </div>
      </div>
    </section>
  );
}
