# Temple Stuart

Twenty-five business tools on one data pipe that ends in one Ledger and one Calendar.

Source-available (BSL 1.1) · built and operated in production by its founder as User #1 · as of 2026-09-02: 116 Prisma models, 288 API route files, 121 feeds from 20 providers (counted August 24, 2026)

## The system

A small business runs on about twenty-five tools — invoicing, payroll, banking, travel, trading, tax, projects — and none of them knows what the others did. Temple Stuart replaces that with one data pipe. By design: every provider answer lands once, word for word, fingerprinted; every feed is labeled by its kind and lands in the table for that kind; what happened to you is kept apart from what you did; every tool runs the same loop and stores its records in one master table; observed money is matched to authored documents; rules write the debits and credits; four answers are math on those lines; and the same rows show as a Ledger and a Calendar. Any number walks back to the provider's words. Search & book travel — free today, no account needed.

## This is the blueprint

The landing deck at templestuart.com teaches the ideal pipe, step by step, with build-time proofs. This README carries the deck's shapes — the arrival row, the kinds, the loop, the document, the match key, the rule book, the lenses, the two windows — verbatim from the code that renders them. The GAP LEDGER below is the distance between the blueprint and today, taken from the deck's own honest-state lines. The rebuild closes the gaps, and a step moves to alive only with a dated census.

## The pipe

| Step | Headline |
|---|---|
| 01 / IDENTIFY THE PROBLEM, THE TOOLS, THE FAMILIES — AND SORT THEM IN | Twenty-five tools. None of them knows what the others did. |
| 02 / LOOK AT THE TOOLS AND PICK THE PROVIDERS BEHIND THEM | Every job has more than one company. You pick yours. |
| 03 / IMPORT THE DATA AND SEE HOW IT ARRIVES | Store what arrived. Then decide what it means. |
| 04 / LABEL EVERY FEED BY ITS KIND | One rule per feed. Written down. |
| 05 / CREATE ONE TABLE PER KIND AND MAP THE DATA IN | The kind picks the table. |
| 06 / SEPARATE WHAT HAPPENED TO YOU FROM WHAT YOU DID | Some things happen to you. Some things you make happen. |
| 07 / RUN THE LOOP | Every tool runs the same four beats. Discover. Decide. Commit. Record. |
| 08 / STORE EVERYTHING YOU DO IN ONE MASTER TABLE | One table holds everything you do. |
| 09 / MATCH WHAT HAPPENED TO WHAT YOU DID | The deposit meets the invoice. The fill meets the order. |
| 10 / LET THE RULES WRITE THE LINES | Nobody sends them. Rules write them. |
| 11 / TURN THE LINES INTO ANSWERS | Every answer is math on the lines. |
| 12 / OPEN THE TWO WINDOWS | One Ledger. One Calendar. All twenty-five. |
| 13 / WATCH ONE DOLLAR RUN THE WHOLE MACHINE | One $100.00 sale runs the machine. Then every other door opens. |
| 14 / PROVE EVERY NUMBER | Click any number. Walk it back. |

templestuart.com teaches the full pipe with build-time proofs: every drawing derives from these consts, and the layout laws throw at build, so a false slide is a failed build.

## The data model

Every shape below is extracted from the consts the deck renders from — `src/components/landing/Landing.tsx` and the leaves it imports (`src/lib/problemSheet.ts` for the sheet, `src/lib/providers.ts` for the provider menu and the rule book, `src/lib/answers.ts` for the four lenses and their inputs).

### The arrival row (step 3)

One row per provider answer, eleven fields:

| Band | Field | Gloss |
|---|---|---|
| WHERE IT CAME FROM | provider | which company sent it |
| WHERE IT CAME FROM | connection | because you might have two or more banks |
| WHAT IT IS | resource | their own word |
| WHAT IT IS | their id | so we tie the row back to the provider and never import the same thing twice |
| WHAT IT IS | our id | two providers could accidentally use the same id |
| WHAT THEY ACTUALLY SENT | payload | saved word for word — THE REASON THIS TABLE EXISTS |
| WHAT THEY ACTUALLY SENT | fingerprint | a code made from the payload — proves we never changed it |
| WHEN AND HOW FAR | asked | when we asked |
| WHEN AND HOW FAR | arrived | when it arrived |
| WHEN AND HOW FAR | read | when we read it |
| WHEN AND HOW FAR | status | pending, done, or failed |

### The arrivals store (step 3, built)

The arrival row above as tables — `prisma/migrations/20260903000000_arrivals/migration.sql` and the `provider_responses` / `arrivals` models in `prisma/schema.prisma`, column for column (asserted at build). Two tables: the wire (one row per HTTP answer, exact bytes, sha256) and the deck's row (one per provider object). The `arrival_provider` enum is `src/lib/providers.ts`' code set — 27 providers, every one the deck names — and `arrival_status` is the deck's pending / done / failed. As of September 7, 2026 it holds 9,092 Plaid transactions, 712 investment transactions and 247 securities — every answer word for word, fingerprinted, status done; rows synced before September 3, 2026 carry no arrival.

`provider_responses` — the wire:

