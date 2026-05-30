# TRAVEL — PR-14 Audit: Hotel Card UI Redesign (sparse → rich)

**Branch:** `claude/travel-pr-14-audit`
**Date:** 2026-05-30
**Mode:** READ-ONLY. Audit before action. No code changed.
**Goal:** Diagnose today's hotel card, propose the redesign surface that
renders PR-13's 11 new fields — Booking.com/Airbnb density, Temple Stuart
palette.

---

## 1. Current card anatomy (CITED)

The card is rendered by `TravelCarousel` in
**`src/components/trips/TripPlannerAI.tsx:935-1004`**. The card itself is the
`<button>` at **`:970-998`**, inside a horizontal scroll row (`:968-969`).

```
:968  <div className="overflow-x-auto pb-2 -mx-1 px-1" scrollSnapType:x mandatory>
:969    <div className="flex gap-3">
:970      <button … w-[200px] sm:w-[220px] flex-shrink-0 border border-border
                     rounded overflow-hidden bg-white hover:shadow-md … text-left
:976             scrollSnapAlign:start onClick={onCardClick(rec)}>
:978        {rec.photoUrl
:980          ? <img src={rec.photoUrl} alt={rec.name} className="w-full h-32 object-cover"/>
:982          : <div className="w-full h-32 bg-gradient-to-br from-purple-50
                     to-indigo-100 … text-xs">{label}</div>}
:986        <div className="p-3 space-y-1">
:987          <div className="text-xs font-semibold text-text-primary
                     line-clamp-2 leading-tight">{rec.name}</div>
:988          <div className="flex items-center justify-between text-[11px] text-text-muted">
:989            <span>★ {rec.googleRating || '—'}{rec.reviewCount ? ` (${rec.reviewCount})` : ''}</span>
:990            {rec.price != null
                   ? <span className="font-semibold text-emerald-700">${rec.price}</span>
:992               : rec.priceLevelDisplay
                     ? <span className="font-semibold text-text-secondary">{priceLevelDisplay}</span>
                     : null}
:995          </div>
:996        </div>
:997      </button>
```

**Today the card renders exactly five primitives:** `photoUrl` (single,
`h-32`), `name` (2-line clamp), `googleRating`, `reviewCount`, and
`price`/`priceLevelDisplay`. Everything PR-13 added is dropped on the floor at
the UI layer.

Card width: `w-[200px]` mobile / `sm:w-[220px]` desktop (`:975`). Height is
**auto** — photo `h-32` (128px) + `p-3` content ≈ **~195-205px** total. The
loading skeleton mirrors this at `:953-959`.

---

## 2. Discriminator analysis — shared vs source-specific

**The card render is fully SHARED.** `TravelCarousel` (`:935`) renders Viator
activities, Google restaurants/coworking, and LiteAPI hotels through the *same*
JSX (`:970-998`). There is **zero source discrimination inside the card body
today** — every source gets the identical five-field layout.

**The discriminator already exists and is already wired in:**
- `TravelCarousel` receives a `source: Source` prop —
  **`:925`** (interface) / **`:935`** (destructured param).
- It's passed per-row from `getSource(catKey)` —
  **`:862` + `:868`**.
- `getSource` maps `accommodation → { source: 'liteapi', hardBookable: true }`
  — **`src/lib/travelSourceRegistry.ts:63`**.

So PR-14 can branch on **`source === 'liteapi'`** to render a hotel-specific
card block while leaving Viator/Google output byte-identical. **No breaking
risk to the other two sources** — they never enter the hotel branch. A separate
`HotelCard` component is optional (cleanliness), not required.

> ### ⚠️ Critical gating fact (PR-14 must fix first)
> The card component's interface is **`GrokRecommendation`**
> (`TripPlannerAI.tsx:11-37`) — and it does **NOT** carry PR-13's 11 fields.
> PR-13 added them only to the *detail page's* `Recommendation` interface
> (`…/discover/[category]/[rank]/page.tsx:51-62`). The data **is present at
> runtime** (the mapper writes it into the JSON `recommendations` column), but
> it's **untyped in this component**, so the card can't read `rec.images`,
> `rec.facilities`, etc. without TS errors. **PR-14 step 0 = add the same 11
> optional fields to `GrokRecommendation`.** Mechanical, backward-compatible.

---

## 3. Available data per PR-13 (CONFIRMED)

Confirmed against `…/discover/[category]/[rank]/page.tsx:51-62` — 11 optional
fields live on every LiteAPI recommendation now:

`city`, `addressLine`, `latitude`, `longitude`, `reviewScore`, `chain`,
`images[]`, `facilities[]` (filtered to ≤6: Pool/Wifi/Breakfast/Gym/Spa/Parking),
`currency`, `priceTotal`, `nights`.

All optional → Viator/Google leave them `undefined`.

---

## 4. Per-element redesign proposals

For each, the **recommended** choice is first, with where it lands in the card.

