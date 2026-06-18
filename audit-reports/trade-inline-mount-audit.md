# Mount the trading scanner INLINE on the Trade tab (READ-ONLY AUDIT)

**Mandate:** Truth-first, read-only, every claim cites file:line. No fixes. Labels:
EXISTS / EXISTS-BUT-UNUSED / MISSING / REUSABLE / RISK.

**Prerequisite status:** PR-Trade-SEC (gating the 3 backtest routes) is **NOT yet merged to main**
(the 3 `tastytrade/backtest/*` routes have 0 `requireAdmin` on `origin/main` — the branch is pushed,
unmerged). This audit is read-only and independent of that gate, so it proceeds — but **merge
PR-Trade-SEC before shipping any Trade-tab work.**

**Headline (the prior assumption was wrong — in a good way):** `ConvergenceIntelligence` is **NOT
coupled to AppLayout/`useSession`/router** — a full-file grep returns **0** matches for
`useSession`/`useRouter`/`AppLayout`/`useSearchParams`/`next-auth`/`router.push`/`useContext`. The
AppLayout + `useSession` live in `app/trading/page.tsx` (the page **wrapper**), NOT in the
component. `ConvergenceIntelligence` is a **self-contained, portable client component** that already
takes the **exact optional props ModuleLauncher manages** (`scanTriggerRef`, `externalFilters`,
`externalUniverse`, `hideControls`) and runs the scan via its **own `EventSource`** to
`/api/trading/convergence?stream=true`. So this is **MOUNT-WHOLE, not extraction** — and the single
critical change is removing the `ModuleLauncher.tsx:185` `router.push('/trading')` redirect so the
component owns `scanTriggerRef`. SMALL-MED. Styling stays deferred (132 `font-mono`, terminal —
suits a quant scanner).

---

## 1. CONVERGENCEINTELLIGENCE COUPLING — none (it's portable)

`components/convergence/ConvergenceIntelligence.tsx` — `'use client'` (`:1`). Imports are all
generic: `ScannerResultsTable`, `FilterPanel`, `filter-types`, `filter-engine`, `Badge`, `Button`,
convergence `types` (`:3-11,77,87`). **Full-file grep for `useSession`/`useRouter`/`AppLayout`/
`useSearchParams`/`useParams`/`next-auth`/`window.location`/`router.push`/`useContext`/`createContext`
→ 0 matches.** It is NOT coupled to `/trading`'s layout, session, router, or any context. The
session+AppLayout coupling is in the **page** (`app/trading/page.tsx:4-5`), which merely wraps it.
**Nothing in the component breaks when mounted on the homepage Trade tab.** — EXISTS / REUSABLE
(portable), `ConvergenceIntelligence.tsx` (grep = 0 coupling).

**Props** (`:4393-4411`), all optional (`= {}`): `externalFilters?`, `onFiltersChange?`,
`externalUniverse?`, `onUniverseChange?`, `hideControls?`, `scanTriggerRef?`, `scanningRef?` — it
can run fully self-contained (no props) OR be driven by a parent's filter state (the `/trading`
mode). — REUSABLE.

## 2. THE SCAN TRIGGER + SSE STREAM — self-contained, registers itself via the ref

- `scanMarket = useCallback(async () => {...})` (`:4591`) — the inline scan: opens
  `new EventSource('/api/trading/convergence?stream=true&limit=9&refresh=true&universe=…')`
  (`:4602-4603`), streams live progress via `onmessage` (`:4605`), and on `step:'done'` fetches the
  cached result (`:4611`). Fully **inside the component** — no external trigger logic. — EXISTS.
- **The ref contract:** `useEffect(() => { if (scanTriggerRef) scanTriggerRef.current = scanMarket;
  }, [scanMarket, scanTriggerRef])` (`:4700-4701`) — the component **publishes its own scan
  function onto the parent's `scanTriggerRef`.** So a parent's "Scan" button that calls
  `scanTriggerRef.current()` fires `scanMarket` (the inline scan). `scanningRef` mirrors `scanning`
  (`:4703`). — EXISTS / REUSABLE (the trigger is portable + already ref-exposed).

## 3. MINIMAL INLINE SURFACE — the whole component IS the scan+results unit

