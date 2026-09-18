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
 * confirms the row exists). No paid service is reached at all.
 *
 * IT WRITES NOTHING BUT THE LINK. No posting is altered, no journal entry is
 * touched, no task's actual_cost_usd is overwritten. The Books commit flow is
 * not in this file.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { LINKABLE_KINDS, isLinkableKind, requiresInstant } from '@/lib/calendar/linkKeys';

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

/**
 * The amount of a posting, in cents, or NULL when it cannot be read.
 *
 * EDGE-01 found the opposite of this at src/app/api/trade-card-links/route.ts:80
 * and :255 — `sum + (p.realized_pl ?? 0)` silently counts an unknown as zero. A
 * posting with no readable debit line returns NULL here and is REPORTED by the
 * leaf, never summed.
 */
function amountCentsOf(entry: { ledger_entries: { entry_type: string; amount: bigint }[] }): number | null {
  const debit = entry.ledger_entries.find((l) => l.entry_type === 'D');
  if (!debit) return null;
  const n = Number(debit.amount);
  return Number.isFinite(n) ? n : null;
}

const ENTRY_SELECT = {
  id: true, date: true, description: true,
  ledger_entries: { select: { entry_type: true, amount: true } },
} as const;

type EntryRow = { id: string; date: Date; description: string; ledger_entries: { entry_type: string; amount: bigint }[] };

const asPosting = (e: EntryRow) => ({
  journalEntryId: e.id,
  date: e.date.toISOString().slice(0, 10),
  description: e.description,
  amountCents: amountCentsOf(e),
});

/** The (kind, id, instant) triple, validated. Returns the reason on refusal. */
function readTarget(kind: string | null, id: string | null, instant: string | null):
  { ok: true; kind: string; id: string; instant: Date | null } | { ok: false; reason: string } {
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
        },
        select: ENTRY_SELECT,
        orderBy: { date: 'desc' },
        take: CANDIDATE_LIMIT,
      });
      candidates = rows.map(asPosting);
    }
  }

  return NextResponse.json({
    links: links.map((l) => {
      const e = linkedEntries.find((x) => x.id === l.journal_entry_id);
      // A link whose entry cannot be read keeps its id and reports a NULL
      // amount — the leaf excludes it from the sum and names it. It is never
      // counted as zero (the EDGE-01 bug, done the other way round).
      const posting = e ? asPosting(e) : { journalEntryId: l.journal_entry_id, date: null, description: null, amountCents: null };
      return { ...posting, linkedAt: l.linked_at.toISOString(), linkedBy: l.linked_by };
    }),
    candidates,
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

  // The posting must be THIS user's. Someone else's resolves to a defensive 404.
  const entry = await prisma.journal_entries.findFirst({
    where: { id: body.journalEntryId, userId: user.id },
    select: { id: true },
  });
  if (!entry) return NextResponse.json({ error: 'No such posting' }, { status: 404 });

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
  return NextResponse.json({ link: { journalEntryId: link.journal_entry_id, linkedAt: link.linked_at.toISOString() } }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const user = await caller();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const journalEntryId = request.nextUrl.searchParams.get('journalEntryId');
  if (!journalEntryId) return NextResponse.json({ error: 'journalEntryId is required' }, { status: 400 });

  // Scoped by user_id: another user's link is invisible, so this is a 404.
  const removed = await prisma.planned_item_links.deleteMany({
    where: { journal_entry_id: journalEntryId, user_id: user.id },
  });
  if (removed.count === 0) return NextResponse.json({ error: 'No such link' }, { status: 404 });
  return NextResponse.json({ unlinked: journalEntryId });
}
