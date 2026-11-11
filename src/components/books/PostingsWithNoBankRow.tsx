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
 * THE REVERSAL. A tick box on each row and one for all; `Reverse <n>` for the ticked rows. That first press sends
 * NOTHING — it shows the one question, with `Reverse <n>` and `Cancel`. The second press sends the ticked ids to the
 * route's POST in slices of 25, one request at a time, and stops at the first request that is not OK, printing its
 * reason. Then the result line, each refusal beside its row's description, the list read again, and
 * `Refresh the books`, which calls GeneralLedger's own onReload — the result stays on screen until that press. While
 * a press is running the buttons and the boxes stand down. Nothing is deleted or edited: each ticked posting gets a
 * reversing entry, through the one reversal writer.
 *
 * IT TYPES NO WORD: every string comes from src/lib/books/postingsWithNoBankRow.ts. A day prints through the one day
 * formatter (src/lib/plaid/failLoud.ts calendarDay) and a day it will not print is a fault by name; every figure is
 * integer cents printed through functionalMoneyWords, beside the unit line its siblings carry.
 *
 * TWO PIECES: NoBankRowView draws what it is handed and holds no state; the default export reads, sends, and holds
 * the state — React state only, nothing kept in the browser.
 */
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { failedAnswerWords } from '@/components/dashboard/StatementScopeSelect';
import { FUNCTIONAL_CURRENCY_WORDS, functionalMoneyWords } from '@/lib/books/functionalCurrency';
import {
  CANCEL_WORDS, COLUMN_WORDS, HIDE_WORDS, NO_BANK_ROW_ROUTE, REFRESH_WORDS, SHOW_WORDS, TICK_ALL_WORDS, WHAT_THEY_ARE_WORDS,
  countWords, noBankRowAnswerFrom, notADayWords, notAllAnsweredWords, notAskedWords, notJsonWords, questionWords, resultWords,
  reversalAnswerFrom, reverseWords, slicesOf,
  type LineAccount, type NoBankRowAnswer, type PostingWithNoBankRow, type ReversalRefusal,
} from '@/lib/books/postingsWithNoBankRow';
import { calendarDay } from '@/lib/plaid/failLoud';

export interface PostingsWithNoBankRowProps {
  /** GeneralLedger's own reload — `Refresh the books` calls it, once a reversal has been run. */
  readonly onReload: () => void;
}

/** What the read has come to: still reading, failed with the route's reason, or read. */
export type NoBankRowRead =
  | { readonly state: 'reading' }
  | { readonly state: 'failed'; readonly reason: string }
  | { readonly state: 'read'; readonly answer: NoBankRowAnswer };

/** One entry a request did not reverse: the route's words, beside the row's own description. */
export interface ShownRefusal extends ReversalRefusal {
  readonly description: string;
}

/** What one press of the second `Reverse <n>` came to. */
export interface ReversalOutcome {
  /** How many were ticked, and how many of them the route reversed. */
  readonly asked: number;
  readonly reversed: number;
  readonly refusals: readonly ShownRefusal[];
  /** The reason of the first request that was not OK — no request was sent after it. Null when every one was. */
  readonly stopped: string | null;
}

/** A posting's day in words, through the one day formatter — or a fault by name. */
function dayWords(posting: PostingWithNoBankRow): string {
  const words = calendarDay(posting.day);
  if (words === null) throw new Error(notADayWords(posting.id, posting.day));
  return words;
}

const reasonOf = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/** One request's answer as JSON, or a throw carrying the route's own reason. */
async function answerOf(res: Response): Promise<unknown> {
  let body: unknown;
  try { body = await res.json(); } catch { throw new Error(notJsonWords(res.status)); }
  if (!res.ok) throw new Error(failedAnswerWords(NO_BANK_ROW_ROUTE, res.status, body));
  return body;
}

/** THE READ: the route's answer with every field checked and every day printable — or a throw carrying the reason. */
export async function readNoBankRow(): Promise<NoBankRowAnswer> {
  const answer = noBankRowAnswerFrom(await answerOf(await fetch(NO_BANK_ROW_ROUTE)));
  for (const posting of answer.postings) dayWords(posting);
  return answer;
}

/**
 * THE SEND: the ticked postings' ids to the route's POST, in slices of 25, ONE REQUEST AT A TIME — each is awaited
 * before the next is sent. It stops at the first request that is not OK (or whose answer does not account for what
 * was asked) and reports that reason; what the earlier requests reversed is counted as it stands.
 */
