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
 * THE ANSWERS is reserved (NAV-01c) and is not rendered.
 *
 * Mobile: the family row scrolls horizontally; tool rows stack; nothing under
 * 10px type.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FAMILIES, COCKPIT_PRIMARY_TOOL, TOOL_REGISTRY, toolsOf, type Beats, type ToolEntry, type ToolStatus } from '@/lib/toolRegistry';
import type { FamilyName } from '@/lib/problemSheet';

interface Props {
  /** The cockpit's active section key (ModuleLauncher activeModule). */
  activeModule: string;
  /** The cockpit's selectTab funnel — sets the section AND writes the URL. */
  onSelectModule: (key: string) => void;
}

const STATUS_LABEL: Record<ToolStatus, string> = { LIVE: 'LIVE', PARTIAL: 'PARTIAL', NOT_BUILT: 'NOT BUILT' };
const STATUS_CLASS: Record<ToolStatus, string> = {
  LIVE: 'border-brand-gold text-brand-gold',
  PARTIAL: 'border-brand-amber text-brand-amber',
  NOT_BUILT: 'border-border text-text-faint',
};
const BEATS: ReadonlyArray<[keyof Beats, string]> = [['discover', 'discover'], ['decide', 'decide'], ['commit', 'commit'], ['record', 'record']];

function familyOfModule(key: string): FamilyName | null {
  const name = COCKPIT_PRIMARY_TOOL[key];
  if (!name) return null;
  return TOOL_REGISTRY.find((t) => t.name === name)?.family ?? null;
}

export default function FamilyNav({ activeModule, onSelectModule }: Props) {
  const [family, setFamily] = useState<FamilyName>(() => familyOfModule(activeModule) ?? FAMILIES[0]);

  // A deep link or the path restore lands on a cockpit section → open its family.
  useEffect(() => {
    const f = familyOfModule(activeModule);
    if (f) setFamily(f);
  }, [activeModule]);

  const tools = toolsOf(family);

  return (
    <nav aria-label="Tool families" className="border-b border-border bg-white">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        {/* The six families — one row, horizontal scroll on a phone. */}
        <div role="tablist" className="flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {FAMILIES.map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={family === f}
              onClick={() => setFamily(f)}
              className={`shrink-0 border-b-2 px-3 sm:px-4 py-3 font-mono text-[10px] sm:text-xs uppercase tracking-wider transition-colors ${
                family === f ? 'border-brand-purple text-brand-purple' : 'border-transparent text-text-muted hover:text-text-primary'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* The family's tools, sheet order. */}
        <ul role="tabpanel" className="divide-y divide-border">
          {tools.map((t) => (
            <ToolRow key={t.slug} tool={t} activeModule={activeModule} onSelectModule={onSelectModule} />
          ))}
        </ul>
      </div>
    </nav>
  );
}

function ToolRow({ tool, activeModule, onSelectModule }: { tool: ToolEntry; activeModule: string; onSelectModule: (key: string) => void }) {
  const isOpen = tool.cockpitKey !== undefined && tool.cockpitKey === activeModule;
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
          {tool.cockpitKey ? (
            <button
              type="button"
              onClick={() => onSelectModule(tool.cockpitKey as string)}
              aria-current={isOpen ? 'page' : undefined}
              className={`rounded border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                isOpen ? 'border-brand-purple bg-brand-purple text-white' : 'border-brand-purple text-brand-purple hover:bg-brand-purple-wash'
              }`}
            >
              {isOpen ? 'Open below' : `Open · ${tool.home}`}
            </button>
          ) : (
            <Link
              href={tool.home}
              className="rounded border border-brand-purple px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-brand-purple transition-colors hover:bg-brand-purple-wash"
            >
              Open · {tool.home}
            </Link>
          )}
          {(tool.links ?? []).map((l) =>
            l.href ? (
              <Link key={l.label} href={l.href} className="font-mono text-[10px] text-text-muted underline-offset-2 hover:text-text-primary hover:underline">
                {l.label}
              </Link>
            ) : (
              <button
                key={l.label}
                type="button"
                onClick={() => onSelectModule(l.cockpitKey as string)}
                className="font-mono text-[10px] text-text-muted underline-offset-2 hover:text-text-primary hover:underline"
              >
                {l.label}
              </button>
            ),
          )}
        </div>
      )}
    </li>
  );
}
