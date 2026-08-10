import { themed, type Surface } from '@/lib/ds';
// LANG-1: persistent, visible data-not-advice disclaimer for the Trade surfaces.
// Positioning only — no logic. Styled with app tokens (border-border, text-text-muted,
// white-sans). Rendered at the top of the Trade tab flush section AND above the card
// results, so it is never hidden behind a tooltip or scroll.
//
// COPY IS A DRAFT — FLAGGED FOR ATTORNEY REVIEW before relying on it legally.

export default function TradingDataDisclaimer({ surface = 'light' }: { surface?: Surface } = {}) {
  const dk = surface === 'dark';
  return (
    <p
      role="note"
      className="rounded-lg border border-panel-border bg-white/5 px-3 py-2 font-mono text-[11px] text-white/50"
    >
      Data and analytics only — not investment advice or a recommendation. All metrics are
      computed from market data; you make all trading decisions. Options involve substantial
      risk of loss.
    </p>
  );
}
