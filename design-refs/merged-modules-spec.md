# Temple Stuart — Merged Modules Section (Round 2) · Handoff

Replaces `02 / THE NINE PILLARS` (catalog table) and `04 / INSIDE THE APP` (frame grid) with ONE section.
Four acts, one stage. No new colors, no dark surfaces, no gradients, no data tables.

Files in this bundle:
- `Modules-v2-Desktop-1440.dc.html` — interactive: nine chips switch the one stage (default Runway)
- `Modules-v2-Mobile-390.dc.html` — static Runway state
- `Modules-v2-Build-Spec.dc.html` — this spec, rendered
- `public/demo/*.svg` — the nine frame illustrations, 1200×750 (16:10), drop in AS-IS, never redraw

Tweaks (component props): `defaultModule` = `runway` (enum: travel/runway/books/trade/tax/compliance/routines/projects/content) · `showPersonas` = `true`.

---

## 0 · Tokens (from `src/app/globals.css` + `tailwind.config.ts` — nothing invented)

| Hex | Use |
|---|---|
| `#FAF8F3` | canvas (cream) |
| `#F3EFE6` | row fill (frames' own footer strips) |
| `#FFFFFF` | cards / stage |
| `#FFFDF9` | chips at rest · text on purple |
| `#DDD6E8` | hairline — every card border + act rules (1px) |
| `#EBE4F7` | inner hairline — step rows, persona rows |
| `#3B2D6B` | purple — h2, names, hub, active chip, LIVE — FREE, links |
| `#4E3E85` | link hover only |
| `#B8860B` | gold — LIVE dot, active-chip underline, spine dots/square, hub underline |
| `#1A1A2E` | text primary |
| `#4A4A5A` | text secondary · bar kickers |
| `#7A7488` | text muted · LAUNCHING SOON · act labels |
| `#A8A2B0` | text faint · numbers · micro-labels |

On-purple inks: `rgba(255,255,255,.55 / .6 / .72 / .75)` + `#FFFDF9`.
Fonts: **Inter** 400/500/600 (sans) · **IBM Plex Mono** 400/500/600 (mono).
Color dosage: section chrome = cream + purple + gold ONLY. Green/red exist solely inside the frame SVGs.
Radii: cards/stage 8 · chips (tag) 4 · selector chips + hub blocks square. No shadows.

## 1 · Act geometry (desktop 1440 — all px)

Content column: max-width 1280, padding-x 32 (inner 1216). Section bounded by 1px `#DDD6E8` top+bottom; acts separated by full-bleed 1px `#DDD6E8` rules.

- HEADER — pt 60 · eyebrow row: `02 / THE NINE MODULES` (mono 10/600/+0.12em `#A8A2B0`) + `HOW PRICING WORKS →` right (mono 10 purple) · h2 mt 18: sans 38/500/−0.025em `#3B2D6B` "The product, as it runs." · intro mt 12: sans 17/1.55 `#4A4A5A`, max-w 680
- ACT 1 SPINE — pad 64/32/76, centered, flows from header (no rule above)
- ACT 2 PERSONAS — rule · pad 60/32/68 · list max-w 880 centered
- ACT 3 STAGE — rule · pad 60/32/76 · label row → chips mt 16 → truth line mt 12 → stage mt 20
- ACT 4 FOOT — rule · pad 40/32/60 · bundle bar → pricing line mt 14
- Act labels: mono 10/600/+0.16em `#7A7488` — "NINE MODULES · ONE SPINE" + "WHO IT'S FOR" centered; "THE MODULES" left with honesty line right (mono 9.5 `#A8A2B0`)

## 2 · Spine anatomy (Act 1) — zero per-module arrows

1. Label (centered)
2. Marks mt 22 — nine pairs, centered flex, wrap, gap 10×26: number mono 10 `#A8A2B0` + name mono 10/600/+0.08em `#3B2D6B` (01 TRAVEL … 09 CONTENT)
3. Spine — 1px × 40 `#DDD6E8` vertical, mt 26, centered
4. Sentence half 1 mt 20 — sans 16 `#4A4A5A`: "Every module speaks the same three words —"
5. THE WORDS mt 12 — mono 24/600/+0.16em `#3B2D6B`: `A DATE · A TIME · A DOLLAR` (separator dots `#B8860B`)
6. Sentence half 2 mt 12 — "— and the app writes them into"
7. Spine — 1px × 32, mt 20 · ends in 5×5 gold square
8. Hubs mt 14 — centered, gap 24: `ONE LEDGER` purple fill + 4px gold bottom border; `ONE CALENDAR` `#FFFDF9` + 1px hairline. Both: mono 12.5/600/+0.14em, pad 15×30

## 3 · Chip states (Act 3)

Row: `grid-template-columns: repeat(9, 1fr)` · gap 8. Chip: pad 9/8/8, mono 10/+0.06em, centered baseline flex gap 6, nowrap, cursor pointer.

- DEFAULT — bg `#FFFDF9` · border 1px `#DDD6E8` · border-bottom 3px `#DDD6E8` · text `#4A4A5A` · number `#A8A2B0`
- LIVE (Travel only) — default + gold `▪` before the name (`#B8860B`)
- ACTIVE — bg + border `#3B2D6B` · text `#FFFDF9` · number `rgba(255,255,255,.6)` · border-bottom 3px `#B8860B` (the frames' you-are-here cell)

Truth line under chips (mt 12, mono 11 `#7A7488`, repo's own sentence):
"Search & book travel free today — no account needed. Paid modules are launching soon."
All nine chips switch the ONE stage — same anatomy, different data. Review states: Runway (default) / Trade / Travel.

## 4 · Stage grid (Act 3)

One card: radius 8, border `#DDD6E8`, bg `#FFFFFF`, overflow hidden. The 400 column runs through both rows — one continuous vertical.

- BAR — px 18 / py 10, bottom rule: kicker `NN / NAME` mono 10.5/+0.05em `#4A4A5A` · status right: `LIVE — FREE` mono 10.5/600 `#3B2D6B` / `LAUNCHING SOON` mono 10.5/+0.05em `#7A7488`
- BODY — `grid: 1fr / 400`
  - FRAME cell — aspect 16/10, bg `#FAF8F3`; illustration as `background: url(public/demo/<id>.svg) center/contain no-repeat` (resolved at render — never an unresolved `<img src>`); 814 wide at 1216 (scale 0.68)
  - RAIL — border-left `#DDD6E8`, pad 22/24, flex column: label row ("THE PIPELINE" mono 10/600/+0.14em `#7A7488` · "NN STEPS" right mono 10 `#A8A2B0`) → step rows (py 11, top rule `#EBE4F7`; number mono 11 `#A8A2B0` col 22 · name sans 15/500 `#1A1A2E`) → flex spacer (min 14) → foot note mono 9.5/+0.08em `#A8A2B0`: "A PREVIEW OF EXACTLY WHAT THE BUYER SEES INSIDE"
- ROW C — top rule, `grid: 1fr / 400`
  - LEFT pad 18 — line 1 sans 16.5/500/1.4 `#1A1A2E` · line 2 mt 6 sans 13/1.6 `#7A7488` (both verbatim)
  - RIGHT — border-left, pad 16/24, flex column: group tag chip (border `#DDD6E8`, radius 4, pad 2×8, mono 10/600/+0.08em `#4A4A5A`) → rationale mt 8 sans 12/1.55 `#7A7488` → spacer → `EXPLORE →` mono 11/600/+0.06em `#3B2D6B` → `/modules/<id>`

Step counts vary (4–7); the frame fixes the height, the rail breathes.

## 5 · Mobile 390 rules

- NOTHING RENDERED UNDER 12PX — micro-labels promote to 12. Page never scrolls sideways.
- Column pad-x 16 · header pt 36, h2 27 · act pads 40–52
- Act 1: marks 3×3 grid (mono 12) · spine 30/24 · words mono 16.5/600/+0.1em · hubs one row, gap 12, pad 12×18
- Act 2: rows stacked — persona label (mono 12/600) over line (sans 14.5; stack part mono 12.5 purple), top rules `#EBE4F7`
- Act 3: chips = CONTAINED horizontal scroll strip (`overflow-x:auto`, inner `width:max-content`, gap 8, pad-x 16, chips mono 12, pad 10/12/9) · stage stacks: BAR → STEP LIST FIRST → frame (full-width `<img>`, may crop) → captions → group tag → EXPLORE →
- Act 4: bundle chip + "Launching soon" one row, text below · pricing line wraps

## 6 · Strings ledger

### Verbatim from source — NEVER retype
- H2: "The product, as it runs."
- Intro: "Everything you plan and everything you spend lands in one place — so it can tell you how long your money lasts."
- Statuses: `LIVE — FREE` (Travel) · `LAUNCHING SOON` (all eight others)
- Truth line: "Search & book travel free today — no account needed. Paid modules are launching soon."
- Honesty line: `ILLUSTRATED PIPELINES — NOT SCREENSHOTS`
- Pricing slot: `HOW PRICING WORKS →` · foot link: "Every price, traced to a real bill → see the full breakdown"
- Bundle: chip `ALL-MODULES BUNDLE` · "Every module above — one subscription." · "Launching soon"
- Stage line 1 = `PILLAR_CARDS[id].plain` · line 2 = `FRAME_LINKS[id]` (src/components/landing/Landing.tsx):
  - Travel: "Search, book, and budget your trips in one place." / "Every booking lands in your budget and on your calendar — automatically."
  - Runway: "See how many months your money lasts." / "Reads what you planned and what you actually spent. The number moves as you live."
  - Books: "Know where every dollar went — synced straight from your bank." / "Real transactions, real double-entry. Feeds Runway and Tax."
  - Trade: "Find trades worth taking — and get told when to skip." / "Every trade lands in your books."
  - Tax: "Your return builds itself from your records." / "Derived from your closed books — not typed."
  - Compliance: "Every number keeps its receipt — proof you can show later." / "The audit trail writes itself."
  - Routines: "Set up a habit once — it lands on your calendar and your budget." / "Bills stop ambushing you."
  - Projects: "Type a goal — get a plan you can actually run." / "With a price tag, on your calendar."
  - Content: "Turn what you did today into a ready-to-film script." / "Your calendar tells the story."

### Step lists (verbatim — the app's own phase names)
- Runway: 01 Source · 02 History · 03 Burn · 04 Match · 05 Project
- Travel: 01 Trip · 02 Search · 03 Book · 04 Ledger · 05 Reconcile
- Books: 01 Feed · 02 Code · 03 Reconcile · 04 Close · 05 Reports · 06 Export
- Trade: 01 Setup · 02 Scan · 03 Review · 04 Lab · 05 Record · 06 In Books →
- Tax: 01 Life events · 02 Documents · 03 Income · 04 Deductions · 05 Trading · 06 Review · 07 File
- Compliance: 01 Profile · 02 Corpus · 03 Retrieve · 04 Discover · 05 Verify · 06 Register
- Routines: 01 Define · 02 Scheduled · 03 Run · 04 Proven
- Projects: 01 Input · 02 Research · 03 Audit · 04 Tasks · 05 Plan · 06 Evolve
- Content: 01 Inputs · 02 Script map · 03 Answer + Record · 04 Script

### Spine copy (Act 1)
- Label: `NINE MODULES · ONE SPINE`
- "Every module speaks the same three words —" · `A DATE · A TIME · A DOLLAR` · "— and the app writes them into" · `ONE LEDGER` / `ONE CALENDAR`

### Persona lines ×5 (Act 2)
- FOUNDER — "Building a company? **Books + Runway + Projects** is your stack."
- TRADER — "Trading your own money? **Trade + Books + Tax** is your stack."
- CREATOR — "Filming what you do? **Content + Routines + Books** is your stack."
- NOMAD — "Living out of a suitcase? **Travel + Runway + Books** is your stack."
- SMALL BUSINESS OWNER — "Window cleaning business? **Books + Routines + Runway** is your stack."

### Group tags + rationale (stage row C)
- TRAVEL — "Where money moves first." (travel)
- ACCOUNTING — "The ledger is the spine — Books writes it, Runway and Tax read it." (runway, books, tax)
- TRADING — "A money engine with receipts — every trade lands in your books." (trade)
- OPERATIONS — "The life around the money, on the same calendar." (compliance, routines, projects, content)

### New micro-chrome
`WHO IT'S FOR` · `THE MODULES` · `THE PIPELINE` · `NN STEPS` · `A PREVIEW OF EXACTLY WHAT THE BUYER SEES INSIDE` · `EXPLORE →`

---
Source: `Temple-Stuart/temple-stuart-accounting` @ main · tokens from `globals.css` / `tailwind.config.ts` / `design-tokens.ts`.

