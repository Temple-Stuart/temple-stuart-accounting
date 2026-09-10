'use client';

/**
 * NAV-25 — THE RAIL IS THE SHEET. SHELL-01 walked twelve invented "steps", so
 * nineteen of the twenty-five tools appeared nowhere and the app did not mirror
 * the home page. The steps layer is gone. The rail is the sheet: six family
 * headings in TOOL_REGISTRY's order, and under each, ITS tools in
 * TOOL_REGISTRY's order — twenty-five rows, every one of them a tool.
 *
 * Everything shown is DERIVED (src/lib/nav.ts): the families, the tools, each
 * tool's number (its position in the registry), status, gate and door. A tool
 * that is not built is a row with its status chip and NO LINK — never a
 * placeholder page. Nothing is retyped, reordered or renamed.
 *
 * The open tool shows the pages IT owns (the registry's own links) as sub-rows:
 * that is how /chart-of-accounts, /dashboard/tax-filing, /soc2, /budgets/trips,
 * /shopping and /hub/itinerary keep their doors — inside the tool they belong
 * to, never as a top-level row, and never pointing at another tool's screen
 * (navLaw rule 7).
 *
 * Open / collapsed is REACT STATE ONLY — no localStorage, no sessionStorage, no
 * cookie. ACCOUNTS-01: that state is held by the provider the ROOT LAYOUT mounts
 * (src/components/shell/RailState.tsx), which client navigation never unmounts —
 * so a collapsed rail stays collapsed as you walk from one tool to another.
 *
 * Doors: on the cockpit a cockpit-hosted tool opens in place through the SAME
 * selectTab funnel (onSelectModule — the URL is written as today); off the
 * cockpit it is a plain link to COCKPIT_PATH.
 *
 * The lock chip is the client twin the cockpit uses (isTabLocked,
 * src/lib/categoryLock.ts) over the viewer's own entitlement keys, handed down
 * from the mount's /api/auth/me read — never a second read, never a guess: with
 * no keys yet, no chip is drawn.
 *
 * Keyboard: every row is a link or a button, so Tab reaches them all in order;
 * Up / Down move between tool rows (wrapping), Home / End jump, and on a phone
 * Escape closes the drawer and returns focus to its button.
 */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ANSWERS_HOME } from '@/lib/answers';
import { isTabLocked } from '@/lib/categoryLock';
import { TOOL_GATE } from '@/lib/offer';
import { navFamilies, type NavTool, type OpenDoor } from '@/lib/nav';
import { COCKPIT_PRIMARY_TOOL } from '@/lib/toolRegistry';
import { StatusChip } from '@/components/home/ToolChrome';
import { useRailState } from '@/components/shell/RailState';

interface Props {
  /** The cockpit's active section key (ModuleLauncher activeModule). Absent off the cockpit. */
  activeModule?: string;
  /** The cockpit's selectTab funnel — sets the section AND writes the URL. Absent off the cockpit (link mode). */
  onSelectModule?: (key: string) => void;
  /** The viewer's active entitlement keys (/api/auth/me entitledCategories), from the mount's own read. Undefined until it lands — no chip is drawn on a guess. */
  entitledKeys?: readonly string[];
  /** The server's admin verdict (/api/auth/me isAdmin) — the same bypass the cockpit's gate honours. */
  isAdmin?: boolean;
}

const ROW = 'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left outline-none hover:bg-bg-row focus-visible:bg-bg-row focus-visible:ring-1 focus-visible:ring-brand-purple';
const NUM = 'w-5 shrink-0 text-right font-mono text-[10px] text-text-faint';

/** Segment-wise: the door equals the path, or is a proper prefix of it (a child is reached through its parent). */
function covers(href: string, pathname: string): boolean {
  const d = href.split('?')[0].split('/').filter(Boolean);
  const r = pathname.split('/').filter(Boolean);
  if (d.length === 0) return r.length === 0;
  if (d.length > r.length) return false;
  return d.every((seg, i) => seg === r[i]);
}

/**
 * The tool the viewer is in: the cockpit's own section first (its primary tool),
 * then the tool whose screen or owned page covers the path — the longest match
 * wins, so /budgets/trips/42 resolves to Travel and not to whatever else is
 * shallower. Several tools share /trading and /operations; the FIRST in registry
 * order is the one the rail marks, and both rows stay visible either way.
 */
export function activeToolOf(pathname: string | null, activeModule?: string): NavTool | null {
  const rows = navFamilies(TOOL_GATE).flatMap((f) => f.tools);
  if (activeModule) {
    const name = COCKPIT_PRIMARY_TOOL[activeModule];
    const byCockpit = name ? rows.find((t) => t.name === name) : undefined;
    if (byCockpit) return byCockpit;
  }
  if (!pathname) return null;
  let best: { tool: NavTool; depth: number } | null = null;
  for (const tool of rows) {
    const hrefs = [...(tool.href ? [tool.href] : []), ...tool.subRows.map((r) => r.door.href)];
    for (const href of hrefs) {
      if (!covers(href, pathname)) continue;
      const depth = href.split('?')[0].split('/').filter(Boolean).length;
      if (!best || depth > best.depth) best = { tool, depth };
    }
  }
  return best?.tool ?? null;
}

