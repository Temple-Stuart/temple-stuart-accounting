# Lint Backlog (as of PR-Ops-5.1.5)

The lint harness was fixed in PR-Ops-5.1.5 (was previously broken — `next lint` exited before linting). On restoration, `eslint .` surfaces 1028 pre-existing problems across 242 files. These are documented here and scheduled for cleanup in dedicated themed PRs.

## Current counts (run `npm run lint` for live numbers)
- 694 errors + 334 warnings = 1028 total
- 0 auto-fixable (every fix requires human judgment)

## Top rules
- 551× @typescript-eslint/no-explicit-any
- 282× @typescript-eslint/no-unused-vars
- 85× react/no-unescaped-entities
- 37× react-hooks/exhaustive-deps
- 14× next/next
- 12× next/image
- 10× @typescript-eslint/no-require-imports
- 3× import/no-anonymous-default-export
- 2× next/link

## Cleanup plan (themed PRs, run in parallel with Phase 1 features)
- PR-Ops-5.1.5.1 — no-unused-vars (282, mechanical, low risk)
- PR-Ops-5.1.5.2 — no-explicit-any in API handlers (highest-value subset)
- PR-Ops-5.1.5.3 — react-hooks/exhaustive-deps (37, each a potential runtime bug)
- PR-Ops-5.1.5.4 — react/no-unescaped-entities (85, mechanical JSX)
- PR-Ops-5.1.5.5 — no-explicit-any in components (remaining)
- PR-Ops-5.1.5.6 — misc (next/image, next/link, require-imports, anonymous-default)

## Verification discipline until backlog cleared
Every feature PR: run `npm run lint`, confirm the files YOU touched introduce no NEW errors. The repo-wide count should trend DOWN, never up. New code ships lint-clean.

## End state
When the backlog hits zero, flip CI to `npm run lint:strict` (--max-warnings 0) as a hard gate.
