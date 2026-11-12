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
 * HOME-PLANS-02 (Alex, 2026-11-11 00:09: "Mobile should remain usable" · "Desktop and mobile remain usable."): THE
 * COMPARISON FITS A PHONE. Eight keys of the section's class grammar take the phone's values below `md` and keep the
 * desktop's behind `md:` (GRAMMAR_UNTIL, GRAMMAR_NOW, PHONE). Re-pointed for it: T4's expected markup — the table tag,
 * the plan heads and every mark cell — and T5's two source pins (the table's string; a category's toggle against the
 * plans table's group toggle, two of whose classes now stand behind `md:`). Added to T5: each of the eight strings as
 * written, and that the desktop's classes are all still there. Until then the table kept 720px at every width, and
 * on a phone its box scrolled: the names with no marks or, scrolled right, the marks with no names. T10 keeps its two
 * pins — the box does not change.
 *
 * HOME-PLANS-03 (Alex, 2026-11-11 18:17 Manila: "take the table and have the steps listed inside the cards… as they
 * apply… so that there are just 4 neat cards … and no added table, to save room and look cleaner and more crisp";
 * built 2026-11-11): THE STEPS STAND INSIDE THE FOUR CARDS, and the comparison table left the home page. The public
 * section is the pillar, the four plan cards — each listing the steps its plan ADDS, as the leaf derives them
 * (planCardSteps) — and one link to /pricing. Re-written in place for it, each under a dated note: the render helpers,
 * T4, T5 and T10. T7 changed in two places and no other: its signature pin moved to the new signature, and it gained one
 * hold — without `steps` PlanCards draws, to the byte, what it drew (the whole markup of /pricing's four cards is built
 * here from the leaf and held equal to the render T7 already made); every assertion it had stands as written. Two tests
 * are new: T11, planCardSteps in the leaf; and T12, the cards WITH `steps`. T1, T2, T3, T6, T8 and T9 are untouched —
 * the comparison stays in the leaf, undrawn, with the same standing as the status view, and T8 holds it as it did.
 *
 *   T1 the law — the live leaf passes; every refusal by name over injected sections, registry and plans; it runs at
 *      module scope;
 *   T2 the plan — the four choices give the four plans' names and audience lines as PLANS holds them; no plan, no line;
 *      the plan's price line and its button's words are its price slot's (HOME-BRIEF-04);
 *   T3 the counts — the steps, how many are live and pending, and how many need Books, computed HERE from the leaf's
 *      steps and the registry and held equal to what the leaf says; a step is LIVE exactly when every tool in it is; the
 *      Books lines follow the Books offer;
 *   T4 the section, in its four states (HOME-PLANS-04) — the pillar's name and the plans' subhead, the map, the cards and
 *      the band, the link last; none of what left (his three paragraphs, every step list, the comparison); no table,
 *      nothing that opens, no status word; two switches and a button per plan, each wired; the default export draws the
 *      pure half at rest. The cards and the band count their tools; the map draws no count of its own (Alex's note on the
 *      built page, 2026-11-12 — it drew "<n> of 25 tools" until then).
 *      (Until HOME-PLANS-04, from HOME-PLANS-03: one render, nothing in it opened — the pillar, the four cards
 *      (PlanCards' own render WITH the leaf's steps), the one link, and nothing after; each card's categories and step
 *      titles the leaf's (planCardSteps, looped — no step typed here); the bundle drew its three benefits; no table, no
 *      data-comparison hook, no aria-expanded and no screen-reader-only text; the link's words and href the leaf's; none
 *      of the status words, the switches' words, the plan line or the legend; a card's button opened the door; the
 *      default export held no state.
 *      Until HOME-PLANS-03, from HOME-PLANS-01: at rest — the pillar, the four cards with their benefits, the table
 *      with Personal open and three closed, 8 step rows and no tool row; with Business open; with a step open — its
 *      tools, their lines and its note; every button's aria-expanded; the marks under each plan for all 26 steps; no
 *      "Compare all four plans" in any render; a toggle called back with its key; the two sets, through the default
 *      export. Before that: rendered for the four choices — the pillar, then "What you run" and the two switches, the
 *      plan line with its price line, its button and the link to the four plans, the steps line and the Books line,
 *      each section's steps in ONE row that swiped sideways, the card — its step and its state, the title, each tool
 *      and its mark, its note — the Travel lines with and without Business, and the legend.)
 *   T5 the source (HOME-PLANS-04) — no leaf word, mark, status or price typed; its one typed label; two booleans in
 *      React state and nothing stored; it reads the how-to leaf, the pillars leaf and the plans leaf, and nothing from
 *      the plans section; every class is the ported stylesheet's; the leaf pure, keeping the comparison and the cards'
 *      steps, undrawn.
 *      (Until HOME-PLANS-04, from HOME-PLANS-03: no state — no hook, no storage, no URL; it read the cards' steps and the
 *      link from the leaf and took PlanCards and nothing else from the plans section; the table left with every name
 *      only it used; the link wore the house text link; the leaf pure, keeping the comparison, undrawn.
 *      Until HOME-PLANS-03, from HOME-PLANS-01: two sets in React state only; the table's box, head row and toggle
 *      were the plans table's own idioms; the marks' colours were never the status colours; eight keys of the class
 *      grammar took a phone's values below `md` — HOME-PLANS-02. Before that: no status, no plan name, no price and
 *      none of the leaf's words; two switches in React state only; the row was MY TRIP's rail.)
 *   T6 Landing mounts the section once — first under "What We Do" (HOME-FINISH-02; under the guest's strip until then),
 *      above the services section; the heading box is the reference's (HOME-PLANS-04) and its heading wears the act
 *      headings' type, About Us's (Alex's note on the built page, 2026-11-12; the eyebrow from HOME-PLANS-04 until then,
 *      and gold and one size up before that — the same type it wears again).
 *      Landing itself never names the plans section: the how-to draws its own three cards and the band (HOME-PLANS-04;
 *      PlanCards' four until then).
 *   T7 (HOME-PLANS-01, Alex, 2026-11-11 00:09: "Four plans. One comparison.") the four plan cards, exported whole from
 *      the plans section — PlanCards alone stands whole inside PlansSection's render, once, right under its subhead; four
 *      cards in PLANS' order, each with its top label, its name, its two lines, who it is for, three benefits, the
 *      launch placeholder and its door; a button door calls back with the plan's id; a link door draws the link.
 *      HOME-PLANS-03: its signature carries the one optional prop, `steps`; and without it the four cards are, to the
 *      byte, what they were — the whole markup, built here from the leaf, with a link door and with a button door.
 *   T8 (HOME-PLANS-01) the comparison, in the leaf — four columns and their heads; 8 · 9 · 4 · 5 = 26 steps and the
 *      counts' words; the in-plan grid, cell by cell, derived from each plan's modules; every step's title the leaf's;
 *      every tool's line its capability row's label (the plans leaf's — never retyped), the three tools no row names
 *      alone named; the two customer notes present and the build note absent; no status word anywhere in the view; each
 *      new refusal by name; the status view's notes unchanged by the field move.
 *   T9 (HOME-PLANS-01) the guard — one statement at the end of the plan law's line that holds the how-to's anchor
 *      (scripts/assert-tool-registry.ts): a plan that carries a price fails the build, by name; no plan carries one.
 *   T10 (HOME-PLANS-04) nothing scrolls sideways and nothing is drawn for a screen reader alone — no box, no overflow
 *      and no sr-only text, in the source or in any state's render; what a screen reader hears is what a visitor reads:
 *      every decorative mark hidden, every tool's mark carrying its label; the plans table's own box is untouched; the
 *      section's header says what left.
 *      (Until HOME-PLANS-04, from HOME-PLANS-03: the comparison's box left with its table — no box, no overflow-x-auto
 *      and no sr-only span, in the source or in the render; the plans table's own box untouched; the section's header
 *      said what left.
 *      Until HOME-PLANS-03, from HOME-PLANS-01's fix after the look: the comparison's box held its own screen-reader
 *      text — the box was positioned and was the one thing in the section that scrolled sideways; every sr-only span
 *      the section drew sat inside it, at rest and with everything open; the reason stood where the class was typed.
 *      Before the fix the box was unpositioned: that text was laid out against the page, outside the box's clip, and
 *      a 390 or a 360 screen scrolled sideways to 694 — measured in the look.)
 *   T11 (HOME-PLANS-03) what a card lists, in the leaf — planCardSteps: Personal lists Personal and Travel (Travel in
 *      its without-Business words), Personal + Business lists Business, Personal + Trading lists Trade, the bundle
 *      lists none; the same derived here another way, from each plan's modules; every heading and title the leaf's;
 *      the four cards together list every category once; no tool, no note and no status in what it returns; a fifth
 *      plan that holds what Personal holds inherits nothing new; the sections' order is the cards' order; a plan with
 *      no module is refused by name.
 *   T12 (HOME-PLANS-03) the cards with `steps` — the same four cards but for two things: where a plan adds categories
 *      they stand where its benefits stood, and the grid is also two across from md; a plan that lists none draws its
 *      three benefits; a plan `steps` does not name is a throw, by name; the cards type no step, no heading and no mark
 *      of their own — the mark and the type of `steps` are the how-to leaf's; a category's heading wears the card's own
 *      top label.
 * HOME-PLANS-04 (Alex's brief, 2026-11-12 14:07 Manila; the board approved on the design canvas at 14:30): THE FINANCIAL SOFTWARE
 * SECTION — the pillar's name and one line, the map of the 25 tools with its two switches, three plan cards and the all-three band, the
 * one link; "What We Do" wore the eyebrow. The section's whole markup, its stylesheet, its tokens and its words are held to the
 * reference (design-refs/home-plans-04/Section-Reference.html) in homePlans04.test.ts — but for Alex's notes on the built page
 * (2026-11-12), which that file names: "What We Do" in About Us's type again, no count over the map, and the Personal pill says
 * "Personal". Re-written in place here, each under a dated note: the render helper (it takes what you run now), T4 and T5 (the
 * section rendered, and its source), T6's heading box and its name (the how-to draws its own three cards and the band now) and T10
 * (what a screen reader hears) — and, for Alex's notes, T4's count pin and T6's heading box again; the list above says what each
 * holds now, and what it held until then. T9 gains a note and no assertion: the guard stands as it was (the brief's ruling d). T1, T2, T3,
 * T7, T8, T11 and T12 are untouched — PlanCards, the comparison and planCardSteps stand as they were, undrawn on this page.
 *
 * Source is read through code() and comments() only (the reader law). No count of what is live is typed: each is
 * computed (T3). The step counts — 8 · 9 · 4 · 5 — are the brief's own figures, held both ways (T8, T11). No clock, no live call.
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
import { PRIMARY_CTA } from '../ds';
import { TOOL_REGISTRY, type ToolEntry } from '../toolRegistry';
import { CAPABILITY_GROUPS, EARLY_ACCESS_CTA, LAUNCH_PLACEHOLDER, PLANS, PLANS_SUBHEAD, priceSlot, type Plan } from '../offer/plans';
import { OFFERS } from '../offer';
import {
  ADD_BUSINESS, ADD_TRADE, COMPARE_PLANS_PATH, COMPARE_PLANS_WORDS, COMPARISON_FIRST_HEAD, HOW_TO_CHOICES, HOW_TO_SECTIONS,
  HOW_TO_SECTION_ORDER, HowToLawError, PLAN_HEADS, PLAN_MARKS, categoryHeading, choiceOf, planCardSteps, planComparison, stepCountWords, toolLine, LEGEND_BOOKS_LINE, LEGEND_STEP_LINE, LEGEND_TITLE, NEEDS_BOOKS, NEXT_LINE, PERSONAL_ALWAYS, STEP_LIVE,
  STEP_PENDING, TOOL_MARKS, WHAT_YOU_RUN_LABEL, booksLine, booksNotOnSale, cardStep, howToLaw, howToView, modulesOf, planFor, planLine, priceLine,
  sectionShown, stepsLine, type HowToChoice, type HowToSection, type PlanCardSteps,
} from '../howTo';
import { PLAN_PILLAR } from '../homeActWords';
import HowToSectionDefault, { HowToView } from '@/components/landing/HowToSection';
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
/**
 * HOME-PLANS-04 (2026-11-12): THE PURE HALF, RENDERED — for what you run: Business and Trading, each on or off. The default export holds
 * the two booleans; the pure half draws any of the four states from them. At rest by default.
 * (Until then — HOME-PLANS-03 — it had ONE render: nothing in the section opened, so it took the door and nothing else:
 * `renderToStaticMarkup(React.createElement(HowToView, { onJoin: () => {} }))`. Before that it was rendered for one open state of the comparison —
 * `type Open = { categories; steps }`, `render(open)` handing HowToView the two sets and their two handlers — and BOX_TAG held the comparison's box as
 * drawn, positioned and the one thing in the section that scrolled sideways:
 * '<div class="relative mt-8 overflow-x-auto rounded-lg border border-border bg-white" data-plan-comparison="true">'.
 * Until HOME-PLANS-01 it took a choice and the two switches' handlers.)
 */
const render = (choice: HowToChoice = HOW_TO_CHOICES[0]): string =>
  renderToStaticMarkup(React.createElement(HowToView, { business: choice.business, trade: choice.trade, onBusiness: () => {}, onTrade: () => {}, onJoin: () => {} }));
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

/** The words no render of the public block may hold: every status word, and the two phrases that count what is live or for sale. */
const NO_STATUS = ['LIVE', 'PENDING', 'PARTIAL', 'NOT BUILT', 'NOT_BUILT', 'NEEDS BOOKS', 'on sale', 'live today'];
/**
 * The act's own tag, as drawn. HOME-PLANS-04 (2026-11-12): the ported stylesheet's class, the id first — the plan law, footer01 and heroCrest01 hold the
 * literal `<section id="modules"`. (Until then:
 * '<section id="modules" aria-label="Software plans" class="w-full border-b border-border bg-bg-terminal" data-how-to="true">'.)
 */
const ACT_TAG = '<section id="modules" class="ts-fs" aria-label="Software plans" data-how-to="true">';
/**
 * The one link under the band, as drawn — the reference's (.ts-fs__compare): the leaf's words, to the leaf's path. HOME-PLANS-04 (2026-11-12).
 * (Until then it wore the house text link under a top margin, held here as COMPARE_CLASSES:
 * 'mt-4 inline-flex min-h-[44px] items-center font-mono text-xs tracking-wider text-brand-purple hover:text-brand-purple-hover'.)
 */
const LINK = `<a class="ts-fs__compare" href="${COMPARE_PLANS_PATH}" data-compare-plans="true">${asHtml(COMPARE_PLANS_WORDS)}</a>`;
/**
 * HOME-PLANS-03 (2026-11-11) — THE CARDS, AS DRAWN: the four plan cards' whole markup, built HERE from the leaves — each plan's words (PLANS), its
 * price slot (priceSlot) and, when `steps` is handed in, what its card lists (planCardSteps). Every class is typed as PlansSection.tsx draws it, so
 * a render is held to the byte (T4, T7). Without `steps` this is the markup the cards had before this brief: /pricing's grid, the three benefits.
 * (Until then this block held the comparison's render helpers: the marks' classes — MARK_IN 'font-mono text-sm text-brand-purple', MARK_OUT
 * 'font-mono text-sm text-text-faint'; HOME-PLANS-02's three grammars of the eight class keys a phone changed — GRAMMAR_UNTIL, GRAMMAR_NOW, PHONE;
 * marksHtml, one cell per plan; and the table's rows as regular-expression sources built from planComparison, row by row — categoryRow, lineRow,
 * stepRow, toolsRow, bodyRows. They left with the table they drew.)
 */
/** The classes the card's top label wears — and, since HOME-PLANS-03, a category's heading on a card. */
const LABEL_CLASSES = 'font-mono text-[10px] font-semibold uppercase tracking-wider text-text-faint';
/** The cards' grid: as /pricing draws it; and with `steps`, as the home page draws it — also two across from md. */
const GRID_TAG = '<div class="mt-6 grid gap-4 lg:grid-cols-4">';
const GRID_TAG_WITH_STEPS = '<div class="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">';
/** A step on a card: the leaf's in-plan mark — hidden from a screen reader, brand purple, in the gold dot's seat — then the step's title. */
const stepHtml = (title: string) => `<li class="flex gap-2" data-plan-step="true"><span aria-hidden="true" class="text-brand-purple">${PLAN_MARKS.inPlan.mark}</span><span>${asHtml(title)}</span></li>`;
/** A benefit on a card: the gold dot, then the words. */
const benefitHtml = (words: string) => `<li class="flex gap-2" data-plan-benefit="true"><span aria-hidden="true" class="text-brand-gold">·</span><span>${asHtml(words)}</span></li>`;
/** The door a card is built with: a button, or a link to an href. */
type DoorAs = 'button' | { href: string };
/** One plan's card. `listed` is what `steps` gives its plan — null when no `steps` is handed in. */
function cardHtml(plan: Plan, door: DoorAs, listed: PlanCardSteps | null): string {
  const slot = priceSlot(plan);
  // The launch slot's markup, and no other: no plan carries a price (T9 holds it, and so does the build's guard). A priced slot draws more — say it here on the day one is ruled.
  if (slot.kind !== 'unannounced') assert.fail(`${plan.id} carries a price — this builder holds the launch slot's markup only`);
  const tone = `${plan.id === 'everything' ? 'border-brand-purple shadow-sm' : ''} ${plan.id === 'personal' ? 'border-brand-gold/60' : ''}`;
  const head = `<div><p class="${LABEL_CLASSES}" data-plan-role="true">${asHtml(plan.role)}</p><h3 class="mt-1 text-lg font-semibold text-brand-purple" data-plan-name="true">${asHtml(plan.name)}</h3>`
    + `<p class="mt-1 text-sm text-text-primary" data-plan-positioning="true">${asHtml(plan.positioning)}</p><p class="mt-2 text-xs text-text-muted" data-plan-audience="true">${asHtml(plan.audience)}</p>`
    + `<p class="mt-1 text-xs text-text-secondary" data-plan-relationship="true">${asHtml(plan.relationship)}</p></div>`;
  // Where the benefits stood: the categories the plan adds — or, for a plan that adds none and for a card with no `steps`, its three benefits.
  const list = listed !== null && listed.categories.length > 0
    ? listed.categories.map((c) => `<div data-plan-category="${c.id}"><h4 class="${LABEL_CLASSES}">${asHtml(c.heading)}</h4><ul class="mt-2 space-y-1.5 text-sm text-text-secondary">${c.steps.map(stepHtml).join('')}</ul></div>`).join('')
    : `<ul class="space-y-1.5 text-sm text-text-secondary">${plan.benefits.map(benefitHtml).join('')}</ul>`;
  const cta = asHtml(slot.cta);
  const doorHtml = door === 'button' ? `<button type="button" class="${PRIMARY_CTA}" data-plan-cta="${plan.id}">${cta}</button>` : `<a class="${PRIMARY_CTA}" data-plan-cta="${plan.id}" href="${door.href}">${cta}</a>`;
  const price = '<div class="mt-auto flex min-h-[128px] flex-col justify-end gap-2" data-price-slot="unannounced" data-price-where="card">'
    + (slot.bestValue === null ? '' : `<div class="min-h-[20px]" data-best-value="${slot.bestValue}"></div>`)
    + `<span class="font-mono text-sm text-text-secondary" data-price-placeholder="true">${asHtml(slot.text)}</span>${doorHtml}</div>`;
  return `<div class="flex flex-col gap-4 rounded-lg border border-border bg-white p-5 ${tone}" data-plan="${plan.id}" data-plan-modules="${plan.modules.join(' ')}">${head}${list}${price}</div>`;
}
/** The four cards in their grid, in PLANS' order. With `steps`, each card lists what the leaf gives its plan. */
function cardsHtml(door: DoorAs, steps?: readonly PlanCardSteps[]): string {
  const cards = PLANS.map((plan) => {
    if (steps === undefined) return cardHtml(plan, door, null);
    const listed = steps.find((s) => s.plan === plan.id);
    assert.ok(listed, `${plan.id}: the leaf lists an entry for it`);
    return cardHtml(plan, door, listed);
  });
  return `${steps === undefined ? GRID_TAG : GRID_TAG_WITH_STEPS}${cards.join('')}</div>`;
}
/** A step and a benefit, as drawn — each captures its words (a step: its mark, then its title). */
const STEP_LI = /<li class="flex gap-2" data-plan-step="true"><span aria-hidden="true" class="text-brand-purple">([^<]*)<\/span><span>([^<]*)<\/span><\/li>/g;
const BENEFIT_LI = /<li class="flex gap-2" data-plan-benefit="true"><span aria-hidden="true" class="text-brand-gold">·<\/span><span>([^<]*)<\/span><\/li>/g;

// HOME-PLANS-04 (2026-11-12): T4 RE-WRITTEN IN PLACE — the section is the pillar's name and one line, the map, three plan cards and the band, and the
// one link; its whole markup is held to the reference's, token for token, in homePlans04.test.ts. Until then (HOME-PLANS-03): ONE render — the pillar
// with his three paragraphs, the four cards (PlanCards' own render handed the leaf's steps, held to the byte through cardsHtml), the link with nothing
// after; every card's categories and step titles the leaf's, behind the in-plan mark ✓, hidden from a screen reader; the bundle's three benefits; one
// h2, four buttons and no other; no count of the tools (/\d+ tools\b/); "placeholder" four times, the price slot's hook; none of the switches' words,
// no aria-pressed and no "Your plan"; and a default export with no state, called outside any render. (Before that: the comparison at rest and opened,
// its marks under each plan, and the two open-sets driven through the default export inside a host's render.)
test('T4 (HOME-PLANS-04) the section, rendered in its four states: the pillar\'s name and one line, the map, three cards and the band, the one link last; none of what left — his paragraphs, the step lists, the comparison; no table, nothing that opens, no status word; two switches and a button per plan, each wired; the default export draws the pure half at rest', () => {
  const steps = planCardSteps();
  const comparison = planComparison();
  const undrawn = [comparison.firstHead, ...comparison.columns.filter((c) => c.head !== c.name).map((c) => `>${c.head}<`),
    ...comparison.categories.flatMap((c) => [c.line, ...c.steps.flatMap((step) => [...step.tools.map((t) => t.line), ...(step.note === null ? [] : [step.note])])])];
  assert.ok(undrawn.length > PLANS.length, 'the comparison\'s words, read from the leaf');
  // IN NO RENDER: a status word, a step line, the legend, the build note, the old switch word "+ Trade", a status colour
  const gone = [...NO_STATUS, STEP_LIVE.words, STEP_PENDING.words, ...Object.values(TOOL_MARKS).flatMap((m) => [m.words, m.means]), `>${ADD_TRADE}<`,
    'Your steps', 'need Books', asHtml(NEXT_LINE), LEGEND_TITLE, asHtml(LEGEND_STEP_LINE), asHtml(LEGEND_BOOKS_LINE), 'No customer can open a trading book yet',
    PIPELINE_DOOR, `href="${PIPELINE_PATH}"`, 'data-how-to-switch', 'data-how-to-plan', 'data-how-to-price', 'data-how-to-cta', 'data-how-to-compare', 'data-how-to-steps', 'data-how-to-books', 'data-how-to-section', 'data-how-to-row', 'data-how-to-card', 'data-how-to-state', 'data-how-to-mark', 'data-how-to-legend',
    'text-status-', 'text-brand-amber', 'text-brand-red', 'text-brand-green'];
  for (const choice of HOW_TO_CHOICES) {
    const html = render(choice);
    const w = words(choice);
    // the act: its id (the checkout's cancel link, /modules and the footer's first link land on it), its label, its class
    assert.ok(html.startsWith(ACT_TAG), `${w}: the act's own tag — aria-label "How to" until HOME-PLANS-01`);
    assert.equal(count(html, 'id="modules"'), 1, `${w}: the anchor, once`);
    // the pillar's name, the one line where his paragraphs stood, then the map
    assert.ok(html.startsWith(`${ACT_TAG}<div class="ts-fs__inner"><h2 class="ts-fs__title">${asHtml(PLAN_PILLAR.heading)}</h2><p class="ts-fs__lede">${asHtml(PLANS_SUBHEAD)}</p><div class="ts-fs-map">`), `${w}: the pillar's name, the plans' subhead, the map`);
    assert.equal(count(html, '<h2'), 1, `${w}: one h2 — the pillar's`);
    // the map's 25 tools, then the plans in PLANS' order: three cards, then the band
    assert.equal(count(html, 'class="ts-fs-tool"'), 25, `${w}: the sheet's 25 tools`);
    assert.deepEqual([...html.matchAll(/data-plan="([^"]+)"/g)].map((m) => m[1]), PLANS.map((p) => p.id), `${w}: the plans, in PLANS' order`);
    // WHAT LEFT: his three paragraphs, every card's step list (planCardSteps), the comparison — each stays in its leaf, undrawn
    for (const para of PLAN_PILLAR.paragraphs) assert.equal(count(html, asHtml(para)), 0, `${w}: "${para.slice(0, 30)}…" is not drawn`);
    for (const text of steps.flatMap((s) => s.categories.flatMap((c) => [c.heading, ...c.steps]))) assert.equal(count(html, asHtml(text)), 0, `${w}: the step "${text.slice(0, 30)}" is not drawn`);
    for (const text of undrawn) assert.equal(count(html, asHtml(text)), 0, `${w}: the comparison's "${text.slice(0, 30)}" is not drawn`);
    assert.equal(count(html, PLAN_MARKS.inPlan.mark), 0, `${w}: no ✓ glyph — a tool's mark is the reference's tick, carrying its label`);
    // no table, nothing that opens, nothing that scrolls sideways, no screen-reader-only text
    for (const markup of ['<table', '<thead', '<tbody', '<th ', '<td', 'data-plan-comparison', 'data-comparison-', 'data-plan-step', 'data-plan-category', 'aria-expanded', 'sr-only', 'overflow-x-auto', 'colspan', 'colSpan']) assert.equal(count(html, markup), 0, `${w}: no ${markup}`);
    for (const word of gone) assert.equal(count(html, word), 0, `${w}: no "${word}"`);
    // the cards' counts are drawn (ruling f: "Both numbers are computed"); still no guide line, nothing coming soon. The map's own count is not:
    // AFTER THE BUILD (Alex's note on the built page, 2026-11-12: "then 13 of 25 tools is tacky, we dont need that to tell us, we can just
    // count..."). Until then this pinned it: '<span class="ts-fs-map__figure">\d+<\/span> <span>of 25 tools<\/span>' — the count over the sheet's tools.
    assert.doesNotMatch(html, /\bguide\b|coming soon/i, `${w}: no guide line, nothing coming soon`);
    for (const markup of ['ts-fs-map__count', 'ts-fs-map__figure', 'aria-live']) assert.equal(count(html, markup), 0, `${w}: no count over the map — no ${markup}`);
    assert.equal(count(html, 'of 25 tools'), 3, `${w}: the three cards count their tools — and nothing else does`);
    assert.equal(count(html, 'All 25 tools'), 1, `${w}: the band counts all`);
    // THE LINK — one, last: the leaf's words, to the leaf's path
    assert.equal(count(html, '<a '), 1, `${w}: one link`);
    assert.ok(html.endsWith(`${LINK}</div></section>`), `${w}: the last thing in the section`);
    // the buttons: the two switches and a button per plan — and no other
    assert.equal(count(html, '<button'), 2 + PLANS.length, `${w}: two switches and a button per plan`);
    assert.equal(count(html, 'aria-pressed='), 2, `${w}: each switch says whether it is on`);
    assert.equal(count(html, 'aria-pressed="true"'), Number(choice.business) + Number(choice.trade), `${w}: on as chosen`);
  }
  // the default export draws the pure half — at rest
  assert.equal(renderToStaticMarkup(React.createElement(HowToSectionDefault, { onRequireAuth: () => {} })), render(), 'the default export, at rest: the pure half with both switches off');
  // THE DOOR — each plan's button opens it; each switch turns its own; the link is a plain anchor, with no handler
  const calls: string[] = [];
  const drawn = drawnElementsOf(HowToView({ business: false, trade: false, onBusiness: () => { calls.push('business'); }, onTrade: () => { calls.push('trade'); }, onJoin: () => { calls.push('join'); } }));
  const buttons = drawn.filter((el) => el.type === 'button');
  assert.equal(buttons.length, 2 + PLANS.length);
  for (const b of buttons) (b.props.onClick as () => void)();
  assert.deepEqual(calls, ['business', 'trade', ...PLANS.map(() => 'join')], 'each switch turns its own; each plan\'s button opens the door');
  const anchors = drawn.filter((el) => el.type === 'a');
  assert.equal(anchors.length, 1, 'the one link');
  assert.deepEqual(Object.keys(anchors[0].props).sort(), ['children', 'className', 'data-compare-plans', 'href'], 'a plain anchor: where it goes, how it looks, its hook, its words');
});

// ── T5 · THE SOURCE ──────────────────────────────────────────────────────────

// HOME-PLANS-04 (2026-11-12): T5 RE-WRITTEN IN PLACE — the section draws the board: its own classes (the ported stylesheet's), two booleans in React
// state, two switches and a button per plan, and it reads the plans leaf for the question and the one line. Until then (HOME-PLANS-03): NO STATE — no
// hook, so no `useState` and no 'react' among its imports; three imports — the how-to leaf for the cards' steps and the link ('{ COMPARE_PLANS_PATH,
// COMPARE_PLANS_WORDS, planCardSteps }'), the pillars leaf, and PlanCards and nothing else from the plans section; no <button> and no aria-pressed of its
// own; WHAT_YOU_RUN_LABEL, PERSONAL_ALWAYS and PLAN_MARKS among the names that had left; the act's tag '<section id="modules" aria-label="Software
// plans" className="w-full border-b border-border bg-bg-terminal" data-how-to>'; the pillar's h2 and his paragraphs through a four-key class grammar —
// inner 'max-w-7xl mx-auto px-4 lg:px-8 pt-6 pb-10', h2 'text-2xl sm:text-3xl font-medium tracking-tight text-brand-purple', pillar 'mt-3 max-w-3xl text-base
// text-text-secondary', compare (the house text link); the order pillar → cards → link; and "'use client' STAYS, FOR THE DOOR: this file builds the
// button door's click handler". (The comparison's source pins before that, HOME-PLANS-01 and -02, are named in T5's own history above.)
test('T5 (HOME-PLANS-04) the source: the section types no leaf word, no mark, no status and no price — its only typed words are its aria-label; two booleans in React state and nothing stored; it reads the how-to leaf, the pillars leaf and the plans leaf, and nothing from the plans section; every class is the ported stylesheet\'s; the leaf is pure and keeps the comparison and the cards\' steps, undrawn', () => {
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
  // PILLAR-NAMES-01 (Alex, 2026-11-11: "Financial Software | Professional Services | Travel Marketplace — these will replace Plan your Escape /
  // Build your Income / Explore the World"): the first pillar's name, and no full stop — 'Plan Your Escape.' until then. His paragraphs are untouched.
  assert.equal(PLAN_PILLAR.heading, 'Financial Software');
  assert.deepEqual([...PLAN_PILLAR.paragraphs], [
    'Get your bank data. Turn it into financial statements. See your income and expenses, what you own, what you owe, and what living at home actually costs.',
    'Plan ahead, budget for what you want to do, prepare for tax time, and compare your plans with what actually happened.',
    'Connect the dots across your personal, business, and trading finances to make better decisions about what comes next.',
  ]);
  // none of the leaves' words: the pillar's, the cards', each category's heading and each step's title, the link's — and none of the comparison's
  // or the status view's, which are drawn here no more
  assert.equal(COMPARE_PLANS_WORDS, 'Compare all four plans →');
  assert.equal(COMPARE_PLANS_PATH, '/pricing');
  const typed = [PLAN_PILLAR.heading, ...PLAN_PILLAR.paragraphs, COMPARISON_FIRST_HEAD, PLAN_MARKS.inPlan.label, PLAN_MARKS.notInPlan.label, LAUNCH_PLACEHOLDER, EARLY_ACCESS_CTA,
    ...planCardSteps().flatMap((card) => card.categories.flatMap((c) => [c.heading, ...c.steps])),
    ...view.categories.flatMap((c) => [c.heading, c.countWords, c.line, ...c.steps.flatMap((step) => [step.title, ...step.tools.map((t) => t.line), ...(step.note === null ? [] : [step.note])])]),
    ...HOW_TO_SECTIONS.flatMap((s) => s.steps.flatMap((step) => (typeof step.title === 'string' ? [step.title] : [step.title.withBusiness, step.title.withoutBusiness]))),
    'Software plans →', 'Here’s how you actually do it.', 'Personal is everyone’s.', WHAT_YOU_RUN_LABEL, PERSONAL_ALWAYS, ADD_BUSINESS, ADD_TRADE, NEXT_LINE, COMPARE_PLANS_WORDS, COMPARE_PLANS_PATH, 'NEEDS BOOKS', 'NOT ON SALE YET', 'YOUR STEP', LEGEND_TITLE, LEGEND_STEP_LINE, LEGEND_BOOKS_LINE, PIPELINE_DOOR, stepCountWords(1), stepCountWords(2)];
  for (const w of typed) assert.ok(!flat.includes(w), `the section does not type "${w.slice(0, 40)}"`);
  for (const head of Object.values(PLAN_HEADS)) assert.ok(!flat.includes(`'${head}'`) && !flat.includes(`"${head}"`) && !flat.includes(`>${head}<`), `nor the head "${head}"`);
  // what it does type: one aria-label, and — between its tags — nothing a visitor reads
  assert.deepEqual([...section.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]), ['Software plans'], 'its one aria-label — "How to" until HOME-PLANS-01');
  const drawnAt = section.indexOf('<section id="modules"');
  const drawnEnd = section.lastIndexOf('</section>');
  assert.ok(drawnAt > -1 && drawnEnd > drawnAt, 'the pure half\'s markup: from the act\'s opening tag to its closing tag');
  // `>text<` with no brace in it is a literal a visitor would read (the plan law's own scan); an arrow function's opening parenthesis is not text
  assert.deepEqual([...section.slice(drawnAt, drawnEnd).matchAll(/>([^<>{}]+)</g)].map((m) => m[1].trim()).filter((text) => /[A-Za-z0-9]/.test(text)), [], 'no text is typed between its tags');
  // nothing opens, so nothing signs it: no − and no +, no aria-expanded (until HOME-PLANS-03 a category's and a step's sign each stood once, in expressions).
  // HOME-PLANS-04: its buttons are the board's — a switch, written once and drawn for each module the leaf names, and a plan's, written once and drawn
  // for each plan (until then: no <button> of its own)
  for (const sign of ['−', '\'+\'', 'aria-expanded']) assert.equal(count(section, sign), 0, `the section types no ${sign}`);
  assert.equal(count(section, '<button'), 2, 'two buttons written: the switch and the plan\'s');
  assert.equal(count(section, 'aria-pressed={s.pressed}'), 1, 'a switch says whether it is on');
  // the act, as ruled; the pillar's name, and the one line where his paragraphs stood
  assert.match(section, /^'use client';/);
  assert.match(comments(SECTION), /'use client' STAYS, FOR THE STATE AND THE DOOR: the two switches are React state, and each plan's button calls the door Landing/, 'why the directive stays, said in the header');
  assert.match(section, /<section id="modules" className="ts-fs" aria-label="Software plans" data-how-to>/, 'the act — id="modules" since HOME-BRIEF-04, first in its tag (the plan law, footer01 and heroCrest01 hold that literal); aria-label "How to" until HOME-PLANS-01');
  assert.equal(count(section, 'id="modules"'), 1);
  assert.match(section, /^import \{ PLAN_PILLAR \} from '@\/lib\/homeActWords';$/m, 'the pillar\'s name from its leaf');
  assert.equal(count(section, '<h2 className="ts-fs__title">{PLAN_PILLAR.heading}</h2>'), 1, 'the pillar\'s name, the section\'s one h2');
  assert.equal(count(section, '<h2'), 1);
  assert.equal(count(section, '<p className="ts-fs__lede">{PLANS_SUBHEAD}</p>'), 1, 'one line where his three paragraphs stood: the plans\' subhead');
  assert.ok(!section.includes('paragraphs'), 'his paragraphs are read no more — they stay in their leaf, undrawn (ruling c)');
  // what it reads: React's state; the how-to leaf; the pillars leaf; the plans leaf — and nothing from the plans section
  assert.deepEqual([...section.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]), ['react', '@/lib/howTo', '@/lib/homeActWords', '@/lib/offer/plans'], 'four imports — PlanCards and the plans section left');
  assert.match(section, /^import \{ useState \} from 'react';$/m, 'React\'s state, and nothing else of React');
  assert.match(section, /^import \{ PLANS_HEADLINE, PLANS_SUBHEAD \} from '@\/lib\/offer\/plans';$/m, 'the question and the line, from the plans leaf');
  for (const goneName of ['PlanCards', 'PlansSection', 'planCardSteps', 'planComparison', 'howToView', 'TOOL_MARKS', 'LEGEND_', 'ADD_BUSINESS', 'ADD_TRADE', 'HowToChoice', 'PRIMARY_CTA', 'chip(', "from 'next/link'", 'pipelineWords', 'PIPELINE_',
    'data-how-to-', 'data-plan-step', 'data-plan-category', 'data-plan-comparison', 'sr-only', '<table', 'overflow-x-auto', 'snap-x', 'HOW.', 'Fragment']) {
    assert.ok(!section.includes(goneName), `${goneName}: not in the section`);
  }
  // the one link: the leaf's path and words, the reference's class
  assert.equal(count(section, '<a className="ts-fs__compare" href={COMPARE_PLANS_PATH} data-compare-plans>{COMPARE_PLANS_WORDS}</a>'), 1, 'the one link: the leaf\'s path, the leaf\'s words');
  assert.equal(count(section, '<a '), 1, 'and no other link');
  // the order: the name → the line → the map → the cards → the band → the link → the act closes
  const drawnClose = section.lastIndexOf('</section>');
  const order = ['<h2 className="ts-fs__title">', '<p className="ts-fs__lede">', '<div className="ts-fs-map">', '<div className="ts-fs-plans">', '<div className="ts-fs-plan ts-fs-plan--all"', '<a className="ts-fs__compare"'].map((s) => section.indexOf(s));
  assert.ok(order.every((at, i) => at > -1 && (i === 0 || at > order[i - 1])) && drawnClose > order[order.length - 1], 'the name → the line → the map → the cards → the band → the link');
  assert.match(section, /export default function HowToSection\(\{ onRequireAuth \}: \{ onRequireAuth: \(\) => void \}\) \{/, 'Landing hands it the door');
  assert.equal(count(section, 'onJoin={onRequireAuth}'), 1, 'and every plan\'s button gets that door');
  // STATE (ruling a): two booleans, both off at first — no other hook, nothing stored, no URL, no clock
  assert.equal(count(section, 'useState('), 2, 'two booleans in React state');
  assert.equal(count(section, 'const [business, setBusiness] = useState(false);') + count(section, 'const [trade, setTrade] = useState(false);'), 2, 'both off at first: a reload starts at Personal');
  assert.doesNotMatch(section, /\buse(Effect|LayoutEffect|Reducer|Ref|Router|SearchParams|Pathname|Context)\b/, 'no other hook');
  assert.doesNotMatch(section, /localStorage|sessionStorage|document\.cookie|window\.|location\b|\bfetch\s*\(|new Date\(|Date\.now\(/, 'no storage, no URL, no fetch, no clock');
  // PAINT: no colour typed; every class is the ported stylesheet's, and none is computed
  assert.doesNotMatch(section, /#[0-9a-fA-F]{3,8}\b|\brgba?\(/, 'no colour typed');
  assert.doesNotMatch(section, /text-status-|bg-status-|text-brand-amber|text-brand-red|text-brand-green|text-brand-gold/, 'never the status colours, nor a house colour utility');
  const classes = [...section.matchAll(/className="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/));
  assert.ok(classes.length > 30 && classes.every((c) => c.startsWith('ts-fs')), `every class is the ported stylesheet's (${classes.length})`);
  assert.doesNotMatch(section, /className=\{/, 'and none is computed');
  // the plans table's own idioms stand as they were (PlansSection.tsx) — /pricing draws them. (Until HOME-PLANS-03 the section's box, head row, first
  // head and two toggles were held against them, class by class; the section draws no table now, so only their side of the pin remains.)
  const plans = code(PLANS_SECTION);
  assert.ok(plans.includes('<div className="mt-3 overflow-x-auto rounded-lg border border-border bg-white" data-plan-table>'), 'the plans table\'s box');
  assert.ok(plans.includes('<tr className="border-b border-border bg-bg-row text-left align-top">'), 'the plans table\'s head row');
  assert.ok(plans.includes('<th className={`px-3 py-3 ${DATA.columnHeader}`}>'), 'the plans table\'s first head');
  assert.match(plans, /className="flex w-full items-center justify-between [^"]*"\s*data-plan-group-toggle/, 'the plans table\'s group toggle');
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
  // HOME-PLANS-03: KEPT, NOT DRAWN — the comparison stays in the leaf too, exported as it was, beside what the cards list now; the leaf's doc says so, dated
  for (const kept of ['export function planComparison(', 'export const COMPARISON_FIRST_HEAD', 'export const PLAN_HEADS:', 'export const PLAN_MARKS', 'export function toolLine(', 'export function planCardSteps(', 'export const COMPARE_PLANS_PATH']) {
    assert.equal(count(leaf, kept), 1, `the leaf keeps ${kept}`);
  }
  const leafDoc = comments(LEAF);
  assert.match(leafDoc, /HOME-PLANS-03 \(Alex, 2026-11-11 18:17 Manila: /, 'the ruling, dated, in the leaf\'s doc');
  assert.match(leafDoc, /KEPT, NOT DRAWN \(2026-11-11\): the comparison — planComparison with COMPARISON_FIRST_HEAD, PLAN_HEADS, toolLine/, 'the comparison is kept, undrawn — said in the leaf\'s doc, dated');
  assert.match(leafDoc, /the same standing as\s+\*?\s*the status view \(howToView\)/, 'with the status view\'s standing');
  // HOME-BRIEF-04 (Alex, 2026-11-10 19:00): four more — Trade Log, Brokerage, Tax, Compliance, each behind a key only Books grants. The six until then.
  assert.deepEqual([...NEEDS_BOOKS], ['Banking', 'Bookkeeping', 'Expenses', 'Bill Pay', 'Budget', 'Tasks', 'Trade Log', 'Brokerage', 'Tax', 'Compliance'], 'the ten tools that need Books');
});

// ── T6 · THE SEAT ────────────────────────────────────────────────────────────

test('T6 Landing mounts the how-to once, with the door — first under "What We Do" (HOME-FINISH-02) and above the services section, comments between each; the heading box is the reference\'s (HOME-PLANS-04) and its heading wears About Us\'s type (Alex\'s note on the built page, 2026-11-12; the eyebrow until then); Landing itself never names the plans section — the how-to draws its own three cards and the band (HOME-PLANS-04; PlanCards\' four until then)', () => {
  const landing = code(LANDING);
  const ONLY_COMMENTS = /^\s*(\{\s*\}\s*)*$/;
  // HOME-BRIEF-04 (Alex, 2026-11-10 19:00): the how-to IS the Software Plans — the plans mount ("<PlansSection door={{ kind: 'button', onClick: () =>
  // onRequireAuth() }} />") left the page, and the how-to, mounted bare ('<HowToSection />') directly under it until then, takes its seat and its door.
  // HOME-FINISH-02 (Alex, 2026-11-10 20:56): PLAN → BUILD → EXPLORE — the how-to is the first pillar, directly under the "What We Do" heading, which
  // stands alone in the page's container. Until then its upper neighbour was the guest's strip ('<GuestTripStrip onRequireAuth={onRequireAuth} />':
  // "the guest's strip → the how-to → the services section", a comment between each).
  // HOME-PLANS-04 (Alex's brief, 2026-11-12 14:07 Manila), in the brief's own words: "What We Do" keeps its element, its place and data-act-heading.
  // Only its look changes: the eyebrow. — the reference's box and heading behind the house prefix. Until then (HOME-FINISH-02: "in gold and one size up"):
  // '<div className="max-w-7xl mx-auto px-4 lg:px-8 pt-10">\n        <h2 className="text-3xl sm:text-4xl font-medium tracking-tight text-brand-gold" data-act-heading>{WHAT_WE_DO_HEADING}</h2>\n      </div>'
  // AFTER THE BUILD (Alex's note on the built page, 2026-11-12: "i like how about us and What We do were the same.  About us is better size...
  // IMO..."): the heading wears the act headings' type again — HOME-FINISH-02's string, About Us's — in the reference's box. Until then (HOME-PLANS-04):
  // '<div className="ts-fs-heading">\n        <h2 className="ts-fs-eyebrow" data-act-heading>{WHAT_WE_DO_HEADING}</h2>\n      </div>'
  const HEADING_BOX = '<div className="ts-fs-heading">\n        <h2 className="text-3xl sm:text-4xl font-medium tracking-tight text-brand-gold" data-act-heading>{WHAT_WE_DO_HEADING}</h2>\n      </div>';
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

test('T7 (HOME-PLANS-01) the four plan cards are exported whole: PlanCards alone stands whole inside PlansSection\'s render, once, right under its subhead; four cards in PLANS\' order, each with its top label, its name, its two lines, who it is for, three benefits, the launch placeholder and its door; a button door calls back with the plan\'s id; a link door draws the link; (HOME-PLANS-03) its signature carries one optional prop, `steps` — and without it the four cards are, to the byte, what they were', () => {
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
  // HOME-PLANS-03 (2026-11-11): WITHOUT `steps`, THE CARDS ARE WHAT THEY WERE — TO THE BYTE. The whole markup of the four cards is built here from the
  // leaf (cardsHtml: every class as the cards wore it before this brief, the plan's words, its three benefits, its launch slot, its door) and held
  // equal to PlanCards' own render — the string this test already builds, and the one that stands whole inside /pricing's section above.
  assert.equal(cards, cardsHtml({ href: '/' }), 'without `steps`: exactly the four cards /pricing drew — the same grid, the three benefits');
  assert.equal(renderToStaticMarkup(React.createElement(PlanCards, { door: linkDoor, steps: undefined })), cards, 'and a `steps` left undefined is no `steps`');
  for (const added of ['data-plan-step', 'data-plan-category', '<h4', 'md:grid-cols-2']) {
    assert.equal(count(cards, added), 0, `without \`steps\`, no ${added} in the cards`);
    assert.equal(count(section, added), 0, `nor anywhere in /pricing's section`);
  }
  assert.equal(count(cards, PLAN_MARKS.inPlan.mark), 0, 'and no step\'s mark on a card');
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
  assert.equal(buttonCards, cardsHtml('button'), 'HOME-PLANS-03: with a button door and no `steps` — the same four cards, to the byte');
  // the source: the grid moved whole into the exported component, and the section renders it in its place
  const src = code(PLANS_SECTION);
  // HOME-PLANS-03 (2026-11-11): THE SIGNATURE PIN MOVED — it carries the one optional prop. (Until then: 'export function PlanCards({ door }: { door: PlanDoor }) {'.)
  assert.equal(count(src, 'export function PlanCards({ door, steps }: { door: PlanDoor; steps?: readonly PlanCardSteps[] }) {'), 1, 'exported from the plans section\'s own file — the door, and one optional prop: `steps`');
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

// HOME-PLANS-04 (2026-11-12): NO ASSERTION CHANGED. The brief's ruling d: "A MARK STILL SAYS "IN THIS PLAN", NEVER "BUILT". The map draws no status and
// no price, so the plan law's price guard stays as it is." The guard's words name the comparison HOME-PLANS-01 drew; the landing draws the map's marks
// now (src/lib/howTo.ts planMapView), with the same standing, and the guard holds them as it held the comparison.
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


// HOME-PLANS-04 (2026-11-12): T10 RE-WRITTEN IN PLACE — what a screen reader hears is held for the board's marks, in every state. Until then (HOME-PLANS-03):
// the only things hidden from a screen reader were a step's mark and a benefit's dot — '✓' and '·', each a <span aria-hidden="true" class="…"> — and the
// section's header was held to say what had left with the comparison: 'HOME-PLANS-03 (Alex, 2026-11-11 18:17 Manila: ' and 'All of it left the public page
// with this brief', which the section's header now says of HOME-PLANS-03 itself.
// HOME-PLANS-03 (2026-11-11): T10 RE-WRITTEN IN PLACE — the comparison's box left the section with its table, and with it everything this test held
// about it. Until then (HOME-PLANS-01, the look's fix): the box's class string as typed — 'relative mt-8 overflow-x-auto rounded-lg border
// border-border bg-white' — positioned, and the one thing in the section that scrolled sideways; '<div className={HOW.box} data-plan-comparison>'
// once; and, at rest and with everything open, every sr-only span the section drew — each plan head's full name and every mark's label — inside
// that box, none before it and none after; with the reason said where the class was typed.
test('T10 (HOME-PLANS-04) nothing in the section scrolls sideways and nothing in it is drawn for a screen reader alone: no box, no overflow and no sr-only text in the source or in any state\'s render; every decorative mark hidden from a screen reader and every tool\'s mark carrying its label; the plans table\'s own box untouched; the section\'s header says what left', () => {
  const section = code(SECTION);
  // the source: no box, nothing that scrolls sideways, nothing positioned, no floor on a width, no text for a screen reader alone
  assert.equal(count(section, 'data-plan-comparison'), 0, 'the comparison\'s box is gone');
  for (const cls of ['overflow-x-auto', 'overflow-x-scroll', 'overflow-auto', 'sr-only', 'relative', 'absolute', 'min-w-[']) assert.equal(count(section, cls), 0, `the section types no ${cls}`);
  for (const choice of HOW_TO_CHOICES) {
    const html = render(choice);
    const w = words(choice);
    for (const drawn of ['data-plan-comparison', 'overflow-x-', 'overflow-auto', 'sr-only', 'min-w-[', '<table']) assert.equal(count(html, drawn), 0, `${w}: the section draws no ${drawn}`);
    // hidden from a screen reader: the decorative marks alone — Personal's tick (the line over the map says everyone gets Personal; the pill's
    // own words said it too until Alex's note on the built page, 2026-11-12) and each switch's mark (its pressed state says it), each benefit's check
    const hidden = [...html.matchAll(/<(?:svg|span) class="([^"]*)"[^>]*aria-hidden="true"/g)].map((m) => m[1]);
    const switchMark = (on: boolean) => (on ? 'ts-fs-tick' : 'ts-fs-ring');
    assert.deepEqual(hidden, ['ts-fs-tick', switchMark(choice.business), switchMark(choice.trade), ...PLANS.flatMap((p) => p.benefits.map(() => 'ts-fs-check'))], `${w}: hidden from a screen reader — the decorative marks, and nothing else`);
    // every tool's mark carries its label: a screen reader hears what a visitor sees
    const marks = [...html.matchAll(/<(?:svg|span) class="(ts-fs-tick|ts-fs-ring)"[^>]*role="img" aria-label="([^"]*)"/g)].map((m) => `${m[1]} · ${m[2]}`);
    assert.equal(marks.length, 25, `${w}: a mark on each of the sheet's tools`);
    assert.ok(marks.every((m) => m === `ts-fs-tick · ${PLAN_MARKS.inPlan.label}` || m === `ts-fs-ring · ${PLAN_MARKS.notInPlan.label}`), `${w}: a tick says "${PLAN_MARKS.inPlan.label}", a ring "${PLAN_MARKS.notInPlan.label}"`);
    assert.equal(count(html, `role="group" aria-label="${asHtml(WHAT_YOU_RUN_LABEL)}"`), 1, `${w}: the switches' group, named in the leaf's words`);
  }
  // the plans table's own box is untouched — /pricing draws what it drew
  assert.ok(code(PLANS_SECTION).includes('<div className="mt-3 overflow-x-auto rounded-lg border border-border bg-white" data-plan-table>'), 'the plans table\'s box is as it was');
  // what left, said in the section's header
  const why = comments(SECTION);
  assert.match(why, /HOME-PLANS-04 \(Alex's brief, 2026-11-12 14:07 Manila: /, 'the brief, dated');
  assert.match(why, /UNTIL THIS BRIEF \(HOME-PLANS-03, Alex, 2026-11-11 18:17 Manila\)/, 'what stood until then');
  assert.match(why, /UNTIL THEN \(HOME-PLANS-01, 2026-11-11 00:09: "Four plans\. One comparison\."/, 'and before that');
  assert.match(why, /a\s+\*?\s*table in a rounded white box \(data-plan-comparison\) that scrolled sideways inside itself/, 'the box, named');
  assert.match(why, /All of it left the public page with HOME-PLANS-03/, 'and when it left');
});

// ── T11 · WHAT A CARD LISTS, IN THE LEAF (HOME-PLANS-03) ─────────────────────

test('T11 (HOME-PLANS-03) what a card lists, in the leaf — planCardSteps: Personal lists Personal and Travel, Personal + Business lists Business, Personal + Trading lists Trade, the bundle lists none; the same derived here another way, from each plan\'s modules; every heading and title the leaf\'s, Travel in its without-Business words on Personal\'s card; the four cards together list every category once; no tool, no note and no status in what it returns; a fifth plan that holds what Personal holds inherits nothing new; the sections\' order is the cards\' order; a plan with no module is refused by name', () => {
  const steps = planCardSteps();
  // THE FOUR DERIVATIONS — the brief's own, held here; nothing in the leaf types them
  assert.deepEqual(steps.map((s) => [s.plan, s.categories.map((c) => c.heading)]), [
    ['personal', ['PERSONAL — 8 steps', 'TRAVEL — 4 steps']],
    ['business', ['BUSINESS — 9 steps']],
    ['trading', ['TRADE — 5 steps']],
    ['everything', []],
  ], 'Personal → Personal and Travel · Personal + Business → Business · Personal + Trading → Trade · the bundle → none');
  assert.deepEqual(steps.map((s) => s.categories.map((c) => c.steps.length)), [[8, 4], [9], [5], []], '8 and 4 · 9 · 5 · none');
  assert.deepEqual(steps.map((s) => s.plan), PLANS.map((p) => p.id), 'one entry per plan, in PLANS\' order');
  assert.deepEqual(planCardSteps(PLANS, HOW_TO_SECTIONS), steps, 'its defaults are the live plans and the live steps');
  // THE SAME, DERIVED HERE ANOTHER WAY: what a plan shows, less what any plan holding fewer of its modules shows
  const shownBy = (plan: Pick<Plan, 'modules'>) => HOW_TO_SECTIONS.filter((s) => sectionShown(s.id, choiceOf(plan))).map((s) => s.id);
  const holdsFewer = (a: Pick<Plan, 'modules'>, b: Pick<Plan, 'modules'>) => new Set(a.modules).size < new Set(b.modules).size && a.modules.every((m) => b.modules.includes(m));
  for (const [i, plan] of PLANS.entries()) {
    const inherited = new Set(PLANS.filter((other) => holdsFewer(other, plan)).flatMap((other) => shownBy(other)));
    assert.deepEqual(steps[i].categories.map((c) => c.id), shownBy(plan).filter((id) => !inherited.has(id)), `${plan.id}: what it shows, less what it inherits`);
  }
  assert.deepEqual(PLANS.map((plan) => PLANS.filter((other) => holdsFewer(other, plan)).map((other) => other.id)), [[], ['personal'], ['personal'], ['personal', 'business', 'trading']], 'what each plan stands on — as its own relationship line says');
  // every heading and every title is the leaf's: the section's name and count through categoryHeading, each step's title read for what the plan runs
  const readFor = (words: string | { withBusiness: string; withoutBusiness: string }, plan: Pick<Plan, 'modules'>) => (typeof words === 'string' ? words : plan.modules.includes('business') ? words.withBusiness : words.withoutBusiness);
  steps.forEach((card, i) => {
    for (const category of card.categories) {
      const section = HOW_TO_SECTIONS.find((s) => s.id === category.id);
      assert.ok(section, `${card.plan}: ${category.id} is a section of the leaf`);
      assert.equal(category.heading, categoryHeading(section.name, section.steps.length), `${card.plan} · ${category.id}: its heading`);
      assert.deepEqual(category.steps, section.steps.map((step) => readFor(step.title, PLANS[i])), `${card.plan} · ${category.id}: every title, in order, read for what the plan runs`);
      assert.deepEqual(Object.keys(category).sort(), ['heading', 'id', 'steps'], 'a category: its id, its heading, its steps\' titles — and nothing else');
      assert.ok(category.steps.every((title) => typeof title === 'string' && title.length > 0), 'a step is its title');
    }
    assert.deepEqual(Object.keys(card).sort(), ['categories', 'plan'], 'a card: its plan and its categories — and nothing else');
  });
  // Travel on Personal's card reads without Business: that plan runs none
  const travelOnPersonal = steps[0].categories.find((c) => c.id === 'travel');
  assert.ok(travelOnPersonal, 'Travel stands on Personal\'s card');
  assert.equal(travelOnPersonal.steps[3], 'Book every trip line to Personal.', 'its fourth step, in the without-Business words');
  const travelStepFour = HOW_TO_SECTIONS[2].steps[3].title;
  assert.ok(typeof travelStepFour !== 'string' && travelOnPersonal.steps[3] === travelStepFour.withoutBusiness && travelStepFour.withBusiness !== travelStepFour.withoutBusiness, 'the leaf\'s own second reading — not the comparison\'s');
  assert.equal(planComparison().categories[2].steps[3].title, travelStepFour.withBusiness, 'the comparison, undrawn, keeps the with-Business reading');
  // the four cards together list every category of the leaf, each once — nothing is left off the page and nothing stands twice
  assert.deepEqual(steps.flatMap((s) => s.categories.map((c) => c.id)).sort(), [...HOW_TO_SECTION_ORDER].sort(), 'each category on exactly one card');
  assert.equal(steps.reduce((n, s) => n + s.categories.reduce((k, c) => k + c.steps.length, 0), 0), 26, 'all 26 steps');
  // NO TOOL, NO NOTE, NO STATUS in what it returns
  const serialised = JSON.stringify(steps);
  for (const section of HOW_TO_SECTIONS) for (const step of section.steps) for (const words of [step.note, step.buildNote]) if (words !== undefined) assert.ok(!serialised.includes(words), `no note: "${words.slice(0, 30)}…"`);
  for (const line of CAPABILITY_GROUPS.flatMap((g) => g.rows.map((r) => r.label))) assert.ok(!serialised.includes(line), `no tool's line: "${line.slice(0, 30)}…"`);
  for (const word of ['LIVE', 'PENDING', 'PARTIAL', 'NOT BUILT', 'NOT_BUILT', 'NEEDS BOOKS', 'on sale', 'live today', STEP_LIVE.words, STEP_PENDING.words, ...Object.values(TOOL_MARKS).map((m) => m.words)]) assert.ok(!serialised.includes(word), `what a card lists says "${word}" nowhere`);
  assert.doesNotMatch(serialised, /\bbuilt\b|\bpending\b|\bpartial\b|coming soon|"tools"|"note"|"status"|"n":/i, 'no softer word for a status, and no field for a tool, a note, a status or a step\'s number');
  // the source: planCardSteps reads the plans and the sections, and nothing that says what is built
  const leaf = code(LEAF);
  const fnAt = leaf.indexOf('export function planCardSteps(');
  const fnEnd = leaf.indexOf('export function howToLaw(');
  assert.ok(fnAt > -1 && fnEnd > fnAt, 'planCardSteps, then the law');
  const fn = leaf.slice(fnAt, fnEnd);
  assert.doesNotMatch(fn, /statusOf|TOOL_MARKS|STEP_LIVE|STEP_PENDING|NEEDS_BOOKS|booksNotOnSale|buildNote|registry|toolLine|\.tools\b|\.note\b/i, 'it reads no status, no Books gate, no tool and no note');
  assert.match(fn, /^export function planCardSteps\(plans: readonly Pick<Plan, 'id' \| 'modules'>\[\] = PLANS, sections: readonly HowToSection\[\] = HOW_TO_SECTIONS\): readonly PlanCardSteps\[\] \{/, 'its two inputs default to the live plans and the live steps');
  for (const read of ['choiceOf(plan)', 'sectionShown(section.id, choice)', 'categoryHeading(section.name, section.steps.length)', 'say(step.title, choice)']) assert.ok(fn.includes(read), `it derives through ${read}`);
  // A FIFTH PLAN THAT HOLDS WHAT PERSONAL HOLDS INHERITS NOTHING NEW: it lists what Personal lists, and the four list what they listed
  const fifth = [...PLANS, { ...PLANS[0], id: 'enterprise' } as unknown as Plan];
  const five = planCardSteps(fifth);
  assert.deepEqual(five.slice(0, PLANS.length), steps, 'the four, unchanged by a fifth');
  assert.deepEqual(five[4].categories, steps[0].categories, 'the fifth holds no more than Personal, so it inherits nothing: it lists what Personal lists');
  assert.equal(five[4].plan, 'enterprise');
  // … and what a card inherits follows the plans it is handed: with no Personal plan in the list, Personal + Business inherits nothing and lists all it shows
  const withoutPersonal = planCardSteps(PLANS.filter((p) => p.id !== 'personal'));
  assert.deepEqual(withoutPersonal.map((s) => [s.plan, s.categories.map((c) => c.id)]), [['business', ['personal', 'business', 'travel']], ['trading', ['personal', 'travel', 'trade']], ['everything', []]], 'no smaller plan, nothing inherited — and the bundle still stands on the other two');
  assert.equal(withoutPersonal[0].categories[2].steps[3], travelStepFour.withBusiness, 'Travel on a card that runs a business reads with Business');
  // a plan alone inherits nothing, whatever it holds
  assert.deepEqual(planCardSteps([PLANS[3]]).map((s) => s.categories.map((c) => c.id)), [[...HOW_TO_SECTION_ORDER]], 'the bundle alone lists all four');
  // THE SECTIONS' ORDER IS THE CARDS' ORDER: swap two sections and the card's categories swap
  const travelFirst: HowToSection[] = [HOW_TO_SECTIONS[2], HOW_TO_SECTIONS[0], HOW_TO_SECTIONS[1], HOW_TO_SECTIONS[3]];
  const swapped = planCardSteps(PLANS, travelFirst);
  assert.deepEqual(swapped[0].categories.map((c) => c.id), ['travel', 'personal'], 'Travel first in the sections, Travel first on Personal\'s card');
  assert.deepEqual(swapped[0].categories.map((c) => c.heading), ['TRAVEL — 4 steps', 'PERSONAL — 8 steps']);
  assert.deepEqual(swapped.slice(1), steps.slice(1), 'the cards that list one category, or none, read the same');
  // … and the sections handed in are the sections listed: with no Travel section, no card lists Travel
  assert.deepEqual(planCardSteps(PLANS, HOW_TO_SECTIONS.filter((s) => s.id !== 'travel')).map((s) => s.categories.map((c) => c.id)), [['personal'], ['business'], ['trade'], []]);
  // THE REFUSAL: a plan with no module, by name — before any card is derived
  const noModule = [...PLANS, { ...PLANS[0], id: 'empty', modules: [] } as unknown as Plan];
  assert.throws(() => planCardSteps(noModule), (e: unknown) => e instanceof HowToLawError && /howTo: the plan "empty" holds no module/.test(e.message), 'a plan with no module: thrown, by name');
  assert.throws(() => planCardSteps([{ id: 'personal', modules: [] }]), (e: unknown) => e instanceof HowToLawError && /the plan "personal" holds no module/.test(e.message));
  assert.deepEqual(planCardSteps([]), [], 'no plan, no card');
});

// ── T12 · THE CARDS, WITH THEIR STEPS (HOME-PLANS-03) ────────────────────────

test('T12 (HOME-PLANS-03) the cards with `steps` — what planCardSteps returns: the same four cards but for two things — where a plan adds categories they stand where its benefits stood, and the grid is also two across from md; a plan that lists none draws its three benefits; a plan `steps` does not name is a throw, by name; the cards type no step, no heading and no mark of their own; a category\'s heading wears the card\'s own top label', () => {
  const linkDoor = { kind: 'link', href: '/' } as const;
  // the cards without `steps` — /pricing's (T7 holds them to the byte) — and with what the leaf lists
  const cards = renderToStaticMarkup(React.createElement(PlanCards, { door: linkDoor }));
  const steps = planCardSteps();
  const stepCards = renderToStaticMarkup(React.createElement(PlanCards, { door: linkDoor, steps }));
  assert.equal(stepCards, cardsHtml({ href: '/' }, steps), 'with `steps`: the whole markup, built from the leaves');
  assert.ok(stepCards.startsWith(GRID_TAG_WITH_STEPS) && !stepCards.startsWith(GRID_TAG), 'its grid: the cards\' own, and two across from md');
  assert.equal(GRID_TAG_WITH_STEPS.replace(' md:grid-cols-2', ''), GRID_TAG, 'md:grid-cols-2 is all the grid gains');
  // put each card's benefits back where its categories stand, and the grid back, and the render is /pricing's own
  const benefitsOf = new Map(PLANS.map((p) => [p.id as string, `<ul class="space-y-1.5 text-sm text-text-secondary">${p.benefits.map(benefitHtml).join('')}</ul>`]));
  let at = '';
  const undone = stepCards.replace(GRID_TAG_WITH_STEPS, GRID_TAG).replace(/ data-plan="([^"]+)"|(?:<div data-plan-category="[^"]+"><h4 class="[^"]*">[^<]*<\/h4><ul class="mt-2 space-y-1\.5 text-sm text-text-secondary">(?:<li class="flex gap-2" data-plan-step="true">[\s\S]*?<\/li>)*<\/ul><\/div>)+/g, (whole: string, planId: string | undefined) => {
    if (planId !== undefined) { at = planId; return whole; }
    const benefits = benefitsOf.get(at);
    if (benefits === undefined) assert.fail(`a category stands on the card of "${at}", which is no plan`);
    return benefits;
  });
  assert.equal(undone, cards, 'the list and the grid aside, the cards with `steps` are the cards without: the top label, the name, the three lines, the price slot and the door are untouched');
  assert.notEqual(stepCards, cards, 'and the list does change them');
  // the leaf's entry for a plan decides its card: categories where it lists some, the three benefits where it lists none
  for (const listed of steps) {
    const plan = PLANS.find((p) => p.id === listed.plan);
    assert.ok(plan, `${listed.plan} is a plan`);
    const from = stepCards.indexOf(` data-plan="${plan.id}"`);
    const to = stepCards.indexOf(' data-plan="', from + 1);
    const card = stepCards.slice(from, to === -1 ? undefined : to);
    assert.deepEqual([...card.matchAll(/data-plan-category="([^"]+)"/g)].map((m) => m[1]), listed.categories.map((c) => c.id), `${plan.id}: its categories`);
    assert.deepEqual([...card.matchAll(STEP_LI)].map((m) => m[2]), listed.categories.flatMap((c) => c.steps).map(asHtml), `${plan.id}: its steps`);
    assert.deepEqual([...card.matchAll(BENEFIT_LI)].map((m) => m[1]), listed.categories.length > 0 ? [] : plan.benefits.map(asHtml), `${plan.id}: its benefits, only where it lists no category`);
  }
  // steps that list nothing for any plan: every card draws its three benefits — the grid alone says `steps` was handed in
  const noneListed = steps.map((s) => ({ ...s, categories: [] }));
  assert.equal(renderToStaticMarkup(React.createElement(PlanCards, { door: linkDoor, steps: noneListed })), cards.replace(GRID_TAG, GRID_TAG_WITH_STEPS), 'no category for any plan: the benefits, in the two-across grid');
  // A PLAN `steps` DOES NOT NAME IS A THROW, BY NAME — never a card that quietly draws its benefits instead
  assert.throws(() => PlanCards({ door: linkDoor, steps: steps.filter((s) => s.plan !== 'trading') }), (e: unknown) => e instanceof Error && /PlanCards: `steps` names no entry for the plan "trading"/.test(e.message), 'a plan with no entry: thrown, by name');
  assert.throws(() => PlanCards({ door: linkDoor, steps: [] }), (e: unknown) => e instanceof Error && /names no entry for the plan "personal"/.test(e.message), 'an empty `steps` is not no `steps`');
  // THE SOURCE: one mount in the plans section's own file, with no `steps`; the two grids, each typed once; the mark and the type are the how-to leaf's
  const src = code(PLANS_SECTION);
  assert.equal(count(src, '<PlanCards '), 1, 'the plans section mounts the cards once');
  assert.equal(count(src, '<PlanCards door={door} />'), 1, 'and hands them no `steps` — /pricing draws what it drew');
  assert.equal(count(src, 'if (steps === undefined) return <div className="mt-6 grid gap-4 lg:grid-cols-4">{cards}</div>;'), 1, '/pricing\'s grid, for a caller that hands no `steps`');
  assert.equal(count(src, 'return <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">{cards}</div>;'), 1, 'and the two-across grid, with `steps` alone');
  assert.equal(count(src, 'md:grid-cols-2'), 1, 'md:grid-cols-2 is typed once');
  assert.match(src, /^import \{ PLAN_MARKS, type PlanCardCategory, type PlanCardSteps \} from '@\/lib\/howTo';$/m, 'the mark and the type of `steps` are the how-to leaf\'s');
  assert.equal(count(src, '<span aria-hidden="true" className="text-brand-purple">{PLAN_MARKS.inPlan.mark}</span>'), 1, 'a step\'s mark: the leaf\'s, hidden from a screen reader, brand purple');
  assert.equal(count(src, '<li key={i} className="flex gap-2" data-plan-step>'), 1, 'a step, in the shape of a benefit\'s row');
  assert.equal(count(src, '<h4 className={CATEGORY_LABEL}>{category.heading}</h4>'), 1, 'a category\'s heading');
  // a category's heading wears the card's own top label — the house label look
  const roleClass = /<p className="([^"]*)" data-plan-role>/.exec(src);
  const categoryLabel = /^const CATEGORY_LABEL = '([^']*)';$/m.exec(src);
  assert.ok(roleClass && categoryLabel, 'the top label\'s classes, and the heading\'s');
  assert.equal(categoryLabel[1], roleClass[1], 'a category\'s heading wears the card\'s own top label, letter for letter');
  assert.equal(categoryLabel[1], LABEL_CLASSES);
  for (const cls of ['font-mono', 'uppercase', 'text-text-faint']) assert.ok(categoryLabel[1].split(' ').includes(cls), `the house label look: ${cls}`);
  // the cards type none of the steps' words, and no mark of their own
  for (const words of steps.flatMap((s) => s.categories.flatMap((c) => [c.heading, ...c.steps]))) assert.ok(!src.includes(words), `the plans section does not type "${words.slice(0, 30)}"`);
  assert.ok(!src.includes(PLAN_MARKS.inPlan.mark), 'nor the mark — it is the leaf\'s');
  // the reason a plan with no entry throws, said where the cards are documented
  assert.match(comments(PLANS_SECTION), /A plan `steps` does not name is a THROW, by name — never a card that quietly shows its benefits instead\./);
});
