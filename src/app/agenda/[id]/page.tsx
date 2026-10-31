import { redirect } from 'next/navigation';

// BUDGET-02 (Alex, ruling H, 2026-10-20): Budget is one page, and its registry row links
// nothing now. /agenda/[id] was one legacy agenda item (GET, PATCH and
// DELETE /api/agenda/[id]), reached from /agenda — one of Budget's sub-rows on the rail.
// This redirect keeps every link in the wild working — bookmarks, the rail rows printed
// before the change, anything already sent. Its components, routes and tables stay, listed
// "for CLEAN" in the BUDGET-02 PR.
//
// REMOVABLE: it carries no state and no UI. Delete it once no stale link is in circulation.
export default function AgendaItemRedirect() {
  redirect('/budget');
}
