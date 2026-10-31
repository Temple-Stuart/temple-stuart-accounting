import type { Prisma, PrismaClient } from '@prisma/client';

/**
 * BUDGET-02 (2026-10-20) — THE BUDGET'S READS, ONCE. Alex's ruling G: "One
 * shared loader for the actuals query, called by the report route and the cell
 * route; the route law's one-query clause points at the loader."
 *
 * GET /api/budget/report (the report) and GET /api/budget/report/cell (the
 * drill behind one figure) read a person's books the same way, so they read
 * them through these functions and nowhere else — a drill's lines can never be
 * read by a second rule from the cell they explain:
 *
 *   · readActuals — THE ONE ACTUALS QUERY: ledger lines on revenue and expense
 *     accounts only, journal date in [from, through]. Left out BY NAME in its own
 *     where clause: reversal pairs (an entry with is_reversal, or one
 *     reversed_by another — the ledger pattern, src/app/api/hub/year-calendar/
 *     route.ts:121-122) and year-end closing entries (source_type
 *     'year_end_close', which zero the P&L into retained earnings,
 *     src/app/api/ledger/year-end-close/route.ts). Each line carries its id, its
 *     entry's description and source type — what the drill lists.
 *   · countLeftOut — what readActuals leaves out, counted: the reversal-pair
 *     lines, the closing-entry lines, and the lines after asOf.
 *   · readBudgetChart — every chart row of the books, archived included, with
 *     is_archived (ruling C: an archived account is a row only with a figure).
 *   · readCostedTasks — costed tasks (estimated_cost_usd not null, every
 *     status), each with its project and EVERY daily-plan item and its blocks'
 *     statuses — the earliest day decides (days.ts).
 *   · readPlanVendors — every every-occurrence plan-vendor row of the viewer, and
 *     the occurrence rows whose instant is in the window the caller computed
 *     (planLines.ts vendorWindow / vendorWindowOf), each with its vendor and its
 *     plan's words.
 *
 * Every read is scoped to the viewer (userId) AND to the books handed in, which
 * the caller has already read as the viewer's own. READ-ONLY: nothing here
 * writes (the budget report route law, clause 4).
 */

type Db = Pick<PrismaClient, 'chart_of_accounts' | 'operations_project_tasks' | 'ledger_entries' | 'planned_item_vendors'>;

const dayStart = (day: string): Date => new Date(`${day}T00:00:00.000Z`);

/** A ledger line on one of the viewer's revenue or expense accounts, in one of the viewer's journal entries. */
const plLine = (userId: string, entityIds: readonly string[], journal: Prisma.journal_entriesWhereInput): Prisma.ledger_entriesWhereInput => ({
  account: { entity_id: { in: [...entityIds] }, entity: { userId }, account_type: { in: ['revenue', 'expense'] } },
  journal_entry: { userId, entity_id: { in: [...entityIds] }, ...journal },
});

/** THE ONE ACTUALS QUERY — [from, through] by journal date; never a reversal pair, never a closing entry, by name. */
export function readActuals(db: Db, userId: string, entityIds: readonly string[], from: string, through: string) {
  return db.ledger_entries.findMany({
    where: plLine(userId, entityIds, { date: { gte: dayStart(from), lte: dayStart(through) }, is_reversal: false, reversed_by_entry_id: null, source_type: { not: 'year_end_close' } }),
    select: {
      id: true, journal_entry_id: true, entry_type: true, amount: true,
      account: { select: { entity_id: true, code: true } },
      journal_entry: { select: { date: true, description: true, source_type: true } },
    },
  });
}

/** What readActuals leaves out of [from, through], counted — and the lines in [from, to] dated after asOf. */
export async function countLeftOut(db: Db, userId: string, entityIds: readonly string[], range: { readonly from: string; readonly through: string; readonly to: string; readonly asOf: string }) {
  const [reversalPairLines, closingEntryLines, linesAfterAsOf] = await Promise.all([
    db.ledger_entries.count({
      where: plLine(userId, entityIds, { date: { gte: dayStart(range.from), lte: dayStart(range.through) }, OR: [{ is_reversal: true }, { reversed_by_entry_id: { not: null } }] }),
    }),
    db.ledger_entries.count({
      where: plLine(userId, entityIds, { date: { gte: dayStart(range.from), lte: dayStart(range.through) }, is_reversal: false, reversed_by_entry_id: null, source_type: 'year_end_close' }),
    }),
    db.ledger_entries.count({
      where: plLine(userId, entityIds, { date: { gt: dayStart(range.asOf), gte: dayStart(range.from), lte: dayStart(range.to) } }),
    }),
  ]);
  return { reversalPairLines, closingEntryLines, linesAfterAsOf };
}

/** Every chart row of the books, archived included. */
export function readBudgetChart(db: Db, userId: string, entityIds: readonly string[]) {
  return db.chart_of_accounts.findMany({
    where: { entity_id: { in: [...entityIds] }, entity: { userId } },
    select: { entity_id: true, code: true, name: true, account_type: true, balance_type: true, is_archived: true },
  });
}

/** The books' costed tasks, every status, each with its project and every daily-plan item. */
export function readCostedTasks(db: Db, userId: string, entityIds: readonly string[]) {
  return db.operations_project_tasks.findMany({
    where: { user_id: userId, entity_id: { in: [...entityIds] }, estimated_cost_usd: { not: null } },
    select: {
      id: true, title: true, project_id: true, entity_id: true, status: true, estimated_cost_usd: true, coa_code: true,
      daily_plan_items: {
        where: { user_id: userId },
        select: { plan_date: true, calendar_blocks: { where: { user_id: userId }, select: { status: true } } },
      },
    },
  });
}

/** The viewer's every-occurrence plan-vendor rows, and the occurrence rows in [window.from, window.to). */
export function readPlanVendors(db: Db, userId: string, window: { readonly from: Date; readonly to: Date }) {
  return db.planned_item_vendors.findMany({
    where: { user_id: userId, OR: [{ occurrence_at: null }, { occurrence_at: { gte: window.from, lt: window.to } }] },
    select: {
      id: true, routine_id: true, step_id: true, task_id: true, occurrence_at: true,
      vendor: { select: { id: true, vendor_name: true, entity_id: true } },
      routine: { select: { name: true, timezone: true } },
      step: { select: { activity: true, routine_id: true, routine: { select: { name: true, timezone: true } } } },
      task: { select: { title: true } },
    },
  });
}
