# README-REALITY-AUDIT — ground the rewrite in what's actually built

**Branch:** `claude/audit-readme-reality` · **Base:** main @ `5ce1bd7a` · **Date:** 2026-06-15
**Scope:** READ ONLY. No code, no README edits. This is the fact base + rewrite outline.

---

## 0. Headline findings (read first)

1. **License mismatch (biggest overclaim).** The README sells a **dual AGPL v3 + Commercial**
   model (`README.md:10`, `:942-990`), but the real `LICENSE` is **Business Source License
   1.1** — Licensor *Temple Stuart LLC*, Change Date **2028-01-01**, Change License **Apache
   2.0** (`LICENSE:1, :10-20`). The badge, the "AGPL v3 — Free Forever" panel, and the copyleft
   warning are all factually wrong. **This must be corrected, not restyled.**
2. **Everything is stamped "Production Ready."** All six module cards carry a
   `Status-Production Ready` badge (`README.md:143,163,200,216,234,249`) with exhaustive
   feature lists. The deep authenticated app *does* back most of these routes — but the
   README ignores the **newer public surface** (the tabbed home page) where several modules
   are **guest stubs / "coming soon" / static showrooms**. The honesty gap is "built as a
   deep authed route" vs "live on the public home page."
3. **The README predates the current product shape.** It has **no mention** of: the public
   **tabbed home** (`ModuleLauncher`), **Calendar** as a top-level module, **Operations** and
   **Compliance** as their own modules (it lists "Hub" + "Budgeting/6 modules" instead), the
   **cost-build pricing page** (`/how-pricing-works`), or the **LiteAPI (hotels)** and
   **Viator (activities)** integrations. Its integration diagram (`:126-127`) lists
   Plaid/Duffel/Google Places/Grok/OpenAI/Tastytrade/Stripe/Claude/Finnhub but **omits
   LiteAPI, Viator, FRED, EDGAR, Mozio**.
4. **The roadmap is stale.** "Mobile-Responsive UI" is listed as **not done** (`:1233`, 🔲)
   but the home page was made mobile-native in recent work (Mobile1/Mobile2/Edge-A/B). "Free
   & Paid Tiers (tier gating) ✅" (`:1217`) overstates: checkout CTAs are "Coming Soon" and a
   second, different **cost-build** pricing model now exists alongside the old tier page.

---

## 1. The current README — style to PRESERVE

- **Length:** `README.md` is **1356 lines** — long, marketing-grade.
- **Structure (section order, with line cites):**
  `:41` Table of Contents (in a `<details>`) → `:63` What is Temple Stuart? → `:106` Core
  Modules → `:269` Tech Stack → `:346` Integration Details → `:428` Architecture → `:830`
  Quick Start → `:928` Licensing → `:1011` Managed Hosting → `:1148` Documentation → `:1162`
  Roadmap → `:1254` Contributing → `:1294` Security → `:1311` Community & Support → `:1321`
  Contact.
- **Voice / style markers (keep these):**
  - A **capsule-render waving banner** with dark/light variants (`:2-6`).
  - A row of **shields.io `for-the-badge` badges** (License/TypeScript/Next.js/PostgreSQL,
    `:10-14`) + per-module `flat-square` Status badges.
  - **Emoji section headers** (`## 📦 Core Modules`, `## 🛠️ Tech Stack`, `## 🗺️ Roadmap`).
  - **YAML-in-a-`<table>`** identity block (`:69-98`), ASCII module/architecture diagrams
    (`:110-131`), two-column `<table>` feature cards, a rainbow `<img>` divider (`:35`).
  - Punchy **taglines** and one-liners.
- **Quote samples (match this voice):**
  - Title tagline (`:19`): **"Track your money. Trade smarter. Plan your life."**
    *(note: the live home hero now reads "Track your money. Plan your life. Act smarter." —
    the README tagline is slightly out of sync.)*
  - Sub-tagline (`:23-24`): *"A unified financial operating system for founder-traders,
    freelancers, and anyone who refuses to be 'simplified' by consumer finance apps."*
  - Module one-liners: *"Real accounting, not 'tracking.'"* (`:145`), *"Built by a daily
    options trader."* (`:165`), *"Activity-based, not destination-based."* (`:202`).
- **What it CLAIMS that may not be real (aspirational vs built):**
  - `version: 1.0.0` (`:71`) — aspirational version stamp.
  - Six modules **all "Production Ready"** (`:143…:249`) — true-ish for the deep authed
    routes, but the public home gates/stubs several (see §2).
  - **AGPL v3 dual-license** (`:10`, `:942-990`) — **wrong**; it's BSL 1.1 (see §3).
  - Module taxonomy ("Hub", "Budgeting / 6 modules") no longer matches the **7 home tabs**.

