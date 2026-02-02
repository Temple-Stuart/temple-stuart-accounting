<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://capsule-render.vercel.app/api?type=waving&color=0:0d1117,50:161b22,100:21262d&height=220&section=header&text=Temple%20Stuart&fontSize=70&fontColor=58a6ff&fontAlignY=32&desc=Personal%20Back%20Office%20•%20Financial%20OS&descSize=22&descAlignY=52&descColor=8b949e&animation=fadeIn&stroke=30363d&strokeWidth=1">
  <source media="(prefers-color-scheme: light)" srcset="https://capsule-render.vercel.app/api?type=waving&color=0:667eea,50:764ba2,100:f093fb&height=220&section=header&text=Temple%20Stuart&fontSize=70&fontColor=ffffff&fontAlignY=32&desc=Personal%20Back%20Office%20•%20Financial%20OS&descSize=22&descAlignY=52&animation=fadeIn">
  <img alt="Temple Stuart" src="https://capsule-render.vercel.app/api?type=waving&color=0:667eea,50:764ba2,100:f093fb&height=220&section=header&text=Temple%20Stuart&fontSize=70&fontColor=ffffff&fontAlignY=32&desc=Personal%20Back%20Office%20•%20Financial%20OS&descSize=22&descAlignY=52&animation=fadeIn" width="100%">
</picture>

<div align="center">

