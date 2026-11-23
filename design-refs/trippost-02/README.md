# Temple Stuart — A stop's page (TRIPPOST-02) · Handoff

Approved by Alex on the design canvas, 2026-11-23 12:52 Bali time: "this is beautiful , except the section called work... we can call that like planning or focus instead.   otherwise this is good!"

His brief (11:38), with four screenshots of a reference page: "Okay, I would like to have the blog posts designed something like this.... review the images, then mock up something that follows the current pages layout and all that good stuff!"

**What he approved is board 1: a stop he has written up (Stop 1, Canggu), as it stood at 12:52.** This handoff differs from that board in the ways listed under "Changed since his yes". **Board 2, a stop not written up yet (Stop 7, General Luna), was drawn from board 1's own parts after his yes** and shown to him with the build prompt. Launching the build is his yes on it.

## Files in this handoff

| File | What it is |
|---|---|
| `design-refs/trippost-02/Post-Reference.html` | **The spec.** Open it in a browser from inside the repo; it reads the photos from `public/was-here/`. It draws two pages, one under the other: Stop 1, written up, then Stop 7, not written up. Press the tabs, pick a day, a week, the arrows and "Read that day"; resize the window. Every value in its stylesheet is the design, and its markup is each page as it opens. |
| `design-refs/trippost-02/README.md` | This file. |

## What the page is today

One column, 768px wide, in the look the site had before the home page was redrawn (`src/components/trip/TripPostView.tsx`): a purple title, bordered boxes, the month as four fold-outs. All ten stops have this page; only Canggu is written up.

## What changes

Top to bottom, as the reference draws it. **A part is drawn only when the stop holds what it shows. Nothing is drawn empty.**

1. **The way back and the count.** "← Back to my trip" on the left, "Stop 1 of 10" on the right.
2. **The head.**
   - A stop written up: the eyebrow, the post's title, its dek, then the place and the dates.
   - A stop not written up: the eyebrow, the place as the title, the dates, then the line that says it is not written, on lavender.
   - **The stop's photo, whole**, beside the head (under it on a narrow window): 3 : 2 in a white frame, its credit under it. Nothing is drawn on it. A stop with no photo (Cebu) has no frame, and the head takes the row.
3. **Four figures** in one white card: how long, the stay a night, the motorbike a day, the fixed bookings. Under each is the sum it came from. A figure that cannot be worked out says why in words ("n/a", "not in my log yet"), smaller and muted. It is never a number. The rules are under "The figures".
4. **What the stop holds of its own**, when it holds it: Alex's line, as a quote on lavender; the event the stop was around (its four lines, as today); DID and LEARNED (no stop holds these today).
5. **The tabs**, on a stop written up: one link for each section drawn, the one being read filled violet. They stay at the top of the window. Under 1024px they are one row that scrolls sideways.
6. **The sections.** Each opens with a small gold heading, then its heading; four of them carry one line under it.
   - On a stop written up the small heading carries the section's number by its place ("01 / The experience"), so a post with no routine has no gap in the numbers.
   - A stop not written up draws "What it actually cost." and, if it has events, "What was on while I was there.", with no numbers.
   - **The short version**: his lines, a lavender tile each.
   - **The day**, only if the post has one: one bar of 24 hours in clock order, its key, and his two cards.
   - **His favorites**: first, only if the post names one, the pick with a photo: the short version's own line, his words from that day, and "Read that day →", which opens that day in the journal. Then every pick list, its items as chips.
   - **What it cost**: the bookings (the stay, the motorbike, the flight in), each with its name, what it covers and its amount; their total; then the post's own costs under "Also in my log". Beside them, a day's share of the fixed bookings: the figure, one bar, each line's sum, and at its foot what is not in these numbers. Where a day's share cannot be worked out, that card is not drawn and the note stands alone beside the bookings.
   - **The journal**: the post's days as a calendar, seven across, starting on the weekday of its first day; the open day, with its chips and two arrows; the weeks. One day is open, and the page opens on the first. A date the post has no entry for is an empty seat.
   - **What he learned**: a card a lesson, numbered; then the first lesson's lead, large, as the takeaway.
   - **What was on while he was there**: each event's dates and source line, its name, its place, and "Source ↗".
