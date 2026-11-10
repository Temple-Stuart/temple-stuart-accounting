/**
 * FOOTER-01 (Alex, 2026-11-08 15:11 + 16:18; board K tag 17) — THE BLOG AND THE RECORD IN THE FOOTER.
 * Two columns join the footer above the disclaimer: THE BLOG (the home page's sections and every written trip post)
 * and THE RECORD (the 14 steps; the code). The disclaimer, ©, the five social icons and PRICING · TERMS · PRIVACY ·
 * the email stay exactly as they are. The four anchors THE BLOG links to get one home, src/lib/homeAnchors.ts.
 *
 *   T1 the labels — THE BLOG, THE RECORD — from src/lib/footerWords.ts;
 *   T2 footerBlogLinks(TRIP_POSTS): Book travel, Events, Stop 0, My trip (each '/#' + its anchor), then one link per
 *      written post in TRIP_POSTS' order — Canggu's today; a second post adds its own link, after the first;
 *   T3 FOOTER_RECORD_LINKS exactly: the door's words and path (imported from pipelineWords.ts, never from
 *      PipelineDeck.tsx), then the code — external; CODE_URL is LandingHeader.tsx's GitHub href;
 *   T4 the footer renders both columns once, above the disclaimer, then the bar; every column link as listed, in order,
 *      in the ruled classes; only the code opens a new tab; no word or href typed in the component;
 *   T5 the bar unchanged: ©, the five social hrefs in order (each _blank, noopener noreferrer), PRICING · TERMS ·
 *      PRIVACY · the email — their hrefs, words and classes;
 *   T6 one home for the anchors: each equals its owner's export; the two sections import theirs back on a line of its
 *      own and still export it; Stop 0's literal stays in its leaf; none of the four is typed as an anchor anywhere
 *      else in src — but the one named literal, LandingBookingSection.tsx's '#events' (experiences01 T6 pins its text).
 *      HOME-FINISH-02 (Alex, 2026-11-10 20:56): five — SERVICES_ANCHOR 'services' joined, the professional-services
 *      section's id (Landing.tsx), its import on a line of its own; the census holds it in its one home;
 *   T7 Landing.tsx renders id={DEMO_ANCHOR}, its import on a line of its own; the trip page's two links back derive
 *      from the leaf;
 *   T8 the law's GUEST_ROUTES names the lines PRICING, PRIVACY and TERMS sit on — read here by content, so the three
 *      citations cannot drift again.
 * Source is read through code() only (the reader law). No clock. No line number or line count is pinned.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { code } from '../sourceText';
import { TRIP_POSTS } from '../tripPosts';
import { tripPostHref } from '../tripPostWords';
import { CODE_URL, FOOTER_BLOG_LABEL, FOOTER_RECORD_LABEL, FOOTER_RECORD_LINKS, footerBlogLinks, type FooterLink } from '../footerWords';
import { DEMO_ANCHOR, EVENTS_ANCHOR, MY_TRIP_ANCHOR, SERVICES_ANCHOR, STOP_ZERO_ANCHOR } from '../homeAnchors';
import { STOP_ZERO_ANCHOR as STOP_ZERO_IN_ITS_LEAF } from '../stopZeroWords';
import { PIPELINE_DOOR, PIPELINE_PATH } from '@/components/landing/pipelineWords';
import { EVENTS_ANCHOR as EVENTS_FROM_ITS_SECTION } from '@/components/landing/ExperiencesSection';
import { MY_TRIP_ANCHOR as MY_TRIP_FROM_ITS_SECTION } from '@/components/landing/WasHereSection';
import { BOOK_HREF, POST_BACK_HREF } from '@/components/trip/TripPostView';
import LandingFooter from '@/components/landing/LandingFooter';

Object.assign(globalThis, { React });

const FOOTER = 'src/components/landing/LandingFooter.tsx';
const WORDS = 'src/lib/footerWords.ts';
const ANCHORS = 'src/lib/homeAnchors.ts';
const STOP_ZERO_LEAF = 'src/lib/stopZeroWords.ts';
const EXPERIENCES = 'src/components/landing/ExperiencesSection.tsx';
const MY_TRIP = 'src/components/landing/WasHereSection.tsx';
const LANDING = 'src/components/landing/Landing.tsx';
const TRIP_POST_VIEW = 'src/components/trip/TripPostView.tsx';
const HEADER = 'src/components/landing/LandingHeader.tsx';
const LAW = 'scripts/assert-tool-registry.ts';
const THIS = 'src/lib/__tests__/footer01.test.ts';

const GRID_OPEN = '<div class="max-w-7xl mx-auto px-4 lg:px-8 pt-10 grid gap-8 sm:grid-cols-2">';
const DISCLAIMER_OPEN = '<div class="max-w-3xl mx-auto px-4 lg:px-8 pt-8 text-center">';
const BAR_OPEN = '<div class="max-w-7xl mx-auto px-4 lg:px-8 py-8">';
const LABEL_CLASS = 'font-mono text-xs lg:text-[10px] font-semibold uppercase tracking-wider text-white/60';
const LINK_CLASS = 'inline-flex min-h-[44px] items-center text-sm text-white/85 hover:text-white';
const SOCIAL_CLASS = 'p-3 lg:p-0 text-white/70 hover:text-white transition-colors';
const LEGAL_CLASS = 'inline-block py-3.5 lg:py-0 font-mono text-xs lg:text-[10px] tracking-wider text-white/80 hover:text-white';

const count = (hay: string, needle: string): number => hay.split(needle).length - 1;
const unescapeHtml = (s: string) => s.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
/** Every <a> in a stretch of rendered HTML: its href, class, target, rel and text — attribute order free. */
const anchorsIn = (html: string) => [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map(([, attrs, inner]) => ({
  href: unescapeHtml(/\bhref="([^"]*)"/.exec(attrs)?.[1] ?? ''),
  cls: /\bclass="([^"]*)"/.exec(attrs)?.[1] ?? '',
  target: /\btarget="([^"]*)"/.exec(attrs)?.[1] ?? null,
  rel: /\brel="([^"]*)"/.exec(attrs)?.[1] ?? null,
  text: unescapeHtml(inner.replace(/<[^>]*>/g, '')),
}));
const render = () => renderToStaticMarkup(React.createElement(LandingFooter));

