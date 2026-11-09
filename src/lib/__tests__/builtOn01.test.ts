/**
 * BUILTON-01 (Alex, ruled 2026-10-30 — HOME-04's WHAT IS COMING; PIPELINE-PAGE-01's judgement calls 2, 3 and 6; board K;
 * 2026-11-09) — BUILT ON MOVES TO /how-it-works, UNDER THE 14 STEPS, UNCHANGED; THE HOME PAGE STOPS LOADING THE DECK.
 *
 *   T1 BuiltOnStrip renders the strip once: the eyebrow and its line, every BUILT_ON entry twice — once per run, the
 *      second run aria-hidden — and the motion's classes;
 *   T2 a mark only where the map says true (a fixture: one slug true → its <img>, false or absent → the letter tile);
 *      the one entry with an href (Stripe) is a link only when lit;
 *   T3 the strip's JSX and its note read as they did in Landing.tsx on origin/main 9f275b1c — a text compare, line for
 *      line, indentation set aside (two digests: the section's code; the note's and the section's comments);
 *   T4 /how-it-works computes logoAvailability once (one fs.existsSync, over BUILT_ON) and mounts BuiltOnStrip once,
 *      inside <main>, between the deck and the footer — the map it hands down is the files on disk;
 *   T5 the home page lets go: Landing.tsx, GuestLanding.tsx and src/app/page.tsx carry no logoAvailability, no BUILT_ON
 *      and no fs check; BUILT_ON's importers in src are exactly the page and the strip;
 *   T6 DECK_STEP_IDS is defined once, in pipelineWords.ts; PipelineDeck.tsx imports it there and re-exports it; Landing.tsx
 *      imports nothing from './PipelineDeck' — and nothing the home page imports, at any depth, reaches the deck's file.
 * Source is read through code() and comments() only (the reader law). No clock. No line number or line count is pinned.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { code, comments } from '../sourceText';
import { BUILT_ON } from '../builtOnWall';
import BuiltOnStrip from '@/components/landing/BuiltOnStrip';
import HowItWorksPage from '@/app/how-it-works/page';
import PipelineDeck, { DECK_STEP_IDS as DECK_STEP_IDS_FROM_THE_DECK } from '@/components/landing/PipelineDeck';
import LandingHeader from '@/components/landing/LandingHeader';
import LandingFooter from '@/components/landing/LandingFooter';
import { DECK_STEP_IDS } from '@/components/landing/pipelineWords';

Object.assign(globalThis, { React });

const STRIP = 'src/components/landing/BuiltOnStrip.tsx';
const PAGE = 'src/app/how-it-works/page.tsx';
const HOME = 'src/app/page.tsx';
const GUEST = 'src/components/landing/GuestLanding.tsx';
const LANDING = 'src/components/landing/Landing.tsx';
const DECK = 'src/components/landing/PipelineDeck.tsx';
const WORDS = 'src/components/landing/pipelineWords.ts';
const THIS = 'src/lib/__tests__/builtOn01.test.ts';

const BUILT_ON_OPEN = '<section className="w-full border-y border-border bg-bg-terminal">';
const EYEBROW = '<p class="font-mono text-xs lg:text-[10px] font-semibold uppercase tracking-wider text-brand-purple">Built on</p>';
const LINE = '<p class="text-sm text-text-secondary mt-1">Every tool this platform runs on.</p>';
const RUN_ONE = '<div class="flex w-max items-center gap-3 pr-3">';
const RUN_TWO = '<div aria-hidden="true" class="flex w-max items-center gap-3 pr-3">';
const LETTER_TILE = '<span class="text-xs font-semibold leading-none text-white/80">';
const MOUNT = '<BuiltOnStrip logoAvailability={logoAvailability} />';
/** code() blanks a comment's words and keeps everything else — whitespace (and a JSX comment's braces) is all that may sit between. */
const ONLY_COMMENTS = /^\s*(\{\s*\}\s*)*$/;

const count = (hay: string, needle: string): number => hay.split(needle).length - 1;
const escapeHtml = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
const render = (logoAvailability: Record<string, boolean>): string => renderToStaticMarkup(React.createElement(BuiltOnStrip, { logoAvailability }));
const sha = (s: string): string => createHash('sha256').update(s).digest('hex');

