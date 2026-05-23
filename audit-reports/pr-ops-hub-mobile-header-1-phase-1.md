# PR-Ops-Hub-Mobile-Header-1 — Phase 1 Audit (read-only)

Maps where each Hub header region lives and how to apply a **mobile-only**
(`<768px`) header redesign **Hub-only**, with desktop and the shared
Trading/Trips toolbars staying byte-identical. No edits made.

> Note: PR-Ops-Hub-Header-1 is now **merged to main** (this branch is cut from
> the updated main), so `enableHubChrome`, the aqua top-rule, and the
> purple-deep bottom edge are already present and are the starting point here.

---

## 1. Command-center bar — `src/app/hub/page.tsx:403-416` (✅ Hub-only)

Purely inline JSX in `hub/page.tsx`. **No shared component** — free to restyle
Hub-only with zero blast radius. Exact current markup:

```jsx
403  <div className="mb-6 bg-brand-purple text-white p-4 border-t-2 border-t-ts-aqua border-b-[3px] border-b-brand-purple-deep">
404    <div className="flex items-center justify-between">
405      <div>
406        <h1 className="text-sm font-semibold tracking-tight">{session?.user?.name || 'Dashboard'}</h1>
409        <p className="text-text-faint text-sm mt-0.5 font-mono">Financial Command Center · FY {selectedYear}</p>
410      </div>
411      <div className="text-right text-xs">
412        <div className="text-text-faint">Last updated</div>
413        <div className="font-mono">{new Date().toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}</div>
414      </div>
415    </div>
416  </div>
```

**Structure / why it fails on mobile:**
- Outer `flex items-center justify-between` (`:404`) pins the name/role block
  hard-left and the date block hard-right. On ~380px there is nothing in the
  center → the **dead middle**.
- The role line `Financial Command Center · FY 2026` is `font-mono text-sm`
  (`:409`). Mono is wide and doesn't shrink; at narrow width it **wraps
  mid-phrase**, and "Last updated" + the mono date (`:412-413`) stack into a
  two-line right column. Combined → a **tall slab** with wasted vertical space.
- `p-4` padding + `mb-6` bottom margin add height and a **gap** below the banner
  before the calendar card, so the zones don't cohere.

Mono font class is `font-mono` (Tailwind default mono stack). The banner has no
`rounded*` — hard corners (intentional on desktop; the locked redesign wants
tight-rounded **on mobile only**).

---

## 2. Nav bar — `src/components/ui/AppLayout.tsx` (🚫 NOT touched)

Confirmed shared global shell. The top nav ("Temple Stuart" `:196`, user +
`signOut` `:168`) is ROW1 `bg-brand-purple` (`:190`); the tab rows are
`bg-brand-purple/90` (`:212`) and `bg-brand-purple/80` (`:233`,`:242`); mobile
menu `bg-brand-purple-deep` (`:324`). Rendered on every authenticated route.
**This PR does not touch AppLayout** (decision locked in Hub-Header-1). The
command-center restyle starts cleanly *below* the nav, inside `hub/page.tsx`.

---

## 3. Calendar toolbar — `src/components/shared/CalendarGrid.tsx:324-358` (shared → gate via existing prop)

Shared by 4 callers (Hub, Trading, Trips list, Trip detail). Current toolbar is
**one horizontal flex row** (`toolbarBarClass` at `:325`, defined `:282`):
- Left group (`:326`): view-button track (`:327`, Day `:329` gated by
  `enableDayView`, Week `:331`, Month `:332`) + timezone `<select>` (`:336`).
- Center: title `<h2>` (`:346`).
- Right group (`:347`): Today/Start button (`:348`) + ‹ (`:351`) + › (`:354`).

On mobile this single row overflows. The locked redesign stacks it into rows
(views row · date row · nav row).

**Gating — REUSE the existing `enableHubChrome` prop (no new prop needed).**
`enableHubChrome` already exists (interface `:60-66`, destructure `:165`,
default `false`) and already gates Hub toolbar chrome. It is the natural switch
for the mobile-stack layout too — only Hub passes it (`hub/page.tsx:429`).
Cleanest approach: extend the toolbar so that the **stacked layout applies only
when `enableHubChrome && isMobile`**. When `enableHubChrome` is false (Trading,
both Trips) the markup path is unchanged → **byte-identical**. Adding a second
opt-in prop would be redundant; one Hub-chrome switch keeps the gate single and
clear.

> No-op guarantee: Trading/Trips never pass `enableHubChrome`, so any new
> `isMobile`/stacked branch sits behind `enableHubChrome &&` and is dead code
> for them. Preserve the existing `toolbarBarClass`/`viewBtn*` off-strings
> exactly (already proven byte-identical in Hub-Header-1).

---