// ── T1 · THE LABELS ──────────────────────────────────────────────────────────

test('T1 the labels: THE BLOG and THE RECORD, from the words module', () => {
  assert.equal(FOOTER_BLOG_LABEL, 'THE BLOG');
  assert.equal(FOOTER_RECORD_LABEL, 'THE RECORD');
});

// ── T2 · THE BLOG'S LINKS ────────────────────────────────────────────────────

test('T2 footerBlogLinks(TRIP_POSTS): the four sections, then one link per written post — Canggu\'s today; a second post adds itself, after the first', () => {
  const sections: FooterLink[] = [
    { label: 'Book travel', href: '/#demo' },
    { label: 'Events', href: '/#events' },
    { label: 'Stop 0', href: '/#stop-0' },
    { label: 'My trip', href: '/#my-trip' },
  ];
  const links = footerBlogLinks(TRIP_POSTS);
  assert.deepEqual(links, [...sections, ...TRIP_POSTS.map((post) => ({ label: post.title, href: tripPostHref(post.stopId) }))], 'derived from the list, in its order');
  assert.deepEqual(links.slice(0, 4), [
    { label: 'Book travel', href: `/#${DEMO_ANCHOR}` },
    { label: 'Events', href: `/#${EVENTS_ANCHOR}` },
    { label: 'Stop 0', href: `/#${STOP_ZERO_ANCHOR}` },
    { label: 'My trip', href: `/#${MY_TRIP_ANCHOR}` },
  ], 'each section link is "/#" + its anchor');
  assert.deepEqual(links[4], { label: 'Thirty days in Canggu with no plan.', href: '/my-trip/canggu-2026-07' }, 'today\'s written post: Canggu');
  // a fixture: a second post adds its own link, in the list's order — nothing in the words changes
  const second = { stopId: 'danang-2026-08', title: 'A second post.' };
  const withTwo = footerBlogLinks([...TRIP_POSTS, second]);
  assert.equal(withTwo.length, links.length + 1);
  assert.deepEqual(withTwo.slice(0, links.length), links, 'the links before it unchanged');
  assert.deepEqual(withTwo[withTwo.length - 1], { label: 'A second post.', href: '/my-trip/danang-2026-08' });
  assert.deepEqual(footerBlogLinks([second, ...TRIP_POSTS]).slice(4).map((l) => l.label), ['A second post.', ...TRIP_POSTS.map((p) => p.title)], 'the order given is the order shown');
  for (const l of links) assert.ok(l.href.startsWith('/'), `${l.label}: starts with '/', so it lands from every page the footer is on`);
});

