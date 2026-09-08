// SELL-02: which keys unlock a tab is the OFFER's say — the same keysGranting the server gate reads.
import { keysGranting } from '@/lib/offer';

// TAB-SHOW-AND-GATE: per-TAB lock, the client-side twin of hasTabAccess
// (src/lib/entitlements.ts). A tab is LOCKED unless the user holds a key that
// grants it — the specific tab key, the all-tabs bundle, or an offer that
// grants it (SELL-02 keysGranting: Books grants Trade, Tax and Compliance) —
// among their active entitlement keys, which /api/auth/me already delivers
// verbatim (getEntitledCategories returns every active row's key unfiltered,
// so tab:/bundle: keys ride the existing payload). SELL-05b: the admin bypass
// is the SERVER's verdict — /api/auth/me's isAdmin flag (src/lib/admin.ts,
// ADMIN_USER_ID in the env) — never an id compared on the client. FALLBACK
// TRIPWIRE: no key match → locked, always — there is no default-unlock path.
//
// The per-CATEGORY lock (isCategoryLocked) left with the per-category gates:
// nothing sells a Google category key (SELL-05, SELL-05b).
//
// PRISMA-FREE / client-safe: imports only offer.ts (a leaf). No server-only deps.
export function isTabLocked(tabKey: string, entitledKeys: string[], isAdmin: boolean): boolean {
  if (isAdmin) return false;                            // the server said so
  return !keysGranting(tabKey).some((k) => entitledKeys.includes(k));
}
