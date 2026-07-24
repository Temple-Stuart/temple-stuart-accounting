/**
 * ds.ts — the Temple Stuart design system, EXTRACTED from the landing shipped
 * today (DS-1). This is codification, not new design: every value below is a
 * verbatim class string already in production on the landing. No new hex, no
 * new colors — components import these instead of copy-pasting, so the app
 * speaks the landing's language on every page.
 *
 * Provenance is cited per constant. The token families (bg-panel*, brand-*,
 * white opacities) are defined in tailwind.config.ts / globals.css.
 */

/* ─── SURFACES ──────────────────────────────────────────────────────────────
 * The dark panel stack. Origin: HomeClient.tsx page div (bg-panel), the
 * COMPACT-1 section strips (bg-white/5), the trip components (bg-panel-surface),
 * and the landing hero glow (HERO_BG).
 */
export const SURFACE = {
  /** The page background. Origin: HomeClient.tsx:98 `min-h-screen bg-panel`. */
  page: 'bg-panel',
  /** A raised card. Origin: the trip components + CountryCityPicker dropdown
   *  (bg-panel-surface + border-panel-border). */
  card: 'rounded-lg border border-panel-border bg-panel-surface',
  /** A subtle inset / strip fill. Origin: the teaser + LandingBookingSection.tsx:65
   *  container (`bg-white/5`) and TravelSectionShell (COMPACT-1). */
  inset: 'bg-white/5',
  /** Row / control hover. Origin: HotelResultsView row `hover:bg-panel-hover`. */
  hover: 'bg-panel-hover',
} as const;

/** The hero radial glow, verbatim from Landing.tsx:472-474 (const HERO_BG) —
 *  token-native (rgb(var(--ts-purple)…)/var(--ts-panel)), zero hex. Applied via
 *  `style={{ background: HERO_BG }}` (Landing hero + DECK-2 mini-hero slides). */
export const HERO_BG =
  'radial-gradient(ellipse 80% 90% at 85% 10%, rgb(var(--ts-purple) / 0.65), transparent 60%), radial-gradient(ellipse 60% 70% at 100% 80%, rgb(var(--ts-purple-deep) / 0.5), transparent 55%), var(--ts-panel)';

/* ─── TYPE ───────────────────────────────────────────────────────────────────
 * Scale + the white-opacity ladder. Origin: the landing hero (display), the
 * deck headings (section), COMPACT-1 (micro-label), and the ladder used across
 * every landing surface.
 */
export const TYPE = {
  /** Hero display. Origin: Landing.tsx hero h1 `text-4xl lg:text-5xl font-light
   *  tracking-tight`; the app hero compacts this (FD-3-1) to 2xl/3xl. */
  display: 'text-2xl lg:text-3xl font-light tracking-tight',
  /** Section heading. Origin: the deck header h2 `text-lg font-light tracking-tight`. */
  heading: 'text-lg font-light tracking-tight text-white',
  /** Default body copy. */
  body: 'text-sm text-white/70',
  /** Mono micro-label — the signature. Origin: TRAVEL_LABEL_CLASS
   *  (LandingSearchTeaser LABEL_CLASS, COMPACT-1) + every landing section eyebrow. */
  microLabel: 'font-mono text-[10px] font-semibold uppercase tracking-wider text-white/50',
} as const;

/**
 * The white-opacity ladder + WHEN each rung is used (codified from the landing):
 *   text-white      — primary content: headings, active values, headline bullets.
 *   text-white/70    — body copy, sub-copy under a headline (hero sub-copy).
 *   text-white/60    — secondary body: descriptors, explainer lines, meta.
 *   text-white/50    — micro-labels, muted captions, inactive-but-legible chrome.
 *   text-white/40    — faint: placeholders' cousins, "our cost:" trace lines, dashes.
 */
export const TEXT = {
  primary: 'text-white',
  body: 'text-white/70',
  secondary: 'text-white/60',
  muted: 'text-white/50',
  faint: 'text-white/40',
} as const;

