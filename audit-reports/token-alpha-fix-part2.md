# Token Alpha Fix — Part 2 (gold / accent / status / bg / border)

Completes the alpha-compatible token foundation started by the purple fix. Same
root cause: var-based color tokens defined as plain `var(--ts-x)` can't be
decomposed by Tailwind v3 for opacity modifiers, so `bg-x/NN` silently emits
nothing. Same proven fix: vars → RGB channels, mappings → `rgb(var() /
<alpha-value>)`. **Only `globals.css` + `tailwind.config.ts`; no call sites touched.**

## Scope (data-driven, broader than the named 5 families)

The opacity-usage grep over `src/**/*.tsx` showed the **full** set of var-based
tokens currently used with opacity (so currently broken/transparent):

| token | opacity usages | in named list? |
|---|---|---|
| `brand-accent` | 30 | yes |
| `brand-gold` | 12 | yes |
| `brand-red` | 2 | yes |
| `brand-green` | 1 | yes |
| `brand-amber` | 1 | yes |
| `brand-accent-dark` | 1 | **no — found by grep** |
| `bg-row` | **37** | **no — found by grep** |
| `border-light` | 2 | **no — found by grep** |

`bg-row` (37) and `border-light` (2) and `brand-accent-dark` (1) have the
**identical** bug and weren't in the prior audit's named list. To actually
"complete the token foundation," I fixed them too, and — per the consistency rule
— converted each affected family's **full** hex shade set so no shade is left a
latent trap.

**Safety check (the one real risk):** `grep` for direct `var(--ts-{accent,gold,
green,red,amber,bg,bg-row,border,border-light,...})` usage **outside**
`tailwind.config.ts` → **none**. Every target var is consumed only through the
Tailwind config, so switching to raw channels breaks no direct-color usage.

## Conversions (cited)

**`globals.css` — hex → space-separated RGB channels:**
| var | hex | channels |
|---|---|---|
| `--ts-gold` | #7D6B2C | `125 107 44` |
| `--ts-gold-bright` | #8B7D3C | `139 125 60` |
| `--ts-green` | #16a34a | `22 163 74` |
| `--ts-red` | #c53030 | `197 48 48` |
| `--ts-amber` | #d97706 | `217 119 6` |
| `--ts-accent` | #b4b237 | `180 178 55` |
| `--ts-accent-dark` | #9a9630 | `154 150 48` |
| `--ts-bg` | #f7f6f3 | `247 246 243` |
| `--ts-bg-row` | #f0eee9 | `240 238 233` |
| `--ts-border` | #e2e0da | `226 224 218` |
| `--ts-border-light` | #f0eee9 | `240 238 233` |

**`tailwind.config.ts` — `var(...)` → `rgb(var(...) / <alpha-value>)`** for each
of: `brand.gold`, `gold-bright`, `green`, `red`, `amber`, `accent`, `accent-dark`;
`bg.terminal`, `bg.row`; `border.DEFAULT`, `border.light`.

### Deliberate exception — `gold-wash` (NOT converted)
`--ts-gold-wash: rgba(125,107,44,0.07)` has a **baked 7% alpha** and is used
**solid only** (`bg-brand-gold-wash` in Badge.tsx:19, ResponsiveTable.tsx:65 — no
opacity modifier). Converting it to `rgb(125 107 44 / <alpha-value>)` would make
solid usage 100% opaque (visual change), so it is **left as the rgba literal**
(`tailwind.config.ts:27` keeps `var(--ts-gold-wash)`). The one shade intentionally
not in the channel form, documented inline.

## Proof — built CSS (`npx tailwindcss -c tailwind.config.ts -i src/app/globals.css`)

**Solid still emits the correct color (alpha = 1):**
```
.bg-brand-gold   { background-color: rgb(var(--ts-gold) / var(--tw-bg-opacity, 1)); }
.bg-brand-accent { background-color: rgb(var(--ts-accent) / var(--tw-bg-opacity, 1)); }
.bg-brand-red    { background-color: rgb(var(--ts-red) / var(--tw-bg-opacity, 1)); }
.bg-brand-green  { background-color: rgb(var(--ts-green) / var(--tw-bg-opacity, 1)); }
.bg-bg-row       { background-color: rgb(var(--ts-bg-row) / var(--tw-bg-opacity, 1)); }
.bg-brand-gold-wash { background-color: var(--ts-gold-wash); }   ← preserved (7% wash, unchanged)
```

**Opacity variants NOW emit (were absent before):**
```
.border-brand-gold\/30, .border-brand-gold\/60
.bg-brand-accent\/5, \/10, \/20
.bg-bg-row\/30, \/50, \/60
.border-border-light\/30, \/60
```
Before (on merged main, pre-this-PR): grep for these `/NN` classes → **0**.
After: **18** opacity variants emitted across the touched families. The
previously-transparent ~44 sites (incl. the 37 `bg-bg-row/NN`) now resolve to the
correct tinted color.

## Remaining var-based tokens NOT converted (no current opacity usage)
`ts.aqua/aqua-deep/cyan/indigo/white`, `text.*`, `panel.*` are still plain
`var()` hex. They have **zero** opacity usages today, so they're not broken — left
untouched to keep this PR scoped. If a future component uses `bg-text-muted/50`
etc., apply the same channel + `rgb(var() / <alpha-value>)` treatment then.
(Flagged, not fixed.)

## Checks
- `npx tsc --noEmit` → exit 0.
- ESLint `tailwind.config.ts` → 0 errors (globals.css is not JS-linted).
- Only 2 files changed; no call sites edited; no fallback logic. Every solid usage
  renders identically (alpha = 1 = original hex); gold-wash preserved exactly.

## Not verified
Headless — built the CSS locally (definitive for emission) but did not load the app
in a browser; confirm visually after deploy.
