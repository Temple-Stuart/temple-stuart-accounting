# Temple Stuart — Hero + Top Bar (HERO-CREST-01) · Handoff

Approved by Alex on the design canvas, 2026-11-11. Replaces the guest landing's solid aubergine hero band and the cream top bar above it.

## Files in this handoff

| File | What it is |
|---|---|
| `design-refs/hero-crest-01/Hero-Reference.html` | **The spec.** Open it in a browser from inside the repo. Top: the hero with the bar laid over it. Below: the same bar on a plain page. Resize under 1024px for the phone composition; press the menu button there. Every value in its stylesheet is the design. |
| `public/brand/hero-crest-desktop.svg` | The crest and the ground's arcs, 1024px and up. 3600 × 2000 units; the shield's middle is the file's centre. |
| `public/brand/hero-crest-mobile.svg` | The same, under 1024px. 2000 × 2000 units; same centre rule. |
| `public/brand/temple-stuart-crest-gold.png` | The bar's mark, 164 × 241: `public/brand/temple-stuart-crest.png` with its white knocked out to transparency and the ink set to `#F2CB6A`. Nothing redrawn. |

The two SVGs are generated art, about 3,000 path segments each. Use them as files. Never redraw, trace, simplify or hand-edit them. They hold paths, circles and gradients only: no script, no embedded image, no outside reference.

## What changes

**The hero** (`src/components/landing/Landing.tsx`, the band under the header)
- Ground: a violet sweep with a bloom behind the crest and a warm corner bottom right. No flat fill.
- The crest sits right of the copy from 1024px; above the copy below that.
- Headline in Inter 500, the third sentence gold. Subline under it. Two pill buttons.
- "Clone it on GitHub" carries GitHub's mark (see below), then the label, then the arrow (no arrow under 1024px).

**The top bar** (`src/components/landing/LandingHeader.tsx`, six mounts)
- One pill: gold crest mark and wordmark · three product links with hairline rules between · Pricing · Log in.
- Over the landing's hero it is glass and scrolls away with the hero. On every other mount it is the same pill filled violet, in the page's flow, on that page's existing cream.
- Under 1024px the links fold into a menu behind one button.

## Strings

