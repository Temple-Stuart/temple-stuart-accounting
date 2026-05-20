PR-OPS-5.1.5 PHASE 1 AUDIT REPORT
=================================

BRANCH STATUS
- current branch: claude/pr-ops-5.1.5-lint-toolchain-audit
- base: origin/main top `6d5eeb0` (includes PR-Ops-5.1.6 + 5.1.7 merges)

A. CURRENT LINT CONFIG

- **package.json scripts.lint:** `"lint": "next lint"` (package.json:10)
- **Other lint-related scripts:** none. No `lint:fix`, `lint:strict`, `format`, or similar entries (package.json:5-14).
- **Next.js version:** `next: "15.5.9"` (package.json:31). Installed at exactly `15.5.9` (verified via `npx next --version`).
- **ESLint version:** `eslint: "^8"` declared (package.json:59); installed at `8.57.1`.
- **eslint-config-next version:** `eslint-config-next: "15.5.2"` (package.json:60).
- **Other ESLint-related packages:** `@eslint/eslintrc@2.1.4` is present as a transitive dep of `eslint@8.57.1` (used by `eslint.config.mjs` via `FlatCompat`). No `@typescript-eslint/*`, `eslint-plugin-*`, or `prettier-*` declared in devDependencies — they're all pulled in transitively by `eslint-config-next`.
- **ESLint config file:** `eslint.config.mjs` (flat config; 25 lines). **No legacy `.eslintrc*` files exist** (verified via `ls .eslintrc*` — no such file or directory).
- **ESLint config contents (verbatim, eslint.config.mjs:1-25):**
  ```js
  import { dirname } from "path";
  import { fileURLToPath } from "url";
  import { FlatCompat } from "@eslint/eslintrc";

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  const compat = new FlatCompat({ baseDirectory: __dirname });

  const eslintConfig = [
    ...compat.extends("next/core-web-vitals", "next/typescript"),
    { ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts"] },
  ];

  export default eslintConfig;
  ```
  Uses `FlatCompat` to shim the legacy `eslint-config-next` presets (`next/core-web-vitals`, `next/typescript`) into ESLint 9-style flat config. The config is **already migrated** to flat-config format; it's just the package.json script that still invokes the deprecated `next lint` shim.
- **next.config eslint block:** `eslint: { ignoreDuringBuilds: true }` at next.config.ts:4-6. The Next **build** does NOT lint — so even though `next build` runs in CI, lint never gates the build today. The only lint surface is `npm run lint`.

B. FAILURE REPRODUCTION

- **Exact `npm run lint` output:**
  ```
  > temple-stuart-accounting@0.1.0 lint
  > next lint

  `next lint` is deprecated and will be removed in Next.js 16.
  For new projects, use create-next-app to choose your preferred linter.
  For existing projects, migrate to the ESLint CLI:
  npx @next/codemod@canary next-lint-to-eslint-cli .

  Invalid Options:
  - Unknown options: useEslintrc, extensions, resolvePluginsRelativeTo, rulePaths, ignorePath, reportUnusedDisableDirectives
  - 'extensions' has been removed.
  - 'resolvePluginsRelativeTo' has been removed.
  - 'ignorePath' has been removed.
  - 'rulePaths' has been removed. Please define your rules using plugins.
  - 'reportUnusedDisableDirectives' has been removed. Please use the 'overrideConfig.linterOptions.reportUnusedDisableDirectives' option instead.
  ```
- **Exit code:** 1.
- **`npx next lint --help` status:** the command exists (exit 0) and prints usage. But invoking it for real fails because its internal shim tries to pass options that the underlying ESLint API no longer accepts. The CLI itself works; the integration with ESLint is broken in Next 15.5.9. Next's own deprecation banner now recommends `npx @next/codemod@canary next-lint-to-eslint-cli .` to migrate off.

**Root cause:** Next 15 deprecated `next lint`. The shim still ships and still tries to pass legacy ESLint CLI options (`useEslintrc`, `extensions`, `resolvePluginsRelativeTo`, `rulePaths`, `ignorePath`, `reportUnusedDisableDirectives`) that have been removed in modern ESLint's options-validator. Since our `eslint.config.mjs` is already flat-config, ESLint correctly rejects those legacy options as unknown. Result: zero files are linted, exit code 1, harness functionally dead. **The deprecation banner says Next 16 will remove `next lint` entirely.**

