import { redirect } from 'next/navigation';
import { dayCardRedirectHref } from '@/components/workbench/operations/day/dayCard';

/**
 * /tasks/day — ONE HOP TO THE DAY CARD (TASKS-ONE-01, 2026-10-14; TIME-01, 2026-10-19).
 *
 * The day card was this page (DAYCARD-01, 2026-10-11). Alex's ruling — one
 * Tasks page, no sub-tabs — made it the first section of /tasks, so this URL
 * is a server redirect to the card's page: `date` and `step` carried exactly as
 * given, no other parameter carried and none invented (dayCard.ts
 * dayCardRedirectHref, on DAY_CARD_PATH). TIME-01 (Alex, 2026-10-19): the card
 * is the first section of /time now — the constant moved, this hop follows it.
 * Old links and bookmarks land on the same day and step.
 */
export default async function TasksDayRedirect({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  redirect(dayCardRedirectHref(await searchParams));
}
