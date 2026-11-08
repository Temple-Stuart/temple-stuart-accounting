/**
 * ONE-FORM-01 (Alex, 2026-11-06) — THE ONE PROPOSAL FORM: the 2026 close was booked on /work-with-me, not by
 * email ("all as one proposal form ... since email is wack").
 * SERVICES-01 (Alex, 2026-11-08): THE CLOSE RETIRED — the form's sixth choice, its block, its leaf and its words are
 * gone, and 'close' is no longer accepted on write; the choices are the DONE-FOR-YOU panel's six doors
 * (src/lib/proposalNeeds.ts SERVICES), bookkeeping one of them. What ONE-FORM-01 built and still stands is pinned
 * here, each moved pin dated; the six doors' own rules are services01.test.ts's.
 *
 *   T1 the vocabulary — the six keys typed once (src/lib/proposalNeeds.ts); the route's enum reads them and refuses
 *      the retired 'close'; the form's choices are the six doors on any day; no typed list of needs in the route or
 *      the form;
 *   T2 the migration — ONE-FORM-01's still drops proposals_need_chk by its production name and re-adds it with its
 *      six words, never IF EXISTS (history: SERVICES-01's re-adds it with seven); the schema's `need` names the
 *      CHECK, the seven words and both migrations; the pins on the newest migration moved;
 *   T3 the server page — force-dynamic, `?need=` handed down; no day (SERVICES-01: the close was the day's one
 *      reader); the client reads no clock;
 *   T4 the form, rendered — ?need=setup: setup picked, the modules asked, no bookkeeping block; a word the form does
 *      not offer — 'close' from an old link included — picks nothing; the form sends no modules for bookkeeping;
 *   T5 the doors — the six DONE-FOR-YOU doors open the form with their key; the path from the module, never typed in
 *      Landing.
 * No live call, no database, no clock.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { code, comments } from '../sourceText';
// SERVICES-01 (2026-11-08): the path, the keys and the doors from the one module; the close's leaf and words retired.
import { PROPOSAL_FORM_PATH, PROPOSAL_NEEDS, SERVICES, SERVICE_NEEDS } from '../proposalNeeds';
import { SEGMENT } from '../ds';
import { z } from 'zod';
import WorkWithMeForm, { needChoices } from '@/app/work-with-me/WorkWithMeForm';

Object.assign(globalThis, { React });

const ROUTE = 'src/app/api/proposals/route.ts';
const FORM = 'src/app/work-with-me/WorkWithMeForm.tsx';
const PAGE = 'src/app/work-with-me/page.tsx';
const VOCAB = 'src/lib/proposalNeeds.ts';
const LANDING = 'src/components/landing/Landing.tsx';
const SCHEMA = 'prisma/schema.prisma';
const MIGRATION_DIR = '20261106120000_one_form_01_close_need';
const MIGRATION = `prisma/migrations/${MIGRATION_DIR}/migration.sql`;

/** SERVICES-01 (2026-11-08): the six doors' keys — 'bookkeeping' joined, the close's 'close' retired from the form. */
const SIX = ['setup', 'maintenance', 'custom', 'embed', 'bookkeeping', 'unsure'];

// SERVICES-01 (2026-11-08): the form takes no day — only the door the link names.
const render = (initialNeed: string | null) => renderToStaticMarkup(React.createElement(WorkWithMeForm, { initialNeed }));
const chip = (html: string, need: string) => {
  const m = new RegExp(`<button type="button" class="([^"]*)" data-need="${need}">([^<]*)</button>`).exec(html);
  return m ? { className: m[1], words: m[2] } : null;
};

// ── T1 · THE VOCABULARY ──────────────────────────────────────────────────────

