/**
 * HOME-PAGES-01 (Alex's brief, 2026-11-14 19:11 Manila, with his four beta users' notes on the home page — two of them, as he
 * pasted them: "Cut the scrolling length of the landing page in half. Make the user explore to find the information behind info
 * pages" · "It's a lot on one page though. Any way you can split it out"; his approval of the boards on the design canvas,
 * 2026-11-14 20:01 Manila: "ALL LOOKS GOOD … OTHERWISE, LETS DO IT") — THREE SECTIONS GET PAGES OF THEIR OWN: THEIR PATHS AND
 * THEIR TITLES.
 *
 * The home page is getting shorter in a series of small PRs. This is the first, and it changes nothing on the home page: three
 * of its sections get a second home, so a later PR can trim the home page without losing a word.
 *   · /financial-software    — the Financial Software section, whole (src/components/landing/HowToSection.tsx);
 *   · /professional-services — the Professional Services section, whole (src/components/landing/ServicesSection.tsx);
 *   · /about                 — About Us (src/components/landing/StopZeroSection.tsx) and, under it, Our Story
 *                              (src/components/landing/WasHereSection.tsx).
 * Each page (src/app/<path>/page.tsx) is /how-it-works's shell around the section's own component, and each one's door is the
 * footer's (src/lib/footerWords.ts reads the three paths here): Financial Software, Professional Services, and
 * Stop 0 | Los Angeles.
 *
 * THE RULINGS BUILT HERE (Alex's brief, 2026-11-14):
 *   c. "WORDS. Nothing is typed in a page. Three titles are new and need a leaf: each is the section's heading, then
 *      " | Temple Stuart", as PIPELINE_PAGE_TITLE ends. Descriptions are words that exist: PLANS_SUBHEAD,
 *      BUILD_PILLAR.paragraphs[0], and for /about the first quote of STOP_ZERO_STORY as its leaf writes it." — the three titles
 *      below, each its section's heading (src/lib/homeActWords.ts) and the ending. No description lives here: each page imports
 *      its own from the leaf that holds it (src/lib/offer/plans.ts, src/lib/homeActWords.ts, src/lib/stopZeroWords.ts), so the
 *      footer, which reads the paths here on every page it is on, does not bring the plans leaf with it.
 *   g. "NO TRAVEL PAGE. /travel is the cockpit's (src/app/[tab]/page.tsx TAB_PATHS). The booking box and the lookup stay
 *      mounted where the guest law holds them." — three paths, and no fourth: the footer's Travel Marketplace keeps /#demo.
 *   h. "THE HOME PAGE DOES NOT CHANGE. Landing.tsx keeps every mount where it is, once each. The only thing a visitor to / can
 *      notice is three footer links' targets." — Landing.tsx reads nothing of this leaf.
 * (a is built in src/app/globals.css and on the /financial-software page; b on the three pages; d in HowToSection.tsx; e on the
 * /about page and in the build's trip log law; f in src/middleware.ts and the law's GUEST_ROUTES.)
 *
 * PURE, NO DIRECTIVE: one import, the headings' leaf, which imports nothing. The three pages are server components and the
 * footer is one on six pages; an export of a 'use client' module reaches a server component as a client reference, never as
 * its string, so a title or a path could not be read from a section's own file.
 */
import { ABOUT_US_HEADING, BUILD_PILLAR, PLAN_PILLAR } from './homeActWords';

/** The Financial Software section's own page. */
export const FINANCIAL_SOFTWARE_PATH = '/financial-software';

/** The Professional Services section's own page. */
export const PROFESSIONAL_SERVICES_PATH = '/professional-services';

/** About Us, and Our Story under it. */
export const ABOUT_PATH = '/about';

/** How a page's title ends — as PIPELINE_PAGE_TITLE ends (src/components/landing/pipelineWords.ts). */
const TITLE_END = ' | Temple Stuart';

export const FINANCIAL_SOFTWARE_TITLE = `${PLAN_PILLAR.heading}${TITLE_END}`;

export const PROFESSIONAL_SERVICES_TITLE = `${BUILD_PILLAR.heading}${TITLE_END}`;

export const ABOUT_TITLE = `${ABOUT_US_HEADING}${TITLE_END}`;
