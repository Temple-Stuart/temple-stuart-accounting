'use client';

/**
 * LandingHeader — THE GUEST'S TOP BAR, on every page that mounts it: the landing, /pricing, /how-it-works, the
 * /modules pages, a trip page and the signed-out cockpit tabs (and, since HOME-PAGES-01, 2026-11-14, /financial-software, /professional-services and /about).
 *
 * HERO-CREST-01 (Alex, design canvas, 2026-11-11) — ONE PILL, TWO FILLS. The bar is the reference's pill
 * (design-refs/hero-crest-01/Hero-Reference.html — "every value in its stylesheet is the design"): the gold crest
 * mark and the wordmark · Financial Software | Professional Services | Travel Marketplace · Pricing · Log in (HOME-MENU-01, 2026-11-16: the three names with a caret each, then About Us with its own, first in the account group, before Pricing — "· Pricing · Log in" followed the three names until then). Its
 * classes are the reference's own with the house prefix (.bar__pill → .ts-bar__pill …), and their rules are the
 * reference's own, ported to the foot of src/app/globals.css (and, since HOME-MENU-01, 2026-11-16, design-refs/home-menu-01's second stylesheet after them: the menu's); no colour is typed in this file.
 *   · FILLED IS THE DEFAULT — the pill filled with the hero's violet, in the page's flow, on that page's own cream.
 *     Five mounts take it by passing nothing new (eight since HOME-PAGES-01, 2026-11-14: the three sections' own pages).
 *   · GLASS IS THE LANDING'S — `glass` lays the same pill over the hero (Landing.tsx), where it scrolls away with it.
 *   · THE THREE LINKS were the home page's three pillars until HOME-MENU-01 (2026-11-16): each wore its pillar's own name — the pillar's heading,
 *     src/lib/homeActWords.ts (PILLAR-NAMES-01, 2026-11-11) — and landed on that pillar's section by the section's own anchor from src/lib/homeAnchors.ts
 *     (MODULES_ANCHOR · SERVICES_ANCHOR · DEMO_ANCHOR). Since then THE FOUR NAMES — the three pillars' headings and About Us, read from homeActWords.ts — are buttons that open one panel of the site's destinations and land on no section (BAR_MENU and the view, below). No pillar name and no id is typed
 *     here (the menu's other words are BAR_MENU's, below, the heavy homes' copied once: ruling f). Its links are absolute (/#… and /…), so they land from every page the bar is on.
 *   · LOG IN KEEPS ITS TWO MODES (ROUTE-1, below): a button calling onRequireLogin where a login modal exists, a link
 *     to '/' where none does.
 *   · UNDER 1024px the bar's row folds into a menu behind one 44px button — the menu repeated the three links, Pricing and Log in until HOME-MENU-01 (2026-11-16); since then its first four rows are the four names, each opening its own list, before the rule, Pricing and Log in. Open or closed — the menu, the panel and the open list — is React state, and nothing
 *     else: no storage, no cookie, no URL. The menu closes on a link, on Log in, on Escape and on the button.
 * GONE, BY ALEX'S RULING (2026-11-11):
 *   · "GitHub ↗" — "remove github, the icon is enough, we dont need it 2x": the hero's "Clone it on GitHub" carries
 *     GitHub's mark, and the footer's THE RECORD keeps the code's link on every page that mounts the footer. (The
 *     signed-out cockpit tabs mount none: this link was their one link to the code.) HOME-MENU-01 (2026-11-16), his newer choice, beside it: the menu's About Us column draws the footer's code link again, "Built in Public: The Code", in a new tab, from the copy below (ruling h, quoted there) — on the cockpit tabs too.
 *   · "CREATE FREE ACCOUNT" — "create free account top right, that can be login… we dont need it twice": the hero
 *     keeps the register ask, and Log in opens the one LoginBox, whose own switch reaches "create account". The
 *     onRequireAuth prop left with its last reader (it fed that button alone).
 * GONE WITH THE DESIGN: the white box with the crest in it (public/brand/temple-stuart-crest.png — one dark-gold ink on a white ground). The bar's
 * mark is the gold crest the handoff ships, public/brand/temple-stuart-crest-gold.png — that file with its white
 * knocked out and its ink gold. This bar was the older file's one reader; it stays in public/brand, read by nothing.
 * Every note below is history: it says how the cream bar stood until this design.
 *
 * LandingHeader (FD-1d) — the Bloomberg header extracted from Landing.tsx so
 * the /modules pages share it verbatim. Token-native, zero hex. REPAINT-2
 * (Direction C): the nav sits on cream with the lavender border-b hairline,
 * aubergine ink; the Create-account CTA wears the MONEY_ACTION gold colors
 * (geometry preserved — the header buttons keep their own padding and carry
 * no rounding).
 *
 * ROUTE-1 (Alex's ruling b): the top-right CTA is now "Log in" — the hero
 * already carries "Create free account", so the header stops duplicating the
 * register ask and serves returning users. Two honest modes:
 *   • onRequireLogin provided (the Landing; GuestLanding passes the LoginBox
 *     opener in LOGIN mode) → a button calling it;
 *   • absent (the /modules pages, which have no login modal) → a LINK to
 *     '/' — PR-PRICE-3: /pricing (the old ask surface) is a redirect now, so
 *     the front door is the real one: its header renders THIS component in
 *     button mode (working Log in modal) and its hero carries the register
 *     ask.
 *
 * LANDING-V3 (spec :34-47) → THREE-TRIMS: the nav anatomy, minus the retired anchor links (Live demo → /#demo and
 * Modules → /#modules died — the #modules id now marks THE OFFER act, SELL-02, the target of the checkout cancel_url
 * and the /?module= doors). Outlined TS mark (:37) — HOME-BRIEF-02 (Alex, 2026-11-10): his crest took that square
 * (public/brand/temple-stuart-crest.png — the file he attached, cropped to the crest, nothing redrawn), a plain <img>
 * as BuiltOnStrip.tsx draws one. HOME-BRIEF-04 (Alex, 2026-11-10 19:00): the box is larger, rounded and white, the
 * crest centred in it by object-contain inside even padding (multiply went with the cream ground), the box never
 * squeezed by the row (shrink-0 — without it a phone drew it 30px wide), and the wordmark is larger from sm;
 * HOME-BRIEF-05 (Alex, 2026-11-10 20:53: "meet the top and bottom at a min … truly centered on left right spacing"):
 * the box's padding went, so the crest runs from the border's inner top edge to its inner bottom edge, never stretched
 * (object-contain) and centred left to right — the file is cropped to the crest on all four sides; the corner is
 * rounded-md; the name is bold and larger from sm; the row's and the link's gaps are narrower below sm, so a 360px
 * phone no longer scrolls sideways ("even padding" and "rounded" above are HOME-BRIEF-04's, until then). Pricing keeps
 * /how-pricing-works; GitHub ↗ = the repo link; Log in = the spec's text link, SAME dual-mode handlers; CREATE FREE
 * ACCOUNT = the spec's mono uppercase gold button, SAME dual-mode handlers. V3 FLAGS: Contact dropped — the mailto
 * survives in the footer. (This note stood inside the component, over its <header>, until HERO-CREST-01.)
 */

