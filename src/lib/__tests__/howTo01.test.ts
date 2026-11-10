/**
 * HOME-BRIEF-03 (Alex, 2026-11-10 18:09; the board he approved on 2026-11-09, "pick what you run") — THE HOW-TO: the home
 * page's services display. What you run picks your plan and your steps, in order, across Personal, Business, Travel and
 * Trade; every status is the tool registry's and the plan is the plans leaf's — never typed.
 *
 * HOME-PLANS-01 (Alex, 2026-11-11 00:09: "Four plans. One comparison. Clean, polished, professional." · "Do not display
 * development statuses on the public homepage." · "A checkmark means the capability is part of that plan's intended
 * offering. It does NOT represent implementation status or current availability."): the public section is the pillar,
 * the four plan cards and ONE comparison now. The status view stays in the leaf, undrawn — T1, T2 and T3 hold it as
 * they did. T4 and T5 are rewritten for the new section; T6 keeps every assertion; T7, T8 and T9 are new. T10 holds
 * the one fix the look found: the comparison's box is positioned, so a phone's page does not scroll sideways.
 *
 *   T1 the law — the live leaf passes; every refusal by name over injected sections, registry and plans; it runs at
 *      module scope;
 *   T2 the plan — the four choices give the four plans' names and audience lines as PLANS holds them; no plan, no line;
 *      the plan's price line and its button's words are its price slot's (HOME-BRIEF-04);
 *   T3 the counts — the steps, how many are live and pending, and how many need Books, computed HERE from the leaf's
 *      steps and the registry and held equal to what the leaf says; a step is LIVE exactly when every tool in it is; the
 *      Books lines follow the Books offer;
 *   T4 the section, rendered (HOME-PLANS-01) — at rest: the pillar, the four cards (PlanCards' own render), the table
 *      with Personal open and three closed, 8 step rows and no tool row; with Business open; with a step open — its
 *      tools, their lines and its note; every button's aria-expanded; the marks under each plan for all 26 steps; none
 *      of the status words, the switches' words, the plan line, "Compare all four plans" or the legend in any render;
 *      a card's button opens the door, a toggle calls back with its key; the two sets, through the default export.
 *      (Until then: rendered for the four choices — the pillar, then "What you run" and the two switches, the plan line
 *      with its price line, its button and the link to the four plans, the steps line and the Books line, each
 *      section's steps in ONE row that swiped sideways, the card — its step and its state, the title, each tool and its
 *      mark, its note — the Travel lines with and without Business, and the legend.)
 *   T5 the source (HOME-PLANS-01) — the section types no leaf word, no mark, no status and no price; its only typed
 *      words are its aria-label; two sets in React state only, no storage and no URL; it takes PlanCards and nothing
 *      else from the plans section; the table's box, head row and toggle are the plans table's own idioms; the marks'
 *      colours are never the status colours; the leaf is pure. (Until then: no status, no plan name, no price and none
 *      of the leaf's words; two switches in React state only; the row was MY TRIP's rail.)
 *   T6 Landing mounts the section once — first under "What We Do" (HOME-FINISH-02; under the guest's strip until then),
 *      above the services section. Landing itself never names the plans section: the how-to draws the four cards.
 *   T7 (HOME-PLANS-01, Alex, 2026-11-11 00:09: "Four plans. One comparison.") the four plan cards, exported whole from
 *      the plans section — PlanCards alone stands whole inside PlansSection's render, once, right under its subhead; four
 *      cards in PLANS' order, each with its top label, its name, its two lines, who it is for, three benefits, the
 *      launch placeholder and its door; a button door calls back with the plan's id; a link door draws the link.
 *   T8 (HOME-PLANS-01) the comparison, in the leaf — four columns and their heads; 8 · 9 · 4 · 5 = 26 steps and the
 *      counts' words; the in-plan grid, cell by cell, derived from each plan's modules; every step's title the leaf's;
 *      every tool's line its capability row's label (the plans leaf's — never retyped), the three tools no row names
 *      alone named; the two customer notes present and the build note absent; no status word anywhere in the view; each
 *      new refusal by name; the status view's notes unchanged by the field move.
 *   T9 (HOME-PLANS-01) the guard — one statement at the end of the plan law's line that holds the how-to's anchor
 *      (scripts/assert-tool-registry.ts): a plan that carries a price fails the build, by name; no plan carries one.
 *   T10 (HOME-PLANS-01, the look's fix) the comparison's box holds its own screen-reader text — the box is positioned
 *      and is the one thing in the section that scrolls sideways; every sr-only span the section draws sits inside it,
 *      at rest and with everything open; the plans table's own box is untouched; the reason stands where the class is
 *      typed. (Until then the box was unpositioned: that text was laid out against the page, outside the box's clip,
 *      and a 390 or a 360 screen scrolled sideways to 694 — measured in the look.)
 * Source is read through code() and comments() only (the reader law). No count of what is live is typed: each is
 * computed (T3). The step counts — 8 · 9 · 4 · 5 — are the brief's own figures, held both ways (T8). No clock, no live call.
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
import { code, comments } from '../sourceText';
import { DATA, PRIMARY_CTA } from '../ds';
import { TOOL_REGISTRY, type ToolEntry } from '../toolRegistry';
import { CAPABILITY_GROUPS, EARLY_ACCESS_CTA, LAUNCH_PLACEHOLDER, PLANS, PLANS_SUBHEAD, priceSlot, type Plan } from '../offer/plans';
import { OFFERS } from '../offer';
import {
  ADD_BUSINESS, ADD_TRADE, COMPARE_PLANS_PATH, COMPARE_PLANS_WORDS, COMPARISON_FIRST_HEAD, HOW_TO_CHOICES, HOW_TO_SECTIONS,
  HOW_TO_SECTION_ORDER, HowToLawError, PLAN_HEADS, PLAN_MARKS, categoryHeading, choiceOf, planComparison, stepCountWords, toolLine, LEGEND_BOOKS_LINE, LEGEND_STEP_LINE, LEGEND_TITLE, NEEDS_BOOKS, NEXT_LINE, PERSONAL_ALWAYS, STEP_LIVE,
  STEP_PENDING, TOOL_MARKS, WHAT_YOU_RUN_LABEL, booksLine, booksNotOnSale, cardStep, howToLaw, howToView, modulesOf, planFor, planLine, priceLine,
  sectionShown, stepsLine, type ComparisonCategory, type ComparisonStep, type HowToChoice, type HowToSection, type HowToSectionId,
} from '../howTo';
import { PLAN_PILLAR } from '../homeActWords';
import HowToSectionDefault, { HowToView, stepKey, toggled, type HowToViewProps } from '@/components/landing/HowToSection';
import PlansSection, { PlanCards } from '@/components/offer/PlansSection';
import { PIPELINE_DOOR, PIPELINE_PATH } from '@/components/landing/pipelineWords';

Object.assign(globalThis, { React });

const LEAF = 'src/lib/howTo.ts';
const PLANS_SECTION = 'src/components/offer/PlansSection.tsx';
const PRICING = 'src/app/pricing/page.tsx';
const SECTION = 'src/components/landing/HowToSection.tsx';
const LANDING = 'src/components/landing/Landing.tsx';
const LAW = 'scripts/assert-tool-registry.ts';

/** React's escaping of text. */
const asHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/'/g, '&#x27;').replace(/"/g, '&quot;');
const count = (hay: string, needle: string) => hay.split(needle).length - 1;
/** A string, as a regular expression that matches exactly it. */
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** What is open in the comparison: the categories, and the steps by their keys. */
type Open = { categories: readonly HowToSectionId[]; steps: readonly string[] };
/** The comparison's box, as it is drawn: positioned, and the one thing in the section that scrolls sideways (T4, T10). */
const BOX_TAG = '<div class="relative mt-8 overflow-x-auto rounded-lg border border-border bg-white" data-plan-comparison="true">';
/** The pure half, rendered for one open state. (Until HOME-PLANS-01 it took a choice and the two switches' handlers.) */
const render = (open: Open) => renderToStaticMarkup(React.createElement(HowToView, { openCategories: new Set(open.categories), openSteps: new Set(open.steps), onCategory: () => {}, onStep: () => {}, onJoin: () => {} }));
/**
 * Every element in a tree, depth first, with each PURE function component called so what it draws can be reached (the
 * plan cards' PriceSlot and Door hold no hook). Anything that is not a plain function — next/link's Link — is left as it is.
 */
function drawnElementsOf(node: React.ReactNode): React.ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap((child) => drawnElementsOf(child as React.ReactNode));
  if (!React.isValidElement<Record<string, unknown>>(node)) return [];
  if (typeof node.type === 'function') return drawnElementsOf((node.type as (props: Record<string, unknown>) => React.ReactNode)(node.props));
  return [node, ...drawnElementsOf(node.props.children as React.ReactNode)];
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

