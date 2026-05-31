# TRAVEL — PR-28e1a Implementation: lift scan engine/state into TripScanContext

**Branch:** `claude/travel-pr-28e1a`
**Date:** 2026-05-31
**Scope:** Pure plumbing lift. Extract the scan engine + all TripPlannerAI state
into a `useTripScanState` hook exposed via a `TripScanContext`/`TripScanProvider`;
`TripPlannerAI` now renders the **byte-identical** JSX from the context. **ZERO
visual change, ZERO behavior change.** Per `audit-reports/travel-pr-28e1-audit.md`
§4, §7 (recommended sub-sequence 28e1a). Peer sections = 28e1b; aesthetics = 28e2.
2 files + this report. **0 schema, 0 deps, 0 route change.**

---

## STEP 1 — State lifted (inventory)

The entire former `TripPlannerAI` component body (the ~25 `useState` hooks, the
mount `useEffect`, all handlers, and every derived value) was relocated
**verbatim** into a new module-scope hook:

```ts
function useTripScanState(input: Props) {
  const { tripId, city, country, activity, activities = [], month, year,
          daysTravel, tripDates, onCommitted } = input;
  // …VERBATIM former component body 186-751…
  return { /* ALL names */ };
}
```

Lifted (unchanged): scan engine `scanSingleCategory` / `autoScanCategoriesFor` /
`rescanAll`; scan state `byCategory`, `perLocationDates`, `loadingCategories`,
`categoryErrors`, `scannerMeta`, `totalCategories`; commit flow `committedCards`,
the `card*` maps, `handleCommitCard` / `handleUncommitCard`; the edit + custom-add
modal state; reservation state; and all derived values (`tripDays`,
`tripActivities`, `activeCity`, `checkinVal`, `checkoutVal`, `datesValid`).

**Hook order is preserved exactly** (same hooks, same sequence, same deps) — the
hook is the former body with only the prop-param → `input` destructure swapped at
the top. The Rules-of-Hooks order is therefore identical to before.

## STEP 2 — TripScanContext + provider

```ts
const TripScanContext = createContext<ReturnType<typeof useTripScanState> | null>(null);

export function TripScanProvider({ input, children }: { input: Props; children: ReactNode }) {
  const value = useTripScanState(input);
  return <TripScanContext.Provider value={value}>{children}</TripScanContext.Provider>;
}

function useTripScanCtx() {
  const ctx = useContext(TripScanContext);
  if (!ctx) throw new Error('useTripScanCtx must be used within a TripScanProvider');
  return ctx;
}
```

`createContext, useContext, type ReactNode` were added to the existing
`react` import (line 3). The provider runs `useTripScanState` at the **same
mount point** the old component occupied (see STEP 3 wiring), so the scan/commit
lifecycle (mount auto-scan effect, etc.) fires identically.

## STEP 3 — TripPlannerAI consumes the context (same render)

```ts
export default function TripPlannerAI() {
  const { /* JSX-used names */ } = useTripScanCtx();
  return ( /* …VERBATIM former JSX 752-941… */ );
}
```

`page.tsx` wraps the existing mount in the provider, passing the **identical**
props it formerly passed to `<TripPlannerAI>` as `input`:

```tsx
<TripScanProvider input={{ tripId: id, city: …, country: …, activity: …,
    month: …, year: …, daysTravel: …, tripDates,
    onCommitted: () => { loadTrip(); loadBudgetItems(); loadVendorOptions(); loadScannerResults(); } }}>
  <TripPlannerAI />
</TripScanProvider>
```

Same DOM position, same props, same callback — no visual/behavioral delta.

## STEP 4 — Parity verification (the critical step)

| Check | Result |
|---|---|
| **JSX byte-identical** — default-export JSX (`:779-968`) vs main component JSX (`:752-941`) | ✅ `diff` empty — **BYTE-IDENTICAL** |
| **Component body verbatim** — `git diff main` on TripPlannerAI.tsx | ✅ only **3 boundary hunks**: import (line 3), hook signature/destructure, and the return-block + context/provider/export glue. Body 186-751 unchanged. |
| `tsc --noEmit -p tsconfig.json` | ✅ exit 0 |
| **eslint TPA** branch vs base (stash compare) | ✅ branch **1 error / 2 warnings**; base **1 error / 27 warnings** → **0 new errors, 0 new warnings** (all remaining are pre-existing: the `any` at `:540`, the `<img>` at `:907`, unused `CATEGORY_DEFAULT_TIMES`). Warnings net-dropped because the lifted state is now all consumed by the hook's return. |
| **eslint page.tsx** branch vs base | ✅ **34 errors / 19 warnings on both** — identical, 0 new |
| Diff scope (`git diff main --name-only`) | ✅ `TripPlannerAI.tsx`, `page.tsx` (+ this report; the audit `.md` is the branch base) |
| Pricing / charge path / TripHeader / Crew / Committed Budget | ✅ untouched (not in diff) |
| 0 schema, 0 deps, 0 route change | ✅ |

> The `daysTravel` prop is consumed inside the hook (derived values), not in the
> JSX — it was dropped from the default-export destructure to avoid introducing a
> new unused-var warning. JSX parity is unaffected (it appeared only in a comment).

---

## Result

The scan engine, scan/commit state, and modals now live in a reusable
`useTripScanState` hook behind `TripScanContext`/`TripScanProvider`.
`TripPlannerAI` renders the **byte-identical** JSX off the context, mounted at the
**same position** with the **same props**. The page looks and behaves identically.
This is the plumbing foundation for **PR-28e1b** (render the control bar + per-API
peer sections from the context) and **PR-28e2** (aesthetics) — neither of which is
in this PR.
