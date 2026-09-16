import { redirect } from 'next/navigation';

// TRADE-SPLIT (2026-09-16): one tool, one page. /trading was the last page on
// the tool law's grandfather list — Brokerage (17) and Trade Log (18) shared it.
// Brokerage now owns /brokerage (trade 01-03) and Trade Log owns /trade-log
// (04-06). This redirect keeps every link in the wild working — bookmarks, the
// rail rows printed before the move, anything already sent.
//
// REMOVABLE: it carries no state and no UI. Delete it once the two homes have
// been live long enough that no stale /trading link is in circulation; nothing
// in the app points here any more (TRADE-SPLIT STEP 3 updated every pointer).
export default function TradingRedirect() {
  redirect('/brokerage');
}
