/**
 * FOOTER-01 (Alex, 2026-11-08 15:11 + 16:18; board K tag 17) — THE BLOG AND THE RECORD IN THE FOOTER.
 * Two columns join the footer above the disclaimer: THE BLOG (the home page's sections and every written trip post)
 * and THE RECORD (the 14 steps; the code). The disclaimer, ©, the five social icons and PRICING · TERMS · PRIVACY ·
 * the email stay exactly as they are. The four anchors THE BLOG links to get one home, src/lib/homeAnchors.ts.
 *
 * HOME-FINISH-02 (Alex's brief "HOME-FINISH | Temple Stuart Homepage Copy, Layout & Footer", 2026-11-10 20:56, with his footer
 * note of 20:53): THE FOOTER IN FOUR COLUMNS — OUR STORY (Stop 0 and every stop of the trip log), SERVICES (the three
 * pillars), SOCIALS (icon and name), THE RECORD (three links) — then the disclaimer, then one row: © and PRICING · TERMS ·
 * PRIVACY · CONTACT. THE BLOG is gone; the socials left the bar. T1–T5 are re-pointed below, each note saying what it held
 * until then; T6 (the anchors' one home), T7 and T8 stand.
 *
 * PILLAR-NAMES-01 (Alex, 2026-11-11: "Financial Software | Professional Services | Travel Marketplace — these will replace
 * Plan your Escape / Build your Income / Explore the World"): SERVICES' three links take the pillars' new names, on the
 * targets they had. The pillars' headings dropped their full stop with the same ruling (put to Alex in the audit before
 * the build; his answer: drop it), so T3's rule moved from "each label is its pillar's heading, without the full stop" to
 * "each label is its pillar's heading, letter for letter" — and T3 gained one hold: no code under src still types an old
 * name. T4's list of words the component must not type names the new three. Nothing else in this file moved.
 *
 *   T1 the labels — OUR STORY, SERVICES, SOCIALS, THE RECORD (THE BLOG, THE RECORD until then) — from src/lib/footerWords.ts;
 *   T2 footerStoryLinks(WAS_HERE): "Stop 0 | Los Angeles" ('/#' + its anchor), then one link per stop of the trip log in
 *      trip order — "Stop <n> | <the row's city>" → that stop's page; a stop added to the log adds itself, in its place.
 *      (Until then: footerBlogLinks(TRIP_POSTS) — Book travel, Events, Stop 0, My trip, then one link per written post.)
 *   T3 the other three columns, exactly: SERVICES (the three pillars on their sections), SOCIALS (the five accounts, the
 *      bar's own hrefs), THE RECORD (the 14 steps, the code, the licence — no arrows; the last two external); CODE_URL is
 *      LandingHeader.tsx's GitHub href. (Until then: FOOTER_RECORD_LINKS — the door's words and path, then the code.)
 *   T4 the footer renders the four columns once, above the disclaimer, then the bar; every column link as listed, in
 *      order, in the ruled classes; the socials each an icon beside its name; no word or href typed in the component.
 *      (Until then: two columns.)
 *   T5 below the columns: the disclaimer word for word, then one row — ©, PRICING · TERMS · PRIVACY · CONTACT, their
 *      hrefs, words and classes; no socials and no icon there. (Until then: the bar unchanged — ©, the five social hrefs
 *      in order, PRICING · TERMS · PRIVACY · the email.)
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
import { WAS_HERE, type WasHereRow } from '../wasHere';
import { tripOrder } from '../wasHereWords';
import { BUILD_PILLAR, EXPLORE_PILLAR, PLAN_PILLAR } from '../homeActWords';
import {
  CODE_URL, FOOTER_RECORD_LABEL, FOOTER_RECORD_LINKS, FOOTER_SERVICES_LABEL, FOOTER_SERVICES_LINKS, FOOTER_SOCIALS, FOOTER_SOCIALS_LABEL, FOOTER_STOP_ZERO_LABEL,
  FOOTER_STORY_LABEL, LICENSE_URL, footerStoryLinks, type FooterLink,
} from '../footerWords';
import { DEMO_ANCHOR, EVENTS_ANCHOR, MY_TRIP_ANCHOR, SERVICES_ANCHOR, STOP_ZERO_ANCHOR } from '../homeAnchors';
import { STOP_ZERO_ANCHOR as STOP_ZERO_IN_ITS_LEAF } from '../stopZeroWords';
import { PIPELINE_PATH } from '@/components/landing/pipelineWords';
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
const HOW_TO = 'src/components/landing/HowToSection.tsx';
const STOP_PAGE = 'src/app/my-trip/[id]/page.tsx';
const THIS = 'src/lib/__tests__/footer01.test.ts';

// HOME-FINISH-02 (2026-11-10): four columns — two by two on a phone, four across from lg. Until then: '<div class="max-w-7xl mx-auto px-4 lg:px-8 pt-10 grid gap-8 sm:grid-cols-2">'.
const GRID_OPEN = '<div class="max-w-7xl mx-auto px-4 lg:px-8 pt-10 grid gap-8 grid-cols-2 lg:grid-cols-4">';
const DISCLAIMER_OPEN = '<div class="max-w-3xl mx-auto px-4 lg:px-8 pt-8 text-center">';
const BAR_OPEN = '<div class="max-w-7xl mx-auto px-4 lg:px-8 py-8">';
const LABEL_CLASS = 'font-mono text-xs lg:text-[10px] font-semibold uppercase tracking-wider text-white/60';
// HOME-FINISH-02 (2026-11-10): the column link gained lg:min-h-0 lg:py-1 — eleven 44px rows would stand 484px tall on a desktop; the 44px touch
// height stays below lg. Until then: 'inline-flex min-h-[44px] items-center text-sm text-white/85 hover:text-white'.
const LINK_CLASS = 'inline-flex min-h-[44px] items-center text-sm text-white/85 hover:text-white lg:min-h-0 lg:py-1';
// A social's link in its column: the same row with its icon beside its name. Until then the socials stood in the bar, icon-only, as
// SOCIAL_CLASS = 'p-3 lg:p-0 text-white/70 hover:text-white transition-colors'.
const SOCIAL_LINK_CLASS = 'inline-flex min-h-[44px] items-center gap-2 text-sm text-white/85 hover:text-white lg:min-h-0 lg:py-1';
/** The five accounts — the hrefs the bar held, in its order — and the first characters of each one's icon path, so a name and its icon cannot be swapped. */
const SOCIALS: ReadonlyArray<readonly [string, string, string]> = [
  ['Instagram', 'https://www.instagram.com/temple_stuart_accounting/', 'M12 2.163c3.204 0 3.584'],
  ['TikTok', 'https://www.tiktok.com/@temple_stuart', 'M19.59 6.69a4.83 4.83'],
  ['YouTube', 'https://www.youtube.com/@Temple-Stuart', 'M23.498 6.186a3.016'],
  ['X', 'https://x.com/Alex_Stuart_APS', 'M18.244 2.25h3.308l-7.227'],
  ['LinkedIn', 'https://www.linkedin.com/in/alexander-stuart-phi/', 'M20.447 20.452h-3.554v-5.569'],
];
const DISCLAIMER = 'Temple Stuart is not a CPA firm, tax preparer, or licensed financial advisor. All tax figures generated by this platform are estimates for informational purposes only and must be verified by a qualified tax professional before filing. Use of this software does not constitute tax advice.';
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

