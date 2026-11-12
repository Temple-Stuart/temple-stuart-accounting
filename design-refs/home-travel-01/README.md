# Temple Stuart — Travel Marketplace section (HOME-TRAVEL-01) · Handoff

Approved by Alex on the design canvas, 2026-11-12. His brief (16:08 Manila): "this one is basically set, not much to change, just need to match astehetics of the site to make it follow along... also with the events, it would be cool if someone selects events, they add to a queue table below the search bar, so the person who adds them can see them for review to like aid in booking flights and stuff.... the see what they wanna do when it is, so they know dates they need to filter for flights and stuff, to build around the events." His approval (20:26): "ok I approve the travel market place".

The third pillar keeps every part it has and all of its wiring. It takes the look of the two pillars above it, and the guest's events join the trip under the box, in date order, with the days between them.

## Files in this handoff

| File | What it is |
|---|---|
| `design-refs/home-travel-01/Section-Reference.html` | **The spec.** Open it in a browser. Pick a category, press Add to trip, open the tabs, press Stay near it → and Search flights →, remove an event, resize the window. Every value in its stylesheet is the design, and its markup is the page as it opens (the board Alex approved). The bar above the section is the page's own: it sets the four states. The dashed frames stand where each tab's search sits today. |
| `design-refs/home-travel-01/README.md` | This file. |

## What changes

Top to bottom, as the reference draws it:

1. **The section** is a full-width cream band with the page container inside it (1280px at most, 16px sides, 32px from 1024px) and its bottom line, like the two pillars above it. Today the section itself is the container (`max-w-7xl mx-auto px-4 lg:px-8 py-10 border-b`).
2. **Travel Marketplace** and its line, at the pillars' size. The h2 keeps `id={DEMO_ANCHOR}`.
3. **The box**: one white card with a 24px radius and a soft shadow. It holds:
   - **The eight tabs as tiles**: the mode's icon over its label, and "Soon" under the two coming-soon labels. Four columns under 768px, eight from 768px, every tile the same height. The open tab is filled violet. A coming-soon tab is grey until it is open. This look is the landing's own. The app's travel tab keeps `ToggleStrip` and `DS.iconTab` exactly as they are.
   - **One rule**, then the open tab's panel.
   - **Events**: "I'M INTO…", the dropdown, then COMING UP (or WHEN TO GO) and the rows. Each row has its dates on the left. Then the series, the name, the place and the note, then **+ Add to trip** and Stay near it →. Then "Checked …" and Source ↗. Then the closing line.
   - **Every other tab** opens with its mode's headline (`headline` in travelStripModes.tsx), then the stay line (Hotels, after Stay near it →), then the panel as it is today, then the disclosure (the four that pay).
4. **The trip.** "Your trip so far" moves into the section, directly under the box and above the lookup, and holds the guest's events as well as their bookings:
   - its eyebrow, then the summary ("3 events · Jan 17 – Mar 14, 2027"), and the gold **Search flights →** on the right (full width under 480px);
   - the events by date, each with its dates, name, city and country, Stay near it → and a round × that removes it, and between two dated events the days between them;
   - then the guest's bookings (BOOK-3's records) and the Total;
   - then the pitch and Create free account.
5. **The lookup**: the same fields, words and behaviour in the new look (fields 46px with a 12px radius, Look up as the quiet pill). Its look is the component's own, so `/booking/manage` takes it too.

