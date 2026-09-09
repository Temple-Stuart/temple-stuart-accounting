'use client';

/**
 * SHELL-01 — THE RAIL. The app's navigation is the sheet walked in FLOW ORDER:
 * six families (src/lib/steps.ts FLOW_ORDER), twelve numbered steps, and inside
 * the open step the rooms it holds. It replaces the six family menus, which
 * listed 25 tools in the deck's teaching order — an order neither a customer nor
 * the founder navigates by.
 *
 * Everything shown is DERIVED: the steps and their jobs from steps.ts, each
 * step's status from its jobs (stepStatus), each sub-link from the registry's
 * own doors (stepLinks → doorOf / doorOfLink), so every page that had a door
 * under the family navigation has one here. Nothing is retyped.
 *
 * Open / collapsed is REACT STATE ONLY — no localStorage, no sessionStorage, no
 * cookie (SHELL-01 forbids browser storage). ACCOUNTS-01: that state is held by
 * the provider the ROOT LAYOUT mounts (src/components/shell/RailState.tsx), which
 * client navigation never unmounts — so a collapsed rail stays collapsed as you
 * walk from one step's room to another.
 *
 * Doors: on the cockpit a cockpit-hosted room opens in place through the SAME
 * selectTab funnel the family menu used (onSelectModule — the URL is written as
 * today); off the cockpit it is a plain link to COCKPIT_PATH. A step with no
 * room opens /step/<slug>, which states its jobs and says it is not built.
 *
 * The lock chip is the client twin the cockpit uses (isTabLocked,
 * src/lib/categoryLock.ts) over the viewer's own entitlement keys, handed down
 * from the mount's /api/auth/me read — never a second read, never a guess: with
 * no keys yet, no chip is drawn.
 *
 * Keyboard: every row is a link or a button, so Tab reaches them all in order;
 * Up / Down move between step rows (wrapping), Home / End jump, and on a phone
 * Escape closes the drawer and returns focus to its button.
 */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ANSWERS_HOME } from '@/lib/answers';
import { isTabLocked } from '@/lib/categoryLock';
import { TOOL_GATE } from '@/lib/offer';
import { FLOW_ORDER, STEPS, stepBySlug, stepGates, stepHref, stepLinks, stepOfTool, stepStatus, stepsOf, type Step } from '@/lib/steps';
import { COCKPIT_PRIMARY_TOOL, type ToolDoor } from '@/lib/toolRegistry';
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

/** The step the viewer is in: the cockpit's own section first, then /step/<slug>, then the step whose screen or room covers the path (the longest match wins). */
export function activeStepOf(pathname: string | null, activeModule?: string): Step | null {
  if (activeModule) {
    const name = COCKPIT_PRIMARY_TOOL[activeModule];
    if (name) return stepOfTool(name);
  }
  if (!pathname) return null;
  const bySlug = pathname.startsWith('/step/') ? stepBySlug(pathname.slice('/step/'.length)) : undefined;
  if (bySlug) return bySlug;
  let best: { step: Step; depth: number } | null = null;
  for (const step of STEPS) {
    const hrefs = [...(step.screen ? [step.screen] : []), ...stepLinks(step).map((l) => (l.door.kind === 'none' ? '' : l.door.href))];
    for (const href of hrefs) {
      if (!href || !covers(href, pathname)) continue;
      const depth = href.split('?')[0].split('/').filter(Boolean).length;
      if (!best || depth > best.depth) best = { step, depth };
    }
  }
  return best?.step ?? null;
}

/** Locked when the step is gated and EVERY one of its gates is shut for this viewer — a step with one key in hand is not called locked. */
function stepLocked(step: Step, entitledKeys: readonly string[] | undefined, isAdmin: boolean): boolean {
  if (entitledKeys === undefined) return false;
  const gates = stepGates(step, TOOL_GATE);
  return gates.length > 0 && gates.every((g) => isTabLocked(g, [...entitledKeys], isAdmin));
}

