# Temple Stuart — the footer (FOOTER-02) · Handoff

Alex, 2026-11-12 at 22:44 Manila: "… all thats left to touch up is the footer!!!" He approved the boards at 23:30: "lets get the hand off! yeet yett! i like it!"

His footer note of 2026-11-10 still stands (it is quoted in `LandingFooter.tsx`'s header): "Less text. Higher impact. A clean, professional presentation." No new words: every word and link is one the footer has today, and the top bar's own crest and wordmark now head it.

## Files in this handoff

| File | What it is |
|---|---|
| `design-refs/footer-02/Section-Reference.html` | **The spec.** Open it in a browser from its place in the repo (it reads the crest from `public/brand/`) and resize the window. Every value in its stylesheet is the design, and its markup is the footer. The cream strip above the footer is the page's own. |
| `design-refs/footer-02/README.md` | This file. |

## What stays

- **Every word and link**, in its home and its order: the four columns from `src/lib/footerWords.ts`; the disclaimer word for word, ©, and PRICING · TERMS · PRIVACY · CONTACT on their targets, as `LandingFooter.tsx` has them.
- **The five socials' SVG paths**, byte for byte (`SOCIAL_ICON_PATHS`), and `target="_blank" rel="noopener noreferrer"` on every link that leaves the site.
- **The four hooks** (`data-footer-story`, `-services`, `-socials`, `-record`), each on its column's `<div>`, the label a `<p>`, the links a `<ul>`. The board drew each column as a `<nav>`; the reference keeps today's `<div>`s, so the footer stays one landmark.
- `next/link` for the links that stay on the site; a plain `<a>` where today's footer has one.
- **Where it mounts**, unchanged: `Landing.tsx`, `ModulePageClient.tsx` (the /modules pages), `/how-it-works`, `/pricing`, `/my-trip/[id]`. **The new footer shows on every one of them.**

## What changes

1. **The band**: the solid `bg-brand-purple` becomes the hero's violet, light at the top left and deepening to the bottom right (a 155° sweep from violet-2 through violet-3 to violet-4, under a soft bloom in the top-left corner).
2. **A lockup opens it**: the top bar's gold crest and wordmark, linking to `/`, at the bar's full size on every width (25×36 mark, 16px wordmark).
3. **The four labels** are gold mono, 12px.
4. **The links** are 15px in the bar's link ink. A row is 44px tall below 1024px and 36px from 1024px (today: `lg:min-h-0 lg:py-1`).
5. **Our Story draws each stop in two parts**: its number small, in mono capitals, then its place (STOP 1, then Canggu, Bali). The stops run down, then across.
6. **Socials**: each icon is drawn in the small print's ink. The icons are now `aria-hidden` (today they carry neither a name nor `aria-hidden`).
7. **The two Record links that leave the site** end with a small ↗ in lilac, also `aria-hidden`.
8. **Under the columns**: a hairline; the disclaimer, left-aligned (today it is centred), 13px, 760px wide at most; then one row with © on the left and the four links on the right. On a phone the four links wrap under ©. Each of the four links stays 44px tall at every width.
9. **Hover** turns a link gold, and its number, icon or arrow go gold with it. **Focus** shows a 2px gold ring.

**How it stands at each width:**

| Window | Layout |
|---|---|
| from 1280px | The board: four columns side by side (Our Story `3fr`, Services `1.1fr`, Socials `0.8fr`, The Record `1.5fr`). The stops are in two columns, 24px apart. |
| 1024–1279px | Our Story runs across with its stops in three columns. Under it, Services, Socials and The Record sit on the same thirds. |
| 640–1023px | Our Story runs across with its stops in two columns. Services and Socials share a row in halves, standing on the stops' columns. The Record runs across. |
| under 640px | Our Story runs across with one column of stops. Services and Socials share a row, three fifths and two fifths. The Record runs across. |

## Where the reference differs from the board, and why

| | The board | The reference | Why |
|---|---|---|---|
| The stops' numbers | lilac `#B9A2FF` | white at 72% | At their lightest spot, under the bloom, the lilac measures **3.9 : 1**. That is under the 4.5 : 1 that 11px text needs. White at 72% measures **5.14 : 1**. |
| The icons; the disclaimer and © | `#CDBDFF`; `#C9C2E6` | white at 72% | Neither colour is in the app. Over the violet, white at 72% comes out close to both (`#CDC0EC` over violet-2), so no new token is needed. |
| 1024–1279px | four across | Our Story across, the rest on thirds | Four across at 1024px puts three stops, "Professional Services" and "How It All Connects: The 14 Steps" on two lines, and "Da Nang / Hoi An" breaks after "Hoi". From 1280px the board fits every link on one line, so it stays as drawn. |
| under 640px | Services and Socials in halves | three fifths and two fifths | In halves, "Professional Services" takes two lines under about 380px. With the 3 : 2 split it fits on one line down to 340px. At 390px, Socials moves 32px to the right. |
| the stops' column gap below 1280px | 24px | 40px | While Our Story runs across, its columns stand exactly on the columns beneath it. |
| the side padding between 640 and 1279px | `clamp(16px, 2.5cqw, 32px)` | 16px, then 32px from 1024px | It follows the page container (`px-4 lg:px-8`), as the footer does today. |

At 1440px and at 390px the reference is the board's height to the pixel (681px and 1420px).

## The words

| On the page | Home |
|---|---|
| TEMPLE STUART (the lockup) | Today the bar types it in JSX (`LandingHeader.tsx:122`). The footer must not type it a second time: it moves to one export that both read. See "When porting". |
| OUR STORY · SERVICES · SOCIALS · THE RECORD | `FOOTER_STORY_LABEL`, `FOOTER_SERVICES_LABEL`, `FOOTER_SOCIALS_LABEL`, `FOOTER_RECORD_LABEL` in `footerWords.ts` |
| Stop 0 \| Los Angeles, then Stop 1 \| Canggu, Bali … Stop 10 \| Pererenan Beach, Bali | `footerStoryLinks(WAS_HERE)` in `footerWords.ts` (`FOOTER_STOP_ZERO_LABEL`, then `${stopWords(i + 1)} \| ${row.city}`), in its order. **It is drawn in two parts, split at its " \| "**: see "When porting". |
| Financial Software · Professional Services · Travel Marketplace | `FOOTER_SERVICES_LINKS` |
| Instagram · TikTok · YouTube · X · LinkedIn | `FOOTER_SOCIALS`; the icons from `SOCIAL_ICON_PATHS` |
| How It All Connects: The 14 Steps · Built in Public: The Code · Software License | `FOOTER_RECORD_LINKS`. A link with `external` gets the ↗. |
| the disclaimer; © 2026 TEMPLE STUART, LLC; PRICING · TERMS · PRIVACY · CONTACT | `LandingFooter.tsx`, where they are typed today, word for word. They stay there. |

## Tokens

**Already in the app.** Each is the same name behind the house prefix (`hero-violet-2` is `--ts-hero-violet-2`). Add none.

| Token | Value | Here |
|---|---|---|
| `hero-violet-2` | `#4D1FBC` | the band, top left |
| `hero-violet-3` | `#32118A` | the band, 48%; its flat colour under the gradients |
| `hero-violet-4` | `#210A5E` | the band, bottom right |
| `hero-bloom` | `162 107 255` | the light in the top-left corner: 24% → 8% at 45% → 0 at 72% |
| `hero-ink` | `#FAF8F4` | the wordmark |
| `hero-ink-nav` | `#E8E4F5` | every link, as the top bar's links |
| `hero-gold` | `#F6C95C` | the four labels; hover; the focus ring |
| `hero-rim-lilac` | `#B9A2FF` | the ↗ after the two links that leave the site |

**Added by HOME-PLANS-04** (on main since PR #1971 as `--ts-fs-*`, the same value). Add none.

| Token | Value | Here |
|---|---|---|
| `fs-white` | `255 255 255` | at 0.72: the stops' numbers, the icons, the disclaimer, ©; at 0.14: the hairline |

**New with this footer: none.** The stylesheet types no hex and no rgb value outside `:root`. (`--bg` in the reference's `:root` is the cream strip above the footer, the page's own, so it is not ported.)

Type: Inter 400 / 700 and IBM Plex Mono 500 / 600, both already loaded by `src/app/layout.tsx`. © and the four links are set at mono 500, as the board draws them. They name the weight because the app also loads mono 400.

## Geometry

- **The band**: 1280px wide at most, including its sides (16px, 32px from 1024px). `clamp(56px, 6vw, 88px)` above the lockup and `clamp(28px, 3vw, 40px)` under the last row.
- **The lockup**: a 44px-tall link, the mark 25×36, 13px apart from the wordmark (16px / 1.2, weight 700, 0.22em).
- **The columns**: `clamp(36px, 4vw, 56px)` under the lockup. The gaps are 36px between rows and 40px between columns. Each label is 12px / 1.3, weight 600, 0.14em, and its list starts 14px under it.
- **A row**: 15px / 1.35, its parts 10px apart. A stop's number is mono 11px, weight 600, 0.1em, and at least 56px wide, so the places line up. An icon is 16px and an arrow 12px.
- **Under the columns**: the hairline has `clamp(40px, 4.4vw, 56px)` above it and 24px under it. The disclaimer is 13px / 1.6. The © row stands 20px under it, with gaps of 8px between lines and 24px between items. © and the four links are mono 11.5px, weight 500, at 0.1em.
- **Height**: 681px at 1440px, 795px at 1024px, 1134px at 768px, 1420px at 390px.

## Behaviour

No script and no state. Hover (where there is a pointer) fades a link to gold over 0.16s, together with its number, icon or arrow, and there is no fade under reduced motion. Focus shows a 2px gold ring, 3px out.

## Checked

The reference was rendered in Chromium (no other engine) at 1920, 1440, 1280, 1024, 1023, 768, 640, 639, 480, 390, 360 and 340px wide. At every width:
- Nothing scrolls sideways, nothing passes the window's edge, and nothing is cut off.
- **No link, label, © or wordmark takes two lines.** (The check was tried on a squeezed column: it names the links that wrap.)
- Each width has its layout: four, three or two column edges; Our Story across below 1280px. The stops per column are 6 / 5 from 1280px, 4 / 4 / 3 from 1024px, 6 / 5 from 640px and 11 under it, and they always run down, then across. Below 1280px the stops' columns stand on the columns beneath them, to the pixel.
- Rows are 44px below 1024px and 36px from it. The four links are 44px at every width. The lockup is 25×36 with a 16px wordmark at every width.
- Every word and link, in order, is the repo's own: `footerWords.ts` and `LandingFooter.tsx`, read at `c64947d`.

Also:
- **Contrast**, measured against the band's own pixels behind each piece of text (the worst pixel, the text made transparent): the stops' numbers 5.14 : 1, the gold labels 5.23, the places 6.96, the disclaimer 7.1, © 7.4, the wordmark 7.51, the other links 8.81, and the four links 12.08.
- **Keyboard**: at 1440 and 390px, Tab walks all 27 links in reading order (the lockup, Stop 0 to Stop 10, Services, Socials, The Record, then the four), and each one shows the gold ring.
- **Names**: every link has its own name, and a stop reads "Stop 1 Canggu, Bali". The icons and arrows add nothing to it.
- **Hover**: a stop, a social and a link that leaves all turn gold, with their number, icon or arrow.
- **Against the app's base styles**: with Tailwind 3.4.18's preflight loaded ahead of the stylesheet, the screenshots at 1440, 1024, 768 and 390px are identical to the file as shipped, pixel for pixel.
- **Against the canvas**: at 1440 and 390px, the reference is the board's height to the pixel. The differences are listed above.

Not checked: any engine but Chromium, a real phone, a screen reader, and the five pages that mount the footer (the build checks those).

## When porting

- **The stylesheet**: port every rule but `:root` and "THIS PAGE'S OWN". `.ft` becomes `.ts-ft` and each `.ft-*` becomes `.ts-ft-*`. `var(--hero-…)` becomes `var(--ts-hero-…)` (with `rgb(var(--ts-hero-bloom) / a)` for the bloom), `rgb(var(--fs-white) / a)` becomes `rgb(var(--ts-fs-white) / a)`, and the two families become `var(--font-sans)` and `var(--font-mono)`. Put the block in `globals.css` directly above HERO-CREST-01's header, which stays last.
- **The lockup gets its own rules** (`.ts-ft-brand…`). The bar's `.ts-brand` shrinks under 1280px and 1024px; the footer's lockup does not.
- **The mark and the wordmark need a plain home.** `LandingHeader.tsx` is `'use client'`, and `LandingFooter.tsx` is a server component under `/pricing`, `/how-it-works` and `/my-trip/[id]`. An export of a `'use client'` module reaches a server component as a client reference, not as its string. So `BAR_MARK_SRC` and the wordmark move to a plain leaf, and the bar and the footer both read it there. `heroCrest01.test.ts` imports `BAR_MARK_SRC` from `LandingHeader.tsx` and pins the bar's markup: keep both passing (a re-export is fine).
- **A stop's two parts**: one pure helper splits a story link's label at its " | " into the stop and the place. It throws, naming the label, if there is not exactly one " | ". Never a guess, never a fallback. Put a space between the two parts in the markup (JSX `{' '}`): the row draws no space for it, and the link's own text then reads "Stop 1 Canggu, Bali" in any engine.
- **The icons and arrows** are `aria-hidden="true"` and draw `currentColor`.
