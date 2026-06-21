# PROJECTS ONBOARDING PATTERN — AUDIT (for Runway reuse, read-only)

**Branch:** `claude/audit-onboarding-pattern` · **Date:** 2026-06-21 · **Scope:** how the Projects
onboarding ("Track your money. Plan your life. Act smarter." + "How it works" 7 steps + Get Started) is
built, so an equivalent **Runway** onboarding can reuse the proven structure. Read-only; every claim cites
`file:line`. Unread = "NOT VERIFIED."

---

## FINDINGS TABLE (Q1–Q6)

| Q | Finding | `file:line` |
|---|---|---|
| **Q1 Location** | The landing **Hero** in `page.tsx` — headline + per-tab subhead + conditional "How it works" + Get Started | `src/app/page.tsx:105-149` |
| **Q2 Reusable?** | **BESPOKE/inline** — 7 steps are a hardcoded literal gated `activeTab==='projects'`; only the *subhead* is data-driven (`TAB_DESCRIPTORS`) | `page.tsx:123-140`; `ModuleLauncher.tsx:107-113` |
| **Q3 Trigger** | **Tab-driven, NOT data-driven** — `activeTab === 'projects'`; no `projects.length===0`; hero queries only `/api/auth/me` | `page.tsx:123`, `:29` |
| **Q4 Get Started** | Opens the **register modal** (`LoginBox`) — no route, no seed, no scroll | `page.tsx:142-145`, `:223-235` |
| **Q5 Runway surface** | Runway = the `'calendar'` tab/module; `RunwayBudgetPanel` renders there | `ModuleLauncher.tsx:80,443-456` |
| **Q6 Styling** | `bg-brand-purple` / `text-white` / `text-text-faint`, `font-light tracking-tight`, `list-decimal list-inside`, white CTA | `page.tsx:106,109,124-126,142-145` |

---

## Q1 — LOCATE THE PROJECTS ONBOARDING

It is **not a standalone component** — it is the landing-page **Hero** (`src/app/page.tsx:105-149`),
whose middle block swaps per active tab:

- **Headline block** (`:109-113`):
  ```tsx
  <h1 className="text-4xl lg:text-5xl font-light tracking-tight mb-4">
    Track your money.<br />Plan your life.<br />
    <span className="text-text-faint">Act smarter.</span>
  </h1>
  ```
- **Per-tab subhead** (`:117-119`): `{TAB_DESCRIPTORS[activeTab]}` with a `min-h-[4rem]` reserve.
- **"How it works" 7-step list** (`:123-140`) — gated on the projects tab:
  ```tsx
  {activeTab === 'projects' && (
    <div className="text-text-faint text-sm mb-8 max-w-xl">
      <p className="text-white font-medium mb-2">How it works:</p>
      <ol className="list-decimal list-inside space-y-2">
        {[ "You bring a problem…", "Research finds the right way…", /* …7 inline strings… */ ]
          .map((step, i) => <li key={i}>{step}</li>)}
      </ol>
    </div>
  )}
  ```
  (the 7 steps are an **inline string-literal array**, `:127-135`.)
- **Get Started button** (`:141-146`):
  ```tsx
  <button onClick={() => { setLoginMode('register'); setShowLogin(true); }}
    className="px-6 py-3 bg-white text-brand-purple font-medium hover:bg-bg-row text-sm">
    Get Started
  </button>
  ```

## Q2 — IS IT REUSABLE OR BESPOKE? → **BESPOKE (inline), subhead-only parameterized**

- **No reusable onboarding component exists.** There is no `<Onboarding title=… steps=… onGetStarted=… />`.
  The headline, the 7-step list, and the button are written **inline** in `page.tsx`'s Hero JSX.
- The **only** parameterized piece is the **subhead**, driven by a tab→string map:
  ```ts
  // ModuleLauncher.tsx:107-113
  export const TAB_DESCRIPTORS: Record<string, string> = {
    calendar: 'Runway — how long your money buys you. …',   // :108 (Runway tab)
    projects: "Type the big messy goal that's rattling around your head…",  // :112
    // …
  };
  ```
  So the subhead **already has a Runway entry** (`calendar`, `:108`) — but the **7-step "How it works" is
  hardcoded to projects** (`page.tsx:123`).

**VERDICT: BESPOKE.** To add Runway onboarding you must either:
- **(A) Add a parallel block** `{activeTab === 'calendar' && ( …Runway steps… )}` mirroring `:123-140`
  — lowest effort, matches the existing idiom, one small JSX edit in `page.tsx`. **Recommended.**
- **(B) Extract a reusable** `<HowItWorks steps={string[]} />` and render it for both tabs — cleaner long
  term, slightly larger change (new component + refactor the projects block). Optional.

## Q3 — WHAT TRIGGERS THE EMPTY STATE? → **the active TAB, not data**

The "How it works" is shown by **`activeTab === 'projects'`** (`page.tsx:123`) — a pure UI-tab condition.
- It **queries no project data** to decide. The hero's only fetch is `/api/auth/me` (`:29`), used for the
  header's Enter↔Log-out — not for the onboarding. `activeTab` is local state (`:16`) set from
  `ModuleLauncher`'s `onTabChange` (`:157`).
- There is **NO `projects.length === 0`** gate; the explainer renders for **everyone** (guest *and*
  logged-in) whenever the Projects tab is active. It is a **guest-facing marketing explainer**, not a
  data-driven "empty state."
