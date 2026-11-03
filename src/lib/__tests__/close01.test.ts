/**
 * HOME-05a (Alex, 2026-11-03) — the 2026 close offer on the home page, booked by email.
 * One leaf (src/lib/offer/close.ts) and its law; one words module that derives every
 * line; one section mounted directly after DONE-FOR-YOU; the law re-run at build.
 *
 *   T1 the law — every refusal by name over a fixture; the live offer passes; it throws
 *      by default; the leaf imports nothing and reads no clock, env or network;
 *   T2 the words — the price line and its total, the book-by line, the mailto href, the
 *      button's words, every other line exact; open through bookBy, closed after it;
 *      a malformed day fails loud; one dayWords in the codebase;
 *   T3 the section, rendered — open: every line in order, one 44px mailto link, what it
 *      is not at the type size of what it is; closed: the top and the closed line only;
 *      no "free", "BUY NOW", "don't miss", countdown, emoji or `new Date(`; nothing typed;
 *   T4 the mount — after DONE-FOR-YOU's closing tag, before the pipeline header; the act
 *      list and the seam ledger name it; the pins that stay; the law's seat at build.
 * No live call, no database, no clock.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { code, comments } from '../sourceText';
import { CLOSE_OFFER, CloseOfferLawError, closeOfferLaw, type CloseOffer } from '../offer/close';
import { CloseWordsError, closeWords, usd } from '../offer/closeWords';
import { dayWords } from '../experienceWords';
import { CLOSE_ANCHOR, CloseOfferView } from '@/components/landing/CloseOfferSection';

Object.assign(globalThis, { React });

const LEAF = 'src/lib/offer/close.ts';
const WORDS = 'src/lib/offer/closeWords.ts';
const SECTION = 'src/components/landing/CloseOfferSection.tsx';
const LANDING = 'src/components/landing/Landing.tsx';
const LAW = 'scripts/assert-tool-registry.ts';

const OPEN_DAY = '2026-12-15';
const CLOSED_DAY = '2026-12-16';
const lawOver = (patch: Partial<Record<keyof CloseOffer, unknown>>) => closeOfferLaw({ throwOnFail: false, offer: { ...CLOSE_OFFER, ...patch } as CloseOffer });
const refuses = (patch: Partial<Record<keyof CloseOffer, unknown>>, words: string) => {
  const v = lawOver(patch);
  assert.ok(v.some((line) => line.includes(words)), `expected a violation naming "${words}" for ${JSON.stringify(patch)}, got [${v.join(' | ')}]`);
};
const render = (today: string, offer: CloseOffer = CLOSE_OFFER) => renderToStaticMarkup(React.createElement(CloseOfferView, { offer, today }));
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
  eyebrow: 'WORK WITH ME · THE 2026 CLOSE',
  headline: 'Your 2026 books, closed.',
  what: 'I catch up and close your 2026 books: every bank and card account reconciled, every transaction categorized, and a year-end trial balance, profit and loss and balance sheet to hand to whoever files your taxes.',
  price: '$150 for each month of 2026 I close. All twelve months: $1,800.',
  bookBy: 'Book by Dec 15, 2026.',
  notTax: "Bookkeeping, not tax filing or tax advice. I have six years in accounting and I'm a CPA candidate, not a licensed CPA.",
  remedy: 'If a month I closed has to be reopened because of my error, I correct it at no charge.',
  words: 'Email me to book: astuart@templestuart.com',
  href: 'mailto:astuart@templestuart.com?subject=2026%20close',
  closed: 'The 2026 close stopped taking new books on Dec 15, 2026.',
};

// ── T1 · THE LAW ─────────────────────────────────────────────────────────────

test('T1 the live offer is the ruled one and passes; the law throws by default on a failure', () => {
  assert.deepEqual(CLOSE_OFFER, { year: 2026, pricePerMonthUsd: 150, bookBy: '2026-12-15', email: 'astuart@templestuart.com', subject: '2026 close' });
  assert.deepEqual(closeOfferLaw({ throwOnFail: false }), []);
  assert.throws(() => closeOfferLaw({ offer: { ...CLOSE_OFFER, subject: '' } }), CloseOfferLawError);
  assert.throws(() => closeOfferLaw({ offer: { ...CLOSE_OFFER, subject: '' } }), /CLOSE OFFER LAW failed:\n {2}close offer: subject is empty/);
});

test('T1 every refusal by name, a fixture for each', () => {
  for (const price of [0, -150, 150.5, Number.NaN, Number.POSITIVE_INFINITY, '150']) refuses({ pricePerMonthUsd: price }, 'is not a positive integer');
  for (const bookBy of ['Dec 15, 2026', '2026-12-5', '2026/12/15', '', 20261215]) refuses({ bookBy }, 'is not YYYY-MM-DD');
  for (const year of [26, 20260, 2026.5, '2026']) refuses({ year }, 'is not four digits');
  refuses({ year: 2025 }, "year 2025 is not bookBy's year (2026-12-15)");
  refuses({ bookBy: '2027-01-10' }, "year 2026 is not bookBy's year (2027-01-10)");
  for (const email of ['astuart', 'astuart@templestuart', 'a b@templestuart.com', 'astuart@templestuart.c', 'astuart@templestuart.COM', '@templestuart.com', '']) refuses({ email }, 'is not name@domain.tld');
  for (const subject of ['', '   ', null]) refuses({ subject }, 'subject is empty');
  assert.deepEqual(lawOver({ pricePerMonthUsd: 1250, year: 2027, bookBy: '2027-01-31', email: 'books@example.co', subject: 'close' }), [], 'a different good offer passes');
});

test('T1 the leaf is data and the law: zero imports, no clock, no env, no network', () => {
  const leaf = code(LEAF);
  assert.doesNotMatch(leaf, /\bimport\b|\brequire\(/, 'the leaf imports nothing');
  for (const f of [LEAF, WORDS, SECTION]) assert.doesNotMatch(code(f), /new Date\(|Date\.now\(|process\.env|fetch\(|toLocale|Intl\./, `${f}: no clock, env, network or locale call`);
  assert.match(leaf, /\ncloseOfferLaw\(\);\s*$/, 'the law runs at module scope');
});

// ── T2 · THE WORDS ───────────────────────────────────────────────────────────

test('T2 the open words: every line exact, the total derived, the book-by day through the one dayWords, the mailto href', () => {
  const w = closeWords(CLOSE_OFFER, OPEN_DAY);
  assert.equal(w.state, 'open');
  if (w.state !== 'open') return;
  assert.deepEqual(w, {
    state: 'open', label: WANT.label, eyebrow: WANT.eyebrow, headline: WANT.headline, what: WANT.what, price: WANT.price, bookBy: WANT.bookBy,
    notTax: WANT.notTax, remedy: WANT.remedy, button: { words: WANT.words, href: WANT.href },
  });
  assert.equal(w.bookBy, `Book by ${dayWords(CLOSE_OFFER.bookBy)}.`);
  assert.equal(w.button.href, `mailto:${CLOSE_OFFER.email}?subject=${encodeURIComponent(CLOSE_OFFER.subject)}`);
  // the total is the price × 12, grouped by a pure formatter — never typed
  const bigger = closeWords({ ...CLOSE_OFFER, pricePerMonthUsd: 1250 }, OPEN_DAY);
  assert.ok(bigger.state === 'open' && bigger.price === '$1,250 for each month of 2026 I close. All twelve months: $15,000.', 'a bigger price groups its thousands, the total derived');
  for (const [n, words] of [[150, '$150'], [1800, '$1,800'], [999, '$999'], [1000, '$1,000'], [15000, '$15,000'], [1234567, '$1,234,567']] as const) assert.equal(usd(n), words);
  const words = code(WORDS);
  assert.match(words, /import \{ dayWords \} from '\.\.\/experienceWords';/, 'one date formatter in the codebase');
  assert.doesNotMatch(words, /toLocale|Intl\.|new Date\(/);
});

test('T2 open through bookBy, closed the day after: the closed line and nothing else; a malformed day fails loud', () => {
  for (const day of ['2026-11-03', '2026-12-14', OPEN_DAY]) assert.equal(closeWords(CLOSE_OFFER, day).state, 'open', `${day}: still taking books`);
  for (const day of [CLOSED_DAY, '2027-01-01']) {
    assert.deepEqual(closeWords(CLOSE_OFFER, day), { state: 'closed', label: WANT.label, eyebrow: WANT.eyebrow, headline: WANT.headline, closed: WANT.closed }, `${day}: the closed state — no price, remedy or button`);
  }
  for (const bad of ['Dec 16, 2026', '2026-12-16T00:00:00Z', '']) assert.throws(() => closeWords(CLOSE_OFFER, bad), CloseWordsError);
});

// ── T3 · THE SECTION, RENDERED ───────────────────────────────────────────────

test('T3 open: the section, every line in order, one 44px mailto link, what it is not at the type size of what it is', () => {
  const html = render(OPEN_DAY);
  assert.equal(CLOSE_ANCHOR, 'close');
  assert.match(html, /^<section id="close" aria-label="Your 2026 books, closed" class="w-full border-b border-border bg-bg-terminal" data-close="open">/);
  assert.deepEqual(textOf(html), [WANT.eyebrow, WANT.headline, WANT.what, WANT.price, WANT.bookBy, WANT.notTax.replace("'", '&#x27;'), WANT.remedy, WANT.words], 'top to bottom, each once');
  assert.match(html, /<h2 class="mt-3 text-2xl sm:text-3xl font-medium tracking-tight text-brand-purple">Your 2026 books, closed\.<\/h2>/, "the DONE-FOR-YOU act's h2, class for class");
  const links = [...html.matchAll(/<a href="([^"]*)" class="([^"]*)"[^>]*>([^<]*)<\/a>/g)];
  assert.equal(links.length, 1, 'one button-styled link');
  assert.equal((html.match(/<a\b/g) ?? []).length, 1);
  assert.equal(links[0][1], WANT.href);
  assert.ok(links[0][2].split(' ').includes('min-h-[44px]'), 'at least 44px tall');
  assert.equal(links[0][3], WANT.words);
  assert.doesNotMatch(html, /<button\b|<form\b|<input\b/, 'booking is an email — no form');
  assert.deepEqual(classOf(html, 'data-close-not').match(SIZE), classOf(html, 'data-close-what').match(SIZE), 'what it is not: the same type size as what it is');
  assert.deepEqual(classOf(html, 'data-close-what').match(SIZE), ['text-sm']);
});

test('T3 closed: the eyebrow, the h2 and the closed line only — no price, no remedy, no button', () => {
  const html = render(CLOSED_DAY);
  assert.match(html, /^<section id="close" aria-label="Your 2026 books, closed" class="[^"]*" data-close="closed">/);
  assert.deepEqual(textOf(html), [WANT.eyebrow, WANT.headline, WANT.closed]);
  assert.doesNotMatch(html, /<a\b|\$|data-close-price|data-close-book|data-close-remedy|data-close-not|data-close-what|mailto:/);
});

test('T3 no "free", "BUY NOW", "don\'t miss", countdown or emoji in either state or in any of the three files; no `new Date(`; the section types no words and no hex', () => {
  for (const [html, state] of [[render(OPEN_DAY), 'open'], [render(CLOSED_DAY), 'closed']] as const) {
    for (const [re, what] of BANNED) assert.doesNotMatch(html, re, `${state}: no ${what}`);
  }
  for (const f of [LEAF, WORDS, SECTION]) {
    const src = code(f);
    for (const [re, what] of BANNED) assert.doesNotMatch(src, re, `${f}: no ${what}`);
    assert.doesNotMatch(src, /new Date\(/, `${f}: no new Date(`);
  }
  const section = code(SECTION);
  assert.doesNotMatch(section, /catch up|Bookkeeping, not|no charge|Email me|WORK WITH ME|books, closed|stopped taking|\$\d|2026|astuart@/, 'every word comes from closeWords — none typed here');
  assert.doesNotMatch(section, /#[0-9a-fA-F]{3,8}\b/, 'zero new hex');
  assert.doesNotMatch(section, /useState|useEffect|useSearchParams|useRouter/, 'no state, no effect');
});

// ── T4 · THE MOUNT, THE LEDGERS, THE SEAT ────────────────────────────────────

test('T4 Landing mounts the close once, directly after DONE-FOR-YOU\'s closing tag and before the pipeline header; the act list and the seam ledger name it', () => {
  const landing = code(LANDING);
  assert.equal((landing.match(/import CloseOfferSection from '\.\/CloseOfferSection';/g) ?? []).length, 1);
  const MOUNT = '<CloseOfferSection today={today} />';
  assert.equal(landing.split(MOUNT).length - 1, 1, 'mounted once, with the day Landing was handed');
  const done = landing.indexOf('DONE-FOR-YOU\n');
  const doneEnd = landing.indexOf('</section>', done);
  const mount = landing.indexOf(MOUNT);
  const pipeline = landing.indexOf('<section aria-label="The pipeline"');
  assert.ok(done > -1 && doneEnd > done && mount > doneEnd && pipeline > mount, 'done-for-you → the close → the pipeline header');
  // code() blanks a JSX comment's words and keeps its braces — the guest law's own allowance.
  assert.match(landing.slice(doneEnd + '</section>'.length, mount), /^\s*(\{\s*\}\s*)*$/, "nothing but a comment between DONE-FOR-YOU's closing tag and the mount");
  assert.match(landing.slice(mount + MOUNT.length, pipeline), /^\s*(\{\s*\}\s*)*$/, 'nothing but a comment between the mount and the next act');
  const notes = comments(LANDING);
  assert.match(notes, / \*   DONE-FOR-YOU {8}— the professional-services panel\n[\s\S]*? \*   THE CLOSE {11}— the 2026 close offer, booked by email \(HOME-05a\)\n \*   THE PIPELINE header — /, 'the act list: right after DONE-FOR-YOU, before the pipeline header');
  assert.ok(notes.includes("the close | pipeline header → the close's border-b (HOME-05a, 2026-11-03: a cream act, the DONE-FOR-YOU idiom, one rule; done-for-you | the close is done-for-you's border-b)"), 'the seam ledger gains its one line');
});

test('T4 the pins that stay: cockpitPerf01\'s three phrases verbatim; the plan law\'s tells absent from Landing\'s code', () => {
  const notes = comments(LANDING);
  for (const phrase of [/THE PLANS\s+— four plan cards and one comparison table/, /id="modules" lives on THE PLANS act/, /said by the four plans below/]) assert.match(notes, phrase);
  const landing = code(LANDING);
  for (const tell of ['heroCountsLine', 'statusCounts', 'numberWord', 'tools, counted', 'SIX LIVES', 'PERSONAS', 'Who is this for?']) assert.ok(!landing.includes(tell), `Landing.tsx carries no "${tell}"`);
  const BEAT_WORDS = ['discover', 'decide', 'commit', 'record'];
  assert.doesNotMatch(landing, new RegExp(`partial\\s*[—-]\\s*(?:${BEAT_WORDS.join('|')})|(?:${BEAT_WORDS.join('|')})\\s*·\\s*(?:${BEAT_WORDS.join('|')})`), 'no beat claim');
});

test('T4 the law\'s seat at build: imported from the leaf and re-run beside the experiences law, before the trip log law', () => {
  const law = code(LAW);
  assert.match(law, /import \{ CLOSE_OFFER, closeOfferLaw \} from '\.\.\/src\/lib\/offer\/close';/);
  const experiences = law.indexOf('violations.push(...experiencesLaw({ throwOnFail: false }));');
  const close = law.indexOf('violations.push(...closeOfferLaw({ throwOnFail: false }));');
  const tripLog = law.indexOf('violations.push(...wasHereLaw({ throwOnFail: false }));');
  assert.ok(experiences > -1 && close > experiences && tripLog > close, 'experiences → the close → the trip log');
  assert.match(law, /✔ The close offer law passed — /);
});
