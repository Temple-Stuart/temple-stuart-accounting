// FD-1d: TAB_DESCRIPTORS extracted to a shared LEAF module (zero imports,
// client-safe) — previously defined inside ModuleLauncher.tsx, which forced
// the Landing to carry a lockstep copy: importing the binding from the
// launcher would have pulled its eager nine-deck import graph into the
// landing bundle. Three consumers now import the ONE source: ModuleLauncher
// (re-exports for page.tsx's existing import), the Landing, and the
// /modules/[pillar] pages.
//
// PR-PerTab-Descriptor: one plain descriptor line per tab, shown under the
// tab row and swapped by activeModule (this replaces the old per-panel "How
// it works" collapsibles). Keyed by TAB key (the activeModule values).
// Calendar + Travel are the lines we wrote; the rest are the first sentence
// of each module's prior intro copy.
export const TAB_DESCRIPTORS: Record<string, string> = {
  calendar: 'Runway — how long your money buys you. Your planned and actual spend, mapped to the day, so your runway is never a guess.',
  travel: 'Book your flights, hotels, things to do, and ground transportation — competitive prices, real times, real data.',
  trade: "Tell the scanner what you're hunting, and it pulls live prices from TastyTrade, company numbers from Finnhub, economy data from FRED, official filings from SEC EDGAR, and the mood online from Grok.",
  routines: 'Build your recurring routines and watch them land on your calendar — the rhythms that run your day.',
  projects: "Type the big messy goal that's rattling around your head — plain, rambly, however it actually lives up there.",
  content: 'Turn what you actually did today into a reel — sources to scenes to a ready-to-record script.',
  books: 'Connect your bank through Plaid and every transaction flows in.',
  tax: 'Your books are already clean, so your taxes are half-done before you start.',
  compliance: "This one's for when things get serious.",
};
