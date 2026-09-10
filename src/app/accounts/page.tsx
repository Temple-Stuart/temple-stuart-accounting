import { getVerifiedEmail } from '@/lib/cookie-auth';
import { prisma } from '@/lib/prisma';
// SHELL-02: the lock card renders the offer from the server's price-id presence map.
import { offerAvailabilityFromEnv } from '@/lib/offer';
import AppLayout from '@/components/ui/AppLayout';
import AccountsClient from '@/components/accounts/AccountsClient';

/**
 * ACCOUNTS-01 — /accounts, THE RAIL'S STEP 1 SCREEN. The shell (and with it the
 * rail) is mounted here, the way /step/[slug] does it: this page reads the
 * verified cookie for the shell bar's viewer and nothing else — every account
 * read happens in the client component, against the already-authed,
 * user-scoped /api/accounts.
 *
 * Auth: a protected path — middleware bounces an unverified visitor to '/'
 * before this renders.
 */
export const dynamic = 'force-dynamic';

export default async function AccountsPage() {
  const viewer = await getVerifiedEmail();
  // SHELL-02: the viewer's id, for the lock card's checkout door. No entitlement
  // is read here — the gate lives in /api/accounts, and a refusal renders the lock.
  const user = viewer
    ? await prisma.users.findFirst({ where: { email: { equals: viewer, mode: 'insensitive' } }, select: { id: true } })
    : null;
  return (
    <AppLayout page>
      <AccountsClient viewerId={user?.id ?? ''} offerAvailability={offerAvailabilityFromEnv(process.env)} />
    </AppLayout>
  );
}
