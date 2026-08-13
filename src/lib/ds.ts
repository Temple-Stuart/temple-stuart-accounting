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
/* REPAINT-3 (Direction C): the dark-native exports below re-pointed to the
 * light vocabulary — cream paper, white/card-cream cards, lavender hairlines,
 * aubergine structure ink. The dark panel-family values retire with the dk
 * machinery in Slice 5. */
export const SURFACE = {
  /** The page background — the cream paper (was bg-page, REPAINT-3). */
  page: 'bg-bg-terminal',
  /** A raised card — flat white + lavender hairline (was panel-surface). */
  card: 'rounded-lg border border-border bg-white',
  /** A subtle inset / strip fill (was bg-white/5). */
  inset: 'bg-bg-row',
  /** Row / control hover (was bg-panel-hover). */
  hover: 'bg-bg-row',
} as const;

/* REPAINT-3: HERO_BG DELETED — the hero radial glow died with the dark
 * shell; both heroes (Landing + HomeClient, the HOME-HERO-PARITY pair) are
 * solid bg-brand-purple bands now. */

/** PR-STRIP-DESIGN-2 → STRIP-FLAT-BAND: the booking strip's band. The
 *  4-layer glow composition died (the STRIP-VISUAL-2 audit: the electric
 *  radial lived only in the top-left, so the band dimmed to the right) —
 *  ONE flat, fully opaque fill, edge to edge. No gradients, no overlays,
 *  no opacity. REPAINT-2 (Direction C): the fill moves off the electric
 *  pop onto the solid aubergine — every band consumer (ToggleStrip band,
 *  ModuleLauncher ModuleBand) goes aubergine with it by design. */
export const BAND_BG = 'rgb(var(--ts-purple))';

/* REPAINT-3: CARD_BG DELETED — the BOOKS-GLOW standing rule inverts under
 * Direction C: cards are FLAT (white or bg-ts-white card-cream) with the
 * lavender hairline; no glow anywhere. Former mounts: ModuleLauncher's
 * MODULE_SHELL, ModulePointerCard, CPAExport, BookkeepingSection — all
 * converted this slice. */

/* ─── TYPE ───────────────────────────────────────────────────────────────────
 * Scale + the white-opacity ladder. Origin: the landing hero (display), the
 * deck headings (section), COMPACT-1 (micro-label), and the ladder used across
 * every landing surface.
 */
export const TYPE = {
  /** Hero display. Origin: Landing.tsx hero h1 `text-4xl lg:text-5xl font-light
   *  tracking-tight`; the app hero compacts this (FD-3-1) to 2xl/3xl. */
  display: 'text-2xl lg:text-3xl font-light tracking-tight',
  /** Section heading (REPAINT-3: primary ink on cream). */
  heading: 'text-lg font-light tracking-tight text-text-primary',
  /** Default body copy (REPAINT-3: the /70 rung's light twin per DARKEN_MAP). */
  body: 'text-sm text-text-secondary',
  /** Mono micro-label — the signature (REPAINT-3: /50 ↔ text-text-faint,
   *  the DARKEN_MAP pair, inverted). */
  microLabel: 'font-mono text-[10px] font-semibold uppercase tracking-wider text-text-faint',
} as const;

/**
 * The white-opacity ladder + WHEN each rung is used (codified from the landing):
 *   text-white      — primary content: headings, active values, headline bullets.
 *   text-white/70    — body copy, sub-copy under a headline (hero sub-copy).
 *   text-white/60    — secondary body: descriptors, explainer lines, meta.
 *   text-white/50    — micro-labels, muted captions, inactive-but-legible chrome.
 *   text-white/40    — faint: placeholders' cousins, "our cost:" trace lines, dashes.
 */
/* REPAINT-3: the ladder inverts through the DARKEN_MAP pairs — primary↔white,
 * /70↔secondary, /60↔muted, /50↔faint; the /40 rung collapses onto faint
 * (the light ladder has four rungs to dark's five). */
export const TEXT = {
  primary: 'text-text-primary',
  body: 'text-text-secondary',
  secondary: 'text-text-muted',
  muted: 'text-text-faint',
  faint: 'text-text-faint',
} as const;

