'use client';

/**
 * SHELL-02 — THE ONE PAGE OPENER. Every app page opens the same way, in the
 * shape /accounts already used: a "STEP N · FAMILY" eyebrow, the step's title,
 * and one line of what it is. It replaces the purple module band on the cockpit
 * tabs — the band is the deck's language and belongs to HOME and the deck.
 *
 * The line is DERIVED, never typed: the step's jobs and their registry statuses.
 * A caller with something truer to say passes `line`; nothing here invents copy.
 */
import { stepStatus, toolsOfStep, type Step } from '@/lib/steps';

/** "WHAT YOU OWN" → "What you own" — the eyebrow's sentence case, computed. */
function familyWord(family: string): string {
  return family.charAt(0) + family.slice(1).toLowerCase();
}

export function stepLine(step: Step): string {
  const tools = toolsOfStep(step);
  const status = stepStatus(step, tools);
  const names = tools.map((t) => t.name).join(', ');
  if (status === 'NOT_BUILT') return `${names} — not built yet.`;
  const live = tools.filter((t) => t.status === 'LIVE').length;
  return `${names}. ${live} of ${tools.length} finished.`;
}

export default function StepOpener({ step, line, actions }: {
  step: Step;
  /** A truer line than the derived one — the room's own words, never marketing. */
  line?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-5" data-step-opener={step.slug}>
      <p className="font-mono text-[10px] sm:text-xs uppercase tracking-[0.2em] text-text-faint">
        Step {step.number} <span className="text-brand-gold">·</span> {familyWord(step.family)}
      </p>
      <h1 className="mt-1 text-xl sm:text-2xl font-semibold tracking-tight text-text-primary">{step.name}</h1>
      <p className="mt-1 text-xs text-text-muted">{line ?? stepLine(step)}</p>
      {actions && <div className="mt-3 flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
