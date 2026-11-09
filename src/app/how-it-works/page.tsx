import fs from 'fs';
import path from 'path';
import type { Metadata } from 'next';
import LandingHeader from '@/components/landing/LandingHeader';
import LandingFooter from '@/components/landing/LandingFooter';
import PipelineDeck from '@/components/landing/PipelineDeck';
import { PIPELINE_HEADER_SUB, PIPELINE_PAGE_TITLE } from '@/components/landing/pipelineWords';
import BuiltOnStrip from '@/components/landing/BuiltOnStrip';
import { BUILT_ON } from '@/lib/builtOnWall';

/**
 * /how-it-works (PIPELINE-PAGE-01, Alex, ruled 2026-10-30; 2026-11-08 15:11 "my holy grail"; board K) — the pipeline
 * header and its 14 steps on their own page, moved whole and unchanged from the home page
 * (src/components/landing/PipelineDeck.tsx). Its doors: the home page's "How it all connects: the 14 steps →" where
 * the header stood (Landing.tsx), and every old /#deck-NN link, which the home page sends on here with its hash
 * (the deck's own hash effect then opens that step). FOOTER-01 (2026-11-09): the footer's THE RECORD links here too.
 * BUILTON-01 (Alex, ruled 2026-10-30; 2026-11-09): Built on renders here, under the 14 steps and above the footer —
 * the strip moved whole from the foot of the home page (src/components/landing/BuiltOnStrip.tsx).
 *
 * PUBLIC (middleware PUBLIC_PATHS '/how-it-works'): a static page — no route handler, no fetch, no paid call, no
 * database read, no env read, no session read. The /my-trip/[id] precedent: LandingHeader (no handlers — its Log in
 * and Create account fall back to links to '/', LandingHeader.tsx:72-75, :85-90), the view, LandingFooter. The title
 * and the description come from ./pipelineWords.ts: the description is the deck header's own sub, imported, never
 * retyped (a 'use client' module's values cannot be read here, so the sentence lives in that leaf).
 * BUILTON-01 (2026-11-09): one file check, at build — per Built on logo slot, does public/logos/<slug>.svg exist
 * (fs.existsSync, below) — and nothing else: no fetch, no env, no database, no session.
 */
export const metadata: Metadata = {
  title: PIPELINE_PAGE_TITLE,
  description: PIPELINE_HEADER_SUB,
};

export default function HowItWorksPage() {
  // PR-ELEV-2d: per cleared logo slot, does public/logos/<slug>.svg exist?
  // File-presence only — no fetch, no env, no database. BUILTON-01 (2026-11-09): moved here from src/app/page.tsx with
  // the strip, re-worded: this page is static, so the check runs at build, and a dropped file lights its chip on the
  // next deploy (a file in public/ only ships with a deploy). On the home page, force-dynamic ran it per request.
  const logoAvailability = Object.fromEntries(
    BUILT_ON.flatMap((e) =>
      e.logo ? [[e.logo.slug, fs.existsSync(path.join(process.cwd(), 'public', 'logos', `${e.logo.slug}.svg`))]] : [],
    ),
  );
  return (
    <div className="min-h-screen bg-bg-terminal text-text-primary">
      <LandingHeader />
      <main data-pipeline-page>
        <PipelineDeck />
        <BuiltOnStrip logoAvailability={logoAvailability} />
      </main>
      <LandingFooter />
    </div>
  );
}
