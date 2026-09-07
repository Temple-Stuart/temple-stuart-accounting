'use client';

/**
 * NAV-01a → NAV-02 — THE FAMILY NAVIGATION. THE ANSWERS first (a link to
 * /answers, current when you are on it — NAV-01c), then the deck's six
 * families in PROBLEM_SHEET order.
 *
 * NAV-02: a family tab is a MENU, not a tab panel. It opens on click — never on
 * hover — and lists "All of <FAMILY>" (the family page) and then the family's
 * tools in sheet order: name · status chip · the tool's door. Selecting closes
 * it; so do Escape, a click outside, and focus leaving the bar. Nothing renders
 * inline below the bar: the map of a family is its page (/work, /money-in, …
 * — src/lib/toolRegistry.ts FAMILY_PAGES). The items come from familyMenu()
 * in the registry — ONE source with the build-time law that counts every tool
 * in exactly one menu, exactly once (scripts/assert-tool-registry.ts).
 *
 * Doors: on the cockpit a cockpit-hosted tool opens its section in place
 * through the SAME selectTab funnel the old tabs used (onSelectModule — the
 * URL keeps being written as today); off the cockpit (link mode — /answers,
 * the family pages) it is a plain link to COCKPIT_PATH. An off-cockpit tool
 * is a link to its home. A NOT_BUILT tool is a disabled item that says so —
 * no screen, no mock, no "coming soon" copy.
 *
 * Keyboard (the ARIA menu-button pattern, no mouse needed): on a family tab,
 * Enter / Space open and focus the first item, ArrowDown the first, ArrowUp
 * the last; Left / Right move between the family tabs (an open menu follows).
 * In a menu, Up / Down move (wrapping), Home / End jump, Left / Right open the
 * neighbouring family's menu, Escape closes and returns focus to the tab, Tab
 * closes and moves on.
 *
 * Mobile (< sm, 640px): a family tab is a plain LINK to its family page — a
 * menu on a 375px screen is the page. The row scrolls horizontally; nothing
 * under 10px type.
 */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { COCKPIT_PRIMARY_TOOL, FAMILIES, FAMILY_PAGES, TOOL_REGISTRY, familyMenu, familyOfPath, type MenuItem } from '@/lib/toolRegistry';
import { ANSWERS_HOME } from '@/lib/answers';
import type { FamilyName } from '@/lib/problemSheet';
import { StatusChip } from './ToolChrome';

interface Props {
  /** The cockpit's active section key (ModuleLauncher activeModule). Absent off the cockpit. */
  activeModule?: string;
  /** The cockpit's selectTab funnel — sets the section AND writes the URL. Absent off the cockpit (link mode). */
  onSelectModule?: (key: string) => void;
}

const CHIP = 'shrink-0 whitespace-nowrap border-b-2 px-3 sm:px-4 py-3 font-mono text-[10px] sm:text-xs uppercase tracking-wider transition-colors';
const CHIP_ON = 'border-brand-purple text-brand-purple';
const CHIP_OFF = 'border-transparent text-text-muted hover:text-text-primary';
const ITEM = 'flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-xs outline-none hover:bg-bg-row focus-visible:bg-bg-row focus-visible:ring-1 focus-visible:ring-brand-purple';

function familyOfModule(key: string | undefined): FamilyName | null {
  if (!key) return null;
  const name = COCKPIT_PRIMARY_TOOL[key];
  if (!name) return null;
  return TOOL_REGISTRY.find((t) => t.name === name)?.family ?? null;
}

const menuId = (f: FamilyName) => `family-menu-${f.toLowerCase().replace(/\s+/g, '-')}`;
const adjacent = (f: FamilyName, delta: 1 | -1): FamilyName => FAMILIES[(FAMILIES.indexOf(f) + delta + FAMILIES.length) % FAMILIES.length];

