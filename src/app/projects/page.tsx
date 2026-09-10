import { redirect } from 'next/navigation';

// ROOM-02: step 12 is ONE room at /operations, read top down. Projects is its
// phase 04. The URL keeps resolving for anyone who linked or bookmarked it.
export default function ProjectsRedirect() {
  redirect('/operations?phase=projects');
}
