# Showroom Pipeline — Readiness Audit (READ-ONLY)

**Date:** 2026-06-07
**Branch:** `claude/audit-showroom-pipeline`
**Scope:** Read-only. No application code modified. Only this report was created.
**Method:** Every claim cites `file:line`. Anything not read is marked **NOT VERIFIED**.

> **Headline:** A working public Operations showroom **already exists** on the home page
> (`src/components/home/OperationsShowroom.tsx`), rendered today via `ModuleLauncher` — fetch-free,
> paid-call-free, gated through a single `onRequireAuth` login trigger. It is the exact
> locked-demo pattern this project asks for. **The gap** is that the existing showroom renders
> simplified *create forms + empty output tables*, **not** the full populated Projects pipeline
> (the live `SectionD_ProjectBacklog` backlog with project rows + step queues). Rendering the
> *full* pipeline publicly is constrained by: (a) the live components self-fetch user-scoped data
> on mount, and (b) there is **no seed/demo/fixture data** to populate a guest view.

---

## A. EXISTS — verified (file + line)

### A.1 Pipeline UI inventory (`/operations/projects`)

Route → component tree (all client components):

- **Page:** `src/app/operations/projects/page.tsx:11-13` renders `<SectionD_ProjectBacklog/>`.
- **Layout:** `src/app/operations/layout.tsx:17-27` wraps children in `AppLayout` + `OperationsEntityProvider` + `OperationsIdentityBar` + `SubNav`.
- **Backlog:** `src/components/workbench/operations/SectionD_ProjectBacklog.tsx` — `'use client'` `:17`; consumes `useOperationsEntity()` `:26`; fetches `GET /api/operations/projects` on mount `:46-55,70-73`.
- **Row:** `src/components/workbench/operations/projects/ProjectRow.tsx` — `'use client'` `:17`. Nests: `TaskList` `:22`, `EvolutionTimeline` `:23`, `DependencyList` `:24`, `ListManager` `:25`, `InspectionDrawer` `:26`, `AITaskPreview` `:27`.
- **Create form:** `src/components/workbench/operations/projects/ProjectCreateForm.tsx` (the live one — fetches AI + entities).
- **Task queue:** `TaskList.tsx` → `TaskRow.tsx` (step 5 "execute").
- **Step blocks rendered in ProjectRow** (the "pipeline steps"): 1·goal `:442-444`, 2·problem `:446-447`, 3·diagnosis `:449-451`, 4·design `:454-475`, reality inputs `:476-514`, 5·execute/tasks `:515-518`, evolution `:519-531`, 6·dependencies `:532-539`.

**Server-rendered vs client-fetched:** Every component above is `'use client'` and **client-fetches** its data (`SectionD:55`, `TaskList.tsx:49`, `EvolutionTimeline.tsx:109`, `DependencyList.tsx:60`). Nothing in the pipeline is server-rendered with props. → **Guest render is an API/props problem, not just a layout problem** (the components have no data unless they fetch a session-scoped API).

**Data each component requires + routes hit + route auth:**

| Component | Data / fetch | Route | Route auth |
|---|---|---|---|
| `SectionD_ProjectBacklog` | project list | `GET /api/operations/projects` `SectionD:55` | `getVerifiedEmail` `route.ts:42`; scoped `user_id: user.id` `route.ts:57` |
| `EntitySelector` (context) | entity list | `GET /api/entities` `EntitySelector.tsx:61` | `getVerifiedEmail` `entities/route.ts:7`; scoped `userId: user.id` `:20` |
| `ProjectRow` (save/archive/delete) | PATCH/DELETE | `/api/operations/projects/[id]` `ProjectRow:166,296,323` | `getVerifiedEmail` `[id]/route.ts:54,81,337`; scoped `user_id: user.id` |
| `ProjectRow` (generate design) | **PAID AI** | `POST .../generate-design` `ProjectRow:215` | `getVerifiedEmail` `generate-design/route.ts:45`; scoped `:55` |
| `ProjectRow` (generate tasks) | **PAID AI** | `POST .../generate-tasks` `ProjectRow:252` | `getVerifiedEmail` `generate-tasks/route.ts:46`; scoped `:56` |
| `TaskList` | tasks + COA | `GET .../tasks` `TaskList:49`; `GET /api/chart-of-accounts` `TaskList:89` | `tasks/route.ts:46` scoped `:219`; COA route NOT VERIFIED (not read) |
| `TaskRow` | mutations + daily-plan | `.../tasks/[taskId]` `TaskRow:286,309`; `POST /api/operations/daily-plan/items` `TaskRow:226` | `tasks/[taskId]/route.ts:52,85,408` scoped; daily-plan route NOT VERIFIED |
| `DependencyList` | deps | `.../dependencies` `DependencyList:60,98,122` | `dependencies/route.ts:48,113` scoped `:177,208` |
| `EvolutionTimeline` | version spine | `GET .../evolution` `EvolutionTimeline:109` | `evolution/route.ts:43` scoped `:55,85` |
| `AITaskPreview` | accept tasks | `.../tasks/bulk-create` `AITaskPreview:124` | `bulk-create/route.ts:122` scoped `:132,164,190` |

