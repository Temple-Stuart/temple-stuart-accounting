'use client';

/**
 * HOME-PLANS-04 (Alex's brief, 2026-11-12 14:07 Manila: "Plaids sections with Title, Sub title, quick explainer paragraph, and
 * then list of features. ours is a little more complex looking and harer to see separation … instead of this , we might have like
 * some simple like lists, or something or an image... that like lists the Tabs , separated by Tier? … simple and easy to
 * understand"; his approval of the board on the design canvas, 2026-11-12 14:30 Manila: "YES, OMG, GIVE ME THE PROMPT TO MAKE THIS
 * REAL!") — THE FINANCIAL SOFTWARE SECTION, AS DRAWN — since HOME-TRIM-02 (2026-11-15), its WHOLE view, on its own page (view="whole"; the
 * home page draws its short view, below). The spec is a file, not this note: design-refs/home-plans-04/Section-Reference.html
 * ("Every value in its stylesheet is the design, and its markup is the page at rest"), with its README beside it. This section is
 * that file's markup, element for element, but for Alex's notes on the built page (below) — and, since HOME-PAGES-01
 * (2026-11-14), but for each plan's door where the caller hands a link: an <a> in the button's own class where the reference
 * draws a <button> (the section's own page; below). Its classes are the reference's own
 * with the house prefix (.fs-map → .ts-fs-map), and their rules are the reference's own, ported to src/app/globals.css
 * (src/lib/__tests__/homePlans04.test.ts holds both equal, but for the differences it names). No colour is typed in this file.
 * Top to bottom, the whole view:
 *   1. the pillar's name — PLAN_PILLAR.heading (src/lib/homeActWords.ts) — then ONE line, PLANS_SUBHEAD (src/lib/offer/plans.ts),
 *      where the pillar's three paragraphs stood;
 *   2. THE MAP: the question (PLANS_HEADLINE), the Personal pill, the two switches, then the 25 tools under the six families of
 *      PROBLEM_SHEET, each lit or not by the picked plan — the Personal pill's words, the switches and the tools from planMapView
 *      (src/lib/howTo.ts); the question, the group's label and the marks' labels from their leaves;
 *   3. three plan cards and the all-three band, drawn here; the picked plan is ringed, tagged and gold;
 *   4. the one link to /pricing — its words and path as they were, in the reference's look.
 * "What We Do" stays where it stands, in Landing.tsx, in the reference's box (.ts-fs-heading), and wears the act headings' type
 * since Alex's note on the built page (the eyebrow, .ts-fs-eyebrow, until then). The section keeps
 * id="modules", the anchor the checkout's cancel link, the /modules pages and — since HERO-CREST-01, 2026-11-11 — the top
 * bar's first link land on (the top bar's first link until HOME-MENU-01, 2026-11-16: its first name opens the menu now, and lands nowhere). (HOME-PAGES-01, 2026-11-14: "the footer's first link" stood in that list until then; it opens
 * /financial-software now, this section's own page.)
 *
 * THE RULINGS, AS BUILT HERE (Alex's brief, 2026-11-12 14:07 Manila):
 *   a. "STATE. The section holds two booleans in React state: what you run. No storage, no URL, no cookie; a reload starts at
 *      Personal. This ends HOME-PLANS-03's "NO STATE" for these two switches and nothing else." — the default export, below: two
 *      useState booleans, both false at first; HowToView draws any of the four states from props and holds none. (HOME-PLANS-05,
 *      2026-11-16: the short view's two toggles are two more booleans since, each closed at first, kept by the short view's holder,
 *      HowToShortHolder; its ruling c is quoted there.)
 *   b. "THE CARDS ARE THE SECTION'S OWN. /pricing keeps PlanCards, its table and every class it has, untouched." — the three cards
 *      and the band are drawn here; nothing is imported from src/components/offer/PlansSection.tsx, which is not edited.
 *   d. "A MARK STILL SAYS "IN THIS PLAN", NEVER "BUILT". The map draws no status and no price, so the plan law's price guard stays
 *      as it is." — a tool's mark carries PLAN_MARKS' label; nothing here reads the registry; each plan's foot says its price
 *      slot's launch words.
 *   f. "WORDS. Nothing is typed in a component. The switches say the part each plan's name adds: "+ Business", "+ Trading". Three
 *      words are new and need a leaf: "Your plan", "<n> of <total> tools", "All <total> tools". Both numbers are computed." — every
 *      word is a leaf's: the three new ones are src/lib/howTo.ts's (YOUR_PLAN; toolCountWords with ofToolsWords; allToolsWords),
 *      the switches' and the Personal pill's are the plans' own names, split (nameParts). One thing here is typed, as it has
 *      been since HOME-PLANS-01: the section's aria-label, which a screen reader announces and no one sees. It has no leaf:
 *      giving it one would be a fourth new word, past the brief's three, so it stays as it was.
 *   (c, e and g are built where they live: c in src/lib/homeActWords.ts and src/lib/howTo.ts, e in src/lib/howTo.ts and the
 *   build's law suite, g in src/app/globals.css.)
 * 'use client' STAYS, FOR THE STATE AND THE DOOR: the two switches are React state, and each plan's button calls the door Landing
 * hands in (onRequireAuth — the sign-up modal). (HOME-TRIM-02, 2026-11-15: on the home page, one plan is drawn — the one the choices
 * pick — and its button calls that door.) (HOME-PLANS-05, 2026-11-16: the short view's two toggles are React state too; while the
 * second is open, the four plans stand in that one plan's place, and each one's button calls the same door.)
 *
 * HOME-PAGES-01 (Alex's brief, 2026-11-14, ruling d: "THE JOIN BUTTON on /financial-software is /pricing's door: a link to the
 * front door (PlansSection.tsx: "The door is the caller's: /pricing hands a link, the home page a button that opens sign-up.").
 * No second sign-up modal and no new auth code.") — THE DOOR MAY BE A LINK. The section has a page of its own now
 * (src/app/financial-software/page.tsx), a server page, which cannot hand a function in. So the door is one of two things
 * (JoinDoor, below): the function Landing hands in, drawn as the button it has always been; or a link, { kind: 'link', href } —
 * PlanDoor's link arm (src/components/offer/PlansSection.tsx), retyped here because this file reads nothing of the plans
 * section (ruling b, above) — drawn as a plain <a> in the button's own class, as the compare link under the cards is a plain
 * <a>. The page hands /pricing's own door, { kind: 'link', href: '/' }. The link travels under the name onRequireAuth: the
 * smallest change, and Landing.tsx's mount stood as typed ("stands as typed" until HOME-TRIM-02, 2026-11-15, which adds
 * view="short" to it — ruling a, at the default export). Each arm is drawn as what it is; neither stands in for the other.
 *
 * HOME-TRIM-02 (Alex's brief, 2026-11-14 19:11 Manila, with his four beta users' notes on the home page; the boards approved on the
 * design canvas at 20:01 and, corrected, at 20:41; built 2026-11-15) — ONE SECTION, TWO VIEWS. On its own page the section draws its
 * WHOLE view (view="whole", src/app/financial-software/page.tsx): HowToView, everything this header describes, its render main's
 * byte for byte. On the home page it draws its SHORT view (view="short", Landing.tsx): the section's name and its line, the panel
 * with the question, the three choices and two toggles (HOME-PLANS-05, 2026-11-16, below: "two links" until then), then the one plan
 * the choices pick — the section of design-refs/home-trim-02/Section-Reference.html, element for element, but for those toggles and
 * what they open, which are design-refs/home-plans-05's (HowToShortView, below: rulings b, c and e are quoted there,
 * ruling a at the default export, ruling d at the choices). The parts both views draw are written once. Ruling l, which re-said this header and the
 * other notes that went false: "NOTES THAT GO FALSE ARE RE-SAID IN PLACE, dated, as HOME-TRIM-01 re-said its own: every sentence
 * that says the home page draws the map, the three cards, the band at rest or the link at the foot. No line moves in a file whose
 * lines a test or a law cites." — "AS DRAWN" and "Top to bottom" above name the whole view now, and the door's note above is dated.
 *
 * HOME-PLANS-05 (Alex's brief, 2026-11-16 00:04 Manila: "I am wondering if we can make them toggles, to open up a drop down , on the
 * home page, rather than routing to a new page?" · "also the buttons look rather mediocore, and dont really follow the look of the rest
 * of the page..."; his approval of the boards on the design canvas, 00:19 Manila: "AMAZING YES!! EXACTLY!!!! Those TOGGLES ARE
 * PERFECT!!"; built 2026-11-16) — THE SHORT VIEW'S TWO LINKS ARE TWO TOGGLES. Where the links stood, in the panel's head, two buttons
 * open parts of the whole view in place: the first, the map's grid inside the panel; the second, the three cards and the band in place
 * of the one plan. Each part is drawn by the component the whole view draws it with (ToolGrid, AllPlans) and is absent from the markup
 * while its toggle is closed; nothing in the section routes away from the home page now. The spec is a file:
 * design-refs/home-plans-05/Section-Reference.html, whose markup is the page at rest; its third stylesheet is ported as the toggles'
 * rules (src/app/globals.css, the port's section 8). Rulings a and b are quoted at the toggles and the parts, c at the short view's
 * holder (HowToShortHolder), f in src/lib/howTo.ts. Ruling h, which re-said the notes in this file that went false — the short view's two links, the parts drawn on
 * /financial-software alone, the section's state as two booleans: "SENTENCES THE TOGGLES MAKE FALSE ARE RE-SAID IN PLACE, dated: every
 * sentence that says the short view draws two links, or that this section opens /financial-software or /pricing from the home page.
 * Files whose lines a test or a law cites keep every line where it is: Landing.tsx stays 815 lines long."
 *
 * AFTER THE BUILD (Alex's notes on the built page, 2026-11-12: "then 13 of 25 tools is tacky, we dont need that to tell us, we
 * can just count..." · "while youre at it, remove that word alwasy from personal... looks tacky too"): the map draws no count —
 * the reference's <p class="fs-map__count"> and its two rules are left out, and with it the section's one live region, so pressing
 * a switch announces its own pressed state and no more — and the Personal pill says "Personal", the first part of the plans'
 * names (planMapView's base), as the switches say theirs; PERSONAL_ALWAYS ("Personal · always") stays in its leaf, undrawn. His
 * first note, "What We Do" in About Us's type, is Landing.tsx's. Each card's count and the band's stay.
 *
 * UNTIL THIS BRIEF (HOME-PLANS-03, Alex, 2026-11-11 18:17 Manila): the pillar's heading and his three paragraphs, the four plan
 * cards — PlanCards, /pricing's own component, handed the leaf's planCardSteps, so each card listed the steps its plan adds — and
 * the one link; NO STATE: the default export handed its door to the pure half and nothing that opens or closes. Its class grammar
 * was four keys — inner, h2, pillar, compare — in Tailwind utilities, and the section wore 'w-full border-b border-border bg-bg-terminal'.
 * Both the paragraphs and the step lists stay in their leaves, undrawn (src/lib/homeActWords.ts PLAN_PILLAR.paragraphs,
 * src/lib/howTo.ts planCardSteps), with the standing HOME-PLANS-03 gave the comparison. PlanCards' `steps` branch has no caller
 * now; it is left as it is (not this brief's to change).
 * UNTIL THEN (HOME-PLANS-01, 2026-11-11 00:09: "Four plans. One comparison."): the pillar, the four cards and one comparison — a
 * table in a rounded white box (data-plan-comparison) that scrolled sideways inside itself, its categories and steps opening and
 * closing in React state. All of it left the public page with HOME-PLANS-03. Before that, the how-to drew the switches, the plan
 * line, the steps in rows and a legend (HOME-BRIEF-03, HOME-BRIEF-04), each still a word of src/lib/howTo.ts.
 */

