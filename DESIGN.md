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
