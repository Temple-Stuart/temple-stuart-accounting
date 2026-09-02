import { redirect } from 'next/navigation';

// NAV-01b (ONE SHELL): the old hub cockpit — its calendar lives in the Runway section of the cockpit
// (HubCalendar, ModuleLauncher.tsx).
// The URL keeps resolving for anyone who linked or bookmarked it.
export default function HubRedirect() {
  redirect('/runway');
}
