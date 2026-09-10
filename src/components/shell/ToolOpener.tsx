'use client';

/**
 * NAV-25 — THE ONE PAGE OPENER. "STEP N" is gone with the steps layer. A screen
 * opens by naming the TOOL it is: the family as eyebrow, the tool's name as the
 * title, and the tool's own registry line beneath it.
 *
 * A screen that serves several tools (/trading is Brokerage and Trade Log,
 * /operations is Tasks and Time) names each of them, with its own number, status
 * and registry line — so a customer reading the rail's row finds that row's name
 * on the screen it opens.
 *
 * PHASES: the opener PRINTS the phases each tool owns (nav.ts THE SORT) but
 * renders no strip of its own. Every one of these screens already mounts the
 * StageStrip its pipe belongs to, and the ratified Pipe Frame holds ONE phase
 * control, never two.
 *
 * Nothing here is typed: every family name, tool name, number, status, line and
 * phase name is read from the registry or from pipePhases.ts.
 */
import { StatusChip } from '@/components/home/ToolChrome';
import type { NavTool } from '@/lib/nav';

/** "WHAT YOU OWN" → "What you own" — the eyebrow's sentence case, computed. */
function familyWord(family: string): string {
  return family.charAt(0) + family.slice(1).toLowerCase();
}

export default function ToolOpener({ tools, line, actions }: {
  /** The tools this screen serves, in registry order — one, or several on a shared screen. */
  tools: readonly NavTool[];
  /** A truer line than the registry's, in the room's own words — never marketing. */
  line?: string;
  actions?: React.ReactNode;
}) {
  const [first] = tools;
  if (!first) return null;
  return (
    <header className="mb-5" data-tool-opener={tools.map((t) => t.name).join(' + ')}>
      <p className="font-mono text-[10px] sm:text-xs uppercase tracking-[0.2em] text-text-faint">
        {familyWord(first.family)}
      </p>
      {tools.map((tool) => (
        <div key={tool.name} className="mt-1" data-opener-tool={tool.name} id={tool.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] text-text-faint" aria-hidden="true">{tool.n}</span>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-text-primary">{tool.name}</h1>
            <StatusChip status={tool.status} />
          </div>
          <p className="mt-1 max-w-3xl font-mono text-[10px] leading-relaxed text-text-muted">{tool.line}</p>
          {tool.phases.length > 0 && (
            <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-text-faint" data-opener-phases={tool.name}>
              {tool.phases.map((p) => `${p.num} ${p.name}`).join(' · ')}
            </p>
          )}
        </div>
      ))}
      {line && <p className="mt-2 text-xs text-text-muted">{line}</p>}
      {actions && <div className="mt-3 flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
