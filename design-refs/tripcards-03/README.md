# Temple Stuart — Our Story, the stop cards (TRIPCARDS-03) · Handoff

Approved by Alex on the design canvas, 2026-11-12 21:21 Manila: "omg yesssssssss that is fucking sexy, our story, yassss yassss yasssss! give me the prmpt to turn this real!"

His brief (21:08): "so these cards (a) dont follow the new asthetics of the page, and also when we made these, it like cuts out parts of my photos and for example the sunset pic in bali, its cutting out surfers in the sunset which were a big part of the image... (b) like how the other cards had the issue, the data just looks like kinda crammed and messy and shanty on the card now...."

**What he approved is the board as it opens**: the quiet Read the post → button, the violet heading, and the row starting at Stop 1. The other choices in the canvas's side panel are not part of this build: a purple button, a gold heading, and the row opening on the stop he is at.

## Files in this handoff

| File | What it is |
|---|---|
| `design-refs/tripcards-03/Section-Reference.html` | **The spec.** Open it in a browser from inside the repo; it reads the photos from `public/was-here/`. Drag or swipe the row, press the arrows, Tab through it, resize the window. Every value in its stylesheet is the design, and its markup is the page as it opens on 2026-11-12. |
| `design-refs/tripcards-03/README.md` | This file. |

## Why the photos were cut

Every photo is 3 : 2. Today's card is 336 × 320, almost square, so `object-cover` keeps about 70% of each photo's width. Then the dark band across the photo's foot covers its last 70px or so. That is where the Canggu surfers are.

## What changes

Top to bottom, as the reference draws it:

1. **The head.**
   - MY TRIP is the eyebrow, in gold mono (the look of the "What We Do" eyebrow).
   - Our Story is at the pillars' size, in violet. It was gold by HOME-FINISH-02 (Alex, 2026-11-10 20:56); the PR says so.
     **The one open choice.** That afternoon Alex wrote, of What We Do: "i like how about us and What We do were the same. About us is better size". What We Do and About Us now wear the act headings' type: `text-3xl sm:text-4xl font-medium tracking-tight text-brand-gold`. If Alex says "gold" when he launches the build, Our Story's heading wears that type instead, and nothing else changes.
   - The line sits under it.
   - From 768px, two round arrows stand on the right.
