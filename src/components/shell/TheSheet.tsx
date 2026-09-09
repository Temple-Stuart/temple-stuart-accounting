'use client';

/**
 * SHELL-01 — THE SHEET on HOME. Below the four answers: the whole map, six
 * family columns in FLOW ORDER (src/lib/steps.ts), every one of the twenty-five
 * jobs in its step, each with its TRUE status and the door to the step that
 * holds it. A job that is not built says so and expands to the census line that
 * proves it — never a placeholder card, never a "coming soon".
 *
 * Everything is derived: the families and steps from steps.ts, the jobs, their
 * statuses, their `why` notes and their citations from the registry
 * (src/lib/toolRegistry.ts). Nothing is typed here. The family READS
 * (FAMILY_READS — Income, Net worth: pages that read across a family and belong
 * to no single job) keep their door at the foot of their column, which is where
 * the retired family pages carried them.
 */
import Link from 'next/link';
import { FLOW_ORDER, stepHref, stepsOf, toolsOfStep, stepStatus } from '@/lib/steps';
import { FAMILY_READS, TOOL_REGISTRY, type ToolEntry } from '@/lib/toolRegistry';
import { StatusChip } from '@/components/home/ToolChrome';

/** The line a job expands to: why it is not finished when the registry says why, else the census citation that placed it. */
function proofLine(tool: ToolEntry): string {
  return tool.why?.trim() ? tool.why : tool.citation;
}

export default function TheSheet() {
  return (
    <section aria-label="The sheet" data-sheet className="mt-8 sm:mt-10">
      <header className="mb-3">
        <p className="font-mono text-[10px] sm:text-xs uppercase tracking-[0.2em] text-text-faint">The sheet</p>
        <h2 className="mt-1 text-lg sm:text-xl font-semibold tracking-tight text-text-primary">
          Every job, where it sits, and how true it is.
        </h2>
        <p className="mt-1 text-xs text-text-muted">
          {TOOL_REGISTRY.length} jobs across {FLOW_ORDER.length} families, in the order the rail walks them. Open one to read why it stands where it does.
        </p>
      </header>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FLOW_ORDER.map((family) => (
          <section key={family} data-sheet-family={family} className="rounded-lg border border-border bg-white p-3">
            <h3 className="font-mono text-[10px] uppercase tracking-wider text-brand-purple">{family}</h3>
            {stepsOf(family).map((step) => {
              const tools = toolsOfStep(step);
              return (
                <div key={step.slug} className="mt-3">
                  <Link
                    href={stepHref(step)}
                    data-sheet-step={step.slug}
                    className="flex items-center gap-2 rounded px-1 py-1 outline-none hover:bg-bg-row focus-visible:bg-bg-row focus-visible:ring-1 focus-visible:ring-brand-purple"
                  >
                    <span className="w-5 shrink-0 text-right font-mono text-[10px] text-text-faint" aria-hidden="true">{step.number}</span>
                    <span className="text-xs font-semibold text-text-primary">{step.name}</span>
                    <span className="ml-auto shrink-0"><StatusChip status={stepStatus(step, tools)} /></span>
                  </Link>
                  <ul className="ml-7 mt-1 space-y-1">
                    {tools.map((tool) => (
                      <li key={tool.slug}>
                        <details data-sheet-tool={tool.slug} data-status={tool.status} className="group">
                          <summary className="flex cursor-pointer list-none items-center gap-2 rounded px-1 py-0.5 outline-none hover:bg-bg-row focus-visible:bg-bg-row focus-visible:ring-1 focus-visible:ring-brand-purple">
                            <span className={`text-[11px] ${tool.status === 'NOT_BUILT' ? 'text-text-muted' : 'text-text-primary'}`}>{tool.name}</span>
                            <span className="ml-auto shrink-0"><StatusChip status={tool.status} /></span>
                          </summary>
                          <p className="px-1 pb-1 pt-0.5 font-mono text-[10px] leading-relaxed text-text-muted">{proofLine(tool)}</p>
                        </details>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
            {(FAMILY_READS[family] ?? []).length > 0 && (
              <ul className="mt-3 border-t border-border pt-2" data-sheet-reads={family}>
                {/* A family read is an href by the registry's own law (registryLaw: FAMILY_READS entries are routes). */}
                {(FAMILY_READS[family] ?? []).map((read) => (
                  <li key={read.label}>
                    <Link href={read.href as string} data-sheet-read={read.href} className="block rounded px-1 py-0.5 font-mono text-[10px] uppercase tracking-wider text-text-muted outline-none hover:bg-bg-row focus-visible:bg-bg-row focus-visible:ring-1 focus-visible:ring-brand-purple">
                      {read.label}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </section>
  );
}
