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
  /** PR-DECK-CLEAN-1: the pillar-specific access sentence EVICTED from the
   *  landing deck's cards (the old PAID_* labels, minus the "A paid module —"
   *  lead the module page's paid block already states) — rendered there so
   *  the claim is preserved, not deleted. Claims stay the FD-1o
   *  gate-verified ones: Runway = /api/runway:38 DB-only ledger read;
   *  Routines = enrich-routine/route.ts:42 requireTier('ai'); Projects =
   *  requirePipeBudget, default cap 20 (pipeBudget.ts:15); Content =
   *  generate-script/route.ts:53 requireTier('ai'). Travel's equivalent
   *  already lives in ModulePageClient's travel branch. */
  accessNote?: string;
}

// The nine pillars — ids are the /modules/<id> route segments. Array order
// never renders (every consumer is a find-by-id); the canonical display
// order lives in Landing.tsx PILLAR_CARDS (MODULE-ORDER lifecycle ruling).
export const PILLARS: PillarDef[] = [
  { id: 'travel', label: 'Travel', tab: 'travel' },
  { id: 'runway', label: 'Runway', tab: 'calendar',
    accessNote: 'Its numbers come from your ledger, so it’s most useful with Books.' },
  { id: 'books', label: 'Books', tab: 'books', entitlementKey: 'tab:books' },
  { id: 'trade', label: 'Trade', tab: 'trade', entitlementKey: 'tab:trade' },
  { id: 'tax', label: 'Tax', tab: 'tax', entitlementKey: 'tab:tax' },
  { id: 'compliance', label: 'Compliance', tab: 'compliance', entitlementKey: 'tab:compliance' },
  { id: 'routines', label: 'Routines', tab: 'routines',
    accessNote: 'Build & run routines. AI scene enrichment is a paid feature.' },
  { id: 'projects', label: 'Projects', tab: 'projects',
    accessNote: 'Includes the AI planning pipeline, capped at 20 runs/day.' },
  { id: 'content', label: 'Content', tab: 'content',
    accessNote: 'Day log & planning. AI script generation is a paid feature.' },
];
