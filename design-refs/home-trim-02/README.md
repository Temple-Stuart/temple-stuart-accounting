# Temple Stuart — Financial Software, the short view (HOME-TRIM-02) · Handoff

Alex showed the home page to his four beta users and, on 2026-11-14 at 19:11 Manila, asked for a mock-up that answers their notes: "I would like to take this feedback, consider it deeply, review the home page in its current state, and then come up with a mock up to meet the requests of the beta users feedback." Two of the notes, as he pasted them: "Cut the scrolling length of the landing page in half. Make the user explore to find the information behind info pages" · "I like the + options for business and trading." He approved the boards at 20:01: "ALL LOOKS GOOD … OTHERWISE, LETS DO IT". He approved the corrected boards at 20:41: "thats it!  yeet yeet!"

**What he approved for Financial Software on the home page is its short view: the section's name and its line, the question with its three choices and two links, and the one plan the choices pick.** The map of 25 tools, the other plans and the link at the section's foot leave the home page. `/financial-software`, which HOME-PAGES-01 built (PR #1986), keeps the whole section, unchanged.

## Files in this handoff

| File | What it is |
|---|---|
| `design-refs/home-trim-02/Section-Reference.html` | **The spec.** Open it in a browser, press the choices and resize the window. Its first stylesheet is `design-refs/home-plans-04`'s, byte for byte. Its second is what the short view adds: every value in it is the design. Its markup is the page at rest. |
| `design-refs/home-trim-02/README.md` | This file. |

## What changes on the home page

1. **The panel holds the question, the three choices and two links.** The links are "See all 25 tools →", to `/financial-software`, and "Compare all four plans →", to `/pricing`, moved up from the section's foot. The map of 25 tools is not drawn.
2. **Under the panel, one plan:** the one the choices pick, with its tag and its gold button, as the picked plan has them today.
   - **A card** stands in one row from 1024px: who it is for, what you get, then its count and its button.
   - **With both choices on**, it is the band, as today.
3. **Under 1024px the plan is shorter.** It keeps its role, tag, name, audience, count and button. Its list and its explainer are not drawn there.
4. **The section ends sooner.** Under the plan: 44px up to 400px wide, 64px from 1400px. Today it is 52px on a phone and 88px at 1440px.
5. **The page gets shorter.**

| | Today | Short view |
|---|---|---|
| 1440px wide | about 1,601px | 605px (626px with both choices on) |
| 390px wide | about 3,385px | 768px (789px with + Business on, 781px with both) |

Today's figures are design-refs/home-plans-04's section with the two notes the live port carries (no count; the first pill says "Personal"), rendered here. They were not measured on the live site.

## What stays

- **`/financial-software`.** The whole section, as `src/app/financial-software/page.tsx` mounts it: the map, the three cards, the band and the link at the foot.
- **The choices.** The same state, words, marks and colours. Pressing one changes the plan under the panel.
- **The cards' look.** Every rule of home-plans-04's port stands. The short view adds rules and changes none.
- **The section's hooks.** `id="modules"` (`MODULES_ANCHOR`), `aria-label="Software plans"` and `data-how-to` stay, so the top bar's "Financial Software" link still lands on the section.
- **Its place and its top.** It stands under the "What We Do" box, 12px below it, as today. HOME-DOORS-01, later in this series, changes both.
- **The plan's button.** On the home page it still opens sign-up, as it does today.
- **The words.** Every one is read from its home (below). Only the first link's words are new.

## The words

| On the page | Home |
|---|---|
| Financial Software | `PLAN_PILLAR.heading`, `src/lib/homeActWords.ts` |
| Everyone gets Personal. Add a business, a trading book, or both. | `PLANS_SUBHEAD`, `src/lib/offer/plans.ts` |
| Four plans. One question: what do you run? | `PLANS_HEADLINE`, `src/lib/offer/plans.ts` |
| Personal · + Business · + Trading | `planMapView`'s base and switches, from the plans' names (`src/lib/howTo.ts`) |
| What you run · add any (the choices' label) | `WHAT_YOU_RUN_LABEL`, `src/lib/howTo.ts` |
| See all 25 tools → | **New.** "See all ‹total› tools →": one function in `src/lib/howTo.ts` beside `allToolsWords`, its total the sheet's count, as the cards' counts are. The arrow is part of the string. It links to `FINANCIAL_SOFTWARE_PATH`, `src/lib/homePages.ts`. |
| Compare all four plans → | `COMPARE_PLANS_WORDS` to `COMPARE_PLANS_PATH`, `src/lib/howTo.ts`, with its `data-compare-plans` hook, as today |
| the plan: role, name, audience, explainer, list, count, price line, button | `planMapView`, as each card draws it today (`src/lib/howTo.ts` over `src/lib/offer/plans.ts`) |
| Your plan | `YOUR_PLAN`, `src/lib/howTo.ts` |

The reference's copies of the plans' words are home-plans-04's, with one change to match the live site: the first pill says "Personal", as `planMapView` writes it.

## Tokens

**New with this section: none.** The short view's stylesheet reads no colour, no token and no font: every colour stays the port's own.

## Geometry

The short view's stylesheet, in the order it applies:

- **The section's foot:** `clamp(44px, 2vw + 36px, 64px)` under the plan, in place of the inner box's `clamp(52px, 6.2vw, 88px)`. Its top and sides stay as they are.
- **The panel** keeps its class and its look (`.fs-map`): it holds the question, the choices and the links, and no map.
- **The links:** one row, 28px apart, each 44px tall. In these renders they stand beside the choices from 781px and under them below that, and they take two rows below 449px.
- **The plan:** 20px under the panel.
  - **A card** in a row: the lead (role, tag, name, audience, explainer) `flex: 5 1 300px`, the list `5 1 300px`, the foot `3 1 220px`, with 24px between rows and 40px between columns. The explainer is 420px at most. These are the band's own values.
  - **Under 1024px:** the lead and the foot, 18px apart. They stand side by side down to 628px and the foot goes under the lead below that.
  - **The band** keeps its own row and gaps. The holder carries the 20px, so the band's own margin goes. Below 648px its foot goes under its lead.

## Behaviour

- Pressing a choice changes the plan under the panel, as the reference's script shows: Personal plus whatever is switched on, and the band when both are.
- Production renders the picked plan alone: the others are not in the page. The reference keeps all four and hides three only so the file works without a framework.
- The section's height follows the plan. At 390px it is 768px for Personal and 789px for + Business.
- The two links carry no state. `/financial-software` opens at rest.

## In the reference but not on the canvas

- **The widths between 1440px and 390px.** The canvas drew those two. The values between them are the reference's.
- **The top.** The canvas drew the section under the three doors, 72px from its top (44px on the phone). Until HOME-DOORS-01 it stands under the "What We Do" box, 12px from it, as today.
- **The foot between the two widths.** The canvas had 64px and 44px. The clamp joins them.

## Checked

The reference was rendered in Chromium (no other engine) at 1920, 1440, 1280, 1100, 1024, 1023, 980, 900, 768, 767, 640, 600, 480, 390, 360 and 340px wide, in each of its four states (no choice, + Business, + Trading, both), the choices pressed by a click. In all 64:

- Nothing scrolls sideways and nothing passes the window's edge.
- The pressed choices wear the tick and the others the ring, and only the plan that matches is shown.
- From 1024px the plan's list and explainer show; under 1024px they do not.

The widths where the links and the plan change rows were found one pixel at a time, from 1440px down to 340px.

**Against the approved boards** (Home · Desktop at 1440px, Home · Phone at 390px), in all four states:
- **Geometry:** every text run, picture and box of the section is where the board has it, to a thousandth of a pixel, once the board's top padding is taken away.
- **Pixels:** with the board's top padding set to the reference's 12px, the two are identical, pixel for pixel, in all eight pairs.
- **Without that step:** the board as drawn differs from the reference by 4 to 65,755 pixels, worst 48 of 255, in the gradients, shadows and icon edges. The board against itself, moved up by the same 60px (32px on the phone), differs in exactly the same pixels by exactly the same amounts. The differences come from where the section is drawn, not from what it is.

**Against the repo** at `0ade717` (main, with HOME-TRIM-01 merged):
- The first stylesheet is `design-refs/home-plans-04/Section-Reference.html`'s, byte for byte, and so is the font link.
- Every word in the markup is in `homeActWords.ts`, `plans.ts` or `howTo.ts`, or is built there:
  - The explainers join a plan's positioning and relationship.
  - "23 of 25 tools" and "15 of 25 tools" are `toolCountWords`.
- "See all 25 tools →" is the one new string.

**Not checked:**
- Any engine but Chromium, a real phone, or a screen reader.
- The site's own font files. Inter was installed on the build machine. IBM Plex Mono was not, so the mono text (the links, the roles, the price line) was drawn by the system monospace, on the boards and here alike.
- The arrows. "→" is not in the latin subset the site serves, so on the site a fallback face draws it, as it already draws "Compare all four plans →". A later PR in this series fixes every arrow at once.

## When porting

- **Port only the second stylesheet,** behind the house prefix: `.fs--short` becomes `.ts-fs--short` and `.fs-plan--row` becomes `.ts-fs-plan--row`. Its rules read no variable.
- **Its rules join the section's port.** They name the section's classes, and `homePlans04.test.ts` holds that no rule outside the port names one. The port's test names them as differences from home-plans-04, as HOME-PAGES-01 named its sixth.
- **They come after every rule of the port,** as the second stylesheet comes after the first. `.fs-plan--row` overrides `.fs-plan`'s column at equal weight, and the narrow rule's gap overrides the row's.
- **The first stylesheet is not ported again.** It is on main as the `.ts-fs…` port.
- **"THIS PAGE'S OWN" is not ported.** Production renders the picked plan alone.