// ── T3 · THE RECORD'S LINKS ──────────────────────────────────────────────────

test('T3 FOOTER_RECORD_LINKS exactly — the door\'s words and path from pipelineWords.ts, then the code, external; CODE_URL is LandingHeader.tsx\'s GitHub href', () => {
  assert.deepEqual(FOOTER_RECORD_LINKS, [
    { label: PIPELINE_DOOR, href: PIPELINE_PATH },
    { label: 'Built in public: the code ↗', href: CODE_URL, external: true },
  ]);
  assert.equal(PIPELINE_DOOR, 'How it all connects: the 14 steps →');
  assert.equal(PIPELINE_PATH, '/how-it-works');
  assert.equal(CODE_URL, 'https://github.com/Temple-Stuart/temple-stuart-accounting');
  const words = code(WORDS);
  assert.match(words, /^import \{ PIPELINE_DOOR, PIPELINE_PATH \} from '@\/components\/landing\/pipelineWords';$/m, 'from the words leaf');
  assert.doesNotMatch(words, /PipelineDeck/, 'never from the deck\'s \'use client\' file');
  const header = [...code(HEADER).matchAll(/href="(https:\/\/github\.com\/[^"]*)"/g)].map((m) => m[1]);
  assert.deepEqual(header, [CODE_URL], 'LandingHeader.tsx\'s GitHub ↗ opens the same URL');
});

// ── T4 · THE FOOTER RENDERS THE TWO COLUMNS ABOVE THE DISCLAIMER ─────────────