export async function sendReversals(ticked: readonly PostingWithNoBankRow[]): Promise<ReversalOutcome> {
  const descriptionOf = new Map(ticked.map((posting) => [posting.id, posting.description]));
  const refusals: ShownRefusal[] = [];
  let reversed = 0;
  for (const slice of slicesOf(ticked.map((posting) => posting.id))) {
    try {
      const res = await fetch(NO_BANK_ROW_ROUTE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entryIds: slice }) });
      const answer = reversalAnswerFrom(await answerOf(res));
      reversed += answer.reversed;
      for (const refusal of answer.errors) {
        const description = descriptionOf.get(refusal.entryId);
        if (description === undefined) throw new Error(notAskedWords(refusal.entryId));
        refusals.push({ ...refusal, description });
      }
      if (answer.reversed + answer.errorCount !== slice.length) throw new Error(notAllAnsweredWords(answer.reversed + answer.errorCount, slice.length));
    } catch (err) {
      return { asked: ticked.length, reversed, refusals, stopped: reasonOf(err) };
    }
  }
  return { asked: ticked.length, reversed, refusals, stopped: null };
}

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
const BUTTON = 'h-7 px-2 text-terminal-base font-mono border border-border rounded bg-white hover:bg-bg-row disabled:opacity-50 disabled:cursor-not-allowed';
const FAILED = 'text-terminal-sm text-brand-red bg-red-50';

export interface NoBankRowViewProps {
  readonly read: NoBankRowRead;
  /** Whether the table is open. */
  readonly open: boolean;
  /** The ticked entry ids. */
  readonly ticked: ReadonlySet<string>;
  /** Whether the one question is on screen — after the first press of `Reverse <n>`, before the second. */
  readonly asking: boolean;
  /** Whether a press is running: every button and box stands down. */
  readonly running: boolean;
  /** What the last press came to — on screen until `Refresh the books`. */
  readonly outcome: ReversalOutcome | null;
  readonly onToggle: () => void;
  readonly onTick: (entryId: string) => void;
  readonly onTickAll: () => void;
  /** The first press: it asks, and sends nothing. */
  readonly onAsk: () => void;
  readonly onCancel: () => void;
  /** The second press: it sends. */
  readonly onConfirm: () => void;
  readonly onRefresh: () => void;
}