2. **The row.** It is still one line of cards that scrolls sideways (TRIPCARDS-01's ruling stands). It now runs to the window's edges, with its first card under the heading. It snaps to a card's start when it comes to rest near one (proximity, as today).
   - The drawn scrollbar leaves. From 768px the arrows move the row. Under 768px it is swiped, and the next card shows at the edge.
3. **The card**: white, 20px radius, the house shadow, 352px wide (less on a phone).
   - **The photo, whole**, at 3 : 2 in a frame with a 14px radius, inset 10px. Nothing is drawn on it. The stop chip, the band and the credit leave it.
   - Under the photo: the stop ("Stop 7") and its chip. I'M HERE is filled violet with a dot; COMING UP is outlined. The photo's credit sits at the right of that line.
   - The city (20px), the country, then the dates in violet mono.
   - At the foot, the three costs. Each row is its label, its name (ending in "…" when long, the whole name in its title) and its amount (never cut; gold when paid). Then **Read the post →** as the quiet pill, the card's width.
   - **The stop he is at** wears a violet ring.
   - **A stop with no photo yet** (Cebu) opens with the place at 30px, and its foot stays at the foot. TRIPCARDS-01's rule stands: no empty photo box.

What leaves:
- the dark card (TRIPCARDS-02's trip.com look) and the 320px crop;
- the chip and the band on the photo;
- the drawn scrollbar;
- `PRIMARY_CTA` on Read the post →. Alex, 2026-11-08 (HOME-FINISH-01): "same thing on blog read the post button.... should be consistent, like lookup, purple". The approved board makes it the quiet pill. The PR says so, and the `buttons01.test.ts` pin changes with this approval quoted.

## What stays

- The order (`tripOrder`), one card per stop, and "Stop n" from that order.
- The label from the server's day (`stopLabel`), the dates (`stayWords`), and the three costs (`stopCostRows`) with "n/a" and "not in my log yet".
- Every stop's post link. The photo still opens the post out of the tab order (`tabindex="-1"`, `aria-hidden`).
- The act's id (`MY_TRIP_ANCHOR`), its `aria-label` ("My trip"), its bottom line, `data-my-trip`, and every `data-was-here-*` hook.
- The About section (Stop 0) is untouched. Its own redesign comes next.

## The photos: the rule that keeps them whole

- The frame is 3 : 2 by CSS (`aspect-ratio: 3 / 2`, `object-fit: cover`). Every photo is 3 : 2 (all nine, within 0.1%), so cover cuts nothing. The frame holds its space before the photo loads (checked with the photos blocked: no shift).
- **A new build law** reads each photo's pixel size from its file's own header (.jpg and .webp, as the leaf allows) and refuses, by name, a photo more than 1% from 3 : 2. So the card never crops a photo: Alex crops a new one, on purpose, before it goes in. Use no new dependency unless the repo already has one that reads image sizes.

## The row: arrows and keyboard

- **The arrows** are two buttons, `aria-label` "Earlier stops" and "Later stops" (new words), each `aria-controls` the row.
  - Each moves the row by one card (the card's width and the gap), smoothly, or at once under `prefers-reduced-motion`.
  - At either end an arrow says it can go no further: `aria-disabled="true"`, so it keeps the focus, faded to 0.4. This updates on scroll and on resize.
  - They show from 768px.
- **A card the keyboard reaches comes into view whole.** If it stands past either edge of the window, it moves to the row's start, which is a snap point. Without this, the browser shows the focused button but leaves its card cut at the edge; that was checked.
- The keyboard's order: the two arrows, then each card's Read the post →, in trip order. The photos are skipped.

## Words

Every word is read from its home. None is typed in a component.

| On the page | Home |
|---|---|
| My trip | the section's aria-label, typed in src/components/landing/WasHereSection.tsx |
| MY TRIP | MY_TRIP_EYEBROW, WasHereSection.tsx |
| Our Story | OUR_STORY_HEADING, src/lib/homeActWords.ts |
| Stop by stop, dated, with the whole story where I've written it up. | MY_TRIP_LINE, WasHereSection.tsx |
| Read the post → | READ_THE_POST, WasHereSection.tsx |
| I'M HERE | stopLabel(), src/lib/wasHereWords.ts |
| COMING UP | stopLabel(), wasHereWords.ts |
| Stay | STOP_COST_LABELS.stay, src/lib/tripPostWords.ts |
| Motorbike | STOP_COST_LABELS.moto, tripPostWords.ts |
| Flight in | STOP_COST_LABELS.flightIn, tripPostWords.ts |
| n/a | NOT_APPLICABLE, tripPostWords.ts |
| not in my log yet | NOT_IN_LOG, tripPostWords.ts |
| "Stop n" | `stopWords()`, `src/lib/wasHereWords.ts` |
| the dates | `stayWords()`, `wasHereWords.ts` |
| the city, the country, the photo's credit and alt | `WAS_HERE`, `src/lib/wasHere.ts` |
| each cost's name · each amount | `TRIP_COSTS`, `src/lib/tripCosts.ts` · `functionalMoneyWords()` through `stopCostRows()` |
| **Earlier stops** · **Later stops** | **New**: the arrows' labels. Proposed home: beside `READ_THE_POST` in `WasHereSection.tsx`, or the leaf the audit finds right. |

## Data

- The stops: `WAS_HERE` in `tripOrder`; the costs: `TRIP_COSTS` through `stopCostRows`; the day: `today`, from `src/app/page.tsx`, as now.
- **An amount's look follows its cost line's kind**: paid is gold; none and unknown are muted. Read the kind from the data (`stopCostRows` can carry it beside the words), never from the words.
- The reference's stops come straight from those leaves, run on 2026-11-12 (10 stops, 9 with a photo).

## Tokens

**Already in the app.** Each is the same name behind the house prefix (`hero-violet-2` is `--ts-hero-violet-2`). Add none.

| Token | Value | Here |
|---|---|---|
| `bg` | `250 248 243` | the cream ground |
| `border` | `221 214 232` | the line under the section |
| `hero-violet-2` | `#4D1FBC` | the arrows' chevrons; the ring and the filled chip of the stop he is at; the focus ring |
| `hero-violet-3` | `#32118A` | the dates; a coming-up chip's words; the post button's words |
| `hero-violet-4` | `#210A5E` | the heading and each place |

**Added by HOME-PLANS-04** (on main since PR #1971 as `--ts-fs-*`, the same values). Add none.

| Token | Value | Here |
|---|---|---|
| `fs-white` | `255 255 255` | the cards, the arrows, the chips and the post button; the filled chip's words |
| `fs-ink` | `#2B2545` | body text; what each cost was |
| `fs-ink-soft` | `#4A4560` | the line under the heading; each country |
| `fs-ink-muted` | `#6F6988` | the stop number, the photo credit, the cost labels, n/a and not in my log yet |
| `fs-gold-text` | `#8A6408` | the eyebrow; each amount paid |
| `fs-line` | `#E9E4F2` | a card's border |
| `fs-rule` | `#EEEAF5` | the rules between the costs; the photo's ground while it loads |
| `fs-chip-line` | `#E4DFF0` | the arrows' border |
| `fs-button-line` | `#CFC6EC` | a coming-up chip's border; the post button's border |
| `fs-shadow` | `33 10 94` | shadows on the cream: hero-violet-4 as channels |

**New with this section: none.** No gradient. The stylesheet types no hex and no rgb value outside `:root`.

Type: Inter 400 / 500 / 600 and IBM Plex Mono 500 / 600, both already loaded by `src/app/layout.tsx`.

## Geometry

**Every width**
- The section: `clamp(44px, 5.6vw, 80px)` above the eyebrow. Under the row's own 32px, `clamp(40px, 5vw, 72px)` to the bottom line. The head sits in the page container: 1280px at most, 16px sides, 32px from 1024px.
- Eyebrow 13px mono. Heading `clamp(34px, 4vw, 56px)` / 1.05 / −0.03em, weight 500, 12px under the eyebrow. Line `clamp(16px, 1.4vw, 19px)` / 1.55, 16px under the heading, 640px wide at most. Arrows 44px round, 10px apart.
- The row: `clamp(24px, 2.8vw, 40px)` under the head; 20px between cards; 4px above and 32px below inside it, for the shadows. Its sides are `max(16px, (100% − 1280px) / 2 + 16px)`, 32px for 16px from 1024px, so its first card stands under the heading. Its snap padding is the same, so a snapped card lines up with the heading.
- A card: 352px, or the row's inner width less 32px where that is smaller (326px at 390px). Padding 10px, radius 20px. Photo radius 14px. Body padding 14px 6px 6px. Chips 22px tall. City 20px (30px with no photo). Country 14px. Dates 13px mono. Cost rows 9px above and below, the label column 84px. Read the post → is 44px tall, 14px under the costs.

**768px and up**: the arrows.

**1024px and up**: 32px sides.

## Behaviour

- No state but the row's scroll position, which is the browser's. Nothing is stored.
- Every card in the row is as tall as the tallest, and the costs and Read the post → sit at its foot.
- Colours change over 160ms, and at once under `prefers-reduced-motion`.

## In the reference but not on the canvas

Alex approved the 1440 and 390 boards. The reference works these out as well, and they are proposals until he has seen them built:

1. **Arrows that know the ends**: faded, `aria-disabled`, keeping the focus.
2. **The keyboard**: a focused card comes into view whole.
3. **Hover**: the arrows' and Read the post →'s borders turn violet. **Focus**: a 2px violet ring.
4. **A narrow phone**: where the stop, its chip and the credit don't fit on one line (340px), the credit wraps to the next line, at the right.

Two things differ from the boards on purpose:
- The side gutters are the page container's own: 16px, and 32px from 1024px.
- The section keeps its bottom line.

## Checked

The reference was rendered in Chromium (no other engine) at 1920, 1440, 1280, 1279, 1024, 1023, 900, 768, 767, 640, 480, 430, 390, 360 and 340px wide. At every width:
- **The layout.**
  - The page never scrolls sideways; the row does.
  - The first card stands exactly under the heading.
  - Every card is the expected width and all ten share one height, with every Read the post → on one line.
- **Every photo.** All nine load. Each shows at 3 : 2, and each file is 3 : 2 within 1%, so nothing is cut.
- **The chips and the ring.** Stops 1–6 have no chip; 7 is I'M HERE with the ring; 8–10 are COMING UP. Cebu has no image and its place is 30px.
- **Nothing collides.** The stop and the credit never overlap. Nothing is cut off, and nothing passes its card's edge. Every name that ends in "…" carries its whole name in its title.
- **The arrows** show only from 768px. At the start, back is `aria-disabled` and forward is not. From 768px:
  - Enter on forward moves the row exactly one card, keeps the focus, and wakes back.
  - Back returns to the start.
  - At the end, forward is `aria-disabled` and pressing it moves nothing.
- **The keyboard.** The order is the arrows, then the ten posts in trip order. Every card the focus lands on is whole on screen.
- **Size.** Every control is at least 44px tall.

Also:
- **Against the app's base styles.** With Tailwind 3.4.18's preflight loaded ahead of the stylesheet, every check above passes. 8 screenshots (1440, 1024, 768 and 390px; the row at its start and at its end) match the file as shipped within 1 of 255 levels.
- **Scripts off.** The file's markup is the page's: the script only sets what the markup already says.
- **Photos blocked.** Every frame still holds 330 × 220 at 1440px, and the cards keep their height.
- **Against the canvas.** At 1440px the section is 923px tall, the board's 922px and the bottom line. At 390px it is 819px, against 818px.
- **Against the repo** at `ed10acc` (main after HOME-SERVICES-01). The 12 words above are their homes' own. Every stop's number, place, dates, cost names and amounts on the page are what the leaves give for 2026-11-12.
- **Contrast.** Every line of text is at least 4.5 : 1 on its ground; the lowest is the eyebrow on the cream (5.06). The arrows' chevrons are 9.38 : 1.

Not checked: any engine but Chromium, a real phone, a screen reader.

Three things to know when porting:
- The row sits outside the page container, the full width of the section; its padding lines its first card up with the heading. It pins `box-sizing: border-box` so the app's base styles change nothing in it.
- The row hides its scrollbar in both ways (`scrollbar-width: none` and `::-webkit-scrollbar { display: none }`).
- The chip takes its mono face, weight, spacing and capitals from the stop line it sits in.
