'use client';

/**
 * TAB13-04 (2026-09-29) — A PLAN LINE'S VENDOR BOX.
 *
 * BUDGET-02 (2026-10-20): this file was DayPlanDrill.tsx. Alex's ruling A took
 * the day's plan and its vendor box off /budget, and the drill (DayPlanDrill and
 * its PlanRows table) is deleted. The box stays, under its own name, because it
 * is not /budget's alone: the Tasks stop form mounts VendorBox
 * (workbench/operations/stops/StopVendor.tsx) and the expense form reads the
 * directory through useDirectory (workbench/operations/ledger/ExpenseForm.tsx).
 * Nothing in it changed but the drill leaving.
 *
 * A plan line's vendor (and a new vendor), through the two vendor routes —
 * never a figure (the budget report route law, clause 6):
 *   · POST   /api/operations/plan-vendors         set a line's vendor
 *   · DELETE /api/operations/plan-vendors?…       clear exactly one address
 *   · POST   /api/operations/vendor-directory     add a vendor to a book
 * THE VENDOR BOX. Every time: "<name> · every time", Clear. This occurrence:
 * "<name>", Change, Clear. None: + vendor. Picking: type — the line's book's
 * active vendors are offered by the ONE name rule (reportView.ts vendorChoices);
 * a name the book does not have offers "+ add <name> to <book>", and a 409 from
 * the directory carries the vendor it matched, which IS that vendor (D1): it is
 * used, and the box says so. Then the grain, chosen every time, nothing
 * pre-selected (ruling O): "This day" or "Every time"; a task line has one
 * button, "Set".
 *
 * Every refusal is shown where the line is, in the route's own words; a 401 (or
 * the middleware's redirect) reads as signed out. After a write the caller's
 * reload() reads its data again — the screen shows what the server holds,
 * never an optimistic copy.
 */
import { useEffect, useState } from 'react';
import { toggleChip } from '@/lib/ds';
import type { PlanAddressText, PlanLine } from '@/lib/budget/planLines';
import { vendorChoices, type DirectoryVendor } from '@/lib/budget/reportView';

/** What a write answered: its JSON, or why not — the route's own words, or signed out. (EXPENSES-02: exported with the writes.) */
export type Answer = { ok: true; status: number; body: Record<string, unknown> } | { ok: false; status: number | null; words: string; body: Record<string, unknown> | null };

const SIGNED_OUT = 'You are signed out — sign in to set a vendor.';

/** A response read the one way: a redirect or a 401 is signed out; a refusal is the route's own message. */
async function answerOf(res: Response): Promise<Answer> {
  if (res.type === 'opaqueredirect' || res.status === 401) return { ok: false, status: res.status, words: SIGNED_OUT, body: null };
  const type = res.headers.get('content-type');
  if (type === null || !type.includes('application/json')) return { ok: false, status: res.status, words: `the route answered ${res.status} with no JSON`, body: null };
  let body: Record<string, unknown>;
  try {
    body = await res.json();
  } catch (error) {
    return { ok: false, status: res.status, words: `the route's answer could not be read: ${error instanceof Error ? error.message : String(error)}`, body: null };
  }
  if (res.ok) return { ok: true, status: res.status, body };
  const words = typeof body.message === 'string' ? body.message : typeof body.error === 'string' ? body.error : `the route answered ${res.status}`;
  return { ok: false, status: res.status, words, body };
}

/** A request that never reached the route. */
const unreached = (error: unknown): Answer => ({ ok: false, status: null, words: `the request did not reach the server: ${error instanceof Error ? error.message : String(error)}`, body: null });

/**
 * POST /api/operations/plan-vendors — this line's vendor, at the grain chosen (instant null = every occurrence).
 * EXPENSES-02 (Alex, 2026-10-26): exported, with addVendor below — ROUTINE EXPENSES' vendor panel
 * (workbench/operations/routines/RoutineVendorPanel.tsx) writes through these same two calls, at the every-occurrence grain.
 */
