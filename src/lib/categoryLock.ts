import { GOOGLE_CATEGORY_KEYS } from '@/lib/categoryKeys';
import { ADMIN_USER_ID } from '@/lib/tiers';
// SELL-02: which keys unlock a tab is the OFFER's say — the same keysGranting the server gate reads.
import { keysGranting } from '@/lib/offer';

// PR-B: per-category lock. A Google catKey is LOCKED unless the user is entitled to it.
// Admin is never locked; commission catKeys (not in GOOGLE_CATEGORY_KEYS) are never locked.
// Single source of truth used by BOTH the trip-page section render (TripApiSection) + its
// zero-spend scan-dispatcher skip (autoScanCategoriesFor) AND the homepage category sections.
//
// PRISMA-FREE / client-safe: imports only categoryKeys.ts (prisma-free) and tiers.ts (zero
// imports). No server-only deps — importable from any 'use client' component.
export const GOOGLE_CAT_SET = new Set<string>(GOOGLE_CATEGORY_KEYS);

export function isCategoryLocked(catKey: string, entitledCategories: string[], currentUserId: string): boolean {
  if (currentUserId === ADMIN_USER_ID) return false;   // admin sees everything unlocked
  if (!GOOGLE_CAT_SET.has(catKey)) return false;        // commission categories stay free
  return !entitledCategories.includes(catKey);          // Google cat: locked unless entitled
}

// TAB-SHOW-AND-GATE: per-TAB lock, the client-side twin of hasTabAccess
// (src/lib/entitlements.ts). A tab is LOCKED unless the user holds a key that
// grants it — the specific tab key, the all-tabs bundle, or an offer that
// grants it (SELL-02 keysGranting: Books grants Trade, Tax and Compliance) —
// among their active entitlement keys, which /api/auth/me already delivers
// verbatim (getEntitledCategories returns every active row's key unfiltered,
// so tab:/bundle: keys ride the existing payload). Admin bypass mirrors
// isCategoryLocked above (same ADMIN_USER_ID comparison the server uses for
// isAdmin). FALLBACK TRIPWIRE: no key match → locked, always — there is no
// default-unlock path.
export function isTabLocked(tabKey: string, entitledKeys: string[], currentUserId: string): boolean {
  if (currentUserId === ADMIN_USER_ID) return false;   // admin sees everything unlocked
  return !keysGranting(tabKey).some((k) => entitledKeys.includes(k));
}