import { Fragment, useEffect, useState } from 'react';
import Link from 'next/link';
import { DEMO_ANCHOR, EVENTS_ANCHOR, MY_TRIP_ANCHOR } from '@/lib/homeAnchors';
import { ABOUT_US_HEADING, BUILD_PILLAR, EXPLORE_PILLAR, OUR_STORY_HEADING, PLAN_PILLAR } from '@/lib/homeActWords';
import { ABOUT_PATH, FINANCIAL_SOFTWARE_PATH } from '@/lib/homePages';
import { PIPELINE_PATH } from '@/components/landing/pipelineWords';
import { SERVICES, proposalFormHref } from '@/lib/proposalNeeds';
import { BAR_MARK_SRC, BAR_WORDMARK } from '@/lib/brandLockup';

/** Pricing keeps its page — /how-pricing-works (the reachability law's GUEST_ROUTES cites this line as that page's door). HOME-MENU-01 (2026-11-16): it stands above BAR_MENU, whose About Us column draws it, so the list can read it when the module loads — at :90 until then, under the three links. */
export const BAR_PRICING = { label: 'Pricing', href: '/how-pricing-works' } as const;

/**
 * THE COPIES. HOME-MENU-01 (Alex: the boards, 2026-11-14 20:01 and, corrected, 20:41 Manila; the destinations, 2026-11-16 00:52 Manila; built 2026-11-16), ruling f: "A WORD WHOSE HOME IS HEAVY IS COPIED ONCE, AND HELD. The bar is a client component on every page that mounts it. src/lib/offer/plans.ts, src/lib/howTo.ts and src/lib/footerWords.ts pull in the tool registry, the offer and the trip rows: read from them, the menu's words would add about 126 KB minified, 35 KB gzipped, to each of those pages, where the light homes weigh about 6 KB in all (esbuild 0.25.12, measured 2026-11-16). travelStripModes.tsx pulls in the five search forms, and the booking-flow freeze pins it. So the four plans' names and audiences, the compare link's words and path, the record's two labels with CODE_URL, and the six travel labels are typed once more, in LandingHeader.tsx. homeMenu01 holds each copy equal to its home, through the home's export where it has one, and the travel labels by their keys in the strip's code."
 * So these are typed once more here, and src/lib/__tests__/homeMenu01.test.ts holds each equal to its home: the four plans' names
 * and audiences to PLANS (src/lib/offer/plans.ts), the compare link to COMPARE_PLANS_WORDS and COMPARE_PLANS_PATH (src/lib/howTo.ts),
 * the record's two labels to FOOTER_RECORD_LINKS and the code's URL to CODE_URL (src/lib/footerWords.ts), and the six travel labels
 * by their keys (events, flights, hotels, transit, activities, visa) in the code of src/components/trips/travelStripModes.tsx.
 */
