# PR-OPS-DS-1 — Phase 1 Audit: palette + design-token inventory (read-only)

**Context.** Design pass on the Hub (`templestuart.com/hub`). Step 1 is
formalizing the aqua/purple/white look into reusable tokens so later changes pull
from one source. This is the inventory + a proposed token set for Alex to lock.
No edits, no token file created. Audit branch cut from `main` (now includes
Hub-1/2/3 + DPI-Unique).

---

## 1. Existing theming infrastructure — what we can build ON

### `tailwind.config.ts` — `theme.extend` (the de-facto token source today)

The brand palette already lives here as **literal hex in the Tailwind config**
(NOT as CSS variables). Full `colors` block (`tailwind.config.ts:11-50`):

```ts
colors: {
  background: "var(--background)",   // 12  → globals.css :root
  foreground: "var(--foreground)",   // 13  → globals.css :root
  brand: {
    purple: '#3b2d6b',               // 15  ← the command-center banner
    'purple-deep': '#2d1b4e',        // 16
    'purple-hover': '#4e3e85',       // 17
    'purple-light': '#7b6baa',       // 18
    'purple-wash': '#eae7f2',        // 19  ← light purple wash (token)
    gold: '#7D6B2C',                 // 20
    'gold-bright': '#8B7D3C',        // 21
    'gold-wash': 'rgba(125,107,44,0.07)', // 22
    green: '#16a34a',                // 23
    red: '#c53030',                  // 24
    amber: '#d97706',                // 25
    accent: '#b4b237',               // 26
    'accent-dark': '#9a9630',        // 27
  },
  panel: { DEFAULT:'#0d1117', surface:'#161b22', border:'#30363d', hover:'#21262d', highlight:'#1a0f2e' }, // 29-35 (dark "terminal" surfaces)
  bg:     { terminal:'#f7f6f3', row:'#f0eee9' },                 // 36-39
  text:   { primary:'#1a1a2e', secondary:'#4a4a5a', muted:'#7a7488', faint:'#a8a2b0' }, // 40-45
  border: { DEFAULT:'#e2e0da', light:'#f0eee9' },                // 46-49
}
```
- `fontFamily` (51-54): `mono: 'IBM Plex Mono', ui-monospace, monospace`;
  `sans: 'Inter', -apple-system, sans-serif`. **The Hub's monospace font is IBM
  Plex Mono.**
- `fontSize` (55-60): a `terminal-*` scale — `terminal-xs 8px/12`, `terminal-sm
  9px/14`, `terminal-base 10.5px/16`, `terminal-lg 11px/16`.
- **No custom `spacing` or `borderRadius` extension** — spacing/radius use
  Tailwind defaults.

So `border-border` → `#e2e0da`, `bg-bg-row` → `#f0eee9`, `text-text-primary` →
`#1a1a2e`, `bg-brand-purple` → `#3b2d6b`. `bg-white` is Tailwind's default
`#ffffff`.

### `globals.css` — almost empty (`src/app/globals.css:1-22`)

```css
:root {
  --background: #ffffff;   /* 6 */
  --foreground: #171717;   /* 7 */
}
@media (prefers-color-scheme: dark) { :root { --background:#0a0a0a; --foreground:#ededed; } } /* 10-15 */
body { background: var(--background); color: var(--foreground); font-family: Arial, Helvetica, sans-serif; } /* 17-21 */
```
**Only two CSS custom properties exist** (`--background`, `--foreground`), and the
`body` font-family is `Arial` (overridden per-component by `font-mono`/`font-sans`
utilities). **The brand palette is NOT in `:root`** — it is config-only hex.

### Verdict — build-on vs. missing
- **Build ON:** the `tailwind.config.ts` `brand/panel/bg/text/border` color scale,
  the `terminal-*` font sizes, and the `font-mono`/`font-sans` families. These are
  real, used tokens.
- **Missing:** (a) **no aqua/teal token at all** — the Hub's signature aqua is an
  un-tokenized Tailwind default (see §2); (b) **no CSS-variable layer** for the
  brand palette (only `--background`/`--foreground`), so there's no single
  runtime source; (c) **no spacing/radius scale**. The token PR should add a
  `:root` variable layer (or extend the config) that the config reads from, and
  introduce an aqua token.

