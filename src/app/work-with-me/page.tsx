/**
 * ONE-FORM-01 (Alex, 2026-11-06) — /work-with-me, the server half. The form itself is
 * WorkWithMeForm.tsx (the client, the RSVPClient precedent). This page does the one thing
 * the client is not handed otherwise:
 *   · THE DOOR'S CHOICE. `?need=<word>` — the home page's doors (the DONE-FOR-YOU cards)
 *     arrive with their choice named; the first value is handed down as is, and the form
 *     picks it only when it names one of the six doors. A word the form does not offer —
 *     'close' from an old link included — opens the form with nothing picked; nothing maps it.
 * SERVICES-01 (Alex, 2026-11-08) — It reads no clock. The day it computed (EVENTS-01's
 * expression) fed one thing only — whether the 2026 close was still open; the close retired,
 * so the day and the form's `today` prop went with it. force-dynamic stays: the page reads
 * the query on every request.
 * PUBLIC (middleware PUBLIC_PATHS: '/work-with-me'); its door is the deck.
 */

import WorkWithMeForm from './WorkWithMeForm';

export const dynamic = 'force-dynamic';

export default async function WorkWithMePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const need = params.need;
  const initialNeed = typeof need === 'string' ? need : Array.isArray(need) && typeof need[0] === 'string' ? need[0] : null;
  return <WorkWithMeForm initialNeed={initialNeed} />;
}
