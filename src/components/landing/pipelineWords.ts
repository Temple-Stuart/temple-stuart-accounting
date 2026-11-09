/**
 * PIPELINE-PAGE-01 (Alex, ruled 2026-10-30; 2026-11-08 15:11 "my holy grail"; board K) — THE 14 STEPS' OWN PAGE: ITS WORDS.
 *
 * The pipeline header and its fourteen steps moved whole from the home page to /how-it-works
 * (src/components/landing/PipelineDeck.tsx, rendered by src/app/how-it-works/page.tsx). Every word the move needed
 * outside the deck lives here, and nothing reads them anywhere else:
 *   · PIPELINE_PATH       — the page's path: the home page's door (Landing.tsx) and its old-links effect read it;
 *                           FOOTER-01 (2026-11-09): the footer's THE RECORD links to it (src/lib/footerWords.ts);
 *   · PIPELINE_DOOR       — the door's words, where the pipeline header stood (Landing.tsx, after the plans);
 *                           FOOTER-01 (2026-11-09): and the words of THE RECORD's first link (src/lib/footerWords.ts);
 *   · PIPELINE_PAGE_TITLE — the page's metadata title;
 *   · PIPELINE_HEADER_SUB — the header's sub, the essay's front matter VERBATIM, moved here word for word from the
 *                           deck's header (it renders there from this constant, byte for byte as before), so the
 *                           page's description is the deck's own words — imported, never retyped.
 *   · DECK_STEP_IDS       — BUILTON-01 (2026-11-09): the fourteen steps' section ids, deck-01 … deck-14, moved
 *                           verbatim from PipelineDeck.tsx (the note on what each id does stays there), which imports
 *                           them back and still exports them:
 *                           the deck's state and hash effect read them there, and the home page's old-links effect
 *                           (Landing.tsx) reads them here — so the home page imports nothing from the deck's file.
 *
 * PURE, NO IMPORTS, NO DIRECTIVE: the page is a server component, and it reads these. A 'use client' module's exports
 * reach the server as client references, never values (Next 15.5's flight loader rewrites each one into
 * registerClientReference(...) — node_modules/next/dist/build/webpack/loaders/next-flight-loader/index.js:114-128), so
 * the words the page needs cannot live in PipelineDeck.tsx. LandingFooter.tsx, a server-safe file, can import the path
 * from here too. FOOTER-01 (2026-11-09): it does, through the pure src/lib/footerWords.ts — the path and the door's words.
 */

export const PIPELINE_PATH = '/how-it-works';

export const PIPELINE_DOOR = 'How it all connects: the 14 steps →';

export const PIPELINE_PAGE_TITLE = 'How it all connects — the 14 steps | Temple Stuart';

export const PIPELINE_HEADER_SUB = 'Fourteen steps turn raw data into one Ledger and one Calendar — the foundation everything else is built on. Written so anyone can understand it — and build it.';

// PR-COLLAPSE: the 14 deck steps' section ids, order-parallel to the acts — BUILTON-01 (2026-11-09): the array
// moved here verbatim from PipelineDeck.tsx, whose note over its re-export says what each id does (aria-controls,
// the hash that opens a step) and why the numbering is the essay's.
export const DECK_STEP_IDS = [
  'deck-01', 'deck-02', 'deck-03', 'deck-04', 'deck-05', 'deck-06', 'deck-07',
  'deck-08', 'deck-09', 'deck-10', 'deck-11', 'deck-12', 'deck-13', 'deck-14',
] as const;
