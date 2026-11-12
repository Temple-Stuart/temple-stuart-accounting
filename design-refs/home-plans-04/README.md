# Temple Stuart — Financial Software section (HOME-PLANS-04) · Handoff

Approved by Alex on the design canvas, 2026-11-12. Replaces what the guest landing's first pillar draws under "What We Do": the pillar's three paragraphs and the four plan cards with their step lists.

## Files in this handoff

| File | What it is |
|---|---|
| `design-refs/home-plans-04/Section-Reference.html` | **The spec.** Open it in a browser. Press `+ Business` and `+ Trading`; resize the window. Every value in its stylesheet is the design, and its markup is the page at rest. It holds no image and reads no outside file but the two fonts. |
| `design-refs/home-plans-04/README.md` | This file. |

## What changes

Top to bottom, as the reference draws it:

1. **"What We Do"** stays where it stands and stays the page's act heading. It wears a small gold mono eyebrow in place of the large gold heading.
2. **Financial Software**, the pillar's name, large. Under it **one line** in place of the three paragraphs.
3. **The map.** One white panel: the question, three pills (Personal is always on; Business and Trading are switches), a count, then all 25 tools under their six families. A tool is filled in its module's colour when the picked plan holds it. When the plan does not, the tool is outlined and carries a small ring in that colour.
4. **Three plan cards**: Personal, Personal + Business, Personal + Trading. Each has its role, its name, who it is for, what it is, three benefits, how many tools it holds, the price line and the button.
5. **The all-three band**: the fourth plan, the same parts laid in a row on the hero's violet.
6. **One link** to the full comparison, as today.

The two switches pick one of the four plans. That plan is ringed, tagged "Your plan", and its button turns gold. At rest nothing is switched on, so Personal is the plan. The canvas's phone artboard is drawn with Business on, to show the second colour; that is not a different default.

Two things leave the page: the pillar's three paragraphs and the step lists inside the cards. Nothing else on the landing draws either.

## Words

Every word is read from its home. None is typed in a component.

