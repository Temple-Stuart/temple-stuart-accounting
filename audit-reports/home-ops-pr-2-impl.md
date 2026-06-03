# HOME-OPS-PR-2 — Real evolution-timeline structure on home (fetch-free, gated)

**Branch:** `claude/home-ops-pr-2`
**Date:** 2026-06-02
**Scope:** Replace the **fabricated** "Evolution loop" panel (04) in
`OperationsShowroom` with the **REAL** evolution-timeline visual structure (the
version spine), rendered **fetch-free** as a muted structural preview (no fabricated
version data presented as real), with the "Re-run AI" action gated to the login
modal. ONE concept — the Evolution panel only; panels 01/03 stay sample-data;
panel 02 (the real routine form) untouched. **Safe by construction: no fetch on
mount, no server call when logged out.** 1 new component + `OperationsShowroom.tsx`.
**0 endpoint, 0 schema, 0 deps.**

> Mirrors HOME-OPS-PR-1 (which extracted `RoutineCreateForm` fetch-free, grep-proven
> no fetch, submit→`onRequireAuth`). The real `EvolutionTimeline` (OPS-CONTENT-PR-2)
> self-fetches on mount, so its structure is reproduced here without the fetch.

---

## STEP 1 — Audit (cited)

- **Real `EvolutionTimeline.tsx` visual structure:**
  - **Fetch on mount** — `useEffect:103` → `fetch('/api/operations/projects/${projectId}/evolution')` `:109`. This is the data load to **omit**.
  - **Summary header** `:153-158`: "N re-runs · M unversioned · T tasks total".
  - **The spine** `:161`: `border-l-2 border-border-light pl-4 space-y-3` (left
    border = spine; nodes hang off it).
  - **Version node** `:163-189`: a `relative` wrapper; the **dot**
    `absolute -left-[1.3rem] top-1 w-2.5 h-2.5 rounded-full bg-brand-purple
    border-2 border-white` `:165`; a card `border border-border-light rounded
    bg-white p-3`; the **`v{n}` chip** `bg-brand-purple text-white text-[10px]`
    `:169`; the date `:172`; "· added N tasks" `:173-175`; the faint
    **`model · $cost · in · out`** line `:177-179`.
  - **Pure structure vs data:** the spine/node markup is pure presentational; only
    `versions`/`unversioned` (from the mount fetch) supply data. So the spine is
    cleanly reproducible fetch-free.
- **Fetch-free pattern mirrored** — `RoutineCreateForm.tsx` (HOME-OPS-PR-1): no
  `useEffect`/`fetch`; the gated action calls `onRequireAuth` only. This PR follows
  the same shape (read-only structure; the gate is the panel footer).
- **Fabricated panel 04 replaced** — `OperationsShowroom.tsx` panel `step="04"`
  rendered the `SAMPLE_VERSIONS` const (`[{v:1,date:'Jun 1',added:4},{v:2,date:'Jun
  2',added:3}]`) — **specific dates + task counts presented as real**. That block is
  removed (and the now-unused `SAMPLE_VERSIONS` const deleted).

## STEP 2 — Build (real evolution structure, fetch-free)

**New `src/components/home/EvolutionPreview.tsx`** — the real spine, fetch-free:
- **No fetch anywhere:** no `useEffect`, no `fetch`, no `/api/`. Read-only structure.
- **Real spine anatomy reproduced:** the summary line, the `border-l-2
  border-border-light pl-4 space-y-3` spine, and two version nodes off the spine
  using the **same node chrome** as `EvolutionTimeline:163-180` (the `-left-[1.3rem]`
  dot, the `v{n}` chip, the date / "added N tasks" / `model · $… · in · out` line).
