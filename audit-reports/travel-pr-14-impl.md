# TRAVEL — PR-14 Implementation: Hotel Card Richness Rendered

**Branch:** `claude/travel-pr-14`
**Date:** 2026-05-30
**Scope:** 1 file render layer + this report. Source-branched; Viator/Google
byte-identical. No photo carousel, no per-night math, no new deps.

> **⏸ STEP 5 STOP GATE HIT — awaiting your yes/no.** The price element renders
> the present-case (`priceTotal` + `nights`) but the **absent-case fallback is
> NOT coded** — it currently renders nothing. See "Step 5" below. Do not
> consider PR-14 final until you answer the fallback question.

---

## Step 0 (gating) — typed the 11 fields on `GrokRecommendation`

Re-verified `GrokRecommendation` was at `TripPlannerAI.tsx:11-37` (current) and
lacked PR-13's fields. Added 11 optional fields at
**`TripPlannerAI.tsx:38-51`**:

```ts
// before — ended at:
  liteapiHotelId?: string;
  liteapiOfferId?: string | null;
}

// after — added:
  city?: string;
  addressLine?: string;
  latitude?: number;
  longitude?: number;
  reviewScore?: number;
  chain?: string;
  images?: string[];
  facilities?: string[];
  currency?: string;
  priceTotal?: number;
  nights?: number;
```

All optional → Viator/Google leave them `undefined`. **`tsc --noEmit` exit 0.**

---

## Step 1 — source-branched the card

Branch point: **`TripPlannerAI.tsx:998`** —
`source === 'liteapi' ? ( richHotelCard ) : ( existingCard )`.
The `source` prop flows from `getSource(catKey)` (`:862/:868`) →
`travelSourceRegistry.ts:63` (`accommodation → 'liteapi'`), re-verified current.

**Proof the non-LiteAPI path is unchanged:** the else branch
(**`:1068-1097`**) is the original card. Its root className is identical to
main:
- main `TripPlannerAI.tsx:975`: `w-[200px] sm:w-[220px] flex-shrink-0 border border-border rounded overflow-hidden bg-white hover:shadow-md transition-shadow text-left`
- PR-14 `:1074`: **same string, byte-for-byte.**

The only delta on that branch is indentation (it now sits one level deeper
inside the ternary). JSX content, classes, `h-32`, price expression
(`:1089-1093`) are unchanged. Viator/Google render identically.

---

## Step 2 — address subtitle
**`:1027-1030`.** `city` → muted subtitle under the name; renders nothing when
`city` is absent (no empty element). Source: `rec.city` (PR-13).

## Step 3 — facility icon row
**`:1031-1039`**, map constant at **`:937-948`**.
Renders `rec.facilities` (PR-13, already filtered to ≤6 standard) as
`lucide-react` icons, `text-brand-purple`, `w-3.5 h-3.5`. Renders nothing when
empty. Row carries `aria-label="Amenities: …"`; each icon has its own
`aria-label`.

**Confirmed lucide-react ^0.544.0 exports (all 6 exist):**

| Facility | lucide icon | verified |
|---|---|---|
| Pool | `Waves` | ✅ in `lucide-react.d.ts` |
| Wifi | `Wifi` | ✅ |
| Breakfast | `Coffee` | ✅ |
| Gym | `Dumbbell` | ✅ |
| Spa | `Flower2` | ✅ |
| Parking | `Car` | ✅ |

No substitutions needed. Import: **`:9`**. Zero new dependencies.

## Step 4 — rating + reviewScore
**`:1040-1054`.** Star `googleRating` stays **primary** (cross-source
consistency); `★` uses `text-brand-gold`, number `text-text-primary`. The
rating span carries `aria-label="Rated X out of 5, N reviews"`. `reviewScore`
(0-10, LiteAPI) renders as a **secondary** purple-wash badge **only when
present** (`:1046-1053`), with `aria-label="Guest review score X out of 10"`.
When absent → stars only (current behavior). Sources: `rec.googleRating`,
`rec.reviewCount`, `rec.reviewScore`.