/* ─── CONTROLS ───────────────────────────────────────────────────────────────
 * Origin: travelSection.ts (TRAVEL_INPUT_CLASS / _LABEL_CLASS / _BUTTON_CLASS)
 * and the LandingBookingSection toggle idiom. Kept byte-identical so the shared
 * primitives and travelSection stay in lockstep (travelSection re-exports the
 * same strings; a later PR can point it here).
 */
export const CONTROL = {
  /** Field on cream (REPAINT-3): white fill, lavender hairline, aubergine
   *  focus ring. */
  input:
    'bg-white border border-border rounded px-3 py-2 text-sm text-text-primary placeholder-text-faint focus:outline-none focus:ring-2 focus:ring-brand-purple',
  /** Field micro-label (above the input). */
  label: 'font-mono text-[10px] font-semibold uppercase tracking-wider text-text-faint',
  /** Primary action (REPAINT-3): the white-on-dark pill inverts to solid
   *  aubergine — a white button has no edge on cream. */
  primaryButton:
    'rounded bg-brand-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-purple-hover disabled:opacity-50',
  /** Secondary / ghost (REPAINT-3): the aubergine ghost — the landing's
   *  REPAINT-2 idiom. */
  ghostButton:
    'rounded border border-brand-purple/40 px-4 py-2 text-sm font-medium text-brand-purple transition-colors hover:bg-brand-purple-wash',
} as const;

/** Toggle chip (REPAINT-3) — active = solid aubergine, inactive = the
 *  aubergine ghost on cream. */
export function toggleChip(active: boolean): string {
  return `px-3 py-1.5 font-mono text-xs font-medium ${
    active ? 'bg-brand-purple text-white' : 'border border-brand-purple/40 text-brand-purple hover:bg-brand-purple-wash'
  }`;
}

/** PR-STRIP-DESIGN-1: the icon-above-label tab (the trip.com tab form factor
 *  on OUR tokens — zero new colors). Active = brand-purple underline + the
 *  white/5 inset fill + full-white text (border-brand-purple/60 precedent:
 *  the FD-1i calculator strip); inactive = transparent underline, secondary
 *  text, inset on hover. Used by ToggleStrip when a mode carries an icon. */
export function iconTab(active: boolean): string {
  // REPAINT-3: the landing's iconTabLight (REPAINT-2 donor) promoted HOME —
  // aubergine-active-on-cream; the pop underline + dark inks died.
  return `flex flex-col items-center gap-1 rounded-t px-3 py-2 font-mono text-[11px] font-medium border-b-2 transition-colors ${
    active
      ? 'border-brand-purple bg-brand-purple-wash text-brand-purple'
      : 'border-transparent text-text-muted hover:bg-brand-purple-wash/50 hover:text-text-primary'
  }`;
}

/** Checkbox idiom. Origin: the FD-1i selection slides `accent-brand-purple`. */
export const CHECKBOX = 'h-3.5 w-3.5 accent-brand-purple';

/** TRADE-SEGMENTS: THE segmented control — anatomy extracted verbatim from
 *  the flights bar's own Round-trip/One-way switch (FlightPickerView.tsx
 *  :252-260, the house reference): an inset white/10 pill track (p-0.5,
 *  gap-1), items rounded inside it, the ACTIVE item lifted to white with
 *  the brand ink + shadow, idle = quiet white/70 text. Two layout-only
 *  deltas from the source, declared: the track's `self-start lg:self-auto`
 *  flex positioning stayed behind (positioning, not anatomy) and `w-max`
 *  joins so the track hugs its content inside flex-col containers.
 *  FlightPickerView itself still carries these classes inline — its
 *  adoption of this extraction is a later travel micro-PR. */
export const SEGMENT = {
  // REPAINT-3: the track inverts to the cream row inset; the active item
  // keeps its lifted white pill + aubergine ink (correct on cream too).
  wrap: 'flex w-max items-center gap-1 rounded bg-bg-row p-0.5',
  item(active: boolean): string {
    return `px-2 py-1 text-xs rounded transition-colors ${
      active ? 'bg-white shadow text-brand-purple font-medium' : 'text-text-secondary'
    }`;
  },
} as const;