test('T1 the labels: OUR STORY, SERVICES, SOCIALS and THE RECORD, from the words module', () => {
  // HOME-FINISH-02 (2026-11-10): four columns. Until then: FOOTER_BLOG_LABEL 'THE BLOG' and FOOTER_RECORD_LABEL 'THE RECORD'.
  assert.deepEqual([FOOTER_STORY_LABEL, FOOTER_SERVICES_LABEL, FOOTER_SOCIALS_LABEL, FOOTER_RECORD_LABEL], ['OUR STORY', 'SERVICES', 'SOCIALS', 'THE RECORD']);
  assert.ok(!code(WORDS).includes('THE BLOG') && !code(WORDS).includes('footerBlogLinks'), 'THE BLOG left the words module with its last reader');
});

// ── T2 · OUR STORY'S LINKS ───────────────────────────────────────────────────

test('T2 footerStoryLinks(WAS_HERE): Stop 0, then one link per stop of the trip log, in trip order — its number, the log\'s own city, its page; a stop added to the log adds itself, in its place', () => {
  // HOME-FINISH-02 (Alex, 2026-11-10 20:53 · 20:56). Until then this test read 'T2 footerBlogLinks(TRIP_POSTS): the four sections, then one link per
  // written post — Canggu's today; a second post adds itself, after the first': { label: 'Book travel', href: '/#demo' }, { label: 'Events', href:
  // '/#events' }, { label: 'Stop 0', href: '/#stop-0' }, { label: 'My trip', href: '/#my-trip' }, then { label: post.title, href:
  // tripPostHref(post.stopId) } per post ({ label: 'Thirty days in Canggu with no plan.', href: '/my-trip/canggu-2026-07' } today).
  const links = footerStoryLinks(WAS_HERE);
  assert.equal(FOOTER_STOP_ZERO_LABEL, 'Stop 0 | Los Angeles');
  assert.deepEqual(links[0], { label: 'Stop 0 | Los Angeles', href: `/#${STOP_ZERO_ANCHOR}` }, 'Stop 0 first: "/#" + its anchor');
  assert.equal(links[0].href, '/#stop-0');
  const stops = tripOrder(WAS_HERE);
  assert.deepEqual(links.slice(1), stops.map((row, i) => ({ label: `Stop ${i + 1} | ${row.city}`, href: tripPostHref(row.id) })), 'derived from the log, in trip order: the number, the row\'s own city, the stop\'s page');
  assert.equal(links.length, WAS_HERE.length + 1, 'Stop 0 and one link per stop — those still ahead included');
  assert.deepEqual(links[1], { label: 'Stop 1 | Canggu, Bali', href: '/my-trip/canggu-2026-07' }, 'today\'s first stop');
  assert.deepEqual(links[links.length - 1], { label: `Stop ${stops.length} | ${stops[stops.length - 1].city}`, href: `/my-trip/${stops[stops.length - 1].id}` }, 'and its last');
  assert.equal(new Set(links.map((l) => l.href)).size, links.length, 'every link its own target — two stops in one city are two links');
  // from the log, never from the posts: a stop with no post is linked all the same, and no post title is a label
  assert.ok(stops.some((row) => !TRIP_POSTS.some((post) => post.stopId === row.id)), 'the log holds stops that are not written up');
  for (const post of TRIP_POSTS) assert.ok(!links.some((l) => l.label === post.title), `no post title: "${post.title}"`);
  for (const gone of ['Book travel', 'Events', 'My trip']) assert.ok(!links.some((l) => l.label === gone), `${gone} left this column`);
  assert.ok(!links.some((l) => l.href === '/#events' || l.href === '/#my-trip' || l.href === '/#demo'));
  // every stop has a page: the route builds one per row of the log
  assert.match(code(STOP_PAGE), /return WAS_HERE\.map\(\(row\) => \(\{ id: row\.id \}\)\);/, 'src/app/my-trip/[id]/page.tsx builds a page per stop');
  // fixtures: a stop added to the log adds its own link, in trip order — nothing in the words changes
  const late: WasHereRow = { ...stops[0], id: 'somewhere-2027-01', city: 'Somewhere', start: '2027-01-05', end: '2027-01-20' };
  const withLate = footerStoryLinks([late, ...WAS_HERE]);
  assert.equal(withLate.length, links.length + 1);
  assert.deepEqual(withLate.slice(0, links.length), links, 'given first, drawn last: trip order — the links before it unchanged');
  assert.deepEqual(withLate[withLate.length - 1], { label: `Stop ${stops.length + 1} | Somewhere`, href: '/my-trip/somewhere-2027-01' });
  const early: WasHereRow = { ...stops[0], id: 'early-2026-06', city: 'Early', start: '2026-06-01', end: '2026-06-30' };
  const withEarly = footerStoryLinks([...WAS_HERE, early]);
  assert.deepEqual(withEarly[1], { label: 'Stop 1 | Early', href: '/my-trip/early-2026-06' }, 'a stop that starts first is Stop 1');
  assert.equal(withEarly[2].label, `Stop 2 | ${stops[0].city}`, 'and every other moves down one');
  for (const l of links) assert.ok(l.href.startsWith('/'), `${l.label}: starts with '/', so it lands from every page the footer is on`);
});

