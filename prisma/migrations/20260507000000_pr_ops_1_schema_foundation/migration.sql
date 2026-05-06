-- =============================================================================
-- PR-Ops-1: Operations schema foundation
-- =============================================================================
-- Lays down the core tables for the Operations tab introduced in PR-Ops-0a:
--   - operations_projects (Bridgewater 5-step scoping fields)
--   - operations_project_tasks (Citadel-style ranked decision queue, step 5)
--   - operations_project_dependencies (typed DAG edges)
--   - operations_routines (RFC 5545 RRULE-driven recurring tasks)
--   - operations_routine_completions (per-fire completion log)
--   - operations_issue_log_entries (Bridgewater Issue Log + 5 Whys)
--   - operations_vendor_directory (subscription/vendor inventory)
--
-- Reuses existing ProjectStatus enum where applicable; introduces 4 new enums
-- specific to Operations (OperationsTaskStatus, ProjectDependencyType,
-- IssueSeverity, IssueStatus).
--
-- Extends AuditActionType with 27 new operations_* values for the audit log.
--
-- ALTER TYPE ADD VALUE intentionally NOT wrapped in BEGIN/COMMIT per the
-- PR-G/PR-K convention (Postgres driver edge cases on enum-extension inside
-- explicit transactions).
-- =============================================================================

-- PART 1: Enums + tables
BEGIN;

-- -----------------------------------------------------------------------------
-- ENUMS (4 new)
-- -----------------------------------------------------------------------------

CREATE TYPE "OperationsTaskStatus" AS ENUM (
  'open', 'in_progress', 'blocked', 'completed', 'cancelled'
);

CREATE TYPE "ProjectDependencyType" AS ENUM (
  'blocks', 'informs', 'derived_from'
);

CREATE TYPE "IssueSeverity" AS ENUM (
  'minor', 'moderate', 'severe', 'critical'
);

CREATE TYPE "IssueStatus" AS ENUM (
  'open', 'investigating', 'root_caused', 'resolved', 'accepted_no_action', 'superseded_by_redesign'
);

-- -----------------------------------------------------------------------------
-- TABLE 1: operations_projects
-- Bridgewater 5-step scoping carried in 4 prose columns; step 5 (tasks) lives
-- in the operations_project_tasks child table.
-- -----------------------------------------------------------------------------

CREATE TABLE operations_projects (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  TEXT NOT NULL,
  entity_id                TEXT NOT NULL,
  title                    VARCHAR(500) NOT NULL,
  goal                     TEXT NOT NULL,
  problem                  TEXT NOT NULL,
  diagnosis                TEXT NOT NULL,
  design                   TEXT NOT NULL,
  status                   "ProjectStatus" NOT NULL DEFAULT 'not_started',
  target_completion_date   TIMESTAMPTZ,
  estimated_total_minutes  INTEGER,
  estimated_total_cost_usd DECIMAL(15,2),
  priority_score           DECIMAL(10,4),
  priority_inputs_hash     VARCHAR(64),
  priority_computed_at     TIMESTAMPTZ,
  priority_rationale       TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by               TEXT,
  CONSTRAINT operations_projects_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT operations_projects_entity_id_fkey
    FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT operations_projects_user_title_key
    UNIQUE (user_id, title)
);

CREATE INDEX operations_projects_user_entity_status_idx
  ON operations_projects (user_id, entity_id, status);
CREATE INDEX operations_projects_user_status_idx
  ON operations_projects (user_id, status);
CREATE INDEX operations_projects_priority_score_idx
  ON operations_projects (priority_score DESC NULLS LAST);
CREATE INDEX operations_projects_target_date_idx
  ON operations_projects (target_completion_date);

COMMENT ON TABLE operations_projects IS
  'Top-level projects in the Operations tab. Reuses ProjectStatus enum '
  '(shared with compliance projects). Bridgewater 5-step scoping: goal '
  '(step 1), problem (step 2), diagnosis (step 3), design (step 4); step '
  '5 = task list lives in operations_project_tasks.';
COMMENT ON COLUMN operations_projects.priority_score IS
  'Computed priority score (Citadel-style ranked queue). Recomputed by '
  'priority engine on input changes; null until first computation.';
COMMENT ON COLUMN operations_projects.priority_inputs_hash IS
  'SHA-256 hex of the input bundle used to compute priority_score. Used to '
  'short-circuit recomputation when nothing material has changed.';
COMMENT ON COLUMN operations_projects.priority_computed_at IS
  'Timestamp of the last priority_score computation. Null until first run.';
COMMENT ON COLUMN operations_projects.priority_rationale IS
  'Human-readable explanation of priority_score, e.g. "Unblocks 3 projects, '
  'ROI $X, deadline Y".';

