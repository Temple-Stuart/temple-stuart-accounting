'use client';

/**
 * NAV-01a — THE FAMILY NAVIGATION. Replaces the nine product-history tabs in
 * the cockpit with the deck's six families (PROBLEM_SHEET order); selecting a
 * family lists its tools in sheet order. Every row states the tool's TRUE
 * state from the registry (src/lib/toolRegistry.ts): name · status chip · the
 * beats it has · a way in when a home exists. A cockpit-hosted tool opens its
 * existing section in place (the same selectTab funnel the old tabs used, so
 * the URL keeps being written as today); an off-cockpit tool is a plain link.
 * A NOT_BUILT row is exactly that — no screen, no mock, no "coming soon" copy.
 *
 * NAV-01c — THE ANSWERS is the first entry of the row: a link to /answers, the
 * app's front page (src/lib/answers.ts ANSWERS_HOME), current when you are on
 * it. Off the cockpit (no selectTab funnel — /answers), the nav runs in LINK
 * MODE: a cockpit-hosted tool is a plain link to the URL the cockpit writes
 * for its section (COCKPIT_PATH, one source with the reachability law), and
 * the tool list opens only when a family is picked.
 *
 * Mobile: the family row scrolls horizontally; tool rows stack; nothing under
 * 10px type.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { COCKPIT_PATH, FAMILIES, FAMILY_READS, COCKPIT_PRIMARY_TOOL, TOOL_REGISTRY, toolsOf, type Beats, type ToolEntry, type ToolStatus } from '@/lib/toolRegistry';
import { ANSWERS_HOME } from '@/lib/answers';
import type { FamilyName } from '@/lib/problemSheet';

interface Props {
  /** The cockpit's active section key (ModuleLauncher activeModule). Absent off the cockpit. */
  activeModule?: string;
  /** The cockpit's selectTab funnel — sets the section AND writes the URL. Absent off the cockpit (link mode). */
  onSelectModule?: (key: string) => void;
}

const STATUS_LABEL: Record<ToolStatus, string> = { LIVE: 'LIVE', PARTIAL: 'PARTIAL', NOT_BUILT: 'NOT BUILT' };
const STATUS_CLASS: Record<ToolStatus, string> = {
  LIVE: 'border-brand-gold text-brand-gold',
  PARTIAL: 'border-brand-amber text-brand-amber',
  NOT_BUILT: 'border-border text-text-faint',
};
const BEATS: ReadonlyArray<[keyof Beats, string]> = [['discover', 'discover'], ['decide', 'decide'], ['commit', 'commit'], ['record', 'record']];
const CHIP = 'shrink-0 border-b-2 px-3 sm:px-4 py-3 font-mono text-[10px] sm:text-xs uppercase tracking-wider transition-colors';
const CHIP_ON = 'border-brand-purple text-brand-purple';
const CHIP_OFF = 'border-transparent text-text-muted hover:text-text-primary';

function familyOfModule(key: string | undefined): FamilyName | null {
  if (!key) return null;
  const name = COCKPIT_PRIMARY_TOOL[key];
  if (!name) return null;
  return TOOL_REGISTRY.find((t) => t.name === name)?.family ?? null;
}

