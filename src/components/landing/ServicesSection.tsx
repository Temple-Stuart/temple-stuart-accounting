'use client';

/**
 * HOME-SERVICES-01 (Alex's brief, 2026-11-12 15:16 Manila: "do we have like a form under the table that adjusts questions being
 * asked by what you click? … remove that text about and replace with like an image that SHOWS what and why and how, rather than
 * telling with words … obviously following the style of the page weve built thus far since this is a continuation of all that is
 * above it!"; his approval of the board on the design canvas, 2026-11-12 15:41 Manila: "yea, I approve , this looks good, lets
 * build this for sure") — THE PROFESSIONAL SERVICES SECTION, AS DRAWN: the guest landing's second pillar. The spec is a file, not
 * this note: design-refs/home-services-01/Section-Reference.html ("Every value in its stylesheet is the design, and its markup is
 * the page at rest"), with its README beside it. This section is the HOME-SERVICES-01 half of that file's markup, element for
 * element; its classes are the reference's own with the house prefix (.ps-tile → .ts-ps-tile), and their rules are the
 * reference's own, ported to src/app/globals.css (src/lib/__tests__/homeServices01.test.ts holds both equal). No colour and no
 * word is typed in this file. Top to bottom:
 *   1. the pillar's name — BUILD_PILLAR.heading (src/lib/homeActWords.ts) — then the one line where his paragraph stood,
 *      BUILD_PILLAR.paragraphs;
 *   2. THE PANEL: the question (NEED_QUESTION) and six tiles, one per door of SERVICES (src/lib/proposalNeeds.ts), each its icon,
 *      its title and its kind. One is always picked; at rest, the first;
 *   3. THE STAGE: the picked door's picture, title and line; how a proposal goes, in three steps (PROPOSAL_STEPS) — step 1 names
 *      the pick, step 2 lists what the form will ask (formAsks), step 3 says who reads it; then the gold button (PROPOSAL_CTA)
 *      and "Scoped by proposal" (SCOPED_BY_PROPOSAL) beside it.
 * The form the reference draws in place, under the stage, is HOME-SERVICES-02's — a later PR. The brief: "The form drawn in the
 * reference is HOME-SERVICES-02, a later PR: do not build it here." Until then the gold button is the link each card carried.
 * The section keeps id={SERVICES_ANCHOR} (src/lib/homeAnchors.ts), the anchor the footer's and the top bar's links to Professional
 * Services land on.
 *
 * THE RULINGS, AS BUILT HERE (Alex's brief, 2026-11-12 15:16 Manila):
 *   a. "STATE. The picked door, in React state only. No storage, no URL, no cookie; a reload starts at the first door." — the
 *      default export, below: one useState, the first door of SERVICES at first; ServicesView draws any door from its props and
 *      holds none.
 *   d. "THE PICTURES ARE FILES, one per door, named by its key. All six are in the page and one shows. They are decorative
 *      (alt=""): the title and line beside each say what it shows. A door with no picture, or a picture with no door, fails the
 *      build by name." — the stage draws one <img> per key, public/brand/services/<key>.svg (servicePictureSrc), the five not
 *      picked hidden, each alt=""; the build's half is the services law's one line (scripts/assert-tool-registry.ts). Plain <img>, as
 *      the README has them ("Draw them with `<img>`, all six in the page, the five not picked hidden."): next/image would load the
 *      five hidden ones lazily, and a pick would wait on a download. The hero's crest and the bar's mark are drawn the same way, and
 *      their lint line is this one's.
 *   f. "THE GOLD BUTTON replaces the purple one here; PRIMARY_CTA keeps its other users. "Send a project proposal →" and
 *      "Scoped by proposal" move from Landing.tsx into a leaf. The gold gradient is HOME-PLANS-04's; the picture's frame is the
 *      second gradient, on the board." — the link wears .ts-ps-cta, not PRIMARY_CTA (src/lib/ds.ts: its value untouched); both words are
 *      src/lib/proposalNeeds.ts's; its href is the form's page with the pick (proposalFormHref), as the README has it:
 *      "The button links to the form's page with the pick: `/work-with-me?need=<key>`, the link each card carried until now."
 *   h. "HOOKS. data-done-for-you={need} moves to the tiles." — each tile carries it, in the place the reference's tile carries
 *      data-need; each picture keeps the reference's data-need.
 *   (b is built in src/lib/homeActWords.ts; c and e in src/lib/proposalNeeds.ts, e's rule held by the test that renders the form
 *   for each door; g in src/app/globals.css.)
 * 'use client' FOR THE STATE: the pick is React state, and each tile's press sets it.
 *
 * UNTIL THIS BRIEF (SERVICES-01, Alex, 2026-11-08; drawn inline in Landing.tsx since LANDING-V4): the pillar's heading in the
 * page's purple heading classes, his one paragraph, and a white card holding six equal doors — each a link to the form with its
 * door picked (?need=<key>), its title and its line — then the purple button (PRIMARY_CTA) to the bare form and "Scoped by
 * proposal". The section wore 'w-full border-b border-border bg-bg-terminal'. Landing.tsx keeps that section's notes, as
 * history, above the mount.
 */

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { BUILD_PILLAR } from '@/lib/homeActWords';
import { SERVICES_ANCHOR } from '@/lib/homeAnchors';
import {
  NEED_QUESTION, PROPOSAL_CTA, PROPOSAL_STEPS, SCOPED_BY_PROPOSAL, SERVICES, SERVICE_NEEDS,
  formAsks, proposalFormHref, serviceDoor, servicePictureSrc, type ServiceNeed,
} from '@/lib/proposalNeeds';

