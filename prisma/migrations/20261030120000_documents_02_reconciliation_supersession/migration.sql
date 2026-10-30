-- DOCUMENTS-02 (Alex, 2026-10-30, ruling D) — A RECONCILED MONTH IS FROZEN; RE-OPENED ONLY BY SUPERSESSION.
--
-- The bank reconciliation is the statement's screen (the source document of kind 'statement',
-- 20261028120000_documents_01_source_documents). Until now a reconciled month could be re-saved as a
-- draft by the same upsert that wrote it, keeping its old reconciled_at (STATEMENTS-00 §5). This
-- migration gives bank_reconciliations the source_documents pattern:
--   · superseded_by → bank_reconciliations(id), DEFERRABLE INITIALLY DEFERRED: a re-open inserts the new
--     current row and marks the old one superseded by it, in one transaction;
--   · ONE CURRENT ROW per (user, entity, account, year, month): the five-column unique becomes a PARTIAL
--     unique over the same five columns WHERE superseded_by IS NULL — strictly weaker than today's, so
--     every existing row is accepted as it is;
--   · status is 'draft' or 'reconciled' — a CHECK, not a convention;
--   · FREEZE: an UPDATE of a reconciled row is refused unless the change is exactly superseded_by
--     NULL → NOT NULL with every other column unchanged (updated_at excepted — Prisma's @updatedAt writes
--     it); a row already superseded refuses every UPDATE; a draft row may be updated — that is the save;
--   · NO DELETE: every DELETE is refused (the journal_entries precedent, 20260227000100).
--
-- AUTHORED, NOT APPLIED. Claude Code cannot reach Azure Postgres: the build's `prisma migrate deploy`
-- (package.json "build") applies it at deploy, after Alex merges. Nothing here rewrites a row.

ALTER TABLE "bank_reconciliations" ADD COLUMN "superseded_by" TEXT;

ALTER TABLE "bank_reconciliations" ADD CONSTRAINT "bank_reconciliations_superseded_by_fkey"
  FOREIGN KEY ("superseded_by") REFERENCES "bank_reconciliations"("id") ON DELETE RESTRICT ON UPDATE CASCADE
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE "bank_reconciliations" ADD CONSTRAINT "bank_reconciliations_not_self_superseded"
  CHECK ("superseded_by" IS NULL OR "superseded_by" <> "id");

ALTER TABLE "bank_reconciliations" ADD CONSTRAINT "bank_reconciliations_status"
  CHECK ("status" IN ('draft', 'reconciled'));

-- One CURRENT row per account-month: the five-column unique, over the rows no one has superseded.
DROP INDEX "bank_reconciliations_userId_entity_id_account_id_year_month_key";
CREATE UNIQUE INDEX "bank_reconciliations_one_current_month"
  ON "bank_reconciliations" ("userId", "entity_id", "account_id", "year", "month")
  WHERE "superseded_by" IS NULL;

CREATE INDEX "bank_reconciliations_superseded_by_idx" ON "bank_reconciliations" ("superseded_by");

-- FREEZE: a reconciled row changes in exactly one way — it is superseded, once.
CREATE OR REPLACE FUNCTION prevent_bank_reconciliation_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.superseded_by IS NOT NULL THEN
    RAISE EXCEPTION 'Bank reconciliation % is superseded — final; nothing on it changes.', OLD.id;
  END IF;
  IF OLD.status = 'reconciled' THEN
    IF NEW.superseded_by IS NULL
       OR NEW.id IS DISTINCT FROM OLD.id
       OR NEW."userId" IS DISTINCT FROM OLD."userId"
       OR NEW.entity_id IS DISTINCT FROM OLD.entity_id
       OR NEW.account_id IS DISTINCT FROM OLD.account_id
       OR NEW.year IS DISTINCT FROM OLD.year
       OR NEW.month IS DISTINCT FROM OLD.month
       OR NEW.statement_balance IS DISTINCT FROM OLD.statement_balance
       OR NEW.book_balance IS DISTINCT FROM OLD.book_balance
       OR NEW.adjusted_bank IS DISTINCT FROM OLD.adjusted_bank
       OR NEW.adjusted_book IS DISTINCT FROM OLD.adjusted_book
       OR NEW.difference IS DISTINCT FROM OLD.difference
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.reconciled_at IS DISTINCT FROM OLD.reconciled_at
       OR NEW.reconciled_by IS DISTINCT FROM OLD.reconciled_by
       OR NEW.items IS DISTINCT FROM OLD.items
       OR NEW.notes IS DISTINCT FROM OLD.notes
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'Bank reconciliation % is reconciled — frozen; it is re-opened only by supersession (a new row that replaces it), and nothing else on it changes.', OLD.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER protect_bank_reconciliation_fields
BEFORE UPDATE ON "bank_reconciliations"
FOR EACH ROW
EXECUTE FUNCTION prevent_bank_reconciliation_mutation();

-- NO DELETE: a reconciliation is never removed; a wrong one is superseded.
CREATE OR REPLACE FUNCTION prevent_bank_reconciliation_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Bank reconciliations cannot be deleted. Re-open a reconciled month by supersession; a draft is saved over.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER no_bank_reconciliation_deletes
BEFORE DELETE ON "bank_reconciliations"
FOR EACH ROW
EXECUTE FUNCTION prevent_bank_reconciliation_delete();
