/**
 * HOME-05a (Alex, 2026-11-03) — the 2026 close offer on the home page. ONE-FORM-01 (Alex,
 * 2026-11-06): booked on the proposal form, not by email. HOME-PANELS-01 (Alex, 2026-11-07):
 * the close is a CARD INSIDE the DONE-FOR-YOU panel — its fifth door, last — PRICED BY
 * PROPOSAL: the fixed price left the leaf, the words, the card, the form and the law; the
 * separate close act with its eyebrow, h2 and button is gone. One panel, one button.
 *
 *   T1 the law — the shape { year, bookBy, need }; every refusal by name over a fixture; no
 *      price judged; the live offer passes; it throws by default; the leaf imports nothing
 *      and reads no clock, env or network;
 *   T2 the words — the exact open and closed shapes (chip and priced arrive; price, eyebrow,
 *      headline, button and usd are gone); the book-by line through the one dayWords; the
 *      form href; open through bookBy, closed after it; a malformed day fails loud;
 *   T3 the card, rendered — open: the chip, the title, the five lines in order each once,
 *      ONE <a> at least 44px tall (the card itself) with the form href and
 *      data-done-for-you="close", what it is not at the type size of what it is; closed:
 *      the chip, the title and the closed line — no <a>, no `$`; no "free", "BUY NOW",
 *      "don't miss", countdown, emoji or `new Date(`; nothing typed; no `$` followed by a
 *      digit in the three files;
 *   T4 the mount — once, inside the DONE-FOR-YOU white card after the services grid and
 *      before the button row; no close act, no second button; the eyebrow once and no
 *      "WORK WITH ME"; the h2; the act list and the seam ledger rewritten; the pins that
 *      stay; the law's seat and its line at build; the form's offer block.
 * No live call, no database, no clock.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { code, comments } from '../sourceText';
import { CLOSE_OFFER, CloseOfferLawError, PROPOSAL_FORM_PATH, closeOfferLaw, type CloseOffer } from '../offer/close';
import * as wordsModule from '../offer/closeWords';
import { CloseWordsError, closeChoiceWords, closeFormHref, closeWords } from '../offer/closeWords';
import { dayWords } from '../experienceWords';
import { CLOSE_ANCHOR, CloseOfferCard } from '@/components/landing/CloseOfferCard';

Object.assign(globalThis, { React });

const LEAF = 'src/lib/offer/close.ts';
const WORDS = 'src/lib/offer/closeWords.ts';
const CARD = 'src/components/landing/CloseOfferCard.tsx';
const LANDING = 'src/components/landing/Landing.tsx';
const FORM = 'src/app/work-with-me/WorkWithMeForm.tsx';
const LAW = 'scripts/assert-tool-registry.ts';

const OPEN_DAY = '2026-12-15';
const CLOSED_DAY = '2026-12-16';
const lawOver = (patch: Partial<Record<keyof CloseOffer, unknown>>) => closeOfferLaw({ throwOnFail: false, offer: { ...CLOSE_OFFER, ...patch } as CloseOffer });
const refuses = (patch: Partial<Record<keyof CloseOffer, unknown>>, words: string) => {
  const v = lawOver(patch);
  assert.ok(v.some((line) => line.includes(words)), `expected a violation naming "${words}" for ${JSON.stringify(patch)}, got [${v.join(' | ')}]`);
};
const render = (today: string, offer: CloseOffer = CLOSE_OFFER) => renderToStaticMarkup(React.createElement(CloseOfferCard, { offer, today }));
const textOf = (html: string) => html.replace(/<[^>]+>/g, '\n').split('\n').map((s) => s.trim()).filter(Boolean);
const classOf = (html: string, hook: string) => {
  const m = new RegExp(`<[a-z0-9]+ class="([^"]*)" ${hook}`).exec(html);
  assert.ok(m, `${hook} is rendered with a class`);
  return m[1];
};
const SIZE = /\btext-(?:xs|sm|base|lg|xl|[2-9]xl|\[[^\]]+\])\b/g;
const BANNED: Array<[RegExp, string]> = [
  [/\bfree\b/i, '"free"'], [/buy now/i, '"BUY NOW"'], [/don['’]t miss/i, '"don\'t miss"'], [/countdown|days left|hours left/i, 'a countdown'],
  [/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u, 'an emoji'],
];

const WANT = {
  label: 'Your 2026 books, closed',
  chip: 'THE 2026 CLOSE',
  what: 'I catch up and close your 2026 books: every bank and card account reconciled, every transaction categorized, and a year-end trial balance, profit and loss and balance sheet to hand to whoever files your taxes.',
  priced: 'Priced by proposal — the price follows your books: how many accounts, how many transactions a month.',
  bookBy: 'Book by Dec 15, 2026.',
  notTax: "Bookkeeping, not tax filing or tax advice. I have six years in accounting and I'm a CPA candidate, not a licensed CPA.",
  remedy: 'If a month I closed has to be reopened because of my error, I correct it at no charge.',
  href: '/work-with-me?need=close',
  choice: 'Close my 2026 books',
  done: 'e.g. Every month of 2026 closed, and the year-end statements with my tax preparer by the end of January.',
  closed: 'The 2026 close stopped taking new books on Dec 15, 2026.',
};

// ── T1 · THE LAW ─────────────────────────────────────────────────────────────

test('T1 the live offer is the ruled one — { year, bookBy, need }, no price — and passes; the law throws by default on a failure', () => {
  assert.deepEqual(CLOSE_OFFER, { year: 2026, bookBy: '2026-12-15', need: 'close' });
  assert.ok(!('pricePerMonthUsd' in CLOSE_OFFER), 'HOME-PANELS-01: the fixed price left the leaf');
  assert.equal(PROPOSAL_FORM_PATH, '/work-with-me');
  assert.deepEqual(closeOfferLaw({ throwOnFail: false }), []);
  assert.throws(() => closeOfferLaw({ offer: { ...CLOSE_OFFER, need: '' } }), CloseOfferLawError);
  assert.throws(() => closeOfferLaw({ offer: { ...CLOSE_OFFER, need: '' } }), /CLOSE OFFER LAW failed:\n {2}close offer: need "" is not lower-case letters/);
});

test('T1 every refusal by name, a fixture for each; no price is judged', () => {
  for (const bookBy of ['Dec 15, 2026', '2026-12-5', '2026/12/15', '', 20261215]) refuses({ bookBy }, 'is not YYYY-MM-DD');
  for (const year of [26, 20260, 2026.5, '2026']) refuses({ year }, 'is not four digits');
  refuses({ year: 2025 }, "year 2025 is not bookBy's year (2026-12-15)");
  refuses({ bookBy: '2027-01-10' }, "year 2026 is not bookBy's year (2027-01-10)");
  for (const need of ['', ' ', 'Close', 'close 2026', 'close-2026', 'close?', null, 7]) refuses({ need }, 'is not lower-case letters');
  assert.deepEqual(lawOver({ year: 2027, bookBy: '2027-01-31', need: 'yearend' }), [], 'a different good offer passes');
  // HOME-PANELS-01: the law reads year, bookBy and need alone — a stray price key is neither required nor refused
  assert.deepEqual(closeOfferLaw({ throwOnFail: false, offer: { ...CLOSE_OFFER, pricePerMonthUsd: 0 } as unknown as CloseOffer }), []);
  assert.doesNotMatch(code(LEAF), /pricePerMonthUsd|\busd\b|\$\d/, 'the leaf names no price (its template literals hold $ before braces, never a figure)');
});

test('T1 the leaf is data and the law: zero imports, no clock, no env, no network', () => {
  const leaf = code(LEAF);
  assert.doesNotMatch(leaf, /\bimport\b|\brequire\(/, 'the leaf imports nothing');
  for (const f of [LEAF, WORDS, CARD]) assert.doesNotMatch(code(f), /new Date\(|Date\.now\(|process\.env|fetch\(|toLocale|Intl\./, `${f}: no clock, env, network or locale call`);
  assert.match(leaf, /\ncloseOfferLaw\(\);\s*$/, 'the law runs at module scope');
});

// ── T2 · THE WORDS ───────────────────────────────────────────────────────────

test('T2 the open words: the exact shape — chip and priced in; price, eyebrow, headline, button and usd out; the book-by day through the one dayWords; the form href', () => {
  const w = closeWords(CLOSE_OFFER, OPEN_DAY);
  assert.equal(w.state, 'open');
  if (w.state !== 'open') return;
  assert.deepEqual(w, {
    state: 'open', label: WANT.label, chip: WANT.chip, what: WANT.what, priced: WANT.priced, bookBy: WANT.bookBy,
    notTax: WANT.notTax, remedy: WANT.remedy, choice: WANT.choice, done: WANT.done,
  });
  assert.equal(w.bookBy, `Book by ${dayWords(CLOSE_OFFER.bookBy)}.`);
  assert.equal(closeFormHref(CLOSE_OFFER), WANT.href, 'the card\'s href — the form with the close picked');
  assert.equal(closeFormHref(CLOSE_OFFER), `${PROPOSAL_FORM_PATH}?need=${encodeURIComponent(CLOSE_OFFER.need)}`);
  // CRM-01a (2026-11-07, ruling 6): the chip's words on any day — the open state reads them; the CRM prints them after bookBy too.
  assert.equal(closeChoiceWords(CLOSE_OFFER), WANT.choice);
  assert.equal(closeFormHref({ ...CLOSE_OFFER, need: 'yearend' }), '/work-with-me?need=yearend', 'the href follows the leaf, never typed');
  assert.equal(closeWords({ ...CLOSE_OFFER, year: 2027, bookBy: '2027-01-31' }, '2027-01-01').chip, 'THE 2027 CLOSE', 'the chip follows the leaf');
  assert.doesNotMatch(code(WORDS), /mailto|@templestuart|'\/work-with-me'|"\/work-with-me"/, 'no email, and the path from the leaf');
  // HOME-PANELS-01: no price line, no dollar formatter, no figure — priced by proposal, one sentence
  assert.ok(!('usd' in wordsModule), 'usd retired — nothing imported it from here (AnswersClient.tsx and RunwayBudgetPanel.tsx declare their own)');
  assert.ok(!('price' in w) && !('eyebrow' in w) && !('headline' in w) && !('button' in w), 'the retired fields are gone');
  assert.ok(!/\d|\$/.test(WANT.priced), 'the priced line carries no figure');
  const words = code(WORDS);
  assert.doesNotMatch(words, /\busd\b|pricePerMonthUsd|price:|eyebrow|headline|button|\$\d/, 'the price and the act\'s words are gone from the words module');
  assert.match(words, /import \{ dayWords \} from '\.\.\/experienceWords';/, 'one date formatter in the codebase');
  assert.doesNotMatch(words, /toLocale|Intl\.|new Date\(/);
});

test('T2 open through bookBy, closed the day after: the chip, the title and the closed line, nothing else; a malformed day fails loud', () => {
  for (const day of ['2026-11-03', '2026-12-14', OPEN_DAY]) assert.equal(closeWords(CLOSE_OFFER, day).state, 'open', `${day}: still taking books`);
  for (const day of [CLOSED_DAY, '2027-01-01']) {
    assert.deepEqual(closeWords(CLOSE_OFFER, day), { state: 'closed', label: WANT.label, chip: WANT.chip, closed: WANT.closed }, `${day}: the closed state — no priced line, no remedy`);
  }
  for (const bad of ['Dec 16, 2026', '2026-12-16T00:00:00Z', '']) assert.throws(() => closeWords(CLOSE_OFFER, bad), CloseWordsError);
});

// ── T3 · THE CARD, RENDERED ──────────────────────────────────────────────────

test('T3 open: the chip, the title and the five lines in order, each once; one 44px link — the card itself — to the form with data-done-for-you="close"; what it is not at the type size of what it is', () => {
  const html = render(OPEN_DAY);
  assert.equal(CLOSE_ANCHOR, 'close');
  assert.match(html, /^<div class="mt-4" data-close-block="true"><span class="rounded border border-border px-2 py-0\.5 font-mono text-xs lg:text-\[10px\] font-semibold uppercase tracking-wider text-text-secondary" data-close-chip="true">THE 2026 CLOSE<\/span><a /, "the block, the chip in the PROFESSIONAL SERVICES chip's class, then the card");
  const a = /<a [^>]*>/.exec(html);
  assert.ok(a, 'the card is a link');
  for (const attr of ['id="close"', 'data-done-for-you="close"', 'data-close="open"', 'href="/work-with-me?need=close"']) assert.ok(a[0].includes(attr), attr);
  assert.deepEqual(textOf(html), [WANT.chip, WANT.label, WANT.what, WANT.priced, WANT.bookBy, WANT.notTax.replace("'", '&#x27;'), WANT.remedy], 'top to bottom, each once');
  assert.equal((html.match(/<a\b/g) ?? []).length, 1, 'one link — the card');
  const cls = /<a [^>]*class="([^"]*)"/.exec(html)![1].split(' ');
  assert.ok(cls.includes('min-h-[44px]') && cls.includes('block'), 'at least 44px tall, full width');
  assert.ok(cls.includes('rounded-lg') && cls.includes('border-border') && cls.includes('hover:bg-brand-purple-wash'), "the service cards' card class");
  assert.match(html, /<div class="text-sm font-medium" data-close-title="true">Your 2026 books, closed<\/div>/, "the title in the service cards' title class");
  assert.doesNotMatch(html, /<button\b|<form\b|<input\b|<section\b|<h2\b|mailto:|\$/, 'no act, no h2, no button, no form, no email, no figure');
  assert.deepEqual(classOf(html, 'data-close-not').match(SIZE), classOf(html, 'data-close-what').match(SIZE), 'what it is not: the same type size as what it is');
  assert.deepEqual(classOf(html, 'data-close-what').match(SIZE), ['text-sm']);
  assert.deepEqual(classOf(html, 'data-close-priced').match(SIZE), ['text-sm'], "the priced line at the body size — the what class with the price line's mt-4");
  assert.ok(classOf(html, 'data-close-priced').split(' ').includes('mt-4') && !classOf(html, 'data-close-priced').includes('font-semibold'), 'a sentence, not a figure');
  assert.doesNotMatch(html, /data-close-price[="]|data-close-book[="]/, 'the old hooks are gone — data-close-priced and data-close-book-by stand');
});

test('T3 closed: the chip, the title and the closed line only — not a door: no <a>, no priced line, no `$`', () => {
  const html = render(CLOSED_DAY);
  assert.match(html, /^<div class="mt-4" data-close-block="true"><span class="[^"]*" data-close-chip="true">THE 2026 CLOSE<\/span><div id="close" class="[^"]*" data-close="closed">/);
  assert.deepEqual(textOf(html), [WANT.chip, WANT.label, WANT.closed]);
  assert.doesNotMatch(html, /<a\b|\$|data-close-priced|data-close-book|data-close-remedy|data-close-not|data-close-what|data-done-for-you|mailto:/);
});

test('T3 no "free", "BUY NOW", "don\'t miss", countdown or emoji in either state or in any of the three files; no `new Date(`; no `$` followed by a digit; the card types no words and no hex; the section is gone', () => {
  for (const [html, state] of [[render(OPEN_DAY), 'open'], [render(CLOSED_DAY), 'closed']] as const) {
    for (const [re, what] of BANNED) assert.doesNotMatch(html, re, `${state}: no ${what}`);
  }
  for (const f of [LEAF, WORDS, CARD]) {
    const src = code(f);
    for (const [re, what] of BANNED) assert.doesNotMatch(src, re, `${f}: no ${what}`);
    assert.doesNotMatch(src, /new Date\(/, `${f}: no new Date(`);
    assert.doesNotMatch(src + comments(f), /\$\d/, `${f}: no $ followed by a digit — the price is gone by ruling (HOME-PANELS-01)`);
  }
  const card = code(CARD);
  assert.doesNotMatch(card, /catch up|Bookkeeping, not|no charge|Book the|Priced by|THE 20|WORK WITH ME|books, closed|stopped taking|2026|astuart@|work-with-me|need=|"close"/, 'every word comes from closeWords — none typed here');
  assert.doesNotMatch(card, /#[0-9a-fA-F]{3,8}\b/, 'zero new hex');
  assert.doesNotMatch(card, /useState|useEffect|useSearchParams|useRouter/, 'no state, no effect');
  assert.match(card, /href=\{closeFormHref\(offer\)\}/, 'the href from the words module');
  assert.match(card, /data-done-for-you=\{offer\.need\}/, 'the door\'s word from the leaf');
  assert.ok(!existsSync(resolve(process.cwd(), 'src/components/landing/CloseOfferSection.tsx')), 'the section is gone');
});

// ── T4 · THE MOUNT, THE LEDGERS, THE SEAT ────────────────────────────────────

test('T4 Landing mounts the card once, inside the DONE-FOR-YOU white card after the services grid and before the button row; no close act, no second section, no second button; the eyebrow once, no "WORK WITH ME"; the h2', () => {
  const landing = code(LANDING);
  assert.equal((landing.match(/import CloseOfferMount from '\.\/CloseOfferCard';/g) ?? []).length, 1);
  assert.doesNotMatch(landing, /CloseOfferSection|CloseOfferView/, 'the section and its import are gone');
  const MOUNT = '<CloseOfferMount today={today} />';
  assert.equal(landing.split(MOUNT).length - 1, 1, 'mounted once, with the day Landing was handed');
  const eyebrow = landing.indexOf('DONE-FOR-YOU\n');
  assert.ok(eyebrow > -1);
  assert.equal((landing.match(/DONE-FOR-YOU\n/g) ?? []).length, 1, 'the eyebrow once');
  const sectionEnd = landing.indexOf('</section>', eyebrow);
  const grid = landing.indexOf('<div className="mt-4 grid gap-3 sm:grid-cols-2">', eyebrow);
  const gridEnd = landing.indexOf('</div>', landing.indexOf('))}', grid));
  const mount = landing.indexOf(MOUNT);
  const buttonRow = landing.indexOf('href={PROPOSAL_FORM_PATH}', eyebrow);
  assert.ok(grid > eyebrow && gridEnd > grid && mount > gridEnd && buttonRow > mount && sectionEnd > buttonRow, 'the eyebrow → the services grid → the card → the one button → the section\'s end');
  // code() blanks a JSX comment's words and keeps its braces — the guest law's own allowance.
  assert.match(landing.slice(gridEnd + '</div>'.length, mount), /^\s*(\{\s*\}\s*)*$/, 'nothing but a comment between the grid and the mount');
  assert.equal((landing.slice(eyebrow, sectionEnd).match(/href=\{PROPOSAL_FORM_PATH\}/g) ?? []).length, 1, 'one button');
  assert.doesNotMatch(landing, /WORK WITH ME/);
  assert.doesNotMatch(comments(LANDING), /WORK WITH ME/);
  assert.match(landing, /<h2 className="mt-3 text-2xl sm:text-3xl font-medium tracking-tight text-brand-purple">\n\s*Need help\? Send a proposal\.\n\s*<\/h2>/, 'CLOSED 6: the h2, still typed in Landing');
  assert.doesNotMatch(landing, /Need help setting it up/);
  const pipeline = landing.indexOf('<section aria-label="The pipeline"');
  assert.ok(pipeline > sectionEnd);
  // HOME-PANELS-02 (2026-11-07): THE PLANS sits between DONE-FOR-YOU and the pipeline header now — its one mount and comments, nothing else (homePanels02 pins the order).
  const between = landing.slice(sectionEnd + '</section>'.length, pipeline);
  const PLANS_MOUNT = "<PlansSection door={{ kind: 'button', onClick: () => onRequireAuth() }} />";
  assert.equal(between.split(PLANS_MOUNT).length - 1, 1, 'the plans mount once between');
  assert.match(between.replace(PLANS_MOUNT, ''), /^\s*(\{\s*\}\s*)*$/, 'nothing but a comment and the plans mount between DONE-FOR-YOU and the pipeline header — the close act is gone');
  assert.doesNotMatch(landing, /data-close=|id="close"|CLOSE_ANCHOR/, 'the card renders its own anchor');
  // the act list, the seam note and the seam ledger — rewritten in place, dated
  const notes = comments(LANDING);
  // HOME-PANELS-02 (2026-11-07): THE PLANS' three lines sit between the THE CLOSE note and THE PIPELINE header now.
  assert.match(notes, / \*   \(THE CLOSE {10}— HOME-05a's own act, gone: HOME-PANELS-01, 2026-11-07, folded the 2026 close into DONE-FOR-YOU as its fifth door, priced by proposal\)\n \*   THE PLANS {11}— four plan cards and one comparison table\n[\s\S]{0,200}? \*   THE PIPELINE header — /, 'the act list');
  assert.ok(notes.includes("(the close | pipeline header → gone: HOME-PANELS-01, 2026-11-07 — the close is a card inside done-for-you, its fifth door; HOME-05a, 2026-11-03, had it as a cream act of its own between them, so done-for-you | pipeline header is done-for-you's border-b again, as before HOME-05a)"), 'the seam ledger');
  // HOME-PANELS-02 (2026-11-07): done-for-you moved above the plans — the plans act's border-b closes this seam now.
  assert.ok(notes.includes("plans | pipeline header → the plans act's border-b (HOME-PANELS-02, 2026-11-07: done-for-you moved above the plans; until then done-for-you's border-b closed this seam)"), 'the ledger\'s line for the seam above the header');
  // HOME-PANELS-02 (2026-11-07): the section's seam note re-said for its new neighbours — this edge closes done-for-you|plans; the close seams are history.
  assert.ok(notes.includes("HOME-PANELS-01, 2026-11-07, folded\n            the close into this card as its fifth door; both seams are history.)"), 'the seam note on the section');
  assert.match(notes, /HOME-PANELS-01 \(Alex, 2026-11-07\): THE FIFTH DOOR, LAST/, 'the mount\'s comment');
  assert.match(code(LANDING).split('\n')[1806], /^\s+s08: /, 'Landing.tsx:1807 is still the s08 line — the act line reworded in place');
});

test('T4 the pins that stay: cockpitPerf01\'s three phrases verbatim; the plan law\'s tells absent from Landing\'s code', () => {
  const notes = comments(LANDING);
  for (const phrase of [/THE PLANS\s+— four plan cards and one comparison table/, /id="modules" lives on THE PLANS act/, /said by the four plans below/]) assert.match(notes, phrase);
  const landing = code(LANDING);
  for (const tell of ['heroCountsLine', 'statusCounts', 'numberWord', 'tools, counted', 'SIX LIVES', 'PERSONAS', 'Who is this for?']) assert.ok(!landing.includes(tell), `Landing.tsx carries no "${tell}"`);
  const BEAT_WORDS = ['discover', 'decide', 'commit', 'record'];
  assert.doesNotMatch(landing, new RegExp(`partial\\s*[—-]\\s*(?:${BEAT_WORDS.join('|')})|(?:${BEAT_WORDS.join('|')})\\s*·\\s*(?:${BEAT_WORDS.join('|')})`), 'no beat claim');
});

test('T4 the law\'s seat at build: imported from the leaf and re-run beside the experiences law, before the trip log law; its one line, :710, in place and priced by proposal; the form\'s offer block shows priced', () => {
  const law = code(LAW);
  assert.match(law, /import \{ CLOSE_OFFER, closeOfferLaw \} from '\.\.\/src\/lib\/offer\/close';/);
  const experiences = law.indexOf('violations.push(...experiencesLaw({ throwOnFail: false }));');
  const close = law.indexOf('violations.push(...closeOfferLaw({ throwOnFail: false }));');
  const tripLog = law.indexOf('violations.push(...wasHereLaw({ throwOnFail: false }));');
  assert.ok(experiences > -1 && close > experiences && tripLog > close, 'experiences → the close → the trip log');
  assert.ok(law.includes('`✔ The close offer law passed — the ${CLOSE_OFFER.year} close, new books through ${CLOSE_OFFER.bookBy}, priced by proposal, booked on the proposal form as need "${CLOSE_OFFER.need}" (src/lib/offer/close.ts; ONE-FORM-01; HOME-PANELS-01, 2026-11-07: the fixed price retired).`'), 'the summary line, priced by proposal');
  assert.doesNotMatch(law, /pricePerMonthUsd/);
  assert.match(law.split('\n')[709], /^\{ const before = violations\.length; violations\.push\(\.\.\.closeOfferLaw\(\{ throwOnFail: false \}\)\);/, 'the law\'s one line is still :710 — the deck cites lines below it by number');
  // CLOSED 3: the form's offer block shows `priced` where it showed `price`
  const form = code(FORM);
  assert.match(form, /<p>\{close\.what\}<\/p>\n\s*<p className="mt-2">\{close\.priced\}<\/p>\n\s*<p className="mt-1 font-mono text-xs text-text-secondary">\{close\.bookBy\}<\/p>\n\s*<p className="mt-2">\{close\.notTax\}<\/p>\n\s*<p className="mt-1 text-text-secondary">\{close\.remedy\}<\/p>/, 'what · priced · bookBy · notTax · remedy');
  assert.doesNotMatch(form, /close\.price\b|close\.button|close\.eyebrow|close\.headline|pricePerMonthUsd/);
  const block = form.slice(form.indexOf('data-close-offer'), form.indexOf('</div>', form.indexOf('data-close-offer')));
  assert.doesNotMatch(block, /\$\d/, "no figure in the form's offer block (the form's own budget ranges elsewhere are not the close's price)");
});
