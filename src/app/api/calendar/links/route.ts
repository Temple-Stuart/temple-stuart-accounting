/**
 * LINK-01 — THE LINK BETWEEN A BUDGETED ITEM AND THE POSTING THAT SETTLED IT.
 *
 * GET    ?kind=&id=&instant=          → this item's links, and the candidate
 *                                       postings the founder may choose from.
 * POST   { kind, id, instant, journalEntryId } → link one posting.
 * DELETE ?journalEntryId=             → unlink it.
 *
 * NOTHING HERE MATCHES ANYTHING. The candidate list is every posting of this
 * user near the item's date, in date order, with no score, no ranking by
 * closeness of amount, and nothing pre-selected. DAY-01 ruled the automatic
 * join unsound; this route does not sneak one back in as a "suggestion".
 * `transaction_reservation_links` (schema :1473) is the repo's OTHER link
 * table and it DOES carry `confidence` and `matchRationale` — that shape is
 * deliberately not copied here.
 *
 * SECURITY. Every verb: cookie → user → user-scoped query. A posting or an item
 * belonging to someone else resolves to a DEFENSIVE 404 (never 403 — a 403
 * confirms the row exists). No paid service is reached at all. SEC-TASKS-01: the
 * POST reads the item on its own table, user-scoped, before it writes — until
 * then the item's id was written unchecked.
 *
 * IT WRITES NOTHING BUT THE LINK. No posting is altered, no journal entry is
 * touched, no task's actual_cost_usd is overwritten. The Books commit flow is
 * not in this file.
 *
 * LEDGER-03 (Alex, 2026-10-19): A LINK IS A FINANCIAL ASSERTION — AUDITED. The
 * POST writes planned_item_linked and the DELETE planned_item_unlinked
 * (writeAuditLog: the actor, the table, the row's id, the payload { kind, id,
 * instant, journal_entry_id, amountCents }); the migration
 * 20261019230000_ledger_03_planned_item_link_audit adds the two values. The
 * amount rule (amountCentsOf) moved to src/lib/calendar/postingAmount.ts so the
 * ledger route reads a posting's amount by the same rule — one copy. The
 * candidate rule is unchanged: the window, the date order, nothing pre-selected.
 *
 * LINK-LAW-01 (Alex, 2026-10-28). THIS ROUTE IS THE ONE WRITER of planned_item_links (ruling A — the tool-registry law
 * fails the build on any other create or delete; the routine rekey alone moves an instant). A LINK IS TO A REAL
 * OCCURRENCE (ruling B): the POST, for a routine or a line, refuses an instant the routine's rule does not produce in
 * its own zone — linkOccurrence.ts occurrenceCheck, the budget's builder — "<instant> is not an occurrence of
 * <routine>". A REVERSED POSTING PAYS NOTHING (ruling C): the POST refuses a posting that is a reversal or has been
 * reversed, by name (postingAmount.ts isReversedPosting); the GET marks each linked posting `reversed` (the leaf's sum
 * leaves it out and says so — links.ts sumLinks) and offers no reversed posting as a candidate, counting the ones it
 * left out (candidatesReversed).
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';
import { LINKED_POSTING_SELECT, PAYING_POSTING_WHERE, REVERSED_POSTING_WHERE, amountCentsOf, isReversedPosting, reversedRefusalWords } from '@/lib/calendar/postingAmount';
import { OCCURRENCE_ROUTINE_SELECT, occurrenceCheck } from '@/lib/operations/linkOccurrence';
import { LINKABLE_KINDS, isLinkableKind, requiresInstant, targetOwnerQuery, type LinkableKind, type TargetOwnerQuery } from '@/lib/calendar/linkKeys';

/** How far either side of the item's date a candidate may sit. Not a match — a window. */
const CANDIDATE_DAYS = 45;
const CANDIDATE_LIMIT = 100;

async function caller() {
  const email = await getVerifiedEmail();
  if (!email) return null;
  return prisma.users.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true, email: true },
  });
}