`ConvergenceIntelligence` already bundles **FilterPanel (controls) + `scanMarket` (run) +
ScannerResultsTable (results)** — it is itself the smallest coherent "run the scan + show results"
unit. **No extraction needed.** The heavier siblings on `/trading` — `TradeLabPanel`,
`DataObservatory` (`app/trading/page.tsx:8-9`) — are **separate** page panels, NOT part of
ConvergenceIntelligence, so they can stay at `/trading` while the Trade tab gets just the scanner.
— EXISTS (one self-contained unit), REUSABLE.

`/trading` mounts it as (`page.tsx:861-869`): `externalFilters`, `onFiltersChange`,
`externalUniverse`, `onUniverseChange`, `hideControls={true}`, `scanTriggerRef`, `scanningRef` —
i.e. /trading drives it with its own filter bar (`hideControls` hides the built-in FilterPanel) and
a shared trigger ref. **ModuleLauncher already holds those exact pieces** (§4), so the Trade tab can
mount it the same way.

## 4. CURRENT TAB STATE → the redirect to kill

`ModuleLauncher.tsx`:
- `:174-180` `scannerFilters` / `scannerUniverse` state; `:184` `scanTriggerRef = useRef(...)`;
  `:185` **`scanTriggerRef.current = () => router.push('/trading')`** — set on EVERY render.
- `:351-363` trading branch (admin): `<ScanFilterForm … scannerUniverse scannerFilters
  scanTriggerRef showHeader={false}/>` — the filter form; its Scan calls `scanTriggerRef.current()`
  → today that's the **redirect** (`:185`).
- `:365-376` non-admin/guest → the "coming soon / Requires an account" stub.

**The exact change (redirect → inline):**
1. **Remove/replace `:185`** `scanTriggerRef.current = () => router.push('/trading')` — this is the
   blocker. It's reassigned on every render, so it would **clobber** ConvergenceIntelligence's
   `:4700` `scanTriggerRef.current = scanMarket`. The inline mount REQUIRES dropping this redirect
   so the component owns the ref. — RISK (render-race) → the precise fix.
2. **Mount `<ConvergenceIntelligence …/>`** in the admin trading branch (`:351-363`) with the props
   ModuleLauncher already manages — mirror `/trading` (`externalFilters={scannerFilters}`,
   `onFiltersChange={handleFiltersChange}`, `externalUniverse={scannerUniverse}`,
   `onUniverseChange={setScannerUniverse}`, `scanTriggerRef`, `scanningRef`). Either keep
   `ScanFilterForm` as the filter bar with `hideControls={true}` (mirror /trading), or drop
   ScanFilterForm and use `hideControls={false}` (the built-in FilterPanel). Now Scan →
   `scanMarket` runs **inline**, results stream into ScannerResultsTable on the tab. — the inline
   wiring.

## 5. THE ADMIN GATE — preserved, two layers

The inline scan stays admin-only WITHOUT any new gate:
- **Tab gate:** the inline mount goes in the `m.key === 'trading' && isAdmin` branch (`:351`) —
  non-admins keep the stub (`:365-376`). — EXISTS.
- **Route gate:** `/api/trading/convergence` is `requireAdmin` (`convergence/route.ts:52`) — even if
  the component renders, a non-admin's `EventSource` gets 401/403 before any paid call. — EXISTS.
**No opening to non-admins.** Opening the paid scan to non-admin tiers is a SEPARATE, explicit
cost/tier decision — out of scope here. — RISK (do not open implicitly).

## 6. EXTRACTION vs MOUNT-WHOLE — MOUNT-WHOLE wins

Given §1 (zero coupling) + §2 (self-contained trigger) + §3 (it IS the scan+results unit) + §4
(ModuleLauncher already holds the props): **mount the whole `ConvergenceIntelligence` component** —
no extraction, no focused-runner rebuild, no second scanner. This is the cleanest AND truest to
"runs on the tab": the very component that runs at `/trading` now runs on the tab, sharing the
existing ref/filter wiring. Extraction or a focused-runner would FORK the scanner (anti-pattern,
two code paths) for no benefit. — recommend MOUNT-WHOLE.

**Two honest RISKs to weigh (neither a blocker):**
- **Bundle/perf:** mounting a 4,876-line component (+ ScannerResultsTable/FilterPanel) on the
  homepage pulls it into the home bundle and mounts it when the Trade tab section renders. It's
  admin-only (the tab gate), so only admins pay it — but consider `next/dynamic` (lazy) for the
  Trade tab to keep the home bundle lean. — RISK (perf), optional mitigation.
