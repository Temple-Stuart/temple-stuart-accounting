# Temple Stuart — Financial Software, the short view's two links become toggles (HOME-PLANS-05) · Handoff

Alex, 2026-11-16 at 00:04 Manila, looking at Financial Software on the live home page and its two links, "See all 25 tools →" and "Compare all four plans →": "I am wondering if we can make them toggles, to open up a drop down , on the home page, rather than routing to a new page?" And: "also the buttons look rather mediocore, and dont really follow the look of the rest of the page..." He asked for a mock-up first, and approved its boards on the design canvas at 00:19: "AMAZING YES!! EXACTLY!!!! Those TOGGLES ARE PERFECT!!"

**What he approved is the two links made toggles, in the page's button look, each opening its part of the whole section right there: "See all 25 tools" the map of tools inside the panel, "Compare all four plans" the four plans in place of the one.** Nothing in the section routes away from the home page any more.

## Files in this handoff

| File | What it is |
|---|---|
| `design-refs/home-plans-05/Section-Reference.html` | **The spec.** Open it in a browser, press the toggles and the choices, and resize the window. Its first stylesheet is `design-refs/home-plans-04`'s, byte for byte, and its second is `design-refs/home-trim-02`'s second, byte for byte. Its third is what this change adds: every value in it is the design. Its markup is the page at rest. |
| `design-refs/home-plans-05/README.md` | This file. |

## What changes on the home page

1. **The two links become two toggles,** where they stand in the panel: "See all 25 tools" and "Compare all four plans".
   - Each is a pill button with the choices' height and type, in the quiet button's look: white, a lavender line, violet words.
   - A chevron stands where the arrow was.
   - Both start closed.
2. **"See all 25 tools" opens the map's grid inside the panel,** under the question and the choices: the 25 tools by family, each lit or not by the choices, as `/financial-software` draws them. Pressing a choice while it is open lights its tools.
3. **"Compare all four plans" shows the four plans in place of the one:** the three cards and the band, as `/financial-software` draws them, the picked plan ringed, tagged and gold.
4. **An open toggle wears the soft fill and the violet line, and its chevron turns.** Pressing it again closes it. Either can be open with the other. With both open, the section shows everything the whole view shows but its foot link.
5. **At rest the section is as tall as today,** but on a phone, where the two toggles stack with 8px between them, it is 8px taller.

| | Today | At rest | Tools open | Plans open | Both open |
|---|---|---|---|---|---|
| 1440px wide | 605px | 605px | 946px | 1,175px | 1,517px |
| 390px wide | 768px | 776px | 1,505px | 2,697px | 3,427px |

## What stays

- **The choices:** the same state, words, marks and colours.
- **The one plan at rest,** with its tag and its gold button. On the home page its button still opens sign-up.
- **`/financial-software` and `/pricing`,** unchanged. The top bar and the footer still reach both.
- **The section's hooks:** `id="modules"`, `aria-label="Software plans"`, `data-how-to` and `ts-fs--short`.
- **The port:** every rule stands but the two rules of `.fs-links`, which lose their last wearer.

## The words

| On the page | Home |
|---|---|
| See all 25 tools | **Changed:** `seeAllToolsWords`, `src/lib/howTo.ts`, loses its arrow. Its total is still the sheet's count, as the cards' counts are. |
| Compare all four plans | **New:** one constant in `src/lib/howTo.ts` beside `COMPARE_PLANS_WORDS`, which keeps its arrow for the whole view's foot link |
| the grid: the families, the tools, the marks' labels | `planMapView` and `PLAN_MARKS`, `src/lib/howTo.ts`, as the whole view draws them |
| the four plans | `planMapView`'s cards and band, and `YOUR_PLAN`, `src/lib/howTo.ts`, as the whole view draws them |
| everything else | as today: `design-refs/home-trim-02`'s README lists them |

## Tokens

**Already in the app.** Each is the same name behind the house prefix (`fs-rule` is `--ts-fs-rule`). Add none.

| Token | Value | Here |
|---|---|---|
| `fs-button-line` | `#CFC6EC` | a toggle's line at rest |
| `fs-white` | `255 255 255` | a toggle's fill at rest |
| `hero-violet-3` | `#32118A` | a toggle's words and chevron at rest |
| `hero-violet-2` | `#4D1FBC` | an open toggle's line, words and chevron; the line when pointed at; the focus ring |
| `fs-rule` | `#EEEAF5` | an open toggle's fill |

