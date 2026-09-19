-- TRAVEL-01 (2026-09-19) — A TRIP ITEM IS A KIND A POSTING CAN BE LINKED TO.
--
-- planned_item_links admits target_kind 'trip_item': the target_id is
-- trip_itinerary.id (a stored cuid), so no occurrence instant — the instant
-- CHECK LINES-01 wrote already forbids one for every kind but routine and
-- routine_line, and is untouched. Nothing is migrated; no link is created.
-- Additive, the LINES-01 idiom: drop the kind CHECK, re-add it with the kind.

ALTER TABLE "planned_item_links" DROP CONSTRAINT IF EXISTS "planned_item_links_kind";
ALTER TABLE "planned_item_links" ADD CONSTRAINT "planned_item_links_kind"
  CHECK ("target_kind" IN ('calendar_event', 'project_task', 'routine', 'routine_line', 'trip_item'));
