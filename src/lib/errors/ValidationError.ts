/**
 * HYG-02 follow-up — user guidance is not an internal fault.
 *
 * A route's catch-all answers a thrown error with a FIXED line (failClosed);
 * the thrown text stays on the server. That is right for a database or
 * runtime fault and wrong for a message written FOR the user — "Trip dates
 * required for hotel search — set Start/End on the trip first" tells them
 * what to change. Throw one of these instead of a plain Error and failClosed
 * passes the text through VERBATIM at its status (400 by default; 404 for a
 * record the caller named that does not exist for them) with no error log —
 * a refusal is not a fault.
 *
 * Zero imports: services (journal entries, positions, rrule) throw it too.
 */
export type ValidationStatus = 400 | 404 | 409 | 422;

export class ValidationError extends Error {
  readonly status: ValidationStatus;
  /** The input field the guidance is about, when there is one. */
  readonly field?: string;

  constructor(message: string, opts: { status?: ValidationStatus; field?: string } = {}) {
    super(message);
    this.name = 'ValidationError';
    this.status = opts.status ?? 400;
    this.field = opts.field;
  }
}
