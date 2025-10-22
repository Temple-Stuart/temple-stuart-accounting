# Temple Stuart Accounting

## What This Is

You want to start a business. You also trade stocks and options. You need to track your personal spending. Right now, that means juggling three different platforms:

- **Personal finance**: Mint, Personal Capital, or Kubera
- **Business accounting**: QuickBooks, Xero, or Wave  
- **Trading journal**: TraderSync, Tradervue, or Edgewonk

Temple Stuart replaces all three. One platform, one login, everything in one place.

## Why This Exists

I got tired of:
- Paying for three separate subscriptions
- Manually categorizing the same transaction in multiple places
- Wondering if my books would survive an IRS audit
- Explaining to my accountant why my trading income was mixed with business expenses

So I built what I needed. If you're a founder who trades, you probably need it too.

## What Makes It Different

**Account-Level Entity Assignment**  
Connect your bank account once, mark it as "Personal" or "Business" or "Trading." Every transaction from that account automatically knows what it is. No more categorizing every purchase three times.

**Hidden Double-Entry Bookkeeping**  
You never see debits and credits. The system handles proper accounting in the background. Your CPA will be happy. You won't be confused.

**Trader Tax Status (TTS) Ready**  
If you elect Mark-to-Market accounting for trading, the system tracks it properly. Separate books for each entity, complete audit trail, zero cross-contamination.

**Real-Time, Not Batch**  
Most platforms import your data once a day. This syncs in real-time through Plaid. Your dashboard shows what's happening now, not yesterday.

## Who This Is For

- Founders running a startup while trading on the side
- Solo contractors who need clean books for their business
- Anyone tired of paying $50/month for three different finance apps
- People who want CPA-grade accuracy without hiring a CPA (yet)

## Current Status

**What Works:**
- ✅ Plaid integration (connects to banks, brokerages, credit cards)
- ✅ Entity separation (personal/business/trading)
- ✅ Transaction import from Wells Fargo, Robinhood, Relay Bank, Tasty Trade
- ✅ Double-entry accounting engine (runs invisibly)
- ✅ Chart of Accounts with entity prefixes (P-XXXX, B-XXXX, T-XXXX)

**What's Being Built:**
- Transaction categorization → journal entry pipeline
- Financial statements (Income Statement, Balance Sheet, Cash Flow)
- Tax Center (aggregates all entities for filing)
- Trading journal analytics (win rate, strategy performance)
- GPT-powered tax explanation (tells you WHY things were categorized certain ways)

## Tech Stack

- **Frontend**: Next.js, TypeScript, Tailwind
- **Backend**: Next.js API routes
- **Database**: PostgreSQL (Azure)
- **APIs**: Plaid for financial data, OpenAI for tax explanations
- **Hosting**: Vercel

## The Vision

Eventually, this becomes your entire financial operating system:

- **Spending Module**: Track personal expenses, set budgets
- **Business Module**: P&L, invoicing, expense tracking
- **Trading Module**: Journal every trade, track strategies, calculate realized/unrealized gains
- **Tax Center**: See what you owe, understand why
- **Goals Module**: Plan for the future based on real data

All with proper entity separation so your personal Starbucks run doesn't accidentally show up on your business P&L.

## Getting Started

Not ready for public use yet. Still wiring up the core data flow. Check back soon.

## License

AGPL-3.0 - See LICENSE file for details.

---

Built by someone who got tired of paying three companies to do one job poorly.