import { useState } from 'react';
import { COMPARE_PLANS_PATH, COMPARE_PLANS_TOGGLE_WORDS, COMPARE_PLANS_WORDS, PLAN_MARKS, WHAT_YOU_RUN_LABEL, YOUR_PLAN, planMapView, type MapPlan, type NamePart, type PlanMapView } from '@/lib/howTo';
import { PLAN_PILLAR } from '@/lib/homeActWords';
import { PLANS_HEADLINE, PLANS_SUBHEAD } from '@/lib/offer/plans';

/**
 * The reference's tick. Hidden from a screen reader where something else says it — a switch's own pressed state, and for the
 * Personal pill the line over the map (PLANS_SUBHEAD: everyone gets Personal; the pill's own words said it too, "Personal ·
 * always", until Alex's note on the built page) — and carrying its label where it is a tool's mark.
 */
function Tick({ label }: { label?: string }) {
  return label === undefined
    ? <svg className="ts-fs-tick" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" /></svg>
    : <svg className="ts-fs-tick" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label={label}><path d="M3.5 8.5l3 3 6-7" /></svg>;
}

/** The reference's check, beside each of a plan's three benefits. Decorative: the benefit's words are what it says. */
function Check() {
  return <svg className="ts-fs-check" width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="10" cy="10" r="8.2" /><path d="M6.4 10.3l2.4 2.4 4.8-5.2" /></svg>;
}