- **NOT VERIFIED:** whether a *separate* logged-in, data-driven projects empty-state exists elsewhere
  (e.g. in the workbench `SectionD_ProjectBacklog`) — that is a different surface from this headline hero
  and out of scope here.

→ For Runway, the equivalent trigger would be `activeTab === 'calendar'` (the Runway tab) — OR, if a
data-driven "Runway not set up" is wanted, one of the signals in **Q5** (those require an explicit query).

## Q4 — WHAT DOES "GET STARTED" DO? → opens the register modal

`page.tsx:142` `onClick={() => { setLoginMode('register'); setShowLogin(true); }}`. That flips two pieces
of state; the modal at `:223-235` then renders `<LoginBox … initialMode={loginMode} />` (register mode).
**No routing, no data seeding, no scroll-to-input.** (For a logged-in user the same button would still
open the register modal — the hero is built for the guest path.)

## Q5 — THE RUNWAY SURFACE + candidate "empty" signals

**Surface:** the Runway tab is the **`'calendar'`** module (`ModuleLauncher.tsx:80` `{ key: 'calendar',
label: 'Runway' }`). Its panel renders in the `activeModule === 'calendar'` section
(`ModuleLauncher.tsx:443-456`): `<RunwayDataProvider><RunwayBudgetPanel /></RunwayDataProvider>`. A Runway
onboarding would mount **either** in `page.tsx`'s Hero (gated `activeTab === 'calendar'`, mirroring
`:123`) **or** as an empty-state inside `RunwayBudgetPanel` (which already fetches `/api/runway`).

**Candidate truthful "Runway not set up" signals that EXIST in code** (reported, not chosen):

| Signal | How to detect | Already computed? | User-scoped? |
|---|---|---|---|
| **No bank linked** | `/api/runway` → `cash.available === false` (`accountsLinked === 0`) | YES — `runway/route.ts:97-104` | YES (`WHERE "userId"`) |
| **No operating ledger history** | `/api/runway` windows all `state === 'insufficient_history'` (earliest non-trading ledger date null) | YES — `runway/route.ts:108-…` | YES (`je."userId"`) |
| **Cash unavailable / $0** | `cash.available === false` (same as #1) | YES | YES |
| **Zero routines** | `SELECT COUNT(*) FROM operations_routines WHERE user_id = …` (pattern: `operations-routines` route) | NO (extra query) | YES if `user_id` added |
| **No planned budget** | year-calendar `budgetData` empty for the user/year | YES via `/api/hub/year-calendar` | YES |

**Strongest reuse:** signals #1–#3 are **already in the `/api/runway` response** the panel fetches — so a
data-driven Runway empty-state needs **no new query**; it can read `cash.available` / window `state`. DO
NOT pick one here — Alex chooses which truthfully means "not set up."

## Q6 — STYLING TOKENS (so a Runway version matches)

- **Purple hero treatment:** `className="bg-brand-purple text-white …"` on the section (`page.tsx:106`).
- **Headline:** `text-4xl lg:text-5xl font-light tracking-tight` (`:109`); de-emphasized line via
  `<span className="text-text-faint">` (`:112`).
- **Subhead / body:** `text-text-faint`, `text-terminal-lg` / `text-sm` (`:117,124`).
- **Steps list:** `text-white font-medium` label (`:125`) + `<ol className="list-decimal list-inside
  space-y-2">` (`:126`).
- **CTA button:** `px-6 py-3 bg-white text-brand-purple font-medium hover:bg-bg-row text-sm` (`:142-145`).
- All are existing design tokens (`brand-purple`, `text-faint`, `bg-row`, `terminal-lg`) — **no new
  colors** needed for a matching Runway version.

---

## BUILD APPROACH (recommendation)

**Reuse-by-pattern, not by component (Approach A):** add a Runway "How it works" block in `page.tsx`'s
Hero gated `activeTab === 'calendar'`, mirroring the projects block (`:123-140`), with Runway-specific
step strings. Reasoning:
- The existing onboarding is **inline + tab-keyed**, and the **subhead already has a `calendar` (Runway)
  entry** (`TAB_DESCRIPTORS:108`) — so the pattern is half-built for Runway already; only the 7-step list
  is missing.
- It's a **single, low-risk JSX addition** in one file, visually identical by construction (same tokens).
- **Optional upgrade (Approach B):** if onboarding will grow to more tabs, extract a tiny
  `<HowItWorks steps={…} />` and render it for both `projects` and `calendar`. More code now, less
  duplication later. Either is fine; A is the minimal truthful match.

## RUNWAY EMPTY-STATE OPTIONS (Alex chooses the truthful trigger)

If a **data-driven** "Runway not set up" state is wanted (instead of/in addition to the tab-driven hero),
the truthful candidates already detectable are:
1. **No bank linked** — `cash.available === false` (most decisive; runway has no numerator). *Already in
   `/api/runway`.*
2. **No operating ledger history** — every window `state === 'insufficient_history'`. *Already in
   `/api/runway`.*
3. **Zero routines / no planned budget** — requires the routines-count or year-calendar query (extra read).

Recommend **#1 or #2** since they need **no new query** and map exactly to "Runway can't be computed yet."

---

*Read-only audit. No code changed; this `.md` is the only file created. The onboarding is the inline,
tab-driven landing Hero (`page.tsx:105-149`), not a reusable component or a data-driven empty state; a
Runway version is a parallel `activeTab === 'calendar'` block (or an extracted `<HowItWorks/>`). Every
claim cites `file:line`; any separate logged-in projects empty-state is NOT VERIFIED.*
