/**
 * ONE-FORM-01 (Alex, 2026-11-06) — /work-with-me, the server half. The form itself is
 * WorkWithMeForm.tsx (the client, the RSVPClient precedent). This page does two things
 * the client cannot:
 *   · THE DAY. `today` is the UTC calendar date computed HERE, once per request (the
 *     page is force-dynamic), the same expression src/app/page.tsx uses for the home
 *     page (EVENTS-01's day rule), so the form offers the close exactly while the home
 *     page does — no component reads the clock during render, and the server's words
 *     and the browser's are the same words.
 *   · THE DOOR'S CHOICE. `?need=<word>` — the home page's doors (the DONE-FOR-YOU cards,
 *     the close button) arrive with their choice named; the first value is handed down
 *     as is, and the form picks it only when it offers that word today.
 * PUBLIC (middleware PUBLIC_PATHS: '/work-with-me'); its door is the deck.
 */

import WorkWithMeForm from './WorkWithMeForm';

export const dynamic = 'force-dynamic';

export default async function WorkWithMePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const need = params.need;
  const initialNeed = typeof need === 'string' ? need : Array.isArray(need) && typeof need[0] === 'string' ? need[0] : null;
  const today = new Date().toISOString().slice(0, 10);
  return <WorkWithMeForm today={today} initialNeed={initialNeed} />;
}
