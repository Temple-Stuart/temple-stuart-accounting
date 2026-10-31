import { redirect } from 'next/navigation';

// SHELL-02: THE ANSWERS moved to /home — the app's front door has the app's
// plainest name. This redirect keeps every link in the wild working: bookmarks,
// the Stripe success URL sent before the move, and anything already printed.
export default function AnswersRedirect() {
  redirect('/home');
}
