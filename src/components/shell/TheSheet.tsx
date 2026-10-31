'use client';

/**
 * SHELL-01 → NAV-25 — THE SHEET on HOME. Below the four answers: the whole map,
 * six family columns in TOOL_REGISTRY's order, every one of the twenty-five jobs
 * with its TRUE status and its own door. A job that is not built says so and
 * expands to the census line that proves it — never a placeholder card, never a
 * "coming soon", and now never a link either.
 *
 * NAV-25: the step layer between the family and the job is gone, here as in the
 * rail. The sheet and the rail render the SAME model (src/lib/nav.ts) — that is
 * what "the rail is the sheet" means, and why they can no longer disagree.
 *
 * Everything is derived: the families and their tools from nav.ts, the statuses,
 * `why` notes and citations from the registry. Nothing is typed here. The family READS
 * (FAMILY_READS — Income, Net worth: pages that read across a family and belong
 * to no single job) keep their door at the foot of their column, which is where
 * the retired family pages carried them.
 */
import Link from 'next/link';
import { navFamilies } from '@/lib/nav';
import { TOOL_GATE } from '@/lib/offer';
import { FAMILY_READS, TOOL_REGISTRY, type ToolEntry } from '@/lib/toolRegistry';
import { StatusChip } from '@/components/home/ToolChrome';

/**
 * The line a job expands to: the registry's `why` — what is not finished for a
 * customer. BOOKS-PIPE-01: it used to fall back to `citation`, the census's
 * file:line evidence, and printed source paths on HOME. A job with no `why`
 * says plainly that the registry holds no note, which is true and is not a path.
 */
function proofLine(tool: ToolEntry): string {
  return tool.why?.trim() ? tool.why : 'No note in the registry for this job.';
}

export default function TheSheet() {
  const families = navFamilies(TOOL_GATE);
  return (
    <section aria-label="The sheet" data-sheet className="mt-8 sm:mt-10">
      <header className="mb-3">
        <p className="font-mono text-[10px] sm:text-xs uppercase tracking-[0.2em] text-text-faint">The sheet</p>
        <h2 className="mt-1 text-lg sm:text-xl font-semibold tracking-tight text-text-primary">
          Every job, where it sits, and how true it is.
        </h2>
        <p className="mt-1 text-xs text-text-muted">
          {TOOL_REGISTRY.length} jobs across {families.length} families, in the order the rail walks them. Open one to read why it stands where it does.
        </p>
      </header>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {families.map((family) => (
          <section key={family.name} data-sheet-family={family.name} className="rounded-lg border border-border bg-white p-3">
            <h3 className="font-mono text-[10px] uppercase tracking-wider text-brand-purple">{family.name}</h3>
            <ul className="mt-2 space-y-1">
              {family.tools.map((row) => {
                const tool = TOOL_REGISTRY.find((t) => t.name === row.name) as ToolEntry;
                return (
                  <li key={row.name} className="flex items-start gap-2">
                    <span className="w-5 shrink-0 pt-0.5 text-right font-mono text-[10px] text-text-faint" aria-hidden="true">{row.n}</span>
                    <div className="min-w-0 flex-1">
                      <details data-sheet-tool={tool.slug} data-status={row.status} className="group">
                        <summary className="flex cursor-pointer list-none items-center gap-2 rounded px-1 py-0.5 outline-none hover:bg-bg-row focus-visible:bg-bg-row focus-visible:ring-1 focus-visible:ring-brand-purple">
                          {/* A built job carries its own door; a not-built one carries none — nothing to open, so nothing that looks openable. */}
                          {row.href ? (
                            <Link href={row.href} data-sheet-door={row.name} className="text-[11px] font-semibold text-text-primary underline-offset-2 hover:underline">{row.name}</Link>
                          ) : (
                            <span className="text-[11px] text-text-muted">{row.name}</span>
                          )}
                          <span className="ml-auto shrink-0"><StatusChip status={row.status} /></span>
                        </summary>
                        <p className="px-1 pb-1 pt-0.5 font-mono text-[10px] leading-relaxed text-text-muted">{proofLine(tool)}</p>
                      </details>
                    </div>
                  </li>
                );
              })}
            </ul>
            {(FAMILY_READS[family.name] ?? []).length > 0 && (
              <ul className="mt-3 border-t border-border pt-2" data-sheet-reads={family.name}>
                {/* A family read is an href by the registry's own law (registryLaw: FAMILY_READS entries are routes). */}
                {(FAMILY_READS[family.name] ?? []).map((read) => (
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
