# Temple Stuart — Design System

The app speaks **one visual language on every page** — the compact Bloomberg skin
shipped on the landing. `src/lib/ds.ts` is the single source of truth: named class
constants extracted verbatim from the landing (no new hex, no new colors). Import
from `ds.ts` instead of copy-pasting Tailwind strings.

## Principles
- **Dark panel base.** `bg-panel` page → `bg-panel-surface` cards → `bg-white/5`
  insets. Light surfaces are legacy debt, migrated tab-by-tab (FD-3 roadmap).
- **Token-only.** Every value resolves to an existing token (`bg-panel*`,
  `brand-*`, white opacities). Adding a hex is a design change, not a DS change.
- **Codification, not invention.** Each constant cites its landing origin.

## The system (`src/lib/ds.ts`)

| Group | Constant | What / origin |
|---|---|---|
| **SURFACE** | `page` / `card` / `inset` / `hover` | the dark panel stack (HomeClient page, COMPACT-1 strips, trip cards) |
| | `HERO_BG` | the hero radial glow, verbatim `Landing.tsx` const |
| **TYPE** | `display` / `heading` / `body` / `microLabel` | hero scale → deck heading → body → mono micro-label |
| **TEXT** | `primary/body/secondary/muted/faint` | the `white` → `white/70` → `/60` → `/50` → `/40` ladder, with usage rules |
| **CONTROL** | `input` / `label` / `primaryButton` / `ghostButton` | the `travelSection` field/label/button consts + hero CTAs |
| | `toggleChip(active)` / `CHECKBOX` | the LandingBookingSection toggle idiom + FD-1i checkbox |
| **DATA** | `list` / `row` / `numeral` / `columnHeader` / `traceLine` | COMPACT-1 list rows, FD-3-2 tables, FD-1o cost trace |
| **LAYOUT** | `strip` / `snapRail` / `snapItem` / `stack` | the section strip, scroll-snap rail, vertical stack |

## The guest hero and the top bar (HERO-CREST-01, 2026-11-11)
The approved crest design (`design-refs/hero-crest-01/`) is a design change: it brings its own colours. They are
tokens — typed once in `src/app/globals.css` `:root` as `--ts-<token>`, mapped in `tailwind.config.ts` as the `hero`
and `glass` families — named and valued as the handoff's table. No hex is typed in a component.

| Token | Value | Used for |
|---|---|---|
| `hero-violet-1` … `-4` | `#6A33E0` · `#4D1FBC` · `#32118A` · `#210A5E` | the ground's sweep; the filled bar uses 1–3 |
| `hero-bloom` | `162 107 255` | the light behind the crest |
| `hero-orchid` | `217 70 239` | the warm corner, bottom right |
| `hero-ink` · `hero-ink-soft` · `hero-ink-nav` | `#FAF8F4` · `#E4E0F2` · `#E8E4F5` | headline, wordmark, menu rows · subline · the bar's links |
| `hero-gold` | `#F6C95C` | the headline's third sentence, link hover, focus ring |
| `hero-gold-1` … `-3` | `255 236 178` · `248 203 90` · `236 178 62` | the gold pills |
| `hero-on-gold` | `#2A0F5C` | ink on the gold pills |
| `hero-well` · `hero-rim-gold` · `hero-rim-lilac` | `#210B5C` · `#F8CB5A` · `#B9A2FF` | the secondary button's fill and rim |
| `glass-fill` · `glass-line` | `rgb(255 255 255 / 0.10)` · `rgb(255 255 255 / 0.22)` | the bar over the hero |

The hero (`Landing.tsx`) and the bar (`LandingHeader.tsx`) are drawn by the reference's own stylesheet, ported rule
for rule to the foot of `globals.css` under the `ts-` prefix (`.ts-hero`, `.ts-bar`, `.ts-pill-gold`, …) — not by
`ds.ts` constants. `src/lib/__tests__/heroCrest01.test.ts` holds the port equal to
`design-refs/hero-crest-01/Hero-Reference.html`, the tokens to the handoff README's table, and this table to the
same values. The hero and the bar are gradients and glass by this design, which comes after Direction C's ban on
gradients (`globals.css`, REPAINT-5); it changes no other surface.

## Shared primitives built on the system
- **`src/components/ui/ToggleStrip.tsx`** — the one-strip / N-chip / show-hide
  toggle (all panels mounted, in-flight results survive). Consumed by BOTH the
  landing (`LandingBookingSection`) and the app travel tab — the DS thesis proven.

## The white-opacity ladder (when to use which)
- `text-white` — primary content: headings, active values, first bullet.
- `text-white/70` — body / sub-copy.
- `text-white/60` — secondary: descriptors, explainers, meta.
- `text-white/50` — micro-labels, muted captions, chrome.
- `text-white/40` — faint: trace lines ("our cost:"), dashes.

## Roadmap
The travel tab is the DS reference implementation. The eight other tab bodies
(calendar, routines, projects, content, trade, books, tax, compliance) are cheap
installments that consume the same primitives — each swaps its light surface for
`SURFACE`/`CONTROL`/`DATA` constants, no new design decisions required.
