# Overhaul-PR-1 — App Shell: sidebar nav replaces top-nav (structure only)

Replaces the shared top-nav in `AppLayout` with a left **sidebar shell**. Every
existing page drops into the new shell with its `{children}` **unchanged** — no
page redesigns, no dashboard, no card grids. Structure only.

## Old AppLayout skeleton (replaced) vs new shell

**Before** (`AppLayout.tsx`): a sticky `<header>` with ROW1 (logo + Hub icon +
user + sign-out + mobile hamburger, `bg-brand-purple`), ROW2 (5 pill tabs,
`hidden lg:flex`, `bg-brand-purple/90`), conditional context bars, a mobile menu
(`lg:hidden`), then `<main className="max-w-[1800px] mx-auto">{children}</main>`.

**After**: `<div className="min-h-screen bg-bg-terminal lg:flex">` → `<Sidebar/>`
+ a `flex-1 min-w-0 flex flex-col` content column holding the preserved context
bars then `<main className="max-w-[1800px] mx-auto w-full">{children}</main>`.

## Sidebar structure (`src/components/ui/Sidebar.tsx`, new)

Top→bottom: **logo** ("Temple Stuart" → `/hub`) · **Hub** nav item (home) ·
**divider** · the **5 modules** · **user label + Sign out** (bottom, `mt-auto`).

Routes link to the **same** hrefs/prefixes as the former top-nav (relocated, not
changed):
| Item | href | active prefixes |
|---|---|---|
| Hub | `/hub` | exact `/hub` |
| Bookkeeping | `/dashboard` | `/dashboard,/accounts,/chart-of-accounts,/journal-entries,/ledger,/statements,/transactions,/net-worth` |
| Trading | `/trading` | `/trading` |
| Travel | `/budgets/trips` | `/budgets/trips,/trips` |
| Compliance | `/compliance` | `/compliance` |
| Operations | `/operations` | `/operations` |

Active detection is the same logic as before (`pathname === '/hub'` for Hub;
`prefixes.some(p => pathname.startsWith(p))` for modules).

## Entity switcher — OMITTED (per your decision), with rationale

Audit finding: **there is no global Personal/Business entity switcher to
relocate.** The only entity mechanism is `OperationsEntityProvider` /
`useOperationsEntity` (`src/components/workbench/operations/EntitySelector.tsx`) —
**operations-scoped** (provided only in `src/app/operations/layout.tsx`,
`localStorage`-backed, multi-entity *id* selector). The `PERSONAL_PREFIXES` /
`BUSINESS_PREFIXES` constants in the old AppLayout were **unused dead code**
(removed). Per your "omit it for now" choice, the sidebar ships without an entity
switcher and does **not** rebuild/relocate entity logic. **Recommend a dedicated
follow-up PR** to design a real global entity context if that's desired.

## Behavior

- **Collapsible** (desktop rail): expanded `w-60` (icon+label) ↔ collapsed `w-16`
  (icons-only), toggled by a `PanelLeftClose/Open` button. **Persisted** in
  `localStorage` key `sidebar-collapsed` (SSR-safe: defaults expanded, hydrates in
  a post-mount effect — mirrors the existing `OperationsEntityProvider`
  localStorage pattern; cited as the codebase's client-state convention).
- **Mobile (`< lg`)**: the rail is hidden; a slim top bar (logo + hamburger) shows,
  and tapping it opens a fixed overlay drawer with the full nav. Drawer closes on
  navigation (`useEffect` on `pathname`). **Breakpoint = `lg`** — matching the
  *existing nav's* convention (the old top-nav used `lg:` for its desktop/mobile
  split, not `md`); kept identical so behavior doesn't shift.
- Placement is identical on every route (the consistency goal).

## Preserved (contents unchanged)

- **Auth**: session/cookie checks, loading spinner guard, unauthenticated
  redirect, `handleSignOut` — all unchanged.
- **Prop-driven context bars**: the Travel search (`TripCreationBar` on travel
  routes), `bookkeepingBar`, `ledgerMetrics`, and `engineMetrics` bars are
  **preserved verbatim** and relocated to the top of the main content column, so
  pages passing those props (e.g. `dashboard/page.tsx`) keep their bars.
- `<main>` keeps the `max-w-[1800px] mx-auto` cap (now `w-full` inside the flex
  column so it fills the area beside the sidebar).
- `{children}` render exactly as before — **no page touched.**

> Minor, noted behavior change: the context bars were inside a `sticky` header;
> they now render in-flow at the top of the scrolling main column (the desktop
> sidebar itself is `lg:sticky`). No content change.

## Color (tokens only, no hex)

Sidebar bg `bg-brand-purple-deep` (darkest). Active item: `text-ts-aqua` +
`border-l-2 border-ts-aqua` + `bg-white/10` (aqua = the active/signal color).
Hover: `hover:bg-brand-purple/40` (purple opacity tint — works now post token-fix).
Built-CSS verified: `hover:bg-brand-purple/40 → rgb(var(--ts-purple) / 0.4)`,
`text-ts-aqua`/`border-ts-aqua` (solid) and `bg-white/10` all emit. (Aqua opacity
classes were deliberately avoided — aqua wasn't alpha-converted in the token PRs —
so only **solid** aqua is used.)

## Checks
- `npx tsc --noEmit` → exit 0.
- ESLint (both files) → 0 errors (1 pre-existing warning: unused `e` in the auth
  `catch`, untouched).
- Tokens only; no hex; no fallback logic. Only `AppLayout.tsx` rewired +
  `Sidebar.tsx` added — no page/route files changed.

## For Alex's eyeball (the verification that matters)
Load Hub + each module (Bookkeeping/Trading/Travel/Compliance/Operations):
- Sidebar is in the **same place** on every route; the active item tracks the
  current route (aqua highlight).
- Each page's **content looks exactly as before**, just framed by the sidebar
  instead of the top bar. Travel still shows its search bar; the dashboard still
  shows its ledger/engine/cockpit bars.
- Collapse/expand persists across navigation; on a phone width the rail becomes a
  hamburger drawer.

## Not verified
Headless sandbox — built the CSS (confirms class emission) and tsc/lint, but did
not load routes in a browser. Needs the eyeball pass above after deploy.