### (a) Photo — RECOMMEND: hover-cycle slideshow (desktop), static on touch
- **Why not a swipeable inner carousel:** the outer row is
  `overflow-x-auto` + `scrollSnapType: 'x mandatory'` (`:968`). A swipeable
  *inner* carousel fights the outer horizontal touch-scroll — drag intent is
  ambiguous on mobile. Hard conflict; reject.
- **Recommendation:** keep a single static hero (`images[0]` / `photoUrl`) as
  the touch default; on desktop **hover** cycles 2-3 previews from `images[]`,
  with a small dot indicator + a `"1 / N"` count badge in the corner. No touch
  gesture is consumed, so the outer carousel is untouched.
- **Lands at:** replaces `:978-985`. `photoUrl` stays the primary; `images[]`
  feeds the hover cycle.
- **TASTE CALL** — see §8.

### (b) Address / neighborhood — RECOMMEND: city as subtitle under the name
- Render `city` directly under `name` in `text-text-muted text-[11px]`.
  Use `addressLine` only as a fallback when `city` is absent, `line-clamp-1`
  truncated. Full `addressLine` belongs on the detail page, not the card.
- **Lands at:** new line between `:987` (name) and `:988` (rating row).
- **MECHANICAL.**

### (c) Facility icons — RECOMMEND: small icon row (Booking.com style)
- **Icon library already present:** `lucide-react ^0.544.0`
  (`package.json` dependencies). No new dependency.
- Render up to 6 inline icons mapped from the filtered `facilities[]`:
  `Pool→Waves`, `Wifi→Wifi`, `Breakfast→Coffee`, `Gym→Dumbbell`,
  `Spa→Flower2`, `Parking→Car` (or `SquareParking`). Size `w-3.5 h-3.5`,
  `text-text-secondary`. Each icon needs an `aria-label` (§6).
- Reject text chips (heavier, wrap badly at 220px) and the "6 amenities" count
  badge (loses the at-a-glance scan that icons give).
- **Lands at:** new row below the rating/price row (after `:995`).
- **MECHANICAL** (icon-name mapping is trivial taste).

### (d) Rating + review — RECOMMEND: keep star primary, add reviewScore badge
- Today: `★ googleRating (reviewCount)` (`:989`). Keep that as the primary
  (matches Airbnb + the existing Viator/Google cards → cross-source
  consistency).
- When `reviewScore` is present (LiteAPI only), add a **small badge** showing
  the 0-10 score (e.g. `8.6`) beside the stars — Booking.com's signal, but
  secondary so all sources still read consistently.
- **Lands at:** extend `:989` span; badge sits inline before the price.
- **TASTE CALL** (lead-with-stars vs lead-with-score) — see §8.

### (e) Price — RECOMMEND: `"$1,400 · 7 nights"` (honest interim)
- Data available: `priceTotal`, `nights`, `currency`. Per-night is queued for
  **PR-15** (it owns the `extractNightlyRate` whole-stay bug fix).
- **Recommendation:** when `source === 'liteapi'` and `nights` is present,
  render `priceTotal` with a window note: `"$1,400 · 7 nights"`. This is
  honest — today's bare `$1400` (`:991`) is actually the whole-stay total
  mislabeled, so adding the `· N nights` context corrects the *impression*
  without touching the buggy math.
- **Do NOT** compute per-night ourselves here (`option 3`). That duplicates
  PR-15's fix and re-introduces the exact PR-9 "mixing concerns" mistake. Let
  PR-15 own per-night end-to-end.
- **Trade-off:** a total looks pricier at a glance than competitors' per-night
  headline — accepted as the honest interim until PR-15.
- **Lands at:** `:990-994`. Use `currency` for the symbol when not USD.
- **TASTE CALL** on the format string — see §8.

### (f) Chain badge — RECOMMEND: yes, subtle badge near the name
- When `chain` is present, render a small pill (`text-[9px]`, `brand-purple`
  text on `brand-purple-wash` bg) above or inline-trailing the name.
- **Lands at:** adjacent to `:987`.
- **MECHANICAL.**

### (g) Card height + carousel spacing
- Current ≈195-205px tall, auto height. Adding city line + facility row +
  chain badge + reviewScore grows it to **~270-300px**.
- The outer row is `flex gap-3` + `overflow-x-auto` with no fixed height
  (`:968-969`) → taller cards scroll cleanly; `scrollSnapAlign:start` is
  unaffected.
- **Recommendation:** widen hotel cards to `w-[240px] sm:w-[260px]` (more room
  for the richer content), keep **height auto**, optionally bump the photo to
  `h-36`. Non-hotel cards keep `w-[200px]/[220px]`. Confirm the loading
  skeleton (`:953`) matches the hotel width when `source==='liteapi'`.
- **MECHANICAL** (width is a safe bump).

---

## 5. Palette + typography mapping

Source of truth: **`tailwind.config.ts:17-65`** (brand/text/border/ts families)
backed by CSS vars in **`src/app/globals.css:23-68`**.