/**
 * HOME-PLANS-05 (2026-11-16): the reference's chevron, where each link's arrow stood — inline, and hidden from a screen reader as the
 * switches' tick is, because something else says it: the toggle's own words and its aria-expanded. An open toggle's rule turns it.
 */
function Chevron() {
  return <svg className="ts-fs-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 6l4 4 4-4" /></svg>;
}

/** One part of a plan's name: the first as it stands; each later one after a space, in a span that wears its module's colour. */
function NameWords({ part, first }: { part: NamePart; first: boolean }) {
  return first ? <>{part.words}</> : <>{' '}<span data-module={part.module}>{part.words}</span></>;
}

/** A plan's top line, its name in its coloured parts, and who it is for with what it is — a card's first three parts, the band's lead. */
function PlanHead({ plan }: { plan: MapPlan }) {
  return (
    <>
      <div className="ts-fs-plan__top"><p className="ts-fs-plan__role">{plan.role}</p>{plan.picked ? <span className="ts-fs-plan__tag">{YOUR_PLAN}</span> : null}</div>
      <h3 className="ts-fs-plan__name">{plan.parts.map((part, i) => <NameWords key={part.module} part={part} first={i === 0} />)}</h3>
      <div>
        <p className="ts-fs-plan__audience">{plan.audience}</p>
        <p className="ts-fs-plan__explainer">{plan.explainer}</p>
      </div>
    </>
  );
}

