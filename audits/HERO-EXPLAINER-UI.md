# HERO EXPLAINER UI — AUDIT (collapsible + spacing + subhead, read-only)

**Branch:** `claude/audit-hero-explainer-ui` · **Date:** 2026-06-21 · **Scope:** gather everything needed to
(1) make the "How it works" steps **collapsible** (hidden by default, one toggle), (2) **tighten** the
subhead→steps gap, (3) make the subhead **bigger + bold** (same font/color) — across all three tab blocks
(projects, calendar/Runway, routines). Read-only; every claim cites `file:line`. Unread = "NOT VERIFIED."

---

## FINDINGS TABLE (Q1–Q6)

| Q | Finding | `file:line` |
|---|---|---|
| **Q1 Client/server** | `'use client'`; `useState` already used; `activeTab` state lives in **this** component | `page.tsx:1,3,16` |
| **Q2 Three blocks** | 3 **separate inline** blocks (projects/calendar/routines), not a shared component | `page.tsx:123-140, 144-161, 165-181` |
| **Q3 The gap** | subhead `<p>` has `min-h-[4rem]` + `mb-8` → reserves 4rem then adds 2rem | `page.tsx:117` |
| **Q4 Subhead style** | `text-terminal-lg` (= **11px**), normal weight, `text-text-faint` — smaller than the 14px steps | `page.tsx:117`; `tailwind.config.ts:75` |
| **Q5 Toggle surface** | `How it works:` is a plain `<p>` in each block — can become the toggle; **one** shared state suffices | `page.tsx:125,146,167` |
| **Q6 Tokens/icon** | design tokens listed; **lucide-react available** (used in ModuleLauncher) but NOT imported in page.tsx | `ModuleLauncher.tsx:7` |

---

## Q1 — CLIENT VS SERVER → **client; state can live here directly**

- `page.tsx:1` `'use client';` — it is a client component.
- `page.tsx:3` `import { useState, useEffect } from 'react';` — hooks already imported and used:
  `showLogin` (`:12`), **`activeTab` (`:16`)**, `loginRedirect` (`:19`), `loginMode` (`:20`), plus a
  `useEffect` for `/api/auth/me` (`:27`).
- **`activeTab` state lives IN this component** (`page.tsx:16` `const [activeTab, setActiveTab] =
  useState('calendar')`). `ModuleLauncher` owns the tab *buttons* but reports up via
  `onTabChange={setActiveTab}` (`page.tsx:178`) — so `LandingPage` already holds the tab state and renders
  the Hero inline.

→ **VERDICT:** a collapse `useState` (e.g. `const [howOpen, setHowOpen] = useState(false)`) can be added
**directly to `LandingPage`** — no new client component, no lifting. The toggle state belongs right next to
`activeTab` (`page.tsx:16`).

## Q2 — THE THREE EXPLAINER BLOCKS → 3 separate inline blocks

All three are inline JSX, **structurally identical**, differing only in the gate value + step strings:
- **Projects** — `{activeTab === 'projects' && ( … )}` (`page.tsx:123-140`).
- **Runway** — `{activeTab === 'calendar' && ( … )}` (`page.tsx:144-161`).
- **Routines** — `{activeTab === 'routines' && ( … )}` (`page.tsx:165-181`).

Each block is: `<div className="text-text-faint text-sm mb-8 max-w-xl">` → `<p
className="text-white font-medium mb-2">How it works:</p>` → `<ol className="list-decimal list-inside
space-y-2">{[…].map(...)}</ol>`. **They are NOT a shared component.**

**Refactor options:**
- **(a) ONE shared block** — hoist the 3 step arrays into a `const STEPS: Record<string, string[]>` keyed
  by tab, and render a **single** block `{STEPS[activeTab] && ( …collapsible… )}`. Since **only one tab's
  block renders at a time** (gated on `activeTab`), this collapses ~55 lines to one and puts the
  collapsible logic in **one** place. **Cleaner, lower-duplication.**
- **(b) Same inline treatment ×3** — add the toggle markup + collapse condition to each of the three
  blocks. Works, but triples the toggle JSX and invites drift (must keep 3 copies in sync).

## Q3 — THE SPACING SOURCE (the big gap) → `min-h-[4rem]` + `mb-8` on the subhead

The subhead container (`page.tsx:117`):
```tsx
<p className="text-text-faint text-terminal-lg mb-8 max-w-xl min-h-[4rem]">
  {TAB_DESCRIPTORS[activeTab]}
</p>
```
- **`min-h-[4rem]`** reserves **4rem (64px)** of height regardless of how short the descriptor is — a
  one-line descriptor leaves a large empty band **below the text, inside the box.** (Its stated purpose,
  `:114-116`: "min-h reserves space so the Get Started button never jumps as the line changes length.")
- **`mb-8`** then adds **2rem (32px)** margin below that box, before the "How it works" block.

→ **The big gap = the empty tail of `min-h-[4rem]` + `mb-8`.** To tighten (current → recommended):
- `min-h-[4rem]` → **`min-h-0`** (or a small reserve like `min-h-[2rem]`). *Tradeoff:* removing it lets the
  Get Started button shift slightly when the descriptor wraps to a different line count on tab switch — with
  steps now collapsed by default this is minor; a small `min-h-[2rem]` is a safe middle ground.
- `mb-8` → **`mb-3`** (12px) or `mb-2` (8px).