export default function Rail({ activeModule, onSelectModule, entitledKeys, isAdmin = false }: Props) {
  const pathname = usePathname();
  // Above the pages, so navigating between steps does not reopen a collapsed rail.
  const { open, setOpen } = useRailState();
  // The drawer is per-page and ephemeral: it closes when you pick a step.
  const [drawer, setDrawer] = useState(false);
  const drawerButton = useRef<HTMLButtonElement>(null);
  const active = activeStepOf(pathname, activeModule);
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
    const rows = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[data-step-row]'));
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
      {FLOW_ORDER.map((family) => (
        <div key={family} className="mb-2">
          {!collapsed && (
            <p className="px-2 pb-1 font-mono text-[10px] uppercase tracking-wider text-text-faint" data-rail-family={family}>{family}</p>
          )}
          <ul>
            {stepsOf(family).map((step) => {
              const isActive = active?.slug === step.slug;
              const locked = stepLocked(step, entitledKeys, isAdmin);
              return (
                <li key={step.slug}>
                  <Link
                    href={stepHref(step)}
                    data-step-row
                    data-step={step.slug}
                    data-step-status={stepStatus(step)}
                    data-step-locked={locked ? 'true' : undefined}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={onNavigate}
                    title={collapsed ? `${step.number}. ${step.name}` : undefined}
                    className={`${ROW} text-xs ${isActive ? 'bg-bg-row text-brand-purple' : 'text-text-primary'}`}
                  >
                    <span className={NUM} aria-hidden="true">{step.number}</span>
                    {!collapsed && (
                      <>
                        <span className="font-semibold">{step.name}</span>
                        <span className="ml-auto flex shrink-0 items-center gap-1">
                          {locked && (
                            <span className="rounded border border-border px-1 py-0.5 font-mono text-[10px] uppercase tracking-wider text-text-muted" data-lock-chip>Locked</span>
                          )}
                          <StatusChip status={stepStatus(step)} />
                        </span>
                      </>
                    )}
                    {collapsed && <span className="sr-only">{step.name}</span>}
                  </Link>
                  {/* The open step shows the rooms it holds — the registry's own doors. */}
                  {!collapsed && isActive && stepLinks(step).length > 0 && (
                    <ul className="mb-1 ml-7 border-l border-border pl-2" data-step-links={step.slug}>
                      {stepLinks(step).map((link) => (
                        <li key={link.label}>
                          <RoomRow label={link.label} door={link.door} activeModule={activeModule} onSelectModule={onSelectModule} onNavigate={onNavigate} />
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
        aria-label="The steps"
        data-rail
        data-rail-open={open ? 'true' : 'false'}
        className={`hidden shrink-0 border-r border-border bg-white sm:block ${open ? 'w-56' : 'w-14'}`}
      >
        <div className="sticky top-0 max-h-screen overflow-y-auto p-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="rail-steps"
            data-rail-toggle
            className={`${ROW} mb-2 font-mono text-[10px] uppercase tracking-wider text-text-muted`}
          >
            <span className={NUM} aria-hidden="true">{open ? '«' : '»'}</span>
            {open && <span>Collapse</span>}
          </button>
          <div id="rail-steps">{list(!open)}</div>
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
            <span aria-hidden="true">☰</span> Steps
          </button>
          {active && <span className="truncate font-mono text-[10px] uppercase tracking-wider text-text-primary">{active.number}. {active.name}</span>}
        </div>
        {drawer && (
          <div className="fixed inset-0 z-50 flex">
            <div
              role="presentation"
              onClick={() => setDrawer(false)}
              className="absolute inset-0 bg-black/40"
            />
            <nav id="rail-drawer" aria-label="The steps" data-rail-drawer className="relative h-full w-72 max-w-[85vw] overflow-y-auto border-r border-border bg-white p-2">
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

/** A room inside the open step: a cockpit section opens in place on the cockpit (the selectTab funnel), everything else is a link. */
function RoomRow({ label, door, activeModule, onSelectModule, onNavigate }: {
  label: string;
  door: ToolDoor;
  activeModule?: string;
  onSelectModule?: (key: string) => void;
  onNavigate?: () => void;
}) {
  if (door.kind === 'none') return null;
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