---

## 2. What's ACTUALLY built — the real route + module map

There are **two layers**, and the rewrite must distinguish them:

### Layer A — the deep authenticated app (many real routes)
`find src/app -name page.tsx` → real pages exist for, among others:
- **Public / shell:** `/` (`src/app/page.tsx`), `/how-pricing-works` (new cost-build page),
  `/pricing` (old 4-tier page), `/login`, `/privacy`, `/terms`, `/health`.
- **Bookkeeping:** `/ledger`, `/journal-entries`, `/chart-of-accounts`, `/transactions`,
  `/statements`, `/income`, `/accounts`, `/net-worth`, `/business`, `/personal`.
- **Trading:** `/trading`, `/dashboard`, `/data-explorer`, `/data-observatory`.
- **Tax:** `/dashboard/tax`, `/dashboard/tax-filing`.
- **Trips/Budgeting:** `/budgets/trips`, `/budgets/trips/new`, `/budgets/trips/[id]`,
  `/budgets/trips/[id]/discover/[category]/[rank]`, `/trips/[id]`, `/trips/rsvp`, `/shopping`,
  `/auto`, `/growth`, `/agenda`.
- **Hub:** `/hub`, `/hub/itinerary`.
- **Operations:** `/operations`, `/operations/projects`, `/operations/routines`,
  `/operations/issues`, `/operations/content`, `/operations/audit-log`.
- **Compliance:** `/compliance`, `/compliance/missions`, `/compliance/discovery`,
  `/compliance/citations`, `/compliance/registry`, `/compliance/profile`,
  `/compliance/audit-log`, plus `/soc2`.

So Operations and Compliance are **substantially built as authed routes** — even though the
README never names them as modules and the public home gates them.

### Layer B — the public tabbed home (`src/components/home/ModuleLauncher.tsx`)
The 7 tabs (`TABS`, `ModuleLauncher.tsx:51-59`) and their **public** reality:

| Tab | On the public home | Evidence |
|---|---|---|
| **Calendar** | **LIVE.** Real `HubCalendar` when logged in; static demo seed for guests. | `ModuleLauncher.tsx:359-372`; `src/components/hub/HubCalendar.tsx` |
| **Travel** | **MOSTLY LIVE.** Create-trip, trips list, budget-vs-actual (authed), live flight search, hotel search, activity search, visa check — all real; ground/insurance/eSIM/events are static "coming soon". | `ModuleLauncher.tsx:373-419`; `CreateTripForm`, `AllTripsList`, `TripBudgetActual`, `PublicFlightSearch`, `PublicHotelSearch`, `PublicActivitySearch`, `PublicVisaCheck`, `ComingSoonSection` |
| **Trade** | **PARTIAL.** Admin sees the real `ScanFilterForm` (routes to `/trading`); non-admins get a paid stub. | `ModuleLauncher.tsx:285-312` (`isAdmin` branch + default stub) |
| **Operations** | **SHOWROOM ONLY (on home).** Static `OperationsPipelineShowroom`, no live fetch — but `/operations/*` routes are real. | `ModuleLauncher.tsx:278-283` |
| **Books** | **STUB on home** (paid "coming soon") — but the bookkeeping routes (Layer A) are real. | `renderBody` default stub `:300-312` |
| **Tax** | **STUB on home** — but `/dashboard/tax*` routes are real. | `renderBody` default stub `:300-312` |
| **Compliance** | **STUB on home** — but `/compliance/*` routes are real. | `renderBody` default stub `:300-312` |

**Known live-but-gated bug (already audited):** budgeting a flight from the home Travel tab
always fires the login prompt even when logged in — `PublicFlightSearch` is search-only, its
commit is a stub (`PublicFlightSearch.tsx:149`). See `audit-reports/BUDGET-LOGIN-BUG-AUDIT.md`.
Relevant to the README's "Duffel Flight Booking ✅" claim — search is live, *commit-to-trip
from home* is not.

### Real API integrations (wired vs planned)
Installed SDKs (`package.json` dependencies): `@anthropic-ai/sdk ^0.96.0`, `@tastytrade/api
^6.0.1`, `openai ^6.7.0`, `plaid ^11.0.0`, `stripe ^20.3.0`, `xai-sdk ^1.0.0-alpha.0`.
Client libs in `src/lib/`: `duffel.ts`, `liteapiClient.ts`, `viatorClient.ts`, `plaid.ts`,
`tastytrade.ts`, `grok.ts` + `grokAgent.ts`, `stripe.ts`.

