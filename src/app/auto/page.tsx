import { redirect } from 'next/navigation';

// ROOM-01: Budget is ONE room at /budget with a category switcher. This route
// kept its own page and its own rail door until now; it redirects so no link,
// bookmark or printed URL breaks.
export default function AutoRedirect() {
  redirect('/budget?category=auto');
}
