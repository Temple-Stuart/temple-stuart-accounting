/**
 * VENDOR-01 (2026-09-29) — /api/operations/plan-vendors: WHO A PLAN'S MONEY IS PAID TO.
 *
 * POST   { kind, id, instant, vendorId } → set the vendor at that address.
 *        instant null = EVERY occurrence (a subscription); an instant = that ONE
 *        occurrence (today's lunch). The same vendor already there → 200, nothing
 *        written, nothing audited. Another vendor there → replaced. None → created.
 * DELETE ?kind=&id=&instant=            → clear exactly that address; none → 404.
 *
 * THE ADDRESS speaks the link route's words (kind routine_line | routine |
 * project_task, id, instant — linkKeys.ts, the links route's readTarget), so a
 * plan's vendor and the posting that paid it share one key.
 *
 * THE CHECKS, in order, each refusal named, nothing written (the rule decides —
 * src/lib/operations/planVendor.ts; this route reads and writes):
 *   (a) the caller first — the cart-plan gate, as the budget report route;
 *   (b) the address — a bad kind 400, an id that is not a UUID 404, an instant
 *       that does not parse 400, a task with an instant 400;
 *   (c) the plan is the caller's — a routine { id, user_id }, a line { id,
 *       routine: { user_id } }, a task { id, user_id } — else 404, never 403;
 *   (d) the plan as /budget reads it — a routine (or a line's routine) through the
 *       ONE loader for its book (loadRoutineBudgetInputs), mapped by the report's
 *       own mappers (reportInputs.ts toReportEntity, toRoutinePlanInput); a task
 *       in PLAN_TASK_STATUSES — else 409;
 *   (e) the money is where the vendor goes (D4) — else 409 in words;
 *   (f) an instant is an occurrence /budget builds — buildRoutineBudgetLines for
 *       that one routine over the rule's window (ruled D1 (b): the instant's UTC
 *       day ±2), the exact address deciding — else 409 in the builder's words, or
 *       naming the routine and the instant;
 *   (g) the vendor — the caller's (else 404), active, in the plan's book — else 409;
 *   (h) the grain (D2) — a plan holding one grain refuses the other: 409. The
 *       migration's trigger refuses the same, and its unique indexes a race: both
 *       answered 409, never 500.
 * Then the write, then the audit (operations_plan_vendor_set / _cleared, before and
 * after, the address and the vendor's name) — the line route's order. DELETE runs
 * (a)–(c) and clears what is at the address: a vendor can be cleared from a plan
 * that has since gone inactive or lost its money.
 *
 * A BudgetDaysError or BudgetInputError is answered as the report answers it; any
 * other failure fails closed. A vendor never changes a figure (D5).
 */
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';
import { isValidUuid } from '@/lib/operations/parseUuid';
import { loadRoutineBudgetInputs } from '@/lib/operations/routineBudgetInputs';
import { BudgetDaysError, buildRoutineBudgetLines, type RoutinePlanInput } from '@/lib/budget/days';
import { BudgetInputError, toReportEntity, toRoutinePlanInput } from '@/lib/budget/reportInputs';
import {
  bookOf, grainAllows, isGrainRefusal, moneyIsHere, occurrenceIn, occurrenceWindow, readPlanAddress, routineAsBudgetReads,
  taskAsBudgetReads, vendorFits, writeFor, type Book, type HeldVendor, type PlanAddress, type PlanFacts, type Refusal,
} from '@/lib/operations/planVendor';

export const dynamic = 'force-dynamic';

const refused = (r: Refusal) => NextResponse.json({ error: r.error, message: r.message }, { status: r.status });
const noPlan = () => NextResponse.json({ error: 'not-found', message: 'No such plan' }, { status: 404 });

/** The address as its three columns: which plan column, and the instant (null = every occurrence). */
function addressWhere(a: PlanAddress): { routine_id?: string; step_id?: string; task_id?: string; occurrence_at: Date | null } {
  if (a.kind === 'routine') return { routine_id: a.id, occurrence_at: a.instant };
  if (a.kind === 'routine_line') return { step_id: a.id, occurrence_at: a.instant };
  return { task_id: a.id, occurrence_at: a.instant };
}

/** The plan column alone — every row the plan holds, at either grain. */
function planWhere(a: PlanAddress): { routine_id: string } | { step_id: string } | { task_id: string } {
  if (a.kind === 'routine') return { routine_id: a.id };
  if (a.kind === 'routine_line') return { step_id: a.id };
  return { task_id: a.id };
}

const addressMeta = (a: PlanAddress) => ({ kind: a.kind, id: a.id, instant: a.instant === null ? null : a.instant.toISOString() });

