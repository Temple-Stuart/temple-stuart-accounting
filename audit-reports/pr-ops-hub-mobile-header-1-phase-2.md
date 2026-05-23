# PR-Ops-Hub-Mobile-Header-1 — Phase 2 Build

Compact unified **mobile-only** (`<768px`) Hub header. Desktop (`≥768px`)
unchanged on every surface; Trading + both Trips byte-identical; nav (AppLayout)
untouched. Tokens only, no hardcoded hex. `tsc` + lint clean.

Mobile boundary: Tailwind has **no `screens` override** (tailwind.config.ts) →
default `md` = `min-width:768px`. So CSS `md:` flips at 768px, exactly matching
the JS `useMediaQuery('(max-width: 767px)')` boundary used by
`ResponsiveViewController.tsx:27`. **One consistent 768px boundary.**

---

## (A) Compact command-center bar — `hub/page.tsx:403-422` (Hub-only inline JSX)

Pure CSS responsive (`md:`) — no JS, SSR-safe, no hydration flash. Desktop
restores the prior layout exactly.

- **Outer div** (`:407`): `mb-0 md:mb-6` · `p-3 md:p-4` · `rounded-lg md:rounded-none`.
  Kept `bg-brand-purple`, the `border-t-2 border-t-ts-aqua` rule, and the
  `border-b-[3px] border-b-brand-purple-deep` edge.
- **Role line** (`:413`): `Financial ` is now wrapped in
  `<span className="hidden md:inline">` + the `<p>` gets `whitespace-nowrap`.
  → mobile renders "Command Center · FY 2026" (one line, no wrap); desktop
  renders "Financial Command Center · FY 2026" (identical to before).
- **Right block** (`:416-421`): split into a mobile `md:hidden` single line
  ("Updated May 22", `{month:'short', day:'numeric'}`) and a desktop
  `hidden md:block` two-line block ("Last updated" + "May 22, 2026") that is the
  exact prior markup.
- Layout stays `flex items-center justify-between` (`:408`) — two elements,
  no empty center.

**Desktop-unchanged proof:** every new class is gated by `md:`. At `≥768px`:
`md:mb-6`→mb-6, `md:p-4`→p-4, `md:rounded-none`→no radius (== prior, which had
no rounded class), `Financial ` span visible, desktop two-line block visible,
mobile line hidden. Net desktop DOM/classes == pre-change.

## (B) Continuous stack — `hub/page.tsx:407` (Hub-only)

The gap below the banner was the banner's `mb-6`. Now `mb-0 md:mb-6`: on mobile
the banner (with its aqua top-rule crowning the stack) sits flush above the
calendar card — nav → command-center → toolbar read as one continuous stack.
Desktop keeps `mb-6`.

## (C) Tight-rounded cards — mobile only (Hub-only/gated)

- **Banner**: `rounded-lg md:rounded-none` (`hub/page.tsx:407`).
- **Calendar card**: CalendarGrid root (`:330`) now
  `${hubMobileToolbar ? 'rounded-lg' : 'rounded'}`. Hub-mobile → `rounded-lg`
  (8px); Hub-desktop & all non-Hub → `rounded` (unchanged 4px).
- Edge breathing room comes from the existing page container `p-6 lg:p-8`
  (`hub/page.tsx:398`) — 24px inset on mobile — so no extra `mx` was added
  (avoids double-inset; the cards already float off the screen edges).
- `rounded-lg` (8px) used as the "~9px tight" radius — no custom radius token
  exists (the `--ts-radius*` vars top out at 4px and are unwired, per Phase 1).

## (D) Mobile-stacked toolbar — `CalendarGrid.tsx` (shared, GATED)

Hook added (`:6`): `import { useMediaQuery } from '@/hooks/useMediaQuery'`.
Gate (`:292-293`):
```
const isMobile = useMediaQuery('(max-width: 767px)');
const hubMobileToolbar = enableHubChrome && isMobile;
```
Gated class strings (`:294-305`) drive the layout; markup applied at the toolbar
(`:336-348`):
- **Row 1** — view track: container `toolbarLeftClass` = `flex flex-col gap-2`
  (mobile) vs `flex items-center gap-4`; track gets `w-full`; Day/Week/Month
  buttons get `flex-1` (equal width).
- **Row 2** — title `<h2 className={toolbarTitleClass}>` = `... text-center`
  (mobile) — full title on its own line, kills the "Fri/May/22/2026" vertical wrap.
- **Row 3** — `<div className={toolbarRightClass}>` = `flex items-center justify-center gap-2` — ‹ Today › centered.
- Bar container `toolbarBarClass` switches to `flex flex-col gap-3 ...` on
  Hub-mobile, keeping the purple-wash + purple top border.

### No-op proof — Trading + both Trips byte-identical
`hubMobileToolbar = enableHubChrome && isMobile`. Trading
(`trading/page.tsx`), Trips list, and Trip detail **never pass
`enableHubChrome`** → it defaults `false` (`:166`) → `hubMobileToolbar` is
**permanently false regardless of viewport**. Therefore every gated string
resolves to its exact pre-change value:

| var | non-Hub / Hub-desktop value |
|-----|------------------------------|
| `toolbarBarClass` | `flex items-center justify-between px-4 py-3 border-b border-border bg-bg-row/50` (non-Hub) |
| `toolbarLeftClass` | `flex items-center gap-4` |
| `viewTrackExtra` | `''` → track `flex bg-border/70 rounded p-0.5` |
| `viewBtnExtra` | `''` → btn `px-3 py-1.5 text-sm font-medium rounded-md transition-colors …` |
| `toolbarTitleClass` | `text-sm font-semibold text-text-primary` |
| `toolbarRightClass` | `flex items-center gap-2` |
| root radius | `rounded` |

All character-for-character identical to the pre-mobile build → identical DOM.

**Hook-safety (Rules of Hooks):** `useMediaQuery` is called unconditionally at
the top level (required), but `isMobile` is **only consumed via
`hubMobileToolbar`**, which is `false` for non-opting callers. So the hook adds
only a passive `matchMedia` listener for Trading/Trips — **zero** render or
behavior change. (Documented inline at `:286-291`.) This is the explicitly
pre-approved "gate the consumption" pattern; output is provably identical.

> Why CSS `md:` for the banner but JS `isMobile` for the toolbar: the banner is
> Hub-only inline JSX with no shared-caller risk, so pure CSS (flash-free, SSR-safe)
> is cleanest. The toolbar is shared; the JS gate `enableHubChrome && isMobile`
> guarantees non-Hub callers receive the unchanged class strings. Both flip at
> the same 768px boundary.

---

## Constraints check
- ✅ **Desktop unchanged**, every surface (all mobile classes gated by `md:` or
  `hubMobileToolbar`/`isMobile`).
- ✅ **Trading + both Trips byte-identical** (gate proof above).
- ✅ **Nav (AppLayout) untouched** — zero edits to `AppLayout.tsx`.
- ✅ **Tokens only**: `bg-brand-purple`, `border-t-ts-aqua`,
  `border-b-brand-purple-deep`, `bg-brand-purple-wash`, `text-brand-purple`,
  `rounded-lg`. No hardcoded hex added.
- ✅ No fallback logic, no schema changes.
- ✅ `npx tsc --noEmit` → exit 0. ESLint touched files → 0 errors (19 pre-existing
  warnings: unused imports / effect-deps, unrelated).

## Not verified
`/hub` is auth-gated (307 → `/`) in this headless env, so the mobile visual
result (compact banner, continuous stack, rounded cards, 3-row toolbar at
≤767px) needs a manual pass in an authenticated mobile-width browser.