| Element | Token | Hex | Note |
|---|---|---|---|
| Card background | `bg-white` (current) or `bg-ts-white` | #fff / #fafaf9 | keep white; `ts-white` is brand warm-white (unused by any component yet — adopting it here would be its first use) |
| Hotel name | `text-text-primary` + `font-semibold` (current) | #1a1a2e | keep; `brand-purple` on every card reads heavy — TASTE |
| City / address | `text-text-muted` | #7a7488 | matches existing muted subtitle |
| Price | **change** `text-emerald-700` → `text-brand-gold-bright` | #8B7D3C | current price uses a **raw Tailwind color** (`:991`), off-palette; gold is the brand "value" accent |
| Rating star ★ | `text-brand-gold` glyph + `text-text-primary` number | #7D6B2C | |
| reviewScore badge | `text-brand-purple` on `bg-brand-purple-wash` | #3b2d6b / #eae7f2 | secondary signal |
| Facility icons | `text-text-secondary` (or `text-brand-purple` outline) | #4a4a5a | |
| Chain pill | `text-brand-purple` on `bg-brand-purple-wash` | | subtle |

> **Off-palette finding:** the existing price color `text-emerald-700` (`:991`)
> is a raw Tailwind class, not a Temple Stuart token. PR-14 should swap it to a
> brand token (`brand-gold-bright` or `brand-green` #16a34a) for consistency —
> this also touches the Viator/Google price, so flag it as a deliberate
> cross-source change.

---

## 6. Accessibility — gaps + fixes

Current state:
- ✅ Image has `alt={rec.name}` (`:980`).
- ⚠️ The whole card is a `<button>` that performs **navigation**
  (`router.push`, `:873`). Functionally fine (accessible name comes from the
  card text), but a navigation is semantically a link — consider `<a>`/`Link`.
  Low priority; out of scope unless trivial.
- ⚠️ The `★` glyph (`:989`) is decorative text with no semantic rating —
  screen readers read "star 4.5 (120)". Wrap with
  `aria-label="Rated 4.5 out of 5, 120 reviews"`.
- ⚠️ Price has no SR context — add it to the card's accessible name or an
  `aria-label` ("$1,400 for 7 nights").

New elements PR-14 must ship accessibly:
- **Facility icon row is icon-only** → each icon needs `aria-label` (e.g.
  `aria-label="Pool"`), or wrap the row in a single `aria-label="Amenities:
  Pool, Wifi, Breakfast"`. **This is the biggest new a11y obligation.**
- reviewScore badge → `aria-label="Guest review score 8.6 out of 10"`.
- Hover slideshow images are decorative duplicates → keep them out of the a11y
  tree or give the hero the only meaningful `alt`.

---

## 7. PR-14 implementation scope estimate

| Item | Estimate |
|---|---|
| Files touched | **1** (`src/components/trips/TripPlannerAI.tsx`) — or **2** if a `HotelCard.tsx` is extracted for cleanliness |
| New dependencies | **0** — `lucide-react` already in `package.json` |
| Step 0 | +11 optional fields on `GrokRecommendation` (`:11-37`) |
| Card redesign | `source === 'liteapi'` branch: photo+hover, city line, facility icon row, reviewScore badge, chain pill, price `· N nights`, width bump |
| Facility→icon map | ~8 lines |
| Line estimate | **~90-150 lines** (11 fields + ~70-110 line hotel branch + icon map + a11y labels) |
| Quality gate | `tsc` + `eslint` clean; Viator/Google cards byte-identical |

No route changes, no mapper changes, no schema changes — pure render layer.

---

## 8. Honest call-outs — TASTE vs MECHANICAL

**MECHANICAL (safe to ship without sign-off):**
- Step 0: adding the 11 fields to `GrokRecommendation` (backward-compatible).
- City subtitle under the name (b).
- Facility icon row via lucide (c) — library already present.
- Chain pill (f).
- Card width bump + auto height (g).
- All accessibility `aria-label`s (§6).
- Swapping the off-palette `text-emerald-700` price to a brand token (§5) —
  though note it touches all three sources.

**TASTE CALLS (recommend confirming with the user first):**
- **(a) Photo behavior** — hover-cycle slideshow vs static-with-count-badge vs
  doing nothing. I recommend hover-cycle, but it's the single biggest UX
  decision and has a touch/desktop split. **Confirm.**
- **(d) Rating lead** — star-primary + reviewScore-badge (my rec, Airbnb-style)
  vs reviewScore-primary (Booking.com-style). **Confirm.**
- **(e) Price format** — `"$1,400 · 7 nights"` (my rec) vs `"$1,400 total"` vs
  computing per-night now. I strongly advise **against** computing per-night
  (PR-15's job), but the exact string is taste. **Confirm.**
- Price/name color choices in §5.

**The two decisions that most change the work:** (a) photo interaction and
(e) price format. Everything else is mechanical and low-risk.

---

**READ-ONLY audit. No implementation performed.**
