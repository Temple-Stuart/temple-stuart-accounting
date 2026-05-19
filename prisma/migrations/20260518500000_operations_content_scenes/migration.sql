-- PR-Ops-4.9.1a: operations_content_scenes — scene-level content overlay
--
-- A "scene" is a 1:1 content-production overlay on an existing routine
-- (UNIQUE routine_id). It annotates the routine with filming/editing
-- metadata; it does not replace the routine.
--
-- entity_id + user_id are denormalized loose scalars (TEXT), matching the
-- operations_routine_steps / operations_project_tasks precedent — no FK to
-- entities/users (entities.id is TEXT and operations_* models stay loosely
-- coupled to tenancy). Only routine_id carries a real FK.
--
-- No status enum in v1; categorical fields (focus_category,
-- filming_location_base) are free-text. estimated_hours is DECIMAL(5,2).

BEGIN;

CREATE TABLE "operations_content_scenes" (
  "id"                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"               TEXT NOT NULL,
  "entity_id"             TEXT NOT NULL,
  "routine_id"            UUID NOT NULL,
  "scene_number"          INT NOT NULL,
  "scene_title"           VARCHAR(500) NOT NULL,
  "focus_category"        VARCHAR(200),
  "filming_location_base" VARCHAR(200),
  "estimated_hours"       DECIMAL(5,2),
  "script"                TEXT,
  "created_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "operations_content_scenes_routine_id_fkey"
    FOREIGN KEY ("routine_id") REFERENCES "operations_routines"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "operations_content_scenes_routine_id_key"
  ON "operations_content_scenes"("routine_id");

CREATE UNIQUE INDEX "uniq_user_scene_number"
  ON "operations_content_scenes"("user_id", "scene_number");

CREATE INDEX "operations_content_scenes_user_id_idx"
  ON "operations_content_scenes"("user_id");

CREATE INDEX "operations_content_scenes_entity_id_idx"
  ON "operations_content_scenes"("entity_id");

CREATE INDEX "operations_content_scenes_routine_id_idx"
  ON "operations_content_scenes"("routine_id");

COMMIT;
