# Temple Stuart Accounting

I built my own accounting system.

## Why

I'm trading options daily and starting a business. I needed one place to:
- Track my trades properly
- Handle business accounting
- Learn to code by building something real

Instead of paying for QuickBooks or patching together different tools, I just built what I needed.

## What It Does

Full accounting system with:
- Bank integration (Plaid API)
- Transaction categorization
- Investment/options trade tracking
- Double-entry bookkeeping
- Financial statements (P&L, balance sheet)
- Bank reconciliation
- Period closing
- Financial analysis and projections

## How It Works

Built as a 10-tab system:

1. **Import Data** - Connect banks, pull transactions
2. **Chart of Accounts** - Manage account structure
3. **Journal Entries** - View accounting entries
4. **Post to Ledger** - General ledger view
5. **Reconciliation** - Match bank to books
6. **Adjusting Entries** - Manual corrections
7. **Financial Statements** - P&L and balance sheet
8. **3-Statement Analysis** - Period comparisons
9. **Metrics & Projections** - KPIs and forecasts
10. **Close Books** - Period-end workflow

## Tech Stack

- Next.js 15 + TypeScript
- PostgreSQL (Azure)
- Prisma ORM
- Plaid API
- Tailwind CSS

## Setup

1. Clone repo
2. Set up PostgreSQL database
3. Get Plaid API keys
4. Copy `.env.example` to `.env` with your credentials
5. `npm install`
6. `npx prisma db push`
7. `npm run dev`

## Built With AI

This was built working with Claude (Anthropic's AI). Wanted to test if you could build a real production system by pairing with AI. Turns out you can.

## License

MIT
