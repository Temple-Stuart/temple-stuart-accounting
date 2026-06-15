
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://capsule-render.vercel.app/api?type=waving&color=0:0d1117,50:161b22,100:21262d&height=220&section=header&text=Temple%20Stuart&fontSize=70&fontColor=58a6ff&fontAlignY=32&desc=Personal%20Back%20Office%20•%20Financial%20OS&descSize=22&descAlignY=52&descColor=8b949e&animation=fadeIn&stroke=30363d&strokeWidth=1">
  <source media="(prefers-color-scheme: light)" srcset="https://capsule-render.vercel.app/api?type=waving&color=0:667eea,50:764ba2,100:f093fb&height=220&section=header&text=Temple%20Stuart&fontSize=70&fontColor=ffffff&fontAlignY=32&desc=Personal%20Back%20Office%20•%20Financial%20OS&descSize=22&descAlignY=52&animation=fadeIn">
  <img alt="Temple Stuart" src="https://capsule-render.vercel.app/api?type=waving&color=0:667eea,50:764ba2,100:f093fb&height=220&section=header&text=Temple%20Stuart&fontSize=70&fontColor=ffffff&fontAlignY=32&desc=Personal%20Back%20Office%20•%20Financial%20OS&descSize=22&descAlignY=52&animation=fadeIn" width="100%">
</picture>

<div align="center">