/** The marks' classes as drawn (HowToSection.tsx HOW): ✓ in brand purple, — in faint ink. */
const MARK_IN = 'font-mono text-sm text-brand-purple';
const MARK_OUT = 'font-mono text-sm text-text-faint';
/** The words no render of the public block may hold: every status word, and the two phrases that count what is live or for sale. */
const NO_STATUS = ['LIVE', 'PENDING', 'PARTIAL', 'NOT BUILT', 'NOT_BUILT', 'NEEDS BOOKS', 'on sale', 'live today'];
/** Any class attribute — the classes that matter are pinned by name where they matter. */
const C = 'class="[^"]*"';
/** One cell per plan: its mark, hidden from a screen reader, and the words the screen reader hears. */
const marksHtml = (inPlan: readonly boolean[]) => PLANS.map((plan, j) => {
  const mark = inPlan[j] ? PLAN_MARKS.inPlan : PLAN_MARKS.notInPlan;
  return `<td class="px-2 py-2 text-center" data-comparison-mark="${plan.id}" data-in-plan="${inPlan[j]}"><span aria-hidden="true" class="${inPlan[j] ? MARK_IN : MARK_OUT}">${mark.mark}</span><span class="sr-only">${mark.label}</span></td>`;
}).join('');
/** The comparison's rows for one open state, as a regular expression source — built from the leaf's view, row by row. */
const SPAN = 1 + PLANS.length;
const sign = (open: boolean) => (open ? '−' : '\\+');
const categoryRow = (c: ComparisonCategory, open: boolean) => `<tr ${C}><th scope="row" ${C}><button type="button" aria-expanded="${open}" ${C} data-comparison-toggle="${c.id}"><span>${esc(asHtml(c.heading))}</span><span aria-hidden="true" ${C}>${sign(open)}</span></button></th>${esc(marksHtml(c.inPlan))}</tr>`;
const lineRow = (c: ComparisonCategory) => `<tr ${C}><td col[sS]pan="${SPAN}" ${C} data-comparison-line="true">${esc(asHtml(c.line))}</td></tr>`;
const stepRow = (c: ComparisonCategory, step: ComparisonStep, open: boolean) => `<tr ${C} data-comparison-step="${stepKey(c.id, step.n)}"><th scope="row" ${C}><button type="button" aria-expanded="${open}" ${C} data-comparison-step-toggle="${stepKey(c.id, step.n)}"><span ${C}><span ${C}>${step.n}</span><span>${esc(asHtml(step.title))}</span></span><span aria-hidden="true" ${C}>${sign(open)}</span></button></th>${esc(marksHtml(c.inPlan))}</tr>`;
const toolsRow = (c: ComparisonCategory, step: ComparisonStep) => `<tr ${C}><td col[sS]pan="${SPAN}" ${C} data-comparison-tools="${stepKey(c.id, step.n)}"><ul ${C}>${step.tools.map((t) => `<li ${C}><span ${C}>${esc(asHtml(t.name))}</span><span ${C}>${esc(asHtml(t.line))}</span></li>`).join('')}</ul>${step.note === null ? '' : `<p ${C} data-comparison-note="true">${esc(asHtml(step.note))}</p>`}</td></tr>`;
const bodyRows = (c: ComparisonCategory, open: Open) => {
  const isOpen = open.categories.includes(c.id);
  const steps = c.steps.map((step) => stepRow(c, step, open.steps.includes(stepKey(c.id, step.n))) + (open.steps.includes(stepKey(c.id, step.n)) ? toolsRow(c, step) : '')).join('');
  return `<tbody data-comparison-category="${c.id}" data-comparison-open="${isOpen}">${categoryRow(c, isOpen)}${isOpen ? lineRow(c) + steps : ''}</tbody>`;
};

