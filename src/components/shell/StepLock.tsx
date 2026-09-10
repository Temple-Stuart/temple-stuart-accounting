'use client';

/**
 * SHELL-02 — THE ONE LOCK. Wherever a step's screen or its data is refused for
 * want of an entitlement, the viewer sees THIS card: the step's name, one line
 * saying which module unlocks it, and the buy affordance the offer already
 * provides. Never an HTTP status, never a stack.
 *
 * It is a thin wrapper over LockedTabCard (SELL-02) — the buy surface the
 * cockpit tabs have always rendered — so nothing about the offer, the price
 * line or the checkout call is retyped here. When no price is set, the card
 * says "Not for sale yet — no price is set." because offer.ts:208 says so.
 */
import { LockedTabCard } from '@/components/home/LockedTabCard';
import type { Step } from '@/lib/steps';
import { TOOL_GATE } from '@/lib/offer';
import type { ToolName } from '@/lib/problemSheet';

export default function StepLock({
  step,
  tabKey,
  currentUserId,
  onRequireAuth,
  offerAvailability,
}: {
  /** The step being refused — its name and jobs are the card's subject. */
  step: Step;
  /** The entitlement key the refusal was about (tab:books, tab:trade, …). */
  tabKey: string;
  currentUserId: string;
  onRequireAuth: () => void;
  offerAvailability: Readonly<Record<string, boolean>>;
}) {
  const gated = step.tools.filter((t) => TOOL_GATE[t as ToolName] === tabKey);
  return (
    <section className="mx-auto max-w-2xl" data-step-lock={step.slug}>
      <header className="mb-4">
        <p className="font-mono text-[10px] sm:text-xs uppercase tracking-[0.2em] text-text-faint">
          Step {step.number} <span className="text-brand-gold">·</span> {step.family.toLowerCase().replace(/^./, (c) => c.toUpperCase())}
        </p>
        <h1 className="mt-1 text-xl sm:text-2xl font-semibold tracking-tight text-text-primary">{step.name}</h1>
        <p className="mt-1 text-xs text-text-muted">
          {gated.length > 0
            ? `${gated.join(', ')} ${gated.length === 1 ? 'is' : 'are'} part of a module you do not hold yet.`
            : 'This step is part of a module you do not hold yet.'}
        </p>
      </header>
      <LockedTabCard
        tabKey={tabKey}
        currentUserId={currentUserId}
        onRequireAuth={onRequireAuth}
        offerAvailability={offerAvailability}
      />
    </section>
  );
}

/** Does this failure line describe an ENTITLEMENT refusal rather than a fault? */
export function isEntitlementRefusal(status: number): boolean {
  return status === 403;
}
