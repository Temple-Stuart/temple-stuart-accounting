# Temple Stuart -- Personal Back Office

**Track your money. Trade smarter. Plan your life.**

Temple Stuart is a unified personal finance platform that combines double-entry bookkeeping,
options trading analytics with AI-powered market analysis, trip planning, meal planning,
and life expense budgeting into one system.

Built by one person using AI (GPT, Claude, Grok) over 8 months. Featured in
[The New York Times](https://www.nytimes.com/2025/09/13/business/chatgpt-financial-advice.html).

---

## What It Does

### Volatility Scanner and AI Analysis

Scans up to 475 S&P 500 tickers (plus Nasdaq-100, Dow 30, ETFs, sector lists) through
Tastytrade's market metrics API, then scores and filters them for options trading opportunities.

- Pulls IV, HV (30/60/90 day), IV Rank, term structure, earnings dates, borrow rates, beta, and SPY correlation per ticker
- Applies hard gates: liquidity >= 3, IV-HV spread >= 5, IV Rank >= 15%, borrow rate <= 10%
- Scores 0-100 across multiple factors with sector diversity penalty
- Claude Sonnet generates a Market Brief: regime snapshot, sector heatmap, risk clusters, top ticker notes
- Top tickers auto-expand with strategy cards (spreads, straddles, iron condors) including P&L charts, Greeks, breakevens
- Per-strategy AI analysis in plain English via Claude
- Finnhub provides news headlines and analyst ratings per ticker
- Trade journal with thesis, emotion tracking, and self-assessment per trade number

### Bookkeeping

Plaid-synced double-entry accounting that actually works for people with multiple entities.

- Multi-institution bank sync via Plaid (banks, brokerages, credit cards)
- Auto-categorization engine: merchant mapping with confidence scores, learns from corrections
- Entity separation with prefixes: P- (personal), B- (business), T- (trading)
- Every transaction creates balanced debit/credit journal entries
- Chart of Accounts with settled and pending balances
- Bank reconciliation, period close, general ledger, financial statements
- Robinhood CSV import with lot matching and reconciliation
- Lot-based cost basis tracking: FIFO, LIFO, HIFO, Specific ID
- Wash sale tracking with disallowed loss and cost basis adjustment fields
- Corporate action handling (splits, reverse splits, mergers)

### Budget and Life Expenses

Track committed expenses across every category of your life.

- Monthly budgets by COA code with year-over-year comparison
- Dedicated modules: Home, Auto, Personal, Health, Growth, Business, Income
- Each module has its own page, API, and calendar integration
- Committed expenses flow into the Hub calendar
- Net worth tracking across all accounts
- AI-powered spending insights via OpenAI

### Shopping and Meal Planning

- AI meal planner generates weekly plans with ingredient lists and costs
- Cart planner for clothing, hygiene, cleaning, and kitchen supplies
- Shopping lists commit to budget as line items with COA codes
- Powered by OpenAI

### Trip Planning

Activity-based trip planning with real booking and group coordination.

- Multi-activity support: ski, surf, nomad, golf, cycling, races, festivals, conferences, and more
- Duffel GDS integration for real-time flight search and booking
- Google Places API: up to 60 results per category with photos, ratings, price levels
- Grok AI analysis: sentiment scoring, fit scoring, warnings per place
- Group management: invite tokens, RSVP tracking, payment method collection
- Expense splitting with per-person calculations
- Lodging, vehicle, and transfer option comparison
- Trip AI assistant for destination recommendations
- Committed trips get coordinates and appear on the Hub map

### Hub (Command Center)

- Year calendar view with all committed expenses across every module
- Color-coded by source: home, auto, shopping, personal, health, growth, trips
- Monthly budget summaries: homebase vs travel vs business
- Committed trip cards with destination photos and map markers
- Leaflet map with interactive popups for trip locations

---

## Tech Stack

- **Framework:** Next.js 15 (App Router) + React 18 + TypeScript
- **Styling:** Tailwind CSS
- **Database:** PostgreSQL + Prisma ORM (60+ models)
- **Auth:** NextAuth.js + custom JWT cookie auth, bcrypt password hashing
- **Financial Data:** Plaid (banking/investments), Tastytrade API (options/market metrics)
- **AI:** Anthropic Claude (`@anthropic-ai/sdk`) for market briefs and strategy analysis, OpenAI for meal planning and spending insights, xAI Grok for trip AI analysis
- **News:** Finnhub API for headlines and analyst ratings
- **Travel:** Duffel GDS (flights), Google Places API (locations), Leaflet (maps)
- **Payments:** Stripe (subscriptions with free/pro/pro+ tiers)
- **Hosting:** Vercel

---

## API Routes

120+ endpoints grouped by domain.

### Trading
- `/api/tastytrade/scanner` -- Volatility scan across S&P 500, Nasdaq-100, Dow 30, ETFs, sectors
- `/api/tastytrade/quotes` -- Live quotes from Tastytrade
- `/api/tastytrade/chains` -- Option chains
- `/api/tastytrade/greeks` -- Greeks data
- `/api/tastytrade/balances` -- Account balances
- `/api/tastytrade/positions` -- Current positions
- `/api/tastytrade/connect` -- Connect Tastytrade account
- `/api/tastytrade/disconnect` -- Disconnect
- `/api/tastytrade/status` -- Connection status
- `/api/ai/market-brief` -- Claude-powered regime analysis, sector heatmap, risk clusters
- `/api/ai/strategy-analysis` -- Per-strategy plain-English AI analysis via Claude
- `/api/finnhub/ticker-context` -- News headlines and analyst ratings
- `/api/trading` -- Trading overview data
- `/api/trading/trades` -- Trade listing with P&L
- `/api/trading-journal` -- Trade journal CRUD (thesis, emotion, lessons)
- `/api/trading-positions/open` -- Open position tracking
- `/api/investment-transactions` -- Investment transaction CRUD
- `/api/investment-transactions/analyze` -- Trade analysis
- `/api/investment-transactions/commit-to-ledger` -- Commit trades to double-entry ledger
- `/api/investment-transactions/opens` -- Open positions
- `/api/investments` -- Investment management
- `/api/investments/analyze` -- Portfolio analysis
- `/api/investments/assignment-exercise` -- Options assignment/exercise handling
- `/api/stock-lots` -- Lot-based cost basis tracking
- `/api/stock-lots/match` -- Lot matching (FIFO/LIFO/HIFO/Specific)
- `/api/stock-lots/commit` -- Commit lot dispositions
- `/api/corporate-actions` -- Stock splits, mergers, corporate events
- `/api/robinhood/append-history` -- Robinhood CSV import
- `/api/robinhood/get-history` -- Robinhood history retrieval

### Bookkeeping
- `/api/plaid/link-token` -- Create Plaid Link token
- `/api/plaid/exchange-token` -- Exchange public token for access token
- `/api/plaid/sync` -- Sync transactions from Plaid
- `/api/plaid/items` -- Manage connected bank items
- `/api/transactions` -- Transaction CRUD
- `/api/transactions/sync` -- Trigger transaction sync
- `/api/transactions/auto-categorize` -- Run auto-categorization
- `/api/transactions/assign-coa` -- Assign Chart of Accounts code
- `/api/transactions/commit-to-ledger` -- Commit to double-entry ledger
- `/api/transactions/review-queue` -- Review queue for categorization
- `/api/transactions/manual` -- Manual transaction entry
- `/api/chart-of-accounts` -- Chart of Accounts CRUD
- `/api/chart-of-accounts/balances` -- Account balance queries
- `/api/journal-entries` -- Journal entry listing
- `/api/journal-entries/manual` -- Manual journal entries
- `/api/ledger` -- General ledger queries
- `/api/accounts` -- Account management
- `/api/merchant-mappings` -- Merchant-to-COA learning mappings
- `/api/bank-reconciliations` -- Bank reconciliation
- `/api/closing-periods` -- Period close management
- `/api/period-closes` -- Period close status
- `/api/statements` -- Financial statements
- `/api/statements/analysis` -- Three-statement analysis

### Budget and Life Expenses
- `/api/budgets` -- Budget CRUD
- `/api/home` -- Home expense management
- `/api/auto` -- Auto expense management
- `/api/personal` -- Personal expense management
- `/api/business` -- Business expense management
- `/api/health` -- Health expense management
- `/api/growth` -- Growth/education expense management
- `/api/income` -- Income tracking
- `/api/net-worth` -- Net worth calculation
- `/api/metrics` -- Financial metrics
- `/api/stats` -- Statistics
- `/api/calendar` -- Calendar events CRUD
- `/api/shopping` -- Shopping list CRUD
- `/api/shopping/commit` -- Commit shopping to budget
- `/api/ai/meal-plan` -- AI meal plan generation
- `/api/ai/meal-planner` -- AI meal planner
- `/api/ai/cart-plan` -- AI cart plan generation
- `/api/ai/spending-insights` -- AI spending analysis

### Trip Planning
- `/api/trips` -- Trip CRUD
- `/api/trips/[id]` -- Single trip management
- `/api/trips/[id]/activities` -- Activity options
- `/api/trips/[id]/lodging` -- Lodging options
- `/api/trips/[id]/vehicles` -- Vehicle rental options
- `/api/trips/[id]/transfers` -- Transfer options
- `/api/trips/[id]/destinations` -- Destination management
- `/api/trips/[id]/budget` -- Trip budget
- `/api/trips/[id]/expenses` -- Trip expenses
- `/api/trips/[id]/participants` -- Participant management
- `/api/trips/[id]/ai-assistant` -- Trip AI recommendations
- `/api/trips/[id]/commit` -- Commit/finalize trip
- `/api/trips/rsvp` -- RSVP handling
- `/api/destinations` -- Destination search
- `/api/resorts` -- Ikon resort data
- `/api/travel/flights` -- Flight search
- `/api/travel/hotels` -- Hotel search
- `/api/travel/transfers` -- Transfer search
- `/api/travel/quote` -- Travel quotes
- `/api/flights/search` -- Duffel flight search
- `/api/flights/book` -- Duffel flight booking

### Hub
- `/api/hub/year-calendar` -- Year calendar with all committed expenses
- `/api/hub/business-budget` -- Business budget summary
- `/api/hub/nomad-budget` -- Nomad/travel budget summary
- `/api/hub/trips` -- Committed trips for map display

### Auth and Admin
- `/api/auth/login` -- Login
- `/api/auth/signup` -- Registration
- `/api/auth/logout` -- Logout
- `/api/auth/me` -- Current user
- `/api/admin/verify` -- Admin verification
- `/api/stripe/checkout` -- Stripe checkout session
- `/api/stripe/portal` -- Stripe customer portal
- `/api/stripe/webhook` -- Stripe webhook handler

---

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- API keys: Plaid, Anthropic (Claude), and at minimum one of the optional integrations

### Setup

```bash
git clone https://github.com/Temple-Stuart/temple-stuart-accounting.git
cd temple-stuart-accounting
npm install
cp .env.example .env.local
# Add your API keys to .env.local
npx prisma generate
npx prisma db push
npm run dev
```

Open http://localhost:3000

### Environment Variables

See [`.env.example`](.env.example) for the full list. The required ones:

```
DATABASE_URL=                 # PostgreSQL connection string
JWT_SECRET=                   # Secret for JWT token signing
NEXTAUTH_SECRET=              # NextAuth.js secret
PLAID_CLIENT_ID=              # Plaid API client ID
PLAID_SECRET=                 # Plaid API secret
ANTHROPIC_API_KEY=            # Claude API key (market briefs, strategy analysis)
```

Optional (features degrade gracefully without these):

```
FINNHUB_API_KEY=              # News headlines and analyst ratings
OPENAI_API_KEY=               # Meal planning, spending insights
XAI_API_KEY=                  # Grok trip AI analysis
DUFFEL_API_TOKEN=             # Flight search and booking
GOOGLE_PLACES_API_KEY=        # Location intelligence for trips
STRIPE_SECRET_KEY=            # Subscription billing
```

---

## Project Structure

```
src/
├── app/
│   ├── api/                  # 120+ API routes
│   │   ├── tastytrade/       # Scanner, quotes, chains, Greeks, positions
│   │   ├── ai/               # Market brief, strategy analysis, meal planning
│   │   ├── plaid/            # Bank sync, link tokens
│   │   ├── transactions/     # CRUD, categorization, ledger commit
│   │   ├── trips/            # Trip CRUD, participants, activities, booking
│   │   ├── investment-transactions/  # Trade processing, lot matching
│   │   ├── stock-lots/       # Cost basis tracking
│   │   ├── hub/              # Calendar, budget summaries
│   │   ├── stripe/           # Payments and subscriptions
│   │   └── ...
│   ├── trading/              # Volatility scanner, AI analysis, strategy cards
│   ├── dashboard/            # Main bookkeeping dashboard
│   ├── transactions/         # Transaction review and categorization
│   ├── chart-of-accounts/    # Chart of Accounts management
│   ├── journal-entries/      # Journal entries
│   ├── ledger/               # General ledger
│   ├── statements/           # Financial statements
│   ├── hub/                  # Command center (calendar, map, budgets)
│   ├── shopping/             # Meal and cart planning
│   ├── trips/                # Trip detail pages, RSVP
│   ├── budgets/              # Trip budget pages
│   ├── home/                 # Home expenses
│   ├── auto/                 # Auto expenses
│   ├── personal/             # Personal expenses
│   ├── business/             # Business expenses
│   ├── health/               # Health expenses
│   ├── growth/               # Growth/education expenses
│   ├── income/               # Income tracking
│   ├── net-worth/            # Net worth
│   ├── accounts/             # Plaid account management
│   └── ...
├── components/
│   ├── dashboard/            # Bookkeeping components (30+ files)
│   ├── trips/                # Trip components (maps, pickers, AI assistant)
│   ├── shopping/             # Meal planner, cart planner
│   ├── sections/             # Landing page sections
│   └── ui/                   # Shared primitives (Button, Card, Badge, etc.)
├── lib/
│   ├── tastytrade.ts         # Tastytrade API client
│   ├── strategy-builder.ts   # Client-side option strategy generation
│   ├── plaid.ts              # Plaid client (production)
│   ├── prisma.ts             # Database client
│   ├── auth.ts               # JWT auth helpers
│   ├── auto-categorization-service.ts  # Merchant mapping + category fallback
│   ├── investment-ledger-service.ts    # Trade-to-ledger commit engine
│   ├── journal-entry-service.ts        # Journal entry creation
│   ├── position-tracker-service.ts     # Options position lifecycle
│   ├── robinhood-parser.ts   # Robinhood CSV import
│   ├── seedDefaultCOA.ts     # Default Chart of Accounts seeding
│   ├── duffel.ts             # Duffel GDS client
│   ├── grok.ts               # xAI Grok client
│   ├── grokAgent.ts          # Grok agent for trip analysis
│   ├── placesSearch.ts       # Google Places with caching
│   ├── stripe.ts             # Stripe client and tier management
│   ├── openai.ts             # OpenAI client
│   └── ...
└── middleware.ts              # Auth middleware (JWT verification)
```

---

## How the Scanner Works

1. Select a universe: S&P 500 (475 tickers), Nasdaq-100, Dow 30, ETFs, sector lists, or custom symbols
2. Fetch market metrics from Tastytrade in batches of 50: IV, HV (30/60/90 day), IV Rank, term structure, earnings dates, borrow rates, beta, SPY correlation, lendability
3. Apply hard gates: liquidity >= 3, IV-HV spread >= 5, IV Rank >= 15%, borrow rate <= 10%
4. Client-side scoring (0-100) across multiple factors with sector diversity penalty
5. Claude Sonnet generates a Market Brief from the qualifying universe: regime snapshot, sector heatmap, risk clusters (earnings overlap, sector concentration, rising vol, backwardated term structures), top ticker notes
6. Top tickers auto-expand with strategy cards built client-side from option chains: credit spreads, debit spreads, iron condors, straddles, strangles -- with P&L curves, Greeks, breakevens, probability of profit
7. Finnhub provides news headlines and analyst ratings in parallel; per-strategy AI analysis via Claude explains each trade in plain English

---

## License

AGPL-3.0. See [LICENSE](LICENSE).

You can use, modify, and self-host Temple Stuart. If you modify it and run it as a web service, you must open-source your modifications under the same license.

---

## Disclaimer

This is not financial advice. The AI does not make trading decisions. It scans, filters, scores, and explains. You decide. Options trading involves significant risk of loss. Always consult qualified professionals for tax and investment decisions.

---

## Author

**Alex Stuart** -- [astuart@templestuart.com](mailto:astuart@templestuart.com)

Built with GPT, Claude, and Grok. Featured in
[The New York Times](https://www.nytimes.com/2025/09/13/business/chatgpt-financial-advice.html).
