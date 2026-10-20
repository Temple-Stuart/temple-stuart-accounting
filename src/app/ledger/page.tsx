import { redirect } from 'next/navigation';

// NAV-01b (ONE SHELL): the standalone ledger page duplicated the Books cockpit's General Ledger
// section (GeneralLedger).
// The URL keeps resolving for anyone who linked or bookmarked it.
// BUDGET-02 (Alex, ruling F, 2026-10-20): "open in Books" on /budget links here with
// ?account=&book=&from=&to=. Those four keys — every value as given, no other key, none
// invented — are carried to /books, which opens the general ledger's phase, fills its four
// filters and clears them from the URL (src/components/home/BooksPipeline.tsx). With none of
// them, the hop is the one it always was.
const LEDGER_KEYS = ['account', 'book', 'from', 'to'] as const;

export default async function LedgerRedirect({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const given = await searchParams;
  const forward = new URLSearchParams();
  for (const key of LEDGER_KEYS) {
    const value = given[key];
    for (const v of typeof value === 'string' ? [value] : value ?? []) forward.append(key, v);
  }
  if (forward.toString() === '') redirect('/books');
  redirect(`/books?${forward.toString()}`);
}
