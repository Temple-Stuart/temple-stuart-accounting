/**
 * FOOTER-01 (Alex, 2026-11-08 15:11 + 16:18; board K tag 17) — THE FOOTER'S TWO COLUMNS: THEIR WORDS AND THEIR LINKS.
 *
 * Above the disclaimer, two columns join the footer (src/components/landing/LandingFooter.tsx):
 *   · THE BLOG   — the home page's four sections, then every written trip post, one link each. DERIVED: the
 *                  sections' anchors from src/lib/homeAnchors.ts, the posts from the list the footer passes in
 *                  (TRIP_POSTS, src/lib/tripPosts.ts) in its order, each post's page from tripPostHref — so a new post
 *                  adds its own link and nothing here changes.
 *   · THE RECORD — the 14 steps (the door's own words and path, PIPELINE_DOOR and PIPELINE_PATH from
 *                  src/components/landing/pipelineWords.ts — never from PipelineDeck.tsx, a 'use client' file) and
 *                  the code, built in public (an external link).
 * Every href starts with '/' (or is the full repo URL), so it lands from every page the footer is on: /, /pricing,
 * /how-it-works, /my-trip/<stop> and the /modules pages.
 * OUT, BY RULING: no "how this site earns" (Alex: "maybe TMI"); no corrections link (not built); no guide sections
 * yet (they join when built).
 *
 * PURE, NO DIRECTIVE: the footer is a server component on three pages and a client one on two (Landing.tsx and
 * ModulePageClient.tsx are 'use client'), so its words must be plain values both sides can read.
 *
 * HOME-FINISH-02 (Alex's brief, 2026-11-10 20:56, with his footer note of 20:53): FOUR COLUMNS, and THE BLOG is gone.
 *   · OUR STORY  — "Stop 0 | Los Angeles" (→ the home page's Stop 0, by its anchor), then one link per stop in the trip
 *                  log, in trip order: "Stop <n> | <the row's city>" → that stop's page. DERIVED from the list the
 *                  footer passes in (WAS_HERE, src/lib/wasHere.ts — never TRIP_POSTS: every stop has a page, written
 *                  up or not; src/app/my-trip/[id]/page.tsx builds one per row): the order from tripOrder and the
 *                  number's words from stopWords (src/lib/wasHereWords.ts), the page from tripPostHref. The city is the
 *                  log's own, never shortened or retyped; a stop added to the log adds itself.
 *   · SERVICES   — the three pillars under "What We Do" (their headings in src/lib/homeActWords.ts, without the full
 *                  stop), each landing on its section: /#modules, /#services, /#demo.
 *   · SOCIALS    — the five accounts: name and href. They were typed in the footer's bar, icon-only, until now; the
 *                  hrefs are unchanged. The component draws each icon beside its name.
 *   · THE RECORD — the 14 steps, the code, the licence — as Alex typed the labels, no arrows. The licence is the
 *                  Business Source License 1.1: it is never called open source.
 * LEFT WITH THEIR LAST READER: FOOTER_BLOG_LABEL ('THE BLOG') and footerBlogLinks — Book travel (/#demo), Events
 * (/#events), Stop 0 and My trip (/#my-trip), then every written post's title. The home page's own handling of a link
 * to /#events (LandingBookingSection.tsx) stands untouched. PIPELINE_DOOR ("How it all connects: the 14 steps →",
 * pipelineWords.ts) is read here no more: THE RECORD's first label is typed below, as Alex typed it.
 *
 * PILLAR-NAMES-01 (Alex, 2026-11-11: "Financial Software | Professional Services | Travel Marketplace — these will
 * replace Plan your Escape / Build your Income / Explore the World"): SERVICES' three links take the pillars' new
 * names — "Plan Your Escape", "Build Your Income" and "Explore the World" until then. The headings dropped their full
 * stop with the same ruling, so each label IS its pillar's heading now, letter for letter (src/lib/homeActWords.ts;
 * src/lib/__tests__/footer01.test.ts holds the two equal) — "without the full stop", above, is HOME-FINISH-02's note.
 * The three targets are unchanged: /#modules, /#services, /#demo.
 */