What leaves the landing:
- the strip's grey card (`rounded-lg border border-border bg-white p-4`);
- the explainer line `ToggleStrip` draws under its tabs (the headline opening each panel says it, shorter; the app's strip keeps it);
- `GuestTripStrip`'s own full-width band below the section (it is now the card inside it);
- the lookup's filled purple button. **Look up wore `PRIMARY_CTA` by Alex's ruling of 2026-11-08 (HOME-FINISH-01: "like lookup, purple"). The board makes it the quiet pill, beside Create free account.** The PR says so in its body, and `buttons01.test.ts` changes its pin for the lookup with this approval cited.

## What stays

- Every panel's content and wiring: the five searches, the visa check and the two coming-soon panels. They stay mounted and hidden when closed, so a search's dates and results survive a tab change, as now.
- The open tab, held in `LandingBookingSection`'s React state. Stay near it → still opens Hotels with the event's place and never a date, and still brings the box into view. `?into=` stays the one filter. The disclosure and the four panels it closes stay as they are.
- `id={DEMO_ANCHOR}` on the h2, `id="events"` on the Events panel, `data-guest-lookup-home`, and every `data-*` hook a test reads.

## The trip: the rules

- **One trip.** The events join the guest trip: the same store (`src/lib/guestTrip.ts`, sessionStorage by BOOK-3's ruling), the same tab session, the same update signal. The card's own words already say "This trip lives in your browser". BOOK-3's header ("writers fire solely on guest booking successes") gains the event writers, dated.
- **An event's record holds its catalog id, and nothing else from the catalog.** Its words and dates are read from `src/lib/experiences.ts` when the card renders, so a deploy that corrects a date corrects every trip.
- **Where.** In the travel section, under the box, above the lookup, on every tab. It renders when the trip holds an event or a booking. With neither, nothing renders, as BOOK-3 does today.
- **Order.** Events with dates go first, by start date (ties keep the order added). Then events without dates, in the order added. Then the bookings, as today, and the Total row or rows (one per currency, as today).
- **Between two dated events in a row**, count the days strictly between the first's end and the second's start: "{n} days between", "1 day between", or "Back to back" at 0. If the second starts on or before the first ends, the line is "Overlaps the one above", in gold. Count days from the date strings' own parts, never `Date`, as `experienceWords.ts` does for weekdays (the reference's `dayNumber`).
- **The summary.** Take the dated events: "{n} event" or "{n} events", then " · ", then `dateWords(first start, latest end)`. When no event has dates, "dates not announced yet" follows the dot. The summary and the gold button show only when the trip holds an event. Bookings alone get the card as today: eyebrow, rows, Total, pitch, button.
- **An event's dates** are the dated part of the panel's line, without its source:
  - the dates, with "Window " or "Season " before them as the line has it;
  - `usualWindowWords` for a usual season ("Usually Nov – May");
  - "Not announced yet" where the panel's line says not announced. That covers a row with no dates, and one whose window has closed by `today`.

  One function beside `experienceWindowLine` should give this window part, and both should read it, so the line and the card never drift.
- **Its place** is "{city}, {country}". A city that is not fixed prints the leaf's own mark ("—, USA"), as the panel's place line does. No special case.
- **Stay near it →** shows where `canStayNear` is true. It is the panel row's action, unchanged.
- **Remove** is a round × with `aria-label` "Remove {name}".
- **Search flights →** opens Flights and brings the box into view, exactly as Stay near it → does with Hotels. It fills nothing: no airport and no date. Alex, 2026-11-09: "would be cool if that populated destination but like user gonna wanna pick their own travel dates".
- **Add to trip** and **In your trip** are one button that flips. Pressing In your trip takes the event out again. Its words say its state, so it carries no `aria-pressed`. The summary is `aria-live="polite"`.
- **Focus.** Add keeps the focus on the pressed button. Remove moves it to the next event's ×. If there is none, it goes to the one before. If the trip has no event left, it goes to the open tab.

## Before writing any of these, ask Alex (no fallback without his yes)

1. **An id the catalog no longer holds.** A deploy may remove or rename an event while a guest's tab holds it. Don't drop it silently and don't substitute for it. Propose the options in the audit and ask.
2. **A write the storage refuses** (private mode, quota). `addGuestTripRecord` swallows that for bookings ("Never block the booking"). For an event, a swallowed write means Add to trip shows nothing. Propose the options in the audit and ask.
3. **Signup carrying the trip** is out of scope. Report what a guest's trip does at signup today. Don't build it.

## Words

Every word is read from its home. None is typed in a component.

| On the page | Home |
|---|---|
| Live demo — travel | the section's aria-label, typed in src/components/landing/Landing.tsx |
| Travel Marketplace | EXPLORE_PILLAR.heading, src/lib/homeActWords.ts |
| Discover events and experiences worth traveling for, find flights and places to stay, and book the journey that gets you there. | EXPLORE_PILLAR.paragraphs, src/lib/homeActWords.ts |
| Soon | SOON_BADGE, src/components/trips/travelStripModes.tsx |
| I'M INTO… | INTO_LABEL, src/components/landing/ExperiencesSection.tsx |
| Select a category | SELECT_CATEGORY, ExperiencesSection.tsx |
| COMING UP | COMING_UP_LABEL, ExperiencesSection.tsx |
| WHEN TO GO | WHEN_TO_GO_LABEL, ExperiencesSection.tsx |
| Source ↗ | SOURCE_LINK, ExperiencesSection.tsx |
| Tickets are sold by the events, not here. | CLOSING_LINE, ExperiencesSection.tsx |
| Each window comes from the place's own source, with the day it was checked. Usual months are a guide, not set dates. | SEASONS_CLOSING_LINE, ExperiencesSection.tsx |
| Book the experience | the Events panel's aria-label, typed in ExperiencesSection.tsx |
| Stay near it → | STAY_NEAR_WORDS, src/lib/experienceWords.ts |
| When you book here, I may earn a commission. | COMMISSION_LINE, src/lib/disclosureWords.ts |
| Your trip so far | typed in src/components/landing/GuestTripStrip.tsx |
| This trip lives in your browser — create a free account to save it, budget it, and map it to your runway. | typed in GuestTripStrip.tsx |
| Create free account | typed in GuestTripStrip.tsx |
| Total | typed in GuestTripStrip.tsx |
| Booked without an account? Look up your booking | typed in src/components/guest/GuestBookingLookup.tsx |
| Manage reference | typed in GuestBookingLookup.tsx |
| Manage code | typed in GuestBookingLookup.tsx |
| Look up | typed in GuestBookingLookup.tsx |
| Your reference and manage code are in your booking email. | typed in GuestBookingLookup.tsx |
| We couldn't open a booking with that reference and code. | GUEST_WORDS.notOpened, src/lib/guest/guestSession.ts (the lookup shows the route's error) |
| the tab labels and headlines | `travelStripModes.tsx`, each mode's `label` and `headline` |
| the categories, and each row's series, name, venue, city, country and notes | `EXPERIENCE_CATEGORIES` and `EXPERIENCES`, `src/lib/experiences.ts` |
| each row's line · the stay line | `experienceLine()` · `stayNearLine()`, `src/lib/experienceWords.ts` |
| Nothing announced yet in {category} — the list below says when each one was checked. | nothingUpcoming(), ExperiencesSection.tsx |
| {value} is not a category — pick one above. | notACategory(), ExperiencesSection.tsx |
| Checked {day} | checkedWords(), ExperiencesSection.tsx |

