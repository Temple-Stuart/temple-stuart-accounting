# Temple Stuart — the top bar's menu (HOME-MENU-01) · Handoff

Alex approved the menu's two boards on the design canvas on 2026-11-14 at 20:01 Manila, with the shorter home page's boards, and the corrected set at 20:41. On 2026-11-16 at 00:52 he chose where each item goes (the table below).

**What he approved is one menu for the whole site.** The bar's three pillar names, and About Us beside Pricing, each carry a caret. Any of the four opens one panel under the pill, with everything the site offers in four columns. On a phone the same four names are the menu's first rows, and each opens its own list.

## Files in this handoff

| File | What it is |
|---|---|
| `design-refs/home-menu-01/Menu-Reference.html` | **The spec.** Open it in a browser from inside the repo: it reads three files under `public/brand/`. From 1024px press any name with a caret. In a narrower window press the menu button, then any row. It shows the bar twice, as glass over the hero and filled on a plain page. Its first stylesheet is `design-refs/hero-crest-01`'s, byte for byte, and so is everything on the page but the two bars. Its second stylesheet is what this change adds: every value in it is the design. |
| `design-refs/home-menu-01/README.md` | This file. |

## What changes

1. **From 1024px the bar reads** Financial Software ⌄ | Professional Services ⌄ | Travel Marketplace ⌄, then About Us ⌄ · Pricing · Log in.
   - The four names with a caret are buttons. They no longer land on the home page's sections.
   - About Us is new in the bar. It stands first in the account group, before Pricing.
2. **Any of the four opens the panel:** one panel, 10px under the pill and as wide as it is, in four columns. Each column is headed by its name in gold mono capitals.
   - **Financial Software:** the four plans, each with who it is for, then "Compare all four plans →".
   - **Professional Services:** the six services, each with its kind (Project or Monthly) at its right.
   - **Travel Marketplace:** Events and the five travel tabs, then "Look up your booking →".
   - **About Us:** About Us, Our Story, the 14 steps, Pricing, and the code, which leaves the site.
3. **Under 1024px the menu button opens the menu, as today,** and draws a cross while it is open. The menu's first four rows are the four names, each with a caret, and a row opens its list under it. Then come the rule, Pricing and Log in, as today.

## Where each item goes

Alex's choice, 2026-11-16 00:52 Manila.

| Item | Goes to | Home of the destination |
|---|---|---|
| The four plans | `/financial-software` | `FINANCIAL_SOFTWARE_PATH`, `src/lib/homePages.ts` |
| Compare all four plans → | `/pricing` | `COMPARE_PLANS_PATH`, `src/lib/howTo.ts` |
| Each service | the proposal form with it picked: `/work-with-me?need=<its need>` | `proposalFormHref`, `src/lib/proposalNeeds.ts` |
| Events | `/#events` | `EVENTS_ANCHOR`, `src/lib/homeAnchors.ts` |
| Flights, Hotels, Getting around, Things to do, Visa | `/#demo` | `DEMO_ANCHOR`, `src/lib/homeAnchors.ts` |
| Look up your booking → | `/booking/manage` | new |
| About Us | `/about` | `ABOUT_PATH`, `src/lib/homePages.ts` |
| Our Story | `/#my-trip` | `MY_TRIP_ANCHOR`, `src/lib/homeAnchors.ts` |
| How It All Connects: The 14 Steps | `/how-it-works` | `PIPELINE_PATH`, `src/components/landing/pipelineWords.ts` |
| Pricing | `/how-pricing-works` | `BAR_PRICING`, `src/components/landing/LandingHeader.tsx` |
| Built in Public: The Code | the repository on GitHub, in a new tab (`rel="noopener noreferrer"`) | `CODE_URL`, `src/lib/footerWords.ts` |
| The four names in the bar | open the menu | — |

## The words

Every word is copied into the reference for placement only. Each has a home in the app, and production types none of them a second time unless the brief says so.

