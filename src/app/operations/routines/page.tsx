import { redirect } from 'next/navigation';

// TOOL-LAW-01: the room this hop pointed into is gone. One hop, to the owner.
// PLAN-01 (2026-09-17): the owner changed — was '/calendar', and the routine
// builder is on /tasks now. The occurrence tiles stay on the calendar; the
// authoring surface is Tasks'.
export default function OperationsRoutinesRedirect() {
  redirect('/tasks');
}
