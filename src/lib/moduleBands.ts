// ONE-BAND: the per-tab module band copy — headline (`plain`) + the 3 ✓ chips
// (`bullets`) — extracted to a shared LEAF module (zero imports, client-safe;
// the FD-1d TAB_DESCRIPTORS precedent) so the HomeClient hero can render it
// without pulling ModuleLauncher's eager nine-deck import graph.
//
// Strings are byte-exact lockstep copies of the deck's PILLAR_CARDS
// (Landing.tsx PILLAR_CARDS): each card's `plain` = the headline, its 3
// `bullets` = the ✓ chips. ZERO new strings; a copy change in the deck
// re-fires here. (History: eight entries moved verbatim from ModuleLauncher's
// MODULE_BANDS — itself the same lockstep copy — and travel was added as the
// same byte-copy of its PILLAR_CARDS card, which ModuleLauncher never carried
// because the travel tab's band lived on the ToggleStrip instead.)
//
// `num`/`name` = the module ordinal + label from the PILLAR_CARDS funnel
// order (travel first … content last — the numbering authority PIPE-FRAME-1
// ratified): keyed by TAB key (the activeModule values ModuleLauncher
// reports via onTabChange; Runway's tab key is 'calendar').
export const MODULE_BANDS: Record<
  string,
  { num: string; name: string; plain: string; bullets: readonly [string, string, string] }
> = {
  travel: {
    num: '01', name: 'Travel',
    plain: 'Search, book, and budget your trips in one place.',
    bullets: [
      'Search and book — no account needed',
      'Every booking saves to your trip',
      'See planned vs. what you really spent',
    ],
  },
  calendar: {
    num: '02', name: 'Runway',
    plain: 'See how many months your money lasts.',
    bullets: ['Every system you’re juggling', 'Burn: Personal vs. Business', 'Strays surfaced, never dropped'],
  },
  books: {
    num: '03', name: 'Books',
    plain: 'Know where every dollar went — synced straight from your bank.',
    bullets: ['Plaid bank sync', 'Double-entry journal & ledger', 'Hand your CPA a package'],
  },
  trade: {
    num: '04', name: 'Trade',
    plain: 'Find trades worth taking — and get told when to skip.',
    bullets: ['Scanner on live market data', 'Trading journal & realized P&L', 'Eighteen controls, sixteen strategies'],
  },
  tax: {
    num: '05', name: 'Tax',
    plain: 'Your return builds itself from your records.',
    bullets: ['1040 estimate from closed books', 'Wash sales + Form 8949', 'CPA export'],
  },
  compliance: {
    num: '06', name: 'Compliance',
    plain: 'Every number keeps its receipt — proof you can show later.',
    bullets: ['Regulatory corpus search', 'Citation verification', 'Tamper-evident audit registry'],
  },
  routines: {
    num: '07', name: 'Routines',
    plain: 'Set up a habit once — it lands on your calendar and your budget.',
    bullets: ['Build once, shows up everywhere', 'Executable steps you actually run', 'What’s due, done, slipped'],
  },
  projects: {
    num: '08', name: 'Projects',
    plain: 'Type a goal — get a plan you can actually run.',
    bullets: ['Goals in, audited tasks out', 'AI planning pipeline', 'Capped at 20 runs/day'],
  },
  content: {
    num: '09', name: 'Content',
    plain: 'Turn what you did today into a ready-to-film script.',
    bullets: ['Your day becomes the script', 'Every step: shot, question, purpose', 'AI script generation (paid)'],
  },
};
