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

interface TravelSectionShellProps {
  /** Bold purple section header (the "PR-T-Headers" family). */
  title: string;
  /** One plain-language line under the header. */
  explainer: string;
  /** Optional pill/badge shown inline beside the title (e.g. ComingSoonSection's
   *  "Coming soon" tag). When omitted the header is byte-identical to the live
   *  search sections (plain title `<p>`); when present the title row matches
   *  ComingSoonSection's existing flex layout. */
  badge?: ReactNode;
  /** The section body (form / results), slotted below the header inside the same
   *  `space-y-4` wrapper — exactly where each section's form sits today. */
  children?: ReactNode;
}

/**
 * The shared section wrapper + header. Renders the EXACT markup the live sections
 * already produce: wrapper `mt-10 pt-8 border-t border-border space-y-4`, an inner
 * `<div>` holding the title `<p>` (text-lg font-bold text-brand-purple mb-1) and the
 * explainer `<p>` (text-xs text-text-muted), then `children` as the next sibling so
 * the wrapper's `space-y-4` spaces the header from the body — identical to e.g.
 * PublicHotelSearch.tsx:174-180 / PublicActivitySearch.tsx:79-86. With a `badge`, the
 * title row matches ComingSoonSection's flex-with-pill layout instead.
 */
export default function TravelSectionShell({ title, explainer, badge, children }: TravelSectionShellProps) {
  return (
    <div className="mt-8 pt-6 border-t border-panel-border space-y-4">
      <div>
        {badge ? (
          <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-sm font-medium text-white">{title}</p>
            {badge}
          </div>
        ) : (
          <p className="text-sm font-medium text-white mb-1">{title}</p>
        )}
        <p className="text-xs text-white/50">{explainer}</p>
      </div>
      {children}
    </div>
  );
}
