# Nav Regression Audit (read-only) — purple nav rendering white site-wide

**Headline finding: there is NO code regression on `main`.** The full
class → token → CSS-var chain for the purple nav is intact, unchanged, and
**provably emits correct purple CSS at build time.** I could not reproduce a
code-level cause for a white/unstyled nav. The symptom is therefore almost
certainly a **build/deploy/cache artifact outside the source**, not a broken token
or nav class. Details + proof below; **no fix recommended to the code** because the
code is already correct (editing correct code would be wrong).

---

## 1. Token layer — INTACT

`src/app/globals.css` (read in full, 96 lines) — `:root` block is well-formed (no
syntax error, no unclosed comment/brace) and all purple vars are defined:
- `--ts-purple-deep: #2d1b4e` (`:19`)
- `--ts-purple: #3b2d6b` (`:20`)
- `--ts-purple-light: #4e3e85` (`:21`)
- `--ts-purple-wash: #eae7f2` (`:22`)
`@tailwind base/components/utilities` present (`:1-3`); imported in
`src/app/layout.tsx:3`. None removed, renamed, or set to white.

`tailwind.config.ts` — wiring intact (`:17-22`):
```
brand: {
  purple: 'var(--ts-purple)',              // #3b2d6b
  'purple-deep': 'var(--ts-purple-deep)',
  'purple-hover': 'var(--ts-purple-light)',
  'purple-wash': 'var(--ts-purple-wash)',
}
```
Content globs (`:4-7`) include `./src/components/**` and `./src/app/**` (the nav is
scanned).

## 2. Nav component — INTACT

`src/components/ui/AppLayout.tsx` still uses `bg-brand-purple` (5 occurrences),
e.g. ROW1 `:190 <div className="bg-brand-purple">`, ROW2 `:212 bg-brand-purple/90`,
mobile menu `:324 bg-brand-purple-deep`. Classes unchanged — they still reference
the purple tokens.

## 3. Git history — styling files NOT touched recently

`git log -- src/app/globals.css tailwind.config.ts src/components/ui/AppLayout.tsx`
→ last change to any of them was **`6ab39320` PR-Ops-DS-2** (the original token
layer), plus an old pre-existing merge. None of the recent merged PRs (#584–#593:
the Hub header series, Evolve-1, audits) touched globals.css, tailwind.config.ts,
postcss, or the nav styling. `postcss.config.mjs` (tailwindcss + autoprefixer) and
`package.json` (tailwindcss `^3.4.18`) are unchanged. **No recent commit altered or
removed the purple tokens or the Tailwind color wiring.**

## 4. The class→token→var chain — VERIFIED EMITTING (built it)

Ran the real Tailwind build against the repo config:
```
npx tailwindcss -c tailwind.config.ts -i src/app/globals.css -o /tmp/tw-out.css
→ "Done in 2184ms."   (no error)
```
Output contains the correct rule (`/tmp/tw-out.css:2777`):
```css
.bg-brand-purple { background-color: var(--ts-purple); }
.bg-brand-purple-deep { background-color: var(--ts-purple-deep); }
.bg-brand-purple-hover { background-color: var(--ts-purple-light); }
```
…and `var(--ts-purple)` appears 14× in the emitted CSS. So end-to-end:
`AppLayout class bg-brand-purple` → `tailwind brand.purple: var(--ts-purple)` →
`globals.css --ts-purple: #3b2d6b`. **Every link resolves. No break.** Installed
Tailwind is **3.4.18** (matches package.json — no v3↔v4 drift that would ignore the
JS config). No global `header`/`nav` override in globals.css.

---

## Conclusion: not a source bug

The premise ("a broken/renamed token breaks everything") does **not** hold against
`main` — the token is defined, the wiring is intact, the build emits purple, and
nothing styling-critical changed. A white/unstyled nav that the source build
disproves points to one of (cannot be fixed by editing this correct code):

1. **Stale/failed deploy** — Vercel serving an old or partial build (e.g. a build
   that errored after the last good CSS, or before a deploy completed). **Most
   likely.** Note: the merged **Evolve-1** migration does `ALTER TYPE … ADD VALUE`
   in `prisma migrate deploy` during `next build` — if that migration step failed
   on Azure, the deploy could be broken/stale even though the CSS source is fine.
2. **Stale local `.next` / browser / CDN cache** serving pre-token CSS.
3. **Observed on a different branch/build** than `main` — a WIP branch may carry a
   real break that `main` does not.

## Recommended diagnosis (NOT a code edit)

Because the code is correct, do **not** patch tokens/classes. Instead:
1. Confirm **which commit is actually deployed** and check the **Vercel build/deploy
   logs** — did `next build` / `prisma migrate deploy` succeed? (Check the Evolve-1
   migration applied cleanly.)
2. Hard-refresh / clear CDN + browser cache; locally `rm -rf .next && npm run build`
   and verify the nav renders purple.
3. If it reproduces on a clean local `main` build, re-open — but per this audit the
   served CSS from `main`'s source is purple, so the fault is in the build/deploy
   pipeline or cache, not the source.

### Caveats
I cannot inspect the live deployment, Vercel logs, browser, or runtime from this
headless sandbox — the above is inferred from source + a local Tailwind build.
If the regression is confirmed to reproduce from a clean `main` build, that would
contradict this evidence and warrants a fresh look (e.g. an environment-specific
PostCSS/Node issue).
