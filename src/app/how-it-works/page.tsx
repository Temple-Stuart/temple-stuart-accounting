import type { Metadata } from 'next';
import LandingHeader from '@/components/landing/LandingHeader';
import LandingFooter from '@/components/landing/LandingFooter';
import PipelineDeck from '@/components/landing/PipelineDeck';
import { PIPELINE_HEADER_SUB, PIPELINE_PAGE_TITLE } from '@/components/landing/pipelineWords';

/**
 * /how-it-works (PIPELINE-PAGE-01, Alex, ruled 2026-10-30; 2026-11-08 15:11 "my holy grail"; board K) — the pipeline
 * header and its 14 steps on their own page, moved whole and unchanged from the home page
 * (src/components/landing/PipelineDeck.tsx). Its doors: the home page's "How it all connects: the 14 steps →" where
 * the header stood (Landing.tsx), and every old /#deck-NN link, which the home page sends on here with its hash
 * (the deck's own hash effect then opens that step). FOOTER-01 adds the footer's THE RECORD next.
 *
 * PUBLIC (middleware PUBLIC_PATHS '/how-it-works'): a static page — no route handler, no fetch, no paid call, no
 * database read, no env read, no session read. The /my-trip/[id] precedent: LandingHeader (no handlers — its Log in
 * and Create account fall back to links to '/', LandingHeader.tsx:72-75, :85-90), the view, LandingFooter. The title
 * and the description come from ./pipelineWords.ts: the description is the deck header's own sub, imported, never
 * retyped (a 'use client' module's values cannot be read here, so the sentence lives in that leaf).
 */
export const metadata: Metadata = {
  title: PIPELINE_PAGE_TITLE,
  description: PIPELINE_HEADER_SUB,
};

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-bg-terminal text-text-primary">
      <LandingHeader />
      <main data-pipeline-page>
        <PipelineDeck />
      </main>
      <LandingFooter />
    </div>
  );
}
