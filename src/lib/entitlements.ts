import { prisma } from '@/lib/prisma';
import { ADMIN_USER_ID } from '@/lib/tiers';

// Server-side single source of the 9 Google category keys eligible for per-category
// entitlement. MUST stay in sync with getGooglePlaceCatKeys() in
// src/components/trips/TripPlannerAI.tsx:1020-1037 — that list lives in a 'use client'
// module and can't be imported server-side, so the admin-all case needs this server const.
export const GOOGLE_CATEGORY_KEYS = [
  'brunch_coffee',
  'dinner',
  'nightlife',
  'coworking',
  'gyms',
  'sports',
  'groceries',
  'shopping',
  'festivals',
] as const;

/**
 * The Google category keys this user is CURRENTLY entitled to: rows with status 'active'
 * whose entitlement has not expired (currentPeriodEnd is null OR in the future).
 *
 * Admin (ADMIN_USER_ID) gets ALL Google keys — mirrors the admin bypass in tiers.ts:68.
 *
 * Fail-loud: a DB error PROPAGATES (no try/catch here). We never return a silent [] —
 * that would falsely lock every category and hide the failure. The caller's error path
 * surfaces the real error.
 */
export async function getEntitledCategories(userId: string): Promise<string[]> {
  if (userId === ADMIN_USER_ID) return [...GOOGLE_CATEGORY_KEYS];

  const now = new Date();
  const rows = await prisma.userCategoryEntitlement.findMany({
    where: {
      userId,
      status: 'active',
      OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: now } }],
    },
    select: { categoryKey: true },
  });
  return rows.map((r) => r.categoryKey);
}