export async function setVendor(address: PlanAddressText, instant: string | null, vendorId: string): Promise<Answer> {
  try {
    return await answerOf(await fetch('/api/operations/plan-vendors', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: address.kind, id: address.id, instant, vendorId }),
      redirect: 'manual',
    }));
  } catch (error) {
    return unreached(error);
  }
}

/** DELETE /api/operations/plan-vendors — exactly this address: its instant, or none for every occurrence. */
export async function clearVendor(address: PlanAddressText): Promise<Answer> {
  const query = new URLSearchParams({ kind: address.kind, id: address.id });
  if (address.instant !== null) query.set('instant', address.instant);
  try {
    return await answerOf(await fetch(`/api/operations/plan-vendors?${query.toString()}`, { method: 'DELETE', redirect: 'manual' }));
  } catch (error) {
    return unreached(error);
  }
}

/** POST /api/operations/vendor-directory — a new vendor in the line's book. (EXPENSES-02: exported — see setVendor.) */
export async function addVendor(entityId: string, name: string): Promise<Answer> {
  try {
    return await answerOf(await fetch('/api/operations/vendor-directory', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ entityId, name }),
      redirect: 'manual',
    }));
  } catch (error) {
    return unreached(error);
  }
}

/** The caller's active vendors (GET — the directory's own list; the box filters to the line's book). */
export function useDirectory(): { vendors: DirectoryVendor[] | null; words: string | null; refresh: () => void } {
  const [vendors, setVendors] = useState<DirectoryVendor[] | null>(null);
  const [words, setWords] = useState<string | null>(null);
  const [asks, setAsks] = useState(0);
  useEffect(() => {
    let live = true;
    (async () => {
      let answer: Answer;
      try {
        answer = await answerOf(await fetch('/api/operations/vendor-directory', { cache: 'no-store', redirect: 'manual' }));
      } catch (error) {
        answer = unreached(error);
      }
      if (!live) return;
      if (!answer.ok) { setWords(answer.words); return; }
      if (!Array.isArray(answer.body.vendors)) { setWords('the vendor list came back without its vendors'); return; }
      setWords(null);
      setVendors(answer.body.vendors as DirectoryVendor[]);
    })();
    return () => { live = false; };
  }, [asks]);
  return { vendors, words, refresh: () => setAsks((n) => n + 1) };
}

/** Clear — a DELETE of exactly this address, then the report again. */
export function ClearVendor({ address, reload, label = 'Clear' }: { address: PlanAddressText; reload: () => void; label?: string }) {
  const [words, setWords] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        className={toggleChip(false)}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const answer = await clearVendor(address);
          setBusy(false);
          if (answer.ok) reload();
          else setWords(answer.words);
        }}
      >
        {label}
      </button>
      {words !== null && <span className="text-xs text-brand-red" data-vendor-refused>{words}</span>}
    </span>
  );
}

