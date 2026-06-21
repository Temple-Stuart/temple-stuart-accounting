# GUEST EMPTY-MODULE RENDERING — AUDIT (read-only)

**Branch:** `claude/audit-guest-empty-modules` · **Date:** 2026-06-21 · **Scope:** what's needed for a
logged-out guest on the Runway tab to see the REAL modules rendering EMPTY (like a brand-new user with no
data) — instead of `demoCalendar.ts` fake data — with **zero authed fetches** and **no weakened auth**.
Read-only; every claim cites `file:line`. Unread = "NOT VERIFIED."

---

## PER-MODULE TABLE

| Module | Component | Fetches (all AUTHED) | Graceful empty today? | 401/guest behavior | Needed for guest-empty |
|---|---|---|---|---|---|
| **Calendar** | `HubCalendar` | `/api/calendar` `:128`, `/api/operations/daily-plan/items` `:141`, `/api/hub/operations-routines` `:153` | **YES** (empty grid when no events) | fetch **skipped** when `demoEvents` truthy (`:173`) | **`demoEvents={[]}`** — no component change |
| **Runway panel** | `RunwayBudgetPanel` | `/api/runway` (`:160`) | **NO** — shows error text, not a zero-shell | 401 → `runwayError` → "Runway unavailable" (`:212-213`) | a **preview/no-fetch flag** + zero-state |
| **Trading panel** | `RunwayBudgetPanel` (same file) | `/api/trading/realized-pnl` (`:169`) | NO — error text | 401 → `tradingError` → "Trading unavailable" | same preview flag |
| **Budget table** | `HubBudgetSection` (+ `BudgetComparison`) | `/api/hub/year-calendar` etc (`:79`) | **YES** — "No budget or actual activity" (`:164-167`) | res not ok → empty data → empty state **but STILL fires the fetch** | preview flag to **suppress the fetch** |

---

## Q1 — THE CALENDAR (HubCalendar) → `demoEvents={[]}` is the whole answer

**Fetches (all account-gated, would 401 for a guest):**
- `loadCalendar` → `fetch('/api/calendar?from=…&to=…')` (`HubCalendar.tsx:128`)
- `loadOperationsBlocks` → `fetch('/api/operations/daily-plan/items?…')` (`:141`)
- `loadOperationsRoutines` → `fetch('/api/hub/operations-routines?…')` (`:153`)
- The file's own doc: *"all three routes are account-gated (NOT public)"* (`:14`).

**The guard + empty render:**
```ts
// :172-175
useEffect(() => {
  if (demoEvents) return;                 // ← skips ALL three fetches when demoEvents is truthy
  loadCalendar(); loadOperationsBlocks(); loadOperationsRoutines();
}, [range.from, range.to, demoEvents]);

// :179-180
const gridEvents = useMemo(() => {
  if (demoEvents) return demoEvents;       // ← renders demoEvents straight through
  …merge fetched…
}, […]);
```

**Decisive JS fact:** `[]` is **truthy**. So `demoEvents={[]}`:
- `isDemo = !!demoEvents = !![] = true` (`:105`),
- `if (demoEvents) return;` → **fetch effect early-returns → ZERO authed calls**,
- `gridEvents` → `return demoEvents` → `[]` → **a real, empty CalendarGrid.**

→ **Passing `demoEvents={[]}` yields a real empty calendar with no fetch — no HubCalendar change needed.**
(`if (demoEvents)` checks truthiness, not length, so `[]` keeps the guard active. Confirmed.)

## Q2 — THE RUNWAY BUDGET PANEL → self-fetches, error-on-401 (needs a no-fetch flag)

- Fetches **`/api/runway`** on mount: `RunwayBudgetPanel.tsx:158-165` `fetch('/api/runway').then(r => r.ok
  ? r.json() : Promise.reject(...))` — **no guard.**