// The amount of a posting, in cents, or NULL when it cannot be read: src/lib/calendar/postingAmount.ts amountCentsOf — the one
// rule (LEDGER-03 moved it there; the ledger route reads by it too). A NULL is REPORTED by the leaf, never summed.

const ENTRY_SELECT = {
  id: true, date: true, description: true,
  ...LINKED_POSTING_SELECT,
} as const;

type EntryRow = { id: string; date: Date; description: string; ledger_entries: { entry_type: string; amount: bigint }[]; status: string; is_reversal: boolean; reversed_by_entry_id: string | null };

// LINK-LAW-01 (ruling C): each posting says whether it was reversed — a reversed one pays nothing, and the leaf's sum leaves it out.
const asPosting = (e: EntryRow) => ({
  journalEntryId: e.id,
  date: e.date.toISOString().slice(0, 10),
  description: e.description,
  amountCents: amountCentsOf(e),
  reversed: isReversedPosting(e),
});

/** The (kind, id, instant) triple, validated. Returns the reason on refusal. */
function readTarget(kind: string | null, id: string | null, instant: string | null):
  { ok: true; kind: LinkableKind; id: string; instant: Date | null } | { ok: false; reason: string } {
  if (!kind || !isLinkableKind(kind)) {
    return { ok: false, reason: `kind must be one of ${LINKABLE_KINDS.join(', ')}` };
  }
  if (!id) return { ok: false, reason: 'a target id is required' };
  if (requiresInstant(kind)) {
    if (!instant) return { ok: false, reason: `a ${kind === 'routine_line' ? 'routine line' : 'routine occurrence'} is addressed by its INSTANT, not its date — pass instant` };
    const d = new Date(instant);
    if (Number.isNaN(d.getTime())) return { ok: false, reason: 'instant is not a valid timestamp' };
    return { ok: true, kind, id, instant: d };
  }
  if (instant) return { ok: false, reason: `${kind} carries no occurrence instant` };
  return { ok: true, kind, id, instant: null };
}

/**
 * SEC-TASKS-01: does the target row exist AND belong to the caller? One read on
 * the kind's own table, scoped as targetOwnerQuery says. A null query is an id
 * that names no row of that table — not the caller's.
 */
async function ownsTarget(q: TargetOwnerQuery | null): Promise<boolean> {
  if (q === null) return false;
  const select = { id: true } as const;
  switch (q.table) {
    case 'calendar_events': return (await prisma.calendar_events.findFirst({ where: q.where, select })) !== null;
    case 'operations_project_tasks': return (await prisma.operations_project_tasks.findFirst({ where: q.where, select })) !== null;
    case 'operations_routines': return (await prisma.operations_routines.findFirst({ where: q.where, select })) !== null;
    case 'operations_routine_steps': return (await prisma.operations_routine_steps.findFirst({ where: q.where, select })) !== null;
    case 'trip_itinerary': return (await prisma.trip_itinerary.findFirst({ where: q.where, select })) !== null;
  }
}

