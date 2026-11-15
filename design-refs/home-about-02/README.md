# Temple Stuart — About Us, the band with the letter's three quotes (HOME-ABOUT-02) · Handoff

Alex, 2026-11-15 at 22:40 Manila, looking at the About Us band on the live home page: "Update the homepage About Us section to display all three quotes, one at the end of each corresponding section, instead of displaying only one." And: "Keep quotes #1 and #3 exactly as written." "Display all three quotes prominently and consistently on the homepage, within their respective sections." "Preserve the existing About Us content, design, styling, and layout wherever possible." At 22:49: "it should be all showing, no swipe on quotes, cause they flow into eachother." At 22:57 he chose quote 2's new words: "That's what I set out to build with Temple Stuart. One connected system for managing your money, planning your future, and measuring the outcomes of your decisions."

**What he asked for is the band with all three of the letter's quotes, each under its part's number and title, and one change to the second quote: a first sentence in front of it.** The letter on `/about` already ends each part with its quote, so there the only change is that new sentence.

## Files in this handoff

| File | What it is |
|---|---|
| `design-refs/home-about-02/Section-Reference.html` | **The spec.** Open it in a browser and resize the window. Every value in its stylesheet is the design, and its markup is the page. |
| `design-refs/home-about-02/README.md` | This file. |

It takes the place of `design-refs/home-trim-01` as the band's spec. That folder stays as it is, the record of the first band.

## What changes

1. **The band shows the letter's three parts.** Each one has a thin rule above it, then the part's number (01, 02, 03), its title, and the quote that ends it in the letter.
   - **From 1024px** the three stand side by side, and "Read my story →" stands beside the heading, at the right.
   - **Under 1024px** they stack in order, and the button comes after the third.
   - **All three always show.** Nothing swipes, folds or hides.
2. **The quotes are smaller,** so three fit side by side: `clamp(22px, 0.2vw + 21.2px, 24px)`, with a 1.25 line height and −0.02em spacing. Today they are `clamp(26px, 0.8vw + 22.8px, 34px)`, 1.2 and −0.025em. They keep their colour, weight and gold marks.
3. **Quote 2 gains a first sentence,** on the home page and in the letter on `/about`:
   - today: “One connected system for managing your money, planning your future, and measuring the outcomes of your decisions.”
   - new: “That's what I set out to build with Temple Stuart. One connected system for managing your money, planning your future, and measuring the outcomes of your decisions.”
   - The apostrophe is the straight one the leaf's other lines use, as in quote 3's "don't".
4. **The band gets taller:**

| | Today | New |
|---|---|---|
| 1440px wide | 263px | 457px |
| 390px wide | 336px | 866px |

## What stays

- **Quotes 1 and 3,** word for word.
- **The heading,** "About Us", in the act headings' type and classes: `text-3xl sm:text-4xl font-medium tracking-tight text-brand-gold`. It stays those classes and is not ported as a rule.
- **The button:** "Read my story →", the quiet pill, 48px tall, to `/about`, with the same pointed-at and focused looks.
- **The band's ground, sides, top, foot and the line under it.** They are home-trim-01's values.
- **The seat:** between Travel Marketplace and Our Story, with `aria-label="About us"` and no id.
- **The letter on `/about`:** its layout and every other word.
- **Our Story,** directly under the band.

## The words

| On the page | Home |
|---|---|
| About Us | `ABOUT_US_HEADING`, `src/lib/homeActWords.ts` |
| 01 · 02 · 03 | `partNumber(index)`, `src/components/landing/StopZeroSection.tsx`, as the letter numbers its parts |
| the three titles | `STOP_ZERO_STORY[i].heading`, `src/lib/stopZeroWords.ts` |
| the three quotes | `STOP_ZERO_STORY[i].quote`, `src/lib/stopZeroWords.ts`, each split into its two marks and its words by the letter's own `quoteParts` |
| Read my story → | `ABOUT_US_DOOR`, `src/lib/homeActWords.ts`, to `ABOUT_PATH`, `src/lib/homePages.ts` |

**One string changes, and it is Alex's:** `STOP_ZERO_STORY[1].quote` in `src/lib/stopZeroWords.ts`, to the new words above. The leaf's header says "a change to these words is Alex's", and this one is (2026-11-15 22:57 Manila).

## Tokens

**Already in the app.** Each is the same name behind the house prefix (`hero-violet-4` is `--ts-hero-violet-4`, `fs-line` is `--ts-fs-line`). Add none.

| Token | Value | Here |
|---|---|---|
| `bg` | `250 248 243` | the cream ground |
| `border` | `221 214 232` | the line under the band |
| `gold` | `184 134 11` | the heading (as text-brand-gold); the quotes' marks |
| `hero-violet-2` | `#4D1FBC` | the quotes; the button's border when it is pointed at; the focus ring |
| `hero-violet-3` | `#32118A` | the button's words |
| `hero-violet-4` | `#210A5E` | each part's title (new to the band) |
| `fs-white` | `255 255 255` | the button's fill |
| `fs-gold-text` | `#8A6408` | each part's number (new to the band), as the letter's numbers wear it |
| `fs-line` | `#E9E4F2` | the rule above each part (new to the band), as the letter's parts have it |
| `fs-button-line` | `#CFC6EC` | the button's border |

