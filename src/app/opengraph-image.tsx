import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * OG-CREST-01 (Alex, 2026-11-12) — THE LINK PREVIEW IS THE HERO'S CREST.
 *
 * Alex, with a screenshot of the card iMessage drew for a templestuart.com link and a crop of the live hero beside it:
 * "for the image it shows... instead of the connect yur world. Create your freedom. Control your future... I wanna see
 * like this image from the hero". The crop is the crest on the hero's violet ground and nothing else, so this card is
 * that and nothing else. It carries no words: the card's words are its title, which layout.tsx holds and the client
 * prints with the picture.
 *
 *   · THE CREST — public/brand/hero-crest-desktop.svg, the hero's own file from 1024px (design-refs/hero-crest-01/
 *     README.md: "Use them as files. Never redraw, trace, simplify or hand-edit them."), read whole and drawn as an <img>.
 *     Its canvas is 3600 × 2000 units with the crest centred on x = 1800. It is drawn CREST_W wide, centred, the plume's
 *     top PLUME_MARGIN below the frame's top; the frame's foot cuts the lowest feathers about where the hero's band cuts
 *     them at the approved 1440 × 900 artboard (≈ 1488 of the file's 2000 units here, ≈ 1495 there).
 *   · THE GROUND — .ts-hero's three layers (src/app/globals.css), each colour the value of its --ts-hero-* token, typed
 *     because ImageResponse reads no stylesheet; src/lib/__tests__/ogCrest01.test.ts holds each one to its token. The
 *     sweep is the hero's as written. The bloom sits on the crest's middle (the file's centre), its radii the hero's at
 *     1440 × 900 — min(48vw, 700px) × 62% of the 880px band = 691.2 × 545.6px, around a crest drawn 2628px wide — scaled
 *     with the crest. The orchid corner is the hero's at the frame's own size: min(46vw, 680px) is 46% of 1200px. Every
 *     alpha is written rgba(r, g, b, a): next/og (satori 0.15.2) takes rgb(r g b / a) without an error and draws the
 *     wrong colour.
 *
 * THE RUNTIME is Node.js, the default, so the crest is read from disk — Next's documented way to use a local file in a
 * generated image. Nothing here is dynamic, so the image is drawn once, at build: a crest that is missing or unreadable
 * fails the build, never a request. It ran on the edge until this change.
 *
 * UNTIL OG-CREST-01 this card was a flat #2d1b4e with a white "TS" box, "Temple Stuart / Founder's Back Office", the
 * company line's three sentences from src/lib/brandLines.ts (the third in the wash #eae7f2) and a "Plaid / Bank Sync"
 * stat — FOUNDERS-POSITIONING-AND-OG-TRUTH, then HOME-LINES-01 (2026-11-08).
 */

export const alt = 'The Temple Stuart crest: a gold lion on a shield, on a violet ground';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** The crest file's canvas, in its own units. */
const FILE_W = 3600;
const FILE_H = 2000;
/** The top of the plume in the file's units: the topmost path's bounding box (getBBox, in Chromium). */
const PLUME_TOP = 445.6;

// next/og lays every box out on whole pixels (Yoga rounds each edge), so the crest's box is whole pixels here and the
// numbers below are what is drawn: 2052 is 9 × 228, so the box keeps the file's 9:5 exactly, and its centring is whole.
const CREST_W = 2052;                                                // px — 0.57px to the unit
const CREST_H = (CREST_W * FILE_H) / FILE_W;                         // 1140px
const PLUME_MARGIN = 36;                                             // px, the frame's top to the plume's
const CREST_LEFT = (size.width - CREST_W) / 2;                       // −426px: centred
const CREST_TOP = Math.round(PLUME_MARGIN - (PLUME_TOP * CREST_W) / FILE_W); // −218px (−217.99)

/** The hero at 1440 × 900 draws the crest 2628px wide and the bloom 691.2 × 545.6px; here the bloom scales with the crest. */
const HERO_SCALE = CREST_W / 2628;
const BLOOM = { x: size.width / 2, y: CREST_TOP + CREST_H / 2, rx: 691.2 * HERO_SCALE, ry: 545.6 * HERO_SCALE };

const ORCHID = 'radial-gradient(46% 56% at 100% 104%, rgba(217, 70, 239, 0.28) 0%, rgba(217, 70, 239, 0.10) 45%, rgba(217, 70, 239, 0) 72%)';
const BLOOM_STOPS = 'rgba(162, 107, 255, 0.50) 0%, rgba(162, 107, 255, 0.16) 45%, rgba(162, 107, 255, 0) 72%';
const SWEEP = 'linear-gradient(155deg, #6A33E0 0%, #4D1FBC 34%, #32118A 68%, #210A5E 100%)';

export default async function Image() {
  const crest = await readFile(join(process.cwd(), 'public/brand/hero-crest-desktop.svg'));
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          backgroundColor: '#32118A',
          backgroundImage: `${ORCHID}, radial-gradient(${BLOOM.rx}px ${BLOOM.ry}px at ${BLOOM.x}px ${BLOOM.y}px, ${BLOOM_STOPS}), ${SWEEP}`,
        }}
      >
        <img
          src={`data:image/svg+xml;base64,${crest.toString('base64')}`}
          alt=""
          width={CREST_W}
          height={CREST_H}
          style={{ position: 'absolute', left: CREST_LEFT, top: CREST_TOP }}
        />
      </div>
    ),
    { ...size }
  );
}
