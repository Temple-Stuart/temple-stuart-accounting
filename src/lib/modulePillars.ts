// MOD-1: the pillar registry extracted to a shared LEAF module (zero imports,
// no 'use client' — server-safe AND client-safe), the tabDescriptors.ts
// precedent. Previously defined inside ModulePageClient.tsx ('use client'),
// which made every export a client reference in the RSC layer — the server
// page's PILLARS.find() threw "PILLARS.find is not a function" at request
// time, 500ing ALL NINE /modules/<id> pages and the unknown-id 404 path (the
// MOD-0 diagnosis, reproduced). Two consumers import the ONE source:
// modules/[pillar]/page.tsx (server — id validation) and ModulePageClient.tsx
// (client — the PillarDef prop type).

export interface PillarDef {
  id: string;
  label: string;
  /** TAB_DESCRIPTORS key (differs from id only for runway → 'calendar'). */
  tab: string;
  /** TAB_PRICING entitlement key — the four paid pillars only. */
  entitlementKey?: string;
}

// The nine pillars — ids are the /modules/<id> route segments (funnel order).
export const PILLARS: PillarDef[] = [
  { id: 'travel', label: 'Travel', tab: 'travel' },
  { id: 'runway', label: 'Runway', tab: 'calendar' },
  { id: 'books', label: 'Books', tab: 'books', entitlementKey: 'tab:books' },
  { id: 'trade', label: 'Trade', tab: 'trade', entitlementKey: 'tab:trade' },
  { id: 'tax', label: 'Tax', tab: 'tax', entitlementKey: 'tab:tax' },
  { id: 'compliance', label: 'Compliance', tab: 'compliance', entitlementKey: 'tab:compliance' },
  { id: 'routines', label: 'Routines', tab: 'routines' },
  { id: 'projects', label: 'Projects', tab: 'projects' },
  { id: 'content', label: 'Content', tab: 'content' },
];