| Column | Type | Rule |
|---|---|---|
| id | text | PRIMARY KEY |
| provider | arrival_provider | NOT NULL |
| resource | text | NOT NULL |
| user_id | text | NULL REFERENCES users(id) |
| guest_ref | text | NULL |
| http_status | integer | NOT NULL |
| body | bytea | NOT NULL |
| body_sha256 | bytea | NOT NULL |
| asked | timestamptz | NOT NULL |
| arrived | timestamptz | NOT NULL |
| redactions | text[] | NOT NULL DEFAULT '{}' — `prisma/migrations/20260907220000_provider_responses_redactions/migration.sql`: every path blanked in body; '{}' = the exact wire bytes |
|  | CHECK / KEY | CHECK (octet_length(body_sha256) = 32) |
|  | CHECK / KEY | CHECK (octet_length(body) <= 1048576) |
|  | CHECK / KEY | CHECK (user_id IS NOT NULL OR guest_ref IS NOT NULL) |

`arrivals` — the deck's row:

| Column | Type | Rule |
|---|---|---|
| id | text | PRIMARY KEY |
| provider | arrival_provider | NOT NULL |
| connection | text | NULL |
| resource | text | NOT NULL |
| their_id | text | NOT NULL |
| their_id_kind | their_id_kind | NOT NULL |
| payload | jsonb | NOT NULL |
| fingerprint | bytea | NOT NULL |
| redactions | text[] | NOT NULL DEFAULT '{}' |
| asked | timestamptz | NOT NULL |
| arrived | timestamptz | NULL |
| read | timestamptz | NULL |
| status | arrival_status | NOT NULL DEFAULT 'pending' |
| response_id | text | NULL REFERENCES provider_responses(id) |
| user_id | text | NULL REFERENCES users(id) |
| guest_ref | text | NULL |
| kind | arrival_kind | NOT NULL — `prisma/migrations/20260907180000_arrival_kind/migration.sql`: the rule book's kind, applied on landing and to every earlier row |
|  | CHECK / KEY | CHECK (octet_length(fingerprint) = 32) |
|  | CHECK / KEY | CHECK (pg_column_size(payload) <= 1048576) |
|  | CHECK / KEY | CHECK (user_id IS NOT NULL OR guest_ref IS NOT NULL) |
|  | CHECK / KEY | UNIQUE (provider, their_id, fingerprint) |

Promise 1 is a database law, not a convention: the `arrivals_promise_1` BEFORE UPDATE trigger raises if provider, connection, resource, their_id, their_id_kind, payload, fingerprint, redactions, asked, arrived, response_id, user_id, guest_ref or kind would change — only `read` and `status` may move, each once (read from NULL, status from pending). There is no updated_at column and no DELETE policy: keep forever is the default.

The write rule (PR-2 — one Plaid writer, `src/app/api/transactions/sync-complete/route.ts`, through `src/lib/arrivals/land.ts`):

1. Every HTTP answer lands first in `provider_responses` — exact bytes, except declared redactions of secrets — then the canonical redacted bytes — with the sha256 of the bytes as stored and every blanked path on `redactions` (the Plaid SDK runs through an axios instance that keeps the body as bytes — `src/lib/plaid/wire.ts`; the Stripe webhook blanks `client_secret` — `src/lib/arrivals/stripeWebhook.ts`).
2. Every object in the answer lands as one `arrivals` row: payload as sent, fingerprint = sha256 of its RFC 8785 canonical bytes (the `canonicalize` package), their_id = the provider's own id (their_id_kind `provider`) or one we composed and labeled as such (`composed` — the LiteAPI cancellation, whose answer carries no id of its own; `src/lib/arrivals/liteapiBooking.ts`), redactions `[]` — `INSERT … ON CONFLICT (provider, their_id, fingerprint) DO NOTHING` — the same thing is the same provider, id and content, so a duplicate is promise 2 working, not an error, and a provider's correction is a new row (promise 1); three outcomes, counted apart: landed · already_landed (linked, not re-parsed) · corrected (parsed — latest-arrived wins and `transactions.arrival_id` moves to the newest row); a non-2xx answer lands as a `provider_responses` row with no arrivals — a failed ask is evidence of the ask; a duplicate is promise 2 working, reported as `already_landed`, never an error.
3. The parser reads the arrival row, never the HTTP object, and points the domain row at it (`transactions.arrival_id`).
4. Landing, parsing and `read` / `status` (once each) happen in ONE database transaction per page; a parser failure rolls that page back and is declared in the response (stage, page, summarized error) while earlier pages stay.
5. No synthetic backfill: rows synced before the cutoff carry `arrival_id` NULL.

### The six kinds (steps 4–5)

Five kinds arrive from outside; the sixth is never sent — the system writes postings from events.

| Kind | Holds | Means |
|---|---|---|
| reference | facts about the world | a fact about the world |
| registry | your accounts and your people | one of your accounts |
| event | what happened | something that happened |
| derived | math we did | math we did — never a source |
| snapshot | how things stood at one moment | how things stood at one moment |
| posting | debits and credits | never arrives — the system writes postings from events |

### The rule book (step 4, applied)

One written rule per feed — its kind — and the system applies it to every arrival of that feed: `src/lib/providers.ts` RULE_BOOK, 24 rows (the deck's 20 verbatim plus the 4 the deck's sample omits and the store lands). Landing consults it (`src/lib/arrivals/land.ts`): every arrival carries its kind (`arrivals.kind`, `prisma/migrations/20260907180000_arrival_kind/migration.sql` — the same rules applied to every row landed before it), and a feed with no rule is a loud failure, never a default. The build asserts the book against the deck, the schema's enum, the migration's UPDATEs and every landing call site.

