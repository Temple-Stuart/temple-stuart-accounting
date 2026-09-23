'use client';

/**
 * OFFER-01 (2026-09-23) — THE OFFER, as a commercial product shows it.
 *
 * Three plan cards, then ONE comparison table of collapsed capability groups.
 * EVERY word, every cell and every price in here comes from src/lib/offer/plans.ts
 * — the plans, the copy, the groups, the rows, the tool mapping and the price
 * slots. This file types no claim, no count, no glyph and no price of its own; it
 * lays them out. A cell's state is `cellState()`, never a hand-written ✓.
 *
 * WHAT IT REPLACED on the landing: the hero's registry count, the offer act's
 * cards with their loop-beat claim lines, and the six-row "ONE SYSTEM · SIX
 * LIVES" persona grid. The audience each persona named now sits on the plan that
 * serves it, in one line under the plan's name.
 *
 * PAINT (REPAINT-04): cream page, white cards, lavender hairlines, aubergine
 * ink — the ds.ts vocabulary. The only white ink is inside the purple button,
 * which carries its own solid fill in the same class string.
 */

import { useState } from 'react';
import Link from 'next/link';
import { DATA } from '@/lib/ds';
import {
  CAPABILITY_GROUPS, CELL_LABEL, CELL_MARK, PLANS,
  capabilityNotes, cellState, priceSlot, travelFreeLine,
  type CapabilityRow, type Plan,
} from '@/lib/offer/plans';

export type PlanDoor =
  | { kind: 'button'; onClick: (planId: string) => void }
  | { kind: 'link'; href: string };

const CARD = 'flex flex-col gap-4 rounded-lg border border-border bg-white p-5';
const CTA = 'rounded-lg bg-brand-purple px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-purple-hover';

/** The door, drawn the one way each caller can give it. */
function Door({ door, plan, label }: { door: PlanDoor; plan: Plan; label: string }) {
  if (door.kind === 'link') {
    return <Link href={door.href} className={`inline-block text-center ${CTA}`} data-plan-cta={plan.id}>{label}</Link>;
  }
  return (
    <button type="button" onClick={() => door.onClick(plan.id)} className={CTA} data-plan-cta={plan.id}>
      {label}
    </button>
  );
}

/**
 * THE PRICE SLOT. It occupies the geometry a price will take — the figure, the
 * struck-through figure, the discount chip and the billing note — whether or not
 * one is set, so setting three constants later moves nothing. While no figure is
 * set it reads the launch placeholder and the door says "Join early access".
 */
function PriceSlot({ plan, door, where }: { plan: Plan; door: PlanDoor; where: 'card' | 'foot' }) {
  const slot = priceSlot(plan);
  return (
    <div className="mt-auto flex min-h-[104px] flex-col justify-end gap-2" data-price-slot={slot.kind} data-price-where={where}>
      {slot.kind === 'announced' ? (
        <>
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="font-mono text-3xl font-bold text-text-primary" data-price-figure>{slot.figure}</span>
            {slot.compareAt && <span className="font-mono text-sm text-text-faint line-through" data-price-compare>{slot.compareAt}</span>}
            {slot.discountNote && (
              <span className="rounded border border-brand-gold/50 px-1.5 py-px font-mono text-[10px] font-semibold uppercase tracking-wider text-brand-gold" data-price-discount>
                {slot.discountNote}
              </span>
            )}
          </div>
          <span className="font-mono text-[10px] uppercase tracking-wider text-text-faint" data-price-billing>{slot.billingNote ?? ''}</span>
        </>
      ) : (
        <span className="font-mono text-sm text-text-secondary" data-price-placeholder>{slot.text}</span>
      )}
      <Door door={door} plan={plan} label={slot.cta} />
    </div>
  );
}

/** One cell: the mark the leaf's mapping chose for this plan and this row. */
function Cell({ planId, row }: { planId: Plan['id']; row: CapabilityRow }) {
  const state = cellState(planId, row);
  const tone = state === 'ready' ? 'text-status-success'
    : state === 'partial' ? 'text-brand-amber'
    : state === 'coming' ? 'text-text-faint'
    : 'text-text-faint';
  return (
    <td className="px-3 py-2 text-center" data-cell={planId} data-cell-state={state}>
      <span className={`font-mono text-sm ${tone}`} title={CELL_LABEL[state]}>{CELL_MARK[state]}</span>
      <span className="sr-only">{CELL_LABEL[state]}</span>
    </td>
  );
}

