# PRE-PUBLISH SECURITY + INVESTOR-READINESS AUDIT (read-only)

**Branch:** `claude/audit-pre-publish-security` · **Date:** 2026-06-21 · **Scope:** gate a PUBLIC post (to
investors AND users) of a PUBLIC repo readable by hostile actors. Two bars: **(A) attack-surface safety**,
**(B) presentation.** Read-only; every claim cites `file:line`. Unread = "NOT VERIFIED." 276 API routes;
breadth covered by grep + two read-only sub-agents (paid-API surface, IDOR sweep), criticals read directly.

---

## ⛔ POST-READINESS VERDICT: **NOT SAFE TO POST TODAY — 2 mandatory blockers**

1. **IDOR — cross-user destructive delete** at `trips/[id]/destinations/route.ts:391` (any logged-in user
   can delete another user's trip destinations). **Must fix before public exposure.**
2. **`audits/` (16 files) + `audit-reports/` (284 files) are tracked → public.** They expose internal
   security reasoning, a `file:line` codebase map, live entity UUIDs — **including THIS document, which
   names the IDOR above.** Publishing a vuln map to hostile readers is self-defeating. **Pull private (or
   land the IDOR fix first).**

Everything else below is **strongly recommended** but those two are non-negotiable. Once they land, the
core posture (auth, secrets, cost surface, user-scoping) is **solid and investor-credible.**

---

# PART A — SECURITY

## A1 — ROUTE AUTH POSTURE (276 routes; category summary + the no-auth set)

**246/276 routes call an auth primitive** (`getVerifiedEmail`/`getCurrentUser`/`requireUser`/`requireTier`/
`requireAdmin`). The dominant, **correct** pattern (verified across the GRC, operations, trips, financial
trees by the IDOR agent): ownership `findFirst`/`findUnique` (direct `user_id` or parent chain) → defensive
404 → then mutate.

| Route group | Auth posture | Status |
|---|---|---|
| `auth/*` (login/register/signup/logout/[…nextauth]) | No user-auth (they ARE auth); generic messages | **FULL** (intentional) |
| `admin/*` | self-gated: `adminSession` HMAC cookie or bearer | **FULL** |
| `cron/*`, `*/audit-ingest`, `*/exec-ingest` | shared-secret **bearer, validated first** | **FULL** |
| `stripe/webhook`, `inngest` | signature / signing-key verified | **FULL** |
| Travel public set (12 routes) | **no cookie auth (by design)** + per-IP rateLimit + daily cap | **PARTIAL-by-design** (A3) |
| AI / Plaid / trading / transactions / hub / income / metrics / operations / GRC | `getVerifiedEmail` → user lookup → user-scoped | **FULL** |
| `test/*` (4 debug routes) | none; **not public** (cookie-gated) but ship to prod | **FLAG** (remove) |
| `developer/prospects/[id]`, `citations/[id]/verify` | authed but **not ownership-scoped** (global tables) | **PARTIAL** (A4) |

**The 30 routes with NO in-file auth primitive**, categorized (all accounted for):
- **Auth (5):** login, register, signup, logout, [...nextauth] — they *are* the auth surface. ✓
- **Public travel (9):** flights/search, flights/payment-intent, travel/{activities/search, hotels/content,
  hotels/reviews, liteapi/prebook, locations/cities, locations/countries, visa/check} — token-less by
  design, rate-limited (A3). ✓
- **Webhook/infra (3):** stripe/webhook (sig), inngest (signing key), cron/auto-categorize (`Bearer
  CRON_SECRET`, `:18`). ✓
- **Token-gated ingest (2):** audit-ingest, exec-ingest — bearer validated FIRST (`audit-ingest:39-40`). ✓
- **Admin (1):** admin/verify — the bcrypt admin-password login (sets HMAC `adminSession`). ✓
- **Reference data (2):** destinations, resorts — static `ACTIVITY_TABLE_MAP` reads; cookie-gated, no user
  data. ✓
- **Token-invite (2):** trips/rsvp, trips/[id]/participant — `?token=` invite-link auth (server validates
  the token). ✓ (note: cookie-gated middleware may block logged-out invitees — *functional*, not security.)
- **Test/debug (4):** test/{convergence-pipeline, data-audit, tt-candles} (+ test/convergence has auth) —
  cookie-gated but **should not ship** (A2). **FLAG.**
- **Other (1):** rfp (POST, cookie-gated; any authed user). Low priority.

## A2 — PUBLIC_PATHS (`middleware.ts:50-87`)

Quoted set: `/`, `/admin`, `/api/admin/verify`, `/api/admin/users`, `/api/auth`, `/_next`, `/favicon.ico`,
`/pricing`, `/api/stripe/webhook`, `/api/inngest`, `/opengraph-image`, `/terms`, `/privacy`, + 12 travel
routes (`/api/flights/{search,book,payment-intent}`, `/api/travel/{hotels/search, hotels/content,
hotels/reviews, activities/search, visa/check, locations/countries, locations/cities, liteapi/prebook,
liteapi/book}`). Plus 2 dynamic bypasses (`*/audit-ingest`, `*/exec-ingest`, `:106,115`).

**Audit of each:**
- `/api/admin/users` (public) → **NOT a leak**: the route self-gates on an HMAC `adminSession` cookie
  (`admin/users/route.ts:10` → 401), `select` excludes `password`. The PUBLIC_PATHS entry only bypasses the
  *user*-cookie redirect; admin auth is enforced in-route. ✓
- `/api/admin/verify` (public) → the admin-password login (bcrypt vs `ADMIN_PASSWORD`, `:17`); generic
  "Invalid password". ✓
- `/api/stripe/webhook`, `/api/inngest` → signature/signing-key gated. ✓
- 12 travel routes → return travel *search* data (no personal data) + cost money → rate-limited (A3). ✓
- **No test/debug route is in PUBLIC_PATHS.** ✓ (the 4 `test/*` are cookie-gated, not public — but still
  should be removed, A1.)

→ **No PUBLIC_PATHS entry returns another user's personal data or makes an unguarded paid call.**

## A3 — PAID-API COST SURFACE (guest-triggered spend) — **NO COST-LEAK**

Sub-agent verified, every claim `file:line`. **Every guest-reachable paid call is rate-limited before the
provider call**; all genuinely-paid ones also carry a durable daily cap (`reserveTravelSearch`).

| Provider | Guest-reachable routes | Guard |
|---|---|---|
| Duffel (flights) | `flights/search:54`, `flights/payment-intent:55` (TEST mode), `flights/book:85` | per-IP `rateLimit` + daily cap (`flights/search:27,49`; `book:41,97`) |
| LiteAPI (hotels) | `hotels/search:83`, `hotels/content:38`, `hotels/reviews:42`, `liteapi/prebook:40`, `liteapi/book:132`, `locations/{countries,cities}` | per-IP `rateLimit` + cap (e.g. `book:50` limit 3/300s); location lists per-IP only (cheap, by design) |
| Viator (activities) | `activities/search:67` | `rateLimit` + cap (`:43,61`) |
| Travel Buddy (visa) | `visa/check:64` | `rateLimit` + cap (`:33,59`) |
| Stripe | `stripe/webhook:30` (`subscriptions.retrieve`) | `constructEvent` HMAC verify FIRST (`:16-20`) — unforgeable |
| **Anthropic, OpenAI, xAI, Plaid, Finnhub, FRED, Google Places, Stripe checkout/portal** | — | **AUTHED-ONLY** (none in PUBLIC_PATHS; sampled `places/photo`, `finnhub/ticker-context`, `data-observatory/check` also self-401) |

**Lower-severity (not leaks):** (1) rate-limit key derives from client `x-forwarded-for`/`x-real-ip` (e.g.
`flights/search:20-23`) — header rotation can fragment the per-IP counter, but the **global daily cap is the
backstop**; confirm Vercel strips inbound XFF (it does on Pro). (2) `test/*` debug routes call FRED/Finnhub/
Grok — authed-only, but remove for prod.

## A4 — USER-SCOPING / DATA-LEAK (IDOR) — **1 CRITICAL + 3 review**

Sub-agent swept all `[id]` routes + body-id mutations. The vast majority are correctly scoped (ownership
`findFirst({ id, userId })` → 404 → mutate). Exceptions:

- **🔴 CRITICAL — `trips/[id]/destinations/route.ts:391` (DELETE):** the trip is ownership-checked
  (`:377` `trips.findFirst({ id, userId })`), but the `destinationId` branch does
  `prisma.trip_destinations.delete({ where: { id: destinationId } })` — **scoped only by the row's own id,
  not re-tied to the owner.** An authed user passes their own trip `id` + a `destinationId` from **another
  user's** trip → **deletes it.** Cross-user destructive write. **LAUNCH BLOCKER.** *(The sibling
  compound-key path `:394` is safe.)*
