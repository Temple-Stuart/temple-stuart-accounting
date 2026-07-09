# TAB-PAYWALL-AUDIT — the per-tab "show it, lock it" pattern: where it exists, where it breaks

**Date:** 2026-07-09 · **Branch:** `claude/tab-paywall-audit` · **Base:** main @ `89fad64d` · **READ-ONLY — audit doc only, no code changed.**

**Verdict up front:** the target pattern — *show the client what the product does, lock actual USE behind (paid-for-that-tab + logged-in)* — **already exists in the codebase, split across two halves that have never been joined.** Travel's premium categories implement the LOCK half (locked card → no mount → no spend → server 403 → unlock CTA). The Projects/Content showroom implements the SHOW half (the full pipe rendered with static demo data, every action routed to one lock handler). Four tabs (Trade, Books, Tax, Compliance) have NEITHER half — they hide a live product behind an admin wall and a "coming soon" label. And the entitlement table needed for per-tab purchase **already exists and needs no migration** — but nothing writes to it.

---

## 1. Per-tab: what a guest sees, what gates use, where the LOOK/USE line sits

| tab | logged-out sees (LOOK) | USE gated by | LOOK/USE line drawn? | matches "show-but-lock"? |
|---|---|---|---|---|
| **Runway** | real empty calendar grid, zero fetches (`ModuleLauncher.tsx:598-615`; demo guard `HubCalendar.tsx:105, 172-180`) + budget panel in preview: "No bank linked", "—", trading "not tracked yet" (`RunwayBudgetPanel.tsx:186-198, 253, 296-306`) | auth only (middleware page wall) | yes, but the LOOK shows chrome, not value — an empty grid demonstrates nothing | **partial** — honest, fetch-free, but no demo of the pipe; free module, so lock = login only |
| **Travel** | **the real product, live**: flight/hotel/transfer/activity/visa searches fire real vendors; premium categories render 🔒 locked cards (`PublicCategorySearch.tsx:67-94`); 3 honest coming-soon rows (`ComingSoonSection.tsx:8-9, 23-34`) | free surface: rate caps only; trip SAVE: auth (`ModuleLauncher.tsx:348-355`); premium categories: **per-key entitlement** + server 403 (`categoryLock.ts`; `category-search` route) | **yes — the cleanest line in the app**: look/search free, save needs login, premium keys need entitlement | ✅ **the reference** (but the unlock CTA is a placeholder — §2) |
| **Routines** | the REAL create form, fetch-free: build/delete routines in-memory, honest "in your browser (not saved)" (`RoutineCreateForm.tsx:64-70, 211-213, 236-239`) | auth (persist); "Make a free account" CTA appears after ≥1 routine built (`:271-283`) | yes — try locally / save behind login | **mostly** — show + hands-on try; lock is auth-only, no purchase concept |
| **Projects** | the FULL pipe as a static showroom: 5-step scoping, research/audit inputs, design w/ reasoning, 4 demo tasks, evolution timeline, dependencies (`OperationsPipelineShowroom.tsx:64`; `ProjectsPipelineShowroom.tsx:236-294`; seed `demoData.ts:52-362`) | auth — **every** action incl. the paid AI triggers routes to one `lock = () => onRequireAuth()` (`ProjectsPipelineShowroom.tsx:60-63, 285-286`) | yes — look at everything, do nothing without login | **mostly** — SHOW half is exemplary; lock is auth-only, no purchase |
| **Content** | same showroom: Day calendar demo + finished reel Script demo (`OperationsPipelineShowroom.tsx:69-101`; seeds `content/showroom/demoData.ts:45-213`) | auth — all actions `= lock` incl. the paid generate (`:94-100`) | yes — same | **mostly** — same |
| **Trade** | **nothing** — "Trading — coming soon." stub + "Launch Trading Module" → login modal (`ModuleLauncher.tsx:508-520` via `:821-823`) | homepage surface: **isAdmin** (`:791`); `/trading` page + `/api/trading/trades`: auth only (no tier); only `realized-pnl` is tier-gated | no line — the product is invisible to guests AND fully open (page-level) to any registered user | ❌ **inverted** — hides instead of shows, mislabels live as coming-soon, and the direct URL skips the lock |
| **Books** | same stub (`:881-883`); `BooksPipeline` has no preview/guest mode (self-fetches 8 authed routes on mount, `BooksPipeline.tsx:78-126`) | homepage: **isAdmin** (`:836`); APIs: plaid tier-gated, ledger/statements auth-only | no line | ❌ |
| **Tax** | same stub (`:896-900`); `TaxHandoffGate` has no preview mode (`TaxHandoffGate.tsx:43-72`) | homepage: **isAdmin** (`:896`); APIs: auth-only (no tier anywhere on tax) | no line | ❌ |
| **Compliance** | same stub (`:913-917`); `ComplianceWorkbench` has no guest variant (`ComplianceWorkbench.tsx:39-69`) | homepage: **isAdmin** (`:913`) | no line | ❌ |

