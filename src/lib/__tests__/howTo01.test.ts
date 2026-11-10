/**
 * HOME-BRIEF-03 (Alex, 2026-11-10 18:09; the board he approved on 2026-11-09, "pick what you run") — THE HOW-TO: the home
 * page's services display. What you run picks your plan and your steps, in order, across Personal, Business, Travel and
 * Trade; every status is the tool registry's and the plan is the plans leaf's — never typed.
 *
 *   T1 the law — the live leaf passes; every refusal by name over injected sections, registry and plans; it runs at
 *      module scope;
 *   T2 the plan — the four choices give the four plans' names and audience lines as PLANS holds them; no plan, no line;
 *      the plan's price line and its button's words are its price slot's (HOME-BRIEF-04);
 *   T3 the counts — the steps, how many are live and pending, and how many need Books, computed HERE from the leaf's
 *      steps and the registry and held equal to what the leaf says; a step is LIVE exactly when every tool in it is; the
 *      Books lines follow the Books offer;
 *   T4 the section, rendered for the four choices — the sections shown and hidden, each section's steps in ONE row that
 *      swipes sideways, the card (its step and its state, the title, each tool and its mark, its note — nothing else),
 *      the plan's price line, its button and the link to the four plans, the Travel lines with and without Business,
 *      the two switches, every tool's mark as the registry has it;
 *   T5 the source — the section types no status, no plan name, no price and none of the leaf's words; two switches in
 *      React state only; the leaf is pure;
 *   T6 Landing mounts the section once, in the seat the plans held — under the guest's strip, above the services section.
 * Source is read through code() only (the reader law). No count is typed: each is computed. No clock, no live call.
 *
 * HOME-BRIEF-04 (Alex, 2026-11-10 19:00 · 19:03: "the how-to should replace software plans … cards should be horizontal
 * swipe per P, B, T … clean these cards up") re-pointed this file: the how-to IS the SOFTWARE PLANS block now. Until
 * then — the label read "The how-to"; the section's id was "how-to"; each section's cards stood in a grid (one column,
 * two from sm, four from lg); a card opened with "<Section> · step <n>" and "YOUR STEP <place> OF <N>" and carried the
 * NEEDS BOOKS and NOT ON SALE YET tags; there was no price line, no button and no link to the plans; and Landing
 * mounted <HowToSection /> bare, directly under <PlansSection/>.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { code } from '../sourceText';
import { PRIMARY_CTA, chip } from '../ds';
import { TOOL_REGISTRY, type ToolEntry } from '../toolRegistry';
import { EARLY_ACCESS_CTA, LAUNCH_PLACEHOLDER, PLANS, priceSlot } from '../offer/plans';
import { OFFERS } from '../offer';
import {
  ADD_BUSINESS, ADD_TRADE, COMPARE_PLANS_PATH, COMPARE_PLANS_WORDS, HOW_TO_CHOICES, HOW_TO_EYEBROW, HOW_TO_HEADING, HOW_TO_LINE, HOW_TO_SECTIONS,
  HOW_TO_SECTION_ORDER, HowToLawError, LEGEND_BOOKS_LINE, LEGEND_STEP_LINE, LEGEND_TITLE, NEEDS_BOOKS, NEXT_LINE, PERSONAL_ALWAYS, STEP_LIVE,
  STEP_PENDING, TOOL_MARKS, WHAT_YOU_RUN_LABEL, booksLine, booksNotOnSale, cardStep, howToLaw, howToView, modulesOf, planFor, planLine, priceLine,
  sectionShown, stepsLine, type HowToChoice, type HowToSection,
} from '../howTo';
import { HowToView } from '@/components/landing/HowToSection';
import { PIPELINE_DOOR, PIPELINE_PATH } from '@/components/landing/pipelineWords';

Object.assign(globalThis, { React });

const LEAF = 'src/lib/howTo.ts';
const SECTION = 'src/components/landing/HowToSection.tsx';
const LANDING = 'src/components/landing/Landing.tsx';
const TRIP = 'src/components/landing/WasHereSection.tsx';

/** React's escaping of text. */
const asHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/'/g, '&#x27;').replace(/"/g, '&quot;');
const count = (hay: string, needle: string) => hay.split(needle).length - 1;
/** A string, as a regular expression that matches exactly it. */
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const render = (choice: HowToChoice) => renderToStaticMarkup(React.createElement(HowToView, { choice, onBusiness: () => {}, onTrade: () => {}, onJoin: () => {} }));
/** Every element in a rendered tree, depth first — the pure half is called as a function, so its handlers can be reached. */
function elementsOf(node: React.ReactNode): React.ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap((child) => elementsOf(child as React.ReactNode));
  if (!React.isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...elementsOf(node.props.children as React.ReactNode)];
}
const statusOf = (name: string) => {
  const tool = TOOL_REGISTRY.find((t) => t.name === name);
  assert.ok(tool, `${name} is a registry tool`);
  return tool.status;
};
/** The steps a choice shows, in section order — computed here, from the leaf's steps. */
const shownSteps = (choice: HowToChoice) => HOW_TO_SECTIONS.filter((s) => sectionShown(s.id, choice)).flatMap((s) => s.steps.map((step) => ({ section: s, step })));
const words = (choice: HowToChoice) => `${choice.business ? 'Business on' : 'Business off'}, ${choice.trade ? 'Trade on' : 'Trade off'}`;

