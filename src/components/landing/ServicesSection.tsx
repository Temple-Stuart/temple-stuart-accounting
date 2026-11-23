'use client';

/**
 * HOME-SERVICES-01 (Alex's brief, 2026-11-12 15:16 Manila: "do we have like a form under the table that adjusts questions being
 * asked by what you click? … remove that text about and replace with like an image that SHOWS what and why and how, rather than
 * telling with words … obviously following the style of the page weve built thus far since this is a continuation of all that is
 * above it!"; his approval of the board on the design canvas, 2026-11-12 15:41 Manila: "yea, I approve , this looks good, lets
 * build this for sure") — THE PROFESSIONAL SERVICES SECTION, AS DRAWN — since HOME-TRIM-03 (2026-11-15), its WHOLE view, on its own
 * page alone (view="whole"; on its own page since HOME-PAGES-01, 2026-11-14, and the guest landing's second pillar until then, where the home page draws its short view now, below). The spec is a file, not
 * this note: design-refs/home-services-01/Section-Reference.html ("Every value in its stylesheet is the design, and its markup is
 * the page at rest"), with its README beside it. This section is the HOME-SERVICES-01 half of that file's markup, element for
 * element; its classes are the reference's own with the house prefix (.ps-tile → .ts-ps-tile), and their rules are the
 * reference's own, ported to src/app/globals.css (src/lib/__tests__/homeServices01.test.ts holds both equal). No colour and no
 * word is typed in this file. Top to bottom, the whole view:
 *   1. the pillar's name — BUILD_PILLAR.heading (src/lib/homeActWords.ts) — then the one line where his paragraph stood,
 *      BUILD_PILLAR.paragraphs;
 *   2. THE PANEL: the question (NEED_QUESTION) and six tiles, one per door of SERVICES (src/lib/proposalNeeds.ts), each its icon,
 *      its title and its kind. One is always picked; at rest, the first;
 *   3. THE STAGE: the picked door's picture, title and line; how a proposal goes, in three steps (PROPOSAL_STEPS) — step 1 names
 *      the pick, step 2 lists what the form will ask (formAsks), step 3 says who reads it; then the gold button (PROPOSAL_CTA)
 *      — and, until HOME-SERVICES-02 (2026-11-16, its ruling k), "Scoped by proposal" (SCOPED_BY_PROPOSAL) beside it.
 * The form the reference draws in place, under the stage, was HOME-SERVICES-02's — a later PR, then. The brief: "The form drawn in the
 * reference is HOME-SERVICES-02, a later PR: do not build it here." The whole view keeps it so: its gold button is the link each card
 * carried. HOME-SERVICES-02 (2026-11-16) built the form on the home page instead, in the short view's panel (below).
 * The section keeps id={SERVICES_ANCHOR} (src/lib/homeAnchors.ts), the anchor the top bar's link to Professional Services lands
 * on (until HOME-MENU-01, 2026-11-16: the bar's Professional Services opens its menu now, whose six services open the form with the door picked; no link lands on the id, which stays). (HOME-PAGES-01, 2026-11-14: "the footer's and the top bar's links" until then. The footer's opens /professional-services
 * now — a page of this section's own, src/app/professional-services/page.tsx, which mounts it as Landing.tsx does: whole, and
 * directly under an element that wears none of its classes — "whole" on both until HOME-TRIM-03 (2026-11-15): the page hands it
 * view="whole" now, and Landing.tsx view="short".)
 *
 * THE RULINGS, AS BUILT HERE (Alex's brief, 2026-11-12 15:16 Manila):
 *   a. "STATE. The picked door, in React state only. No storage, no URL, no cookie; a reload starts at the first door." — the
 *      default export, below: one useState, the first door of SERVICES at first; ServicesView draws any door from its props and
 *      holds none (and so, from HOME-TRIM-03, 2026-11-15, did ServicesShortView: the one state was handed to whichever view drew — until
 *      HOME-SERVICES-02, 2026-11-16, gave the short view a pick of its own, none at rest, held by ServicesShortHolder below).
 *   d. "THE PICTURES ARE FILES, one per door, named by its key. All six are in the page and one shows. They are decorative
 *      (alt=""): the title and line beside each say what it shows. A door with no picture, or a picture with no door, fails the
 *      build by name." — the whole view's stage (the short view draws no picture since HOME-TRIM-03, 2026-11-15: its ruling b, at
 *      the short view) draws one <img> per key, public/brand/services/<key>.svg (servicePictureSrc), the five not
 *      picked hidden, each alt=""; the build's half is the services law's one line (scripts/assert-tool-registry.ts). Plain <img>, as
 *      the README has them ("Draw them with `<img>`, all six in the page, the five not picked hidden."): next/image would load the
 *      five hidden ones lazily, and a pick would wait on a download. The hero's crest and the bar's mark are drawn the same way, and
 *      their lint line is this one's.
 *   f. "THE GOLD BUTTON replaces the purple one here; PRIMARY_CTA keeps its other users. "Send a project proposal →" and
 *      "Scoped by proposal" move from Landing.tsx into a leaf. The gold gradient is HOME-PLANS-04's; the picture's frame is the
 *      second gradient, on the board." — the link wears .ts-ps-cta, not PRIMARY_CTA (src/lib/ds.ts: its value untouched); both words were
 *      src/lib/proposalNeeds.ts's (the note left with HOME-SERVICES-02, 2026-11-16: its ruling k); its href is the form's page with the pick (proposalFormHref), as the README has it:
 *      "The button links to the form's page with the pick: `/work-with-me?need=<key>`, the link each card carried until now."
 *   h. "HOOKS. data-done-for-you={need} moves to the tiles." — each tile carries it, in the place the reference's tile carries
 *      data-need; each picture keeps the reference's data-need.
 *   (b is built in src/lib/homeActWords.ts; c and e in src/lib/proposalNeeds.ts, e's rule held by the test that renders the form
 *   for each door, until HOME-SERVICES-02, 2026-11-16, gave each door its own questions; g in src/app/globals.css.)
 * 'use client' FOR THE STATE: the pick is React state, and each tile's press sets it.
 *
 * HOME-TRIM-03 (Alex's brief, 2026-11-14 19:11 Manila, with his four beta users' notes on the home page; the boards approved on the
 * design canvas at 20:01 and, corrected, at 20:41; built 2026-11-15) — ONE SECTION, TWO VIEWS. On its own page the section draws its
 * WHOLE view (view="whole", src/app/professional-services/page.tsx): ServicesView, everything this header describes, its render main's
 * byte for byte. On the home page it draws its SHORT view (view="short", Landing.tsx): the section's name and its line, the panel with
 * the question and the six tiles, under them the picked door's name and line with the gold link and its note, then one link under the
 * panel — the section of design-refs/home-trim-03/Section-Reference.html, element for element (ServicesShortView, below: rulings b, d
 * and g are quoted there, rulings a and c at the default export). So that brief built it; since HOME-SERVICES-02 (2026-11-16) the panel
 * holds the six services as toggles and the proposal form under them, and nothing links elsewhere: no door row, no gold link, no note,
 * no link under the panel. The parts both views draw are written once, below. Ruling i, which
 * re-said this header and the other notes that went false: "NOTES THAT GO FALSE ARE RE-SAID IN PLACE, dated, as HOME-TRIM-02 re-said its
 * own: every sentence that says the home page draws the picture, the steps or the button under them. No line moves in a file whose lines
 * a test or a law cites." — "AS DRAWN" and "Top to bottom" above name the whole view now, and the page's mount above is dated. Ruling j:
 * "NOTHING ELSE CHANGES: not the hero, the other sections, About Us, Our Story, the footer, /work-with-me or /professional-services."
 *
 * HOME-SERVICES-02 (Alex, 2026-11-16 09:58 Manila: "selecting the category acts as a toggler then a tailored form popus up under the
 * section to be filled out, and submit proposal button at bottom"; his approval of the boards, 10:26: "looks dope lets rick") — THE SHORT
 * VIEW'S SERVICES OPEN THE PROPOSAL FORM IN PLACE: the section of design-refs/home-services-02/Section-Reference.html, element for element
 * (ServicesShortView and ServicesShortHolder below; the form is src/components/landing/ServicesForm.tsx). Alex's brief, 2026-11-16 13:24
 * Manila, ruling t: "ONLY THE PROFESSIONAL SERVICES SECTION AND THE PROPOSAL FORM CHANGE, with the note leaving two pages and what stores and shows the answers. Not the whole view's stage or button, not /work-with-me's look beyond the new kinds of field, not the top bar, the footer or any other section." — the whole view draws what main draws but the note; the pick it holds is the default export's, as it was.
 *
 * UNTIL THIS BRIEF (SERVICES-01, Alex, 2026-11-08; drawn inline in Landing.tsx since LANDING-V4): the pillar's heading in the
 * page's purple heading classes, his one paragraph, and a white card holding six equal doors — each a link to the form with its
 * door picked (?need=<key>), its title and its line — then the purple button (PRIMARY_CTA) to the bare form and "Scoped by
 * proposal". The section wore 'w-full border-b border-border bg-bg-terminal'. Landing.tsx keeps that section's notes, as
 * history, above the mount.
 */

