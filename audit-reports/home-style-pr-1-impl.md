# HOME-STYLE-PR-1 — Contrast + hierarchy pass on home module forms

**Goal:** Improve field contrast + label/header hierarchy on the home module forms
(Travel, Trading, Operations showroom) using the **existing palette only** — no new
colors, no logic/fetch/structural change.

---

## STEP 1 — Audit: where the styles live

### Home-editable form components (home-only — safe to restyle)
| Component | File | Field/label styling locus |
|---|---|---|
| RoutineCreateForm | `src/components/home/RoutineCreateForm.tsx:37-39` | local `inputClass` + `labelClass` |
| ProjectCreateForm | `src/components/home/ProjectCreateForm.tsx:39-41` | local `inputClass` + `labelClass` |
| ContentPreview | `src/components/home/ContentPreview.tsx:34` | local `labelClass` + inline entity-filter select |
| EvolutionPreview | `src/components/home/EvolutionPreview.tsx` | inline (intentionally muted placeholder spine) |
| OperationsShowroom (Panel) | `src/components/home/OperationsShowroom.tsx:103` | panel-header `step` ordinal |

### Shared widgets — **NOT edited** (also rendered by `/operations`)
These are imported by the home forms but their **source was left untouched**; contrast
is improved only via the home wrapper (panel bg, labels, the home-scoped field classes
around them):
- `RRULEBuilder` — `RoutineCreateForm.tsx:19` → `src/components/workbench/operations/routines/RRULEBuilder.tsx`
- `ListManager` — `ProjectCreateForm.tsx:24` → `src/components/workbench/operations/projects/ListManager.tsx`
- `ContentTable` — `ContentPreview.tsx:23` → `src/components/workbench/operations/content/ContentTable.tsx`

### Shared-with-dashboard forms (explicit task targets — flagged)
`CreateTripForm` and `ScanFilterForm` are the Travel/Trading module forms named in the
task. They are **also** rendered on their live dashboards (`/budgets/trips` index and
the trading dashboard) via the `showHeader` prop. The contrast pass applied to them is a
pure readability upgrade (label color/weight + darker field border + purple focus) and
lands identically on those dashboards — consistent, not a regression. **Flagged here so
the blast radius is explicit.**

### Palette tokens reused (cited from `tailwind.config.ts`)
| Token | Value | Use |
|---|---|---|
| `brand-purple` | `--ts-purple` **#3b2d6b** (`tailwind.config.ts:20`) | labels, section headers, field focus border. Alpha-compatible (`rgb(var / <alpha-value>)`, line 18-20) → `brand-purple/40` border, `brand-purple/20` focus ring derive from it with **zero new color** |
| `bg-bg-row` | #f0eee9 (`:43`) | light-gray panel behind white inputs |
| `text-primary` | #1a1a2e (`:46`) | typed field text |
| `text-secondary` | #4a4a5a (`:47`) | Trading field sub-labels |
| `text-muted` | #7a7488 (`:48`) | readable placeholder + empty-state text (replaces ghost `text-faint`) |
| `text-faint` | #a8a2b0 (`:49`) | **removed** from labels/headers (was the low-contrast culprit) |
| `border-border` | #e2e0da (`:52`) | panel frame |
| `bg-white` | white | field bg |

