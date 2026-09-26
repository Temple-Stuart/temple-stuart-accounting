-- AUDIT-01 (2026-09-26) — EVERY CHANGE TO A BOOKING LEAVES A CHAINED ROW.
--
-- AuditActionType had NO reservation value: the booking writes that audited at
-- all used 'system_other' with a description prefix, and most wrote nothing (the
-- hotel book, the cancel, the vendor-state apply, the commission lock, the refund
-- settle, every successful email). These sixteen values name each booking change
-- once, so audit_log — the hash-chained, tamper-evident index of every change —
-- can carry them by type.
--
-- ADD VALUE only: nothing renamed, nothing removed, no row rewritten. NO BACKFILL:
-- the past has its evidence in the primary tables (arrivals, webhook_events,
-- money_events, commission_ledger, journal_entries) and the booking timeline reads
-- it from there; no audit row is invented for a change that was not recorded when
-- it happened.
--
-- The Prisma enum-migration rule: this SQL and the enum block in schema.prisma
-- move together (the values appended after system_other, in this order — the
-- order ALTER TYPE ... ADD VALUE gives them).
--
-- Note: run these as plain statements (psql's autocommit), not inside BEGIN/COMMIT.
-- Before PostgreSQL 12 ALTER TYPE ... ADD VALUE could not run in a transaction
-- block at all; from 12 on it can, but a new value cannot be USED until the
-- transaction that added it commits. IF NOT EXISTS makes a re-run a no-op.
--
-- Applied by Alex via psql (Claude Code authors the file only; it cannot reach Azure).

ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'reservation_booked';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'reservation_status_changed';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'reservation_confirmation_code_arrived';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'reservation_ticketed';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'reservation_ticket_limit_stated';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'reservation_cancel_quoted';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'reservation_cancel_requested';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'reservation_cancel_pending';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'reservation_cancelled';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'reservation_cancel_refused';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'reservation_email_sent';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'reservation_email_failed';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'reservation_posted';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'money_event_stated';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'money_event_settled';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'commission_locked';