C. RECOMMENDED FIX PATH

- **Path chosen: Path A — direct `eslint .` invocation.**
- **Reasoning:**
  - The `eslint.config.mjs` flat config is already in place and correctly extends `next/core-web-vitals` + `next/typescript` via `FlatCompat`. No config migration needed.
  - ESLint 8.57.1 (installed) supports flat config when `eslint.config.mjs` is present in the project root (auto-discovered).
  - Path B (rewrite to a fully-native flat config without `FlatCompat`) would be a larger change for no functional benefit — the existing FlatCompat shim works correctly.
  - Path C (explicit preset list) is redundant; `compat.extends(...)` already does this.
  - **One-line change in package.json:** `"lint": "next lint"` → `"lint": "eslint ."`. ESLint auto-discovers `eslint.config.mjs` and uses the existing `ignores` block.
- **Dry-run result:**
  - `npx eslint . --max-warnings 99999` exit code: **1** (because there are real lint errors in the codebase).
  - But critically: **lint actually runs**. 1516 lines of output. 1028 problems reported (694 errors + 334 warnings) across 242 files. Config is discovered correctly; rules are applied; the harness works end-to-end.
- **Files needed to change for the harness fix:** **1 file only — `package.json`** (the `scripts.lint` value). All other config (`eslint.config.mjs`, `next.config.ts`) is correct as-is.

D. IMPACT ESTIMATE

- **Files failing lint after the harness fix:** 242 files (out of 596 total `.ts`/`.tsx` files under `src/`).
- **Auto-fixable issues:** **0** (verified via `npx eslint . --fix-dry-run --format json` + `jq '[.[] | .messages[] | select(.fix != null)] | length'`). Every rule violation requires human judgment to resolve — none of the current errors are simple formatting fixes.
- **Total problem breakdown:**
  - 694 errors + 334 warnings = 1028 problems.
- **Top rules driving the noise (top 9 by frequency):**
  - 551× `@typescript-eslint/no-explicit-any` (the dominant issue — many `any` annotations across API handlers and components)
  - 282× `@typescript-eslint/no-unused-vars` (dead imports, unused destructured params)
  - 85× `react/no-unescaped-entities` (`"`, `'` in JSX text needing entities)
  - 37× `react-hooks/exhaustive-deps`
  - 14× `next/next` (Next-specific rules e.g., missing `next/image`)
  - 12× `next/image`
  - 10× `@typescript-eslint/no-require-imports` (legacy `require()` in root `.js` scripts)
  - 3× `import/no-anonymous-default-export`
  - 2× `next/link`
- **Recent PR-Ops-5.1.x file health:** of the 5 files most recently touched (PR-Ops-5.1 / 5.1.6 / 5.1.7), **4 are clean**. `TaskList.tsx` has 2 issues at line 290 (`react/no-unescaped-entities` — the existing "atomic execution units" placeholder copy from before PR-Ops-5.1). Not introduced by 5.1.x; it's pre-existing string content in a placeholder div.

- **Recommendation for Phase 2 scope: FIX-HARNESS-ONLY.**
  - The harness fix is a single-line change in `package.json`. Trivial diff.
  - Cleaning 1028 problems is a multi-PR effort with **zero auto-fixable issues** — every fix is human judgment. Bundling it with the harness change would create a 1000+ line PR that mixes mechanical tooling with substantive code rewrites; would block the SOC 2 audit-traceability story (one concept per PR).
  - The pragmatic path: Phase 2 lands the harness fix with `--max-warnings 99999` (or an equivalent permissive policy) so `npm run lint` exits non-zero on errors but doesn't block on warnings. Each subsequent PR adopts a "no new lint errors introduced in files this PR touches" discipline. Existing 1028-problem backlog gets cleaned in dedicated follow-up PRs (likely 3-5 of them grouped by rule).
  - Alternative discussion-worthy policy (Alex to decide): Phase 2 lands the harness fix that exits non-zero on **errors only** (default ESLint behavior) — making the existing 694 errors hard-blockers. Would force aggressive cleanup before the next merge. Risk: blocks unrelated feature PRs until the backlog is cleared. Recommend NOT this path unless Alex wants to halt feature work and do a lint-cleanup sprint.

NO SOURCE FILES MODIFIED. Audit report written to audit-reports/pr-ops-5.1.5-phase-1.md and committed to claude/pr-ops-5.1.5-lint-toolchain-audit.
