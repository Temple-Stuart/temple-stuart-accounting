/**
 * ledgerWrites — the ledger's "+ expense" writes (RETRO-01, Alex, 2026-10-16).
 *
 *   · POST /api/operations/routines              createOneOff   — the one-off stop with its one line (the routines' own create route)
 *   · GET  /api/operations/routines/[id]         readOneOffLine — the line's id, read back (the create answers the routine alone)
 *   · POST /api/operations/vendor-directory      addVendor      — a new vendor in the book (VENDOR-01's route)
 *   · POST /api/operations/plan-vendors          setVendor      — the vendor on the line's occurrence (VENDOR-01's route)
 *   · PATCH /api/operations/routines/steps/[id]  setLineMinutes — the line's minutes (the line's own route)
 *   · PATCH /api/operations/vendor-directory     setVendorTag   — a vendor's Instagram tag (the directory's own PATCH)
 *   · POST /api/chart-of-accounts/sub-accounts   addSubAccount  — a sub-account under an account of the chart (the chart's own route)
 *   · PATCH /api/operations/routines/[id]        patchRoutine   — a routine's own fields (the routine's own route)
 *   · PATCH /api/operations/routines/steps/[id]  patchLine      — a line's own fields (the line's own route)
 *   · DELETE /api/operations/plan-vendors        clearVendor    — the vendor at one address cleared (VENDOR-01's route)
 *   · GET  /api/operations/vendor-directory      readVendors    — the caller's vendors, each with its tag (the directory's own GET)
 *   · the record: stops/stopWrites.ts setStopRecord — the one writer of a stop's record
 *
 * PASTE-02 (Alex, 2026-11-27): the pasted rows are saved through these (src/lib/operations/pasteSave.ts runs them; ledger/PasteRows.tsx
 * hands them in). Three changes for it, and no other: the one helper takes the method (it was `post(url, body)` — still ONE request
 * in this file); setVendor takes a routine's address too (a plan that holds its own amount is a routine — ledger.ts LedgerAddress);
 * and setLineMinutes is new.
 *
 * COALEVELS-01 (Alex, 2026-11-27) — for the paste, which now carries TIMESHEET-04c: setVendor's body may carry the plan's items (sent as
 * it is handed; absent says nothing of them), and two writers are new, at the file's end — setVendorTag and addSubAccount. The file's
 * one request function is not touched.
 *
 * EDIT-01 (Alex, 2026-11-28) — for the time sheet's cells (ledger/cellSaves.ts runs them): three writers and one read are new, at the
 * file's end — patchRoutine, patchLine, clearVendor and readVendors (the directory's list read by the paste's own rule, pasteRows.ts
 * vendorsOf). The one helper takes DELETE too (no body is sent with it), and setVendor takes an instant of null — the plan's
 * every-occurrence row, whose planned items a cell sets at that grain. Still ONE request in this file.
 *
 * Each answer is read the one way the vendor box reads its own
 * (budget/VendorBox.tsx answerOf): ok with the route's body, or the route's
 * own words — message, else error; signed out by name; a request that never
 * reached the route, or an answer that is not JSON, in words too. Nothing is
 * retried; nothing is rolled back; the form says each step by name.
 */
import type { RoutineForm } from '../routines/types';
import { readJson } from '../week/weekReads';
import { ROUTINE_NO_ID_WORDS, VENDOR_NO_ID_WORDS, lineCountWords, type PlanLineBody, type PlanRoutineBody, type PlanVendorAddress } from '@/lib/operations/ledger';
import { vendorsOf, vendorsUnreadWords, type PasteVendor } from '@/lib/operations/pasteRows';

export type WriteAnswer<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly words: string };

const SIGNED_OUT_WORDS = 'You are signed out — sign in to add an expense.';

/** A write read the one way: a redirect or a 401 is signed out; a refusal is the route's own message; no JSON is said as such. PASTE-02 (2026-11-27): it takes the method — `post(url, body)` until then. EDIT-01 (2026-11-28): and DELETE — its body undefined, none is sent. */
async function send(method: 'POST' | 'PATCH' | 'DELETE', url: string, body: unknown): Promise<{ readonly ok: true; readonly body: Record<string, unknown> } | { readonly ok: false; readonly words: string }> {
  let res: Response;
  try {
    res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), redirect: 'manual' });
  } catch (error) {
    return { ok: false, words: `the request did not reach the server: ${error instanceof Error ? error.message : String(error)}` };
  }
  if (res.type === 'opaqueredirect' || res.status === 401) return { ok: false, words: SIGNED_OUT_WORDS };
  const type = res.headers.get('content-type');
  if (type === null || !type.includes('application/json')) return { ok: false, words: `the route answered ${res.status} with no JSON` };
  let answer: Record<string, unknown>;
  try {
    answer = await res.json();
  } catch (error) {
    return { ok: false, words: `the route's answer could not be read: ${error instanceof Error ? error.message : String(error)}` };
  }
  if (res.ok) return { ok: true, body: answer };
  const words = typeof answer.message === 'string' ? answer.message : typeof answer.error === 'string' ? answer.error : `the route answered ${res.status}`;
  return { ok: false, words };
}

/** The one-off stop, created whole with its one line; the new routine's id. */
export async function createOneOff(body: RoutineForm): Promise<WriteAnswer<{ readonly routineId: string }>> {
  const answer = await send('POST', '/api/operations/routines', body);
  if (!answer.ok) return answer;
  const routine = answer.body.routine;
  if (typeof routine !== 'object' || routine === null || typeof (routine as { id?: unknown }).id !== 'string') return { ok: false, words: ROUTINE_NO_ID_WORDS };
  return { ok: true, value: { routineId: (routine as { id: string }).id } };
}

