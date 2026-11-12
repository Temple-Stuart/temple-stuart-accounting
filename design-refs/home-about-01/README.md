# Temple Stuart — About Us (HOME-ABOUT-01) · Handoff

Alex asked on 2026-11-12 at 21:43 Manila: "ok last but not least , mock up that about me section". He approved the boards at 21:53: "okayy give me the prompt to send it!"

**What he approved is the boards as they open: the letter, centred.** The board's other layout, "Page grid, left", is built only if he says "left" (see the end of "What changes").

## Files in this handoff

| File | What it is |
|---|---|
| `design-refs/home-about-01/Section-Reference.html` | **The spec.** Open it in a browser and resize the window. Every value in its stylesheet is the design, and its markup is the page. The bar above the section is the page's own: it shows the other layout. |
| `design-refs/home-about-01/README.md` | This file. |

## What stays

- **Alex's words, exact, in his order**: `src/lib/stopZeroWords.ts` stays byte for byte. Its header says why: "Never reworded, trimmed or added to here: a change to these words is Alex's."
- **HOME-BRIEF-02's structure** (Alex, 2026-11-10): one readable column; the heading, the place, the dates, then three parts, each an h3, its paragraphs and its quote last. No grid, no card, no timeline, no border on a quote.
- **The heading's type**: the act headings' classes, as What We Do wears them since Alex's note of 2026-11-12 ("i like how about us and What We do were the same. About us is better size"): `text-3xl sm:text-4xl font-medium tracking-tight text-brand-gold`. It stays those classes and is not ported as a rule. Its `mt-3` goes, as What We Do's did.
- `id="stop-0"` (`STOP_ZERO_ANCHOR`; the footer lands on it), `aria-label="About us"`, the bottom line, and the mount in `Landing.tsx` between Travel Marketplace and Our Story.

## What changes

1. **The column** is 680px at most and stands in the middle of the page, like a letter. The section keeps the page container's sides: 1280px at most, 16px, 32px from 1024px.
2. **Under the heading**, on one line that wraps:
   - "Stop 0" as a small outlined tag, the way the trip cards write a stop;
   - "Los Angeles, California 🇺🇸" at 17px, semibold;
   - "January to June 2026" in the cards' date look (violet mono). It is no longer italic: HOME-BRIEF-02 said "the dates in italics", and the PR says so.
3. **Each part**:
   - a hairline across the top, 1040px at most and centred;
   - its number (01, 02, 03 — gold mono, `aria-hidden`, derived from his order);
   - its heading at `clamp(24px, 2.2vw, 32px)`;
   - his paragraphs at 17–18px / 1.7, 680px wide at most, which is about 70 characters a line;
   - then **his quote as a statement**: centred, `clamp(26px, 3.2vw, 46px)`, violet, 1040px wide at most, its own two curly marks drawn in gold. Still no border.

**Only if Alex says "left"**, the board's other layout applies (`.about--left` in the reference). The column stands at the page's left edge, the rules run the container's width, and each quote is left-aligned with its opening mark hung into the margin. Nothing else changes.

## The words

| On the page | Home |
|---|---|
| About Us | `ABOUT_US_HEADING`, `src/lib/homeActWords.ts` |
| Stop 0 · Los Angeles, California 🇺🇸 | `STOP_ZERO_PLACE`, `src/lib/stopZeroWords.ts` — drawn as two parts, split at its " \| " |
| January to June 2026 | `STOP_ZERO_DATES`, `stopZeroWords.ts` |
| the three parts' headings, paragraphs and quotes | `STOP_ZERO_STORY`, `stopZeroWords.ts`, in its order |
| 01 · 02 · 03 | derived from the order; `aria-hidden` |

Two pure helpers in the section split what it draws, and the leaf stays as it is:
- **the place line at its " | "**: the stop, then the place;
- **each quote's two marks** (“ and ”): the mark, the words, the mark.

Each refuses, by name, a string that hasn't that shape. Never a guess, never a fallback.

## Tokens

**Already in the app.** Each is the same name behind the house prefix (`hero-violet-2` is `--ts-hero-violet-2`, `gold` is `--ts-gold`). Add none.