| Provider | Resource | Kind | Means | Row |
|---|---|---|---|---|
| plaid | transaction | event | something that happened | deck |
| plaid | account | registry | one of your accounts | deck |
| plaid | holding | snapshot | how things stood at one moment | deck |
| stripe | payout | event |  | deck |
| tastytrade | quote | reference | a fact about the world | deck |
| finnhub | fundamentals | reference |  | deck |
| fred | series | reference |  | deck |
| sec | filing | reference |  | deck |
| liteapi | booking | event |  | deck |
| viator | activity | reference |  | deck |
| google places | place | reference |  | deck |
| travel buddy | visa | reference |  | deck |
| anthropic | classification | derived | math we did — never a source | deck |
| openai | insight | derived |  | deck |
| xai grok | sentiment | derived |  | deck |
| voyage | embedding | derived |  | deck |
| ecfr | title | reference |  | deck |
| us code | title | reference |  | deck |
| federal register | document | reference |  | deck |
| irs | bulletin | reference |  | deck |
| plaid | security | reference |  | added |
| plaid | investment_transaction | event |  | added |
| stripe | event | event |  | added |
| liteapi | cancellation | event |  | added |

### The six tables (step 5, views)

Six tables, six names, the kind picks the table — as VIEWS over the typed feed tables (`prisma/migrations/20260907200000_kind_views/migration.sql`, generated from the census in `src/lib/kindViews.ts`; the six are `view` models in `prisma/schema.prisma` under Prisma's `views` preview; a view changes only through a later migration that drops and recreates it — the snapshot view over holdings, `prisma/migrations/20260908120000_holdings_snapshot/migration.sql` — and the build checks each view's newest text). The feed tables keep their real columns, constraints and `arrival_id`; each view unions exactly the feed tables of its kind, the kind per table from the rule book, in one common shape. Posting is empty by the deck's own law; snapshot holds Plaid holdings (REBUILD-01 PR-2d). A table whose feed the rule book cannot name is reported, never viewed. Today the six are views over the feed tables — event: transactions, investment transactions, bookings; reference: securities, places, the law corpus; registry: accounts; snapshot: holdings; derived: none yet; posting: empty by law.

| Column | Type |
|---|---|
| kind | arrival_kind |
| feed | text |
| table_name | text |
| row_id | text |
| their_id | text |
| arrival_id | text |
| user_id | text |
| arrived | timestamptz |

| View | Unions | Feeds |
|---|---|---|
| reference | securities, places_cache, regulatory_documents | plaid · security · google_places · place · by s.domain: ecfr · title / us_code · title / federal_register · document / irs · bulletin |
| registry | accounts | plaid · account |
| event | transactions, investment_transactions, reservations | plaid · transaction · plaid · investment_transaction · liteapi · booking |
| derived | (nothing) |  |
| snapshot | holdings | plaid · holding |
| posting | (nothing) |  |

| Feed table | Kind | Feed | arrival_id | user | arrived | Outside Prisma |
|---|---|---|---|---|---|---|
| securities | reference | plaid · security | yes | no | s."createdAt" |  |
| places_cache | reference | google_places · place | no | no | p."cachedAt" |  |
| regulatory_documents | reference | by s.domain: ecfr · title / us_code · title / federal_register · document / irs · bulletin | no | no | d.retrieved_at | prisma/migrations/20260503000000_pr_f_corpus_foundation/migration.sql (CREATE TABLE regulatory_documents; not a Prisma model) |
| accounts | registry | plaid · account | no | yes | a."createdAt" |  |
| transactions | event | plaid · transaction | yes | yes | t."createdAt" |  |
| investment_transactions | event | plaid · investment_transaction | yes | yes | i."createdAt" |  |
| reservations | event | liteapi · booking | no | yes | r."createdAt" |  |
| holdings | snapshot | plaid · holding | yes | yes | h."createdAt" |  |

Reported, not viewed — rows from a provider answer whose feed the rule book does not name:

| Table | Why |
|---|---|
| reservations (provider duffel) | history rows from a retired provider (LAUNCH-01 RETIRE-01 deleted its book route; nothing writes provider 'duffel' any more) — the rows are kept, labeled by their provider, and stay outside the event view (the bookings view reads provider 'liteapi' only) |
| trip_scanner_results | src/app/api/trips/[id]/ai-assistant/route.ts writes AI recommendations per trip/category; the book names no such feed (anthropic · classification is the only anthropic row) |
| scan_snapshots | src/lib/convergence/snapshot-logger.ts writes our own scores over quotes — math we did, not a provider answer; no rule-book feed |
| operations_ai_usage | src/lib/ai/recordUsage.ts:158 stores our AI calls (purpose, tokens, full_response) — the book's anthropic row is classification, not a usage log |
| discovery_proposals | AI-authored proposals (src/lib/discovery); not the book's anthropic · classification by name |
| plaid_items | Plaid's item — a handshake (the access token lives here); the deck: handshakes never enter the tables; the book has no plaid · item row |
| tastytrade_connections | a handshake (tokens); never data |
| observatoryHealthLog | our probes of the providers (src/app/api/data-observatory) — not a provider feed |

