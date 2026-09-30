/**
 * completionNote — THE ONE NOTE RULE for a routine's completion (WEEK-02, 2026-09-30).
 *
 * A done's note — the day's journal line — is kept trimmed; a blank one is no
 * note (null). Anything that is not a string is no note either. Moved out of
 * the completions POST (it was the POST's inline rule) so the POST that
 * records a done and the PATCH that edits its note read a note the same way.
 * No length limit: notes is @db.Text, and the POST never had one.
 *
 * Pure: no request, no client, no clock.
 */
export function completionNote(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}
