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

## The Financial Software section (HOME-PLANS-04, 2026-11-12)
The approved section (`design-refs/home-plans-04/`) — "What We Do" as an eyebrow, the map of the 25 tools, three plan
cards and the all-three band — is a design change too. It reads fourteen tokens the app already holds (`bg`, `border`,
`gold` and the hero's violets, golds and inks) and brings seventeen: typed once in `src/app/globals.css` `:root` as
`--ts-<token>`, mapped in `tailwind.config.ts` as the `fs` family, named and valued as the handoff's table. No hex is typed
in a component, and none in the section's stylesheet.

| Token | Value | Used for |
|---|---|---|
| `fs-white` | `255 255 255` | cards, tools and switches; text on violet and teal; on the band at 0.08 and 0.5; the gold button's top light at 0.75 |
| `fs-teal` | `#0B7F73` | Trading: its fill and its ring; on white its word, line and ticks |
| `fs-teal-deep` | `#0B5F57` | Trading's switch label while off |
| `fs-teal-light` | `#8FE8DA` | Trading's word on the band |
| `fs-gold-text` | `#8A6408` | gold as small text: the eyebrow; on white Business's word, line and ticks |
| `fs-gold-deep` | `#6B4E00` | Business's switch label while off |
| `fs-ink` | `#2B2545` | body text |
| `fs-ink-soft` | `#4A4560` | the lede, explainers, family names, the price line |
| `fs-ink-muted` | `#6F6988` | tools not in the plan, roles, counts |
| `fs-line` | `#E9E4F2` | the panel's and the cards' border |
| `fs-rule` | `#EEEAF5` | the rules inside them |
| `fs-chip-line` | `#E4DFF0` | the border of a tool that is not in the plan |
| `fs-button-line` | `#CFC6EC` | the quiet button's border |
| `fs-band-muted` | `#D6CCF7` | the band's role and count |
| `fs-band-ring` | `230 220 255` | the band's rings, at 0.08 |
| `fs-shadow` | `33 10 94` | shadows on the cream: hero-violet-4 as channels |
| `fs-band-shadow` | `12 6 44` | the shadow under the band's gold button |

The section (`HowToSection.tsx`) and its eyebrow (`Landing.tsx`) are drawn by the reference's own stylesheet, ported rule for
rule to `globals.css` under the house prefix (`.ts-fs`, `.ts-fs-map`, `.ts-fs-plan`, …), above the hero's block. One colour
per module: Personal is the hero's violet, Business the hero's gold, Trading the new teal. It draws two more gradients, both
on the board (the brief's ruling g): the picked plan's gold button and the band. `src/lib/__tests__/homePlans04.test.ts`
holds the port equal to `design-refs/home-plans-04/Section-Reference.html`, the tokens to the handoff README's two tables,
and this table to the same values.

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