const BAR_PLANS = [
  { label: 'Personal', audience: 'For students, creators and nomads.' },
  { label: 'Personal + Business', audience: 'For founders, freelancers and small business owners.' },
  { label: 'Personal + Trading', audience: 'For traders running their own money.' },
  { label: 'Personal + Business + Trading', audience: 'For founder-traders.' },
] as const;
const BAR_COMPARE = { label: 'Compare all four plans →', href: '/pricing' } as const;
const BAR_EVENTS = 'Events';
const BAR_TRAVEL_TABS = ['Flights', 'Hotels', 'Getting around', 'Things to do', 'Visa'] as const;
const BAR_STEPS = 'How It All Connects: The 14 Steps';
/**
 * The code, which leaves the site. HOME-MENU-01 (Alex: the boards, 2026-11-14 20:01 and, corrected, 20:41 Manila; the destinations, 2026-11-16 00:52 Manila; built 2026-11-16), ruling h: "HIS NEWER CHOICE SUPERSEDES TWO OLDER RULINGS. GUEST-01's door ruling (Alex, 17:04, as the law quotes it) is re-said as ruling g says. HERO-CREST-01's "remove github, the icon is enough, we dont need it 2x" took the bar's own GitHub link; now the About Us column draws the footer's code link again, in a new tab. Both quotes stay where they stand, and each place that holds them is re-said beside them, dated."
 * The bar's own link to the code was "GitHub ↗" until HERO-CREST-01 (2026-11-11) took it out, by his words the note above quotes; from then until HOME-MENU-01 (2026-11-16) the bar linked no code.
 */
const BAR_CODE = { label: 'Built in Public: The Code', href: 'https://github.com/Temple-Stuart/temple-stuart-accounting' } as const;
/**
 * THE ONE NEW WORD. HOME-MENU-01 (Alex: the boards, 2026-11-14 20:01 and, corrected, 20:41 Manila; the destinations, 2026-11-16 00:52 Manila; built 2026-11-16), ruling g: "ONE WORD IS NEW: "Look up your booking →", the travel column's foot link, to /booking/manage. The words and the path are typed once, in LandingHeader.tsx. The guest law's check that LandingHeader.tsx never links /booking/manage (scripts/assert-tool-registry.ts:10382) is re-said in place to hold exactly this one link. The lookup box stays the door, mounted where it is. The guest proof's seed guest01-z4 plants a second link, and guest01:334 is re-said to match."
 * scripts/assert-tool-registry.ts's guest law holds it, with its path, as LandingHeader.tsx's one link to /booking/manage.
 */
const BAR_LOOKUP = { label: 'Look up your booking →', href: '/booking/manage' } as const;

/** The four columns' keys, in the reference's order: each names its list's id under 1024px (BAR_MENU_ID, then the key). */
export type BarMenuKey = 'fs' | 'ps' | 'tm' | 'about';
/** A destination: its words and where it goes; and a plan's audience, a service's kind, or the code's new tab. */
type BarLink = { label: string; href: string; audience?: string; kind?: string | null; newTab?: true };
/** A column: its key, its name, its links, and its foot link or none. */
type BarColumn = { key: BarMenuKey; name: string; links: readonly BarLink[]; more: { label: string; href: string } | null };

