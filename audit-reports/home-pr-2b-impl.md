# HOME — PR-2b Implementation: hero headline copy change

**Branch:** `claude/home-pr-2b`
**Date:** 2026-05-31
**Scope:** Hero headline copy change only. 1 file + report. **0 schema, 0 deps.**

---

## STEP 1 — Located + changed

`src/app/page.tsx` (LandingPage Hero `<h1>`, `:62-66`):

**Before** (`:63-65`):
```jsx
Track your money.<br />
Trade smarter.<br />
<span className="text-text-faint">Plan your life.</span>
```
**After**:
```jsx
Track your money.<br />
Plan your life.<br />
<span className="text-text-faint">Act smarter.</span>
```

- Line 1 "Track your money." — unchanged.
- Line 2 — text swapped "Trade smarter." → **"Plan your life."** (plain line, same
  styling).
- Line 3 — text swapped "Plan your life." → **"Act smarter."**, keeping the
  **`<span className="text-text-faint">`** muted/lighter treatment exactly.

The `<h1>` classes (`text-4xl lg:text-5xl font-light tracking-tight mb-4`), the
`<br />` line breaks, and the `text-text-faint` span class are **all preserved** —
text swap only.

## Hard-constraint compliance

| Constraint | Status |
|---|---|
| Text only; no style/class/layout change | ✅ diff = 2 lines, only the words changed; `<br />` + `text-text-faint` preserved |
| Nothing else on the page touched | ✅ only the `<h1>` lines 64-65 |
| 0 schema, 0 deps | ✅ |
| `tsc --noEmit` | ✅ exit 0 |
| eslint | ✅ page 0e/3w == main → **+0/+0** (the 3 warnings are pre-existing) |
| git diff scoped | ✅ `page.tsx` (+ this report) |

---

## Result
The hero headline now reads **"Track your money. / Plan your life. / Act
smarter."** with the third line keeping its muted `text-text-faint` styling — a
pure text swap (each line's classes/layout untouched). tsc + lint clean; diff
scoped to `page.tsx`.