// ── T1 · THE STRIP, ONCE ─────────────────────────────────────────────────────

test('T1 BuiltOnStrip renders the strip once: the eyebrow and its line, every BUILT_ON entry twice — once per run, the second aria-hidden — and the motion\'s classes', () => {
  const html = render({});
  assert.ok(html.startsWith('<section class="w-full border-y border-border bg-bg-terminal">') && html.endsWith('</section>'), 'one section, the whole render');
  assert.equal(count(html, '<section'), 1);
  assert.equal(count(html, EYEBROW), 1, 'the eyebrow');
  assert.equal(count(html, LINE), 1, 'its line');
  assert.equal(count(html, RUN_ONE), 1, 'the first run, read aloud');
  assert.equal(count(html, RUN_TWO), 1, 'the second run, aria-hidden — screen readers read each vendor once');
  assert.ok(html.indexOf(RUN_ONE) < html.indexOf(RUN_TWO));
  const [first, second] = html.split(RUN_TWO);
  for (const e of BUILT_ON) {
    const name = `<span class="font-semibold text-brand-purple">${escapeHtml(e.name)}</span><span class="text-text-muted">· ${escapeHtml(e.tag)}</span>`;
    assert.equal(count(first, name), 1, `${e.name}: once in the first run`);
    assert.equal(count(second, name), 1, `${e.name}: once in the second`);
  }
  assert.equal(count(html, '<span class="font-semibold text-brand-purple">'), 2 * BUILT_ON.length, 'every entry twice, none invented');
  assert.equal(count(html, '<div class="group mt-6 overflow-hidden motion-reduce:overflow-x-auto">'), 1, 'reduced motion: a contained scroll');
  assert.equal(count(html, '<div class="flex w-max animate-[ts-marquee_50s_linear_infinite] group-hover:[animation-play-state:paused] motion-reduce:animate-none">'), 1, 'the track: the marquee, hover pauses it, reduced motion stills it');
});

// ── T2 · THE MARK ONLY WHERE THE MAP SAYS TRUE ───────────────────────────────

