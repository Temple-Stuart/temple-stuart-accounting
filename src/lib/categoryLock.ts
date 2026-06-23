import { GOOGLE_CATEGORY_KEYS } from '@/lib/categoryKeys';
import { ADMIN_USER_ID } from '@/lib/tiers';

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