Confirmed per-tab: the prior audit's finding holds everywhere — **the homepage's only identity gate is `isAdmin`; tier appears in zero homepage decisions.**

## 2. The reference pattern (Phase 2)

### 2a. Travel's locked category — the LOCK half, anatomized (`src/components/trips/PublicCategorySearch.tsx`)

1. **Client lock decision:** `isCategoryLocked(catKey, entitledCategories, currentUserId)` (`:65`; helper `src/lib/categoryLock.ts` — admin never locked, non-Google keys free, else locked-unless-entitled). Entitlements arrive with the SAME `/api/auth/me` call the launcher already makes (`ModuleLauncher.tsx:203-206`) — no extra fetch.
2. **Locked render:** a 🔒 card with the category label, a one-line value explainer ("Subscribe to see top-rated {label} with prices"), and a **"Subscribe to unlock"** button (`:75-94`).
3. **Zero-spend by construction:** the search child (form + fetch + fan-out effect) is a separate component that **never mounts while locked** (`:96-109, 171-180`) — a locked tab cannot cost a cent even via the shared fan-out bar.
4. **Defense in depth:** the client lock is UX; the server route re-gates per-category and 403s "Category not unlocked" — and the client surfaces that 403 plainly if they ever disagree (`:11-13, 147-153`).
5. **The unlock is a stub:** `onRequestUnlock` = `console.log` + open the sign-up modal — "Stripe checkout is a later PR" (`:69-74`).

### 2b. What exists to build per-tab entitlement on — **no schema change needed**

