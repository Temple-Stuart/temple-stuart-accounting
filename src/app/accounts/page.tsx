import AppLayout from '@/components/ui/AppLayout';
import AccountsClient from '@/components/accounts/AccountsClient';

/**
 * ACCOUNTS-01 → LOCK-01 — /accounts, THE RAIL'S STEP 1 SCREEN. The shell (and
 * with it the rail) is mounted here; AppLayout reads the viewer itself. Every
 * account read happens in the client component against the already-authed,
 * user-scoped /api/accounts, and a 403 from that gate renders the room's EMPTY
 * state under the locked note — never an error, never an HTTP status.
 *
 * Auth: a protected path — middleware bounces an unverified visitor to '/'
 * before this renders.
 */
export const dynamic = 'force-dynamic';

export default function AccountsPage() {
  return (
    <AppLayout page>
      <AccountsClient />
    </AppLayout>
  );
}
