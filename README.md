# Temple Stuart Accounting

A modern bookkeeping and automation platform for small businesses and contractors, built with Next.js and integrated with Plaid for seamless financial data synchronization.

## 🎯 Vision

Temple Stuart Accounting simplifies financial management for everyday business owners - electricians, tree services, contractors, and small business owners who need professional bookkeeping without the complexity. We're building the bridge between bank transactions and tax-ready financial statements.

## 🏗️ What's Built So Far

### Core Infrastructure
- **Next.js 15.5.2** application with TypeScript
- **PostgreSQL database** with Prisma ORM
- **Plaid integration** for real-time bank connections
- **Azure cloud deployment** via Vercel
- **User authentication** system

### Features Completed

#### 1. Bank Connection & Data Import ✅
- Connect Wells Fargo, Robinhood, and other banks via Plaid
- Automatic transaction syncing (24 months history)
- Investment transaction tracking (746+ trades synced)
- Real-time balance updates
- Merchant enrichment data from Plaid

#### 2. Transaction Categorization System ✅
- **NEW: COA Assignment Filters** (Sept 2024)
  - Filter by Merchant, Primary Category, or Detailed Category
  - Bulk assign Chart of Accounts to filtered transactions
  - Individual transaction COA override capability
- Dual categorization: Plaid suggestions + custom assignments
- Mobile-optimized responsive tables

#### 3. Dashboard Architecture ✅
- 10-step accounting pipeline interface
- Personal/Business entity separation
- Account balance tracking
- Spending vs Investment transaction tabs

#### 4. Database Schema ✅
```
- Users (authentication)
- PlaidItems (bank connections)
- Accounts (bank accounts)
- Transactions (spending)
- InvestmentTransactions (trades)
- ChartOfAccounts (coming soon)
- JournalEntries (coming soon)
```

## 🚧 What's Left to Build

### Phase 1: Complete COA System (Next Sprint)
- [ ] Save COA assignments to database
- [ ] Create Chart of Accounts management page
- [ ] Build COA learning/memory system
- [ ] Import/export COA templates
- [ ] Sub-account hierarchy

### Phase 2: Journal Entry System
- [ ] Convert categorized transactions to journal entries
- [ ] Manual journal entry creation
- [ ] Adjusting entries interface
- [ ] Document/receipt attachments
- [ ] Entry approval workflow

### Phase 3: General Ledger
- [ ] Post journal entries to ledger
- [ ] Trial balance generation
- [ ] Account reconciliation tools
- [ ] Period closing procedures
- [ ] Audit trail/history

### Phase 4: Financial Statements
- [ ] Income Statement (P&L)
- [ ] Balance Sheet
- [ ] Cash Flow Statement
- [ ] Custom report builder
- [ ] Export to PDF/Excel

### Phase 5: Advanced Features
- [ ] Multi-company support
- [ ] Client portal for bookkeepers
- [ ] Tax preparation exports
- [ ] Automated bank rules
- [ ] Budget vs Actual reporting
- [ ] Financial projections/forecasting
- [ ] Mobile app

### Phase 6: Intelligence Layer
- [ ] AI-powered categorization suggestions
- [ ] Anomaly detection
- [ ] Cash flow predictions
- [ ] Tax optimization suggestions
- [ ] Expense insights and recommendations

## 🔧 Technical Debt & Improvements

### Immediate Needs
- [ ] API endpoint for COA assignments (`/api/transactions/assign-coa`)
- [ ] Transaction bulk update functionality
- [ ] Error handling for Plaid disconnections
- [ ] Loading states for data fetches
- [ ] Data pagination for large datasets

### Infrastructure
- [ ] Add Redis caching for frequently accessed data
- [ ] Implement proper logging system
- [ ] Set up automated testing (Jest/Cypress)
- [ ] API rate limiting
- [ ] Database backup strategy

## 💻 Development Setup

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Add your Plaid, database, and auth credentials

# Run database migrations
npx prisma migrate dev

# Start development server
npm run dev
```

## 🚀 Deployment

Automatically deploys to Vercel on push to main branch:
- Production: [temple-stuart-accounting.vercel.app](https://temple-stuart-accounting.vercel.app)
- GitHub: [github.com/Temple-Stuart/temple-stuart-accounting](https://github.com/Temple-Stuart/temple-stuart-accounting)

## 📊 Current Statistics

- **Transactions Synced**: 543 spending + 746 investment
- **Time Period**: 24 months of data
- **Banks Connected**: 2 (Wells Fargo, Robinhood)
- **Database Size**: ~50MB
- **Response Time**: <200ms average

## 🎨 Design Philosophy

- **Simple**: No accounting jargon, plain English
- **Mobile-First**: 99% of users on phones
- **Fast**: Instant filtering, real-time updates
- **Compliant**: GAAP/IRS/IFRS aligned
- **Unique**: Gold & purple branding, luxury feel

## 📝 License

Copyright (c) 2025 Temple Stuart Accounting / Alexander Stuart
All rights reserved. Proprietary and confidential.

---

Built with ❤️ for small business owners who deserve better than QuickBooks.
