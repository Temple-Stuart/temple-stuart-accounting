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

/** The shared input/select class — verbatim from the duplicated definitions in
 *  PublicHotelSearch.tsx:169-171 and PublicActivitySearch.tsx:74-76 (byte-identical
 *  there). One space between `text-text-primary` and `focus:outline-none`, matching
 *  the original two-string concatenation. */
export const TRAVEL_INPUT_CLASS =
  'bg-white/10 border border-white/20 rounded px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/40';

/** The shared submit-button class — verbatim from PublicHotelSearch.tsx:215,
 *  PublicActivitySearch.tsx:108, and PublicVisaCheck.tsx:128 (identical in all three). */
export const TRAVEL_BUTTON_CLASS =
  'rounded bg-white px-4 py-2 text-sm font-medium text-brand-purple transition-colors hover:bg-bg-row disabled:opacity-50';

/** The mono micro-label rendered ABOVE each search field — the deleted teaser's
 *  LABEL_CLASS verbatim (LandingSearchTeaser.tsx@840a053b). */
export const TRAVEL_LABEL_CLASS =
  'font-mono text-[10px] font-semibold uppercase tracking-wider text-white/50';

interface TravelSectionShellProps {
  /** Short section name, rendered as the strip's mono micro-label (COMPACT-1). */
  title: string;
  /** ONE short line beside the title — wraps inside the same header row. */
  explainer: string;
  /** Optional pill/badge shown inline beside the title (e.g. ComingSoonSection's
   *  "Coming soon" tag). Flows in the same header row. */
  badge?: ReactNode;
  /** The section body (form / results), slotted below the header row inside the
   *  strip's `space-y-3`. */
  children?: ReactNode;
}

/**
 * The shared section strip (COMPACT-1: the teaser's form factor). One bordered
 * panel strip — `rounded-lg border-panel-border bg-white/5 p-4` — with a single
 * header row: the mono micro-label title, the optional badge, and the one-line
 * explainer, all inline (wrapping on narrow screens). The body slots directly
 * beneath. The `mt-4` keeps strips separated where no parent `space-y` exists
 * (the app travel tab stacks these as plain siblings).
 */
export default function TravelSectionShell({ title, explainer, badge, children }: TravelSectionShellProps) {
  return (
    <div className="mt-4 rounded-lg border border-panel-border bg-white/5 p-4 space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <p className={TRAVEL_LABEL_CLASS}>{title}</p>
        {badge}
        <p className="text-[10px] text-white/40">{explainer}</p>
      </div>
      {children}
    </div>
  );
}
