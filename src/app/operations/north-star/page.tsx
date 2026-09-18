/**
 * src/app/operations/north-star/page.tsx
 *
 * NORTH-01 (2026-09-18): THE NORTH STAR LIVES UNDER TASKS, BESIDE ISSUE LOG
 * AND AUDIT TRAIL — reached the SAME way they are: a `links` entry on Tasks'
 * registry row (src/lib/toolRegistry.ts), which nav.ts turns into a rail
 * sub-row, opening this page. This file mirrors audit-log/page.tsx exactly:
 * one section component, nothing else. The operations layout above it supplies
 * the shell and the OperationsEntityProvider the section reads.
 *
 * The component is untouched — its content, its edit form, its "I reviewed —
 * still holds" attestation and its cadence/overdue banner all read and write
 * /api/operations/north-star as before. Only where it is REACHED changed: it
 * was rendered inline at the top of /tasks (never a cockpit section — the
 * ruling's premise is corrected in the PR body), which is not the idiom its
 * two siblings use.
 */

import SectionB_NorthStar from '@/components/workbench/operations/SectionB_NorthStar';

export default function OperationsNorthStarPage() {
  return <SectionB_NorthStar />;
}