| | |
|---|---|
| Unchanged | the headline and subline (`COMPANY_LINE`, `HERO_SUBLINE`, `src/lib/brandLines.ts`) · `Create free account` · `Clone it on GitHub` · `Pricing` · `Log in` · `TEMPLE STUART` |
| New, in the bar | `Financial Software` → `/#modules` · `Professional Services` → `/#services` · `Travel Marketplace` → `/#demo` |
| Gone from the bar | `GitHub ↗` · `CREATE FREE ACCOUNT` |
| Gone from the hero | the `✦ Source-available · BSL 1.1` pill (the footer's Software License link stays) |

## Tokens (new with this design)

| Token | Value | Used for |
|---|---|---|
| `hero-violet-1` … `-4` | `#6A33E0` · `#4D1FBC` · `#32118A` · `#210A5E` | the ground's sweep, 155deg, stops 0 / 34 / 68 / 100%; the solid bar's fill uses 1–3 at 0 / 55 / 100% |
| `hero-bloom` | `162 107 255` | the light behind the crest: 50% → 16% at 45% → 0 at 72% |
| `hero-orchid` | `217 70 239` | the bottom-right corner: 28% → 10% → 0 (20% → 7% → 0 under 1024px) |
| `hero-ink` | `#FAF8F4` | headline, wordmark, menu rows |
| `hero-ink-soft` | `#E4E0F2` | subline |
| `hero-ink-nav` | `#E8E4F5` | the bar's links |
| `hero-gold` | `#F6C95C` | the headline's third sentence, link hover, focus ring |
| `hero-gold-1` … `-3` | `255 236 178` · `248 203 90` · `236 178 62` | the gold pills, 135deg, 97% / 95% / 95% alpha, stops 0 / 52 / 100% |
| `hero-on-gold` | `#2A0F5C` | ink on the gold pills |
| `hero-well` | `#210B5C` | the secondary button's fill |
| `hero-rim-gold` · `hero-rim-lilac` | `#F8CB5A` · `#B9A2FF` | the secondary button's 1.5px rim, 120deg |
| glass | `rgb(255 255 255 / 0.10)` fill · `/ 0.22` line · blur 18px (16px under 1024px), saturate 140% | the overlay bar |

Type: Inter 400 / 500 / 600 / 700 and IBM Plex Mono 600, both already loaded by `src/app/layout.tsx`.

## Geometry

**1024px and up**
- Band: at least `clamp(620px, 100svh, 880px)` tall. Copy in the page container (1280px, 32px sides), 124px from the top, 56px from the bottom, centred in what is left.
- Copy column: `min(720px, 57.4%)` wide. Headline `clamp(34px, 4.86vw, 70px)` / 1.05 / −0.035em. Subline 19px / 1.6, 560px wide at most. Gaps 28px; buttons 56px tall, 12px apart, 8px extra above.
- Crest: its middle sits `clamp(294px, 29.2vw − 5px, 393px)` right of the band's middle and 79px below it. Width `min(2628px, max(157vw, 387vw − 2945px), max(1600px, 360svh − 540px))`: 2628px at 1440 × 900 and larger, smaller on narrower or shorter windows so it never runs under the copy or off the band.
- The bloom is centred on the crest's middle.
- Bar: 20px from the top, 60px tall, 30px radius, as wide as the container's content (1216px). 1024–1279px: the same bar with tighter gaps and 14px links.

**Under 1024px**
- Crest: the mobile file 860px wide, centred, its middle 320px down. Plume clears the bar; shield tip sits above the headline.
- Copy: starts 526px down, centred, 460px wide at most, 20px sides. Headline `min(34px, (100vw − 40px) / 9.75)` so each sentence keeps its own line down to 340px wide. Subline 15px / 1.55.
- Buttons: side by side, sharing the width, 50px tall, 8px apart, text `clamp(12.5px, 3.6vw, 14px)`. They stack only under 340px wide.
- Bar: 12px from the top and sides, 54px tall, 27px radius: mark, wordmark, menu button (44 × 44).

## The GitHub mark

The reference shows an empty ring where GitHub's mark goes; the ring is a stand-in, not the design. Production draws GitHub's official mark: add it as `public/logos/github.svg` from the same source as the other files in that folder, 20 × 20 (17 × 17 under 1024px), inked the button's text colour, decorative (`aria-hidden`). Do not draw or approximate it.

## In the reference but not on the canvas

Alex approved the 1440 and 390 artboards. These three were worked out in the reference and are proposals until he has seen them built:
1. **The open phone menu:** a dark glass panel under the bar with the three links, a rule, Pricing and a full-width Log in. Closes on a link, on Escape and on the button. State lives in React only.
2. **The bar on a plain page:** the same pill filled with the hero's violet, in the page's flow.
3. **Between the two artboards:** the 1024–1279px bar, the crest's scaling on narrow or short windows, and the headline and button scaling under 390px.

## Checked

The reference was rendered in Chromium (no other engine) at 1920 × 1080, 1440 × 900, 1440 × 700, 1366 × 650, 1280 × 720, 1100 × 800, 1024 × 768, 768 × 1024, 430 × 932, 390 × 844, 390 × 664, 360 × 740 and 340 × 700. At every size: no sideways scroll, both bars on one row, Log in on one line, the headline on three lines, the plume clear of the bar, the shield inside the band and clear of the headline, the two buttons side by side.

One thing does not hold, by design: under 1024px the buttons end about 860px down the page, so on most phones they sit below the first screen. That is how the 390 artboard is drawn.

Two things to know when porting:
- Browsers reject a radial-gradient size that mixes `%` and `px` inside `min()` or `calc()`, and the whole background then falls back to the flat colour. The reference uses `vw` there; keep it.
- The crest is one `<picture>`: the desktop file from 1024px, the mobile file otherwise, so only one downloads.
