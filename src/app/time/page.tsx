'use client';

/**
 * TOOL-LAW-01 — /time, TIME'S ONE PAGE (tool 03, THE WORK).
 *
 * TIME-01 (Alex, 2026-10-19) — THE DAY CARD AND THE LEDGER LIVE HERE. "The day
 * card is what the Time tab was always meant to be: the narration of the day."
 * In order, inside the one provider: the DayCard section (the deck, the journal
 * card, the reel buttons, the stay bar, the move control — day/DayCard.tsx,
 * exactly as it stood first on /tasks since TASKS-ONE-01, in the Suspense
 * boundary its useSearchParams needs on a client page), then the city ledger
 * (ledger/LedgerSection.tsx — the record of the day's stops, LEDGER-01), then
 * the content pipeline as it is, beneath, until TIME-02 retires it. Tasks keeps
 * the work: projects and routines. Every URL the card pushes starts at
 * dayCard.ts DAY_CARD_PATH ('/time' now); /tasks/day hops here, and a dated
 * /tasks?date= is sent here by next.config.ts. The two-lists law holds this
 * container to exactly the three (scripts/assert-tool-registry.ts). The card
 * and the ledger read no entity; they sit in the provider because the sections
 * share one container, as they did on /tasks.
 *
 * The only phase strip on it is the CONTENT pipe's four phases, from
 * src/lib/pipePhases.ts, rendered by ContentPipeline itself (:371) — a
 * PAGE-LEVEL strip, the same shape BooksPipeline uses.
 *
 * DayCalendarView rides phase 03 (ContentPipeline.tsx:537) and is NOT a
 * violation of rule 5: it renders the day's blocks as a clock-ordered list, not
 * the merged grid. Its own doc says so — "a dense, ONE-LINE stacked list in
 * clock order (NOT an hour-grid)". It is this phase's own surface, so it is
 * Time's. The law names it as an explicit non-violation so this is not
 * re-litigated.
 */
import { Suspense } from 'react';
import AppLayout from '@/components/ui/AppLayout';
import ToolOpener from '@/components/shell/ToolOpener';
import { navToolByName } from '@/lib/nav';
import { TOOL_GATE } from '@/lib/offer';
import { OperationsEntityProvider } from '@/components/workbench/operations/EntitySelector';
import DayCard from '@/components/workbench/operations/day/DayCard';
import LedgerSection from '@/components/workbench/operations/ledger/LedgerSection';
import ContentPipeline from '@/components/workbench/operations/content/ContentPipeline';

export default function TimePage() {
  return (
    <AppLayout page>
      <ToolOpener tools={[navToolByName('Time', TOOL_GATE)]} />
      <OperationsEntityProvider>
        <div className="space-y-3" data-tool-page="Time">
          <Suspense>
            <DayCard />
          </Suspense>
          <LedgerSection />
          <ContentPipeline />
        </div>
      </OperationsEntityProvider>
    </AppLayout>
  );
}
