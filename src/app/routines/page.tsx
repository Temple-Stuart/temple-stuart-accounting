import { redirect } from 'next/navigation';

// TOOL-LAW-01: one tool, one page. The /operations room is gone; this URL keeps
// resolving, straight to the tool that owns the work.
export default function RoutinesRedirect() {
  redirect('/calendar');
}