7. **The stop before and the stop after.** Stop 0 (Los Angeles, the About page) stands before Stop 1. The last stop has no stop after it.
8. **The band**, and on a stop written up the day it was written.

What leaves:
- the 768px column and every class string in `TripPostView.tsx` (its `POST` grammar);
- the four fold-outs, their day counts and their Open and Close;
- an event as one line in a pill: it is three lines and a link to its source now;
- the capital-letter labels (THE SHORT VERSION, WHAT I'D DO DIFFERENTLY, WHAT IT COST, THE MONTH, DAY BY DAY, WHAT WAS ON WHILE I WAS THERE, MY PICKS);
- the band's flat gold button: the band is the all-three band's violet (HOME-PLANS-04), with its gold button.

## What stays

- The route, built for every stop; the page a server component; the site's top bar above and its footer below.
- Every word of the post, the stop, its costs and its events, read from the leaves that hold them today.
- The page's hooks: `data-trip-post`, `data-trip-post-kind` (written or stop), `data-trip-post-back`, `data-trip-post-section` (header, photo, line, event, did, learned, short, picks, cost, days, differently, on, book, written), `data-trip-post-unwritten`, `data-trip-post-cost`, `data-trip-post-day`, `data-trip-post-chip`, `data-trip-post-event`, `data-trip-post-experience`. New beside them: the sections `tiles`, `tabs`, `routine` and `pager`; `data-trip-post-pick` on whatever opens a day (it names the day); `data-trip-post-week` on a week's button.
- No clock on the page.

## The figures

Whole cents, by integer arithmetic, printed by the one money formatter.

- **Nights**: the stay's end less its start, in days. A stay with no end yet has none.
- **The motorbike's days**: the rental's last day less its first. They come from a new table in the costs leaf, a row for each rental whose days Alex's log holds. Canggu is the one row today: Jul 3 to Jul 30, 27 days (the day he got the scooter and the day he returned it, by his own journal). A rental with no row has no days.
- **A rate**: an amount over what it is spread across, to the nearest cent, halves up: `floor((2 × amount + over) / (2 × over))`. The stay and the flight in are spread across the nights, the motorbike across its days.
- **A rate's tile** shows the rate and its sum ("$708.14 ÷ 29 nights"). A line he never had says "n/a". A line with no rate says "not in my log yet", with the amount under it ("$63.53 total") when the amount is paid and only what to spread it across is missing.
- **Fixed bookings**: the sum of the lines paid. Under it, what is in it ("stay + motorbike + flight in"). A line that is not in the log is named there ("stay + flight in · motorbike not in my log yet"), and the breakdown calls its total "Fixed bookings in my log".
- **A day's share** is drawn only when every line is one he never had or has a rate, and one at least is paid. It is the rounding of the unrounded sum, as one fraction over the product of what each line is spread across. It is never the sum of the rounded rates.

Every stop, from the leaves on 2026-11-23:

| Stop | How long | Stay / night | Motorbike / day | Fixed bookings | A day's share |
|---|---|---|---|---|---|
| 1 · Canggu, Bali | 29 nights | $24.42 ($708.14 ÷ 29 nights) | $4.88 ($131.79 ÷ 27 days) | $1,677.13 (stay + motorbike + flight in) | $58.17 / day |
| 2 · Da Nang / Hoi An | 29 nights | $33.82 ($980.73 ÷ 29 nights) | n/a | $1,156.83 (stay + flight in) | $39.89 / day |
| 3 · Bangkok | 28 nights | $35.99 ($1,007.72 ÷ 28 nights) | n/a | $1,157.62 (stay + flight in) | $41.34 / day |
| 4 · Phuket | 13 nights | $43.82 ($569.61 ÷ 13 nights) | not in my log yet ($80.00 total) | $708.42 (stay + motorbike + flight in) | not drawn |
| 5 · Chiang Mai | 13 nights | $31.80 ($413.37 ÷ 13 nights) | n/a | $525.16 (stay + flight in) | $40.40 / day |
| 6 · Bangkok | 1 night | $43.98 ($43.98 ÷ 1 night) | n/a | $91.18 (stay + flight in) | $91.18 / day |
| 7 · General Luna, Siargao | 22 nights | $29.01 ($638.24 ÷ 22 nights) | not in my log yet ($63.53 total) | $962.27 (stay + motorbike + flight in) | not drawn |
| 8 · Cebu | 7 nights | $31.04 ($217.26 ÷ 7 nights) | not in my log yet | $321.31 (stay + flight in · motorbike not in my log yet) | not drawn |
| 9 · Uluwatu, Bali | 11 nights | $36.38 ($400.16 ÷ 11 nights) | not in my log yet | $665.28 (stay + flight in · motorbike not in my log yet) | not drawn |
| 10 · Pererenan Beach, Bali | 10 nights | $28.59 ($285.90 ÷ 10 nights) | not in my log yet | $285.90 (stay · motorbike, flight in not in my log yet) | not drawn |

## Words

Every word is read from its home. None is typed in a component.

| On the page | Home |
|---|---|
| ← Back to my trip | `POST_BACK`, `src/components/trip/TripPostView.tsx` |
| My trip · Stop 1 | `postEyebrow()`, `src/lib/tripPostWords.ts` |
| the title, the dek, the short version, the lessons, the pick lists, each day's story and chips, the post's own costs, the note under the costs | `TRIP_POSTS`, `src/lib/tripPosts.ts` |
| the place as a title · the place and the dates | `stopHeading()` · `postMeta()`, `tripPostWords.ts`; the dates alone by `stayWords()`, `src/lib/wasHereWords.ts` |
| I haven’t written this stop up yet. · Coming up — booked as of … | `unwrittenLine()`, `tripPostWords.ts` |
| a photo's alt and credit; Alex's line | `WAS_HERE`, `src/lib/wasHere.ts` |
| Stay · Motorbike · Flight in | `STOP_COST_LABELS`, `tripPostWords.ts` |
| n/a · not in my log yet | `NOT_APPLICABLE` · `NOT_IN_LOG`, `tripPostWords.ts` |
| These are the stay, the motorbike and the flight in. The rest of what I spent isn’t in my log yet. | `UNWRITTEN_COST_NOTE`, `tripPostWords.ts` |
| each cost's name · each amount | `TRIP_COSTS`, `src/lib/tripCosts.ts`, through `costRows()` · `functionalMoneyWords()`, `src/lib/books/functionalCurrency.ts` |
| Wed Jul 1 · Week 1 · Jul 1–7, 2026 · Brunch, Dinner, Activity, Entertainment | `dayLabel()` · `weekEyebrow()` · `chipLabel()`, `tripPostWords.ts` |
| every span of dates (the calendar's head; the rental's days) · the weekdays over the calendar | `dateWords()` · `weekdayWords()`, `src/lib/experienceWords.ts` |
| an event's dates and source line · its place | `stopEventLine()` · `stopEventPlace()`, `wasHereWords.ts` |
| the event block's four lines | `experienceCategoryLabel()` and `EXPERIENCES`, `src/lib/experiences.ts`; `experienceWindowLine()`, `experienceWords.ts` |
| DID · LEARNED | `DID`, `LEARNED`, `TripPostView.tsx`; the list joined by `listWords()`, `wasHereWords.ts` |
| Stop 0 · Los Angeles · Stop 2 · Da Nang / Hoi An, and where each opens | `footerStoryLinks()` and `storyLinkParts()`, `src/lib/footerWords.ts`: the footer's own list, so the two never disagree |
| Going to Canggu, Bali? Book the stay and the flight here. · Book the stay and the flight | `bookLine()`, `tripPostWords.ts` · `BOOK_BUTTON`, `TripPostView.tsx` |
| Written Nov 5, 2026 | `writtenLine()`, `tripPostWords.ts` |

**New words.** Proposed home: one new pure leaf beside `tripPostWords.ts`.

| On the page | What it is |
|---|---|
| **Stop 1 of 10** | the stop's number, by `stopWords()`, of the stops in the log |
| **On this page** | the tabs' name for a screen reader |
| **Duration · Stay / night · Motorbike / day · Fixed bookings** | the four figures' labels |
| **29 nights** (1 night) · **27 days** (1 day) · **$708.14 ÷ 29 nights** · **$63.53 total** · **stay + motorbike + flight in** | the figures' own words; the last is the costs' labels in small letters |
| **The story · Daily routine · My favorites · Real costs · Daily journal · What I learned · What was on** | the seven tabs; each is also its section's name for a screen reader |
| **The experience · How I structure my day · Experienced firsthand · Transparent spending · Day by day · What I would tell someone going · While I was there** | the sections' small headings; with its number, "01 / The experience" |
| **The short version. · 24 hours. Intentionally spent. · Places worth returning to. · What it actually cost. · The daily journal. · What I learned the hard way. · What was on while I was there.** | the sections' headings |
| **The daily structure I aim for, rather than a claim that every day follows it perfectly.** | the day's line |
| **My favorite discoveries from the stop. Real vendors, personal impressions, and the experiences that stood out.** | his favorites' line |
| **Verified booking figures from the travel log. Shared costs are allocated by stay duration; unrecorded daily expenses are not assumed to be zero.** | the costs' line where a day's share is drawn |
| **Verified booking figures from the travel log. Unrecorded daily expenses are not assumed to be zero.** | the costs' line where it is not |
| **Pick a day to see what happened, where I ate, and how the day actually unfolded.** | the journal's line |
| **Activity · Meals · Focus · Entertainment · Sleep**, **Activity · 2h**, **A day in 24 hours: activity 2 hours, …** | the day's five kinds, a key's entry, and the bar's words for a screen reader |
| **Read that day →** | opens that day in the journal |
| **Booking breakdown · Fixed bookings total · Fixed bookings in my log · Excludes meals, activities and other spending · Also in my log** | the bookings' card |
| **Daily cost allocation · / day · Fixed bookings normalized over the 29-night stay; motorbike over its 27 rental days. · A day from the fixed bookings: stay $24.42, …** | the day's card: its label, the figure's unit, how it was worked out (no motorbike clause where there is none), and the bar's words for a screen reader |
| **The rest** | over what is not in these numbers |
| **30 days · Day 1 of 30 · Earlier day · Later day** | the journal |
| **The big takeaway** | over the first lesson's lead |
| **Source ↗** | the events band's own word (`SOURCE_LINK`, `src/components/landing/ExperiencesSection.tsx`). That file is a client module, which a server page cannot read a word from: copied once, and held equal by the test |
| **More stops · ← Stop 0 · Stop 2 →** | the two stops' name for a screen reader, and each one's small line |

## Data

Three things the leaves do not hold today.

1. **The motorbike's days**, in the costs leaf: Canggu, 2026-07-03 to 2026-07-30. A rental's days lie inside its stop's stay, and only a paid motorbike has them.
2. **The day**, on a post, or none: its blocks in clock order (each a kind and whole hours, 24 in all) and his two cards. Canggu's, as approved with "focus" for "work":
   - activity 2, meals 1, focus 8, meals 1, entertainment 4, sleep 8;
   - The focus · Temple Stuart · "Product development, marketing, professional services, and building the tools I use to manage the trip."
   - The life · Beyond the laptop · "Training, surf, cafes, local food, sunsets, social experiences, and exploring wherever I happen to be."
3. **The favorite with a photo**, on a post, or none: which line of the short version it is, the day it happened, his words from that day's own entry, and the photo. Canggu's: "Best day"; 2026-07-05; "I’m already planning a trip back just for Uluwatu."; `/was-here/uluwatu-2026-11.jpg`, with that photo's own alt and credit.
   - His words must be found in that day's story, letter for letter. The photo is held to the stop photos' law: on disk, 400 KB at most, 3 : 2 within 1%.
   - That file is also the Uluwatu stop's photo for now ("his photo from a day there during the Canggu stay, until he has one from the stop", `wasHere.ts`). When the Uluwatu stop gets its own photo, this one keeps its file.

The takeaway is the first lesson's lead, by rule. No field holds it.

## Tokens

**Already in the app.** Each is the same name behind the house prefix (`hero-violet-2` is `--ts-hero-violet-2`). Add none.

| Token | Value | Here |
|---|---|---|
| `bg` | `250 248 243` | the cream ground; behind the tabs at 0.92 |
| `border` | `221 214 232` | the line under the tabs, at 0.7 |
| `gold` | `184 134 11` | two parts of a bar and their dots: activity, and the flight in |
| `hero-violet-1` | `#6A33E0` | the band's sweep, end; the bar's entertainment |
| `hero-violet-2` | `#4D1FBC` | what is lit: the tab and the day; the small violet labels and the quotes; the arrows; the total; the focus ring |
| `hero-violet-3` | `#32118A` | the links and the dates; a tab's and a day's words; the band's flat colour |
| `hero-violet-4` | `#210A5E` | the title, the headings and every name; the bar's sleep |
| `hero-ink` | `#FAF8F4` | the band's line |
| `hero-gold` | `#F6C95C` | the focus ring on the band |
| `hero-gold-1` | `255 236 178` | the band's button, start |
| `hero-gold-2` | `248 203 90` | the band's button, 52% |
| `hero-gold-3` | `236 178 62` | the band's button, end |
| `hero-on-gold` | `#2A0F5C` | the words on the band's button |
| `hero-rim-lilac` | `#B9A2FF` | two parts of a bar and their dots: meals, and the motorbike |

**Added by HOME-PLANS-04** (on main as `--ts-fs-*`, the same values). Add none.

| Token | Value | Here |
|---|---|---|
| `fs-white` | `255 255 255` | the cards, the tabs, the buttons; the words on what is lit; the button's top light at 0.75 |
| `fs-gold-text` | `#8A6408` | the eyebrows, each amount paid, a lesson's number, the quote marks |
| `fs-ink` | `#2B2545` | body text; a day's story |
| `fs-ink-soft` | `#4A4560` | the dek, each section's line, the explainers |
| `fs-ink-muted` | `#6F6988` | the small grey labels, the photo credits, n/a and not in my log yet |
| `fs-line` | `#E9E4F2` | a card's border; the rule over a section |
| `fs-rule` | `#EEEAF5` | the rules inside a card; a photo's ground while it loads |
| `fs-chip-line` | `#E4DFF0` | a chip's border; the arrows' border |
| `fs-button-line` | `#CFC6EC` | the quiet buttons' border: a tab, Read that day, the two stops; the rule over the total |
| `fs-band-ring` | `230 220 255` | the band's rings, at 0.08 |
| `fs-shadow` | `33 10 94` | shadows on the cream |
| `fs-band-shadow` | `12 6 44` | the shadow under the band's button |

**Added by HOME-SERVICES-01** (on main as `--ts-ps-*`, the same values). Add none.

| Token | Value | Here |
|---|---|---|
| `ps-field-line` | `#DCD5EC` | a day's border in the calendar |
| `ps-wash` | `#F6F2FE` | the lavender tiles: the short version, the takeaway, his line, what is not counted, a day, a day's chips, the open week |

**New with this page: none.** Three gradients, all the all-three band's own (HOME-PLANS-04): the band's rings and its sweep, and its gold button. The stylesheet types no hex and no rgb value outside `:root`.

Type: Inter 400 / 500 / 600 / 700 and IBM Plex Mono 400 / 500 / 600, both already loaded by `src/app/layout.tsx`.

## Geometry

**Every width**
- The page container: 1280px at most, 16px sides, 32px from 1024px. The head, the tabs' row and the sections all stand in it.
- The head and the photo share a row and wrap: the head is at least 320px, the photo at least 360px and a little wider (1.15 to 1). Title `clamp(34px, 4vw, 56px)` / 1.05 / −0.03em, weight 500.
- A card: white, a 1px line, 20px radius, the house shadow. The journal's box: 24px radius and the larger shadow. A photo's radius 14px, inset 10px.
- A section: a rule over it, `clamp(40px, 4.4vw, 64px)` above the rule and `clamp(36px, 4vw, 56px)` under it. The section directly under the tabs has no rule. A section a tab opens stops 64px under the window's top, clear of the tabs.
- Section heading `clamp(24px, 2.2vw, 32px)` / 1.2, weight 600. Small headings 13px mono, gold.
- The tabs: 44px tall pills, 8px apart, on the cream at 0.92 with a 10px blur and a line under them.
- A bar: 22px tall, parts 3px apart, each part's share its own number (hours, or cents a day).
- The calendar: seven across; a day 44px tall. The arrows 44px round. The takeaway `clamp(26px, 3vw, 42px)`.
- The band: 24px radius; its button 52px tall.

**Under 520px**: the short version is one column; the journal's box has 12px padding and its days are 4px apart, so a day is 44px wide from 390px (42px at 375px, 40px at 360px, 37px at 340px).

**520px and up**: the short version is two columns; the journal's padding is `clamp(18px, 2.3vw, 32px)` and its days 6px apart.

**640px and up**: the four figures stand in one row (two rows of two under it).

**900px and up**: the journal is two columns, the calendar and the weeks on the left (420px at most), the open day on the right. Under it they stack: the calendar, the open day, the weeks. That is also their order in the page.

**1024px and up**: 32px sides; the tabs wrap and no longer scroll; the short version is four columns.

## Behaviour

- **The tabs** are plain links to their sections, so they work with no script. A section is being read once its top is within 160px of the window's top; until the second one is, the first tab is lit. A pressed tab is lit at once. Under 1024px the lit tab comes into view in its row.
- **The journal.** Every day of the post is in the page; one is shown and the rest carry `hidden`. A day's button, a week (it opens its first day) and "Read that day →" each open a day. The week holding the open day is lit. The arrows step one day; at an end an arrow says so (`aria-disabled="true"`), fades to 0.4, keeps the focus, and does nothing when pressed.
- **State**: the open day and the lit tab, in the page's own memory only. Nothing is stored, and nothing is written to the address.
- The keyboard's order through the journal: the days, the two arrows, the weeks.
- Border colours change over 160ms, and at once under `prefers-reduced-motion`.

## Changed since his yes

Board 1 as it stood at 12:52, against this handoff:

1. **"Work" is "Focus"**: the card's label and the bar's key. His ask.
2. **The journal opens on the post's first day.** The board opened on Jul 3.
3. **"Landed Jul 1" is gone** from the flight's row. No leaf holds the day a flight landed, and the stop's first day is not it for every stop (Da Nang's stop starts Jul 30; he landed on the 31st).
4. **"The rest of the month" is "The rest"**: a stop can be one night.
5. **The calendar's head is the post's own dates** ("Jul 1–30, 2026"), where the board said "July 2026": a post can cross a month.
6. **The motorbike's line carries its year**: "27 days · Jul 3–30, 2026", as the one date formatter writes it.
7. **Four small arrows are text**, as the site writes them elsewhere ("Read the post →", "Source ↗"): ← Back to my trip, Source ↗, ← Stop 0, Stop 2 →. The board drew them.
8. **The mark "From your reference · not in the post yet" is gone**: the build puts the day in the post.
9. **The side gutters are the page container's own** (16px, 32px from 1024px), as on every section of the home page. At 1440px and at 390px nothing moves.
10. **The open day's arrows stand at the panel's top right** and its words wrap beside them.
11. **Small mono text is the regular weight** (the photo credits, the figures' sums, the day it was written), as on the stop cards. The board loaded no regular weight and drew them medium.
12. **On a phone the calendar's days are 4px apart** in a box with 12px padding.

## In the reference but not on board 1

Worked out for the states board 1 does not show. Proposals until he has seen them built:

1. **Hover**: a tab's, a day's, an arrow's, "Read that day →"'s and the two stops' borders turn violet; the way back and "Source ↗" turn violet; the band's button brightens. **Focus**: a 2px violet ring, gold on the band.
2. **The lit tab comes into view** in its row under 1024px.
3. **An empty seat** in the calendar for a date with no entry.
4. **A figure in words** ("n/a", "not in my log yet") and "$63.53 total" under it.
5. **"Fixed bookings in my log"**, and the note standing alone where no day's share is drawn.
6. **DID and LEARNED** as white cards beside his line. No stop holds them today.

## Checked

The reference was rendered in Chromium (no other engine) at 1920, 1440, 1280, 1279, 1024, 1023, 900, 899, 820, 768, 640, 639, 520, 519, 430, 390, 375, 360 and 340px wide. At every width, on both pages:
- **The layout.** The page never scrolls sideways; under 1024px the tabs' row does. Nothing passes the window's edge.
- **Size.** Every link and button is at least 44px tall, and at least 44px wide but for the calendar's days under 390px.
- **Every photo** loads and shows at 3 : 2.

Also:
- **Against the canvas.** Both boards are drawn from this stylesheet and this markup. At 1440, 1024, 900, 820, 640, 390 and 360px every element's box, colours and type on each board's page are this file's (823 elements on the written page, 82 on the other). At 1440, 1280, 1024, 820, 640 and 360px the two are the same picture, pixel for pixel, in every run. At 900 and 390px they are the same picture in some runs; in the others the written page differs in one band 15px tall and nowhere else: the tabs' words, in their scrolling row, are smoothed a fraction of a pixel apart.
- **The controls**, pressed in this file and on the board: a day, the arrows to both ends, a week, the tabs, "Read that day →", and the keyboard through the journal.
- **Scripts off.** The markup alone is the page as it opens: the first day shown, 29 hidden, the first tab and the first week lit.
- **Photos blocked.** Every frame holds its space and each page keeps its height.
- **Against the app's base styles.** With Tailwind 3.4.18's preflight loaded ahead of the stylesheet, every element's box, colours and type are as without it, at 1440, 1024, 820 and 390px.
- **Contrast.** Every run of text on both pages is at least 4.5 : 1 on its ground (82 kinds measured; the lowest is the small grey label on lavender, 4.70).
- **Against the repo** at `43ec0d7` (main, 2026-11-23). Both pages are drawn by a script from the leaves themselves, so every word, date and amount on them is the leaf's. The new markup was run against the page's standing tests (`src/lib/__tests__/tripPost01.test.ts` T4) for all ten stops and its Lisbon fixture: every pin holds as written but three, named in the build prompt. The stylesheet was ported into a copy of the repo, directly under the chip strip's rules in `src/app/globals.css`, and the whole suite run: one test that passes on main goes red, the one that pins that seam (`src/lib/__tests__/homeAbout01.test.ts:300`); with that line re-pointed in place, none does.

Not checked: any engine but Chromium, a real phone, a screen reader, and the canvas as its own app shows it.

Five things to know when porting:
- **Other sections' tests read every rule outside their own block.** Write no attribute selector, begin every selector with one of this page's classes, and name no `button` in a selector. The state classes carry the states: `--on`, `--off`, `--none`, `--paid`, `--words`, `--first`, `--foot`, `--alone`.
- **A day is hidden by the `hidden` attribute.** `.post-entry` has no `display` of its own, so nothing overrides it.
- **Three shapes keep the standing tests true.** The photo's `<img>` and `<figcaption>` are the `<figure>`'s only children. A cost row's inner `<div>` carries no attribute. His line's `<p>` holds his words alone: the quote marks are the stylesheet's.
- **A bar's part carries its share on itself** (`style="flex-grow:8"`). It is the page's only inline style.
- **A section's id is a tab's target.** A stop not written up has no tabs and its sections carry no id.
