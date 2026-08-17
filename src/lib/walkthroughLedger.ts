// WALKTHROUGH-LEDGER (round-5): THE TRUTH LEDGER + GLIMPSE MANIFEST — the
// TEACH / YOU / APP / FEEDS / GLIMPSE content for all 49 walkthrough steps,
// extracted PROGRAMMATICALLY (never retyped) from the ratified spec bundle:
// design-refs/landing-v5/Modules-v5-Build-Spec.dc.html §6 (the build's single
// source for rail, truth-strip, and glimpse content — README.md §Strings law),
// then byte-diffed field-by-field against a re-extraction (245/245 identical
// at generation; the method mirrors PROBLEM-01's §A extraction precedent).
//
// SHAPE (declared, the a′ ruling): pipePhases.ts stays THE single
// step-name/order source and is byte-untouched — this sibling stores NO step
// names or nums; each `steps` array is ORDER-PARALLEL to PIPE_PHASES[pillar]
// (verified at extraction: every §6 num/name matched pipePhases, with ONE
// declared divergence — the spec §6 restyles Trade's shipped mono-uppercase
// names in Title case; case-only, six steps, pipePhases authoritative).
// Module payoff lines ride along (§6's own header quotes). [IN BUILD] is a
// TYPED flag (compliance steps 04 + 05 only, per README §[IN BUILD]) — never
// a string hack. §6 header annotations ([LIVE — FREE] on Travel; the
// HEIGHT-SETTER / SHORTEST geometry notes) are spec commentary, deliberately
// NOT landed (declared).
//
// STAGED DATA: zero runtime consumers exist at this commit (grep-verified) —
// the Treatment-A stage PRs consume this next. Leaf module: the only import
// is the PipePillarId TYPE from the zero-import pipePhases leaf.

import type { PipePillarId } from '@/lib/pipePhases';

export interface WalkthroughFeeds {
  /** The step number this step feeds (2-based ordinal in the SAME module);
   *  null = the module's terminal step (§6 renders bare "FEEDS"). */
  target: number | null;
  /** The gold clause after FEEDS — what flows forward. */
  clause: string;
}

export interface WalkthroughStep {
  /** The rail row's teach line. */
  teach: string;
  /** The truth strip's YOU cell. */
  you: string;
  /** The truth strip's THE APP cell. */
  app: string;
  feeds: WalkthroughFeeds;
  /** What the glimpse panel depicts (the glimpse manifest entry). */
  glimpse: string;
  /** README §[IN BUILD]: the muted chip — never sold as live. */
  inBuild?: true;
}

export interface WalkthroughModule {
  /** The module's §6 header payoff quote. */
  payoff: string;
  /** ORDER-PARALLEL to PIPE_PHASES[pillar] — index i annotates step i. */
  steps: readonly WalkthroughStep[];
}