-- -----------------------------------------------------------------------------
-- TABLE 2: operations_project_tasks
-- Step-5 of Bridgewater scoping. user_id and entity_id are denormalized from
-- the parent project for index speed on the user-scoped task queues.
-- -----------------------------------------------------------------------------

CREATE TABLE operations_project_tasks (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id             UUID NOT NULL,
  user_id                TEXT NOT NULL,
  entity_id              TEXT NOT NULL,
  title                  VARCHAR(500) NOT NULL,
  description            TEXT,
  status                 "OperationsTaskStatus" NOT NULL DEFAULT 'open',
  estimated_minutes      INTEGER,
  estimated_cost_usd     DECIMAL(15,2),
  deadline               TIMESTAMPTZ,
  priority_score         DECIMAL(10,4),
  priority_inputs_hash   VARCHAR(64),
  priority_computed_at   TIMESTAMPTZ,
  priority_rationale     TEXT,
  unblocks_label         TEXT,
  display_order          INTEGER NOT NULL DEFAULT 0,
  completed_at           TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by             TEXT,
  CONSTRAINT operations_project_tasks_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES operations_projects(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT operations_project_tasks_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT operations_project_tasks_entity_id_fkey
    FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE NO ACTION ON UPDATE NO ACTION
);

CREATE INDEX operations_project_tasks_project_status_order_idx
  ON operations_project_tasks (project_id, status, display_order);
CREATE INDEX operations_project_tasks_user_status_priority_idx
  ON operations_project_tasks (user_id, status, priority_score DESC NULLS LAST);
CREATE INDEX operations_project_tasks_deadline_idx
  ON operations_project_tasks (deadline);
CREATE INDEX operations_project_tasks_entity_idx
  ON operations_project_tasks (entity_id);

COMMENT ON TABLE operations_project_tasks IS
  'Concrete tasks under an operations project (Bridgewater step 5). user_id '
  'and entity_id denormalized from the parent for fast user-scoped queries.';
COMMENT ON COLUMN operations_project_tasks.unblocks_label IS
  'Free-text label describing what completing this task unblocks. Displayed '
  'in the priority queue alongside priority_rationale.';
COMMENT ON COLUMN operations_project_tasks.priority_inputs_hash IS
  'SHA-256 hex of the input bundle used to compute priority_score. Mirrors '
  'the operations_projects pattern.';

-- -----------------------------------------------------------------------------
-- TABLE 3: operations_project_dependencies
-- Typed DAG edges between projects. Cycle prevention is enforced in app code.
-- -----------------------------------------------------------------------------

CREATE TABLE operations_project_dependencies (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id               UUID NOT NULL,
  depends_on_project_id    UUID NOT NULL,
  dependency_type          "ProjectDependencyType" NOT NULL,
  rationale                TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by               TEXT,
  CONSTRAINT operations_project_dependencies_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES operations_projects(id) ON DELETE CASCADE,
  CONSTRAINT operations_project_dependencies_depends_on_project_id_fkey
    FOREIGN KEY (depends_on_project_id) REFERENCES operations_projects(id) ON DELETE CASCADE,
  CONSTRAINT operations_project_dependencies_unique_edge
    UNIQUE (project_id, depends_on_project_id, dependency_type),
  CONSTRAINT operations_project_dependencies_no_self_dependency
    CHECK (project_id != depends_on_project_id)
);

CREATE INDEX operations_project_dependencies_project_idx
  ON operations_project_dependencies (project_id);
CREATE INDEX operations_project_dependencies_depends_idx
  ON operations_project_dependencies (depends_on_project_id);
CREATE INDEX operations_project_dependencies_type_idx
  ON operations_project_dependencies (dependency_type);

COMMENT ON TABLE operations_project_dependencies IS
  'Typed dependency edges between operations_projects. DAG cycle prevention '
  'enforced in app code, not SQL.';

-- -----------------------------------------------------------------------------
-- TABLE 4: operations_routines
-- RFC 5545 RRULE-driven recurring tasks. next_due_at and last_evaluated_at are
-- materialized by an Inngest job (PR-Ops-5).
-- -----------------------------------------------------------------------------

CREATE TABLE operations_routines (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                         TEXT NOT NULL,
  entity_id                       TEXT NOT NULL,
  name                            VARCHAR(200) NOT NULL,
  description                     TEXT,
  schedule_rrule                  TEXT NOT NULL,
  timezone                        VARCHAR(64) NOT NULL DEFAULT 'America/Los_Angeles',
  next_due_at                     TIMESTAMPTZ,
  last_evaluated_at               TIMESTAMPTZ,
  last_completed_at               TIMESTAMPTZ,
  consecutive_completion_streak   INTEGER NOT NULL DEFAULT 0,
  consecutive_miss_streak         INTEGER NOT NULL DEFAULT 0,
  ideal_time_label                VARCHAR(50),
  fail_threshold_minutes          INTEGER NOT NULL DEFAULT 0,
  is_active                       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by                      TEXT,
  CONSTRAINT operations_routines_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE NO ACTION,
  CONSTRAINT operations_routines_entity_id_fkey
    FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE NO ACTION,
  CONSTRAINT operations_routines_user_name_key
    UNIQUE (user_id, name)
);

CREATE INDEX operations_routines_user_active_due_idx
  ON operations_routines (user_id, is_active, next_due_at);
CREATE INDEX operations_routines_user_entity_idx
  ON operations_routines (user_id, entity_id);
CREATE INDEX operations_routines_active_due_idx
  ON operations_routines (next_due_at) WHERE is_active = TRUE;

COMMENT ON COLUMN operations_routines.schedule_rrule IS
  'RFC 5545 RRULE string, e.g. FREQ=DAILY;BYHOUR=6;BYMINUTE=0';
COMMENT ON COLUMN operations_routines.next_due_at IS
  'Materialized by Inngest job in PR-Ops-5; NULL until first evaluation';
COMMENT ON COLUMN operations_routines.fail_threshold_minutes IS
  'Minutes past expected_at before a missed completion is logged. 0 = strict.';

-- -----------------------------------------------------------------------------
-- TABLE 5: operations_routine_completions
-- One row per actual completion of a routine fire. Misses are NOT stored
-- here -- they are emitted as operations_routine_missed events into the
-- shared audit_log by the Inngest job in PR-Ops-5. The (routine_id,
-- expected_at) UNIQUE key ensures one completion per fire (no duplicate
-- attestations).
-- -----------------------------------------------------------------------------

CREATE TABLE operations_routine_completions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id      UUID NOT NULL,
  user_id         TEXT NOT NULL,
  expected_at     TIMESTAMPTZ NOT NULL,
  completed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delta_minutes   INTEGER NOT NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT operations_routine_completions_routine_id_fkey
    FOREIGN KEY (routine_id) REFERENCES operations_routines(id) ON DELETE CASCADE,
  CONSTRAINT operations_routine_completions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE NO ACTION,
  CONSTRAINT operations_routine_completions_routine_expected_key
    UNIQUE (routine_id, expected_at)
);

