-- DOCUMENTS-01 (Alex, 2026-10-28, rulings B and C) — THE SOURCE DOCUMENT, KEPT.
--
-- Every GL entry comes from a source document. A receipt is the one for a posting;
-- a bank statement is the one for an account's month. This table keeps the file
-- itself, word for word, in the database the books already live in (Azure
-- Postgres, bytea — no storage vendor, no package, no env var: ruling C), owned
-- by one user and addressed to exactly one thing:
--   kind 'receipt'   → journal_entry_id      (a posting)
--   kind 'statement' → account_id + period_month (an account's month; its
--                      screen is DOCUMENTS-02 — this PR writes receipts only)
--
-- APPEND-ONLY, HELD HERE — not by convention:
--   · FREEZE: no UPDATE of any column, except superseded_by set ONCE from NULL —
--     a replaced receipt stays, marked by the one that replaced it (the
--     journal_entries precedent: 20260227000100_protect_journal_entries, and
--     LAW-02's set-once rule, 20260927210000_law_02_document_freeze);
--   · NO DELETE: every DELETE is refused (no_journal_entry_deletes' posture);
--   · ONE CURRENT document per address: a partial unique index over the rows
--     no one has superseded (Prisma cannot express a partial index; this file
--     holds it, as POST-01's journal_entries_document_charge_key does).
--
-- REPLACE IN ONE TRANSACTION (the upload route, replace=true): the old row's
-- superseded_by is set to the new row's id, THEN the new row is inserted — the
-- old row leaves the partial index before the new one enters it. The self
-- reference is therefore DEFERRABLE INITIALLY DEFERRED: it is checked at COMMIT,
-- when the new row exists. A transaction that sets superseded_by and inserts
-- nothing fails at commit, by name.
--
-- The type is read from the file's FIRST BYTES by the route
-- (src/lib/books/sourceDocuments.ts sniffContentType), never from the browser's
-- word; the CHECKs below hold the three it accepts, the 4 MiB cap, and the
-- sha256 the server computed over exactly these bytes.
--
-- AUTHORED, NOT APPLIED. Claude Code cannot reach Azure Postgres; Alex runs this
-- via psql, or it applies at deploy after merge (the build's prisma migrate deploy).

CREATE TABLE "source_documents" (
  "id"               UUID           NOT NULL DEFAULT gen_random_uuid(),
  "user_id"          TEXT           NOT NULL,
  "kind"             VARCHAR(12)    NOT NULL,
  "journal_entry_id" TEXT,
  "account_id"       TEXT,
  "period_month"     DATE,
  "file_name"        VARCHAR(255)   NOT NULL,
  "content_type"     VARCHAR(32)    NOT NULL,
  "byte_size"        INTEGER        NOT NULL,
  "sha256"           BYTEA          NOT NULL,
  "bytes"            BYTEA          NOT NULL,
  "superseded_by"    UUID,
  "uploaded_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "uploaded_by"      TEXT,
  CONSTRAINT "source_documents_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "source_documents" ADD CONSTRAINT "source_documents_kind"
  CHECK ("kind" IN ('receipt', 'statement'));

-- Exactly one address: a receipt names its posting and nothing else; a statement its account's month and nothing else.
ALTER TABLE "source_documents" ADD CONSTRAINT "source_documents_one_address"
  CHECK (("kind" = 'receipt' AND "journal_entry_id" IS NOT NULL AND "account_id" IS NULL AND "period_month" IS NULL)
      OR ("kind" = 'statement' AND "journal_entry_id" IS NULL AND "account_id" IS NOT NULL AND "period_month" IS NOT NULL));

ALTER TABLE "source_documents" ADD CONSTRAINT "source_documents_period_first_of_month"
  CHECK ("period_month" IS NULL OR "period_month" = date_trunc('month', "period_month")::date);

ALTER TABLE "source_documents" ADD CONSTRAINT "source_documents_content_type"
  CHECK ("content_type" IN ('application/pdf', 'image/jpeg', 'image/png'));

ALTER TABLE "source_documents" ADD CONSTRAINT "source_documents_byte_size"
  CHECK ("byte_size" > 0 AND "byte_size" <= 4194304 AND octet_length("bytes") = "byte_size");

ALTER TABLE "source_documents" ADD CONSTRAINT "source_documents_sha256_len"
  CHECK (octet_length("sha256") = 32);

ALTER TABLE "source_documents" ADD CONSTRAINT "source_documents_file_name_not_blank"
  CHECK (length(btrim("file_name")) > 0);

ALTER TABLE "source_documents" ADD CONSTRAINT "source_documents_not_self_superseded"
  CHECK ("superseded_by" IS NULL OR "superseded_by" <> "id");

ALTER TABLE "source_documents" ADD CONSTRAINT "source_documents_user_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "source_documents" ADD CONSTRAINT "source_documents_journal_entry_fkey"
  FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "source_documents" ADD CONSTRAINT "source_documents_account_fkey"
  FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "source_documents" ADD CONSTRAINT "source_documents_superseded_by_fkey"
  FOREIGN KEY ("superseded_by") REFERENCES "source_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE
  DEFERRABLE INITIALLY DEFERRED;

-- One CURRENT receipt per posting; one current statement per account's month.
CREATE UNIQUE INDEX "source_documents_one_current_receipt"
  ON "source_documents" ("journal_entry_id")
  WHERE "kind" = 'receipt' AND "superseded_by" IS NULL;
CREATE UNIQUE INDEX "source_documents_one_current_statement"
  ON "source_documents" ("account_id", "period_month")
  WHERE "kind" = 'statement' AND "superseded_by" IS NULL;

CREATE INDEX "source_documents_user_entry_idx" ON "source_documents" ("user_id", "journal_entry_id");
CREATE INDEX "source_documents_user_account_month_idx" ON "source_documents" ("user_id", "account_id", "period_month");

-- FREEZE: nothing changes once kept, except superseded_by, set once from NULL.
CREATE OR REPLACE FUNCTION prevent_source_document_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.kind IS DISTINCT FROM OLD.kind
     OR NEW.journal_entry_id IS DISTINCT FROM OLD.journal_entry_id
     OR NEW.account_id IS DISTINCT FROM OLD.account_id
     OR NEW.period_month IS DISTINCT FROM OLD.period_month
     OR NEW.file_name IS DISTINCT FROM OLD.file_name
     OR NEW.content_type IS DISTINCT FROM OLD.content_type
     OR NEW.byte_size IS DISTINCT FROM OLD.byte_size
     OR NEW.sha256 IS DISTINCT FROM OLD.sha256
     OR NEW.bytes IS DISTINCT FROM OLD.bytes
     OR NEW.uploaded_at IS DISTINCT FROM OLD.uploaded_at
     OR NEW.uploaded_by IS DISTINCT FROM OLD.uploaded_by
  THEN
    RAISE EXCEPTION 'A source document cannot be changed once kept. Only superseded_by may be set, once, when a new document replaces it.';
  END IF;
  IF OLD.superseded_by IS NOT NULL AND NEW.superseded_by IS DISTINCT FROM OLD.superseded_by THEN
    RAISE EXCEPTION 'A source document is superseded once: superseded_by cannot change or go back to NULL.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER protect_source_document_fields
BEFORE UPDATE ON "source_documents"
FOR EACH ROW
EXECUTE FUNCTION prevent_source_document_mutation();

-- NO DELETE: a kept document is never removed.
CREATE OR REPLACE FUNCTION prevent_source_document_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Source documents cannot be deleted. Replace one instead — the replaced document stays, superseded.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER no_source_document_deletes
BEFORE DELETE ON "source_documents"
FOR EACH ROW
EXECUTE FUNCTION prevent_source_document_delete();
