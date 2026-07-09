import { prisma } from '@/lib/prisma';
import { ADMIN_USER_ID } from '@/lib/tiers';
import { GOOGLE_CATEGORY_KEYS, BUNDLE_ALL_KEY } from '@/lib/categoryKeys';

// The 9 Google category keys now live in the prisma-free src/lib/categoryKeys.ts so the
// client can import them too (this module imports prisma → server-only). Re-exported here so
// existing server importers of `GOOGLE_CATEGORY_KEYS` from '@/lib/entitlements' keep working.
export { GOOGLE_CATEGORY_KEYS };

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

/**
 * ENTITLEMENT-WRITER: does this user have USE access to a tab?
 * TRUE when the user holds an ACTIVE, non-expired entitlement row for either
 * the specific tab key (e.g. 'tab:trade') OR the all-tabs bundle
 * ('bundle:all') — one bundle purchase satisfies every tab check, resolved
 * here at read time (never fanned out into per-tab rows at write time).
 * Admin (ADMIN_USER_ID) always passes — mirrors getEntitledCategories above.
 *
 * Fail-loud: a DB error PROPAGATES (no try/catch). We never return a silent
 * false — that would hide the failure as a lock. And there is no default
 * grant: no row → false, always.
 */
export async function hasTabAccess(userId: string, tabKey: string): Promise<boolean> {
  if (userId === ADMIN_USER_ID) return true;

  const now = new Date();
  const row = await prisma.userCategoryEntitlement.findFirst({
    where: {
      userId,
      categoryKey: { in: [tabKey, BUNDLE_ALL_KEY] },
      status: 'active',
      OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: now } }],
    },
    select: { id: true },
  });
  return row !== null;
}