### A.2 Existing showroom / public-demo precedent (EXISTS)

- **`src/components/home/OperationsShowroom.tsx`** — `'use client'` `:1`; header comment states "Safe by construction — NO fetch on mount, NO server/paid call logged out" `:4-5`. Four panels `:92-116`, each gating actions to `onRequireAuth` `:35,69`.
- Panel children (all fetch-free, home-specific extractions):
  - `src/components/home/ProjectCreateForm.tsx` — explicit hard-line comment: "A logged-out visitor must NEVER be able to fire a paid AI call" `:5-7`; "NO fetch ANYWHERE" `:9`; every action calls `gate()→onRequireAuth` `:50-52,127,167,174`. Reuses the **real** `ListManager` `:24,92`.
  - `src/components/home/RoutineCreateForm.tsx` (referenced `OperationsShowroom:28`).
  - `src/components/home/ContentPreview.tsx` (referenced `:29`).
  - `src/components/home/EvolutionPreview.tsx` — fetch-free structural preview of the real version spine; placeholder nodes render em-dashes, "NOT fabricated version data presented as real" `:11-12,21-54`.
- **Rendered on the home page today:** `ModuleLauncher.tsx:7` imports it; `:110-114` renders `<OperationsShowroom onRequireAuth={onRequireAuth}/>` inside the "operations" module card; card tag reads "Live demo · log in to use" `:160`.
- **Other gated-demo precedent:** Travel's guest flow — `ModuleLauncher.gateGuestCreate()` `:94-101` lets guests fill `CreateTripForm` but routes "Create trip" to `onRequireAuth` when `authed===false`. Trading shows `ScanFilterForm` to admins only, a paid stub otherwise `:116-129`.
- **Grep evidence:** `grep -rilE "showroom|demo|locked|readonly|guest"` → hits include `home/OperationsShowroom.tsx`, `home/EvolutionPreview.tsx`, `home/ContentPreview.tsx`, `home/ProjectCreateForm.tsx`, `home/RoutineCreateForm.tsx`.

### A.3 Home page structure

`src/app/page.tsx` (171 lines), `LandingPage` `:9`, section order:
1. Header (purple) `:17` — Pricing/Contact/Enter.
2. Hero `:46-68`.
3. **`<ModuleLauncher/>`** `:74` — six stacked module cards.
4. CPA disclaimer `:77-86`.
5. Press `:89`.
6. Closing CTA (purple) `:111`.

**Module order inside `ModuleLauncher.MODULES`** `:29-36`: `travel`(0, live/guest-ok), `trading`(1), **`operations`(2)**, `bookkeeping`(3), `tax`(4), `compliance`(5). Each module renders as a full-width alternating-bg `<section>` with one purple band `:153-169`. **Travel and Operations are sibling cards in the same launcher** — a pipeline showroom would live in the `operations` card body (`renderBody` `:106-144`, operations branch `:110-114`), directly two cards below Travel.

**Reusable layout system:** the per-module `<section>` + single purple band + white body wrapper `ModuleLauncher.tsx:153-167`, and the inner `Panel` component `OperationsShowroom.tsx:42-75`.

### A.4 Auth / gating surface

- **Middleware** `src/middleware.ts:50-64` `PUBLIC_PATHS` = `/`, `/admin`, `/api/admin/verify`, `/api/admin/users`, `/api/auth`, `/_next`, `/favicon.ico`, `/pricing`, `/api/stripe/webhook`, `/api/inngest`, `/opengraph-image`, `/terms`, `/privacy`. **Root `/` is public** `:51`. Match logic `isPublic` `:66-68`. Unauthenticated non-public → redirect to `/` `:85-88`.
  - `/api/auth/me` is reachable publicly because `/api/auth` is public `:55` (prefix match) — this is how `ModuleLauncher` detects auth client-side (`fetch('/api/auth/me')` `:55`, sets `authed`/`isAdmin` `:57-62`).
  - **No travel or operations route is in `PUBLIC_PATHS`.**