// ── T3 · SERVICES, SOCIALS, THE RECORD ───────────────────────────────────────

test('T3 the other three columns, exactly — SERVICES: the three pillars on their sections; SOCIALS: the five accounts, the bar\'s own hrefs; THE RECORD: the 14 steps, the code, the licence, no arrows; CODE_URL is LandingHeader.tsx\'s GitHub href', () => {
  // HOME-FINISH-02 (2026-11-10). Until then this test read 'T3 FOOTER_RECORD_LINKS exactly — the door's words and path from pipelineWords.ts, then
  // the code, external': [{ label: PIPELINE_DOOR, href: PIPELINE_PATH }, { label: 'Built in public: the code ↗', href: CODE_URL, external: true }],
  // with PIPELINE_DOOR = 'How it all connects: the 14 steps →' and "import { PIPELINE_DOOR, PIPELINE_PATH } from '@/components/landing/pipelineWords';".
  // PILLAR-NAMES-01 (Alex, 2026-11-11): the three pillars' new names, on the targets they had. Until then the labels were 'Plan Your Escape',
  // 'Build Your Income' and 'Explore the World'.
  assert.deepEqual(FOOTER_SERVICES_LINKS, [
    { label: 'Financial Software', href: '/#modules' },
    { label: 'Professional Services', href: `/#${SERVICES_ANCHOR}` },
    { label: 'Travel Marketplace', href: `/#${DEMO_ANCHOR}` },
  ]);
  assert.deepEqual(FOOTER_SERVICES_LINKS.map((l) => l.href), ['/#modules', '/#services', '/#demo'], 'absolute paths, so they land from every page the footer is on');
  // PILLAR-NAMES-01: the headings dropped their full stop, so a label IS its pillar's heading. Until then this line held `${l.label}.` equal to the
  // three headings — 'each label is its pillar's heading, without the full stop'.
  assert.deepEqual(FOOTER_SERVICES_LINKS.map((l) => l.label), [PLAN_PILLAR.heading, BUILD_PILLAR.heading, EXPLORE_PILLAR.heading], 'each label is its pillar\'s heading, letter for letter');
  for (const heading of [PLAN_PILLAR.heading, BUILD_PILLAR.heading, EXPLORE_PILLAR.heading]) assert.doesNotMatch(heading, /[.!?:]$/, `"${heading}" is a name, not a sentence — no full stop`);
  // PILLAR-NAMES-01: renamed wherever the three were shown as the pillars' names — no code under src (comments tell the history) still types an old one.
  // The experience line is another thing and stays in its leaf: 'Plan your escape.', in sentence case (src/lib/brandLines.ts — homeLines01 holds it).
  for (const old of ['Plan Your Escape', 'Build Your Income', 'Explore the World']) {
    assert.deepEqual(srcFiles().filter((file) => code(file).includes(old)), [], `no code under src types "${old}"`);
  }
  assert.ok(code(HOW_TO).includes('<section id="modules"'), 'the first link\'s target: the how-to\'s own section id');
  assert.deepEqual(FOOTER_SOCIALS, SOCIALS.map(([name, href]) => ({ name, href })), 'the five accounts, the bar\'s hrefs, in its order');
  assert.deepEqual(FOOTER_RECORD_LINKS, [
    { label: 'How It All Connects: The 14 Steps', href: PIPELINE_PATH },
    { label: 'Built in Public: The Code', href: CODE_URL, external: true },
    { label: 'Software License', href: LICENSE_URL, external: true },
  ]);
  assert.equal(PIPELINE_PATH, '/how-it-works');
  assert.equal(CODE_URL, 'https://github.com/Temple-Stuart/temple-stuart-accounting');
  assert.equal(LICENSE_URL, 'https://github.com/Temple-Stuart/temple-stuart-accounting/blob/main/LICENSE');
  for (const l of FOOTER_RECORD_LINKS) assert.doesNotMatch(l.label, /[→↗]/, `${l.label}: as Alex typed it — no arrow`);
  const words = code(WORDS);
  assert.match(words, /^import \{ PIPELINE_PATH \} from '@\/components\/landing\/pipelineWords';$/m, 'the path from the words leaf');
  assert.doesNotMatch(words, /PipelineDeck|PIPELINE_DOOR/, 'never from the deck\'s \'use client\' file; the door\'s old words are read no more');
  for (const f of [WORDS, FOOTER]) assert.doesNotMatch(code(f), /open[ -]?source/i, `${f}: the licence is the Business Source License — never called open source`);
  const header = [...code(HEADER).matchAll(/href="(https:\/\/github\.com\/[^"]*)"/g)].map((m) => m[1]);
  assert.deepEqual(header, [CODE_URL], 'LandingHeader.tsx\'s GitHub ↗ opens the same URL');
});

