// ONE-BAND: the per-tab module band copy — headline (`plain`) + the 3 ✓ chips
// (`bullets`) — extracted to a shared LEAF module (zero imports, client-safe;
// the FD-1d TAB_DESCRIPTORS precedent) so the HomeClient hero can render it
// without pulling ModuleLauncher's eager nine-deck import graph.
//
// Strings are byte-exact lockstep copies of the deck's PILLAR_CARDS
// (Landing.tsx PILLAR_CARDS): each card's `plain` = the headline, its
// `bullets` = the ✓ chips. ZERO new strings; a copy change in the deck
// re-fires here. (History: eight entries moved verbatim from ModuleLauncher's
// MODULE_BANDS — itself the same lockstep copy — and travel was added as the
// same byte-copy of its PILLAR_CARDS card, which ModuleLauncher never carried
// because the travel tab's band lived on the ToggleStrip instead.)
//
// ONE RATIFIED DIVERGENCE — trade.bullets: NOT the deck's three. They are the
// module's own verified-facts trust row (the retired TRADE_TRUST_CHIPS,
// pre-4df0b06e ModuleLauncher.tsx:154-164, restored verbatim by Alex's
// ruling). Per-chip basis as originally cited there: live TastyTrade prices
// (tastytrade.ts client + api/tastytrade/quotes), broker sync
// (api/tastytrade/positions), trades commit to the ledger
// (api/trading/commit-to-ledger), and the LANG-1 data-not-advice stance
// (TradingDataDisclaimer). A deck copy change to the trade card does NOT
// re-fire here — trade's chips answer to the trust row, not the deck.
//
// `num`/`name` = the module ordinal + label from the PILLAR_CARDS canonical
// lifecycle order (MODULE-ORDER: routines 01 … content 09 — plan → execute →
// book → prove → settle → know → tell; supersedes the funnel-order
// numbering): keyed by TAB key (the activeModule values ModuleLauncher
// reports via onTabChange; Runway's tab key is 'calendar'). Map layout
// order is legacy and never renders — only `num` carries the ordinal.
export const MODULE_BANDS: Record<
  string,
  // bullets: readonly string[] (not a fixed 3-tuple) — trade carries four
  // (the ratified verified-facts divergence above); the other eight carry
  // the deck's three.
  { num: string; name: string; plain: string; bullets: readonly string[] }
> = {
  travel: {
    num: '03', name: 'Travel',
    plain: 'Search, book, and budget your trips in one place.',
    bullets: [
      'Search and book — no account needed',
      'Every booking saves to your trip',
      'See planned vs. what you really spent',
    ],
  },
  calendar: {
    num: '08', name: 'Runway',
    plain: 'See how many months your money lasts.',
    bullets: ['Every system you’re juggling', 'Burn: Personal vs. Business', 'Strays surfaced, never dropped'],
  },
  books: {
    num: '05', name: 'Books',
    plain: 'Know where every dollar went — synced straight from your bank.',
    bullets: ['Plaid bank sync', 'Double-entry journal & ledger', 'Hand your CPA a package'],
  },
  trade: {
    num: '04', name: 'Trade',
    plain: 'Find trades worth taking — and get told when to skip.',
    bullets: ['Live prices from TastyTrade', 'Synced from your broker', 'Every trade lands in your books', 'Data, not advice'],
  },
  tax: {
    num: '07', name: 'Tax',
    plain: 'Your return builds itself from your records.',
    bullets: ['1040 estimate from closed books', 'Wash sales + Form 8949', 'CPA export'],
  },
  compliance: {
    num: '06', name: 'Compliance',
    plain: 'Every number keeps its receipt — proof you can show later.',
    bullets: ['Regulatory corpus search', 'Citation verification', 'Tamper-evident audit registry'],
  },
  routines: {
    num: '01', name: 'Routines',
    plain: 'Set up a habit once — it lands on your calendar and your budget.',
    bullets: ['Build once, shows up everywhere', 'Executable steps you actually run', 'What’s due, done, slipped'],
  },
  projects: {
    num: '02', name: 'Projects',
    plain: 'Type a goal — get a plan you can actually run.',
    bullets: ['Goals in, audited tasks out', 'AI planning pipeline', 'Capped at 20 runs/day'],
  },
  content: {
    num: '09', name: 'Content',
    plain: 'Turn what you did today into a ready-to-film script.',
    bullets: ['Your day becomes the script', 'Every step: shot, question, purpose', 'AI script generation (paid)'],
  },
};
