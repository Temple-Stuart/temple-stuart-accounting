# HOME-PR-10 — Operations showroom on home (4 pieces visible, actions gate to login)

**Branch:** `claude/home-pr-10`
**Date:** 2026-06-02
**Scope:** Replace the Operations home **stub** with a purpose-built,
**presentational** showroom: the 4 Operations pieces (make a project · make a
routine · create content · evolution loop) rendered with **hardcoded sample data**,
where every action button opens the existing login modal. **Safe by construction —
ZERO fetches, ZERO API calls, ZERO real-Operations-component imports.** Visible to
all; using it requires login. 1 new component + `ModuleLauncher.tsx` (+ report).
**0 endpoint, 0 schema, 0 deps.**

> Why presentational, not the real dashboard: the real Operations components
> (`SectionD_ProjectBacklog`, `RoutineList`, `ContentTable`, `EvolutionTimeline`)
> call paid AI + load user data. They must never run on the public home page. This
> showroom has **nothing to call**, so a visitor literally cannot trigger a paid
> request — protecting the API budget the recent security sweep hardened.

---

## STEP 1 — Audit (cited)

- **The Operations stub replaced:** in `ModuleLauncher.tsx`, Operations fell through
  to the generic paid stub `return` in `renderBody` (`:124-136`: "Operations —
  coming soon. … Launch Operations Module"), since it is neither `travel` nor
  `trading && isAdmin`.
- **Login-modal trigger reused (NOT reinvented):** the **`onRequireAuth` prop**
  (`ModuleLauncher.tsx:40`), wired at `page.tsx:74` to open the register/login
  `LoginBox` modal. It is the same trigger Travel's `gateGuestCreate` calls
  (`:94-96`) and the paid stub's "Launch" button calls (`:130`). The showroom's
  every action button calls this exact prop.
- **Home design language matched:** the per-module full-width band
  (`ModuleLauncher.tsx:146-162`) — **one `bg-brand-purple/80` band per card**
  (`:150`), **alternating background** `bg-bg-row`/`bg-white` (`:147`, PR-7), white
  body `bg-white p-4` (`:156`); Travel/Trading render `showHeader={false}` so each
  card keeps exactly one purple band. The showroom mounts inside that same white
  body, so the **module band is the card's only purple** — its 4 inner panels use
  **light gray** headers (`bg-gray-50`), never a second purple.
- **Confirmed — no real Operations component imported, no endpoint called:** the new
  `OperationsShowroom.tsx` imports **nothing** (pure JSX + hardcoded constants); it
  does not import `SectionD_ProjectBacklog` / `RoutineList` / `ContentTable` /
  `EvolutionTimeline`, and contains no `fetch`/`axios`/`/api/` (grep below).

## STEP 2 — The showroom (presentational only)

**New `src/components/home/OperationsShowroom.tsx`** — `onRequireAuth: () => void`
is its only prop. Renders the intro line *"This is the real dashboard, not a
screenshot — look around"* + *"Creating anything asks you to log in. Nothing here
calls the server."*, then a responsive `grid lg:grid-cols-2` of 4 panels with
**baked-in sample data**:

1. **01 · Make a project** — the 5-step glimpse: "Apply for SBA microloan" with
   Goal/Problem/Diagnosis/Design lines + 3 sample tasks (`SAMPLE_TASKS`, with
   done/in-process/new status pills). Gated **"Generate tasks → log in"**.
2. **02 · Make a routine** — "Morning content filming", cadence chips **daily ·
   06:00** + a streak chip + sample steps + "next fire · tomorrow 06:00". Gated
   **"Create routine → log in"**.
3. **03 · Create content** — piece glimpse: "Day 2 reel · draft", "8 routines · 2
   projects grouped for this day", a scene/b-roll sample, and a *"find the story"*
   caption. Gated **"Assemble piece → log in"**.
4. **04 · Evolution loop** — the version-timeline glimpse mirroring the real
   `EvolutionTimeline` spine: `SAMPLE_VERSIONS` = **v1 Jun 1 +4 tasks / v2 Jun 2 +3
   tasks** on a `border-l-2` spine with `bg-brand-purple` v-chips/dots. Gated
   **"Re-run AI → log in"**.

**All data hardcoded** (`SAMPLE_TASKS`, `SAMPLE_VERSIONS`, inline literals) — no
fetch. **Every action button** (`Panel`'s single `<button onClick={onRequireAuth}>`)
opens the existing login modal — the reused trigger. Visual language mirrors the
real Operations surface (`font-mono`, status pills, brand-purple version chips, the
EvolutionTimeline spine) so visitors see the actual product.

**Wiring in `ModuleLauncher.tsx`** (3 edits, scoped):
- import `OperationsShowroom` (`:7`).
- `renderBody`: new `if (m.key === 'operations') return <OperationsShowroom
  onRequireAuth={onRequireAuth} />;` (`:110-115`) — placed before the trading/stub
  branches, so Operations no longer falls to the stub.
- band tag: `{m.key === 'operations' ? 'Live demo · log in to use' : m.live ? 'Free
  · guest ok' : 'Paid'}` (`:160`) — the "live demo · log in to use" tag in the band.

## STEP 3 — Verify (cited)

- **Operations section = the 4-panel showroom; old stub gone.** Operations now
  returns `<OperationsShowroom>` (`ModuleLauncher.tsx:110-115`) before reaching the
  stub; the stub `return` (`:130-142`) is now only Trading-non-admin +
  Bookkeeping/Tax/Compliance.
- **ZERO fetches / API / real-Operations imports** (grep of the new file):
  ```
  grep -nE "fetch|axios|/api/|useEffect|SectionD|RoutineList|ContentTable|EvolutionTimeline|operations/projects|operations/routines" OperationsShowroom.tsx
    → matches ONLY inside comment lines (5,6,7,15,24); zero in code.
  grep -nE "^import" OperationsShowroom.tsx → NO imports (pure presentational).
  ```
- **Every action opens the existing login modal, nothing else:** the only
  interactive element in the showroom is `Panel`'s button → `onClick={onRequireAuth}`
  (the reused trigger). No other handlers, no navigation, no network.
- **Other 5 module sections UNTOUCHED:** `git diff ModuleLauncher.tsx` shows only the
  import, the operations branch, and the operations-only tag ternary. Travel,
  Trading, Bookkeeping, Tax, Compliance route through unchanged code
  (`CreateTripForm` / `ScanFilterForm` / the stub) — none in the diff.
- **Alternating bands + one-purple-per-card preserved:** the band loop (`:147`) and
  the single `bg-brand-purple/80` header (`:150`) are unchanged; the showroom's 4
  inner panels use `bg-gray-50` light headers, so the Operations card still has
  exactly one purple band.

## Hard-constraint compliance

| Constraint | Status |
|---|---|
| PRESENTATIONAL ONLY — no fetch, no API, no real-Operations import; safe by construction | ✅ grep: 0 fetch / 0 `/api/` / 0 real-ops imports (matches are comments only); component imports nothing |
| Gated buttons reuse the EXISTING login modal trigger (no new auth) | ✅ all buttons call `onRequireAuth` (`ModuleLauncher:40`, same as Travel/stub) |
| Don't touch the other 5 sections or real /operations module/endpoints | ✅ diff = import + operations branch + operations-only tag; no operations route/component edited |
| 0 endpoint, 0 schema, 0 deps | ✅ |
| `tsc --noEmit` | ✅ exit 0 |
| eslint (new + changed) | ✅ `OperationsShowroom.tsx` + `ModuleLauncher.tsx` → 0 problems |
| git diff scoped | ✅ `OperationsShowroom.tsx` (new) + `ModuleLauncher.tsx` (+ this report) |

---

## Result
The home Operations section is now a **showroom**, not a stub: a "Live demo · log
in to use" band tag, a "this is the real dashboard, not a screenshot" lead-in, and 4
sample-data panels — make a project (5-step + tasks), make a routine (daily · 06:00
+ streak), create content (Day 2 reel · draft → find the story), and the evolution
loop (v1 +4 / v2 +3 on the version spine). Every action button opens the **existing**
login modal via the reused `onRequireAuth` trigger. **Safe by construction:** the
component imports no real Operations code and makes no network call — a visitor
cannot reach a paid/authed endpoint from here. The other 5 module sections, the
alternating bands, and the one-purple-per-card rule are untouched. tsc + lint clean;
diff scoped to the new showroom + `ModuleLauncher.tsx`.