## 4. useMediaQuery hook — `src/hooks/useMediaQuery.ts` (✅ reuse, locked breakpoint)

Exists (built in Cal-4). SSR-safe, signature: `useMediaQuery(query: string): boolean`
(returns `false` on server/first render, resolves in effect). Default-exported too.

**Locked mobile breakpoint:** `(max-width: 767px)` — used verbatim by
`ResponsiveViewController.tsx:27` (`useMediaQuery('(max-width: 767px)')`). This
PR **must use the same string** so there is ONE mobile boundary, not a competing
one. The Day-view auto-default already flips at this width, so a header that
restacks at the same `767px` keeps the whole mobile transition coherent.

Reuse pattern: either call `useMediaQuery('(max-width: 767px)')` directly in the
banner area of `hub/page.tsx`, and/or mount the stacked toolbar branch inside
CalendarGrid behind the same query (mirroring how `ResponsiveViewController`
isolates the subscription to opting callers only).

---

## 5. Radius / token availability

**Colors — wired & available:**
- `--ts-aqua` #14e0c8 → `ts.aqua` → `bg-ts-aqua` / `border-t-ts-aqua` ✅
  (tailwind.config.ts:58). Already used for the banner top-rule.
- Purple family is namespaced under **`brand.*`, NOT `ts.*`**: `brand.purple`
  #3b2d6b (`:18`), `brand.purple-deep` #2d1b4e (`:19`), `brand.purple-wash`
  #eae7f2 (`:22`). ⚠️ The task's `bg-ts-purple` does **not** exist — the real
  classes are `bg-brand-purple` / `bg-brand-purple-wash` / `border-brand-purple-deep`.

**Radius — tokens exist but are NOT wired to Tailwind:**
- `globals.css:79-81` defines `--ts-radius-none: 0`, `--ts-radius-sm: 0.125rem`
  (2px), `--ts-radius: 0.25rem` (4px). Comment (`:68-72`) states these are
  **foundation-only, deliberately not wired** into `theme.extend.borderRadius`
  (to avoid shadowing defaults), and **nothing references them**. The max token
  is 4px — too tight for the locked ~9px.
- So there is **no token utility for ~9px**. Options for the tight-rounded card:
  - `rounded-lg` = 0.5rem (8px) — closest standard Tailwind utility, "rounded
    but institutional," no config change. **Recommended.**
  - `rounded-[9px]` — exact arbitrary value if 9px is required.
  - Wiring a real `--ts-radius-md: 9px` token + `theme.extend.borderRadius` is
    cleaner long-term but is a foundation change beyond this mobile PR's scope;
    flag for a later DS PR rather than do it here.

---

## RECOMMENDED BUILD PLAN

All four pieces are **mobile-only** (behind `useMediaQuery('(max-width: 767px)')`,
matching Cal-4) and leave desktop untouched.

| # | Change | Scope | Gating |
|---|--------|-------|--------|
| A | **Compact command-center bar** — single row: `name + short role` left, `Updated <date>` right; drop the dead-middle `justify-between` spread on mobile, prevent the mono role from wrapping (truncate or shorten to e.g. "Command Center · FY 2026"), ~half height (reduce `p-4`→tighter, trim `mt-0.5`). | `hub/page.tsx:403-416` | **Hub-only-free** (inline JSX, no shared dep) |
| B | **Unified stack (no gaps)** — on mobile remove the `mb-6` gap below the banner (`:403`) and the `mb-6` above the calendar card (`:423`) so nav → command-center → toolbar read as ONE continuous stack tied by the aqua rule. | `hub/page.tsx:403,423` | **Hub-only-free** |
| C | **Tight-rounded cards** — apply `rounded-lg` (8px) to the command-center bar and calendar card **on mobile only** (`md:rounded-none` to preserve desktop's hard corners, or conditional class). | `hub/page.tsx` banner + `:423` wrapper | **Hub-only-free** |
| D | **Mobile-stacked toolbar** — views row · date/title row · Today+‹› nav row, behind `enableHubChrome && isMobile`. Keep off-path strings byte-identical. | `CalendarGrid.tsx:324-358` | **Shared — gated via existing `enableHubChrome`** (Trading/Trips byte-identical) |

**Notes:**
- A, B, C are pure `hub/page.tsx` edits → zero risk to other surfaces.
- D is the only shared-file change; reuse `enableHubChrome` (do **not** add a
  new prop) and reuse `useMediaQuery('(max-width: 767px)')`.
- Use token classes only: `bg-brand-purple`, `border-t-ts-aqua`,
  `bg-brand-purple-wash`, `border-brand-purple-deep`; `rounded-lg` for radius
  (no ~9px token exists — flag a `--ts-radius-md` wiring for a future DS PR if
  exact 9px becomes a hard requirement).
- Single breakpoint everywhere: `(max-width: 767px)`.
