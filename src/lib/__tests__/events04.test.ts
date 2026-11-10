/**
 * EVENTS-04 (Alex, 2026-11-09: "right now the home page is not doing what the mock up said it would"; EVENTS-03's judgement
 * calls 1, 2 and 5; STOP0-01's judgement call 12) — the events band's last finish.
 *
 *   T1 the label over the row: WHEN TO GO on each of the seven season chips, COMING UP on each event chip — the groups
 *      read from EXPERIENCE_CATEGORIES, no id typed; the refused view shows neither;
 *   T2 the words: an announced season whose published window has ended says "Next season not announced (checked …)"
 *      (seasonNotAnnouncedLine); an event past its end still says "Next edition not announced (checked …)"; a typical
 *      row prints its usual window on any day; a season still on prints its dates;
 *   T3 Snow resorts on 2027-06-01, rendered: each ended season's card reads "Next season not announced (checked Nov 8,
 *      2026)" and says "checked" once; Golf past every edition reads the edition's words, never the season's;
 *   T4 the row starts at the start: the rail carries key={into} — a new chip mounts a new rail — one data-coming-up-rail
 *      per view. HOME-BRIEF-02 (Alex, 2026-11-10): the rail is the compact list now, so the class list it holds is the
 *      list's (the sideways row's until then);
 *   T5 RETIRED (HOME-BRIEF-02, 2026-11-10) — it held "Read my story ↓" on one line; the paragraph and its link are gone.
 * Source is read through code() only (the reader law). No clock: the days are written down. No line number or line
 * count is pinned (the last test says so of this file).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { code } from '../sourceText';
import { EXPERIENCES, EXPERIENCE_CATEGORIES, type Experience } from '../experiences';
import { experienceLine, experienceWindowLine, notAnnouncedLine, seasonNotAnnouncedLine } from '../experienceWords';
import { ExperiencesView, COMING_UP_LABEL, WHEN_TO_GO_LABEL, type IntoChoice } from '@/components/landing/ExperiencesSection';

Object.assign(globalThis, { React });

const SECTION = 'src/components/landing/ExperiencesSection.tsx';
const WORDS = 'src/lib/experienceWords.ts';
const THIS = 'src/lib/__tests__/events04.test.ts';
/** EVENTS-01's day: Surf has three cards upcoming. */
const TODAY = '2026-10-30';
/** A day after every announced snow season has ended (the last, Niseko, closes 2027-05-05). */
const AFTER_THE_SNOW = '2027-06-01';
/** A day after every edition and every season in the leaf. */
const FAR_LATER = '2099-12-31';
/** HOME-BRIEF-02 (Alex, 2026-11-10): the rail is the compact list — its classes (EXP.rail). Until then, the sideways row's: '-mx-4 mt-3 flex snap-x snap-proximity gap-3 overflow-x-auto …' with its drawn thumb. */
// HOME-BRIEF-04 (Alex, 2026-11-10 19:00): the catalog is repainted for the booking box's white surface — the list's hairlines are the house
// lavender and the labels are faint ink. Until then, on the purple band: 'mt-3 divide-y divide-white/15 border-y border-white/15' and
// '<p class="mt-10 font-mono text-xs lg:text-[10px] font-semibold uppercase tracking-wider text-white/60">'.
const RAIL_CLASSES = 'mt-3 divide-y divide-border border-y border-border';
const LABEL_P = '<p class="mt-10 font-mono text-xs lg:text-[10px] font-semibold uppercase tracking-wider text-text-faint">';

const SEASONS = EXPERIENCE_CATEGORIES.filter((c) => c.group === 'season');
const EVENTS = EXPERIENCE_CATEGORIES.filter((c) => c.group === 'event');
const render = (choice: IntoChoice, today = TODAY, rows: readonly Experience[] = EXPERIENCES) =>
  renderToStaticMarkup(React.createElement(ExperiencesView, { rows, today, choice, onPick: () => {} }));
const count = (hay: string, needle: string) => hay.split(needle).length - 1;
const unescape = (s: string) => s.replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"');
const cardOf = (html: string, id: string) => {
  const m = new RegExp(`<article class="[^"]*" data-coming-up="${id}">([\\s\\S]*?)</article>`).exec(html);
  assert.ok(m, `${id}: its card is drawn`);
  return m[1];
};
const lineIn = (card: string) => unescape(/data-experience-line="true">([^<]*)</.exec(card)?.[1] ?? '');

// ── T1 · THE LABEL OVER THE ROW ──────────────────────────────────────────────

