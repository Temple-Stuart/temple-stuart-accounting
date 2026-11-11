'use client';

/**
 * PENDING-02 (Alex, 2026-11-11) — THE POSTINGS WHOSE BANK ROW IS GONE, at the top of the General Ledger.
 *
 * Mounted ONCE, as the first thing GeneralLedger draws (src/components/dashboard/GeneralLedger.tsx), above its book
 * tabs. It reads GET /api/journal-entries/no-bank-row when it mounts:
 *   · none            → it draws NOTHING — no heading, no zero, no empty table;
 *   · some            → the count line with their sum, the one line that says what they are, and a button that
 *                       opens them as a table: Date · Description · Debit · Credit · Amount · Book;
 *   · the read failed → the route's own reason, in red — never an empty list in its place.
 *
 * IT TYPES NO WORD: every string comes from src/lib/books/postingsWithNoBankRow.ts. A day prints through the one day
 * formatter (src/lib/plaid/failLoud.ts calendarDay) and a day it will not print is a fault by name; every figure is
 * integer cents printed through functionalMoneyWords, beside the unit line its siblings carry.
 *
 * TWO PIECES: NoBankRowView draws what it is handed and holds no state; the default export reads the route and holds
 * the state — React state only, nothing kept in the browser.
 */
import { useEffect, useState, type ReactElement } from 'react';
import { failedAnswerWords } from '@/components/dashboard/StatementScopeSelect';
import { FUNCTIONAL_CURRENCY_WORDS, functionalMoneyWords } from '@/lib/books/functionalCurrency';
import {
  COLUMN_WORDS, HIDE_WORDS, NO_BANK_ROW_ROUTE, SHOW_WORDS, WHAT_THEY_ARE_WORDS,
  countWords, noBankRowAnswerFrom, notADayWords, notJsonWords,
  type LineAccount, type NoBankRowAnswer, type PostingWithNoBankRow,
} from '@/lib/books/postingsWithNoBankRow';
import { calendarDay } from '@/lib/plaid/failLoud';

export interface PostingsWithNoBankRowProps {
  /** GeneralLedger's own reload. PENDING-02 part 2 calls it once a reversal has posted; this part only lists. */
  readonly onReload: () => void;
}

/** What the read has come to: still reading, failed with the route's reason, or read. */
export type NoBankRowRead =
  | { readonly state: 'reading' }
  | { readonly state: 'failed'; readonly reason: string }
  | { readonly state: 'read'; readonly answer: NoBankRowAnswer };

/** A posting's day in words, through the one day formatter — or a fault by name. */
function dayWords(posting: PostingWithNoBankRow): string {
  const words = calendarDay(posting.day);
  if (words === null) throw new Error(notADayWords(posting.id, posting.day));
  return words;
}

/** THE READ: the route's answer with every field checked and every day printable — or a throw carrying the reason. */
export async function readNoBankRow(): Promise<NoBankRowAnswer> {
  const res = await fetch(NO_BANK_ROW_ROUTE);
  let body: unknown;
  try { body = await res.json(); } catch { throw new Error(notJsonWords(res.status)); }
  if (!res.ok) throw new Error(failedAnswerWords(NO_BANK_ROW_ROUTE, res.status, body));
  const answer = noBankRowAnswerFrom(body);
  for (const posting of answer.postings) dayWords(posting);
  return answer;
}

const reasonOf = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/** One side's accounts, a line each: the code, then the name — as the ledger's own account list prints them. */
function Accounts({ accounts }: { readonly accounts: readonly LineAccount[] }) {
  return (
    <>
      {accounts.map((account, i) => (
        <div key={`${account.code}-${i}`}>
          <span className="font-medium">{account.code}</span>{' '}
          <span className="text-text-secondary">- {account.name}</span>
        </div>
      ))}
    </>
  );
}

