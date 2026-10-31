'use client';

import LoginBox from '@/components/LoginBox';

/**
 * /login — SELL-03: the one sign-in box, standalone. Sign in, create an
 * account (the "Sign up free" switch is the register link), or continue
 * with Google / GitHub; every completion lands on /answers, the one front
 * door (LoginBox). Nothing here fetches, nothing costs.
 */
export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-row p-4" data-login-page>
      <LoginBox />
    </div>
  );
}
