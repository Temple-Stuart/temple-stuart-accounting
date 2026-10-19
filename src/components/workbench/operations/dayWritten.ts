/**
 * dayWritten — ONE SIGNAL between the Tasks page's sections (RETRO-01, Alex, 2026-10-16).
 *
 * "+ expense" on the task ledger (the city ledger until LEDGER-02, Alex,
 * 2026-10-19, renamed it) writes a one-off stop, its vendor and its
 * record for a day through the three existing routes. The day card reads that
 * day through its own reads (day/dayReads.ts) and knows nothing of the ledger;
 * the ledger knows nothing of the card. When the ledger has written a day, it
 * says so here (announceDayWritten), and a card showing that day reads it again
 * (onDayWritten) — the same reads, no copy handed across, nothing stored.
 *
 * A browser event on window, named once; no fetch, no state of its own.
 */

export const DAY_WRITTEN_EVENT = 'ts-day-written';

/** The day (YYYY-MM-DD) a section has written to — every listener for that day reads it again. */
export function announceDayWritten(day: string): void {
  window.dispatchEvent(new CustomEvent<string>(DAY_WRITTEN_EVENT, { detail: day }));
}

/** Listen for days written; returns the unlisten, for an effect's cleanup. */
export function onDayWritten(handler: (day: string) => void): () => void {
  const listener = (e: Event) => { handler((e as CustomEvent<string>).detail); };
  window.addEventListener(DAY_WRITTEN_EVENT, listener);
  return () => window.removeEventListener(DAY_WRITTEN_EVENT, listener);
}