- **🟠 `citations/[id]/verify/route.ts:17,30`:** `findUnique({ id })` + `update({ id })` with **no scope**;
  also fires `verifyCitation()` which may hit a **paid external service**. `citations` is a global reg
  library (no `userId`). Any authed user can trigger a paid verify + overwrite shared verification status —
  violates "no authed-but-unauthorized paid call." **Gate it (authorization + rate).**
- **🟠 `developer/prospects/[id]/route.ts:18-20,42-44` (PATCH/DELETE):** unscoped `update`/`delete` on
  `prospects` (no `userId` column → global CRM). Any authed user edits/deletes any lead. **By-design
  (global) vs needs-scoping is a schema question → HARD GATE / Alex's call.**
- **🟡 `trips/[id]/ai-assistant/route.ts:223-230`:** the LiteAPI branch does `trips.findFirst({ id: tripId })`
  with **no `userId`** (tier-gated but not ownership-checked) → a tier-holder can run a paid hotel scan
  against another user's trip + read its dates/participant count. **Consistency fix** (add `userId`).

> Note: prospects/citations have **no `userId` column** — fixing them by scoping is a **schema migration =
> HARD GATE** (CLAUDE.md). Confirm intent with Alex before changing; the `destinations` and `ai-assistant`
> fixes are pure code.

