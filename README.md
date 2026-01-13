# Temple Stuart OS

Temple Stuart OS is a personal back office that blends money, travel, and planning into one clear system. Track every dollar, plan the trip, split the costs, and see the full picture without juggling apps.

## What we've built
- **Personal back office.** A unified home for budgets, recurring commitments, and net-worth tracking.
- **Bookkeeping and trading.** Double-entry ledgers, entity separation, Plaid sync, and investment P&L with wash-sale handling.
- **Trip planning with real math.** Compare destinations, collect RSVPs, split expenses, and price your share without spreadsheets.
- **Decision tools.** A nomad vs. home calculator that puts the cost of staying put next to the cost of leaving.
- **AI helpers.** Meal planning and spending insights that connect the dots across your transactions.

## Why it matters
Temple Stuart is built to replace guesswork with signal. It shows you what your money is doing, what your future commitments are, and what the trip actually costs before you book it. The value is clarity, speed, and a system that makes both money and travel feel deliberate.


## How it's put together
- **Frontend:** Next.js App Router with Tailwind styling in `src/app` and `src/components`.
- **Data + auth:** Prisma + Postgres, NextAuth, and JWT helpers.
- **Integrations:** Plaid for bank sync, OpenAI for AI helpers, plus travel/search connectors (Google Places, Amadeus, Duffel, Yelp).


## Quick start
1. **Install dependencies:** `npm install`.
2. **Set environment variables** (see below) in `.env.local`.
3. **Generate Prisma client:** `npx prisma generate` (runs on install/build).
4. **Run migrations:** `npx prisma migrate dev`.
5. **Start the dev server:** `npm run dev` and open http://localhost:3000.

## Environment variables
Required for a minimal local run:
- `DATABASE_URL` (Postgres connection string)
- `JWT_SECRET`
- `NEXTAUTH_SECRET`

Bank sync:
- `PLAID_CLIENT_ID`
- `PLAID_SECRET`

Auth providers (optional):
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`

AI and travel services (optional, feature-dependent):
- `OPENAI_API_KEY`
- `GOOGLE_PLACES_API_KEY`
- `AMADEUS_API_KEY`
- `AMADEUS_API_SECRET`
- `DUFFEL_API_TOKEN`
- `YELP_API_KEY`

Operational:
- `CRON_SECRET`
- `ADMIN_PASSWORD`
- `NEXT_PUBLIC_BASE_URL`
- `NEXT_PUBLIC_APP_URL`

## How to use it
1. **Connect accounts.** Link your banks via Plaid to pull transactions.
2. **Categorize + reconcile.** Map transactions to categories, reconcile statements, and keep the ledger tight.
3. **Plan the month.** Add recurring expenses so your calendar shows what’s already committed.
4. **Plan the trip.** Compare destinations, get group RSVPs, and split costs automatically.
5. **Review the story.** Track net worth, income trends, and what’s changing month over month.

## Scripts
- `npm run dev` — start the dev server
- `npm run build` — generate Prisma client and build
- `npm run start` — run production build
- `npm run lint` — lint the codebase