### The loop (step 7)

Every tool runs the same four beats: **DISCOVER → DECIDE → COMMIT → RECORD**.

### The document (step 8)

Four fields on every record in the master table:

| # | Field |
|---|---|
| 1 | What it is |
| 2 | Its life story |
| 3 | Its pieces |
| 4 | Who did it, and when |
| life | draft → committed → settled |
| who | you · the moment you committed |

### The match key (step 9)

An observed money event meets its authored document on **amount · date · reference**.

### The posting rule book (step 10)

Fourteen matched events, one rule each — the rule writes two lines:

| Tool | Event | Debit | Credit |
|---|---|---|---|
| Invoicing | invoice issued | A/R | Revenue |
| Payments | payment received | Cash | A/R |
| Brokerage | fill | Investments | Cash |
| Travel | booking charged | Travel | Card Payable |
| Expenses | expense charged | Expense | Card Payable |
| Fixed Assets | asset bought | Fixed Assets | Cash |
| Bill Pay | bill paid | A/P | Cash |
| Payroll | payroll run | Wages + employer taxes | Cash + withholdings |
| Debt | debt payment | Loan Payable + Interest | Cash |
| Sales Tax | sales tax paid | Sales Tax Payable | Cash |
| Ent Filings | filing fee paid | Filing Fees | Cash |
| Retirement | contribution | Retirement | Cash |
| Banking | transfer | Cash (to) | Cash (from) |
| Tax | tax paid | Tax Expense | Cash |

### The four lenses (step 11)

| Question | The math | Reads |
|---|---|---|
| What do I owe in tax? | Income so far × the rules. | Revenue · Expense · Wages + employer taxes · irs bulletin · us code title |
| How long can I last? | Cash ÷ what I burn each month. | Cash · Expense · Travel · Wages + employer taxes · A/P |
| How is my trading doing? | Wins, losses, and open risk; from fills, positions, and live quotes. | Investments · plaid holding · tastytrade quote |
| How is my business doing? | Money in minus money out. | Revenue · Expense · Travel · Wages + employer taxes · Filing Fees |

### The two windows (step 12)

Pull out WHEN it is: a moment — a dot — or a span — a bar. Every dated thing appears in both windows at once: as a row in the Ledger, and on its day in the Calendar.

## The gap ledger

BLUEPRINT is the step's headline; TODAY is the deck's honest-state line, verbatim; GAP is the difference between the two and nothing more. Steps 1–6 appear only where the deck states a dated fact.