export default function PlansSection({ door, headingId = 'modules' }: {
  door: PlanDoor;
  /** The anchor the checkout cancel_url and the /?module= doors resolve to. */
  headingId?: string;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const freeLine = travelFreeLine();

  return (
    <section id={headingId} aria-label="Plans" className="w-full border-b border-border bg-bg-terminal" data-plans>
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-10">
        <p className="font-mono text-xs lg:text-[10px] font-semibold uppercase tracking-wider text-text-faint">
          PLANS <span className="text-brand-gold">·</span> WHAT EACH ONE IS FOR
        </p>
        <h2 className="mt-3 text-2xl sm:text-3xl font-medium tracking-tight text-brand-purple">
          Three plans. Each one adds to the one before it.
        </h2>

        {/* THE CARDS — positioning, three benefits, the price slot, one button. */}
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <div key={plan.id} className={CARD} data-plan={plan.id}>
              <div>
                <h3 className="text-lg font-semibold text-brand-purple" data-plan-name>{plan.name}</h3>
                <p className="mt-1 text-sm text-text-primary" data-plan-positioning>{plan.positioning}</p>
                <p className="mt-2 text-xs text-text-muted" data-plan-audience>{plan.audience}</p>
                <p className="mt-1 text-xs text-text-secondary" data-plan-relationship>{plan.relationship}</p>
              </div>
              <ul className="space-y-1.5 text-sm text-text-secondary">
                {plan.benefits.map((b) => (
                  <li key={b} className="flex gap-2" data-plan-benefit>
                    <span aria-hidden="true" className="text-brand-gold">·</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <PriceSlot plan={plan} door={door} where="card" />
            </div>
          ))}
        </div>

        {/* TRAVEL's free line — once, under the cards, from the registry's own row. */}
        {freeLine && <p className="mt-4 text-[13px] text-text-secondary" data-travel-free>{freeLine}</p>}

        {/* THE TABLE — collapsed groups, the plan columns headed by the same
            audience and relationship lines the cards carry. */}
        <div className="mt-8 overflow-x-auto rounded-lg border border-border bg-white" data-plan-table>
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-row text-left align-top">
                <th className={`px-3 py-3 ${DATA.columnHeader}`}>What you can do</th>
                {PLANS.map((plan) => (
                  <th key={plan.id} className="px-3 py-3 text-center" data-column={plan.id}>
                    <div className="text-sm font-semibold text-brand-purple">{plan.name}</div>
                    <div className="mt-1 text-[11px] font-normal normal-case tracking-normal text-text-muted" data-column-audience>{plan.audience}</div>
                    <div className="mt-0.5 text-[11px] font-normal normal-case tracking-normal text-text-secondary" data-column-relationship>{plan.relationship}</div>
                  </th>
                ))}
              </tr>
            </thead>
            {CAPABILITY_GROUPS.map((group) => {
              const isOpen = open === group.id;
              return (
                <tbody key={group.id} data-plan-group={group.id} data-plan-group-open={isOpen}>
                  <tr className="border-b border-border-light">
                    <td colSpan={1 + PLANS.length} className="p-0">
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => setOpen(isOpen ? null : group.id)}
                        className="flex w-full items-center justify-between px-3 py-2.5 text-left font-mono text-xs font-semibold uppercase tracking-wider text-brand-purple hover:bg-bg-row"
                        data-plan-group-toggle={group.id}
                      >
                        <span>{group.title}</span>
                        <span aria-hidden="true" className="text-text-faint">{isOpen ? '−' : '+'}</span>
                      </button>
                    </td>
                  </tr>
                  {isOpen && group.rows.map((row) => {
                    const notes = capabilityNotes(row).filter((n) => n.status !== 'LIVE');
                    return (
                      <tr key={row.label} className="border-b border-border-light align-top" data-capability={row.label}>
                        <td className="px-3 py-2">
                          <div className="text-text-primary">{row.label}</div>
                          {notes.length > 0 && (
                            <ul className="mt-1 space-y-0.5" data-capability-notes>
                              {notes.map((n) => (
                                <li key={n.name} className="text-[11px] text-text-muted" data-capability-why={n.name}>
                                  <span className="font-mono">{n.name}</span>
                                  {' — '}
                                  {n.status === 'PARTIAL' ? 'partly built' : 'not built yet'}
                                  {n.why ? `: ${n.why}` : ''}
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                        {PLANS.map((plan) => <Cell key={plan.id} planId={plan.id} row={row} />)}
                      </tr>
                    );
                  })}
                </tbody>
              );
            })}
            {/* The price and the button repeat at the foot of the table. */}
            <tfoot>
              <tr className="border-t border-border bg-bg-row align-top">
                <td className="px-3 py-4 text-[13px] text-text-secondary">Pick the plan that fits, and add to it later.</td>
                {PLANS.map((plan) => (
                  <td key={plan.id} className="px-3 py-4 text-center" data-foot={plan.id}>
                    <div className="mx-auto flex max-w-[220px] flex-col items-center gap-2">
                      <PriceSlot plan={plan} door={door} where="foot" />
                    </div>
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </section>
  );
}
