-- PR-Ops-3.6: AI Transparency Layer
-- Adds full prompt/response capture columns to operations_ai_usage so
-- every AI inference is fully inspectable in real-time (preview pane)
-- and retrospectively (audit tail row expansion).
--
-- All three columns are nullable. PR-Ops-3.5 row(s) keep working with
-- NULL values; UI renders graceful "predates PR-Ops-3.6" message.
-- New rows from PR-Ops-3.6 onward populate them on every call.

ALTER TABLE "operations_ai_usage"
    ADD COLUMN "full_system_prompt" TEXT,
    ADD COLUMN "full_user_message" TEXT,
    ADD COLUMN "full_response" TEXT;