**New** (the homes are proposals; the audit confirms them):

| Words | Proposed home |
|---|---|
| `Add to trip` · `In your trip` | `src/lib/experienceWords.ts`, beside `STAY_NEAR_WORDS` |
| `Search flights →` · `{n} event` / `{n} events` · `dates not announced yet` · `{n} days between` · `1 day between` · `Back to back` · `Overlaps the one above` · `Remove {name}` · `Not announced yet` | one pure words leaf for the trip (e.g. `src/lib/guestTripWords.ts`). The four words `GuestTripStrip.tsx` types today move there too: Your trip so far, the pitch, Create free account, Total. |
| the trip's date words | one function beside `experienceWindowLine` (see above) |

## Data

- **The catalog**: `src/lib/experiences.ts`, unchanged, drawn as the panel draws it today.
- **today**: the server's UTC day, computed once (`src/app/page.tsx`) and passed down as now. The card reads it too.
- **The trip**: see the rules.
- **The script's catalog** is a copy of the leaf as of 2026-11-12 (171 rows, 26 categories), run through `experienceWords.ts`, so the file works on its own. Never copy it.
- **The bar's "sample guest booking"** (`MNL → MEL`, `K7Q2PX`, USD 412.00) is invented, to show a booked row's look. It is not data.

## Tokens

**Already in the app.** Each is the same name behind the house prefix (`hero-violet-2` is `--ts-hero-violet-2`). Add none.

| Token | Value | Here |
|---|---|---|
| `bg` | `250 248 243` | the cream ground |
| `border` | `221 214 232` | the line under the section; the border of the dropdown and the lookup's two fields, the house's own field line |
| `red` | `197 48 48` | the lookup's failure line |
| `hero-violet-2` | `#4D1FBC` | the open tab; the icons; In your trip; the stay line's rule; the focus ring |
| `hero-violet-3` | `#32118A` | the events' dates; the links; Add to trip; the quiet buttons' words |
| `hero-violet-4` | `#210A5E` | the heading, the panel headlines, the event names, the trip summary, the lookup legend |
| `hero-gold-1` | `255 236 178` | the gold button, start |
| `hero-gold-2` | `248 203 90` | the gold button, 52% |
| `hero-gold-3` | `236 178 62` | the gold button, end |
| `hero-on-gold` | `#2A0F5C` | ink on the gold button |