CREATE INDEX operations_routine_completions_routine_expected_idx
  ON operations_routine_completions (routine_id, expected_at DESC);
CREATE INDEX operations_routine_completions_user_completed_idx
  ON operations_routine_completions (user_id, completed_at DESC);

COMMENT ON COLUMN operations_routine_completions.expected_at IS
  'The RRULE fire timestamp that this completion satisfies. UNIQUE per '
  '(routine_id, expected_at) prevents double-completion of the same fire.';
COMMENT ON COLUMN operations_routine_completions.delta_minutes IS
  'Signed difference (completed_at - expected_at) in minutes. Negative = '
  'early, positive = late. Used by streak/miss analytics.';

-- -----------------------------------------------------------------------------
-- TABLE 6: operations_issue_log_entries
-- Bridgewater Issue Log + 5 Whys. Self-referential via linked_issue_id for
-- issue chains; linked_project_id ties an issue to a remediation project.
-- -----------------------------------------------------------------------------

CREATE TABLE operations_issue_log_entries (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  TEXT NOT NULL,
  entity_id                TEXT NOT NULL,
  title                    VARCHAR(500) NOT NULL,
  description              TEXT NOT NULL,
  severity                 "IssueSeverity" NOT NULL,
  status                   "IssueStatus" NOT NULL DEFAULT 'open',
  root_cause_proximate     TEXT,
  root_cause_systemic      TEXT,
  resolution               TEXT,
  resolution_category      VARCHAR(50),
  recurrence_count         INTEGER NOT NULL DEFAULT 0,
  linked_issue_id          UUID,
  linked_project_id        UUID,
  occurred_at              TIMESTAMPTZ NOT NULL,
  discovered_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at              TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by               TEXT,
  CONSTRAINT operations_issue_log_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE NO ACTION,
  CONSTRAINT operations_issue_log_entity_id_fkey
    FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE NO ACTION,
  CONSTRAINT operations_issue_log_linked_issue_id_fkey
    FOREIGN KEY (linked_issue_id) REFERENCES operations_issue_log_entries(id) ON DELETE SET NULL,
  CONSTRAINT operations_issue_log_linked_project_id_fkey
    FOREIGN KEY (linked_project_id) REFERENCES operations_projects(id) ON DELETE SET NULL
);

CREATE INDEX operations_issue_log_user_status_idx
  ON operations_issue_log_entries (user_id, status);
CREATE INDEX operations_issue_log_user_severity_status_idx
  ON operations_issue_log_entries (user_id, severity, status);
