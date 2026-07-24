'use client';
import { themed, type Surface } from '@/lib/ds';
/**
 * src/components/workbench/SectionD_DiscoveryLauncher.tsx
 *
 * Discovery run launcher: model selection, cost cap, snapshot lock,
 * launch button. Currently a placeholder — the multi-model ensemble
 * (proposer/critic/judge) lands in PR-16 through PR-25 per architecture
 * doc § 8.1 Phase 2.
 */


export function SectionD_DiscoveryLauncher({ surface = 'light' }: { surface?: Surface } = {}) {
  const dk = surface === 'dark';
  return (
    <section className={themed('bg-white rounded border border-border shadow-sm p-5', dk)}>
      <div className="flex items-center justify-between mb-3">
        <h2 className={themed('font-mono text-sm font-bold tracking-wide text-text-primary', dk)}>
          D · DISCOVERY RUN LAUNCHER
        </h2>
        <span className="text-xs font-mono text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
          UNBUILT
        </span>
      </div>

      <div className="space-y-3 text-xs font-mono">
        <div className="grid grid-cols-3 gap-3 opacity-50">
          <div>
            <div className={themed('text-text-faint uppercase tracking-wide mb-1', dk)}>
              proposer models
            </div>
            <div className={themed('text-text-muted', dk)}>Claude · GPT · Gemini</div>
          </div>
          <div>
            <div className={themed('text-text-faint uppercase tracking-wide mb-1', dk)}>
              cost cap
            </div>
            <div className={themed('text-text-muted', dk)}>$5.00 default</div>
          </div>
          <div>
            <div className={themed('text-text-faint uppercase tracking-wide mb-1', dk)}>
              corpus snapshot
            </div>
            <div className={themed('text-text-muted', dk)}>locked</div>
          </div>
        </div>

        <button
          disabled
          className={themed('px-4 py-2 bg-gray-100 text-text-muted font-mono text-xs rounded border border-border cursor-not-allowed', dk)}
        >
          launch discovery (disabled)
        </button>

        <div className={themed('text-text-muted leading-relaxed pt-2 border-t border-border-light', dk)}>
          The multi-model proposer/critic/judge ensemble lands in
          architecture doc § 8.1 Phase 2 (PRs 16-25). Until then, this
          section is a placeholder. Once Phase 2 ships, clicking
          &quot;launch discovery&quot; will fire an Inngest event,
          stream proposer/critic/judge outputs into Section E in real
          time, and write a typed roadmap into Section F.
        </div>
      </div>
    </section>
  );
}