- **Tier model** `src/lib/tiers.ts`: tiers `free|pro|pro_plus` `:15`; `TierConfig` flags `:17-25` (`plaid, ai, manualEntry, tradingAnalytics, tripPlanning, tripAI, maxLinkedAccounts`). `canAccess()` `:64-69` with **admin bypass** `ADMIN_USER_ID` `:13,66`. `requireTier()` impl `src/lib/auth-helpers.ts:41-49`.
  - **There is NO `operations` feature flag in `TierConfig`** `:17-25`. The operations/projects routes gate on **auth only** (`getVerifiedEmail`) and call **no `requireTier`** (verified across all 12 routes in A.1). So Operations is auth-gated but **not** paid-tier-gated server-side today.
- **"Render but disable interactions" pattern EXISTS:** the showroom does exactly this — real UI rendered, every mutating/paid action routed to `onRequireAuth` instead of a fetch (`OperationsShowroom.tsx:62-71`, `home/ProjectCreateForm.tsx:50-52,127,167,174`). This is distinct from a hard 401.
- **Convert / paywall flow:** the login/register modal opens via `onRequireAuth` → `setLoginMode('register'); setShowLogin(true)` `page.tsx:74`; modal component `LoginBox` (`page.tsx:6`). **Stripe checkout entry:** `src/app/api/stripe/checkout/route.ts` — `getStripe().checkout.sessions.create({ mode:'subscription', line_items:[{price: priceId,...}] })` `:43-47`, price from `getPriceIdFromTier(tier)` `:21`. Also `stripe/portal/route.ts`, `stripe/webhook/route.ts`.

### A.5 Paid external-API inventory (must be excluded in locked mode)

- AI calls go through `src/lib/ai/client.ts` — `new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })` `:17-24`, model `claude-sonnet-4-20250514` `:31`.
- Pipeline-reachable paid endpoints: `generate-design` (`ProjectRow:215` → `generateProjectDesign` `generate-design/route.ts:22`) and `generate-tasks` (`ProjectRow:252`). Both **trigger only on explicit button click**, never on render/mount (the render path is GET-only: projects/tasks/deps/evolution).
- The existing showroom already neutralizes these: `home/ProjectCreateForm.tsx:5-16` documents that its generate buttons call `onRequireAuth` and never fetch.

---

## B. MISSING — with grep evidence

### B.1 Seed / demo / fixture data — MISSING
- `grep -rilE "fixture|mockdata|sampleData|seedData|demoData"` over `src/` → only `components/home/ModuleLauncher.tsx` (its `:111` comment says "hardcoded sample data" but the rendered panels are actually **empty** structures, see B.2) and `lib/regulatory/seedRegulatorySources.ts` (regulatory, unrelated).
- No fixture/demo dataset exists to populate a *full* pipeline (backlog rows + tasks) for a guest. A publicly-rendered live pipeline would therefore show **empty/redirect**, not a populated demo.

### B.2 A populated full-pipeline guest view — MISSING
- The existing showroom panels render **empty** output: `home/ProjectCreateForm.tsx:182-200` ("0 tasks", "Your tasks appear here … after you log in"); `EvolutionPreview.tsx:21,45-49` (em-dash placeholder nodes). There is no component that renders the **populated** `SectionD_ProjectBacklog` (multiple project rows + step queues) without a live user fetch.
- `ModuleLauncher.tsx:111` comment ("hardcoded sample data") is **stale** relative to the current fetch-free-but-empty implementation — flag, do not fix.

### B.3 Narrative / teaching / explanatory-copy layer — MISSING
- `grep -rilE "teaching|narrative|explainer|infoPanel|helpText|coachmark"` → no dedicated teaching-copy system; hits are incidental (tooltips inside content-pipeline components).
- Schema has **no** narrative/content-copy/CMS model: `grep -niE "model .*(narrative|copy|teaching|explan|cms|article)"` on `prisma/schema.prisma` → 0. (The `operations_content_*` models `schema.prisma:2881-3015` are the Content-reels pipeline, not explanatory copy.)
- **No COA teaching layer landed in code:** `grep -rin "teaching layer|teachingLayer"` `src/ prisma/` → 0 hits.
- **Where copy lives today:** hardcoded JSX strings in components — e.g. showroom intro `OperationsShowroom.tsx:80-85`, panel captions `home/ProjectCreateForm.tsx:133-136,196-198`, `EvolutionPreview.tsx:28-30,57-59`, module blurbs `ModuleLauncher.tsx:30-35`. → Narrative blocks would be a **content file/component**, not a schema addition (no DB mechanism exists).