| On the page | Home |
|---|---|
| Financial Software · Professional Services · Travel Marketplace | the pillars' headings: `PLAN_PILLAR`, `BUILD_PILLAR`, `EXPLORE_PILLAR`, `src/lib/homeActWords.ts` |
| About Us · Our Story | `ABOUT_US_HEADING`, `OUR_STORY_HEADING`, `src/lib/homeActWords.ts` |
| Personal … Personal + Business + Trading, and who each is for | `PLANS` (each plan's `name` and `audience`), `src/lib/offer/plans.ts` |
| Compare all four plans → | `COMPARE_PLANS_WORDS`, `src/lib/howTo.ts` |
| Full setup … Something else | `SERVICES` (each service's `title`), `src/lib/proposalNeeds.ts` |
| Project · Monthly | `SERVICE_KINDS`, read through each service's `kind`, `src/lib/proposalNeeds.ts`. Something else has no kind. |
| Events · Flights · Hotels · Getting around · Things to do · Visa | the travel tabs' labels by their keys (`events`, `flights`, `hotels`, `transit`, `activities`, `visa`), `src/components/trips/travelStripModes.tsx` |
| Look up your booking → | **New:** the one new word. The arrow is part of the string, as in "Compare all four plans →". |
| How It All Connects: The 14 Steps · Built in Public: The Code | `FOOTER_RECORD_LINKS`, its first two labels, `src/lib/footerWords.ts` |
| Pricing · Log in | as today: `BAR_PRICING`, and Log in as the bar writes it |

## Tokens

**Already in the app.** Each has the same name behind the house prefix (`hero-gold` is `--ts-hero-gold`). Add none.

| Token | Here |
|---|---|
| `hero-ink-nav` | the four names, as the bar's links are inked today |
| `hero-ink` | the panel's links, and the links in an open list |
| `hero-gold` | the column names; a name pointed at |
| `hero-rim-lilac` | the foot links ("Compare all four plans →", "Look up your booking →") and the outward arrow |
| `glass-line` | the panel's line |

**New with this change: none.** No gradient.

**Typed as colours,** as hero-crest-01's stylesheet types its own:
- `rgb(33 11 92 / 0.95)` is the panel's fill: `hero-well` at 95%, as the phone menu's panel is `hero-well` at 86%.
- `rgb(12 6 44 / 0.45)` is the panel's shadow, in the shadow ink the bar already uses.
- `rgb(255 255 255 / 0.72)` is who a plan is for, and a service's kind.
- `rgb(255 255 255 / 0.08)` is an open list's ground on the phone.

Type: Inter, and IBM Plex Mono for the column names, the kinds and the foot links, as the bar's Log in has it.

## Geometry

- **A name in the bar:** the bar's links' look (15px, 500, 12px above and below). Its caret is 12px at 85% opacity, 6px after the name.
- **The panel:**
  - It stands 10px under the pill. It is inset 32px each side, as the bar is, and at most 1216px wide, centred, so its edges meet the pill's.
  - It has a 1px line, 26px corners, the bar's blur, and 28px of padding above, 32px at the sides and 22px below.
  - Its four columns are 1.3fr, 1fr, 1fr and 1.15fr, 40px apart.
  - At 1440px it is 1216 × 424px, and its columns are 301, 231, 231 and 266px wide.
- **A column:**
  - Its name: IBM Plex Mono 12px / 1.3, 600, 0.14em apart, capitals, gold, 8px above the first link.
  - A link: Inter 15px / 1.35, 500, at least 50px tall with 3px above and below its words.
  - Under a plan's name, who it is for: 13px / 1.4, 400.
  - At a service's right, its kind: IBM Plex Mono 10.5px / 1.3, 600, 0.12em apart, capitals, at least 12px from the name.
  - Its foot link: IBM Plex Mono 13px / 1.3, 500, 0.04em apart, lilac, at least 44px tall, 4px below the last link.
  - The outward arrow: 12px, lilac, 6px after the words.
- **From 1280px** About Us joins the account group, which keeps 24px between its three (hero-crest-01 keeps 26px between its two).
- **From 1024px to 1279px** the bar is tighter than hero-crest-01's own values in that range, so that the carets and About Us fit:
  - the pill's gap 12px; 8px either side of the rules between the names, which start 16px after the wordmark; the account group 14px apart;
  - a caret 4px after its name; Log in 16px at each side; the wordmark 0.14em apart.
  - At 1024px the row keeps 2px to spare.
  - The panel there: 24px of padding above and at the sides, 20px below, and its columns 28px apart. The column names are 0.1em apart and the links 14px, and a service's kind may take a second line.
  - At 1024px the panel is 960 × 418px, and its columns are 241, 186, 186 and 213px wide.
- **What wraps:** "For founders, freelancers and small business owners." takes two lines at every width, as on the board. Below 1072px "How It All Connects: The 14 Steps" takes two, and below about 1120px Monthly maintenance's kind stands under its name. Nothing else wraps.
- **The phone menu** is hero-crest-01's panel. Its rows are 48px tall, and each name's caret stands at the row's right.
  - **An open list:** 6px under its row, inset 6px, on a ground of white at 8%, with 14px corners and 6px of padding above and below.
  - **Its links:** 44px tall, 14px in, Inter 15px, 500. Its foot link is IBM Plex Mono 13px, 0.04em apart, lilac.
  - **Heights at 390px:** 331px closed; 569px with Financial Software or About Us open; 613px with Professional Services; 657px with Travel Marketplace, the tallest.
- **Under 1024px the panel is never drawn.**

## Behaviour

- **The four names are buttons.**
  - Each says whether the panel is open (`aria-expanded`) and names it (`aria-controls`).
  - Any of them opens the panel. The name pressed last closes it, and another name pressed while it is open leaves it open.
  - Enter and Space press a name.
- **The panel closes** on a press of any link in it, on Escape, and on a press anywhere outside it and the four names. A press inside it, off a link, leaves it open.
  - Escape returns focus to the name that opened it, when focus was inside the panel.
- **The keyboard's order:** the four names, Pricing and Log in, then the panel's links, column by column. The panel follows the pill in the page's order.
- **The phone menu:**
  - The menu button opens and closes it as today. It reads "Close menu" while it is open and draws a cross; closed, it draws its two bars.
  - Each row says whether its list is open and names the list. A row opens its list and closes the one that was open, and an open row closes its own.
  - The menu closes on a link, on Log in, on Escape and on its button, as today. Escape returns focus to the button, when focus was inside the menu.
- **One list at a time** keeps the open menu inside the hero. The hero clips what overflows it, and with any list open the menu ends at least 133px above the hero's foot, at every width from 340px to 1023px.
- **Nothing is stored and nothing goes in the URL.** A reload starts closed.
- **No motion.**

## In the reference but not on the canvas

- **The widths between 1440px and 390px,** and the tighter bar from 1024px to 1279px. The canvas drew 1440px and 390px.
- **The arrow after "Built in Public: The Code".** The canvas typed "↗". The reference draws the hero's own outward arrow (its "Clone it on GitHub"), 12px and lilac.
- **A name pointed at** (gold) **and focused** (hero-crest-01's ring: 2px solid `hero-gold`, 3px off).
- **The behaviour above.** The canvas drew the panel open and the phone menu open with one list.

## Checked

The reference was rendered in Chromium only, with Inter and IBM Plex Mono installed (IBM Plex Mono 2.5.0, `@ibm/plex-mono`), so the mono was measured in the site's face.

- **The bar:** at 1920, 1440, 1280, 1279, 1200, 1150, 1100, 1060, 1040, 1030 and 1024px, closed. Nothing passes the pill's content edge.
- **The panel:** at 1920, 1440, 1280, 1279, 1200, 1100 and 1024px, open. No column overflows, and only the two lines above wrap.
- **The phone menu:** at 340, 360, 375, 390, 414, 430, 600, 768, 820 and 1023px wide, each at 640, 844 and 1024px tall, with each list open in turn. Nothing scrolls sideways, and the menu ends inside the hero.
- **Against the canvas.** At 1440px the panel, and every column name, link and foot link in it, stand where the approved board draws them, box for box. At 390px the open menu, with Financial Software's list open, stands where its board draws it, box for box.
- **Against the app's base styles.** Tailwind 3.4.18's preflight was loaded ahead of the stylesheets, with hero-crest-01's port's `line-height: normal` on the band and the bar. Under it these are identical to the file as shipped, pixel for pixel:
  - the panel at 1440px and 1024px, in both bars;
  - the filled pill at 1440px and 1024px;
  - the filled bar's phone menu at 390px, with each list open.
- **The two bars alike.** The glass bar and the filled bar draw their menus box for box and style for style. The one difference is Log in, a button in one and a link in the other, as hero-crest-01 has it.
- **The behaviour,** by mouse and keyboard, every rule above.

**Not checked:** any engine but Chromium, a real phone, or a screen reader.

## When porting

- **The second stylesheet is the only part to port,** behind the house prefix (`.mega__panel` → `.ts-mega__panel`).
  - It goes after the bar's own rules: it overrides some of their values from 1024px to 1279px, and its specificity is the same as theirs.
  - Its mono is the site's: `font-family: 'IBM Plex Mono'` is `var(--font-mono)`, as in hero-crest-01's port.
  - It sets `box-sizing` wherever padding meets a set size, so the app's base draws it as the file does.
- **The column names are `div`s.**
- **The reference's script is the reference's own,** so that the file works without a framework.
