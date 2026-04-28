-- PR-0: Archive Legacy Mission Planner
-- Renames 6 tables to legacy_* prefix. Preserves all data and FK integrity.
-- Production row counts at time of archival:
--   missions: 1, mission_stages: 5, brain_dump_entries: 28,
--   reality_constraints: 0, roadmap_weeks: 0, mission_tasks: 0,
--   daily_plans with mission_id: 0

-- ═══════════════════════════════════════════════════════════════════
-- STEP 1: Rename tables
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE missions RENAME TO legacy_missions;
ALTER TABLE mission_stages RENAME TO legacy_mission_stages;
ALTER TABLE brain_dump_entries RENAME TO legacy_brain_dump_entries;
ALTER TABLE reality_constraints RENAME TO legacy_reality_constraints;
ALTER TABLE roadmap_weeks RENAME TO legacy_roadmap_weeks;
ALTER TABLE mission_tasks RENAME TO legacy_mission_tasks;

-- ═══════════════════════════════════════════════════════════════════
-- STEP 2: Rename indexes to avoid collisions with future tables
-- (Postgres auto-renames FK constraints when table is renamed,
--  but explicit indexes need manual rename)
-- ═══════════════════════════════════════════════════════════════════

-- mission_stages indexes
ALTER INDEX IF EXISTS mission_stages_missionId_idx RENAME TO legacy_mission_stages_missionId_idx;
ALTER INDEX IF EXISTS mission_stages_missionId_stageType_idx RENAME TO legacy_mission_stages_missionId_stageType_idx;

-- brain_dump_entries indexes
ALTER INDEX IF EXISTS brain_dump_entries_missionId_idx RENAME TO legacy_brain_dump_entries_missionId_idx;

-- reality_constraints indexes
ALTER INDEX IF EXISTS reality_constraints_missionId_idx RENAME TO legacy_reality_constraints_missionId_idx;

-- roadmap_weeks indexes
ALTER INDEX IF EXISTS roadmap_weeks_missionId_weekNumber_key RENAME TO legacy_roadmap_weeks_missionId_weekNumber_key;
ALTER INDEX IF EXISTS roadmap_weeks_missionId_idx RENAME TO legacy_roadmap_weeks_missionId_idx;

-- mission_tasks indexes
ALTER INDEX IF EXISTS mission_tasks_missionId_idx RENAME TO legacy_mission_tasks_missionId_idx;
ALTER INDEX IF EXISTS mission_tasks_weekId_idx RENAME TO legacy_mission_tasks_weekId_idx;
ALTER INDEX IF EXISTS mission_tasks_missionId_scheduledDate_idx RENAME TO legacy_mission_tasks_missionId_scheduledDate_idx;

-- ═══════════════════════════════════════════════════════════════════
-- STEP 3: Validate daily_plans FK (0 linked rows, but verify constraint)
-- ═══════════════════════════════════════════════════════════════════

-- Postgres tracks FK by table OID, so rename is transparent.
-- This VALIDATE confirms the constraint is still valid after rename.
ALTER TABLE daily_plans VALIDATE CONSTRAINT daily_plans_mission_id_fkey;
