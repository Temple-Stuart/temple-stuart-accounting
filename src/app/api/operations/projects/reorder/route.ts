/**
 * PATCH /api/operations/projects/reorder — THE RANK (BACKLOG-02, Alex, 2026-10-20).
 *
 * Alex, 15:42: the morning card is "a running log of all the projects that are ongoing … and I need a way to rank
 * them". This is the ONE writer of operations_projects.rank (BACKLOG-01 added the column, its CHECK rank > 0 and the
 * index (user_id, status, rank); nothing wrote it before this route).
 *
 * THE RULE. Body { ids: string[] } — the FULL ordered list of the user's OPEN projects (backlog · scoped · scheduled ·
 * in_progress · blocked · not_started — morningLog.ts OPEN_PROJECT_STATUSES; BACKLOG-02b added not_started), every book. Ranks are written 1..n in that order, in
 * ONE transaction. Refused by name (400, field "ids", the rule named) — checked by the one pure rule,
 * morningLog.ts reorderCheck, in this order:
 *   · shape      — not a list of ids;
 *   · duplicate  — an id listed twice;
 *   · not_yours  — an id that is not one of the user's projects (or not a project id at all) — the same words whether
 *                  the row belongs to another user or to no one, so the route never confirms another user's row exists;
 *   · not_open   — one of the user's projects that is not open;
 *   · missing    — an open project of the user's that the list leaves out (every open project is ranked, or none is).
 * Unranked projects get ranks the first time the list is saved — the list holds every open project, so every one is
 * written. Closed projects keep whatever rank they had; nothing reads it.
 *
 * The check runs INSIDE the transaction, on what the transaction read: the projects the list names that the user owns,
 * and every open project of the user's. A list that changes nothing writes nothing and audits nothing ({ changed:
 * false }). A list that changes a rank writes all n ranks, then audits ONCE as operations_project_reranked, the before
 * and after ranks in metadata — after the commit, the projects routes' way (sequential awaits; writeAuditLog retries
 * on its own). No paid call.
 *
 * Auth: the projects routes' order — getVerifiedEmail → 401, the user → 404, every query scoped to user_id.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { OPEN_PROJECT_STATUSES, isProjectId, ranksAfter, ranksChange, reorderCheck, reorderIds, type ReorderRule } from '@/lib/operations/morningLog';

type Saved =
  | { readonly ok: false; readonly rule: ReorderRule; readonly message: string }
  | { readonly ok: true; readonly changed: boolean; readonly before: { id: string; title: string; rank: number | null }[]; readonly after: { id: string; rank: number }[] };

export async function PATCH(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    let body: unknown;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json({ error: 'Validation', field: 'ids', rule: 'shape', message: `the body is not JSON: ${error instanceof Error ? error.message : String(error)}` }, { status: 400 });
    }
    const shape = reorderIds(body);
    if (!shape.ok) return NextResponse.json({ error: 'Validation', field: 'ids', rule: shape.rule, message: shape.message }, { status: 400 });
    const ids = shape.ids;

    const saved: Saved = await prisma.$transaction(async (tx) => {
      // What the check needs, for THIS user only: the listed projects they own (a non-UUID id is never sent) and every open project.
      const owned = await tx.operations_projects.findMany({
        where: { user_id: user.id, OR: [{ id: { in: ids.filter(isProjectId) } }, { status: { in: [...OPEN_PROJECT_STATUSES] } }] },
        select: { id: true, title: true, status: true, rank: true },
      });
      const check = reorderCheck(ids, owned);
      if (!check.ok) return check;
      const before = owned.filter((p) => ids.includes(p.id)).map((p) => ({ id: p.id, title: p.title, rank: p.rank }));
      const after = ranksAfter(ids);
      if (!ranksChange(ids, owned)) return { ok: true, changed: false, before, after };
      for (const { id, rank } of after) {
        await tx.operations_projects.update({ where: { id, user_id: user.id }, data: { rank } });
      }
      return { ok: true, changed: true, before, after };
    });

    if (!saved.ok) return NextResponse.json({ error: 'Validation', field: 'ids', rule: saved.rule, message: saved.message }, { status: 400 });
    if (saved.changed) {
      await writeAuditLog({
        actor: { user_id: user.id, email: userEmail, type: 'human_user' },
        action: {
          type: 'operations_project_reranked',
          description: `Reranked ${saved.after.length} open project${saved.after.length === 1 ? '' : 's'} for ${userEmail}`,
        },
        target: { table: 'operations_projects', id: null },
        payload: {
          metadata: {
            before: saved.before.map((p) => ({ id: p.id, title: p.title, rank: p.rank })),
            after: saved.after,
          },
        },
      });
    }
    return NextResponse.json({ changed: saved.changed, ranks: saved.after });
  } catch (error) {
    return failClosedResponse('Projects reorder PATCH', 'Failed to rank projects', error);
  }
}
