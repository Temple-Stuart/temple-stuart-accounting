/**
 * StayBar — where you are, and for how long (STAY-01, 2026-10-12).
 *
 * Above the day card's plate, outside the recorded box: the stay covering the
 * card's day — "Chiang Mai · 2026-10-20 → 2026-11-02 · 14 days · day 3" — with
 * edit and delete; or, when none covers it, the word and "+ stay". The other
 * stays open on a toggle, each with edit and delete. The form takes the place,
 * the first day and the last day; "1 week", "1 month", "3 months" and "N days"
 * set the last day from the first by the one rule (src/lib/operations/stay.ts
 * endsOnFor). Every write goes through the one writer (stayWrites.ts) and the
 * route's refusal is shown in its own words under the form; after a write the
 * caller reads the stays again — never an optimistic copy. Nothing is stored
 * in the browser.
 */

'use client';

import { useState } from 'react';
import { endsOnFor, stayDay, stayLength, stayLengthWords, type StayPreset, type StayRow } from '@/lib/operations/stay';
import type { Read } from '../week/weekReads';
import type { StaysAnswer } from '../day/dayReads';
import { changeStay, createStay, removeStay } from './stayWrites';

const chip = 'px-2 py-0.5 border border-border rounded hover:bg-bg-row text-xs disabled:opacity-50';
const box = 'px-1.5 py-0.5 border border-border rounded text-xs text-text-primary focus:outline-none focus:border-brand-purple';

export const NO_STAY_COVERS = (day: string): string => `No stay covers ${day}`;

/** "Chiang Mai · 2026-10-20 → 2026-11-02 · 14 days" */
export const stayLine = (s: StayRow): string => `${s.place} · ${s.starts_on} → ${s.ends_on} · ${stayLengthWords(stayLength({ startsOn: s.starts_on, endsOn: s.ends_on }))}`;

interface Draft {
  readonly id: string | null;
  readonly place: string;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly days: string;
}

export default function StayBar({ day, stays, onChanged }: { day: string; stays: Read<StaysAnswer> | null; onChanged: () => void }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [words, setWords] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [others, setOthers] = useState(false);

  if (stays === null) return <p className="text-xs text-text-muted" data-stay-bar>loading the stay…</p>;
  if (!stays.ok) return <p className="text-xs text-brand-red" data-stay-bar data-stay-failed>{stays.words}</p>;

  const covering = stays.value.covering;
  const rest = stays.value.stays.filter((s) => covering === null || s.id !== covering.id);
  const at = covering === null ? null : stayDay({ startsOn: covering.starts_on, endsOn: covering.ends_on }, day);

  const open = (s: StayRow | null) => {
    setWords(null);
    setDraft(s === null ? { id: null, place: '', startsOn: day, endsOn: day, days: '' } : { id: s.id, place: s.place, startsOn: s.starts_on, endsOn: s.ends_on, days: '' });
  };
  const setLength = (preset: StayPreset) => {
    if (draft === null) return;
    try {
      setDraft({ ...draft, endsOn: endsOnFor(draft.startsOn, preset) });
    } catch (error) {
      setWords(error instanceof Error ? error.message : String(error));
    }
  };
  const save = async () => {
    if (draft === null) return;
    setBusy(true);
    setWords(null);
    try {
      const body = { place: draft.place, starts_on: draft.startsOn, ends_on: draft.endsOn };
      const answer = draft.id === null ? await createStay(body) : await changeStay(draft.id, body);
      if (!answer.ok) { setWords(answer.message); return; }
      setDraft(null);
      onChanged();
    } catch (error) {
      setWords(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };
  const remove = async (s: StayRow) => {
    setBusy(true);
    setWords(null);
    try {
      const answer = await removeStay(s.id);
      if (!answer.ok) { setWords(answer.message); return; }
      onChanged();
    } catch (error) {
      setWords(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const row = (s: StayRow, mark: string | null) => (
    <div key={s.id} className="flex flex-wrap items-center gap-1.5 text-xs" data-stay-row={s.id}>
      <span className="text-text-primary">{stayLine(s)}</span>
      {mark !== null && <span className="font-mono text-text-muted" data-stay-at>{mark}</span>}
      <button type="button" className={chip} disabled={busy} onClick={() => open(s)}>edit</button>
      <button type="button" className={chip} disabled={busy} onClick={() => remove(s)}>delete</button>
    </div>
  );

  return (
    <div className="space-y-1" data-stay-bar>
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-text-faint uppercase tracking-wide">Stay</span>
        {covering !== null && at !== null ? row(covering, `day ${at.n} of ${at.of}`) : (
          <>
            <span className="text-text-muted" data-stay-none>{NO_STAY_COVERS(day)}</span>
            <button type="button" className={chip} disabled={busy} onClick={() => open(null)}>+ stay</button>
          </>
        )}
        {covering !== null && <button type="button" className={chip} disabled={busy} onClick={() => open(null)}>+ stay</button>}
        {rest.length > 0 && (
          <button type="button" className={chip} onClick={() => setOthers((o) => !o)} data-stay-others>{others ? 'hide' : 'show'} {rest.length === 1 ? '1 other stay' : `${rest.length} other stays`}</button>
        )}
      </div>
      {others && rest.map((s) => row(s, null))}
      {draft !== null && (
        <form className="flex flex-wrap items-center gap-1.5 text-xs" data-stay-form onSubmit={(e) => { e.preventDefault(); save(); }}>
          <input type="text" value={draft.place} onChange={(e) => setDraft({ ...draft, place: e.target.value })} placeholder="place — Chiang Mai" aria-label="Place" className={`${box} w-44`} maxLength={80} data-stay-place />
          <input type="date" value={draft.startsOn} onChange={(e) => setDraft({ ...draft, startsOn: e.target.value })} aria-label="First day" className={`${box} font-mono`} data-stay-starts />
          <span className="text-text-muted">→</span>
          <input type="date" value={draft.endsOn} onChange={(e) => setDraft({ ...draft, endsOn: e.target.value })} aria-label="Last day" className={`${box} font-mono`} data-stay-ends />
          <button type="button" className={chip} onClick={() => setLength('week')}>1 week</button>
          <button type="button" className={chip} onClick={() => setLength('month')}>1 month</button>
          <button type="button" className={chip} onClick={() => setLength('quarter')}>3 months</button>
          <input type="number" min={1} value={draft.days} onChange={(e) => setDraft({ ...draft, days: e.target.value })} placeholder="N" aria-label="Days" className={`${box} w-14 font-mono`} data-stay-days />
          <button type="button" className={chip} disabled={!/^\d+$/.test(draft.days)} onClick={() => setLength({ days: Number(draft.days) })}>days</button>
          <button type="submit" className={chip} disabled={busy}>{draft.id === null ? 'add' : 'save'}</button>
          <button type="button" className={chip} disabled={busy} onClick={() => { setDraft(null); setWords(null); }}>cancel</button>
        </form>
      )}
      {words !== null && <p className="text-xs text-brand-red" data-stay-words>{words}</p>}
    </div>
  );
}