/* ─── CONTROLS ───────────────────────────────────────────────────────────────
 * Origin: travelSection.ts (TRAVEL_INPUT_CLASS / _LABEL_CLASS / _BUTTON_CLASS)
 * and the LandingBookingSection toggle idiom. Kept byte-identical so the shared
 * primitives and travelSection stay in lockstep (travelSection re-exports the
 * same strings; a later PR can point it here).
 */
export const CONTROL = {
  /** Dark field. Origin: travelSection TRAVEL_INPUT_CLASS. */
  input:
    'bg-white/10 border border-white/20 rounded px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/40',
  /** Field micro-label (above the input). Origin: travelSection TRAVEL_LABEL_CLASS. */
  label: 'font-mono text-[10px] font-semibold uppercase tracking-wider text-white/50',
  /** Primary action — white on dark. Origin: travelSection TRAVEL_BUTTON_CLASS +
   *  the hero "Create free account". */
  primaryButton:
    'rounded bg-white px-4 py-2 text-sm font-medium text-brand-purple transition-colors hover:bg-bg-row disabled:opacity-50',
  /** Secondary / ghost. Origin: the hero "Clone it on GitHub ↗" + FlightPicker
   *  Clear button (`border border-white/30 text-white/70 hover:bg-white/10`). */
  ghostButton:
    'rounded border border-white/30 px-4 py-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/10',
} as const;

/** Toggle chip — active = white-on-purple, inactive = bordered ghost. Verbatim
 *  from LandingBookingSection.tsx:54-57 (the teaser toggle idiom). */
export function toggleChip(active: boolean): string {
  return `px-3 py-1.5 font-mono text-xs font-medium ${
    active ? 'bg-white text-brand-purple' : 'border border-white/30 text-white/70 hover:bg-white/10'
  }`;
}

/** Checkbox idiom. Origin: the FD-1i selection slides `accent-brand-purple`. */
export const CHECKBOX = 'h-3.5 w-3.5 accent-brand-purple';

/* ─── DATA DISPLAY ───────────────────────────────────────────────────────────
 * List-row rhythm + numerals + table headers. Origin: HotelResultsView /
 * ActivityResultsView (COMPACT-1 list rows) and the trip tables (FD-3-2).
 */
export const DATA = {
  /** A list container: hairline-divided rows in one bordered card. */
  list: 'divide-y divide-panel-border rounded-lg border border-panel-border bg-panel-surface',
  /** One dense list row. Origin: HotelResultsView row `flex items-center gap-3 p-2`. */
  row: 'flex flex-wrap items-center gap-x-3 gap-y-2 p-2 transition-colors hover:bg-panel-hover',
  /** Right-aligned mono numerals for amounts (color from @/lib/money). Origin:
   *  the trip tables' amount cells (FD-3-2). */
  numeral: 'text-right font-mono',
  /** Table column header = a micro-label. Origin: the trip tables' theads (FD-3-2). */
  columnHeader: 'font-mono text-[10px] uppercase tracking-wider text-white/50',
  /** The "our cost:" / coverage trace micro-line. Origin: Landing projectCostSummary
   *  (FD-1o) `font-mono text-[10px] text-white/40`. */
  traceLine: 'font-mono text-[10px] text-white/40',
} as const;

/* ─── LAYOUT ─────────────────────────────────────────────────────────────────
 * The section strip container + rail/stack rhythm. Origin: LandingBookingSection
 * container, the deck scroll-snap rail, and the DECK-2 vertical stack.
 */
