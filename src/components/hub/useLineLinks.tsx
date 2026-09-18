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
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { sumLinks, type LinkedActual, type LinkedPosting } from '@/lib/calendar/links';

interface LineLink extends LinkedPosting { linkedAt: string; linkedBy: string | null }
interface LineState { links: LineLink[]; summed: LinkedActual }

export function useLineLinks(stepIds: readonly string[], instant: string | null) {
  const [byStep, setByStep] = useState<Map<string, LineState>>(new Map());
  const [picking, setPicking] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<LinkedPosting[] | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const key = stepIds.join('|');

  const loadOne = useCallback(async (stepId: string, near?: string): Promise<LineLink[] | null> => {
    if (!instant) return null;
    const q = new URLSearchParams({ kind: 'routine_line', id: stepId, instant });
    if (near) q.set('near', near);
    const res = await fetch(`/api/calendar/links?${q.toString()}`);
    const data = await res.json().catch(() => null);
    if (!res.ok) { setRefusal(data?.error ?? `Links could not be read (HTTP ${res.status}).`); return null; }
    if (near) setCandidates(data.candidates ?? []);
    return data.links ?? [];
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
    const res = await fetch('/api/calendar/links', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'routine_line', id: stepId, instant, journalEntryId }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) { setRefusal(data?.error ?? `The link was not made (HTTP ${res.status}).`); return; }
    setPicking(null); setCandidates(null);
    await reload();
  }, [instant, reload]);

  const unlink = useCallback(async (_stepId: string, journalEntryId: string) => {
    setRefusal(null);
    const res = await fetch(`/api/calendar/links?journalEntryId=${encodeURIComponent(journalEntryId)}`, { method: 'DELETE' });
    const data = await res.json().catch(() => null);
    if (!res.ok) { setRefusal(data?.error ?? `The link was not removed (HTTP ${res.status}).`); return; }
    await reload();
  }, [reload]);

  // THE OCCURRENCE'S ACTUAL: the lines' links, pooled, summed ONCE by the leaf —
  // so an unreadable amount on any line is named in the occurrence's own line.
  const summed = useMemo(() => sumLinks([...byStep.values()].flatMap((l) => l.links)), [byStep]);

  return { byStep, summed, picking, candidates, refusal, openPicker, closePicker, link, unlink };
}
