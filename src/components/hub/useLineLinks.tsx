'use client';

/**
 * LINES-01 — the links of a routine occurrence's LINES, read and written from
 * the drill panel.
 *
 * One hook, one route: it reads every line's links from /api/calendar/links
 * on kind 'routine_line' keyed (step, instant), and links or unlinks one line
 * at a time through the same route. The occurrence's actual is the SUM of the
 * lines' actuals, each of which is sumLinks() over that line's own links — so
 * a null amount on any posting is REPORTED by the leaf, never summed as zero,
 * and the routine grain is never added in.
 *
 * NOTHING IS SUGGESTED. The candidate list is the same date-ordered window
 * LINK-01 established, with nothing pre-selected and no score.
 *
 * LEDGER-03 (Alex, 2026-10-19): GENERALISED. The three requests (readLinks,
 * postLink, deleteLink — the same URLs, the same bodies, the same refusal words
 * LINES-01 made) are shared by two hooks: useLineLinks, unchanged in signature
 * and behaviour for the drill panel's lines, and useItemLinks(kind, id, instant)
 * — ONE item of any linkable kind, which the ledger's LinkPicker uses on a stop
 * record's own (kind, target_id, occurrence_at). Nothing is stored in the
 * browser; nothing is ranked.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LinkableKind } from '@/lib/calendar/linkKeys';
import { sumLinks, type LinkedActual, type LinkedPosting } from '@/lib/calendar/links';

export interface LineLink extends LinkedPosting { linkedAt: string; linkedBy: string | null }
interface LineState { links: LineLink[]; summed: LinkedActual }

type Outcome<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly words: string };

/** GET the item's links and, with `near`, its candidates — the route's words on refusal. */
async function readLinks(kind: LinkableKind, id: string, instant: string | null, near?: string): Promise<Outcome<{ links: LineLink[]; candidates: LinkedPosting[] | null }>> {
  const q = new URLSearchParams({ kind, id });
  if (instant) q.set('instant', instant);
  if (near) q.set('near', near);
  const res = await fetch(`/api/calendar/links?${q.toString()}`);
  const data = await res.json().catch(() => null);
  if (!res.ok) return { ok: false, words: data?.error ?? `Links could not be read (HTTP ${res.status}).` };
  return { ok: true, value: { links: data.links ?? [], candidates: near ? (data.candidates ?? []) : null } };
}
/** POST one link. */
async function postLink(kind: LinkableKind, id: string, instant: string | null, journalEntryId: string): Promise<Outcome<null>> {
  const res = await fetch('/api/calendar/links', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind, id, instant, journalEntryId }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) return { ok: false, words: data?.error ?? `The link was not made (HTTP ${res.status}).` };
  return { ok: true, value: null };
}
/** DELETE one link, by its posting. */
async function deleteLink(journalEntryId: string): Promise<Outcome<null>> {
  const res = await fetch(`/api/calendar/links?journalEntryId=${encodeURIComponent(journalEntryId)}`, { method: 'DELETE' });
  const data = await res.json().catch(() => null);
  if (!res.ok) return { ok: false, words: data?.error ?? `The link was not removed (HTTP ${res.status}).` };
  return { ok: true, value: null };
}

export function useLineLinks(stepIds: readonly string[], instant: string | null) {
  const [byStep, setByStep] = useState<Map<string, LineState>>(new Map());
  const [picking, setPicking] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<LinkedPosting[] | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const key = stepIds.join('|');

  const loadOne = useCallback(async (stepId: string, near?: string): Promise<LineLink[] | null> => {
    if (!instant) return null;
    const read = await readLinks('routine_line', stepId, instant, near);
    if (!read.ok) { setRefusal(read.words); return null; }
    if (near) setCandidates(read.value.candidates ?? []);
    return read.value.links;
  }, [instant]);

  const reload = useCallback(async () => {
    if (!instant || stepIds.length === 0) return;
    const next = new Map<string, LineState>();
    for (const id of stepIds) {
      const links = await loadOne(id);
      if (links) next.set(id, { links, summed: sumLinks(links) });
    }
    setByStep(next);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instant, key, loadOne]);

  useEffect(() => { void reload(); }, [reload]);

  const openPicker = useCallback(async (stepId: string, near: string) => {
    setRefusal(null); setCandidates(null); setPicking(stepId);
    await loadOne(stepId, near);
  }, [loadOne]);
  const closePicker = useCallback(() => { setPicking(null); setCandidates(null); }, []);

  const link = useCallback(async (stepId: string, journalEntryId: string) => {
    if (!instant) return;
    setRefusal(null);
    const done = await postLink('routine_line', stepId, instant, journalEntryId);
    if (!done.ok) { setRefusal(done.words); return; }
    setPicking(null); setCandidates(null);
    await reload();
  }, [instant, reload]);

  const unlink = useCallback(async (_stepId: string, journalEntryId: string) => {
    setRefusal(null);
    const done = await deleteLink(journalEntryId);
    if (!done.ok) { setRefusal(done.words); return; }
    await reload();
  }, [reload]);

  // THE OCCURRENCE'S ACTUAL: the lines' links, pooled, summed ONCE by the leaf —
  // so an unreadable amount on any line is named in the occurrence's own line.
  const summed = useMemo(() => sumLinks([...byStep.values()].flatMap((l) => l.links)), [byStep]);

  return { byStep, summed, picking, candidates, refusal, openPicker, closePicker, link, unlink };
}

/**
 * LEDGER-03: ONE item's links — any linkable kind, keyed as the route keys it
 * (kind, id, instant; the instant null for a kind that carries none). The links
 * are read on mount; openPicker(near) reads them again with the candidates near
 * a day; link and unlink go through the route and read again (with the
 * candidates when `near` is given, so a linked posting leaves the list), and
 * answer true when the route accepted — the caller re-reads what it owns.
 */
export function useItemLinks(kind: LinkableKind, id: string, instant: string | null) {
  const [links, setLinks] = useState<LineLink[] | null>(null);
  const [candidates, setCandidates] = useState<LinkedPosting[] | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async (near?: string) => {
    const read = await readLinks(kind, id, instant, near);
    if (!read.ok) { setRefusal(read.words); return; }
    setLinks(read.value.links);
    if (near) setCandidates(read.value.candidates ?? []);
  }, [kind, id, instant]);

  useEffect(() => { void reload(); }, [reload]);

  const openPicker = useCallback(async (near: string) => { setRefusal(null); setCandidates(null); await reload(near); }, [reload]);
  const closePicker = useCallback(() => { setCandidates(null); }, []);

  const link = useCallback(async (journalEntryId: string, near?: string): Promise<boolean> => {
    setBusy(true); setRefusal(null);
    try {
      const done = await postLink(kind, id, instant, journalEntryId);
      if (!done.ok) { setRefusal(done.words); return false; }
      await reload(near);
      return true;
    } finally { setBusy(false); }
  }, [kind, id, instant, reload]);

  const unlink = useCallback(async (journalEntryId: string, near?: string): Promise<boolean> => {
    setBusy(true); setRefusal(null);
    try {
      const done = await deleteLink(journalEntryId);
      if (!done.ok) { setRefusal(done.words); return false; }
      await reload(near);
      return true;
    } finally { setBusy(false); }
  }, [reload]);

  const summed = useMemo(() => sumLinks(links ?? []), [links]);

  return { links, summed, candidates, refusal, busy, openPicker, closePicker, link, unlink, reload };
}
