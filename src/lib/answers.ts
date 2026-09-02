/**
 * NAV-01c — THE ANSWERS. The deck's step-11 constants, moved out of
 * Landing.tsx into a shared LEAF (the PROBLEM_SHEET precedent, NAV-01a — zero
 * imports, server- and client-safe): ONE source for the four questions, their
 * math lines, and the lines each answer reads. The deck renders them
 * (Landing.tsx), the app's front page renders them (/answers), and the
 * build-time law reads them (scripts/assert-tool-registry.ts). The two literals
 * are byte-identical to the deck's; never a retyped second copy.
 *
 * ANSWER_READS (below) is NAV-01c's own fact table: per question, whether a
 * COMPUTATION EXISTS in the code today and, when it does, the SOURCE LINE — one
 * clause from the NAV-01c audit — the card prints beside its number. THE LAW
 * (module scope, the deck's LAYOUT LAW idiom; re-run at build by the assert):
 *   1. ANSWER_READS keys === ANSWER_ROWS questions, 4/4, in order;
 *   2. a computed read declares a non-empty source, an /api endpoint, a
 *      file:line citation, and a home — a card with a number and no source
 *      FAILS THE BUILD;
 *   3. an un-computed read carries the deck's honest words and reads nothing.
 */

// DECK-11: four questions and their math, the math pre-split so the deck's
// money words ink gold. Row 3 has no money word and that is the deck's own
// shape, not an omission.
export const ANSWER_ROWS: ReadonlyArray<readonly [string, ReadonlyArray<readonly [string, boolean]>]> = [
  ['What do I owe in tax?', [['Income', true], [' so far × the rules.', false]]],
  ['How long can I last?', [['Cash', true], [' ÷ what I burn each month.', false]]],
  ['How is my trading doing?', [['Wins, losses, and open risk; from fills, positions, and live quotes.', false]]],
  ['How is my business doing?', [['Money in', true], [' minus ', false], ['money out', true], ['.', false]]],
];

// S11-INPUTS (PR-S11-DATAFLOW): the lines each answer reads, keyed by
// the answer's question, in ANSWER_ROWS order — Alex's product logic; he
// tunes on Preview. Accounts are verbatim POSTING_RULES debit/credit
// strings; feeds are verbatim ROUTING_RULES provider+resource pairs; the
// S11_LAYOUT law throws on anything that resolves to neither. A line
// under more than one answer is CORRECT — same line, many lenses; it
// renders once per group. NOTE: the ruling named a tastytrade position
// feed, which ROUTING_RULES does not carry (tastytrade has only quote);
// plaid holding is the rule book's positions feed (SNAPSHOT — how things
// stood at one moment), so it rides here and the kept math's 'fills,
// positions, and live quotes' stays drawn 3-for-3.
export const ANSWER_INPUTS: Readonly<Record<string, readonly string[]>> = {
  'What do I owe in tax?': ['Revenue', 'Expense', 'Wages + employer taxes', 'irs bulletin', 'us code title'],
  'How long can I last?': ['Cash', 'Expense', 'Travel', 'Wages + employer taxes', 'A/P'],
  'How is my trading doing?': ['Investments', 'plaid holding', 'tastytrade quote'],
  'How is my business doing?': ['Revenue', 'Expense', 'Travel', 'Wages + employer taxes', 'Filing Fees'],
};

/** The app's front page — the post-login front door (NAV-01c). */
export const ANSWERS_HOME = '/answers';

/** A lens whose computation EXISTS in the code today: the card reads `endpoint` and prints the number WITH `source`. */
export interface ComputedRead {
  computed: true;
  /** The user-scoped route the card reads (cookie-gated in the route; a failed read prints its status, never a number). */
  endpoint: string;
  /** ONE clause — where the number comes from, from the NAV-01c audit. Printed beside the number. */
  source: string;
  /** file:line of the computation (the NAV-01c audit). */
  citation: string;
  /** Where the lens lives — the card's door. */
  home: string;
}

/** A lens with NO computation in the code: the card prints the deck's honest words — no number, no placeholder. */
export interface HonestRead {
  computed: false;
  /** The honest state in the deck's words (Landing.tsx, step 11). */
  honest: string;
}

export type AnswerRead = ComputedRead | HonestRead;

/**
 * The four reads, keyed by the question, in ANSWER_ROWS order. Every source
 * line is one clause from the NAV-01c audit of the route it names; the
 * citation is the computation's file:line on main at the audit.
 */
