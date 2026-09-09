import { getVerifiedEmail } from '@/lib/cookie-auth';
import ShellFrame from '@/components/ui/ShellFrame';
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
  return (
    <ShellFrame viewer={viewer ?? ''}>
      <AccountsClient />
    </ShellFrame>
  );
}
