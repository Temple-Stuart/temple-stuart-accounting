'use client';

/**
 * GuestLanding (FD-2) — the client wrapper the arrival branch renders for
 * VERIFIED-guest arrivals on bare '/': the Landing with REAL wiring.
 *
 *   • entitlementAvailability arrives server-computed from page.tsx (the same
 *     env-only map landing-preview computed; /pricing/page.tsx:15-24 pattern);
 *   • onRequireAuth opens the REAL LoginBox in REGISTER mode — the modal
 *     markup mirrors the home shell's own mount (HomeClient :262-274 — same
 *     backdrop, same props).
 *
 * NO LOOP by construction: LoginBox onSuccess reloads '/'; a successful
 * login/registration set the signed userEmail cookie, so the server branch
 * now VERIFIES the arrival and renders <HomeClient/> — the Landing renders
 * only while verification fails, so a logged-in user can never be handed the
 * Landing again by this path.
 */

import { useState } from 'react';
import Landing from './Landing';
import LoginBox from '@/components/LoginBox';

export default function GuestLanding({ entitlementAvailability }: {
  entitlementAvailability: Record<string, boolean>;
}) {
  const [showLogin, setShowLogin] = useState(false);

  return (
    <>
      <Landing
        entitlementAvailability={entitlementAvailability}
        onRequireAuth={() => setShowLogin(true)}
      />
      {showLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowLogin(false)} />
          <div className="relative z-10">
            <LoginBox
              onClose={() => setShowLogin(false)}
              onSuccess={() => { window.location.href = '/'; }}
              redirectTo="/"
              initialMode="register"
            />
          </div>
        </div>
      )}
    </>
  );
}