/**
 * Each door's icon, as the reference draws it — keyed by the door, so a door with no icon does not compile. Decorative: the tile's
 * title says what it is. Each is a function, so nothing is drawn until the tile is (no element is made when the module loads).
 */
const TILE_ICONS: { readonly [N in ServiceNeed]: () => ReactNode } = {
  setup: () => <><rect x="3" y="4.5" width="18" height="15" rx="3.5" /><path d="M3 9.2h18M7.2 12.6h3.6v3.4H7.2zM13.2 12.6h3.6v3.4h-3.6z" /></>,
  maintenance: () => <path d="M19.5 12.4a7.5 7.5 0 0 1 -13 4.7M4.5 11.6a7.5 7.5 0 0 1 13 -4.7M17.8 3.4v3.8H14M6.2 20.6v-3.8H10" />,
  custom: () => <><rect x="3.5" y="3.5" width="17" height="17" rx="4" strokeDasharray="3.2 2.6" /><path d="M12 8.4v7.2M8.4 12h7.2" /></>,
  embed: () => <path d="M9 3.4v4.4M15 3.4v4.4M6.4 7.8h11.2v3.4a5.6 5.6 0 0 1 -11.2 0zM12 16.8v3.8" />,
  bookkeeping: () => <><rect x="5" y="3.5" width="14" height="17" rx="2.6" /><path d="M8.6 8h6.8M8.6 11.6h6.8M8.6 15.2h3.6" /></>,
  unsure: () => <><path d="M5 4.8h14a2 2 0 0 1 2 2v8.4a2 2 0 0 1 -2 2h-6.6L8 20.6v-3.4H5a2 2 0 0 1 -2 -2V6.8a2 2 0 0 1 2 -2z" /><path d="M8.4 11h.01M12 11h.01M15.6 11h.01" strokeWidth="2.6" /></>,
};

function TileIcon({ need }: { need: ServiceNeed }) {
  return <svg className="ts-ps-tile__icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{TILE_ICONS[need]()}</svg>;
}

/** The reference's tick: step 1's mark (12px) and the picked chip's (11px). Decorative: the words beside it say it. */
function Tick({ size }: { size: 11 | 12 }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" /></svg>;
}

