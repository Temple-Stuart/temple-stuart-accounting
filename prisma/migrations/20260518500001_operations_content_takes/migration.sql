-- PR-Ops-4.9.1b: operations_content_takes — take-level content overlay
--
-- A "take" is a 1:1 content-production overlay on an existing routine_step
-- (UNIQUE routine_step_id). It annotates the step with filming-production
-- metadata; it does not replace the step.
--
-- entity_id + user_id are denormalized loose scalars (TEXT), matching the
-- operations_content_scenes / operations_routine_steps precedent — no FK to
-- entities/users. Only routine_step_id carries a real FK.
--
-- No take_number column: display ordering is derived at render-time from
-- scene.scene_number + routine_step.step_order. No direct scene_id link —
-- takes reach their scene transitively via routine_step -> routine -> scene.
--
-- No status enum in v1; categorical fields (filming_location_specific,
-- camera_needed, filming_angle) are free-text.

BEGIN;

CREATE TABLE "operations_content_takes" (
  "id"                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"                   TEXT NOT NULL,
  "entity_id"                 TEXT NOT NULL,
  "routine_step_id"           UUID NOT NULL,
  "filming_location_specific" VARCHAR(200),
  "camera_needed"             VARCHAR(200),
  "filming_angle"             VARCHAR(200),
  "notes"                     TEXT,
  "created_at"                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "operations_content_takes_routine_step_id_fkey"
    FOREIGN KEY ("routine_step_id") REFERENCES "operations_routine_steps"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "operations_content_takes_routine_step_id_key"
  ON "operations_content_takes"("routine_step_id");

CREATE INDEX "operations_content_takes_user_id_idx"
  ON "operations_content_takes"("user_id");

CREATE INDEX "operations_content_takes_entity_id_idx"
  ON "operations_content_takes"("entity_id");

CREATE INDEX "operations_content_takes_routine_step_id_idx"
  ON "operations_content_takes"("routine_step_id");

COMMIT;
