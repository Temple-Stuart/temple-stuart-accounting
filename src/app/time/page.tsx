'use client';

/**
 * TOOL-LAW-01 — /time, TIME'S ONE PAGE (tool 03, THE WORK).
 *
 * TIME-01 (Alex, 2026-10-19) — THE DAY CARD AND THE LEDGER LIVE HERE. "The day
 * card is what the Time tab was always meant to be: the narration of the day."
 * In order, inside the one provider: the DayCard section (the deck, the journal
 * card, the reel buttons, the stay bar, the move control — day/DayCard.tsx,
 * exactly as it stood first on /tasks since TASKS-ONE-01, in the Suspense
 * boundary its useSearchParams needs on a client page), then the task ledger
 * (ledger/LedgerSection.tsx — the record of the day's stops, LEDGER-01; the
 * city ledger until LEDGER-02, Alex, 2026-10-19, renamed it). Tasks
 * keeps the work: projects and routines. Every URL the card pushes starts at
 * dayCard.ts DAY_CARD_PATH ('/time'); /tasks/day hops here, and a dated
 * /tasks?date= is sent here by next.config.ts. The two-lists law holds this
 * container to exactly the two (scripts/assert-tool-registry.ts). The card
 * and the ledger read no entity; they sit in the provider because the sections
 * share one container, as they did on /tasks.
 *
 * TIME-02 (Alex, 2026-10-19) — THE CONTENT PIPELINE IS RETIRED. "Copy script"
 * replaced the script generator, the card's clock order replaced the day
 * calendar, stop records replaced takes. ContentPipeline and its companions
 * (src/components/workbench/operations/content/, 25 files), its thirteen routes
 * (src/app/api/operations/content/) and the cockpit's hidden Content tab are
 * deleted; nothing renders beneath the ledger, and this page draws no phase
 * strip (nav.ts PHASES_RENDERED_AT['/time'] = []). The content pipe stays
 * DEFINED in pipePhases.ts, declared undrawn in THE SORT, until PIPES-01; its
 * five tables stay, untouched, until TABLES-01. HISTORY: until TIME-01 this
 * page rendered the content pipe's four phases as a page-level strip, and
 * DayCalendarView rode phase 03 as a clock-ordered list — the law named it an
 * explicit non-violation of rule 5; both are gone with the pipeline.
 */
import { Suspense } from 'react';
import AppLayout from '@/components/ui/AppLayout';
import ToolOpener from '@/components/shell/ToolOpener';
import { navToolByName } from '@/lib/nav';
import { TOOL_GATE } from '@/lib/offer';
import { OperationsEntityProvider } from '@/components/workbench/operations/EntitySelector';
import DayCard from '@/components/workbench/operations/day/DayCard';
import LedgerSection from '@/components/workbench/operations/ledger/LedgerSection';

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
        </div>
      </OperationsEntityProvider>
    </AppLayout>
  );
}