// ── T1 · THE LAW ─────────────────────────────────────────────────────────────

test('T1 the law: the live leaf passes; a section out of order, a step misnumbered, a tool that is no registry tool, a registry tool in no step and a choice with no plan are each refused by name; it runs at module scope', () => {
  assert.deepEqual(howToLaw({ throwOnFail: false }), []);
  assert.deepEqual(HOW_TO_SECTIONS.map((s) => s.id), [...HOW_TO_SECTION_ORDER]);
  assert.deepEqual([...HOW_TO_SECTION_ORDER], ['personal', 'business', 'travel', 'trade']);
  for (const s of HOW_TO_SECTIONS) assert.deepEqual(s.steps.map((step) => step.n), s.steps.map((_, i) => i + 1), `${s.id}: its steps run 1..N`);
  // every registry tool stands in a step, and every tool a step names is a registry tool
  const named = new Set(HOW_TO_SECTIONS.flatMap((s) => s.steps.flatMap((step) => step.tools)));
  assert.deepEqual([...named].sort(), TOOL_REGISTRY.map((t) => t.name).sort(), 'the steps name exactly the registry\'s tools');
  // the refusals, by name
  const swapped: HowToSection[] = [HOW_TO_SECTIONS[1], HOW_TO_SECTIONS[0], HOW_TO_SECTIONS[2], HOW_TO_SECTIONS[3]];
  assert.ok(howToLaw({ throwOnFail: false, sections: swapped }).some((v) => /the sections are \[business, personal, travel, trade\], not \[personal, business, travel, trade\]/.test(v)));
  const misnumbered = HOW_TO_SECTIONS.map((s) => (s.id === 'travel' ? { ...s, steps: s.steps.map((step) => (step.n === 2 ? { ...step, n: 5 } : step)) } : s));
  assert.ok(howToLaw({ throwOnFail: false, sections: misnumbered }).some((v) => /travel: step 2 in order is numbered 5/.test(v)));
  const fewer: ToolEntry[] = TOOL_REGISTRY.filter((t) => t.name !== 'Mileage');
  assert.ok(howToLaw({ throwOnFail: false, registry: fewer }).some((v) => /names "Mileage", which is not a registry tool/.test(v)));
  const personalOnly = HOW_TO_SECTIONS.map((s) => (s.id === 'trade' ? { ...s, steps: s.steps.filter((step) => !step.tools.includes('Trade Log')).map((step, i) => ({ ...step, n: i + 1 })) } : s));
  assert.ok(howToLaw({ throwOnFail: false, sections: personalOnly }).some((v) => v === 'Trade Log is in the registry and in no step'));
  const threePlans = PLANS.filter((p) => p.id !== 'everything');
  assert.ok(howToLaw({ throwOnFail: false, plans: threePlans }).some((v) => /\[personal, business, trading\] resolves to 0 plans \(none\), not one/.test(v)));
  assert.throws(() => howToLaw({ plans: threePlans }), (e: unknown) => e instanceof HowToLawError && /howTo law: /.test(e.message), 'it throws by default');
  assert.match(code(LEAF), /^howToLaw\(\);$/m, 'run at module scope');
});

// ── T2 · THE PLAN ────────────────────────────────────────────────────────────

