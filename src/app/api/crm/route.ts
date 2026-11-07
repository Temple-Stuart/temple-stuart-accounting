/**
 * GET /api/crm — THE CRM'S ONE READ: contacts, proposals and signups (CRM-01a, Alex, 2026-11-06, ruling C).
 *
 * Thin, the bill-pay GET's pattern: the caller first — a verified cookie or 401, the user or 404 (before any other read) —
 * then whose rows, decided here and never by anything the client sends:
 *   · THE PLATFORM OWNER (isAdminUser — ADMIN_USER_ID; unset, it throws AdminConfigError and this answers 500 with that
 *     message, never a quiet empty page) reads every proposals row and every users row but their own as their leads,
 *     plus their own crm_contacts rows;
 *   · ANY OTHER USER reads only their own crm_contacts rows, and the answer says ownerOnly: true — the page prints the
 *     honest lines for Proposals and Signups.
 * The rows go through the pure rules (src/lib/crm/crm.ts); a record that contradicts itself (a password-less user with
 * no provider account, an active key in no vocabulary, a need the form does not hold) is a CrmLawError, answered 500
 * with its words. Answers { ownerOnly, contacts, proposals, signups, said }. Reads only: no write, no paid service, no email.
 * Not in PUBLIC_PATHS — the middleware sends a cookie-less request to / before this runs.
 *
 * The password hash never leaves the database: whether a user has one is asked of the database (password = '').
 * An ACTIVE entitlement is entitlements.ts's own: status 'active' and not expired (currentPeriodEnd null or later).
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { AdminConfigError, isAdminUser } from '@/lib/admin';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { CrmLawError, contactsOf, proposalRowsOf, signupRowsOf, type ProposalRow, type SignupRow, type WorkingInput } from '@/lib/crm/crm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const owner = isAdminUser(user.id);

    // The server's day, read here once (the home page's way): the day a working row's last touch may not be after.
    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    // The reader's own working rows — every user's, owner or not; never another user's.
    const workingRows = await prisma.crm_contacts.findMany({
      where: { user_id: user.id },
      select: { id: true, source: true, source_ref: true, name: true, business: true, email: true, stage: true, next_step: true, last_touch_at: true, created_at: true },
    });
    const working: WorkingInput[] = workingRows.map((w) => ({ ...w, last_touch_at: w.last_touch_at?.toISOString() ?? null, created_at: w.created_at.toISOString() }));

    let proposals: ProposalRow[] = [];
    let signups: SignupRow[] = [];
    if (owner) {
      const [proposalRows, userRows, passwordless, providerUsers] = await Promise.all([
        prisma.proposals.findMany({
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, createdAt: true, name: true, email: true, business: true, need: true, modules: true, startWindow: true, budgetRange: true,
            currentStack: true, hardDeadline: true, deadlineDriver: true, links: true, teamSize: true, referralSource: true, notesFromThem: true,
          },
        }),
        prisma.users.findMany({
          where: { id: { not: user.id } },
          orderBy: { createdAt: 'desc' },
          select: { id: true, email: true, name: true, createdAt: true, email_verified_at: true },
        }),
        prisma.users.findMany({ where: { id: { not: user.id }, password: '' }, select: { id: true } }),
        prisma.user.findMany({ where: { email: { not: null } }, select: { email: true, accounts: { select: { provider: true } } } }),
      ]);
      const entitlements = await prisma.userCategoryEntitlement.findMany({
        where: { userId: { in: userRows.map((u) => u.id) }, status: 'active', OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: now } }] },
        select: { userId: true, categoryKey: true },
      });

      const noPassword = new Set(passwordless.map((u) => u.id));
      const providers = new Map<string, string[]>();
      for (const u of providerUsers) {
        const key = (u.email ?? '').trim().toLowerCase();
        providers.set(key, [...(providers.get(key) ?? []), ...u.accounts.map((a) => a.provider)]);
      }
      const activeKeys = new Map<string, string[]>();
      for (const e of entitlements) activeKeys.set(e.userId, [...(activeKeys.get(e.userId) ?? []), e.categoryKey]);

      proposals = proposalRowsOf(proposalRows.map((p) => ({
        id: p.id, created_at: p.createdAt.toISOString(), name: p.name, email: p.email, business: p.business, need: p.need, modules: p.modules,
        start_window: p.startWindow, budget_range: p.budgetRange, current_stack: p.currentStack,
        hard_deadline: p.hardDeadline === null ? null : p.hardDeadline.toISOString().slice(0, 10), deadline_driver: p.deadlineDriver,
        links: p.links, team_size: p.teamSize, referral_source: p.referralSource, notes_from_them: p.notesFromThem,
      })));
      signups = signupRowsOf({
        users: userRows.map((u) => ({
          id: u.id, email: u.email, name: u.name, created_at: u.createdAt.toISOString(), passwordless: noPassword.has(u.id),
          email_verified_at: u.email_verified_at?.toISOString() ?? null,
        })),
        providers,
        activeKeys,
        readerId: user.id,
      });
    }

    const contacts = contactsOf({ proposals, signups, working, today });
    return NextResponse.json({ ownerOnly: !owner, contacts, proposals, signups, said: [] as string[] });
  } catch (error) {
    if (error instanceof AdminConfigError || error instanceof CrmLawError) return NextResponse.json({ error: error.message }, { status: 500 });
    return failClosedResponse('CRM GET', 'Failed to load the CRM', error);
  }
}
