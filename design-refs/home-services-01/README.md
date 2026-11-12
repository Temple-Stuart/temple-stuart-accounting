# Temple Stuart — Professional Services section (HOME-SERVICES-01 and -02) · Handoff

Approved by Alex on the design canvas, 2026-11-12. Replaces the guest landing's second pillar: his paragraph, the six equal cards and the purple button.

## Files in this handoff

| File | What it is |
|---|---|
| `design-refs/home-services-01/Section-Reference.html` | **The spec.** Open it in a browser from inside the repo: it reads the six pictures from `public/brand/services/`. Press the tiles; press the gold button; resize the window. Every value in its stylesheet is the design, and its markup is the page at rest. |
| `design-refs/home-services-01/README.md` | This file. |
| `public/brand/services/<key>.svg` | Six pictures, one per service, each named by its door's key: `setup`, `maintenance`, `custom`, `embed`, `bookkeeping`, `unsure`. 560 × 380. Use them as files. Never redraw, trace or edit them. They hold shapes only: no text, no script, no image, no outside reference. |

## Two PRs

| | What it builds | Runs after |
|---|---|---|
| **HOME-SERVICES-01** | The section: the heading and its line, the six tiles, the picked service's picture and words, the three steps, the gold button. The button is a link to the form's page with the pick. | HOME-PLANS-04 is merged (it reuses that PR's colours) |
| **HOME-SERVICES-02** | The form, in place: the gold button opens the one proposal form under the picked service. | HOME-SERVICES-01 is merged |

## What changes — HOME-SERVICES-01

Top to bottom, as the reference draws it:

1. **Professional Services**, the pillar's name, as large as Financial Software above it.
2. **One line** where his paragraph stood: "Hands-on services, tailored to your needs."
3. **The panel.** "What do you need?", then six tiles, one per door: an icon, the door's title, and what kind of work it is. One is always picked; at rest, the first (Full setup).
4. **The stage.** The picked service's picture beside its title and line, then how a proposal goes, in three steps:
   - **Pick what fits**: the picked service, as a chip.
   - **Tell me about your business**: what the form will ask. Bookkeeping drops Modules, as the form does.
   - **I read every one of these myself**: "You’ll hear from me by email."
5. **The gold button**, "Send a project proposal →", and "Scoped by proposal" beside it. The button links to the form's page with the pick: `/work-with-me?need=<key>`, the link each card carried until now.

Three things leave the page: his paragraph, the six equal cards and the purple button.

## What changes — HOME-SERVICES-02

- The gold button opens the form inside the panel, under the stage, and hides itself. Focus moves to Name. Close hides the form and returns focus to the button.
- The tiles are the form's need question. Inside the panel the form draws none, and it follows the pick: Bookkeeping shows its three lines and drops the modules question, and the "done" example changes with it. Picking another tile keeps what was typed.
- Everything else is the form's own: its fields, words, order and defaults (Timeline: Exploring; Budget range: not sure; Project details: open), its rules (the button waits for the deadline answer, for Other's description and for the referral's follow-up), its honeypot, its submit and its thank-you, shown in place.

## Words

Every word is read from its home. None is typed in a component.

| On the page | Home |
|---|---|
| `Professional Services` | `BUILD_PILLAR.heading`, `src/lib/homeActWords.ts` |
| `Hands-on services, tailored to your needs.` | **New.** It takes the place of `BUILD_PILLAR`'s paragraph. |
| `What do you need?` | the form's need question, typed today in `src/app/work-with-me/WorkWithMeForm.tsx` |
| the six titles and lines | `SERVICES`, `src/lib/proposalNeeds.ts`, in its order |
| `Project` · `Monthly` | **New:** each door's kind. Project: setup, custom, embed. Monthly: maintenance, bookkeeping. None: unsure. |
| `Pick what fits` · `Tell me about your business` · `I read every one of these myself` · `You’ll hear from me by email.` | **New.** The first two come from `FORM_INTRO`, the last two from the form's thank-you line. |
| `Your business` · `Modules` · `Timeline` · `Budget range` · `What done looks like` | **New:** short names for the form's questions. Timeline and Budget range are its labels as they stand. |
| `Send a project proposal →` · `Scoped by proposal` | typed today in `src/components/landing/Landing.tsx`; "Scoped by proposal" is also typed in the form |
| the form's labels, options, hints and examples | `WorkWithMeForm.tsx` and `BOOKKEEPING_WORDS`, unchanged |
| `Close` | **New** (HOME-SERVICES-02) |

## Data

- **The doors:** `SERVICES`, mapped once. A tile's key is its door's `need`, the key the form, the route and the CRM already use.
- **At rest:** the first door.
- **The pictures:** `public/brand/services/<need>.svg`. A door with no file, or a file with no door, should fail the build by name.
- **Step 2:** the form's questions, less Modules where the form asks none. Today that is Bookkeeping (`isBookkeeping` in the form). The landing and the form must not drift apart: one rule read by both, or a test that renders the form for each door and holds the two equal.
- **The link** (HOME-SERVICES-01): `${PROPOSAL_FORM_PATH}?need=<picked>`. The page already opens the form with that door picked.

## Tokens

**Already in the app.** Each is the same name behind the house prefix (`hero-violet-2` is `--ts-hero-violet-2`). Add none.

| Token | Value | Here |
|---|---|---|
| `bg` | `250 248 243` | the cream ground; the form's two inset boxes |
| `border` | `221 214 232` | the line under the section |
| `red` | `197 48 48` | the form's error, at 0.3 (border), 0.06 (fill) and solid (text) |
| `hero-violet-2` | `#4D1FBC` | the picked tile; icons; the steps' marks; picks that are on; the focus ring |
| `hero-violet-3` | `#32118A` | the picked service's chip; the add-link button's label |
| `hero-violet-4` | `#210A5E` | headings, tile titles and the thank-you |
| `hero-gold-1` | `255 236 178` | the gold button, start |
| `hero-gold-2` | `248 203 90` | the gold button, 52% |
| `hero-gold-3` | `236 178 62` | the gold button, end |
| `hero-on-gold` | `#2A0F5C` | ink on the gold button |

**Added by HOME-PLANS-04** (`design-refs/home-plans-04`). This section reuses them by the same values. If that PR ported them under other names, use its names. Add none of them twice.

| Token | Value | Here |
|---|---|---|
| `fs-white` | `255 255 255` | the panel, tiles, chips and fields; text on violet; the gold button's top light at 0.75 |
| `fs-ink` | `#2B2545` | body text; the form's labels and what is typed |
| `fs-ink-soft` | `#4A4560` | the lede, the service's line, the chips, the notes, the bookkeeping box's last line |
| `fs-ink-muted` | `#6F6988` | tile kinds; step 3's mark and note; hints; placeholders |
| `fs-gold-text` | `#8A6408` | the form's eyebrow |
| `fs-line` | `#E9E4F2` | the panel's border |
| `fs-rule` | `#EEEAF5` | the rules inside it |
| `fs-chip-line` | `#E4DFF0` | the border of a tile, a chip and the Close button |
| `fs-button-line` | `#CFC6EC` | step 3's ring; the picked chip's border; the thank-you's border; the Project details underline |
| `fs-band-muted` | `#D6CCF7` | the picked tile's kind |
| `fs-shadow` | `33 10 94` | shadows on the cream: hero-violet-4 as channels |

**New with this section.**

| Token | Value | Used for |
|---|---|---|
| `ps-field-line` | `#DCD5EC` | the border of a field and a pick; the steps' wire |
| `ps-wash` | `#F6F2FE` | the picked chip's fill; the thank-you's fill |
| `ps-art` | `#F3EFFC` | the picture's frame: its flat colour, under its gradients |
| `ps-art-1` | `#F8F5FE` | the frame's gradient, start |
| `ps-art-2` | `#ECE6FA` | the frame's gradient, end |
| `ps-art-ring` | `77 31 188` | the frame's rings, at 0.05: hero-violet-2 as channels |

Two gradients, both on the board:
- The gold button: the hero's three golds at 135deg, stops 0 / 52 / 100%, as HOME-PLANS-04's, with `hero-gold-2` under it so a button's default face never shows through.
- The picture's frame: `ps-art-1` to `ps-art-2` at 135deg, under rings 1px wide every 16px at 0.05.

The stylesheet types no hex and no rgb value outside `:root`.

Type: Inter 400 / 500 / 600 and IBM Plex Mono 500 / 600, both already loaded by `src/app/layout.tsx`.

## Geometry

**Every width**
- The page container: 1280px at most, 16px sides, 32px from 1024px.
- Down the section: `clamp(44px, 5.6vw, 80px)` above the heading · 16px to the line · `clamp(24px, 2.8vw, 40px)` to the panel · `clamp(52px, 6.2vw, 88px)` to the section's bottom line.
- Heading `clamp(34px, 4vw, 56px)` / 1.05 / −0.03em, weight 500. Line `clamp(16px, 1.4vw, 19px)` / 1.55, 620px wide at most.
- Panel: 24px radius, padding `clamp(18px, 2.3vw, 32px)`. Question `clamp(18px, 1.6vw, 22px)`.
- Tiles: at least 104px tall, 14px radius, `clamp(8px, 1vw, 12px)` apart. Every row is as tall as the tallest.
- Stage: a rule `clamp(18px, 1.8vw, 24px)` under the tiles and the same again under it. Frame: 18px radius, padding `clamp(12px, 1.6vw, 24px)`; the picture at most 560px wide. Title `clamp(24px, 2.2vw, 30px)`; line 16px / 1.55, 540px wide at most.
- Steps: 26px marks on a 1.5px wire, 12px from their words. Chips 28px tall.
- The button: 48px tall, full width under 480px.

**1024px and up**
- Tiles in six columns. The picture beside the words, sharing the width 5 : 6 from 260px and 280px.
- The line keeps two lines' room, and from 1024px to 1279px step 2 keeps two rows' room. So the panel is the same height for all six services.

**640px to 1023px**
- Tiles in three columns. The picture above the words.

**Under 640px**
- Tiles in two columns.

**The form** (HOME-SERVICES-02)
- Its fields are 860px wide at most, in two columns from 640px (Name and Email, Timeline and Budget range, Hard deadline and What's driving it?), the rest full width.
- Fields 46px tall with a 12px radius; text areas at least 84px; picks 38px; Close 40px; the remove-link button 46px square.

## Behaviour

**HOME-SERVICES-01**
- One value in React state: the picked door. No storage, no URL, no cookie. A reload starts at the first door.
- Pressing a tile changes the picture, the title and line (the title is read out), step 1's chip and step 2's list.
- All six pictures are in the page and one shows, so a pick never waits on a download.
- The tiles are buttons with `aria-pressed`, in a group labelled by the question. This is the form's own single-pick idiom, with its state said.
- The pictures are decorative (`alt=""`): the title and line beside each say what it shows.
- Colours change over 160ms, and at once under `prefers-reduced-motion`.

**HOME-SERVICES-02**
- Open or closed is React state only. A reload starts closed.
- Opening moves focus to Name, which brings the form into view. Close returns focus to the gold button.
- The send, its body and its route are the form's, unchanged.

## In the reference but not on the canvas

Alex approved the 1440 and 390 artboards and the board with the form open. These were worked out in the reference and are proposals until he has seen them built:

1. **Pointer and keyboard states.** Hover: a tile's border, a pick's border, Close and the link buttons' borders turn violet; the gold button brightens. Focus: a 2px violet ring.
2. **Between the artboards.** Three columns of tiles from 640px. The picture beside the words from 1024px. The heights kept between 1024px and 1279px.
3. **The form in full.** The board drew "Project details" as a closed link. The form opens it at rest, and its deadline question gates the button, so the reference draws it open, with every field. The picks say whether they are on (`aria-pressed`). The error and the thank-you have their looks. Close is 40px. Focus moves on open and close.
4. **The pictures load with the page.**

Three things differ from the artboards on purpose:
- The side gutters are the page container's own.
- The section keeps the bottom line every section on the page has.
- The form's apostrophes are straight, as the form types them.

## Checked

The reference was rendered in Chromium (no other engine) at 1920, 1440, 1280, 1279, 1200, 1100, 1024, 1023, 900, 768, 640, 639, 480, 479, 430, 390, 360 and 340px wide. At every width:
- **All six services, pressed in turn.** Exactly one tile is pressed. The title, line, picture (loaded), step 1's chip and step 2's list are its own; step 2 has no Modules for Bookkeeping. Nothing scrolls sideways, no box passes the window's edge, nothing is cut off. The tiles are one height and stand in six, three or two columns. From 1024px the panel is the same height for all six.
- **The form.** It opens with focus on Name. It follows the pick: Bookkeeping's three lines, no modules question and its own "done" example; another door brings back the modules question and the general example. The button waits for the deadline answer, for Other's description and for the referral's follow-up, and the follow-up's label is the form's for each. Links grow to five rows. Project details closes and opens. Close returns focus to the button. Send shows the thank-you with the email typed. Nothing scrolls sideways with every field showing.

Also:
- **Against the app's base styles.** With Tailwind 3.4.18's preflight loaded ahead of the stylesheet, 17 screenshots (1440, 1024, 768 and 390px, at rest, each service and the form) were compared with the file as shipped, pixel by pixel. No pixel differs by more than 1 of 255 levels.
- **Against the canvas.** At 1440px the section is 957px tall: the artboard's 956px and the bottom line. At 390px it is 1364px: the artboard's 1363px and the line.
- **Against the repo** at `e8bca5c`: the six doors are `SERVICES` in its order, `BOOKKEEPING_WORDS` and the heading are their leaves', and every word of the form, with its five option lists in order, is the form's own.
- **Contrast.** Every line of text is at least 4.5 : 1 on its ground; the lowest is a hint on the Project details box's cream (4.88). The icons are 9.38 : 1. The fields' borders are 1.42 : 1, as light as the house's own fields (1.41 : 1); a field is known by the label above it.
- **Keyboard.** Tab reaches the six tiles, then the gold button. Space and Enter pick a tile and focus stays on it. Enter on the gold button opens the form with focus on Name; Close returns focus to the button.

Not checked: any engine but Chromium, a real phone, a screen reader.

Three things to know when porting:
- The six pictures are files. Draw them with `<img>`, all six in the page, the five not picked hidden.
- One rule hides what the section hides: `.ps [hidden] { display: none }`. Without it, every block that sets its own display would show what is meant to be hidden.
- The gold button has `hero-gold-2` under its gradient, so the button's default face never tints its edges.
