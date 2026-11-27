/**
 * HOME-SERVICES-02 — PROFESSIONAL SERVICES ON THE HOME PAGE: EACH SERVICE OPENS ITS OWN PROPOSAL FORM IN PLACE.
 *
 * Alex asked for it on 2026-11-16, Manila time. At 09:58: "selecting the category acts as a toggler then a tailored form popus up under the
 * section to be filled out, and submit proposal button at bottom"; at 10:26, of the boards: "looks dope lets rick"; at 12:08: "have questions
 * how its the same for a bunch of the categories"; at 12:59: "ok lets do it, lets build it"; at 13:07: "ok so where is the prompt a mundo?";
 * at 13:24: "can we combine hone service 2 and this one? i never ran home service 2 casue it was with old form". The brief that followed,
 * HOME-SERVICES-02 (Alex's brief, 2026-11-16 13:24 Manila), rules twenty ways (a to t); three are this file's to build.
 * Ruling q: "WHAT THIS MAKES FALSE IS RE-SAID WHERE IT STANDS, dated. That includes every note calling the form in place a later PR, and every note saying the short view draws the gold link, its note or the link to /professional-services, or that the first door is picked at rest on the home page. It includes every note and pin naming the old questions, the deadline rule, Project details, today's single set of bands or the old body, and the route's FORM-V2 notes on current_stack and notesFromThem. It includes the honeypot's place, cited as WorkWithMeForm.tsx:371-380 by the form's tests and by IntakeFormClient.tsx:6 and :128. It includes the deck as /work-with-me's door, in its page's note (page.tsx:13) and in GUEST_ROUTES' reason on :225, re-said on the line it holds: the gold button on /professional-services is its door now. And it includes the CRM's read of proposals. The notes that count the public pages' imports stand as written, as HOME-PHONE-01 left them, and each new file says it joins that closure. A line a test or a law cites by its number stays there unless the citation moves with it. Landing.tsx stays at 815 lines, and src/middleware.ts is not touched. The route stays public BY RULING: it writes to the database only, rate-limited, behind the honeypot."
 * Ruling r: "EVERY OTHER CENSUS STANDS UNTOUCHED: homeTrim01's, homeTrim02's, homeTrim03's, homePages01's, homeAbout02's, homePlans05's and homePhone01's, and homeMenu01's when it lands. Where another brief is quoted, the new words go around its quotes, and no quote of it appears anywhere it did not. Other briefs' approvals appear by their times, never by their words."
 * Ruling s: "HOME-SERVICES-02'S QUOTES CARRY ITS TIMES: 2026-11-16 at 09:58, 10:26, 12:08, 12:59, 13:07 and 13:24 Manila. Every ruling of this brief is quoted exactly, and none is worded like another census's."
 *
 *   T1 the handoff, byte for byte; the reference's first stylesheet is home-services-01's, byte for byte
 *   T2 the port: section 4 and the four form-only rules of sections 5 and 6, as the first stylesheet writes them, renamed; the short view's
 *      block, the second stylesheet renamed; no token added
 *   T3 the list: equal to the README's tables and to the reference's form, question by question, for the core and each service
 *   T4 the short view's render: the reference's section as its script paints it, token for token — at rest, each service picked with More
 *      details closed and open, and sent — but for the house prefix, the ids, the honeypot and the data- hooks only its script reads
 *   T5 the toggle; Close; the pick none at rest
 *   T6 the form in the page and hidden at rest; what was typed kept across a close and a new press
 *   T7 both forms read one hook; the rule for each service, and the route's check's verdict on the same bodies
 *   T8 the body; T9 the bands by billing; T10 the migration; T11 the CRM's read
 *   T12 every word from the list, no question typed in a component, Scoped by proposal nowhere in src
 *   T13 /work-with-me asks each door's set with its own controls
 *   T14 each ruling quoted where it is built, dated, and this brief's census
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { code, comments, rejoin } from '../sourceText';
import {
  BOOKKEEPING_BANDS, BOOKKEEPING_WORDS, CORE_COLUMNS, CORE_QUESTIONS, FORM_CLOSE, FORM_WORDS, FOUND_QUESTION, MAINTENANCE_BANDS, MONTHLY_BUDGET,
  NEED_QUESTION, ONGOING, PROJECT_BANDS, PROPOSAL_STEPS, SERVICES, SERVICE_NEEDS, SERVICE_QUESTIONS, TIMELINE,
  answerPress, proposalCheck, questionsOf, setOf, startAnswers, type Answers, type Question, type ServiceNeed,
} from '../proposalNeeds';
import { CORE_START, proposalBody, proposalHeld, useProposalForm, type CoreAnswers, type ProposalForm } from '@/hooks/useProposalForm';
import ServicesSection, { ServicesShortView, nextPick } from '@/components/landing/ServicesSection';
import WorkWithMeForm from '@/app/work-with-me/WorkWithMeForm';
import { CrmLawError, proposalRowsOf, type ProposalInput } from '../crm/crm';
import { CONTROL, SEGMENT } from '../ds';

Object.assign(globalThis, { React });

const ROOT = process.cwd();
const FOLDER = 'design-refs/home-services-02';
const README = `${FOLDER}/README.md`;
const REFERENCE = `${FOLDER}/Section-Reference.html`;
const SERVICES01_REFERENCE = 'design-refs/home-services-01/Section-Reference.html';
const LEAF = 'src/lib/proposalNeeds.ts';
const HOOK = 'src/hooks/useProposalForm.ts';
const FORM = 'src/components/landing/ServicesForm.tsx';
const SECTION = 'src/components/landing/ServicesSection.tsx';
const PAGE_FORM = 'src/app/work-with-me/WorkWithMeForm.tsx';
const ROUTE = 'src/app/api/proposals/route.ts';
const CRM = 'src/lib/crm/crm.ts';
const GLOBALS = 'src/app/globals.css';
const SCHEMA = 'prisma/schema.prisma';
const MIGRATION_DIR = '20261116132400_home_services_02_answers';
const MIGRATION = `prisma/migrations/${MIGRATION_DIR}/migration.sql`;
const THIS = 'src/lib/__tests__/homeServices02.test.ts';

const count = (hay: string, needle: string): number => hay.split(needle).length - 1;
const flat = (s: string): string => s.replace(/\s+/g, ' ').trim();
const sha256 = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');
const whole = (file: string): string => rejoin(code(file), comments(file));
const size = (file: string): number => statSync(resolve(ROOT, file)).size;
const prose = (file: string): string => flat(comments(file).split('\n').map((line) => line.replace(/^\s*(\/\*\*?|\*\/|\*|\/\/|--)?\s?/, '')).join(' '));
const unescaped = (s: string): string => s.replace(/&#x27;/g, "'").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const srcFiles = (dir = 'src'): string[] => readdirSync(resolve(ROOT, dir)).flatMap((name) => {
  const rel = join(dir, name);
  if (statSync(resolve(ROOT, rel)).isDirectory()) return name === '__tests__' ? [] : srcFiles(rel);
  return /\.tsx?$/.test(name) ? [rel] : [];
});
const noop = (): void => {};

// ── THE BRIEF, EXACT ─────────────────────────────────────────────────────────

/** Alex's six quotes, by their times (ruling s). */
const QUOTES: ReadonlyArray<readonly [time: string, words: string]> = [
  ['09:58', 'selecting the category acts as a toggler then a tailored form popus up under the section to be filled out, and submit proposal button at bottom'],
  ['10:26', 'looks dope lets rick'],
  ['12:08', 'have questions how its the same for a bunch of the categories'],
  ['12:59', 'ok lets do it, lets build it'],
  ['13:07', 'ok so where is the prompt a mundo?'],
  ['13:24', 'can we combine hone service 2 and this one? i never ran home service 2 casue it was with old form'],
];
/** The twenty rulings, as the brief gives them. */
const RULING = {
  a: 'A SERVICE IS A TOGGLE ON THE HOME PAGE. At rest nothing is picked, and the panel holds only the question and the six. A press on a service picks it and opens the proposal form under them, inside the panel. A press on another picks that one, and the open form follows it. A press on the picked service picks none and closes the form, which is also what Close does. Each tile keeps aria-pressed and gains aria-controls="ps-form". A press leaves focus on its tile, and Close hands focus back to the tile that was picked.', b: 'THE FORM IN THE PANEL IS THE PROPOSAL FORM ITSELF. Its honeypot, the body it posts to /api/proposals and its thank-you are those of /work-with-me. It draws no need question, because the tiles are its need. Its head is the eyebrow with Close at the right, then the picked door\'s name and line, drawn by DoorWords, which ServicesSection.tsx hands the form, with aria-live kept; Send proposal comes last. After a send, the thank-you takes the place of the door\'s words and the fields for the rest of the visit.', c: 'EACH SERVICE HAS ITS OWN QUESTIONS, AND THE README\'S TABLES ARE THEM. Name, Email, the business, a website and the visitor\'s part in the decision open every form, and How did you find me closes it, last under More details. Between them, each service asks its own questions in the README\'s order, with their required answers, defaults, follow-ups and the answers that stand alone. Team size, What tools do you use today? and the hard deadline with No deadline — exploring are no longer asked.', d: 'ONE LIST HOLDS THE QUESTIONS, AND BOTH FORMS DRAW THEM FROM IT. The core and the six sets are data in src/lib/proposalNeeds.ts, where NEED_QUESTION, ASK_TIMELINE and ASK_BUDGET already live: each question\'s key, words, kind, answers, whether it is required, its default and its follow-up, and every other word the forms show. ServicesForm.tsx draws the picked set in the panel\'s dress. WorkWithMeForm.tsx draws it with the page\'s own controls, as it draws today\'s questions, and its need question stays and picks the set. No question, word or answer is typed in a component. Close is a new word, one constant there.', e: 'ONE HOOK, READ BY BOTH FORMS. The answers, the button\'s rule, the body, the send and its errors leave WorkWithMeForm.tsx for src/hooks/useProposalForm.ts, with the picked need as their argument. The rule and the body are pure functions there, so the tests reach them. The core\'s answers carry from service to service, and each service keeps its own while another is looked at. The page keeps its own need, its markup and needChoices. No line of the form\'s logic is written twice.', f: 'THE BUTTON WAITS FOR WHAT A QUOTE NEEDS, AND THE ROUTE CHECKS THE SAME THINGS. The required picks, Bookkeeping\'s three counts, Other\'s description and the referral\'s follow-up hold the button; the required text answers are required fields, as Name and Email are. Nothing waits for a deadline. The hook\'s rule and the route\'s check read the same set, so the route refuses by name any body the button would have held back.', g: 'BUDGETS FOLLOW THE BILLING. The three project services keep today\'s bands under Budget range. Monthly maintenance and Bookkeeping ask Monthly budget with their own bands. Something else takes the monthly bands when Something ongoing is its answer, and the project bands otherwise. The monthly bands are Alex\'s placeholders: they live in the list and the route reads them there, so his prices will be a change in one place.', h: 'MORE DETAILS STARTS CLOSED, in both forms. Its words, More details (optional), replace Project details. Inside it stand the service\'s optional questions, then How did you find me.', i: 'THE FORM IS IN THE PAGE FROM THE START, HIDDEN WHILE NOTHING IS PICKED. It is never unmounted, so a close keeps what was typed. The pick is React state, none at rest; nothing is stored and nothing is put in the URL. Which shape holds the short view\'s state is the audit\'s to name, the smallest by the pins it moves.', j: 'THE SECTION SENDS NOBODY ELSEWHERE. The short view\'s brief row leaves, with the door\'s name and line, the gold link and its note. The link under the panel to /professional-services leaves too, and SEE_HOW_A_PROPOSAL_WORKS with it, and the rules of both.',
  k: 'THE GREY NOTE LEAVES EVERY PAGE. Scoped by proposal goes from beside the whole view\'s gold button on /professional-services and from beside Send proposal on /work-with-me; SCOPED_BY_PROPOSAL and .ts-ps-note go with it.', l: 'THE WHOLE VIEW KEEPS ITS OWN PICK: Full setup at rest, and a press only picks. Its render is main\'s but for the note.', m: 'THE ANSWERS ARE STORED IN ONE NEW COLUMN. One migration adds answers, jsonb, to proposals: the website, the decision role and the picked service\'s answered questions, each under its key. Name, email, business, need and the referral keep their columns. The columns only the old questions filled stop being written for new rows, and lose NOT NULL and any default, so a new row holds NULL there rather than a value nobody gave. No old row is read, changed or deleted. The migration is authored, not applied, in SERVICES-01\'s idiom: it applies at the production deploy through the build\'s migration gate.', n: 'THE HONEYPOT KEEPS ITS NAME. website stays the route\'s trap, silently dropped when filled, BY RULING. The visitor\'s real website never travels under that key: it is an answer, under a key of its own.', o: 'OLD ROWS STAY AS THEY WERE STORED. The CRM shows a new proposal\'s answers under their questions\' words, read from the list, and shows an old proposal as it does today.', p: 'THE PORT TAKES THE FORM\'S RULES AS THE FIRST STYLESHEET WRITES THEM: its section 4 into the port\'s empty section 4, and the four rules of its sections 5 and 6 that name only the form\'s elements, renamed, in its order. The second stylesheet becomes the short view\'s block, renamed: its nine new rules come, and the brief\'s and the link\'s rules go. The third stylesheet is the reference page\'s own and is not ported. The 14px margins written on the follow-ups come with the markup. homeServices01 T3 and homeTrim03 T2 are re-said to hold the port as it now stands, its difference 4 and difference 5 included. The port adds no token.', q: 'WHAT THIS MAKES FALSE IS RE-SAID WHERE IT STANDS, dated. That includes every note calling the form in place a later PR, and every note saying the short view draws the gold link, its note or the link to /professional-services, or that the first door is picked at rest on the home page. It includes every note and pin naming the old questions, the deadline rule, Project details, today\'s single set of bands or the old body, and the route\'s FORM-V2 notes on current_stack and notesFromThem. It includes the honeypot\'s place, cited as WorkWithMeForm.tsx:371-380 by the form\'s tests and by IntakeFormClient.tsx:6 and :128. It includes the deck as /work-with-me\'s door, in its page\'s note (page.tsx:13) and in GUEST_ROUTES\' reason on :225, re-said on the line it holds: the gold button on /professional-services is its door now. And it includes the CRM\'s read of proposals. The notes that count the public pages\' imports stand as written, as HOME-PHONE-01 left them, and each new file says it joins that closure. A line a test or a law cites by its number stays there unless the citation moves with it. Landing.tsx stays at 815 lines, and src/middleware.ts is not touched. The route stays public BY RULING: it writes to the database only, rate-limited, behind the honeypot.', r: 'EVERY OTHER CENSUS STANDS UNTOUCHED: homeTrim01\'s, homeTrim02\'s, homeTrim03\'s, homePages01\'s, homeAbout02\'s, homePlans05\'s and homePhone01\'s, and homeMenu01\'s when it lands. Where another brief is quoted, the new words go around its quotes, and no quote of it appears anywhere it did not. Other briefs\' approvals appear by their times, never by their words.', s: 'HOME-SERVICES-02\'S QUOTES CARRY ITS TIMES: 2026-11-16 at 09:58, 10:26, 12:08, 12:59, 13:07 and 13:24 Manila. Every ruling of this brief is quoted exactly, and none is worded like another census\'s.', t: 'ONLY THE PROFESSIONAL SERVICES SECTION AND THE PROPOSAL FORM CHANGE, with the note leaving two pages and what stores and shows the answers. Not the whole view\'s stage or button, not /work-with-me\'s look beyond the new kinds of field, not the top bar, the footer or any other section.',
} as const;