export function VendorBox({ line, bookName, directory, reload }: {
  line: PlanLine;
  bookName: string;
  directory: ReturnType<typeof useDirectory>;
  reload: () => void;
}) {
  const [picking, setPicking] = useState(false);
  const [typed, setTyped] = useState('');
  const [chosen, setChosen] = useState<DirectoryVendor | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [words, setWords] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const task = line.address.kind === 'project_task';
  const everyAddress: PlanAddressText = { ...line.address, instant: null };

  const reset = () => { setPicking(false); setTyped(''); setChosen(null); setNote(null); setWords(null); };

  // The write, at the grain the person chose — nothing is pre-selected.
  const write = async (instant: string | null) => {
    if (chosen === null) return;
    setBusy(true);
    const answer = await setVendor(line.address, instant, chosen.id);
    setBusy(false);
    if (answer.ok) { reset(); reload(); } else setWords(answer.words);
  };

  // + add <name> to <book>: created, or — a 409 — the vendor it matched, which IS that vendor (D1).
  const add = async (name: string) => {
    setBusy(true);
    const answer = await addVendor(line.entityId, name);
    setBusy(false);
    const matched = !answer.ok && answer.status === 409 && answer.body !== null && typeof answer.body.vendor === 'object' && answer.body.vendor !== null
      ? answer.body.vendor as { id: string; vendor_name: string; is_active: boolean }
      : null;
    if (answer.ok) {
      const made = answer.body as unknown as DirectoryVendor;
      setChosen(made);
      setNote(`Added "${made.vendor_name}" to ${bookName}.`);
      setWords(null);
      directory.refresh();
    } else if (matched !== null) {
      setChosen({ id: matched.id, vendor_name: matched.vendor_name, entity_id: line.entityId });
      setNote(`"${matched.vendor_name}" is already a vendor of ${bookName}${matched.is_active ? '' : ' (archived)'} — using it.`);
      setWords(null);
    } else {
      setWords(answer.words);
    }
  };

  if (!picking) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5" data-vendor-box>
        {line.vendor !== null && line.vendor.grain === 'every' && (
          <>
            <span className="text-text-primary" data-vendor="every">{line.vendor.name} · every time</span>
            <ClearVendor address={everyAddress} reload={reload} />
          </>
        )}
        {line.vendor !== null && line.vendor.grain === 'occurrence' && (
          <>
            <span className="text-text-primary" data-vendor="occurrence">{line.vendor.name}</span>
            <button type="button" className={toggleChip(false)} onClick={() => setPicking(true)}>Change</button>
            <ClearVendor address={line.address} reload={reload} />
          </>
        )}
        {line.vendor === null && <button type="button" className={toggleChip(false)} onClick={() => setPicking(true)}>+ vendor</button>}
      </span>
    );
  }

  const choices = directory.vendors === null ? null : vendorChoices(typed, directory.vendors, line.entityId);
  return (
    <span className="flex flex-col gap-1.5" data-vendor-box="picking">
      {chosen === null ? (
        <>
          <input
            className="border border-border bg-white px-2 py-1 text-sm"
            aria-label="Vendor"
            placeholder="Type a vendor"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
          {directory.words !== null && <span className="text-xs text-brand-red">{directory.words}</span>}
          {choices !== null && (
            <span className="flex flex-wrap gap-1.5">
              {choices.offered.map((v) => (
                <button key={v.id} type="button" className={toggleChip(false)} onClick={() => { setChosen(v); setNote(null); }}>{v.vendor_name}</button>
              ))}
              {choices.add !== null && (
                <button type="button" className={toggleChip(false)} disabled={busy} onClick={() => add(choices.add as string)}>+ add {choices.add} to {bookName}</button>
              )}
              {choices.refusal !== null && <span className="text-xs text-brand-red">{choices.refusal}</span>}
            </span>
          )}
        </>
      ) : (
        <>
          <span className="text-text-primary">{chosen.vendor_name}</span>
          {note !== null && <span className="text-xs text-text-muted" data-vendor-note>{note}</span>}
          {/* THE GRAIN — two buttons, nothing pre-selected (ruling O); a task happens once: one button. */}
          <span className="flex flex-wrap gap-1.5" data-vendor-grain>
            {task ? (
              <button type="button" className={toggleChip(false)} disabled={busy} onClick={() => write(null)}>Set</button>
            ) : (
              <>
                <button type="button" className={toggleChip(false)} disabled={busy} onClick={() => write(line.address.instant)}>This day</button>
                <button type="button" className={toggleChip(false)} disabled={busy} onClick={() => write(null)}>Every time</button>
              </>
            )}
          </span>
        </>
      )}
      {words !== null && <span className="text-xs text-brand-red" data-vendor-refused>{words}</span>}
      <button type="button" className="self-start text-xs text-text-faint underline" onClick={reset}>Cancel</button>
    </span>
  );
}
