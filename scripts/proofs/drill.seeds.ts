/**
 * The entry-source law's seeded regressions (DRILL-01, 2026-09-23).
 *
 * The law says one thing four ways: a book surface tells the customer where every
 * number came from, from the row rather than from a component's imagination.
 * These four seeds are its four clauses — each of them the shape the books had on
 * main db3a2ed6, put back:
 *
 *   · a surface stops reading the entry's source, so the line goes silent about
 *     where the number came from (clause 1);
 *   · a source_type nobody has words for is GUESSED at instead of rendered as
 *     itself (clause 2);
 *   · the coverage line is typed instead of counted from the rows shown (clause 3);
 *   · the pure mapping reaches for the clock (clause 4).
 *
 * Each must fail THE ENTRY-SOURCE LAW by name. The anchors occur exactly once in
 * their file, which the harness enforces before it runs anything.
 */
import type { Seed } from '../prove';

const LEDGER = 'src/components/dashboard/GeneralLedger.tsx';
const JOURNAL = 'src/components/dashboard/JournalEntryEngine.tsx';
const LEAF = 'src/lib/books/entrySource.ts';

export const SEEDS: Seed[] = [
  {
    name: 'drill-a the ledger stops reading the entry’s source (clause 1)',
    file: LEDGER,
    find: '                            entry={{ source_type: entry.source_type, source_id: entry.source_id, reverses_entry_id: entry.reverses_entry_id }}',
    replace: '                            entry={{}}',
    expect: 'does not read source_type, source_id and reverses_entry_id off its rows',
  },
  {
    name: 'drill-b a source_type nobody has words for is guessed at (clause 2)',
    file: LEAF,
    find: "    return { kind: 'unknown', type, words: type, id: entry.source_id ?? null };",
    replace: "    return { kind: 'unknown', type, words: 'a bank transaction', id: entry.source_id ?? null };",
    expect: 'it renders as itself, never as a guess',
  },
  {
    name: 'drill-c the coverage line is typed instead of counted (clause 3)',
    file: JOURNAL,
    find: '          <CoverageLine line={coverage.line} />',
    replace: "          <CoverageLine line={'12 of 12 entries carry their source.'} />",
    expect: 'the coverage line is counted from the rows shown',
  },
  {
    name: 'drill-d the pure mapping reaches for the clock (clause 4)',
    file: LEAF,
    find: 'export function sourceRuleFor(type: string): SourceRule | undefined {',
    replace: 'export function sourceRuleFor(type: string): SourceRule | undefined {\n  void Date.now();',
    expect: 'reads the clock',
  },
];

export default SEEDS;
