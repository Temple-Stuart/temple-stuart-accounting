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
 *
 * JOURNAL-07 (Alex, 2026-10-24) — THE JOURNALS DAY OVER DAY. Under the ledger,
 * two more sections in the shared idiom (IDIOM-01): MorningJournalTable (DAY ·
 * DATE · GOALS · BLOCKER · PLAN · DONE) then EveningJournalTable (DAY · DATE ·
 * ACCOMPLISHED · GAPS · EVOLUTION · DIRECTION · ALIGNMENT · ON TRACK · NEXT),
 * each over the days that have a journal in its period, read through the
 * read-only range route (api/operations/journal/range); the card still writes
 * the journal. The container is exactly the four, in this order; the two-lists
 * law holds it (TIME_MOUNTS). They read no entity and no URL — no boundary.
 *
 * HOME-01 (Alex, 2026-10-24) — THE CARD MOVED TO THE DASHBOARD; /time IS THE
 * TABLES. The day card (the deck, the morning and evening forms, THE LOG, the
 * stay bar, the move control, the record row, the reel buttons) is Time's
 * component shown on the cockpit's Runway panel — home/ModuleLauncher.tsx,
 * /runway, dayCard.ts DAY_CARD_PATH — first, in its Suspense boundary. This
 * page mounts the three tables, in order: the task ledger, then the morning
 * and the evening journal tables; none reads the URL, so the boundary left
 * with the card. A dated /time?date= or ?step= — a bookmark from the card's
 * days here — is sent to /runway by next.config.ts (307) before this page
 * renders; a plain /time is this page. The two-lists law holds the container
 * to exactly the three (TIME_MOUNTS) and the card's mount on the panel.
 */
import AppLayout from '@/components/ui/AppLayout';
import ToolOpener from '@/components/shell/ToolOpener';
import { navToolByName } from '@/lib/nav';
import { TOOL_GATE } from '@/lib/offer';
import { OperationsEntityProvider } from '@/components/workbench/operations/EntitySelector';
import LedgerSection from '@/components/workbench/operations/ledger/LedgerSection';
import MorningJournalTable from '@/components/workbench/operations/journal/MorningJournalTable';
import EveningJournalTable from '@/components/workbench/operations/journal/EveningJournalTable';

export default function TimePage() {
  return (
    <AppLayout page>
      <ToolOpener tools={[navToolByName('Time', TOOL_GATE)]} />
      <OperationsEntityProvider>
        <div className="space-y-3" data-tool-page="Time">
          <LedgerSection />
          <MorningJournalTable />
          <EveningJournalTable />
        </div>
      </OperationsEntityProvider>
    </AppLayout>
  );
}