/**
 * The door a plan's button opens (HOME-PAGES-01, 2026-11-14): the function Landing hands in — the sign-up modal — or a link, on
 * the section's own page. The link arm is PlanDoor's (src/components/offer/PlansSection.tsx), retyped: this file imports
 * nothing of the plans section.
 */
export type JoinDoor = (() => void) | { readonly kind: 'link'; readonly href: string };

/**
 * A plan's three benefits, then its foot: how many tools it holds, its price slot's words, and its button — the door: a button
 * that calls it where the door is a function, a link to it where the door is a link (HOME-PAGES-01, 2026-11-14; a button
 * always, until then).
 */
function PlanBody({ plan, onJoin }: { plan: MapPlan; onJoin: JoinDoor }) {
  return (
    <>
      <ul className="ts-fs-plan__points">
        {plan.benefits.map((words) => <li key={words} className="ts-fs-plan__point"><Check />{words}</li>)}
      </ul>
      <div className="ts-fs-plan__foot">
        <p className="ts-fs-plan__meta"><span>{plan.count}</span><span className="ts-fs-plan__price">{plan.price}</span></p>
        {typeof onJoin === 'function'
          ? <button className="ts-fs-plan__cta" type="button" onClick={() => onJoin()}>{plan.cta}</button>
          : <a className="ts-fs-plan__cta" href={onJoin.href}>{plan.cta}</a>}
      </div>
    </>
  );
}

