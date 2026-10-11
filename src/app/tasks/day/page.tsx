import AppLayout from '@/components/ui/AppLayout';
import DayCard from '@/components/workbench/operations/day/DayCard';

/**
 * /tasks/day — THE DAY CARD, a child page of Tasks (DAYCARD-01, 2026-10-11).
 *
 * Reached as North Star is: a `links` entry on Tasks' registry row
 * (src/lib/toolRegistry.ts → a rail sub-row), and the "day card" chip beside
 * "this week" on /tasks. The page wears the shell (AppLayout, the rail is on
 * it) and mounts the card alone — no OperationsEntityProvider: the card reads
 * no entity.
 *
 * The day and the step live in the URL (?date=YYYY-MM-DD&step=n) and the card
 * reads them with useSearchParams; `dynamic = 'force-dynamic'` is /budget's way
 * of letting a client component read the URL without a prerender (no static
 * render, so no Suspense boundary is asked for) — src/app/budget/page.tsx.
 */
export const dynamic = 'force-dynamic';

export default function TasksDayPage() {
  return (
    <AppLayout page>
      <DayCard />
    </AppLayout>
  );
}