---

## 2. Actual colors in use — inventory + inconsistencies

### The three signature Hub colors (exact values + source)

| Role | Where | Class / value |
|------|-------|---------------|
| **Purple** command-center banner | `page.tsx:401` `bg-brand-purple` | `#3b2d6b` (config token) — also the HubEventCard header `HubEventCard.tsx:253` |
| **Aqua/teal** routine calendar blocks | `page.tsx:69` `routines.calendarColor: 'bg-teal-400'` → rendered by `CalendarGrid.tsx:433-441` as the block `badge` | **`bg-teal-400` = `#2dd4bf`** (Tailwind default — NOT a brand token) |
| **Cyan** Trip legend/blocks | `page.tsx:67` `trip: { calendarColor:'bg-cyan-400', dotColor:'bg-cyan-500', color:'text-cyan-600', bgColor:'bg-cyan-50' }` | cyan-400 `#22d3ee`, cyan-500 `#06b6d4`, cyan-600 `#0891b2`, cyan-50 `#ecfeff` |
| (Operations blocks) | `page.tsx:68` `operations` | indigo-400 `#818cf8`, indigo-500 `#6366f1`, indigo-600 `#4f46e5`, indigo-50 `#eef2ff` |

The Hub calendar's three source hues (trip=cyan, operations=indigo,
routines=teal) are centralized in `SOURCE_CONFIG` (`page.tsx:52-70`) and fanned
into `HUB_GRID_CONFIG` (`page.tsx:73-82`) — good, single legend source — but they
all reference **Tailwind defaults**, not brand tokens. The "aqua" is `teal-400
#2dd4bf`.

### Distinct hex values found (frequency, across `src` + config)

Top recurring raw hex (many in non-Hub charts/trading, but they show the
app-wide spread): `#6b7280` (17, gray-500), `#10b981` (13, emerald-500),
`#ef4444` (10, red-500), `#9ca3af` (9, gray-400), `#8b5cf6` (9, violet-500),
`#f59e0b` (7, amber-500), `#d97706` (7, brand-amber), `#1a1a1a` (7), `#16a34a`
(7, brand-green), `#7c3aed` (6, violet-600), `#4a3875` (6, a purple),
`#2d6a2d` (6, a green), `#1a1a2e` (6, text-primary), `#8a2222` (5, a red),
`#9b59b6` (3, flat-ui purple), `#a855f7` (2, purple-500), `#f43f5e` (2,
rose-500)… plus the config tokens (`#3b2d6b`, `#2d1b4e`, `#eae7f2`, `#e2e0da`,
`#f7f6f3`, etc.). `rgb()/rgba()` usage is minimal: `rgba(0,0,0,0.3)` (backdrops,
×2), white-alpha overlays, and a few brand alpha washes.

### Near-duplicate INCONSISTENCIES (what tokenizing will unify)

These are the headline finds — multiple near-but-different values for the same
visual role:

- **Aqua/teal (the exact case the brief flagged):** `teal-400 #2dd4bf` (routine
  blocks, page.tsx:69) vs `teal-500 #14b8a6` (`STATUS_CHIP`/other teal usages) —
  two adjacent aquas. Compounded by the green family bleeding in: `emerald-500
  #10b981` (13×), `emerald-600 #059669`, `emerald-700 #047857`, `brand-green
  #16a34a`, `green-500 #22c55e`, `#2d6a2d`. **Aqua and green are not cleanly
  separated.**
- **Purple/violet (worst offender — 8+ distinct):** brand tokens `#3b2d6b /
  #2d1b4e / #4e3e85 / #7b6baa / #eae7f2`, PLUS un-tokenized `#4a3875` (6×),
  `#9b59b6` (3×), and Tailwind `violet-500 #8b5cf6` (9×), `violet-600 #7c3aed`
  (6×), `purple-500 #a855f7` (2×). **Two competing light-purple washes:**
  `brand-purple-wash #eae7f2` (token) vs Tailwind `purple-50 #faf5ff` — the
  latter is used in the Hub itself (`HubEventCard.tsx:358`,
  `UnscheduledTaskTable.tsx:198/277`, `CalendarGrid.tsx:338/405/515`).
