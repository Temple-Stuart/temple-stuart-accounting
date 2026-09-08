'use client';

/**
 * SELL-02 — THE ONE CARD every selling surface renders: the deck's modules act,
 * /pricing, the /modules pages' access block and the cockpit's locked tabs
 * (LockedTabCard). It draws from an OfferCardModel (src/lib/offer.ts offerCard):
 * the label, the four Answers line, each tool with its REGISTRY claim line
 * (claimLine(): the LIVE wording for LIVE only, "partial — <beats>" for PARTIAL), the
 * price line — the number only when the const AND the Stripe price id both
 * exist — and the door. When the price is not live there is NO buy button:
 * the declared line stands alone. Zero fetches, zero reads: the caller owns
 * the checkout call (src/lib/checkoutDoor.ts) or hands a link.
 */

import Link from 'next/link';
import type { OfferCardModel, OfferToolLine } from '@/lib/offer';

export type OfferDoor =
  | { kind: 'button'; onClick: () => void; busy?: boolean }
  | { kind: 'link'; href: string };

const STATUS_CHIP: Record<OfferToolLine['status'], string> = {
  LIVE: 'border-status-success/40 text-status-success',
  PARTIAL: 'border-brand-amber/50 text-brand-amber',
  NOT_BUILT: 'border-border text-text-faint',
};

export default function OfferCard({ card, door, highlight = [], error, tone = 'light' }: {
  card: OfferCardModel;
  door: OfferDoor;
  /** Tool names to set in bold — the tab a locked card sits on. */
  highlight?: readonly string[];
  /** A checkout failure, declared under the button. */
  error?: string;
  tone?: 'light' | 'dark';
}) {
  const dark = tone === 'dark';
  const frame = dark ? 'border-panel-border bg-panel text-white' : 'border-border bg-white text-text-primary';
  const muted = dark ? 'text-white/60' : 'text-text-muted';
  const faint = dark ? 'text-white/40' : 'text-text-faint';
  const buttonClass = dark
    ? 'bg-white px-5 py-2 text-sm font-semibold text-brand-purple hover:bg-bg-row disabled:opacity-60'
    : 'rounded-lg bg-brand-purple px-5 py-2 text-sm font-semibold text-white hover:bg-brand-purple/90 disabled:opacity-60';
  const doorLabel = `Subscribe to ${card.label} — ${card.price.text}`;

  return (
    <div className={`flex flex-col gap-4 rounded-lg border p-5 ${frame}`} data-offer={card.key} data-buyable={card.buyable}>
      <div>
        <span className={`rounded border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${dark ? 'border-white/20 text-white/70' : 'border-brand-purple/30 text-brand-purple'}`}>
          {card.label}
        </span>
        {card.includesAnswers && (
          <p className={`mt-2 text-xs ${muted}`} data-includes-answers>Includes the four Answers — tax, runway, trading, business — on your own lines.</p>
        )}
      </div>
      <ul className="space-y-1.5" data-offer-tools>
        {card.tools.map((t) => {
          const bold = highlight.includes(t.name);
          return (
            <li key={t.name} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm" data-tool={t.name} data-status={t.status}>
              <span className={bold ? 'font-bold' : ''}>{t.name}</span>
              <span className={`rounded border px-1.5 py-px font-mono text-[10px] uppercase tracking-wider ${STATUS_CHIP[t.status]}`}>{t.status.toLowerCase().replace('_', ' ')}</span>
              <span className={`text-xs ${muted}`} data-claim>{t.claim}</span>
            </li>
          );
        })}
      </ul>
      <p className={`font-mono ${card.price.kind === 'live' ? 'text-lg font-bold' : `text-xs italic ${faint}`}`} data-price-kind={card.price.kind}>
        {card.price.text}
      </p>
      {card.buyable && door.kind === 'button' && (
        <button type="button" onClick={door.onClick} disabled={door.busy} className={buttonClass} data-offer-door="button">
          {door.busy ? 'Starting checkout…' : doorLabel}
        </button>
      )}
      {card.buyable && door.kind === 'link' && (
        <Link href={door.href} className={`inline-block text-center ${buttonClass}`} data-offer-door="link">
          {doorLabel}
        </Link>
      )}
      {error && <p role="alert" className="text-sm text-brand-red">{error}</p>}
      <p className={`font-mono text-[10px] uppercase tracking-wider ${faint}`}>Billed monthly · cancel anytime</p>
    </div>
  );
}
