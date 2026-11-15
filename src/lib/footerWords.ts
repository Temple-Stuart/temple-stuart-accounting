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
 * /how-it-works, /my-trip/<stop> and the /modules pages (and, since HOME-PAGES-01, 2026-11-14, the three below).
 * OUT, BY RULING: no "how this site earns" (Alex: "maybe TMI"); no corrections link (not built); no guide sections
 * yet (they join when built).
 *
 * PURE, NO DIRECTIVE: the footer is a server component on three pages and a client one on two (Landing.tsx and
 * ModulePageClient.tsx are 'use client'), so its words must be plain values both sides can read. (HOME-PAGES-01, 2026-11-14:
 * a server component on six pages now — the three, and the three new ones.)
 *
 * HOME-FINISH-02 (Alex's brief, 2026-11-10 20:56, with his footer note of 20:53): FOUR COLUMNS, and THE BLOG is gone.
 *   · OUR STORY  — "Stop 0 | Los Angeles" (→ the home page's Stop 0, by its anchor — until HOME-PAGES-01, below), then one link per stop in the trip
 *                  log, in trip order: "Stop <n> | <the row's city>" → that stop's page. DERIVED from the list the
 *                  footer passes in (WAS_HERE, src/lib/wasHere.ts — never TRIP_POSTS: every stop has a page, written
 *                  up or not; src/app/my-trip/[id]/page.tsx builds one per row): the order from tripOrder and the
 *                  number's words from stopWords (src/lib/wasHereWords.ts), the page from tripPostHref. The city is the
 *                  log's own, never shortened or retyped; a stop added to the log adds itself.
 *   · SERVICES   — the three pillars under "What We Do" (their headings in src/lib/homeActWords.ts, without the full
 *                  stop), each landing on its section: /#modules, /#services, /#demo (the first two until HOME-PAGES-01, below).
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
 *
 * FOOTER-02 (Alex, 2026-11-12: his ask at 22:44 Manila — "… all thats left to touch up is the footer!!!"; the board approved at
 * 23:30): the footer in the hero's violet (design-refs/footer-02). Every word and href here stands as it was, in its order — the
 * design adds no word. One helper joins them: storyLinkParts, which splits a story link's label at its " | " into the stop and the
 * place, so the footer can draw the two apart — and refuses, by name (FooterStoryLabelError), a label with no " | " or with two.
 *
 * HOME-PAGES-01 (Alex's brief, 2026-11-14 19:11 Manila; his answer to the audit, 2026-11-14): THREE DOORS MOVE, AND NOTHING ELSE.
 * Three of the home page's sections have pages of their own (src/lib/homePages.ts holds their paths), and the footer is each one's
 * door. The brief's step 4: "The footer's doors to them: Financial Software → /financial-software, Professional Services →
 * /professional-services, and Stop 0 | Los Angeles → /about#stop-0. Travel Marketplace stays /#demo." His answer changed one of
 * them: "The footer's Stop 0 | Los Angeles goes to /about, with no fragment. This replaces "/about#stop-0" in step 4. The letter is
 * the first thing on that page, so the fragment only scrolled the bar away. No scroll margin is added and the About Us port is not
 * touched." — and — "The href is the leaf's /about path. footerWords.ts builds nothing from STOP_ZERO_ANCHOR for it; if that leaves
 * the import unread there, it goes."
 *   · SERVICES' first two links open the sections' own pages — /#modules and /#services until then. The third stays /#demo, by
 *     ruling g: "NO TRAVEL PAGE. /travel is the cockpit's (src/app/[tab]/page.tsx TAB_PATHS). The booking box and the lookup stay
 *     mounted where the guest law holds them."
 *   · OUR STORY's Stop 0 opens /about, at its top — /#stop-0, the home page's About Us act by its anchor, until then.
 *   · So this leaf reads ONE anchor now, DEMO_ANCHOR. MODULES_ANCHOR, SERVICES_ANCHOR and STOP_ZERO_ANCHOR left its import with
 *     their last use here. The top bar still reads the first two (LandingHeader.tsx: its three links are not this brief's, and
 *     still land on the home page's sections), and every section keeps its id. HOME-MENU-01 (2026-11-16): the bar read the first two until then; its names open its menu now and land on no section, MODULES_ANCHOR has no reader under src but its home, and SERVICES_ANCHOR is its section's alone.
 *   · The labels, their order and every other href stand. Ruling h: "THE HOME PAGE DOES NOT CHANGE. Landing.tsx keeps every mount
 *     where it is, once each. The only thing a visitor to / can notice is three footer links' targets."
 */
import { DEMO_ANCHOR } from './homeAnchors';
import { ABOUT_PATH, FINANCIAL_SOFTWARE_PATH, PROFESSIONAL_SERVICES_PATH } from './homePages';
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

/** OUR STORY's first link: Stop 0 — About Us's own page, /about, at its top (HOME-PAGES-01, 2026-11-14; "the home page's About Us act (StopZeroSection.tsx), by its anchor" until then). */
export const FOOTER_STOP_ZERO_LABEL = 'Stop 0 | Los Angeles';

/** OUR STORY: Stop 0, then one link per stop in the log given (WAS_HERE's), in trip order — its number, its city, its page. */
export function footerStoryLinks(rows: readonly WasHereRow[]): FooterLink[] {
  return [
    { label: FOOTER_STOP_ZERO_LABEL, href: ABOUT_PATH },
    ...tripOrder(rows).map((row, i) => ({ label: `${stopWords(i + 1)} | ${row.city}`, href: tripPostHref(row.id) })),
  ];
}

/** A story link's label without exactly one " | " — refused by name, naming the label. Never a guess, never a fallback. */
export class FooterStoryLabelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FooterStoryLabelError';
  }
}

/** Where a story link's label splits: its stop before, its place after — the " | " footerStoryLinks writes between them. */
const STORY_LABEL_SPLIT = ' | ';

/**
 * FOOTER-02 (Alex's board, approved 2026-11-12 23:30 Manila): OUR STORY draws each link in two parts — its stop, small, in mono
 * capitals, then its place ("STOP 1, then Canggu, Bali"). One label, split at its " | ": the stop, then the place. A label with no
 * " | ", or with two (overlapping ones counted), is refused by name.
 */
export function storyLinkParts(label: string): { stop: string; place: string } {
  const at = label.indexOf(STORY_LABEL_SPLIT);
  if (at < 0 || label.indexOf(STORY_LABEL_SPLIT, at + 1) > -1) {
    throw new FooterStoryLabelError(`storyLinkParts: "${label}" is not its stop, one " | ", then its place`);
  }
  return { stop: label.slice(0, at), place: label.slice(at + STORY_LABEL_SPLIT.length) };
}

/**
 * The how-to's section id — src/components/landing/HowToSection.tsx's <section id="modules". It is that file's literal,
 * guarded there by the plan law (scripts/assert-tool-registry.ts); the checkout's cancel link and the /modules pages
 * land on it too. HERO-CREST-01 (2026-11-11): it was typed here, once and privately (`const PLANS_SECTION_ID = 'modules'`),
 * for the footer's link to the first pillar. The top bar links the same section, so the copy moved to the anchors' one
 * home — MODULES_ANCHOR, src/lib/homeAnchors.ts — and both read it. The footer's links are unchanged.
 * HOME-PAGES-01 (2026-11-14): the footer reads it no more — its first link opens /financial-software; the bar still does (until HOME-MENU-01, 2026-11-16: its names open the menu now, and nothing under src reads MODULES_ANCHOR but its home).
 */

/** SERVICES: the three pillars — the first two open their sections' own pages (HOME-PAGES-01, 2026-11-14; "each landing on its section of the home page" until then), the third lands on its section of the home page. Absolute, so they land from every page the footer is on. */
export const FOOTER_SERVICES_LINKS: readonly FooterLink[] = [
  { label: 'Financial Software', href: FINANCIAL_SOFTWARE_PATH },
  { label: 'Professional Services', href: PROFESSIONAL_SERVICES_PATH },
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

/** The code, built in public — the same URL the hero's "Clone it on GitHub" opens (Landing.tsx; src/lib/__tests__/footer01.test.ts holds them equal). HERO-CREST-01 (2026-11-11): LandingHeader.tsx's GitHub ↗ until then — it left the top bar. HOME-MENU-01 (2026-11-16): the bar's menu opens it again, in a new tab — its About Us column's Built in Public: The Code, from the bar's own copy of this URL, which src/lib/__tests__/homeMenu01.test.ts holds equal to it. */
export const CODE_URL = 'https://github.com/Temple-Stuart/temple-stuart-accounting';

/** The licence file on the default branch — the Business Source License 1.1. Never called open source. */
export const LICENSE_URL = `${CODE_URL}/blob/main/LICENSE`;

/** THE RECORD: the 14 steps, the code, the licence — the last two leave the site. */
export const FOOTER_RECORD_LINKS: readonly FooterLink[] = [
  { label: 'How It All Connects: The 14 Steps', href: PIPELINE_PATH },
  { label: 'Built in Public: The Code', href: CODE_URL, external: true },
  { label: 'Software License', href: LICENSE_URL, external: true },
];