export default function FamilyNav({ activeModule, onSelectModule }: Props) {
  const pathname = usePathname();
  const onAnswers = pathname === ANSWERS_HOME;
  // Cockpit mode opens a family at once (the section's own); link mode opens none until picked.
  const [family, setFamily] = useState<FamilyName | null>(() => familyOfModule(activeModule) ?? (onSelectModule ? FAMILIES[0] : null));

  // A deep link or the path restore lands on a cockpit section → open its family.
  useEffect(() => {
    const f = familyOfModule(activeModule);
    if (f) setFamily(f);
  }, [activeModule]);

  const tools = family ? toolsOf(family) : [];
  const reads = family ? (FAMILY_READS[family] ?? []) : [];

  return (
    <nav aria-label="Tool families" className="border-b border-border bg-white">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        {/* THE ANSWERS first, then the six families — one row, horizontal scroll on a phone. */}
        <div className="flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Link
            href={ANSWERS_HOME}
            aria-current={onAnswers ? 'page' : undefined}
            data-answers
            className={`${CHIP} ${onAnswers ? CHIP_ON : CHIP_OFF}`}
          >
            THE ANSWERS
          </Link>
          <div role="tablist" className="flex">
            {FAMILIES.map((f) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={family === f}
                onClick={() => setFamily(f)}
                className={`${CHIP} ${family === f ? CHIP_ON : CHIP_OFF}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* The family's tools, sheet order. */}
        {family !== null && (
          <ul role="tabpanel" className="divide-y divide-border">
            {tools.map((t) => (
              <ToolRow key={t.slug} tool={t} activeModule={activeModule} onSelectModule={onSelectModule} />
            ))}
          </ul>
        )}
        {/* NAV-01b: family-level reads — pages that read across the family's tools. */}
        {reads.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border py-2 font-mono text-[10px] uppercase tracking-wider">
            <span className="text-text-faint">Reads</span>
            {reads.map((r) => (
              <Link key={r.label} href={r.href as string} className="text-text-muted underline-offset-2 hover:text-text-primary hover:underline normal-case tracking-normal">
                {r.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}

function ToolRow({ tool, activeModule, onSelectModule }: { tool: ToolEntry; activeModule?: string; onSelectModule?: (key: string) => void }) {
  const isOpen = onSelectModule !== undefined && tool.cockpitKey !== undefined && tool.cockpitKey === activeModule;
  const openClass = 'rounded border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors';
  const linkClass = 'font-mono text-[10px] text-text-muted underline-offset-2 hover:text-text-primary hover:underline';
  return (
    <li className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:gap-4" data-tool={tool.slug} data-status={tool.status}>
      <div className="flex items-center gap-3 sm:w-64">
        <span className="font-mono text-[10px] text-text-faint w-5 text-right">{String(tool.order).padStart(2, '0')}</span>
        <span className={`text-sm font-semibold ${tool.status === 'NOT_BUILT' ? 'text-text-muted' : 'text-text-primary'}`}>{tool.name}</span>
        <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${STATUS_CLASS[tool.status]}`}>
          {STATUS_LABEL[tool.status]}
        </span>
      </div>

      {/* The beats it has — a filled dot is a cited beat, a hollow one is "—". */}
      <ul className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-wider" aria-label={`${tool.name} beats`}>
        {BEATS.map(([key, label]) => (
          <li key={key} className={`flex items-center gap-1 ${tool.beats[key] ? 'text-text-primary' : 'text-text-faint'}`}>
            <span aria-hidden="true" className={`inline-block h-2 w-2 rounded-full border ${tool.beats[key] ? 'border-brand-purple bg-brand-purple' : 'border-border bg-transparent'}`} />
            {label}
          </li>
        ))}
      </ul>

      {/* A way in — only when a home exists. NOT_BUILT renders nothing here. */}
      {tool.home !== null && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:ml-auto">
          {tool.cockpitKey && onSelectModule ? (
            <button
              type="button"
              onClick={() => onSelectModule(tool.cockpitKey as string)}
              aria-current={isOpen ? 'page' : undefined}
              className={`${openClass} ${isOpen ? 'border-brand-purple bg-brand-purple text-white' : 'border-brand-purple text-brand-purple hover:bg-brand-purple-wash'}`}
            >
              {isOpen ? 'Open below' : `Open · ${tool.home}`}
            </button>
          ) : (
            <Link
              href={tool.cockpitKey ? COCKPIT_PATH[tool.cockpitKey] : tool.home}
              className={`${openClass} border-brand-purple text-brand-purple hover:bg-brand-purple-wash`}
            >
              Open · {tool.cockpitKey ? COCKPIT_PATH[tool.cockpitKey] : tool.home}
            </Link>
          )}
          {(tool.links ?? []).map((l) =>
            l.href ? (
              <Link key={l.label} href={l.href} className={linkClass}>
                {l.label}
              </Link>
            ) : onSelectModule ? (
              <button key={l.label} type="button" onClick={() => onSelectModule(l.cockpitKey as string)} className={linkClass}>
                {l.label}
              </button>
            ) : (
              <Link key={l.label} href={COCKPIT_PATH[l.cockpitKey as string]} className={linkClass}>
                {l.label}
              </Link>
            ),
          )}
        </div>
      )}
    </li>
  );
}