/**
 * HOME-MENU-01 (2026-11-16) — THE MENU: ONE LIST, DRAWN TWICE — the panel's four columns from 1024px, the phone menu's four lists under it — so the
 * two cannot drift. Until then this place held BAR_PRODUCT_LINKS (HERO-CREST-01: the bar's three product links, each its pillar's
 * heading on its pillar's section by that section's own anchor, drawn as the bar's row and as the phone menu's rows). HOME-MENU-01 (Alex: the boards, 2026-11-14 20:01 and, corrected, 20:41 Manila; the destinations, 2026-11-16 00:52 Manila; built 2026-11-16),
 * ruling d: "THE FOUR COLUMNS ARE ONE EXPORTED LIST, BAR_MENU, where BAR_PRODUCT_LINKS stands, in the reference's order. Each column holds its key, its name, its links and its foot link or none. A link holds its words and its destination, and also a plan's audience, a service's kind, or the code's new tab. The panel draws the list as four columns and the phone menu as four lists. A destination on the site is a next/link Link, as the bar's are now; the code's is a plain anchor with target _blank and rel noopener noreferrer, as the footer's is. BAR_PRODUCT_LINKS goes with its last reader. BAR_PRICING stays in LandingHeader.tsx and the About Us column draws it; if its line moves, the law's GUEST_ROUTES row re-cites it, newest first, as FOOTER-02 re-cited it."
 * Ruling e: "A WORD WHOSE HOME IS LIGHT IS READ THERE: the four names and Our Story from src/lib/homeActWords.ts; EVENTS_ANCHOR, DEMO_ANCHOR and MY_TRIP_ANCHOR from src/lib/homeAnchors.ts; FINANCIAL_SOFTWARE_PATH and ABOUT_PATH from src/lib/homePages.ts; PIPELINE_PATH from src/components/landing/pipelineWords.ts; the six services, their kinds and proposalFormHref from src/lib/proposalNeeds.ts."
 * Each destination is his choice, the README's table "Where each item goes" — his answer to it, 2026-11-16 00:52 Manila:
 * "Yes, use these (Recommended)"
 */
export const BAR_MENU: readonly BarColumn[] = [
  { key: 'fs', name: PLAN_PILLAR.heading, links: BAR_PLANS.map((plan) => ({ label: plan.label, href: FINANCIAL_SOFTWARE_PATH, audience: plan.audience })), more: BAR_COMPARE },
  { key: 'ps', name: BUILD_PILLAR.heading, links: SERVICES.map((service) => ({ label: service.title, href: proposalFormHref(service.need), kind: service.kind })), more: null },
  { key: 'tm', name: EXPLORE_PILLAR.heading, links: [{ label: BAR_EVENTS, href: `/#${EVENTS_ANCHOR}` }, ...BAR_TRAVEL_TABS.map((label) => ({ label, href: `/#${DEMO_ANCHOR}` }))], more: BAR_LOOKUP },
  {
    key: 'about',
    name: ABOUT_US_HEADING,
    links: [
      { label: ABOUT_US_HEADING, href: ABOUT_PATH },
      { label: OUR_STORY_HEADING, href: `/#${MY_TRIP_ANCHOR}` },
      { label: BAR_STEPS, href: PIPELINE_PATH },
      { label: BAR_PRICING.label, href: BAR_PRICING.href },
      { label: BAR_CODE.label, href: BAR_CODE.href, newTab: true },
    ],
    more: null,
  },
];

/** FOOTER-02 (2026-11-12): the mark and the wordmark live in src/lib/brandLockup.ts — the footer's lockup reads them there, since this file is 'use client'. The mark is re-exported here for this file's readers. */
export { BAR_MARK_SRC };

/**
 * The phone menu's id — what the menu button's aria-controls names. ONE FIXED ID, as the reference types its own
 * ("menu-hero"): a page mounts one top bar, never two. Not React's useId: tried first, and on the landing the server and
 * the browser disagreed about the generated id on some dev loads and not others (14 and 11 of 21 in two logged runs; 5 of 21 in the first, not logged — React's hydration warning named
 * aria-controls and id; the fixed id gave none in 21), so the pair is typed. HOME-MENU-01 (2026-11-16): five more fixed ids, for the same reason — the panel's (BAR_MEGA_ID, ruling a) and the four lists' (this id, then each column's key: ts-bar-menu-fs, -ps, -tm and -about, ruling b).
 */
