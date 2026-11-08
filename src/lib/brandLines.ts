/**
 * HOME-LINES-01 (Alex, 2026-11-08 15:36 · 15:40 · 16:18) — TEMPLE STUART'S TWO LINES, ONE HOME.
 *
 * Alex, 15:40 — the two lines, word for word as the HOME-LINES-01 brief relays them:
 *   the company line    — "Connect your world. / Control your future. / Create your freedom."
 *   the experience line — "Plan your escape. / Build your income. / Explore the world."
 *
 * WHERE THEY RENDER — every surface reads them from here; none types them:
 *   · COMPANY_LINE     — the hero's h1 (src/components/landing/Landing.tsx), the page description
 *                        (src/app/layout.tsx, through SITE_DESCRIPTION) and the link-preview image
 *                        (src/app/opengraph-image.tsx);
 *   · EXPERIENCE_LINE  — the events section's h2 (src/components/landing/ExperiencesSection.tsx),
 *                        with "Book the experience, not just the destination." (that file's PROMISE) under it;
 *   · HERO_SUBLINE     — the hero's subline, moved here word for word from Landing.tsx :2085-2086;
 *   · SITE_DESCRIPTION — the company line and the subline, derived, never retyped.
 *
 * RETIRED 2026-11-08 (HOME-LINES-01): "Track your money. / Plan your time. / Live smarter." — the
 * hero's line since FOUNDERS-POSITIONING-AND-OG-TRUTH. It left every file that rendered or served it;
 * the comments that quote it are history and stay.
 *
 * PURE, NO IMPORTS: the preview image runs on the edge runtime (src/app/opengraph-image.tsx :3).
 */

export const COMPANY_LINE = ['Connect your world.', 'Control your future.', 'Create your freedom.'] as const;

export const EXPERIENCE_LINE = ['Plan your escape.', 'Build your income.', 'Explore the world.'] as const;

export const HERO_SUBLINE = 'One system for your money, your days and your books — so every number can be traced back to what actually happened.';

export const SITE_DESCRIPTION = `${COMPANY_LINE.join(' ')} ${HERO_SUBLINE}`;
