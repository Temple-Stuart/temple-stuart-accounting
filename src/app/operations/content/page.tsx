/**
 * /operations/content
 *
 * Section G · Content page — Alex's 4-step pipeline (OPS-CE-7), one flat page:
 *   1 · SOURCES (routines + project tasks) → 2 · SCENIFY DRAFT (inline, multi-routine)
 *   → 3 · CONFIRMED (PieceGrid + Daily Log) → 4 · SCRIPT OUTPUT (CE-5 mount point).
 *
 * The whole composition lives in ContentPipeline (client). The OperationsEntity
 * Provider is wired in the parent /operations/layout.tsx.
 *
 * RETIRED here (OPS-CE-7): the legacy SectionG_Content surface (the "No scenes yet"
 * container UI + legacy ContentTable + its ScriptDrawer) is no longer mounted on this
 * page. Those component files are left in place (not deleted) — ContentTable is still
 * used by the home ContentPreview; SectionG_Content/ScriptDrawer/AvailableRoutinesList/
 * SceneHeaderRow/TakeRow are now dead on this page → flagged for a later cleanup PR.
 */

import ContentPipeline from '@/components/workbench/operations/content/ContentPipeline';

export default function OperationsContentPage() {
  return <ContentPipeline />;
}