/**
 * HOME-TRIM-02 (Alex's brief, 2026-11-14 19:11 Manila; built 2026-11-15) — WHAT BOTH VIEWS DRAW IS WRITTEN ONCE, in this file: the
 * section's name and its line (here), the question with its three choices (Choices), the band (Band) and the link to /pricing
 * (CompareLink). Until this brief HowToView drew each of them inline; it draws them through these now, and its render is main's,
 * byte for byte (src/lib/__tests__/homeTrim02.test.ts holds it). HOME-PLANS-05 (2026-11-16) adds two, each drawn by the short view
 * while its toggle is open — the map's grid (ToolGrid) and the three cards with the band (AllPlans) — and takes one away from it: the
 * link to /pricing is the whole view's alone since (both views drew it until then, the short view in its panel).
 */
function SectionName() {
  return (
    <>
      <h2 className="ts-fs__title">{PLAN_PILLAR.heading}</h2>
      <p className="ts-fs__lede">{PLANS_SUBHEAD}</p>
    </>
  );
}

/**
 * The question and the three choices — the panel's head in both views. HOME-TRIM-02 (Alex's brief, 2026-11-14 19:11 Manila; built
 * 2026-11-15), ruling d: "THE CHOICES are the section's own:
 * the same state, words, marks and handlers. Nothing is stored and nothing goes in the URL." — the state is the default export's
 * two booleans; the handlers are the ones it hands both views.
 */
