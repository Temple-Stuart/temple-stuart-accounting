/**
 * Shared Travel-section primitives (PR-A — pure extraction, no visual change).
 *
 * The public Travel search sections (PublicFlightSearch / PublicHotelSearch /
 * PublicActivitySearch / PublicVisaCheck, + the ComingSoonSection placeholders)
 * were hand-rolled and copy-converged: each repeats the SAME section-header markup,
 * and the input + button class strings are duplicated verbatim across files. This
 * module is the single source of truth for those three pieces so the sections can
 * stop duplicating them (consumption happens in PR-B; this PR only adds them).
 *
 * BOOK-1b: the shell + shared input/button moved to the compact Bloomberg
 * skin (the LandingSearchTeaser reference vocabulary — dark bg-white/10
 * fields, white/brand-purple buttons, panel hairlines). The app's travel tab
 * inherits this skin — ruled-desired as FD-3's first installment. Tokens
 * only; nothing new is invented.
 *
 * COMPACT-1: the shell adopts the teaser's FORM FACTOR — each section is one
 * bordered panel strip (the teaser's container: rounded border-panel-border
 * bg-white/5 p-4) headed by a single mono micro-label row (title + optional
 * badge + a one-line explainer), replacing the divider-and-paragraph header
 * block. TRAVEL_LABEL_CLASS is the teaser's LABEL_CLASS verbatim, exported so
 * every field label above an input shares the one vocabulary.
 */

import type { ReactNode } from 'react';

/** The shared input/select class. PR-STRIP-DESIGN-2: stepped up ONE grade
 *  (py-2 → py-3, rounded → rounded-lg — the "large, rounded" field spec on
 *  the same tokens; text-sm stays: nothing measured cramped at it). Every
 *  consumer inherits — the strip forms, the unified bar, the checkout
 *  panels. */
export const TRAVEL_INPUT_CLASS =
  'bg-white/10 border border-white/20 rounded-lg px-3 py-3 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/40';

/** The shared submit-button class. PR-STRIP-DESIGN-2: the big confident
 *  Search — px-8 py-3, white text. PALETTE-OVERHAUL (D): the fill is the one
 *  CTA gradient (.ts-cta-gradient, globals.css — pop → grad-mid → grad-end)
 *  with hover:brightness-110. Consumers are the strip-family CTAs only (the
 *  five search/check buttons, the category unlock, the unified "Search all")
 *  — the checkout panels don't import it. */
export const TRAVEL_BUTTON_CLASS =
  'rounded-lg ts-cta-gradient px-8 py-3 text-sm font-medium text-white transition-colors hover:brightness-110 disabled:opacity-50';

/** The mono micro-label rendered ABOVE each search field — the deleted teaser's
 *  LABEL_CLASS verbatim (LandingSearchTeaser.tsx@840a053b). */
export const TRAVEL_LABEL_CLASS =
  'font-mono text-[10px] font-semibold uppercase tracking-wider text-white/50';

/** PR-STRIP-DESIGN-2: the icon-inside-field wrapper (the trip.com field
 *  anatomy) — a muted lucide icon pinned to the field's left edge. ADDITIVE:
 *  wrap any input/select and give it `pl-10` (+ `w-full` inside the relative
 *  box); unwrapped fields render exactly as before. Icon = caller-supplied
 *  ~16px lucide node in the faint rung (text-white/40). */
export function TravelField({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/40" aria-hidden="true">
        {icon}
      </span>
      {children}
    </div>
  );
}

interface TravelSectionShellProps {
  /** Short section name, rendered as the strip's mono micro-label (COMPACT-1).
   *  With hideHeader it still renders — screen-reader-only. */
  title: string;
  /** ONE short line beside the title — wraps inside the same header row. */
  explainer: string;
  /** Optional pill/badge shown inline beside the title (e.g. ComingSoonSection's
   *  "Coming soon" tag). Flows in the same header row. */
  badge?: ReactNode;
  /** PR-STRIP-DESIGN-1: the strip's tab + per-mode explainer line carry this
   *  section's identity now — the single-mode strip panels pass hideHeader so
   *  the card reads clean (title stays, sr-only). Multi-card consumers
   *  (PublicCategorySearch's per-category cards) keep the visible header. */
  hideHeader?: boolean;
  /** The section body (form / results), slotted below the header row inside the
   *  strip's `space-y-3`. */
  children?: ReactNode;
}

/**
 * The shared section strip (COMPACT-1: the teaser's form factor). One bordered
 * panel — PR-STRIP-DESIGN-1 elevated it one surface step (bg-white/5 →
 * bg-panel-surface, the ds.ts SURFACE.card family) so the active search reads
 * as ONE clean card inside the strip. Header: the mono micro-label title, the
 * optional badge, and the one-line explainer, all inline (wrapping on narrow
 * screens) — or sr-only title when hideHeader (see the prop note). The body
 * slots directly beneath. The `mt-4` keeps strips separated where no parent
 * `space-y` exists (the app travel tab stacks these as plain siblings).
 */
export default function TravelSectionShell({ title, explainer, badge, hideHeader, children }: TravelSectionShellProps) {
  return (
    <div className="mt-4 rounded-lg border border-panel-border bg-panel-surface p-4 space-y-3">
      {hideHeader ? (
        <p className="sr-only">{title}</p>
      ) : (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <p className={TRAVEL_LABEL_CLASS}>{title}</p>
          {badge}
          <p className="text-[10px] text-white/40">{explainer}</p>
        </div>
      )}
      {children}
    </div>
  );
}
