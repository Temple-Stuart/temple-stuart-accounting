# Nav Regression — Targeted Audit (read-only): desktop white vs mobile purple

**ROOT CAUSE FOUND.** The responsive clue (mobile purple ✓, desktop white ✗) was
decisive — it is a **class divergence**, exactly as suspected, and it traces to a
real source bug introduced by **commit `6ab39320` (PR-Ops-DS-2, 2026-05-22 18:15
UTC — "last night")**.

DS-2 swapped the brand colors from hex literals to CSS-var strings in
`tailwind.config.ts`:
```
- purple: '#3b2d6b',
+ purple: 'var(--ts-purple)',
```
Its comment claimed *"pure value-preserving swap, no visual change."* **That is
false for opacity-modified utilities.** In Tailwind v3, `bg-brand-purple/90`
requires decomposing the color into RGB channels to inject the alpha. Tailwind can
do that for a **hex** (`#3b2d6b` → `rgb(59 45 107 / 0.9)`), but it **cannot** for a
plain **`var(--ts-purple)`** string — so it **silently skips emitting the
`/opacity` variant entirely.** Solid `bg-brand-purple` still works (it's just
`background-color: var(--ts-purple)`).

This is why my earlier passes (which tested solid `bg-brand-purple`) found
everything fine — the broken utilities are the **opacity-modified** ones only.

---

## 1. The two nav renderings + their background classes (the divergence)

In `src/components/ui/AppLayout.tsx`:

| Rendering | Line | bg class | Opacity mod? | Emits CSS? | Renders |
|---|---|---|---|---|---|
| ROW1 top/logo bar (always visible) | `:190` | `bg-brand-purple` | no (solid) | **yes** | purple ✓ |
| **ROW2 desktop tab bar** (`hidden lg:flex` tabs) | `:212` | **`bg-brand-purple/90`** | **yes** | **NO** | **white ✗** |
| ROW3 Travel search bar | `:233` | `bg-brand-purple/80` | yes | **NO** | white ✗ |
| ROW3 Bookkeeping bar | `:242` | `bg-brand-purple/80` | yes | **NO** | white ✗ |
| **Mobile dropdown** (`lg:hidden`) | `:324` | **`bg-brand-purple-deep`** | no (solid) | **yes** | purple ✓ |

- **Working reference (mobile):** `:324 bg-brand-purple-deep` — solid token →
  emits `background-color: var(--ts-purple-deep)` → **#2d1b4e purple**.
- **Broken (desktop):** `:212 bg-brand-purple/90` — opacity-modified token → **no
  rule generated** → element has no background → page white shows through.

The desktop tab row uses an **opacity modifier**, the mobile dropdown uses a
**solid** class. That single difference is the bug.

## 2. Proof from the built CSS

`npx tailwindcss -c tailwind.config.ts -i src/app/globals.css -o /tmp/nav.css`
then grep the output — the ONLY brand-purple background rules emitted are **solid**:
```
.bg-brand-purple        { background-color: var(--ts-purple); }
.bg-brand-purple-deep   { background-color: var(--ts-purple-deep); }
.bg-brand-purple-hover  { background-color: var(--ts-purple-light); }
.bg-brand-purple-wash   { background-color: var(--ts-purple-wash); }
(+ their hover: variants)
```
`grep` for `bg-brand-purple\/(90|80|10)` → **zero matches.** The opacity variants
`bg-brand-purple/90`, `/80`, `/10` are **not in the stylesheet at all.** So every
element using them has no background → transparent → white.

## 3. Git attribution

`git show 6ab39320 -- tailwind.config.ts` shows the hex→var swap for `purple`,
`purple-deep`, `purple-hover`, `purple-wash` (and gold/green/red/amber/accent).
Committed **2026-05-22** — matches the "merged everything last night" window. The
nav markup itself was **not** changed (AppLayout last touched 2026-05-17); the
classes that were always there (`bg-brand-purple/90` since long ago) only **broke
when the underlying token became a `var()`**. So the regression commit is the
token swap, not a nav edit.

## 4. Blast radius — this is SITE-WIDE, not just the nav

`grep -rnoE "brand-purple[a-z-]*/[0-9]+" src --include=*.tsx | wc -l` → **80
opacity-modified usages** of brand-purple* tokens across 10+ components
(ManualTransactionForm, CalendarGrid, HealthCard, EndOfDayCard, RidesharePicker,
ResponsiveTable, TripCreationBar, DataObservatory, HotelPicker, …). **All 80 are
currently emitting nothing** (transparent). The same breakage applies to any
opacity modifier on the other tokenized colors (gold/green/red/amber/accent). The
desktop nav is just the most visible symptom of a global token-opacity break.

---

## Recommended fix (do NOT apply yet)

**Root fix (correct — repairs all 80+ sites at once):** make the tokens
alpha-compatible. The standard Tailwind v3 pattern is to store the CSS vars as raw
channels and reference them with the `<alpha-value>` placeholder:
- `globals.css`: `--ts-purple: 59 45 107;` (RGB triplet, no `#`) for each color.
- `tailwind.config.ts`: `purple: 'rgb(var(--ts-purple) / <alpha-value>)'`.
Then **both** solid `bg-brand-purple` **and** `bg-brand-purple/90` generate valid
CSS. This fully restores DS-2's "zero visual change" intent (which the hex→var swap
broke for opacity usages).

**Minimal nav-only patch (fast unblock, per the task hint — matches the working
mobile reference):** change the three opacity-modified nav containers to solid
token classes that emit:
- `:212 bg-brand-purple/90` → `bg-brand-purple` (or `bg-brand-purple-hover` for a
  hair lighter, to approximate the old /90 tint).
- `:233`, `:242 bg-brand-purple/80` → `bg-brand-purple` / `bg-brand-purple-deep`.
This fixes the visible nav immediately but **leaves the other 77 site-wide usages
broken** — so it's a stopgap, not the real fix.

**Recommendation:** do the **root fix** (alpha-compatible tokens) — it's only a
globals.css + tailwind.config.ts change, fixes the nav AND the 80 other sites, and
restores DS-2's intended invariant. Flag DS-2's "no visual change" comment as
incorrect for opacity utilities.

### Note
This supersedes my prior two passes' "source is fine / deploy-pipeline" conclusion:
those tested only the **solid** `bg-brand-purple` (which does emit). The
responsive clue exposed that the **opacity-modified** variants are the broken ones
— a genuine source bug in the token definition, confirmed by the empty
`/opacity` grep in the built CSS.