function Choices({ view, onBusiness, onTrade }: { view: PlanMapView; onBusiness: () => void; onTrade: () => void }) {
  const press = { business: onBusiness, trading: onTrade } as const;
  return (
    <div className="ts-fs-map__ask">
      <h3 className="ts-fs-map__question">{PLANS_HEADLINE}</h3>
      <div className="ts-fs-switches" role="group" aria-label={WHAT_YOU_RUN_LABEL}>
        <span className="ts-fs-switch ts-fs-switch--always"><Tick />{view.base.words}</span>
        {view.switches.map((s) => (
          <button key={s.module} className="ts-fs-switch" type="button" data-module={s.module} aria-pressed={s.pressed} onClick={() => press[s.module]()}>
            {s.pressed ? <Tick /> : <span className="ts-fs-ring" aria-hidden="true" />}{s.words}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * HOME-PLANS-05 (Alex's brief, 2026-11-16 00:04 Manila; the boards approved on the design canvas at 00:19; built 2026-11-16), ruling b:
 * "EACH PART IS THE WHOLE VIEW'S OWN, WRITTEN ONCE. While open, the first draws the map's grid inside the panel, under its head, lit by
 * the choices; the second draws the three cards and the band in place of the one plan, the picked one ringed, tagged and gold. A closed
 * part is absent from the markup. HowToView draws both parts through the same components, and its render stays main's byte for byte."
 * — ToolGrid, here, is the grid HowToView drew inline until then, and AllPlans, below it, the three cards and the band; the short view
 * draws each only while its toggle is open. THE MAP'S GRID: the sheet's tools under its six families, each lit or not by the picked
 * plan, each mark carrying its label. In the short view it carries the id its toggle names (fs-all-tools); the whole view's grid has
 * none, as main drew it, so React writes no id there and its render is main's.
 */
function ToolGrid({ view, id }: { view: PlanMapView; id?: string }) {
  return (
    <div className="ts-fs-map__grid" id={id}>
      {view.families.map((family) => (
        <div key={family.name}>
          <h4 className="ts-fs-family__name">{family.name}</h4>
          <ul className="ts-fs-family__tools">
            {family.tools.map((t) => (
              <li key={t.name} className="ts-fs-tool" data-module={t.module} data-lit={t.lit}>
                {t.name}{t.lit ? <Tick label={PLAN_MARKS.inPlan.label} /> : <span className="ts-fs-ring" role="img" aria-label={PLAN_MARKS.notInPlan.label} />}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/**
 * THE FOUR PLANS (HOME-PLANS-05, 2026-11-16, ruling b, above): the three cards in their grid, then the band — under the whole view's
 * panel, and in the short view, while its second toggle is open, in place of the one plan. The picked one wears the ring, the tag and
 * the gold button, as it always has. They stand side by side in a fragment, which adds no element, so the whole view's markup is main's.
 */
function AllPlans({ view, onJoin }: { view: PlanMapView; onJoin: JoinDoor }) {
  return (
    <>
      <div className="ts-fs-plans">
        {view.cards.map((plan) => (
          <div key={plan.id} className="ts-fs-plan" data-plan={plan.id} data-picked={plan.picked}>
            <PlanHead plan={plan} />
            <PlanBody plan={plan} onJoin={onJoin} />
          </div>
        ))}
      </div>
      <Band plan={view.band} onJoin={onJoin} />
    </>
  );
}

export interface HowToViewProps {
  /** What you run: Business on, Trading on. */
  business: boolean;
  trade: boolean;
  /** Each switch's press. */
  onBusiness: () => void;
  onTrade: () => void;
  /** The door every plan's button opens — Landing's onRequireAuth (the sign-up modal), or a link on the section's own page. */
  onJoin: JoinDoor;
}

/** THE PURE HALF: the whole section for one state of the two switches. It holds no state; the default export does. */
export function HowToView({ business, trade, onBusiness, onTrade, onJoin }: HowToViewProps) {
  const view = planMapView({ business, trade });
  return (
    <section id="modules" className="ts-fs" aria-label="Software plans" data-how-to>
      <div className="ts-fs__inner">
        <SectionName />

        <div className="ts-fs-map">
          <div className="ts-fs-map__head">
            <Choices view={view} onBusiness={onBusiness} onTrade={onTrade} />
          </div>
          <ToolGrid view={view} />
        </div>

        <AllPlans view={view} onJoin={onJoin} />

        <CompareLink />
      </div>
    </section>
  );
}

/** The all-three band: under the whole view's three cards (AllPlans, which draws them in both views since HOME-PLANS-05, 2026-11-16 — in the whole view alone until then); and, with both choices on, the short view's one plan (ruling c, below). */
function Band({ plan, onJoin }: { plan: MapPlan; onJoin: JoinDoor }) {
  return (
    <div className="ts-fs-plan ts-fs-plan--all" data-plan={plan.id} data-picked={plan.picked}>
      <div className="ts-fs-plan__lead">
        <PlanHead plan={plan} />
      </div>
      <PlanBody plan={plan} onJoin={onJoin} />
    </div>
  );
}

/**
 * The link to /pricing, its words and path as they were: at the whole view's foot — and, from HOME-TRIM-02 (ruling e, below) until
 * HOME-PLANS-05 (2026-11-16), in the short view's panel too, where its words stand without the arrow on the second toggle now.
 */
function CompareLink() {
  return <a className="ts-fs__compare" href={COMPARE_PLANS_PATH} data-compare-plans>{COMPARE_PLANS_WORDS}</a>;
}

/**
 * HOME-PLANS-05 (Alex's brief, 2026-11-16 00:04 Manila; the boards approved on the design canvas at 00:19; built 2026-11-16), ruling a:
 * "TWO TOGGLES STAND WHERE THE LINKS STOOD. Each is a button of type button, with aria-expanded, and aria-controls naming its part,
 * fs-all-tools or fs-all-plans, which is drawn only while open. Each carries its chevron, inline and aria-hidden, as the section's tick
 * is. Both start closed, and either can be open with the other. Neither is a link." — A TOGGLE: its words, whether its part is open,
 * the id of that part, and its press, which the short view's holder turns (HowToShortHolder, below). A button opens and closes on
 * Enter and Space as on a click, and stays where it is in the page, so focus stays on it.
 */
function Toggle({ words, open, controls, onPress }: { words: string; open: boolean; controls: string; onPress: () => void }) {
  return <button className="ts-fs-toggle" type="button" aria-expanded={open} aria-controls={controls} onClick={() => onPress()}>{words}<Chevron /></button>;
}

/** HOME-PLANS-05 (2026-11-16): the short view's props — HowToView's, as they are, and its two toggles: each open or closed, and each one's press. */
export interface HowToShortViewProps extends HowToViewProps {
  /** The first toggle's part, the map's grid in the panel: open or closed. */
  toolsOpen: boolean;
  /** The second toggle's part, the three cards and the band in the one plan's place: open or closed. */
  plansOpen: boolean;
  /** Each toggle's press. */
  onTools: () => void;
  onPlans: () => void;
}

/**
 * HOME-TRIM-02 — THE SHORT VIEW, the home page's: the section's name and its line, the panel with the question, the three choices and
 * two toggles, then the one plan the choices pick — or, while the second toggle is open, the four plans in its place ("two links,
 * then the one plan" until HOME-PLANS-05, 2026-11-16). The spec is a file: design-refs/home-trim-02/Section-Reference.html, whose markup is
 * the page at rest; this is its section, element for element, behind the house prefix, but for the toggles and what they open
 * (design-refs/home-plans-05/Section-Reference.html), and its second stylesheet is ported after the rest of the port (src/app/globals.css,
 * section 7 — the port's last rules until HOME-PLANS-05's toggles followed them), but for the two rules of the links' row, which went
 * with the links. The rulings built here (Alex's brief, 2026-11-14 19:11 Manila; built 2026-11-15):
 *   b. "WHAT THE SHORT VIEW DRAWS is the reference's section. The map's grid, the three-card grid, the plans not picked and the link
 *      at the foot are absent from its markup, not hidden. The panel keeps its class, .ts-fs-map. The section keeps id="modules"
 *      (the plan law's :9448 reads '<section id="modules"'), aria-label="Software plans" and data-how-to, and adds the reference's
 *      hook, ts-fs--short." — so this view writes its own section tag and its own inner box, and nothing it does not draw;
 *   c. "THE PLAN is the one planMapView picks, in a holder, .ts-fs-yours. It is a card in a row (.ts-fs-plan--row, its first three
 *      parts in .ts-fs-plan__lead, as the band's are), or the band itself when both choices are on. It wears the tag and the gold
 *      button, as the picked plan does today. On the home page its button opens sign-up, as it does today." — the cards are
 *      filtered to the picked one and the band is drawn only when it is the picked one, so exactly one plan is in the holder's markup (HOME-PLANS-05, 2026-11-16: while the second toggle is open the holder is not drawn and the four plans stand in its place — "exactly one plan is in the markup" until then);
 *      PlanHead draws its tag and the port's rule its gold button; PlanBody's button calls Landing's door (the sign-up modal);
 *   e. "THE WORDS. Nothing is typed. "See all ‹total› tools →" is new: one function in src/lib/howTo.ts beside allToolsWords
 *      (:712). Its total is the sheet's count that the cards count against, never typed. Its link is a plain anchor in the compare
 *      link's class (.ts-fs__compare) to FINANCIAL_SOFTWARE_PATH (src/lib/homePages.ts:39). "Compare all four plans →" moves into
 *      the panel in the short view with its path and its data-compare-plans hook; in the whole view it stays at the foot. Neither
 *      link carries state." — the first link's words were planMapView's seeAll (seeAllToolsWords over the cards' own total). Since
 *      HOME-PLANS-05 (2026-11-16) neither link is drawn here: the first toggle says seeAll — the same words and total, without the
 *      arrow — and the second COMPARE_PLANS_TOGGLE_WORDS; each opens its part in place, and the compare link stands at the whole view's
 *      foot alone.
 * Its props are HowToView's and, since HOME-PLANS-05, the two toggles' (HowToShortViewProps, above); it holds no state.
 */
export function HowToShortView({ business, trade, toolsOpen, plansOpen, onBusiness, onTrade, onTools, onPlans, onJoin }: HowToShortViewProps) {
  const view = planMapView({ business, trade });
  return (
    <section id="modules" className="ts-fs ts-fs--short" aria-label="Software plans" data-how-to>
      <div className="ts-fs__inner">
        <SectionName />

        <div className="ts-fs-map">
          <div className="ts-fs-map__head">
            <Choices view={view} onBusiness={onBusiness} onTrade={onTrade} />
            <div className="ts-fs-toggles">
              <Toggle words={view.seeAll} open={toolsOpen} controls="fs-all-tools" onPress={onTools} />
              <Toggle words={COMPARE_PLANS_TOGGLE_WORDS} open={plansOpen} controls="fs-all-plans" onPress={onPlans} />
            </div>
          </div>
          {toolsOpen ? <ToolGrid view={view} id="fs-all-tools" /> : null}
        </div>

        {plansOpen ? (
          <div id="fs-all-plans">
            <AllPlans view={view} onJoin={onJoin} />
          </div>
        ) : (
          <div className="ts-fs-yours">
            {view.cards.filter((plan) => plan.picked).map((plan) => (
              <div key={plan.id} className="ts-fs-plan ts-fs-plan--row" data-plan={plan.id} data-picked={plan.picked}>
                <div className="ts-fs-plan__lead">
                  <PlanHead plan={plan} />
                </div>
                <PlanBody plan={plan} onJoin={onJoin} />
              </div>
            ))}
            {view.band.picked ? <Band plan={view.band} onJoin={onJoin} /> : null}
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * HOME-PLANS-05 (Alex's brief, 2026-11-16 00:04 Manila; the boards approved on the design canvas at 00:19; built 2026-11-16), ruling c:
 * "OPEN OR CLOSED IS REACT STATE, one boolean per toggle, false at first: nothing stored, nothing in the URL, so a reload starts closed.
 * Its shape is the audit's to name: the smallest that keeps both views pure and HowToView's props as they are, by the pins it moves." —
 * THE SHAPE: this holder, the short view's, with the two toggles' booleans and their presses; it draws the pure short view with them
 * and with all the default export hands it. Both views stay pure and HowToView's props stand as they are. It moves five pins — the
 * count of useState in three tests, the lookup's text and the element it returns in one — as the other shape, two more booleans in
 * the default export, would have: that one also moved the pin on /financial-software's note in the middleware (its section's only
 * state, two booleans, would have been four there, two of them read by nothing), and ruling j keeps /financial-software as it was.
 */
export function HowToShortHolder(props: HowToViewProps) {
  const [toolsOpen, setToolsOpen] = useState(false);
  const [plansOpen, setPlansOpen] = useState(false);
  return <HowToShortView {...props} toolsOpen={toolsOpen} plansOpen={plansOpen} onTools={() => setToolsOpen((open) => !open)} onPlans={() => setPlansOpen((open) => !open)} />;
}

/**
 * Each view by its name, in an object with no prototype: a name that is neither — a missing one, or one of Object's own, as toString —
 * finds no view here, and React refuses to draw it. No view is assumed. (HOME-PLANS-05, 2026-11-16: the short view's name finds its
 * holder, which draws the short view with the toggles' state — HowToShortView itself until then.)
 */
const VIEWS = { __proto__: null, short: HowToShortHolder, whole: HowToView } as const;

/**
 * Ruling a: what you run is two booleans in React state, and nothing else — a reload starts at Personal. The door is the
 * caller's (HOME-PAGES-01, 2026-11-14): Landing's function, or /financial-software's link.
 * HOME-TRIM-02 (Alex's brief, 2026-11-14 19:11 Manila; built 2026-11-15), ruling a: "ONE SECTION, TWO VIEWS. HowToSection takes one
 * more prop, view: 'short' | 'whole', required, with no default. Landing.tsx mounts it with view="short", /financial-software with
 * view="whole". The whole view renders byte for byte what main renders, on /financial-software and wherever a test renders it. The
 * audit names the smallest shape inside the file (a prop on HowToView, or a second pure view beside it) and builds the one that
 * moves fewer pins. Nothing in the whole view is copied into a second file." — the second pure view, HowToShortView, beside
 * HowToView: a prop on HowToView would have moved the six calls of it in three tests. The view is looked up by name, one element drawn,
 * the same state and door handed to either. (HOME-PLANS-05, 2026-11-16: the short view's name finds its holder, above, which keeps the
 * toggles' two booleans and draws the short view with them; this function is as it was.)
 */
export default function HowToSection({ view, onRequireAuth }: { view: 'short' | 'whole'; onRequireAuth: JoinDoor }) {
  const [business, setBusiness] = useState(false);
  const [trade, setTrade] = useState(false);
  const View = VIEWS[view];
  return <View business={business} trade={trade} onBusiness={() => setBusiness((on) => !on)} onTrade={() => setTrade((on) => !on)} onJoin={onRequireAuth} />;
}
