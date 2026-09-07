import { getVerifiedEmail } from '@/lib/cookie-auth';
import FamilyPage from '@/components/home/FamilyPage';

/**
 * NAV-02 — /what-you-owe, the WHAT YOU OWE family page: the map of the family's tools
 * (src/lib/toolRegistry.ts FAMILY_PAGES; one card per tool from familyCards()).
 * Auth: a protected path — middleware (src/middleware.ts) bounces an unverified
 * visitor to '/' before this renders; the verified cookie names the viewer for
 * the shell bar only, and nothing here touches the database (the /answers shape).
 */
export const dynamic = 'force-dynamic';

export default async function WhatYouOwePage() {
  const viewer = await getVerifiedEmail();
  return <FamilyPage family="WHAT YOU OWE" viewer={viewer ?? ''} />;
}