- **No fabricated data presented as real:** the two nodes are **structural
  placeholders** — visibly muted (dot `bg-brand-purple/40`, chip
  `bg-brand-purple/60`, card `border-dashed … opacity-70`) with all values rendered
  as **em-dashes** (`—`, `added — tasks`, `model · $— · — in · — out`). The summary
  states the **mechanism** ("Each AI re-run is an immutable version — the task list
  grows, never resets"), not a fake count; a caption reads "Your real versions
  populate this spine after you log in and re-run the AI."

**`OperationsShowroom.tsx` wiring:**
- `import EvolutionPreview` (top).
- Panel 04 keeps `action="Re-run AI"` (the gated footer button → `onRequireAuth`,
  unchanged) and its body becomes `<EvolutionPreview />`.
- Removed the now-unused `SAMPLE_VERSIONS` const.
- Header comment updated to record panel 04 is now the real fetch-free structure.
- **Design:** the panel adds no purple band; the module card's single
  `bg-brand-purple/80` band (`ModuleLauncher`) stays the only purple — the spine's
  muted purple dot/chip are accents, not a band. One-purple-per-card preserved.

## STEP 3 — Verify (cited)

- **Panel 04 = the REAL evolution spine structure; fabricated content gone.** It now
  renders `<EvolutionPreview />` (the real spine + node anatomy as a muted preview);
  the `SAMPLE_VERSIONS` Jun-1/Jun-2 block is removed.
- **grep proof — no fetch / `/api/` / useEffect; action→onRequireAuth only:**
  `grep -nE "fetch|axios|/api/|useEffect" EvolutionPreview.tsx` → matches are
  **comment lines only**; **zero in code**. EvolutionPreview has no action of its own;
  the gated control is panel 04's `action="Re-run AI"` footer → `onRequireAuth`
  (unchanged from before).
- **Logged-out fires ZERO server calls:** the component has no `useEffect`, no
  `fetch`, no `/api/` — no network code on any render path. Safe by construction.
- **Panels 01/03 + panel 02 UNCHANGED:** `grep 'step="0[1234]"'` confirms panel 01
  (project, `action="Generate tasks"`), 03 (content, `action="Assemble piece"`), and
  02 (the real routine form, no `action`) are intact.
- **Real /operations Content/Evolution surfaces + other 5 modules UNTOUCHED:**
  `git diff --name-only` = `OperationsShowroom.tsx` only (+ the new component +
  report); `EvolutionTimeline`, the `/operations` workbench, and `ModuleLauncher` are
  **not** in the diff.
- **One purple band per card; alternating bands preserved:** the showroom adds no
  band; `ModuleLauncher`'s section band + alternating backgrounds are unchanged.

## Hard-constraint compliance

| Constraint | Status |
|---|---|
| Real evolution structure; no fabricated version data presented as real | ✅ real spine/node chrome; values are em-dash placeholders, muted/dashed/opacity-70 |
| No fetch on mount; no server call logged out (action→onRequireAuth) | ✅ grep: 0 fetch/`/api/`/useEffect in code; gate = panel footer → `onRequireAuth` |
| Touch ONLY panel 04; don't touch real surfaces or other panels/modules | ✅ diff = `OperationsShowroom.tsx` + new component; panels 01/02/03 + real surfaces not changed |
| 0 endpoint, 0 schema, 0 deps | ✅ |
| `tsc --noEmit` | ✅ exit 0 |
| eslint (new + changed) | ✅ `EvolutionPreview.tsx` + `OperationsShowroom.tsx` → 0 problems |
| git diff scoped | ✅ `OperationsShowroom.tsx` + `EvolutionPreview.tsx` (+ this report) |

---

## Result
The home showroom's **Evolution loop** panel now shows the **real** version-spine
structure — the `border-l-2` spine with `v{n}` purple nodes carrying the genuine
node anatomy (date · added N tasks · model/cost) — rendered **fetch-free** as a muted
structural preview (dashed, opacity-70, em-dash values) so no fabricated version data
is presented as real. It is extracted exactly like HOME-OPS-PR-1's routine form: no
`useEffect`, no `fetch`, no `/api/` — a logged-out visitor fires **zero** server calls
(grep-proven), and the gated "Re-run AI → log in" footer calls `onRequireAuth`. Panels
01/03 (still sample-data) and panel 02 (the real routine form), the real `/operations`
Content/Evolution surfaces, and the other 5 module sections are untouched;
one-purple-per-card + alternating bands preserved. tsc + lint clean; diff scoped to
the showroom + the new preview component.