- **The entitlement table is already generic.** `UserCategoryEntitlement` (`prisma/schema.prisma:1195-1207`): `userId + categoryKey String` (unique pair), `status`, **`stripeSubscriptionId`**, **`currentPeriodEnd`** — exactly the shape a per-tab purchase needs. Nothing in the schema restricts keys to Google categories; that restriction lives only in app code (`categoryLock.ts` checks `GOOGLE_CAT_SET`; `entitlements.ts:24-31` returns whatever active rows exist). Per-tab keys (e.g. `tab:trade`, `tab:books`) can ride the same table. **MIGRATION VERDICT: none required.** (The model's *name* says "Category" — renaming would be a cosmetic migration and is not needed.)
- **The read path exists:** `getEntitledCategories` (`src/lib/entitlements.ts:20-33`, fail-loud, admin gets all) → shipped to the client via `/api/auth/me` (`me/route.ts:48`). A `getEntitledTabs`/`isTabLocked` twin is pure app code.
- **The write path does NOT exist:** a repo-wide grep finds **exactly one** reference to `userCategoryEntitlement` — the read at `entitlements.ts:24`. **Nothing anywhere creates/updates entitlement rows.** Today every non-admin user has zero entitlements; all 9 categories are permanently locked; the "Subscribe to unlock" button leads nowhere but sign-up. The purchase backbone (per-key Stripe prices + webhook writing entitlement rows) is unbuilt.
- **The tier system is a different axis.** `tiers.ts` grants per-FEATURE booleans by bundle (free/pro/pro_plus) — it has no per-tab concept and cannot express "buy 1, some, or all tabs." The two axes already coexist in code (`canAccess` vs `isCategoryLocked`) without conflict: tiers could remain as bundles while per-tab entitlement rows carry à-la-carte purchases — or tiers retire into bundle-SKUs that grant entitlement rows. That is a product ruling for Alex, not a technical blocker.
- `UpgradePrompt.tsx` (dead code, zero importers) renders "{feature} requires Pro/Pro+ ($20/$40/mo) → View Plans" — tier-bundle copy that predates the per-tab model; wire-or-delete.

### 2c. The SHOW half already exists too

`OperationsPipelineShowroom` proves the codebase already knows how to demo a full pipe with **zero fetches and zero reachable paid calls**: static typed seed data, real leaf components, and every callback — including the paid Anthropic triggers — bound to a single `lock = () => onRequireAuth()` (`OperationsPipelineShowroom.tsx:58, 94-100`; `ProjectsPipelineShowroom.tsx:60-63, 283-286`). The target pattern for Trade/Books/Tax/Compliance is this showroom discipline + the locked-card CTA from 2a.

## 3. The consistency gap and the smallest path to the target

**Target:** every tab SHOWS the pipe (demo/live-free view) and LOCKS use behind per-tab purchase + login, with the server re-gating.

**Inconsistencies flagged (from §1):** Trade/Books/Tax/Compliance show nothing and gate on admin identity; their "coming soon" labels contradict live code; `/trading` bypasses the homepage wall entirely at the page level; Travel locks with a card while Trade stubs; Projects/Content lock on login where the target is purchase; the Runway trading 403 renders as an outage; the account-limit pricing claims remain unenforced.

**Ranked smallest-change list (report only — nothing built):**

1. **Entitlement plumbing (no migration):** add tab keys (`tab:trade`, `tab:books`, `tab:tax`, `tab:compliance`, …) to the existing table's vocabulary; `isTabLocked()` twin of `categoryLock.ts`; extend `/api/auth/me` payload with entitled tabs; **build the missing writer** — per-tab Stripe price IDs + the signature-verified webhook (PAYWALL pattern, `stripe/webhook/route.ts`) upserting entitlement rows with `writeAuditLog`, revoking on cancellation. This single item unblocks everything and also makes Travel's existing "Subscribe to unlock" real.
2. **Trade/Books/Tax/Compliance SHOW surfaces:** a fetch-free showroom/preview per tab (the `OperationsPipelineShowroom` discipline — static seed, every action → lock) replacing the stubs; locked-card CTA (the `PublicCategorySearch` render) as the lock face. Kill the "coming soon" copy — the honest label is "built — subscribe to unlock."
3. **Swap `isAdmin` → `isTabLocked` on the four homepage surfaces** (`ModuleLauncher.tsx:791, 836, 896, 913`); the admin bypass survives inside the lock helper exactly as it does in `categoryLock.ts`.
4. **Server-side per-tab defense-in-depth:** the tab APIs that are auth-only today (`/api/trading/trades`, the tax routes, ledger reads) get a per-tab entitlement gate mirroring `category-search`'s dual gate — needs Alex's scope ruling on which routes constitute each tab's "use" (HARD GATE: touches auth surface).
5. **Truth-label cleanup (can ship with #2):** Runway panel's 403 → an unlock prompt instead of "Trading unavailable"; wire-or-delete `UpgradePrompt`; align `/pricing` with the per-tab model (tier bundles vs à-la-carte is Alex's product ruling); enforce-or-remove the "10/25 accounts" bullets (standing PAYWALL-2 finding).

## One-paragraph summary

The platform already contains both halves of the target pattern, proven in production code: Travel's premium categories show exactly how to LOCK (entitlement-keyed 🔒 card, unmounted search child so a locked feature cannot spend, server 403 behind the client lock), and the Projects/Content showroom shows exactly how to SHOW (the full pipe on static seed data with every action — including paid AI calls — routed to one login-lock handler). Travel and Routines even draw a clean look/try/save line, and Runway is honest if empty. The gap is concentrated in the four admin-walled tabs — Trade, Books, Tax, Compliance — which show nothing, say "coming soon" about live software, and (for Trade) leak full page access to any registered user via direct URL. Per-tab purchase needs **no schema change** — the `UserCategoryEntitlement` table is already generic with Stripe fields and expiry — but it has **no writer anywhere in the codebase**, so today every lock is permanent and every "Subscribe to unlock" dead-ends at sign-up. The build order that closes the gap with the least motion: write the entitlement writer (per-tab Stripe prices + webhook), clone the two existing halves onto the four dark tabs, swap the admin gate for the tab lock, then re-gate the tab APIs server-side with Alex ruling the route scope.