| Provider | Status | Evidence |
|---|---|---|
| **Duffel** (flights) | **Wired** | `src/lib/duffel.ts`, `src/app/api/flights/*` |
| **LiteAPI** (hotels) | **Wired** (16 refs) — *missing from README* | `src/lib/liteapiClient.ts` |
| **Viator** (activities) | **Wired** (12 refs) — *missing from README* | `src/lib/viatorClient.ts` |
| **Google Places** | **Wired** | `src/app/api/places/*`, `/destinations` |
| **Plaid** (banking) | **Wired** | `src/lib/plaid.ts`, `src/app/api/plaid/*` |
| **TastyTrade** (options) | **Wired** | `src/lib/tastytrade.ts`, `src/app/api/positions/*` |
| **Finnhub** (news/ratings) | **Wired** | `src/app/api/finnhub/*` |
| **FRED** (macro) | **Wired** (`api.stlouisfed.org`, 3 files) — *missing from README diagram* | convergence/trading libs |
| **SEC EDGAR** (filings) | **Wired** (`sec.gov`, 3 files) — *missing from README diagram* | discovery/convergence |
| **Anthropic Claude** | **Wired** (12 files) | `src/lib/ai/client.ts`, `api/ai/market-brief`, `api/ai/strategy-analysis`, `api/ops/ai-plan`, `api/ops/brain-dump`, discovery, news-classifier |
| **xAI Grok** | **Wired** | `src/lib/grok.ts`, `grokAgent.ts` |
| **OpenAI** | **Installed** (`openai` dep) | `package.json` |
| **Stripe** | **Wired lib**, but checkout is "Coming Soon" on pricing CTAs | `src/lib/stripe.ts`; old `/pricing` CTAs read "Coming Soon" |
| **Mozio** (ground transit) | **Referenced (4 files) but PARKED** — home "Getting around" is a `ComingSoonSection` | `ModuleLauncher.tsx:393-398` |

---

## 3. The real stack + infra (for an accurate Tech Stack section)

From `package.json` + repo:
- **Next.js `15.5.9`** (App Router), **React `18.3.1`**, **TypeScript `^5`** (README badge
  says "TypeScript 5.3" `:12` — close enough; pin to `^5`).
- **Prisma `^5.22.0`** (`@prisma/client` + `prisma` dev), **PostgreSQL** (Azure-hosted per
  project docs; README badge says "PostgreSQL 16" `:14`).
- **TailwindCSS `^3.4.18`**, token-driven theme (`tailwind.config.ts:11-65`, CSS-var brand
  palette — no hex in components).
- **Auth:** **cookie-based** via `src/lib/cookie-auth.ts` (`getVerifiedEmail()`) **alongside**
  `next-auth ^4.24.13` (`@auth/prisma-adapter`) — the README's auth story should name the
  cookie-auth path that the API routes actually gate on.
- **Other real deps worth naming:** `recharts` (charts), `leaflet`/`react-leaflet` (maps),
  `pdfkit`/`pdf-parse` (tax/statement PDFs), `inngest` (background jobs), `rrule` (routine
  recurrence), `react-plaid-link`, `cheerio`/`fast-xml-parser` (EDGAR/scraping).
- **License:** **Business Source License 1.1** (`LICENSE`), Licensor **Temple Stuart LLC**,
  © 2024-2025, **Change Date 2028-01-01 → Apache 2.0**, Additional Use Grant for personal/
  non-production use; production/commercial use needs a separate commercial license
  (`LICENSE:10-20, :26-40`). **NOT AGPL.**

---

## 4. What's genuinely "to come" (planned, not built)

Grounded in stubs/markers + known gaps:
- **Home flight commit-to-trip wiring** — `PublicFlightSearch.tsx:149` commit is a stub
  (`book = () => onRequireAuth()`); budgeting a flight from home isn't wired (PLANNED).
- **Hotels/activities commit from home** — searches are live, commit-to-trip from the public
  home is not yet wired (PLANNED).
- **Ground transit (Mozio)** — client referenced but surfaced as `ComingSoonSection`
  ("Getting around"), `ModuleLauncher.tsx:393-398` (PARKED).
- **Travel "coming soon" rows** — Insurance, eSIM/"Stay connected", Events are static
  promises, `ModuleLauncher.tsx:403-419` (PLANNED).
- **Books / Tax / Compliance as public modules** — live as authed routes, but **stubs on the
  public home** (`renderBody` default, `:300-312`); surfacing them publicly is PLANNED.
- **Pricing → real numbers** — `/how-pricing-works` cells are static placeholders ($—/TBD);
  wiring them to Books data + picking Method A vs B is PLANNED (see the page's own footnote +
  `audit-reports/TRAVEL-GLOWUP-AUDIT.md` / pricing PR notes).