test('T2 what you run picks the plan: the four choices give the four plans — each name and audience line as PLANS holds them, its price line and its button\'s words from its price slot; no matching plan throws by name', () => {
  assert.equal(HOW_TO_CHOICES.length, 4);
  const picked = HOW_TO_CHOICES.map((choice) => planFor(choice));
  assert.deepEqual(picked.map((p) => p.id).sort(), PLANS.map((p) => p.id).sort(), 'the four choices are the four plans, each once');
  for (const choice of HOW_TO_CHOICES) {
    const want = ['personal', ...(choice.business ? ['business'] : []), ...(choice.trade ? ['trading'] : [])];
    assert.deepEqual([...modulesOf(choice)], want, `${words(choice)}: its modules`);
    const plan = PLANS.find((p) => [...p.modules].sort().join() === [...want].sort().join());
    assert.ok(plan, `${words(choice)}: PLANS holds a plan of exactly those modules`);
    assert.equal(planFor(choice), plan);
    assert.equal(howToView(choice).planLine, `Your plan: ${plan.name}. ${plan.audience}`, `${words(choice)}: the plan's name and audience line, from PLANS`);
    assert.equal(planLine(plan), `Your plan: ${plan.name}. ${plan.audience}`);
    // HOME-BRIEF-04 (2026-11-10): the plan itself, and under its line the plan's price line and its button's words — read from priceSlot(plan), never typed
    const view = howToView(choice);
    const slot = priceSlot(plan);
    assert.equal(view.plan, plan, `${words(choice)}: the plan itself`);
    assert.deepEqual(view.price, { line: priceLine(slot), cta: slot.cta }, `${words(choice)}: the price line and the button's words, from the plan's slot`);
    if (plan.price.monthly === null) assert.deepEqual(view.price, { line: LAUNCH_PLACEHOLDER, cta: EARLY_ACCESS_CTA }, `${words(choice)}: no price set — the launch words and the early-access button`);
    // a price on the plan: the line is its figure and its billing note, and the button chooses the plan
    const priced = PLANS.map((p) => ({ ...p, price: { ...p.price, monthly: 29, billingNote: 'billed monthly' } }));
    assert.deepEqual(howToView(choice, { plans: priced }).price, { line: '$29 billed monthly', cta: `Choose ${plan.name}` }, `${words(choice)}: a priced plan`);
  }
  assert.equal(priceLine({ kind: 'unannounced', text: LAUNCH_PLACEHOLDER, cta: EARLY_ACCESS_CTA, bestValue: null }), LAUNCH_PLACEHOLDER);
  assert.equal(priceLine({ kind: 'announced', figure: '$29', compareAt: '$39', discountNote: 'Save 25%', billingNote: 'billed annually', cta: 'Choose it', bestValue: null }), '$29 billed annually');
  assert.equal(priceLine({ kind: 'announced', figure: '$29', compareAt: null, discountNote: null, billingNote: null, cta: 'Choose it', bestValue: null }), '$29', 'no billing note, no trailing word');
  assert.throws(() => planFor({ business: true, trade: true }, PLANS.filter((p) => p.id !== 'everything')), (e: unknown) => e instanceof HowToLawError && /0 plans hold exactly \[personal, business, trading\]/.test(e.message));
  assert.doesNotMatch(code(LEAF), new RegExp(PLANS.map((p) => p.audience.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')), 'the leaf types no audience line');
});

// ── T3 · THE COUNTS ──────────────────────────────────────────────────────────

test('T3 the counts are the registry\'s: steps, live, pending and needs-Books computed here from the leaf\'s steps and held equal to the leaf\'s lines; a step is LIVE exactly when every tool in it is; the Books lines follow the Books offer', () => {
  const gate = booksNotOnSale();
  for (const choice of HOW_TO_CHOICES) {
    const steps = shownSteps(choice);
    const total = steps.length;
    const live = steps.filter(({ step }) => step.tools.every((name) => statusOf(name) === 'LIVE')).length;
    const needBooks = gate ? steps.filter(({ step }) => step.tools.some((name) => NEEDS_BOOKS.includes(name))).length : 0;
    const view = howToView(choice);
    assert.deepEqual([view.total, view.live, view.pending, view.needBooks], [total, live, total - live, needBooks], `${words(choice)}: the four counts`);
    assert.equal(view.stepsLine, `Your steps: ${total}, in order — ${live} live today, ${total - live} pending.`, `${words(choice)}: the steps line`);
    assert.equal(view.stepsLine, stepsLine(total, live));
    assert.equal(view.booksLine, gate ? `${needBooks} of them need Books, and Books isn’t on sale yet.` : null, `${words(choice)}: the Books line, while Books is not on sale`);
    assert.equal(view.legendBooksLine, gate ? LEGEND_BOOKS_LINE : null);
    const cards = view.sections.flatMap((s) => s.cards);
    assert.equal(cards.length, total);
    cards.forEach((card, i) => {
      const { step } = steps[i];
      assert.equal(card.live, step.tools.every((name) => statusOf(name) === 'LIVE'), `${card.step}: LIVE exactly when every tool in it is`);
      assert.deepEqual(card.state, card.live ? STEP_LIVE : STEP_PENDING);
      assert.deepEqual(card.tools.map((t) => [t.name, t.words]), step.tools.map((name) => [name, TOOL_MARKS[statusOf(name)].words]), `${card.step}: each tool's mark is its registry status`);
      assert.equal(card.needsBooks, gate && step.tools.some((name) => NEEDS_BOOKS.includes(name)), `${card.step}: needs Books`);
      // HOME-BRIEF-04 (2026-11-10): a card's first line is its step in its own section — "<Section> · step <n>" and "YOUR STEP <place> OF <N>" until then
      assert.equal(card.n, step.n);
      assert.equal(card.step, `STEP ${step.n}`);
      assert.deepEqual(Object.keys(card).sort(), ['live', 'n', 'needsBooks', 'note', 'state', 'step', 'title', 'tools'], 'no place among your steps and no section name on the card');
    });
  }
  // a registry in which every tool is LIVE makes every step LIVE; one PARTIAL tool makes exactly its steps PENDING
  const allLive: ToolEntry[] = TOOL_REGISTRY.map((t) => ({ ...t, status: 'LIVE' as const }));
  const both = { business: true, trade: true };
  assert.equal(howToView(both, { registry: allLive }).pending, 0);
  const onePartial: ToolEntry[] = allLive.map((t) => (t.name === 'Mileage' ? { ...t, status: 'PARTIAL' as const } : t));
  const pending = howToView(both, { registry: onePartial }).sections.flatMap((s) => s.cards.filter((c) => !c.live).map((c) => `${s.id}-${c.n}`));
  assert.deepEqual(pending, shownSteps(both).filter(({ step }) => step.tools.includes('Mileage')).map(({ section, step }) => `${section.id}-${step.n}`));
  assert.equal(cardStep(3), 'STEP 3');
  // the Books lines follow the offer: with Books on sale nothing says Books; the leaf reads the offer, never a typed flag
  const onSale = howToView(both, { booksOnSale: true });
  assert.equal(onSale.booksLine, null);
  assert.equal(onSale.legendBooksLine, null);
  assert.ok(onSale.sections.flatMap((s) => s.cards).every((c) => !c.needsBooks));
  const books = OFFERS.find((o) => o.key === 'tab:books');
  assert.ok(books, 'the Books offer');
  assert.equal(booksNotOnSale(), books.monthlyPrice === null, 'not on sale exactly while the Books offer holds no price');
  assert.equal(booksNotOnSale(OFFERS.map((o) => (o.key === 'tab:books' ? { ...o, monthlyPrice: 9 } : o))), false, 'a price on the Books offer puts it on sale');
  assert.throws(() => booksNotOnSale(OFFERS.filter((o) => o.key !== 'tab:books')), (e: unknown) => e instanceof HowToLawError);
  assert.equal(booksLine(3), '3 of them need Books, and Books isn’t on sale yet.');
  assert.match(code(LEAF), /const price = priceLineFor\(books, true\);\s*return price\.kind === 'unset' && price\.missing\.includes\('price'\);/, 'read from src/lib/offer.ts');
});

// ── T4 · THE SECTION, RENDERED ───────────────────────────────────────────────

test('T4 rendered for the four choices: the sections shown and hidden, each section\'s steps in one row that swipes sideways, the cleaner card, the plan\'s price line, its button and the link to the four plans, the Travel lines with and without Business, the switches, every mark as the registry has it', () => {
  for (const choice of HOW_TO_CHOICES) {
    const html = render(choice);
    const view = howToView(choice);
    const what = words(choice);
    // HOME-BRIEF-04 (2026-11-10): the section carries id="modules" — the plans act's anchor on this page ('<section id="how-to" …' until then)
    assert.equal(count(html, '<section id="modules" aria-label="How to" class="w-full border-b border-border bg-bg-terminal"'), 1, `${what}: the act, once`);
    assert.equal(count(html, 'id="modules"'), 1, `${what}: the anchor, once`);
    assert.equal(count(html, 'id="how-to"'), 0);
    // the header: the label, the h2, the line, the door
    assert.ok(html.includes(`>${HOW_TO_EYEBROW}</p><h2 class="mt-3 text-2xl sm:text-3xl font-medium tracking-tight text-brand-purple">${asHtml(HOW_TO_HEADING)}</h2>`), `${what}: the label, then the h2`);
    assert.ok(html.includes(asHtml(HOW_TO_LINE)));
    assert.match(html, new RegExp(`<a [^>]*href="${PIPELINE_PATH}"[^>]*>${PIPELINE_DOOR}</a>`), `${what}: the door to the 14 steps`);
    // what you run: Personal is not a button; the two switches are, pressed as the choice says, 44px tall, filled purple when on
    assert.match(html, new RegExp(`<span class="[^"]*" data-how-to-always="true">${PERSONAL_ALWAYS}</span>`), `${what}: Personal · always, not a button`);
    assert.equal(count(html, '<button'), 3, `${what}: three buttons — the two switches and the plan's (HOME-BRIEF-04; two until then)`);
    for (const [key, on, label] of [['business', choice.business, ADD_BUSINESS], ['trade', choice.trade, ADD_TRADE]] as const) {
      const button = new RegExp(`<button type="button" aria-pressed="${on}" class="([^"]*)" data-how-to-switch="${key}">${label.replace('+', '\\+')}</button>`).exec(html);
      assert.ok(button, `${what}: the ${key} switch, aria-pressed=${on}`);
      assert.ok(button[1].split(' ').includes('min-h-[44px]'), `${what}: ${key} is 44px tall`);
      assert.equal(button[1].split(' ').includes('bg-brand-purple'), on, `${what}: ${key} is filled brand purple exactly when on`);
    }
    assert.match(html, new RegExp(`<p class="([^"]*)">${WHAT_YOU_RUN_LABEL}</p>`));
    assert.ok(!(new RegExp(`<p class="([^"]*)">${WHAT_YOU_RUN_LABEL}</p>`).exec(html)?.[1] ?? '').split(' ').includes('uppercase'), `${what}: the label reads as written`);
    // the plan line; right under it the plan's price line; then its button — the page's one filled button — and, beside it, the link to the four plans
    assert.match(html, new RegExp(`data-how-to-plan="true">${esc(asHtml(view.planLine))}</p><p class="[^"]*" data-how-to-price="true">${esc(asHtml(view.price.line))}</p><div class="[^"]*"><button type="button" class="${esc(PRIMARY_CTA)}" data-how-to-cta="${view.plan.id}">${esc(asHtml(view.price.cta))}</button><a [^>]*href="${COMPARE_PLANS_PATH}"[^>]*>${COMPARE_PLANS_WORDS}</a></div>`), `${what}: the plan line → the price line → the button and the link`);
    assert.equal(count(html, asHtml(view.price.cta)), 1, `${what}: one such button`);
    assert.equal(count(html, COMPARE_PLANS_WORDS), 1);
    // the steps line, the Books line
    assert.ok(html.includes(`data-how-to-steps="true">${asHtml(view.stepsLine)}</p>`), `${what}: the steps line`);
    assert.equal(count(html, 'data-how-to-books='), view.booksLine === null ? 0 : 1);
    if (view.booksLine !== null) assert.ok(html.includes(`data-how-to-books="true">${asHtml(view.booksLine)}</p>`));
    // the sections shown and hidden
    const shown = [...html.matchAll(/data-how-to-section="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(shown, HOW_TO_SECTION_ORDER.filter((id) => sectionShown(id, choice)), `${what}: the sections, in order`);
    assert.equal(shown.includes('business'), choice.business);
    assert.equal(shown.includes('trade'), choice.trade);
    assert.ok(shown.includes('personal') && shown.includes('travel'), 'Personal and Travel always');
    // HOME-BRIEF-04 (2026-11-10): ONE row per section, swiped sideways — a flex rail that snaps and scrolls on x, holding every card of its
    // section and nothing else; no grid anywhere (the cards stood in 'mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4' until then)
    const rows = [...html.matchAll(/<div class="([^"]*)" data-how-to-row="([^"]+)">((?:<article [\s\S]*?<\/article>)*)<\/div>/g)];
    assert.deepEqual(rows.map((m) => m[2]), shown, `${what}: one row per section shown`);
    rows.forEach((m, i) => {
      const classes = m[1].split(' ');
      for (const cls of ['flex', 'overflow-x-auto', 'snap-x', 'gap-4']) assert.ok(classes.includes(cls), `${what}: ${m[2]}'s row is ${cls}`);
      assert.ok(!classes.includes('flex-wrap'), `${what}: ${m[2]}'s row never wraps — one row`);
      assert.equal(count(m[3], '<article '), view.sections[i].cards.length, `${what}: ${m[2]}'s row holds every card of its section`);
    });
    for (const m of html.matchAll(/class="([^"]*)"/g)) assert.ok(!m[1].split(' ').some((cls) => cls === 'grid' || /(^|:)grid-cols-/.test(cls)), `${what}: no grid`);
    // off the card and off the page: the place among your steps and the two Books tags (HOME-BRIEF-04; each card carried them until then)
    for (const gone of ['YOUR STEP', ' · step ', 'NOT ON SALE YET', 'data-how-to-place', 'data-how-to-needs-books', 'data-how-to-not-on-sale']) assert.equal(count(html, gone), 0, `${what}: no "${gone}"`);
    assert.equal(count(html, 'NEEDS BOOKS'), view.legendBooksLine === null ? 0 : count(LEGEND_BOOKS_LINE, 'NEEDS BOOKS'), `${what}: "NEEDS BOOKS" is the legend's word alone — on no card`);
    // every card, whole: line one — its step on the left, its own state on the right; the title; each tool on its own line, its name on the
    // left and its mark on the right; its note when it has one — and nothing else. Fixed width, in a row that stretches each to equal height.
    const cards = [...html.matchAll(/<article class="w-\[17rem\] shrink-0 snap-start flex flex-col rounded-lg border border-border bg-white p-5" data-how-to-card="([^"]+)">([\s\S]*?)<\/article>/g)];
    assert.equal(cards.length, view.total, `${what}: one card per step`);
    const expected = view.sections.flatMap((s) => s.cards.map((card) => ({ id: `${s.id}-${card.n}`, card })));
    cards.forEach((m, i) => {
      const { id, card } = expected[i];
      assert.equal(m[1], id);
      const whole = new RegExp(
        `^<p class="([^"]*)"><span class="([^"]*)" data-how-to-step="true">STEP ${card.n}</span><span class="${esc(chip(card.state.tone))}" data-how-to-state="true">${card.live ? STEP_LIVE.words : STEP_PENDING.words}</span></p>`
        + `<h3 class="[^"]*">${esc(asHtml(card.title))}</h3>`
        + `<ul class="[^"]*">${card.tools.map((t) => `<li class="([^"]*)"><span>${esc(asHtml(t.name))}</span><span class="${esc(chip(TOOL_MARKS[statusOf(t.name)].tone))}" data-how-to-mark="${esc(asHtml(t.name))}">${TOOL_MARKS[statusOf(t.name)].words}</span></li>`).join('')}</ul>`
        + `${card.note === null ? '' : `<p class="[^"]*" data-how-to-note="true">${esc(asHtml(card.note))}</p>`}$`,
      ).exec(m[2]);
      assert.ok(whole, `${id}: STEP ${card.n} and its state; the title; each tool with the registry's mark; its note — and nothing else`);
      const [headLine, stepWords, ...toolLines] = whole.slice(1);
      for (const line of [headLine, ...toolLines]) assert.ok(line.split(' ').includes('flex') && line.split(' ').includes('justify-between') && !line.split(' ').includes('flex-wrap'), `${id}: one line, left and right`);
      assert.ok(!stepWords.split(' ').includes('uppercase'), `${id}: the step reads in the case the leaf writes it`);
      assert.equal(toolLines.length, card.tools.length);
    });
    // the Travel lines follow Business
    const travel = HOW_TO_SECTIONS.find((s) => s.id === 'travel');
    assert.ok(travel && typeof travel.line !== 'string' && typeof travel.badge !== 'string');
    const [line, other] = choice.business ? [travel.line.withBusiness, travel.line.withoutBusiness] : [travel.line.withoutBusiness, travel.line.withBusiness];
    assert.ok(html.includes(asHtml(line)) && !html.includes(asHtml(other)), `${what}: Travel's line`);
    const fourth = travel.steps[3].title;
    assert.ok(typeof fourth !== 'string');
    assert.ok(html.includes(`>${choice.business ? fourth.withBusiness : fourth.withoutBusiness}</h3>`) && !html.includes(`>${choice.business ? fourth.withoutBusiness : fourth.withBusiness}</h3>`), `${what}: Travel's fourth step`);
    assert.match(html, new RegExp(`data-how-to-section="travel"><p class="[^"]*"><span class="[^"]*" data-how-to-badge="true">${choice.business ? travel.badge.withBusiness : travel.badge.withoutBusiness}</span>`), `${what}: Travel's badge`);
    // "Next, earn abroad…" only while neither is on, right after Personal's row
    assert.equal(count(html, asHtml(NEXT_LINE)), !choice.business && !choice.trade ? 1 : 0, `${what}: the next line`);
    // the legend — it still says which steps need Books
    assert.ok(html.includes(`>${LEGEND_TITLE}</p>`) && html.includes(asHtml(LEGEND_STEP_LINE)));
    for (const mark of Object.values(TOOL_MARKS)) assert.ok(html.includes(`>${mark.words}</span> ${mark.means}</span>`), `the legend says what ${mark.words} means`);
    assert.equal(count(html, asHtml(LEGEND_BOOKS_LINE)), view.legendBooksLine === null ? 0 : 1);
    // not built, on purpose: no count of the tools, no guide line, no placeholder
    assert.doesNotMatch(html, /\d+ tools\b|\bguide\b|placeholder|coming soon/i);
  }
  // the plan's button opens the door it is handed — and nothing else does
  let joined = 0;
  const tree = elementsOf(HowToView({ choice: { business: true, trade: false }, onBusiness: () => assert.fail('a switch'), onTrade: () => assert.fail('a switch'), onJoin: () => { joined += 1; } }));
  const cta = tree.filter((el) => el.props['data-how-to-cta'] !== undefined);
  assert.equal(cta.length, 1, 'one plan button');
  assert.equal(cta[0].props['data-how-to-cta'], planFor({ business: true, trade: false }).id, 'it names the plan what you run picks');
  (cta[0].props.onClick as () => void)();
  assert.equal(joined, 1, 'the button calls the door once');
});

// ── T5 · THE SOURCE ──────────────────────────────────────────────────────────

test('T5 the section types no status, no plan name, no price and none of the leaf\'s words; its two switches live in React state only; the row is MY TRIP\'s rail; the leaf is pure', () => {
  const section = code(SECTION);
  const flat = section.replace(/\s+/g, ' ');
  for (const status of ['LIVE', 'PARTIAL', 'NOT BUILT', 'NOT_BUILT', 'PENDING']) assert.ok(!section.includes(status), `the section does not type ${status}`);
  for (const plan of PLANS) {
    assert.ok(!flat.includes(`'${plan.name}'`) && !flat.includes(`"${plan.name}"`) && !flat.includes(`>${plan.name}<`), `the section does not type the plan name "${plan.name}"`);
    assert.ok(!flat.includes(plan.audience), `nor its audience line`);
  }
  assert.doesNotMatch(section, /\bPersonal\b|\bBusiness\b|\bTrade\b|\bTravel\b/, 'no section name is typed either');
  // HOME-BRIEF-04 (2026-11-10): the two Books tags left the card and the leaf (NEEDS_BOOKS_TAG, NOT_ON_SALE_TAG stood in this list until then);
  // the link's words and the plan's price words joined — the section types none of them, and no figure
  assert.equal(HOW_TO_EYEBROW, 'Software plans', 'the label — "The how-to" until HOME-BRIEF-04');
  assert.equal(COMPARE_PLANS_WORDS, 'Compare all four plans →');
  assert.equal(COMPARE_PLANS_PATH, '/pricing');
  const typed = [HOW_TO_EYEBROW, HOW_TO_HEADING, HOW_TO_LINE, WHAT_YOU_RUN_LABEL, PERSONAL_ALWAYS, ADD_BUSINESS, ADD_TRADE, NEXT_LINE, COMPARE_PLANS_WORDS, COMPARE_PLANS_PATH, LAUNCH_PLACEHOLDER, EARLY_ACCESS_CTA, 'NEEDS BOOKS', 'NOT ON SALE YET', 'YOUR STEP', LEGEND_TITLE, LEGEND_STEP_LINE, LEGEND_BOOKS_LINE, PIPELINE_DOOR,
    ...HOW_TO_SECTIONS.flatMap((s) => s.steps.flatMap((step) => (typeof step.title === 'string' ? [step.title] : [step.title.withBusiness, step.title.withoutBusiness])))];
  for (const w of typed) assert.ok(!flat.includes(w), `the section does not type "${w.slice(0, 40)}"`);
  assert.doesNotMatch(section, /\$\s?\d/, 'no figure is typed');
  assert.match(section, /^'use client';/);
  assert.match(section, /<section id="modules" aria-label="How to" className="w-full border-b border-border bg-bg-terminal" data-how-to>/, 'the act, as ruled — id="modules" since HOME-BRIEF-04 ("how-to" until then)');
  assert.equal(count(section, 'id="modules"'), 1);
  assert.equal(count(section, 'useState(false)'), 2, 'two switches, both off, in React state');
  assert.doesNotMatch(section, /\buse(Effect|LayoutEffect|Reducer|Ref|Router|SearchParams|Pathname)\b|localStorage|sessionStorage|document\.cookie|window\.|\bfetch\s*\(|new Date\(|Date\.now\(/, 'no storage, no URL, no fetch, no clock');
  assert.doesNotMatch(section, /#[0-9a-fA-F]{3,8}\b/, 'zero new hex');
  assert.match(section, /import \{ PRIMARY_CTA, chip \} from '@\/lib\/ds';/, 'marks through the design system\'s chip; the button is its one filled button (HOME-BRIEF-04 — the import read { chip } until then)');
  assert.equal(count(section, '<button type="button" aria-pressed={'), 2, 'the two switches are real buttons with aria-pressed');
  // the plan's button and the link beside it: the door it is handed, the words and the path from the leaf
  assert.equal(count(section, '<button type="button" onClick={onJoin} className={PRIMARY_CTA} data-how-to-cta={view.plan.id}>{view.price.cta}</button>'), 1, 'the plan\'s button');
  assert.equal(count(section, '<Link href={COMPARE_PLANS_PATH} className={HOW.compare} data-how-to-compare>{COMPARE_PLANS_WORDS}</Link>'), 1, 'the link to the four plans');
  assert.match(section, /export default function HowToSection\(\{ onRequireAuth \}: \{ onRequireAuth: \(\) => void \}\) \{/, 'Landing hands it the door');
  assert.equal(count(section, 'onJoin={onRequireAuth}'), 1, 'and the button gets that door');
  // the card and the row (HOME-BRIEF-04): fixed width, in a flex rail — MY TRIP's, whole but for its top margin; no grid
  assert.match(section, /card: 'w-\[17rem\] shrink-0 snap-start flex flex-col rounded-lg border border-border bg-white p-5',/, "the card — 'rounded-lg border border-border bg-white p-5' in a grid until then");
  const rail = /^\s*list: '([^']*)',$/m.exec(code(TRIP));
  const row = /^\s*row: '([^']*)',$/m.exec(section);
  assert.ok(rail && row, 'the trip rail and the how-to\'s row, each one string');
  assert.ok(rail[1].split(' ').includes('mt-6') && row[1].split(' ').includes('mt-4'));
  assert.equal(row[1], rail[1].replace(' mt-6 ', ' mt-4 '), 'the row is the trip cards\' rail idiom (WasHereSection.tsx TRIP.list)');
  assert.doesNotMatch(section, /\bgrid\b|grid-cols/, 'no grid');
  assert.match(section, /import \{ PIPELINE_DOOR, PIPELINE_PATH \} from '\.\/pipelineWords';/, 'the door\'s words and path from their leaf');
  // the leaf: pure, and it reads the registry, the plans and the offer — never a typed status for a tool, never a plan's words, never a price
  const leaf = code(LEAF);
  assert.doesNotMatch(leaf, /['"]use client['"]|from 'react'|\bfetch\s*\(|new Date\(|Date\.now\(|process\.env|localStorage/, 'the leaf is pure');
  assert.deepEqual([...leaf.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]), ['./problemSheet', './toolRegistry', './offer/plans', './offer']);
  for (const plan of PLANS) assert.ok(!leaf.includes(`'${plan.name}'`) || plan.name === 'Personal', `the leaf does not type the plan name "${plan.name}"`);
  assert.doesNotMatch(leaf, /status: '(LIVE|PARTIAL|NOT_BUILT)'/, 'no tool\'s status is typed in the leaf');
  assert.match(leaf, /const slot = priceSlot\(plan\);/, 'the price line and the button\'s words are read from the plan\'s slot');
  for (const w of [LAUNCH_PLACEHOLDER, EARLY_ACCESS_CTA]) assert.ok(!leaf.includes(w), `the leaf does not type "${w}"`);
  assert.doesNotMatch(leaf, /\$\s?\d/, 'the leaf types no figure');
  for (const gone of ['NEEDS_BOOKS_TAG', 'NOT_ON_SALE_TAG', 'cardWhere', 'cardPlace', 'YOUR STEP']) assert.ok(!leaf.includes(gone), `${gone} left the leaf`);
  // HOME-BRIEF-04 (Alex, 2026-11-10 19:00): four more — Trade Log, Brokerage, Tax, Compliance, each behind a key only Books grants. The six until then.
  assert.deepEqual([...NEEDS_BOOKS], ['Banking', 'Bookkeeping', 'Expenses', 'Bill Pay', 'Budget', 'Tasks', 'Trade Log', 'Brokerage', 'Tax', 'Compliance'], 'the ten tools that need Books');
});

// ── T6 · THE SEAT ────────────────────────────────────────────────────────────

test('T6 Landing mounts the how-to once, with the door — in the seat the plans held: under the guest\'s strip and above the services section, a comment between each; the plans are mounted nowhere on the page', () => {
  const landing = code(LANDING);
  const ONLY_COMMENTS = /^\s*(\{\s*\}\s*)*$/;
  // HOME-BRIEF-04 (Alex, 2026-11-10 19:00): the how-to IS the Software Plans — the plans mount ("<PlansSection door={{ kind: 'button', onClick: () =>
  // onRequireAuth() }} />") left the page, and the how-to, mounted bare ('<HowToSection />') directly under it until then, takes its seat and its door.
  const GUEST_STRIP = '<GuestTripStrip onRequireAuth={onRequireAuth} />';
  const HOW_TO = '<HowToSection onRequireAuth={onRequireAuth} />';
  const SERVICES_OPEN = '<section className="w-full border-b border-border bg-bg-terminal">';
  for (const s of [GUEST_STRIP, HOW_TO, SERVICES_OPEN]) assert.equal(count(landing, s), 1, `${s} once`);
  assert.equal(count(landing, '<HowToSection'), 1);
  assert.equal(count(landing, 'PlansSection'), 0, 'the plans section is neither imported nor mounted here — /pricing keeps it');
  assert.match(landing, /^import HowToSection from '\.\/HowToSection';$/m);
  const [strip, howTo, services] = [GUEST_STRIP, HOW_TO, SERVICES_OPEN].map((s) => landing.indexOf(s));
  assert.ok(strip > -1 && howTo > strip && services > howTo, 'the guest\'s strip → the how-to → the services section');
  assert.match(landing.slice(strip + GUEST_STRIP.length, howTo), ONLY_COMMENTS, 'the guest\'s strip → the how-to: a comment between, nothing else');
  assert.match(landing.slice(howTo + HOW_TO.length, services), ONLY_COMMENTS, 'the how-to → the services section: a comment between, nothing else');
  // /pricing still mounts the plans, under its own anchor
  assert.match(code('src/app/pricing/page.tsx'), /<PlansSection [^>]*headingId="plans"/, '/pricing keeps the four plans and the table');
});
