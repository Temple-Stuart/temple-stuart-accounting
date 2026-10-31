import { redirect } from 'next/navigation';

// NAV-01b (ONE SHELL): the standalone transactions page duplicated the Books cockpit's Categorize
// section (SpendingTab + ManualTransactionForm).
// The URL keeps resolving for anyone who linked or bookmarked it.
export default function TransactionsRedirect() {
  redirect('/books');
}
