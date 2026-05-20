/**
 * Map Operations daily-plan items → CalendarGrid events.
 *
 * One CalendarEvent per calendar_block. Surfaces the universal triple:
 *   - date  : LOCAL YYYY-MM-DD from block.scheduled_start (UTC timestamptz → local)
 *   - time  : LOCAL HH:MM start/end
 *   - cost  : task.actual_cost_usd → falls back to estimated_cost_usd
 *   - category: task.coa_code
 *
 * The `details` slot carries a single rendered line "<coa_code> · $<cost>"
 * (omits either half if missing) — CalendarGrid renders details[0] as a
 * small muted line under the time range (PR-Ops-5.3).
 *
 * `href` routes clicks to the workbench input/action surface for Operations,
 * intercepted client-side by CalendarGrid's per-event router dispatch.
 */

import type { CalendarEvent } from '@/components/shared/CalendarGrid';
import type { DailyPlanItem } from '@/components/workbench/operations/dailyplan/types';

const OPERATIONS_SOURCE = 'operations';
const OPERATIONS_HREF = '/workbench/operations';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** UTC timestamptz ISO string → local YYYY-MM-DD + HH:MM components. */
function toLocalDateAndTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

function formatCostUsd(n: number): string {
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export function mapOperationsBlocks(items: DailyPlanItem[]): CalendarEvent[] {
  const out: CalendarEvent[] = [];

  for (const item of items) {
    const title = item.task?.title ?? item.ad_hoc_title ?? 'Untitled';

    // Cost: prefer actual (post-execution truth) over estimate. Prisma
    // Decimals serialize as strings; Number() converts. null → no badge.
    const costStr = item.task?.actual_cost_usd ?? item.task?.estimated_cost_usd ?? null;
    const costNum = costStr != null ? Number(costStr) : null;
    const costValid = costNum != null && Number.isFinite(costNum);

    const coa = item.task?.coa_code ?? null;

    const detailParts: string[] = [];
    if (coa) detailParts.push(coa);
    if (costValid) detailParts.push(formatCostUsd(costNum as number));
    const detailLine = detailParts.length > 0 ? detailParts.join(' · ') : null;

    for (const block of item.calendar_blocks) {
      const start = toLocalDateAndTime(block.scheduled_start);
      const end = toLocalDateAndTime(block.scheduled_end);

      out.push({
        id: block.id,
        source: OPERATIONS_SOURCE,
        title,
        startDate: start.date,
        endDate: end.date !== start.date ? end.date : null,
        startTime: start.time,
        endTime: end.time,
        budgetAmount: costValid ? (costNum as number) : undefined,
        details: detailLine ? [detailLine] : undefined,
        href: OPERATIONS_HREF,
      });
    }
  }

  return out;
}