export const BAR_MENU_ID = 'ts-bar-menu';
/** HOME-MENU-01 (2026-11-16): the panel's one fixed id — what the four names' aria-controls name (ruling a). */
export const BAR_MEGA_ID = 'ts-bar-mega';

/** The reference's caret, after each of the four names: in the bar's row and in the phone menu's rows. */
function Caret() {
  return <svg className="ts-bar__caret" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 6l4 4 4-4" /></svg>;
}

/** The bar's two props, shared by the stateful bar and its view. */
type LandingHeaderProps = {
  /** ROUTE-1: the login modal's opener, where the page has one. Absent → Log in is a link to '/'. */
  onRequireLogin?: () => void;
  /** HERO-CREST-01: the landing lays the bar over its hero as glass. Every other mount leaves it out and gets the pill filled, in the page's flow. */
  glass?: boolean;
};

/**
 * THE VIEW — the bar drawn from its state, pure, so that each open state renders on the server for the tests. The default export below
 * holds the state and draws this. HOME-MENU-01 (Alex: the boards, 2026-11-14 20:01 and, corrected, 20:41 Manila; the destinations, 2026-11-16 00:52 Manila; built 2026-11-16), ruling a: "FOUR NAMES OPEN ONE PANEL. From 1024px the three pillar names and About Us, which stands first in the account group, are buttons of type button. Each carries the reference's caret, aria-expanded, and aria-controls naming the panel, ts-bar-mega. Any of the four opens it; a second press of the same name closes it, and a press of another leaves it open. All four say the panel's state. It closes on a press of any link in it, on Escape, and on a press outside it and the four names. Escape sends focus back to the name that opened it when focus was inside. Under 1024px the panel is never drawn."
 * Ruling b: "ON A PHONE THE NAMES ARE ROWS THAT OPEN LISTS. Under 1024px the menu, BAR_MENU_ID as today, opens on the same four names as rows, before the rule, Pricing and Log in. Each row is a button with its caret, aria-expanded, and aria-controls naming its list: ts-bar-menu-fs, -ps, -tm and -about. A row opens its list and closes the one open, and an open row closes its own; all start closed. One list at a time keeps the open menu inside the hero, which clips what overflows it. The menu still closes on a link, on Log in, on Escape and on its button, and Escape sends focus back to the button when focus was inside. While it is open the button draws the board's cross, and its two bars while closed."
 * The design is design-refs/home-menu-01/Menu-Reference.html's two bars, element for element; their classes behind the house prefix,
 * their ids the fixed ones above, the mark the lockup's.
 */
