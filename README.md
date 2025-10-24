# Temple Stuart Accounting

**Plaid-powered double-entry accounting + AI spending insights built with Next.js / Prisma**

💡 **100% source-available** – read the code, learn from it, fork it for personal use  
💼 **Free for personal use** – Commercial or hosted use requires a Temple Stuart Commercial License  
📜 **License**: Business Source License 1.1 (see [LICENSE](./LICENSE))

---

## What This Is

One platform that replaces:
- 💰 **Mint/Quicken** (spending tracking + budgets)
- 📊 **QuickBooks** (business accounting)
- 📈 **Tradervue** (trading journal)
- 💵 **TurboTax** (tax prep, eventually)

Built for founders who trade and need real books without paying $200/month across five apps.

---

## Why This Exists

I got tired of:
- Paying for five separate subscriptions
- Manually categorizing the same transaction in multiple places
- Wondering if my books would survive an IRS audit
- Explaining to my accountant why trading income was mixed with business expenses

So I built what I needed. If you're a founder who trades, you probably need it too.

---

## What Makes It Different

### 🏦 Account-Level Entity Assignment
Connect your bank account once, mark it as "Personal," "Business," or "Trading." Every transaction from that account automatically knows what it is. No triple-entry across three platforms.

### 📚 Hidden Double-Entry Bookkeeping
You never see debits and credits. The system handles proper accounting (journal entries, ledger posting, balance updates) in the background. Your CPA will be happy. You won't be confused.

### 📊 Trader Tax Status (TTS) Ready
If you elect Mark-to-Market accounting, the system tracks it properly with separate books for each entity, complete audit trail, zero cross-contamination.

### ⚡ Real-Time Sync via Plaid
Most platforms import your data once a day. This syncs through Plaid in real-time. Your dashboard shows what's happening now, not yesterday.

### 🤖 AI-Powered Insights
GPT analyzes your spending patterns and gives you personalized financial advice. Mint doesn't have this. QuickBooks doesn't have this. You do.

---

## Current Status

### ✅ What Works Today

**Core Accounting Engine:**
- ✅ Plaid integration (Wells Fargo, Robinhood, Relay, Tasty Trade tested)
- ✅ Double-entry bookkeeping with journal entries + ledger
- ✅ Entity separation (P-XXXX, B-XXXX, T-XXXX account codes)
- ✅ Transaction → Journal Entry → Ledger → Balance updates (atomic)
- ✅ Merchant mapping with confidence scores

**12-Step Accounting Pipeline:**
1. ✅ Import Data (Plaid sync + manual categorization)
2. ✅ Chart of Accounts (entity-aware COA management)
3. ✅ Journal Entries (view all entries with debit/credit breakdowns)
4. ✅ Post to Ledger (automatic from journal entries)
5. ✅ Reconciliation (bank statement matching)
6. ✅ Adjusting Entries (accruals, depreciation, corrections)
7. ✅ Financial Statements (P&L, Balance Sheet, Cash Flow)
8. ✅ 3-Statement Analysis (financial health metrics)
9. ✅ Metrics & Projections (liquidity ratios, burn rate)
10. ✅ Close Books (period closing with retained earnings)
11. ✅ Trading Journal (win/loss analytics by strategy)
12. ✅ **Spending Dashboard** (Mint-style analytics):
    - Monthly/yearly spending totals
    - 6-month trend chart
    - Entity filtering (Personal/Business/Trading)
    - Budget tracking with color-coded alerts (🟢 <70%, 🟡 70-90%, 🔴 >90%)
    - Top categories & merchants with click-to-filter
    - **AI-powered spending insights** (GPT-4o analysis)
    - Transaction table with smart filters

### 🚧 What's Being Built

**High Priority (Production Readiness):**
- Auto-categorization pipeline (currently manual)
- NextAuth / JWT authentication (replace cookie auth)
- Prisma connection pooling (fix memory leaks)
- Complete reconciliation workflows

**Medium Priority (Feature Completion):**
- Tax Center (Schedule C, Schedule D, 8949 generation)
- Editable budgets (save to database)
- Comparison views ("This month vs last month")
- Export to CSV
- Cash flow statement improvements

**Lower Priority (Polish):**
- Unified UI/UX design system
- Mobile responsiveness
- Email alerts/notifications
- Multi-user permissions

---

## Screenshots

*(Add screenshots here once ready)*

- Spending Dashboard with AI insights
- Journal Entries with debit/credit breakdown
- Trading Journal analytics
- Financial Statements

---

## Tech Stack

- **Frontend**: Next.js 15, TypeScript, Tailwind CSS
- **Backend**: Next.js API routes + Prisma ORM
- **Database**: PostgreSQL (Azure)
- **APIs**: Plaid (financial data), OpenAI (AI insights)
- **Hosting**: Vercel

---

## The Vision

This becomes your **entire financial operating system**:

- **Spending Module**: Mint-style tracking with AI insights ✅
- **Business Module**: P&L, invoicing, expense management
- **Trading Module**: Strategy analysis, wash sale tracking, tax optimization
- **Tax Center**: Generate forms, understand liabilities, file confidently
- **Goals Module**: Plan based on real data across all entities

All with proper entity separation so your personal Starbucks run doesn't show up on your business P&L.

---

## Who This Is For

- Founders running a startup while trading on the side
- Solo contractors who need clean books
- Anyone tired of paying $50/month for five different finance apps
- People who want CPA-grade accuracy without hiring a CPA (yet)

---

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL database
- Plaid API keys (sandbox or development)
- OpenAI API key (for AI insights)

### Installation
```bash
# Clone the repo
git clone https://github.com/your-username/temple-stuart-accounting.git
cd temple-stuart-accounting

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Add your DATABASE_URL, PLAID keys, OPENAI_API_KEY

# Run migrations
npx prisma migrate dev

# Start development server
npm run dev
```

Visit `http://localhost:3000`

---

## Commercial Use

**Personal use is free.** Want to use this commercially or host it for others?

📧 Contact: astuart@templestuart.com  
🌐 More info: https://templestuart.com

---

## Contributing

This is source-available under BUSL-1.1. Contributions are welcome but become part of the Licensed Work under the same license.

Before contributing:
1. Open an issue to discuss the change
2. Fork the repo
3. Submit a PR with tests

---

## License

Business Source License 1.1 – see [LICENSE](./LICENSE)

**TL;DR:**
- ✅ Free to use personally
- ✅ View and modify the source
- ❌ Commercial use requires a paid license
- 🗓️ Converts to Apache 2.0 on 2028-01-01

---

## Acknowledgments

Built with:
- [Plaid](https://plaid.com) for financial data
- [Prisma](https://prisma.io) for database ORM
- [OpenAI](https://openai.com) for AI insights
- [Next.js](https://nextjs.org) for the framework

---

**Made with ☕ by a founder who got tired of juggling five finance apps**