export const LAYOUT = {
  /** The section strip — one bordered inset panel. Origin: LandingBookingSection.tsx:65
   *  `rounded-lg border border-white/20 bg-white/5 p-4`. */
  strip: 'rounded-lg border border-white/20 bg-white/5 p-4',
  /** A horizontal scroll-snap rail. Origin: the pillar-deck / summary-deck track. */
  snapRail:
    'flex snap-x snap-mandatory items-stretch gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
  /** A snap child. Origin: the deck slides `shrink-0 snap-start`. */
  snapItem: 'shrink-0 snap-start',
  /** Vertical stack rhythm. Origin: the DECK-2 vertical stack `space-y-6`. */
  stack: 'space-y-6',
} as const;

/* ─── THEME-AWARE HELPER (CAL-DS-THEME) ──────────────────────────────────────
 * A component shared between light and dark surfaces stays byte-identical on
 * its light default and only darkens when asked. `themed(classes, dark)`:
 *   • dark === false → returns `classes` VERBATIM (byte-identical light default,
 *     guaranteed by construction — the map never runs);
 *   • dark === true  → swaps each light token for its panel-family equivalent.
 * The dark vocabulary lives ONLY here (the ruling: dark classes come exclusively
 * from ds.ts). Tokens already dark-friendly in both themes — `text-white`,
 * `text-white/NN`, `bg-black/NN`, `hover:text-white` — are deliberately NOT in
 * the map, so filled calendar blocks and modal overlays are unchanged.
 */
export type Surface = 'light' | 'dark';

const DARKEN_MAP: [RegExp, string][] = [
  // hover/prefixed variants FIRST (so the bare token regexes below don't touch them)
  [/\bhover:bg-bg-row\b/g, 'hover:bg-panel-hover'],
  [/\bhover:bg-white\b(?!\/)/g, 'hover:bg-white/10'],
  [/\bhover:text-text-secondary\b/g, 'hover:text-white/60'],
  [/\bhover:text-text-primary\b/g, 'hover:text-white'],
  [/\bhover:border-border\b/g, 'hover:border-panel-border'],
  // BOOKS-DS-1 additions: the dashboard stack's gray-family neutrals
  [/\bhover:bg-gray-100\b/g, 'hover:bg-panel-hover'],
  [/\bbg-gray-50\b(?!\/)/g, 'bg-white/5'],
  [/\bborder-gray-200(\/\d+)?\b/g, 'border-panel-border'],
  [/\bdivide-border\b/g, 'divide-panel-border'],
  // translucent + solid light insets → the dark inset
  [/\bbg-bg-row\/\d+\b/g, 'bg-white/5'],
  [/\bbg-bg-row\b/g, 'bg-white/5'],
  // hairline-as-fill (tracks/dividers)
  [/\bbg-border\/\d+\b/g, 'bg-panel-border'],
  [/\bbg-border\b/g, 'bg-panel-border'],
  // a neutral marker fill
  [/\bbg-gray-400\b/g, 'bg-white/40'],
  // solid surfaces (NOT bg-white/NN, which is already a dark token)
  [/\bbg-white\b(?!\/)/g, 'bg-panel-surface'],
  // borders + the text ladder (border-border-light before border-border)
  [/\bborder-border-light\b/g, 'border-panel-border'],
  [/\bborder-border\b/g, 'border-panel-border'],
  [/\btext-text-primary\b/g, 'text-white'],
  [/\btext-text-secondary\b/g, 'text-white/60'],
  [/\btext-text-muted\b/g, 'text-white/50'],
  [/\btext-text-faint\b/g, 'text-white/40'],
];

export function themed(classes: string, dark: boolean): string {
  if (!dark) return classes; // byte-identical light default — the map never runs
  let out = classes;
  for (const [re, to] of DARKEN_MAP) out = out.replace(re, to);
  return out;
}

/** The whole system under one import for terse call sites. */
export const DS = {
  SURFACE,
  HERO_BG,
  TYPE,
  TEXT,
  CONTROL,
  toggleChip,
  CHECKBOX,
  DATA,
  LAYOUT,
  /** The strip container, hoisted for the most common consumer (ToggleStrip). */
  STRIP: LAYOUT.strip,
} as const;

export default DS;