import Link from 'next/link';
import { useState, type MouseEvent, type ReactNode } from 'react';
import ServicesForm, { FORM_ID } from '@/components/landing/ServicesForm';
import { useProposalForm, type ProposalForm } from '@/hooks/useProposalForm';
import { BUILD_PILLAR } from '@/lib/homeActWords';
import { SERVICES_ANCHOR } from '@/lib/homeAnchors';
import {
  NEED_QUESTION, PROPOSAL_CTA, PROPOSAL_STEPS, SERVICES, SERVICE_NEEDS,
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

/**
 * HOME-TRIM-03 (Alex's brief, 2026-11-14 19:11 Manila; built 2026-11-15) — WHAT BOTH VIEWS DRAW IS WRITTEN ONCE, in this file: the
 * section's name and its line (here), the question and the six tiles (Tiles), the picked door's name and line (DoorWords) and the gold
 * link with its note (GoldLink). Until this brief ServicesView drew each of them inline; it draws them through these now, and its render
 * is main's, byte for byte (src/lib/__tests__/homeTrim03.test.ts holds it). Since HOME-SERVICES-02 (2026-11-16) the short view draws the
 * name and line, the tiles (each naming the form it opens, aria-controls) and DoorWords — handed to its form — and no gold link; the
 * gold link's note is gone from both views.
 */
function SectionName() {
  return (
    <>
      <h2 className="ts-ps__title" id="ps-title">{BUILD_PILLAR.heading}</h2>
      {BUILD_PILLAR.paragraphs.map((words) => <p key={words} className="ts-ps__lede">{words}</p>)}
    </>
  );
}

/**
 * The question and the six tiles — one per door of SERVICES, in its order; the picked one pressed; a tile's press is the door it names.
 * HOME-SERVICES-02 (2026-11-16): the short view's pick may be none (none is pressed then), and its tiles name the form they open
 * (controls, drawn as aria-controls); the whole view hands no controls, so its tiles are drawn as main draws them.
 */
function Tiles({ picked, onPick, controls }: { picked: ServiceNeed | null; onPick: (need: ServiceNeed) => void; controls?: string }) {
  return (
    <>
      <h3 className="ts-ps-panel__question" id="ps-question">{NEED_QUESTION}</h3>
      <div className="ts-ps-tiles" role="group" aria-labelledby="ps-question">
        {SERVICES.map(({ need, title, kind }) => (
          <button key={need} className="ts-ps-tile" type="button" aria-pressed={need === picked} aria-controls={controls} data-done-for-you={need} onClick={() => onPick(need)}>
            <TileIcon need={need} /><span className="ts-ps-tile__words"><span className="ts-ps-tile__title">{title}</span><span className="ts-ps-tile__kind">{kind}</span></span>
          </button>
        ))}
      </div>
    </>
  );
}

/** The picked door's name and its line; the name is the live region, so a pick is heard (aria-live="polite", as the stage's has it). */
function DoorWords({ picked }: { picked: ServiceNeed }) {
  const door = serviceDoor(picked);
  return (
    <>
      <h3 className="ts-ps-stage__title" aria-live="polite">{door.title}</h3>
      <p className="ts-ps-stage__line">{door.line}</p>
    </>
  );
}

/**
 * The gold link to the form with the pick (proposalFormHref) — the whole view's stage's. Its note beside it, and the short view's row that
 * drew the two, left with HOME-SERVICES-02 (2026-11-16, rulings k and j).
 */
function GoldLink({ picked }: { picked: ServiceNeed }) {
  return <Link className="ts-ps-cta" href={proposalFormHref(picked)}>{PROPOSAL_CTA}</Link>;
}

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
        <SectionName />

        <div className="ts-ps-panel">
          <Tiles picked={picked} onPick={onPick} />

          <div className="ts-ps-stage">
            <div className="ts-ps-stage__art">
              {SERVICE_NEEDS.map((need) => <img key={need} src={servicePictureSrc(need)} alt="" width={560} height={380} data-need={need} hidden={need !== picked} />)}{/* eslint-disable-line @next/next/no-img-element */}
            </div>
            <div className="ts-ps-stage__text">
              <DoorWords picked={picked} />
              <ol className="ts-ps-steps">
                {steps.map((step, i) => (
                  <li key={step.at} className="ts-ps-step" data-step={step.at}>
                    <span className="ts-ps-step__rail"><span className="ts-ps-step__mark" aria-hidden="true">{step.at === 'done' ? <Tick size={12} /> : i + 1}</span>{i < steps.length - 1 ? <span className="ts-ps-step__wire" /> : null}</span>
                    <div className="ts-ps-step__body"><p className="ts-ps-step__title">{step.title}</p>{step.body}</div>
                  </li>
                ))}
              </ol>
              <div className="ts-ps-cta-row">
                <GoldLink picked={picked} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * THE SHORT VIEW — the home page's. HOME-TRIM-03 (Alex's brief, 2026-11-14 19:11 Manila; built 2026-11-15), ruling b: "WHAT THE SHORT
 * VIEW DRAWS is the reference's section. The picture, the three steps and their rail are absent from its markup, not hidden. The section
 * keeps id={SERVICES_ANCHOR}, aria-labelledby="ps-title" and each tile's data-done-for-you, and adds the reference's hook, ts-ps--short.
 * The picked service's name keeps aria-live="polite"." — the section of design-refs/home-trim-03/Section-Reference.html: its tag (the
 * anchor, the label, ts-ps--short), its inner box, the name and line (SectionName), the panel holding the question and the six tiles
 * (Tiles), then the picked door's row (.ts-ps-brief: its name and line, DoorWords, in .ts-ps-brief__text; the gold link and its note,
 * GoldLink, in .ts-ps-brief__go); under the panel, the link to the section's own page — so it drew them until HOME-SERVICES-02. Ruling d: "THE WORDS. Nothing is typed. "See how a
 * proposal works →" is new: one constant in src/lib/proposalNeeds.ts beside SCOPED_BY_PROPOSAL (:166), the arrow in the string, with a
 * dated note. Its link is a next/link Link, as the gold link is, to PROFESSIONAL_SERVICES_PATH (src/lib/homePages.ts:42). It carries no
 * state." — the words SEE_HOW_A_PROPOSAL_WORKS, the path the pages' leaf's. Ruling g: "THE ARROWS in the two links are drawn by the
 * fallback face, as "Send a project proposal →" already is on main. A later PR fixes every arrow at once. Name those pixels; do not fix
 * them here." — named in the PR; no face is added for U+2192 (the gold link inherits the section's family, the link under the panel reads the site's mono, as the reference names its mono). Its props were ServicesView's; it held no state.
 * HOME-SERVICES-02 (Alex's brief, 2026-11-16 13:24 Manila), ruling j: "THE SECTION SENDS NOBODY ELSEWHERE. The short view's brief row leaves, with the door's name and line, the gold link and its note. The link under the panel to /professional-services leaves too, and SEE_HOW_A_PROPOSAL_WORKS with it, and the rules of both." — gone from the markup: the row (.ts-ps-brief), its gold link
 * and note, the link under the panel and its word (SEE_HOW_A_PROPOSAL_WORKS), and their rules in the port. What the short view draws now is
 * the section of design-refs/home-services-02/Section-Reference.html: the tag, the inner box, the name and line (SectionName), the panel
 * holding the question and the six tiles (Tiles, each naming the form it opens), then the proposal form (ServicesForm), handed the
 * picked door's name and line (DoorWords) for its head. It is still pure: it draws the pick, the hook's form and Close it is handed.
 */
export function ServicesShortView({ picked, onPick, form, onClose }: ServicesShortProps) {
  return (
    <section id={SERVICES_ANCHOR} className="ts-ps ts-ps--short" aria-labelledby="ps-title">
      <div className="ts-ps__inner">
        <SectionName />

        <div className="ts-ps-panel">
          <Tiles picked={picked} onPick={onPick} controls={FORM_ID} />

          <ServicesForm form={form} door={picked === null ? null : <DoorWords picked={picked} />} onClose={onClose} />
        </div>
      </div>
    </section>
  );
}

/** HOME-SERVICES-02: what the short view is handed — its pick, which may be none; a tile's press; the hook's form; Close. */
export interface ServicesShortProps {
  /** The picked service, or none: none at rest. */
  picked: ServiceNeed | null;
  /** A tile's press: the holder's toggle. */
  onPick: (need: ServiceNeed) => void;
  /** The proposal form's hook, as the holder called it (src/hooks/useProposalForm.ts). */
  form: ProposalForm;
  /** Close: none picked, and focus back on the tile that was. */
  onClose: (event: MouseEvent<HTMLButtonElement>) => void;
}

/**
 * HOME-SERVICES-02 (Alex's brief, 2026-11-16 13:24 Manila), ruling a: "A SERVICE IS A TOGGLE ON THE HOME PAGE. At rest nothing is picked, and the panel holds only the question and the six. A press on a service picks it and opens the proposal form under them, inside the panel. A press on another picks that one, and the open form follows it. A press on the picked service picks none and closes the form, which is also what Close does. Each tile keeps aria-pressed and gains aria-controls="ps-form". A press leaves focus on its tile, and Close hands focus back to the tile that was picked." — THE SHORT VIEW'S HOLDER: its own pick, React state, none at rest;
 * a press on a tile picks it, a press on the picked one picks none, and focus stays where the press left it, on the tile; Close picks none
 * and hands focus back to the tile that was picked (found in this section by its data-done-for-you; a tile that is not there is refused by
 * name). Ruling i: "THE FORM IS IN THE PAGE FROM THE START, HIDDEN WHILE NOTHING IS PICKED. It is never unmounted, so a close keeps what was typed. The pick is React state, none at rest; nothing is stored and nothing is put in the URL. Which shape holds the short view's state is the audit's to name, the smallest by the pins it moves." — the holder calls the hook (src/hooks/useProposalForm.ts), so the answers live as long as the section, and the
 * form it draws (ServicesForm.tsx) hides while the pick is none and is never unmounted. Nothing is stored, nothing goes in the URL.
 * The pick the default export hands every view is the whole view's (ruling l): this view takes those props and draws from its own pick.
 * nextPick is the toggle, pure, so the tests reach it: a press picks the service pressed, or none when it is the one picked.
 */
export function nextPick(now: ServiceNeed | null, pressed: ServiceNeed): ServiceNeed | null {
  return now === pressed ? null : pressed;
}

function ServicesShortHolder(wholeViewsPick: ServicesViewProps) {
  const [picked, setPicked] = useState<ServiceNeed | null>(null);
  const form = useProposalForm(picked);
  void wholeViewsPick;
  const onPick = (need: ServiceNeed) => setPicked((now) => nextPick(now, need));
  const onClose = (event: MouseEvent<HTMLButtonElement>) => {
    const section = event.currentTarget.closest('section');
    const tile = section === null ? undefined : Array.from(section.querySelectorAll<HTMLButtonElement>('.ts-ps-tile')).find((each) => each.dataset.doneForYou === picked);
    if (tile === undefined) throw new Error('services: Close found no tile for "' + String(picked) + '" to hand focus back to');
    setPicked(null);
    tile.focus();
  };
  return <ServicesShortView picked={picked} onPick={onPick} form={form} onClose={onClose} />;
}

/**
 * Each view by its name, in an object with no prototype: a name that is neither — a missing one, or one of Object's own, as toString —
 * finds no view here, and React refuses to draw it. No view is assumed. (HowToSection.tsx's lookup, HOME-TRIM-02.)
 */
const VIEWS = { __proto__: null, short: ServicesShortHolder, whole: ServicesView } as const;

/**
 * Ruling a: the picked door is React state, and nothing else — a reload starts at the first door.
 * HOME-TRIM-03 (Alex's brief, 2026-11-14 19:11 Manila; built 2026-11-15), ruling a: "ONE SECTION, TWO VIEWS, as HOME-TRIM-02 built them.
 * ServicesSection takes view: 'short' | 'whole', required, with no default. It picks its pure view by a lookup that refuses any other
 * name, as HowToSection does. A second pure view, ServicesShortView, stands beside ServicesView. Landing.tsx mounts view="short",
 * /professional-services view="whole". The whole view renders byte for byte what main renders, on /professional-services and wherever a
 * test renders it. What both views draw is written once (the name and line, the question and the six tiles, the gold link and its note).
 * Nothing in the whole view is copied." — the view looked up by name, one element drawn. Ruling c: "THE PICK is the section's own: React
 * state, the first door at rest, nothing stored and nothing in the URL. The gold link is the same Link to proposalFormHref(picked)." —
 * the one useState, as it was, handed to whichever view draws; the gold link is GoldLink's, in both. (So it stood until HOME-SERVICES-02,
 * 2026-11-16: the short view holds its own pick now, and draws no gold link — ServicesShortHolder, above.)
 * HOME-SERVICES-02 (Alex's brief, 2026-11-16 13:24 Manila), ruling l: "THE WHOLE VIEW KEEPS ITS OWN PICK: Full setup at rest, and a press only picks. Its render is main's but for the note." — this useState is the whole view's: Full setup at rest, a
 * press picks (setPicked, never a toggle). Handed "short", the lookup finds the short view's holder, which keeps its own.
 */
export default function ServicesSection({ view }: { view: 'short' | 'whole' }) {
  const [picked, setPicked] = useState<ServiceNeed>(SERVICES[0].need);
  const View = VIEWS[view];
  return <View picked={picked} onPick={setPicked} />;
}
