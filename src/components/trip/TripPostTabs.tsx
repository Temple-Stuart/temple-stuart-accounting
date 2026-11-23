'use client';

/**
 * TripPostTabs (TRIPPOST-02, Alex, 2026-11-23) — the tabs of a written-up stop's page (design-refs/trippost-02, README, Behaviour):
 * one plain link per section drawn, so they work with no script, the one being read lit. A section is being read once its top is
 * within the reading line, 160px under the window's top; until the second one is, the first tab is lit. A pressed tab is lit at once.
 * Under 1024px the tabs are one row that scrolls sideways, and the lit tab comes into view in it — at once under reduced motion.
 *
 * Its one state is the lit tab, in React state alone: nothing is stored, nothing is written to the address, no clock. It imports no
 * leaf: every word reaches it as a prop from src/components/trip/TripPostView.tsx (ruling l). Which tab is lit is a pure function
 * of the sections' tops, litTab, exported and tested (src/lib/__tests__/tripPost02.test.ts). Its classes are the stop page's port
 * in src/app/globals.css.
 */

import { useEffect, useRef, useState } from 'react';

/** How far under the window's top a section's top must come for it to be the one being read, in CSS pixels. */
export const READING_LINE = 160;

/** Which tab is lit: the last section whose top has reached the reading line — the first, until the second has. */
export function litTab(tops: readonly number[], line: number): number {
  let lit = 0;
  tops.forEach((top, i) => {
    if (top <= line) lit = i;
  });
  return lit;
}

/** One tab: where it opens (its section, by id) and its words. */
export interface PostTab {
  href: string;
  label: string;
}

export default function TripPostTabs({ label, tabs }: { label: string; tabs: readonly PostTab[] }) {
  const [lit, setLit] = useState(0);
  const row = useRef<HTMLDivElement>(null);
  const links = useRef<Array<HTMLAnchorElement | null>>([]);

  // the section being read, from the sections' tops — on scroll, on resize, and once on arriving
  useEffect(() => {
    const sections = tabs.map((tab) => document.getElementById(tab.href.slice(1)));
    const missing = tabs.filter((_, i) => sections[i] === null).map((tab) => tab.href);
    if (missing.length > 0) throw new Error(`TripPostTabs: no section on the page for ${missing.join(', ')}`);
    const reading = (): void => setLit(litTab(sections.map((section) => (section as HTMLElement).getBoundingClientRect().top), READING_LINE));
    reading();
    window.addEventListener('scroll', reading, { passive: true });
    window.addEventListener('resize', reading);
    return () => {
      window.removeEventListener('scroll', reading);
      window.removeEventListener('resize', reading);
    };
  }, [tabs]);

  // under 1024px the row scrolls sideways: the lit tab comes into view in it, at once under reduced motion
  useEffect(() => {
    const box = row.current;
    const tab = links.current[lit];
    if (box === null || tab === null || tab === undefined) return;
    const r = box.getBoundingClientRect();
    const t = tab.getBoundingClientRect();
    if (t.left < r.left + 16 || t.right > r.right - 16) {
      box.scrollTo({ left: box.scrollLeft + t.left - r.left - 16, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
  }, [lit]);

  return (
    <nav className="ts-post-tabs" aria-label={label} data-trip-post-section="tabs">
      <div className="ts-post-tabs__row" ref={row}>
        {tabs.map((tab, i) => (
          <a
            key={tab.href}
            href={tab.href}
            className={i === lit ? 'ts-post-tab ts-post-tab--on' : 'ts-post-tab'}
            aria-current={i === lit ? 'true' : undefined}
            ref={(el) => {
              links.current[i] = el;
            }}
            onClick={() => setLit(i)}
          >
            {tab.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
