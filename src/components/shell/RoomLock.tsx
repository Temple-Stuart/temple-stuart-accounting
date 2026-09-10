'use client';

/**
 * LOCK-01 — THE ONE LOCKED MECHANISM.
 *
 * A locked step shows ITS OWN ROOM, not a sales pitch. The room's shell, header,
 * phase strip and empty state render exactly as they do for an entitled viewer
 * with no data; everything that would WRITE or SPEND is dead.
 *
 * WHY THIS SHAPE — a wrapper with `inert`, not a prop threaded through the rooms:
 * the rooms are deep trees (BooksPipeline → six phases → forms; TaxFilingWizard →
 * its steps; the trading cockpit → scanner, chains, lab). Threading a `locked`
 * prop to every button would mean editing every room's body, and DS-02 owns
 * interiors — LOCK-01 is forbidden from redesigning them. `inert` disables the
 * whole subtree at the DOM level: no click, no focus, no submit, no keyboard
 * reach, and it is the platform's own answer rather than a CSS trick that a
 * determined tab-key defeats. One wrapper, zero edits inside any room.
 *
 * WHAT IT COSTS, said plainly: `inert` is indiscriminate — read-only affordances
 * inside the room (a phase strip you could click, a disclosure) go quiet too.
 * The room still RENDERS in full; it is frozen, not hidden. That is the honest
 * trade for not touching six room bodies, and DS-02 can refine it per room.
 *
 * The context is exported alongside so a room that WANTS to know (to soften a
 * label rather than be frozen) can read it without any wrapper change.
 */
import { createContext, useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { isTabLocked } from '@/lib/categoryLock';
// LAUNCH-01 LAPSE-01: a lapsed subscriber reads when and why it ended. That line
// used to ride the offer card; it rides the inline note now rather than dying.
import { lapsedLine, type LapseReason } from '@/lib/lapse';

const RoomLockContext = createContext(false);

/**
 * LOCK-01: the CLIENT gate for a room whose page is a client component. It asks
 * the SAME question the tab asks, with the SAME helper — isTabLocked over
 * /api/auth/me's entitledCategories and the server's isAdmin verdict
 * (ModuleLauncher.tsx:340-341 does exactly this). A server page uses roomGate
 * (src/lib/roomGate.ts → hasTabAccess); both resolve through keysGranting, so
 * the two twins cannot disagree.
 *
 * Until the read lands it returns LOCKED — the fallback tripwire: a room is
 * never open on a guess. A failed read stays locked and says so.
 */
export function useTabLock(tabKey: string): { locked: boolean; resolved: boolean } {
  const [state, setState] = useState<{ locked: boolean; resolved: boolean }>({ locked: true, resolved: false });
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' });
        if (!res.ok) { if (live) setState({ locked: true, resolved: true }); return; }
        const body = (await res.json()) as { user?: { isAdmin?: boolean; entitledCategories?: string[] } };
        const keys = body.user?.entitledCategories ?? [];
        if (live) setState({ locked: isTabLocked(tabKey, keys, Boolean(body.user?.isAdmin)), resolved: true });
      } catch {
        if (live) setState({ locked: true, resolved: true });
      }
    })();
    return () => { live = false; };
  }, [tabKey]);
  return state;
}

/** Is the room this component sits in locked? False everywhere it is not provided. */
export function useRoomLock(): boolean {
  return useContext(RoomLockContext);
}

/**
 * THE ONE INLINE NOTE. One short line, one link to /pricing. No price, no
 * billing copy, no offer card — the offer lives at /pricing and on the deck.
 */
export function LockedNote({ stepName, lapsed }: { stepName?: string; lapsed?: { endedAt: string; reason: LapseReason } | null }) {
  return (
    <p className="mb-3 flex flex-wrap items-center gap-2 font-mono text-[11px] text-text-secondary" data-locked-note>
      <Lock className="h-3.5 w-3.5 shrink-0 text-brand-purple" strokeWidth={2} aria-hidden="true" />
      <span data-lapsed={lapsed ? lapsed.reason : undefined}>
        {lapsed
          ? `${lapsedLine(lapsed)} ${stepName ? `${stepName} is read-only.` : 'Read-only.'}`
          : `${stepName ? `${stepName} is read-only` : 'Read-only'} — you do not hold the module that unlocks it.`}{' '}
        <Link href="/pricing" className="underline decoration-dotted underline-offset-2 hover:text-text-primary">
          See what unlocks it
        </Link>
      </span>
    </p>
  );
}

/**
 * Wrap a room. Locked → the note above it and the room frozen below.
 * Unlocked → the children, untouched, with no wrapper behaviour at all.
 */
export default function RoomLock({ locked, stepName, lapsed = null, children }: {
  locked: boolean;
  stepName?: string;
  /** LAPSE-01: the most recent ended subscription among the keys granting this step, or null. */
  lapsed?: { endedAt: string; reason: LapseReason } | null;
  children?: React.ReactNode;
}) {
  if (!locked) return <RoomLockContext.Provider value={false}>{children}</RoomLockContext.Provider>;
  return (
    <RoomLockContext.Provider value={true}>
      <div data-room-locked="true">
        <LockedNote stepName={stepName} lapsed={lapsed} />
        {/* inert: the whole room is non-interactive. It still renders in full —
            a locked viewer sees the product, not a pitch. */}
        {/* React 18 does not type `inert`, so it is set through the DOM ref —
            the attribute is what browsers act on, not React's prop table. */}
        <div ref={(el) => { if (el) el.setAttribute('inert', ''); }} className="opacity-70" aria-label="Locked — read-only">
          {children}
        </div>
      </div>
    </RoomLockContext.Provider>
  );
}
