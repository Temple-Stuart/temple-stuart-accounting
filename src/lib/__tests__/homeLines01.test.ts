/**
 * HOME-LINES-01 (Alex, 2026-11-08 15:36 · 15:40 · 16:18) — Temple Stuart's two lines go live.
 *
 *   T1 the words — src/lib/brandLines.ts: the four exports, exact; SITE_DESCRIPTION is derived;
 *   T2 the hero — Landing.tsx imports COMPANY_LINE and HERO_SUBLINE and types none of their words;
 *      the h1 renders the three lines (the third in the wash) and the subline renders HERO_SUBLINE;
 *   T3 the events heading — ExperiencesView, rendered: an h2 holding EXPERIENCE_LINE (the third in
 *      the wash), then the PROMISE paragraph, then SUBHEAD;
 *   T4 the page description — layout.tsx reads SITE_DESCRIPTION three times and types none;
 *   T5 the link preview — opengraph-image.tsx renders COMPANY_LINE, the third in #eae7f2, no "Modules";
 *   T6 the retired line — no code under src/ carries it, and its two dead files are gone.
 *
 * Every text check reads code() — the comments that quote the retired line are history and stay.
 * No line number and no file length is pinned here. No live call, no database, no clock.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { code } from '../sourceText';
import { COMPANY_LINE, EXPERIENCE_LINE, HERO_SUBLINE, SITE_DESCRIPTION } from '../brandLines';
import { EXPERIENCES } from '../experiences';
import { ExperiencesView, DEFAULT_INTO, PROMISE, SUBHEAD } from '@/components/landing/ExperiencesSection';

Object.assign(globalThis, { React });

const WORDS = 'src/lib/brandLines.ts';
const LANDING = 'src/components/landing/Landing.tsx';
const LAYOUT = 'src/app/layout.tsx';
const PREVIEW = 'src/app/opengraph-image.tsx';
const THIS_FILE = 'src/lib/__tests__/homeLines01.test.ts';
const DELETED = ['src/components/sections/HeroSection.tsx', 'src/app/api/og/home/route.tsx'];
const ROOT = resolve(__dirname, '../../..');

const asHtml = (s: string) => s.replace(/'/g, '&#x27;');
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ── T1 · THE WORDS ───────────────────────────────────────────────────────────

test('T1 the four exports are the exact words, and SITE_DESCRIPTION is the company line and the subline, derived', () => {
  assert.deepEqual([...COMPANY_LINE], ['Connect your world.', 'Control your future.', 'Create your freedom.']);
  assert.deepEqual([...EXPERIENCE_LINE], ['Plan your escape.', 'Build your income.', 'Explore the world.']);
  assert.equal(HERO_SUBLINE, 'One system for your money, your days and your books — so every number can be traced back to what actually happened.');
  assert.equal(SITE_DESCRIPTION, 'Connect your world. Control your future. Create your freedom. One system for your money, your days and your books — so every number can be traced back to what actually happened.');
  assert.match(code(WORDS), /export const SITE_DESCRIPTION = `\$\{COMPANY_LINE\.join\(' '\)\} \$\{HERO_SUBLINE\}`;/, 'derived, never retyped');
  assert.doesNotMatch(code(WORDS), /\bimport\b|\brequire\(/, 'pure, no imports — the preview image runs on the edge');
});

// ── T2 · THE HERO ────────────────────────────────────────────────────────────

test('T2 the hero renders COMPANY_LINE and HERO_SUBLINE from src/lib/brandLines.ts and types none of their words', () => {
  const landing = code(LANDING);
  assert.match(landing, /import PlansSection from '@\/components\/offer\/PlansSection'; import \{ COMPANY_LINE, HERO_SUBLINE \} from '@\/lib\/brandLines';/, 'the import rides an existing line — every line above :1807 stays');
  assert.match(
    landing,
    /<h1 className="text-4xl sm:text-6xl font-bold leading-tight tracking-tight mb-6 text-ts-white">\s*\{COMPANY_LINE\[0\]\}<br \/>\s*\{COMPANY_LINE\[1\]\}<br \/>\s*\{\s*\}\s*<span className="text-brand-purple-wash">\{COMPANY_LINE\[2\]\}<\/span>\s*<\/h1>/,
    'the h1 keeps its class; the first two lines each break, the third wears the wash',
  );
  assert.match(landing, /<p className="mb-6 max-w-xl text-base text-white\/70">\s*\{HERO_SUBLINE\}\s*<\/p>/, 'the subline is HERO_SUBLINE');
  for (const words of [...COMPANY_LINE, HERO_SUBLINE, 'One system for your money']) {
    assert.ok(!landing.includes(words), `Landing.tsx's code types "${words}" — it reads src/lib/brandLines.ts`);
  }
});

// ── T3 · THE EVENTS HEADING ──────────────────────────────────────────────────

test('T3 the events section renders EXPERIENCE_LINE as its h2 (the third in the wash), then the PROMISE, then SUBHEAD', () => {
  const html = renderToStaticMarkup(React.createElement(ExperiencesView, { rows: EXPERIENCES, today: '2026-11-08', choice: { category: DEFAULT_INTO }, onPick: () => {} }));
  assert.equal(PROMISE, 'Book the experience, not just the destination.');
  const h2 = /<h2 class="([^"]*)">([\s\S]*?)<\/h2>/.exec(html);
  assert.ok(h2, 'the section renders an h2');
  assert.equal(h2[1], 'mt-3 text-3xl sm:text-5xl font-bold leading-tight tracking-tight text-ts-white');
  assert.equal(h2[2], `${EXPERIENCE_LINE[0]}<br/>${EXPERIENCE_LINE[1]}<br/><span class="text-brand-purple-wash">${EXPERIENCE_LINE[2]}</span>`);
  const after = html.slice(h2.index + h2[0].length);
  assert.ok(after.startsWith(`<p class="mt-4 text-lg sm:text-xl font-semibold text-ts-white">${asHtml(PROMISE)}</p>`), 'the promise right under the h2');
  const promiseEnd = after.indexOf('</p>') + '</p>'.length;
  assert.match(after.slice(promiseEnd), new RegExp(`^<p class="[^"]*">${esc(asHtml(SUBHEAD))}</p>`), 'then SUBHEAD, as today');
  assert.match(html, /<section id="events" aria-label="Book the experience"/, 'the aria-label is unchanged');
  assert.equal((html.match(/<h2/g) ?? []).length, 1, 'one heading');
});

// ── T4 · THE PAGE DESCRIPTION ────────────────────────────────────────────────

test('T4 layout.tsx reads SITE_DESCRIPTION for all three descriptions and types none', () => {
  const layout = code(LAYOUT);
  assert.match(layout, /import \{ SITE_DESCRIPTION \} from "@\/lib\/brandLines";/);
  assert.equal((layout.match(/description: SITE_DESCRIPTION,/g) ?? []).length, 3, 'the page, Open Graph and Twitter');
  assert.equal((layout.match(/description:/g) ?? []).length, 3, 'no fourth description');
  assert.doesNotMatch(layout, /description:\s*["'`]/, 'no description typed');
  assert.doesNotMatch(layout, /Nine modules/i);
  assert.match(layout, /title: "Temple Stuart \| Founder's Back Office"/, 'the title is unchanged — Alex\'s call, not made');
});

// ── T5 · THE LINK PREVIEW ────────────────────────────────────────────────────

test('T5 opengraph-image.tsx renders COMPANY_LINE — the third in the hero\'s wash — and no Modules stat', () => {
  const preview = code(PREVIEW);
  assert.match(preview, /import \{ COMPANY_LINE \} from '@\/lib\/brandLines';/);
  for (const k of [0, 1, 2]) assert.ok(preview.includes(`{COMPANY_LINE[${k}]}`), `line ${k + 1} renders COMPANY_LINE[${k}]`);
  assert.match(preview, /<span style=\{\{ color: '#eae7f2', fontSize: '52px', fontWeight: '300' \}\}>\s*\{COMPANY_LINE\[2\]\}/, 'the third wears #eae7f2');
  assert.ok(preview.includes('#eae7f2'));
  assert.ok(!preview.includes('Modules'), 'the "9 / Modules" stat left');
  assert.ok(preview.includes('>Plaid<') && preview.includes('>Bank Sync<'), 'Plaid / Bank Sync stays');
  for (const words of COMPANY_LINE) assert.ok(!preview.includes(words), `"${words}" is not typed`);
});

// ── T6 · THE RETIRED LINE ────────────────────────────────────────────────────

test('T6 no code under src/ carries the retired line, and its two dead files are gone', () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const abs = join(dir, name);
      if (statSync(abs).isDirectory()) walk(abs);
      else if (/\.tsx?$/.test(name)) files.push(relative(ROOT, abs));
    }
  };
  walk(resolve(ROOT, 'src'));
  assert.ok(files.includes(LANDING) && files.includes(WORDS), 'the walk reaches the files it judges');
  const carriers = files
    .filter((f) => f !== THIS_FILE)
    .filter((f) => { const body = code(f); return body.includes('Track your money') || body.includes('Live smarter'); });
  assert.deepEqual(carriers, [], 'the retired line left every file that renders or serves it');
  for (const f of DELETED) assert.equal(existsSync(resolve(ROOT, f)), false, `${f} is deleted`);
  assert.equal(existsSync(resolve(ROOT, 'src/app/api/og/route.tsx')), true, 'the trip RSVP preview stays');
});
