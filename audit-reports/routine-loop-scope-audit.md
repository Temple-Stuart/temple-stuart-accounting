# AUDIT — Scope a Claude Code Routine for the autonomous loop (research→audit→fusion→implement) (READ-ONLY)

**Branch:** `claude/audit-routine-loop-scope` · **Date:** 2026-06-18 · **Mandate:** Truth-First, read-only, NO setup. Cite `file:line`/config. Tell the truth about ready vs missing.

---

## HEADLINE — the gates are physically un-bypassable; the #1 missing piece is a CLAUDE.md

- **Safe by construction:** a Routine on this repo **cannot push to main** (claude/-only default) and **cannot touch Azure Postgres** (the repo commits **no `DATABASE_URL`** — all secrets are env-only). So an unwatched loop can write code on a `claude/` branch but can't merge or migrate. Both gates hold.
- **The #1 gap: there is NO `CLAUDE.md`** (none at root, no `AGENTS.md`, no `.claude/`). An unwatched Routine would run with **no standing instructions** — it wouldn't follow the claude/ workflow, one-concept-PR, audit-before-action, migration discipline, fail-loud, or the commit-email convention. **This must be authored first.**
- **The loop's prompts are app-route-bound** (auth + DB + `project_id`) — a *repo* Routine can't call them. It would run the **same methodology natively in Claude Code** (the institutional prompt *texts* are reusable as its instructions; the audit prompt is literally "copy into Claude Code" already).

---

## 1. CLAUDE.md / REPO CONVENTIONS — MISSING (the prime gap)

