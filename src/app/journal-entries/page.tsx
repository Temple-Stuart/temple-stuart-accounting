import { redirect } from 'next/navigation';

// NAV-01b (ONE SHELL): the standalone journal-entries page duplicated the Books cockpit's Journal
// Entries section (JournalEntryEngine).
// The URL keeps resolving for anyone who linked or bookmarked it.
export default function JournalEntriesRedirect() {
  redirect('/books');
}