/** The six columns, in the leaf's order — the heads below and each row's cells follow it. */
const [DATE, DESCRIPTION, DEBIT, CREDIT, AMOUNT, BOOK] = COLUMN_WORDS;
const HEAD = 'text-terminal-xs uppercase tracking-widest font-mono py-1 px-2';
const BUTTON = 'h-7 px-2 text-terminal-base font-mono border border-border rounded bg-white hover:bg-bg-row';

export interface NoBankRowViewProps {
  readonly read: NoBankRowRead;
  /** Whether the table is open. */
  readonly open: boolean;
  readonly onToggle: () => void;
}

/** WHAT IS DRAWN, from what it is handed — no state, no fetch. */
export function NoBankRowView({ read, open, onToggle }: NoBankRowViewProps): ReactElement | null {
  if (read.state === 'reading') return null;
  if (read.state === 'failed') {
    return (
      <div className="border-b border-border px-3 py-2 text-terminal-sm text-brand-red bg-red-50" role="alert" data-no-bank-row-failed>
        {read.reason}
      </div>
    );
  }
  const { answer } = read;
  // None: nothing is drawn.
  if (answer.count === 0) return null;

  return (
    <section className="border-b border-border bg-bg-row px-3 py-2 text-terminal-base" data-no-bank-row={answer.count}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-semibold" data-no-bank-row-count>{countWords(answer.count)}</span>
        <span className="font-mono tabular-nums" data-no-bank-row-sum>{functionalMoneyWords(answer.sumCents)}</span>
        <span className="text-[10px] text-text-muted" data-functional-currency>{FUNCTIONAL_CURRENCY_WORDS}</span>
        <button type="button" onClick={onToggle} aria-expanded={open} className={`${BUTTON} ml-auto`} data-no-bank-row-toggle>
          {open ? HIDE_WORDS : SHOW_WORDS}
        </button>
      </div>
      <p className="mt-1 text-text-secondary" data-no-bank-row-what>{WHAT_THEY_ARE_WORDS}</p>

      {open && (
        <div className="mt-2 overflow-x-auto border border-border bg-white">
          <table className="w-full text-terminal-base min-w-[700px]" data-no-bank-row-table>
            <thead>
              <tr className="bg-gray-50 text-text-secondary">
                <th className={`${HEAD} text-left`}>{DATE}</th>
                <th className={`${HEAD} text-left`}>{DESCRIPTION}</th>
                <th className={`${HEAD} text-left`}>{DEBIT}</th>
                <th className={`${HEAD} text-left`}>{CREDIT}</th>
                <th className={`${HEAD} text-right`}>{AMOUNT}</th>
                <th className={`${HEAD} text-left`}>{BOOK}</th>
              </tr>
            </thead>
            <tbody>
              {answer.postings.map((posting, i) => (
                <tr key={posting.id} className={i % 2 === 0 ? 'bg-white' : 'bg-bg-row'} data-no-bank-row-entry={posting.id}>
                  <td className="py-1 px-2 whitespace-nowrap align-top">{dayWords(posting)}</td>
                  <td className="py-1 px-2 align-top">{posting.description}</td>
                  <td className="py-1 px-2 align-top"><Accounts accounts={posting.debits} /></td>
                  <td className="py-1 px-2 align-top"><Accounts accounts={posting.credits} /></td>
                  <td className="py-1 px-2 text-right font-mono tabular-nums align-top">{functionalMoneyWords(posting.cents)}</td>
                  <td className="py-1 px-2 text-text-muted align-top">{posting.book}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** THE PANEL: it reads the route once, when it mounts, and draws the view over what came back. */
const PostingsWithNoBankRow: (props: PostingsWithNoBankRowProps) => ReactElement | null = () => {
  const [read, setRead] = useState<NoBankRowRead>({ state: 'reading' });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    readNoBankRow().then(
      (answer) => { if (alive) setRead({ state: 'read', answer }); },
      (err: unknown) => { if (alive) setRead({ state: 'failed', reason: reasonOf(err) }); },
    );
    return () => { alive = false; };
  }, []);

  return <NoBankRowView read={read} open={open} onToggle={() => setOpen((was) => !was)} />;
};

export default PostingsWithNoBankRow;
