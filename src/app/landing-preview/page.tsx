'use client';

/**
 * /landing-preview (FD-1) — the SCRATCH route for Alex's visual gate on the
 * assembled Landing. Deliberately NOT added to middleware PUBLIC_PATHS: Alex
 * previews it while authed; a logged-out guest hitting this URL is redirected
 * to '/' by the middleware's default unauth handling — guests never see the
 * scratch route. Routing the real arrival (page.tsx guest/authed branch) is
 * FD-2, where onRequireAuth becomes the real register-modal opener.
 *
 * The stub below is the FD-1 audit's mechanism pick (option a): Landing takes
 * one onRequireAuth callback; here it routes to /pricing — a real, public
 * auth-adjacent surface — so every ask CTA does something honest in preview
 * without building any new auth UI.
 */

import Landing from '@/components/landing/Landing';

export default function LandingPreviewPage() {
  return <Landing onRequireAuth={() => { window.location.href = '/pricing'; }} />;
}