/** The line the create wrote, read back from the routine — exactly one, or said. */
export async function readOneOffLine(routineId: string): Promise<WriteAnswer<{ readonly lineId: string }>> {
  const read = await readJson(`/api/operations/routines/${routineId}`);
  if (!read.ok) return { ok: false, words: read.words };
  const routine = read.value.routine;
  const steps = typeof routine === 'object' && routine !== null ? (routine as { steps?: unknown }).steps : undefined;
  if (!Array.isArray(steps)) return { ok: false, words: lineCountWords(0) };
  if (steps.length !== 1 || typeof steps[0]?.id !== 'string') return { ok: false, words: lineCountWords(steps.length) };
  return { ok: true, value: { lineId: steps[0].id as string } };
}

/** A new vendor in the book, by name — the route answers the row itself ({ id, vendor_name, entity_id }); its refusals (a name the book already has) are its words. */
export async function addVendor(entityId: string, name: string): Promise<WriteAnswer<{ readonly vendorId: string }>> {
  const answer = await send('POST', '/api/operations/vendor-directory', { entityId, name });
  if (!answer.ok) return answer;
  if (typeof answer.body.id !== 'string') return { ok: false, words: VENDOR_NO_ID_WORDS };
  return { ok: true, value: { vendorId: answer.body.id } };
}

/** The vendor on the line's one occurrence — or, PASTE-02 (2026-11-27), on a routine's own (`kind: 'routine_line'` alone until then). COALEVELS-01 (2026-11-27): with the plan's items, when the caller hands any — sent as handed; a body without the key says nothing of them. EDIT-01 (2026-11-28): or on every occurrence — the instant null, as the route reads it (a string until then). */
export async function setVendor(body: { readonly kind: 'routine_line' | 'routine'; readonly id: string; readonly instant: string | null; readonly vendorId: string; readonly items?: string }): Promise<WriteAnswer<{ readonly outcome: string }>> {
  const answer = await send('POST', '/api/operations/plan-vendors', body);
  if (!answer.ok) return answer;
  return { ok: true, value: { outcome: typeof answer.body.outcome === 'string' ? answer.body.outcome : '' } };
}

/** PASTE-02 (2026-11-27): the line's minutes — a stop's planned length, from which the time sheet reads its END. The route answers the line; nothing of it is read back here. */
export async function setLineMinutes(lineId: string, minutes: number): Promise<WriteAnswer<null>> {
  const answer = await send('PATCH', `/api/operations/routines/steps/${lineId}`, { duration_minutes: minutes });
  if (!answer.ok) return answer;
  return { ok: true, value: null };
}

/** COALEVELS-01 (2026-11-27): a vendor's Instagram tag — the directory's PATCH, by the vendor's id. The route answers the vendor; nothing of it is read back here. */
export async function setVendorTag(vendorId: string, tag: string): Promise<WriteAnswer<null>> {
  const answer = await send('PATCH', '/api/operations/vendor-directory', { id: vendorId, instagramTag: tag });
  if (!answer.ok) return answer;
  return { ok: true, value: null };
}

/** COALEVELS-01 (2026-11-27): a sub-account under an account of the chart — its name and its two-digit code. The route answers the sub-account; nothing of it is read back here. */
export async function addSubAccount(accountId: string, name: string, code: string): Promise<WriteAnswer<null>> {
  const answer = await send('POST', '/api/chart-of-accounts/sub-accounts', { accountId, name, code });
  if (!answer.ok) return answer;
  return { ok: true, value: null };
}

/** EDIT-01 (2026-11-28): a routine's own fields — the routines PATCH, the body as handed (its name, its role, its start time, its Location). The route moves what its clock keys, or refuses by name; nothing of its answer is read back here. */
export async function patchRoutine(routineId: string, body: PlanRoutineBody): Promise<WriteAnswer<null>> {
  const answer = await send('PATCH', `/api/operations/routines/${routineId}`, body);
  if (!answer.ok) return answer;
  return { ok: true, value: null };
}

/** EDIT-01 (2026-11-28): a line's own fields — the line's PATCH, the body as handed (its TYPE, its minutes cleared, its account, its amount). The route answers the line; nothing of it is read back here. */
export async function patchLine(lineId: string, body: PlanLineBody): Promise<WriteAnswer<null>> {
  const answer = await send('PATCH', `/api/operations/routines/steps/${lineId}`, body);
  if (!answer.ok) return answer;
  return { ok: true, value: null };
}

/** EDIT-01 (2026-11-28): the vendor at exactly one address cleared — the plan-vendors DELETE, the address in the query (no instant: every occurrence). Nothing there is the route's refusal, in its words. */
export async function clearVendor(address: PlanVendorAddress): Promise<WriteAnswer<null>> {
  const query = new URLSearchParams(address.instant === null ? { kind: address.kind, id: address.id } : { kind: address.kind, id: address.id, instant: address.instant });
  const answer = await send('DELETE', `/api/operations/plan-vendors?${query.toString()}`, undefined);
  if (!answer.ok) return answer;
  return { ok: true, value: null };
}

/** EDIT-01 (2026-11-28): the caller's vendors as the directory lists them, read by the paste's own rule (pasteRows.ts vendorsOf) — each with the tag it carries. A read that fails is said in its words, never taken as none. */
export async function readVendors(): Promise<WriteAnswer<readonly PasteVendor[]>> {
  const listed = await readJson('/api/operations/vendor-directory');
  if (!listed.ok) return { ok: false, words: vendorsUnreadWords(listed.words) };
  const read = vendorsOf(listed.value);
  return read.ok ? { ok: true, value: read.vendors } : { ok: false, words: vendorsUnreadWords(read.words) };
}
