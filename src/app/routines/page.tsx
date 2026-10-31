import { redirect } from 'next/navigation';

// TOOL-LAW-01: one tool, one page. The /operations room is gone; this URL keeps
// resolving, straight to the tool that owns the work.
// PLAN-01 (2026-09-17): was '/calendar'. The routine BUILDER moved to /tasks —
// routines and projects are one act of planning — so someone landing on this
// legacy URL wants /tasks. The calendar still SHOWS a routine's occurrences; it
// no longer authors them.
export default function RoutinesRedirect() {
  redirect('/tasks');
}