/** WHAT IS DRAWN, from what it is handed — no state, no fetch. */
export function NoBankRowView({ read, open, ticked, asking, running, outcome, onToggle, onTick, onTickAll, onAsk, onCancel, onConfirm, onRefresh }: NoBankRowViewProps): ReactElement | null {
  if (outcome === null) {
    if (read.state === 'reading') return null;
    if (read.state === 'failed') {
      return (
        <div className={`border-b border-border px-3 py-2 ${FAILED}`} role="alert" data-no-bank-row-failed>
          {read.reason}
        </div>
      );
    }
    // None: nothing is drawn.
    if (read.answer.count === 0) return null;
  }
  const answer = read.state === 'read' && read.answer.count > 0 ? read.answer : null;
  const tickedCount = answer === null ? 0 : answer.postings.filter((posting) => ticked.has(posting.id)).length;

  return (
    <section className="border-b border-border bg-bg-row px-3 py-2 text-terminal-base" data-no-bank-row={answer === null ? 0 : answer.count}>
      {outcome !== null && (
        <div className="mb-1 border border-border bg-white px-2 py-1" data-no-bank-row-result>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-semibold" data-no-bank-row-result-line>{resultWords(outcome.reversed, outcome.asked)}</span>
            <button type="button" onClick={onRefresh} disabled={running} className={`${BUTTON} ml-auto`} data-no-bank-row-refresh>
              {REFRESH_WORDS}
            </button>
          </div>
          {outcome.stopped !== null && (
            <div className={`mt-1 px-1 ${FAILED}`} role="alert" data-no-bank-row-stopped>{outcome.stopped}</div>
          )}
          {outcome.refusals.length > 0 && (
            <ul className="mt-1" data-no-bank-row-refusals>
              {outcome.refusals.map((refusal) => (
                <li key={refusal.entryId} className="flex flex-wrap gap-x-2" data-no-bank-row-refusal={refusal.entryId}>
                  <span>{refusal.description}</span>
                  <span className="text-brand-red">{refusal.error}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {read.state === 'failed' && (
        <div className={`px-1 ${FAILED}`} role="alert" data-no-bank-row-failed>{read.reason}</div>
      )}

      {answer !== null && (
        <>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-semibold" data-no-bank-row-count>{countWords(answer.count)}</span>
            <span className="font-mono tabular-nums" data-no-bank-row-sum>{functionalMoneyWords(answer.sumCents)}</span>
            <span className="text-[10px] text-text-muted" data-functional-currency>{FUNCTIONAL_CURRENCY_WORDS}</span>
            <button type="button" onClick={onToggle} disabled={running} aria-expanded={open} className={`${BUTTON} ml-auto`} data-no-bank-row-toggle>
              {open ? HIDE_WORDS : SHOW_WORDS}
            </button>
          </div>
          <p className="mt-1 text-text-secondary" data-no-bank-row-what>{WHAT_THEY_ARE_WORDS}</p>

          {open && (
            <div className="mt-2 border border-border bg-white">
              <div className="flex flex-wrap items-center gap-2 border-b border-border px-2 py-1" data-no-bank-row-reverse>
                {asking ? (
                  <>
                    <span data-no-bank-row-question>{questionWords(tickedCount)}</span>
                    <button type="button" onClick={onConfirm} disabled={running || tickedCount === 0} className={BUTTON} data-no-bank-row-confirm>
                      {reverseWords(tickedCount)}
                    </button>
                    <button type="button" onClick={onCancel} disabled={running} className={BUTTON} data-no-bank-row-cancel>
                      {CANCEL_WORDS}
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={onAsk} disabled={running || tickedCount === 0} className={BUTTON} data-no-bank-row-ask>
                    {reverseWords(tickedCount)}
                  </button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-terminal-base min-w-[700px]" data-no-bank-row-table>
                  <thead>
                    <tr className="bg-gray-50 text-text-secondary">
                      <th className={`${HEAD} w-8 text-left`}>
                        <input type="checkbox" aria-label={TICK_ALL_WORDS} checked={tickedCount === answer.count} onChange={onTickAll} disabled={running} data-no-bank-row-tick-all />
                      </th>
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
                        <td className="py-1 px-2 align-top">
                          <input type="checkbox" aria-label={posting.description} checked={ticked.has(posting.id)} onChange={() => onTick(posting.id)} disabled={running} data-no-bank-row-tick={posting.id} />
                        </td>
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
            </div>
          )}
        </>
      )}
    </section>
  );
}

/** THE PANEL: it reads the route when it mounts and again after a send, and draws the view over what it holds. */
export default function PostingsWithNoBankRow({ onReload }: PostingsWithNoBankRowProps): ReactElement | null {
  const [read, setRead] = useState<NoBankRowRead>({ state: 'reading' });
  const [open, setOpen] = useState(false);
  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set());
  const [asking, setAsking] = useState(false);
  const [running, setRunning] = useState(false);
  const [outcome, setOutcome] = useState<ReversalOutcome | null>(null);
  const alive = useRef(true);

  /** Its own list, read (again): what came back, or the reason it did not. */
  const load = useCallback((): Promise<void> => readNoBankRow().then(
    (answer) => { if (alive.current) setRead({ state: 'read', answer }); },
    (err: unknown) => { if (alive.current) setRead({ state: 'failed', reason: reasonOf(err) }); },
  ), []);

  useEffect(() => {
    alive.current = true;
    void load();
    return () => { alive.current = false; };
  }, [load]);

  const postings = read.state === 'read' ? read.answer.postings : [];

  const tick = (entryId: string): void => {
    setAsking(false);
    setTicked((was) => {
      const next = new Set(was);
      if (!next.delete(entryId)) next.add(entryId);
      return next;
    });
  };

  const tickAll = (): void => {
    setAsking(false);
    setTicked((was) => (postings.length > 0 && postings.every((posting) => was.has(posting.id)) ? new Set() : new Set(postings.map((posting) => posting.id))));
  };

  /** THE SECOND PRESS — the only place anything is sent. Then the result, the ticks cleared, and the list read again. */
  const confirm = (): void => {
    const sending = postings.filter((posting) => ticked.has(posting.id));
    if (running || !asking || sending.length === 0) return;
    setAsking(false);
    setRunning(true);
    void sendReversals(sending)
      .then((sent) => {
        if (!alive.current) return undefined;
        setOutcome(sent);
        setTicked(new Set());
        return load();
      })
      .finally(() => { if (alive.current) setRunning(false); });
  };

  return (
    <NoBankRowView
      read={read}
      open={open}
      ticked={ticked}
      asking={asking}
      running={running}
      outcome={outcome}
      onToggle={() => setOpen((was) => !was)}
      onTick={tick}
      onTickAll={tickAll}
      onAsk={() => setAsking(true)}
      onCancel={() => setAsking(false)}
      onConfirm={confirm}
      onRefresh={() => { setOutcome(null); onReload(); }}
    />
  );
}