import { DEMO_ANCHOR, MODULES_ANCHOR, SERVICES_ANCHOR, STOP_ZERO_ANCHOR } from './homeAnchors';
import { tripPostHref } from './tripPostWords';
import type { WasHereRow } from './wasHere';
import { stopWords, tripOrder } from './wasHereWords';
import { PIPELINE_PATH } from '@/components/landing/pipelineWords';

/** One footer link. `external` marks one that leaves the site — it opens in a new tab. */
export type FooterLink = { readonly label: string; readonly href: string; readonly external?: true };

export const FOOTER_STORY_LABEL = 'OUR STORY';

export const FOOTER_SERVICES_LABEL = 'SERVICES';

export const FOOTER_SOCIALS_LABEL = 'SOCIALS';

export const FOOTER_RECORD_LABEL = 'THE RECORD';

/** OUR STORY's first link: Stop 0, the home page's About Us act (StopZeroSection.tsx), by its anchor. */
export const FOOTER_STOP_ZERO_LABEL = 'Stop 0 | Los Angeles';

/** OUR STORY: Stop 0, then one link per stop in the log given (WAS_HERE's), in trip order — its number, its city, its page. */
export function footerStoryLinks(rows: readonly WasHereRow[]): FooterLink[] {
  return [
    { label: FOOTER_STOP_ZERO_LABEL, href: `/#${STOP_ZERO_ANCHOR}` },
    ...tripOrder(rows).map((row, i) => ({ label: `${stopWords(i + 1)} | ${row.city}`, href: tripPostHref(row.id) })),
  ];
}

/**
 * The how-to's section id — src/components/landing/HowToSection.tsx's <section id="modules". It is that file's literal,
 * guarded there by the plan law (scripts/assert-tool-registry.ts); the checkout's cancel link and the /modules pages
 * land on it too. HERO-CREST-01 (2026-11-11): it was typed here, once and privately (`const PLANS_SECTION_ID = 'modules'`),
 * for the footer's link to the first pillar. The top bar links the same section, so the copy moved to the anchors' one
 * home — MODULES_ANCHOR, src/lib/homeAnchors.ts — and both read it. The footer's links are unchanged.
 */

/** SERVICES: the three pillars, each landing on its section of the home page — absolute, so they land from every page the footer is on. */
export const FOOTER_SERVICES_LINKS: readonly FooterLink[] = [
  { label: 'Financial Software', href: `/#${MODULES_ANCHOR}` },
  { label: 'Professional Services', href: `/#${SERVICES_ANCHOR}` },
  { label: 'Travel Marketplace', href: `/#${DEMO_ANCHOR}` },
];

/** A social account's name — the component keys its icon by it. */
export type SocialName = 'Instagram' | 'TikTok' | 'YouTube' | 'X' | 'LinkedIn';

/** SOCIALS: the five accounts, in the order the bar held them. Every one leaves the site, in a new tab. */
export const FOOTER_SOCIALS: ReadonlyArray<{ readonly name: SocialName; readonly href: string }> = [
  { name: 'Instagram', href: 'https://www.instagram.com/temple_stuart_accounting/' },
  { name: 'TikTok', href: 'https://www.tiktok.com/@temple_stuart' },
  { name: 'YouTube', href: 'https://www.youtube.com/@Temple-Stuart' },
  { name: 'X', href: 'https://x.com/Alex_Stuart_APS' },
  { name: 'LinkedIn', href: 'https://www.linkedin.com/in/alexander-stuart-phi/' },
];

/** The code, built in public — the same URL the hero's "Clone it on GitHub" opens (Landing.tsx; src/lib/__tests__/footer01.test.ts holds them equal). HERO-CREST-01 (2026-11-11): LandingHeader.tsx's GitHub ↗ until then — it left the top bar. */
export const CODE_URL = 'https://github.com/Temple-Stuart/temple-stuart-accounting';

/** The licence file on the default branch — the Business Source License 1.1. Never called open source. */
export const LICENSE_URL = `${CODE_URL}/blob/main/LICENSE`;

/** THE RECORD: the 14 steps, the code, the licence — the last two leave the site. */
export const FOOTER_RECORD_LINKS: readonly FooterLink[] = [
  { label: 'How It All Connects: The 14 Steps', href: PIPELINE_PATH },
  { label: 'Built in Public: The Code', href: CODE_URL, external: true },
  { label: 'Software License', href: LICENSE_URL, external: true },
];