- **The `:185` render-race** (§4.1) — must be removed, else the redirect clobbers the inline
  trigger. The single must-do wiring fix.

## 7. STYLING — terminal, explicitly DEFERRED (out of scope)

`ConvergenceIntelligence` is **132 `font-mono`** + dense data-tables — its own quant-scanner
aesthetic. Per the prior audit (`trade-tab-audit.md` §8), a homepage-contract restyle is **LARGE-XL
and deferrable** — the terminal/data-table look is appropriate for a scanner (like keeping the rrule
mono). **Styling is OUT of scope for "make it run"** — running it inline is the priority; a restyle
is a separate, optional, large effort. — RISK (XL restyle), defer.

---

## Explicit answers

**(a) Can it mount as-is?** **Yes — as-is.** `ConvergenceIntelligence` has **0** coupling to
AppLayout/`useSession`/router/context (full-file grep). The AppLayout+session are in
`app/trading/page.tsx`, not the component. Nothing breaks on the Trade tab.

**(b) Scan trigger + SSE — portable?** **Portable.** `scanMarket` (`:4591`) opens its own
`EventSource('/api/trading/convergence?stream=true')` (`:4602-4603`) and publishes itself via
`scanTriggerRef.current = scanMarket` (`:4700`). No `/trading` state needed.

**(c) Minimal inline surface.** The **whole `ConvergenceIntelligence`** — it already IS
FilterPanel+scanMarket+ScannerResultsTable. No extraction. `TradeLabPanel`/`DataObservatory` stay at
`/trading` (separate page panels, `page.tsx:8-9`).

**(d) Exact Trade-tab change.** (1) Remove `ModuleLauncher.tsx:185`
`scanTriggerRef.current = () => router.push('/trading')` (the redirect that clobbers the ref). (2) In
the `isAdmin` trading branch (`:351-363`), mount `<ConvergenceIntelligence externalFilters={…}
onFiltersChange={…} externalUniverse={…} onUniverseChange={…} scanTriggerRef={scanTriggerRef}
scanningRef={scanningRef} …/>` (mirror `page.tsx:861-869`), keeping or replacing `ScanFilterForm` as
the filter bar.

**(e) Admin gate preserved.** Yes — the tab gate (`m.key==='trading' && isAdmin`, `:351`) + the
route gate (`requireAdmin`, `convergence/route.ts:52`). Non-admins keep the stub; no implicit
opening.

**(f) Recommended approach + PRs.** **MOUNT-WHOLE** (not extract, not a focused-runner rebuild).
1. **(prereq) merge PR-Trade-SEC** (gate the backtest routes).
2. **PR-Trade-inline (SMALL-MED).** Import `ConvergenceIntelligence` into `ModuleLauncher`; remove
   the `:185` redirect; mount the component in the admin trading branch with the existing
   `scanTriggerRef`/`scannerFilters`/`scannerUniverse` props (mirror `/trading`); optionally pull
   the Trade tab into a flush section like the others. Keep the non-admin stub. Verify: admin's
   "Scan" runs inline (SSE → results on the tab), non-admin sees the stub, `/trading` still works.
   Consider `next/dynamic` for the home bundle. — SMALL-MED.
3. **(optional, deferred) PR-Trade-style — LARGE-XL.** Restyle the scanner to the homepage contract.
   Recommend **defer** (terminal suits a quant scanner; running it is the priority).

**(g) Styling.** **OUT of scope** for "make it run" — 132 `font-mono`, terminal data-tables;
LARGE-XL restyle, deferred (§7).

### Citation index
- Coupling (none): `ConvergenceIntelligence.tsx:1-11,77,87` (full-file grep 0 for session/router/
  layout/context). Props: `:4393-4411`.
- Scan trigger + SSE + ref: `:4591, 4602-4603, 4605, 4611, 4700-4701, 4703`.
- /trading mount: `app/trading/page.tsx:4-9, 861-869`.
- Trade tab + redirect + gate + stub: `ModuleLauncher.tsx:174-185, 351-363, 365-376`.
- Route gate: `api/trading/convergence/route.ts:52`. Prereq: backtest routes 0 `requireAdmin` on
  main.
- Styling: `ConvergenceIntelligence.tsx` (132 font-mono); prior audit `trade-tab-audit.md` §8.

*Do not implement — audit only.*