CREATE INDEX operations_issue_log_occurred_idx
  ON operations_issue_log_entries (occurred_at DESC);
CREATE INDEX operations_issue_log_entity_idx
  ON operations_issue_log_entries (entity_id);
CREATE INDEX operations_issue_log_linked_project_idx
  ON operations_issue_log_entries (linked_project_id);
CREATE INDEX operations_issue_log_linked_issue_idx
  ON operations_issue_log_entries (linked_issue_id);

COMMENT ON COLUMN operations_issue_log_entries.root_cause_proximate IS
  'Bridgewater 5 Whys: the immediate, surface-level cause.';
COMMENT ON COLUMN operations_issue_log_entries.root_cause_systemic IS
  'Bridgewater 5 Whys: the underlying system/process flaw.';
COMMENT ON COLUMN operations_issue_log_entries.resolution_category IS
  'Free-text: typical values are fixed, redesigned, accepted, deferred.';
COMMENT ON COLUMN operations_issue_log_entries.recurrence_count IS
  'App-incremented when a repeat of a previously-resolved issue is detected.';
COMMENT ON COLUMN operations_issue_log_entries.linked_issue_id IS
  'Self-referential FK for issue chains (e.g. recurrence pointing back to '
  'the original).';

-- -----------------------------------------------------------------------------
-- TABLE 7: operations_vendor_directory
-- Subscription/vendor inventory. chart_account_id is UUID-typed (matches
-- chart_of_accounts.id) and is joined in PR-Ops-10.
-- -----------------------------------------------------------------------------

CREATE TABLE operations_vendor_directory (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  TEXT NOT NULL,
  entity_id                TEXT NOT NULL,
  chart_account_id         UUID,
  vendor_name              VARCHAR(200) NOT NULL,
  category                 VARCHAR(100),
  amount_usd               DECIMAL(15,2),
  billing_rrule            TEXT,
  next_due_date            DATE,
  last_paid_date           DATE,
  last_paid_amount_usd     DECIMAL(15,2),
  contact_email            VARCHAR(255),
  contact_url              VARCHAR(500),
  account_number_last4     VARCHAR(4),
  notes                    TEXT,
  is_active                BOOLEAN NOT NULL DEFAULT TRUE,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by               TEXT,
  CONSTRAINT operations_vendor_directory_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE NO ACTION,
  CONSTRAINT operations_vendor_directory_entity_id_fkey
    FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE NO ACTION,
  CONSTRAINT operations_vendor_directory_chart_account_id_fkey
    FOREIGN KEY (chart_account_id) REFERENCES chart_of_accounts(id) ON DELETE SET NULL,
  CONSTRAINT operations_vendor_directory_user_entity_vendor_key
    UNIQUE (user_id, entity_id, vendor_name)
);

CREATE INDEX operations_vendor_directory_user_active_idx
  ON operations_vendor_directory (user_id, is_active);
CREATE INDEX operations_vendor_directory_user_entity_idx
  ON operations_vendor_directory (user_id, entity_id);
CREATE INDEX operations_vendor_directory_next_due_idx
  ON operations_vendor_directory (next_due_date);
CREATE INDEX operations_vendor_directory_chart_acct_idx
  ON operations_vendor_directory (chart_account_id);

COMMENT ON COLUMN operations_vendor_directory.chart_account_id IS
  'FK to chart_of_accounts.id (UUID). Nullable; populated by the vendor->COA '
  'mapping flow in PR-Ops-10.';
COMMENT ON COLUMN operations_vendor_directory.billing_rrule IS
  'RFC 5545 RRULE string. NULL means one-time vendor (no recurring billing).';
COMMENT ON COLUMN operations_vendor_directory.next_due_date IS
  'Materialized in PR-Ops-10 from billing_rrule + last_paid_date.';
COMMENT ON COLUMN operations_vendor_directory.account_number_last4 IS
  'Last four characters of the vendor account number, for human '
  'identification only. Never store full account numbers here.';

COMMIT;

-- =============================================================================
-- PART 2: AuditActionType enum extensions (must run outside transaction)
-- IF NOT EXISTS guards make this idempotent.
-- =============================================================================

ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_project_created';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_project_updated';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_project_status_changed';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_project_deleted';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_project_task_created';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_project_task_updated';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_project_task_status_changed';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_project_task_completed';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_project_task_deleted';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_project_dependency_added';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_project_dependency_removed';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_routine_created';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_routine_updated';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_routine_deactivated';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_routine_deleted';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_routine_completed';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_routine_missed';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_issue_logged';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_issue_updated';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_issue_status_changed';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_issue_resolved';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_issue_deleted';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_vendor_added';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_vendor_updated';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_vendor_deactivated';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_vendor_deleted';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_priority_recomputed';
