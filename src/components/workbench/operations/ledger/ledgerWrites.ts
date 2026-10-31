/**
 * ledgerWrites — the ledger's "+ expense" writes (RETRO-01, Alex, 2026-10-16).
 *
 *   · POST /api/operations/routines              createOneOff   — the one-off stop with its one line (the routines' own create route)
 *   · GET  /api/operations/routines/[id]         readOneOffLine — the line's id, read back (the create answers the routine alone)
 *   · POST /api/operations/vendor-directory      addVendor      — a new vendor in the book (VENDOR-01's route)
 *   · POST /api/operations/plan-vendors          setVendor      — the vendor on the line's occurrence (VENDOR-01's route)
 *   · the record: stops/stopWrites.ts setStopRecord — the one writer of a stop's record
 *
 * Each answer is read the one way the vendor box reads its own
 * (budget/VendorBox.tsx answerOf): ok with the route's body, or the route's
 * own words — message, else error; signed out by name; a request that never
 * reached the route, or an answer that is not JSON, in words too. Nothing is
 * retried; nothing is rolled back; the form says each step by name.
 */
import type { RoutineForm } from '../routines/types';
import { readJson } from '../week/weekReads';
import { ROUTINE_NO_ID_WORDS, VENDOR_NO_ID_WORDS, lineCountWords } from '@/lib/operations/ledger';

export type WriteAnswer<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly words: string };

const SIGNED_OUT_WORDS = 'You are signed out — sign in to add an expense.';

/** A POST read the one way: a redirect or a 401 is signed out; a refusal is the route's own message; no JSON is said as such. */
async function post(url: string, body: unknown): Promise<{ readonly ok: true; readonly body: Record<string, unknown> } | { readonly ok: false; readonly words: string }> {
  let res: Response;
  try {
    res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), redirect: 'manual' });
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
  const answer = await post('/api/operations/routines', body);
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
  const answer = await post('/api/operations/vendor-directory', { entityId, name });
  if (!answer.ok) return answer;
  if (typeof answer.body.id !== 'string') return { ok: false, words: VENDOR_NO_ID_WORDS };
  return { ok: true, value: { vendorId: answer.body.id } };
}

/** The vendor on the line's one occurrence. */
export async function setVendor(body: { readonly kind: 'routine_line'; readonly id: string; readonly instant: string; readonly vendorId: string }): Promise<WriteAnswer<{ readonly outcome: string }>> {
  const answer = await post('/api/operations/plan-vendors', body);
  if (!answer.ok) return answer;
  return { ok: true, value: { outcome: typeof answer.body.outcome === 'string' ? answer.body.outcome : '' } };
}