**Note on the mock hexes:** the brief referenced #534AB7 / #3C3489 / #26215C / #B8B5CC as
the *intent*. The codebase palette has a single dark `brand-purple` (#3b2d6b) — using the
literal mock hexes would introduce **new colors** (forbidden), so labels + headers map to
`brand-purple`, and the "muted purple-gray border ~#B8B5CC" / "focus rgba(83,74,183,0.15)"
are derived from `brand-purple` via the `/40` and `/20` alpha modifiers. No new hex added.

---

## STEP 2 — Contrast changes applied (cited)

### Operations showroom forms (home-only)
**RoutineCreateForm** & **ProjectCreateForm** (`inputClass`/`labelClass`/panel — identical):
- Labels `text-faint` (ghost) → **`text-brand-purple font-medium`** (scannable dark purple, weight 500).
- Fields: added **`bg-white`**, border `border-border` → **`border-brand-purple/40`** (darker muted purple-gray), **`placeholder:text-text-muted`** (readable), focus → **`focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20`** (purple ring ≈ approved rgba(83,74,183,0.15)). Kept `text-text-primary` typed text.
- Panel container `bg-white` → **`bg-bg-row`** so the white fields sit on a light-gray panel and edges show (the mock's white-on-gray). ProjectCreateForm's nested "4 · design" box flipped `bg-bg-row` → `bg-white` to stay distinct against the now-gray panel (`ProjectCreateForm.tsx:128`).
- Empty output tables: header/count/cadence-pill `text-faint` → `text-muted` (readable).

**ContentPreview** (`ContentPreview.tsx`):
- `labelClass` `text-faint` → `text-brand-purple font-medium`.
- Disabled entity-filter select: `border-border` → `bg-white border-brand-purple/40`.
- Caption `text-faint italic` → `text-muted italic`.
- `ContentTable` (shared) rendered as-is — **not edited**.

**EvolutionPreview** (`EvolutionPreview.tsx`):
- Only the bottom caption `text-faint` → `text-muted`. The placeholder spine nodes are left
  **intentionally muted** (dashed border / opacity-70 / em-dash values) — that mutedness is a
  deliberate honesty signal that the versions are not real data, so it was preserved.

**OperationsShowroom** (`OperationsShowroom.tsx:103`):
- Panel-header `step` ordinal `text-faint` → `text-muted`. Header kept **non-purple** on purpose
  (the file's "one purple band per card" rule, `:83-86`); only field labels inside go purple.

### Travel — CreateTripForm (`src/components/trips/CreateTripForm.tsx`)
- 5 field labels `text-text-muted` → **`text-brand-purple font-medium`**.
- 5 field borders `border-border` → **`border-brand-purple/40`**; 4 focusable inputs +1 destination
  wrapper got purple focus (`focus:`/`focus-within:` `border-brand-purple ring-2 ring-brand-purple/20`).
- Gold CTA, toggles, structure unchanged.

### Trading — ScanFilterForm (`src/components/trading/ScanFilterForm.tsx`)
- `GroupLabel` (section headers: Universe / Direction / Liquidity gates / Edge metrics / Strategies)
  `text-text-muted` → **`text-brand-purple`** (weight already 600).
- `FieldLabel` (Min OI / Max Spread / …) `text-gray-600` → **`text-text-secondary font-medium`** (palette token + weight).
- 4 number inputs (DTE / Width ranges) `border-gray-200` → **`border-brand-purple/40`** + purple focus ring.
- Sliders, toggles, gold Scan CTA, structure unchanged.

### Shared-widget fields flagged, not edited
The fields rendered *inside* `RRULEBuilder`, `ListManager`, `ContentTable` (the cadence builder,
the goal/problem/diagnosis list inputs, the 14-column content grid) keep the shared widget's own
styling. Their contrast was improved only via the surrounding home panel (gray bg + purple section
labels framing them). Any residual low-contrast **inside** those widgets is **flagged for a separate
app-wide pass** — fixing it here would require editing shared source and changing `/operations`.

---

## STEP 3 — Verify

- **No new colors:** `git diff | grep '^+'` for hex → **none**. All color-bearing tokens in added
  lines are existing palette/utility tokens (`brand-purple[/40][/20]`, `bg-bg-row`, `bg-white`,
  `text-{primary,secondary,muted}`, `border-border`, pre-existing `gray-50/200`). ✓
- **Shared widgets + /operations untouched:** `git diff --name-only | grep -E 'workbench/operations|RRULEBuilder|ListManager|ContentTable'` → **empty**. ✓
- **Styling only:** diff is className strings + explanatory comments — no `fetch`, no handlers, no
  state, no added/removed JSX elements. The showroom panels still gate every action to
  `onRequireAuth` (no `onClick`/`onRequireAuth` wiring changed); no fetch added anywhere. ✓
- **tsc:** `npx tsc --noEmit` → **exit 0**. ✓
- **lint:** `npx eslint <changed files>` → **exit 0**. ✓

### Files changed (7 + this report)
```
src/components/home/ContentPreview.tsx
src/components/home/EvolutionPreview.tsx
src/components/home/OperationsShowroom.tsx
src/components/home/ProjectCreateForm.tsx
src/components/home/RoutineCreateForm.tsx
src/components/trading/ScanFilterForm.tsx     (also trading dashboard — flagged)
src/components/trips/CreateTripForm.tsx        (also /budgets/trips index — flagged)
```

0 endpoints, 0 schema, 0 deps.
