import { redirect } from 'next/navigation';

// ROOM-02: step 12 is ONE room at /operations, read top down. Routines is its
// phase 03. The URL keeps resolving for anyone who linked or bookmarked it.
export default function RoutinesRedirect() {
  redirect('/operations?phase=routines');
}