**New with this section: none.** No gradient.

Type: Inter 500 and 600, and IBM Plex Mono 600 for the numbers, all already loaded by `src/app/layout.tsx`.

## Geometry

- **The band:** home-trim-01's sides, top and foot.
  - The container is 1280px at most, with 16px sides, 32px from 1024px.
  - Above the heading: `clamp(44px, 2vw + 36px, 64px)`.
  - Under the last line: `clamp(40px, 1.6vw + 33.6px, 56px)`.
- **The grid:**
  - **Under 1024px:** one column — the heading, the three parts 24px under it, the button 28px under them.
  - **From 1024px:** two columns, the heading and the button on the first row, centred on each other, 48px apart at least. The three parts span the second row, 28px under it.
  - **The heading takes the first cell by itself:** no rule places it, so the app's heading needs no class of the band's.
- **The parts:** three equal columns 40px apart from 1024px; 24px apart when stacked. Each has:
  - a 1px `fs-line` rule above it and 20px under that;
  - the number: IBM Plex Mono 600, 13px, 0.14em;
  - the title: 8px under the number, Inter 600, 17px / 1.3, −0.01em;
  - the quote: 12px under the title, 1.25 line height, weight 500, −0.02em.
- **The button:** 48px tall, 24px sides, a 1.5px border, fully rounded, 15px / 1.2 semibold, never wrapping. From 1024px it stands at the right end of the heading's row; under 1024px it stands at the left, after the parts.

## Behaviour

A link. No state, no script, no clock.

- **The button,** pointed at: its border turns the quotes' violet over 0.16s. With reduced motion it turns at once.
- **Focused from the keyboard,** the button wears the house ring: 2px, the same violet, 3px off.
- **Reading order:** the heading, the three parts, the button. From 1024px the button is drawn beside the heading, and the reading order stays the same. It is the band's one tab stop.

## In the reference but not on the canvas

- **The widths between 1440px and 390px.** The canvas drew those two. The values between them are the reference's.
- **The button's pointed-at and focused looks:** home-trim-01's, unchanged.

## Checked

The reference was rendered in Chromium (no other engine) at 1920, 1440, 1280, 1100, 1024, 1023, 900, 768, 767, 640, 639, 480, 390, 360 and 340px wide. At every width:

- Nothing scrolls sideways and nothing passes the window's edge.
- From 1024px the three parts stand side by side and the button stands beside the heading. Under 1024px they stack and the button comes last.
- Line counts of quotes 1, 2 and 3:

| Width | Quote 1 | Quote 2 | Quote 3 |
|---|---|---|---|
| 1440 | 4 | 6 | 3 |
| 1024 | 5 | 7 | 4 |
| 768 | 2 | 3 | 2 |
| 390 | 4 | 6 | 3 |

Also:
- **Against the canvas.** The band was lifted out of the two boards, "About Us band · three quotes (desktop)" at 1440px and "About Us band · three quotes (phone)" at 390px, and set beside the reference at the same width. Both pairs are identical, pixel for pixel.
- **Against the app's base styles.** With Tailwind 3.4.18's preflight loaded ahead of the stylesheet, screenshots at 1440, 1024, 768 and 390px are identical to the file as shipped, pixel for pixel.
- **Against the repo** at `79948a9`:
  - The titles and quotes 1 and 3 are `STOP_ZERO_STORY`'s, exact.
  - "About Us" is `ABOUT_US_HEADING` and "Read my story →" is `ABOUT_US_DOOR`.
  - The ten tokens are in `globals.css` under the house prefix, with these values.
- **The button:** one tab stop. Its border turns `hero-violet-2` when pointed at, its ring shows on focus, and with reduced motion it has no transition.

**Not checked:**
- Any engine but Chromium, a real phone, or a screen reader.
- The site's own font files. Inter was installed on the build machine and IBM Plex Mono was not, so the numbers were drawn by the system monospace, on the boards and here alike.
- The arrow. "→" is not in the latin subset the site serves, so on the site a fallback face draws it, as it does today. A later PR fixes every arrow at once.

## When porting

- **The band's port is replaced, not added to.** The rules ported from home-trim-01 become this stylesheet's, at the same seat in `globals.css`, behind the house prefix (`.aboutband__part` → `.ts-aboutband__part`). Families become `var(--font-sans)` and `var(--font-mono)`.
- **Gone:** `.aboutband__words`. Nothing in the new markup wears it.
- **Not ported:** the heading's rule, which stays the act headings' Tailwind classes, and the page's own ground under "THIS PAGE'S OWN".
- **The class block stays one word, `aboutband`,** so `homeAbout01.test.ts`'s scan (no rule outside the letter's port names `.ts-about` or a class that starts `.ts-about-` or `.ts-about_`) stands as it is.
- **Each number reads `partNumber`** and each quote reads `quoteParts`, both imported from `./StopZeroSection`, as the band imports `quoteParts` today. No second helper is written.