export function LandingHeaderView({ onRequireLogin, glass = false, menuOpen, setMenuOpen, panelFrom, setPanelFrom, openList, setOpenList }: LandingHeaderProps & {
  menuOpen: boolean;
  setMenuOpen: (next: boolean | ((open: boolean) => boolean)) => void;
  panelFrom: BarMenuKey | null;
  setPanelFrom: (next: BarMenuKey | null | ((from: BarMenuKey | null) => BarMenuKey | null)) => void;
  openList: BarMenuKey | null;
  setOpenList: (next: BarMenuKey | null | ((open: BarMenuKey | null) => BarMenuKey | null)) => void;
}) {
  // a name: the panel opens on it; the name pressed last closes it (a press of another leaves it open, and makes that one the opener)
  const name = (column: BarColumn) => (
    <button className="ts-bar__trigger" type="button" aria-expanded={panelFrom !== null} aria-controls={BAR_MEGA_ID} onClick={() => setPanelFrom((from) => (from === column.key ? null : column.key))}><span>{column.name}</span><Caret /></button>
  );
  return (
    <header className={glass ? 'ts-bar ts-bar--overlay' : 'ts-bar ts-bar--solid'}>
      <div className="ts-bar__pill">
        <Link className="ts-brand" href="/">
          <img className="ts-brand__mark" src={BAR_MARK_SRC} alt="" />{/* eslint-disable-line @next/next/no-img-element */}
          <span className="ts-brand__name">{BAR_WORDMARK}</span>
        </Link>
        <nav className="ts-bar__products" aria-label="Products">
          {BAR_MENU.slice(0, 3).map((column, i) => (
            <Fragment key={column.key}>
              {i > 0 && <span className="ts-bar__rule" aria-hidden="true" />}
              {name(column)}
            </Fragment>
          ))}
        </nav>
        <nav className="ts-bar__account" aria-label="Account">
          {name(BAR_MENU[3])}
          <Link className="ts-bar__link" href={BAR_PRICING.href}>{BAR_PRICING.label}</Link>
          {onRequireLogin ? (
            <button type="button" onClick={onRequireLogin} className="ts-pill-gold ts-bar__login">Log in</button>
          ) : (
            <Link href="/" className="ts-pill-gold ts-bar__login">Log in</Link>
          )}
        </nav>
        <button
          type="button"
          className="ts-bar__menu-button"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-controls={BAR_MENU_ID}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {/* closed, its two bars; open, the cross the 390 board draws (ruling b) */}
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d={menuOpen ? 'M5.5 5.5l11 11M16.5 5.5l-11 11' : 'M3 8h16M3 14h16'} /></svg>
        </button>
      </div>
      {/* THE PANEL (HOME-MENU-01, 2026-11-16): from 1024px, under the pill, the four columns; always in the markup, hidden while closed. A press on any
          link in it closes it. Under 1024px the stylesheet never draws it. */}
      <div className="ts-mega" id={BAR_MEGA_ID} hidden={panelFrom === null} onClick={(e) => { if ((e.target as HTMLElement).closest('a')) setPanelFrom(null); }}>
        <div className="ts-mega__panel">
          {BAR_MENU.map((column) => (
            <div key={column.key} className="ts-mega__col">
              <div className="ts-mega__label">{column.name}</div>
              {column.links.map((link) => (
                link.newTab ? (
                  <a key={link.href} className="ts-mega__link" href={link.href} target="_blank" rel="noopener noreferrer"><span>{link.label}<svg className="ts-mega__out" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4.5 11.5l7-7M5.5 4.5h6v6" /></svg></span></a>
                ) : link.kind ? (
                  <Link key={link.label} className="ts-mega__link ts-mega__link--row" href={link.href}><span>{link.label}</span><span className="ts-mega__kind">{link.kind}</span></Link>
                ) : link.audience ? (
                  <Link key={link.label} className="ts-mega__link" href={link.href}><span>{link.label}</span><span className="ts-mega__sub">{link.audience}</span></Link>
                ) : (
                  <Link key={link.label} className="ts-mega__link" href={link.href}><span>{link.label}</span></Link>
                )
              ))}
              {column.more && <Link className="ts-mega__more" href={column.more.href}>{column.more.label}</Link>}
            </div>
          ))}
        </div>
      </div>
      {/* THE OPEN MENU — under 1024px, a dark glass panel under the bar: the four names as rows, each opening its own list under it, then a
          rule, Pricing and a full-width Log in (HOME-MENU-01, 2026-11-16: the menu's 390 board, approved with the home page's boards, draws
          it open with one list — "the README's first proposal (the 390 artboard draws the bar closed): a dark glass panel under the bar with
          the three links, a rule, Pricing and a full-width Log in" until then). A press on any link in it closes it. */}
      <nav
        className="ts-menu"
        id={BAR_MENU_ID}
        aria-label="Menu"
        hidden={!menuOpen}
        onClick={(e) => { if ((e.target as HTMLElement).closest('a')) setMenuOpen(false); }}
      >
        {BAR_MENU.map((column) => (
          <Fragment key={column.key}>
            <button className="ts-menu__row ts-menu__row--group" type="button" aria-expanded={openList === column.key} aria-controls={`${BAR_MENU_ID}-${column.key}`} onClick={() => setOpenList((open) => (open === column.key ? null : column.key))}><span>{column.name}</span><Caret /></button>
            <div className="ts-menu__sub" id={`${BAR_MENU_ID}-${column.key}`} hidden={openList !== column.key}>
              {column.links.map((link) => (
                link.newTab ? (
                  <a key={link.href} className="ts-menu__subrow" href={link.href} target="_blank" rel="noopener noreferrer">{link.label}<svg className="ts-menu__out" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4.5 11.5l7-7M5.5 4.5h6v6" /></svg></a>
                ) : (
                  <Link key={link.label} className="ts-menu__subrow" href={link.href}>{link.label}</Link>
                )
              ))}
              {column.more && <Link className="ts-menu__subrow ts-menu__subrow--more" href={column.more.href}>{column.more.label}</Link>}
            </div>
          </Fragment>
        ))}
        <span className="ts-menu__rule" aria-hidden="true" />
        <Link className="ts-menu__row" href={BAR_PRICING.href}>{BAR_PRICING.label}</Link>
        {onRequireLogin ? (
          <button type="button" onClick={() => { setMenuOpen(false); onRequireLogin(); }} className="ts-pill-gold ts-menu__login">Log in</button>
        ) : (
          <Link href="/" className="ts-pill-gold ts-menu__login">Log in</Link>
        )}
      </nav>
    </header>
  );
}