// ── T4 · THE FOOTER RENDERS THE FOUR COLUMNS ABOVE THE DISCLAIMER ────────────

test('T4 the footer renders the four columns once, above the disclaimer, then the bar; every column link as listed, in order, in the ruled classes; the socials each an icon beside its name; only the socials, the code and the licence open a new tab', () => {
  // HOME-FINISH-02 (2026-11-10). Until then: two columns — data-footer-blog (THE BLOG: footerBlogLinks(TRIP_POSTS)) and data-footer-record (THE
  // RECORD) — 'only the code opens a new tab', and the component held "import { TRIP_POSTS } from '@/lib/tripPosts';" and
  // '{footerBlogLinks(TRIP_POSTS).map('.
  const html = render();
  assert.ok(html.startsWith(`<footer class="bg-brand-purple text-white">${GRID_OPEN}`), 'the columns open the footer — the solid purple stays');
  const grid = html.indexOf(GRID_OPEN);
  const disclaimer = html.indexOf(DISCLAIMER_OPEN);
  const bar = html.indexOf(BAR_OPEN);
  assert.ok(grid === html.indexOf('>') + 1 && disclaimer > grid && bar > disclaimer, 'the columns → the disclaimer → the bar');
  for (const [s, what] of [[GRID_OPEN, 'the grid'], [DISCLAIMER_OPEN, 'the disclaimer'], [BAR_OPEN, 'the bar']] as const) assert.equal(count(html, s), 1, `${what} once`);
  const columns = html.slice(grid, disclaimer);
  const inner = columns.slice(GRID_OPEN.length, -'</div>'.length); // the four columns, the grid's own tags off
  const sides: ReadonlyArray<readonly [string, string, readonly FooterLink[]]> = [
    ['data-footer-story', FOOTER_STORY_LABEL, footerStoryLinks(WAS_HERE)],
    ['data-footer-services', FOOTER_SERVICES_LABEL, FOOTER_SERVICES_LINKS],
    ['data-footer-socials', FOOTER_SOCIALS_LABEL, FOOTER_SOCIALS.map((s): FooterLink => ({ label: s.name, href: s.href, external: true }))],
    ['data-footer-record', FOOTER_RECORD_LABEL, FOOTER_RECORD_LINKS],
  ];
  const starts = sides.map(([marker]) => inner.indexOf(`<div ${marker}="true">`));
  assert.equal(starts[0], 0, 'OUR STORY first');
  assert.deepEqual(starts, [...starts].sort((x, y) => x - y), 'OUR STORY → SERVICES → SOCIALS → THE RECORD');
  assert.ok(starts.every((at) => at > -1), 'each has a column of its own');
  assert.equal(count(columns, '<ul'), 4, 'one list per column');
  sides.forEach(([marker, label, links], i) => {
    const col = inner.slice(starts[i], i + 1 < sides.length ? starts[i + 1] : undefined);
    // each column is its label, then a <ul> of ITS OWN links — nothing else (attribute order free; the <ul>'s own attributes are not ruled)
    const shape = col.replace(/<a\b[^>]*>[\s\S]*?<\/a>/g, '<a/>').replace(/<ul\b[^>]*>/g, '<ul>');
    assert.equal(shape, `<div ${marker}="true"><p class="${LABEL_CLASS}">${label}</p><ul>${'<li><a/></li>'.repeat(links.length)}</ul></div>`, `${label}: its label, then a <ul> of its own links, nothing else`);
    const drawn = anchorsIn(col);
    assert.deepEqual(drawn.map((a) => ({ label: a.text, href: a.href })), links.map((l) => ({ label: l.label, href: l.href })), `${label}: its own links, in order`);
    drawn.forEach((a, j) => {
      assert.equal(a.cls, marker === 'data-footer-socials' ? SOCIAL_LINK_CLASS : LINK_CLASS, `${a.text}: the ruled link class`);
      assert.deepEqual([a.target, a.rel], links[j].external === true ? ['_blank', 'noopener noreferrer'] : [null, null], `${a.text}: ${links[j].external === true ? 'leaves the site, in a new tab' : 'stays on the site'}`);
    });
  });
  assert.equal(sides[0][2].length, 11, 'eleven story links today: Stop 0 and the ten stops');
  // the socials: the bar's five SVGs, each beside its account's name — and nowhere else in the footer
  const socials = inner.slice(starts[2], starts[3]);
  for (const [name, href, path] of SOCIALS) {
    assert.ok(new RegExp(`<a href="${href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^"]*"></path></svg><span>${name}</span></a>`).test(socials), `${name}: its own icon, then its name`);
  }
  assert.equal(count(html, '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">'), 5, 'the five icons, as the bar drew them');
  assert.equal(count(html, '<svg'), 5, 'and no other');
  // every word and href from the words module — none typed in the component (an icon's key is the account's name: a type the words leaf exports)
  // PILLAR-NAMES-01 (2026-11-11): the three pillars' names in this list are the new ones — 'Plan Your Escape', 'Build Your Income', 'Explore the World' until then.
  const footer = code(FOOTER);
  for (const typed of ['OUR STORY', 'THE RECORD', 'THE BLOG', 'Stop 0', 'Los Angeles', 'Financial Software', 'Professional Services', 'Travel Marketplace', 'How It All Connects', 'Built in Public', 'Software License', '/how-it-works', 'github.com', 'instagram.com', 'tiktok.com', 'youtube.com', 'x.com/', 'linkedin.com', '/my-trip', "'#", '/#']) {
    assert.ok(!footer.includes(typed), `LandingFooter.tsx types no "${typed}"`);
  }
  for (const label of ['FOOTER_STORY_LABEL', 'FOOTER_SERVICES_LABEL', 'FOOTER_SOCIALS_LABEL', 'FOOTER_RECORD_LABEL']) assert.equal(count(footer, `<p className={COLUMN.label}>{${label}}</p>`), 1, `${label}, rendered from the leaf`);
  assert.match(footer, /^import \{ WAS_HERE \} from '@\/lib\/wasHere';$/m);
  assert.match(footer, /\{footerStoryLinks\(WAS_HERE\)\.map\(columnLink\)\}/, 'the log passed in, so a stop added to it adds its own link');
  assert.ok(!footer.includes('tripPosts') && !footer.includes('TRIP_POSTS'), 'the posts are read here no more');
  assert.doesNotMatch(footer, /^['"]use client['"]/m, 'still a server component where a server page renders it — no directive on any line');
});

// ── T5 · BELOW THE COLUMNS: THE DISCLAIMER, THEN ONE ROW ─────────────────────

test('T5 below the columns: the disclaimer word for word; then one row — ©, PRICING · TERMS · PRIVACY · CONTACT on their existing targets, in their classes; no socials and no icon there', () => {
  // HOME-FINISH-02 (2026-11-10). Until then this test read 'T5 the bar unchanged: ©, the five social hrefs in order, PRICING · TERMS · PRIVACY · the
  // email — their hrefs, words and classes': nine hrefs — the five socials (each _blank, noopener noreferrer, class 'p-3 lg:p-0 text-white/70
  // hover:text-white transition-colors', an icon each), then '/how-pricing-works', '/terms', '/privacy', 'mailto:astuart@templestuart.com' reading
  // PRICING, TERMS, PRIVACY and ASTUART@TEMPLESTUART.COM.
  const html = render();
  const tail = html.slice(html.indexOf(DISCLAIMER_OPEN));
  assert.ok(tail.startsWith(`${DISCLAIMER_OPEN}<p class="text-xs text-white/50 leading-relaxed">${DISCLAIMER}</p></div>${BAR_OPEN}`), 'the disclaimer, word for word, then the bar');
  assert.ok(tail.includes('<div class="font-mono text-xs lg:text-[10px] uppercase tracking-wider text-white/60">© 2026 TEMPLE STUART, LLC</div>'), '©');
  assert.deepEqual(anchorsIn(tail).map((a) => [a.text, a.href, a.cls, a.target]), [
    ['PRICING', '/how-pricing-works', LEGAL_CLASS, null],
    ['TERMS', '/terms', LEGAL_CLASS, null],
    ['PRIVACY', '/privacy', LEGAL_CLASS, null],
    ['CONTACT', 'mailto:astuart@templestuart.com', LEGAL_CLASS, null],
  ], 'PRICING · TERMS · PRIVACY · CONTACT — the four, on their existing targets');
  assert.equal(count(tail, '<svg'), 0, 'no icon below the columns');
  assert.ok(!tail.includes('·'), 'and no "·" — it stood between the icons and PRICING');
  for (const [, href] of SOCIALS) assert.ok(!tail.includes(href), `${href} is in its column, not in the bar`);
  assert.ok(!html.includes('ASTUART@TEMPLESTUART.COM'), 'the address is the link\'s target, no longer its words');
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
  // HOME-FINISH-02 (Alex, 2026-11-10 20:56): the eyebrow row left the page — the third pillar's heading carries the anchor. Until then:
  // '<div id={DEMO_ANCHOR} className="flex items-baseline justify-between gap-3 pt-6">' ('the eyebrow row carries the anchor').
  assert.equal(count(landing, '<h2 id={DEMO_ANCHOR} className="text-2xl sm:text-3xl font-medium tracking-tight text-brand-purple">{EXPLORE_PILLAR.heading}</h2>'), 1, 'the pillar\'s heading carries the anchor');
  assert.equal(count(landing, 'id={DEMO_ANCHOR}'), 1, 'once');
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
