'use client';

/**
 * DRILL-01 (2026-09-23) — WHERE IT CAME FROM, on the line.
 *
 * One cell for both book surfaces (JournalEntryEngine and GeneralLedger): it says
 * in the customer's words where an entry came from, and — for the one kind whose
 * row this ruling reads, the bank transaction — opens it.
 *
 * It types NO source word and NO field name: every string comes from
 * src/lib/books/entrySource.ts, which maps a source_type to its words. A
 * source_type the leaf does not know renders as ITSELF. An entry with no
 * source_type says "no source recorded for this entry". Nothing is ever blank
 * and nothing is ever invented.
 *
 * The open is one authed GET of /api/journal-entries/<id>/source, whose answer is
 * either the row's stated facts or the plain fact that the row is gone. A null
 * column is DROPPED by statedFacts() — never rendered as 0, "" or "Unknown".
 *
 * PAINT (REPAINT-04): cream/white/lavender/aubergine, the ds.ts vocabulary. No
 * white ink on cream.
 *
 * POST-01 (2026-09-26): THE DOCUMENT. A posting that documents a booking says so
 * under its source — the words come from the leaf's one rule, documentOf(); this
 * cell types none of them. NULL renders nothing.
 */

import { useEffect, useState } from 'react';
import { documentOf, entrySourceOf, statedFacts, type EntryDocument, type EntrySource, type SourceAnswer, type SourcedEntry } from '@/lib/books/entrySource';

type Loaded = { state: 'idle' } | { state: 'loading' } | { state: 'error'; message: string } | { state: 'done'; answer: SourceAnswer };

/**
 * THE WORDS ALONE — no state, no fetch. `onOpen` is given by a surface that
 * places the panel itself (the ledger's rows are virtualized at a fixed height,
 * so its panel lives under the table); without it the words are not a button.
 */
export function EntrySourceWords({ entryId, entry, onOpen, opened = false, compact = false }: {
  /** The journal entry's own id: the browser names an ENTRY, never a transaction. */
  entryId: string;
  entry: SourcedEntry;
  onOpen?: (entryId: string) => void;
  opened?: boolean;
  compact?: boolean;
}) {
  const source: EntrySource = entrySourceOf(entry);
  const document: EntryDocument = documentOf(entry);
  return (
    <div className={compact ? 'text-[11px]' : 'text-xs'} data-entry-source={source.kind} data-entry-source-type={'type' in source ? source.type : ''}>
      {source.kind === 'opens' && onOpen ? (
        <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(entryId); }} aria-expanded={opened}
          className="text-left text-brand-purple underline decoration-dotted underline-offset-2 hover:text-brand-purple-hover"
          data-entry-source-open={entryId}>
          {source.words} <span className="font-mono text-text-faint">{source.id}</span>
        </button>
      ) : source.kind === 'opens' ? (
        <span className="text-text-secondary" data-entry-source-words>
          {source.words} <span className="font-mono text-text-faint">{source.id}</span>
        </span>
      ) : source.kind === 'entry' ? (
        <span className="text-text-secondary" data-entry-source-words>
          {source.words}
          {source.entryId
            ? <> of <span className="font-mono text-text-faint">{source.entryId}</span></>
            : <> — the entry it reverses is not named on this row</>}
        </span>
      ) : source.kind === 'stated' ? (
        <span className="text-text-secondary" data-entry-source-words>
          {source.words}
          {source.id && <> · <span className="font-mono text-text-faint">{source.id}</span></>}
        </span>
      ) : source.kind === 'unknown' ? (
        <span className="text-text-secondary" data-entry-source-words>
          {/* The database's own word, rendered as itself — naming it anything else would invent a source. */}
          <span className="font-mono">{source.words}</span>
          {source.id && <> · <span className="font-mono text-text-faint">{source.id}</span></>}
        </span>
      ) : (
        <span className="text-text-faint" data-entry-source-words>{source.words}</span>
      )}
      {document.kind !== 'none' && (
        <div className="text-text-secondary" data-entry-document={document.kind} data-entry-document-reservation={document.reservationId}>
          {document.words}
        </div>
      )}
    </div>
  );
}

/**
 * THE OPENED SOURCE — one authed GET of /api/journal-entries/<id>/source, whose
 * answer is either the row's stated facts or the plain fact that the row is gone.
 * A null column is DROPPED by statedFacts(): never 0, never "", never "Unknown".
 */
export function EntrySourcePanel({ entryId }: { entryId: string }) {
  const [loaded, setLoaded] = useState<Loaded>({ state: 'idle' });

  useEffect(() => {
    let alive = true;
    setLoaded({ state: 'loading' });
    (async () => {
      try {
        const res = await fetch(`/api/journal-entries/${encodeURIComponent(entryId)}/source`);
        if (!res.ok) throw new Error(`the source read answered ${res.status}`);
        const answer = (await res.json()) as SourceAnswer;
        if (alive) setLoaded({ state: 'done', answer });
      } catch (err) {
        // Fail loud: the reason is shown, nothing is substituted for the row.
        if (alive) setLoaded({ state: 'error', message: err instanceof Error ? err.message : 'the source could not be read' });
      }
    })();
    return () => { alive = false; };
  }, [entryId]);

  return (
    <div className="mt-1 rounded border border-border bg-white p-2 text-xs" data-entry-source-panel={entryId}>
      {(loaded.state === 'idle' || loaded.state === 'loading') && <span className="text-text-faint">reading the transaction…</span>}
      {loaded.state === 'error' && <span className="text-brand-red" role="alert" data-entry-source-error>{loaded.message}</span>}
      {loaded.state === 'done' && (loaded.answer.found ? (
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5" data-entry-source-facts>
          {statedFacts(loaded.answer.transaction).map((f) => (
            <div key={f.label} className="contents" data-entry-source-fact={f.label}>
              <dt className="font-mono text-[10px] uppercase tracking-wider text-text-faint">{f.label}</dt>
              <dd className="text-text-primary">{f.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <span className="text-text-secondary" data-entry-source-absent>{loaded.answer.reason}</span>
      ))}
    </div>
  );
}

/** Words plus the panel, inline — the journal's expanded row places it this way. */
export default function EntrySourceCell({ entryId, entry }: { entryId: string; entry: SourcedEntry }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <EntrySourceWords entryId={entryId} entry={entry} opened={open} onOpen={() => setOpen((o) => !o)} />
      {open && <EntrySourcePanel entryId={entryId} />}
    </>
  );
}

/** The coverage line, stated over the rows actually shown. The caller derives it with coverageOf(). */
export function CoverageLine({ line }: { line: string }) {
  return <p className="font-mono text-[10px] uppercase tracking-wider text-text-faint" data-source-coverage>{line}</p>;
}