export async function POST(request: NextRequest) {
  try {
    // (a) The caller first — the cart-plan gate.
    const userEmail = await getVerifiedEmail();
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let body: { kind?: unknown; id?: unknown; instant?: unknown; vendorId?: unknown };
    try { body = await request.json(); } catch { return NextResponse.json({ error: 'A JSON body is required.' }, { status: 400 }); }

    // (b) The address.
    const read = readPlanAddress(body.kind, body.id, body.instant);
    if (!read.ok) return refused(read);
    const address = read.address;

    // (c) The plan is the caller's — and what (d)–(f) need of it.
    let routineRef: { id: string; name: string; entity_id: string } | null = null;
    let task: { title: string; status: string; entity_id: string; estimated_cost_usd: Prisma.Decimal | null } | null = null;
    if (address.kind === 'routine') {
      routineRef = await prisma.operations_routines.findFirst({ where: { id: address.id, user_id: user.id }, select: { id: true, name: true, entity_id: true } });
    } else if (address.kind === 'routine_line') {
      const line = await prisma.operations_routine_steps.findFirst({
        where: { id: address.id, routine: { user_id: user.id } },
        select: { routine: { select: { id: true, name: true, entity_id: true } } },
      });
      routineRef = line === null ? null : line.routine;
    } else {
      task = await prisma.operations_project_tasks.findFirst({
        where: { id: address.id, user_id: user.id },
        select: { title: true, status: true, entity_id: true, estimated_cost_usd: true },
      });
    }
    if (routineRef === null && task === null) return noPlan();

    const books: Book[] = await prisma.entities.findMany({ where: { userId: user.id }, select: { id: true, name: true, entity_type: true } });

    // (d) The plan as /budget reads it, and (e) where its money is.
    let plan: PlanFacts;
    let planBook: Book;
    let routineInput: RoutinePlanInput | null = null;
    if (routineRef !== null) {
      planBook = bookOf(books, routineRef.entity_id, `routine ${routineRef.id}`);
      const loaded = await loadRoutineBudgetInputs(prisma, user.id, planBook.id);
      const entity = toReportEntity(planBook);
      const asRead = routineAsBudgetReads(loaded.map((row) => toRoutinePlanInput(row, entity)), routineRef, address.kind === 'routine_line' ? address.id : null);
      if (!asRead.ok) return refused(asRead);
      routineInput = asRead.routine;
      plan = address.kind === 'routine_line'
        ? { kind: 'routine_line', routine: routineInput, lineId: address.id }
        : { kind: 'routine', routine: routineInput };
    } else {
      const t = task as NonNullable<typeof task>;
      planBook = bookOf(books, t.entity_id, `task ${address.id}`);
      const facts = { title: t.title, status: t.status, estimatedCostUsd: t.estimated_cost_usd === null ? null : t.estimated_cost_usd.toString() };
      const asRead = taskAsBudgetReads(facts);
      if (!asRead.ok) return refused(asRead);
      plan = { kind: 'project_task', task: facts };
    }
    const money = moneyIsHere(plan);
    if (!money.ok) return refused(money);

    // (f) An instant is an occurrence /budget builds — its own builder, the exact address.
    if (address.instant !== null && routineInput !== null) {
      const window = occurrenceWindow(address.instant);
      const built = buildRoutineBudgetLines([routineInput], window.rangeFrom, window.rangeTo);
      const occurrence = occurrenceIn(built, routineInput, { ...address, instant: address.instant });
      if (!occurrence.ok) return refused(occurrence);
    }

    // (g) The vendor.
    if (typeof body.vendorId !== 'string') return NextResponse.json({ error: 'Validation', message: 'vendorId is required' }, { status: 400 });
    const vendorId = body.vendorId;
    // A vendorId that is not a UUID names no row of the directory: the same 404.
    const vendorRow = isValidUuid(vendorId)
      ? await prisma.operations_vendor_directory.findFirst({ where: { id: vendorId, user_id: user.id }, select: { id: true, vendor_name: true, entity_id: true, is_active: true } })
      : null;
    const fits = vendorFits(vendorRow, planBook, books);
    if (!fits.ok) return refused(fits);

    // (h) The grain.
    const rows = await prisma.planned_item_vendors.findMany({
      where: { user_id: user.id, ...planWhere(address) },
      select: { id: true, occurrence_at: true, vendor_id: true, vendor: { select: { vendor_name: true } } },
    });
    const held: HeldVendor[] = rows.map((r) => ({ id: r.id, occurrenceAt: r.occurrence_at, vendorId: r.vendor_id, vendorName: r.vendor.vendor_name }));
    const grain = grainAllows(address, held, routineInput === null ? null : routineInput.timezone);
    if (!grain.ok) return refused(grain);

    // The write, then the audit.
    const existing = grain.existing;
    const write = writeFor(existing, fits.vendor.id);
    if (write === 'unchanged') {
      return NextResponse.json({ outcome: 'unchanged', address: addressMeta(address), vendor: { id: fits.vendor.id, vendor_name: fits.vendor.vendor_name } });
    }
    const before = existing === null ? null : rows.find((r) => r.id === existing.id) ?? null;
    const after = write === 'create'
      ? await prisma.planned_item_vendors.create({ data: { user_id: user.id, ...addressWhere(address), vendor_id: fits.vendor.id } })
      : await prisma.planned_item_vendors.update({ where: { id: (existing as HeldVendor).id, user_id: user.id }, data: { vendor_id: fits.vendor.id } });

    await writeAuditLog({
      actor: { user_id: user.id, email: userEmail, type: 'human_user' },
      action: { type: 'operations_plan_vendor_set', description: `Set the vendor of a plan to "${fits.vendor.vendor_name}"` },
      target: { table: 'planned_item_vendors', id: after.id },
      payload: {
        before,
        after,
        metadata: { address: addressMeta(address), vendor_name: fits.vendor.vendor_name, replaced: existing === null ? null : existing.vendorName },
      },
    });

    return NextResponse.json(
      { outcome: write === 'create' ? 'set' : 'replaced', address: addressMeta(address), vendor: { id: fits.vendor.id, vendor_name: fits.vendor.vendor_name } },
      { status: write === 'create' ? 201 : 200 },
    );
  } catch (error) {
    return answerFailure('Plan vendor POST', 'Failed to set the plan\'s vendor', error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // (a) The caller first — the cart-plan gate.
    const userEmail = await getVerifiedEmail();
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // (b) The address.
    const q = request.nextUrl.searchParams;
    const read = readPlanAddress(q.get('kind'), q.get('id'), q.get('instant'));
    if (!read.ok) return refused(read);
    const address = read.address;

    // (c) The plan is the caller's.
    const owned = address.kind === 'routine'
      ? await prisma.operations_routines.findFirst({ where: { id: address.id, user_id: user.id }, select: { id: true } })
      : address.kind === 'routine_line'
        ? await prisma.operations_routine_steps.findFirst({ where: { id: address.id, routine: { user_id: user.id } }, select: { id: true } })
        : await prisma.operations_project_tasks.findFirst({ where: { id: address.id, user_id: user.id }, select: { id: true } });
    if (owned === null) return noPlan();

    // Exactly that address.
    const row = await prisma.planned_item_vendors.findFirst({
      where: { user_id: user.id, ...addressWhere(address) },
      include: { vendor: { select: { vendor_name: true } } },
    });
    if (row === null) return NextResponse.json({ error: 'not-found', message: 'No vendor at that address' }, { status: 404 });

    const { vendor, ...before } = row;
    await prisma.planned_item_vendors.delete({ where: { id: row.id, user_id: user.id } });

    await writeAuditLog({
      actor: { user_id: user.id, email: userEmail, type: 'human_user' },
      action: { type: 'operations_plan_vendor_cleared', description: `Cleared the vendor "${vendor.vendor_name}" from a plan` },
      target: { table: 'planned_item_vendors', id: row.id },
      payload: { before, after: null, metadata: { address: addressMeta(address), vendor_name: vendor.vendor_name } },
    });

    return NextResponse.json({ outcome: 'cleared', address: addressMeta(address) });
  } catch (error) {
    return answerFailure('Plan vendor DELETE', 'Failed to clear the plan\'s vendor', error);
  }
}

/**
 * The grain trigger and the unique indexes answer a race: 409, never 500. A
 * missing row at delete (a concurrent clear) is the 404 it would have been. The
 * day rules and the report's inputs are answered as the report answers them.
 */
function answerFailure(stage: string, message: string, error: unknown): NextResponse {
  if (isGrainRefusal(error)) {
    return NextResponse.json({ error: 'grain', message: 'this plan gained a vendor at the other grain at the same moment — read it again' }, { status: 409 });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    return NextResponse.json({ error: 'taken', message: 'this address gained a vendor at the same moment — read it again' }, { status: 409 });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
    return NextResponse.json({ error: 'not-found', message: 'the vendor at that address was cleared at the same moment — read it again' }, { status: 404 });
  }
  if (error instanceof BudgetDaysError || error instanceof BudgetInputError) {
    return NextResponse.json({ error: error.code, message: error.message }, { status: 500 });
  }
  return failClosedResponse(stage, message, error);
}
