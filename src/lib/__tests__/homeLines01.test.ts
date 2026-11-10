/**
 * HOME-LINES-01 (Alex, 2026-11-08 15:36 · 15:40 · 16:18) — Temple Stuart's two lines go live.
 *
 *   T1 the words — src/lib/brandLines.ts: the four exports, exact; SITE_DESCRIPTION is derived;
 *   T2 the hero — Landing.tsx imports COMPANY_LINE and HERO_SUBLINE and types none of their words;
 *      the h1 renders the three lines (the third in the wash) and the subline renders HERO_SUBLINE;
 *   T3 the experience line's home — HOME-BRIEF-03 (Alex, 2026-11-10): the ONE travel-and-experiences header in
 *      Landing.tsx — an h2 holding EXPERIENCE_LINE on one line, then the PROMISE, then the travel sentence; the band
 *      (ExperiencesView, rendered) repeats no headline: its eyebrow, then SUBHEAD. (Until then the band rendered the
 *      line as its own h2, the third in the wash, then the PROMISE paragraph, then SUBHEAD.)
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
import { ExperiencesView, DEFAULT_INTO, EYEBROW, PROMISE, SUBHEAD } from '@/components/landing/ExperiencesSection';

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
  assert.deepEqual([...COMPANY_LINE], ['Connect your world.', 'Create your freedom.', 'Control your future.']); // HOME-BRIEF-02 (Alex, 2026-11-10): lines two and three switched — ['Connect your world.', 'Control your future.', 'Create your freedom.'] until then
  assert.deepEqual([...EXPERIENCE_LINE], ['Plan your escape.', 'Build your income.', 'Explore the world.']);
  // HOME-BRIEF-02 (Alex, 2026-11-10): the hero's new sentence — 'One system for your money, your days and your books — so every number can be traced back to what actually happened.' until then.
  assert.equal(HERO_SUBLINE, "Whether you're managing your personal finances, running a business, managing investments, or planning a trip for business or pleasure — Temple Stuart brings your plans, budgets, and financial records together so you can see the whole picture.");
  assert.equal(SITE_DESCRIPTION, "Connect your world. Create your freedom. Control your future. Whether you're managing your personal finances, running a business, managing investments, or planning a trip for business or pleasure — Temple Stuart brings your plans, budgets, and financial records together so you can see the whole picture.");
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
  for (const words of [...COMPANY_LINE, HERO_SUBLINE, 'Temple Stuart brings your plans']) { // HOME-BRIEF-02 (2026-11-10): the new subline's own words ('One system for your money' until then)
    assert.ok(!landing.includes(words), `Landing.tsx's code types "${words}" — it reads src/lib/brandLines.ts`);
  }
});

// ── T3 · THE EXPERIENCE LINE'S HOME ──────────────────────────────────────────

test('T3 (HOME-BRIEF-03, 2026-11-10) the experience line heads the ONE travel-and-experiences header in Landing — an h2 on one line, then the PROMISE, then the travel sentence, then the booking box; the band repeats no headline: its eyebrow, then SUBHEAD', () => {
  // HOME-BRIEF-03 (Alex, 2026-11-10 18:09 · 18:15): travel booking and the experiences read as one offering — the line and the promise moved
  // up into the travel block's header. Until then the band rendered them itself: an h2 'mt-3 text-3xl sm:text-5xl font-bold leading-tight
  // tracking-tight text-ts-white' holding the three lines (the third in the wash), the PROMISE paragraph right under it, then SUBHEAD.
  assert.equal(PROMISE, 'Book the experience, not just the destination.');
  assert.equal(EXPERIENCE_LINE.join(' '), 'Plan your escape. Build your income. Explore the world.', 'the three sentences, on one line');
  const landing = code(LANDING);
  assert.match(landing, /^import \{ EXPERIENCE_LINE \} from '@\/lib\/brandLines';$/m, 'the line, imported on a line of its own');
  assert.match(landing, /^import \{ PROMISE \} from '\.\/ExperiencesSection';$/m, 'the promise, from the band\'s file');
  const steps = [
    '>TRAVEL BOOKING &amp; EXPERIENCES</p>',
    `<h2 className="mt-3 text-2xl sm:text-3xl font-medium tracking-tight text-brand-purple">{EXPERIENCE_LINE.join(' ')}</h2>`,
    '<p className="mt-2 text-lg font-semibold text-text-primary">{PROMISE}</p>',
    '<p className="mt-2 text-sm text-text-secondary">',
    'Search &amp; book travel — free today, no account needed.',
    '<LandingBookingSection onRequireAuth={onRequireAuth} />',
  ];
  for (const step of steps) assert.equal(landing.split(step).length - 1, 1, `${step} — once`);
  const at = steps.map((step) => landing.indexOf(step));
  assert.deepEqual(at, [...at].sort((a, b) => a - b), 'the label → the h2 → the promise → the travel sentence, as a line → the booking box');
  assert.match(landing.slice(at[1] + steps[1].length, at[2]), /^\s*$/, 'the promise right under the h2');
  assert.match(landing.slice(at[2] + steps[2].length, at[3]), /^\s*$/, 'the travel sentence right under the promise');
  assert.match(landing.slice(at[3] + steps[3].length, at[5]), /^\s*Search &amp; book travel — free today, no account needed\.\s*<\/p>\s*$/, 'that line holds the sentence, word for word, and the booking box follows');
  for (const words of [...EXPERIENCE_LINE, PROMISE]) assert.ok(!landing.includes(words), `Landing.tsx does not type "${words}"`);
  // the band: no headline of its own
  const html = renderToStaticMarkup(React.createElement(ExperiencesView, { rows: EXPERIENCES, today: '2026-11-08', choice: { category: DEFAULT_INTO }, onPick: () => {} }));
  assert.equal((html.match(/<h2/g) ?? []).length, 0, 'the band renders no h2');
  assert.ok(!html.includes(asHtml(PROMISE)) && EXPERIENCE_LINE.every((line) => !html.includes(line)), 'neither the promise nor the experience line');
  assert.match(html, new RegExp(`^<section id="events" aria-label="Book the experience"[^>]*><div class="[^"]*"><p class="[^"]*">${esc(EYEBROW)}</p><p class="[^"]*">${esc(asHtml(SUBHEAD))}</p><p class="[^"]*">`), 'the eyebrow, then SUBHEAD, then the chips\' label; the id and the aria-label unchanged');
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