- **Stripe checkout** — lib wired, CTAs say "Coming Soon" (PLANNED).
- **From the README roadmap (`:1162-1253`), still 🔲:** Onboarding Flow, Results Tracking,
  Multi-Broker (Schwab/IBKR), Invoice Generation, iOS/Android app, CPA Client Portal,
  Team/Multi-User, Multi-Currency, Payroll, White-Label.
- **Stale ✅ to re-check:** "Mobile-Responsive UI" is marked 🔲 (`:1233`) but the home is now
  mobile-native — move to Shipped. "Free & Paid Tiers ✅" (`:1217`) — partially real (gating
  exists; checkout doesn't; a second cost-build model now exists).

---

## REPORT — the grounded rewrite plan (outline only, do NOT write yet)

Keep the **exact voice + structure** (capsule banner, badges, emoji headers, YAML/table/ASCII
blocks, taglines, `<details>` ToC, rainbow divider). Change only the **claims** so they match
reality, and add an honest roadmap. Section-by-section:

1. **Banner + badges (`:2-14`)** — keep the capsule banner. **Fix the license badge:** AGPL →
   **BSL 1.1** (link to `LICENSE`). Keep TS/Next/Postgres badges; pin Next **15**, TS **5**,
   Prisma **5**. Optionally add a "Status: Active development" badge instead of implying 1.0.
2. **Tagline (`:18-25`)** — keep the style; sync the tagline to the live hero
   ("Track your money. Plan your life. Act smarter.") or keep the README's — flag the
   divergence and pick one.
3. **What is Temple Stuart? (`:63-104`)** — keep the YAML identity block + "replace 5+ tools"
   mission. Drop/soften `version: 1.0.0` to reflect active development.
4. **Core Modules (`:106-265`)** — **restructure to the 7 home tabs** (Calendar, Travel,
   Trade, Operations, Books, Tax, Compliance) instead of the old six. For each, **replace the
   blanket "Production Ready" badge with an honest status**: *Live* (Calendar, most of Travel),
   *Admin-only/partial* (Trade), *Authed app, public stub* (Operations/Books/Tax/Compliance).
   Keep the dense feature bullets but mark which are live vs planned. Keep the ASCII module
   diagram; refresh it to the 7 modules + correct integration list.
5. **Tech Stack (`:269-345`) + Integration Details (`:346-427`)** — make accurate per §3.
   **Add LiteAPI (hotels), Viator (activities), FRED, EDGAR** to the integration list/diagram;
   note Mozio as parked. Name **cookie-auth** + next-auth. Correct versions.
6. **Architecture (`:428-829`)** — keep the ASCII/diagram style; verify route names against
   §2's real route list before re-publishing (it's a big section — spot-check, don't trust).
7. **Quick Start (`:830-927`)** — keep; verify the env-var list matches real providers (add
   LiteAPI/Viator/FRED/EDGAR keys if used; the current block already lists Plaid/Duffel/Places/
   Grok/OpenAI/Anthropic/Finnhub/TastyTrade).
8. **Licensing (`:928-1010`)** — **rewrite to BSL 1.1**: non-production/personal use granted,
   commercial use needs a license, **converts to Apache 2.0 on 2028-01-01**. Remove the AGPL
   copyleft framing entirely. Keep the dual-tone "free for personal / paid for commercial"
   voice — it's compatible with BSL's Additional Use Grant.
9. **Managed Hosting (`:1011-1147`)** — keep; sanity-check claims (Azure Postgres, Vercel).
10. **Documentation (`:1148-1161`)** — keep; verify linked docs exist.
11. **Roadmap (`:1162-1253`)** — keep the 4-column quarter layout. **Move "Mobile-Responsive
    UI" to Shipped**; soften "Tiers ✅"; **add the real near-term items from §4** (home
    flight/hotel commit-wiring, Mozio ground, surfacing Books/Tax/Compliance publicly, pricing
    → real numbers, Stripe checkout).
12. **Contributing / Security / Community / Contact (`:1254-end`)** — keep as-is (style +
    contact are fine); just ensure the contributing license note says **BSL**, not AGPL.

**Overclaims to correct (checklist):** (a) AGPL → BSL everywhere (`:10`, `:942-1010`,
contributing note); (b) six "Production Ready" badges → honest per-module status; (c) module
taxonomy → 7 home tabs incl. Calendar/Operations/Compliance; (d) integration list → add
LiteAPI/Viator/FRED/EDGAR, mark Mozio parked; (e) `version: 1.0.0` → active development;
(f) roadmap mobile/tiers staleness; (g) "Duffel Flight Booking ✅" → search live, home
commit-to-trip planned.

**Do not write the new README yet — this is the fact base + outline only.**