**Added by HOME-PLANS-04** (on main since PR #1971 as `--ts-fs-*`, the same values). Add none.

| Token | Value | Here |
|---|---|---|
| `fs-white` | `255 255 255` | the box, the tabs, the trip, the buttons and fields; text on violet; the gold button's top light at 0.75 |
| `fs-ink` | `#2B2545` | body text; the stay line; the lookup's labels and what is typed |
| `fs-ink-soft` | `#4A4560` | the lede, the panel's labels, an event's place, the disclosure, the trip's pitch, the total's label |
| `fs-ink-muted` | `#6F6988` | series, notes, Checked; a Soon tab; the gaps; a booking's kind and code; the closing line; the lookup's hint |
| `fs-gold-text` | `#8A6408` | Your trip so far; an overlap; amounts |
| `fs-line` | `#E9E4F2` | the box's and the trip's border; the rule over the lookup |
| `fs-rule` | `#EEEAF5` | the rules inside them |
| `fs-chip-line` | `#E4DFF0` | a tab's border; the remove button's border |
| `fs-button-line` | `#CFC6EC` | Add to trip's border; the quiet buttons' border |
| `fs-band-muted` | `#D6CCF7` | Soon on the open tab |
| `fs-shadow` | `33 10 94` | shadows on the cream: hero-violet-4 as channels |

**New with this section: none.**

- The dropdown and the lookup's fields wear the house's own field line, `--ts-border`. HOME-SERVICES-01's `ps-field-line` (#DCD5EC) is a hair darker. This PR doesn't use it, so it never waits on that one.
- There is one gradient: the gold button. It uses the hero's three golds at 135deg, stops 0 / 52 / 100%, as HOME-PLANS-04's does, with `hero-gold-2` under it.
- The stylesheet types no hex and no rgb value outside `:root`.
- Type: Inter 400 / 500 / 600 and IBM Plex Mono 500 / 600, both already loaded by `src/app/layout.tsx`.

## Geometry

**Every width**
- Page container: 1280px at most, 16px sides (32px from 1024px). Down the section: `clamp(44px, 5.6vw, 80px)` above the heading · 16px to the line · `clamp(24px, 2.8vw, 40px)` to the box · 20px to the trip · `clamp(28px, 3vw, 40px)` to the lookup's rule and `clamp(22px, 2.4vw, 28px)` under it · `clamp(52px, 6.2vw, 88px)` to the bottom line.
- Heading `clamp(34px, 4vw, 56px)` / 1.05 / −0.03em, weight 500. Line `clamp(16px, 1.4vw, 19px)` / 1.55, 640px wide at most.
- Box: 24px radius, padding `clamp(18px, 2.3vw, 32px)`. Tabs `clamp(5px, 0.8vw, 10px)` apart, at least `clamp(76px, 6vw, 86px)` tall, 14px radius; icon 22px; label `clamp(11.5px, 0.3vw + 10.5px, 13px)`; Soon 10px mono. The rule `clamp(18px, 1.8vw, 24px)` under the tabs, and the same again under it.
- Dropdown: 46px tall, 340px wide at most, 12px radius, 16px chevron 14px from its right edge.
- Rows: 18px above and below, a hairline between. Dates 13px mono. Name 16px; place 14px; note 13px. Add to trip is a pill (1.5px border). The links are 13px mono, 44px tall.
- Trip: 20px radius, padding `clamp(18px, 2.2vw, 28px)`. Eyebrow 13px mono; summary `clamp(19px, 1.7vw, 24px)`. Gold button 48px. Rows 14px above and below; the gap lines 6px. × is round. Create free account is 44px.
- Lookup: fields 46px with a 12px radius, 760px across at most; Look up 46px.

**Under 480px**: the gold button and Look up are full width.

**768px and up**: eight tab columns; a row's dates stand beside it (250px), and the trip's (200px).

**1024px and up**: Add to trip and × are 36px tall. Under 1024px they are 44px, the house's touch height. The links are 44px at every width, as the Source link is today.

## Behaviour

- **State.** The open tab and the stay line live in React state, as now. The category lives in `?into=`, as now. The trip lives in the guest trip, sessionStorage.
- **The trip renders after mount.** It reads storage in an effect, as `GuestTripStrip` does, so the server's HTML holds no trip and hydration stays safe. The Add buttons' state comes from the same read.
- **Colours** change over 160ms, and at once under `prefers-reduced-motion`.
- **Scrolling.** The box comes into view with `scrollIntoView()`, as Stay near it → does today, with 24px of cream above it.

## In the reference but not on the canvas

Alex approved the 1440 and 390 boards and the Flights board. The reference works these out as well, and they are proposals until he has seen them built:

1. **Pointer and keyboard.** On hover, a tab's border, Add to trip's, the quiet buttons' and the dropdown's turn violet. A link turns violet and underlines. × turns violet, and the gold button brightens. Focus is a 2px violet ring.
2. **Between the boards.** The tabs go to eight columns, and the dates go beside the rows, at 768px. The boards switched at 860px and 760px of their own width.
3. **Touch heights.** Below 1024px, Add to trip and × are 44px, and the links are 44px at every width. The boards drew 36px.
4. **A guest booking in the card**: its kind, its name over its code, and its amount beside them, then the Total. The boards drew events only.
5. **Bookings alone**: no summary and no gold button.
6. **The refused `?into=` line, the lookup's failure line**, and the fields' look while disabled.
7. **Where focus goes on remove.**

Three things differ from the boards on purpose:
- The side gutters are the page container's own.
- The section keeps the bottom line every section on the page has.
- The fields wear the house's field line (#DDD6E8), where the board drew #DCD5EC.

## Checked

The reference was rendered in Chromium (no other engine) at 1920, 1440, 1280, 1279, 1024, 1023, 900, 860, 859, 768, 767, 640, 480, 479, 430, 390, 360 and 340px wide. At every width:
- **As it opens (the board).**
  - Nothing scrolls sideways, no box passes the window's edge, and nothing is cut off.
  - The tabs are one height, in eight columns from 768px and four below.
  - The dates stand beside the rows from 768px.
  - The trip is Australian Open, Sapporo Snow Festival and Bahrain GP, with "3 days between" and "28 days between", and "3 events · Jan 17 – Mar 14, 2027".
- **All 26 categories, picked in turn.** Each one's rows are in the catalog's order, with its label, its nothing-yet line where the panel draws one, and its closing line, and nothing spills.
- **Adding, by keyboard.** Each set was checked against expectations worked out by the check itself, with `Date.UTC` (the page uses its own day count): an overlapping pair, a back-to-back pair, a pair one day apart, a pair several days apart, an undated event with a usual season and a dated pair, an undated event alone, and an event whose city is not fixed. In each set:
  - the focus stays on the pressed button, and its words change;
  - the order, the gap words, the gold mark on an overlap, the summary, the dates, the places and the Stay near links are as expected;
  - In your trip takes the event out again.
- **Removing.** The focus goes to the next ×, then the one before, then the open tab, and the card goes when the trip is empty.
- **Stay near it →**, from the panel and from the card, opens Hotels with the event's stay line, and the box's top lands within 30px of the window's top. **Search flights →** opens Flights the same way. Every tab shows its own panel alone, the trip stays under the box, and Space on a tab opens it.
- **The sample booking.** Kind, name, code and USD 412.00 stand beside the name, then the Total. Removing the three events leaves the bookings alone, with no summary and no gold button.
- **The refused line** reads "skiing is not a category — pick one above.", with the closing line. **The lookup's failure line** shows on Look up.
- **Size.** Every control is at least its size: 44px below 1024px for Add to trip and ×, 36px from 1024px, the gold button 48px, the fields 46px.

Also:
- **Against the app's base styles.** With Tailwind 3.4.18's preflight loaded ahead of the stylesheet, every check above passes. 22 screenshots (1440, 1024, 768 and 390px; the board, at rest, the seasons, Hotels, Flights, the sample booking) are identical, pixel for pixel, to the file as shipped.
- **Scripts off.** The file's markup is the painted page: the same markup, and an identical screenshot.
- **Against the canvas.** At 1440px the section is 2269px tall, against the board's 2233px. At 390px it is 3257px, against 3162px. The differences are the 44px links (and, on phones, the 44px Add and ×) and the bottom line.
- **Against the repo** at `ca3fdc7`:
  - the 24 words above, the three patterns, the eight tabs' labels and headlines, and the 26 categories are their homes' own;
  - the script's catalog is drawn from `experiences.ts` and `experienceWords.ts`, which are byte for byte the repo's.
- **Contrast.** Every line of text is at least 4.5 : 1 on its ground; the lowest is the lookup's hint on the cream (4.88). The icons are 9.38 : 1, and 5.18 on a coming-soon tab.
- **Keyboard order.** The eight tabs, then the dropdown, then each row's Add to trip, Stay near it → and Source ↗. Then Search flights →, each event's Stay near it → and ×, and Create free account. Then the lookup's two fields and Look up.

Not checked: any engine but Chromium, a real phone, a screen reader.

Five things to know when porting:
- One rule hides what the section hides: `.tm [hidden] { display: none }`. Without it, every block that sets its own display would show what is meant to be hidden.
- One rule between the tabs and the panel. A panel that opens with its own hairline (the Events panel's `mt-6 border-t border-border pt-6`, `EXP.panel`) draws none inside this box.
- The tab's icon is the mode's own node; this look draws it at 22px. The app's strip keeps 20px.
- The gold button has `hero-gold-2` under its gradient, so the button's default face never tints its edges.
- The lookup's rules stand on their own: `/booking/manage` draws it outside the section, so its form carries its own focus ring and hiding rule (`.tm-lookup__form`).