test('T1 WHEN TO GO over the row on each of the seven season chips, COMING UP on each event chip, neither on the refused view', () => {
  assert.equal(WHEN_TO_GO_LABEL, 'WHEN TO GO');
  assert.equal(COMING_UP_LABEL, 'COMING UP', 'an event chip says COMING UP exactly as before');
  assert.equal(SEASONS.length, 7, 'seven season categories');
  for (const c of SEASONS) {
    const html = render({ category: c.id });
    assert.equal(count(html, `${LABEL_P}${WHEN_TO_GO_LABEL}</p>`), 1, `${c.label}: WHEN TO GO, once, in the label's classes`);
    assert.ok(!html.includes(COMING_UP_LABEL), `${c.label}: no COMING UP`);
    assert.ok(html.includes(`${LABEL_P}${WHEN_TO_GO_LABEL}</p><div class="`) && html.indexOf(WHEN_TO_GO_LABEL) < html.indexOf('data-coming-up-rail'), `${c.label}: directly over its row`);
  }
  for (const c of EVENTS) {
    const html = render({ category: c.id });
    assert.equal(count(html, `${LABEL_P}${COMING_UP_LABEL}</p>`), 1, `${c.label}: COMING UP, once`);
    assert.ok(!html.includes(WHEN_TO_GO_LABEL), `${c.label}: no WHEN TO GO`);
    assert.ok(html.indexOf(COMING_UP_LABEL) < html.indexOf('data-coming-up-rail'), `${c.label}: over its row`);
  }
  const refused = render({ refused: 'nope' });
  assert.ok(!refused.includes(WHEN_TO_GO_LABEL) && !refused.includes(COMING_UP_LABEL), 'the refused view: neither label');
  const section = code(SECTION);
  assert.equal(count(section, '{isSeason ? WHEN_TO_GO_LABEL : COMING_UP_LABEL}'), 1, 'the label picks by the chip\'s group');
  assert.equal(count(section, "'WHEN TO GO'"), 1, 'typed once, in its const');
  assert.match(section, /^export const WHEN_TO_GO_LABEL = 'WHEN TO GO';$/m);
  assert.doesNotMatch(section, /\.status\b/, 'never a list of statuses');
});

// ── T2 · THE WORDS ───────────────────────────────────────────────────────────