// ── the stylesheets, read as lists of declarations (homeTrim03.test.ts's reading) ──

function declarations(css: string): string[] {
  const out: string[] = [];
  const walk = (text: string, media: string): void => {
    let i = 0;
    while (i < text.length) {
      const open = text.indexOf('{', i);
      if (open < 0) { assert.match(text.slice(i), /^\s*$/, `nothing stands after the last block: "${flat(text.slice(i)).slice(0, 60)}"`); break; }
      let depth = 1;
      let j = open + 1;
      for (; j < text.length && depth > 0; j += 1) { if (text[j] === '{') depth += 1; else if (text[j] === '}') depth -= 1; }
      assert.equal(depth, 0, 'every block closes');
      const prelude = flat(text.slice(i, open));
      const body = text.slice(open + 1, j - 1);
      if (prelude.startsWith('@media')) walk(body, prelude);
      else for (const d of body.split(';').map(flat).filter(Boolean)) out.push(`${media} | ${prelude} | ${d}`);
      i = j;
    }
  };
  walk(css, '');
  return out;
}
const uncommented = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
const stylesOf = (html: string): string[] => html.split('<style>').slice(1).map((part) => part.slice(0, part.indexOf('</style>')));
/** The house prefix: every class, and every custom property; the reference's mono family is the site's. */
const ported = (d: string): string => {
  const [media, sel, decl] = d.split(' | ');
  return `${media} | ${sel.replace(/\.ps(?=$|[^A-Za-z0-9])/g, '.ts-ps')} | ${decl.replace(/var\(--/g, 'var(--ts-').replace("'IBM Plex Mono', monospace", 'var(--font-mono)')}`;
};
const PORT_OPEN = '.ts-ps {';
const NEXT_PORT = '.ts-fs-heading {';
const BLOCK_OPEN = '.ts-ps--short .ts-ps__inner {';
const portOf = (): string[] => { const css = code(GLOBALS); return declarations(css.slice(css.indexOf(PORT_OPEN), css.indexOf(NEXT_PORT))); };

// ── the markup, read as tokens ───────────────────────────────────────────────

const VOID = new Set(['input', 'img', 'br', 'hr', 'meta', 'link', 'source', 'area', 'col', 'embed', 'param', 'track', 'wbr']);
type Token = { readonly kind: 'open' | 'close' | 'text'; readonly name: string; readonly attrs: ReadonlyArray<readonly [string, string]>; readonly text: string };
/** HTML as tokens: tags with their attributes, text runs unescaped and collapsed; comments and layout whitespace dropped. */
function rawTokens(html: string): Token[] {
  const out: Token[] = [];
  for (const m of html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<[^>]+>|[^<]+/g)) {
    const t = m[0];
    if (!t.startsWith('<')) {
      if (/^\s*$/.test(t)) { if (!t.includes('\n')) out.push({ kind: 'text', name: '', attrs: [], text: ' ' }); continue; }
      out.push({ kind: 'text', name: '', attrs: [], text: unescaped(t).replace(/\s+/g, ' ') });
      continue;
    }
    const tag = /^<(\/?)([a-zA-Z][a-zA-Z0-9]*)([\s\S]*?)(\/?)>$/.exec(t);
    assert.ok(tag, `a tag: ${t}`);
    if (tag[1]) { out.push({ kind: 'close', name: tag[2], attrs: [], text: '' }); continue; }
    const attrs: Array<[string, string]> = [];
    // an attribute's name is the same name in any case (HTML): React writes maxLength, the reference maxlength
    for (const a of tag[3].matchAll(/([^\s=]+)(?:="([^"]*)")?/g)) attrs.push([a[1].toLowerCase(), unescaped(a[2] === undefined ? '' : a[2])]);
    out.push({ kind: 'open', name: tag[2], attrs, text: '' });
    if (VOID.has(tag[2])) out.push({ kind: 'close', name: tag[2], attrs: [], text: '' });
  }
  return out;
}
const attr = (t: Token, name: string): string | undefined => t.attrs.find(([k]) => k === name)?.[1];
/**
 * What the eye and the reader get: every element marked hidden dropped with what it holds; the reference's per-service wrappers (.ps-set,
 * display: contents in its own third stylesheet) unwrapped; the trap dropped; ids and what names them, and the data- hooks but the tiles',
 * dropped; an empty value dropped; a valueless attribute read as present. `prefix`: the reference's classes behind the house prefix.
 */
