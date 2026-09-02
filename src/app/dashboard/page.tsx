import { redirect } from 'next/navigation';

// NAV-01b (ONE SHELL): the legacy bookkeeping dashboard duplicated the Books cockpit section for
// section; every section now renders once, in the cockpit (BooksPipeline).
// The URL keeps resolving for anyone who linked or bookmarked it.
export default function DashboardRedirect() {
  redirect('/books');
}