/** Locked when the tool is gated and that gate is shut for this viewer. With no keys read yet, no chip is drawn — never a guess. */
function toolLocked(tool: NavTool, entitledKeys: readonly string[] | undefined, isAdmin: boolean): boolean {
  if (entitledKeys === undefined) return false;
  if (!tool.gate || !tool.gate.startsWith('tab:')) return false;
  return isTabLocked(tool.gate, [...entitledKeys], isAdmin);
}

export default function Rail({ activeModule, onSelectModule, entitledKeys, isAdmin = false }: Props) {
  const pathname = usePathname();
  // Above the pages, so navigating between steps does not reopen a collapsed rail.
  const { open, setOpen } = useRailState();
  // The drawer is per-page and ephemeral: it closes when you pick a step.
  const [drawer, setDrawer] = useState(false);
  const drawerButton = useRef<HTMLButtonElement>(null);
  const active = activeToolOf(pathname, activeModule);
  const families = navFamilies(TOOL_GATE);
  const onHome = pathname === ANSWERS_HOME;

  // The drawer is a phone overlay: Escape closes it and hands focus back to its button.
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setDrawer(false);
      drawerButton.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawer]);

  // Up / Down / Home / End move between the step rows of whichever list has focus.
  const onListKey = (e: React.KeyboardEvent<HTMLElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    const rows = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[data-tool-row]'));
    if (rows.length === 0) return;
    const i = rows.indexOf(document.activeElement as HTMLElement);
    e.preventDefault();
    const next =
      e.key === 'Home' ? rows[0]
        : e.key === 'End' ? rows[rows.length - 1]
          : e.key === 'ArrowDown' ? rows[(i + 1) % rows.length]
            : rows[(i - 1 + rows.length) % rows.length];
    next?.focus();
  };

  const list = (collapsed: boolean, onNavigate?: () => void) => (
    <div onKeyDown={onListKey}>
      <Link
        href={ANSWERS_HOME}
        aria-current={onHome ? 'page' : undefined}
        data-rail-home
        onClick={onNavigate}
        className={`${ROW} mb-2 font-mono text-[10px] uppercase tracking-wider ${onHome ? 'text-brand-purple' : 'text-text-muted'}`}
        title="Home — the answers and the whole sheet"
      >
        <span className={NUM} aria-hidden="true">⌂</span>
        {!collapsed && <span className="font-semibold">Home</span>}
      </Link>
      {families.map((family) => (
        <div key={family.name} className="mb-2">
          {!collapsed && (
            <p className="px-2 pb-1 font-mono text-[10px] uppercase tracking-wider text-text-faint" data-rail-family={family.name}>{family.name}</p>
          )}
          <ul>
            {family.tools.map((tool) => {
              const isActive = active?.name === tool.name;
              const locked = toolLocked(tool, entitledKeys, isAdmin);
              const chips = !collapsed && (
                <span className="ml-auto flex shrink-0 items-center gap-1">
                  {locked && (
                    <span className="rounded border border-border px-1 py-0.5 font-mono text-[10px] uppercase tracking-wider text-text-muted" data-lock-chip>Locked</span>
                  )}
                  <StatusChip status={tool.status} />
                </span>
              );
              return (
                <li key={tool.name}>
                  {tool.href ? (
                    <ToolRow tool={tool} isActive={isActive} locked={locked} collapsed={collapsed} chips={chips}
                      onSelectModule={onSelectModule} onNavigate={onNavigate} />
                  ) : (
                    /* Not built: a row with its status chip and NO LINK. There is
                       no screen behind it and none is pretended — no placeholder
                       page, no redirect that goes somewhere emptier. */
                    <div
                      data-tool-row
                      data-tool={tool.name}
                      data-tool-status={tool.status}
                      data-tool-unbuilt="true"
                      tabIndex={-1}
                      title={collapsed ? `${tool.n}. ${tool.name}` : undefined}
                      className={`${ROW} cursor-default text-xs text-text-faint hover:bg-transparent`}
                    >
                      <span className={NUM} aria-hidden="true">{tool.n}</span>
                      {!collapsed ? <><span>{tool.name}</span>{chips}</> : <span className="sr-only">{tool.name}</span>}
                    </div>
                  )}
                  {/* The open tool shows the pages IT owns — the registry's own doors. */}
                  {!collapsed && isActive && tool.subRows.length > 0 && (
                    <ul className="mb-1 ml-7 border-l border-border pl-2" data-tool-subrows={tool.name}>
                      {tool.subRows.map((sub) => (
                        <li key={sub.label}>
                          <RoomRow label={sub.label} door={sub.door} activeModule={activeModule} onSelectModule={onSelectModule} onNavigate={onNavigate} />
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );

  return (
    <>
      {/* ≥ sm: the rail is a column beside the page. */}
      <nav
        aria-label="The sheet"
        data-rail
        data-rail-open={open ? 'true' : 'false'}
        className={`hidden shrink-0 border-r border-border bg-white sm:block ${open ? 'w-56' : 'w-14'}`}
      >
        <div className="sticky top-0 max-h-screen overflow-y-auto p-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="rail-sheet"
            data-rail-toggle
            className={`${ROW} mb-2 font-mono text-[10px] uppercase tracking-wider text-text-muted`}
          >
            <span className={NUM} aria-hidden="true">{open ? '«' : '»'}</span>
            {open && <span>Collapse</span>}
          </button>
          <div id="rail-sheet">{list(!open)}</div>
        </div>
      </nav>

      {/* < sm: a drawer — the bar carries its button, the panel carries the same list. */}
      <div className="sm:hidden">
        <div className="flex items-center gap-2 border-b border-border bg-white px-4 py-2">
          <button
            type="button"
            ref={drawerButton}
            onClick={() => setDrawer(true)}
            aria-expanded={drawer}
            aria-controls="rail-drawer"
            data-rail-drawer-toggle
            className="flex items-center gap-2 rounded px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-text-muted outline-none focus-visible:ring-1 focus-visible:ring-brand-purple"
          >
            <span aria-hidden="true">☰</span> Tools
          </button>
          {active && <span className="truncate font-mono text-[10px] uppercase tracking-wider text-text-primary">{active.n}. {active.name}</span>}
        </div>
        {drawer && (
          <div className="fixed inset-0 z-50 flex">
            <div
              role="presentation"
              onClick={() => setDrawer(false)}
              className="absolute inset-0 bg-black/40"
            />
            <nav id="rail-drawer" aria-label="The sheet" data-rail-drawer className="relative h-full w-72 max-w-[85vw] overflow-y-auto border-r border-border bg-white p-2">
              <button
                type="button"
                onClick={() => { setDrawer(false); drawerButton.current?.focus(); }}
                className={`${ROW} mb-2 font-mono text-[10px] uppercase tracking-wider text-text-muted`}
              >
                <span className={NUM} aria-hidden="true">✕</span> Close
              </button>
              {list(false, () => setDrawer(false))}
            </nav>
          </div>
        )}
      </div>
    </>
  );
}

/** A page the open tool owns: a cockpit section opens in place on the cockpit (the selectTab funnel), everything else is a link. */
function RoomRow({ label, door, activeModule, onSelectModule, onNavigate }: {
  label: string;
  door: OpenDoor;
  activeModule?: string;
  onSelectModule?: (key: string) => void;
  onNavigate?: () => void;
}) {
  const openBelow = door.kind === 'cockpit' && onSelectModule !== undefined && door.key === activeModule;
  const inner = <span className="truncate">{label}</span>;
  const cls = `${ROW} text-[11px] ${openBelow ? 'text-brand-purple' : 'text-text-muted'}`;
  if (door.kind === 'cockpit' && onSelectModule) {
    return (
      <button type="button" data-room={door.href} aria-current={openBelow ? 'page' : undefined} onClick={() => { onSelectModule(door.key); onNavigate?.(); }} className={cls}>
        {inner}
      </button>
    );
  }
  return (
    <Link href={door.href} data-room={door.href} onClick={onNavigate} className={cls}>
      {inner}
    </Link>
  );
}


/**
 * A built tool's row. On the cockpit a cockpit-hosted tool switches the section
 * in place through the SAME selectTab funnel the old rail used, so the URL is
 * written exactly as today; everywhere else it is a plain link to its screen.
 */
function ToolRow({ tool, isActive, locked, collapsed, chips, onSelectModule, onNavigate }: {
  tool: NavTool;
  isActive: boolean;
  locked: boolean;
  collapsed: boolean;
  chips: React.ReactNode;
  onSelectModule?: (key: string) => void;
  onNavigate?: () => void;
}) {
  const door = tool.door!;
  const marks = {
    'data-tool-row': true,
    'data-tool': tool.name,
    'data-tool-status': tool.status,
    'data-tool-locked': locked ? 'true' : undefined,
    'aria-current': isActive ? ('page' as const) : undefined,
    title: collapsed ? `${tool.n}. ${tool.name}` : undefined,
    className: `${ROW} text-xs ${isActive ? 'bg-bg-row text-brand-purple' : 'text-text-primary'}`,
  };
  const inner = (
    <>
      <span className={NUM} aria-hidden="true">{tool.n}</span>
      {!collapsed ? <><span className="font-semibold">{tool.name}</span>{chips}</> : <span className="sr-only">{tool.name}</span>}
    </>
  );
  if (door.kind === 'cockpit' && onSelectModule) {
    return <button type="button" onClick={() => { onSelectModule(door.key); onNavigate?.(); }} {...marks}>{inner}</button>;
  }
  return <Link href={door.href} onClick={onNavigate} {...marks}>{inner}</Link>;
}