- **No `CLAUDE.md`, no `AGENTS.md`, no `.claude/`** at root (verified: `ls` + `find` return none). The repo encodes its conventions only in **PR/commit discipline + audit-reports/** + prose comments — not in a machine-readable standing-instructions file. — MISSING.
- **Commit-email convention is NOT what the mandate states:** recent non-merge commits are authored `Claude <noreply@anthropic.com>` (git log) — **not** `astuart@templestuart.com`. There's no `.gitmessage`/commit template. So the email convention exists only as intent, unenforced. — RISK (a Routine would commit as whatever its platform identity is).
- **What a Routine NEEDS in CLAUDE.md** (so an unwatched run follows our mandates): the `claude/<name>` branch workflow + "never push to main"; **one concept per PR**; **audit-before-action / Truth-First / cite file:line**; **fail-loud / no-fallback / no fabricated data**; **migration discipline** — *may write* a migration file but **never apply** it (no Azure access; Alex runs `psql` / merge→deploy applies it); the **showroom-fetch-free** invariant (enforced at build, §2) + **tsc-clean / zero-new-lint**; the commit author/email; and the "verify on a sample, paste proof" habit. — **NEEDED before any Routine.** — MED.

## 2. THE BRANCH + PR WORKFLOW

- **`claude/` convention — overwhelmingly established:** `list_branches` shows **100+ `claude/`-prefixed branches**; every PR in this session and historically lands on `claude/<name>`. The Routine's default (push only to `claude/`) **fits perfectly**. — EXISTS / READY.
- **Branch protection on `main` — NOT verifiable from here (TRUTH):** the available GitHub tools expose no branch-protection/ruleset reader, and `main`'s `protected` flag wasn't on the first `list_branches` page. **I cannot confirm whether direct pushes to `main` are blocked.** — **RISK / must be confirmed in GitHub settings.** (Note: the *primary* PR gate doesn't depend on protection — it's the Routine's claude/-only push + merge being a human action — but protection is essential **belt-and-suspenders** so the Routine can never push main even if misconfigured.)
- **No automated CI PR checks:** `.github/` has **no workflows, no CODEOWNERS, no PR template** (`find .github` empty; `list_workflows` returned 0 earlier). The **de-facto CI is the Vercel preview build** per PR, which runs `scripts/assert-showroom-fetch-free.mjs` + `prisma generate && prisma migrate deploy && next build` (`package.json:9`). So a Routine's `claude/` PR gets a Vercel preview build (tsc via `next build` + the showroom assert) but **no GitHub-Actions tsc/lint gate**. — RISK (weak automated gating; the human review is the real check).

## 3. WHAT THE LOOP NEEDS TO RUN

- **The app's loop prompts are ROUTE-bound, not Routine-callable:** `buildResearchPrompt`/`buildTasksPrompt` (`generateDeepResearch.ts`/`generateProjectTasks.ts`) and `buildAuditPrompt.ts` are consumed by **API routes** (`projects/[id]/research`, `[id]/generate-tasks`, `[id]/prompts`) that require **auth + a DB-resident `project_id`**. A Routine running on the *repo* (no server, no auth, no DB) **can't invoke them.** — the app pipeline ≠ the Routine path.
- **The methodology maps to Claude Code natively:** research = `web_search` (Claude Code has it); **audit = `buildAuditPrompt.ts` is literally designed for this** (its doc comment: *"the prompt the user copies into Claude Code (read-only)… cites file:line"*) → Claude Code's native repo-grep+cite; fusion = produce an atomic plan; **implement = write code on a `claude/` branch** (instead of inserting task rows). The institutional prompt **texts are reusable as the Routine's standing instructions.** — REUSABLE (texts), NEEDED (the Routine harness + CLAUDE.md to drive it).
- **What a Routine would need:** the loop encoded as its prompt/CLAUDE.md; web access (for research); repo access (audit + implement); claude/ push. It does **not** need or use the app's API. — clear separation.

## 4. THE DB CONSTRAINT — HOLDS

- **The repo commits NO database credentials:** `.env.example` lists names only (`DATABASE_URL=…`, `:9`), all real secrets live in Vercel/env. A Routine cloning the repo gets **no `DATABASE_URL`** → it **physically cannot connect to Azure Postgres.** — CONSTRAINT HOLDS.
- **Migrations are deploy-applied, file-authored:** `package.json:9` runs `prisma migrate deploy` at **build** (Vercel deploy), and migration **files** live in `prisma/migrations/` (created by `prisma migrate dev` — manual; `schema.prisma:1696` "Run `npx prisma migrate dev`") + a hand-written `prisma/migrations-manual/` ("Vercel runs `prisma migrate deploy`"). So a Routine **can write a migration `.sql` file** (it's code on the branch) but it **applies only after Alex merges → Vercel deploys** (or, for non-deployable ones in `migrations-manual/`, **Alex runs `psql`**). — **Manual-gate point: any migration the loop writes is reviewed at PR merge; the loop never applies it.** — DB constraint holds; flag migration-bearing PRs for extra scrutiny.

## 5. SECRETS / SECURITY

- **What the Routine needs:** the Anthropic key (provided by the **Routine platform**, not the repo) + GitHub access (via the **Claude GitHub App**). Nothing else.
- **What stays UNEXPOSED:** every app secret — `DATABASE_URL`, `ANTHROPIC_API_KEY`, `PLAID_*`, `STRIPE_*`, `TASTYTRADE_*`, `JWT_SECRET`, `OWNER_EMAIL`, etc. (`.env.example:9-111`, names only) — lives in **Vercel/env, never the repo**. A Routine works on the **repo** (no prod env) → **no app secrets, no DB creds, no API keys are exposed to it.** — SECURE boundary confirmed.
- **The `/fire` token (one per Routine):** if the **app** fires the loop, store the per-Routine `/fire` token **server-side in our secrets manager** (the same pattern as `CRON_SECRET` `.env.example:91` / the Inngest signing keys `:102-103`) — never client-exposed, gated like the existing cron/owner secrets. — NEEDED (storage location: Vercel env, server routes only).

## 6. COST / QUOTA

- **~15 runs/day shared quota — enough for Alex (User #1):** a solo founder iterating a handful of projects/day fits comfortably. — OK for Alex's own loop.
- **MULTI-TENANT CEILING (flagged):** the ~15/day is the **account's** quota. **Selling cannot share Alex's account** — each customer would need their own account/Routine **OR** the sandboxed Agent-SDK architecture (the agentic-loop audit's Phase 3: ephemeral read-only runner per tenant). **Routines are the right tool for Alex's own loop, NOT the product's multi-tenant path.** — RISK (do not build the SaaS on shared-quota Routines).

## 7. THE GATES — both physically un-bypassable (the truth-check)

- **(a) PR-merge gate:** the Routine pushes **claude/-only** (Anthropic's safe default) and **has no merge capability** — merging `claude/ → main` is a **human GitHub action by Alex**. The unwatched loop cannot self-merge. ✓ (Strengthen with branch protection on main — §2, unverified, recommend enabling.)
- **(b) Migration gate:** the Routine has **no `DATABASE_URL`** (repo commits none) → **cannot run any migration**; a migration file it writes applies only at **deploy after merge**, and truly-manual ones need **Alex's `psql`**. ✓
- **Truth-check verdict:** the unwatched loop is safe **by construction** — it can author code (incl. migration files) on a `claude/` branch, but it **cannot merge to main and cannot touch Azure**. The two human gates (Alex merges; Alex migrates) are the SOC 2 controls, and the Routine **physically can't bypass either**. The one caveat to close: **confirm/enable `main` branch protection** as defense-in-depth (the claude/-only default is the primary gate, but protection guarantees it).

---

## Explicit answers

**(a) CLAUDE.md.** MISSING (no CLAUDE.md/AGENTS.md/.claude). Commits author as `Claude <noreply@anthropic.com>`, not `astuart@…`. A Routine NEEDS a root CLAUDE.md encoding: claude/ branch + never-push-main, one-concept-PR, audit-first/Truth-First/cite file:line, fail-loud/no-fallback, migration discipline (write files, never apply — Alex migrates), showroom-fetch-free + tsc/lint-clean, commit identity, no-Azure rule.

**(b) Branch protection + claude/ convention.** claude/ convention is **established** (100+ branches) — the Routine default fits. `main` protection is **NOT verifiable from the available tools** → must be confirmed/enabled in GitHub settings; no `.github` CI/CODEOWNERS exists (Vercel preview build is the only de-facto check).

**(c) Can the sequence run via a Routine?** Not via the app's routes (auth+DB-bound). YES via Claude Code natively — research (web_search), audit (`buildAuditPrompt.ts` is already a "run in Claude Code" prompt), fusion (plan), implement (claude/ branch). NEEDED: the loop encoded as the Routine's prompt + CLAUDE.md.

**(d) DB constraint.** HOLDS — no `DATABASE_URL` in the repo (`.env.example:9` names-only) → no Azure access. Loop writes code (incl. migration files); `prisma migrate deploy` applies them at deploy after merge (`package.json:9`); manual ones via `psql` (Alex).

**(e) Secrets.** Routine needs: Anthropic key (platform) + GitHub App access. UNEXPOSED: all app secrets/DB creds/API keys (`.env.example:9-111`, Vercel-only). `/fire` token stored server-side like `CRON_SECRET` (`:91`).

**(f) Quota.** ~15/day is enough for Alex's own loop. Multi-tenant ceiling FLAGGED — selling needs per-tenant accounts or the Phase-3 sandboxed Agent-SDK, not shared-quota Routines.

**(g) Both gates un-bypassable.** YES — claude/-only push (no self-merge) + no `DATABASE_URL` (no migrate). The loop can't merge or touch Azure. Confirm main protection as belt-and-suspenders.

**(h) Recommended setup sequence (no setup performed):**
1. **CLAUDE.md hardening (MED, do FIRST).** Author the root `CLAUDE.md` (the standing mandates above) — the single biggest prerequisite for a safe unwatched run.
2. **Confirm/enable `main` branch protection (SMALL, GitHub settings).** Block direct push, require PR. Belt-and-suspenders to the claude/-only default.
3. **Configure the Routine (MED).** Standing prompt = the loop methodology + the institutional prompt texts (research/audit/fusion); trigger = schedule or `/fire`; push = claude/-only (default); beta header `experimental-cc-routine-2026-04-01`. Store any `/fire` token server-side (CRON_SECRET pattern).
4. **Test run on a LOW-RISK project (SMALL).** Point it at a **presentation-only** project (no migration, no money/financial-data) → review the `claude/` branch it produces before trusting it on data-bearing or migration work.
5. **Review + iterate.** Merge a few of its PRs by hand; tune CLAUDE.md from what it gets wrong. Keep migration-bearing PRs for extra human scrutiny.

### Citation index
- CLAUDE.md absent: `ls`/`find` (no CLAUDE.md/AGENTS.md/.claude); commit author `git log` (`Claude <noreply@anthropic.com>`).
- Branch/CI: `list_branches` (100+ claude/); `.github` empty (no workflows/CODEOWNERS); build gate `package.json:9` + `scripts/assert-showroom-fetch-free.mjs`.
- Loop route-bound: `generateDeepResearch.ts`, `generateProjectTasks.ts`, `buildAuditPrompt.ts` (the "copy into Claude Code" doc comment) consumed by `projects/[id]/research`, `[id]/generate-tasks`, `[id]/prompts`.
- DB/migrations: `.env.example:9` (`DATABASE_URL` name-only), `package.json:9` (`migrate deploy`), `prisma/migrations/`, `prisma/migrations-manual/`, `schema.prisma:1696`.
- Secrets: `.env.example:9-111`; `/fire` storage pattern `CRON_SECRET` `:91`, Inngest `:102-103`.

*Do not set up — audit only.*
