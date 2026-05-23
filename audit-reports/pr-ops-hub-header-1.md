# PR-Ops-Hub-Header-1 — unified Hub header hierarchy (DS-2 token adoption)

Design pass on the Hub header CHROME only. Adopts the dormant DS-2 tokens
(`--ts-aqua`, the purple family) for the first time in a live surface, to give
the three stacked header zones a clear hierarchy and a "sharp" boundary
(borders / background shifts — **no corner/radius changes**) so each zone reads
as distinct against the warm-white page.

## Audit — where the three header regions live

| # | Region | Location | Current style | Hub-only-safe? |
|---|--------|----------|---------------|----------------|
| 1 | Top nav bar (TS logo + user + sign out + tab bar) | **shared** `src/components/ui/AppLayout.tsx` ROW1 `:190` (`bg-brand-purple`), ROW2 `:212` (`bg-brand-purple/90`) | base purple #3b2d6b | **NO — global shell, every authenticated page** |
| 2 | Command-center banner ("Alexander Stuart / Financial Command Center · FY 2026 / Last updated") | `src/app/hub/page.tsx:401-414` | `bg-brand-purple text-white p-4` (#3b2d6b) | **YES — Hub-only** |
| 3 | Calendar toolbar (Day/Week/Month, title, Today, ‹›) | **shared** `src/components/shared/CalendarGrid.tsx:316-350` | header `bg-bg-row/50`; button track `bg-border/70`; active `bg-white text-text-primary`; inactive `text-text-muted` | **NO — shared by Trading + both Trips → needs gating** |

### Decision on the nav bar (region 1)
The locked spec calls for the nav at deepest purple `#2d1b4e`. But the nav lives
in the **global** `AppLayout`, rendered on every authenticated route — deepening
it there would change Trading/Travel/Bookkeeping/Operations, violating the
Hub-only / byte-identical constraint. **Per the user's explicit choice ("Don't
touch nav (Hub-only)"), `AppLayout.tsx` is left completely untouched.** The
hierarchy is instead established by the banner restyle + the gated toolbar zone.

## Changes (DS-2 token classes — no hardcoded hex)

Token utilities used (all wired in `tailwind.config.ts`, resolving to the
`globals.css` CSS vars):
- `border-t-ts-aqua` → `var(--ts-aqua)` #14e0c8 (`tailwind.config.ts:58`)
- `bg-brand-purple` → `var(--ts-purple)` #3b2d6b (`:18`)
- `border-b-brand-purple-deep` / `border-t-brand-purple` → deep #2d1b4e / base (`:18-19`)
- `bg-brand-purple-wash` → `var(--ts-purple-wash)` #eae7f2 (`:22`)
- `text-brand-purple` (active/inactive button text)

> Note: the purple family is namespaced under `brand.*` in DS-2, not `ts.*`
> (only aqua/cyan/indigo/white are under `ts.*`). The prompt's `bg-ts-purple`
> does not exist; the correct wired class is `bg-brand-purple`. Used the real
> token classes throughout — no literals.

### Banner — `src/app/hub/page.tsx:401-417`
Added to the existing `bg-brand-purple text-white p-4`:
- `border-t-2 border-t-ts-aqua` — 2px **aqua top-rule** tying the header block
  together (boldest accent, easy to thin later).
- `border-b-[3px] border-b-brand-purple-deep` — **hard bottom edge**. Chose
  `purple-deep` (not the spec's parenthetical `var(--ts-purple)`) deliberately:
  the banner body is already `--ts-purple`, so a same-color border would be
  invisible. `purple-deep` makes the "header-zone-ends-here" separation actually
  visible against both the banner and the warm-white page. Still a DS-2 token.

### Toolbar zone — `src/components/shared/CalendarGrid.tsx`, **prop-gated**
New opt-in prop `enableHubChrome?: boolean` (default `false`), interface doc at
`:60-66`, destructure `:165`. Three class vars (`:282-287`) switch on it:
- `toolbarBarClass` — on: `... border-b border-border border-t-[3px] border-t-brand-purple bg-brand-purple-wash` (purple-wash zone + strong purple top border); off: original `... border-b border-border bg-bg-row/50`.
- `viewBtnActive` — on: `bg-brand-purple text-white shadow-sm`; off: original `bg-white shadow-sm text-text-primary`.
- `viewBtnInactive` — on: `text-brand-purple/70 hover:text-brand-purple`; off: original `text-text-muted hover:text-text-secondary`.

Applied at the header bar (`:316`) and the three view buttons (`:319-323`).
Hub opt-in: `enableHubChrome={true}` at `src/app/hub/page.tsx:428`.

## No-op proof — Trading + both Trips byte-identical
`enableHubChrome` defaults `false` (`:165`) and only Hub passes `true`
(`hub/page.tsx:428`). When `false`, the three class vars resolve to the **exact
original strings** character-for-character:
- bar: `flex items-center justify-between px-4 py-3 border-b border-border bg-bg-row/50`
- active: `bg-white shadow-sm text-text-primary`
- inactive: `text-text-muted hover:text-text-secondary`

The button static prefix (`px-3 py-1.5 text-sm font-medium rounded-md transition-colors `)
is unchanged; only the inline ternary literals were replaced by the off-valued
vars. So Trading (`trading/page.tsx`), Trips list (`budgets/trips/page.tsx`),
and Trip detail (`budgets/trips/[id]/page.tsx`) — none of which pass
`enableHubChrome` — render an identical DOM/class tree. No new effect, no
runtime branch with observable effect.

## Constraints honored
- **No border-radius / corner changes anywhere.** "Sharp edges" = zone
  boundaries (borders + bg shifts) only. Verified: no `rounded*` utility added,
  removed, or changed in either file.
- **Header chrome only.** Untouched: calendar grid internals, day-view, time
  axis, unscheduled queues, budget panels, everything below the header.
- **AppLayout untouched** (per user's nav decision).
- No fallback logic, no schema.

## Verification
- `npx tsc --noEmit` → **exit 0**.
- `npm run lint` (touched files) → **0 errors**; warnings all pre-existing
  (unused imports, effect-deps in `hub/page.tsx` and the auto-scroll effect).
- Runtime UI not exercised: `/hub` is auth-gated (307 → `/`) in this headless
  environment, so the visual result (aqua rule, hard edge, wash toolbar, purple
  active Day button) needs a manual pass in an authenticated browser.
