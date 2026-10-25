/**
 * TextCell — THE TABLE IDIOM'S TEXT CELL, ONE FOR EVERY TABLE (COLUMNS-01, Alex, 2026-10-25, ruling D).
 *
 * Lifted from the journal tables (journal/JournalDayTable.tsx, JOURNAL-07 ruling E)
 * as it stood — every element, class, word and attribute, so the journal tables'
 * DOM is byte for byte what it was — and rendered by them and by PROJECTS' rows
 * (projects/ProjectTableRows.tsx, which carried a copy). The rule (lifted from the
 * journal tables to src/lib/table/preview.ts): the full text when it fits or when
 * opened; else its first 160 code points (previewOf), how many there are
 * ("… (n chars)"), and the control — "all of it" / "less". The opened state is the
 * caller's (one per cell, React state only). "—" for a blank cell (words.ts BLANK).
 * COLUMNS-01b (Alex, 2026-10-25, ruling 3): the rule is the idiom's own (src/lib/table/preview.ts) — no journal import here.
 */

'use client';

import { cellClass as cell } from './DataTable';
import { dataAttr } from './dataAttr';
import { BLANK } from '@/lib/table/words';
import { COLLAPSE_WORDS, EXPAND_WORDS, previewOf } from '@/lib/table/preview';

const BLANK_CLASS = 'text-text-faint';
const link = 'underline text-brand-purple hover:text-text-primary';

/** A TEXT cell: the full text when it fits or when opened; else its first 160 code points, how many there are, and the control. */
export default function TextCell({ name, column, text, open, onToggle }: { name: string; column: string; text: string | null; open: boolean; onToggle: () => void }) {
  if (text === null) return <td className={`${cell} ${BLANK_CLASS}`} {...dataAttr(name, 'cell', column)}>{BLANK}</td>;
  const preview = previewOf(text);
  return (
    <td className={`${cell} max-w-[24rem] whitespace-pre-line break-words`} {...dataAttr(name, 'cell', column)} {...dataAttr(name, 'cell-open', open ? '' : undefined)}>
      {open || preview.more === null ? text : preview.shown}
      {preview.more !== null && (
        <>
          {!open && <span className="text-text-faint"> {preview.more}</span>}
          {' '}
          <button type="button" className={link} onClick={onToggle} {...dataAttr(name, 'cell-toggle')}>{open ? COLLAPSE_WORDS : EXPAND_WORDS}</button>
        </>
      )}
    </td>
  );
}