function seen(html: string, prefix: boolean): string[] {
  const out: string[] = [];
  const tokens = rawTokens(html);
  let skip = 0;
  const unwrap: boolean[] = [];
  for (const t of tokens) {
    if (skip > 0) { if (t.kind === 'open') skip += 1; else if (t.kind === 'close') skip -= 1; continue; }
    if (t.kind === 'open') {
      const cls = attr(t, 'class') ?? '';
      if (attr(t, 'hidden') !== undefined || cls.startsWith('absolute -left-[9999px]')) { skip = 1; continue; }
      if (cls === 'ps-set') { unwrap.push(true); continue; }
      unwrap.push(false);
      const keep = t.attrs
        .filter(([k, v]) => !['id', 'for', 'aria-labelledby'].includes(k) && !(k.startsWith('data-') && k !== 'data-done-for-you') && !(k === 'value' && v === ''))
        .map(([k, v]): string => `${k}="${k === 'class' && prefix ? v.split(/\s+/).map((c) => `ts-${c}`).join(' ') : k === 'style' ? v.replace(/\s+/g, '') : v === '' ? 'true' : v}"`)
        .sort();
      out.push(`<${t.name}${keep.map((a) => ` ${a}`).join('')}>`);
    } else if (t.kind === 'close') {
      if (unwrap.pop()) continue;
      out.push(`</${t.name}>`);
    } else out.push(`#text ${JSON.stringify(t.text)}`);
  }
  // text runs that touch merge, as the eye reads them (React writes a run per expression)
  return out.reduce<string[]>((acc, t) => {
    const last = acc[acc.length - 1];
    if (t.startsWith('#text ') && last !== undefined && last.startsWith('#text ')) acc[acc.length - 1] = `#text ${JSON.stringify(JSON.parse(last.slice(6)) + JSON.parse(t.slice(6)))}`;
    else acc.push(t);
    return acc;
  }, []);
}
const textsOf = (html: string): string[] => seen(html, false).filter((t) => t.startsWith('#text ')).map((t) => (JSON.parse(t.slice(6)) as string).trim()).filter(Boolean);


// ── the reference, and its script's paint ────────────────────────────────────

const referenceText = (): string => whole(REFERENCE);
function referenceSection(): string {
  const html = referenceText();
  const body = html.slice(html.indexOf('<body>'), html.indexOf('<script>'));
  assert.equal(count(body, '<section'), 1, 'one section in the reference');
  return body.slice(body.indexOf('<section'), body.indexOf('</section>') + '</section>'.length);
}
const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function swap(html: string, from: string, to: string, times = 1): string {
  assert.equal(count(html, from), times, `the reference holds "${from.slice(0, 60)}" ${times} time(s)`);
  return html.split(from).join(to);
}
/** The reference's section as its own script paints it (paint(), the More button, the send): each edit is one its script makes. */
function painted(need: ServiceNeed | null, opts: { more?: boolean; sent?: string } = {}): string {
  const script = referenceText().slice(referenceText().indexOf('<script>'), referenceText().indexOf('</script>'));
  for (const line of [
    "for (const tile of $$('.ps-tile')) tile.setAttribute('aria-pressed', String(tile.dataset.doneForYou === state.need));",
    "$('#ps-form').hidden = state.need === null;",
    "for (const set of $$('.ps-set')) set.hidden = set.dataset.set !== state.need;",
    "$('[data-offer]').hidden = state.need !== 'bookkeeping';",
    "$('.ps-form__door').hidden = state.sent;",
    "$('[data-send]').disabled = !(groupsOk && countsOk && followsOk);",
  ]) assert.ok(script.includes(line), `its script does this: ${line.slice(0, 70)}`);
  let h = referenceSection().replace(/(<button class="ps-tile" type="button" aria-pressed=")(?:true|false)(" aria-controls="ps-form" data-done-for-you="([a-z]+)">)/g, (_m, a: string, b: string, n: string) => `${a}${n === need}${b}`);
  if (need === null) return h;
  const door = SERVICES.find((s) => s.need === need);
  assert.ok(door, need);
  h = swap(h, '<div class="ps-form" id="ps-form" hidden>', '<div class="ps-form" id="ps-form">');
  h = h.replace(/(<h3 class="ps-stage__title" aria-live="polite">)[^<]*(<\/h3>)/, `$1${esc(door.title)}$2`).replace(/(<p class="ps-stage__line">)[^<]*(<\/p>)/, `$1${esc(door.line)}$2`);
  h = h.split(`<div class="ps-set" data-set="${need}" hidden>`).join(`<div class="ps-set" data-set="${need}">`);
  if (need === 'bookkeeping') h = swap(h, '<div class="ps-offer" data-offer hidden>', '<div class="ps-offer" data-offer>');
  if (opts.more === true) {
    h = swap(h, 'aria-expanded="false" aria-controls="ps-more"', 'aria-expanded="true" aria-controls="ps-more"');
    h = swap(h, '<div class="ps-fields ps-fields--more" id="ps-more" hidden>', '<div class="ps-fields ps-fields--more" id="ps-more">');
  }
  if (opts.sent !== undefined) {
    h = swap(h, '<div class="ps-form__door">', '<div class="ps-form__door" hidden>');
    h = swap(h, '<form class="ps-fields" data-form>', '<form class="ps-fields" data-form hidden>');
    h = swap(h, '<div class="ps-sent" role="status" hidden>', '<div class="ps-sent" role="status">');
    h = swap(h, '<span data-email></span>', `<span data-email>${esc(opts.sent)}</span>`);
  } else h = swap(h, '<button class="ps-cta" type="submit" data-send>', '<button class="ps-cta" type="submit" data-send disabled>');
  return h;
}

// ── the app's renders ────────────────────────────────────────────────────────

/** The short view with a pick, drawn with the hook its holder calls; More details or the thank-you as the hook holds them after a press or a send. */
const Picked = ({ need, more, sent }: { need: ServiceNeed; more?: boolean; sent?: string }) => {
  const form = useProposalForm(need);
  const held: ProposalForm = { ...form, moreOpen: more === true, sentEmail: sent === undefined ? null : sent };
  return React.createElement(ServicesShortView, { picked: need, onPick: noop, form: held, onClose: noop });
};
const shortAt = (need: ServiceNeed, opts: { more?: boolean; sent?: string } = {}): string => renderToStaticMarkup(React.createElement(Picked, { need, ...opts }));
const atRest = (): string => renderToStaticMarkup(React.createElement(ServicesSection, { view: 'short' }));
const pageForm = (need: string | null): string => renderToStaticMarkup(React.createElement(WorkWithMeForm, { initialNeed: need }));
const SENT_TO = 'ada@example.com';

// ── T1 · THE HANDOFF ─────────────────────────────────────────────────────────

const HANDOFF: ReadonlyArray<readonly [file: string, bytes: number, sha: string]> = [
  [README, 20998, 'd11dda8ca9b4c3fe680f098ba5e2b4aa4886f77e345f166b93f1d70d4e127d93'],
  [REFERENCE, 73059, '8f0ca3429dab66a580aff7c008d0e0db72c46d11402e055008fb995cf15c164e'],
];

test('T1 the handoff is in the tree, byte for byte, and the folder holds the two; the reference\'s first stylesheet is home-services-01\'s, byte for byte', () => {
  for (const [file, bytes, sha] of HANDOFF) {
    assert.equal(size(file), bytes, `${file}: ${bytes} bytes`);
    assert.equal(sha256(whole(file)), sha, `${file}: byte for byte`);
  }
  assert.deepEqual(readdirSync(resolve(ROOT, FOLDER)).sort(), ['README.md', 'Section-Reference.html']);
  const styles = stylesOf(referenceText());
  assert.equal(styles.length, 3, 'three stylesheets: home-services-01\'s, the short view\'s, the page\'s own');
  assert.equal(styles[0], stylesOf(whole(SERVICES01_REFERENCE))[0], 'the first is design-refs/home-services-01\'s, byte for byte');
  assert.ok(styles[2].includes('THIS PAGE\'S OWN: not part of the design, not ported'), 'the third is the page\'s own');
});

// ── T2 · THE PORT ────────────────────────────────────────────────────────────

test('T2 the port: the first stylesheet\'s section 4 whole and its sections 5 and 6 with their four form-only rules, renamed, in its order; the short view\'s block, the second stylesheet renamed; no token added; the note\'s rule, the row\'s and the link\'s gone', () => {
  const [first, second] = stylesOf(referenceText());
  const s4 = first.indexOf('/* ── 4 · the form, in place (HOME-SERVICES-02)');
  const s5 = first.indexOf('/* ── 5 · wider windows');
  const own = first.indexOf('/* ── THIS PAGE\'S OWN');
  assert.ok(s4 > -1 && s5 > s4 && own > s5, 'sections 4, 5 and 6, then the page\'s own');
  const section4 = declarations(uncommented(first.slice(s4, s5))).map(ported);
  const later = declarations(uncommented(first.slice(s5, own))).map(ported);
  assert.equal(section4.length, 196, 'section 4: one hundred and ninety-six declarations');
  const port = portOf();
  const at = port.indexOf(section4[0]);
  assert.ok(at > -1, 'section 4 stands in the port');
  assert.deepEqual(port.slice(at, at + section4.length), section4, 'section 4, declaration by declaration, in its order, renamed');
  assert.deepEqual(port.slice(at + section4.length, at + section4.length + later.length), later, 'then sections 5 and 6, whole — their four form-only rules in their places');
  for (const rule of ['.ts-ps-fields', '.ts-ps-close:hover, .ts-ps-link__remove:hover, .ts-ps-add:hover', '.ts-ps-pick[aria-pressed="false"]:hover', '.ts-ps-more:hover']) {
    assert.ok(later.some((d) => d.split(' | ')[1] === rule && d.startsWith('@media')), `${rule}: one of the four, ported`);
  }
  const css = code(GLOBALS);
  const block = declarations(css.slice(css.indexOf(BLOCK_OPEN), css.indexOf(NEXT_PORT)));
  assert.deepEqual(block, declarations(uncommented(second)).map(ported), 'the short view\'s block is the second stylesheet, declaration by declaration, renamed');
  assert.equal(block.length, 27, 'twenty-seven declarations');
  assert.deepEqual(port.slice(-27), block, 'the port\'s last');
  assert.ok(!port.some((d) => /\| --[\w-]+:/.test(d)), 'no token declared in the port');
  for (const gone of ['.ts-ps-note', '.ts-ps-brief', '.ts-ps-how']) assert.ok(!css.includes(gone), `${gone}: no rule names it`);
  const read = new Set([...css.slice(css.indexOf(PORT_OPEN), css.indexOf(NEXT_PORT)).matchAll(/var\((--[\w-]+)\)/g)].map((m) => m[1]));
  for (const v of read) if (v !== '--font-sans' && v !== '--font-mono') assert.match(css, new RegExp(`\\n {2}${v}:`), `${v} is in :root`);
});


