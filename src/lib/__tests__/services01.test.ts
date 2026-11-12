/**
 * SERVICES-01 (Alex, 2026-11-08 11:00 + 11:15) — SIX EQUAL DOORS on DONE-FOR-YOU: Full setup · Monthly maintenance ·
 * Custom builds · Integration · Bookkeeping · Something else. The 2026 close retired everywhere (its card, its leaf, its
 * words, its law, the form's close block); bookkeeping is a service billed monthly, priced by proposal; ONE module —
 * src/lib/proposalNeeds.ts — holds every door's key and words, read by the panel, the form, the route and the CRM. This
 * file replaces close01.test.ts (git rm'd with the close); what still meant something there moved here.
 *
 *   T1 the module — SERVICES exactly the six in order with the ruled words; the keys; PROPOSAL_NEEDS the six; the
 *      legacy title; the path; the lead; BOOKKEEPING_WORDS (notTax and remedy verbatim from the retired closeWords);
 *      SERVICE_NEED_LABELS retired; pure; no fixed price and no sales tone anywhere in its words;
 *   T2 the law — the live module passes, alone and over every migration; it refuses by name a duplicate key, an
 *      upper-case key, an empty title, a `$1` in a line, a CHECK word list that differs from the module, a missing
 *      CHECK, and a newer CHECK it cannot read (never a fallback to an older one); the LAST migration by directory
 *      order and the last ADD in it win, comments stripped and strings kept whole; it throws by name by default;
 *   T3 the migration — the newest; the two ALTERs exactly, the seven words; nothing else; authored, not applied;
 *      'close' kept; the schema's `need` comment; ONE-FORM-01's migration untouched;
 *   T4 the panel — Landing maps SERVICES once inside the DONE-FOR-YOU card, in the ruled grid; no typed door, no typed
 *      line under the chip, no close card, no "2026 close" in its code; the pillar's heading and paragraph (HOME-FINISH-02,
 *      2026-11-10: "Build Your Income." and Alex's words — the label PROFESSIONAL SERVICES and the h2 "Need help? Send a
 *      proposal." until then) and the one button stand, and the chip
 *      that repeated the label is gone (HOME-BRIEF-04, 2026-11-10 — it stood, untouched, until then); the
 *      act list's line; :1807 still s08; the pins that stay (moved from close01). HOME-SERVICES-01 (Alex's brief, 2026-11-12): the
 *      panel is the Professional Services section's own component, src/components/landing/ServicesSection.tsx — the six doors are tiles
 *      that pick, the gold link carries the pick, his paragraph is replaced by one line — and T4 reads it there; each rewritten
 *      assertion keeps its old form in a dated note;
 *   T5 the form — needChoices() the six; Bookkeeping picked: the three lines in order, no modules question, the done
 *      placeholder; the lead; ?need=close picks nothing; the honeypot still at :371-380 (cited there by number);
 *   T6 the route — need z.enum(PROPOSAL_NEEDS): each of the six accepted, 'close' refused with an issue naming need;
 *      the comment re-said; the lines other files cite by number unmoved; its public-writer entry unchanged;
 *   T7 the CRM — needWords for the six and the legacy 'close'; a stranger throws by name;
 *   T8 the law script — :159-160 and :710 in place, the services law between the experiences and the trip log laws
 *      (HOME-FINISH-01, 2026-11-08: no whole-file line count — new laws land at its END by rule); the close retired:
 *      no code in src or scripts reads its symbols;
 *   T9 README's "Work with me" (HOME-FINISH-01, 2026-11-08) — the six doors from SERVICES, title and line, in order;
 *      the form's link; no mailto.
 * No live call, no database, no clock.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { z } from 'zod';
import { code, comments, rejoin } from '../sourceText';
import * as vocabulary from '../proposalNeeds';
import {
  BOOKKEEPING_WORDS, FORM_INTRO, LEGACY_NEED_TITLES, PROPOSAL_CTA, PROPOSAL_FORM_PATH, PROPOSAL_NEEDS, SCOPED_BY_PROPOSAL, SERVICES, SERVICE_NEEDS, ServicesLawError,
  needCheckWords, servicesLaw, sqlCode, type Service,
} from '../proposalNeeds';
import { CrmLawError, needWords } from '../crm/crm';
import { SEGMENT } from '../ds';
import { BUILD_PILLAR } from '../homeActWords';
import WorkWithMeForm, { needChoices } from '@/app/work-with-me/WorkWithMeForm';

Object.assign(globalThis, { React });

const VOCAB = 'src/lib/proposalNeeds.ts';
const LANDING = 'src/components/landing/Landing.tsx';
const DECK = 'src/components/landing/PipelineDeck.tsx'; // PIPELINE-PAGE-01 (2026-11-09): the deck's own file — the 14 steps moved there whole from Landing.tsx
const FORM = 'src/app/work-with-me/WorkWithMeForm.tsx';
const PAGE = 'src/app/work-with-me/page.tsx';
const ROUTE = 'src/app/api/proposals/route.ts';
const RULES = 'src/lib/crm/crm.ts';
const LAW = 'scripts/assert-tool-registry.ts';
const SCHEMA = 'prisma/schema.prisma';
const MIGRATION_DIR = '20261108111500_services_01_bookkeeping_need';
const MIGRATION = `prisma/migrations/${MIGRATION_DIR}/migration.sql`;
const ONE_FORM_MIGRATION = 'prisma/migrations/20261106120000_one_form_01_close_need/migration.sql';

/** CLOSED 1, verbatim — Alex is the voice. */
const SIX: ReadonlyArray<Service> = [
  { need: 'setup', title: 'Full setup', line: 'Your own hosted copy, every API wired, you own everything.' },
  { need: 'maintenance', title: 'Monthly maintenance', line: 'I keep it updated and running.' },
  { need: 'custom', title: 'Custom builds', line: 'Need a feature? I build it.' },
  { need: 'embed', title: 'Integration', line: 'One piece of this system (the booking engine, the books, the scanner) wired into the system you already run.' },
  { need: 'bookkeeping', title: 'Bookkeeping', line: 'Fell behind, or need a bookkeeper? Catch-up and monthly bookkeeping, billed monthly — the price follows your volume.' },
  { need: 'unsure', title: 'Something else', line: 'Out of scope, or not sure which fits? Tell me what you need.' },
];
const KEYS = SIX.map((s) => s.need);
/** The retired closeWords' two lines, as they stood on main at 8099fe5 — BOOKKEEPING_WORDS carries them verbatim. */
const CLOSE_NOT_TAX = "Bookkeeping, not tax filing or tax advice. I have six years in accounting and I'm a CPA candidate, not a licensed CPA.";
const CLOSE_REMEDY = 'If a month I closed has to be reopened because of my error, I correct it at no charge.';
const BANNED: Array<[RegExp, string]> = [
  [/\bfree\b/i, '"free"'], [/buy now/i, '"BUY NOW"'], [/don['’]t miss/i, '"don\'t miss"'], [/countdown|days left|hours left/i, 'a countdown'],
  [/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u, 'an emoji'],
];
/** code() blanks a JSX comment's words and keeps its braces — the guest law's own allowance. */
const ONLY_COMMENTS = /^\s*(\{\s*\}\s*)*$/;

/** Every migration as the build hands it to the law: each prisma/migrations/<dir>/migration.sql, its two halves rejoined. */
const allMigrations = () => readdirSync(resolve(process.cwd(), 'prisma/migrations')).sort()
  .filter((d) => existsSync(resolve(process.cwd(), 'prisma/migrations', d, 'migration.sql')))
  .map((d) => ({ dir: d, sql: rejoin(code(`prisma/migrations/${d}/migration.sql`), comments(`prisma/migrations/${d}/migration.sql`)) }));
const checkSql = (dir: string, words: readonly string[]) => ({
  dir,
  sql: `ALTER TABLE "proposals" DROP CONSTRAINT "proposals_need_chk";\nALTER TABLE "proposals" ADD CONSTRAINT "proposals_need_chk"\n  CHECK ("need" IN (${words.map((w) => `'${w}'`).join(', ')}));\n`,
});
const refuses = (opts: Parameters<typeof servicesLaw>[0], words: string) => {
  const v = servicesLaw({ ...opts, throwOnFail: false });
  assert.ok(v.some((line) => line.includes(words)), `expected a violation naming "${words}", got [${v.join(' | ')}]`);
};
const render = (initialNeed: string | null) => renderToStaticMarkup(React.createElement(WorkWithMeForm, { initialNeed }));
const chip = (html: string, need: string) => {
  const m = new RegExp(`<button type="button" class="([^"]*)" data-need="${need}">([^<]*)</button>`).exec(html);
  return m ? { className: m[1], words: m[2] } : null;
};
const unescape = (s: string) => s.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ── T1 · THE MODULE ──────────────────────────────────────────────────────────

test('T1 SERVICES is exactly the six doors in order, with the ruled words; the keys, PROPOSAL_NEEDS, the legacy title, the path and the lead', () => {
  // HOME-SERVICES-01 (Alex's brief, 2026-11-12; ruling c: "THE DOORS ARE SERVICES'. Titles, lines and order unchanged. Each door gains a kind:
  // Project (setup, custom, embed), Monthly (maintenance, bookkeeping), none (unsure)."): each door carries its kind beside its words, so the
  // six are held by key, title and line — unchanged — and by kind. Until then: assert.deepEqual(SERVICES.map((s) => ({ ...s })), SIX).
  assert.deepEqual(SERVICES.map(({ need, title, line }) => ({ need, title, line })), SIX, 'titles, lines and order unchanged (ruling c)');
  assert.deepEqual(SERVICES.map((s) => [s.need, s.kind]), [['setup', 'Project'], ['maintenance', 'Monthly'], ['custom', 'Project'], ['embed', 'Project'], ['bookkeeping', 'Monthly'], ['unsure', null]], 'each door\'s kind — none for unsure (ruling c)');
  assert.deepEqual(SERVICES.map((s) => Object.keys(s)), SIX.map(() => ['need', 'title', 'line', 'kind']), 'a door is its key, its words and its kind — nothing else');
  assert.deepEqual([...SERVICE_NEEDS], KEYS, 'the keys, in the doors\' order');
  assert.deepEqual([...PROPOSAL_NEEDS], KEYS, 'what the route accepts: the six — \'close\' is not one');
  assert.ok(!(PROPOSAL_NEEDS as readonly string[]).includes('close'));
  assert.deepEqual(LEGACY_NEED_TITLES, { close: 'Close my 2026 books (the old close door)' });
  assert.equal(PROPOSAL_FORM_PATH, '/work-with-me');
  assert.equal(FORM_INTRO, 'Pick what fits below and tell me about your business.');
  assert.ok(!('SERVICE_NEED_LABELS' in vocabulary), 'SERVICE_NEED_LABELS retired — no reader needs a Record of the titles');
  assert.doesNotMatch(code(VOCAB), /SERVICE_NEED_LABELS/);
  assert.match(comments(VOCAB), /SERVICE_NEED_LABELS RETIRED \(SERVICES-01, 2026-11-08\)/, 'the module says where it went');
});

test('T1 BOOKKEEPING_WORDS: what it is, what it is not and the remedy (the last two verbatim from the retired closeWords), the done example', () => {
  assert.deepEqual({ ...BOOKKEEPING_WORDS }, {
    what: 'Catch-up on the months you fell behind, or monthly bookkeeping going forward: every bank and card account reconciled, every transaction categorized, and the statements whoever files your taxes needs.',
    notTax: CLOSE_NOT_TAX,
    remedy: CLOSE_REMEDY,
    done: 'e.g. 3 bank and card accounts, about 400 transactions a month, books current through March — caught up, then kept every month.',
  });
});

test('T1 the module is pure — no import, no clock, no env, no network — and its words carry no fixed price and no sales tone', () => {
  const src = code(VOCAB);
  assert.doesNotMatch(src, /^\s*import\b/m, 'no import');
  assert.doesNotMatch(src, /new Date\(|Date\.now\(|process\.env|fetch\(|from 'react'/);
  const words = [...SERVICES.flatMap((s) => [s.title, s.line]), ...Object.values(LEGACY_NEED_TITLES), ...Object.values(BOOKKEEPING_WORDS), FORM_INTRO];
  for (const w of words) {
    assert.doesNotMatch(w, /\$\s*\d/, `no fixed price: "${w}"`);
    for (const [re, what] of BANNED) assert.doesNotMatch(w, re, `no ${what}: "${w}"`);
  }
  assert.match(comments(VOCAB), /PURE: no import, no fetch, no env, no clock, no React/);
});

// ── T2 · THE LAW ─────────────────────────────────────────────────────────────

test('T2 the live module passes the law — alone (module scope) and over every migration (the build); the CHECK it reads is SERVICES-01\'s', () => {
  assert.deepEqual(servicesLaw({ throwOnFail: false }), []);
  const migrations = allMigrations();
  assert.deepEqual(servicesLaw({ throwOnFail: false, migrations }), []);
  assert.deepEqual(needCheckWords(migrations), { dir: MIGRATION_DIR, words: ['setup', 'maintenance', 'custom', 'embed', 'unsure', 'bookkeeping', 'close'] }, 'the LAST migration that adds proposals_need_chk');
  assert.doesNotThrow(() => servicesLaw());
});

test('T2 every refusal by name: a duplicate key, an upper-case key, an empty title, an empty line, a $1 in a line or a bookkeeping word, a legacy key that is a door', () => {
  refuses({ services: [...SIX, { need: 'setup', title: 'Again', line: 'Twice.' }] }, 'the key "setup" is held twice');
  refuses({ services: SIX.map((s, i) => (i === 0 ? { ...s, need: 'Setup' } : s)) }, 'the key "Setup" is not lower-case letters');
  refuses({ services: SIX.map((s, i) => (i === 2 ? { ...s, need: 'custom-build' } : s)) }, 'the key "custom-build" is not lower-case letters');
  refuses({ services: SIX.map((s, i) => (i === 3 ? { ...s, title: '  ' } : s)) }, 'the door "embed" has no title');
  refuses({ services: SIX.map((s, i) => (i === 1 ? { ...s, line: '' } : s)) }, 'the door "maintenance" has no line');
  refuses({ services: SIX.map((s, i) => (i === 4 ? { ...s, line: 'Bookkeeping from $1 a month.' } : s)) }, 'the door "bookkeeping"\'s line carries a fixed price');
  refuses({ services: SIX.map((s, i) => (i === 0 ? { ...s, title: 'Setup — $ 150' } : s)) }, 'the door "setup"\'s title carries a fixed price');
  refuses({ bookkeeping: { ...BOOKKEEPING_WORDS, what: 'Monthly books for $150.' } }, 'BOOKKEEPING_WORDS.what carries a fixed price');
  refuses({ legacy: { setup: 'Old setup' } }, 'the key "setup" is held twice');
  refuses({ legacy: { close: '' } }, 'the legacy key "close" has no title');
});

test('T2 the CHECK: a word list that differs from the module is refused by name — a word missing, a word extra, a word twice, the legacy word dropped; no CHECK at all is refused', () => {
  const seven = [...KEYS.slice(0, 4), 'unsure', 'bookkeeping', 'close'];
  assert.deepEqual(servicesLaw({ throwOnFail: false, migrations: [checkSql('a', seven)] }), [], 'the same words in another order pass');
  refuses({ migrations: [checkSql('a', seven.filter((w) => w !== 'bookkeeping'))] }, '— missing bookkeeping');
  refuses({ migrations: [checkSql('a', [...seven, 'retainer'])] }, '— not in the module: retainer');
  refuses({ migrations: [checkSql('a', [...seven, 'setup'])] }, '— twice: setup');
  refuses({ migrations: [checkSql('a', seven.filter((w) => w !== 'close'))] }, '— missing close');
  refuses({ migrations: [{ dir: 'a', sql: 'SELECT 1;' }] }, 'no migration adds proposals_need_chk');
  refuses({ migrations: [] }, 'no migration adds proposals_need_chk');
});

test('T2 how the law finds the file: the LAST migration by directory order that adds proposals_need_chk, the caller\'s order not trusted, comments stripped', () => {
  const seven = ['setup', 'maintenance', 'custom', 'embed', 'unsure', 'bookkeeping', 'close'];
  const older = checkSql('20261106120000_old', ['setup', 'maintenance', 'custom', 'embed', 'unsure', 'close']);
  const newer = checkSql('20261108111500_new', seven);
  for (const order of [[older, newer], [newer, older]]) {
    assert.deepEqual(needCheckWords(order), { dir: '20261108111500_new', words: seven });
    assert.deepEqual(servicesLaw({ throwOnFail: false, migrations: order }), []);
  }
  const quoted = { dir: '20261109000000_comment', sql: `-- ALTER TABLE "proposals" ADD CONSTRAINT "proposals_need_chk" CHECK ("need" IN ('only'));\nSELECT 1;\n` };
  assert.deepEqual(needCheckWords([older, newer, quoted])?.dir, '20261108111500_new', 'a comment that quotes the DDL is not the DDL');
  assert.equal(needCheckWords([quoted]), null);
  // the real tree: ONE-FORM-01's six words are older; SERVICES-01's seven are the last
  const real = allMigrations();
  const adding = real.filter((m) => /ADD CONSTRAINT "proposals_need_chk"/.test(code(`prisma/migrations/${m.dir}/migration.sql`))).map((m) => m.dir);
  assert.deepEqual(adding, ['20261106120000_one_form_01_close_need', MIGRATION_DIR], 'two migrations add the CHECK; the law reads the last');
});

test('T2 the CHECK in force, never a fallback: a newer ADD the law cannot read is refused by name; the last ADD in a file wins; comments and strings read right', () => {
  const seven = ['setup', 'maintenance', 'custom', 'embed', 'unsure', 'bookkeeping', 'close'];
  const older = checkSql('20261108111500_services', seven);
  // a newer migration that writes the CHECK in another shape: refused by name — the older readable one is not used instead
  const anyShape = { dir: '20261201000000_need_any', sql: 'ALTER TABLE "proposals" DROP CONSTRAINT "proposals_need_chk";\nALTER TABLE "proposals" ADD CONSTRAINT "proposals_need_chk" CHECK (("need")::text = ANY ((ARRAY[\'setup\'::character varying])::text[]));\n' };
  assert.deepEqual(needCheckWords([older, anyShape]), { dir: '20261201000000_need_any', words: null });
  refuses({ migrations: [older, anyShape] }, 'services: 20261201000000_need_any adds proposals_need_chk in a shape the law cannot read');
  const lower = { dir: '20261201000000_lower', sql: "alter table proposals add constraint proposals_need_chk check (need in ('setup'));\n" };
  assert.deepEqual(needCheckWords([older, lower]), { dir: '20261201000000_lower', words: ['setup'] }, 'any case, quoted or not');
  refuses({ migrations: [older, lower] }, 'services: proposals_need_chk (20261201000000_lower) holds [setup]; the module holds [setup, maintenance, custom, embed, bookkeeping, unsure, close] — missing bookkeeping, close, custom, embed, maintenance, unsure');
  // two ADDs in one file: the last is the one in force
  const twice = { dir: '20261201000000_twice', sql: `${checkSql('x', ['setup']).sql}${checkSql('x', seven).sql}` };
  assert.deepEqual(needCheckWords([twice])?.words, seven);
  const thenUnreadable = { dir: '20261201000000_then_any', sql: `${checkSql('x', seven).sql}${anyShape.sql}` };
  assert.deepEqual(needCheckWords([thenUnreadable]), { dir: '20261201000000_then_any', words: null }, 'an unreadable last ADD is refused, not read past');
  const thenReadable = { dir: '20261201000000_then_in', sql: `${anyShape.sql}${checkSql('x', seven).sql}` };
  assert.deepEqual(needCheckWords([thenReadable])?.words, seven, 'a readable last ADD after an unreadable one is the one in force');
  // comments are not DDL — a block comment, a line comment after an E-string escape; a doubled quote stays inside its string
  const block = { dir: '20261201000000_block', sql: `/* ALTER TABLE "proposals" ADD CONSTRAINT "proposals_need_chk" CHECK ("need" IN ('only')); */\nSELECT 1;\n` };
  const eString = { dir: '20261201000000_estring', sql: `SELECT E'it\\'s';\n-- ALTER TABLE "proposals" ADD CONSTRAINT "proposals_need_chk" CHECK ("need" IN ('only'));\n` };
  const doubled = { dir: '20261201000000_doubled', sql: `SELECT 'it''s -- not a comment';\n-- ADD CONSTRAINT "proposals_need_chk" CHECK ("need" IN ('only'))\n` };
  for (const m of [block, eString, doubled]) assert.equal(needCheckWords([older, m])?.dir, '20261108111500_services', `${m.dir}: a comment is not the DDL`);
  assert.equal(sqlCode("SELECT 'a -- b';"), "SELECT 'a -- b';", 'a quoted -- is not a comment');
  assert.equal(sqlCode('a /* x\ny */ b'), 'a     \n     b', 'a block comment is blanked character for character, its newline kept');
});

test('T2 the law throws by name by default, and runs at module scope', () => {
  assert.throws(() => servicesLaw({ services: [{ need: 'X', title: '', line: '' }] }), (e: unknown) => e instanceof ServicesLawError && e.name === 'ServicesLawError' && /^SERVICES LAW failed:\n {2}services: /.test(e.message));
  assert.match(code(VOCAB), /\nservicesLaw\(\);\s*$/, 'the module\'s last statement');
});

// ── T3 · THE MIGRATION ───────────────────────────────────────────────────────

test('T3 the migration: the newest; drops proposals_need_chk by its production name and re-adds it with the seven words — nothing else; never IF EXISTS', () => {
  const dirs = readdirSync(resolve(process.cwd(), 'prisma/migrations')).filter((d) => /^\d{14}_/.test(d)).sort();
  // CASH-02a (2026-11-08): travel_expenses gains paid_with — the newest now; every pin below moved by one more.
  assert.equal(dirs[dirs.length - 1], '20261108120000_cash_02a_paid_with', 'the newest migration');
  assert.equal(dirs[dirs.length - 2], MIGRATION_DIR, 'right before CASH-02a\'s');
  assert.equal(dirs[dirs.length - 3], '20261107212000_crm_02_intake_forms', 'right after CRM-02\'s');
  const sql = code(MIGRATION);
  assert.equal(
    sql.trim(),
    `ALTER TABLE "proposals" DROP CONSTRAINT "proposals_need_chk";\nALTER TABLE "proposals" ADD CONSTRAINT "proposals_need_chk"\n  CHECK ("need" IN ('setup', 'maintenance', 'custom', 'embed', 'unsure', 'bookkeeping', 'close'));`,
    'exactly the ruled DDL',
  );
  assert.doesNotMatch(sql, /IF EXISTS|UPDATE|DELETE|INSERT|SELECT|ADD COLUMN|DROP COLUMN|TRUNCATE/i, 'the CHECK and nothing else — no row is read, updated or deleted');
  const notes = comments(MIGRATION);
  assert.match(notes, /^-- SERVICES-01 \(Alex, 2026-11-08 11:00 \+ 11:15\)/);
  assert.match(notes, /AUTHORED, NOT APPLIED/);
  assert.match(notes, /No existing row\s*\n?--\s*is read, updated or deleted; no column changes; the old 'close' rows keep their word\./);
  assert.match(notes, /'close' IS KEPT\./);
});

test('T3 the schema\'s need comment lists the seven words, \'close\' legacy, and names both migrations; ONE-FORM-01\'s migration is untouched history', () => {
  const schema = comments(SCHEMA);
  assert.match(schema, /proposals_need_chk\): 'setup' \| 'maintenance' \| 'custom' \| 'embed' \| 'unsure' \| 'bookkeeping' \| 'close' \(legacy\) — SERVICES-01 \(2026-11-08\) added 'bookkeeping'/);
  assert.match(schema, new RegExp(`prisma/migrations/${MIGRATION_DIR}`));
  assert.match(schema, /prisma\/migrations\/20261106120000_one_form_01_close_need/);
  assert.match(code(ONE_FORM_MIGRATION), /CHECK \("need" IN \('setup', 'maintenance', 'custom', 'embed', 'unsure', 'close'\)\);/, 'the six words it set stand in its file');
  assert.match(code(SCHEMA), /need {11}String {4}@db\.VarChar\(20\)/, 'VARCHAR(20) holds "bookkeeping" (11 characters)');
  assert.ok('bookkeeping'.length <= 20);
});

// ── T4 · THE PANEL ───────────────────────────────────────────────────────────

/**
 * HOME-FINISH-02 (Alex, 2026-11-10 20:56): the section opens at the pillar's h2 — "Build Your Income." — and the panel is found from it. Until
 * then it was found from the label: SERVICES_LABEL = 'text-text-faint">\n            PROFESSIONAL SERVICES\n' (HOME-BRIEF-03, Alex, 2026-11-10:
 * the section's label reads PROFESSIONAL SERVICES — 'DONE-FOR-YOU\n' until then. Found with the end of its own <p>: the card's chip said the same
 * words until HOME-BRIEF-04 (2026-11-10) took the chip out).
 * HOME-SERVICES-01 (Alex's brief, 2026-11-12 15:16 Manila; the board approved on the design canvas at 15:41): the section is its own component —
 * src/components/landing/ServicesSection.tsx, which Landing.tsx mounts — drawn as design-refs/home-services-01/Section-Reference.html draws it, the
 * reference's classes behind the house prefix; the panel is found there, from the pillar's h2 in the reference's class and id. Until then, of
 * Landing.tsx: PILLAR_HEAD = '<h2 className="text-2xl sm:text-3xl font-medium tracking-tight text-brand-purple">{BUILD_PILLAR.heading}</h2>'.
 * These T4 tests hold what SERVICES-01 ruled of the doors; homeServices01.test.ts holds the section to the reference, token for token.
 */
const SECTION = 'src/components/landing/ServicesSection.tsx';
const PILLAR_HEAD = '<h2 className="ts-ps__title" id="ps-title">{BUILD_PILLAR.heading}</h2>';
/** The panel: the section's code from the pillar's h2 to its </section> — asserted found, so no check below passes on nothing. */
const panelOf = (section: string): string => {
  const head = section.indexOf(PILLAR_HEAD);
  assert.ok(head > -1, 'the pillar\'s heading, in the section');
  const panel = section.slice(head, section.indexOf('</section>', head));
  assert.ok(panel.length > PILLAR_HEAD.length, 'the panel is found');
  return panel;
};

test('T4 the section maps SERVICES once, in the panel\'s tile group; each door a tile that picks it and carries data-done-for-you (HOME-SERVICES-01, 2026-11-12: six equal Link cards in a white card until then)', () => {
  const landing = code(LANDING);
  const section = code(SECTION);
  // HOME-SERVICES-01 (2026-11-12): the heading is the section's, found there. Until then: const head = landing.indexOf(PILLAR_HEAD);
  // assert.ok(head > -1); assert.equal(landing.split(PILLAR_HEAD).length - 1, 1, 'the pillar\'s heading once (the eyebrow, until HOME-FINISH-02)').
  assert.equal(section.split(PILLAR_HEAD).length - 1, 1, 'the pillar\'s heading once');
  assert.equal(landing.split('BUILD_PILLAR').length - 1, 0, 'Landing.tsx draws the pillar nowhere — it mounts the section');
  for (const src of [landing, section]) assert.ok(!src.includes('DONE-FOR-YOU\n'), 'the old label is rendered nowhere');
  const panel = panelOf(section);
  // HOME-SERVICES-01 (2026-11-12): the section reads the doors and their words from the one module, and Landing.tsx reads none of it. Until
  // then: assert.match(landing, /import \{\n {2}PROPOSAL_FORM_PATH, SERVICES,\n\} from '@\/lib\/proposalNeeds';/).
  assert.doesNotMatch(landing, /from '@\/lib\/proposalNeeds'/, 'Landing.tsx imports nothing of the doors');
  assert.match(section, /^import \{\n {2}NEED_QUESTION, PROPOSAL_CTA, PROPOSAL_STEPS, SCOPED_BY_PROPOSAL, SERVICES, SERVICE_NEEDS,\n {2}formAsks, proposalFormHref, serviceDoor, servicePictureSrc, type ServiceNeed,\n\} from '@\/lib\/proposalNeeds';$/m, 'the section reads the doors from the one module');
  // HOME-SERVICES-01 (2026-11-12): mapped in the section, and nowhere in Landing.tsx. Until then: assert.equal((landing.match(/SERVICES\.map\(/g)
  // ?? []).length, 1, 'SERVICES mapped once').
  assert.equal((section.match(/SERVICES\.map\(/g) ?? []).length, 1, 'SERVICES mapped once — the tiles');
  assert.equal((landing.match(/SERVICES\.map\(/g) ?? []).length, 0, 'and nowhere in Landing.tsx');
  // HOME-SERVICES-01 (2026-11-12): each door is a tile — a button in the group the question labels, saying whether it is picked (README: "the
  // form's own single-pick idiom, with its state said"), carrying data-done-for-you (ruling h: "data-done-for-you={need} moves to the tiles.").
  // Until then (HOME-FINISH-01, 2026-11-08: auto-rows-fr — every row as tall as the tallest): assert.match(panel, /<div className="mt-4 grid
  // auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-3">\n {16}\{SERVICES\.map\(\(\{ need, title, line \}\) => \(\n {18}<Link key=\{need\}
  // href=\{`\$\{PROPOSAL_FORM_PATH\}\?need=\$\{need\}`\} className="rounded-lg border border-border bg-white p-4 text-text-primary
  // hover:bg-brand-purple-wash" data-done-for-you=\{need\}>\n {20}<div className="text-sm font-medium">\{title\}<\/div>\n {20}<p className="mt-1
  // text-xs text-text-muted">\{line\}<\/p>\n {18}<\/Link>\n {16}\)\)\}\n {14}<\/div>/); the white card ('<div className="mt-4 rounded-lg border
  // border-border bg-white p-5">') before SERVICES.map(; one grid. Every row as tall as the tallest is the port's rule now.
  assert.match(panel, /<div className="ts-ps-tiles" role="group" aria-labelledby="ps-question">\n {12}\{SERVICES\.map\(\(\{ need, title, kind \}\) => \(\n {14}<button key=\{need\} className="ts-ps-tile" type="button" aria-pressed=\{need === picked\} data-done-for-you=\{need\} onClick=\{\(\) => onPick\(need\)\}>\n {16}<TileIcon need=\{need\} \/><span className="ts-ps-tile__words"><span className="ts-ps-tile__title">\{title\}<\/span><span className="ts-ps-tile__kind">\{kind\}<\/span><\/span>\n {14}<\/button>\n {12}\)\)\}\n {10}<\/div>/, 'the group the question labels; each door a tile that picks it and says so; data-done-for-you on the tile');
  const box = panel.indexOf('<div className="ts-ps-panel">');
  assert.ok(box > -1 && box < panel.indexOf('SERVICES.map('), 'the tiles inside the panel');
  assert.equal((panel.match(/className="ts-ps-tiles"/g) ?? []).length, 1, 'one tile group');
  assert.match(code('src/app/globals.css'), /\n\.ts-ps-tiles \{[^}]*grid-auto-rows: 1fr;/, 'every row as tall as the tallest — the port\'s rule');
});

test('T4 nothing typed: no door\'s title or line, no line under the chip, no close card, no CloseOffer*, no "2026 close" — in Landing\'s code or the section\'s', () => {
  const landing = code(LANDING);
  const section = code(SECTION);
  const panel = panelOf(section);
  // HOME-SERVICES-01 (2026-11-12): the panel is the section's, found or the test fails (panelOf). Until then the same check ran over Landing's
  // panel, found from the old PILLAR_HEAD with no check that it was found.
  for (const s of SIX) {
    assert.ok(!panel.includes(s.title), `no typed title "${s.title}" in the panel`);
    for (const src of [landing, section]) assert.ok(!src.includes(s.line), `no typed line for ${s.need}`);
  }
  for (const src of [landing, section]) assert.ok(!src.includes('Your own hosted copy — every API wired, custom to your business, you own everything.'), 'the line under the chip went');
  // HOME-SERVICES-01 (2026-11-12): Landing.tsx's check stands as it was. The section's own leaves out ServiceNeed\b: ServiceNeed is the type of
  // the section's pick (ruling a: the picked door in React state), and what went is the typed tuple array.
  assert.doesNotMatch(landing, /Embed a module|ServiceNeed\b|as const satisfies ReadonlyArray<readonly \[ServiceNeed/, 'the typed tuple array went');
  assert.doesNotMatch(section, /Embed a module|as const satisfies ReadonlyArray<readonly \[ServiceNeed/, 'and the section types none');
  for (const src of [landing, section]) {
    assert.doesNotMatch(src, /CloseOffer|closeWords|closeFormHref|CLOSE_ANCHOR|offer\/close|data-close|id="close"/);
    assert.doesNotMatch(src, /2026 close|THE 2026 CLOSE/i, 'no "2026 close" in the code — comments may tell the history');
  }
  assert.ok(!existsSync(resolve(process.cwd(), 'src/components/landing/CloseOfferCard.tsx')));
  assert.match(comments(LANDING), /SERVICES-01 \(Alex, 2026-11-08\): SIX EQUAL\n\s+DOORS/, 'the ONE-FORM-01 comment re-said, dated');
});

test('T4 the pillar\'s heading and its one line stand over the panel (HOME-SERVICES-01, 2026-11-12: his paragraph until then); the gold link to the form with the pick, and the note beside it; the chip is gone; the panel holds no other link', () => {
  const landing = code(LANDING);
  const section = code(SECTION);
  const panel = panelOf(section);
  const head = section.indexOf(PILLAR_HEAD);
  // HOME-FINISH-02 (Alex, 2026-11-10 20:56): "Purple title → Approved description → Existing functionality … No additional promotional headings or
  // explanatory paragraphs between these elements." Until then this line held 'the h2, untouched':
  // <h2 className="mt-3 text-2xl sm:text-3xl font-medium tracking-tight text-brand-purple"> reading "Need help? Send a proposal.", under the label.
  // HOME-SERVICES-01 (Alex's brief, 2026-11-12; ruling b: "THE PARAGRAPH IS REPLACED. BUILD_PILLAR.paragraphs holds the one new line, "Hands-on
  // services, tailored to your needs."; his paragraph is quoted, dated, in the leaf's note. HOME-FINISH-02's "Approved description" is this line
  // now."): the heading → the one line → the panel, nothing between, in the reference's classes. Until then: assert.ok(panel.startsWith(
  // `${PILLAR_HEAD}\n          {BUILD_PILLAR.paragraphs.map((words) => <p key={words} className="mt-3 max-w-3xl text-base text-text-secondary">{words}</p>)}\n
  //           <div className="mt-4 rounded-lg border border-border bg-white p-5">`), 'the heading → the paragraph → the card, nothing between').
  assert.ok(panel.startsWith(`${PILLAR_HEAD}\n        {BUILD_PILLAR.paragraphs.map((words) => <p key={words} className="ts-ps__lede">{words}</p>)}\n\n        <div className="ts-ps-panel">`), 'the heading → the line → the panel, nothing between');
  // PILLAR-NAMES-01 (Alex, 2026-11-11: "Financial Software | Professional Services | Travel Marketplace — these will replace Plan your Escape /
  // Build your Income / Explore the World"): the second pillar's name, and no full stop — 'Build Your Income.' until then.
  assert.equal(BUILD_PILLAR.heading, 'Professional Services');
  // HOME-SERVICES-01 (2026-11-12), ruling b. Until then: assert.deepEqual([...BUILD_PILLAR.paragraphs], ['Want to build your own system or something
  // customized for your business? From full setup and custom development to integrations, ongoing maintenance, and bookkeeping, Temple Stuart offers
  // hands-on services tailored to your needs.'], 'his paragraph, word for word').
  assert.deepEqual([...BUILD_PILLAR.paragraphs], ['Hands-on services, tailored to your needs.'], 'the one line where his paragraph stood (ruling b)');
  const leafNote = comments('src/lib/homeActWords.ts').replace(/^\s*\*/gm, ' ').replace(/\s+/g, ' ');
  assert.ok(leafNote.includes('"Want to build your own system or something customized for your business? From full setup and custom development to integrations, ongoing maintenance, and bookkeeping, Temple Stuart offers hands-on services tailored to your needs."'), 'his paragraph, word for word, quoted in the leaf\'s note');
  assert.match(leafNote, /HOME-SERVICES-01 \(Alex's brief, 2026-11-12 15:16 Manila/, 'dated');
  for (const words of [BUILD_PILLAR.heading, ...BUILD_PILLAR.paragraphs, 'Want to build your own system', 'Need help?', 'Send a proposal.']) {
    for (const src of [landing, section]) assert.ok(!src.includes(words), `no code types "${words.slice(0, 40)}"`);
  }
  // the section's opening: its id from the anchors leaf, its label, the inner box, then the pillar's heading. HOME-SERVICES-01 (2026-11-12): the
  // reference's tag behind the house prefix. Until then, of Landing.tsx: '<section id={SERVICES_ANCHOR} className="w-full border-b border-border
  // bg-bg-terminal">\n        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-10">', a comment between it and the heading.
  const sectionOpen = '<section id={SERVICES_ANCHOR} className="ts-ps" aria-labelledby="ps-title">\n      <div className="ts-ps__inner">';
  assert.equal(section.split(sectionOpen).length - 1, 1, 'the section, its id, its label and its inner box');
  assert.match(section.slice(section.indexOf(sectionOpen) + sectionOpen.length, head), ONLY_COMMENTS, 'the heading is the first thing in the section — a comment between, nothing else');
  // HOME-BRIEF-04 (Alex, 2026-11-10 19:00): the small chip inside the card repeated the label's words — it went with its span. Until then this
  // line held 'the chip, untouched': <span className="rounded border border-border px-2 py-0.5 font-mono text-xs … text-text-secondary">PROFESSIONAL SERVICES</span>.
  assert.doesNotMatch(panel, /<span className="rounded border border-border px-2 py-0\.5/, 'the chip is gone');
  // HOME-FINISH-02 (2026-11-10): the label left too — until then 'the words stand once in Landing's code — the label above the headline' (1).
  for (const src of [landing, section]) assert.equal(src.split('PROFESSIONAL SERVICES').length - 1, 0, 'the words stand nowhere in the code');
  // HOME-SERVICES-01 (2026-11-12), ruling f: "THE GOLD BUTTON replaces the purple one here; PRIMARY_CTA keeps its other users. "Send a project
  // proposal →" and "Scoped by proposal" move from Landing.tsx into a leaf." — and the README: "The button links to the form's page with the pick".
  // Until then (HOME-FINISH-01, 2026-11-08: the public page's one filled button, src/lib/ds.ts PRIMARY_CTA, 44px tall; the follow-up on #1931: worn
  // bare): assert.match(panel, /<div className="mt-4 flex flex-wrap items-center gap-4">\n\s*<Link\n\s*href=\{PROPOSAL_FORM_PATH\}\n\s*
  // className=\{PRIMARY_CTA\}\n\s*>\n\s*Send a project proposal →\n\s*<\/Link>\n\s*<span className="ml-auto font-mono text-xs italic
  // text-text-faint">Scoped by proposal<\/span>/); one href={PROPOSAL_FORM_PATH}; two Links — the door template and the button.
  assert.match(panel, /<div className="ts-ps-cta-row">\n {16}<Link className="ts-ps-cta" href=\{proposalFormHref\(picked\)\}>\{PROPOSAL_CTA\}<\/Link>\n {16}<span className="ts-ps-note">\{SCOPED_BY_PROPOSAL\}<\/span>\n {14}<\/div>/, 'the gold link to the form with the pick, the note beside it — both words from their leaf');
  assert.deepEqual([PROPOSAL_CTA, SCOPED_BY_PROPOSAL], ['Send a project proposal →', 'Scoped by proposal'], 'the two words, moved unchanged');
  assert.equal((panel.match(/\bhref=/g) ?? []).length, 1, 'one link — to the form');
  assert.equal((panel.match(/<Link\b/g) ?? []).length, 1, 'the gold link — the tiles are buttons; nothing else links');
  assert.equal((panel.match(/<button\b/g) ?? []).length, 1, 'one tile template');
  assert.doesNotMatch(panel, /PRIMARY_CTA|href=\{PROPOSAL_FORM_PATH\}/, 'no purple button, no bare link to the form');
  // the question, then the group it labels — nothing between. HOME-SERVICES-01 (2026-11-12). Until then (HOME-BRIEF-04: 'between the chip and the
  // doors' until the chip went): CARD_INNER = '<div className="mt-4 rounded-lg border border-border bg-white p-5">\n            <div className="mt-4">',
  // and nothing but a comment between it and the doors' grid.
  const PANEL_OPEN = '<div className="ts-ps-panel">\n          <h3 className="ts-ps-panel__question" id="ps-question">{NEED_QUESTION}</h3>\n          <div className="ts-ps-tiles" role="group" aria-labelledby="ps-question">';
  assert.equal(panel.split(PANEL_OPEN).length - 1, 1, 'the question, then the group it labels — nothing between');
  for (const src of [landing, section]) assert.doesNotMatch(src, /WORK WITH ME/);
});

test('T4 the act list\'s line rewritten in place, dated; the history stays; the s08 line is the deck\'s, found by content (PIPELINE-PAGE-01); the pins that stay (moved from close01)', () => {
  const notes = comments(LANDING);
  assert.ok(notes.includes(' *   DONE-FOR-YOU        — the professional-services panel, six doors from src/lib/proposalNeeds.ts — SERVICES-01, 2026-11-08: the close retired, bookkeeping a door (HOME-PANELS-02, 2026-11-07: under MY TRIP, above THE PLANS)\n'));
  assert.ok(notes.includes(' *                         (HOME-SERVICES-01, 2026-11-12: the act is the Professional Services section now — ServicesSection over src/lib/proposalNeeds.ts:'), 'HOME-SERVICES-01\'s line under it, dated');
  assert.ok(notes.includes(" *   (THE CLOSE          — HOME-05a's own act, gone: HOME-PANELS-01, 2026-11-07, folded the 2026 close into DONE-FOR-YOU as its fifth door, priced by proposal)"), 'the historical note stays');
  assert.ok(comments(DECK).includes('(the close | pipeline header → gone: HOME-PANELS-01, 2026-11-07'), 'the seam ledger\'s note stays'); // PIPELINE-PAGE-01 (2026-11-09): the ledger moved with the deck
  // PIPELINE-PAGE-01 (2026-11-09): the s08 line moved with the deck to PipelineDeck.tsx — found by content (the one line whose code starts with s08:), never by number.
  assert.equal(code(DECK).split('\n').filter((l) => /^\s+s08: /.test(l)).length, 1, 'exactly one s08 line, in the deck\'s file');
  // close01's pins that stay (HOME-05a, 2026-11-03; moved here by SERVICES-01): cockpitPerf01's three phrases; the plan law's tells absent
  for (const phrase of [/THE PLANS\s+— four plan cards and one comparison table/, /id="modules" lives on THE PLANS act/, /said by the four plans below/]) assert.match(notes, phrase);
  // PIPELINE-PAGE-01 (2026-11-09): the deck's text left Landing.tsx for its own page — it is held to the plan law's tells still, as the law holds it (clause 1).
  // HOME-SERVICES-01 (2026-11-12): the services section's own file joins the two (it was Landing.tsx's markup until then).
  for (const f of [LANDING, DECK, SECTION]) for (const tell of ['heroCountsLine', 'statusCounts', 'numberWord', 'tools, counted', 'SIX LIVES', 'PERSONAS', 'Who is this for?']) assert.ok(!code(f).includes(tell), `${f} carries no "${tell}"`);
  const BEAT_WORDS = ['discover', 'decide', 'commit', 'record'];
  for (const f of [LANDING, DECK, SECTION]) assert.doesNotMatch(code(f), new RegExp(`partial\\s*[—-]\\s*(?:${BEAT_WORDS.join('|')})|(?:${BEAT_WORDS.join('|')})\\s*·\\s*(?:${BEAT_WORDS.join('|')})`), `no beat claim in ${f}`);
});

// ── T5 · THE FORM ────────────────────────────────────────────────────────────

test('T5 needChoices() is the six doors in order, each chip the door\'s title; it takes no day', () => {
  assert.deepEqual(needChoices(), SIX.map((s) => ({ value: s.need, label: s.title })));
  assert.equal(needChoices.length, 0);
  const html = render(null);
  assert.deepEqual(SIX.map((s) => unescape(chip(html, s.need)?.words ?? '')), SIX.map((s) => s.title), 'the six chips, rendered');
  assert.equal(chip(html, 'close'), null, 'no close chip');
  assert.equal((html.match(/data-need="/g) ?? []).length, 6, 'six chips, no seventh');
});

test('T5 Bookkeeping picked: the three lines in order in the close block\'s classes, no modules question, the done placeholder', () => {
  const html = render('bookkeeping');
  assert.equal(chip(html, 'bookkeeping')?.className, SEGMENT.item(true), 'picked');
  for (const other of KEYS.filter((k) => k !== 'bookkeeping')) assert.equal(chip(html, other)?.className, SEGMENT.item(false), `${other} not picked`);
  const block = /<div class="mt-3 rounded bg-bg-row p-4 text-sm leading-relaxed text-text-primary" data-bookkeeping-offer="true">([\s\S]*?)<\/div>/.exec(html);
  assert.ok(block, 'the bookkeeping block');
  assert.equal(block[1], `<p>${escapeHtml(BOOKKEEPING_WORDS.what)}</p><p class="mt-2">${escapeHtml(BOOKKEEPING_WORDS.notTax)}</p><p class="mt-1 text-text-secondary">${escapeHtml(BOOKKEEPING_WORDS.remedy)}</p>`, 'what · notTax · remedy, in the close block\'s classes');
  assert.doesNotMatch(html, /data-modules|Which modules interest you/, 'no modules question for bookkeeping');
  assert.match(html, new RegExp(`placeholder="${escapeRe(BOOKKEEPING_WORDS.done)}"`), 'the done question\'s example');
  assert.doesNotMatch(unescape(block[1]), /\$\s*\d/, 'no figure');
  assert.doesNotMatch(html, /data-close-offer|books, closed|Close my/);
});

test('T5 another door picked: no bookkeeping block, the modules asked, the general placeholder; the lead is FORM_INTRO alone', () => {
  for (const need of KEYS.filter((k) => k !== 'bookkeeping')) {
    const html = render(need);
    assert.equal(chip(html, need)?.className, SEGMENT.item(true), `${need} picked`);
    assert.doesNotMatch(html, /data-bookkeeping-offer/);
    assert.match(html, /data-modules/);
    assert.doesNotMatch(html, new RegExp(`placeholder="${escapeRe(BOOKKEEPING_WORDS.done)}"`));
  }
  const html = render(null);
  assert.match(unescape(html), new RegExp(`<p class="text-xs leading-relaxed text-text-muted">${escapeRe(FORM_INTRO)}</p>`), 'the lead, one sentence');
  assert.doesNotMatch(unescape(html), /Your own hosted copy — every API wired|books, closed/, 'the typed setup sentence and the close sentence went');
});

test('T5 an old link /work-with-me?need=close opens the form with nothing picked — the page\'s own rule for a word it does not offer; nothing maps it', () => {
  for (const word of ['close', 'Close', 'embed a module', 'bookkeeping ', 'unsure;']) {
    const html = render(word);
    for (const k of KEYS) assert.equal(chip(html, k)?.className, SEGMENT.item(false), `"${word}": ${k} not picked`);
    assert.doesNotMatch(html, /data-bookkeeping-offer|data-close-offer/);
  }
  const form = code(FORM);
  assert.match(form, /const isDoor = \(word: string\): word is ServiceNeed => needs\.some\(\(n\) => n\.value === word\);/);
  assert.match(form, /useState<ServiceNeed \| null>\(initialNeed !== null && isDoor\(initialNeed\) \? initialNeed : null\)/, 'a door, or nothing picked');
  assert.match(form, /const isBookkeeping = need === 'bookkeeping';/);
  assert.match(form, /modules: isBookkeeping \? \[\] : modules,/);
  assert.match(form, /\(!isBookkeeping && modules\.includes\('other'\) && otherModuleText\.trim\(\) === ''\)/, 'the submit guard');
  assert.doesNotMatch(form, /isClose|CLOSE_OFFER|closeWords|SERVICE_NEED_LABELS|'close'/);
  assert.match(form, /export default function WorkWithMeForm\(\{ initialNeed \}: \{ initialNeed: string \| null \}\)/, 'the form takes no today');
});

test('T5 no clock anywhere on the form\'s path: the page computes no day and hands none down; both headers say so; the honeypot is still at WorkWithMeForm.tsx:371-380', () => {
  const page = code(PAGE);
  assert.match(page, /<WorkWithMeForm initialNeed=\{initialNeed\} \/>/);
  assert.doesNotMatch(page, /\btoday\b|new Date\(|Date\.now\(/);
  assert.match(comments(PAGE), /It reads no clock\./);
  assert.match(comments(FORM), /It reads no clock\.\n/);
  assert.doesNotMatch(code(FORM), /new Date\(|Date\.now\(|today=|today:/);
  // IntakeFormClient.tsx (:6, :128) and src/lib/crm/formWords.ts (:68) cite the honeypot by number — the lines stand.
  const lines = code(FORM).split('\n');
  assert.equal(lines[370], '              <div aria-hidden="true" className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden">');
  assert.equal(lines[379], '                  onChange={(e) => setWebsite(e.target.value)}');
});

// ── T6 · THE ROUTE ───────────────────────────────────────────────────────────

test('T6 the route: need z.enum(PROPOSAL_NEEDS) — each of the six accepted, \'close\' refused with a 400 whose issue names need', () => {
  const route = code(ROUTE);
  assert.match(route, /need: z\.enum\(PROPOSAL_NEEDS\),/);
  assert.match(route, /import \{ PROPOSAL_NEEDS \} from '@\/lib\/proposalNeeds';/);
  assert.match(route, /if \(!parsed\.success\) \{\n\s*return NextResponse\.json\(\n\s*\{\n\s*error: 'Invalid submission',\n\s*issues: parsed\.error\.issues\.map\(\(i\) => `\$\{i\.path\.join\('\.'\)\}: \$\{i\.message\}`\),\n\s*\},\n\s*\{ status: 400 \},/, 'a refusal is a 400 naming the path');
  // the route's own field, its own enum: the issue it maps is "need: …"
  const field = z.object({ need: z.enum(PROPOSAL_NEEDS) });
  for (const need of KEYS) assert.equal(field.safeParse({ need }).success, true, `${need} accepted`);
  const refused = field.safeParse({ need: 'close' });
  assert.equal(refused.success, false);
  if (refused.success) return;
  const issues = refused.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
  assert.equal(issues.length, 1);
  assert.match(issues[0], /^need: Invalid enum value\. Expected 'setup' \| 'maintenance' \| 'custom' \| 'embed' \| 'bookkeeping' \| 'unsure', received 'close'$/);
});

test('T6 the route\'s comment re-said, dated; its other lines unmoved — the lines other files cite by number; its public-writer entry unchanged', () => {
  const notes = comments(ROUTE);
  assert.ok(notes.includes("SERVICES-01: 'close' is no longer accepted on write — proposals_need_chk keeps it for the rows the old close door wrote."));
  const lines = code(ROUTE).split('\n');
  assert.equal(lines.length, 163, 'the route keeps its line count');
  assert.match(lines[45], /^ {2}name: z\.string\(\)/, ':46 — contactWrites.ts and formWrites.ts cite :46-47');
  assert.match(lines[46], /^ {2}email: z\.string\(\)/, ':47');
  assert.match(lines[74], /^export async function POST\(request: Request\) \{/, ':75 — src/app/api/f/[slug]/route.ts cites :75-113');
  const law = code(LAW);
  assert.match(law, /\{ file: 'src\/app\/api\/proposals\/route\.ts', kind: 'public', reason: 'PROPOSAL-FORM: public BY RULING — a DB write only, no paid call', guards: \[\{ name: 'honeypot', re: \/\\\['website'\\\]\/ \}/, 'the PUBLIC_WRITERS entry, unchanged');
});

// ── T7 · THE CRM ─────────────────────────────────────────────────────────────

test('T7 needWords: the six doors\' titles (old rows print today\'s words), the legacy title for \'close\', and a stranger throws by name', () => {
  assert.deepEqual(KEYS.map(needWords), ['Full setup', 'Monthly maintenance', 'Custom builds', 'Integration', 'Bookkeeping', 'Something else']);
  assert.equal(needWords('close'), 'Close my 2026 books (the old close door)');
  for (const stranger of ['bogus', 'Close', 'setup ', 'retainer']) assert.throws(() => needWords(stranger), (e: unknown) => e instanceof CrmLawError && e.message.includes(`"${stranger}" is neither a door of the proposal form`));
  const rules = code(RULES);
  assert.match(rules, /import \{ LEGACY_NEED_TITLES, SERVICES, SERVICE_NEEDS, type LegacyNeed \} from '@\/lib\/proposalNeeds';/);
  assert.doesNotMatch(rules, /CLOSE_OFFER|closeChoiceWords|offer\/close|SERVICE_NEED_LABELS/);
  assert.match(comments(RULES), /needWords\(need\) {12}what a proposal asked for — SERVICES-01 \(2026-11-08\): the door's title/);
});

// ── T8 · THE LAW SCRIPT, AND THE CLOSE RETIRED ───────────────────────────────

test('T8 the law script, in place: :160 imports the module; :710 is the services law\'s one line, between the experiences and the trip log laws', () => {
  const law = code(LAW);
  const lines = law.split('\n');
  // HOME-FINISH-01 (Alex, 2026-11-08): no whole-file line count. This file grows — new laws land at its END by rule, and #1929
  // (SUPERSEDE-01b) grew two existing laws mid-file (:3334-3529, :10965-11127), 11182 → 11218 lines, all below every line the deck
  // cites — so a count breaks on PRs that move no cited line. The deck's citations of this file are guarded by content: dataflow01.test.ts
  // T5 holds each `// true per` citation to the word it names — :483 ownTableLaw (s08, PipelineDeck.tsx:1624), :742 enumValues (s04 and
  // PipelineDeck.tsx:1616), :840 callSites (s14Parsed), :987 s14Law (the step-14 note, PipelineDeck.tsx:3867 — PIPELINE-PAGE-01, 2026-11-09: the deck's own file, was Landing.tsx:1807, :1799, :4516; STOP0-01, 2026-11-09: was :4509; BOOK-DISCLOSE-01, 2026-11-08: was :4508); intakeForm01.test.ts T8 pins
  // :483 and :742 by number (lawLines[482], lawLines[741]). :160 and :710 are pinned here.
  assert.equal(lines[159], "import { EXPERIENCES, EXPERIENCE_CATEGORIES, experiencesLaw } from '../src/lib/experiences'; import { SERVICES, servicesLaw } from '../src/lib/proposalNeeds';");
  assert.match(lines[709], /^\{ const before = violations\.length; violations\.push\(\.\.\.servicesLaw\(\{ throwOnFail: false, migrations: ALL_MIGRATIONS \}\)\);/, ':710 — the deck cites lines below it by number');
  assert.ok(lines[709].includes("`✔ The services law passed — ${SERVICES.length} doors (${SERVICES.map((s) => s.title).join(' · ')}), every word in src/lib/proposalNeeds.ts, every key held by proposals_need_chk with 'close' kept for the rows the old close door wrote; no fixed price on a door (SERVICES-01, 2026-11-08: the close offer law retired with the close; this seat re-used because the deck cites this file’s lines by number)`"), 'the ruled line — its words verbatim; the apostrophe is U+2019 because an ASCII one would unpair the activity law\'s string blanking over this file');
  const experiences = law.indexOf('violations.push(...experiencesLaw({ throwOnFail: false }));');
  const services = law.indexOf('violations.push(...servicesLaw({ throwOnFail: false, migrations: ALL_MIGRATIONS }));');
  const tripLog = law.indexOf('violations.push(...wasHereLaw({ throwOnFail: false }));');
  assert.ok(experiences > -1 && services > experiences && tripLog > services, 'experiences → the services → the trip log');
  assert.ok(law.indexOf('const ALL_MIGRATIONS = ') < services, 'every migration is read before the law runs');
  assert.doesNotMatch(law, /closeOfferLaw|CLOSE_OFFER|offer\/close/);
});

test('T8 the close retired: its four files gone, and no code in src or scripts reads CLOSE_OFFER, CloseOffer*, closeWords, closeChoiceWords, closeFormHref or CLOSE_ANCHOR', () => {
  for (const f of ['src/lib/offer/close.ts', 'src/lib/offer/closeWords.ts', 'src/components/landing/CloseOfferCard.tsx', 'src/lib/__tests__/close01.test.ts']) {
    assert.ok(!existsSync(resolve(process.cwd(), f)), `${f} is gone`);
  }
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === '__tests__' ? [] : walk(full);
    return /\.tsx?$/.test(name) ? [full.slice(process.cwd().length + 1)] : [];
  });
  const files = [...walk(resolve(process.cwd(), 'src')), ...walk(resolve(process.cwd(), 'scripts'))];
  assert.ok(files.length > 500, `the sweep reads the tree (${files.length} files)`);
  const READERS = /\bCLOSE_OFFER\b|\bCloseOffer\w*|\bcloseWords\b|\bcloseChoiceWords\b|\bcloseFormHref\b|\bCLOSE_ANCHOR\b|\bcloseOfferLaw\b|offer\/close\b/;
  const hits = files.filter((f) => READERS.test(code(f)));
  assert.deepEqual(hits, [], 'zero code readers; the history lives in dated comments');
});

// ── T9 · README ──────────────────────────────────────────────────────────────

test('T9 README\'s "Work with me" is the six doors from SERVICES — title and line, in order — and the form\'s link; no mailto (HOME-FINISH-01)', () => {
  const readme = rejoin(code('README.md'), comments('README.md'));
  const start = readme.indexOf('\n## Work with me\n');
  const end = readme.indexOf('\n## License\n', start);
  assert.ok(start > -1 && end > start, 'the section, then the License section');
  const section = readme.slice(start + 1, end + 1);
  assert.ok(section.startsWith('## Work with me\n\nI built this for me — but I\'ll set it up for you.\n\n'), 'its first sentence kept');
  const bullets = section.split('\n').filter((l) => l.startsWith('- '));
  assert.deepEqual(bullets, SERVICES.map((s) => `- ${s.title}: ${s.line}`), 'the six doors, verbatim from src/lib/proposalNeeds.ts, in order');
  assert.ok(section.includes('\nSend a proposal: [templestuart.com/work-with-me](https://templestuart.com/work-with-me)\n'), 'the form is the one door');
  assert.doesNotMatch(section, /mailto:/, 'no email proposals (Alex, 2026-11-06)');
  assert.ok(readme.includes('\n## License\n\nSource-available under the Business Source License 1.1'), 'the License section stays');
  assert.ok(readme.includes('Temple Stuart is not a CPA firm, tax preparer, or licensed financial advisor.'), 'the closing notice stays');
});

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
}
