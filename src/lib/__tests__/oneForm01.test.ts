/**
 * ONE-FORM-01 (Alex, 2026-11-06) — THE ONE PROPOSAL FORM: the 2026 close is booked on
 * /work-with-me, not by email ("all as one proposal form ... since email is wack").
 *
 *   T1 the vocabulary — the six words typed once (src/lib/proposalNeeds.ts + the leaf's
 *      need); the route's enum reads them; the form's choices on an open day and after
 *      the book-by day; no typed list of the five remains in the route or the form;
 *   T2 the migration — drops proposals_need_chk by its production name and re-adds it
 *      with the six words, never IF EXISTS; the schema's `need` names the CHECK, the six
 *      words and the migration; the pins on the newest migration moved;
 *   T3 the server page — force-dynamic, the one UTC-day expression, `?need=` handed down,
 *      the client reads no clock;
 *   T4 the form, rendered — arriving with ?need=close: the chip picked, the offer's lines
 *      from closeWords, no modules question; with ?need=setup: setup picked, modules
 *      asked, no offer lines; with a word the form does not offer: nothing picked; after
 *      the book-by day: no close chip, and ?need=close picks nothing;
 *   T5 the doors — the four DONE-FOR-YOU cards and the close button open the form with
 *      their word; the path from the leaf, never typed in Landing or the words module.
 * No live call, no database, no clock.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { code, comments } from '../sourceText';
import { CLOSE_OFFER, PROPOSAL_FORM_PATH } from '../offer/close';
import { closeWords } from '../offer/closeWords';
import { PROPOSAL_NEEDS, SERVICE_NEED_LABELS, SERVICE_NEEDS } from '../proposalNeeds';
import { SEGMENT } from '../ds';
import { z } from 'zod';
import WorkWithMeForm, { needChoices } from '@/app/work-with-me/WorkWithMeForm';

Object.assign(globalThis, { React });

const ROUTE = 'src/app/api/proposals/route.ts';
const FORM = 'src/app/work-with-me/WorkWithMeForm.tsx';
const PAGE = 'src/app/work-with-me/page.tsx';
const VOCAB = 'src/lib/proposalNeeds.ts';
const LANDING = 'src/components/landing/Landing.tsx';
const WORDS = 'src/lib/offer/closeWords.ts';
const SCHEMA = 'prisma/schema.prisma';
const MIGRATION_DIR = '20261106120000_one_form_01_close_need';
const MIGRATION = `prisma/migrations/${MIGRATION_DIR}/migration.sql`;

const OPEN_DAY = '2026-11-06';
const CLOSED_DAY = '2026-12-16';
const FIVE = ['setup', 'maintenance', 'custom', 'embed', 'unsure'];

const render = (today: string, initialNeed: string | null) => renderToStaticMarkup(React.createElement(WorkWithMeForm, { today, initialNeed }));
const chip = (html: string, need: string) => {
  const m = new RegExp(`<button type="button" class="([^"]*)" data-need="${need}">([^<]*)</button>`).exec(html);
  return m ? { className: m[1], words: m[2] } : null;
};
const unescape = (s: string) => s.replace(/&#x27;/g, "'").replace(/&amp;/g, '&');

// ── T1 · THE VOCABULARY ──────────────────────────────────────────────────────

test('T1 six words, typed once: the five service words then the close\'s; the route\'s enum reads them', () => {
  assert.deepEqual([...SERVICE_NEEDS], FIVE);
  assert.deepEqual([...PROPOSAL_NEEDS], [...FIVE, 'close']);
  assert.equal(CLOSE_OFFER.need, 'close');
  assert.deepEqual(SERVICE_NEED_LABELS, { setup: 'Setup', maintenance: 'Maintenance', custom: 'Custom build', embed: 'Embed a module', unsure: 'Not sure' });
  const route = code(ROUTE);
  assert.match(route, /need: z\.enum\(PROPOSAL_NEEDS\),/, 'the enum is the vocabulary');
  assert.match(route, /import \{ PROPOSAL_NEEDS \} from '@\/lib\/proposalNeeds';/);
  const need = z.enum(PROPOSAL_NEEDS);
  for (const ok of [...FIVE, 'close']) assert.equal(need.safeParse(ok).success, true, `${ok} is accepted`);
  for (const bad of ['bogus', 'Close', '', ' close', 'closed']) assert.equal(need.safeParse(bad).success, false, `"${bad}" is refused`);
  for (const f of [ROUTE, FORM]) assert.doesNotMatch(code(f), /'setup', 'maintenance'|'close'/, `${f}: no typed list of needs, no typed 'close'`);
  assert.doesNotMatch(code(VOCAB), /'close'|new Date\(|process\.env|fetch\(/, 'the vocabulary takes the close\'s word from the leaf and is pure');
});

test('T1 the form\'s choices: the four services, the close while it is open, then Not sure; no close after the book-by day', () => {
  assert.deepEqual(needChoices(OPEN_DAY), [
    { value: 'setup', label: 'Setup' }, { value: 'maintenance', label: 'Maintenance' }, { value: 'custom', label: 'Custom build' }, { value: 'embed', label: 'Embed a module' },
    { value: 'close', label: 'Close my 2026 books' }, { value: 'unsure', label: 'Not sure' },
  ]);
  assert.deepEqual(needChoices(CLOSE_OFFER.bookBy).map((n) => n.value), [...FIVE.slice(0, 4), 'close', 'unsure'], 'open through the book-by day');
  assert.deepEqual(needChoices(CLOSED_DAY).map((n) => n.value), FIVE, 'the day after: the five');
  for (const n of needChoices(OPEN_DAY)) assert.ok((PROPOSAL_NEEDS as readonly string[]).includes(n.value), `${n.value} is a word the table holds`);
});

// ── T2 · THE MIGRATION ───────────────────────────────────────────────────────

test('T2 the migration drops proposals_need_chk by its production name and re-adds it with the six words; never IF EXISTS', () => {
  assert.ok(existsSync(resolve(process.cwd(), MIGRATION)), `${MIGRATION} exists`);
  const sql = code(MIGRATION);
  assert.match(sql, /ALTER TABLE "proposals" DROP CONSTRAINT "proposals_need_chk";/);
  assert.match(sql, /ALTER TABLE "proposals" ADD CONSTRAINT "proposals_need_chk"\s+CHECK \("need" IN \('setup', 'maintenance', 'custom', 'embed', 'unsure', 'close'\)\);/);
  assert.doesNotMatch(sql, /IF EXISTS|UPDATE|DELETE|INSERT|ADD COLUMN|DROP COLUMN/i, 'the CHECK and nothing else; a wrong name fails loud');
  assert.equal((sql.match(/ALTER TABLE/g) ?? []).length, 2);
  const notes = comments(MIGRATION);
  assert.match(notes, /AUTHORED, NOT APPLIED/);
  assert.match(notes, /claude\/home-05-facts\.md/, 'the name\'s source');
});

test('T2 the schema\'s need names the CHECK, the six words and the migration; the newest-migration pins moved', () => {
  const schema = comments(SCHEMA);
  assert.match(schema, /proposals_need_chk\): 'setup' \| 'maintenance' \| 'custom' \| 'embed' \| 'unsure' \| 'close'/);
  assert.match(schema, new RegExp(`prisma/migrations/${MIGRATION_DIR}`));
  const dirs = readdirSync(resolve(process.cwd(), 'prisma/migrations')).filter((d) => /^\d{14}_/.test(d)).sort();
  assert.equal(dirs[dirs.length - 3], MIGRATION_DIR, 'the migration before the newest (CRM-01a followed)');
  assert.equal(dirs[dirs.length - 4], '20261103200000_travel_02c_stay_link_living_baselines');
  // CRM-01a (2026-11-07): crm_contacts, the CRM's working table, followed — every pin above moved by one.
  assert.equal(dirs[dirs.length - 2], '20261106150000_crm_01a_crm_contacts', 'right before CRM-02\'s');
  // CRM-02 (2026-11-07): crm_forms and crm_form_submissions, the intake form's two tables, followed — every pin above moved by one more.
  assert.equal(dirs[dirs.length - 1], '20261107212000_crm_02_intake_forms', 'the newest migration');
});

// ── T3 · THE SERVER PAGE ─────────────────────────────────────────────────────

test('T3 the server page: force-dynamic, the one UTC-day expression, ?need= handed down; the client reads no clock', () => {
  const page = code(PAGE);
  assert.match(page, /export const dynamic = 'force-dynamic';/);
  assert.match(page, /const today = new Date\(\)\.toISOString\(\)\.slice\(0, 10\);/, 'the home page\'s own expression (EVENTS-01)');
  assert.match(page, /const params = await searchParams;\s*const need = params\.need;/);
  assert.match(page, /<WorkWithMeForm today=\{today\} initialNeed=\{initialNeed\} \/>/);
  assert.doesNotMatch(page, /'use client'|useState|fetch\(|prisma/);
  const form = code(FORM);
  assert.match(form, /^'use client';/);
  assert.doesNotMatch(form, /new Date\(|Date\.now\(|useSearchParams|process\.env/, 'the client reads no clock and no query — both are props');
});

// ── T4 · THE FORM, RENDERED ──────────────────────────────────────────────────

test('T4 arriving with ?need=close: the chip picked, the offer\'s lines from closeWords, no modules question', () => {
  const html = render(OPEN_DAY, 'close');
  const w = closeWords(CLOSE_OFFER, OPEN_DAY);
  assert.equal(w.state, 'open');
  if (w.state !== 'open') return;
  const picked = chip(html, 'close');
  assert.ok(picked, 'the close chip is rendered');
  assert.equal(picked.className, SEGMENT.item(true), 'picked');
  assert.equal(picked.words, w.choice);
  for (const other of FIVE) assert.equal(chip(html, other)?.className, SEGMENT.item(false), `${other} not picked`);
  const offer = /<div class="[^"]*" data-close-offer="true">([\s\S]*?)<\/div>/.exec(html);
  assert.ok(offer, 'the offer lines are shown');
  const lines = unescape(offer[1]).replace(/<[^>]+>/g, '\n').split('\n').map((s) => s.trim()).filter(Boolean);
  assert.deepEqual(lines, [w.what, w.price, w.bookBy, w.notTax, w.remedy], 'what it is, the price, the book-by day, what it is not, the remedy');
  assert.doesNotMatch(html, /data-modules|Which modules interest you/, 'no modules question for a close');
  assert.match(html, new RegExp(`placeholder="${w.done.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`), 'the done question\'s example is the close\'s');
  assert.match(unescape(html), /Or your 2026 books, closed\. Pick one below/);
  assert.match(html, /<div class="[^"]*">WORK WITH ME<\/div>/);
  assert.doesNotMatch(html, /mailto:/);
});

test('T4 arriving with ?need=setup: setup picked, the modules asked, no offer lines; with a word the form does not offer: nothing picked', () => {
  const setup = render(OPEN_DAY, 'setup');
  assert.equal(chip(setup, 'setup')?.className, SEGMENT.item(true));
  assert.equal(chip(setup, 'close')?.className, SEGMENT.item(false));
  assert.match(setup, /data-modules/);
  assert.doesNotMatch(setup, /data-close-offer/);
  for (const bogus of ['bogus', '', 'Close', 'setup;drop']) {
    const html = render(OPEN_DAY, bogus);
    for (const need of [...FIVE, 'close']) assert.equal(chip(html, need)?.className, SEGMENT.item(false), `"${bogus}": ${need} not picked`);
  }
  const none = render(OPEN_DAY, null);
  for (const need of [...FIVE, 'close']) assert.equal(chip(none, need)?.className, SEGMENT.item(false));
});

test('T4 after the book-by day: no close chip, ?need=close picks nothing, the lead names no close', () => {
  const html = render(CLOSED_DAY, 'close');
  assert.equal(chip(html, 'close'), null, 'no close chip');
  for (const need of FIVE) assert.equal(chip(html, need)?.className, SEGMENT.item(false));
  assert.doesNotMatch(html, /data-close-offer|books, closed/);
  assert.match(html, /data-modules/);
});

test('T4 the form sends no modules for a close, and the Other description does not ride along', () => {
  const form = code(FORM);
  assert.match(form, /modules: isClose \? \[\] : modules,/);
  assert.match(form, /!isClose && modules\.includes\('other'\) && otherModuleText\.trim\(\)/);
  assert.match(form, /\(!isClose && modules\.includes\('other'\) && otherModuleText\.trim\(\) === ''\)/, 'the submit guard too');
  assert.match(form, /const isClose = need === CLOSE_OFFER\.need;/);
});

// ── T5 · THE DOORS ───────────────────────────────────────────────────────────

test('T5 the four DONE-FOR-YOU cards and the close button open the form with their word; the path from the leaf, never typed', () => {
  const landing = code(LANDING);
  assert.match(landing, /import \{ PROPOSAL_FORM_PATH \} from '@\/lib\/offer\/close';/);
  assert.match(landing, /href=\{`\$\{PROPOSAL_FORM_PATH\}\?need=\$\{need\}`\}/, 'each card: the form with its word');
  for (const [need, title] of [['setup', 'Full setup'], ['maintenance', 'Monthly maintenance'], ['custom', 'Custom builds'], ['embed', 'Embed a module']]) {
    assert.match(landing, new RegExp(`\\['${need}', '${title}', `), `${title} → ${need}`);
  }
  assert.match(landing, /href=\{PROPOSAL_FORM_PATH\}/, 'the Send a project proposal button');
  assert.doesNotMatch(landing, /['"`]\/work-with-me['"`?]/, 'the path is never typed in Landing');
  assert.equal(PROPOSAL_FORM_PATH, '/work-with-me');
  const w = closeWords(CLOSE_OFFER, OPEN_DAY);
  assert.ok(w.state === 'open' && w.button.href === '/work-with-me?need=close' && w.button.words === 'Book the 2026 close →');
  assert.doesNotMatch(code(WORDS), /mailto/);
  const list = ['setup', 'maintenance', 'custom', 'embed'];
  assert.deepEqual(list.filter((n) => (PROPOSAL_NEEDS as readonly string[]).includes(n)), list, 'every card\'s word is one the table holds');
});
