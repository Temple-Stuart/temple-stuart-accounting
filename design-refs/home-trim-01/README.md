# Temple Stuart — About Us, the band (HOME-TRIM-01) · Handoff

Alex showed the home page to his four beta users and, on 2026-11-14 at 19:11 Manila, asked for a mock-up that answers their notes: "I would like to take this feedback, consider it deeply, review the home page in its current state, and then come up with a mock up to meet the requests of the beta users feedback." One of the notes, as he pasted it: "Like for Mobile, put your story behind a page and make it a vertical scroll." He approved the boards at 20:01: "ALL LOOKS GOOD … OTHERWISE, LETS DO IT". He approved the corrected boards at 20:41: "thats it!  yeet yeet!"

**What he approved for About Us is one band on the home page, on every width: the heading, the first quote of his letter, and one button that opens the letter on its own page.** The letter is not shortened or reworded. It lives on `/about`, which HOME-PAGES-01 built (PR #1986).

## Files in this handoff

| File | What it is |
|---|---|
| `design-refs/home-trim-01/Section-Reference.html` | **The spec.** Open it in a browser and resize the window. Every value in its stylesheet is the design, and its markup is the page. |
| `design-refs/home-trim-01/README.md` | This file. |

## What changes

1. **On the home page, About Us is one band.** Left: the heading, then his first quote. Right: one button, "Read my story →", that opens `/about`. Under about 812px the button has no room beside the quote and stands under it, at the left.
2. **The letter leaves the home page, and only the home page.** `/about` shows it whole, as it is today.
3. **The page gets shorter.** At 1440px About Us goes from 2,991px to 263px. At 390px it goes from 3,334px to 336px.

## What stays

- **The letter.** `src/components/landing/StopZeroSection.tsx` draws it exactly as it does today: no element, class, word or rule of it changes. Its stylesheet (`.ts-about…` in `src/app/globals.css`) and `design-refs/home-about-01` are not edited. `/about` mounts the section as it is. Only notes that say where the section is mounted are re-said.
- **Alex's words.** `src/lib/stopZeroWords.ts` stays byte for byte, as HOME-PAGES-01 left it. Its header says why: "Never reworded, trimmed or added to here: a change to these words is Alex's." The band's quote is that leaf's first quote, read through the letter's own helper.
- **The heading's type**: the act headings' classes, as What We Do and the letter's About Us wear them: `text-3xl sm:text-4xl font-medium tracking-tight text-brand-gold`. It stays those classes and is not ported as a rule.
- **The seat.** The band stands where the letter stood, between Travel Marketplace and Our Story. It keeps `aria-label="About us"` and the line under the section. It carries no id: `stop-0` is the letter's section's alone, on `/about`, and no link lands on it (`src/lib/homeAnchors.ts`).
- **Our Story**, directly under the band, on every width. Alex, 2026-11-14 20:01: "I LIKE SEEING IT ON THE WEB, OTHERWISE USER MIGHT NOT BE INTRIGUED TO READ THE STORY.. OR KNOW THE BLOG IS EVEN THERE." Nothing in this handoff touches the trip cards.

## The words

| On the page | Home |
|---|---|
| About Us | `ABOUT_US_HEADING`, `src/lib/homeActWords.ts` |
| “Everyone was showing me the life they were living. I wanted to understand how to build one of my own.” | `STOP_ZERO_STORY[0].quote`, `src/lib/stopZeroWords.ts` — split into its two marks and its words by the letter's helper, `quoteParts` (`StopZeroSection.tsx`) |
| Read my story → | **New.** One constant in `src/lib/homeActWords.ts`, beside `ABOUT_US_HEADING`. The arrow is part of the string, as it is in "Compare all four plans →" (`src/lib/howTo.ts`). |
| `/about` | the button's path: `ABOUT_PATH`, `src/lib/homePages.ts` (HOME-PAGES-01), read from there and not retyped |

The new constant does not go in `stopZeroWords.ts`. That leaf is held byte for byte (`homeAbout01.test.ts`), and `stopZero01.test.ts` holds that "Read my story" is typed nowhere in it.

## Tokens

**Already in the app.** Each is the same name behind the house prefix (`hero-violet-2` is `--ts-hero-violet-2`, `gold` is `--ts-gold`). Add none.

| Token | Value | Here |
|---|---|---|
| `bg` | `250 248 243` | the cream ground |
| `border` | `221 214 232` | the line under the band |
| `gold` | `184 134 11` | the heading (as text-brand-gold, the act headings' colour); the quote's two marks |
| `hero-violet-2` | `#4D1FBC` | the quote; the button's border when it is pointed at; the focus ring |
| `hero-violet-3` | `#32118A` | the button's words |

**Added by HOME-PLANS-04** (on main since PR #1971 as `--ts-fs-*`, the same values). Add none.

| Token | Value | Here |
|---|---|---|
| `fs-white` | `255 255 255` | the button's fill |
| `fs-button-line` | `#CFC6EC` | the button's border |

**New with this section: none.** No gradient. The stylesheet types no hex and no rgb value outside `:root`.

Type: Inter 500 / 600, already loaded by `src/app/layout.tsx`.

## Geometry

- **The band** keeps the page container's sides: 1280px at most, 16px, 32px from 1024px. Above the heading: `clamp(44px, 2vw + 36px, 64px)`, which is 44px up to 400px wide and 64px from 1400px. Under the words: `clamp(40px, 1.6vw + 33.6px, 56px)`, which is 40px and 56px at the same two widths. Then the bottom line.
- **The heading**: 30px / 36px, and 36px / 40px from 640px. That is the classes' own type.
- **The quote**: 20px under the heading. `clamp(26px, 0.8vw + 22.8px, 34px)` / 1.2, weight 500, −0.025em: 26px up to 400px wide, 34px from 1400px. It is the letter's quote colour and weight, smaller, and left-aligned.
- **The words' column**: 560px at least when it shares the row, 880px at most.
- **The button**: 48px tall, 24px sides, a 1.5px border, fully rounded; 15px / 1.2, semibold. It is the quiet pill, at the plan cards' height. It never wraps and is about 172px wide.
- **The row**: from about 812px the button stands at the container's right edge, its bottom on the quote's bottom, at least 48px from the words. Under that it stands 22px under the quote, at the left edge.

## Behaviour

A link. No state, no script, no clock.

- Pointed at, the button's border turns the quote's violet over 0.16s. With reduced motion it turns at once.
- Focused from the keyboard, it wears the house ring: 2px, the same violet, 3px off.

## In the reference but not on the canvas

- The canvas drew two widths, 1440px and 390px. The values between them are the reference's.
- The button's pointed-at and focused looks. They are the quiet pill's, as the plan cards and the trip cards have them.

## Checked

The reference was rendered in Chromium (no other engine) at 1920, 1440, 1280, 1024, 1023, 900, 813, 812, 768, 767, 640, 639, 480, 390, 360 and 340px wide. At every width:
- Nothing scrolls sideways, nothing passes the window's edge, and nothing is cut off.
- The button is 48px tall and on one line. It stands beside the words from 812px and under them below that (811, 810, 809 and 808px were rendered too).
- The heading is 30/36px under 640px and 36/40px from it.
- The quote is two lines at 1440px and 1024px, three at 900px, four at 390px and five at 340px.

Also:
- **Against the canvas.** The band was lifted out of each approved board (Home · Desktop at 1440px, Home · Phone at 390px) and set beside the reference at the same width. Both pairs are identical, pixel for pixel. The band is 263px tall at 1440px and 336px at 390px.
- **Against the app's base styles.** With Tailwind 3.4.18's preflight loaded ahead of the stylesheet, 4 screenshots (1440, 1024, 768 and 390px) are identical to the file as shipped, pixel for pixel.
- **Against the repo** at `480d4ef`: the heading is `ABOUT_US_HEADING` and the quote is `STOP_ZERO_STORY[0].quote`, exact. The seven tokens are in `globals.css` under the house prefix with these values.
- **Keyboard.** One tab stop, the button. Its ring shows on focus.
- **Contrast.** The quote is 8.84 : 1 on the cream. The button's words are 13.27 : 1 on its white. The gold heading and the quote's gold marks are 3.07 : 1, which is large type: the heading is today's, unchanged. The button's border is 1.53 : 1 against the cream. That is the quiet pill as the site already draws it, and this handoff does not change it.

Not checked: any engine but Chromium, a real phone, a screen reader. The file was rendered with Inter installed on the build machine, not with the font as the site serves it.

## When porting

- Port every rule but the heading's and "THIS PAGE'S OWN" (`.aboutband` → `.ts-aboutband`, `var(--hero-violet-2)` → `var(--ts-hero-violet-2)`, `rgb(var(--gold))` → `rgb(var(--ts-gold))`, the family → `var(--font-sans)`).
- The heading stays the act headings' Tailwind classes, as the letter's does.
- The class is one word, `aboutband`, on purpose. `homeAbout01.test.ts` holds that no rule outside the letter's port names `.ts-about` or a class that starts `.ts-about-` or `.ts-about_`. `.ts-aboutband` is neither, so that test stands as it is.
- The section carries no id and reads no anchor.
