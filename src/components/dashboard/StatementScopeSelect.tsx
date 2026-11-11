'use client';

/**
 * BOOKS-01 (Alex, 2026-11-11 12:08: "get bookkeeping full proof") — THE ONE CONTROL: WHICH BOOK, WHICH YEAR.
 *
 * Financial Statements and the Export each read a route for a book and a year, and until this neither said which:
 * Financial Statements asked /api/statements with no year and no book; the Export was handed the current year and the
 * default book and printed the book as an id. Both panels mount THIS control and each keeps its own choice.
 * BooksPipeline hands them the books it already fetches, its default book and the years /api/statements lists — it
 * does not mount the control itself.
 *
 *   Book — each of the user's books by name, then "All books".
 *   Year — the years /api/statements lists plus the current year, each once, newest first.
 *
 * Both panels START on the default book and the current year — what the pipeline handed the Export before.
 *
 * The helpers are pure (no clock, no state); readScoped is the one fetch both panels make; the component holds no
 * state — the panel does.
 */
import { calendarDay } from '@/lib/plaid/failLoud';

/** A book as the selects name it — what /api/entities answers of one. */
export interface ScopeBook {
  readonly id: string;
  readonly name: string;
}

/** A panel's own choice: the book (null is all books) and the year. */
export interface ScopeChoice {
  readonly bookId: string | null;
  readonly year: number;
}

/** What the pipeline hands each panel: its books, its default book, the years /api/statements lists, the current year. */
export interface ScopeProps {
  readonly books: readonly ScopeBook[];
  readonly defaultBookId: string | null;
  readonly years: readonly number[];
  readonly currentYear: number;
}

/** What a statement over every book is called — on the select, the scope line, the Export's status bar and its CSVs. */
export const ALL_BOOKS_WORDS = 'All books';

/** Where both panels start: the default book and the current year. */
export const startingChoiceOf = (defaultBookId: string | null, currentYear: number): ScopeChoice => ({ bookId: defaultBookId, year: currentYear });

/** The Year select's options: the years /api/statements lists plus the current year — each once, newest first. */
export function yearOptionsOf(years: readonly number[], currentYear: number): number[] {
  return [...new Set([...years, currentYear])].sort((a, b) => b - a);
}

/** A book by its name; "All books" when the read was asked for none. */
export const bookWordsOf = (entityName: string | null): string => (entityName === null ? ALL_BOOKS_WORDS : entityName);

/** THE SCOPE LINE: `<book or All books> · <year>` — what a route says it read, never what a select was set to. */
export const scopeWordsOf = (scope: { readonly entityName: string | null; readonly year: number }): string =>
  `${bookWordsOf(scope.entityName)} · ${scope.year}`;

/** A statement's last day in words — '2026-12-31' → 'Dec 31, 2026' (the one day formatter). Not a calendar day → throws by name; nothing is guessed. */
export function throughWordsOf(through: unknown): string {
  const words = calendarDay(through);
  if (words === null) throw new Error(`statements: ${JSON.stringify(through)} is not a calendar day`);
  return words;
}

/** The query both routes take: year=<year>, and entityId=<book> when one is chosen — none for all books. */
export function scopeQueryOf(choice: ScopeChoice): string {
  const qs = new URLSearchParams({ year: String(choice.year) });
  if (choice.bookId !== null) qs.set('entityId', choice.bookId);
  return qs.toString();
}

/** What a failed answer prints: the route's own reason — and when it gave none, the status it answered with, by name. Never a blank. */
export function failedAnswerWords(route: string, status: number, body: unknown): string {
  const reason = (body as { error?: unknown } | null)?.error;
  return typeof reason === 'string' && reason !== '' ? reason : `${route} answered ${status} and gave no reason`;
}

/** The two routes the panels read — each takes the same query. */
export type ScopedRoute = '/api/statements' | '/api/cpa-export';

/**
 * THE READ both panels make: a route's JSON answer for a book and a year. An answer that is not JSON, or not OK,
 * throws the words the panel prints — it never comes back as an empty answer.
 */
export async function readScoped(route: ScopedRoute, choice: ScopeChoice): Promise<unknown> {
  const res = await fetch(`${route}?${scopeQueryOf(choice)}`);
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new Error(`${route} answered ${res.status} and its answer was not JSON`);
  }
  if (!res.ok) throw new Error(failedAnswerWords(route, res.status, body));
  return body;
}

interface StatementScopeSelectProps {
  readonly books: readonly ScopeBook[];
  readonly years: readonly number[];
  readonly currentYear: number;
  readonly choice: ScopeChoice;
  readonly onChange: (next: ScopeChoice) => void;
}

export default function StatementScopeSelect({ books, years, currentYear, choice, onChange }: StatementScopeSelectProps) {
  return (
    <div className="flex flex-wrap items-center gap-4" data-statement-scope>
      <label className="flex items-center gap-2 text-xs text-text-muted">
        Book
        <select
          value={choice.bookId === null ? '' : choice.bookId}
          onChange={(e) => onChange({ bookId: e.target.value === '' ? null : e.target.value, year: choice.year })}
          className="px-3 py-2 border rounded text-sm text-text-primary min-w-[160px]"
          data-scope-book
        >
          {books.map((book) => <option key={book.id} value={book.id}>{book.name}</option>)}
          <option value="">{ALL_BOOKS_WORDS}</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-xs text-text-muted">
        Year
        <select
          value={String(choice.year)}
          onChange={(e) => onChange({ bookId: choice.bookId, year: Number(e.target.value) })}
          className="px-3 py-2 border rounded text-sm text-text-primary"
          data-scope-year
        >
          {yearOptionsOf(years, currentYear).map((y) => <option key={y} value={String(y)}>{y}</option>)}
        </select>
      </label>
    </div>
  );
}
