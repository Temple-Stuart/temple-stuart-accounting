/**
 * journalWrites — the ONE writer of a day's journal from the screen (JOURNAL-01, 2026-10-13).
 *
 *   · set:   PUT /api/operations/journal            { day, ...answers }
 *   · clear: DELETE /api/operations/journal/[id]
 *
 * Each answer is read the way the week's reader reads an answer (week/weekReads.ts
 * readJson): ok, or words — a redirect or a 401 is signed out, by name; an answer
 * with no JSON body says so (never a raw SyntaxError on the screen); a request that
 * never reached the server says so; a refusal is the route's own words — message,
 * else error, else this writer's. Nothing is filled in. This file is the only
 * screen file that names the journal routes with a method.
 */
import type { Answers } from '@/lib/operations/journal';
import { SIGNED_OUT_WORDS } from '../week/weekReads';

export type JournalWriteAnswer = { readonly ok: true } | { readonly ok: false; readonly message: string };

export const SET_FAILED_WORDS = 'failed to save the journal';
export const CLEAR_FAILED_WORDS = 'failed to clear the journal';

async function answerOf(send: () => Promise<Response>, ownWords: string): Promise<JournalWriteAnswer> {
  let res: Response;
  try {
    res = await send();
  } catch (error) {
    return { ok: false, message: `the request did not reach the server: ${error instanceof Error ? error.message : String(error)}` };
  }
  if (res.type === 'opaqueredirect' || res.status === 401) return { ok: false, message: SIGNED_OUT_WORDS };
  const type = res.headers.get('content-type');
  if (type === null || !type.includes('application/json')) return { ok: false, message: `the route answered ${res.status} with no JSON` };
  let body: Record<string, unknown>;
  try {
    body = await res.json();
  } catch (error) {
    return { ok: false, message: `the answer could not be read: ${error instanceof Error ? error.message : String(error)}` };
  }
  if (res.ok) return { ok: true };
  const message = typeof body.message === 'string' ? body.message : typeof body.error === 'string' ? body.error : ownWords;
  return { ok: false, message };
}

export function setJournal(day: string, answers: Answers): Promise<JournalWriteAnswer> {
  return answerOf(() => fetch('/api/operations/journal', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ day, ...answers }),
    redirect: 'manual',
  }), SET_FAILED_WORDS);
}

export function clearJournal(id: string): Promise<JournalWriteAnswer> {
  return answerOf(() => fetch(`/api/operations/journal/${id}`, { method: 'DELETE', redirect: 'manual' }), CLEAR_FAILED_WORDS);
}
