import { redirect } from 'next/navigation';

// NAV-01b (ONE SHELL): the standalone statements page duplicated the Books cockpit's Financial
// Statements section (FinancialStatementsTab).
// The URL keeps resolving for anyone who linked or bookmarked it.
export default function StatementsRedirect() {
  redirect('/books');
}