test('T2 a mark only where the map says true — one slug true → its <img>, false or absent → the letter tile; Stripe is a link only when lit', () => {
  const slotted = BUILT_ON.filter((e) => e.logo !== undefined);
  const anthropic = BUILT_ON.find((e) => e.logo?.slug === 'anthropic');
  assert.ok(anthropic?.logo && !anthropic.logo.href, 'the fixture\'s lit slug: Anthropic, a mark with no link');
  const lit = render({ anthropic: true });
  assert.deepEqual([...lit.matchAll(/<img src="([^"]*)"/g)].map((m) => m[1]), ['/logos/anthropic.svg', '/logos/anthropic.svg'], 'its mark, once per run, and no other');
  assert.equal(count(lit, `<img src="/logos/anthropic.svg" alt="${escapeHtml(anthropic.logo.alt)}" class="h-5 w-auto max-w-[72px] object-contain"/>`), 2);
  assert.equal(count(lit, LETTER_TILE), 2 * (BUILT_ON.length - 1), 'every other chip: its letter tile');
  assert.equal(count(lit, '<a '), 0, 'a lit mark with no href is not a link');
  const dark = render({});
  assert.equal(count(dark, '<img'), 0, 'an empty map: no mark');
  assert.equal(count(dark, LETTER_TILE), 2 * BUILT_ON.length, 'every chip its letter tile');
  for (const e of BUILT_ON) assert.equal(count(dark, `${LETTER_TILE}${escapeHtml(e.name[0])}</span>`) >= 2, true, `${e.name}: its initial`);
  assert.equal(render({ anthropic: false }), dark, 'false renders as absent — never a broken <img>');
  // the one entry with an href — Stripe's marks mandate the link — links only when its mark is lit
  const linked = slotted.filter((e) => e.logo?.href);
  assert.deepEqual(linked.map((e) => [e.name, e.logo?.slug, e.logo?.href]), [['Stripe', 'stripe', 'https://stripe.com']]);
  assert.equal(count(render({ stripe: false }), '<a '), 0, 'unlit: no link');
  const stripeLit = render({ stripe: true });
  assert.equal(count(stripeLit, '<a href="https://stripe.com" target="_blank" rel="noopener noreferrer" class="flex items-center gap-2 whitespace-nowrap rounded border border-border bg-white py-1.5 pl-1.5 pr-3 font-mono text-xs">'), 2, 'lit: the whole chip links out, once per run');
  assert.equal(count(stripeLit, '<a '), 2);
});

// ── T3 · THE TEXT COMPARE ────────────────────────────────────────────────────

test('T3 the strip\'s JSX and its note read as they did in Landing.tsx on origin/main 9f275b1c — line for line, indentation set aside', () => {
  const codeLines = code(STRIP).split('\n');
  const noteLines = comments(STRIP).split('\n');
  const open = codeLines.findIndex((l) => l.trim() === BUILT_ON_OPEN);
  const close = codeLines.findIndex((l, i) => i > open && l.trim() === '</section>');
  const noteStart = noteLines.findIndex((l) => l.includes('── BUILTON-MARQUEE:'));
  assert.ok(noteStart > -1 && open > noteStart && close > open, 'the note, then the section');
  assert.equal(codeLines.slice(close + 1).join('\n').trim(), ');\n}', 'nothing after the section but the return\'s close');
  const trimLines = (lines: string[]): string => lines.map((l) => l.trim()).join('\n');
  // Both digests were taken from origin/main's Landing.tsx by this same procedure (the section's <section> line to its
  // </section>; the note's first line to the same </section>). A JSX comment's braces are code, so the comments half
  // reads the same with or without them — the note's {/* */} became a plain /* */ inside return ( ), nothing else moved.
  assert.equal(sha(trimLines(codeLines.slice(open, close + 1))), 'd45d38d1ad8e328b51b367c04011d208470404fa2572de7ae1318be3cbb3fbdf', 'the section\'s code: every word, class, run, mark and href, as on main');
  assert.equal(sha(trimLines(noteLines.slice(noteStart, close + 1))), '14294ebe34cf7bdf85232847e5a4202a83ac66757cd98b95388c1389d286395d', 'the BUILTON-MARQUEE note and the section\'s own comments (REAL-MARKS, the eslint line over the <img>), as on main');
  const strip = code(STRIP);
  assert.doesNotMatch(strip, /['"]use (client|server)['"]/, 'no directive: no state, no handler — it renders on a server page');
  assert.doesNotMatch(strip, /\buse(State|Effect|Ref|Memo|Callback)\b|\bon[A-Z]\w*=/, 'no hook, no handler');
  assert.match(strip, /^import \{ BUILT_ON \} from '@\/lib\/builtOnWall';$/m);
  assert.match(strip, /^export default function BuiltOnStrip\(\{ logoAvailability \}: Props\) \{$/m);
  assert.match(strip, /^ {2}logoAvailability: Record<string, boolean>;$/m, 'its one prop');
});

// ── T4 · THE PAGE COMPUTES IT ONCE AND MOUNTS THE STRIP ONCE ─────────────────

test('T4 /how-it-works computes logoAvailability once — one fs.existsSync, over BUILT_ON — and mounts BuiltOnStrip once, inside <main>, between the deck and the footer; the map it hands down is the files on disk', () => {
  const page = code(PAGE);
  assert.equal(count(page, 'fs.existsSync('), 1, 'one file check');
  assert.equal(count(page, 'const logoAvailability = Object.fromEntries('), 1, 'computed once');
  assert.equal(count(page, 'BUILT_ON.flatMap((e) =>'), 1, 'over BUILT_ON\'s slots');
  assert.ok(page.includes("fs.existsSync(path.join(process.cwd(), 'public', 'logos', `${e.logo.slug}.svg`))"), 'public/logos/<slug>.svg — the expression moved verbatim');
  for (const line of ["import fs from 'fs';", "import path from 'path';", "import { BUILT_ON } from '@/lib/builtOnWall';", "import BuiltOnStrip from '@/components/landing/BuiltOnStrip';"]) {
    assert.equal(page.split('\n').filter((l) => l.trim() === line).length, 1, line);
  }
  assert.equal(count(page, MOUNT), 1, 'mounted once');
  const deck = page.indexOf('<PipelineDeck />');
  const strip = page.indexOf(MOUNT);
  const mainClose = page.indexOf('</main>');
  const footer = page.indexOf('<LandingFooter />');
  assert.ok(deck > -1 && strip > deck && mainClose > strip && footer > mainClose, 'the deck → Built on → </main> → the footer');
  assert.match(page.slice(deck + '<PipelineDeck />'.length, strip), ONLY_COMMENTS, 'nothing but comments between the deck and the strip');
  assert.match(page.slice(strip + MOUNT.length, mainClose), ONLY_COMMENTS, 'the strip closes <main>');
  assert.doesNotMatch(page, /'use client'|generateMetadata|dynamic =|revalidate|fetch\(|process\.env|prisma/, 'still static: no directive, no per-request config, no fetch, no env, no database');
  // the element tree the page returns — the strip once, after the deck, with the map of the files on disk
  type El = React.ReactElement<{ children?: React.ReactNode; logoAvailability?: Record<string, boolean> }>;
  const walk = (n: React.ReactNode, out: El[] = []): El[] => {
    if (Array.isArray(n)) n.forEach((c) => walk(c, out));
    else if (React.isValidElement(n)) { out.push(n as El); walk((n as El).props.children, out); }
    return out;
  };
  const els = walk(HowItWorksPage());
  assert.deepEqual(els.map((e) => e.type), ['div', LandingHeader, 'main', PipelineDeck, BuiltOnStrip, LandingFooter], 'header → <main>: the deck, the strip → footer');
  const handed = els.find((e) => e.type === BuiltOnStrip)?.props.logoAvailability;
  const onDisk = Object.fromEntries(BUILT_ON.flatMap((e) => (e.logo ? [[e.logo.slug, existsSync(resolve(process.cwd(), 'public', 'logos', `${e.logo.slug}.svg`))]] : [])));
  assert.deepEqual(handed, onDisk, 'every slot, true exactly where public/logos holds its file');
  assert.ok(Object.values(onDisk).some(Boolean) && Object.values(onDisk).some((v) => !v), 'some lit, some letter tiles — the check is not vacuous');
});

// ── T5 · THE HOME PAGE LETS GO ───────────────────────────────────────────────

/** Every non-test .ts/.tsx file under src/, repo-relative. */
const srcFiles = (dir = 'src'): string[] => readdirSync(dir).flatMap((name) => {
  const rel = join(dir, name);
  if (statSync(rel).isDirectory()) return name === '__tests__' ? [] : srcFiles(rel);
  return /\.(ts|tsx)$/.test(name) ? [rel] : [];
});

test('T5 the home page lets go: Landing.tsx, GuestLanding.tsx and src/app/page.tsx carry no logoAvailability, no BUILT_ON and no fs check; BUILT_ON\'s importers in src are exactly the page and the strip', () => {
  for (const f of [LANDING, GUEST, HOME]) {
    const src = code(f);
    for (const gone of ['logoAvailability', 'BUILT_ON', 'builtOnWall', 'existsSync', '/logos/']) assert.ok(!src.includes(gone), `${f}: no ${gone}`);
  }
  const home = code(HOME);
  assert.doesNotMatch(home, /^import (fs|path) from/m, 'the home page imports neither fs nor path');
  assert.match(home, /^export const dynamic = 'force-dynamic';$/m, 'force-dynamic stays — the signed-in redirect reads the request');
  assert.ok(!code(LANDING).includes(BUILT_ON_OPEN), 'Landing.tsx renders no strip');
  const importers = srcFiles().filter((f) => /from '(@\/lib|\.{1,2}(\/\.\.)*(\/lib)?)\/builtOnWall'/.test(code(f))).sort();
  assert.deepEqual(importers, [PAGE, STRIP].sort(), 'BUILT_ON is read by the page that checks the files and the strip that renders them — nothing else');
  assert.deepEqual(srcFiles().filter((f) => /\bBUILT_ON\b/.test(code(f))).sort(), [PAGE, STRIP, 'src/lib/builtOnWall.ts'].sort(), 'and named nowhere else');
});

// ── T6 · THE DECK'S IDS LEAVE THE DECK ───────────────────────────────────────

/** A source file's runtime imports and re-exports (type-only ones erased), resolved to repo-relative files under src/ —
 *  every statement, including a second one riding a line after a ';' (Landing.tsx carries two such lines). */
const importsOf = (file: string): string[] => {
  const src = code(file);
  const specs = [
    ...[...src.matchAll(/(?:^|;)\s*(?:import|export)(?!\s+type\b)[^'"`;]*?\sfrom\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]),
    ...[...src.matchAll(/(?:^|;)\s*import\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]),
    ...[...src.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]),
  ];
  return specs.flatMap((spec) => {
    const base = spec.startsWith('@/') ? join('src', spec.slice(2)) : spec.startsWith('.') ? join(dirname(file), spec) : null;
    if (base === null) return [];
    const hit = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'].map((ext) => base + ext).find((p) => existsSync(p) && statSync(p).isFile());
    return hit === undefined || !/\.(ts|tsx)$/.test(hit) ? [] : [hit];
  });
};

test('T6 DECK_STEP_IDS is defined once, in pipelineWords.ts; the deck imports it there and re-exports it; Landing.tsx imports nothing from \'./PipelineDeck\' — and nothing the home page imports, at any depth, reaches the deck\'s file', () => {
  assert.deepEqual(srcFiles().filter((f) => /\bDECK_STEP_IDS = \[/.test(code(f))), [WORDS], 'one definition, in the words leaf');
  assert.doesNotMatch(code(WORDS), /^import |'use client'/m, 'the leaf stays pure: no imports, no directive');
  assert.deepEqual([...DECK_STEP_IDS], Array.from({ length: 14 }, (_, i) => `deck-${String(i + 1).padStart(2, '0')}`), 'deck-01 … deck-14, in order');
  const deck = code(DECK);
  assert.match(deck, /^import \{ DECK_STEP_IDS, PIPELINE_HEADER_SUB \} from '\.\/pipelineWords';$/m, 'the deck imports it from the leaf, beside the header\'s sub');
  assert.match(deck, /^export \{ DECK_STEP_IDS \};$/m, 'and still exports it');
  assert.equal(DECK_STEP_IDS_FROM_THE_DECK, DECK_STEP_IDS, 'one array — the deck\'s export is the leaf\'s');
  const landing = code(LANDING);
  assert.doesNotMatch(landing, /from '\.\/PipelineDeck'/, 'Landing.tsx imports nothing from the deck');
  assert.match(landing, /^import \{ DECK_STEP_IDS \} from '\.\/pipelineWords';$/m, 'the old-links effect reads the ids from the leaf');
  // the home page's whole import graph — src/app/page.tsx, both of its landings, everything they import
  const seen = new Set<string>();
  const queue = [HOME];
  while (queue.length > 0) {
    const f = queue.pop() as string;
    if (seen.has(f)) continue;
    seen.add(f);
    queue.push(...importsOf(f));
  }
  for (const reached of [GUEST, LANDING, WORDS, 'src/components/home/HomeClient.tsx', 'src/components/landing/StopZeroSection.tsx', 'src/lib/ds.ts']) assert.ok(seen.has(reached), `the walk reaches ${reached}`); // the last two ride a line after another import
  assert.ok(!seen.has(DECK), `nothing the home page imports reaches ${DECK} (${seen.size} files walked)`);
  assert.ok(!seen.has(STRIP), 'nor the strip');
});

// ── NO LINE PINS ─────────────────────────────────────────────────────────────

test('this test pins no line number and no line count', () => {
  assert.doesNotMatch(code(THIS), /\.tsx?:\d+/, 'no file:line');
  assert.doesNotMatch(code(THIS), /\.length,\s*\d{2,}\b|lines?\)?, \d{2,}/, 'no line count');
});