// ── T3 · THE LIST ────────────────────────────────────────────────────────────

/** A question as the README's table and the reference's form can say it: its words, kind, answers, lone answers, default, required, place. */
type Said = { words: string; kind: string; answers: string[]; alone: string[]; fixed: string | null; required: boolean; more: boolean; follow: boolean };
const saidOf = (q: Question, follow: boolean): Said => ({
  words: q.words, kind: q.kind,
  answers: q.kind === 'one' || q.kind === 'many' ? [...q.answers] : [],
  alone: q.kind === 'many' ? [...q.alone] : [],
  fixed: q.kind === 'one' ? q.fixed : null,
  required: q.required, more: q.more, follow,
});
const listed = (set: readonly Question[]): Said[] => set.flatMap((q) => [saidOf(q, false), ...(q.follow === undefined ? [] : [saidOf(q.follow.question, true)])]);

/** The README's tables, by their headings: "Asked of every service" and each service's title. */
function readmeTables(): Map<string, Said[]> {
  const md = whole(README);
  const part = md.slice(md.indexOf('### Asked of every service'), md.indexOf('\n## Behaviour'));
  const tables = new Map<string, Said[]>();
  for (const section of part.split('\n### ')) {
    const title = section.replace(/^### /, '').split('\n')[0].trim();
    const rows = section.split('\n').filter((l) => l.startsWith('| ') && !l.startsWith('| Question') && !l.startsWith('| ---'));
    tables.set(title, rows.map((row) => {
      const [q, a, r, w] = row.split('|').slice(1, 5).map((cell) => cell.trim());
      const follow = q.startsWith('↳ ');
      const said: Said = { words: follow ? q.slice(2) : q, kind: '', answers: [], alone: [], fixed: null, required: r === 'Yes' || r.startsWith('Yes,'), more: w.startsWith('More details'), follow };
      const pick = /^Pick (one|any): (.*?)(?: \(([^()]*)\))?$/.exec(a);
      if (pick) {
        said.kind = pick[1] === 'one' ? 'one' : 'many';
        said.answers = pick[2].split(' · ');
        const note = pick[3] ?? '';
        const first = /^(.*) at first$/.exec(note);
        if (first) said.fixed = first[1];
        const alone = /^(.*) (?:stands|stand) alone$/.exec(note);
        if (alone) said.alone = alone[1].split(' and ');
      } else {
        const KINDS: ReadonlyArray<readonly [string, string]> = [['A number each', 'counts'], ['A number', 'number'], ['Text, several lines', 'area'], ['Text', 'text'], ['Email', 'email'], ['Web address', 'url'], ['A month', 'month'], ['Links', 'links'], ['A date', 'dated']];
        const kind = KINDS.find(([opens]) => a.startsWith(opens));
        assert.ok(kind, `the README's "${a}" names a kind`);
        said.kind = kind[1];
      }
      return said;
    }));
  }
  return tables;
}

/** The reference's form, read field by field (each .ps-field in order; a follow-up after its group), in a part of the markup. */
function referenceFields(part: string, more: boolean): Said[] {
  const starts = [...part.matchAll(/<div class="ps-field( ps-field--wide)?"( data-follow="([^"]*)")?( data-required)?/g)];
  return starts.map((m, i) => {
    const chunk = part.slice(m.index, i + 1 < starts.length ? starts[i + 1].index : part.length);
    const label = /class="ps-label"[^>]*>([^<]*)</.exec(chunk);
    const said: Said = { words: unescaped(label === null ? '' : label[1]), kind: '', answers: [], alone: [], fixed: null, required: false, more, follow: m[2] !== undefined };
    const group = /<div class="ps-picks"[^>]*data-picks="(one|many)"[^>]*>/.exec(chunk);
    if (group) {
      said.kind = group[1];
      said.required = group[0].includes('data-required');
      for (const b of chunk.matchAll(/<button class="ps-pick" type="button" aria-pressed="(true|false)"( data-alone)?>([^<]*)<\/button>/g)) {
        said.answers.push(unescaped(b[3]));
        if (b[1] === 'true') said.fixed = unescaped(b[3]);
        if (b[2]) said.alone.push(unescaped(b[3]));
      }
    } else if (chunk.includes('class="ps-counts"')) { said.kind = 'counts'; said.required = chunk.includes(' required>'); }
    else if (chunk.includes('class="ps-dated"')) said.kind = 'dated';
    else if (chunk.includes('data-links')) said.kind = 'links';
    else if (chunk.includes('<textarea')) { said.kind = 'area'; said.required = /<textarea[^>]* required/.test(chunk); }
    else {
      const input = /<input class="ps-input[^"]*" id="[^"]*" type="(\w+)"([^>]*)>/.exec(chunk);
      assert.ok(input, `a field: ${chunk.slice(0, 80)}`);
      said.kind = input[1];
      said.required = / required\b/.test(input[2]);
    }
    if (said.follow) said.required = m[4] !== undefined;
    return said;
  });
}
/** The reference's form in its parts: the core, each service's own under it and under More details, How did you find me? last. */
function referenceForm(): { core: Said[]; found: Said[]; sets: Record<string, Said[]> } {
  const html = referenceSection();
  const form = html.slice(html.indexOf('<form class="ps-fields" data-form>'), html.indexOf('</form>'));
  const moreField = form.lastIndexOf('<div class="ps-field', form.indexOf('<button class="ps-more"'));
  const moreOpen = form.indexOf('<div class="ps-fields ps-fields--more" id="ps-more" hidden>');
  const found = form.indexOf('<div class="ps-field ps-field--wide"><span class="ps-label" id="ps-found-label">');
  const main = form.slice(0, moreField);
  const inMore = form.slice(moreOpen, found);
  const setsOf = (part: string, more: boolean): Record<string, Said[]> => Object.fromEntries(part.split('<div class="ps-set" data-set="').slice(1).map((s) => [s.slice(0, s.indexOf('"')), referenceFields(s, more)]));
  const mainSets = setsOf(main, false);
  const moreSets = setsOf(inMore, true);
  return {
    core: referenceFields(main.slice(0, main.indexOf('<div class="ps-set"')), false),
    found: referenceFields(form.slice(found), true),
    sets: Object.fromEntries(SERVICE_NEEDS.map((need) => { assert.ok(mainSets[need] && moreSets[need], `${need}: under the core and under More details`); return [need, [...mainSets[need], ...moreSets[need]]]; })),
  };
}

test('T3 the list is the README\'s tables and the reference\'s form: every question\'s words, kind, answers, lone answers, default, required and place, in order, for the core and each service (rulings c and d)', () => {
  const tables = readmeTables();
  assert.deepEqual([...tables.keys()], ['Asked of every service', ...SERVICES.map((s) => s.title)], 'a table for the core, then one per service, in the panel\'s order');
  const ref = referenceForm();
  const coreListed = [...listed(CORE_QUESTIONS), ...listed([FOUND_QUESTION])];
  // the core's follow-up: its words are the opening answer's — the README's one row names both, the reference's label is empty at rest
  const readmeCore = tables.get('Asked of every service');
  assert.ok(readmeCore, 'the core\'s table');
  const followRow = readmeCore[readmeCore.length - 1];
  assert.equal(followRow.words, 'the follow-up');
  const cell = whole(README).split('\n').find((l) => l.startsWith('| ↳ the follow-up |'));
  assert.ok(cell, 'its follow-up\'s row');
  const follow = FOUND_QUESTION.follow;
  assert.ok(follow !== undefined && follow.wordsBy !== undefined, 'its follow-up\'s words by answer');
  const wordsBy = follow.wordsBy;
  assert.ok(cell.includes(`"${wordsBy.Referral}" for Referral`) && cell.includes(`"${wordsBy.Other}" for Other`), 'its words by answer, as the README names them');
  const strip = (s: Said[]): Said[] => s.map((x) => ({ ...x, words: x.follow && x.words === 'the follow-up' ? '' : x.words }));
  assert.deepEqual(coreListed, strip(readmeCore), 'the core: the README\'s table');
  assert.deepEqual(listed(CORE_QUESTIONS), ref.core, 'the core: the reference\'s form');
  assert.deepEqual(listed([FOUND_QUESTION]), ref.found, 'How did you find me? and its follow-up: the reference\'s form');
  for (const s of SERVICES) {
    const set = SERVICE_QUESTIONS[s.need];
    assert.deepEqual(listed(set), tables.get(s.title), `${s.title}: the README's table`);
    assert.deepEqual(listed(set), ref.sets[s.need], `${s.title}: the reference's form`);
    // a follow-up opens on the answers the reference's data-follow names
    for (const q of set) if (q.follow !== undefined) {
      const opens = new RegExp(`data-follow="${q.follow.when.join('\\|').replace(/[.*+?^${}()[\]\\]/g, '\\$&')}"`);
      assert.match(referenceSection(), opens, `${s.title}: "${q.follow.question.words}" opens on ${q.follow.when.join(', ')}`);
    }
  }
  // no key twice in a set, and none a core's: the body keeps every answer under its own
  for (const need of SERVICE_NEEDS) {
    const keys = questionsOf(SERVICE_QUESTIONS[need]).map((q) => q.key);
    assert.equal(new Set(keys).size, keys.length, `${need}: each key once`);
    for (const key of keys) assert.ok(!(key in CORE_START) && key !== 'website', `${need}: "${key}" is no core key and not the trap's`);
  }
});

// ── T4 · THE SHORT VIEW'S MARKUP ─────────────────────────────────────────────

test('T4 the short view\'s render is the reference\'s section as its script paints it, token for token — at rest, each service picked with More details closed and open, and sent — but for the house prefix, the ids, the honeypot and the data- hooks only its script reads', () => {
  assert.deepEqual(seen(atRest(), false), seen(painted(null), true), 'at rest: nothing picked, the form hidden');
  for (const need of SERVICE_NEEDS) {
    assert.deepEqual(seen(shortAt(need), false), seen(painted(need), true), `${need}: picked, More details closed`);
    assert.deepEqual(seen(shortAt(need, { more: true }), false), seen(painted(need, { more: true }), true), `${need}: More details open`);
    assert.deepEqual(seen(shortAt(need, { sent: SENT_TO }), false), seen(painted(need, { sent: SENT_TO }), true), `${need}: sent — the thank-you in place of the door's words and the fields`);
  }
  // what the comparison sets aside is only what it names: the trap is drawn once, in the form, under its name
  const html = shortAt('setup');
  assert.equal(count(html, 'name="website"'), 1, 'the trap, once');
  assert.match(html, /<div aria-hidden="true" class="absolute -left-\[9999px\] top-auto h-px w-px overflow-hidden"><label for="ps-trap">Website<\/label><input id="ps-trap" type="text" name="website" tabindex="-1" autoComplete="off" value=""\/><\/div>/, '/work-with-me\'s honeypot, as it drew it');
});


// ── T5 · THE TOGGLE ──────────────────────────────────────────────────────────

/** Every element a view draws, depth first — its function components drawn too. */
function drawnElementsOf(node: React.ReactNode): React.ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap((child) => drawnElementsOf(child as React.ReactNode));
  if (!React.isValidElement<Record<string, unknown>>(node)) return [];
  return typeof node.type === 'function' ? drawnElementsOf((node.type as (props: Record<string, unknown>) => React.ReactNode)(node.props)) : [node, ...drawnElementsOf(node.props.children as React.ReactNode)];
}
/** The hook's form for a pick, as a render hands it — for a call of the pure view outside one. */
function formFor(need: ServiceNeed | null): ProposalForm {
  const box: { form?: ProposalForm } = {};
  const Capture = (): null => { box.form = useProposalForm(need); return null; };
  renderToStaticMarkup(React.createElement(Capture));
  assert.ok(box.form, 'the hook was called');
  return box.form;
}

test('T5 a service is a toggle: none at rest; a press picks it; a second press picks none; a press on another moves the pick; Close picks none and hands focus back (ruling a)', () => {
  assert.equal(nextPick(null, 'setup'), 'setup', 'a press picks');
  assert.equal(nextPick('setup', 'setup'), null, 'a second press on it picks none');
  assert.equal(nextPick('setup', 'custom'), 'custom', 'a press on another moves the pick');
  for (const now of [null, ...SERVICE_NEEDS]) for (const pressed of SERVICE_NEEDS) assert.equal(nextPick(now, pressed), now === pressed ? null : pressed);
  const section = code(SECTION);
  assert.match(section, /function ServicesShortHolder\(wholeViewsPick: ServicesViewProps\) \{\n {2}const \[picked, setPicked\] = useState<ServiceNeed \| null>\(null\);\n {2}const form = useProposalForm\(picked\);/, 'the short view\'s own pick, React state, none at rest; the hook handed it');
  assert.ok(section.includes('  const onPick = (need: ServiceNeed) => setPicked((now) => nextPick(now, need));'), 'a tile\'s press is the toggle');
  assert.match(section, /const onClose = \(event: MouseEvent<HTMLButtonElement>\) => \{[\s\S]*?\.find\(\(each\) => each\.dataset\.doneForYou === picked\);\n {4}if \(tile === undefined\) throw new Error\([^\n]*\n {4}setPicked\(null\);\n {4}tile\.focus\(\);\n {2}\};/, 'Close: none picked, focus back on the tile that was — a tile not there refused by name');
  assert.ok(!/useEffect|localStorage|sessionStorage|document\.cookie|searchParams|useRouter|history\./.test(section), 'nothing stored, nothing in the URL, no effect (ruling i)');
  // at rest: no tile pressed, each names the form; a press reaches the toggle with the tile's own service
  const rest = atRest();
  assert.equal(count(rest, 'aria-pressed="true"'), 0, 'at rest nothing is picked');
  assert.equal(count(rest, 'aria-controls="ps-form"'), 6, 'each tile names the form (aria-controls="ps-form")');
  for (const need of SERVICE_NEEDS) {
    const presses: string[] = [];
    const closes: string[] = [];
    const onClose = (): void => { closes.push(need); };
    const drawn = drawnElementsOf(ServicesShortView({ picked: need, onPick: (n) => { presses.push(n); }, form: formFor(need), onClose }));
    const tiles = drawn.filter((el) => el.type === 'button' && typeof el.props['data-done-for-you'] === 'string');
    assert.deepEqual(tiles.map((el) => el.props['aria-pressed']), SERVICE_NEEDS.map((n) => n === need), `${need}: pressed, and only it`);
    for (const tile of tiles) (tile.props.onClick as () => void)();
    assert.deepEqual(presses, [...SERVICE_NEEDS], `${need}: each tile presses its own service`);
    const close = drawn.filter((el) => el.props.className === 'ts-ps-close');
    assert.equal(close.length, 1, `${need}: one Close`);
    (close[0].props.onClick as () => void)();
    assert.deepEqual(closes, [need], `${need}: Close is the holder's`);
  }
});

// ── T6 · THE FORM IN THE PAGE ────────────────────────────────────────────────

test('T6 the form is in the page from the start, hidden while nothing is picked, and never unmounted; the answers are the section\'s, so a close keeps what was typed (ruling i)', () => {
  const rest = atRest();
  assert.equal(count(rest, '<div class="ts-ps-form" id="ps-form" hidden="">'), 1, 'at rest the form is in the page, hidden');
  for (const q of CORE_QUESTIONS) assert.ok(rest.includes(unescaped(q.words)) || rest.includes(esc(q.words).replace(/'/g, '&#x27;')), `its core is drawn at rest: ${q.words}`);
  // the form stands in the page while parts of it hide: no hidden control is required, or the browser would hold every send — a follow-up waits on
  // the button instead (the hook's rule), as the reference's carries data-required on its box and no required on its field
  const requiredHidden = (html: string): string[] => {
    const found: string[] = [];
    const hidden: boolean[] = [];
    for (const tok of rawTokens(html)) {
      if (tok.kind === 'open') {
        const isHidden = attr(tok, 'hidden') !== undefined || hidden.some(Boolean);
        if (attr(tok, 'required') !== undefined && isHidden) found.push(`<${tok.name} ${attr(tok, 'id') ?? attr(tok, 'class') ?? ''}>`);
        hidden.push(attr(tok, 'hidden') !== undefined);
      } else if (tok.kind === 'close') hidden.pop();
    }
    return found;
  };
  for (const need of SERVICE_NEEDS) for (const html of [shortAt(need), shortAt(need, { more: true })]) assert.deepEqual(requiredHidden(html), [], `${need}: no hidden control is required`);
  assert.deepEqual(requiredHidden(atRest()).length > 0, true, 'at rest the hidden form holds its required fields — nothing is sent from it while hidden');
  const section = code(SECTION);
  assert.ok(section.includes('<ServicesForm form={form} door={picked === null ? null : <DoorWords picked={picked} />} onClose={onClose} />'), 'drawn whatever the pick: never unmounted');
  assert.equal(count(section, '<ServicesForm '), 1);
  const hook = code(HOOK);
  assert.ok(hook.includes('const [sets, setSets] = useState<Record<ServiceNeed, Answers>>(startSets);'), 'every service\'s answers kept from the start, each its own');
  assert.ok(hook.includes('const [core, setCore] = useState<CoreAnswers>(CORE_START);'), 'the core\'s, once, carried from service to service');
  assert.ok(hook.includes('setSets((all) => ({ ...all, [picked]: next(all[picked], picked) }));'), 'a change touches the picked service\'s alone');
  // the same holder state, read for two services: each keeps its own; the core is shared
  const sets: Record<ServiceNeed, Answers> = Object.fromEntries(SERVICE_NEEDS.map((n) => [n, startAnswers(n)])) as Record<ServiceNeed, Answers>;
  sets.setup = answerPress('setup', sets.setup, 'who', 'Just me');
  sets.custom = { ...sets.custom, problem: 'A payroll bridge' };
  const core: CoreAnswers = { ...CORE_START, name: 'Ada' };
  assert.equal(proposalBody('setup', core, sets.setup, '').answers.who, 'Just me');
  assert.equal(proposalBody('custom', core, sets.custom, '').answers.problem, 'A payroll bridge');
  assert.equal(proposalBody('custom', core, sets.custom, '').name, proposalBody('setup', core, sets.setup, '').name, 'the core carries');
});


// ── T7 · ONE HOOK, ONE RULE, ONE CHECK ───────────────────────────────────────

const CORE_DONE: CoreAnswers = { ...CORE_START, name: 'Ada Lovelace', email: 'ada@example.com', business: 'Analytical Engines', role: 'I decide' };
/** A service's answers with every required one given — a pick's first answer that opens no follow-up, a count each, a text. */
function complete(need: ServiceNeed): Answers {
  let answers: Answers = startAnswers(need);
  for (const q of SERVICE_QUESTIONS[need]) {
    if (!q.required) continue;
    const opens = (a: string): boolean => q.follow !== undefined && q.follow.when.includes(a);
    if (q.kind === 'one') answers = { ...answers, [q.key]: q.answers.filter((a) => !opens(a))[0] };
    else if (q.kind === 'many') answers = { ...answers, [q.key]: [q.answers.filter((a) => !opens(a) && !q.alone.includes(a))[0]] };
    else if (q.kind === 'counts') answers = { ...answers, [q.key]: Object.fromEntries(q.parts.map((p, i) => [p.key, String(i + 1)])) };
    else answers = { ...answers, [q.key]: 'Twelve units, rent and vendors' };
  }
  return answers;
}
const accepted = (body: object): boolean => { const c = proposalCheck(body as { readonly [k: string]: unknown }); return c.held.length + c.empty.length + c.wrong.length === 0; };
const holds = (q: Question): boolean => q.kind === 'one' || q.kind === 'many' || q.kind === 'counts';

test('T7 both forms read one hook; for each service the rule holds an empty form, holds each required answer missing on its own, frees a complete one — and the route\'s check gives the same verdict on the same bodies, refusing by name (rulings e and f)', () => {
  for (const [file, call] of [[SECTION, 'const form = useProposalForm(picked);'], [PAGE_FORM, 'const form = useProposalForm(need);']] as const) {
    assert.equal(count(code(file), 'useProposalForm('), 1, `${file}: the hook, once`);
    assert.ok(code(file).includes(call), `${file}: ${call}`);
    assert.ok(!/\bfetch\s*\(|JSON\.stringify|proposalBody\(|proposalCheck\(/.test(code(file)), `${file}: no send, no body, no rule of its own`);
  }
  assert.equal(count(code(PAGE_FORM), 'useState'), 2, '/work-with-me keeps its need alone: the import and the one state');
  assert.deepEqual(srcFiles().filter((f) => /\bproposalBody\(|\bproposalHeld\(/.test(code(f))), [HOOK], 'the body and the rule are written once, in the hook');
  assert.ok(code(HOOK).includes('return proposalCheck(body).held.length > 0;'), 'the rule is the check\'s held list, on the body the button would send');
  const route = code(ROUTE);
  assert.match(route, /const found = proposalCheck\(d\);\n {4}const refused = refusedByTheList\(found\);\n {4}if \(refused !== null\) return refused;\n\s*const row = await prisma\.proposals\.create\(/, 'the route refuses on the same check, before the insert');
  assert.ok(route.includes("const issues = [...[...found.held, ...found.empty].map((words) => `${words}: required`), ...found.wrong];"), 'by name');
  for (const need of SERVICE_NEEDS) {
    const empty = proposalBody(need, CORE_START, startAnswers(need), '');
    assert.ok(proposalHeld(empty) && !accepted(empty), `${need}: an empty form is held, and refused`);
    const done = proposalBody(need, CORE_DONE, complete(need), '');
    assert.ok(!proposalHeld(done) && accepted(done), `${need}: a complete form is free, and accepted`);
    assert.ok(accepted(JSON.parse(JSON.stringify(done))), `${need}: as the route reads it, from JSON`);
    for (const q of setOf(need, complete(need))) {
      if (!q.required) continue;
      const missing = proposalBody(need, CORE_DONE, { ...complete(need), [q.key]: startAnswers(need)[q.key] }, '');
      const check = proposalCheck(missing);
      assert.equal(proposalHeld(missing), holds(q), `${need}: "${q.words}" missing ${holds(q) ? 'holds the button' : 'leaves it to the browser\'s required field'}`);
      assert.deepEqual([...check.held, ...check.empty], [q.words], `${need}: the check names "${q.words}", and only it`);
      assert.ok(!accepted(missing), `${need}: the route refuses it`);
    }
    for (const [key, words] of [['role', 'Your part in the decision'], ['name', 'Name'], ['email', 'Email'], ['business', "What's your business? (or: it's just for me)"]] as const) {
      const missing = proposalBody(need, { ...CORE_DONE, [key]: '' }, complete(need), '');
      assert.deepEqual([...proposalCheck(missing).held, ...proposalCheck(missing).empty], [words], `${need}: the core's "${words}" missing, named`);
      assert.equal(proposalHeld(missing), key === 'role', `${need}: the role holds the button; a text is the browser's required field`);
    }
  }
  // the follow-ups hold the button while asked and unanswered — Other's description, the referral's
  const other = { ...complete('setup'), modules: ['Books', 'Other'] };
  assert.deepEqual(proposalCheck(proposalBody('setup', CORE_DONE, other, '')).held, ['What is it?'], 'Other picked: its description holds the button');
  assert.ok(!proposalHeld(proposalBody('setup', CORE_DONE, { ...other, other: 'A payroll bridge' }, '')), 'described: free');
  for (const [found, words] of [['Referral', 'Who referred you? (name)'], ['Other', "Where'd you find me?"]] as const) {
    const body = proposalBody('custom', { ...CORE_DONE, found }, complete('custom'), '');
    assert.equal(body.referralSource, `${found === 'Referral' ? 'referral' : 'other'}: `);
    assert.deepEqual(proposalCheck(body).held, [words], `${found}: its follow-up holds the button`);
    assert.deepEqual(proposalCheck({ ...body, referralSource: (body.referralSource as string).trim() }).held, [words], `${found}: and the route's check, on zod's trimmed string, names it too`);
    assert.ok(accepted(proposalBody('custom', { ...CORE_DONE, found, detail: 'Grace' }, complete('custom'), '')), `${found}: answered, accepted`);
  }
  // what no form sends is refused by name
  const done = proposalBody('setup', CORE_DONE, complete('setup'), '');
  assert.match(proposalCheck({ ...done, answers: { ...done.answers, color: 'red' } }).wrong.join(), /no question asks "color"/);
  assert.match(proposalCheck({ ...done, answers: { ...done.answers, who: 'Everyone' } }).wrong.join(), /Who is it for\?: "Everyone" is not one of its answers/);
  assert.match(proposalCheck({ ...done, answers: { ...done.answers, budget: 'Under $250' } }).wrong.join(), /Budget range: "Under \$250" is not one of its answers/);
  assert.match(proposalCheck({ ...done, referralSource: 'a billboard' }).wrong.join(), /How did you find me\?: "a billboard" is not one of its answers/);
});

// ── T8 · THE BODY ────────────────────────────────────────────────────────────

test('T8 the body: Name, Email, the business and the need in their columns; under answers only the core\'s two and the picked service\'s answered questions; the referral\'s column; nothing under website but the trap (rulings b, m and n)', () => {
  for (const need of SERVICE_NEEDS) {
    const core: CoreAnswers = { ...CORE_DONE, name: '  Ada Lovelace  ', site: 'https://example.com', found: 'Reddit' };
    const body = proposalBody(need, core, complete(need), '');
    assert.deepEqual(Object.keys(body), ['name', 'email', 'business', 'need', 'answers', 'referralSource', 'website'], `${need}: the body's fields, in order`);
    assert.equal(body.name, 'Ada Lovelace', `${need}: texts trimmed`);
    assert.equal(body.website, '', `${need}: the trap, empty — the visitor's site is not under website`);
    assert.equal(body.answers.site, 'https://example.com', `${need}: the visitor's website, under answers as site`);
    assert.equal(body.referralSource, 'Reddit');
    const keys = new Set(['site', 'role', ...questionsOf(setOf(need, complete(need))).map((q) => q.key)]);
    for (const key of Object.keys(body.answers)) assert.ok(keys.has(key), `${need}: "${key}" is the core's two or the service's own`);
    assert.ok(!('website' in body.answers) && !('found' in body.answers) && !('name' in body.answers), `${need}: nothing else under answers`);
    for (const q of setOf(need, complete(need))) {
      const given = complete(need)[q.key];
      const answered = typeof given === 'string' ? given !== '' : Array.isArray(given) ? given.some((r) => r !== '') : Object.values(given).some((v) => v !== '');
      assert.equal(q.key in body.answers, answered, `${need}: "${q.words}" ${answered ? 'answered, sent' : 'unanswered, not sent'}`);
    }
    assert.equal(proposalBody(need, core, complete(need), 'http://spam.example').website, 'http://spam.example', `${need}: a filled trap rides under website, for the route to drop`);
  }
  // a follow-up typed and then closed stays home
  const typed = { ...complete('setup'), who: 'Just me', entities: '4' };
  assert.ok(!('entities' in proposalBody('setup', CORE_DONE, typed, '').answers), 'How many? closed: not sent');
  assert.equal(proposalBody('setup', CORE_DONE, { ...typed, who: 'Several businesses or entities' }, '').answers.entities, '4', 'open: sent');
  // the route keeps the trap's silent drop, by ruling, and stores the check's answers
  const route = code(ROUTE);
  assert.ok(route.includes("const website = (body as Record<string, unknown> | null)?.['website'];") && route.includes('answers: found.answers,'), 'website is the route\'s trap; answers are the check\'s');
});

// ── T9 · THE BANDS ───────────────────────────────────────────────────────────

test('T9 budgets follow the billing: the three project services today\'s bands under Budget range; Monthly maintenance and Bookkeeping their own under Monthly budget; Something else the monthly bands while Something ongoing is its answer (ruling g)', () => {
  const budgetOf = (need: ServiceNeed, answers: Answers): Question => {
    const q = setOf(need, answers).find((x) => x.key === 'budget');
    assert.ok(q && q.kind === 'one', `${need}: a budget`);
    return q;
  };
  const expect: Record<ServiceNeed, { words: string; answers: readonly string[]; fixed: string }> = {
    setup: PROJECT_BANDS, custom: PROJECT_BANDS, embed: PROJECT_BANDS, unsure: PROJECT_BANDS, maintenance: MAINTENANCE_BANDS, bookkeeping: BOOKKEEPING_BANDS,
  };
  for (const need of SERVICE_NEEDS) {
    const q = budgetOf(need, startAnswers(need));
    assert.deepEqual([q.words, q.kind === 'one' ? [...q.answers] : [], q.kind === 'one' ? q.fixed : null], [expect[need].words, [...expect[need].answers], expect[need].fixed], `${need}: its bands`);
    assert.equal(startAnswers(need).budget, expect[need].fixed, `${need}: its default, set at first`);
  }
  assert.deepEqual([PROJECT_BANDS.words, MAINTENANCE_BANDS.words, BOOKKEEPING_BANDS.words], ['Budget range', MONTHLY_BUDGET, MONTHLY_BUDGET]);
  assert.deepEqual([...PROJECT_BANDS.answers], ['<$2k', '$2–10k', '$10–50k', '$50k+', 'not sure'], 'today\'s bands');
  assert.deepEqual([...MAINTENANCE_BANDS.answers], ['Under $250', '$250–750', '$750–2,000', 'More than $2,000', 'Not sure'], 'Alex\'s placeholders');
  assert.deepEqual([...BOOKKEEPING_BANDS.answers], ['Under $300', '$300–600', '$600–1,000', 'More than $1,000', 'Not sure'], 'Alex\'s placeholders');
  // Something ongoing's swap, and back: the budget starts again on the new bands' default
  const ongoing = answerPress('unsure', startAnswers('unsure'), 'closer', ONGOING);
  assert.equal(ongoing.budget, MAINTENANCE_BANDS.fixed);
  assert.equal(budgetOf('unsure', ongoing).words, MONTHLY_BUDGET);
  assert.deepEqual(budgetOf('unsure', ongoing).kind === 'one' ? [...(budgetOf('unsure', ongoing) as Extract<Question, { kind: 'one' }>).answers] : [], [...MAINTENANCE_BANDS.answers]);
  const back = answerPress('unsure', answerPress('unsure', ongoing, 'budget', '$250–750'), 'closer', 'A one-time project');
  assert.equal(back.budget, PROJECT_BANDS.fixed, 'back to a project: the project bands\' default');
  assert.equal(answerPress('unsure', ongoing, 'closer', 'Advice or a second opinion').budget, PROJECT_BANDS.fixed);
  // the route reads them there: a monthly band on a project service is refused, on its own service accepted
  const asked = (need: ServiceNeed, answers: Answers): boolean => accepted(proposalBody(need, CORE_DONE, answers, ''));
  assert.ok(asked('maintenance', { ...complete('maintenance'), budget: '$250–750' }));
  assert.ok(!accepted({ ...proposalBody('setup', CORE_DONE, complete('setup'), ''), answers: { ...proposalBody('setup', CORE_DONE, complete('setup'), '').answers, budget: '$250–750' } }));
  assert.ok(asked('unsure', { ...complete('unsure'), closer: ONGOING, budget: '$250–750' }), 'Something ongoing: a monthly band');
  assert.ok(!accepted({ ...proposalBody('unsure', CORE_DONE, complete('unsure'), ''), answers: { ...proposalBody('unsure', CORE_DONE, complete('unsure'), '').answers, budget: '$250–750' } }), 'a one-time project: not a monthly band');
  // in one place: each band's words typed once, in the list
  for (const words of [...MAINTENANCE_BANDS.answers, ...BOOKKEEPING_BANDS.answers].filter((w) => w !== 'Not sure')) {
    assert.equal(count(code(LEAF), `'${words}'`), 1, `"${words}" typed once, in the list`);
    for (const f of srcFiles().filter((f) => f !== LEAF)) assert.ok(!code(f).includes(`'${words}'`), `${f} types no band`);
  }
  assert.equal(TIMELINE.kind === 'one' ? TIMELINE.fixed : null, 'Exploring', 'Timeline, Exploring at first');
});


// ── T10 · THE MIGRATION ──────────────────────────────────────────────────────

test('T10 the migration adds answers, jsonb, relaxes only the old questions\' columns, and touches no row; the schema moves with it (ruling m)', () => {
  const dirs = readdirSync(resolve(ROOT, 'prisma/migrations')).filter((d) => /^\d{14}_/.test(d)).sort();
  // TIMESHEET-04a (2026-11-27): its migration, 20261127160000_timesheet_04_tag_items_notes (three columns — a vendor's Instagram tag, a plan's planned items, a stop's notes), is the newest now — every position read from the end below moved by one more. COALEVELS-01 (2026-11-27): and its migration, 20261127230000_coa_levels_01_sub_accounts_location (a table of the chart's sub-accounts, and a routine's Location), is the newest now — every position moved by one more again.
  assert.equal(dirs[dirs.length - 3], MIGRATION_DIR, 'the migration before the newest (TIMESHEET-04a followed)');
  const statements = code(MIGRATION).split(';').map(flat).filter(Boolean);
  assert.deepEqual(statements, [
    'ALTER TABLE "proposals" ADD COLUMN "answers" JSONB',
    'ALTER TABLE "proposals" ALTER COLUMN "current_stack" DROP NOT NULL',
    'ALTER TABLE "proposals" ALTER COLUMN "modules" DROP NOT NULL',
    'ALTER TABLE "proposals" ALTER COLUMN "modules" DROP DEFAULT',
    'ALTER TABLE "proposals" ALTER COLUMN "start_window" DROP NOT NULL',
    'ALTER TABLE "proposals" ALTER COLUMN "start_window" DROP DEFAULT',
    'ALTER TABLE "proposals" ALTER COLUMN "budget_range" DROP NOT NULL',
    'ALTER TABLE "proposals" ALTER COLUMN "notes_from_them" DROP NOT NULL',
  ], 'one column added, NULL, no default; five columns lose NOT NULL, two their default — nothing else');
  assert.doesNotMatch(code(MIGRATION), /\b(?:UPDATE|DELETE|INSERT|TRUNCATE|RENAME|CHECK|CONSTRAINT|INDEX)\b|DROP\s+(?:TABLE|COLUMN)/i, 'no row read, changed or deleted; no constraint, no index');
  const schema = code(SCHEMA).split('\n');
  const model = schema.slice(schema.findIndex((l) => l === 'model proposals {'));
  const field = (name: string): string => { const line = model.find((l) => l.trimStart().startsWith(`${name} `)); assert.ok(line, name); return flat(line); };
  assert.equal(field('answers'), 'answers Json?', 'answers: Json, NULL');
  assert.equal(schema[1710].trimEnd(), '  answers        Json?', 'on the line that was blank, so no line below it moved'); // COALEVELS-01 (2026-11-27): the schema grew ABOVE it since (the model chart_of_sub_accounts after chart_of_accounts, and a relation line in users) — index 1683 → 1710; HOME-SERVICES-02 itself still added no line
  assert.equal(field('currentStack'), 'currentStack String? @db.Text @map("current_stack")');
  assert.equal(field('modules'), 'modules Json?', 'no default');
  assert.equal(field('startWindow'), 'startWindow String? @db.VarChar(20) @map("start_window")', 'no default');
  assert.equal(field('budgetRange'), 'budgetRange String? @db.VarChar(50) @map("budget_range")');
  assert.equal(field('notesFromThem'), 'notesFromThem String? @db.Text @map("notes_from_them")');
  for (const kept of ['name String @db.VarChar(255)', 'email String @db.VarChar(255)', 'business String @db.Text', 'ipHash String @db.VarChar(64) @map("ip_hash")']) assert.ok(model.some((l) => flat(l) === kept), `${kept}: as it was`);
});

// ── T11 · THE CRM ────────────────────────────────────────────────────────────

test('T11 the CRM reads a new row\'s answers under their questions\' words, from the list, in its order, and an old row as it reads today (ruling o)', () => {
  const columns = { modules: null, start_window: null, budget_range: null, current_stack: null, hard_deadline: null, deadline_driver: null, links: null, team_size: null, notes_from_them: null };
  const old: ProposalInput = { id: 'p-1', created_at: '2026-11-01T10:00:00.000Z', name: 'Ada', email: 'ada@example.com', business: 'AE', need: 'setup', ...columns, modules: ['books'], start_window: 'now', budget_range: '<$2k', current_stack: 'Sheets', notes_from_them: 'Done', referral_source: null, answers: null };
  const kept = proposalCheck(proposalBody('bookkeeping', { ...CORE_DONE, site: 'https://example.com' }, complete('bookkeeping'), '')).answers;
  const fresh: ProposalInput = { id: 'p-2', created_at: '2026-11-17T10:00:00.000Z', name: 'Grace', email: 'grace@example.com', business: 'Compilers', need: 'bookkeeping', ...columns, referral_source: 'Reddit', answers: kept };
  const [newRow, oldRow] = proposalRowsOf([old, fresh]);
  assert.equal(oldRow.answers, null, 'an old row: no answers');
  assert.deepEqual([oldRow.modules, oldRow.start_window, oldRow.budget_range, oldRow.current_stack, oldRow.notes_from_them], [['books'], 'now', '<$2k', 'Sheets', 'Done'], 'and its columns, as today');
  assert.ok(newRow.answers, 'a new row: its answers');
  const asked = [...CORE_QUESTIONS.filter((q) => !(CORE_COLUMNS as readonly string[]).includes(q.key)), ...questionsOf(setOf('bookkeeping', kept as Answers))];
  assert.deepEqual(newRow.answers.map((a) => a.key), asked.map((q) => q.key).filter((key) => key in kept), 'in the list\'s order');
  for (const a of newRow.answers) assert.equal(a.question, asked.find((q) => q.key === a.key)?.words, `"${a.key}": under its question's words`);
  const counts = newRow.answers.find((a) => a.key === 'accounts');
  assert.ok(counts && /^Bank 1\W+Cards 2\W+Loans 3$/.test(counts.answer), 'a count, by its parts\' words');
  assert.equal(newRow.budget_range, BOOKKEEPING_BANDS.fixed, 'the contacts\' budget, from its answer');
  assert.equal(newRow.modules, null);
  assert.throws(() => proposalRowsOf([{ ...fresh, answers: { ...kept, color: 'red' } }]), (e: unknown) => e instanceof CrmLawError && /answers holds "color"/.test(e.message), 'a key no question asks: refused by name');
  assert.throws(() => proposalRowsOf([{ ...fresh, answers: 'yes' }]), (e: unknown) => e instanceof CrmLawError && /not a set of answers/.test(e.message));
  const route = code('src/app/api/crm/route.ts');
  assert.ok(route.includes('notesFromThem: true, answers: true,') && route.includes('answers: p.answers,'), 'GET /api/crm reads the column');
});

// ── T12 · THE WORDS ──────────────────────────────────────────────────────────

/** Every word the two forms show, from the list. */
function listWords(): string[] {
  const of = (q: Question): string[] => [q.words, ...(q.kind === 'one' || q.kind === 'many' ? q.answers : []), ...(q.kind === 'counts' ? q.parts.map((p) => p.words) : []), ...(q.placeholder === undefined ? [] : [q.placeholder]), ...(q.hint === undefined ? [] : [q.hint]), ...(q.follow === undefined ? [] : [...of(q.follow.question), ...(q.follow.wordsBy === undefined ? [] : Object.values(q.follow.wordsBy))])];
  return [...new Set([
    ...CORE_QUESTIONS.flatMap(of), ...of(FOUND_QUESTION), ...SERVICE_NEEDS.flatMap((n) => SERVICE_QUESTIONS[n].flatMap(of)),
    ...[PROJECT_BANDS, MAINTENANCE_BANDS, BOOKKEEPING_BANDS].flatMap((b) => [b.words, ...b.answers]),
    ...Object.values(FORM_WORDS), FORM_CLOSE, NEED_QUESTION, PROPOSAL_STEPS.read, BOOKKEEPING_WORDS.what, BOOKKEEPING_WORDS.notTax, BOOKKEEPING_WORDS.remedy,
  ])].filter((w) => w.length > 0);
}

test('T12 every word the forms show is the list\'s: no question, word or answer typed in a component; Close one constant; Scoped by proposal nowhere in src (rulings d and k)', () => {
  assert.equal(FORM_CLOSE, 'Close', 'Close, a new word, one constant');
  const words = listWords();
  for (const file of [FORM, SECTION, PAGE_FORM, HOOK]) {
    const src = code(file);
    for (const w of words) assert.ok(!src.includes(`'${w}'`) && !src.includes(`"${w}"`) && !src.includes(`>${w}<`) && !src.includes(`{"${w}"}`), `${file} types "${w.slice(0, 40)}" nowhere`);
    assert.doesNotMatch(src, />[^<>{}\n]*[A-Za-z][^<>{}\n]*<\//, `${file}: no text typed between tags`);
  }
  for (const file of srcFiles()) assert.ok(!code(file).includes('Scoped by proposal'), `${file}: no "Scoped by proposal"`);
  for (const html of [atRest(), ...SERVICE_NEEDS.flatMap((n) => [shortAt(n), shortAt(n, { more: true }), pageForm(n)]), pageForm(null)]) assert.ok(!html.includes('Scoped by proposal'), 'drawn nowhere');
  assert.ok(!code(LEAF).includes('SCOPED_BY_PROPOSAL') && !code(GLOBALS).includes('ts-ps-note'), 'the constant and its rule are gone');
  // the drawn words, read back: each text the panel's form draws for a service is a word of the list or of the doors
  const doors = SERVICES.flatMap((s) => [s.title, s.line, ...(s.kind === null ? [] : [s.kind])]);
  const known = new Set([...words, ...doors, 'Professional Services', 'Hands-on services, tailored to your needs.']);
  for (const need of SERVICE_NEEDS) for (const t of textsOf(shortAt(need, { more: true }))) assert.ok(known.has(t) || t === '.', `${need}: "${t}" is the list's`);
});

// ── T13 · /WORK-WITH-ME ──────────────────────────────────────────────────────

test('T13 /work-with-me asks each door\'s own questions with its own controls; its need question stays and picks the set; More details starts closed; nothing picked, the core alone and the button held (rulings c, d and h)', () => {
  const html = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#x27;').replace(/"/g, '&quot;');
  for (const need of SERVICE_NEEDS) {
    const page = pageForm(need);
    assert.ok(page.includes(`class="${SEGMENT.item(true)}" data-need="${need}"`), `${need}: the need question picks it`);
    for (const q of [...CORE_QUESTIONS, ...SERVICE_QUESTIONS[need].filter((x) => !x.more)]) assert.ok(page.includes(html(q.words)), `${need}: asks "${q.words}"`);
    for (const q of SERVICE_QUESTIONS[need].filter((x) => x.more)) assert.ok(!page.includes(`>${html(q.words)}<`), `${need}: "${q.words}" waits under More details, closed`);
    assert.match(page, new RegExp(`aria-expanded="false"[^>]*>${html(FORM_WORDS.more).replace(/[()]/g, '\\$&')}</button>`), `${need}: More details (optional), closed`);
    assert.ok(page.includes(`class="${CONTROL.input} mt-1 w-full"`), `${need}: the page's inputs`);
    assert.ok(page.includes(`class="${SEGMENT.wrap} mt-1 max-w-full flex-wrap"`), `${need}: the page's single picks`);
    for (const q of SERVICE_QUESTIONS[need].filter((x) => !x.more && x.kind === 'counts')) for (const p of q.kind === 'counts' ? q.parts : []) assert.ok(page.includes(`>${p.words}</span>`), `${need}: a count's part, "${p.words}"`);
    assert.match(page, /<button type="submit" disabled=""/, `${need}: at first the button waits`);
  }
  const none = pageForm(null);
  for (const need of SERVICE_NEEDS) for (const q of SERVICE_QUESTIONS[need]) assert.ok(!none.includes(`>${html(q.words)}<`) || q.words === NEED_QUESTION, `nothing picked: "${q.words}" not asked (Bookkeeping's and Something else's first question share the need question's words)`);
  assert.match(none, /<button type="submit" disabled=""/, 'nothing picked: the button waits for the need');
  assert.equal(proposalCheck(proposalBody(null, CORE_DONE, {}, '')).held[0], NEED_QUESTION, 'held by the need question');
  assert.ok(code(HOOK).includes('const [moreOpen, setMoreOpen] = useState(false);'), 'More details starts closed, in both forms (ruling h)');
});


// ── T14 · THE RULINGS ────────────────────────────────────────────────────────

/** Each file's quotes of the brief — its rulings and Alex's six — counted. */
const CENSUS: Record<string, number> = {
  [THIS]: 9, // Alex's six quotes, under their times; rulings q, r and s whole
  [LEAF]: 5, // rulings c and d over the list, g at the bands, f at the check, k where the note's constant stood
  [HOOK]: 2, // rulings e and h
  [FORM]: 4, // his 09:58 request and his 10:26 approval; ruling b whole; a sentence of ruling i
  [SECTION]: 7, // his 09:58 request and his 10:26 approval; rulings t, j, a, i and l whole
  [PAGE_FORM]: 3, // his 12:08 question and his 12:59 go-ahead; a sentence of ruling d
  [ROUTE]: 2, // ruling n whole; a sentence of ruling f
  [GLOBALS]: 1, // ruling p, over section 7
  [MIGRATION]: 1, // ruling m, in SERVICES-01's idiom
  [CRM]: 1, // ruling o
  'src/lib/__tests__/homeServices01.test.ts': 1, // a sentence of ruling p, at FIFTH
  'src/lib/__tests__/homeTrim03.test.ts': 1, // a sentence of ruling l, at T4
};

/** Where each ruling is built, and quoted whole. */
const BUILT: Readonly<Record<keyof typeof RULING, readonly string[]>> = {
  a: [SECTION], b: [FORM], c: [LEAF], d: [LEAF], e: [HOOK], f: [LEAF], g: [LEAF], h: [HOOK], i: [SECTION], j: [SECTION],
  k: [LEAF], l: [SECTION], m: [MIGRATION], n: [ROUTE], o: [CRM], p: [GLOBALS], q: [THIS], r: [THIS], s: [THIS], t: [SECTION],
};
/** Every source file of the change. */
const CHANGED = [
  THIS, LEAF, HOOK, FORM, SECTION, PAGE_FORM, ROUTE, CRM, GLOBALS, MIGRATION, SCHEMA,
  'src/app/work-with-me/page.tsx', 'src/app/professional-services/page.tsx', 'src/middleware.ts', 'src/components/landing/Landing.tsx',
  'src/components/crm/IntakeFormClient.tsx', 'src/lib/crm/formWords.ts', 'src/lib/crm/crmWords.ts', 'src/app/api/crm/route.ts', 'scripts/assert-tool-registry.ts',
  ...['homeServices01', 'homeTrim03', 'homePages01', 'services01', 'oneForm01', 'crm01', 'crm02'].map((n) => `src/lib/__tests__/${n}.test.ts`),
];

test('T14 each ruling is quoted, exact and whole, where it is built, under the brief\'s stamp; Alex\'s six quotes carry their times; in every source file of the change a quote that follows a sentence of the brief for twenty characters is its words from there, whole or to a full stop, and each file\'s count is held (rulings q, r and s)', () => {
  for (const [letter, files] of Object.entries(BUILT) as Array<[keyof typeof RULING, readonly string[]]>) {
    for (const file of files) {
      const said = prose(file);
      const at = said.indexOf(`"${RULING[letter]}"`);
      assert.ok(at > -1, `${file}: ruling ${letter}, quoted whole`);
      const under = said.slice(said.lastIndexOf('HOME-SERVICES-02', at), at);
      assert.ok(under.includes('2026-11-16') && /\b1[0-3]:\d\d\b|\b09:58\b/.test(under), `${file}: ruling ${letter} under the brief's stamp — "${under.slice(0, 80)}…"`);
    }
  }
  const WORDS = [...QUOTES.map(([, w]) => w), ...Object.values(RULING)];
  const sentencesOf = (text: string): number[] => [0, ...[...text.matchAll(/[.!?] /g)].map((m) => (m.index as number) + 2)];
  const closes = (text: string, n: number): boolean => n === text.length || (/[.!?]/.test(text[n - 1]) && text[n] === ' ');
  const census: Record<string, number> = {};
  for (const file of CHANGED) {
    const said = prose(file);
    for (const [time, words] of QUOTES) for (const m of said.matchAll(new RegExp(`${time}(?: Manila)?: "([^"]+)"`, 'g'))) assert.equal(m[1], words, `${file}: under ${time}, his words, exact`);
    for (let at = said.indexOf('"'); at > -1; at = said.indexOf('"', at + 1)) {
      const rest = said.slice(at + 1);
      let quoted = false;
      let parted = '';
      for (const text of WORDS) for (const from of sentencesOf(text)) {
        let n = 0;
        while (from + n < text.length && rest[n] === text[from + n]) n += 1;
        if (n >= 20 && closes(text, from + n) && rest[n] === '"') quoted = true;
        else if (n >= 20) parted = `"${rest.slice(0, 40)}…" follows the brief for ${n} characters, then parts from it: "${rest.slice(n, n + 24)}"`;
      }
      if (quoted) {
        census[file] = (census[file] ?? 0) + 1;
        const under = said.slice(said.lastIndexOf('HOME-SERVICES-02', at), at);
        assert.ok(under.includes('2026-11-16') && /\b(?:09:58|10:26|12:08|12:59|13:07|13:24)\b/.test(under), `${file}: a quote under the brief's stamp — "${rest.slice(0, 40)}…"`);
      } else assert.equal(parted, '', `${file}: ${parted}`);
    }
  }
  assert.deepEqual(census, CENSUS, 'each file\'s quotes of the brief, counted');
});
