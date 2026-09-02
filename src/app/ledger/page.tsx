import { redirect } from 'next/navigation';

// NAV-01b (ONE SHELL): the standalone ledger page duplicated the Books cockpit's General Ledger
// section (GeneralLedger).
// The URL keeps resolving for anyone who linked or bookmarked it.
export default function LedgerRedirect() {
  redirect('/books');
}
