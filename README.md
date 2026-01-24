# Temple Stuart

**Personal back office for people with complex financial lives.**

Track your money. Budget your life. Plan your trips.

---

## What is this?

Temple Stuart is a unified finance platform that replaces the patchwork of apps most people use to manage their money — Mint, QuickBooks, spreadsheets, trading journals, trip planners.

Connect your accounts once. Categorize transactions once. The system handles the rest.

---

## What's built

**Bookkeeping**
- Plaid integration (banks, brokerages, credit cards)
- Transaction review queues (spending + investing separated)
- Chart of Accounts with proper entity separation
- Double-entry accounting running under the hood
- Financial statements: income statement, balance sheet, general ledger
- CPA-ready exports

**Trading P&L**
- Lot-based cost basis (FIFO / LIFO / HIFO)
- Wash sale detection
- Stock split handling
- Strategy-level analytics
- Win rate, average win/loss, P&L by ticker

**Budgeting**
- Monthly budgets by category
- Actuals populate automatically from committed transactions
- Budget vs actual comparison with variance indicators
- Homebase vs travel cost calculator

**Trip Planning**
- Create trips, invite friends
- AI assistant searches Google Places for lodging, coworking, dining, activities, nightlife
- Traveler profile (trip type, budget, priorities, dealbreakers)
- Selections commit directly to budget with cost splitting
- 11 vendor categories: lodging, coworking, moto rental, equipment rental, airport transfers, brunch/coffee, dinner, activities, nightlife, toiletries, wellness

**Hub**
- Central dashboard
- Budget vs actual matrix
- Nomad calculator: compare staying home vs traveling

---

## Tech stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 15, TypeScript, Tailwind CSS |
| Backend | Next.js API routes |
| Database | PostgreSQL (Azure) |
| ORM | Prisma |
| Auth | JWT with HTTP-only cookies |
| Financial data | Plaid API |
| AI recommendations | GPT-4, Google Places API |
| Flights | Duffel API |
| Hotels | RateHawk API |
| Hosting | Vercel |

---

## Current status

**Working prototype.** I use it daily to manage my own finances.

- Core bookkeeping pipeline complete
- Trading P&L functional with 746+ trades synced
- Trip planner AI operational
- Budgeting module live with actuals integration
- Security hardening in progress before public release

---

## Traction

All organic. No ad spend.

- 4M+ views across Reddit and social media
- 1.8k Instagram followers (overnight, single post)
- 1.3k Reddit followers
- New York Times feature on using AI for accounting and trading
- YouTube videos with 1.8k+ views

---

## Who this is for

- Founders running a business while trading on the side
- Freelancers and contractors who need clean books
- Digital nomads who want to see if traveling actually saves money
- Anyone tired of juggling five finance apps and a spreadsheet

---

## Roadmap

- [ ] Security hardening
- [ ] User onboarding flow
- [ ] Public beta release
- [ ] Mobile experience
- [ ] Multi-user trip planning
- [ ] AI-powered shopping/grocery module
- [ ] Marketplace integration (buy directly from budget)

---

## About

Built by Alex — 7 years as a general accountant, no degree, hit a ceiling, decided to build the thing myself.

I built this because I've never been organized with money. Just guessing every time I made a decision. Temple Stuart is the tool I needed but couldn't find.

---

## License

AGPL-3.0

---

## Links

- [Website](https://templestuart.com)
- [Instagram](https://instagram.com/templestuart)
- [Reddit](https://reddit.com/u/templestuart)