[![License: BSL 1.1](https://img.shields.io/badge/License-BSL%201.1-blue.svg?style=for-the-badge&logo=mariadb&logoColor=white)](LICENSE)
[![Commercial License](https://img.shields.io/badge/Commercial-License%20Available-ff6b6b?style=for-the-badge&logo=handshake&logoColor=white)](#-licensing)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)

<br>

<h3>
  <strong>Track your money. Plan your life. Act smarter.</strong>
</h3>

<p>
  A unified financial operating system for founder-traders, freelancers, and anyone<br>
  who refuses to be "simplified" by consumer finance apps.
</p>

<br>

[**🚀 Get Started**](#-quick-start) · [**📖 Documentation**](#-documentation) · [**☁️ Managed Hosting**](#%EF%B8%8F-managed-hosting) · [**💼 Commercial License**](#-commercial-licensing)

<br>

---

<img src="https://raw.githubusercontent.com/andreasbm/readme/master/assets/lines/rainbow.png" width="100%">

</div>

<br>

## 📋 Table of Contents

<details>
<summary>Click to expand</summary>

- [What is Temple Stuart?](#-what-is-temple-stuart)
- [Core Modules](#-core-modules)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Quick Start](#-quick-start)
- [Licensing](#-licensing)
- [Managed Hosting](#%EF%B8%8F-managed-hosting)
- [Documentation](#-documentation)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [Security](#-security)
- [Contact](#-contact)

</details>

<br>

## 🎯 What is Temple Stuart?

<table>
<tr>
<td>

```yaml
name: Temple Stuart
status: in active development (fast-moving; some modules live, some behind login)
type: Personal Back Office / Financial Operating System

mission: |
  Replace 5+ fragmented tools with one unified system
  that respects your data, your time, and your intelligence.

problem_we_solve:
  - Mint oversimplifies, hides important details
  - QuickBooks is overkill for personal + small biz hybrid
  - TraderSync doesn't integrate with your books
  - TurboTax can't handle active trading complexity
  - Spreadsheets for trip budgets don't talk to your ledger
  - No single source of truth across entities

built_for:
  - Founder-traders (personal + business + trading accounts)
  - Active options traders needing wash-sale compliance
  - Digital nomads planning activity-based trips
  - Freelancers wanting CPA-ready double-entry books
  - Anyone managing complex financial lives

principles:
  accuracy_over_convenience: true
  transparency_over_magic: true
  user_control_over_ai_assumptions: true
  double_entry_or_nothing: true
```

</td>
</tr>
</table>

<br>

## 📦 Core Modules

<div align="center">

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  THE HOME APP — 7 tabs, one timeline                                             │
│  ╔════════╗ ╔════════╗ ╔═══════╗ ╔════════════╗ ╔═══════╗ ╔═════╗ ╔════════════╗  │
│  ║CALENDAR║ ║ TRAVEL ║ ║ TRADE ║ ║ OPERATIONS ║ ║ BOOKS ║ ║ TAX ║ ║ COMPLIANCE ║  │
│  ╚═══╤════╝ ╚═══╤════╝ ╚═══╤═══╝ ╚═════╤══════╝ ╚═══╤═══╝ ╚══╤══╝ ╚═════╤══════╝  │
│      └──────────┴──────────┴───────────┴────────────┴────────┴──────────┘         │
│  ┌────────────────────────────────────────────────────────────────────────────┐  │
│  │           🔒 UNIFIED DOUBLE-ENTRY LEDGER  ·  one shared calendar            │  │
│  └────────────────────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────────────────────┐  │
│  │  🔌 LIVE: Plaid · Duffel · LiteAPI · Viator · Google Places · TastyTrade    │  │
│  │           Finnhub · FRED · SEC EDGAR · Anthropic Claude · xAI Grok          │  │
│  │     PARTIAL: Stripe      PARKED: Mozio · CoverGenius · Airalo               │  │
│  └────────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

</div>

<br>

> **How to read this:** Temple Stuart is one app with three layers. The **home app** at `/`
> is the front door — a 7-tab, mobile-friendly launcher. Some tabs are usable right away
> (Calendar, Travel search); the rest run as a **deep app behind login** (~57 routes:
> bookkeeping, trading, tax, operations, compliance) that the home tab will surface over
> time. An older **Hub** cockpit and a first-pass tier `/pricing` page still exist and are
> being folded into the home app. The status badge on each card below says where it stands
> **on the public home surface** — not a blanket "done."

<table>
<tr>
<td width="50%" valign="top">

### 📅 Calendar

<img src="https://img.shields.io/badge/Status-Live-success?style=flat-square" alt="Live">

One timeline for your whole life.

- **Live for everyone** — logged in, it shows your real calendar; logged out, a static demo
- **Day view** — edge-to-edge, with a roomy time gutter and a crisp "now" line
- **Phone** — day-only with a horizontal week strip; **desktop** keeps Day / Week / Month
- **Four layers** — trips, projects, routines, trades, color-coded on one grid
- Shared `CalendarGrid` reused across the home app and the deep app

</td>
<td width="50%" valign="top">

### 🗺️ Travel

<img src="https://img.shields.io/badge/Status-Live%20(search)-success?style=flat-square" alt="Live (search)">

Plan a trip; search real fares and stays.

- **Live search** — flights (Duffel), hotels (LiteAPI), things to do (Viator), visa check
- **Trips money-arc** — create a trip, budget items, mark planned vs actual, photos, uncommit
- **Budget integration** — committed trip costs flow toward your chart of accounts
- ⏳ **Coming:** booking/commit a flight to a trip *from the home page* (the deep
  `/budgets/trips` flow does this today; the home commit is being wired)
- ⏳ **Parked:** ground transit (Mozio), insurance (CoverGenius), eSIM (Airalo)

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 📈 Trade

<img src="https://img.shields.io/badge/Status-Behind%20login-blue?style=flat-square" alt="Behind login">

Built by a daily options trader. Full engine lives at `/trading`.

- **AI volatility scanner** — S&P 500 universe through a convergence pipeline (4 categories, 3/4 gate)
- **AI market brief + per-strategy analysis** — Claude reads regime, risk, picks; plain-English signals
- **Strategy builder** — iron condors, credit spreads, straddles with P&L
- **Live options data** — quotes, chains, Greeks, IV/HV via TastyTrade
- **Cost basis + wash sales** — FIFO/LIFO/HIFO/SpecID, IRS Pub 550 30-day window
- **Feeds** — Finnhub (news/analysts), FRED (macro), SEC EDGAR (filings), xAI Grok (sentiment)
- On the home page: the scan form is admin-only today; everyone else sees a preview

</td>
<td width="50%" valign="top">

### 🎯 Operations

<img src="https://img.shields.io/badge/Status-Behind%20login-blue?style=flat-square" alt="Behind login">

Turn a messy goal into a dated plan. Lives at `/operations`.

- **Projects** — design, tasks, dependencies, evolution history
- **Routines** — steps, completions, upcoming/today views
- **Daily plan + north star** — blocks that drop onto your calendar with times
- **Content studio** — scenes, takes, scripts
- **AI plan / brain-dump** — Claude turns rambly input into a step list
- On the home page: a static, fetch-free **preview** (no live data for guests)

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 📒 Books (Double-Entry Bookkeeping)

<img src="https://img.shields.io/badge/Status-Behind%20login-blue?style=flat-square" alt="Behind login">

Real accounting, not "tracking." Lives at `/ledger`, `/transactions`, `/statements`.

- **Plaid sync** — banks, brokerages, credit cards into one place
- **Auto-categorization** — merchant mapping that learns from your corrections
- **Entity separation** — P- (personal) · B- (business) · T- (trading)
- **Double-entry** — balanced debits/credits, commit-to-ledger, journal entries
- **Statements** — balance sheet (prior-year carry-forward), income statement, three-statement view
- **Bank reconciliation + period close** — month-end verify and lock
- On the home page: a paid tab (use it in the deep app today)

</td>
<td width="50%" valign="top">

### 🧾 Tax

<img src="https://img.shields.io/badge/Status-Behind%20login-blue?style=flat-square" alt="Behind login">

From clean books toward Form 1040. Lives at `/dashboard/tax`.

- **Form 1040 estimator** — bracket breakdown, line-item mapping
- **Schedule C / SE / D + Form 8949** — business P&L, self-employment, capital gains (CSV/PDF export)
- **Wash sale detection** — IRS Pub 550, 30-day window
- **Manual overrides** — W-2 / 1099-R entry for the full picture
- On the home page: a paid tab (use it in the deep app today)

> ⚠️ **Disclaimer:** Temple Stuart is not a CPA firm or tax preparer. All tax figures are estimates and must be verified by a licensed professional before filing.

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 🛡️ Compliance

<img src="https://img.shields.io/badge/Status-Behind%20login-blue?style=flat-square" alt="Behind login">

A timestamped record that you did things right. Lives at `/compliance`.

- **Missions + tasks** — what needs doing, tracked
- **Citations** — pulled and verified against source regulation
- **Discovery** — runs, proposals, profile
- **Registry + audit log** — a tamper-evident, chain-verified trail (`/soc2`)
- On the home page: a paid tab (use it in the deep app today)

</td>
<td width="50%" valign="top">

### 🎛️ Hub (legacy cockpit)

<img src="https://img.shields.io/badge/Status-Legacy-lightgrey?style=flat-square" alt="Legacy">

The original command center at `/hub` — being folded into the home app.

- **Unified calendar** — its calendar logic now powers the home Calendar tab
- **Budget comparison + trip cards + map view** — homebase vs travel vs business
- Still works today; the home app is the new front door

</td>
</tr>
</table>

<br>

## 🛠️ Tech Stack

<div align="center">

<table>
<tr>
<td align="center" width="96">
<img src="https://skillicons.dev/icons?i=nextjs" width="48" height="48" alt="Next.js" />
<br><sub><b>Next.js 15</b></sub>
</td>
<td align="center" width="96">
<img src="https://skillicons.dev/icons?i=ts" width="48" height="48" alt="TypeScript" />
<br><sub><b>TypeScript</b></sub>
</td>
<td align="center" width="96">
<img src="https://skillicons.dev/icons?i=react" width="48" height="48" alt="React" />
<br><sub><b>React 18</b></sub>
</td>
<td align="center" width="96">
<img src="https://skillicons.dev/icons?i=tailwind" width="48" height="48" alt="Tailwind" />
<br><sub><b>Tailwind</b></sub>
</td>
<td align="center" width="96">
<img src="https://skillicons.dev/icons?i=postgres" width="48" height="48" alt="PostgreSQL" />
<br><sub><b>PostgreSQL</b></sub>
</td>
<td align="center" width="96">
<img src="https://skillicons.dev/icons?i=prisma" width="48" height="48" alt="Prisma" />
<br><sub><b>Prisma</b></sub>
</td>
</tr>
<tr>
<td align="center" width="96">
<img src="https://skillicons.dev/icons?i=azure" width="48" height="48" alt="Azure" />
<br><sub><b>Azure</b></sub>
</td>
<td align="center" width="96">
<img src="https://skillicons.dev/icons?i=vercel" width="48" height="48" alt="Vercel" />
<br><sub><b>Vercel</b></sub>
</td>
<td align="center" width="96">
<img src="https://avatars.githubusercontent.com/u/134034493" width="48" height="48" alt="Plaid" style="border-radius: 8px" />
<br><sub><b>Plaid</b></sub>
</td>
<td align="center" width="96">
<img src="https://avatars.githubusercontent.com/u/54536011" width="48" height="48" alt="Duffel" style="border-radius: 8px" />
<br><sub><b>Duffel</b></sub>
</td>
<td align="center" width="96">
<img src="https://www.gstatic.com/images/branding/product/2x/maps_96dp.png" width="48" height="48" alt="Google Places" />
<br><sub><b>Places API</b></sub>
</td>
<td align="center" width="96">
<img src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/X_logo_2023.svg/300px-X_logo_2023.svg.png" width="48" height="48" alt="xAI" style="background: black; border-radius: 8px; padding: 8px" />
<br><sub><b>xAI Grok</b></sub>
</td>
</tr>
<tr>
<td align="center" width="96">
<img src="https://avatars.githubusercontent.com/u/76263028" width="48" height="48" alt="Anthropic" style="border-radius: 8px" />
<br><sub><b>Claude AI</b></sub>
</td>
<td align="center" width="96">
<img src="https://avatars.githubusercontent.com/u/48205786" width="48" height="48" alt="Finnhub" style="border-radius: 8px" />
<br><sub><b>Finnhub</b></sub>
</td>
<td align="center" width="96">
<img src="https://avatars.githubusercontent.com/u/37933258" width="48" height="48" alt="Tastytrade" style="border-radius: 8px" />
<br><sub><b>Tastytrade</b></sub>
</td>
</tr>
</table>

</div>

<br>

### Integration Details

| Integration | Status | Purpose | Implementation |
|-------------|--------|---------|----------------|
| **Plaid** | 🟢 Live | Banking data sync | Production: transactions + investments + balances |
| **Duffel** | 🟢 Live | Flight search/booking | GDS: search → offers → passenger details → order |
| **LiteAPI** | 🟢 Live | Hotel search | Search + content + reviews; booking flow (prebook/book) maturing |
| **Viator** | 🟢 Live | Things to do | Bookable tours / activities / wellness search |
| **Google Places** | 🟢 Live | Location intelligence | Geocoding, text search (60 results/category), photos, price levels |
| **TastyTrade** | 🟢 Live | Options data | Live quotes, chains, Greeks, IV/HV, positions, scanner |
| **Finnhub** | 🟢 Live | Market data | Company news, analyst ratings, price targets (free tier) |
| **FRED** | 🟢 Live | Macro data | St. Louis Fed indicators feeding the convergence regime score |
| **SEC EDGAR** | 🟢 Live | Filings | Filings ingest for discovery + convergence info-edge |
| **Anthropic Claude** | 🟢 Live | AI analysis | Market briefs, strategy analysis, ops planning, discovery |
| **xAI Grok** | 🟢 Live | Trip AI + sentiment | Trip analysis, X/Twitter sentiment via x_search |
| **OpenAI** | 🟢 Live | General AI | Client for some explanatory features |
| **Stripe** | 🟡 Partial | Payments | Checkout/portal/webhook routes built; checkout not surfaced yet |
| **Mozio** | ⚪ Parked | Ground transit | Declared in the source registry, not connected |
| **CoverGenius** | ⚪ Parked | Travel insurance | Declared, not connected |
| **Airalo** | ⚪ Parked | eSIM / data | Declared, not connected |
| **Leaflet** | 🟢 Live | Maps | Trip visualization, destination markers, popups |

<br>

<details>
<summary><strong>📁 Project Structure</strong></summary>

```
temple-stuart/
├── src/
│   ├── app/                    # Next.js App Router (flat routes)
│   │   ├── accounts/           # Plaid account management
│   │   ├── api/                # API routes (160 endpoints)
│   │   │   ├── plaid/          # Plaid webhooks + sync
│   │   │   ├── flights/        # Duffel search + booking
│   │   │   ├── trips/          # Trip CRUD + participants
│   │   │   ├── trading/        # P&L, positions, journal
│   │   │   ├── transactions/   # Commit to ledger
│   │   │   └── ...
│   │   ├── budgets/            # Budget management + trips UI
│   │   ├── hub/                # Command center dashboard
│   │   ├── trading/            # Trading analytics UI
│   │   ├── transactions/       # Transaction review UI
│   │   └── layout.tsx          # Root layout
│   ├── components/             # React components
│   │   ├── ui/                 # Shared UI primitives
│   │   ├── convergence/        # Market Intelligence dashboard
│   │   └── trips/              # Trip-specific (TripMap, etc.)
│   ├── lib/                    # Core libraries
│   │   ├── convergence/        # Convergence pipeline (15 modules)
│   │   │   ├── pipeline.ts     # Full scan orchestrator
│   │   │   ├── composite.ts    # 4-category composite + gate
│   │   │   ├── vol-edge.ts     # IV vs HV scoring
│   │   │   ├── quality-gate.ts # Finnhub fundamentals
│   │   │   ├── regime.ts       # FRED macro + SPY correlation
│   │   │   ├── info-edge.ts    # News + insider + analyst
│   │   │   ├── trade-cards.ts  # Plain English trade cards
│   │   │   ├── chain-fetcher.ts # TT option chains + Greeks
│   │   │   ├── data-fetchers.ts # Finnhub + FRED APIs
│   │   │   ├── probability.ts  # N(d2) normalCDF (Abramowitz & Stegun)
│   │   │   ├── filter-types.ts # 3-tier filter definitions
│   │   │   ├── filter-engine.ts # Client-side filter engine
│   │   │   ├── sentiment.ts    # xAI Grok social sentiment
│   │   │   └── types.ts        # Pipeline type definitions
│   │   ├── strategy-builder.ts # Delta-based strategy generation
│   │   ├── plaid.ts            # Plaid client (production)
│   │   ├── duffel.ts           # Duffel GDS client
│   │   ├── grok.ts             # xAI Grok client
│   │   ├── placesSearch.ts     # Google Places with caching
│   │   ├── auto-categorization-service.ts
│   │   ├── investment-ledger-service.ts
│   │   ├── journal-entry-service.ts
│   │   ├── form-1040-service.ts
│   │   ├── schedule-c-service.ts
│   │   ├── tax-report-service.ts
│   │   ├── wash-sale-service.ts
│   │   ├── robinhood-parser.ts # CSV import
│   │   └── prisma.ts           # Database client
│   └── types/                  # TypeScript types
├── prisma/
│   ├── schema.prisma           # 61 models, full audit trail
│   └── migrations/             # Migration history
└── public/                     # Static assets
```

</details>

<br>

## 🏗️ Architecture

<details>
<summary><strong>System Design Overview</strong></summary>

```
                                    ┌─────────────────┐
                                    │    USERS        │
                                    │  (Web Browser)  │
                                    └────────┬────────┘
                                             │
                                             ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                              PRESENTATION LAYER                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         Next.js 15 (App Router)                       │  │
│  │  • React 18 Server Components    • API Routes    • Vercel Edge        │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
                                             │
                                             ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                              APPLICATION LAYER                             │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────┐│
│  │Bookkeeping│ │  Trading  │ │   Trips   │ │ Budgeting │ │    Tax    │ │  Hub  ││
│  │  Service  │ │  Service  │ │  Service  │ │  Service  │ │ Reporting │ │Service││
│  └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └───┬───┘│
│        │              │              │              │              │            │      │
│  ┌─────┴──────────────┴──────────────┴──────────────┴──────────────┴────────────┴───┐│
│  │                  AUTO-CATEGORIZATION ENGINE                              ││
│  │    Merchant Mapping (high confidence) → Category Fallback               ││
│  │    Learning Loop: User corrections → Future predictions                 ││
│  └──────────────────────────────────┬──────────────────────────────────────┘│
│                                │                                           │
│                    ┌───────────┴───────────┐                               │
│                    │   Double-Entry        │                               │
│                    │   Accounting Engine   │                               │
│                    │   (ledger_entries)    │                               │
│                    └───────────────────────┘                               │
└────────────────────────────────────────────────────────────────────────────┘
                                             │
                                             ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                                DATA LAYER                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     Prisma ORM + PostgreSQL (Azure)                  │   │
│  │  • 61 models            • Entity separation (P/B/T)    • Audit trail  │   │
│  │  • stock_lots          • trading_positions            • trip RSVP    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────┘
                                             │
                                             ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                            INTEGRATION LAYER                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  ┌──────────┐  ┌──────────┐ │
│  │   Plaid  │  │  Duffel  │  │ Google Places│  │ xAI Grok │  │  OpenAI  │ │
│  │ Banking  │  │ Flights  │  │  Locations   │  │ Analysis │  │ Explain  │ │
│  │  (prod)  │  │  (GDS)   │  │  (cached)    │  │(grok-3)  │  │          │ │
│  └──────────┘  └──────────┘  └──────────────┘  └──────────┘  └──────────┘ │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐                             │
│  │Tastytrade│  │Claude AI │  │   Finnhub    │                             │
│  │ Options  │  │  Market  │  │ News/Analyst │                             │
│  │  (live)  │  │  Briefs  │  │  (free tier) │                             │
│  └──────────┘  └──────────┘  └──────────────┘                             │
└────────────────────────────────────────────────────────────────────────────┘
```

</details>

<details>
<summary><strong>🔄 Auto-Categorization Flow</strong></summary>

```
Transaction arrives from Plaid
         │
         ▼
┌─────────────────────────────────────┐
│  1. MERCHANT MAPPING (High Conf)    │
│     Look up merchant_coa_mappings   │
│     Match: merchant + category      │
│     Confidence: 0.5 - 1.0           │
└──────────────┬──────────────────────┘
               │ No match?
               ▼
┌─────────────────────────────────────┐
│  2. CATEGORY FALLBACK (Med Conf)    │
│     Map Plaid category → COA code   │
│     FOOD_AND_DRINK → P-6100         │
│     TRANSPORTATION → P-6400         │
│     Confidence: 0.6                 │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  3. HUMAN REVIEW                    │
│     predicted_coa_code set          │
│     review_status = pending_review  │
│     User approves or overrides      │
└──────────────┬──────────────────────┘
               │ User overrides?
               ▼
┌─────────────────────────────────────┐
│  4. LEARNING LOOP                   │
│     Save to merchant_coa_mappings   │
│     Future transactions auto-match  │
│     manually_overridden = true      │
└─────────────────────────────────────┘
```

</details>

<details>
<summary><strong>✈️ Trip AI Pipeline</strong></summary>

```
User selects: Destination + Activities (e.g., surf, nomad, coworking)
         │
         ▼
┌─────────────────────────────────────┐
│  GOOGLE PLACES API                  │
│  Facts only. No opinions.           │
│                                     │
│  • Geocode destination              │
│  • Search 60 places per category    │
│  • Get: rating, reviewCount, price  │
│  • Cache results (places_cache)     │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  XAI GROK (grok-3-latest)           │
│  Analysis + Judgment                │
│                                     │
│  Input: places + traveler profile   │
│  Output per place:                  │
│    • sentimentScore (1-10)          │
│    • fitScore (1-10 for activities) │
│    • warnings (actionable issues)   │
│    • trending (buzzy or not)        │
│    • valueRank (final ordering)     │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  USER SEES                          │
│  Ranked recommendations with:       │
│  • Google rating + review count     │
│  • Grok sentiment + fit score       │
│  • Specific warnings                │
│  • Photos from Google               │
│  User decides. AI explains.         │
└─────────────────────────────────────┘
```

</details>

<details>
<summary><strong>📊 Volatility Scanner Pipeline</strong></summary>

```
User opens Scanner → Selects Universe (S&P 500)
         │
         ▼
┌─────────────────────────────────────┐
│  TASTYTRADE API                     │
│  Live data for 475 tickers          │
│                                     │
│  • IV, HV (30/60/90 day)           │
│  • IV Rank, term structure          │
│  • Earnings dates, borrow rates     │
│  • Sector classification            │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  INSTITUTIONAL HARD GATES           │
│  ~26% pass rate                     │
│                                     │
│  • Liquidity score ≥ 3             │
│  • IV-HV spread ≥ 5 points        │
│  • IV Rank ≥ 25                    │
│  • Borrow rate ≤ 10%              │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  SCORING ENGINE (0-100)             │
│  7 factors + sector penalty         │
│                                     │
│  • IV-HV spread (30 pts)           │
│  • HV trend (5 pts)               │
│  • IV Rank (20 pts)               │
│  • Liquidity (20 pts)             │
│  • Term structure (10 pts)         │
│  • Earnings proximity (10 pts)     │
│  • Lendability (5 pts)            │
│  • Sector diversity: -5 penalty    │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  CLAUDE AI MARKET BRIEF             │
│  Regime + Risk + Top Picks          │
│                                     │
│  • Regime snapshot (avg spreads)    │
│  • Sector heatmap                  │
│  • Risk clusters (earnings,         │
│    sector concentration, anomalies) │
│  • Top 8 tickers + marginal 3      │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  TOP PICKS AUTO-ANALYSIS            │
│  Sequential, ~25 seconds            │
│                                     │
│  For each of 8 tickers:            │
│  • Fetch quote + chain + Greeks    │
│  • Generate 2-3 strategy cards     │
│  • Fetch Finnhub news + analysts   │
│  • Claude AI analysis per strategy │
│                                     │
│  Cards show: legs, Greeks, PoP,    │
│  P&L chart, breakevens, AI text    │
└─────────────────────────────────────┘
```

</details>

<details>
<summary><strong>🧠 Convergence Pipeline</strong></summary>

```
User selects Universe → Scan Market
         │
         ▼
┌─────────────────────────────────────┐
│  TASTYTRADE SCANNER                 │
│  41 fields per ticker               │
│                                     │
│  • IV30, HV30, IV60, HV60, IV90    │
│  • IV Rank, IV Percentile           │
│  • Term structure, liquidity score  │
│  • Earnings date, borrow rate       │
│  • 475 S&P 500 stocks               │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  HARD FILTERS                       │
│  Quick elimination                  │
│                                     │
│  • Liquidity ≥ 3                    │
│  • IV-HV spread ≥ 5                │
│  • IV Rank ≥ 25                     │
│  • Borrow rate ≤ 10%               │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  4-CATEGORY SCORING (0-100 each)    │
│  Convergence = all categories agree │
│                                     │
│  Vol-Edge (IV vs HV)                │
│  • IV-HV spread magnitude           │
│  • HV trend direction               │
│  • Term structure slope              │
│  • IV Rank percentile               │
│                                     │
│  Quality Gate (fundamentals)         │
│  • Profitability & margins           │
│  • Earnings surprise history         │
│  • Analyst consensus vs price        │
│  • Financial health ratios           │
│                                     │
│  Regime (macro + correlation)        │
│  • VIX level & percentile           │
│  • Credit spreads (HY-IG)           │
│  • Yield curve slope                 │
│  • SPY correlation modifier          │
│  • FRED macro indicators (9)         │
│                                     │
│  Info-Edge (news + insiders)         │
│  • News sentiment (Finnhub)          │
│  • Insider activity (MSPR)           │
│  • Analyst rating changes            │
│  • Earnings proximity                │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  CONVERGENCE GATE                   │
│  3/4 categories must score > 50     │
│                                     │
│  Only tickers where volatility,     │
│  fundamentals, macro regime, AND    │
│  information flow all agree get     │
│  promoted to trade card generation  │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  TRADE CARD GENERATION              │
│  Real strikes from live chains      │
│                                     │
│  • Fetch TastyTrade option chains   │
│  • Delta-based strike selection     │
│  • Generate 2-3 strategies:         │
│    Iron Condor, Credit Spread,      │
│    Straddle, etc.                   │
│  • N(d2) breakeven PoP, 3-outcome EV│
│  • Calculate: max profit, max loss, │
│    breakevens, risk/reward          │
│  • 3-tier gate: EV > 0, PoP floor, │
│    minimum credit                   │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  PLAIN ENGLISH OUTPUT               │
│  Everything explained, no jargon    │
│                                     │
│  • Score explanations per category  │
│  • Risk flags: insider selling,     │
│    earnings proximity, low volume   │
│  • Regime context: what macro means │
│  • Key stats with explanations      │
│    "Beta: 1.1 — moves slightly      │
│     more than the market"           │
│  • Top headlines from Finnhub       │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  3-TIER FILTER PANEL               │
│  15 configurable parameters         │
│                                     │
│  Tier 1: Liquidity Gates           │
│  • Min OI, max spread, volume,     │
│    liquidity rating                 │
│                                     │
│  Tier 2: Risk Profile              │
│  • Defined/unlimited, direction,   │
│    premium stance, DTE, strategies  │
│                                     │
│  Tier 3: Edge Metrics              │
│  • Min PoP, min EV, EV/Risk,      │
│    vol edge, IV rank, sentiment    │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  SOCIAL SENTIMENT (xAI Grok)       │
│  Optional, runs in parallel         │
│                                     │
│  Stage 1: Grok 4.1 Fast + x_search │
│  • Fetch 10-20 X/Twitter posts     │
│  • Classify bullish/bearish/neutral│
│                                     │
│  Stage 2: Grok 4.1 Fast (scoring)  │
│  • Numerical score (-1 to +1)      │
│  • Confidence magnitude (0-1)      │
└─────────────────────────────────────┘
```

**Data Sources:**

| Source | Fields | Purpose |
|--------|--------|---------|
| **Tastytrade** | 41 fields per ticker | IV, HV, Greeks, chains, liquidity, earnings |
| **Finnhub** | 132 fundamentals + news + insider + analyst + earnings | Quality scores, sentiment, insider activity |
| **FRED** | 9 macro indicators | VIX, credit spreads, yield curve, unemployment |
| **SPY** | Correlation coefficient | Regime modifier — adjusts for market-wide moves |
| **xAI Grok** | X/Twitter posts via x_search | Social sentiment scoring (two-stage pipeline) |

**Key Files:**

| File | Purpose |
|------|---------|
| `pipeline.ts` | Orchestrates full scan: TT fetch → hard filters → scoring → ranking |
| `composite.ts` | Combines 4 category scores into composite + convergence gate |
| `vol-edge.ts` | IV vs HV analysis, term structure, rank scoring |
| `quality-gate.ts` | Fundamental analysis from Finnhub (132 metrics) |
| `regime.ts` | Macro regime from FRED + SPY correlation modifier |
| `info-edge.ts` | News sentiment + insider MSPR + analyst changes |
| `trade-cards.ts` | Wraps strategy cards with plain English signals |
| `strategy-builder.ts` | Delta-based strike selection, N(d2) PoP, three-outcome EV, P&L |
| `probability.ts` | Abramowitz & Stegun normalCDF for N(d2) breakeven PoP |
| `filter-types.ts` | 3-tier filter type definitions (15 parameters) |
| `filter-engine.ts` | Client-side filter engine (liquidity → risk → edge) |
| `sentiment.ts` | xAI Grok two-stage social sentiment pipeline |
| `chain-fetcher.ts` | TastyTrade option chain fetch + WebSocket Greeks |
| `data-fetchers.ts` | Finnhub + FRED API integration |
| `types.ts` | All pipeline types and interfaces |
| `ConvergenceIntelligence.tsx` | Unified Market Intelligence dashboard |

**Stress Tested:** 20/20 tickers passed — AAPL, NVDA, TSLA, JPM, XOM, PFE, PLTR, GME, MSFT, AMZN, META, GOOGL, KO, WMT, BAC, AMD, COIN, SOFI, IWM, SPY

</details>

<br>

## 🚀 Quick Start

### Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js | 20+ | LTS recommended |
| PostgreSQL | 16+ | Azure or local |
| Plaid Account | - | Sandbox works for dev |

### Installation

```bash
# Clone the repository
git clone https://github.com/Temple-Stuart/temple-stuart-accounting.git
cd temple-stuart-accounting

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
```

<details>
<summary><strong>📝 Environment Variables</strong></summary>

```env
# ═══════════════════════════════════════════════════════════════
# DATABASE
# ═══════════════════════════════════════════════════════════════
DATABASE_URL="postgresql://user:password@host:5432/temple_stuart?sslmode=require"

# ═══════════════════════════════════════════════════════════════
# AUTHENTICATION
# ═══════════════════════════════════════════════════════════════
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"

# ═══════════════════════════════════════════════════════════════
# PLAID (Banking Integration) — Required
# ═══════════════════════════════════════════════════════════════
PLAID_CLIENT_ID="your-client-id"
PLAID_SECRET="your-secret"
# Note: App forces production environment for real data

# ═══════════════════════════════════════════════════════════════
# DUFFEL (Flight Booking) — Optional
# ═══════════════════════════════════════════════════════════════
DUFFEL_API_TOKEN="duffel_live_..."

# ═══════════════════════════════════════════════════════════════
# GOOGLE PLACES — Optional (for trip recommendations)
# ═══════════════════════════════════════════════════════════════
GOOGLE_PLACES_API_KEY="AIza..."

# ═══════════════════════════════════════════════════════════════
# XAI GROK — Optional (for trip AI analysis)
# ═══════════════════════════════════════════════════════════════
XAI_API_KEY="xai-..."

# ═══════════════════════════════════════════════════════════════
# OPENAI — Optional
# ═══════════════════════════════════════════════════════════════
OPENAI_API_KEY="sk-..."

# ═══════════════════════════════════════════════════════════════
# ANTHROPIC (AI Market Brief + Strategy Analysis)
# ═══════════════════════════════════════════════════════════════
ANTHROPIC_API_KEY="sk-ant-..."

# ═══════════════════════════════════════════════════════════════
# FINNHUB (News + Analyst Ratings) — Free tier, 60 calls/min
# ═══════════════════════════════════════════════════════════════
FINNHUB_API_KEY="your-finnhub-key"

# ═══════════════════════════════════════════════════════════════
# TASTYTRADE (Options Data — Quotes, Chains, Greeks)
# ═══════════════════════════════════════════════════════════════
TASTYTRADE_USERNAME="your-username"
TASTYTRADE_PASSWORD="your-password"
```

</details>

```bash
# Initialize database
npx prisma migrate deploy
npx prisma db seed

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) 🎉

<br>

## 📜 Licensing

<div align="center">

Temple Stuart is **source-available** under the **Business Source License 1.1** — free for personal use, a paid license for commercial use, and fully open (Apache 2.0) from 2028.

</div>

<br>

<table>
<tr>
<td width="50%" valign="top">

### 🆓 Free for personal use

**Personal, non-commercial use**

<img src="https://img.shields.io/badge/Cost-$0-success?style=flat-square" alt="Free">

✅ Self-host it for your own personal finances<br>
✅ Read the full source — learn from it<br>
✅ Modify and extend it for yourself<br>
✅ Full feature access — no paywalled code

🔓 **Converts to Apache 2.0 on 2028-01-01** (the BSL Change Date) — fully open from then on, for everyone.

<br>

**Perfect for:**
- Personal finance tracking
- Learning and experimentation
- Self-hosting your own back office

</td>
<td width="50%" valign="top">

### 💼 Commercial license

**For business & production use**

<img src="https://img.shields.io/badge/Pricing-Contact%20Us-blue?style=flat-square" alt="Contact Us">

✅ Run it as a business or in production<br>
✅ Host it as a service for others<br>
✅ Use it inside a company<br>
✅ Priority support included

⚠️ Commercial or production use needs a paid license from Temple Stuart LLC — you can't take it and sell it.

<br>

[**📧 Contact for a commercial license →**](mailto:astuart@templestuart.com)

</td>
</tr>
</table>

<br>

<div align="center">

### Why this model?

> *"Free to use for yourself. Pay if you build a business on it. Fully open in 2028."*

The BSL + Commercial model means:

**Personal users** → Use it free, forever, for your own life<br>
**Tinkerers** → Read every line, learn from it, modify it<br>
**Businesses** → Pay fairly for the value you build on it<br>
**Everyone, eventually** → It becomes Apache 2.0 on 2028-01-01

</div>

<br>

## ☁️ Managed Hosting

<div align="center">

**Don't want to self-host? We've got you.**

*Pricing is estimated — final tiers TBD*

</div>

<br>

<table>
<tr>
<th></th>
<th align="center">🆓 Free<br><sub>$0/mo</sub></th>
<th align="center">🚀 Pro<br><sub>$20/mo</sub></th>
<th align="center">⚡ Pro+<br><sub>$40/mo</sub></th>
<th align="center">📈 Trader Pro<br><sub>$60/mo</sub></th>
</tr>
<tr>
<td><strong>Manual Entry & Budgeting</strong></td>
<td align="center">✅</td>
<td align="center">✅</td>
<td align="center">✅</td>
<td align="center">✅</td>
</tr>
<tr>
<td><strong>Double-Entry Bookkeeping</strong></td>
<td align="center">✅</td>
<td align="center">✅</td>
<td align="center">✅</td>
<td align="center">✅</td>
</tr>
<tr>
<td><strong>Hub Command Center</strong></td>
<td align="center">✅</td>
<td align="center">✅</td>
<td align="center">✅</td>
<td align="center">✅</td>
</tr>
<tr>
<td><strong>Plaid Bank Sync</strong></td>
<td align="center">—</td>
<td align="center">✅ (10 accounts)</td>
<td align="center">✅ (25 accounts)</td>
<td align="center">✅ (25 accounts)</td>
</tr>
<tr>
<td><strong>Trading P&L Analytics</strong></td>
<td align="center">—</td>
<td align="center">✅</td>
<td align="center">✅</td>
<td align="center">✅</td>
</tr>
<tr>
<td><strong>Auto-Categorization</strong></td>
<td align="center">—</td>
<td align="center">✅</td>
<td align="center">✅</td>
<td align="center">✅</td>
</tr>
<tr>
<td><strong>Tax Estimator (1040, C, D, SE)</strong></td>
<td align="center">—</td>
<td align="center">✅</td>
<td align="center">✅</td>
<td align="center">✅</td>
</tr>
<tr>
<td><strong>AI Spending Insights</strong></td>
<td align="center">—</td>
<td align="center">—</td>
<td align="center">✅</td>
<td align="center">✅</td>
</tr>
<tr>
<td><strong>AI Meal Planning</strong></td>
<td align="center">—</td>
<td align="center">—</td>
<td align="center">✅</td>
<td align="center">✅</td>
</tr>
<tr>
<td><strong>Trip AI Recommendations</strong></td>
<td align="center">—</td>
<td align="center">—</td>
<td align="center">✅</td>
<td align="center">✅</td>
</tr>
<tr>
<td><strong>AI Volatility Scanner</strong></td>
<td align="center">—</td>
<td align="center">—</td>
<td align="center">—</td>
<td align="center">✅</td>
</tr>
<tr>
<td><strong>Strategy Builder</strong></td>
<td align="center">—</td>
<td align="center">—</td>
<td align="center">—</td>
<td align="center">✅</td>
</tr>
<tr>
<td><strong>Trade Lab + Grading</strong></td>
<td align="center">—</td>
<td align="center">—</td>
<td align="center">—</td>
<td align="center">✅</td>
</tr>
<tr>
<td><strong>Live Signals + Portfolio Greeks</strong></td>
<td align="center">—</td>
<td align="center">—</td>
<td align="center">—</td>
<td align="center">🔜</td>
</tr>
<tr>
<td><strong>Support</strong></td>
<td align="center">Community</td>
<td align="center">Email</td>
<td align="center">Priority</td>
<td align="center">Priority</td>
</tr>
</table>

<br>

<div align="center">

**All plans include:** Your data, always exportable

</div>

<br>

## 📚 Documentation

Documentation is maintained in-app and in code comments. See `src/lib/` for service-level documentation.

| Area | Key Files |
|------|-----------|
| **Bookkeeping** | `journal-entry-service.ts`, `investment-ledger-service.ts`, `auto-categorization-service.ts` |
| **Tax Reporting** | `form-1040-service.ts`, `schedule-c-service.ts`, `tax-report-service.ts`, `wash-sale-service.ts` |
| **Trading** | `strategy-builder.ts`, `convergence/pipeline.ts`, `convergence/composite.ts` |
| **Integrations** | `plaid.ts`, `duffel.ts`, `tastytrade.ts`, `grok.ts` |
| **Contributing** | See [CONTRIBUTING.md](CONTRIBUTING.md) |

<br>

## 🗺️ Roadmap

<table>
<tr>
<td align="center" width="33%"><strong>✅ Live now</strong></td>
<td align="center" width="33%"><strong>🔧 In progress</strong></td>
<td align="center" width="33%"><strong>🔮 Planned</strong></td>
</tr>
<tr>
<td valign="top">

✅ Double-entry bookkeeping + general ledger<br>
✅ Plaid sync + auto-categorization<br>
✅ Bank reconciliation + period close<br>
✅ Trading scanner + convergence pipeline<br>
✅ AI market brief + strategy builder (Claude)<br>
✅ Lot cost basis + wash sales<br>
✅ Tax: 1040 / Sch C / SE / D + Form 8949<br>
✅ Operations: projects + routines + daily plan<br>
✅ Compliance: missions + citations + audit log<br>
✅ Travel live search (Duffel / LiteAPI / Viator / visa)<br>
✅ Trips money-arc (budget vs actual, photos, uncommit)<br>
✅ The home app — 7-tab mobile-friendly front door<br>
✅ Day-view calendar + phone week strip, edge-to-edge<br>
✅ Cost-build pricing page (`/how-pricing-works`)<br>
✅ Account creation (cookie auth + next-auth)

</td>
<td valign="top">

🔧 Home commit-wiring (search → commit → trip → calendar)<br>
🔧 Surface Books / Tax / Compliance on the public home<br>
🔧 Login → home redirect + demo→real flip<br>
🔧 Pricing page → real numbers (from Books cost data)<br>
🔧 Stripe checkout activation (routes built, not surfaced)<br>
🔧 Retire / fold in the legacy Hub + tier `/pricing`

</td>
<td valign="top">

🔲 `hub_scheduled_items` master schedule live<br>
🔲 Resume Mozio / CoverGenius / Airalo<br>
🔲 Onboarding flow + results tracking<br>
🔲 Multi-broker support (Schwab, IBKR)<br>
🔲 Invoice generation + advanced analytics<br>
🔲 iOS / Android app<br>
🔲 CPA client portal + team / multi-user<br>
🔲 Multi-currency + payroll + white-label

</td>
</tr>
</table>

<br>

## 🤝 Contributing

We welcome contributions! Whether it's bug fixes, new features, or documentation improvements.

```bash
# 1. Fork the repository

# 2. Clone your fork
git clone https://github.com/YOUR_USERNAME/temple-stuart-accounting.git

# 3. Create a feature branch
git checkout -b feature/amazing-feature

# 4. Make your changes and test
npm run test
npm run lint
npm run build

# 5. Commit with conventional commits
git commit -m "feat: add amazing feature"

# 6. Push and open a PR
git push origin feature/amazing-feature
```

<details>
<summary><strong>📜 Contribution Agreement</strong></summary>

By contributing to Temple Stuart, you agree that:

1. Your contributions are licensed under the Business Source License 1.1
2. You grant us the right to include your contributions under our commercial license
3. You have the right to make the contribution (no proprietary code)

This allows us to maintain the dual-license model while accepting community contributions.

</details>

<br>

## 🔒 Security

Security is critical for financial software.

| Measure | Implementation |
|---------|----------------|
| **Authentication** | Cookie-based auth on 150/160 API routes |
| **Data Isolation** | All financial queries scoped to userId |
| **Tier Gating** | Paid API access (Plaid, AI) restricted by plan |
| **Transport Security** | TLS via Vercel (HTTPS enforced) |
| **Password Hashing** | bcrypt with salt rounds |
| **Dependency Scanning** | Automated via Dependabot |

**Found a vulnerability?** Email [astuart@templestuart.com](mailto:astuart@templestuart.com) with details. We respond within 24 hours.

<br>

## 💬 Community & Support

<div align="center">

[![GitHub Discussions](https://img.shields.io/badge/Discussions-Ask%20Questions-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/Temple-Stuart/temple-stuart-accounting/discussions)

</div>

<br>

## 📞 Contact

| Purpose | Contact |
|---------|---------|
| **Everything** | [astuart@templestuart.com](mailto:astuart@templestuart.com) |

<br>

---

<div align="center">

<br>

**Built with obsessive attention to accuracy by someone who lost money to bad financial tools.**

<sub>Temple Stuart is not a financial advisor, CPA, or tax professional.<br>Always consult qualified professionals for tax and investment decisions.</sub>

<br>

<a href="https://github.com/Temple-Stuart/temple-stuart-accounting/stargazers">
  <img src="https://img.shields.io/github/stars/Temple-Stuart/temple-stuart-accounting?style=social" alt="GitHub Stars">
</a>
<a href="https://github.com/Temple-Stuart/temple-stuart-accounting/network/members">
  <img src="https://img.shields.io/github/forks/Temple-Stuart/temple-stuart-accounting?style=social" alt="GitHub Forks">
</a>

<br><br>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://capsule-render.vercel.app/api?type=waving&color=0:0d1117,50:161b22,100:21262d&height=100&section=footer&stroke=30363d&strokeWidth=1">
  <source media="(prefers-color-scheme: light)" srcset="https://capsule-render.vercel.app/api?type=waving&color=0:667eea,50:764ba2,100:f093fb&height=100&section=footer">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=0:667eea,50:764ba2,100:f093fb&height=100&section=footer" width="100%">
</picture>

</div>