export const WALKTHROUGH_LEDGER: Record<PipePillarId, WalkthroughModule> = {
  travel: {
    payoff: "Search, book, and budget your trips in one place.",
    steps: [
      {
        teach: "Start a trip with a budget",
        you: "Name the trip, set the budget",
        app: "Opens a budget + calendar slot for it",
        feeds: { target: 2, clause: "the trip to shop for" },
        glimpse: "your trips + \"+ Create a trip\"",
      },
      {
        teach: "Live flights, hotels, things to do",
        you: "Search — free, no account",
        app: "Pulls live prices: flights, stays, tours, transfers",
        feeds: { target: 3, clause: "real options, real prices" },
        glimpse: "the mode strip + live results",
      },
      {
        teach: "Book it right here",
        you: "Pay the provider — they're the merchant of record",
        app: "Saves the booking to your trip",
        feeds: { target: 4, clause: "the booking + its receipt" },
        glimpse: "booked + paid reservations",
      },
      {
        teach: "The cost writes itself down",
        you: "Nothing — automatic",
        app: "Writes each booking into the trip's budget lines",
        feeds: { target: 5, clause: "planned vs booked" },
        glimpse: "the trip's budget ledger — saved vs booked",
      },
      {
        teach: "Match bookings to your bank",
        you: "Attach any orphan bookings",
        app: "Matches trip spend against your real bank feed",
        feeds: { target: null, clause: "clean, matched books" },
        glimpse: "the unattached-bookings attach panel",
      },
    ],
  },
  runway: {
    payoff: "See how many months your money lasts.",
    steps: [
      {
        teach: "Your banks feed the number",
        you: "Nothing — Books already linked them",
        app: "Reads live balances — trading money EXCLUDED, that's at-risk cash, not spending cash",
        feeds: { target: 2, clause: "real operating cash" },
        glimpse: "the CASH line — \"excludes trading capital\"",
      },
      {
        teach: "What you actually spent",
        you: "Nothing",
        app: "Reads your real spend from the ledger — not estimates",
        feeds: { target: 3, clause: "real burn history" },
        glimpse: "the trailing-months readout",
      },
      {
        teach: "Cash ÷ spend = months left",
        you: "Just look",
        app: "Divides: cash ÷ burn = MONTHS LEFT + your zero date",
        feeds: { target: 4, clause: "the number that matters" },
        glimpse: "the hero — MONTHS LEFT · ZERO DATE · \"not a number you typed\"",
      },
      {
        teach: "Plans matched to real spending",
        you: "Approve the matches",
        app: "Matches planned items to what actually hit the bank",
        feeds: { target: 5, clause: "plan vs reality" },
        glimpse: "booking ↔ bank match review",
      },
      {
        teach: "See the months ahead",
        you: "Set the budget view",
        app: "Projects forward from budget vs actual",
        feeds: { target: null, clause: "your future, priced" },
        glimpse: "month-by-month budget vs actual",
      },
    ],
  },
  books: {
    payoff: "Know where every dollar went — synced straight from your bank.",
    steps: [
      {
        teach: "Your bank feeds in every dollar",
        you: "Link your bank — or type transactions in manually (no Plaid? no problem)",
        app: "Pulls every real transaction, on its own",
        feeds: { target: 2, clause: "the raw feed" },
        glimpse: "source accounts + the manual-entry row",
      },
      {
        teach: "Sort each dollar into its bucket",
        you: "Confirm the buckets",
        app: "Proposes the account for each dollar; you stay the boss",
        feeds: { target: 3, clause: "coded books" },
        glimpse: "the coding queue",
      },
      {
        teach: "Check the books match the bank",
        you: "Review mismatches",
        app: "Checks book totals against bank totals — differences get named",
        feeds: { target: 4, clause: "books that match reality" },
        glimpse: "the reconcile check",
      },
      {
        teach: "Lock the month when it's right",
        you: "Close the period",
        app: "Locks it — debits = credits or it refuses",
        feeds: { target: 5, clause: "a locked month" },
        glimpse: "period close — debits = credits ✓",
      },
      {
        teach: "See where the money went",
        you: "Read them",
        app: "Builds trial balance, income statement, balance sheet, full ledger",
        feeds: { target: 6, clause: "the statements" },
        glimpse: "the reports grid",
      },
      {
        teach: "Hand your accountant the package",
        you: "One click",
        app: "Zips accountant-ready CSVs — your data is yours, never paywalled",
        feeds: { target: null, clause: "your CPA's inbox" },
        glimpse: "the CPA export — \"Export All\"",
      },
    ],
  },
  trade: {
    payoff: "Find trades worth taking — and get told when to skip.",
    steps: [
      {
        teach: "Pick what you're hunting",
        you: "Set universe, filters, risk limits",
        app: "Holds your rules — the scan obeys them, always",
        feeds: { target: 2, clause: "your rules" },
        glimpse: "the setup panel — universe + filters",
      },
      {
        teach: "Live market data runs your filters",
        you: "Hit scan",
        app: "Pulls live broker prices + fundamentals + macro + filings and runs YOUR rules",
        feeds: { target: 3, clause: "survivors only" },
        glimpse: "the pipeline flow — each step shows its counts",
      },
      {
        teach: "Trades worth taking — and the skips",
        you: "Read the verdicts; pick or pass",
        app: "Shows every candidate WITH the reason — including why to skip",
        feeds: { target: 4, clause: "your picks" },
        glimpse: "the verdict table with reasons",
      },
      {
        teach: "Test it before you risk it",
        you: "Link a pick, grade it",
        app: "Tests the setup before money moves",
        feeds: { target: 5, clause: "the graded setup" },
        glimpse: "the lab panel",
      },
      {
        teach: "Wins and losses, written down",
        you: "Nothing — it records",
        app: "Writes every result down — wins AND losses, no cherry-picking",
        feeds: { target: 6, clause: "the record" },
        glimpse: "graded results",
      },
      {
        teach: "Every trade lands in your books",
        you: "One click",
        app: "Books the trade as a real journal entry — same ledger as everything else",
        feeds: { target: null, clause: "your books" },
        glimpse: "the IN BOOKS → chip",
      },
    ],
  },
  tax: {
    payoff: "Your return builds itself from your records.",
    steps: [
      {
        teach: "Check what happened this year",
        you: "Tick what applies",
        app: "Auto-detects what your books already prove (side gig, investments)",
        feeds: { target: 2, clause: "which forms matter" },
        glimpse: "the checklist with auto-detected tags",
      },
      {
        teach: "Your forms, in one place",
        you: "Add what the app can't derive",
        app: "Collects the paper trail",
        feeds: { target: 3, clause: "the evidence" },
        glimpse: "the documents step",
      },
      {
        teach: "What you made — from your books",
        you: "Confirm",
        app: "Pulls income from your CLOSED BOOKS — derived, not typed",
        feeds: { target: 4, clause: "the income picture" },
        glimpse: "the income review",
      },
      {
        teach: "What you can write off",
        you: "Confirm",
        app: "Builds Schedule C from your coded expenses",
        feeds: { target: 5, clause: "the write-offs" },
        glimpse: "the deductions step",
      },
      {
        teach: "Gains, losses, wash sales — handled",
        you: "Nothing — it's your trade record",
        app: "Computes gains, losses, and IRS-window wash sales from your fills",
        feeds: { target: 6, clause: "Schedule D + 8949" },
        glimpse: "the trading step",
      },
      {
        teach: "The whole return, checked",
        you: "Read the 1040",
        app: "Assembles the full return from every step above",
        feeds: { target: 7, clause: "a return you trust" },
        glimpse: "the 1040 review",
      },
      {
        teach: "Export it or file it",
        you: "Export — or file",
        app: "Hands you the filing package",
        feeds: { target: null, clause: "the IRS" },
        glimpse: "the export + filing options",
      },
    ],
  },
  compliance: {
    payoff: "Every number keeps its receipt — proof you can show later.",
    steps: [
      {
        teach: "Who you are, where you file",
        you: "Set entities + jurisdictions",
        app: "Keeps the profile every check runs against",
        feeds: { target: 2, clause: "who the rules apply to" },
        glimpse: "entities + jurisdictions",
      },
      {
        teach: "The rulebooks, collected",
        you: "Add sources",
        app: "Stores the regulations — documents + searchable chunks",
        feeds: { target: 3, clause: "the library" },
        glimpse: "corpus totals — documents · chunks",
      },
      {
        teach: "Find the rule that applies",
        you: "Ask in plain words",
        app: "Searches the rulebooks and returns the passage",
        feeds: { target: 4, clause: "the applicable rule" },
        glimpse: "the retrieval search",
      },
      {
        teach: "Scans for what you're missing",
        you: "—",
        app: "Will scan your profile against the corpus for gaps — this step is being built now",
        feeds: { target: 5, clause: "findings to verify" },
        glimpse: "the launcher (marked in build)",
        inBuild: true,
      },
      {
        teach: "Every citation gets checked",
        you: "—",
        app: "Will check each citation 8 ways before it counts — being built now",
        feeds: { target: 6, clause: "verified findings" },
        glimpse: "the 8-step badge design (marked in build)",
        inBuild: true,
      },
      {
        teach: "A tamper-proof record of it all",
        you: "Hit verify chain",
        app: "Hash-chains every action — change one record and the chain screams",
        feeds: { target: null, clause: "the permanent record" },
        glimpse: "the audit tail + VERIFY CHAIN → VALID",
      },
    ],
  },
  routines: {
    payoff: "Set up a habit once — it lands on your calendar and your budget.",
    steps: [
      {
        teach: "Name the habit — what it takes, what it costs",
        you: "Name it, set the cost + cadence",
        app: "Prices the habit and files it",
        feeds: { target: 2, clause: "the cost + cadence" },
        glimpse: "the routine create form — name · cadence · $ each time",
      },
      {
        teach: "It lands on your calendar",
        you: "Nothing — this one's automatic",
        app: "Writes dated entries onto your calendar AND your budget",
        feeds: { target: 3, clause: "today's due list" },
        glimpse: "the routines list grouped by cadence + calendar dots",
      },
      {
        teach: "Check off what's due today",
        you: "Check off what you did",
        app: "Marks done · due · missed — every day, no mercy",
        feeds: { target: 4, clause: "the done/missed record" },
        glimpse: "the today strip — done ✓ due ○ missed ✗",
      },
      {
        teach: "Streaks show it's really happening",
        you: "Just look",
        app: "Counts streaks from the record — proof, not vibes",
        feeds: { target: null, clause: "the streak record" },
        glimpse: "the streak counts beside each routine",
      },
    ],
  },
  projects: {
    payoff: "Type a goal — get a plan you can actually run.",
    steps: [
      {
        teach: "Type your goal in plain words",
        you: "Type the goal — plain, rambly, however it lives in your head",
        app: "Holds it as the project's source of truth",
        feeds: { target: 2, clause: "your goals, verbatim" },
        glimpse: "the goal input — \"I WANT to…\" lines",
      },
      {
        teach: "AI digs up how to get it done",
        you: "Review it; add your own findings",
        app: "Runs deep research on YOUR goals — the prompt shows your words in it",
        feeds: { target: 3, clause: "the research output" },
        glimpse: "the research card — your inputs highlighted inside the real prompt",
      },
      {
        teach: "The plan gets fact-checked first",
        you: "Paste or run the audit",
        app: "Fact-checks the plan against reality before anything runs",
        feeds: { target: 4, clause: "audited findings" },
        glimpse: "the audit card + its output box",
      },
      {
        teach: "You approve every task — nothing runs itself",
        you: "Approve or reject each task",
        app: "Fuses research + audit into proposed tasks — then STOPS and waits for you",
        feeds: { target: 5, clause: "only what you approved" },
        glimpse: "the task preview with the approve gate",
      },
      {
        teach: "Approved tasks hit your calendar",
        you: "Commit tasks to time blocks",
        app: "Puts them on your calendar with a price tag",
        feeds: { target: 6, clause: "the live plan" },
        glimpse: "the live task list",
      },
      {
        teach: "Rerun with new goals anytime",
        you: "Add new goals, rerun",
        app: "Reruns the pipe; keeps every old plan in history — nothing deleted",
        feeds: { target: null, clause: "the next version" },
        glimpse: "the evolve card — \"new goals, loop again\"",
      },
    ],
  },
  content: {
    payoff: "Turn what you did today into a ready-to-film script.",
    steps: [
      {
        teach: "Your day is the raw material",
        you: "Live your day",
        app: "Pulls today's routines + tasks as the story inputs",
        feeds: { target: 2, clause: "what actually happened" },
        glimpse: "today's routines + tasks band",
      },
      {
        teach: "Scenes, planned from what you did",
        you: "Adjust the scenes",
        app: "Maps your day into scenes with camera notes",
        feeds: { target: 3, clause: "a shot plan" },
        glimpse: "scene rows + cameras",
      },
      {
        teach: "Answer prompts, film the takes",
        you: "Answer the questions, film",
        app: "Turns answers into takes tied to each scene",
        feeds: { target: 4, clause: "the raw takes" },
        glimpse: "the answer grid + take rows",
      },
      {
        teach: "A ready-to-read voiceover",
        you: "Read it to camera",
        app: "Writes the voiceover from YOUR answers — your words, organized",
        feeds: { target: null, clause: "the finished script" },
        glimpse: "the generated script view",
      },
    ],
  },
};