**New with this change: none.** No gradient.

Type: Inter 600, as the choices have it.

## Geometry

- **A toggle:**
  - 44px tall, the choices' height;
  - 18px before its words and 16px after its chevron, a 1.5px line, fully rounded;
  - 14px / 1.2 semibold, never wrapping;
  - its chevron 16px, 8px after the words.
- **The two toggles:** 8px apart.
  - In the reference's renders they stand beside the choices from 785px and under them below that.
  - From 640px each keeps its own width. Under 640px each fills its row, and under 453px they stack.
- **What they open:**
  - The grid takes its whole-view place inside the panel, with the rule above it and its spacing.
  - The four plans take their whole-view place under the panel, 20px below it.

## Behaviour

- **A toggle is a button.**
  - `aria-expanded` says whether its part is open, and `aria-controls` names the part: `id="fs-all-tools"` and `id="fs-all-plans"`.
  - Enter and Space open and close it, and focus stays on it.
- **Production draws a closed part not at all.** The reference keeps both parts in the file, hidden, and its script shows them, so that it works without a framework.
- **Both toggles start closed.** Nothing is stored and nothing goes in the URL, so a reload starts closed.
- **Motion:** the chevron turns over 0.2s, and the line and fill change over 0.16s. With reduced motion they change at once.
- **The keyboard's order at rest:** the two choices, the two toggles, then the plan's button. Open, the four plans' buttons take the one plan's place in that order. The grid has no stops.

## In the reference but not on the canvas

- **The widths between 1440px and 390px.** The canvas drew those two. The values between them are the reference's.
- **A toggle pointed at** (its line turns violet) **and focused** (the house ring).

## Checked

The reference was rendered in Chromium (no other engine) at 1920, 1440, 1280, 1100, 1024, 1023, 900 and 800px, every width from 799 to 780px, then 768, 700, 640, 639, 560 and 480px, every width from 479 to 449px, then 420, 390, 360 and 340px. At each width it was checked at rest, with each toggle open and with both:

- Nothing scrolls sideways and nothing passes the window's edge.
- The toggles are 44px tall. They stand beside the choices from 785px, and stack up to 452px.

Also:
- **Against production's markup.** The build should draw main's short view at `79948a9` with its links made toggles, and, while open, the whole view's own grid and plans. The reference's section, as its script paints it, is that markup, token for token, in all sixteen states: each of the four plans, with each toggle open and closed.
- **Against the canvas.** The section was lifted out of the six boards and set beside the reference in the same state at the same width. All six pairs are identical, pixel for pixel. The boards are "Financial Software · toggles": at rest, "See all 25 tools" open and "Compare all four plans" open, each on desktop and on phone.
- **Against the app's base styles.** With Tailwind 3.4.18's preflight loaded ahead of the stylesheets, at rest and with both open, screenshots at 1440, 1024, 768 and 390px are identical to the file as shipped, pixel for pixel.
- **The keyboard:**
  - The order is the two choices, the two toggles, then the plan's button.
  - Enter opens a toggle, Space closes it, and focus stays on it.
  - The ring is 2px solid `hero-violet-2`, 3px off.
- **At rest against today:**
  - At 1440, 1024 and 768px the section is as tall as today: 604.52, 543.11 and 520.61px.
  - At 390px it is 775.63px, 8px more than today's 767.63px.

**Not checked:**
- Any engine but Chromium, a real phone, or a screen reader.
- The site's own font files. IBM Plex Mono was not installed on the build machine, so the mono labels (the families, the roles, the price lines) were drawn by the system monospace, on the boards and here alike.

## When porting

- **The third stylesheet is the only part to port,** behind the house prefix (`.fs-toggle` → `.ts-fs-toggle`), after the short view's rules (HOME-TRIM-02's, at the port's foot).
- **Gone:** the two rules of `.fs-links` (`.fs-links`, and `.fs-links .fs__compare`). Nothing wears them now.
- **Not ported:** the grid's `[hidden]` rule under "THIS PAGE'S OWN".
- **The grid and the four plans are the whole view's own,** drawn by the same components in both views. The whole view's render does not change.
- **The toggles' family is the section's** (`font-family: inherit`): no font variable is read.