- **`/api/runway` is authed:** `api/runway/route.ts` GET → `getVerifiedEmail()` → `401 Unauthorized` if
  absent (the route's first check). → a guest's fetch **rejects**.
- **On reject → `setRunwayError(true)` → renders** `<p>Runway unavailable — could not load cash + burn.</p>`
  (`:212-213`). That is an **error message, not a clean empty/zero shell.** *(The panel HAS truthful
  zero-paths — `cash.available === false` → "No bank linked" `:222`, window `state` labels — but those
  require a successful empty response, which a guest can't get.)*
- **Needed:** a `preview`/`guest` prop that (1) **skips the `/api/runway` fetch**, (2) feeds an **empty/zero
  RunwayData shape** so the real shell renders zeros (e.g. "No bank linked", "—") instead of the error text.

## Q3 — THE TRADING PANEL → same shape (inside RunwayBudgetPanel)

- Fetches **`/api/trading/realized-pnl`** on mount: `RunwayBudgetPanel.tsx:167-174` — **no guard.**
- **`/api/trading/realized-pnl` is authed:** `api/trading/realized-pnl/route.ts` → `getVerifiedEmail()` →
  401 for a guest.
- **On reject → `setTradingError(true)` → "Trading unavailable — could not load realized P&L."** (error
  text, not a zero shell).
- **Needed:** same preview flag suppresses this fetch and renders a zero P&L shell.

## Q4 — THE BUDGET TABLE (Budget vs Actual) → graceful empty, but still fetches

- Component: **`HubBudgetSection`** (and `BudgetComparison` for the Year view), rendered **inside**
  `RunwayBudgetPanel` (`:55` `view === 'month' ? <HubBudgetSection/> : <BudgetComparison/>`).
- Fetches the budget routes on mount: `HubBudgetSection.tsx:79`
  `fetch(\`${active.route}?year=${year}\`)` where `active.route` ∈ `/api/hub/year-calendar` /
  `/api/hub/business-budget` / `/api/hub/nomad-budget` (`:48-51`) — **all authed** (`getVerifiedEmail` →
  404/401, user-scoped).
- **Empty handling is graceful:** `res.ok ? res.json() : { empty }` (`:80`) → `rows.length === 0` →
  **"No budget or actual activity for {month} {year}."** (`:164-167`). So on a guest 401 it **degrades to
  the empty table** — BUT it **still fires the authed fetch** (`:79`), which 401s.
- **Needed:** a preview flag to **suppress the fetch** (the empty UI already exists; only the fetch must be
  prevented to honor the "no 401" mandate).

## Q5 — THE GUEST RENDER BRANCH (ModuleLauncher)

- **Authed branch** (`:442-456`): `<HubCalendar />` (real, no demoEvents) **+** `<RunwayDataProvider>
  <RunwayBudgetPanel /></RunwayDataProvider>`.
- **Guest branch** (`:457-462`): renders **ONLY** `<HubCalendar demoEvents={demoCalendar}
  onRequireAuth={…} />` — **no RunwayBudgetPanel, no Budget table at all.**

→ Today a guest sees only the demo calendar. To show the **same real modules empty**, the guest branch
must **also mount `RunwayBudgetPanel`** (which internally renders the runway readout + trading panel +
budget table), but in a **no-fetch preview mode**, and pass the calendar `demoEvents={[]}`. The decision
point is `ModuleLauncher:457-462`.

## Q6 — THE CLEANEST MECHANISM

**Evaluation of the three options:**
- **(a) empty props + a "preview/guest" no-fetch flag → render zero-states.** ✅ **FEASIBLE & cleanest.**
  Mirrors HubCalendar's proven `if (demoEvents) return` guard. Thread a `preview` boolean into
  `RunwayBudgetPanel` → it (i) skips both fetches, (ii) renders zero shells, and passes `preview` down to
  `HubBudgetSection`/`BudgetComparison` to skip their fetches (their empty UI already exists). Calendar gets
  `demoEvents={[]}`. **No route touched, no auth weakened, zero authed fetches.**
- **(b) make the authed routes return empty.** ❌ **RULED OUT (security).** `/api/runway`,
  `/api/trading/realized-pnl`, `/api/hub/year-calendar|business-budget|nomad-budget` are **authed +
  user-scoped** (each `getVerifiedEmail` → 401). Making them public to serve guests would **expose
  personal/financial routes** — a direct violation of the hard security constraint. **Do not do this.**
- **(c) a dedicated guest-preview render path mounting the real components with empty props.** ✅ Viable but
  **more code** than (a) — it duplicates the mount logic; (a) reuses the same component instances with one
  flag. (c) is essentially (a) without the flag, via a wrapper.

**RECOMMENDATION — Option (a), the preview-flag pattern:**
1. **Calendar:** `ModuleLauncher:460` → `demoEvents={[]}` (no `HubCalendar` change; truthy-empty keeps the
   no-fetch guard).
2. **RunwayBudgetPanel:** add a `preview?: boolean` prop → when true, the two `useEffect` fetches
   early-return (`if (preview) return;`) and the panel renders a **zero shell** (cash "No bank linked",
   net burn "—", trading P&L "$0 / not tracked") instead of the error text. Thread `preview` into
   `HubBudgetSection`/`BudgetComparison` so their budget-route fetches are likewise skipped (their
   `rows.length === 0` empty state already renders).
3. **ModuleLauncher guest branch (`:457-462`):** mount the **same** `RunwayBudgetPanel` (in
   `RunwayDataProvider`) with `preview`, alongside the empty calendar — so the guest sees the real shells
   empty.

**Security honored:** every authed route stays authed; guests render via **empty props / suppressed
fetches**, never by exposing a route. No `getVerifiedEmail` gate is removed.

---

## PR SEQUENCE (atomic)

1. **PR-A — Calendar guest-empty.** `ModuleLauncher:460` `demoEvents={demoCalendar}` → `demoEvents={[]}`
   (and retire the `demoCalendar` import/file once unused). Smallest, zero-risk: the guard already supports
   it; no `HubCalendar` change. *(This alone removes the fake calendar data.)*
2. **PR-B — RunwayBudgetPanel preview mode.** Add `preview` prop → suppress `/api/runway` +
   `/api/trading/realized-pnl` fetches, render zero shells. Thread `preview` to `HubBudgetSection` +
   `BudgetComparison` to suppress their budget fetches (one concept: "panel renders empty in preview").
3. **PR-C — Mount the panels in the guest branch.** `ModuleLauncher:457-462` → render `RunwayDataProvider`
   + `RunwayBudgetPanel preview` (and the empty calendar) for guests. Now the guest sees the real,
   empty modules with **no authed fetch**.

*(PR-B and PR-C could merge if preferred, but B is a self-contained component capability and C is the
mount wiring — splitting keeps each revertible. Travel/paid-tab guest work remains separate, per the
GUEST-EXPERIENCE audit.)*

---

## SECURITY CALLOUT (hard constraint honored)

All data routes behind these modules are **authed + user-scoped** and **MUST stay so**:
`/api/runway`, `/api/trading/realized-pnl`, `/api/hub/year-calendar`, `/api/hub/business-budget`,
`/api/hub/nomad-budget`, `/api/calendar`, `/api/operations/daily-plan/items`,
`/api/hub/operations-routines` (each `getVerifiedEmail` → 401). The guest-empty experience is achieved
**entirely client-side** (empty props + suppressed fetches) — **option (b) is rejected**; no route is made
public, no auth gate is removed.

---

*Read-only audit. No code changed; this `.md` is the only file created. Core findings: the calendar needs
only `demoEvents={[]}` (truthy-empty keeps the no-fetch guard, `HubCalendar.tsx:173,180`); the
RunwayBudgetPanel + Trading panel self-fetch authed routes and show ERROR text on 401 (need a preview/no-
fetch flag); the Budget table already degrades to an empty state but still fires its fetch; the guest
branch currently mounts only the calendar. Cleanest path = option (a) preview-flag, no auth weakened.
Every claim cites `file:line`.*