test('T2 an ended published season says "Next season not announced (checked …)"; an ended edition, "Next edition not announced (checked …)"; a usual window prints on any day', () => {
  assert.equal(seasonNotAnnouncedLine('2026-11-08'), 'Next season not announced (checked Nov 8, 2026)');
  assert.equal(notAnnouncedLine('2026-11-08'), 'Next edition not announced (checked Nov 8, 2026)', 'the edition\'s words, unchanged');
  const announcedSeasons = EXPERIENCES.filter((r) => r.windowKind === 'season' && r.status === 'announced');
  assert.ok(announcedSeasons.length > 0, 'the leaf holds published seasons');
  for (const r of announcedSeasons) {
    assert.match(experienceLine(r, r.end as string), /^Season /, `${r.id}: on its last day, its dates`);
    assert.equal(experienceLine(r, FAR_LATER), seasonNotAnnouncedLine(r.checkedOn), `${r.id}: past its end, the season's words`);
  }
  const typical = EXPERIENCES.filter((r) => r.status === 'typical');
  assert.ok(typical.length > 0);
  for (const r of typical) {
    for (const day of ['2000-01-01', r.start as string, r.end as string, FAR_LATER]) {
      assert.equal(experienceLine(r, day), experienceWindowLine(r), `${r.id} on ${day}: its usual window`);
    }
    assert.match(experienceLine(r, FAR_LATER), /^Usually /);
  }
  const events = EXPERIENCES.filter((r) => r.windowKind !== 'season' && r.end !== null);
  assert.ok(events.length > 0);
  for (const r of events) {
    const line = experienceLine(r, FAR_LATER);
    assert.equal(line, notAnnouncedLine(r.checkedOn), `${r.id}: past its end, the edition's words`);
    assert.match(line, /^Next edition not announced \(checked /);
  }
  for (const r of EXPERIENCES.filter((x) => x.status === 'not_announced')) assert.equal(experienceLine(r, TODAY), notAnnouncedLine(r.checkedOn), `${r.id}: not announced, as before`);
  const words = code(WORDS);
  assert.match(words, /^export function seasonNotAnnouncedLine\(checkedOn: string\): string \{\s*return `Next season not announced \(checked \$\{dayWords\(checkedOn\)\}\)`;\s*\}/m);
  assert.equal(count(words, "if (row.end < today) return row.windowKind === 'season' ? seasonNotAnnouncedLine(row.checkedOn) : notAnnouncedLine(row.checkedOn);"), 1, 'the end-of-window rule: the season\'s words for a season, the edition\'s for every other row');
});

// ── T3 · SNOW RESORTS AFTER THE SNOW, AND GOLF ───────────────────────────────

test('T3 Snow resorts on 2027-06-01: each ended season reads "Next season not announced (checked Nov 8, 2026)" and says "checked" once; Golf past every edition reads the edition\'s words', () => {
  const snow = SEASONS.find((c) => EXPERIENCES.some((r) => r.category === c.id && r.status === 'announced'));
  assert.ok(snow, 'the season category with published dates');
  assert.equal(snow.label, 'Snow resorts');
  const html = render({ category: snow.id }, AFTER_THE_SNOW);
  const rows = EXPERIENCES.filter((r) => r.category === snow.id);
  let ended = 0;
  for (const r of rows) {
    const card = cardOf(html, r.id);
    assert.equal(count(card.replace(/<[^>]*>/g, '').toLowerCase(), 'checked'), 1, `${r.id}: says "checked" once, in its visible words`);
    if (r.status === 'announced') {
      ended += 1;
      assert.equal(lineIn(card), 'Next season not announced (checked Nov 8, 2026)', `${r.id}: the season's words`);
      assert.ok(!card.includes('data-checked'), `${r.id}: its line says it — no foot words`);
    } else {
      assert.match(lineIn(card), /^Usually /, `${r.id}: its usual window still prints`);
      assert.ok(card.includes(`data-checked="${r.id}">Checked Nov 8, 2026<`), `${r.id}: the foot says it`);
    }
  }
  assert.equal(count(html, 'Next season not announced (checked Nov 8, 2026)'), ended, 'the season\'s words once per ended published season, counted in the rendered view');
  assert.ok(ended > 0 && !html.includes('Next edition not announced'), 'no season card says the edition\'s words');
  assert.equal(count(html, `${LABEL_P}${WHEN_TO_GO_LABEL}</p>`), 1);
  const golf = EVENTS.find((c) => c.label === 'Golf');
  assert.ok(golf);
  const late = render({ category: golf.id }, FAR_LATER);
  const ids = [...late.matchAll(/data-coming-up="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(ids.length > 0);
  for (const id of ids) assert.match(lineIn(cardOf(late, id)), /^Next edition not announced \(checked /, `${id}: the edition's words`);
  assert.ok(!late.includes('Next season not announced'));
});

// ── T4 · THE ROW STARTS AT THE START ─────────────────────────────────────────

type El = React.ReactElement<Record<string, unknown> & { children?: React.ReactNode }>;
const walk = (n: React.ReactNode, out: El[] = []): El[] => {
  if (Array.isArray(n)) n.forEach((c) => walk(c, out));
  else if (React.isValidElement(n)) { out.push(n as El); walk((n as El).props.children, out); }
  return out;
};

test('T4 the rail carries key={into} — a new chip mounts a new rail — and renders as the compact list (HOME-BRIEF-02, 2026-11-10)', () => {
  const section = code(SECTION);
  assert.equal(count(section, '<div key={into} className={EXP.rail} data-coming-up-rail>'), 1, 'the rail is keyed by the chip');
  assert.equal(count(section, 'data-coming-up-rail'), 1, 'one rail');
  const keys: string[] = [];
  for (const c of [...EVENTS, ...SEASONS]) {
    const html = render({ category: c.id });
    assert.equal(count(html, 'data-coming-up-rail'), 1, `${c.label}: one rail`);
    const cls = /<div class="([^"]*)" data-coming-up-rail="true">/.exec(html);
    assert.ok(cls, `${c.label}: the rail is drawn`);
    assert.deepEqual(unescape(cls[1]).split(' '), RAIL_CLASSES.split(' '), `${c.label}: the list's classes`);
    const rails = walk(ExperiencesView({ rows: EXPERIENCES, today: TODAY, choice: { category: c.id }, onPick: () => {} })).filter((e) => e.props['data-coming-up-rail'] === true);
    assert.equal(rails.length, 1);
    assert.equal(rails[0].key, c.id, `${c.label}: the rail's key is the chip`);
    keys.push(rails[0].key as string);
  }
  assert.equal(new Set(keys).size, keys.length, 'every chip its own rail — picking another mounts a new one');
  assert.equal(count(render({ refused: 'nope' }), 'data-coming-up-rail'), 0, 'the refused view: no rail');
});

// ── T5 · READ MY STORY ON ONE LINE — RETIRED ─────────────────────────────────
// HOME-BRIEF-02 (Alex's home page brief, 2026-11-10): T5 held that "Read my story ↓" never broke across lines (EXP.storyLink's
// whitespace-nowrap) and that the link's JSX was untouched. The WHY EVENTS FIRST paragraph and its link left the events band, with
// their words in src/lib/stopZeroWords.ts, so there is nothing left for it to hold; stopZero01 T4 holds that the band no longer
// reads that leaf.

// ── NO LINE PINS ─────────────────────────────────────────────────────────────

test('this test pins no line number and no line count', () => {
  assert.doesNotMatch(code(THIS), /\.tsx?:\d+/, 'no file:line');
  assert.doesNotMatch(code(THIS), /\.length,\s*\d{2,}\b|lines?\)?, \d{2,}/, 'no line count');
});
