import { redirect } from 'next/navigation';

// NAV-01b (ONE SHELL): the Operations shell's Routines page mounted the same SectionE_Routines the
// cockpit's Routines section mounts.
// The URL keeps resolving for anyone who linked or bookmarked it.
export default function OperationsRoutinesRedirect() {
  redirect('/routines');
}