export async function GET(request: NextRequest) {
  const user = await caller();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const q = request.nextUrl.searchParams;
  const t = readTarget(q.get('kind'), q.get('id'), q.get('instant'));
  if (!t.ok) return NextResponse.json({ error: t.reason }, { status: 400 });
  const near = q.get('near');

  const links = await prisma.planned_item_links.findMany({
    where: { user_id: user.id, target_kind: t.kind, target_id: t.id, target_instant: t.instant },
    orderBy: { linked_at: 'asc' },
  });

  const entryIds = links.map((l) => l.journal_entry_id);
  const linkedEntries = entryIds.length
    ? await prisma.journal_entries.findMany({ where: { id: { in: entryIds }, userId: user.id }, select: ENTRY_SELECT })
    : [];

  // THE CANDIDATES. Every posting of THIS user inside a window around the item's
  // date, minus any already linked to something. Date order — not closeness.
  let candidates: ReturnType<typeof asPosting>[] = [];
  // LINK-LAW-01 (ruling C): a reversed posting is never offered; how many the window held is said, never hidden.
  let candidatesReversed = 0;
  if (near) {
    const anchor = new Date(`${near.slice(0, 10)}T00:00:00Z`);
    if (!Number.isNaN(anchor.getTime())) {
      const from = new Date(anchor); from.setUTCDate(from.getUTCDate() - CANDIDATE_DAYS);
      const to = new Date(anchor); to.setUTCDate(to.getUTCDate() + CANDIDATE_DAYS);
      const rows = await prisma.journal_entries.findMany({
        where: {
          userId: user.id,
          date: { gte: from, lte: to },
          // A posting already linked to any item is not a candidate — the
          // cardinality rule (one posting, at most one item) shown in the UI
          // rather than left for the database to refuse.
          planned_item_links: { none: {} },
          ...PAYING_POSTING_WHERE,
        },
        select: ENTRY_SELECT,
        orderBy: { date: 'desc' },
        take: CANDIDATE_LIMIT,
      });
      candidates = rows.map(asPosting);
      candidatesReversed = await prisma.journal_entries.count({
        where: { userId: user.id, date: { gte: from, lte: to }, planned_item_links: { none: {} }, ...REVERSED_POSTING_WHERE },
      });
    }
  }

  return NextResponse.json({
    links: links.map((l) => {
      const e = linkedEntries.find((x) => x.id === l.journal_entry_id);
      // A link whose entry cannot be read keeps its id and reports a NULL
      // amount — the leaf excludes it from the sum and names it. It is never
      // counted as zero (the EDGE-01 bug, done the other way round).
      const posting = e ? asPosting(e) : { journalEntryId: l.journal_entry_id, date: null, description: null, amountCents: null, reversed: null };
      return { ...posting, linkedAt: l.linked_at.toISOString(), linkedBy: l.linked_by };
    }),
    candidates,
    candidatesReversed,
    candidateWindowDays: CANDIDATE_DAYS,
  });
}

