'use client';

// MOD-2: the pointer-card — marketing slides live in exactly ONE home
// (/modules/<pillar>), so the app's guest/locked tab bodies point there
// instead of mounting full decks (Alex's ruling; ModuleLauncher sheds its
// deck import graph). Descriptor-only by the MOD-2 audit call: the pillar
// bullets live in Landing.tsx's PILLAR_CARDS, whose extraction was out of
// this PR's ruled scope (0 lines on Landing) and duplicating the strings is
// banned — the descriptor line from the one shared leaf is the copy.
// Token-native panel chrome (the house Bloomberg family); zero fetches.

import Link from 'next/link';
import { PILLARS } from '@/lib/modulePillars';
import { TAB_DESCRIPTORS } from '@/lib/tabDescriptors';

export default function ModulePointerCard({ pillarId }: { pillarId: string }) {
  const pillar = PILLARS.find((p) => p.id === pillarId);
  if (!pillar) {
    // Fail loud: the nine call sites pass static ids from the PILLARS
    // registry — an unknown id is a programming error, never a render state.
    throw new Error(`ModulePointerCard: unknown pillar id "${pillarId}"`);
  }
  return (
    // REPAINT-3 → 4b: the glow died — flat white card + lavender hairline;
    // the pillar label is the card's heading (aubergine structure ink) and
    // the CTA is the aubergine ghost (navigational, not money).
    <div className="rounded-lg border border-border bg-white p-5">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-brand-purple">
        {pillar.label}
      </p>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
        {TAB_DESCRIPTORS[pillar.tab]}
      </p>
      <Link
        href={`/modules/${pillar.id}`}
        className="mt-4 inline-block rounded border border-brand-purple/40 px-3 py-1.5 font-mono text-xs font-medium text-brand-purple hover:bg-brand-purple-wash"
      >
        See how {pillar.label} works →
      </Link>
    </div>
  );
}
