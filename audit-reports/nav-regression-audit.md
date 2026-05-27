# Nav Regression Audit (read-only) — purple nav white site-wide [PASS 2, deeper]

Re-audited after the "it's in deployed code, not cache (hard-refresh didn't fix)"
signal, with a harder look for a recent commit that clobbered a token or the
Tailwind color mapping ("merged everything last night").

**Result is unchanged and now proven more rigorously: there is NO source
regression on `main`.** No recent commit touched the purple tokens, the Tailwind
color wiring, or the nav. The styling files are **byte-identical to the DS-2
commit that made them purple**, and a build emits correct purple CSS. I will not
name "the commit that broke it" because, in the styling chain, **no such commit
exists.** The break is therefore in the **build/deploy pipeline or the deployed
artifact**, not in `main`'s source.

---

## Git history — no recent styling commit (smoking gun is absent)

- `git log -- src/app/globals.css tailwind.config.ts` → most recent touch is
  **`6ab39320` PR-Ops-DS-2** (the commit that *introduced* the purple tokens +
  wiring). Nothing since.
- `git log -- src/components/ui/AppLayout.tsx` → last change **`beb2af13`
  (2026-05-17)**, months before the regression window.
- `git log -- src/app/layout.tsx` → also `beb2af13`. Imports `./globals.css`
  (`layout.tsx:3`), unchanged.
- Last night's merges (#584–#593: the Hub-header series + Evolve-1 + audits) —
  **none touch globals.css, tailwind.config.ts, postcss, layout, or the nav.**

**Decisive diff:** `git diff --stat 6ab39320 HEAD -- src/app/globals.css
tailwind.config.ts` → **empty** (no changes). The token layer is exactly what it
was when the nav was purple.

## The class→token→var chain — every link intact, and it EMITS

1. **globals.css `:root`** (unchanged): `--ts-purple-deep:#2d1b4e` (`:19`),
   `--ts-purple:#3b2d6b` (`:20`), `--ts-purple-light:#4e3e85` (`:21`),
   `--ts-purple-wash:#eae7f2` (`:22`). None removed/renamed/whitened. `:root`
   block well-formed (no stray brace/comment).
2. **tailwind.config.ts** (unchanged) `:17-22`: `brand.purple:'var(--ts-purple)'`,
   `purple-deep`, `purple-hover:'var(--ts-purple-light)'`, `purple-wash`. Mapping
   intact.
3. **AppLayout nav** (unchanged): `:190 <div className="bg-brand-purple">` (ROW1),
   `:212 bg-brand-purple/90` (ROW2 tab bar), `:324 bg-brand-purple-deep` (mobile
   menu); 5 `bg-brand-purple` usages total. Tab buttons: active
   `border border-white bg-white/10 text-white`, inactive `text-white/70` — these
   are **white-on-purple**, so if the purple background fails, white text/borders
   on a white page = exactly the "white/unstyled nav" symptom.
4. **Build proof:** `npx tailwindcss -c tailwind.config.ts -i src/app/globals.css
   -o /tmp/out.css` → succeeds; output contains
   `.bg-brand-purple { background-color: var(--ts-purple); }` (and `-deep`,
   `-hover`), `var(--ts-purple)` appears 14×. **The chain resolves end-to-end.**

## Also ruled out this pass
- **No competing config**: exactly one `tailwind.config.ts`, one
  `postcss.config.mjs` (`tailwindcss + autoprefixer`), one `src/app/globals.css`.
  No stray `tailwind.config.js` that Next could auto-pick over the `.ts`.
- **Tailwind version**: installed `3.4.18` = package.json (no v3↔v4 drift).
- **`main` compiles**: `tsc --noEmit` → exit 0 (so a TS error isn't failing the build).
- **Odd migration `add_robinhood_reconciliation`** (non-timestamped folder, sorts
  after the 2026 ones) is **old — from `beb2af13` (May 17)**, so deploys have
  succeeded with it since; not a new deploy-breaker.

---

## Conclusion: source is correct → the fault is in the deployed artifact

`main`'s source provably produces a purple nav. If the deployed site shows white
and a hard refresh doesn't fix it, the **deployed CSS differs from what `main`'s
source generates.** The honest read: the deploy is serving a build whose Tailwind
stylesheet is missing/empty or stale — i.e. a **build/deploy-pipeline failure**,
not a token/class regression. (`npm run build` =
`prisma generate && prisma migrate deploy && next build`; a `migrate deploy`
failure against Azure aborts before `next build`, which can leave a broken/stale
deploy.) I can't see Vercel logs or the live bundle from this sandbox to confirm
which.

## 10-second test to settle source-vs-deploy (do this on the LIVE site)
Open devtools on the live nav element:
- **If `class="… bg-brand-purple …"` IS on the element but `background-color`
  computes to transparent/none** → the served stylesheet is missing
  `.bg-brand-purple` → **build/deploy dropped the CSS** (not source). Check Vercel
  build + `prisma migrate deploy` logs; confirm the deployed commit SHA == current
  `main` (`10c6e8df`); redeploy.
- **If the element does NOT have `bg-brand-purple`** (different markup) → an
  **older/different build is deployed** than current `main` → redeploy from
  `main`.
- Also: `view-source` the deployed CSS and grep for `.bg-brand-purple` /
  `--ts-purple` — if absent, the CSS layer didn't ship.

## Recommended fix (pipeline, not code)
**Do not edit globals.css / tailwind.config.ts / AppLayout** — they are correct and
unchanged. Instead: (1) confirm the deployed SHA, (2) read the latest Vercel build
log for a `migrate deploy` or `next build` failure, (3) trigger a clean redeploy
(and locally `rm -rf .next && npm run build` to confirm purple from a clean build).
If a clean build of `main` reproduces white nav, that contradicts all evidence here
and would point to an environment-specific PostCSS/Node issue — reopen with the
build log.

### Caveat
Static + local-build analysis only; I cannot observe the live deployment, Vercel
logs, or the served CSS bundle from this headless sandbox. Every check I *can* run
says `main`'s source is purple.
