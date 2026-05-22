# PR-OPS-DS-2 — Design-token layer (foundation only)

Creates the token SYSTEM from the DS-1 audit + Alex's locked palette. **Pure
infrastructure** — no component is migrated, so nothing on the Hub changes
visually. The only files touched are `src/app/globals.css` and
`tailwind.config.ts`. Built off `main`.

Re-verified against live source: the Operations source color at
`page.tsx:68` is `calendarColor: 'bg-indigo-400'` (= `#818cf8`); the unused
`brand-purple-light` (`#7b6baa`) has **0 references** in `src`, while
`brand-purple-hover` (`#4e3e85`) is used across many files.

---

## 1. The `:root` token block added (by family)

Added to `src/app/globals.css` `:root` alongside the existing
`--background`/`--foreground`:

- **Purple** — `--ts-purple-deep #2d1b4e`, `--ts-purple #3b2d6b` (banner),
  `--ts-purple-light #4e3e85` (the old `brand-purple-hover` value),
  `--ts-purple-wash #eae7f2` (replaces both the old wash and Tailwind
  `purple-50`).
- **Aqua (NEW)** — `--ts-aqua #14e0c8` (routine blocks), `--ts-aqua-deep
  #0fb8a8` (borders/hover).
- **Cyan** — `--ts-cyan #22d3ee` (Trip; kept distinct from aqua).
- **Indigo** — `--ts-indigo #818cf8` (Operations; = SOURCE_CONFIG
  `calendarColor` indigo-400).
- **Surface** — `--ts-white #fafaf9` (NEW warm off-white), `--ts-bg #f7f6f3`,
  `--ts-bg-row #f0eee9`.
- **Neutrals/text** — `--ts-text #1a1a2e`, `-secondary #4a4a5a`, `-muted
  #7a7488`, `-faint #a8a2b0`.
- **Borders** — `--ts-border #e2e0da`, `--ts-border-light #f0eee9`.
- **Status** — `--ts-green #16a34a`, `--ts-red #c53030`, `--ts-amber #d97706`.
- **Gold/accent** — `--ts-gold #7D6B2C`, `-bright #8B7D3C`, `-wash
  rgba(125,107,44,0.07)`, `--ts-accent #b4b237`, `--ts-accent-dark #9a9630`.
- **Panel (dark surfaces)** — `--ts-panel #0d1117`, `-surface #161b22`,
  `-border #30363d`, `-hover #21262d`, `-highlight #1a0f2e`.
- **Spacing/radius (foundation, not wired)** — `--ts-space-1…6`
  (0.25…1.5rem), `--ts-radius-none/sm/default` (0 / 0.125rem / 0.25rem).

---

## 2. `tailwind.config.ts` before → after (value-preservation proof)

Every existing color entry became a `var()` that resolves to its **identical
prior value**:

| Tailwind key | before (literal) | after | resolves to |
|---|---|---|---|
| `brand.purple` | `#3b2d6b` | `var(--ts-purple)` | **#3b2d6b** ✓ |
| `brand.purple-deep` | `#2d1b4e` | `var(--ts-purple-deep)` | **#2d1b4e** ✓ |
| `brand.purple-hover` | `#4e3e85` | `var(--ts-purple-light)` | **#4e3e85** ✓ (locked `--ts-purple-light` == old hover) |
| `brand.purple-light` | `#7b6baa` | `#7b6baa` (kept literal) | **#7b6baa** ✓ (unused; legacy — see note) |
| `brand.purple-wash` | `#eae7f2` | `var(--ts-purple-wash)` | **#eae7f2** ✓ |
| `brand.gold` / `-bright` / `-wash` | `#7D6B2C` / `#8B7D3C` / `rgba(125,107,44,0.07)` | `var(--ts-gold*)` | identical ✓ |
| `brand.green` / `red` / `amber` | `#16a34a` / `#c53030` / `#d97706` | `var(--ts-green/red/amber)` | identical ✓ |
| `brand.accent` / `-dark` | `#b4b237` / `#9a9630` | `var(--ts-accent*)` | identical ✓ |
| `panel.*` | `#0d1117/#161b22/#30363d/#21262d/#1a0f2e` | `var(--ts-panel*)` | identical ✓ |
| `bg.terminal` / `row` | `#f7f6f3` / `#f0eee9` | `var(--ts-bg)` / `var(--ts-bg-row)` | identical ✓ |
| `text.primary/secondary/muted/faint` | `#1a1a2e/#4a4a5a/#7a7488/#a8a2b0` | `var(--ts-text*)` | identical ✓ |
| `border.DEFAULT` / `light` | `#e2e0da` / `#f0eee9` | `var(--ts-border)` / `var(--ts-border-light)` | identical ✓ |

**Every existing token resolves to its current value** → no visual change.

**Legacy note — `brand.purple-light` (#7b6baa):** Alex's locked palette
intentionally collapsed the 8-way purple spread and dropped this stop (it's
**unused** — 0 refs in `src`). Rather than re-point it (which would change the
class's resolved value) or add a stray `#7b6baa` token back into the canonical
`:root` set, I left it as a literal with a `LEGACY` comment, value-preserved. It
will be deleted in the component-migration PR (no usages to migrate).

---

## 3. New tokens added, NOT yet referenced

A new `ts.*` color family was added to the config so these utilities exist:
`bg-ts-aqua` / `bg-ts-aqua-deep` / `text-ts-cyan` / `bg-ts-indigo` /
`bg-ts-white` (and `border-*`, `text-*` variants). **`--ts-aqua` (#14e0c8) and
`--ts-white` (#fafaf9) are new and referenced by NO component** — confirmed by
the scope check below. They are dormant until the next (adoption) PR.

---

## 4. Scope — only the two infra files changed

`git status` shows exactly two modified files: `src/app/globals.css` and
`tailwind.config.ts`. A grep for the Hub component files
(`page.tsx`, `CalendarGrid`, `HubEventCard`, `UnscheduledTaskTable`,
`BudgetDrillDown`) in the change set returned **none** — zero component edits,
`SOURCE_CONFIG` untouched.

---

## 5. Spacing / radius — DEFERRED (Tailwind wiring)

The spacing + radius **scales are defined as CSS tokens** (`--ts-space-1…6`,
`--ts-radius-*`) for the design system, but they are **not wired into
`theme.extend.spacing` / `borderRadius`**. Reason: adding numeric spacing/radius
keys risks shadowing Tailwind's defaults and shifting existing margins/paddings —
the brief said colors are the priority and to defer anything that could move
existing layout. The tokens exist for reference now; wiring them into utilities
(and migrating components onto them) is a later PR. Zero layout risk in this PR.

---

## 6. Verification

- **`tsc --noEmit`:** ✓ exit 0.
- **`next build`:** compilation + type-checking passed (the build progressed to
  "Collecting page data", which runs only after `Compiled successfully` and the
  type-validity check), then errored only on the **unrelated** route
  `/api/admin/backfill-transaction-fields` (`PLAID_CLIENT_ID and PLAID_SECRET
  must be set`) — the same sandbox-env limit seen in every prior PR (the `build`
  script also chains `prisma migrate deploy`, needing an unreachable
  `DATABASE_URL`). Not produced by this change; the Tailwind/CSS token layer
  compiled.

No fallback logic, no schema, no migration, no component edits. The aqua token
exists but nothing references it; every prior token resolves unchanged.