- **Red:** `brand-red #c53030` vs `red-500 #ef4444` (10×) vs `red-600 #dc2626`
  (3×) vs `#8a2222` (5×).
- **Neutral grays:** the `text-*` tokens (`#1a1a2e/#4a4a5a/#7a7488/#a8a2b0`)
  compete with raw `#6b7280` (17×), `#9ca3af` (9×), `#666666` (3×), `#e5e7eb`
  (3×), `#1a1a1a` (7×).

---

## 3. Spacing / radius / typography patterns actually in use (Hub files)

Across `page.tsx`, `CalendarGrid.tsx`, `HubEventCard.tsx`,
`UnscheduledTaskTable.tsx`:

- **Typography:** `font-mono` is dominant (69 occurrences) — the Hub is a
  monospace UI (IBM Plex Mono). Sizes cluster at `text-xs` (45×) and `text-sm`
  (12×), with the `terminal-lg` token (3×) on section headings. Weights:
  `font-medium` (36×), `font-semibold` (20×), `font-bold` (6×).
- **Spacing (padding):** `py-2` (55×), `px-2` (49×), `px-3` (48×), `py-1` (40×),
  `px-4`/`px-5` (headers), `py-0`/`py-0.5` (chips). Gaps: `gap-2` (14×), `gap-3`
  (3×). Section rhythm: `mb-6` (6×) between major Hub sections, `mb-3`/`mb-4` for
  sub-blocks. → the recurring scale is **{1, 2, 3, 4, 5} (×0.25rem)** with **6**
  as the section gap.
- **Radius:** `rounded` (24×, = `0.25rem`) is the default; `rounded-sm` (2×) for
  small dots/legend swatches. No `rounded-lg`/`xl`/`full` to speak of in the Hub.
  Cards use `border border-border rounded bg-white`; the banner is square (no
  radius, `page.tsx:401`).

---

## 4. Scope map — files a token migration would touch (Hub surface)

| File | Hardcoded color/spacing it would migrate |
|------|------------------------------------------|
| `src/app/hub/page.tsx` | **Largest.** `SOURCE_CONFIG` cyan/indigo/teal hues (67-69); emerald budget-variance colors (`getWsVarianceClass/Text` 90-100, and inline at 644/646/720/722/797/799/668/670/744/746/821/823); `brand-purple` banner (401), `brand-purple`/`-hover`/`-wash` table chrome (524-823); `bg-emerald-600`/`bg-red-600` legend swatches (461/...). |
| `src/components/shared/CalendarGrid.tsx` | `bg-purple-50` (338/405/515), `bg-emerald-50 border-emerald-400` (509), `border-purple-300` (515), `text-brand-purple/red/green` (530/534), `bg-gray-400` source fallback (364/432/549); applies source `badge` colors for every event block (433-441). |
| `src/components/hub/HubEventCard.tsx` | `bg-brand-purple` header (253), `bg-purple-50` (358), `border-brand-purple`/`bg-brand-purple` action buttons (101/392/435). |
| `src/components/hub/UnscheduledTaskTable.tsx` | `STATUS_CHIP` map (35-39): `bg-bg-row`/`bg-blue-50 text-blue-800 border-blue-200`/`bg-amber-50 text-amber-800 border-amber-300`; `bg-purple-50` (198/277), `border-brand-purple bg-brand-purple` assign buttons (233/337). |
| `src/components/hub/BudgetDrillDown.tsx` | ~4 color usages (Hub drill-in panel) — migrate alongside. |
| `src/lib/hub/mapOperationsBlocks.ts`, `mapOperationsRoutines.ts` | **No colors** (they map data → `GridEvent`; color comes from `SOURCE_CONFIG`). No migration needed. |

**Sequencing suggestion:** lock tokens → migrate `page.tsx` `SOURCE_CONFIG` +
`tailwind.config.ts` first (defines the palette), then the three Hub components,
then `CalendarGrid` (shared — used beyond Hub, migrate carefully last).

---

## 5. PROPOSED TOKEN SET (for Alex to lock)