/** How a proposal goes, step by step: where it stands (done, now, next), its title and what it holds. A step's number is its place. */
type Step = { readonly at: 'done' | 'now' | 'next'; readonly title: string; readonly body: ReactNode };

export interface ServicesViewProps {
  /** The picked door. */
  picked: ServiceNeed;
  /** A tile's press: the door it names. */
  onPick: (need: ServiceNeed) => void;
}

/** THE PURE HALF: the whole section for one picked door. It holds no state; the default export does. */
export function ServicesView({ picked, onPick }: ServicesViewProps) {
  const door = serviceDoor(picked);
  const steps: readonly Step[] = [
    {
      at: 'done',
      title: PROPOSAL_STEPS.pick,
      body: <p className="ts-ps-chips"><span className="ts-ps-chip ts-ps-chip--picked" data-picked><Tick size={11} /><span>{door.title}</span></span></p>,
    },
    {
      at: 'now',
      title: PROPOSAL_STEPS.tell,
      body: <ul className="ts-ps-chips ts-ps-chips--asks" data-asks>{formAsks(picked).map((ask) => <li key={ask} className="ts-ps-chip">{ask}</li>)}</ul>,
    },
    {
      at: 'next',
      title: PROPOSAL_STEPS.read,
      body: <p className="ts-ps-step__note">{PROPOSAL_STEPS.note}</p>,
    },
  ];
  return (
    <section id={SERVICES_ANCHOR} className="ts-ps" aria-labelledby="ps-title">
      <div className="ts-ps__inner">
        <h2 className="ts-ps__title" id="ps-title">{BUILD_PILLAR.heading}</h2>
        {BUILD_PILLAR.paragraphs.map((words) => <p key={words} className="ts-ps__lede">{words}</p>)}

        <div className="ts-ps-panel">
          <h3 className="ts-ps-panel__question" id="ps-question">{NEED_QUESTION}</h3>
          <div className="ts-ps-tiles" role="group" aria-labelledby="ps-question">
            {SERVICES.map(({ need, title, kind }) => (
              <button key={need} className="ts-ps-tile" type="button" aria-pressed={need === picked} data-done-for-you={need} onClick={() => onPick(need)}>
                <TileIcon need={need} /><span className="ts-ps-tile__words"><span className="ts-ps-tile__title">{title}</span><span className="ts-ps-tile__kind">{kind}</span></span>
              </button>
            ))}
          </div>

          <div className="ts-ps-stage">
            <div className="ts-ps-stage__art">
              {SERVICE_NEEDS.map((need) => <img key={need} src={servicePictureSrc(need)} alt="" width={560} height={380} data-need={need} hidden={need !== picked} />)}{/* eslint-disable-line @next/next/no-img-element */}
            </div>
            <div className="ts-ps-stage__text">
              <h3 className="ts-ps-stage__title" aria-live="polite">{door.title}</h3>
              <p className="ts-ps-stage__line">{door.line}</p>
              <ol className="ts-ps-steps">
                {steps.map((step, i) => (
                  <li key={step.at} className="ts-ps-step" data-step={step.at}>
                    <span className="ts-ps-step__rail"><span className="ts-ps-step__mark" aria-hidden="true">{step.at === 'done' ? <Tick size={12} /> : i + 1}</span>{i < steps.length - 1 ? <span className="ts-ps-step__wire" /> : null}</span>
                    <div className="ts-ps-step__body"><p className="ts-ps-step__title">{step.title}</p>{step.body}</div>
                  </li>
                ))}
              </ol>
              <div className="ts-ps-cta-row">
                <Link className="ts-ps-cta" href={proposalFormHref(picked)}>{PROPOSAL_CTA}</Link>
                <span className="ts-ps-note">{SCOPED_BY_PROPOSAL}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Ruling a: the picked door is React state, and nothing else — a reload starts at the first door. */
export default function ServicesSection() {
  const [picked, setPicked] = useState<ServiceNeed>(SERVICES[0].need);
  return <ServicesView picked={picked} onPick={setPicked} />;
}