---

## C. REUSABLE — fits with zero/trivial change (cited)

- **`OperationsShowroom` + `Panel`** (`OperationsShowroom.tsx:42-120`) — the locked-demo container, already wired into the home page. Adding/replacing panels is a content edit.
- **`onRequireAuth` gating trigger** — single prop already threaded from `page.tsx:74` → `ModuleLauncher` → showroom → every panel button. New gated buttons reuse it verbatim (`OperationsShowroom.tsx:62-71`).
- **`home/ProjectCreateForm` / `RoutineCreateForm` / `ContentPreview` / `EvolutionPreview`** — fetch-free extractions of the real components; the established "copy the real UI, strip fetches, gate actions" recipe (`home/ProjectCreateForm.tsx:3-21`).
- **`ListManager`** (`workbench/operations/projects/ListManager.tsx`) — pure, fetch-free; already reused unchanged in the showroom (`home/ProjectCreateForm.tsx:24,92`). Safe in a guest render.
- **Status pills / labels** `projects/types.ts` (`STATUS_LABELS`, `STATUS_PILL_CLASSES`, imported `ProjectRow.tsx:21`) — pure constants, reusable for a read-only backlog render.
- **Module section shell** `ModuleLauncher.tsx:153-167` — the alternating-bg full-width band + single purple header is the layout slot a pipeline showroom drops into.
- **`requireTier` / `canAccess`** (`auth-helpers.ts:41-49`, `tiers.ts:64-69`) — reusable to enforce paid gating **server-side** once an `operations` tier flag is added (it isn't today — see D/E).

---

## D. COUPLING MAP — what a locked guest render must sever/stub

Every dependency the live pipeline UI carries, and the locked-render implication:

| Coupling point | Cite | Locked-guest implication |
|---|---|---|
| `useOperationsEntity()` context (throws if no provider) | `EntitySelector.tsx:30-35` | Must wrap in `OperationsEntityProvider` **or** use a fetch-free variant. The provider itself fetches `/api/entities` on mount `:57-79` (guest → middleware redirect/401). The showroom sidesteps this by not using the context (`home/ProjectCreateForm.tsx:72-77` stubs the entity `<select>`). |
| `SectionD` mount fetch `GET /api/operations/projects` | `SectionD:55,70-73` | Live component **self-fetches on render** → for a guest this returns nothing (auth redirect). Must be stripped (fetch-free extraction) or fed seed data (none exists, B.1). |
| Entity context mount fetch `GET /api/entities` | `EntitySelector.tsx:61` | Same — must be stubbed. |
| `TaskList` mount fetch `GET .../tasks` + `GET /api/chart-of-accounts` | `TaskList.tsx:49,89` | Step-5 queue self-fetches; must be stubbed for a guest. |
| `EvolutionTimeline` mount fetch `GET .../evolution` | `EvolutionTimeline.tsx:109` | Already solved by `EvolutionPreview` (fetch-free) `EvolutionPreview.tsx:6-9`. |
| `DependencyList` mount fetch | `DependencyList.tsx:60` | Must be stubbed (no fetch-free variant exists yet). |
| **PAID** generate-design / generate-tasks | `ProjectRow:215,252` → Anthropic `ai/client.ts:17-24` | Must route to `onRequireAuth`, never fetch (the showroom's hard line, `home/ProjectCreateForm.tsx:5-16,127`). |
| Mutations (PATCH/DELETE/archive/bulk-create/daily-plan) | `ProjectRow:166,296,323`; `TaskRow:226,286,309`; `AITaskPreview:124` | All must gate to login, not fetch. |
| `AppLayout` shell (operations layout) | `operations/layout.tsx:19` | The home page does **not** use AppLayout; the showroom renders inside `ModuleLauncher`'s plain section, so this coupling is naturally severed by living on `/`. |

**Net:** a full-pipeline locked render needs a **fetch-free, props-seeded** sibling of `SectionD_ProjectBacklog` + `ProjectRow` + `TaskList` + `DependencyList` (the EvolutionTimeline already has one), plus seed data to populate it (currently **MISSING**). The simplest precedent-aligned path reuses the existing extraction recipe.

---

## E. SECURITY FLAGS

**No data-leak or unauth'd-paid-API path found in the current code.**

- **Real-user-data leak risk — MITIGATED today, but a live mount on `/` would be the risk.** `GET /api/operations/projects` is auth-gated `route.ts:42` and user-scoped `user_id: user.id` `route.ts:57`; a guest gets 401 (no data). The danger is *only* if a future implementation server-renders the live pipeline **with a session** or fetches without the guest gate. The existing showroom avoids this by being fetch-free (`OperationsShowroom.tsx:4-5`). **No CRITICAL present**, but flag: **do not** SSR the live `SectionD` into the public page or feed it any real `user_id` — that would leak the admin/owner's backlog.
- **Paid-API exposure — MITIGATED.** `generate-design`/`generate-tasks` are auth-gated (`generate-design/route.ts:45`, `generate-tasks/route.ts:46`) and only fire on button click; the showroom gates those buttons to login (`home/ProjectCreateForm.tsx:127`). No render path calls Anthropic. Keep this invariant for any new pipeline panels.
- **Gating-strength note (not a leak):** Operations projects are protected by **auth only**, not by a paid tier — no `requireTier`/operations flag exists (`tiers.ts:17-25`; none of the 12 operations routes call `requireTier`). If "interaction requires … paid account" must be enforced server-side (not just UI), that enforcement **does not exist yet**. Today any *logged-in* user (any tier) can use the pipeline. (Auth-gating still prevents guest access, so this is a tiering gap, not a public leak.)
- **Stale comment** `ModuleLauncher.tsx:111` claims "hardcoded sample data" — the panels are actually empty; no fabricated data is shown. Not a security issue, noted for accuracy.

---

## F. ALEX-SIDE CHECKS

- **Vercel env:** confirm `ANTHROPIC_API_KEY` is set (read at `ai/client.ts:19`) — relevant only to logged-in AI; the locked showroom must never reach it. Confirm Stripe env (`getStripe()` / `getPriceIdFromTier` in `stripe/checkout/route.ts:21,43`) — **NOT VERIFIED** which env var names `getStripe()` reads (file not opened). Verify the Stripe price IDs map to the tiers you intend to sell Operations under.
- **Tier decision (psql / product):** there is no `operations` entitlement in `tiers.ts`. If Operations should be a paid feature, decide which tier unlocks it and whether to add server-side `requireTier` — Alex's call.
- **psql (auditor cannot reach DB):**
  ```sql
  -- How many real projects/tasks exist (would they ever be at risk of a public render?)
  SELECT count(*) FROM operations_projects;
  SELECT count(*) FROM operations_tasks;        -- table name NOT VERIFIED; confirm
  -- Confirm whose data the pipeline holds (single-owner today?)
  SELECT user_id, count(*) FROM operations_projects GROUP BY user_id;
  ```
- **Confirm `/api/auth/me` stays public** (relied on by `ModuleLauncher.tsx:55` for client auth detection); it is public via the `/api/auth` prefix (`middleware.ts:55`).

---

## G. SUGGESTIONS (not verified needs)

Auditor opinion only:

1. **Reuse the existing extraction recipe** (`home/ProjectCreateForm.tsx:3-21`) to build a fetch-free `SectionD`/`ProjectRow`/`TaskList`/`DependencyList` so the *full* populated pipeline can render publicly without touching the live, user-scoped components. `EvolutionPreview` is the template.
2. **Introduce a static seed/demo dataset** (a TS constants module, not a DB table) to populate the locked pipeline — there is no fixture mechanism today (B.1), and the queues are otherwise empty.
3. **Narrative layer = a content file/component**, not a schema change: no DB copy mechanism exists (B.3), and all current copy is inline JSX. A `pipelineNarrative.ts` constants map keyed by step (goal/problem/diagnosis/design/execute/evolution/dependencies) mirrors how `ModuleLauncher.MODULES` blurbs already work (`ModuleLauncher.tsx:30-35`).
4. **Keep the hard security invariant** from `home/ProjectCreateForm.tsx:5-16` for every new panel: no fetch on render or submit; all actions → `onRequireAuth`. Never SSR the live `SectionD` with a session into `/`.
5. **If paid-account gating must be enforced beyond the UI**, add an Operations entitlement to `tiers.ts` and `requireTier` to the operations routes — currently auth-only (E).
6. **Fix the stale `ModuleLauncher.tsx:111` comment** in whatever PR implements this, so "sample data" matches reality.

---

*End of audit. No application code was modified; only this report was created.*