/** TRADE-CHIPS: THE status chip — one vocabulary replacing the trade lane's
 *  chip zoo (5 journal families + TradeLabPanel's 25-hex system + scattered
 *  state colors). Variants are the status token family (+ pop accent and a
 *  neutral); the text INSIDE the chip carries any finer distinction. The
 *  variant record is exported separately so larger displays (the Lab's hero
 *  grade letter) can wear the variant colors at their own scale without
 *  duplicating the color map. */
export const CHIP_VARIANTS = {
  success: 'bg-status-success/15 text-status-success',
  danger: 'bg-status-danger/15 text-status-danger',
  warning: 'bg-status-warning/15 text-status-warning',
  info: 'bg-status-info/15 text-status-info',
  // REPAINT-3: the two non-status variants go light (status quartet untouched).
  accent: 'bg-brand-purple-wash text-brand-purple',
  neutral: 'bg-bg-row text-text-secondary',
} as const;
export type ChipVariant = keyof typeof CHIP_VARIANTS;
export function chip(variant: ChipVariant = 'neutral'): string {
  return `inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide ${CHIP_VARIANTS[variant]}`;
}

/** CI-PIPELINE-CLARITY: the explainer idiom — educational prose set off by a
 *  pop hairline instead of italics (the pipeline panel's teaching voice). */
export const EXPLAINER = 'border-l-2 border-brand-purple/40 pl-3 text-xs leading-relaxed text-text-secondary';

/** TRADE-ACTIONS-STATES: the money-action idiom — ruling: gold SURVIVES as
 *  the color reserved for money-moving actions — Commit to Ledger; Books
 *  commit inherits this idiom. Derivation: the /trading Commit-to-Ledger
 *  button's own classes verbatim (page.tsx Commit button), order
 *  normalized only — byte-equal render. */
export const MONEY_ACTION =
  'rounded px-4 py-1.5 text-xs font-semibold bg-brand-gold text-white hover:bg-brand-gold/90 disabled:opacity-50';

/** TRADE-ACTIONS-STATES: the one state language — loading / empty / error
 *  across the trade lane (journal, account panel, TradeRecord, CI). */
export const STATE = {
  // REPAINT-3: light ink tiers; errorCard is already a light wash on white —
  // status-danger semantics kept verbatim.
  loading: 'flex items-center justify-center gap-2 py-8 font-mono text-xs text-text-faint',
  empty: 'py-8 text-center font-mono text-xs text-text-faint',
  errorCard: 'rounded-lg border border-status-danger/30 bg-status-danger/10 p-3 text-xs text-status-danger',
} as const;

/** TRADE-SHELL-DARK: THE section-header bar — one idiom replacing the seven
 *  divergent `bg-brand-purple/80` header strips the TRADE-UI-DS audit found
 *  on /trading (+ DataObservatory). Dark-native: inset fill + hairline +
 *  the DATA.columnHeader micro-label voice at bar scale. */
// REPAINT-3: the section-header bar goes light — cream row fill, lavender
// hairline, aubergine mono ink (Direction C structure ink; the muted-ink
// option was passed over so headers carry the aubergine hierarchy).
export const SECTION_HEADER =
  'flex items-center justify-between border-b border-border bg-bg-row px-4 py-2.5 font-mono text-xs font-semibold uppercase tracking-wider text-brand-purple';

/* ─── DATA DISPLAY ───────────────────────────────────────────────────────────
 * List-row rhythm + numerals + table headers. Origin: HotelResultsView /
 * ActivityResultsView (COMPACT-1 list rows) and the trip tables (FD-3-2).
 */
export const DATA = {
  /** A list container: hairline-divided rows in one bordered card (REPAINT-3:
   *  white card + lavender hairlines). */
  list: 'divide-y divide-border rounded-lg border border-border bg-white',
  /** One dense list row. Origin: HotelResultsView row `flex items-center gap-3 p-2`. */
  row: 'flex flex-wrap items-center gap-x-3 gap-y-2 p-2 transition-colors hover:bg-bg-row',
  /** Right-aligned mono numerals for amounts (color from @/lib/money). Origin:
   *  the trip tables' amount cells (FD-3-2). */
  numeral: 'text-right font-mono',
  /** Table column header = a micro-label (REPAINT-3: the faint light tier). */
  columnHeader: 'font-mono text-[10px] uppercase tracking-wider text-text-faint',
  /** The "our cost:" / coverage trace micro-line (REPAINT-3: faint). */
  traceLine: 'font-mono text-[10px] text-text-faint',
} as const;

