# Temple Stuart OS

Temple Stuart OS is a personal back-office and trip planner rolled into one. It hooks to your banks, keeps tidy books, helps you split costs with friends, and gives you a dashboard you can actually read.

## What it does (plain English)
- **Bookkeeping that isn't dusty.** Sync your banks with Plaid, tag spending, and spit out real statements and exports your accountant will use.
- **Trip planning around what you actually like.** Compare destinations by surf, trails, or nomad vibe, coordinate RSVPs, and keep the group costs straight.
- **Budget review without the guilt trip.** Set targets, see monthly progress, and drill into the transactions behind every bar.

Those pillars show up in the landing page modules so new users know what's inside.

## Product pillars and vision
- **Single home for money and adventures.** No more bouncing between a finance app, a spreadsheet, and a group chat.
- **Built for real people and small crews.** Friendly labels, audit trails, and CPA-ready outputs without corporate jargon.
- **API-first spine.** Plaid powers bank sync; services for journal entries, reconciliations, and investment tracking keep the ledger honest and extensible.

## How the app is put together
- **Frontend:** Next.js 15 app router with Tailwind UI components. The homepage, dashboard, ledger, and travel modules live in `src/app/`.
- **Auth:** JWT-based helper in `src/lib/auth.ts`; NextAuth is included for sessions on client-heavy views.
- **Finance plumbing:** Plaid client in `src/lib/plaid.ts`, journal and position services in `src/lib/*`, plus dashboard flows for mapping transactions, reconciling banks, closing periods, and exporting for a CPA.

## Getting started locally
1. **Install dependencies:** `npm install`.
2. **Environment:** set `PLAID_CLIENT_ID`, `PLAID_SECRET`, and `JWT_SECRET` in `.env.local` (Plaid is locked to production in the client setup).
3. **Generate Prisma client:** `npx prisma generate` (also runs on `npm run build`).
4. **Run dev server:** `npm run dev` and open http://localhost:3000.

## Who it's for
- Independent workers who want clean books and tax-ready statements without hiring a team.
- Friends planning surf trips or trail weeks who need one spot for budgets, RSVPs, and "who owes who."
- Teammates who want clear, auditable data with minimal fuss.

## Roadmap snapshot
- Finish travel search and RSVPs backed by real data sources (Amadeus is already stubbed in `src/lib/amadeus.ts`).
- Polish CPA exports and period-close workflows for larger books.
- Add mobile-friendly flows for quick tagging and receipt capture.