Derived from values actually in use. Recommendation: add a `:root` CSS-variable
layer in `globals.css` and have `tailwind.config.ts` reference it (so there's one
runtime source), keeping the existing Tailwind class names working.

### Color tokens

| Proposed token | Current value(s) it maps | Notes |
|----------------|--------------------------|-------|
| `--ts-purple` | `#3b2d6b` (brand-purple) | Primary brand / banner. |
| `--ts-purple-deep` | `#2d1b4e` | Darkest (gradients/hover-press). |
| `--ts-purple-hover` | `#4e3e85` | Interactive hover. |
| `--ts-purple-light` | `#7b6baa` | Muted purple text/accent. |
| `--ts-purple-wash` | `#eae7f2` | **Unify with the stray `purple-50 #faf5ff`** used in Hub → pick `#eae7f2`. |
| `--ts-aqua` | **`#2dd4bf`** (teal-400, routines) | **NEW token — the signature aqua.** Make this the canonical aqua. |
| `--ts-aqua-deep` | `#14b8a6` (teal-500) | Resolves the `#2dd4bf`↔`#14b8a6` near-dup as one ramp. |
| `--ts-cyan` | `#06b6d4` (cyan-500, Trip) | Trip accent (distinct from aqua). |
| `--ts-indigo` | `#6366f1` (indigo-500, Operations) | Operations accent. |
| `--ts-white` | `#ffffff` | Surface. |
| `--ts-bg` | `#f7f6f3` (bg-terminal) | App background. |
| `--ts-bg-row` | `#f0eee9` (bg-row) | Zebra/row. |
| `--ts-border` / `--ts-border-light` | `#e2e0da` / `#f0eee9` | Keep. |
| `--ts-text` / `-secondary` / `-muted` / `-faint` | `#1a1a2e` / `#4a4a5a` / `#7a7488` / `#a8a2b0` | Keep; **retire raw `#6b7280`/`#9ca3af`/`#666666` in favor of these.** |
| `--ts-green` | `#16a34a` (brand-green) | Unify the green spread (`#10b981/#22c55e/#2d6a2d/emerald-*`) onto one positive-green ramp. |
| `--ts-red` | `#c53030` (brand-red) | Unify `#ef4444/#dc2626/#8a2222`. |
| `--ts-amber` | `#d97706` (brand-amber) | Keep. |
| `--ts-gold` / `-bright` / `-wash` | `#7D6B2C` / `#8B7D3C` / `rgba(125,107,44,0.07)` | Keep. |

**Key recommendations baked in:** (1) introduce `--ts-aqua = #2dd4bf` as a
first-class token — today the Hub's defining aqua is an anonymous Tailwind
default; (2) collapse the `teal-400/teal-500` aqua near-dup into an `aqua` +
`aqua-deep` ramp; (3) collapse the two purple washes (`#eae7f2` vs `#faf5ff`)
into one `--ts-purple-wash`; (4) keep cyan (Trip) and indigo (Operations)
distinct from aqua so the calendar legend stays legible.

### Spacing scale (×0.25rem, from observed usage)
`--ts-space-1:0.25rem · -2:0.5rem · -3:0.75rem · -4:1rem · -5:1.25rem · -6:1.5rem`
(6 = section gap). Matches the `py-2/px-2/px-3/px-4/px-5` + `mb-6` rhythm.

### Radius scale
`--ts-radius-sm:0.125rem (rounded-sm) · --ts-radius:0.25rem (default card) ·
--ts-radius-none:0 (banner)`. The Hub uses essentially two radii today.

### Typography
`--ts-font-mono: 'IBM Plex Mono', ui-monospace, monospace` (primary);
`--ts-font-sans: 'Inter', -apple-system, sans-serif`. Size scale = existing
`terminal-xs/sm/base/lg` (8/9/10.5/11px) plus Tailwind `text-xs`(12)/`text-sm`(14)
which the Hub leans on — recommend formalizing `xs`/`sm` into the token scale so
the Hub's two dominant sizes are named.

---

No edits. No token file created. Read-only audit + proposal only — awaiting
Alex's lock on the palette before any code change.
