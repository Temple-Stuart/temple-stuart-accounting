# Temple Stuart — Professional Services, the short view (HOME-TRIM-03) · Handoff

Alex showed the home page to his four beta users and, on 2026-11-14 at 19:11 Manila, asked for a mock-up that answers their notes: "I would like to take this feedback, consider it deeply, review the home page in its current state, and then come up with a mock up to meet the requests of the beta users feedback." Two of the notes, as he pasted them: "Cut the scrolling length of the landing page in half. Make the user explore to find the information behind info pages" · "Make it exploratory. Click to learn more." He approved the boards at 20:01: "ALL LOOKS GOOD … OTHERWISE, LETS DO IT". He approved the corrected boards at 20:41: "thats it!  yeet yeet!"

**What he approved for Professional Services on the home page is its short view: the section's name and its line, the question with its six services, the picked service's name and line with its gold button and its note, and one link under the panel to the whole section.** The picture and the three steps leave the home page. `/professional-services`, which HOME-PAGES-01 built (PR #1986), keeps the whole section, unchanged.

## Files in this handoff

| File | What it is |
|---|---|
| `design-refs/home-trim-03/Section-Reference.html` | **The spec.** Open it in a browser, press the services and resize the window. Its first stylesheet is `design-refs/home-services-01`'s, byte for byte. Its second is what the short view adds: every value in it is the design. Its markup is the page at rest. |
| `design-refs/home-trim-03/README.md` | This file. |

## What changes on the home page

1. **Under the six services, one row:** the picked service's name and line on the left, its gold button and "Scoped by proposal" on the right. It stands where the picture and the steps stood, under the same rule line.
   - **The button** is the same link as today, to the form with the pick: `/work-with-me?need=‹picked›`.
   - **On a narrow window** the button stands under the words. Under 480px it is as wide as the panel and the note stands under it, as today.
2. **Under the panel, one link:** "See how a proposal works →", to `/professional-services`, where the picture and the three steps are.
3. **The picture and the three steps are not drawn** on the home page.
4. **The section's top and foot are the boards'.** At the top: 44px up to 400px wide, 72px from 1400px (today 44px to 80px). At the foot: 44px up to 400px, 64px from 1400px (today 52px to 88px).
5. **The page gets shorter.**

| | Today | Short view |
|---|---|---|
| 1440px wide | 957px | 700px, the same for every service |
| 390px wide | 1,364px with Full setup picked (1,339 to 1,413px by service) | 918px with Full setup picked (893 to 968px by service) |

Today's figures are design-refs/home-services-01's section, rendered here. They were not measured on the live site.

## What stays

- **`/professional-services`.** The whole section, as `src/app/professional-services/page.tsx` mounts it: the picture, the three steps and the button under them.
- **The six services.** The same tiles, words, icons, colours and order. One is always picked, the first at rest, and the pick lives in React state only.
- **The section's look.** Every rule of home-services-01's port stands. The short view adds rules and changes none.
- **The section's hooks.** `id="services"` (`SERVICES_ANCHOR`), `aria-labelledby="ps-title"` and each tile's `data-done-for-you` stay, so the top bar's "Professional Services" link still lands on the section.
- **The picked service's name keeps `aria-live="polite"`,** as the stage's has it, so a screen reader hears the pick change.
- **The form.** It stays on `/work-with-me`. Opening it in place is HOME-SERVICES-02's, which stays parked.
- **The words.** Every one is read from its home (below). Only the link's words are new.

## The words

| On the page | Home |
|---|---|
| Professional Services | `BUILD_PILLAR.heading`, `src/lib/homeActWords.ts` |
| Hands-on services, tailored to your needs. | `BUILD_PILLAR.paragraphs`, `src/lib/homeActWords.ts` |
| What do you need? | `NEED_QUESTION`, `src/lib/proposalNeeds.ts` |
| the six tiles' titles and kinds | `SERVICES`, `src/lib/proposalNeeds.ts`, in its order |
| the picked service's name and line | `serviceDoor(picked)`, `src/lib/proposalNeeds.ts` |
| Send a project proposal → | `PROPOSAL_CTA` to `proposalFormHref(picked)`, `src/lib/proposalNeeds.ts`, as today |
| Scoped by proposal | `SCOPED_BY_PROPOSAL`, `src/lib/proposalNeeds.ts` |
| See how a proposal works → | **New.** One constant in `src/lib/proposalNeeds.ts` beside `SCOPED_BY_PROPOSAL`. The arrow is part of the string. It links to `PROFESSIONAL_SERVICES_PATH`, `src/lib/homePages.ts`. |

The reference's tiles are home-services-01's, with one change to match the live site: each carries its door as `data-done-for-you`, where the reference has `data-need`.

## Tokens

**Already in the app, read by the short view's stylesheet.** Each is the same name behind the house prefix (`fs-rule` is `--ts-fs-rule`). Add none.

| Token | Value | Here |
|---|---|---|
| `fs-rule` | `#EEEAF5` | the line above the picked service |
| `hero-violet-3` | `#32118A` | the link |
| `hero-violet-2` | `#4D1FBC` | the link when it is pointed at |

**New with this section: none.**

## Geometry

The short view's stylesheet, in the order it applies:

- **The section:** top `clamp(44px, 2.8vw + 32.8px, 72px)`, foot `clamp(44px, 2vw + 36px, 64px)`, in place of the inner box's own. Its sides stay as they are.
- **The row under the services:** the same rule line and the same room above and below it as the stage, `clamp(18px, 1.8vw, 24px)` each. Then:
  - the words, `flex: 1 1 420px`;
  - the button with its note, 12px under or 18px beside each other, as the stage's row has them.
  - The two halves are 40px apart in a row and 18px apart when stacked.
  - In these renders the button stands beside the words from 938px and under them below that. The note stands beside the button from 480px.
- **The picked service's name and line** keep the stage's classes and type. From 1024px the line keeps two lines' room, so the panel keeps its height from one service to the next.
- **The link:** under the panel, 16px below it, 44px tall, in the plans' link type: IBM Plex Mono 500, 13px, 0.04em, `hero-violet-3`, turning `hero-violet-2` when pointed at.

## Behaviour

- Pressing a service picks it. Its name and line show under the tiles, and the button's link carries it, as the reference's script shows.
- The link carries no state. `/professional-services` opens at rest.
- Under 1024px the section's height follows the service's line. At 390px it is 893px to 968px.

## In the reference but not on the canvas

- **The widths between 1440px and 390px.** The canvas drew those two. The values between them are the reference's.
- **The top and the foot between the two widths.** The canvas had 72px and 64px, and 44px and 44px. The clamps join them.
- **The link's pointed-at colour.** It is the plans' link's.

## Checked

The reference was rendered in Chromium (no other engine) at 1920, 1440, 1280, 1100, 1024, 1023, 900, 768, 767, 640, 639, 480, 479, 390, 360 and 340px wide, with each of its six services picked by a click. In all 96:

- Nothing scrolls sideways and nothing passes the window's edge.
- The picked tile is the one pressed, and the name, the line and the button's link are that service's.

The widths where the button and the note change rows were found one pixel at a time, from 1440px down to 340px.

**Against the approved boards** (Home · Desktop at 1440px, Home · Phone at 390px), with each service picked: every text run, picture and box is where the board has it, to a thousandth of a pixel, and the two are identical, pixel for pixel, in all twelve pairs.

**Against the repo** at `79948a9` (main, with HOME-TRIM-02 merged):
- The first stylesheet is `design-refs/home-services-01/Section-Reference.html`'s, byte for byte, and so is the font link.
- Every word in the markup is in `homeActWords.ts` or `proposalNeeds.ts`. "See how a proposal works →" is the one new string.
- The three tokens are in `globals.css` under the house prefix, with these values.

**Not checked:**
- Any engine but Chromium, a real phone, or a screen reader.
- The site's own font files. Inter was installed on the build machine. IBM Plex Mono was not, so the mono text (the kinds, the note, the link) was drawn by the system monospace, on the boards and here alike.
- The arrows. "→" is not in the latin subset the site serves, so on the site a fallback face draws it, as it already draws "Send a project proposal →". A later PR in this series fixes every arrow at once.

## When porting

- **Port only the second stylesheet,** behind the house prefix: `.ps--short` becomes `.ts-ps--short`, and `.ps-brief`, `.ps-brief__text`, `.ps-brief__go` and `.ps-how` become `.ts-ps-…`. The family becomes `var(--font-mono)`, as the port's other mono rules have it.
- **Its rules join the section's port.** They name the section's classes, and `homeServices01.test.ts` holds that no rule outside the port names one. The port's test names them as a fifth difference from home-services-01.
- **They come after the port's last rule,** as the second stylesheet comes after the first.
- **The first stylesheet is not ported again.** It is on main as the `.ts-ps…` port. Its form's rules are HOME-SERVICES-02's and stay unported.
- **The name and the line keep the stage's classes** (`.ts-ps-stage__title`, `.ts-ps-stage__line`) outside the stage. Their rules are not scoped to it.
- **The link's class is `ps-how`.** `ps-more` is taken: it is the form's "Project details" button in home-services-01.