export async function POST(request: NextRequest) {
  const user = await caller();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { kind?: string; id?: string; instant?: string | null; journalEntryId?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'A JSON body is required.' }, { status: 400 }); }

  const t = readTarget(body.kind ?? null, body.id ?? null, body.instant ?? null);
  if (!t.ok) return NextResponse.json({ error: t.reason }, { status: 400 });
  if (!body.journalEntryId) return NextResponse.json({ error: 'journalEntryId is required' }, { status: 400 });

  // SEC-TASKS-01: the item must be THIS user's too — one user-scoped read on the
  // kind's own table (linkKeys.ts targetOwnerQuery). Someone else's, or none, is
  // the defensive 404 the header promises; nothing is written.
  if (!(await ownsTarget(targetOwnerQuery(t.kind, t.id, user.id)))) {
    return NextResponse.json({ error: 'No such item' }, { status: 404 });
  }

  // LINK-LAW-01 (ruling B): a routine's occurrence, or a line's, must be one the routine's rule produces in its own zone —
  // the budget's builder (linkOccurrence.ts). The routine is read user-scoped, as the ownership read was; refused by name.
  if (t.kind === 'routine' || t.kind === 'routine_line') {
    const routine = t.kind === 'routine'
      ? await prisma.operations_routines.findFirst({ where: { id: t.id, user_id: user.id }, select: OCCURRENCE_ROUTINE_SELECT })
      : (await prisma.operations_routine_steps.findFirst({ where: { id: t.id, routine: { user_id: user.id } }, select: { routine: { select: OCCURRENCE_ROUTINE_SELECT } } }))?.routine ?? null;
    if (!routine) return NextResponse.json({ error: 'No such item' }, { status: 404 });
    if (t.instant === null) throw new Error(`links POST: a ${t.kind} target reached the occurrence test without its instant — readTarget requires one`);
    const occurrence = occurrenceCheck(routine, t.instant);
    if (!occurrence.ok) return NextResponse.json({ error: occurrence.message }, { status: 400 });
  }

  // The posting must be THIS user's. Someone else's resolves to a defensive 404.
  const entry = await prisma.journal_entries.findFirst({
    where: { id: body.journalEntryId, userId: user.id },
    select: { id: true, date: true, description: true, ...LINKED_POSTING_SELECT },
  });
  if (!entry) return NextResponse.json({ error: 'No such posting' }, { status: 404 });
  // LINK-LAW-01 (ruling C): a reversal, or a reversed posting, pays nothing — refused by name, nothing written.
  if (isReversedPosting(entry)) return NextResponse.json({ error: reversedRefusalWords(entry) }, { status: 409 });

  // The cardinality rule, stated before the database has to refuse it.
  const taken = await prisma.planned_item_links.findUnique({ where: { journal_entry_id: entry.id } });
  if (taken) {
    return NextResponse.json({
      error: 'That posting is already linked to another item. One posting belongs to at most one item — a posting that truly belongs to several is an allocation, not a link (ALLOC-01).',
      linkedTo: { kind: taken.target_kind, id: taken.target_id, instant: taken.target_instant?.toISOString() ?? null },
    }, { status: 409 });
  }

  const link = await prisma.planned_item_links.create({
    data: {
      user_id: user.id,
      target_kind: t.kind,
      target_id: t.id,
      target_instant: t.instant,
      journal_entry_id: entry.id,
      linked_by: user.email,
    },
  });
  // LEDGER-03: audited, with the posting's amount as the books hold it (NULL when unreadable — said, never zero).
  await writeAuditLog({
    actor: { user_id: user.id, email: user.email, type: 'human_user' },
    action: { type: 'planned_item_linked', description: `Linked posting ${entry.id} to ${t.kind} ${t.id}${t.instant === null ? '' : ` at ${t.instant.toISOString()}`}` },
    target: { table: 'planned_item_links', id: link.id },
    payload: { after: { kind: t.kind, id: t.id, instant: t.instant === null ? null : t.instant.toISOString(), journal_entry_id: entry.id, amountCents: amountCentsOf(entry) } },
  });
  return NextResponse.json({ link: { journalEntryId: link.journal_entry_id, linkedAt: link.linked_at.toISOString() } }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const user = await caller();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const journalEntryId = request.nextUrl.searchParams.get('journalEntryId');
  if (!journalEntryId) return NextResponse.json({ error: 'journalEntryId is required' }, { status: 400 });

  // Scoped by user_id: another user's link is invisible, so this is a 404. LEDGER-03: the row is read first (user-scoped, with its
  // posting's lines), so the audit names what was unlinked and the amount it carried.
  const link = await prisma.planned_item_links.findFirst({
    where: { journal_entry_id: journalEntryId, user_id: user.id },
    include: { journal_entry: { select: LINKED_POSTING_SELECT } },
  });
  if (!link) return NextResponse.json({ error: 'No such link' }, { status: 404 });
  const removed = await prisma.planned_item_links.deleteMany({
    where: { journal_entry_id: journalEntryId, user_id: user.id },
  });
  if (removed.count === 0) return NextResponse.json({ error: 'No such link' }, { status: 404 });
  await writeAuditLog({
    actor: { user_id: user.id, email: user.email, type: 'human_user' },
    action: { type: 'planned_item_unlinked', description: `Unlinked posting ${link.journal_entry_id} from ${link.target_kind} ${link.target_id}${link.target_instant === null ? '' : ` at ${link.target_instant.toISOString()}`}` },
    target: { table: 'planned_item_links', id: link.id },
    payload: { before: { kind: link.target_kind, id: link.target_id, instant: link.target_instant === null ? null : link.target_instant.toISOString(), journal_entry_id: link.journal_entry_id, amountCents: amountCentsOf(link.journal_entry) } },
  });
  return NextResponse.json({ unlinked: journalEntryId });
}