export const ANSWER_READS: Readonly<Record<string, AnswerRead>> = {
  'What do I owe in tax?': {
    computed: true,
    endpoint: '/api/tax/calculate',
    source: 'from the ledger entries you committed for the tax year on your sole-prop accounts, plus the tax documents you entered — Form 1040 line by line',
    citation: 'src/app/api/tax/calculate/route.ts:63 (tax_documents) · :101-107 (ledger_entries per Schedule C account, entity sole_prop) · src/lib/form-1040-service.ts:508 (totalTax) · :532 (amountOwed)',
    home: '/tax',
  },
  'How long can I last?': {
    computed: true,
    endpoint: '/api/runway',
    source: 'cash from the account balances Plaid last synced (operating accounts, trading excluded), divided by the net burn from the ledger entries you committed over the trailing full months',
    citation: 'src/app/api/runway/route.ts:101-104 (SUM accounts.currentBalance) · :150-160 (expense debits and revenue credits from ledger_entries) · :200-212 (state, runway months, zero date)',
    home: '/runway',
  },
  'How is my trading doing?': {
    computed: true,
    endpoint: '/api/positions/summary',
    source: 'realized wins and losses from the trades you committed (stored option positions and stock lots); open positions are counted, not priced — no live quote in this read',
    citation: 'src/app/api/positions/summary/route.ts:31-41 (trading_positions) · :44-68 (stock_lots + dispositions) · :182-199 (summary)',
    home: '/trade',
  },
  'How is my business doing?': {
    computed: true,
    endpoint: '/api/statements',
    source: 'revenue minus expense over the journal entries you committed this year on your sole-prop entity — the statements read, per account',
    citation: 'src/app/api/entities/route.ts:19-23 (entity_type) · src/app/api/statements/route.ts:53-71 (ledger_entries × journal_entries × chart_of_accounts, per year and entity)',
    home: '/books',
  },
};

/** Net worth — a READ below the four (NAV-01c), its /net-worth source stated the same way. */
export const NET_WORTH_READ: ComputedRead = {
  computed: true,
  endpoint: '/api/net-worth',
  source: 'assets minus debt, each the sum of your Plaid-synced transactions by chart-of-accounts code (personal entity) — not account balances, not ledger entries',
  citation: 'src/app/api/net-worth/route.ts:33-40 (chart_of_accounts modules assets / debt / equity) · :45-56 (transactions summed by accountCode) · :73-85 (totals)',
  home: '/net-worth',
};

/** THE LAW. Throws on the first violation; returns the violations list when asked not to throw. Rows / reads are injectable for tests. */
export function answersLaw(opts: {
  throwOnFail?: boolean;
  rows?: typeof ANSWER_ROWS;
  reads?: Readonly<Record<string, AnswerRead>>;
  netWorth?: AnswerRead;
} = {}): string[] {
  const rows = opts.rows ?? ANSWER_ROWS;
  const reads = opts.reads ?? ANSWER_READS;
  const violations: string[] = [];
  const questions = rows.map(([q]) => q);
  const keys = Object.keys(reads);
  if (questions.length !== 4) violations.push(`ANSWER_ROWS has ${questions.length} questions, expected 4`);
  if (keys.length !== questions.length || keys.some((k, i) => k !== questions[i])) {
    violations.push(`ANSWER_READS keys must equal ANSWER_ROWS questions 4/4 in order — got [${keys.join(' | ')}]`);
  }
  for (const [q, segs] of rows) {
    if (segs.length === 0 || segs.some(([text]) => text.length === 0)) violations.push(`"${q}": the math line must not be empty`);
  }
  const check = (label: string, r: AnswerRead) => {
    if (r.computed) {
      if (r.source.trim() === '') violations.push(`${label}: a card with a number must declare its source line`);
      if (!r.endpoint.startsWith('/api/')) violations.push(`${label}: endpoint "${r.endpoint}" is not an /api route`);
      if (r.citation.trim() === '') violations.push(`${label}: a computed read must cite its file:line`);
      if (!r.home.startsWith('/')) violations.push(`${label}: home "${r.home}" is not a route`);
    } else {
      if (r.honest.trim() === '') violations.push(`${label}: an un-computed card must carry the deck's honest words`);
      if ('endpoint' in r || 'source' in r) violations.push(`${label}: an un-computed card reads nothing and prints no source`);
    }
  };
  for (const q of questions) if (q in reads) check(`"${q}"`, reads[q]);
  check('Net worth', opts.netWorth ?? NET_WORTH_READ);
  if (violations.length && opts.throwOnFail !== false) {
    throw new Error(`THE ANSWERS LAW failed:\n  ${violations.join('\n  ')}`);
  }
  return violations;
}

answersLaw();