/**
 * THE BAR — its state, and the view drawn with it. HOME-MENU-01 (Alex: the boards, 2026-11-14 20:01 and, corrected, 20:41 Manila; the destinations, 2026-11-16 00:52 Manila; built 2026-11-16), ruling c: "THE MENU'S STATE LIVES IN REACT ALONE: the phone menu's, as today; the panel's, which name opened it or none; the lists', which one is open or none. It is kept in no storage and in no URL. The panel and the four lists are always in the markup, hidden while closed, as the menu is today. For the tests, the stateful bar draws a pure view of itself with its state, so each open state renders on the server; the audit names that view's shape, the smallest by the pins it moves."
 * Ruling j: "NOTES THE MENU MAKES FALSE ARE RE-SAID WHERE THEY STAND, dated. That covers every sentence that says the bar's names land on sections, that the bar reads MODULES_ANCHOR or SERVICES_ANCHOR, that the phone menu repeats the bar's links, or that the bar links neither GitHub nor /booking/manage. MODULES_ANCHOR stays, with no reader under src; heroCrest01 T10 still holds it equal to the how-to's id. Apart from BAR_PRICING's (ruling d), a line that a test or a law cites by its number stays on that number, and Landing.tsx keeps its 815 lines."
 * Ruling m: "NOTHING BUT THE BAR CHANGES ON ANY PAGE: not the hero, the home page's sections, the footer, the pages the menu opens, or the lookup box. Their files change only where ruling j re-says a note."
 * The phone menu's state is today's, `menuOpen`; the panel's is the name that opened it, `panelFrom`; the lists' is the one open,
 * `openList`. One effect, while either is open: Escape closes both — focus goes back to the name that opened the panel, or to the menu
 * button, when it was inside — and a press outside the panel and the four names closes the panel. Closing the menu leaves its open list
 * as it was, as the reference's own script does.
 */
export default function LandingHeader(props: LandingHeaderProps) {
  // The menu under 1024px: open or closed, in React state only (HOME-MENU-01, 2026-11-16: and the panel's opener and the open list beside it).
  const [menuOpen, setMenuOpen] = useState(false);
  const [panelFrom, setPanelFrom] = useState<BarMenuKey | null>(null);
  const [openList, setOpenList] = useState<BarMenuKey | null>(null);
  useEffect(() => {
    if (!menuOpen && panelFrom === null) return;
    const closeOnEscape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const focused = document.activeElement;
      if (panelFrom !== null) {
        const back = focused !== null && focused.closest(`#${BAR_MEGA_ID}`) !== null;
        setPanelFrom(null);
        if (back) document.querySelectorAll<HTMLButtonElement>(`button[aria-controls="${BAR_MEGA_ID}"]`)[BAR_MENU.findIndex((column) => column.key === panelFrom)].focus();
      }
      if (menuOpen) {
        const back = focused !== null && focused.closest(`#${BAR_MENU_ID}`) !== null;
        setMenuOpen(false);
        if (back) document.querySelector<HTMLButtonElement>(`button[aria-controls="${BAR_MENU_ID}"]`)!.focus();
      }
    };
    const closeOnPressOutside = (e: MouseEvent) => {
      if (panelFrom === null) return;
      const target = e.target as Element;
      if (target.closest(`#${BAR_MEGA_ID}`) === null && target.closest(`button[aria-controls="${BAR_MEGA_ID}"]`) === null) setPanelFrom(null);
    };
    document.addEventListener('keydown', closeOnEscape);
    document.addEventListener('click', closeOnPressOutside);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('click', closeOnPressOutside);
    };
  }, [menuOpen, panelFrom]);

  return <LandingHeaderView {...props} menuOpen={menuOpen} setMenuOpen={setMenuOpen} panelFrom={panelFrom} setPanelFrom={setPanelFrom} openList={openList} setOpenList={setOpenList} />;
}
