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
[![Plaid](https://img.shields.io/badge/Plaid-Connected-00D64F?style=for-the-badge&logo=plaid&logoColor=white)](https://plaid.com/)

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
  - No single source of truth across entities

built_for:
  - Founder-traders (personal + business + trading accounts)
  - Active options traders needing wash-sale compliance
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
│    │         Plaid • Duffel • Google Places • OpenAI (read-only)        │  │
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

- **Plaid Integration** — Multi-institution sync with automatic categorization
- **Journal Entries** — Every transaction creates balanced debits/credits
- **Entity Separation** — Personal • Business • Trading (IRS-compliant boundaries)
- **Merchant Mapping** — Learn once, categorize forever
- **CPA Export** — One-click reports your accountant will love

</td>
<td width="50%" valign="top">

### 📈 Trading Analytics

<img src="https://img.shields.io/badge/Status-Beta-yellow?style=flat-square" alt="Beta">

Built by a daily options trader.

- **Strategy Detection** — Spreads, straddles, iron condors auto-identified
- **Wash Sale Tracking** — IRS-compliant, lot-level precision
- **Cost Basis Methods** — FIFO, LIFO, Specific ID, Average Cost
- **P&L Reporting** — Short-term / Long-term segregation
- **Tax Lot Optimization** — Minimize tax liability legally

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 🗺️ Trip Planning

<img src="https://img.shields.io/badge/Status-Production%20Ready-success?style=flat-square" alt="Production Ready">

Activity-based, not destination-based.

- **AI Recommendations** — GPT-powered suggestions based on your preferences
- **Duffel Integration** — Flight search and booking built-in
- **Group Cost Splitting** — Fair splits, track who owes what
- **Budget Tracking** — Per-trip, per-category budgets
- **Itinerary Builder** — Drag-and-drop activity scheduling

</td>
<td width="50%" valign="top">

### 🎛️ Hub / Command Center

<img src="https://img.shields.io/badge/Status-Alpha-red?style=flat-square" alt="Alpha">

Your financial cockpit.

- **Unified Dashboard** — All modules, one view
- **Net Worth Tracking** — Assets minus liabilities, over time
- **Budget vs Actual** — Committed plans vs reality
- **Calendar Integration** — Scheduled transactions, bill reminders
- **Quick Actions** — Record transactions without navigating

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
<br><sub><b>React 19</b></sub>
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
<img src="https://skillicons.dev/icons?i=github" width="48" height="48" alt="GitHub" />
<br><sub><b>GitHub</b></sub>
</td>
<td align="center" width="96">
<img src="https://cdn.simpleicons.org/plaid/00D64F" width="48" height="48" alt="Plaid" />
<br><sub><b>Plaid API</b></sub>
</td>
<td align="center" width="96">
<img src="https://cdn.simpleicons.org/openai/412991" width="48" height="48" alt="OpenAI" />
<br><sub><b>OpenAI</b></sub>
</td>
<td align="center" width="96">
<img src="https://cdn.simpleicons.org/stripe/635BFF" width="48" height="48" alt="Stripe" />
<br><sub><b>Stripe</b></sub>
</td>
</tr>
</table>

</div>

<br>

<details>
<summary><strong>📁 Project Structure</strong></summary>

```
temple-stuart/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/             # Authentication routes
│   │   ├── (dashboard)/        # Protected dashboard routes
│   │   ├── api/                # API routes
│   │   └── layout.tsx          # Root layout
│   ├── components/             # React components
│   │   ├── ui/                 # shadcn/ui primitives
│   │   ├── bookkeeping/        # Bookkeeping module
│   │   ├── trading/            # Trading module
│   │   ├── trips/              # Trip planning module
│   │   └── hub/                # Hub/dashboard
│   ├── lib/                    # Core libraries
│   │   ├── accounting/         # Double-entry engine
│   │   ├── plaid/              # Plaid integration
│   │   ├── trading/            # P&L calculations
│   │   └── utils/              # Shared utilities
│   └── types/                  # TypeScript types
├── prisma/
│   ├── schema.prisma           # Database schema
│   ├── migrations/             # Migration history
│   └── seed.ts                 # Database seeding
├── docs/                       # Documentation
├── tests/                      # Test suites
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
                                    │  (Web / Mobile) │
                                    └────────┬────────┘
                                             │
                                             ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                              PRESENTATION LAYER                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         Next.js 15 (App Router)                       │  │
│  │  • React Server Components    • Edge Runtime    • API Routes          │  │
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
│         └─────────────────┴─────────────────┴───────────────┘              │
│                                    │                                       │
│                    ┌───────────────┴───────────────┐                       │
│                    │   Double-Entry Accounting     │                       │
│                    │          Engine               │                       │
│                    └───────────────────────────────┘                       │
└────────────────────────────────────────────────────────────────────────────┘
                                             │
                                             ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                                DATA LAYER                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     Prisma ORM + PostgreSQL 16                       │   │
│  │  • Full audit logging    • Entity separation    • Soft deletes       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────┘
                                             │
                                             ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                            INTEGRATION LAYER                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  ┌──────────┐               │
│  │   Plaid  │  │  Duffel  │  │ Google Places│  │  OpenAI  │               │
│  │ Banking  │  │ Flights  │  │  Locations   │  │ (explain)│               │
│  └──────────┘  └──────────┘  └──────────────┘  └──────────┘               │
└────────────────────────────────────────────────────────────────────────────┘
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
git clone https://github.com/yourusername/temple-stuart.git
cd temple-stuart

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
# PLAID (Banking Integration)
# ═══════════════════════════════════════════════════════════════
PLAID_CLIENT_ID="your-client-id"
PLAID_SECRET="your-secret"
PLAID_ENV="sandbox"  # sandbox | development | production

# ═══════════════════════════════════════════════════════════════
# DUFFEL (Flight Booking) — Optional
# ═══════════════════════════════════════════════════════════════
DUFFEL_ACCESS_TOKEN="your-duffel-token"

# ═══════════════════════════════════════════════════════════════
# OPENAI (Explanatory AI) — Optional
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

<img src="https://img.shields.io/badge/Starts_at-$500%2Fyr-blue?style=flat-square" alt="From $500/yr">

✅ Keep your code proprietary<br>
✅ No copyleft obligations<br>
✅ Use in commercial products<br>
✅ Priority support included

<br>

| Tier | Price | Revenue Cap |
|------|-------|-------------|
| 🌱 **Indie** | $500/yr | < $100K |
| 🏢 **Business** | $2,500/yr | < $1M |
| 🏛️ **Enterprise** | Custom | Unlimited |

<br>

[**📄 Read Full License →**](COMMERCIAL_LICENSE.md)

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

</div>

<br>

<table>
<tr>
<th></th>
<th align="center">🌱 Starter<br><sub>$19/mo</sub></th>
<th align="center">🚀 Pro<br><sub>$49/mo</sub></th>
<th align="center">👨‍👩‍👧‍👦 Family<br><sub>$79/mo</sub></th>
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
<td align="center"><a href="#">Start Free Trial</a></td>
<td align="center"><a href="#">Start Free Trial</a></td>
<td align="center"><a href="#">Start Free Trial</a></td>
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
2026 Q1                    2026 Q2                    2026 Q3                    2026 Q4
   │                          │                          │                          │
   ▼                          ▼                          ▼                          ▼
┌─────────────┐         ┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│ ✅ Core     │         │ 📱 Mobile   │         │ 💰 Invoice  │         │ 🌍 Multi-   │
│ Bookkeeping │         │    App      │         │ Generation  │         │  Currency   │
├─────────────┤         ├─────────────┤         ├─────────────┤         ├─────────────┤
│ ✅ Plaid    │         │ 🔄 Wash     │         │ 📊 Advanced │         │ 🏦 Direct   │
│    Sync     │         │    Sales    │         │  Analytics  │         │   Banking   │
├─────────────┤         ├─────────────┤         ├─────────────┤         ├─────────────┤
│ ✅ Basic    │         │ 📄 Tax      │         │ 👥 Team     │         │ 🔗 More     │
│    Trading  │         │    Export   │         │   Features  │         │ Integrations│
└─────────────┘         └─────────────┘         └─────────────┘         └─────────────┘
```

</div>

<br>

- [x] Double-entry bookkeeping engine
- [x] Plaid multi-account synchronization
- [x] Basic trading P&L reporting
- [x] Trip planning with AI recommendations
- [ ] Wash sale detection (Q1 2026)
- [ ] Tax document generation (Q2 2026)
- [ ] iOS & Android apps (Q2 2026)
- [ ] Multi-currency support (Q4 2026)
- [ ] Invoice generation (Q3 2026)

<br>

## 🤝 Contributing

We welcome contributions! Whether it's bug fixes, new features, or documentation improvements.

```bash
# 1. Fork the repository

# 2. Clone your fork
git clone https://github.com/YOUR_USERNAME/temple-stuart.git

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

**Found a vulnerability?** Email [security@templestuart.com](mailto:security@templestuart.com) with details. We respond within 24 hours and offer bounties for critical issues.

<br>

## 💬 Community & Support

<div align="center">

[![Discord](https://img.shields.io/badge/Discord-Join%20Server-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/templestuart)
[![Twitter](https://img.shields.io/badge/Twitter-Follow-1DA1F2?style=for-the-badge&logo=twitter&logoColor=white)](https://twitter.com/templestuart)
[![GitHub Discussions](https://img.shields.io/badge/Discussions-Ask%20Questions-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/yourusername/temple-stuart/discussions)

</div>

<br>

## 📞 Contact

| Purpose | Contact |
|---------|---------|
| **Commercial Licensing** | [licensing@templestuart.com](mailto:licensing@templestuart.com) |
| **Managed Hosting** | [hosting@templestuart.com](mailto:hosting@templestuart.com) |
| **General Support** | [support@templestuart.com](mailto:support@templestuart.com) |
| **Security Issues** | [security@templestuart.com](mailto:security@templestuart.com) |
| **Press & Media** | [press@templestuart.com](mailto:press@templestuart.com) |

<br>

---

<div align="center">

<br>

**Built with obsessive attention to accuracy by someone who lost money to bad financial tools.**

<sub>Temple Stuart is not a financial advisor, CPA, or tax professional.<br>Always consult qualified professionals for tax and investment decisions.</sub>

<br>

<a href="https://github.com/yourusername/temple-stuart/stargazers">
  <img src="https://img.shields.io/github/stars/yourusername/temple-stuart?style=social" alt="GitHub Stars">
</a>
<a href="https://github.com/yourusername/temple-stuart/network/members">
  <img src="https://img.shields.io/github/forks/yourusername/temple-stuart?style=social" alt="GitHub Forks">
</a>

<br><br>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://capsule-render.vercel.app/api?type=waving&color=0:0d1117,50:161b22,100:21262d&height=100&section=footer&stroke=30363d&strokeWidth=1">
  <source media="(prefers-color-scheme: light)" srcset="https://capsule-render.vercel.app/api?type=waving&color=0:667eea,50:764ba2,100:f093fb&height=100&section=footer">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=0:667eea,50:764ba2,100:f093fb&height=100&section=footer" width="100%">
</picture>

</div>
