import { redirect } from 'next/navigation';

// NAV-01b (ONE SHELL): the Operations shell's Projects page mounted the same SectionD_ProjectBacklog
// the cockpit's Projects section mounts (Tasks' home).
// The URL keeps resolving for anyone who linked or bookmarked it.
export default function OperationsProjectsRedirect() {
  redirect('/projects');
}