export default function FamilyNav({ activeModule, onSelectModule }: Props) {
  const pathname = usePathname();
  const onAnswers = pathname === ANSWERS_HOME;
  // The current family: the cockpit section's own, or the family page you are on.
  const current = familyOfModule(activeModule) ?? familyOfPath(pathname);
  const [open, setOpen] = useState<FamilyName | null>(null);
  const [pendingFocus, setPendingFocus] = useState<'first' | 'last' | null>(null);
  const rootRef = useRef<HTMLElement>(null);
  const buttons = useRef(new Map<FamilyName, HTMLButtonElement>());

  const menuItems = () => Array.from(rootRef.current?.querySelectorAll<HTMLElement>('[role="menu"] [role="menuitem"]') ?? []);

  // A click (or touch) outside the bar closes the open menu.
  useEffect(() => {
    if (open === null) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  // A keyboard open lands focus on the first (or last) item once the menu is in the DOM.
  useEffect(() => {
    if (open === null || pendingFocus === null) return;
    const items = menuItems();
    (pendingFocus === 'first' ? items[0] : items[items.length - 1])?.focus();
    setPendingFocus(null);
  }, [open, pendingFocus]);

  const openWithFocus = (f: FamilyName, where: 'first' | 'last') => { setOpen(f); setPendingFocus(where); };
  const closeToButton = (f: FamilyName) => { setOpen(null); buttons.current.get(f)?.focus(); };

  // Focus leaving the bar closes the menu. Deferred one tick: a keyboard move
  // between menus unmounts the focused item before the next one takes focus.
  const onRootBlur = (e: React.FocusEvent<HTMLElement>) => {
    const root = e.currentTarget;
    if (root.contains(e.relatedTarget as Node | null)) return;
    window.setTimeout(() => { if (!root.contains(document.activeElement)) setOpen(null); }, 0);
  };

  const onButtonKey = (f: FamilyName, e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); openWithFocus(f, 'first'); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); openWithFocus(f, 'last'); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const next = adjacent(f, e.key === 'ArrowRight' ? 1 : -1);
      const wasOpen = open === f;
      buttons.current.get(next)?.focus();
      if (wasOpen) setOpen(next);
    }
    else if (e.key === 'Escape' && open === f) { e.preventDefault(); setOpen(null); }
  };

  const onMenuKey = (f: FamilyName, e: React.KeyboardEvent<HTMLUListElement>) => {
    const items = menuItems();
    const i = items.indexOf(document.activeElement as HTMLElement);
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); items[(i + 1) % items.length]?.focus(); break;
      case 'ArrowUp': e.preventDefault(); items[(i - 1 + items.length) % items.length]?.focus(); break;
      case 'Home': e.preventDefault(); items[0]?.focus(); break;
      case 'End': e.preventDefault(); items[items.length - 1]?.focus(); break;
      case 'ArrowRight': e.preventDefault(); openWithFocus(adjacent(f, 1), 'first'); break;
      case 'ArrowLeft': e.preventDefault(); openWithFocus(adjacent(f, -1), 'first'); break;
      case 'Escape': e.preventDefault(); closeToButton(f); break;
      case 'Tab':
        // Close and hand focus back to the tab; a forward Tab then moves on from there.
        if (e.shiftKey) e.preventDefault();
        closeToButton(f);
        break;
      default: break;
    }
  };

  return (
    <nav ref={rootRef} aria-label="Tool families" onBlur={onRootBlur} className="border-b border-border bg-white">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        {/* THE ANSWERS first, then the six families — one row; horizontal scroll on a phone, room for the menus from sm. */}
        <div className="flex overflow-x-auto sm:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Link
            href={ANSWERS_HOME}
            aria-current={onAnswers ? 'page' : undefined}
            data-answers
            className={`${CHIP} ${onAnswers ? CHIP_ON : CHIP_OFF}`}
          >
            THE ANSWERS
          </Link>
          <ul className="flex" data-families>
            {FAMILIES.map((f, index) => {
              const isCurrent = current === f;
              const isOpen = open === f;
              return (
                <li key={f} className="relative">
                  {/* < sm: the family tab IS the family page. */}
                  <Link
                    href={FAMILY_PAGES[f]}
                    aria-current={isCurrent ? 'page' : undefined}
                    data-family-link={f}
                    className={`block sm:hidden ${CHIP} ${isCurrent ? CHIP_ON : CHIP_OFF}`}
                  >
                    {f}
                  </Link>
                  {/* ≥ sm: the family tab opens its menu. */}
                  <button
                    type="button"
                    ref={(el) => { if (el) buttons.current.set(f, el); else buttons.current.delete(f); }}
                    aria-haspopup="menu"
                    aria-expanded={isOpen}
                    aria-controls={isOpen ? menuId(f) : undefined}
                    aria-current={isCurrent ? 'true' : undefined}
                    data-family={f}
                    onClick={(e) => {
                      const next = isOpen ? null : f;
                      setOpen(next);
                      // A keyboard "click" (Enter / Space — detail 0) lands on the first item; a pointer click leaves focus on the tab.
                      if (next && e.detail === 0) setPendingFocus('first');
                    }}
                    onKeyDown={(e) => onButtonKey(f, e)}
                    onFocus={() => { if (open !== null && open !== f) setOpen(null); }}
                    className={`hidden sm:block ${CHIP} ${isCurrent || isOpen ? CHIP_ON : CHIP_OFF}`}
                  >
                    {f}
                    <span aria-hidden="true" className="ml-1 text-text-faint">▾</span>
                  </button>
                  {isOpen && (
                    <ul
                      role="menu"
                      id={menuId(f)}
                      aria-label={f}
                      onKeyDown={(e) => onMenuKey(f, e)}
                      className={`absolute top-full z-40 mt-px hidden w-[22rem] max-w-[calc(100vw-2rem)] rounded-b-lg border border-border bg-white p-1 shadow-lg sm:block ${index >= FAMILIES.length / 2 ? 'right-0' : 'left-0'}`}
                    >
                      {familyMenu(f).map((item) => (
                        <li key={item.kind === 'family' ? item.href : item.tool.slug} role="none">
                          <MenuRow item={item} activeModule={activeModule} onSelectModule={onSelectModule} close={() => setOpen(null)} />
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </nav>
  );
}

function MenuRow({ item, activeModule, onSelectModule, close }: { item: MenuItem; activeModule?: string; onSelectModule?: (key: string) => void; close: () => void }) {
  if (item.kind === 'family') {
    return (
      <Link role="menuitem" tabIndex={-1} href={item.href} onClick={close} data-menu-family className={`${ITEM} font-mono text-[10px] uppercase tracking-wider text-brand-purple`}>
        {item.label}
        <span className="ml-auto normal-case tracking-normal text-text-faint">the family page</span>
      </Link>
    );
  }
  const { tool, door } = item;
  const isOpenBelow = door.kind === 'cockpit' && onSelectModule !== undefined && door.key === activeModule;
  const doorText = door.kind === 'none' ? 'no door' : isOpenBelow ? 'Open below' : `Open · ${door.href}`;
  const inner = (
    <>
      <span className="w-5 shrink-0 text-right font-mono text-[10px] text-text-faint">{String(tool.order).padStart(2, '0')}</span>
      <span className={`font-semibold ${tool.status === 'NOT_BUILT' ? 'text-text-muted' : 'text-text-primary'}`}>{tool.name}</span>
      <StatusChip status={tool.status} />
      <span className="ml-auto shrink-0 pl-3 font-mono text-[10px] text-text-muted">{doorText}</span>
    </>
  );
  const data = { 'data-tool': tool.slug, 'data-status': tool.status };
  if (door.kind === 'none') {
    return <span role="menuitem" aria-disabled="true" tabIndex={-1} {...data} className={`${ITEM} cursor-default`}>{inner}</span>;
  }
  if (door.kind === 'cockpit' && onSelectModule) {
    return (
      <button type="button" role="menuitem" tabIndex={-1} aria-current={isOpenBelow ? 'page' : undefined} {...data} onClick={() => { onSelectModule(door.key); close(); }} className={ITEM}>
        {inner}
      </button>
    );
  }
  return (
    <Link role="menuitem" tabIndex={-1} href={door.href} {...data} onClick={close} className={ITEM}>
      {inner}
    </Link>
  );
}
