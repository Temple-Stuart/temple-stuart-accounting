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
 */
import { DEMO_ANCHOR, EVENTS_ANCHOR, MY_TRIP_ANCHOR, STOP_ZERO_ANCHOR } from './homeAnchors';
import { tripPostHref } from './tripPostWords';
import type { TripPost } from './tripPosts';
import { PIPELINE_DOOR, PIPELINE_PATH } from '@/components/landing/pipelineWords';

/** One footer link. `external` marks the one that leaves the site — it opens in a new tab. */
export type FooterLink = { readonly label: string; readonly href: string; readonly external?: true };

export const FOOTER_BLOG_LABEL = 'THE BLOG';

export const FOOTER_RECORD_LABEL = 'THE RECORD';

/** THE BLOG: the four sections in the page's order, then one link per post, in the order given (TRIP_POSTS'). */
export function footerBlogLinks(posts: ReadonlyArray<Pick<TripPost, 'stopId' | 'title'>>): FooterLink[] {
  return [
    { label: 'Book travel', href: `/#${DEMO_ANCHOR}` },
    { label: 'Events', href: `/#${EVENTS_ANCHOR}` },
    { label: 'Stop 0', href: `/#${STOP_ZERO_ANCHOR}` },
    { label: 'My trip', href: `/#${MY_TRIP_ANCHOR}` },
    ...posts.map((post) => ({ label: post.title, href: tripPostHref(post.stopId) })),
  ];
}

/** The code, built in public — the same URL LandingHeader.tsx's GitHub ↗ opens (src/lib/__tests__/footer01.test.ts holds them equal). */
export const CODE_URL = 'https://github.com/Temple-Stuart/temple-stuart-accounting';

/** THE RECORD: the 14 steps, then the code. */
export const FOOTER_RECORD_LINKS: readonly FooterLink[] = [
  { label: PIPELINE_DOOR, href: PIPELINE_PATH },
  { label: 'Built in public: the code ↗', href: CODE_URL, external: true },
];