test('T4 the footer renders both columns once, above the disclaimer, then the bar; every column link as listed, in order, in the ruled classes; only the code opens a new tab', () => {
  const html = render();
  assert.ok(html.startsWith(`<footer class="bg-brand-purple text-white">${GRID_OPEN}`), 'the columns open the footer');
  const grid = html.indexOf(GRID_OPEN);
  const disclaimer = html.indexOf(DISCLAIMER_OPEN);
  const bar = html.indexOf(BAR_OPEN);
  assert.ok(grid === html.indexOf('>') + 1 && disclaimer > grid && bar > disclaimer, 'the columns → the disclaimer → the bar');
  for (const [s, what] of [[GRID_OPEN, 'the grid'], [DISCLAIMER_OPEN, 'the disclaimer'], [BAR_OPEN, 'the bar']] as const) assert.equal(count(html, s), 1, `${what} once`);
  const columns = html.slice(grid, disclaimer);
  assert.equal(count(columns, `<p class="${LABEL_CLASS}">${FOOTER_BLOG_LABEL}</p>`), 1, 'THE BLOG, once, in the label class');
  assert.equal(count(columns, `<p class="${LABEL_CLASS}">${FOOTER_RECORD_LABEL}</p>`), 1, 'THE RECORD, once, in the label class');
  assert.ok(columns.indexOf(FOOTER_BLOG_LABEL) < columns.indexOf(FOOTER_RECORD_LABEL), 'THE BLOG first');
  const expected = [...footerBlogLinks(TRIP_POSTS), ...FOOTER_RECORD_LINKS];
  const drawn = anchorsIn(columns);
  assert.deepEqual(drawn.map((a) => ({ label: a.text, href: a.href })), expected.map((l) => ({ label: l.label, href: l.href })), 'every link, in order');
  for (const a of drawn) assert.equal(a.cls, LINK_CLASS, `${a.text}: the ruled link class`);
  assert.deepEqual(drawn.filter((a) => a.target !== null).map((a) => [a.text, a.target, a.rel]), [['Built in public: the code ↗', '_blank', 'noopener noreferrer']], 'only the code opens a new tab');
  assert.equal(count(columns, '<ul'), 2, 'one list per column');
  // CLOSED 3, column by column: each column is its label, then a <ul> of ITS OWN links — nothing else (attribute order
  // free; the <ul>'s own attributes are not ruled, so not pinned)
  const inner = columns.slice(GRID_OPEN.length, -'</div>'.length); // the two columns, the grid's own tags off
  const at = inner.indexOf('<div data-footer-record="true">');
  assert.ok(at > 0, 'THE RECORD has a column of its own, after THE BLOG');
  const sides: ReadonlyArray<readonly [string, string, string, readonly FooterLink[]]> = [
    [inner.slice(0, at), 'data-footer-blog', FOOTER_BLOG_LABEL, footerBlogLinks(TRIP_POSTS)],
    [inner.slice(at), 'data-footer-record', FOOTER_RECORD_LABEL, FOOTER_RECORD_LINKS],
  ];
  for (const [col, marker, label, links] of sides) {
    const shape = col.replace(/<a\b[^>]*>[\s\S]*?<\/a>/g, '<a/>').replace(/<ul\b[^>]*>/g, '<ul>');
    assert.equal(shape, `<div ${marker}="true"><p class="${LABEL_CLASS}">${label}</p><ul>${'<li><a/></li>'.repeat(links.length)}</ul></div>`, `${label}: its label, then a <ul> of its own links, nothing else`);
    assert.deepEqual(anchorsIn(col).map((a) => ({ label: a.text, href: a.href })), links.map((l) => ({ label: l.label, href: l.href })), `${label}: its own links, in order`);
  }
  // every word and href from the words module — none typed in the component
  const footer = code(FOOTER);
  for (const typed of ['THE BLOG', 'THE RECORD', 'Book travel', 'Stop 0', 'My trip', 'Built in public', '/how-it-works', 'github.com', '/my-trip', "'#", '/#']) {
    assert.ok(!footer.includes(typed), `LandingFooter.tsx types no "${typed}"`);
  }
  assert.match(footer, /^import \{ TRIP_POSTS \} from '@\/lib\/tripPosts';$/m);
  assert.match(footer, /\{footerBlogLinks\(TRIP_POSTS\)\.map\(/, 'the posts passed in, so a new post adds its own link');
  assert.doesNotMatch(footer, /^['"]use client['"]/m, 'still a server component where a server page renders it — no directive on any line');
});

// ── T5 · THE BAR UNCHANGED ───────────────────────────────────────────────────

test('T5 the bar unchanged: ©, the five social hrefs in order, PRICING · TERMS · PRIVACY · the email — their hrefs, words and classes', () => {
  const html = render();
  const tail = html.slice(html.indexOf(DISCLAIMER_OPEN));
  assert.ok(tail.startsWith(`${DISCLAIMER_OPEN}<p class="text-xs text-white/50 leading-relaxed">Temple Stuart is not a CPA firm, tax preparer, or licensed financial advisor.`), 'the disclaimer, first words unchanged');
  assert.ok(tail.includes('Use of this software does not constitute tax advice.</p></div>'), 'the disclaimer, last words unchanged');
  assert.ok(tail.includes('<div class="font-mono text-xs lg:text-[10px] uppercase tracking-wider text-white/60">© 2026 TEMPLE STUART, LLC</div>'), '©');
  const links = anchorsIn(tail);
  assert.deepEqual(links.map((a) => a.href), [
    'https://www.instagram.com/temple_stuart_accounting/',
    'https://www.tiktok.com/@temple_stuart',
    'https://www.youtube.com/@Temple-Stuart',
    'https://x.com/Alex_Stuart_APS',
    'https://www.linkedin.com/in/alexander-stuart-phi/',
    '/how-pricing-works',
    '/terms',
    '/privacy',
    'mailto:astuart@templestuart.com',
  ], 'the nine hrefs, in their order');
  for (const a of links.slice(0, 5)) {
    assert.equal(a.target, '_blank', `${a.href}: new tab`);
    assert.equal(a.rel, 'noopener noreferrer', `${a.href}: rel`);
    assert.equal(a.cls, SOCIAL_CLASS, `${a.href}: the social class`);
  }
  assert.deepEqual(links.slice(5).map((a) => [a.text, a.cls]), [
    ['PRICING', LEGAL_CLASS], ['TERMS', LEGAL_CLASS], ['PRIVACY', LEGAL_CLASS], ['ASTUART@TEMPLESTUART.COM', LEGAL_CLASS],
  ], 'PRICING · TERMS · PRIVACY · the email');
  assert.equal(count(tail, '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">'), 5, 'the five icons');
});

// ── T6 · ONE HOME FOR THE ANCHORS ────────────────────────────────────────────

/** Every non-test .ts/.tsx file under src/, repo-relative. */
const srcFiles = (dir = 'src'): string[] => readdirSync(dir).flatMap((name) => {
  const rel = join(dir, name);
  if (statSync(rel).isDirectory()) return name === '__tests__' ? [] : srcFiles(rel);
  return /\.(ts|tsx)$/.test(name) ? [rel] : [];
});

test('T6 one home for the anchors: each equals its owner\'s export; the sections import theirs back and still export it; Stop 0\'s literal stays in its leaf; no second literal anywhere in src but the one named', () => {
  // HOME-FINISH-02 (Alex, 2026-11-10 20:56: "a stable anchor so the footer can link directly to Build Your Income"): a fifth, SERVICES_ANCHOR
  // 'services'. Until then the four: [DEMO_ANCHOR, EVENTS_ANCHOR, STOP_ZERO_ANCHOR, MY_TRIP_ANCHOR] = ['demo', 'events', 'stop-0', 'my-trip'].
  assert.deepEqual([DEMO_ANCHOR, EVENTS_ANCHOR, STOP_ZERO_ANCHOR, MY_TRIP_ANCHOR, SERVICES_ANCHOR], ['demo', 'events', 'stop-0', 'my-trip', 'services']);
  assert.equal(EVENTS_FROM_ITS_SECTION, EVENTS_ANCHOR, 'ExperiencesSection.tsx still exports the anchor');
  assert.equal(MY_TRIP_FROM_ITS_SECTION, MY_TRIP_ANCHOR, 'WasHereSection.tsx still exports the anchor');
  assert.equal(STOP_ZERO_IN_ITS_LEAF, STOP_ZERO_ANCHOR, 'the re-export is the leaf\'s own value');
  const anchors = code(ANCHORS);
  assert.match(anchors, /^export \{ STOP_ZERO_ANCHOR \} from '\.\/stopZeroWords';$/m, 'Stop 0 re-exported, never retyped');
  assert.ok(!anchors.includes('stop-0'), 'the literal stays in src/lib/stopZeroWords.ts');
  assert.doesNotMatch(anchors, /^(import|'use client')/m, 'pure: no import of its own (the re-export aside), no directive');
  for (const [file, name] of [[EXPERIENCES, 'EVENTS_ANCHOR'], [MY_TRIP, 'MY_TRIP_ANCHOR']] as const) {
    const src = code(file);
    assert.equal(src.split('\n').filter((l) => new RegExp(`^import \\{ ${name} \\} from '@/lib/homeAnchors';\\s*$`).test(l)).length, 1, `${file}: the import on a line of its own`);
    assert.match(src, new RegExp(`^export \\{ ${name} \\};\\s*$`, 'm'), `${file}: still exported`);
    assert.doesNotMatch(src, new RegExp(`${name}\\s*=`), `${file}: no second declaration`);
  }
  // THE CENSUS — the five (four until HOME-FINISH-02: '(demo|events|my-trip|stop-0)') typed AS ANCHORS (a hash, an id, an *_ANCHOR declaration, a
  // getElementById) in the code of src
  const ANCHOR = '(demo|events|my-trip|stop-0|services)';
  const forms = [new RegExp(`#${ANCHOR}(?![\\w-])`, 'g'), new RegExp(`\\bid=\\{?\\s*["'\`]${ANCHOR}["'\`]`, 'g'), new RegExp(`_ANCHOR\\s*=\\s*["'\`]${ANCHOR}["'\`]`, 'g'), new RegExp(`getElementById\\(\\s*["'\`]${ANCHOR}["'\`]`, 'g')];
  const typed = srcFiles().flatMap((file) => {
    const src = code(file);
    return forms.flatMap((re) => [...src.matchAll(re)].map((m) => `${file}: ${m[0]}`));
  }).sort();
  assert.deepEqual(typed, [
    "src/components/landing/LandingBookingSection.tsx: #events", // the one named literal — experiences01 T6 pins this call's text; existing tests are not re-pinned here
    "src/lib/homeAnchors.ts: _ANCHOR = 'demo'",
    "src/lib/homeAnchors.ts: _ANCHOR = 'events'",
    "src/lib/homeAnchors.ts: _ANCHOR = 'my-trip'",
    "src/lib/homeAnchors.ts: _ANCHOR = 'services'", // HOME-FINISH-02 (2026-11-10): the fifth, in its one home
    "src/lib/stopZeroWords.ts: _ANCHOR = 'stop-0'",
  ].sort(), 'each anchor typed once, in its home — and the one literal a pinned test still holds');
  assert.equal(code(STOP_ZERO_LEAF).split('\n').filter((l) => l.includes("'stop-0'")).length, 1, 'Stop 0\'s leaf types it once');
  // HOME-FINISH-02 (2026-11-10): the fifth anchor's reader — the professional-services section's own id, its import on a line of its own
  const landing = code(LANDING);
  assert.equal(count(landing, '<section id={SERVICES_ANCHOR} className="w-full border-b border-border bg-bg-terminal">'), 1, 'the professional-services section carries the anchor');
  assert.equal(landing.split('\n').filter((l) => /^import \{ SERVICES_ANCHOR \} from '@\/lib\/homeAnchors';\s*$/.test(l)).length, 1, 'its import, on a line of its own');
  assert.equal(count(landing, 'SERVICES_ANCHOR'), 2, 'the import and the id — nothing else in Landing reads it');
  assert.ok(!landing.includes('id="services"'), 'never typed');
});

// ── T7 · THE DEMO'S ID AND THE TRIP PAGE'S LINKS BACK ────────────────────────

test('T7 Landing.tsx renders id={DEMO_ANCHOR}, its import on a line of its own; the trip page\'s two links back derive from the leaf', () => {
  const landing = code(LANDING);
  assert.equal(count(landing, '<div id={DEMO_ANCHOR} className="flex items-baseline justify-between gap-3 pt-6">'), 1, 'the eyebrow row carries the anchor');
  assert.ok(!landing.includes('id="demo"'), 'never typed');
  assert.equal(landing.split('\n').filter((l) => /^import \{ DEMO_ANCHOR \} from '@\/lib\/homeAnchors';\s*$/.test(l)).length, 1, 'its import, on a line of its own');
  assert.equal(BOOK_HREF, '/#demo');
  assert.equal(POST_BACK_HREF, '/#my-trip');
  const view = code(TRIP_POST_VIEW);
  assert.ok(view.includes('export const BOOK_HREF = `/#${DEMO_ANCHOR}`;'), 'Book the stay and the flight → the live demo, by its anchor');
  assert.ok(view.includes('export const POST_BACK_HREF = `/#${MY_TRIP_ANCHOR}`;'), 'back to MY TRIP, by its anchor');
});

// ── T8 · THE LAW'S CITATIONS OF THE FOOTER'S LINES ───────────────────────────

test('T8 GUEST_ROUTES names the lines PRICING, PRIVACY and TERMS sit on — read by content, so the citations cannot drift', () => {
  const lines = code(FOOTER).split('\n');
  const lineOf = (re: RegExp): number => {
    const at = lines.flatMap((l, i) => (re.test(l) ? [i + 1] : []));
    assert.equal(at.length, 1, `${re} sits on one line`);
    return at[0];
  };
  const pricing = lineOf(/>PRICING<\/Link>/);
  const terms = lineOf(/>TERMS<\/a>/);
  const privacy = lineOf(/>PRIVACY<\/a>/);
  const law = code(LAW);
  // the header's own citation in the same entry is not this PR's (NOT in this PR: the header) — so it is not read here
  assert.match(law, new RegExp(`\\{ route: '/how-pricing-works', why: '[^']*LandingFooter\\.tsx:${pricing}[ ,(]`), `/how-pricing-works cites :${pricing}`);
  assert.match(law, new RegExp(`\\{ route: '/privacy', why: 'LandingFooter\\.tsx:${privacy}[ ,(]`), `/privacy cites :${privacy}`);
  assert.match(law, new RegExp(`\\{ route: '/terms', why: 'LandingFooter\\.tsx:${terms}[ ,(]`), `/terms cites :${terms}`);
  assert.doesNotMatch(code(THIS), /\.ts:\d+|\.tsx:\d+/, 'this test pins no line number');
});