## A5 — COOKIE / AUTH HYGIENE — **SOLID** (one gap)

- **HMAC-signed `userEmail` cookie**, verified both edge (`middleware.ts:9-42`) and node
  (`cookie-auth.ts:26-47`), **timing-safe** comparison (`cookie-auth.ts:41`), normalized lowercase
  (`:60`). ✓
- **No raw-cookie trust:** `cookies.get('userEmail')` appears ONLY in `cookie-auth.ts` + `middleware.ts`
  (both HMAC-verify) — **no route reads it as a bare email.** ✓
- **Generic auth messages (anti-enumeration):** login returns "Invalid email or password" for both
  no-user and bad-password (`auth/login:26,34`); register returns a single generic message whether or not
  the email exists (`auth/register:25,33,50`). ✓
- Cookies `httpOnly` + `secure` + `sameSite:lax` (`auth/login:46-52`). ✓
- **GAP (HIGH):** **NO rate-limiting on `auth/login`, `auth/register`, `admin/verify`** — credential
  brute-force / no lockout (bcrypt slows but doesn't stop). Add the existing `rateLimit` lib.

## A6 — SECRETS / PII IN TRACKED FILES — **CLEAN**

Grep of tracked files for key/connection-string/token patterns: only **placeholders** in `.env.example`
(`ANTHROPIC_API_KEY="sk-ant-..."` `:28`, `DATABASE_URL="postgresql://user:password@host…"` `:9`,
`XAI_API_KEY="xai-..."` `:49`), the `xai-sdk` **package name** in `package.json`, and a `postgres://
regulatory_documents#raw_xml` **storage-URI label** (not a connection string) in `corpus/ingest/*`. **No
real secret committed.** `.env*` is gitignored (`.gitignore:39`). ✓ (No secret values printed here.)

## A7 — THE GUEST SURFACE (just-built) — **ZERO authed-fetch / ZERO DB-write**

Re-verified against the merged guest PRs: **empty Runway** (calendar `demoEvents={[]}` skips all 3 authed
fetches; `RunwayBudgetPanel preview` suppresses `/api/runway` + `/api/trading/realized-pnl` + budget fetches
and renders zero-shells, **no `RunwayDataProvider`** so no `/api/hub/*` fires); **in-memory Routines**
(`RoutineCreateForm` builds in React state — no fetch, no DB, no localStorage); **Travel** (search/book are
intentionally public + rate-limited, A3). **No guest action hits an authed route, writes a DB row, or
exposes a route.** No regression. ✓

---

## CRITICAL ISSUES — ranked

| # | Severity | Issue | `file:line` |
|---|---|---|---|
| 1 | **CRITICAL** | IDOR: cross-user `trip_destinations` DELETE (own trip id + other user's destinationId) | `trips/[id]/destinations/route.ts:391` |
| 2 | **HIGH (pre-post)** | `audits/`+`audit-reports/` public → vuln map / codebase map to hostile readers | tracked dirs (300 files) |
| 3 | **HIGH** | No rate-limit on `auth/login`, `auth/register`, `admin/verify` → brute-force | `auth/login`, `auth/register`, `admin/verify/route.ts` |
| 4 | **MEDIUM** | `citations/[id]/verify` unscoped + fires a possibly-paid external verify, authed-but-unauthorized | `citations/[id]/verify/route.ts:17,30` |
| 5 | **MEDIUM** | `trips/[id]/ai-assistant` LiteAPI branch: trip not ownership-checked (cross-user read + paid scan) | `trips/[id]/ai-assistant/route.ts:223-230` |
| 6 | **MEDIUM** | 4 `test/*` debug routes ship (some call paid FRED/Finnhub/Grok) | `test/{data-audit,convergence,convergence-pipeline,tt-candles}` |
| 7 | **LOW** | `developer/prospects/[id]` PATCH/DELETE unscoped (global table — confirm by-design) | `developer/prospects/[id]/route.ts:18,42` |
| 8 | **LOW** | rate-limit key client-controlled (XFF) — daily cap backstops; confirm Vercel strips inbound XFF | `flights/search:20-23` (pattern) |
| 9 | **LOW** | ~118 routes echo `error.message` to client (minor info leak) | repo-wide pattern |

## CLEAN BILL — already solid

- HMAC cookie auth (timing-safe, lowercased, httpOnly/secure, no raw-cookie trust).
- Generic anti-enumeration on login **and** register.
- Self-gated admin routes; bearer-gated cron + audit/exec-ingest (token-FIRST); signature-gated Stripe +
  Inngest.
- **No committed secrets; `.env*` gitignored.**
- **No guest-reachable paid call without a rate limit** (all travel public routes guarded + daily-capped).
- Guest surface fires zero authed fetches / zero DB writes.
- Dominant correct user-scoping pattern across operations/GRC/trips/financial trees (IDOR agent verified
  SAFE on dozens of `[id]` routes).

---

# PART B — INVESTOR READINESS

## B1 — REPO HYGIENE
- **README.md** present + professional (BSL 1.1 badge, quick-start/docs/licensing sections, tagline). ✓
- **LICENSE** present (BSL 1.1). ✓
- **`console.log`: 322 occurrences across 58 files** — debug-log spam; clean up for DD.
- **TODO/FIXME/HACK/XXX: 26** — moderate, acceptable.
- **`audits/` (16) + `audit-reports/` (284) tracked → public** — exposes internal reasoning, security
  findings (incl. this file), live entity UUIDs, and a `file:line` map of the codebase. **Strong flag for
  Alex: gitignore / move private before the post** (a sharp investor reading them is fine; a hostile actor
  reading them is the problem — and #1 above is literally documented in them).

## B2 — CONSISTENCY / PROFESSIONALISM
- **Auth pattern is consistent** (the `getVerifiedEmail → user lookup → user-scope` recipe is near-uniform;
  the IDOR gaps are deviations from it, not an absence of pattern). ✓
- **Error handling:** consistent `try/catch` → JSON error, BUT **~118 routes return `error.message` /
  `error instanceof Error ? error.message` to the client** — leaks internal messages (DB errors, stack
  hints) and reads unpolished. Replace with generic client messages + server-side logging.

## B3 — WHAT A SHARP INVESTOR (TECHNICAL DD) WOULD FLAG
1. **The IDOR (#1)** — a single cross-user delete is the kind of finding that tanks a technical DD; fix
   before anyone looks.
2. **Public internal audits** — handing a vuln roadmap to the world reads as a process gap.
3. **No auth rate-limiting** — table-stakes for a finance product.
4. **Debug `test/*` routes in prod** + **322 console.logs** + **raw error messages** — "not production-
   hardened" signals.
5. **Positive signals to lead with:** HMAC auth, no committed secrets, a real cost-control layer
   (rate-limit + daily caps on every paid guest call), and a consistent user-scoping pattern — these are
   above-average for a solo build and worth surfacing.

---

## PRIORITIZED FIX SEQUENCE (atomic, one-concept PRs — security first, do NOT bundle)

1. **PR-1 (CRITICAL — pre-post blocker):** Fix `trips/[id]/destinations` DELETE — verify the
   `destinationId` row's `tripId` equals the ownership-checked trip before deleting (pure code, no schema).
2. **PR-2 (HIGH — pre-post blocker):** Make `audits/` + `audit-reports/` private — gitignore + `git rm
   --cached` (or move to a private location). Decision: Alex. *(Do before/with the post.)*
3. **PR-3 (HIGH):** Rate-limit `auth/login`, `auth/register`, `admin/verify` (reuse `@/lib/rateLimit`,
   per-IP).
4. **PR-4 (MEDIUM):** Authorize + rate `citations/[id]/verify` before its paid external verify (and decide
   global-vs-scoped — flag the schema HARD GATE for prospects/citations).
5. **PR-5 (MEDIUM):** Add `userId` to the `trips/[id]/ai-assistant` LiteAPI trip lookup.
6. **PR-6 (MEDIUM):** Delete the 4 `test/*` debug routes.
7. **PR-7 (PRESENTATION):** Stop returning `error.message` to clients (generic responses + server log);
   trim `console.log` spam.

**Mandatory before the post: PR-1 and PR-2.** PR-3 strongly recommended same-day. The rest can follow.

## DB CHECKS FOR ALEX (psql — to confirm exploitability/intent; no secrets)
1. **Confirm the IDOR is exploitable** (rows aren't user-isolated): `SELECT "tripId", count(*) FROM
   trip_destinations GROUP BY "tripId" LIMIT 5;` — confirms a `destinationId` maps to one trip, so a
   cross-trip delete hits another owner's row.
2. **Confirm prospects/citations are global** (no per-user column → scoping = migration): the code already
   shows no `userId`; `\d prospects` / `\d citations` confirms before any schema decision.

---

*Read-only audit. No code changed; this `.md` is the only file created (note: it should itself go private
per B1/#2 before the post). Breadth via grep + two read-only sub-agents; criticals read directly. Every
claim cites `file:line`. The two blockers — the `trips/destinations` IDOR and the public audit dirs — must
be resolved before the public post; the remainder is strongly recommended hardening.*
