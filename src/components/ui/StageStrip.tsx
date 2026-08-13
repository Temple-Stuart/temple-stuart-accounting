'use client';

/**
 * StageStrip (PIPE-FRAME-1) — the numbered phase strip of the ratified Pipe
 * Frame; Trade is the first consumer. Composition per the 1A/1C mock sheets;
 * every color/type value from DS tokens (tailwind.config.ts brand/status/text
 * families) — nothing invented.
 *
 * States (the 1C sheet, with the ratified AMENDMENT): states are DERIVED
 * INDICATORS, never navigation locks — every real phase stays clickable
 * exactly like the tab control it replaces. "No hover, no cursor" on PENDING
 * is styling affordance only.
 *   done    — muted ink, gold ✓ sub-line, clickable
 *   active  — the ONLY purple-filled cell, ● YOU ARE HERE marker
 *   pending — faint ink
 *   blocked — faint ink + a --ts-danger sub-line signal (still clickable)
 * The optional link chip is a bordered mono chip that navigates (caller-owned
 * handler — no routing built here).
 *
 * Mobile: the strip is its own contained horizontal scroll region (the
 * landing-mobile-viewport pattern) — the page never scrolls sideways.
 */

export type StagePhaseState = 'done' | 'active' | 'pending' | 'blocked';

export interface StagePhase {
  key: string;
  /** Two-digit mono ordinal, e.g. "01". */
  num: string;
  /** Mono uppercase phase name. */
  label: string;
  state: StagePhaseState;
  /** blocked only: the danger sub-line's text. */
  blockedNote?: string;
  /** R2: the descriptive micro-label under the phase name — truth-backed
   *  copy supplied by the consumer. STATE SUB-LINES KEEP PRECEDENCE: when a
   *  state marker occupies the sub slot (● YOU ARE HERE / ✓ DONE / a
   *  blockedNote), the subLabel yields; it renders only on plain cells.
   *  Idiom = the strip's own faint mono micro tier (the num line's class). */
  subLabel?: string;
}

interface Props {
  phases: StagePhase[];
  onSelect: (key: string) => void;
  /** The link-chip terminal cell (e.g. "IN BOOKS →") — navigates via the
   *  caller's existing mechanism. */
  link?: { num: string; label: string; chip: string; onClick: () => void };
}

export default function StageStrip({ phases, onSelect, link }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-white">
      <div className="flex min-w-max divide-x divide-border">
        {phases.map((p) => {
          const active = p.state === 'active';
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => onSelect(p.key)}
              aria-current={active ? 'step' : undefined}
              className={`flex min-w-[104px] flex-1 flex-col items-start gap-0.5 px-4 py-2.5 text-left transition-colors ${
                active
                  ? 'bg-brand-purple'
                  : 'hover:bg-brand-purple-wash/40'
              }`}
            >
              <span className={`font-mono text-[9px] tracking-widest ${active ? 'text-white/60' : 'text-text-faint'}`}>
                {p.num}
              </span>
              <span
                className={`font-mono text-[11px] font-semibold uppercase tracking-wider ${
                  active
                    ? 'text-white'
                    : p.state === 'done'
                      ? 'text-text-secondary'
                      : 'text-text-faint'
                }`}
              >
                {p.label}
              </span>
              {active && (
                <span className="font-mono text-[9px] tracking-widest text-white/80">● YOU ARE HERE</span>
              )}
              {p.state === 'done' && (
                <span className="font-mono text-[9px] tracking-widest text-brand-gold">✓ DONE</span>
              )}
              {p.state === 'blocked' && p.blockedNote && (
                <span className="font-mono text-[9px] tracking-widest text-status-danger">{p.blockedNote}</span>
              )}
              {p.subLabel && !active && p.state !== 'done' && !(p.state === 'blocked' && p.blockedNote) && (
                <span className="font-mono text-[9px] tracking-widest text-text-faint">{p.subLabel}</span>
              )}
            </button>
          );
        })}
        {link && (
          <button
            type="button"
            onClick={link.onClick}
            className="flex min-w-[104px] flex-1 flex-col items-start gap-0.5 px-4 py-2.5 text-left transition-colors hover:bg-brand-purple-wash/40"
          >
            <span className="font-mono text-[9px] tracking-widest text-text-faint">{link.num}</span>
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-text-faint">{link.label}</span>
            <span className="mt-0.5 inline-block rounded border border-border px-1.5 font-mono text-[9px] tracking-widest text-brand-purple">
              {link.chip}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