| On the page | Home |
|---|---|
| `What We Do` | `WHAT_WE_DO_HEADING`, `src/lib/homeActWords.ts` |
| `Financial Software` | `PLAN_PILLAR.heading`, `src/lib/homeActWords.ts` |
| `Everyone gets Personal. Add a business, a trading book, or both.` | `PLANS_SUBHEAD`, `src/lib/offer/plans.ts` |
| `Four plans. One question: what do you run?` | `PLANS_HEADLINE`, `src/lib/offer/plans.ts` |
| `What you run · add any` (the pills' group label, for a screen reader) | `WHAT_YOU_RUN_LABEL`, `src/lib/howTo.ts` |
| `Personal · always` | `PERSONAL_ALWAYS`, `src/lib/howTo.ts` |
| `+ Business` · `+ Trading` | the part each plan's name adds (`Personal + Business`, `Personal + Trading`, in `PLANS`), so a switch and its card cannot disagree. `ADD_TRADE` in `src/lib/howTo.ts` says `+ Trade`; the board says `+ Trading`, as the plan does. |
| the six family names and the 25 tool names | `PROBLEM_SHEET`, `src/lib/problemSheet.ts`, in its order |
| `In this plan` · `Not in this plan` (each tool's mark, for a screen reader) | `PLAN_MARKS`, `src/lib/howTo.ts` |
| each plan's role, name, audience and three benefits | `PLANS`, `src/lib/offer/plans.ts` |
| each plan's explainer | its `positioning`, then its `relationship`, as one paragraph |
| `Pricing announced at launch` · `Join early access` | `priceSlot(plan)`: its `text` and its `cta` |
| `Compare all four plans →`, to `/pricing` | `COMPARE_PLANS_WORDS`, `COMPARE_PLANS_PATH`, `src/lib/howTo.ts` |
| **New:** `Your plan` | needs a home |
| **New:** `13 of 25 tools` (the count, and each card's) · `All 25 tools` (the band's) | need a home. Both numbers are computed. |

## Data

Nothing here is typed. Each is derived, and a mismatch should fail the build by name.

- **A tool's module** is the module of the capability rows that name it (`CAPABILITY_GROUPS`, `src/lib/offer/plans.ts`). Today that gives 13 Personal, 10 Business and 2 Trading. Two tools are named by two rows each (Expenses and Bookkeeping), both times under Personal. A tool named by no row, or by rows of two modules, has no colour to wear.
- **The picked plan:** `planFor({ business, trade })`, `src/lib/howTo.ts`. It throws by name if the choice matches no plan or two.
- **Lit:** the picked plan's `modules` include the tool's module.
- **The counts:** lit tools over the sheet's tools. Today 13, 23, 15 and 25 of 25. A card's count is the same sum for its own plan.
- **A name's coloured parts:** the name split at ` + `, one part per module in `plan.modules`, in order.
- **One known difference.** The step lists that leave the page (`HOW_TO_SECTIONS`, `src/lib/howTo.ts`) use Bill Pay, FP&A and Brokerage inside Personal's steps. The capability rows, which are what `/pricing` shows, give Bill Pay and FP&A to Business and Brokerage to Trading. The map follows the capability rows.
- **No status is drawn.** A filled tool says "in this plan", never "built". The plan cards' marks have had that standing since HOME-PLANS-01.
- **No price is drawn.** Only the unannounced slot is designed. The plan law already fails the build if a plan carries a price.

## Tokens

**Already in the app.** The reference declares these only so it renders on its own. Each is the same name behind the house prefix (`hero-violet-2` is `--ts-hero-violet-2`, `bg` is `--ts-bg`). Add none.

| Token | Value | Here |
|---|---|---|
| `bg` | `250 248 243` | the cream ground |
| `border` | `221 214 232` | the line under the section |
| `gold` | `184 134 11` | brand gold: Business's ring while it is off (the switch's border, the tools' rings) |
| `hero-violet-1` | `#6A33E0` | the band's sweep, end |
| `hero-violet-2` | `#4D1FBC` | Personal: its fill, its line and ticks; the picked card's ring and tag; the focus ring |
| `hero-violet-3` | `#32118A` | the band's sweep, start, and its flat colour under the gradients; the link and the quiet button's label |
| `hero-violet-4` | `#210A5E` | headings and the count |
| `hero-gold` | `#F6C95C` | Business: its fill; on the band its word, the audience line, the ticks, the tag and the ring |
| `hero-gold-1` | `255 236 178` | the gold button, start |
| `hero-gold-2` | `248 203 90` | the gold button, 52% |
| `hero-gold-3` | `236 178 62` | the gold button, end |
| `hero-on-gold` | `#2A0F5C` | ink on gold |
| `hero-ink` | `#FAF8F4` | text on the band |
| `hero-ink-soft` | `#E4E0F2` | the band's explainer and price line |

**New with this section.**

| Token | Value | Used for |
|---|---|---|
| `fs-white` | `255 255 255` | cards, tools and switches; text on violet and teal; on the band at 0.08 and 0.5; the gold button's top light at 0.75 |
| `fs-teal` | `#0B7F73` | Trading: its fill and its ring; on white its word, line and ticks |
| `fs-teal-deep` | `#0B5F57` | Trading's switch label while off |
| `fs-teal-light` | `#8FE8DA` | Trading's word on the band |
| `fs-gold-text` | `#8A6408` | gold as small text: the eyebrow; on white Business's word, line and ticks |
| `fs-gold-deep` | `#6B4E00` | Business's switch label while off |
| `fs-ink` | `#2B2545` | body text |
| `fs-ink-soft` | `#4A4560` | the lede, explainers, family names, the price line |
| `fs-ink-muted` | `#6F6988` | tools not in the plan, roles, counts |
| `fs-line` | `#E9E4F2` | the panel's and the cards' border |
| `fs-rule` | `#EEEAF5` | the rules inside them |
| `fs-chip-line` | `#E4DFF0` | the border of a tool that is not in the plan |
| `fs-button-line` | `#CFC6EC` | the quiet button's border |
| `fs-band-muted` | `#D6CCF7` | the band's role and count |
| `fs-band-ring` | `230 220 255` | the band's rings, at 0.08 |
| `fs-shadow` | `33 10 94` | shadows on the cream: hero-violet-4 as channels |
| `fs-band-shadow` | `12 6 44` | the shadow under the band's gold button |

One colour per module: Personal is the hero's violet, Business is the hero's gold, Trading is the new teal. Gold and teal each have a darker form for small text on white.

The eyebrow is small type now, so it wears `fs-gold-text` (5.06 : 1 on the cream) and not brand gold, which is about 3.1 : 1 there and for large type only.

Two gradients, both on the board: the picked plan's gold button (the hero's three golds at 135deg, stops 0 / 52 / 100%, drawn solid) and the band (the hero's violets 3, 2, 1 at 120deg, stops 0 / 58 / 100%, under rings 1px wide every 14px).

The stylesheet types no hex and no rgb value outside `:root`.

Type: Inter 400 / 500 / 600 and IBM Plex Mono 500 / 600, both already loaded by `src/app/layout.tsx`.

## Geometry

**Every width**
- The page container: 1280px at most, 16px sides, 32px from 1024px.
- Down the page: `clamp(52px, 6.6vw, 96px)` above the eyebrow · 12px to the name · 16px to the line · `clamp(24px, 2.8vw, 40px)` to the map · 20px to the cards · 20px to the band · 16px to the link · `clamp(52px, 6.2vw, 88px)` to the section's bottom line.
- Name `clamp(34px, 4vw, 56px)` / 1.05 / −0.03em, weight 500. Line `clamp(16px, 1.4vw, 19px)` / 1.55, 620px wide at most.
- Map: 24px radius, padding `clamp(18px, 2.3vw, 32px)`. Pills 44px tall; under 768px the Personal pill takes a row of its own and the two switches share the next, and from 768px the three share one row. A tool is `clamp(36px, 0.5vw + 32px, 38px)` tall with a 10px radius and 14px text.
- Cards: 20px radius, 28px padding, name 26px. Buttons 48px tall, full width.

**1024px and up**
- Tools in six columns, one per family. The three pills on one row, the count at the right end of the same row.
- Three cards across, 20px apart. The cards share their rows, so the three rules and the three buttons line up whatever the words do. Between 1024px and 1400px a card's padding and name scale with the window, down to 24px and 22px at 1024px.
- The band's three blocks stand in a row: 300px, 300px and 220px, with the rest of the width shared 5 : 5 : 3.

**640px to 1023px**
- Tools in three columns. Cards stacked, one to a row. The band's blocks wrap.

**Under 640px**
- Tools in two columns. On a phone the count drops under the pills.
- Under 360px a tool's text is 13px.

## Behaviour

- Two booleans, in React state only: no storage, no URL, no cookie. A reload starts at rest.
- Pressing a switch changes four things at once: that module's tools, the count, which plan is ringed and tagged, and which button is gold. Nothing moves: the section is the same height in all four states.
- Each plan's button is the door it is today: it opens sign-up.
- The two switches are buttons with `aria-pressed`. A tool's mark carries its label (`role="img"`), so a screen reader hears what a visitor sees and no text is drawn for it alone. The count is read out whole when it changes (`aria-live="polite"`, `aria-atomic`).
- Colours change over 160ms, and at once under `prefers-reduced-motion`.

## In the reference but not on the canvas

Alex approved the 1440 and 390 artboards. These were worked out in the reference and are proposals until he has seen them built:

1. **Pointer and keyboard states.** Hover: an unlit switch's ring thickens and a lit one brightens; the quiet button's border turns violet; the gold button brightens; the link turns violet. Focus: a 2px violet ring, gold on the band.
2. **Between the two artboards.** Three columns of tools from 640px; where the pills and the cards change rows; the cards' padding and names between 1024px and 1400px.
3. **A jump to `#modules`** stops 48px above the section, so the eyebrow is on screen.
4. **The count's digits** are tabular, so the figure keeps its place as it changes.

Three things differ from the artboards on purpose. None shows at 1440 or 390:
- The side gutters are the page container's own (16px, 32px from 1024px), where the artboard scales them with its width.
- A lit tool keeps its 1px border, in its own colour, so its name does not move a pixel when it lights.
- The section keeps the bottom line every section on the page has.

## Checked

The reference was rendered in Chromium (no other engine) at 1920, 1440, 1280, 1100, 1024, 1023, 900, 768, 767, 700, 640, 639, 430, 390, 360, 359 and 340px wide, in all four states at each width. At every one:
- no sideways scroll, no box past the window's edge, no tool's name cut off;
- the count, the lit tools and the marks' labels agree (13, 23, 15 and 25);
- exactly one plan is ringed, tagged and gold, and it is the one the switches pick;
- the section is the same height in all four states;
- every pill, button and link is at least 44px tall;
- with three cards across, each name is on one line and the cards' parts start on the same lines.

Also:
- **Against the app's base styles.** With Tailwind 3.4.18's preflight loaded ahead of the stylesheet, the page at 1440, 1024, 768 and 390px in all four states was compared with the file as shipped, pixel by pixel. No pixel differs. The stylesheet states its own line heights, margins, box sizing and button faces, so the port needs no adjustment for them.
- **Against the canvas.** At 1440px the page is 1713px tall, as the artboard is. At 390px it is 3494px: the artboard's 3493px and the bottom line.
- **Against the repo** at `e8bca5c`: every word above is its home's, the families and tools are `PROBLEM_SHEET`'s, and each tool's module and each count come out as stated from `CAPABILITY_GROUPS`.
- **Contrast.** Every line of text is at least 4.5 : 1 on its ground. The lowest are the band's count, measured against the lightest stretch of gradient behind it (4.61), white on the teal (4.89) and the eyebrow on the cream (5.06). The rings are at least 3 : 1 (brand gold on white is 3.25).
- **Keyboard.** Tab reaches the two switches, the four buttons and the link, in that order, each with a visible ring. Space and Enter work a switch and focus stays on it.

Not checked: any engine but Chromium, a real phone, a screen reader.

Two things to know when porting:
- The three cards line up through `grid-template-rows: subgrid`, from 1024px only. Below that each card is a plain column, so a row gap never falls inside a card.
- The gold button drops its border (`border: 0`) because a gradient repeats into a transparent border and shows a seam.