| Token | Value | Here |
|---|---|---|
| `bg` | `250 248 243` | the cream ground |
| `border` | `221 214 232` | the line under the section |
| `gold` | `184 134 11` | the heading (as text-brand-gold, the act headings' colour); the quotes' two marks |
| `hero-violet-2` | `#4D1FBC` | the quotes |
| `hero-violet-3` | `#32118A` | Stop 0; the dates |
| `hero-violet-4` | `#210A5E` | the place; the three parts' headings |

**Added by HOME-PLANS-04** (on main since PR #1971 as `--ts-fs-*`, the same values). Add none.

| Token | Value | Here |
|---|---|---|
| `fs-white` | `255 255 255` | Stop 0's fill |
| `fs-ink` | `#2B2545` | his paragraphs |
| `fs-gold-text` | `#8A6408` | the parts' numbers |
| `fs-line` | `#E9E4F2` | the rule over each part |
| `fs-button-line` | `#CFC6EC` | Stop 0's border |

**New with this section: none.** No gradient. The stylesheet types no hex and no rgb value outside `:root`.

Type: Inter 400 / 500 / 600 and IBM Plex Mono 500 / 600, both already loaded by `src/app/layout.tsx`.

## Geometry

- The section: `clamp(52px, 6.4vw, 96px)` above the heading, `clamp(64px, 7.6vw, 112px)` under the last quote, then the bottom line.
- The heading: 30px / 36px, and 36px / 40px from 640px. That is the classes' own type, so the section stands 1–3px taller than the board.
- The line under it: 18px under the heading, items 14px apart and 8px between rows; the Stop 0 tag 24px tall.
- A part: `clamp(40px, 4.4vw, 64px)` above its rule and `clamp(36px, 4vw, 56px)` under it. The number, then the heading 12px under it, then the first paragraph 20px under the heading and the next ones 16px apart. The quote stands `clamp(32px, 3.6vw, 52px)` under the last paragraph.

## Behaviour

None. No state, no script, no clock: it is text.

## Checked

The reference was rendered in Chromium (no other engine) at 1920, 1440, 1280, 1024, 1023, 768, 767, 640, 639, 480, 390, 360 and 340px wide, in both layouts. At every width:
- Nothing scrolls sideways, nothing passes the window's edge, and nothing is cut off.
- **The letter:** every column is 680px (or the container's width, where that is less) and centred. Every rule is 1040px (or less) and centred. Every quote is centred, centred-aligned, and 1040px wide at most.
- **The left layout:** the columns and quotes start at the container's left edge, and the rules run its width.
- The heading is 30/36px under 640px and 36/40px from it, weight 500, −0.025em, in the house gold: exactly what its classes give.
- Every word on the page, in order, is the leaves' own: the heading, the stop, the place, the dates, then each part's number, heading, paragraphs and quote. No paragraph is wider than 680px.

Also:
- **Against the app's base styles.** With Tailwind 3.4.18's preflight loaded ahead of the stylesheet, 8 screenshots (1440, 1024, 768 and 390px, both layouts) are identical to the file as shipped, pixel for pixel.
- **Against the canvas.** At 1440px the section is 2991px tall, against the board's 2990px; at 390px, 3334px against 3331px. The difference is the heading's line height and the bottom line.
- **Against the repo** at `ed10acc`: every word is in `stopZeroWords.ts` or `homeActWords.ts`, exact.
- **Contrast.** The body text is at least 5.06 : 1 (the parts' numbers); the paragraphs are 13.61 : 1. The gold heading and the quotes' gold marks are 3.07 : 1, which is large type: the heading is today's, unchanged. The quotes are 8.84 : 1.

Not checked: any engine but Chromium, a real phone, a screen reader.

When porting:
- Port every rule but the heading's (`.about` → `.ts-about`, `var(--fs-ink)` → `var(--ts-fs-ink)`, `rgb(var(--gold))` → `rgb(var(--ts-gold))`, the families → `var(--font-sans)` and `var(--font-mono)`). Leave out the `.about--left` block unless Alex says "left", and leave out "THIS PAGE'S OWN".
- The heading stays the act headings' Tailwind classes, as What We Do's does.