| Step | Blueprint | Today | Gap |
|---|---|---|---|
| 03 | Store what arrived. Then decide what it means. | the arrivals store holds 9,092 Plaid transactions, 712 investment transactions and 247 securities — every answer word for word, fingerprinted, status done — counted September 7, 2026; rows before September 3, 2026 carry no arrival. | the other providers (tastytrade, the market and law feeds) land parsed; Stripe events (PR-4), LiteAPI bookings and cancellations (PR-5) and Plaid holdings (PR-2d) land raw-first with no dated count yet; the three old Plaid writers are retired (PR-3). |
| 04 | One rule per feed. Written down. | rules are rows the system applies — src/lib/providers.ts RULE_BOOK, 24 rows (the deck's 20 plus plaid · security → reference, plaid · investment_transaction → event, stripe · event → event, liteapi · cancellation → event); every Plaid, Stripe and LiteAPI arrival carries its kind (transaction · event, investment_transaction · event, security · reference, stripe event · event, liteapi booking · event, liteapi cancellation · event, holding · snapshot), stamped on landing and applied by the migration to every row landed before it; a feed with no rule cannot land. | the other providers' arrivals wait on their landing — nothing of theirs has arrived to be labeled; the 121 feeds' classification stays the August 24 census until each lands. |
| 05 | The kind picks the table. | Today the six are views over the feed tables — event: transactions, investment transactions, bookings; reference: securities, places, the law corpus; registry: accounts; snapshot: holdings; derived: none yet; posting: empty by law. | derived has no feed table the rule book names — the AI tables carry no rule-book row; posting is empty by law; 8 tables are reported, not viewed. |
| 07 | Every tool runs the same four beats. Discover. Decide. Commit. Record. | This loop is the blueprint — the shape we're building every tool toward. Today, hotel bookings commit for real and an accepted task fires its build; the rest run discover → decide → draft, and commit is the beat we're wiring to the same loop, tool by tool. | commit is real for two tools (hotel bookings, accepted tasks); the other twenty-three stop at draft. |
| 08 | One table holds everything you do. | The master table is the blueprint. Today each tool keeps its own table; one table holding every document is the shape we're building. | no master table; each tool keeps its own. |
| 09 | The deposit meets the invoice. The fill meets the order. | (A piece of this is already alive today: card charges find their bookings and propose the match — you approve it.) | one of fourteen matches proposes today (card charge ↔ booking); the other thirteen do not. |
| 10 | Nobody sends them. Rules write them. | The posting table is the blueprint — today it holds zero lines. The rules writing them is the bookkeeping pipe we're building. | zero lines; no rule writes yet. |
| 11 | Every answer is math on the lines. | These four lenses are the blueprint. Today all four compute — tax and the business result from the journal entries you commit by hand, runway from Plaid's account balances against those entries, trading from the positions and lots you committed, with no live quote in the number. The rules-written lines and the live quotes the blueprint reads wait on the posting pipe. | all four compute from hand-committed lines and Plaid balances; the rules-written lines and live quotes wait on step 10. |
| 12 | One Ledger. One Calendar. All twenty-five. | Two windows over one set of rows is the blueprint. Today the calendar window is live in the cockpit; the ledger window fills as the posting pipe lands its lines. | the Calendar window is live; the Ledger window is empty until step 10 writes. |
| 13 | One $100.00 sale runs the machine. Then every other door opens. | Alive today: the travel match — card charges find their bookings and propose the match; you approve it. The project lane is wired end to end: a task lands for your review, and accepting it fires the build that answers it. | the travel match is alive; the project lane is wired end to end; the sale's lines and lenses wait on steps 10–11. |
| 14 | Click any number. Walk it back. | Alive today: the fingerprint, on the rules and the audit log — every regulation pull is hashed the moment it lands, and the audit log hash-chains every entry it records; the citation re-check is written, but the hash it compares against is stored empty today, so it proves nothing yet. Today the Plaid feeds land in that table — every answer word for word, fingerprinted: 9,092 transactions, 712 investment transactions, 247 securities, counted September 7, 2026. The other providers still land parsed; the same table is the shape they're moving into. | fingerprints on the rules corpus, the audit log and the Plaid feeds; none on the other providers' feeds yet; the citation re-check still compares against an empty hash. |

## Navigation

The app lands on `/answers` — HOME: the four answers, then the whole sheet (25 jobs, each with its true status and the door to its step). A collapsible rail walks the sheet in FLOW ORDER: 6 families, 12 steps, every job in exactly one step. A step's status is derived from its jobs (LIVE when every one is, NOT_BUILT when every one is, else PARTIAL); a step with no screen opens an honest page that names its jobs and says it is not built. The list below is generated from `src/lib/steps.ts`, whose law runs at build (`scripts/assert-tool-registry.ts`).

| # | Step | Family | Status | Opens | Jobs |
|---|---|---|---|---|---|
| 1 | ACCOUNTS | WHAT YOU OWN | PARTIAL | `/accounts` | Banking (PARTIAL), Brokerage (PARTIAL), Retirement (NOT_BUILT), Fixed Assets (NOT_BUILT) |
| 2 | TRADING | WHAT YOU OWN | PARTIAL | `/trading` | Trade Log (PARTIAL) |
| 3 | BOOKS | THE PROOF | LIVE | `/books` | Bookkeeping (LIVE) |
| 4 | TAX | THE PROOF | PARTIAL | `/tax` | Tax (PARTIAL) |
| 5 | COMPLIANCE | THE PROOF | PARTIAL | `/compliance` | Compliance (PARTIAL) |
| 6 | FP&A | THE PROOF | NOT_BUILT | `/step/fpa` (honest page — not built) | FP&A (NOT_BUILT) |
| 7 | OWED | WHAT YOU OWE | NOT_BUILT | `/step/owed` (honest page — not built) | Debt (NOT_BUILT), Sales Tax (NOT_BUILT), Ent Filings (NOT_BUILT) |
| 8 | SALES | MONEY IN | NOT_BUILT | `/step/sales` (honest page — not built) | CRM (NOT_BUILT), Contracts (NOT_BUILT), Invoicing (NOT_BUILT), Payments (NOT_BUILT) |
| 9 | SPEND | MONEY OUT | NOT_BUILT | `/step/spend` (honest page — not built) | Bill Pay (NOT_BUILT), Payroll (NOT_BUILT), Expenses (NOT_BUILT), Mileage (NOT_BUILT) |
| 10 | TRAVEL | MONEY OUT | LIVE | `/travel` | Travel (LIVE) |
| 11 | BUDGET | MONEY OUT | PARTIAL | `/business` | Budget (PARTIAL) |
| 12 | OPERATIONS | THE WORK | PARTIAL | `/projects` | Calendar (PARTIAL), Tasks (PARTIAL), Time (PARTIAL) |

## The nine modules

| Module | What exists in code |
|---|---|
| Travel | stays and flights through LiteAPI, activities through Viator, visa checks through RapidAPI — public routes under src/app/api/travel (15 route files); models `trips` (schema:652) and `reservations` (schema:1414). |
| Runway | the reservation matcher — src/app/api/runway/match/propose, queue, review (the step-9 piece alive today) — plus src/app/api/runway/route.ts; models `budgets` (schema:622) and `home_expenses` (schema:1668). |
| Books | Plaid-synced transactions, a chart of accounts, journal and ledger entries — the one Plaid writer, src/app/api/transactions/sync-complete/route.ts, writes `transactions` (schema:460) through src/lib/arrivals/plaidTransactionsPage.ts:114; `journal_entries` (schema:186), `ledger_entries` (schema:225). |
| Trade | tastytrade connection, quotes and backtests — src/app/api/tastytrade (13 route files); models `trade_cards` (schema:1799) and `scan_snapshots` (schema:1985). |
| Tax | scenarios, documents and the 2025 export script (`npm run tax:export:2025`) — src/app/api/tax (7 route files); models `tax_scenarios` (schema:1588) and `tax_documents` (schema:1907). |
| Compliance | the regulatory corpus (eCFR, US Code, Federal Register, IRS bulletins) ingested by Inngest functions with sha256 on write, citations re-verified, and the hash-chained audit log — models `regulatory_sources` (schema:2298), `citations` (schema:2362), `audit_log` (schema:2528). |
| Routines | scheduled routines evaluated by the `routine-evaluator` Inngest function — models `operations_routines` (schema:3182) and `hub_scheduled_items` (schema:3288); the deck calls the calendar window live in the cockpit (step 12 honest line). |
| Projects | projects and tasks; accepting a pending task fires the Execute-Task Routine (src/app/api/operations/projects/[id]/tasks/[taskId]/route.ts:395-405) — models `operations_projects` (schema:3006) and `operations_project_tasks` (schema:3051). |
| Content | scene groups, scenes, pieces and takes — model `operations_content_pieces` (schema:3415); src/app/api/operations carries 50 route files across Routines, Projects and Content. |

## Architecture

Versions from package.json, read 2026-09-02:

| Layer | What |
|---|---|
| Framework | Next.js 15.5.25 · React ^18.3.1 · TypeScript ^5 |
| Data | Prisma ^5.22.0 (client ^5.22.0) on Azure PostgreSQL |
| Hosting | Vercel (one cron in vercel.json: `/api/cron/auto-categorize` at 02:00 UTC) |
| Jobs | Inngest ^4.2.6 — 8 functions: ecfr-ingest, embed-pending, fedreg-ingest, health-check, irb-ingest, operations-pipe-run, routine-evaluator, uscode-ingest |
| Auth | HMAC-signed cookie (src/lib/cookie-auth.ts) · next-auth ^4.24.15 for OAuth sign-in |
| Payments / banking | Stripe ^20.3.0 · Plaid ^11.0.0 |
| Styling | Tailwind CSS ^3.4.18 |
| Runtime | Node (typed against @types/node ^20) |

Observed versus authored (step 6): what the world sends is observed; what you do is authored; the blueprint keeps the two apart and matches them on one key. Today the Plaid feeds land word for word, fingerprinted — 9,092 transactions, 712 investment transactions, 247 securities, counted September 7, 2026; the other providers still land parsed — see the gap ledger, step 14.

Scale, as of 2026-09-02: 116 Prisma models, 34 enums, 288 API route files, 35 runtime dependencies, 17 dev dependencies, one test file (`npm test`).

## Engineering discipline

These are the written laws in `CLAUDE.md`, stated as practice:

- Audit before action: a read-only audit with `file:line` citations precedes any implementation.
- Derive, never retype: the deck's drawings derive from their consts, and module-scope layout laws throw at build — a false slide is a failed build.
- Census before claim: every public surface claims only what a dated count of the code supports.
- Fail loud: no silent fallbacks, no silent catches, no placeholder data.
- One concept per PR: each change is atomic and revertible.
- All work lands on `claude/*` branches; only the founder merges to `main` — the merge is the SOC 2 change-management control.
- Migrations: the raw SQL and `schema.prisma` move in lockstep; the repo holds no `DATABASE_URL`, so a session can author a migration but never apply one.
- The README and the deck are the blueprint; code drifts, the blueprint doesn't — drift is a bug.

## Security model

- Sessions: an HMAC-SHA256-signed cookie; verification uses a timing-safe comparison — `src/lib/cookie-auth.ts:16-18, 26-45`.
- Middleware: every path not in `PUBLIC_PATHS` requires the verified cookie — `src/middleware.ts:50-160, 162, 165-170`; the two Routine callbacks (`…/audit-ingest`, `…/exec-ingest`) bypass the cookie and validate a shared-secret bearer (`AUDIT_INGEST_SECRET`, `EXEC_INGEST_SECRET`) instead — `src/middleware.ts:173-187`.
- Route gates: `getCurrentUser` (`src/lib/auth-helpers.ts:11`), `requireTier` (`:42`), `requireAdmin` (`src/lib/require-admin.ts:8`); the working law is that a paid external call is never made before the gate (CLAUDE.md, Security-first).
- User scoping: every query is scoped to the authed user — e.g. `where: { userId: user.id }` at `src/app/api/tastytrade/connect/route.ts:54`.
- Rate limits: a durable fixed-window limiter backed by the `rate_limit_hits` table (`src/lib/rateLimit.ts:3-15`; schema:1399), plus `src/lib/scan-rate-limit.ts` and `src/lib/ai-rate-limit.ts`; tuned by `SEARCH_/BOOK_/SCAN_/AI_RATE_LIMIT` and `_WINDOW`, with daily caps `AI_PIPE_DAILY_CAP`, `AI_EXEC_DAILY_CAP`, `AI_ROUTINE_DAILY_CAP`, `AI_DISCOVERY_DAILY_CAP` (USD, from recorded spend — `src/lib/discovery/discoveryGate.ts`), `TRAVEL_SEARCH_DAILY_CAP`, and `GOOGLE_PLACES_MONTHLY_CAP`.
- Audit log: a hash chain — each entry stores `prev_hash` and its own sha256 `content_hash` with a `sequence_number` (`prisma/schema.prisma:2441-2443`; written at `src/lib/audit/writeAuditLog.ts:99`); `src/lib/audit/verifyAuditChain.ts:47, 80` recomputes the chain.
- Citations: `src/lib/citations/verifyCitation.ts:97` re-fetches the source and re-hashes it against `citations.retrieved_content_hash` (`prisma/schema.prisma:2287`); the column's only writer stores an empty string today (`src/lib/discovery/materializeProposal.ts:165`), so the check is structurally dead until the arrivals rebuild lands the real hash.
- Corpus: the four ingest persisters hash content with sha256 on write — `src/lib/corpus/ingest/ecfr-persist.ts:28`, `uscode-persist.ts:32`, `fedreg-persist.ts:31`, `irb-persist.ts:32`.
- Provider tokens at rest: AES-256-GCM with a key held in the deployment env (`src/lib/secrets/tokenCipher.ts`); readers accept ciphertext only.
- Report a vulnerability to astuart@templestuart.com.

## Providers

The provider menu the deck draws at step 2 — who feeds each job today, and which doors are open next:

| The job | Today | Next |
|---|---|---|
| banks & accounts | plaid | teller |
| card money | stripe | square |
| trades & market data | tastytrade | schwab · ibkr · alpaca · tradier · snaptrade |
| company numbers | finnhub | polygon |
| the economy | fred | — |
| filings | sec | — |
| flights | liteapi | amadeus |
| hotels | liteapi | amadeus |
| activities | viator | — |
| locations | google places | — |
| visas | travel buddy | — |
| our AI | anthropic · openai · xai grok · voyage | — |
| the law itself | ecfr · us code · federal register · irs | — |

The deck's own count: today that is 121 feeds from 20 providers — counted August 24, 2026.

## Self-hosting

You need Node (the code is typed against `@types/node ^20`), PostgreSQL, and a host — it is built for Vercel. Then the keys. Every name in the first table is read by the code (`grep -rhoE "process\.env\.[A-Z0-9_]+" src`, 2026-09-02); the second table is what a dependency reads for it, which that grep cannot see — declared in `src/lib/envLaw.ts`, and the build's env law (`scripts/assert-tool-registry.ts`) requires every name in both tables documented here and nothing documented that nothing reads.

| Vendor / concern | Keys | Needed when |
|---|---|---|
| Core | `JWT_SECRET` (the ONE session secret — the former NEXTAUTH_SECRET is retired: the server refuses to boot while it is set, `src/lib/secretGuard.ts`), `OWNER_EMAIL`, `ADMIN_USER_ID` (the admin's users.id; every admin gate throws when it is unset — `src/lib/admin.ts`), `NEXT_PUBLIC_OWNER_EMAIL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_BASE_URL` | Required |
| Set by the platform | `NODE_ENV`, `NEXT_RUNTIME` (`nodejs` or `edge`, set by Next.js — the session-secret boot guard runs on the Node runtime only, `src/instrumentation.ts`), `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` | Provided by Vercel / Node / Next; nothing to set |
| Plaid (bank sync) | `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_REDIRECT_URI` (the OAuth return URL, `src/lib/plaid/oauth.ts`) | Required unless Books sync is disabled — no link token is created without the redirect URI |
| Provider tokens at rest | `TOKEN_ENCRYPTION_KEY` (base64 of 32 bytes), `TOKEN_ENCRYPTION_KEY_ID` (`src/lib/secrets/tokenCipher.ts`) | Required — every Plaid and tastytrade token read or write fails loud without both |
| Stripe (payments) | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`; per entitlement `STRIPE_TAB_<KEY>_PRICE_ID`, `STRIPE_CAT_<KEY>_PRICE_ID`, `STRIPE_BUNDLE_ALL_PRICE_ID` (`src/lib/stripe.ts`) | Required to sell modules; skip to run everything unlocked |
| Flights and stays (LiteAPI) | `LITEAPI_SANDBOX_KEY`, `LITEAPI_PRODUCTION_KEY`, `LITEAPI_MODE`, `FLIGHTS_LANE` (`liteapi` is the only lane — unset resolves to it, anything else refuses; `src/lib/flightsLane.ts:41`) | Required unless travel is disabled |
| Tours (Viator) | `VIATOR_API_KEY` | Required unless activities are disabled |
| Visa rules (RapidAPI) | `RAPIDAPI_VISA_KEY`, `RAPIDAPI_VISA_HOST` | Required unless the visa check is disabled |
| Places | `GOOGLE_PLACES_API_KEY`, `GOOGLE_PLACES_MONTHLY_CAP`, `PLACES_CACHE_TTL_DAYS` | Key required unless location search is disabled; caps optional |
| Markets (tastytrade) | `TASTYTRADE_CLIENT_SECRET`, `TASTYTRADE_REFRESH_TOKEN`, `TT_USERNAME`, `TT_PASSWORD` | Required unless Trade is disabled |
| Market data | `FINNHUB_API_KEY`, `FRED_API_KEY` | Required unless the scanner is disabled |
| AI | `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `XAI_API_KEY`, `VOYAGE_API_KEY` | Required unless the AI features are disabled |
| Email (Resend) | `RESEND_API_KEY`, `EMAIL_FROM` | Required unless email is disabled |
| Jobs (Inngest) | `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` | Required unless background jobs are disabled |
| OAuth sign-in | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | Optional; email login works without |
| Routine and audit hooks | `CRON_SECRET`, `ROUTINE_AUDIT_TOKEN`, `ROUTINE_AUDIT_FIRE_URL`, `EXEC_ROUTINE_TOKEN`, `EXEC_ROUTINE_FIRE_URL`, `EXEC_INGEST_SECRET`, `AUDIT_INGEST_SECRET` | Required unless scheduled routines are disabled |
| Rate limits and caps | `SEARCH_RATE_LIMIT`, `SEARCH_RATE_WINDOW`, `SCAN_RATE_LIMIT`, `SCAN_RATE_WINDOW`, `AI_RATE_LIMIT`, `AI_RATE_WINDOW`, `AI_PIPE_DAILY_CAP`, `AI_EXEC_DAILY_CAP`, `AI_ROUTINE_DAILY_CAP`, `AI_DISCOVERY_DAILY_CAP`, `TRAVEL_SEARCH_DAILY_CAP`; per provider `TRAVEL_SEARCH_DAILY_CAP_<PROVIDER>` (`src/lib/travelSearchQuota.ts:79`) | Optional; the code has defaults |
| Misc | `YELP_API_KEY` | Required unless its feature is disabled |

### Read by a library

Variables no line of this code reads — a dependency does. The night next-auth 4.24.15 started building every OAuth callback from `NEXTAUTH_URL` (its `utils/detect-origin.js`), the table above could not have known the variable existed; in production the server now refuses to boot unless `NEXTAUTH_URL` is the https origin whose host equals `NEXT_PUBLIC_APP_URL`'s (`src/lib/siteUrlGuard.ts`).

| Name | Read by | Where | Needed | Expected shape |
|---|---|---|---|---|
| `DATABASE_URL` | prisma | prisma/schema.prisma:12 `url = env("DATABASE_URL")` — the client and every migration | Required | postgresql://user:password@host:5432/db?sslmode=require (Azure Postgres requires SSL) |
| `NEXTAUTH_URL` | next-auth | utils/detect-origin.js:9 (the origin of every OAuth callback and redirect — since 4.24.15 it wins over the request host on Vercel), jwt/index.js:65 (secure-cookie decision), react/index.js:53-54 (client base URL) | Required | the deployment's https origin with no path — its host must equal NEXT_PUBLIC_APP_URL's (https://www.templestuart.com in production; a bare templestuart.com is refused at boot by src/lib/siteUrlGuard.ts) |
| `NEXTAUTH_URL_INTERNAL` | next-auth | react/index.js:55-56 (server-side fetch base when the public origin is not reachable from the server) | Optional | an http(s) origin; unset here |
| `AUTH_TRUST_HOST` | next-auth | utils/detect-origin.js:10 (trust x-forwarded-host when NEXTAUTH_URL is unset) | Optional | unset — NEXTAUTH_URL rules the origin; never set this to paper over a wrong NEXTAUTH_URL |
| `AUTH_SECRET` | next-auth | next/index.js:17,49,128 (the fallback when options.secret is unset — ours is JWT_SECRET, so this is never consulted) | Optional | unset — SECRET-01: JWT_SECRET is the one session secret |
| `VERCEL` | next-auth | utils/detect-origin.js:10 (trust the forwarded host when NEXTAUTH_URL is unset), jwt/index.js:65 (secure cookies) | Set by the host | "1" on Vercel; set by the host |
| `VERCEL_URL` | next-auth | react/index.js:53 (client base URL fallback when NEXTAUTH_URL is unset) | Set by the host | <deployment>.vercel.app, set by the host — never the production origin |
| `VERCEL_ENV` | the boot check | src/lib/siteUrlGuard.ts (through the env record: production / preview / development — the NEXTAUTH_URL check runs for production only, a Preview has a per-deploy host) | Set by the host | production / preview / development; set by the host |
| `PORT` | next | dist/server/lib/start-server.js (`next start` — self-hosting only; Vercel runs its own runtime) | Set by the host | a port number; set by the host |
| `HOSTNAME` | next | dist/build/utils.js (`next start` bind host — self-hosting only) | Set by the host | a hostname; set by the host |

Yes, that's a lot of keys. That's why the next section exists.

## Work with me

I built this for me — but I'll set it up for you.

- Done-for-you setup: your own hosted copy, every API wired, you own everything.
- Maintenance: I keep it updated and running.
- Custom builds: need a feature? I build it.
- Embed: want just one piece (the booking engine, the books, the scanner) inside your existing system? I do that too.

Email a project proposal (the template's pre-filled): [astuart@templestuart.com](mailto:astuart@templestuart.com?subject=Project%20proposal%20%E2%80%94%20Temple%20Stuart&body=What%20do%20you%20need%3F%20(setup%20%2F%20maintenance%20%2F%20custom%20build%20%2F%20embed%20a%20module)%3A%0A%0AYour%20business%20%2B%20current%20stack%3A%0A%0AWhich%20modules%20interest%20you%3A%0A%0ATimeline%3A%0A%0ABudget%20range%3A%0A%0AAnything%20else%3A)

## License

Source-available under the Business Source License 1.1 — see [LICENSE](LICENSE). Free to self-host for personal use; commercial use or a done-for-you setup: astuart@templestuart.com

---

Temple Stuart is not a CPA firm, tax preparer, or licensed financial advisor.
All tax figures generated by this platform are estimates for informational purposes only
and must be verified by a qualified tax professional before filing.
Use of this software does not constitute tax advice.
