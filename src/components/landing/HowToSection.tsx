'use client';

/**
 * HOME-PLANS-04 (Alex's brief, 2026-11-12 14:07 Manila: "Plaids sections with Title, Sub title, quick explainer paragraph, and
 * then list of features. ours is a little more complex looking and harer to see separation … instead of this , we might have like
 * some simple like lists, or something or an image... that like lists the Tabs , separated by Tier? … simple and easy to
 * understand"; his approval of the board on the design canvas, 2026-11-12 14:30 Manila: "YES, OMG, GIVE ME THE PROMPT TO MAKE THIS
 * REAL!") — THE FINANCIAL SOFTWARE SECTION, AS DRAWN. The spec is a file, not this note: design-refs/home-plans-04/Section-Reference.html
 * ("Every value in its stylesheet is the design, and its markup is the page at rest"), with its README beside it. This section is
 * that file's markup, element for element, but for Alex's notes on the built page (below); its classes are the reference's own
 * with the house prefix (.fs-map → .ts-fs-map), and their rules are the reference's own, ported to src/app/globals.css
 * (src/lib/__tests__/homePlans04.test.ts holds both equal, but for the differences it names). No colour is typed in this file.
 * Top to bottom:
 *   1. the pillar's name — PLAN_PILLAR.heading (src/lib/homeActWords.ts) — then ONE line, PLANS_SUBHEAD (src/lib/offer/plans.ts),
 *      where the pillar's three paragraphs stood;
 *   2. THE MAP: the question (PLANS_HEADLINE), the Personal pill, the two switches, then the 25 tools under the six families of
 *      PROBLEM_SHEET, each lit or not by the picked plan — the Personal pill's words, the switches and the tools from planMapView
 *      (src/lib/howTo.ts); the question, the group's label and the marks' labels from their leaves;
 *   3. three plan cards and the all-three band, drawn here; the picked plan is ringed, tagged and gold;
 *   4. the one link to /pricing — its words and path as they were, in the reference's look.
 * "What We Do" stays where it stands, in Landing.tsx, in the reference's box (.ts-fs-heading), and wears the act headings' type
 * since Alex's note on the built page (the eyebrow, .ts-fs-eyebrow, until then). The section keeps
 * id="modules", the anchor the checkout's cancel link, the /modules pages, the footer's first link and — since HERO-CREST-01,
 * 2026-11-11 — the top bar's first link land on.
 *
 * THE RULINGS, AS BUILT HERE (Alex's brief, 2026-11-12 14:07 Manila):
 *   a. "STATE. The section holds two booleans in React state: what you run. No storage, no URL, no cookie; a reload starts at
 *      Personal. This ends HOME-PLANS-03's "NO STATE" for these two switches and nothing else." — the default export, below: two
 *      useState booleans, both false at first; HowToView draws any of the four states from props and holds none.
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
 * hands in (onRequireAuth — the sign-up modal).
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
import { COMPARE_PLANS_PATH, COMPARE_PLANS_WORDS, PLAN_MARKS, WHAT_YOU_RUN_LABEL, YOUR_PLAN, planMapView, type MapPlan, type NamePart } from '@/lib/howTo';
import { PLAN_PILLAR } from '@/lib/homeActWords';
import { PLANS_HEADLINE, PLANS_SUBHEAD } from '@/lib/offer/plans';

/** The reference's tick. Hidden from a screen reader where the words beside it say it (a switch, Personal); carrying its label where it is a tool's mark. */
function Tick({ label }: { label?: string }) {
  return label === undefined
    ? <svg className="ts-fs-tick" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" /></svg>
    : <svg className="ts-fs-tick" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label={label}><path d="M3.5 8.5l3 3 6-7" /></svg>;
}

/** The reference's check, beside each of a plan's three benefits. Decorative: the benefit's words are what it says. */
function Check() {
  return <svg className="ts-fs-check" width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="10" cy="10" r="8.2" /><path d="M6.4 10.3l2.4 2.4 4.8-5.2" /></svg>;
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

/** A plan's three benefits, then its foot: how many tools it holds, its price slot's words, and its button — the door. */
function PlanBody({ plan, onJoin }: { plan: MapPlan; onJoin: () => void }) {
  return (
    <>
      <ul className="ts-fs-plan__points">
        {plan.benefits.map((words) => <li key={words} className="ts-fs-plan__point"><Check />{words}</li>)}
      </ul>
      <div className="ts-fs-plan__foot">
        <p className="ts-fs-plan__meta"><span>{plan.count}</span><span className="ts-fs-plan__price">{plan.price}</span></p>
        <button className="ts-fs-plan__cta" type="button" onClick={() => onJoin()}>{plan.cta}</button>
      </div>
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
  /** The door every plan's button opens — Landing's onRequireAuth (the sign-up modal). */
  onJoin: () => void;
}

/** THE PURE HALF: the whole section for one state of the two switches. It holds no state; the default export does. */
export function HowToView({ business, trade, onBusiness, onTrade, onJoin }: HowToViewProps) {
  const view = planMapView({ business, trade });
  const press = { business: onBusiness, trading: onTrade } as const;
  return (
    <section id="modules" className="ts-fs" aria-label="Software plans" data-how-to>
      <div className="ts-fs__inner">
        <h2 className="ts-fs__title">{PLAN_PILLAR.heading}</h2>
        <p className="ts-fs__lede">{PLANS_SUBHEAD}</p>

        <div className="ts-fs-map">
          <div className="ts-fs-map__head">
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
          </div>
          <div className="ts-fs-map__grid">
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
        </div>

        <div className="ts-fs-plans">
          {view.cards.map((plan) => (
            <div key={plan.id} className="ts-fs-plan" data-plan={plan.id} data-picked={plan.picked}>
              <PlanHead plan={plan} />
              <PlanBody plan={plan} onJoin={onJoin} />
            </div>
          ))}
        </div>

        <div className="ts-fs-plan ts-fs-plan--all" data-plan={view.band.id} data-picked={view.band.picked}>
          <div className="ts-fs-plan__lead">
            <PlanHead plan={view.band} />
          </div>
          <PlanBody plan={view.band} onJoin={onJoin} />
        </div>

        <a className="ts-fs__compare" href={COMPARE_PLANS_PATH} data-compare-plans>{COMPARE_PLANS_WORDS}</a>
      </div>
    </section>
  );
}

/** Ruling a: what you run is two booleans in React state, and nothing else — a reload starts at Personal. */
export default function HowToSection({ onRequireAuth }: { onRequireAuth: () => void }) {
  const [business, setBusiness] = useState(false);
  const [trade, setTrade] = useState(false);
  return <HowToView business={business} trade={trade} onBusiness={() => setBusiness((on) => !on)} onTrade={() => setTrade((on) => !on)} onJoin={onRequireAuth} />;
}