## Q4 — THE SUBHEAD STYLING (bigger + bold) — current values

- **Subhead** (`page.tsx:117`): `text-text-faint text-terminal-lg mb-8 max-w-xl min-h-[4rem]`
  - **Size** = `text-terminal-lg`, which `tailwind.config.ts:75` defines as **`['11px', { lineHeight:
    '16px' }]`** → only **11px**.
  - **Weight** = none (normal). **Color** = `text-text-faint`.
- **"How it works:" headline** (`page.tsx:125`): `text-white font-medium mb-2` (medium weight, white).
- **Steps** — wrapper (`:124`) `text-text-faint text-sm` (**14px**), `<ol>` (`:126`) `list-decimal
  list-inside space-y-2`.

**Observation:** the subhead (11px) is currently **smaller** than the step text (14px) and lighter than the
headline — it does not visually outrank anything. To make it **bigger + bold, same font family + same
`text-text-faint` color** (current → recommended):
- Size: `text-terminal-lg` (11px) → **`text-base`** (16px) or **`text-lg`** (18px).
- Weight: *(normal)* → add **`font-semibold`** (or `font-bold`).
- Keep **`text-text-faint`** (color unchanged), keep `max-w-xl`.
- → e.g. `className="text-text-faint text-lg font-semibold mb-3 max-w-xl min-h-[2rem]"` (combines Q3 + Q4).

## Q5 — TOGGLE UX SURFACE → make `How it works:` the toggle; one shared state

- In each block, `How it works:` is a plain **`<p className="text-white font-medium mb-2">`** (`:125,146,
  167`). It can become a clickable **`<button>`** (same classes) with a chevron indicator, toggling the
  steps' visibility.
- **One shared collapse state suffices.** Because the three blocks are mutually exclusive (only the active
  tab's block mounts), a single `howOpen` boolean drives whichever block is showing. *Behavior choice:*
  with one state, switching tabs preserves open/closed; if "collapsed on every tab change" is wanted, reset
  `howOpen=false` in the tab-change handler (or key the toggle off `activeTab`). **One state is cleaner**;
  three independent states are unnecessary (only one renders at a time).
- Default **collapsed** = render the `<ol>` only `when howOpen` (`{howOpen && <ol>…</ol>}`).

## Q6 — STYLING TOKENS / NO-REGRESSION

**Tokens already in use (reuse — no new colors):** `bg-brand-purple`, `text-white`, `text-text-faint`,
`text-terminal-lg` (11px, `config:75`), `text-sm` (14px), `font-light`, `font-medium`, `tracking-tight`,
`mb-8/mb-4/mb-2`, `max-w-xl`, `list-decimal`, `list-inside`, `space-y-2` (all in `page.tsx:106-167`).
**Larger sizes available** (default Tailwind): `text-base` 16px, `text-lg` 18px, `text-xl` 20px.

**Chevron icon:** **lucide-react is available** in the project — `ModuleLauncher.tsx:7` imports icons from
`'lucide-react'` (Calendar, Repeat, etc.). **It is NOT yet imported in `page.tsx`** (`page.tsx:3-8` imports
only react/next-auth/Link/Image/LoginBox/ModuleLauncher). For a chevron, add e.g. `import { ChevronDown }
from 'lucide-react'` to `page.tsx`, or use a small rotating inline SVG / unicode (`▸`/`▾`) to avoid the new
import. Either is design-system-safe.

---

## BUILD APPROACH (recommendation)

**Refactor the 3 inline blocks into ONE shared collapsible block (Option 2a).** Reasoning:
- **Client-component requirement is already met** (Q1: `'use client'`, `activeTab` here) — the collapse
  `useState` drops straight into `LandingPage`; no new component, no state lifting.
- The blocks are **byte-identical except data** (Q2) → a `STEPS: Record<string,string[]>` map + one render
  removes ~55 lines and guarantees the collapsible + spacing + subhead changes apply **consistently** to all
  three tabs (no 3-way drift). Only one block mounts at a time, so a single `howOpen` state is exact (Q5).
- **Lower risk than 3× inline edits** (one place to get right, one place to review). If a minimal-diff is
  preferred, Option 2b (same treatment inline ×3) is acceptable but triplicates the toggle markup.

**Exact changes (unambiguous):**
- **Spacing (Q3)** — subhead `page.tsx:117`: `min-h-[4rem]` → `min-h-0` (or `min-h-[2rem]`); `mb-8` → `mb-3`.
- **Subhead (Q4)** — subhead `page.tsx:117`: `text-terminal-lg` → `text-lg` (or `text-base`); add
  `font-semibold`; keep `text-text-faint`.
- **Collapsible (Q1/Q5)** — add `const [howOpen, setHowOpen] = useState(false)` near `:16`; turn each
  `How it works:` `<p>` (`:125/146/167`) into a `<button onClick={() => setHowOpen(o => !o)}>` with a
  chevron; render the `<ol>` only `when howOpen`. Default collapsed.

---

*Read-only audit. No code changed; this `.md` is the only file created. Decisive facts: the Hero is already
a client component with `activeTab` state local (`page.tsx:1,16`); the subhead is 11px (`config:75`) — small,
not big; the gap is `min-h-[4rem]` + `mb-8` (`page.tsx:117`); the three blocks are inline twins ripe for a
single shared collapsible. Every claim cites `file:line`.*