/* ─── LAYOUT ─────────────────────────────────────────────────────────────────
 * The section strip container + rail/stack rhythm. Origin: LandingBookingSection
 * container, the deck scroll-snap rail, and the DECK-2 vertical stack.
 */
export const LAYOUT = {
  /** The section strip — one bordered inset panel (REPAINT-3: cream inset +
   *  lavender hairline; origin classes were the dark white/20-white/5 pair). */
  strip: 'rounded-lg border border-border bg-bg-row p-4',
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
  [/\bhover:bg-bg-row\b(?!\/)/g, 'hover:bg-panel-hover'],
  [/\bhover:bg-white\b(?!\/)/g, 'hover:bg-white/10'],
  // INK-LIFT: hover lifts in lockstep with its bare tier below (a hover
  // state must never be darker than rest state).
  [/\bhover:text-text-secondary\b/g, 'hover:text-white/70'],
  [/\bhover:text-text-primary\b/g, 'hover:text-white'],
  [/\bhover:border-border\b/g, 'hover:border-panel-border'],
  // BOOKS-DS-1 additions: the dashboard stack's gray-family neutrals
  [/\bhover:bg-gray-100\b/g, 'hover:bg-panel-hover'],
  [/\bhover:bg-gray-50\b/g, 'hover:bg-panel-hover'],
  [/\bbg-gray-50\b(?!\/)/g, 'bg-white/5'],
  [/\bborder-gray-200(\/\d+)?\b/g, 'border-panel-border'],
  [/\bborder-gray-100\b/g, 'border-panel-border'],
  [/\bdivide-border\b/g, 'divide-panel-border'],
  // TRADE-DS-1 additions: opacity-variant neutrals collapse to the PLAIN panel
  // token (panel colors are plain var() — a /NN modifier would not compile),
  // the darker gray text ladder, and borders colored with text tokens.
  [/\bhover:bg-bg-row\/\d+\b/g, 'hover:bg-panel-hover'],
  [/\bborder-border\/\d+\b/g, 'border-panel-border'],
  [/\bhover:text-gray-700\b/g, 'hover:text-white'],
  [/\bhover:text-gray-800\b/g, 'hover:text-white'],
  [/\btext-gray-900\b/g, 'text-white'],
  [/\btext-gray-800\b/g, 'text-white'],
  [/\btext-gray-700\b/g, 'text-white/70'],
  [/\btext-gray-600\b/g, 'text-white/60'],
  [/\btext-gray-500\b/g, 'text-white/50'],
  [/\btext-gray-400\b/g, 'text-white/40'],
  [/\btext-gray-300\b/g, 'text-white/40'],
  [/\bborder-gray-300\b/g, 'border-white/30'],
  [/\bbg-gray-200\b/g, 'bg-white/10'],
  [/\bbg-gray-100\b(?!\/)/g, 'bg-white/10'],
  [/\bborder-text-muted\b/g, 'border-white/50'],
  [/\bborder-text-faint\b/g, 'border-white/40'],
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
  [/\bborder-border\b(?!\/)/g, 'border-panel-border'],
  // INK-LIFT: the TRADE-INK tier ruling applied at the map — dense data UIs
  // need labels ≥/60, prose ≥/70. (primary stays full white.)
  [/\btext-text-primary\b/g, 'text-white'],
  [/\btext-text-secondary\b/g, 'text-white/70'],
  [/\btext-text-muted\b/g, 'text-white/60'],
  [/\btext-text-faint\b/g, 'text-white/50'],
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
  BAND_BG,
  SECTION_HEADER,
  CHIP_VARIANTS,
  chip,
  SEGMENT,
  MONEY_ACTION,
  STATE,
  EXPLAINER,
  TYPE,
  TEXT,
  CONTROL,
  toggleChip,
  iconTab,
  CHECKBOX,
  DATA,
  LAYOUT,
  /** The strip container, hoisted for the most common consumer (ToggleStrip). */
  STRIP: LAYOUT.strip,
} as const;

export default DS;