test('T4 (HOME-PLANS-01) the section, rendered: at rest — the pillar, the four cards, the table with Personal open and three closed, 8 step rows and no tool row; with Business open; with a step open — its tools, their lines and its note; every button\'s aria-expanded; the marks under each plan for all 26 steps; no status word, no switch, no plan line, no link to the plans and no legend in any render; the door and the toggles call back; the two sets live in the default export', () => {
  const view = planComparison();
  const AT_REST: Open = { categories: ['personal'], steps: [] };
  const BUSINESS_OPEN: Open = { categories: ['personal', 'business'], steps: [] };
  const STEPS_OPEN: Open = { categories: ['personal', 'business'], steps: ['personal-5', 'business-1'] };
  const ALL_OPEN: Open = { categories: [...HOW_TO_SECTION_ORDER], steps: view.categories.flatMap((c) => c.steps.map((step) => stepKey(c.id, step.n))) };
  /** The whole table, for one open state: the head row, then one <tbody> per category — and nothing else. */
  const table = (open: Open) => new RegExp(`<table ${C}><thead>[\\s\\S]*?</thead>${view.categories.map((c) => bodyRows(c, open)).join('')}</table>`);

  // AT REST — the default export's own first render is the pure half with Personal open and no step open
  const rest = renderToStaticMarkup(React.createElement(HowToSectionDefault, { onRequireAuth: () => {} }));
  assert.equal(rest, render(AT_REST), 'Personal starts open; Business, Travel and Trade start closed; no step starts open');
  // the act: its id (the checkout's cancel link, /modules and the footer's first link land on it), its new aria-label, its classes
  assert.equal(count(rest, '<section id="modules" aria-label="Software plans" class="w-full border-b border-border bg-bg-terminal" data-how-to="true">'), 1, 'the act, once — aria-label "How to" until HOME-PLANS-01');
  assert.equal(count(rest, 'id="modules"'), 1, 'the anchor, once');
  // 1. the pillar, untouched (HOME-FINISH-02) → 2. the four cards, exactly PlanCards' own render with a button door → 3. the comparison; nothing between, nothing after
  const pillar = `<div class="max-w-7xl mx-auto px-4 lg:px-8 pt-6 pb-10"><h2 class="text-2xl sm:text-3xl font-medium tracking-tight text-brand-purple">${asHtml(PLAN_PILLAR.heading)}</h2>`
    + PLAN_PILLAR.paragraphs.map((words) => `<p class="mt-3 max-w-3xl text-base text-text-secondary">${asHtml(words)}</p>`).join('');
  const cards = renderToStaticMarkup(React.createElement(PlanCards, { door: { kind: 'button', onClick: () => {} } }));
  // (Until the look's fix the box's classes opened with `mt-8` — it was not positioned; see T10.)
  const BOX_OPEN = `${BOX_TAG}<table class="w-full min-w-[720px] table-fixed text-sm">`;
  assert.ok(rest.includes(`data-how-to="true">${pillar}${cards}${BOX_OPEN}<thead>`), 'the pillar → the four cards → the comparison, nothing between');
  assert.ok(rest.endsWith('</tbody></table></div></div></section>'), 'and nothing after the table');
  assert.equal(count(rest, '<h2'), 1, 'one h2 — the pillar\'s');
  assert.equal(count(rest, '<table'), 1, 'one table');
  assert.equal(count(rest, 'data-plan='), PLANS.length, 'four cards');
  for (const plan of PLANS) assert.equal(count(rest, `<button type="button" class="${PRIMARY_CTA}" data-plan-cta="${plan.id}">${asHtml(priceSlot(plan).cta)}</button>`), 1, `${plan.id}: its card's button`);
  // the head row: the first head, then the four plans — a short head to read, the plan's full name for a screen reader
  const head = /<thead><tr class="border-b border-border bg-bg-row text-left align-top">([\s\S]*?)<\/tr><\/thead>/.exec(rest);
  assert.ok(head, 'the head row, in the plans table\'s own thead classes');
  assert.equal(head[1], `<th scope="col" class="px-3 py-3 text-left ${DATA.columnHeader}">${asHtml(COMPARISON_FIRST_HEAD)}</th>`
    + view.columns.map((c) => `<th scope="col" class="w-[6.5rem] px-2 py-3 text-center text-sm font-semibold text-brand-purple" data-comparison-column="${c.id}"><span aria-hidden="true">${asHtml(c.head)}</span><span class="sr-only">${asHtml(c.name)}</span></th>`).join(''), 'Step / Capability · Personal · P + Business · P + Trading · All');
  // the rows at rest: four categories, Personal open with its line and its 8 steps, no tool row
  assert.match(rest, table(AT_REST), 'at rest: every row, as the leaf says it');
  assert.deepEqual([...rest.matchAll(/<tbody data-comparison-category="([^"]+)" data-comparison-open="(true|false)">/g)].map((m) => `${m[1]} ${m[2]}`), ['personal true', 'business false', 'travel false', 'trade false']);
  assert.equal(count(rest, 'data-comparison-step='), view.categories[0].count, 'Personal\'s step rows');
  assert.equal(view.categories[0].count, 8);
  assert.equal(count(rest, 'data-comparison-tools='), 0, 'no tool row at rest');
  assert.equal(count(rest, 'data-comparison-line='), 1, 'Personal\'s line, once');
  assert.equal(count(rest, 'aria-expanded="true"'), 1, 'one thing open: Personal');
  assert.equal(count(rest, 'aria-expanded="false"'), 3 + view.categories[0].count, 'three categories and Personal\'s steps, each closed');
  assert.equal(count(rest, '<button'), PLANS.length + 4 + view.categories[0].count, 'the cards\' four buttons, four categories, Personal\'s steps — and no other button');
  for (const c of view.categories) assert.ok(rest.includes(`data-comparison-toggle="${c.id}"><span>${c.heading}</span>`), `${c.heading}`);
  // every toggle is a real button, at least 44px tall, with a focus ring
  const toggles = [...rest.matchAll(/<button type="button" aria-expanded="(?:true|false)" class="([^"]*)" data-comparison-(?:step-)?toggle="[^"]+">/g)];
  assert.equal(toggles.length, 4 + view.categories[0].count);
  for (const m of toggles) for (const cls of ['min-h-[44px]', 'w-full', 'focus-visible:ring-2', 'focus-visible:ring-brand-purple']) assert.ok(m[1].split(' ').includes(cls), `a toggle is ${cls}`);

  // WITH BUSINESS OPEN — its line and its 9 steps join; each of its rows is marked under the two plans that hold it
  const business = render(BUSINESS_OPEN);
  assert.match(business, table(BUSINESS_OPEN), 'Business open: every row, as the leaf says it');
  assert.equal(count(business, 'data-comparison-step='), view.categories[0].count + view.categories[1].count);
  assert.equal(count(business, 'data-comparison-step="business-'), 9);
  assert.equal(count(business, 'aria-expanded="true"'), 2);
  assert.ok(business.includes(`data-comparison-toggle="business"><span>BUSINESS — 9 steps</span><span aria-hidden="true" class="shrink-0 font-mono text-xs text-text-faint">−</span></button></th>${marksHtml([false, true, false, true])}</tr>`), 'Business: — ✓ — ✓ under Personal · P + Business · P + Trading · All');

  // WITH A STEP OPEN — its tools, each with its line, then its note when it has one
  const steps = render(STEPS_OPEN);
  assert.match(steps, table(STEPS_OPEN), 'two steps open: every row, as the leaf says it');
  assert.equal(count(steps, 'data-comparison-tools='), 2);
  const fifth = /data-comparison-tools="personal-5">([\s\S]*?)<\/td>/.exec(steps);
  assert.ok(fifth, 'Personal step 5\'s tools');
  assert.deepEqual([...fifth[1].matchAll(/<li class="[^"]*"><span class="[^"]*">([^<]*)<\/span><span class="[^"]*">([^<]*)<\/span><\/li>/g)].map((m) => [m[1], m[2]]), [
    ['Retirement', 'Retirement accounts beside the rest of your money'],
    ['Brokerage', 'Positions and balances from your broker'],
    ['Fixed Assets', 'The things you own that lose value over time'],
    ['Debt', 'What you owe, and when it comes due'],
  ], 'each tool\'s name with its line');
  assert.ok(fifth[1].endsWith('data-comparison-note="true">Each account sits where you use it: your 401k here, the brokerage you trade options in under Trade.</p>'), 'then the step\'s note');
  const first = /data-comparison-tools="business-1">([\s\S]*?)<\/td>/.exec(steps);
  assert.ok(first, 'Business step 1\'s tools');
  assert.deepEqual([...first[1].matchAll(/<li class="[^"]*"><span class="[^"]*">([^<]*)<\/span><span class="[^"]*">([^<]*)<\/span><\/li>/g)].map((m) => [m[1], m[2]]), [['Compliance · Ent Filings', 'What the entity must file, when it is due, and whether it did']], 'two tools on their one line');
  assert.equal(count(first[1], 'data-comparison-note'), 0, 'no note where the step has none');
  assert.equal(count(steps, 'aria-expanded="true"'), 4, 'two categories and two steps open');

  // EVERYTHING OPEN — all 26 steps, each with a mark under each plan; all 26 tool rows; the two customer notes and no build note
  const all = render(ALL_OPEN);
  assert.match(all, table(ALL_OPEN), 'everything open: every row, as the leaf says it');
  const totalSteps = view.categories.reduce((sum, c) => sum + c.count, 0);
  assert.equal(totalSteps, 26);
  assert.equal(count(all, 'data-comparison-step='), totalSteps, '26 step rows');
  assert.equal(count(all, 'data-comparison-tools='), totalSteps, 'and their 26 tool rows');
  assert.equal(count(all, 'data-comparison-mark='), (view.categories.length + totalSteps) * PLANS.length, 'a mark under each plan on every category row and every step row');
  const inMarks = view.categories.reduce((sum, c) => sum + (1 + c.count) * c.inPlan.filter(Boolean).length, 0);
  assert.equal(count(all, `class="${MARK_IN}">${PLAN_MARKS.inPlan.mark}</span><span class="sr-only">${PLAN_MARKS.inPlan.label}</span>`), inMarks, 'every ✓, with what a screen reader hears');
  assert.equal(count(all, `class="${MARK_OUT}">${PLAN_MARKS.notInPlan.mark}</span><span class="sr-only">${PLAN_MARKS.notInPlan.label}</span>`), (view.categories.length + totalSteps) * PLANS.length - inMarks, 'and every —');
  for (const c of view.categories) for (const step of c.steps) assert.ok(all.includes(`data-comparison-step-toggle="${stepKey(c.id, step.n)}">`) && new RegExp(`data-comparison-step="${stepKey(c.id, step.n)}">[\\s\\S]*?</th>${esc(marksHtml(c.inPlan))}</tr>`).test(all), `${c.id} step ${step.n}: its marks are its category's`);
  assert.equal(count(all, 'data-comparison-note='), 2, 'the two notes written for a customer');
  assert.equal(count(all, 'aria-expanded="true"'), 4 + totalSteps);
  assert.equal(count(all, 'aria-expanded="false"'), 0);

  // IN NO RENDER: a status word, the switches, the plan line, the link to the plans, the counts, the legend, the build note, a status colour
  const gone = [...NO_STATUS, STEP_LIVE.words, STEP_PENDING.words, ...Object.values(TOOL_MARKS).flatMap((m) => [m.words, m.means]), WHAT_YOU_RUN_LABEL, PERSONAL_ALWAYS, `>${ADD_BUSINESS}<`, `>${ADD_TRADE}<`, 'aria-pressed',
    'Your plan', 'Your steps', 'need Books', asHtml(NEXT_LINE), COMPARE_PLANS_WORDS, 'Compare all four plans', `href="${COMPARE_PLANS_PATH}"`, LEGEND_TITLE, asHtml(LEGEND_STEP_LINE), asHtml(LEGEND_BOOKS_LINE), 'No customer can open a trading book yet',
    PIPELINE_DOOR, `href="${PIPELINE_PATH}"`, 'data-how-to-switch', 'data-how-to-plan', 'data-how-to-price', 'data-how-to-cta', 'data-how-to-steps', 'data-how-to-books', 'data-how-to-section', 'data-how-to-row', 'data-how-to-card', 'data-how-to-state', 'data-how-to-mark', 'data-how-to-legend',
    'text-status-', 'text-brand-amber', 'text-brand-red', 'text-brand-green'];
  for (const [what, html] of [['at rest', rest], ['Business open', business], ['two steps open', steps], ['everything open', all]] as const) {
    for (const word of gone) assert.equal(count(html, word), 0, `${what}: no "${word}"`);
    // the board's rule for this block still holds: no count of the tools, no "guide" line, nothing "coming soon". (The old test also refused the word
    // "placeholder"; the cards carry the price slot's own hook, data-price-placeholder, over "Pricing announced at launch" — the leaf's words, as /pricing draws them.)
    assert.doesNotMatch(html, /\d+ tools\b|\bguide\b|coming soon/i, `${what}: no count of the tools, no guide line, nothing coming soon`);
    assert.equal(count(html, 'placeholder'), PLANS.length, `${what}: "placeholder" is the four cards' price-slot hook and nothing else`);
    assert.equal(count(html, '<a '), 0, `${what}: no link — the cards' doors are buttons, and nothing else links`);
  }

  // THE DOOR AND THE TOGGLES — a card's button opens the door it is handed; a toggle calls back with its own key
  const calls: string[] = [];
  const drawn = drawnElementsOf(HowToView({ openCategories: new Set(AT_REST.categories), openSteps: new Set<string>(), onCategory: (id) => { calls.push(`category ${id}`); }, onStep: (key) => { calls.push(`step ${key}`); }, onJoin: () => { calls.push('join'); } }));
  const buttons = drawn.filter((el) => el.type === 'button');
  assert.equal(buttons.length, PLANS.length + 4 + view.categories[0].count);
  for (const b of buttons) (b.props.onClick as () => void)();
  assert.deepEqual(calls, [
    ...PLANS.map(() => 'join'),
    'category personal', ...view.categories[0].steps.map((step) => `step personal-${step.n}`),
    'category business', 'category travel', 'category trade',
  ], 'each card\'s button opens the door; each toggle calls back with its key, in the order drawn');

  // THE TWO SETS — React state in the default export: a category opens and closes, a step opens, any number at once
  assert.deepEqual([...toggled(new Set(['personal']), 'business')], ['personal', 'business'], 'a key that is not in joins');
  assert.deepEqual([...toggled(new Set(['personal', 'business']), 'personal')], ['business'], 'a key that is in leaves');
  const before = new Set(['personal']);
  assert.notEqual(toggled(before, 'travel'), before, 'a new set each time');
  assert.deepEqual([...before], ['personal'], 'and the old one untouched');
  assert.equal(stepKey('business', 3), 'business-3');
  // the section is called inside a host's render; an act made DURING that render is a render-phase update, so the renderer draws the host again
  const acts: Array<(props: HowToViewProps) => void> = [(p) => p.onCategory('business'), (p) => p.onStep('business-3'), (p) => p.onStep('personal-1'), (p) => p.onCategory('personal'), (p) => p.onStep('business-3')];
  const passes: string[] = [];
  const Host = () => {
    const el = HowToSectionDefault({ onRequireAuth: () => {} }) as React.ReactElement<HowToViewProps>;
    assert.equal(el.type, HowToView, 'the default export draws the pure half');
    passes.push(`${[...el.props.openCategories].join(',')} | ${[...el.props.openSteps].join(',')}`);
    if (passes.length <= acts.length) acts[passes.length - 1](el.props);
    return null;
  };
  assert.equal(renderToStaticMarkup(React.createElement(Host)), '');
  assert.deepEqual(passes, [
    'personal | ',
    'personal,business | ',
    'personal,business | business-3',
    'personal,business | business-3,personal-1',
    'business | business-3,personal-1',
    'business | personal-1',
  ], 'Personal open at rest → Business opens beside it → a step opens → another step opens → Personal closes → a step closes');
});

// ── T5 · THE SOURCE ──────────────────────────────────────────────────────────

test('T5 (HOME-PLANS-01) the source: the section types no leaf word, no mark, no status and no price — its only typed words are its aria-label; two sets in React state only, no storage and no URL; it takes PlanCards and nothing else from the plans section; the table\'s box, head row and toggle are the plans table\'s own idioms; the marks are never the status colours; the leaf is pure', () => {
  const section = code(SECTION);
  const flat = section.replace(/\s+/g, ' ');
  const view = planComparison();
  // no status, no mark, no price
  for (const status of ['LIVE', 'PARTIAL', 'NOT BUILT', 'NOT_BUILT', 'PENDING', 'NEEDS']) assert.ok(!section.includes(status), `the section does not type ${status}`);
  for (const mark of [PLAN_MARKS.inPlan.mark, PLAN_MARKS.notInPlan.mark, '◐']) assert.ok(!section.includes(mark), `the section types no "${mark}" — the two marks are the leaf's`);
  assert.doesNotMatch(section, /\$\s?\d/, 'no figure is typed');
  // no plan's words, no category's name
  for (const plan of PLANS) {
    assert.ok(!flat.includes(`'${plan.name}'`) && !flat.includes(`"${plan.name}"`) && !flat.includes(`>${plan.name}<`), `the section does not type the plan name "${plan.name}"`);
    for (const words of [plan.audience, plan.positioning, plan.relationship, plan.role, ...plan.benefits]) assert.ok(!flat.includes(words), `nor "${words.slice(0, 30)}…"`);
  }
  assert.doesNotMatch(section, /\bPersonal\b|\bBusiness\b|\bTrade\b|\bTravel\b|\bTrading\b/, 'no category or plan name is typed');
  // the pillar's words — Alex's, word for word, typed once in src/lib/homeActWords.ts (HOME-FINISH-02) and read by the section
  assert.equal(PLAN_PILLAR.heading, 'Plan Your Escape.');
  assert.deepEqual([...PLAN_PILLAR.paragraphs], [
    'Get your bank data. Turn it into financial statements. See your income and expenses, what you own, what you owe, and what living at home actually costs.',
    'Plan ahead, budget for what you want to do, prepare for tax time, and compare your plans with what actually happened.',
    'Connect the dots across your personal, business, and trading finances to make better decisions about what comes next.',
  ]);
  // none of the leaves' words: the pillar's, the cards', the table's — and none of the status view's, which is drawn here no more
  assert.equal(COMPARE_PLANS_WORDS, 'Compare all four plans →');
  assert.equal(COMPARE_PLANS_PATH, '/pricing');
  const typed = [PLAN_PILLAR.heading, ...PLAN_PILLAR.paragraphs, COMPARISON_FIRST_HEAD, PLAN_MARKS.inPlan.label, PLAN_MARKS.notInPlan.label, LAUNCH_PLACEHOLDER, EARLY_ACCESS_CTA,
    ...view.categories.flatMap((c) => [c.heading, c.countWords, c.line, ...c.steps.flatMap((step) => [step.title, ...step.tools.map((t) => t.line), ...(step.note === null ? [] : [step.note])])]),
    ...HOW_TO_SECTIONS.flatMap((s) => s.steps.flatMap((step) => (typeof step.title === 'string' ? [step.title] : [step.title.withBusiness, step.title.withoutBusiness]))),
    'Software plans →', 'Here’s how you actually do it.', 'Personal is everyone’s.', WHAT_YOU_RUN_LABEL, PERSONAL_ALWAYS, ADD_BUSINESS, ADD_TRADE, NEXT_LINE, COMPARE_PLANS_WORDS, 'NEEDS BOOKS', 'NOT ON SALE YET', 'YOUR STEP', LEGEND_TITLE, LEGEND_STEP_LINE, LEGEND_BOOKS_LINE, PIPELINE_DOOR, stepCountWords(1), stepCountWords(2)];
  for (const w of typed) assert.ok(!flat.includes(w), `the section does not type "${w.slice(0, 40)}"`);
  for (const head of Object.values(PLAN_HEADS)) assert.ok(!flat.includes(`'${head}'`) && !flat.includes(`"${head}"`) && !flat.includes(`>${head}<`), `nor the head "${head}"`);
  // what it does type: one aria-label, and — between its tags — nothing a visitor reads; a toggle's two signs sit in expressions, hidden from a screen reader
  assert.deepEqual([...section.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]), ['Software plans'], 'its one aria-label — "How to" until HOME-PLANS-01');
  const drawnAt = section.indexOf('const marks = (inPlan: readonly boolean[]) =>');
  const drawnEnd = section.lastIndexOf('</section>');
  assert.ok(drawnAt > -1 && drawnEnd > drawnAt, 'the pure half\'s markup: from the marks to the act\'s closing tag');
  // `>text<` with no brace in it is a literal a visitor would read (the plan law's own scan); an arrow function's opening parenthesis is not text
  assert.deepEqual([...section.slice(drawnAt, drawnEnd).matchAll(/>([^<>{}]+)</g)].map((m) => m[1].trim()).filter((text) => /[A-Za-z0-9]/.test(text)), [], 'no text is typed between its tags');
  assert.equal(count(section, `<span aria-hidden="true" className={HOW.sign}>{open ? '−' : '+'}</span>`), 1, 'a category\'s sign');
  assert.equal(count(section, `<span aria-hidden="true" className={HOW.sign}>{stepOpen ? '−' : '+'}</span>`), 1, 'a step\'s sign');
  // the act, as ruled; the pillar, untouched
  assert.match(section, /^'use client';/);
  assert.match(section, /<section id="modules" aria-label="Software plans" className="w-full border-b border-border bg-bg-terminal" data-how-to>/, 'the act — id="modules" since HOME-BRIEF-04; aria-label "How to" until HOME-PLANS-01');
  assert.equal(count(section, 'id="modules"'), 1);
  assert.match(section, /^import \{ PLAN_PILLAR \} from '@\/lib\/homeActWords';$/m, 'the pillar\'s words from their leaf');
  assert.equal(count(section, '<h2 className={HOW.h2}>{PLAN_PILLAR.heading}</h2>'), 1, 'the pillar\'s heading, the section\'s one h2');
  assert.equal(count(section, '<h2'), 1);
  assert.equal(count(section, '{PLAN_PILLAR.paragraphs.map((words) => <p key={words} className={HOW.pillar}>{words}</p>)}'), 1, 'its paragraphs, in the leaf\'s order');
  assert.match(section, /^ {2}inner: 'max-w-7xl mx-auto px-4 lg:px-8 pt-6 pb-10',$/m);
  assert.match(section, /^ {2}h2: 'text-2xl sm:text-3xl font-medium tracking-tight text-brand-purple',$/m, 'the page\'s purple heading classes');
  assert.match(section, /^ {2}pillar: 'mt-3 max-w-3xl text-base text-text-secondary',$/m);
  // what it reads: the comparison and its marks from the leaf; the four cards — and nothing else — from the plans section; the status view no more
  assert.deepEqual([...section.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]), ['react', '@/lib/ds', '@/lib/howTo', '@/lib/homeActWords', '@/components/offer/PlansSection']);
  assert.match(section, /^import \{ PlanCards \} from '@\/components\/offer\/PlansSection';$/m, 'PlanCards, and nothing else, from the plans section');
  assert.match(section, /^import \{ PLAN_MARKS, planComparison, type HowToSectionId \} from '@\/lib\/howTo';$/m, 'the comparison and its two marks from the leaf');
  assert.equal(count(section, 'const view = planComparison();'), 1);
  assert.equal(count(section, `<PlanCards door={{ kind: 'button', onClick: () => onJoin() }} />`), 1, 'the four cards, with a button door');
  assert.match(section, /export default function HowToSection\(\{ onRequireAuth \}: \{ onRequireAuth: \(\) => void \}\) \{/, 'Landing hands it the door');
  assert.equal(count(section, 'onJoin={onRequireAuth}'), 1, 'and the cards\' buttons get that door');
  for (const goneName of ['howToView', 'TOOL_MARKS', 'LEGEND_', 'WHAT_YOU_RUN_LABEL', 'PERSONAL_ALWAYS', 'ADD_BUSINESS', 'ADD_TRADE', 'COMPARE_PLANS', 'HowToChoice', 'PRIMARY_CTA', 'chip(', "from 'next/link'", 'pipelineWords', 'PIPELINE_',
    'data-how-to-switch', 'data-how-to-always', 'data-how-to-plan', 'data-how-to-price', 'data-how-to-cta', 'data-how-to-compare', 'data-how-to-steps', 'data-how-to-books', 'data-how-to-section', 'data-how-to-badge', 'data-how-to-row', 'data-how-to-card', 'data-how-to-step', 'data-how-to-state', 'data-how-to-mark', 'data-how-to-note', 'data-how-to-next', 'data-how-to-legend',
    'switchOn:', 'switchOff:', 'always:', 'legend:', 'legendMarks:', 'legendLine:', 'sectionHead:', 'sectionName:', 'sectionLine:', 'cardHead:', 'compare:', 'offer:', 'aria-pressed', 'snap-x']) {
    assert.ok(!section.includes(goneName), `${goneName} left the section with what it served`);
  }
  // STATE: two sets, in React state only — no storage, no URL, no effect, no clock
  assert.equal(count(section, 'useState<ReadonlySet<'), 2, 'two sets in React state');
  assert.equal(count(section, 'useState'), 3, 'and no other state — the import and the two sets');
  assert.match(section, /const OPEN_AT_REST: readonly HowToSectionId\[\] = \['personal'\];/, 'the first category starts open');
  assert.match(section, /useState<ReadonlySet<string>>\(\(\) => new Set<string>\(\)\)/, 'no step starts open');
  assert.doesNotMatch(section, /\buse(Effect|LayoutEffect|Reducer|Ref|Router|SearchParams|Pathname)\b|localStorage|sessionStorage|document\.cookie|window\.|location\b|\bfetch\s*\(|new Date\(|Date\.now\(/, 'no storage, no URL, no fetch, no clock');
  // PAINT: zero new hex; the marks in brand purple and faint ink — never the status colours
  assert.doesNotMatch(section, /#[0-9a-fA-F]{3,8}\b/, 'zero new hex');
  assert.match(section, /^ {2}markIn: 'font-mono text-sm text-brand-purple',$/m, '✓ in brand purple');
  assert.match(section, /^ {2}markOut: 'font-mono text-sm text-text-faint',$/m, '— in faint ink');
  assert.doesNotMatch(section, /text-status-|bg-status-|text-brand-amber|text-brand-red|text-brand-green|text-brand-gold/, 'never the status colours');
  // the table's box, its head row and its toggle rows are the plans table's own idioms (PlansSection.tsx)
  const plans = code(PLANS_SECTION);
  assert.ok(plans.includes('<div className="mt-3 overflow-x-auto rounded-lg border border-border bg-white" data-plan-table>'), 'the plans table\'s box');
  // (Until the look's fix this pinned the box as the plans table's own but for its top margin alone — unpositioned; see T10.)
  assert.match(section, /^ {2}box: 'relative mt-8 overflow-x-auto rounded-lg border border-border bg-white',$/m, 'the same box, but for its top margin and `relative` — it scrolls sideways inside itself, and holds its own screen-reader text');
  assert.ok(plans.includes('<tr className="border-b border-border bg-bg-row text-left align-top">'), 'the plans table\'s head row');
  assert.match(section, /^ {2}headRow: 'border-b border-border bg-bg-row text-left align-top',$/m, 'the same head row');
  assert.ok(plans.includes('<th className={`px-3 py-3 ${DATA.columnHeader}`}>'), 'the plans table\'s first head');
  assert.match(section, /^ {2}firstHead: `px-3 py-3 text-left \$\{DATA\.columnHeader\}`,$/m, 'the same first head');
  const groupToggle = /className="(flex w-full items-center justify-between [^"]*)"\s*data-plan-group-toggle/.exec(plans);
  const categoryToggle = /^ {2}categoryToggle: `([^`]*)`,$/m.exec(section);
  const stepToggle = /^ {2}stepToggle: `([^`]*)`,$/m.exec(section);
  assert.ok(groupToggle && categoryToggle && stepToggle, 'the plans table\'s group toggle, and the section\'s two');
  for (const cls of groupToggle[1].split(' ').filter((c) => c !== 'uppercase')) assert.ok(categoryToggle[1].split(' ').includes(cls), `a category's toggle wears the group toggle's ${cls}`);
  assert.ok(groupToggle[1].split(' ').includes('uppercase') && !categoryToggle[1].split(' ').includes('uppercase'), 'but not its upper-casing: the capitals are the leaf\'s, so the count reads as written');
  for (const toggle of [categoryToggle[1], stepToggle[1]]) for (const cls of ['flex', 'w-full', 'items-center', 'justify-between', 'min-h-[44px]', 'hover:bg-bg-row', '${RING}']) assert.ok(toggle.split(' ').includes(cls), `a toggle is ${cls}`);
  assert.match(section, /^const RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-purple';$/m, 'the focus ring: the house ring, inside the cell');
  assert.equal(count(section, '<button type="button" aria-expanded={'), 2, 'the two toggles are real buttons with aria-expanded');
  assert.match(section, /^ {2}table: 'w-full min-w-\[720px\] table-fixed text-sm',$/m, 'the table keeps the width it needs; the box scrolls below it');
  assert.equal(count(section, 'scope="col"'), 2, 'the first head and the plan heads are column headers');
  assert.equal(count(section, '<th scope="row" className={HOW.rowHead}>'), 2, 'a category\'s row and a step\'s row each open with a row header that holds the toggle');
  assert.equal(count(section, '<span className="sr-only">{column.name}</span>'), 1, 'a plan\'s full name, for a screen reader');
  // the leaf: pure, and it reads the registry, the plans and the offer — never a typed status for a tool, never a plan's words, never a price
  const leaf = code(LEAF);
  assert.doesNotMatch(leaf, /['"]use client['"]|from 'react'|\bfetch\s*\(|new Date\(|Date\.now\(|process\.env|localStorage/, 'the leaf is pure');
  assert.deepEqual([...leaf.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]), ['./problemSheet', './toolRegistry', './offer/plans', './offer']);
  for (const plan of PLANS) assert.ok(!leaf.includes(`'${plan.name}'`) || plan.name === 'Personal', `the leaf does not type the plan name "${plan.name}"`);
  assert.doesNotMatch(leaf, /status: '(LIVE|PARTIAL|NOT_BUILT)'/, 'no tool\'s status is typed in the leaf');
  assert.match(leaf, /const slot = priceSlot\(plan\);/, 'the price line and the button\'s words are read from the plan\'s slot');
  for (const w of [LAUNCH_PLACEHOLDER, EARLY_ACCESS_CTA]) assert.ok(!leaf.includes(w), `the leaf does not type "${w}"`);
  assert.doesNotMatch(leaf, /\$\s?\d/, 'the leaf types no figure');
  for (const goneName of ['NEEDS_BOOKS_TAG', 'NOT_ON_SALE_TAG', 'cardWhere', 'cardPlace', 'YOUR STEP']) assert.ok(!leaf.includes(goneName), `${goneName} left the leaf`);
  // HOME-FINISH-02 (2026-11-10): the label, the h2 and the one line left the leaf with their last reader
  for (const goneName of ['HOW_TO_EYEBROW', 'HOW_TO_HEADING', 'HOW_TO_LINE', 'Software plans', 'how you actually do it', 'Personal is everyone’s']) assert.ok(!leaf.includes(goneName), `${goneName} left the leaf`);
  // HOME-PLANS-01: KEPT, NOT DRAWN — the status view and its words stay in the leaf, exported as they were
  for (const kept of ['export function howToView(', 'export const NEEDS_BOOKS:', 'export function booksNotOnSale(', 'export function planFor(', 'export const TOOL_MARKS:', 'export const LEGEND_TITLE', 'export const WHAT_YOU_RUN_LABEL', 'export const COMPARE_PLANS_WORDS']) {
    assert.equal(count(leaf, kept), 1, `the leaf keeps ${kept}`);
  }
  // HOME-BRIEF-04 (Alex, 2026-11-10 19:00): four more — Trade Log, Brokerage, Tax, Compliance, each behind a key only Books grants. The six until then.
  assert.deepEqual([...NEEDS_BOOKS], ['Banking', 'Bookkeeping', 'Expenses', 'Bill Pay', 'Budget', 'Tasks', 'Trade Log', 'Brokerage', 'Tax', 'Compliance'], 'the ten tools that need Books');
});

// ── T6 · THE SEAT ────────────────────────────────────────────────────────────

test('T6 Landing mounts the how-to once, with the door — first under "What We Do" (HOME-FINISH-02) and above the services section, comments between each; Landing itself never names the plans section — the how-to draws the four cards (HOME-PLANS-01)', () => {
  const landing = code(LANDING);
  const ONLY_COMMENTS = /^\s*(\{\s*\}\s*)*$/;
  // HOME-BRIEF-04 (Alex, 2026-11-10 19:00): the how-to IS the Software Plans — the plans mount ("<PlansSection door={{ kind: 'button', onClick: () =>
  // onRequireAuth() }} />") left the page, and the how-to, mounted bare ('<HowToSection />') directly under it until then, takes its seat and its door.
  // HOME-FINISH-02 (Alex, 2026-11-10 20:56): PLAN → BUILD → EXPLORE — the how-to is the first pillar, directly under the "What We Do" heading, which
  // stands alone in the page's container. Until then its upper neighbour was the guest's strip ('<GuestTripStrip onRequireAuth={onRequireAuth} />':
  // "the guest's strip → the how-to → the services section", a comment between each).
  const HEADING_BOX = '<div className="max-w-7xl mx-auto px-4 lg:px-8 pt-10">\n        <h2 className="text-3xl sm:text-4xl font-medium tracking-tight text-brand-gold" data-act-heading>{WHAT_WE_DO_HEADING}</h2>\n      </div>';
  const HOW_TO = '<HowToSection onRequireAuth={onRequireAuth} />';
  const SERVICES_OPEN = '<section id={SERVICES_ANCHOR} className="w-full border-b border-border bg-bg-terminal">'; // HOME-FINISH-02 (2026-11-10): the section carries its anchor — '<section className="w-full border-b border-border bg-bg-terminal">' until then
  for (const s of [HEADING_BOX, HOW_TO, SERVICES_OPEN]) assert.equal(count(landing, s), 1, `${s} once`);
  assert.equal(count(landing, '<HowToSection'), 1);
  assert.equal(count(landing, 'PlansSection'), 0, 'the plans section is neither imported nor mounted here — /pricing keeps it');
  assert.match(landing, /^import HowToSection from '\.\/HowToSection';$/m);
  const [heading, howTo, services] = [HEADING_BOX, HOW_TO, SERVICES_OPEN].map((s) => landing.indexOf(s));
  assert.ok(heading > -1 && howTo > heading && services > howTo, '"What We Do" → the how-to → the services section');
  assert.match(landing.slice(heading + HEADING_BOX.length, howTo), ONLY_COMMENTS, '"What We Do" → the how-to: comments between, nothing else');
  assert.match(landing.slice(howTo + HOW_TO.length, services), ONLY_COMMENTS, 'the how-to → the services section: a comment between, nothing else');
  // /pricing still mounts the plans, under its own anchor
  assert.match(code('src/app/pricing/page.tsx'), /<PlansSection [^>]*headingId="plans"/, '/pricing keeps the four plans and the table');
});

// ── T7 · THE FOUR PLAN CARDS, SHARED (HOME-PLANS-01) ─────────────────────────

test('T7 (HOME-PLANS-01) the four plan cards are exported whole: PlanCards alone stands whole inside PlansSection\'s render, once, right under its subhead; four cards in PLANS\' order, each with its top label, its name, its two lines, who it is for, three benefits, the launch placeholder and its door; a button door calls back with the plan\'s id; a link door draws the link', () => {
  // /pricing's own door: a link to the front door (src/app/pricing/page.tsx — not edited)
  const linkDoor = { kind: 'link', href: '/' } as const;
  assert.equal(count(code(PRICING), `<PlansSection door={{ kind: 'link', href: '/' }} headingId="plans" />`), 1, '/pricing mounts the plans section as it did');
  const cards = renderToStaticMarkup(React.createElement(PlanCards, { door: linkDoor }));
  const section = renderToStaticMarkup(React.createElement(PlansSection, { door: linkDoor, headingId: 'plans' }));
  const GRID = '<div class="mt-6 grid gap-4 lg:grid-cols-4">';
  assert.ok(cards.startsWith(GRID) && cards.endsWith('</div>'), 'the grid, whole');
  assert.equal(count(section, cards), 1, 'PlanCards\' own render stands whole inside PlansSection\'s, once');
  assert.equal(count(section, GRID), 1, 'one grid of cards in the plans section');
  assert.ok(section.includes(`data-plans-subhead="true">${asHtml(PLANS_SUBHEAD)}</p>${cards}`), 'right under the subhead, where the grid stood');
  // four cards, in PLANS' order — each whole
  const opens = [...cards.matchAll(/<div class="([^"]*)" data-plan="([^"]+)" data-plan-modules="([^"]*)">/g)];
  assert.deepEqual(opens.map((m) => m[2]), PLANS.map((p) => p.id), 'four cards, in PLANS\' order');
  assert.equal(count(cards, 'data-plan='), PLANS.length);
  PLANS.forEach((plan, i) => {
    const card = cards.slice(opens[i].index, i + 1 < opens.length ? opens[i + 1].index : undefined);
    const slot = priceSlot(plan);
    assert.equal(opens[i][3], plan.modules.join(' '), `${plan.id}: what it holds`);
    assert.ok(opens[i][1].startsWith('flex flex-col gap-4 rounded-lg border border-border bg-white p-5'), `${plan.id}: the white card`);
    assert.ok(card.includes(`data-plan-role="true">${asHtml(plan.role)}</p><h3 class="mt-1 text-lg font-semibold text-brand-purple" data-plan-name="true">${asHtml(plan.name)}</h3>`), `${plan.id}: its top label, then its name`);
    assert.ok(card.includes(`data-plan-positioning="true">${asHtml(plan.positioning)}</p>`), `${plan.id}: its line`);
    assert.ok(card.includes(`data-plan-audience="true">${asHtml(plan.audience)}</p>`), `${plan.id}: who it is for`);
    assert.ok(card.includes(`data-plan-relationship="true">${asHtml(plan.relationship)}</p>`), `${plan.id}: what it holds, in one line`);
    assert.deepEqual([...card.matchAll(/<li class="flex gap-2" data-plan-benefit="true"><span aria-hidden="true" class="text-brand-gold">·<\/span><span>([^<]*)<\/span><\/li>/g)].map((m) => m[1]), plan.benefits.map(asHtml), `${plan.id}: its three benefits`);
    assert.equal(plan.benefits.length, 3);
    // the price slot: while no price is set, the launch placeholder and the early-access door — both the leaf's words
    assert.equal(slot.kind, plan.price.monthly === null ? 'unannounced' : 'announced');
    if (slot.kind === 'unannounced') assert.ok(card.includes(`data-price-slot="unannounced" data-price-where="card">`) && card.includes(`data-price-placeholder="true">${asHtml(slot.text)}</span>`), `${plan.id}: the launch placeholder`);
    // a link door draws the link — the page's one filled button class, the plan's id, the caller's href, the slot's words
    const links = [...card.matchAll(/<a\b([^>]*)>([^<]*)<\/a>/g)];
    assert.equal(links.length, 1, `${plan.id}: one door`);
    assert.ok(links[0][1].includes('href="/"') && links[0][1].includes(`data-plan-cta="${plan.id}"`) && links[0][1].includes(`class="${PRIMARY_CTA}"`), `${plan.id}: the link door`);
    assert.equal(links[0][2], asHtml(slot.cta), `${plan.id}: the door's words are its slot's`);
    assert.equal(count(card, '<button'), 0, `${plan.id}: a link door draws no button`);
  });
  assert.equal(count(cards, LAUNCH_PLACEHOLDER), PLANS.filter((p) => p.price.monthly === null).length, 'the placeholder once per plan with no price');
  // a button door: a real button per card, and a press calls back with that card's plan id
  const pressed: string[] = [];
  const buttonDoor = { kind: 'button', onClick: (planId: string) => { pressed.push(planId); } } as const;
  const buttonCards = renderToStaticMarkup(React.createElement(PlanCards, { door: buttonDoor }));
  for (const plan of PLANS) assert.equal(count(buttonCards, `<button type="button" class="${PRIMARY_CTA}" data-plan-cta="${plan.id}">${asHtml(priceSlot(plan).cta)}</button>`), 1, `${plan.id}: its button`);
  assert.equal(count(buttonCards, '<a '), 0, 'a button door draws no link');
  assert.equal(buttonCards.replace(/<button type="button" class="[^"]*" (data-plan-cta="[^"]*")>([^<]*)<\/button>/g, '<door $1>$2</door>'), cards.replace(/<a\b[^>]*(data-plan-cta="[^"]*")[^>]*>([^<]*)<\/a>/g, '<door $1>$2</door>'), 'the door aside, the two renders are the same cards');
  const buttons = drawnElementsOf(PlanCards({ door: buttonDoor })).filter((el) => el.type === 'button');
  assert.equal(buttons.length, PLANS.length, 'one button per card');
  for (const b of buttons) (b.props.onClick as () => void)();
  assert.deepEqual(pressed, PLANS.map((p) => p.id), 'each card\'s button calls the door with its own plan\'s id, in order');
  // the source: the grid moved whole into the exported component, and the section renders it in its place
  const src = code(PLANS_SECTION);
  assert.equal(count(src, 'export function PlanCards({ door }: { door: PlanDoor }) {'), 1, 'exported from the plans section\'s own file');
  assert.equal(count(src, '<PlanCards door={door} />'), 1, 'PlansSection renders it where the grid stood');
  assert.equal(count(src, '<div className="mt-6 grid gap-4 lg:grid-cols-4">'), 1, 'the grid is typed once');
  assert.equal(count(src, '<PriceSlot plan={plan} door={door} where="card" />'), 1, 'PriceSlot as it was');
  assert.ok(src.indexOf('export function PlanCards(') < src.indexOf('export default function PlansSection('), 'the cards, then the section that mounts them');
  // every string the plan law looks for in this file is still in it
  for (const held of ['{plan.role}', 'priceSlot(plan)', 'slot.bestValue', 'BEST_VALUE_WORDS', 'data-plan-selector', 'data-plan-select={plan.id}', 'hidden lg:table-cell', 'cellState(', 'CELL_MARK[state]', "headingId = 'modules'",
    'data-plan-audience', 'data-plan-relationship', 'data-column-audience', 'data-column-relationship', '{PLANS_HEADLINE}', '{PLANS_SUBHEAD}', 'travelFreeLine()', 'data-travel-free']) {
    assert.ok(src.includes(held), `the plans section still carries ${held}`);
  }
});

// ── T8 · THE COMPARISON, IN THE LEAF (HOME-PLANS-01) ─────────────────────────

test('T8 (HOME-PLANS-01) the comparison of the live leaf: four columns and their heads; 8 · 9 · 4 · 5 = 26 steps and the counts\' words; the in-plan grid, cell by cell; every step\'s title the leaf\'s; every tool\'s line its capability row\'s label; the two customer notes present, the build note absent; no status word anywhere in the view; each new refusal by name; the status view unchanged by the field move', () => {
  const view = planComparison();
  // the table's words, typed once in the leaf
  assert.equal(COMPARISON_FIRST_HEAD, 'Step / Capability');
  assert.equal(view.firstHead, COMPARISON_FIRST_HEAD);
  assert.deepEqual(PLAN_HEADS, { personal: 'Personal', business: 'P + Business', trading: 'P + Trading', everything: 'All' });
  assert.deepEqual(PLAN_MARKS, { inPlan: { mark: '✓', label: 'In this plan' }, notInPlan: { mark: '—', label: 'Not in this plan' } });
  assert.deepEqual([stepCountWords(1), stepCountWords(2), stepCountWords(8)], ['1 step', '2 steps', '8 steps']);
  assert.equal(categoryHeading('Personal', 8), 'PERSONAL — 8 steps');
  // the four columns, in PLANS' order: the plan's id, its head, its full name
  assert.deepEqual(view.columns, PLANS.map((p) => ({ id: p.id, head: PLAN_HEADS[p.id], name: p.name })), 'the columns, in PLANS\' order');
  assert.deepEqual(view.columns.map((c) => c.head), ['Personal', 'P + Business', 'P + Trading', 'All']);
  assert.deepEqual(view.columns.map((c) => c.name), ['Personal', 'Personal + Business', 'Personal + Trading', 'Personal + Business + Trading'], 'each column carries its plan\'s full name');
  // the four categories, in order, with their counts — computed from the leaf's own steps
  assert.deepEqual(view.categories.map((c) => c.id), [...HOW_TO_SECTION_ORDER]);
  assert.deepEqual(view.categories.map((c) => c.count), HOW_TO_SECTIONS.map((s) => s.steps.length));
  assert.deepEqual(view.categories.map((c) => c.count), [8, 9, 4, 5]);
  assert.equal(view.categories.reduce((sum, c) => sum + c.count, 0), 26, '26 steps');
  assert.deepEqual(view.categories.map((c) => c.countWords), ['8 steps', '9 steps', '4 steps', '5 steps']);
  assert.deepEqual(view.categories.map((c) => c.heading), ['PERSONAL — 8 steps', 'BUSINESS — 9 steps', 'TRAVEL — 4 steps', 'TRADE — 5 steps']);
  view.categories.forEach((c, i) => {
    const section = HOW_TO_SECTIONS[i];
    assert.equal(c.name, section.name);
    assert.equal(c.heading, categoryHeading(section.name, section.steps.length));
    assert.equal(c.steps.length, c.count);
  });
  // IN THE PLAN, cell by cell — and derived: what a plan runs is its modules, and a category is in when sectionShown says so
  assert.deepEqual(view.categories.map((c) => c.inPlan), [
    [true, true, true, true], // Personal: all four
    [false, true, false, true], // Business: Personal + Business, and all three
    [true, true, true, true], // Travel: all four
    [false, false, true, true], // Trade: Personal + Trading, and all three
  ]);
  for (const plan of PLANS) assert.deepEqual(choiceOf(plan), { business: plan.modules.includes('business'), trade: plan.modules.includes('trading') }, `${plan.id}: what it runs, from its modules`);
  view.categories.forEach((c) => PLANS.forEach((plan, j) => assert.equal(c.inPlan[j], sectionShown(c.id, choiceOf(plan)), `${c.id} × ${plan.id}`)));
  assert.deepEqual(PLANS.map((plan) => choiceOf(plan)), [...HOW_TO_CHOICES], 'the four plans are the four choices, in order');
  // every step: its number, its title (the with-Business reading where the words read two ways), its note — the leaf's
  const withBusiness = (words: string | { withBusiness: string; withoutBusiness: string }) => (typeof words === 'string' ? words : words.withBusiness);
  view.categories.forEach((c, i) => {
    const section = HOW_TO_SECTIONS[i];
    assert.equal(c.line, withBusiness(section.line), `${c.id}: its line`);
    c.steps.forEach((step, k) => {
      assert.equal(step.n, section.steps[k].n);
      assert.equal(step.title, withBusiness(section.steps[k].title), `${c.id} step ${step.n}: the leaf's title`);
      assert.equal(step.note, section.steps[k].note ?? null, `${c.id} step ${step.n}: its customer note, or none`);
    });
  });
  const travel = view.categories[2];
  assert.equal(travel.line, 'Every trip line goes to Personal or Business — never a book of its own.', 'Travel\'s line takes its with-Business reading');
  assert.equal(travel.steps[3].title, 'Book every trip line to Personal or Business.', 'and so does its fourth step');
  // every tool's line is a capability row's label — the first row that names the tool alone; when none does, the first that names it
  const rows = CAPABILITY_GROUPS.flatMap((g) => g.rows);
  const rowFor = (name: string) => rows.find((r) => r.tools.length === 1 && r.tools[0] === name) ?? rows.find((r) => (r.tools as readonly string[]).includes(name));
  const leaf = code(LEAF);
  for (const tool of TOOL_REGISTRY) {
    const row = rowFor(tool.name);
    assert.ok(row, `${tool.name}: a capability row names it`);
    assert.equal(toolLine(tool.name), row.label, `${tool.name}: its line is that row's label`);
    assert.ok(!leaf.includes(row.label), `the leaf does not retype "${row.label.slice(0, 32)}…"`);
  }
  assert.equal(toolLine('Banking'), 'Every bank and card account in one place');
  assert.equal(toolLine('Expenses'), 'Every recurring expense planned, with its vendor and what it cost this month', 'Expenses: the row that names it alone, not the earlier row it shares with Tasks');
  assert.equal(toolLine('Bookkeeping'), 'Double-entry books written from what you already did', 'Bookkeeping: the first of the two rows that name it alone');
  const noRowAlone = TOOL_REGISTRY.map((t) => t.name).filter((name) => !rows.some((r) => r.tools.length === 1 && r.tools[0] === name)).sort();
  assert.deepEqual(noRowAlone, ['Compliance', 'Ent Filings', 'Tasks'], 'the three tools no row names alone');
  assert.equal(toolLine('Tasks'), 'Projects and routines, each with what it costs');
  assert.equal(toolLine('Compliance'), 'What the entity must file, when it is due, and whether it did');
  assert.equal(toolLine('Ent Filings'), toolLine('Compliance'), 'Compliance and Ent Filings share one row');
  // each step's tools, with their lines; tools of one step that share a line stand together on it
  view.categories.forEach((c, i) => c.steps.forEach((step, k) => {
    const names = HOW_TO_SECTIONS[i].steps[k].tools;
    assert.deepEqual(step.tools.flatMap((t) => t.name.split(' · ')), [...names], `${c.id} step ${step.n}: every tool, in the leaf's order`);
    for (const t of step.tools) for (const name of t.name.split(' · ')) assert.equal(t.line, toolLine(name as (typeof names)[number]), `${c.id} step ${step.n}: ${name}'s line`);
    assert.equal(new Set(step.tools.map((t) => t.line)).size, step.tools.length, `${c.id} step ${step.n}: no line twice`);
  }));
  assert.deepEqual(view.categories[1].steps[0].tools, [{ name: 'Compliance · Ent Filings', line: 'What the entity must file, when it is due, and whether it did' }], 'Business step 1: the two stand together on their one line');
  const together = view.categories.flatMap((c) => c.steps.flatMap((step) => step.tools.filter((t) => t.name.includes(' · ')).map((t) => t.name)));
  assert.deepEqual(together, ['Compliance · Ent Filings'], 'and nothing else shares a line inside one step');
  // the notes: the two written for a customer are there; the build note is not
  const BUILD_NOTE = 'No customer can open a trading book yet, so this step waits on that.';
  const notes = view.categories.flatMap((c) => c.steps.filter((step) => step.note !== null).map((step) => `${c.id}-${step.n}: ${step.note}`));
  assert.deepEqual(notes, [
    'personal-5: Each account sits where you use it: your 401k here, the brokerage you trade options in under Trade.',
    'trade-2: The brokerage you trade options in. Your 401k stays under Personal.',
  ]);
  const tradeOne = HOW_TO_SECTIONS[3].steps[0];
  assert.equal(tradeOne.buildNote, BUILD_NOTE, 'Trade step 1\'s note is its build note now');
  assert.equal(tradeOne.note, undefined);
  assert.deepEqual(HOW_TO_SECTIONS.flatMap((s) => s.steps.filter((step) => step.buildNote !== undefined).map((step) => `${s.id}-${step.n}`)), ['trade-1'], 'one build note in the leaf');
  assert.equal(view.categories[3].steps[0].note, null, 'the comparison does not carry it');
  // NO STATUS WORD anywhere in the whole view, serialised
  const serialised = JSON.stringify(view);
  assert.ok(!serialised.includes(BUILD_NOTE));
  for (const word of ['LIVE', 'PENDING', 'PARTIAL', 'NOT BUILT', 'NOT_BUILT', 'NEEDS BOOKS', 'on sale', 'live today', STEP_LIVE.words, STEP_PENDING.words, ...Object.values(TOOL_MARKS).map((m) => m.words)]) {
    assert.ok(!serialised.includes(word), `the comparison says "${word}" nowhere`);
  }
  assert.doesNotMatch(serialised, /\bbuilt\b|\bpending\b|\bpartial\b|coming soon/i, 'nor any softer word for a status');
  // the source: the comparison reads no status and no build note
  const fnAt = leaf.indexOf('export function planComparison(');
  const fnEnd = leaf.indexOf('export function howToLaw(');
  assert.ok(fnAt > -1 && fnEnd > fnAt, 'planComparison, then the law');
  const fn = leaf.slice(fnAt, fnEnd);
  assert.ok(fn.includes('return { firstHead: COMPARISON_FIRST_HEAD, columns, categories };') && !/statusOf|TOOL_MARKS|STEP_LIVE|STEP_PENDING|NEEDS_BOOKS|booksNotOnSale|buildNote|registry/i.test(fn), 'planComparison reads no status, no Books gate and no build note');
  assert.equal(count(leaf, 'note: step.note ?? step.buildNote ?? null,'), 1, 'the status view\'s card note: the customer note, then the build note');
  // each new refusal, by name
  const withoutMileage = CAPABILITY_GROUPS.map((g) => ({ ...g, rows: g.rows.filter((r) => !(r.tools as readonly string[]).includes('Mileage')) }));
  assert.throws(() => toolLine('Mileage', withoutMileage), (e: unknown) => e instanceof HowToLawError && /no capability row of src\/lib\/offer\/plans\.ts names Mileage/.test(e.message), 'a tool no row names: thrown, by name');
  assert.throws(() => planComparison({ groups: withoutMileage }), (e: unknown) => e instanceof HowToLawError && /names Mileage/.test(e.message));
  const fifth = [...PLANS, { ...PLANS[0], id: 'enterprise' } as unknown as Plan];
  assert.throws(() => planComparison({ plans: fifth }), (e: unknown) => e instanceof HowToLawError && /the plan "enterprise" has no head in the comparison/.test(e.message), 'a plan with no head: thrown, by name');
  assert.throws(() => planComparison({ sections: HOW_TO_SECTIONS.filter((s) => s.id !== 'travel') }), (e: unknown) => e instanceof HowToLawError && /the steps hold no "travel" section/.test(e.message));
  // … and the law's two new clauses
  assert.deepEqual(howToLaw({ throwOnFail: false }), [], 'the live leaf passes');
  const threeHeads = Object.fromEntries(Object.entries(PLAN_HEADS).filter(([id]) => id !== 'everything'));
  assert.ok(howToLaw({ throwOnFail: false, heads: threeHeads }).includes('the plan "everything" has no head in the comparison'), 'a plan with no head');
  assert.ok(howToLaw({ throwOnFail: false, heads: { ...PLAN_HEADS, enterprise: 'Ent' } }).includes('the comparison\'s head "Ent" names "enterprise", which is not a plan'), 'a head that names no plan');
  assert.ok(howToLaw({ throwOnFail: false, heads: { ...PLAN_HEADS, trading: '  ' } }).includes('the plan "trading" has no head in the comparison'), 'a blank head is no head');
  const lawWithoutMileage = howToLaw({ throwOnFail: false, groups: withoutMileage });
  assert.deepEqual(lawWithoutMileage, [
    'business step 7 names "Mileage", which no capability row names — the comparison has no line for it',
    'travel step 3 names "Mileage", which no capability row names — the comparison has no line for it',
  ], 'a tool with no line, at each step that names it');
  // the status view is unchanged by the field move: it still shows all three notes
  const both = howToView({ business: true, trade: true });
  assert.deepEqual(both.sections.flatMap((s) => s.cards.filter((c) => c.note !== null).map((c) => `${s.id}-${c.n}: ${c.note}`)), [
    'personal-5: Each account sits where you use it: your 401k here, the brokerage you trade options in under Trade.',
    `trade-1: ${BUILD_NOTE}`,
    'trade-2: The brokerage you trade options in. Your 401k stays under Personal.',
  ], 'the status view: the two customer notes and the build note, as before');
  for (const choice of HOW_TO_CHOICES) assert.equal(howToView(choice).sections.flatMap((s) => s.cards).filter((c) => c.note !== null).length, choice.trade ? 3 : 1, `${words(choice)}: its notes`);
});

// ── T9 · THE GUARD (HOME-PLANS-01) ───────────────────────────────────────────

test('T9 (HOME-PLANS-01) the guard stands on the plan law\'s line: a plan that carries a price fails the build, by name — the landing\'s comparison marks what each plan covers and draws no status; no plan carries a price today', () => {
  const law = code(LAW);
  const lines = law.split('\n').filter((l) => l.includes(`codeOf('src/components/landing/HowToSection.tsx').includes('<section id="modules"')`));
  assert.equal(lines.length, 1, 'the plan law\'s line that holds the how-to\'s anchor');
  const GUARD = 'for (const p of PLANS) if (p.price.monthly !== null) planFail(`${p.id} carries a price — the landing\'s comparison marks what each plan covers and draws no status, so no plan may carry a price until that is ruled again (HOME-PLANS-01)`);';
  assert.ok(lines[0].trimEnd().endsWith(GUARD), 'the guard is the last statement on that line');
  assert.equal(count(law, GUARD), 1, 'once');
  assert.match(lines[0], /^ {2}else if \(!codeOf\('src\/components\/landing\/HowToSection\.tsx'\)\.includes\('<section id="modules"'\)\) planFail\("[^"]*(?:\\"[^"]*)*"\); for \(const p of PLANS\) if /, 'after the anchor check\'s own statement — so it runs whatever that check finds');
  // why it stands in the build's law and not at module scope in the leaf: said on the line itself
  const why = comments(LAW).split('\n').filter((l) => l.includes('HOME-PLANS-01 (Alex, 2026-11-11 00:09): THE GUARD.'));
  assert.equal(why.length, 1, 'the reason, on the same line');
  assert.match(why[0], /honest only while nothing is for sale/);
  assert.match(why[0], /\/ is request-dynamic \(src\/app\/page\.tsx\), so a throw there would take the page down in front of a visitor instead of failing the build/);
  assert.doesNotMatch(code(LEAF), /price\.monthly/, 'the leaf holds no such throw');
  // what it guards, today: no plan carries a price, so every card says the launch words and the comparison's marks sell nothing
  for (const plan of PLANS) {
    assert.equal(plan.price.monthly, null, `${plan.id}: no price is set — the guard passes`);
    assert.equal(priceSlot(plan).kind, 'unannounced');
  }
});


test('T10 (HOME-PLANS-01, the look\'s fix) the comparison\'s box holds its own screen-reader text: the box is positioned and is the one thing in the section that scrolls sideways, every sr-only span the section draws sits inside it, and the reason stands where the class is typed — so a phone\'s page does not scroll sideways', () => {
  const section = code(SECTION);
  // the box: positioned AND the one that scrolls — one class string, on the comparison's box, once
  assert.match(section, /^ {2}box: 'relative mt-8 overflow-x-auto rounded-lg border border-border bg-white',$/m, 'positioned, and it scrolls sideways inside itself');
  assert.equal(count(section, '<div className={HOW.box} data-plan-comparison>'), 1, 'the comparison\'s box, once');
  assert.equal(count(section, 'overflow-x-auto'), 1, 'nothing else in the section scrolls sideways');
  // every render: what a screen reader hears is drawn ONLY inside that box — each plan head's full name and every mark's label
  const view = planComparison();
  const personalSteps = view.categories.filter((c) => c.id === 'personal').reduce((n, c) => n + c.steps.length, 0);
  const totalSteps = view.categories.reduce((n, c) => n + c.steps.length, 0);
  const AT_REST: Open = { categories: ['personal'], steps: [] };
  const ALL_OPEN: Open = { categories: [...HOW_TO_SECTION_ORDER], steps: view.categories.flatMap((c) => c.steps.map((step) => stepKey(c.id, step.n))) };
  for (const [name, open, stepRows] of [['at rest', AT_REST, personalSteps], ['everything open', ALL_OPEN, totalSteps]] as const) {
    const html = render(open);
    assert.equal(count(html, BOX_TAG), 1, `${name}: the box, positioned`);
    const from = html.indexOf(BOX_TAG);
    const to = html.lastIndexOf('</table></div>');
    assert.ok(to > from, `${name}: the box closes after its table`);
    assert.equal(count(html.slice(0, from), 'sr-only'), 0, `${name}: no screen-reader-only text before the box`);
    assert.equal(count(html.slice(to), 'sr-only'), 0, `${name}: and none after it`);
    assert.equal(count(html.slice(from, to), 'class="sr-only"'), view.columns.length + (view.categories.length + stepRows) * view.columns.length, `${name}: each plan head's full name and every mark's label, inside it`);
  }
  // the plans table's own box is untouched — /pricing draws what it drew
  assert.ok(code(PLANS_SECTION).includes('<div className="mt-3 overflow-x-auto rounded-lg border border-border bg-white" data-plan-table>'), 'the plans table\'s box is as it was');
  // why, said where the class is typed
  const why = comments(SECTION);
  assert.match(why, /`relative` is what keeps the PAGE from scrolling sideways \(HOME-PLANS-01, found by the look\)/);
  assert.match(why, /an absolutely positioned box is laid out against its nearest POSITIONED ancestor/);
});
