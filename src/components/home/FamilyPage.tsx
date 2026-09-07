'use client';

/**
 * NAV-02 — a FAMILY PAGE: the map of one family's tools (/work, /money-in,
 * /money-out, /what-you-own, /what-you-owe, /the-proof — src/lib/toolRegistry.ts
 * FAMILY_PAGES). A grid, one card per tool from familyCards() in sheet order —
 * ONE source with the build-time law that counts every tool on exactly one
 * page, exactly once. Each card: name · status chip · the four beats as dots ·
 * the doors (the registry home, then the related surfaces — plain links; there
 * is no cockpit funnel here) · the census citation as a small line. A
 * NOT_BUILT card says exactly that: no door, no mock, no "coming soon" copy.
 * Below the grid: the family's reads (FAMILY_READS), pages that read across
 * its tools and belong to no single one.
 *
 * The shell is ShellFrame (ShellBar + the family navigation in link mode; this
 * family's tab is current). Mobile: cards stack; nothing under 10px type.
 */
import Link from 'next/link';
import ShellFrame from '@/components/ui/ShellFrame';
import { FAMILY_READS, familyCards, statusCounts, toolsOf, type FamilyCard } from '@/lib/toolRegistry';
import type { FamilyName } from '@/lib/problemSheet';
import { BeatDots, StatusChip } from './ToolChrome';

const DOOR = 'rounded border border-brand-purple px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-brand-purple transition-colors hover:bg-brand-purple-wash';
const LINK = 'font-mono text-[10px] text-text-muted underline-offset-2 hover:text-text-primary hover:underline';

export default function FamilyPage({ family, viewer }: { family: FamilyName; viewer: string }) {
  const cards = familyCards(family);
  const counts = statusCounts(toolsOf(family));
  const reads = FAMILY_READS[family] ?? [];
  return (
    <ShellFrame viewer={viewer}>
      <header className="mb-5 sm:mb-6">
        <p className="font-mono text-[10px] sm:text-xs uppercase tracking-[0.2em] text-text-faint">The family</p>
        <h1 className="mt-1 text-xl sm:text-2xl font-semibold tracking-tight text-text-primary">{family}</h1>
        <p className="mt-1 text-xs text-text-muted" data-family-counts>
          {cards.length} tools in sheet order · {counts.LIVE} live · {counts.PARTIAL} partial · {counts.NOT_BUILT} not built. Every card states the tool&apos;s true state from the registry.
        </p>
      </header>

      <ul aria-label={`${family} tools`} className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3" data-family-page={family}>
        {cards.map((c) => <ToolCard key={c.tool.slug} card={c} />)}
      </ul>

      {/* NAV-01b: family-level reads — pages that read across the family's tools. */}
      {reads.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-3 font-mono text-[10px] uppercase tracking-wider sm:mt-6" data-family-reads>
          <span className="text-text-faint">Reads across {family}</span>
          {reads.map((r) => (
            <Link key={r.label} href={r.href as string} className="normal-case tracking-normal text-text-muted underline-offset-2 hover:text-text-primary hover:underline">
              {r.label}
            </Link>
          ))}
        </div>
      )}
    </ShellFrame>
  );
}

function ToolCard({ card }: { card: FamilyCard }) {
  const { tool, home, links } = card;
  const notBuilt = tool.status === 'NOT_BUILT';
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border bg-white p-4" data-tool={tool.slug} data-status={tool.status}>
      <div className="flex items-start gap-3">
        <span className="w-5 shrink-0 pt-0.5 text-right font-mono text-[10px] text-text-faint">{String(tool.order).padStart(2, '0')}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className={`text-sm font-semibold ${notBuilt ? 'text-text-muted' : 'text-text-primary'}`}>{tool.name}</h2>
            <StatusChip status={tool.status} />
          </div>
          {tool.note && <p className="mt-1 text-xs text-text-muted">{tool.note}</p>}
        </div>
      </div>

      <BeatDots name={tool.name} beats={tool.beats} />

      {/* The doors — the registry home first, then the related surfaces. A NOT_BUILT card has none and says so. */}
      {home !== null ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5" data-doors>
          <Link href={home} className={DOOR}>Open · {home}</Link>
          {links.map((l) => (
            l.door.kind === 'none' ? null : (
              <Link key={l.label} href={l.door.href} className={LINK}>{l.label}</Link>
            )
          ))}
        </div>
      ) : (
        <p className="font-mono text-[10px] uppercase tracking-wider text-text-faint" data-not-built>Not built — no door</p>
      )}

      <p className="break-words font-mono text-[10px] leading-relaxed text-text-faint" data-citation>{tool.citation}</p>
    </li>
  );
}