## Step 5 — price (HONEST INTERIM) + palette fix — ⏸ STOPPED
**Present-case rendered** at **`:1055-1058`**:
`{currency}{priceTotal} · {nights} nights` (e.g. `$1400 · 7 nights`).
No per-night computation — PR-15 owns that after the `extractNightlyRate` fix.
Source: `rec.priceTotal`, `rec.nights`, `rec.currency` (PR-13).

**Palette fix:** the new price uses **`text-brand-gold-bright`**
(`tailwind.config.ts:26`, `#8B7D3C`, backed by `--ts-gold-bright`). This is the
brand-token replacement for the off-palette raw `text-emerald-700` flagged in
the audit. (Note: the raw `text-emerald-700` still lives on the **non-LiteAPI**
branch at `:1090` — left untouched to keep Viator/Google byte-identical, per
hard constraint. A cross-source swap is a separate decision.)

**🛑 Fallback NOT coded (`:1059-1064`).** Step 5 says "if priceTotal/nights
absent, fall back to the existing `price` display." Per your explicit STOP
gate, I halted before writing that branch — the absent-case currently renders
`null`. **Rationale I owe you for the yes/no:**

- **Why a fallback might be wanted:** in sandbox, some LiteAPI properties are
  metadata-only and quote no rate, so `priceTotal`/`nights` can be absent. With
  no fallback, those hotel cards show **no price at all** — a regression vs.
  today's card, which shows `priceLevelDisplay` (`$`/`$$`) when `price` is null.
- **Why it might NOT be wanted:** the old `price`/`priceLevelDisplay` path
  feeds off the same mislabeled whole-stay total the audit flagged; showing it
  could reintroduce the exact confusion PR-13/PR-15 are untangling. A clean
  "no price → no price element" may be the more honest interim.
- **My recommendation:** fall back to **`priceLevelDisplay` only** (the `$`-`$$$$`
  band), never the raw `price` number — keeps a price signal without the
  misleading absolute figure. But this is your call.

**I will not code any fallback branch until you answer.**

## Step 6 — chain badge
**`:1018-1026`.** When `rec.chain` present → subtle pill, `text-brand-purple`
on `bg-brand-purple-wash` (`tailwind.config.ts:24`, `#eae7f2`), beside the
name. Absent → nothing. Source: `rec.chain` (PR-13).

## Step 7 — card width
**`:1004`.** LiteAPI card widened to `w-[260px]` (auto height retained); photo
bumped `h-32 → h-36` for the larger card. Non-LiteAPI cards keep
`w-[200px] sm:w-[220px]` (`:1074`). Outer row is unchanged `flex gap-3
overflow-x-auto` with `scrollSnapType: 'x mandatory'` (`:968`) +
`scrollSnapAlign: 'start'` per card — taller/wider cards scroll cleanly; no
fixed height anywhere.

---

## Hard-constraint compliance

| Constraint | Status |
|---|---|
| Zero change to Viator/Google render | ✅ else-branch className byte-identical to main `:975` |
| Zero photo carousel (single static hero) | ✅ `:1009-1016` |
| Zero per-night computation | ✅ only `priceTotal · nights` shown |
| Zero new dependencies | ✅ `lucide-react ^0.544.0` already present |
| `extractNightlyRate` untouched | ✅ liteapiClient.ts not in diff |
| PR-7 diagnostic logs preserved | ✅ liteapiClient.ts not in diff |
| `tsc --noEmit` clean | ✅ exit 0 |
| eslint clean (changed file) | ✅ 0 new errors / 0 new warnings; the 1 pre-existing `no-explicit-any` (main `:520` → `:535`) is unrelated & line-shifted by my additions |

## git diff scope vs main
Only `src/components/trips/TripPlannerAI.tsx` (+ this report). **Zero** changes
to route / Viator mapper / Google / schema / `liteapiClient.ts`.

---

## ⏸ AWAITING: Step 5 fallback yes/no
Render nothing (current) **vs.** fall back to `priceLevelDisplay` **vs.** fall
back to the full existing `price` display — surfaced as a question. The
fallback branch stays uncoded until you decide.