[![AGPL License](https://img.shields.io/badge/License-AGPL%20v3-blue.svg?style=for-the-badge&logo=gnu&logoColor=white)](https://www.gnu.org/licenses/agpl-3.0)
[![Commercial License](https://img.shields.io/badge/Commercial-License%20Available-ff6b6b?style=for-the-badge&logo=handshake&logoColor=white)](#-licensing)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)

<br>

<h3>
  <strong>Track your money. Plan your trips. Find your people.</strong>
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
version: 1.0.0
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
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│    ╔══════════════╗   ╔══════════════╗   ╔══════════════╗   ╔══════════╗   │
│    ║  BOOKKEEPING ║   ║   TRADING    ║   ║    TRIPS     ║   ║   HUB    ║   │
│    ║    ENGINE    ║   ║  ANALYTICS   ║   ║   PLANNER    ║   ║ COMMAND  ║   │
│    ╚══════╤═══════╝   ╚══════╤═══════╝   ╚══════╤═══════╝   ╚════╤═════╝   │
│           │                  │                  │                │         │
│    ┌──────┴──────────────────┴──────────────────┴────────────────┴──────┐  │
│    │              🔒 UNIFIED DOUBLE-ENTRY LEDGER                        │  │
│    │                    Full Audit Trail                                │  │
│    └────────────────────────────┬───────────────────────────────────────┘  │
│                                 │                                          │
│    ┌────────────────────────────┴───────────────────────────────────────┐  │
│    │                    🔌 INTEGRATION LAYER                            │  │
│    │       Plaid • Duffel • Google Places • xAI Grok • OpenAI           │  │
│    └────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

</div>

<br>

<table>
<tr>
<td width="50%" valign="top">

### 📊 Double-Entry Bookkeeping

<img src="https://img.shields.io/badge/Status-Production%20Ready-success?style=flat-square" alt="Production Ready">

Real accounting, not "tracking."

- **Plaid Sync** — Multi-institution import (banks, brokerages, credit cards)
- **Auto-Categorization** — Merchant mapping with confidence scores, learns from corrections
- **Entity Separation** — P- (personal) • B- (business) • T- (trading) prefixes
- **Journal Entries** — Every transaction creates balanced debits/credits
- **Merchant Learning** — Override once, categorize forever
- **Bank Reconciliation** — Month-end verification against statements

</td>
<td width="50%" valign="top">

### 📈 Trading Analytics

<img src="https://img.shields.io/badge/Status-Production%20Ready-success?style=flat-square" alt="Production Ready">

Built by a daily options trader.

- **Strategy Detection** — Spreads, straddles, iron condors auto-identified
- **Position Lifecycle** — Open → partial → closed with full audit trail
- **Lot-Based Cost Basis** — FIFO, LIFO, HIFO, Specific ID per IRS requirements
- **Wash Sale Tracking** — Disallowed loss + cost basis adjustment fields
- **Trade Journal** — Link thesis, emotion, mistakes to each trade number
- **Robinhood CSV Import** — Parse history, match to Plaid transactions

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 🗺️ Trip Planning

<img src="https://img.shields.io/badge/Status-Production%20Ready-success?style=flat-square" alt="Production Ready">

Activity-based, not destination-based.

- **Multi-Activity Support** — Surf + nomad + coworking in one trip
- **Duffel GDS** — Real-time flight search, offers, booking
- **Google Places** — 60 results per category with photos and ratings
- **Grok AI Analysis** — Sentiment scoring, fit scoring, warnings per place
- **Group Management** — Invite tokens, RSVP tracking, expense splitting
- **Budget Integration** — Trip expenses flow to your Chart of Accounts

</td>
<td width="50%" valign="top">

### 🎛️ Hub / Command Center

<img src="https://img.shields.io/badge/Status-Production%20Ready-success?style=flat-square" alt="Production Ready">

Your financial cockpit.

- **Unified Calendar** — All committed expenses across modules
- **Budget Comparison** — Homebase vs Travel vs Business, month by month
- **Travel Calculator** — Toggle months to see nomad savings
- **Trip Cards** — Destination photos, nomad metrics, budget summaries
- **Committed Trips** — Map view with coordinates and itineraries
- **Wall Street Style** — Dense, data-rich tables, no fluff

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
</table>

</div>

<br>

### Integration Details

| Integration | Purpose | Implementation |
|-------------|---------|----------------|
| **Plaid** | Banking data sync | Production environment, transactions + investments + balances |
| **Duffel** | Flight booking | GDS access: search → offers → passenger details → order creation |
| **Google Places** | Location intelligence | Geocoding, text search (60 results/category), photos, price levels |
| **xAI Grok** | Trip AI analysis | Sentiment scoring, fit scoring, warnings, trending detection |
| **OpenAI** | General AI | Singleton client for explanatory features |
| **Leaflet** | Maps | Trip visualization, destination markers, interactive popups |

<br>

<details>
<summary><strong>📁 Project Structure</strong></summary>

```
temple-stuart/
├── src/
│   ├── app/                    # Next.js App Router (flat routes)
│   │   ├── accounts/           # Plaid account management
│   │   ├── api/                # API routes (61 endpoints)
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
│   │   └── trips/              # Trip-specific (TripMap, etc.)
│   ├── lib/                    # Core libraries
│   │   ├── plaid.ts            # Plaid client (production)
│   │   ├── duffel.ts           # Duffel GDS client
│   │   ├── grok.ts             # xAI Grok client
│   │   ├── placesSearch.ts     # Google Places with caching
│   │   ├── auto-categorization-service.ts
│   │   ├── investment-ledger-service.ts
│   │   ├── robinhood-parser.ts # CSV import
│   │   └── prisma.ts           # Database client
│   └── types/                  # TypeScript types
├── prisma/
│   ├── schema.prisma           # 50+ models, full audit trail
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
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │ Bookkeeping │  │   Trading   │  │    Trips    │  │     Hub     │       │
│  │   Service   │  │   Service   │  │   Service   │  │   Service   │       │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘       │
│         │                │                │                │               │
│  ┌──────┴────────────────┴────────────────┴────────────────┴──────┐       │
│  │                  AUTO-CATEGORIZATION ENGINE                     │       │
│  │    Merchant Mapping (high confidence) → Category Fallback       │       │
│  │    Learning Loop: User corrections → Future predictions         │       │
│  └─────────────────────────────┬──────────────────────────────────┘       │
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
│  │  • 50+ models          • Entity separation (P/B/T)    • Audit trail  │   │
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

Temple Stuart uses a **dual-license model** to balance open-source values with sustainable development.

</div>

<br>

<table>
<tr>
<td width="50%" valign="top">

### 🆓 AGPL v3 — Free Forever

**For personal use & open-source projects**

<img src="https://img.shields.io/badge/Cost-$0-success?style=flat-square" alt="Free">

✅ Self-host for your personal finances<br>
✅ Modify and extend as you wish<br>
✅ Contribute back to the community<br>
✅ Full feature access

⚠️ **Copyleft**: If you deploy Temple Stuart publicly (even as internal SaaS), your **entire codebase** must be open-sourced under AGPL.

<br>

**Perfect for:**
- Personal finance tracking
- Open-source projects
- Learning and experimentation

</td>
<td width="50%" valign="top">

### 💼 Commercial License

**For businesses & proprietary use**

<img src="https://img.shields.io/badge/Pricing-Contact%20Us-blue?style=flat-square" alt="Contact Us">

✅ Keep your code proprietary<br>
✅ No copyleft obligations<br>
✅ Use in commercial products<br>
✅ Priority support included

<br>

| Tier | Notes |
|------|-------|
| 🌱 **Indie** | Small teams, < $100K revenue |
| 🏢 **Business** | Growing companies |
| 🏛️ **Enterprise** | Custom terms |

<br>

[**📧 Contact for Pricing →**](mailto:astuart@templestuart.com)

</td>
</tr>
</table>

<br>

<div align="center">

### Why This Model?

> *"If you use my code to make money, I want to be part of that."*

The AGPL + Commercial model ensures:

**Personal Users** → Use free, forever, no strings attached<br>
**Open-Source Projects** → Contribute and benefit from the community<br>
**Businesses** → Pay fairly for the value you extract<br>
**Competitors** → Can't take, modify, and sell without contributing back

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
<th align="center">🌱 Starter<br><sub>~$19/mo</sub></th>
<th align="center">🚀 Pro<br><sub>~$49/mo</sub></th>
<th align="center">👨‍👩‍👧‍👦 Family<br><sub>~$79/mo</sub></th>
</tr>
<tr>
<td><strong>Users</strong></td>
<td align="center">1</td>
<td align="center">1</td>
<td align="center">5</td>
</tr>
<tr>
<td><strong>Linked Accounts</strong></td>
<td align="center">2</td>
<td align="center">Unlimited</td>
<td align="center">Unlimited</td>
</tr>
<tr>
<td><strong>Bookkeeping</strong></td>
<td align="center">✅</td>
<td align="center">✅</td>
<td align="center">✅</td>
</tr>
<tr>
<td><strong>Trading Analytics</strong></td>
<td align="center">—</td>
<td align="center">✅</td>
<td align="center">✅</td>
</tr>
<tr>
<td><strong>Trip Planning</strong></td>
<td align="center">✅</td>
<td align="center">✅</td>
<td align="center">✅</td>
</tr>
<tr>
<td><strong>Daily Backups</strong></td>
<td align="center">✅</td>
<td align="center">✅</td>
<td align="center">✅</td>
</tr>
<tr>
<td><strong>Plaid Included</strong></td>
<td align="center">✅</td>
<td align="center">✅</td>
<td align="center">✅</td>
</tr>
<tr>
<td><strong>Support</strong></td>
<td align="center">Email</td>
<td align="center">Priority</td>
<td align="center">Priority</td>
</tr>
<tr>
<td><strong>Data Export</strong></td>
<td align="center">CSV</td>
<td align="center">CSV + API</td>
<td align="center">CSV + API</td>
</tr>
<tr>
<td></td>
<td align="center"><a href="mailto:astuart@templestuart.com">Contact</a></td>
<td align="center"><a href="mailto:astuart@templestuart.com">Contact</a></td>
<td align="center"><a href="mailto:astuart@templestuart.com">Contact</a></td>
</tr>
</table>

<br>

<div align="center">

**All plans include:** 14-day free trial • No credit card required • Your data, always exportable

</div>

<br>

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [**Getting Started**](docs/getting-started.md) | Installation, first sync, initial setup |
| [**Bookkeeping Guide**](docs/bookkeeping.md) | Double-entry system, Chart of Accounts |
| [**Trading Analytics**](docs/trading.md) | P&L calculation, wash sales, tax lots |
| [**Trip Planning**](docs/trips.md) | Itinerary building, cost splitting |
| [**Self-Hosting**](docs/self-hosting.md) | Production deployment on Azure/Vercel |
| [**API Reference**](docs/api.md) | REST endpoints, authentication |
| [**Contributing**](CONTRIBUTING.md) | How to contribute, CLA |

<br>

## 🗺️ Roadmap

<div align="center">

```
2025 Q1                    2025 Q2                    2025 Q3                    2025 Q4
   │                          │                          │                          │
   ▼                          ▼                          ▼                          ▼
┌─────────────┐         ┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│ ✅ Core     │         │ 📱 Mobile   │         │ 💰 Invoice  │         │ 🌍 Multi-   │
│ Bookkeeping │         │    App      │         │ Generation  │         │  Currency   │
├─────────────┤         ├─────────────┤         ├─────────────┤         ├─────────────┤
│ ✅ Plaid    │         │ 📄 Tax      │         │ 📊 Advanced │         │ 🏦 Direct   │
│    Sync     │         │    Export   │         │  Analytics  │         │   Banking   │
├─────────────┤         ├─────────────┤         ├─────────────┤         ├─────────────┤
│ ✅ Trading  │         │ ✅ Wash     │         │ 👥 Team     │         │ 🔗 More     │
│    P&L      │         │    Sales    │         │   Features  │         │ Integrations│
├─────────────┤         └─────────────┘         └─────────────┘         └─────────────┘
│ ✅ Trip     │
│    Planning │
├─────────────┤
│ ✅ Grok AI  │
│    Analysis │
└─────────────┘
```

</div>

<br>

**Completed:**
- [x] Double-entry bookkeeping engine
- [x] Plaid multi-account synchronization (production)
- [x] Trading P&L with position lifecycle
- [x] Lot-based cost basis tracking
- [x] Trip planning with multi-activity support
- [x] Duffel flight search and booking
- [x] Google Places integration with caching
- [x] xAI Grok sentiment/fit analysis
- [x] Auto-categorization with learning loop
- [x] Robinhood CSV import + matching

**In Progress:**
- [ ] Wash sale detection automation
- [ ] Tax document generation (8949)
- [ ] Mobile app (React Native)

**Planned:**
- [ ] Multi-currency support
- [ ] Invoice generation
- [ ] Team/family shared access

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

1. Your contributions are licensed under AGPL v3
2. You grant us the right to include your contributions under our commercial license
3. You have the right to make the contribution (no proprietary code)

This allows us to maintain the dual-license model while accepting community contributions.

</details>

<br>

## 🔒 Security

Security is critical for financial software.

| Measure | Implementation |
|---------|----------------|
| **Data Encryption** | AES-256 at rest, TLS 1.3 in transit |
| **Authentication** | NextAuth.js with secure session handling |
| **API Security** | Rate limiting, CORS, CSRF protection |
| **Audit Logging** | Every action logged with user, timestamp, before/after |
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
