'use client';
import { themed, type Surface } from '@/lib/ds';
/**
 * src/components/workbench/SectionG_CitationVerification.tsx
 *
 * Citation verification panel: 8-step status badges per citation,
 * force re-verify button, evidence detail. Currently a placeholder —
 * the 8-step adversarial verifier lands in PR-26 through PR-35 per
 * architecture doc § 8.1 Phase 3.
 */


const STEPS = [
  { n: 1, name: 'Existence', tool: 'HEAD/GET to canonical URL' },
  { n: 2, name: 'Currency', tool: 'effective_date <= today, not superseded' },
  { n: 3, name: 'Groundedness', tool: 'NLI ≥0.85 + verifier LLM + embedding floor' },
  { n: 4, name: 'Pinpoint', tool: 'structural_path + text_hash match' },
  { n: 5, name: 'Supersession', tool: 'graph traversal for newer authority' },
  { n: 6, name: 'Jurisdiction', tool: 'jurisdiction graph match' },
  { n: 7, name: 'Source authority', tool: 'regulatory_sources allow-list' },
  { n: 8, name: 'Content hash', tool: 'SHA-256 chunk text vs recorded hash' },
];

export function SectionG_CitationVerification({ surface = 'light' }: { surface?: Surface } = {}) {
  const dk = surface === 'dark';
  return (
    <section className={themed('bg-white rounded border border-border shadow-sm p-5', dk)}>
      <div className="flex items-center justify-between mb-3">
        <h2 className={themed('font-mono text-sm font-bold tracking-wide text-text-primary', dk)}>
          G · CITATION VERIFICATION
        </h2>
        <span className="text-xs font-mono text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
          UNBUILT · PHASE 3
        </span>
      </div>

      <div className="space-y-2 text-xs font-mono">
        <div className={themed('text-text-muted leading-relaxed mb-3', dk)}>
          The 8-step adversarial verification protocol from architecture
          doc § 3. Each citation passes only if all eight steps pass.
          Failure of any step degrades status to{' '}
          <code className="font-mono">defective</code> and blocks
          dependent tasks until human review.
        </div>

        <table className="w-full">
          <thead>
            <tr className={themed('text-text-faint uppercase tracking-wide', dk)}>
              <th className="text-left pb-1 w-8">#</th>
              <th className="text-left pb-1">step</th>
              <th className="text-left pb-1">tool</th>
            </tr>
          </thead>
          <tbody>
            {STEPS.map((s) => (
              <tr key={s.n} className={themed('border-t border-border-light opacity-60', dk)}>
                <td className={themed('py-1 text-text-primary tabular-nums', dk)}>{s.n}</td>
                <td className={themed('py-1 text-text-primary', dk)}>{s.name}</td>
                <td className={themed('py-1 text-text-muted', dk)}>{s.tool}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
