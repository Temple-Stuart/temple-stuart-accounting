-- LINK-01 — THE ACTUAL IS LINKED, NOT GUESSED.
--
-- DAY-01 proved the automatic event→Books join by (start_date, coa_code) unsound
-- for four independent reasons. This table does not repair the guess; it removes
-- the need for one. The founder taps the budgeted item and taps the posting that
-- settled it, the way a trade links to a card (trade_card_links). Nothing in this
-- table is ever written by a matcher.
--
-- AUTHORED, NOT APPLIED. Claude Code cannot reach Azure Postgres; Alex runs this
-- via psql, or it applies at deploy after merge.

-- STEP 1: the table.
CREATE TABLE "planned_item_links" (
  "id"               UUID        NOT NULL DEFAULT gen_random_uuid(),
  "user_id"          TEXT        NOT NULL,
  "target_kind"      VARCHAR(20) NOT NULL,
  "target_id"        TEXT        NOT NULL,
  -- A routine OCCURRENCE has no row: it is computed from an RRULE. It is
  -- addressed on its INSTANT, exactly as operations_routine_completions does
  -- (@@unique([routine_id, expected_at])). A key of YYYY-MM-DD would silently
  -- miss a 07:00 Asia/Bangkok occurrence read from another zone.
  "target_instant"   TIMESTAMPTZ(6),
  "journal_entry_id" TEXT        NOT NULL,
  "linked_at"        TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "linked_by"        VARCHAR(255),
  CONSTRAINT "planned_item_links_pkey" PRIMARY KEY ("id")
);

-- STEP 2: the kinds are a closed set, named here and in src/lib/calendar/chain.ts.
ALTER TABLE "planned_item_links" ADD CONSTRAINT "planned_item_links_kind"
  CHECK ("target_kind" IN ('calendar_event', 'project_task', 'routine'));

-- STEP 3: the instant is MANDATORY for a routine and FORBIDDEN for anything else.
-- Convention would let a routine link land on a date and quietly match nothing.
ALTER TABLE "planned_item_links" ADD CONSTRAINT "planned_item_links_instant_iff_routine"
  CHECK (("target_kind" = 'routine') = ("target_instant" IS NOT NULL));

-- STEP 4: THE CARDINALITY, ENFORCED BY THE DATABASE, NOT BY CONVENTION.
-- One item may have MANY postings (a hotel posts as a deposit and a balance).
-- One posting belongs to AT MOST ONE item — otherwise two items would each claim
-- the whole amount and the day would double-count. A posting that genuinely
-- belongs to several items (a grocery run across a month of meal routines) is an
-- ALLOCATION, not a link: that is ALLOC-01, and the repo already has the
-- dimension for it (ledger_line_links.percent, sum-to-100). Until then this
-- constraint makes the attempt FAIL LOUD instead of double-counting silently.
CREATE UNIQUE INDEX "planned_item_links_one_item_per_posting"
  ON "planned_item_links" ("journal_entry_id");

-- STEP 5: the foreign keys.
-- journal entry RESTRICT — a posting something is attributed to cannot vanish
-- (the ledger_entries doctrine, and DIM-1's ledger_line_links targets).
-- user CASCADE — a deleted user's attributions go with them.
ALTER TABLE "planned_item_links" ADD CONSTRAINT "planned_item_links_journal_entry_fkey"
  FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "planned_item_links" ADD CONSTRAINT "planned_item_links_user_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- STEP 6: the reads. An item's actual is the sum of ITS links, for ONE user.
CREATE INDEX "planned_item_links_user_target_idx"
  ON "planned_item_links" ("user_id", "target_kind", "target_id");
CREATE INDEX "planned_item_links_user_instant_idx"
  ON "planned_item_links" ("user_id", "target_instant");

-- NO BACKFILL. Every item linked before this migration is none: the legacy epoch
-- carries no links BY DESIGN (the DIM-1 precedent). An item with no links reads
-- NOT LINKED — never $0, and never a guessed match.