test('T1 six keys, typed once: the doors\' keys; the route\'s enum reads them and refuses the retired \'close\' (SERVICES-01)', () => {
  assert.deepEqual([...SERVICE_NEEDS], SIX);
  // SERVICES-01 (2026-11-08): what the route accepts is the six — 'close' is no longer accepted on write.
  assert.deepEqual([...PROPOSAL_NEEDS], SIX);
  // SERVICES-01 (2026-11-08): SERVICE_NEED_LABELS retired — the chips are the doors' titles.
  assert.deepEqual(SERVICES.map((s) => s.title), ['Full setup', 'Monthly maintenance', 'Custom builds', 'Integration', 'Bookkeeping', 'Something else']);
  const route = code(ROUTE);
  assert.match(route, /need: z\.enum\(PROPOSAL_NEEDS\),/, 'the enum is the vocabulary');
  assert.match(route, /import \{ PROPOSAL_NEEDS \} from '@\/lib\/proposalNeeds';/);
  const need = z.enum(PROPOSAL_NEEDS);
  for (const ok of SIX) assert.equal(need.safeParse(ok).success, true, `${ok} is accepted`);
  for (const bad of ['close', 'bogus', 'Close', '', ' close', 'closed', 'Bookkeeping']) assert.equal(need.safeParse(bad).success, false, `"${bad}" is refused`);
  for (const f of [ROUTE, FORM]) assert.doesNotMatch(code(f), /'setup', 'maintenance'|'close'/, `${f}: no typed list of needs, no typed 'close'`);
  assert.doesNotMatch(code(VOCAB), /^\s*import\b|new Date\(|process\.env|fetch\(/m, 'the vocabulary imports nothing and is pure');
});

test('T1 the form\'s choices: the six doors in the panel\'s order, on any day — needChoices takes no day (SERVICES-01)', () => {
  assert.deepEqual(needChoices(), SERVICES.map(({ need, title }) => ({ value: need, label: title })));
  assert.equal(needChoices.length, 0, 'no day argument');
  for (const n of needChoices()) assert.ok((PROPOSAL_NEEDS as readonly string[]).includes(n.value), `${n.value} is a word the route accepts`);
});

// ── T2 · THE MIGRATION ───────────────────────────────────────────────────────

test('T2 ONE-FORM-01\'s migration still drops proposals_need_chk by its production name and re-adds it with its six words; never IF EXISTS (history — SERVICES-01 re-adds it with seven)', () => {
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

test('T2 the schema\'s need names the CHECK, the seven words (\'close\' legacy) and both migrations; the newest-migration pins moved', () => {
  const schema = comments(SCHEMA);
  // SERVICES-01 (2026-11-08): seven words — 'bookkeeping' added, 'close' kept for the rows the old close door wrote.
  assert.match(schema, /proposals_need_chk\): 'setup' \| 'maintenance' \| 'custom' \| 'embed' \| 'unsure' \| 'bookkeeping' \| 'close' \(legacy\)/);
  assert.match(schema, new RegExp(`prisma/migrations/${MIGRATION_DIR}`));
  assert.match(schema, /prisma\/migrations\/20261108111500_services_01_bookkeeping_need/);
  const dirs = readdirSync(resolve(process.cwd(), 'prisma/migrations')).filter((d) => /^\d{14}_/.test(d)).sort();
  assert.equal(dirs[dirs.length - 5], MIGRATION_DIR, 'the migration before the newest (CRM-01a followed)');
  assert.equal(dirs[dirs.length - 6], '20261103200000_travel_02c_stay_link_living_baselines');
  // CRM-01a (2026-11-07): crm_contacts, the CRM's working table, followed — every pin above moved by one.
  assert.equal(dirs[dirs.length - 4], '20261106150000_crm_01a_crm_contacts', 'right before CRM-02\'s');
  // CRM-02 (2026-11-07): crm_forms and crm_form_submissions, the intake form's two tables, followed — every pin above moved by one more.
  assert.equal(dirs[dirs.length - 3], '20261107212000_crm_02_intake_forms', 'right before SERVICES-01\'s');
  // SERVICES-01 (2026-11-08): proposals_need_chk gains 'bookkeeping' — every pin above moved by one more.
  assert.equal(dirs[dirs.length - 2], '20261108111500_services_01_bookkeeping_need', 'right before CASH-02a\'s');
  // CASH-02a (2026-11-08): travel_expenses gains paid_with — every pin above moved by one more.
  assert.equal(dirs[dirs.length - 1], '20261108120000_cash_02a_paid_with', 'the newest migration');
});

// ── T3 · THE SERVER PAGE ─────────────────────────────────────────────────────

test('T3 the server page: force-dynamic, ?need= handed down, no day — SERVICES-01: it reads no clock and the form takes no today', () => {
  const page = code(PAGE);
  assert.match(page, /export const dynamic = 'force-dynamic';/);
  assert.match(page, /const params = await searchParams;\s*const need = params\.need;/);
  // SERVICES-01 (2026-11-08): the day's one reader was the close — the day and the prop went with it.
  assert.match(page, /<WorkWithMeForm initialNeed=\{initialNeed\} \/>/);
  assert.doesNotMatch(page, /\btoday\b|new Date\(|Date\.now\(/);
  assert.match(comments(PAGE), /It reads no clock\./);
  assert.doesNotMatch(page, /'use client'|useState|fetch\(|prisma/);
  const form = code(FORM);
  assert.match(form, /^'use client';/);
  assert.doesNotMatch(form, /new Date\(|Date\.now\(|useSearchParams|process\.env/, 'the client reads no clock and no query — the query is a prop');
  assert.match(form, /export default function WorkWithMeForm\(\{ initialNeed \}: \{ initialNeed: string \| null \}\)/);
});

// ── T4 · THE FORM, RENDERED ──────────────────────────────────────────────────

test('T4 arriving with ?need=setup: setup picked, the modules asked, no bookkeeping block', () => {
  const setup = render('setup');
  assert.equal(chip(setup, 'setup')?.className, SEGMENT.item(true));
  for (const other of SIX.filter((n) => n !== 'setup')) assert.equal(chip(setup, other)?.className, SEGMENT.item(false), `${other} not picked`);
  assert.match(setup, /data-modules/);
  // SERVICES-01 (2026-11-08): the close block retired; bookkeeping's block shows only when bookkeeping is picked.
  assert.doesNotMatch(setup, /data-bookkeeping-offer|data-close-offer/);
  assert.match(setup, /<div class="[^"]*">WORK WITH ME<\/div>/);
  assert.doesNotMatch(setup, /mailto:/);
});

test('T4 a word the form does not offer picks nothing — SERVICES-01: ?need=close from an old link included; no close chip, nothing mapped', () => {
  for (const word of ['close', 'bogus', '', 'Close', 'setup;drop']) {
    const html = render(word);
    for (const need of SIX) assert.equal(chip(html, need)?.className, SEGMENT.item(false), `"${word}": ${need} not picked`);
    assert.equal(chip(html, 'close'), null, 'no close chip');
    assert.doesNotMatch(html, /data-close-offer|data-bookkeeping-offer|books, closed/);
    assert.match(html, /data-modules/, 'nothing picked — the modules are asked');
  }
  const none = render(null);
  for (const need of SIX) assert.equal(chip(none, need)?.className, SEGMENT.item(false));
});

test('T4 the form sends no modules for bookkeeping, and the Other description does not ride along (SERVICES-01: the close\'s rule, kept for bookkeeping)', () => {
  const form = code(FORM);
  assert.match(form, /modules: isBookkeeping \? \[\] : modules,/);
  assert.match(form, /!isBookkeeping && modules\.includes\('other'\) && otherModuleText\.trim\(\)/);
  assert.match(form, /\(!isBookkeeping && modules\.includes\('other'\) && otherModuleText\.trim\(\) === ''\)/, 'the submit guard too');
  assert.match(form, /const isBookkeeping = need === 'bookkeeping';/);
  assert.doesNotMatch(form, /isClose|CLOSE_OFFER|closeWords/);
});

// ── T5 · THE DOORS ───────────────────────────────────────────────────────────

test('T5 the six DONE-FOR-YOU doors open the form with their key; the path from the module, never typed (SERVICES-01: the close card retired)', () => {
  const landing = code(LANDING);
  // SERVICES-01 (2026-11-08): the path moved from the retired leaf to src/lib/proposalNeeds.ts, beside the doors.
  assert.match(landing, /import \{\n {2}PROPOSAL_FORM_PATH, SERVICES,\n\} from '@\/lib\/proposalNeeds';/);
  assert.match(landing, /\{SERVICES\.map\(\(\{ need, title, line \}\) => \(/, 'the doors from the module — none typed');
  assert.match(landing, /href=\{`\$\{PROPOSAL_FORM_PATH\}\?need=\$\{need\}`\}/, 'each door: the form with its key');
  assert.match(landing, /href=\{PROPOSAL_FORM_PATH\}/, 'the Send a project proposal button');
  assert.doesNotMatch(landing, /['"`]\/work-with-me['"`?]/, 'the path is never typed in Landing');
  assert.equal(PROPOSAL_FORM_PATH, '/work-with-me');
  assert.doesNotMatch(landing, /CloseOffer|closeFormHref|offer\/close/);
  assert.ok(!existsSync(resolve(process.cwd(), 'src/components/landing/CloseOfferCard.tsx')), 'the close card retired');
  assert.deepEqual(SERVICES.map((s) => s.need).filter((n) => (PROPOSAL_NEEDS as readonly string[]).includes(n)), SIX, 'every door\'s key is one the route accepts');
});
