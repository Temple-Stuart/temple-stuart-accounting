# Nav/Token Root Fix — alpha-compatible brand-purple tokens

Fixes the white desktop nav AND every opacity-modified brand-purple usage
site-wide by repairing the token definition only — **zero call sites touched.**

Root cause (from `nav-regression-targeted-audit.md`): DS-2 set
`purple: 'var(--ts-purple)'` in `tailwind.config.ts`. Tailwind v3 can't decompose a
raw `var()` into RGB channels, so opacity utilities (`bg-brand-purple/90`, `/80`,
`/10`) **silently emitted nothing** → transparent → white. Solid classes worked.

## Audit (current values, cited)

- `globals.css:19-22` purple vars (hex): `--ts-purple-deep:#2d1b4e`,
  `--ts-purple:#3b2d6b`, `--ts-purple-light:#4e3e85`, `--ts-purple-wash:#eae7f2`.
- `tailwind.config.ts:18-22` mappings: `purple:'var(--ts-purple)'`,
  `'purple-deep':'var(--ts-purple-deep)'`,
  `'purple-hover':'var(--ts-purple-light)'`, `'purple-light':'#7b6baa'` (legacy
  literal, 0 refs), `'purple-wash':'var(--ts-purple-wash)'`.
- **Opacity-modified usages per token** (grep `src/**/*.tsx`):
  `brand-purple` ×72, `brand-purple-deep` ×7, `brand-purple-wash` ×10 → all three
  var-backed tokens need the alpha treatment. (`purple-hover`/`purple-light` have
  no opacity usages but are converted too for family consistency.)
- **Safety check:** the `--ts-purple*` vars are referenced **only** in
  `tailwind.config.ts` (4 mappings) — `grep` for `var(--ts-purple` elsewhere in
  `src/` (css/tsx/ts) returns **nothing**. So switching them to raw channels breaks
  no direct color usage.

## The fix (only 2 files)

**`globals.css:23-26`** — hex → space-separated RGB channels (each conversion
verifiable):
| var | was (hex) | now (channels) |
|---|---|---|
| `--ts-purple-deep` | `#2d1b4e` | `45 27 78` |
| `--ts-purple` | `#3b2d6b` | `59 45 107` |
| `--ts-purple-light` | `#4e3e85` | `78 62 133` |
| `--ts-purple-wash` | `#eae7f2` | `234 231 242` |

**`tailwind.config.ts:18-22`** — `var()` → `rgb(var() / <alpha-value>)`:
```
purple:        'rgb(var(--ts-purple) / <alpha-value>)'         // #3b2d6b
'purple-deep': 'rgb(var(--ts-purple-deep) / <alpha-value>)'    // #2d1b4e
'purple-hover':'rgb(var(--ts-purple-light) / <alpha-value>)'   // #4e3e85
'purple-light':'rgb(123 107 170 / <alpha-value>)'              // #7b6baa (legacy literal, inlined channels)
'purple-wash': 'rgb(var(--ts-purple-wash) / <alpha-value>)'    // #eae7f2
```
(`purple-light` is a literal with no var, so its channels are inlined directly —
kept alpha-compatible so the whole family is uniform, no mixed hex/channel trap.)

## Proof — built CSS matrix (`npx tailwindcss -c tailwind.config.ts -i src/app/globals.css`)

**Solid still purple (unchanged behavior):**
```
.bg-brand-purple {
  --tw-bg-opacity: 1;
  background-color: rgb(var(--ts-purple) / var(--tw-bg-opacity, 1));
}
```
→ resolves to `rgb(59 45 107 / 1)` = **#3b2d6b**. `-deep`/`-wash` likewise emit
solid. Identical render to before.

**Opacity now EMITS (was ABSENT):**
```
.bg-brand-purple\/10 { background-color: rgb(var(--ts-purple) / 0.1); }
.bg-brand-purple\/80 { background-color: rgb(var(--ts-purple) / 0.8); }
.bg-brand-purple\/90 { background-color: rgb(var(--ts-purple) / 0.9); }
```
Before/after grep for `bg-brand-purple*/[0-9]+ {` in the built CSS:
**before = 0 matches** (prior audit), **after = 7** (`/5 /10 /20 /80 /90 /95` +
`brand-purple-deep/5`). The previously-missing classes are now present with the
alpha applied — the root cause is fixed, not flipped.

**The 3 nav containers (`AppLayout.tsx`) now all resolve purple:**
- `:212 bg-brand-purple/90` → `rgb(var(--ts-purple) / 0.9)` ✓ (was white)
- `:233`,`:242 bg-brand-purple/80` → `rgb(var(--ts-purple) / 0.8)` ✓ (was white)
- `:324 bg-brand-purple-deep` (solid) → still purple ✓ (was already working)
- `:190 bg-brand-purple` (solid) → still purple ✓

## ⚠️ Flagged: same latent bug in other token families (NOT fixed — out of scope)

These are also `var()`-based in `tailwind.config.ts` and **also used with opacity
modifiers**, so they're currently emitting nothing too:
- `brand-gold` (`:25 var(--ts-gold)`) — 12 opacity usages
- `brand-accent` (`:31 var(--ts-accent)`) — 28 usages
- `brand-red` (`:29`) — 2 · `brand-green` (`:28`) — 1 · `brand-amber` (`:30`) — 1

≈44 more opacity-modified usages rendering transparent. **Recommend a follow-up PR**
applying the same channels + `rgb(var() / <alpha-value>)` treatment to the gold /
accent / status families. Kept out of this PR to stay purple-scoped + provable.

## Checks
- `npx tsc --noEmit` → exit 0.
- ESLint `tailwind.config.ts` → 0 errors. (globals.css is not JS-linted.)
- Only 2 files changed (globals.css tokens, tailwind.config.ts mappings); **no call
  site edited.** No fallback logic.

## Not verified
Headless sandbox — built the CSS locally (definitive for emission) but did not load
`/` in a browser; the live purple nav should be confirmed visually after deploy.
