# HOME — PR-9 Implementation: reorder home modules — Operations to 3rd

**Branch:** `claude/home-pr-9`
**Date:** 2026-06-01
**Scope:** Reorder the 6 home module sections — move **Operations** up to 3rd (under
Trading). New order: **Travel, Trading, Operations, Bookkeeping, Tax, Compliance.**
Order change only. 1 file + report. **0 schema, 0 deps.**

---

## STEP 1 — Order cited

`src/components/home/ModuleLauncher.tsx:27-33` — the order is the **`MODULES`
array** (rendered via `.map`). Current (before): Travel (`:28`), Trading (`:29`),
**Bookkeeping** (`:30`), **Tax** (`:31`), **Operations** (`:32`), Compliance
(`:33`).

## STEP 2 — Reordered

Moved the **Operations** entry to index 2 (after Trading). **After:** Travel,
Trading, **Operations**, Bookkeeping, Tax, Compliance (`:29-34`). The order comment
above the array was updated (HOME-PR-3 → HOME-PR-9). **Pure reorder** — verified the
6 module entries are byte-identical (sorted-multiset `diff` vs main is empty); only
their sequence changed. No content/copy/form/style change.

## Hard-constraint compliance

| Constraint | Status |
|---|---|
| Reorder only; no section content/form/copy/style change | ✅ same 6 entries (sorted-diff empty), only sequence changed |
| 0 schema, 0 deps | ✅ |
| `tsc --noEmit` | ✅ exit 0 |
| eslint | ✅ ModuleLauncher **0 problems** |
| git diff scoped | ✅ `ModuleLauncher.tsx` (+ this report) |

---

## Result
The home module sections now render in order **Travel → Trading → Operations →
Bookkeeping → Tax → Compliance** (Operations moved to 3rd, under Trading — the
input build-outs lead). Every section's content, forms, copy, and styling are
unchanged (the `MODULES` entries are byte-identical, only reordered); the
alternating bands (HOME-PR-7) recompute from the new index automatically. tsc + lint
clean; diff scoped to `ModuleLauncher.tsx`.
