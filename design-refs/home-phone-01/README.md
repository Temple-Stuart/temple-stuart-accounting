# Temple Stuart — the footer on a phone (HOME-PHONE-01) · Handoff

Alex approved the phone footer on the design canvas with the shorter home page's boards, on 2026-11-14 at 20:01 Manila, and the corrected set at 20:41.

**What he approved is a shorter footer under 1024px.** Our Story, Services and The Record become rows that open their links, and the socials close the columns as a row of their five marks. On a 390px phone the footer goes from 1,420px tall to 640px. From 1024px the footer is FOOTER-02's, unchanged.

## Files in this handoff

| File | What it is |
|---|---|
| `design-refs/home-phone-01/Footer-Reference.html` | **The spec.** Open it in a browser from its place in the repo (it reads the crest from `public/brand/`), in a window narrower than 1024px. Press a row to open its links, and again to close them. Widen the window past 1024px and it is FOOTER-02's footer. Its first stylesheet is `design-refs/footer-02`'s, byte for byte. Its second stylesheet is what this change adds: every value in it is the design. |
| `design-refs/home-phone-01/README.md` | This file. |

## What changes under 1024px

1. **The columns stand one under another.** First come Our Story, Services and The Record, then the socials.
2. **Our Story, Services and The Record are folds.** Each is a row 52px tall under a hairline, with the column's name in its gold mono capitals at the left and a caret at the right.
   - Pressing the row opens the column's links under it, as they stand today. Pressing it again closes them.
   - All three start closed, and any number can be open.
3. **The socials stand last:** their name under a hairline, then the five marks in a row, without their names on the screen. Each mark is 20px in a 44px square, and each account's name stays for a screen reader.
4. **The hairline over the disclaimer** stands 28px under the socials, and the disclaimer 22px under it.

| Footer height | Today | Folded | Our Story open | Services or The Record open | All three open |
|---|---|---|---|---|---|
| 390px wide | 1,420px | 640px | 1,136px | 784px | 1,424px |
| 768px wide | 1,134px | 574px | 850px | 718px | 1,138px |

## What stays

- **From 1024px, everything.** The four columns, their names and links, and every width tier are FOOTER-02's. The folds are not drawn there, and every column's links are, whether its fold is open or not.
- **Every word and link,** in its home and its order. A fold's name is its column's name (`FOOTER_STORY_LABEL`, `FOOTER_SERVICES_LABEL`, `FOOTER_RECORD_LABEL`, `src/lib/footerWords.ts`), and no word is new.
- **The columns' markup.** Each column keeps its `<div>` with its hook, its name as a `<p>` and its links as a `<ul>`. A fold's row is one new `<button>` between the name and the links. Under 1024px the row stands in for the name, and from 1024px the name stands as it does today.
- **The socials' links,** as they are: each icon beside its account's name, the name only drawn off-screen under 1024px.
- **The lockup, the disclaimer, © and the four links** under the columns.

## Tokens

**Already in the app.** Each has the same name behind the house prefix (`hero-gold` is `--ts-hero-gold`). Add none.

| Token | Here |
|---|---|
| `hero-gold` | a fold's name and caret, as the columns' names are inked today |
| `fs-white` | at 0.14: the hairline over each fold and over the socials, as the footer's own hairline |

**New with this change: none.** No colour is typed: as in FOOTER-02's port, `rgb()` only ever wraps a token.

## Geometry

Under 1024px:

- **The columns:** one under another, 24px under the lockup, with nothing between them but the hairlines.
- **A fold:** the full width, at least 52px tall, with a 1px hairline at its top. Its name (the columns' label type: IBM Plex Mono 12px / 1.3, 600, 0.14em apart, capitals) stands at the left, centred in the row. Its caret is 14px, at the right edge.
- **An open fold's links** stand directly under its row, as the column draws them today: 44px rows, the stops one under another below 640px and in two columns from 640px. They stand 12px clear of the next hairline.
- **The socials:** a hairline, 20px, then their name; 6px under it, the five marks, 4px apart. Each mark is a 44px square with the icon at 20px in its middle.
- **The hairline over the disclaimer:** 28px under the socials, with 22px under it.

## Behaviour

- **A fold is a button.** `aria-expanded` says whether its links are open, and `aria-controls` names them: `id="ft-story"`, `id="ft-services"` and `id="ft-record"`.
  - Enter and Space press it, and focus stays on it.
  - A folded column's links carry `data-folded`. Under 1024px they are not drawn, and from 1024px nothing reads it.
- **All three start closed.** Nothing is stored and nothing goes in the URL, so a reload starts closed.
- **The keyboard's order is the markup's,** as it is today: the Our Story and Services rows (and their links when open), the five marks, then The Record's row. The socials stand last on the screen and third in that order.
- **No motion.** The caret does not turn: an open fold shows its links under it, as the top bar's menu rows do.

## In the reference but not on the canvas

- **The open folds.** The canvas drew the footer closed, at 390px.
- **The widths from 390px to 1023px.** The canvas drew 390px; the rules are the board's, for every width under 1024px.
- **The off-screen names.** The board took each account's name off the page and gave the link a label. The reference keeps the name in the link, drawn off-screen, so the markup does not change.

## Checked

The reference was rendered in Chromium only, with Inter and IBM Plex Mono installed (IBM Plex Mono 2.5.0, `@ibm/plex-mono`).

- **From 1024px:** at 1024, 1100, 1279, 1280, 1440 and 1920px, the footer is FOOTER-02's footer, pixel for pixel.
- **Under 1024px:** at 340, 360, 375, 390, 414, 430, 480, 560, 600, 639, 640, 700, 768, 820, 900, 1000 and 1023px. Each was checked folded, with each fold open, and with all three open:
  - nothing scrolls sideways, and nothing passes the footer's edge;
  - the rows are 52px and the marks 44px square;
  - the only column name drawn as plain text is SOCIALS.
- **Against the canvas.** At 390px every fold, name, caret, mark, the socials, the hairline and © stand where the approved board draws them, box for box, to the hundredth of a pixel.
- **Against the app's base styles.** With Tailwind 3.4.18's preflight loaded ahead of the stylesheets, the footer at 390px and 768px is identical to the file as shipped, pixel for pixel: folded, with Our Story open, and with all three open.
- **The folds,** by mouse and keyboard: closed at first, each opening its own, any number open, Enter and Space, and focus staying on the row.

**Not checked:** any engine but Chromium, a real phone, or a screen reader.

## When porting

- **The second stylesheet is the only part to port,** behind the house prefix (`.ft-fold` → `.ts-ft-fold`). It goes at the foot of FOOTER-02's port, after its last rule and above HERO-CREST-01's header, so it comes after the rules it overrides.
- **Its colours are tokens,** as in FOOTER-02's port: `rgb(var(--fs-white) / 0.14)` is `rgb(var(--ts-fs-white) / 0.14)`.
- **A fold sets its own type** (`font-family`, `font-size`, `font-weight` and `line-height` inherited), and `box-sizing` where padding meets a set size, so the app's base draws it as the file does.
- **The reference's script is the reference's own,** so that the file works without a framework.
