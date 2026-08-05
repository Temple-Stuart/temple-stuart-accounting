// ─── Reservation ↔ transaction matcher engine (PR-MATCH-1) ───────────────────
// PURE, PROPOSE-ONLY: no DB access, no fetch, no writes — callers (MATCH-2)
// persist proposals into transaction_reservation_links and humans review them
// there. NEVER auto-links: the output is candidates with confidence +
// auditable rationale, nothing else.
//
// HOUSE SEMANTICS (STEP 0, verified):
//   • transactions.amount: POSITIVE = outflow/spend — the exact convention the
//     analytics consumers use (personal/expense-analytics/route.ts:35 filters
//     amount>0 and sums it as totalOutflow/totalSpend :69,105;
//     admin/fix-entity-assignment/route.ts:180 `isExpense = txn.amount > 0`).
//     Bookings are spend → only amount > 0 transactions are candidates
//     (refunds/credits are out of MATCH-1 scope).
//   • pending: persisted verbatim from Plaid (plaid/sync/route.ts:111,123) and
//     NOT excluded by the analytics consumers — so the matcher includes
//     pending transactions but SAYS SO in the rationale (a pending amount can
//     still settle differently; the reviewer sees the flag).
//   • Missing signals are EXCLUDED and the remaining weights RE-NORMALIZED —
//     never imputed as neutral scores (the info-edge.ts KILL-5 pattern,
//     src/lib/convergence/info-edge.ts:75-79, and the repo constitution).
//
// GUEST FENCE (MATCH-0 ruling): callers MUST pass userId-SCOPED reservations
// only (WHERE userId = authedUser.id). Guest reservations have userId null and
// are unmatchable until the MATCH-4 claim-flow ruling — they must never reach
// this function.
//
// DETERMINISM: same inputs → same ordered output (confidence desc, then
// transactionId, then reservationId; no clocks, no randomness). Every
// contributing signal and its values are named in `rationale` — auditable by
// a CPA (the house bar).

export interface MatcherReservation {
  id: string;
  /** Integer cents (reservations.finalPriceCents). 0 = price unknown (the
   *  book routes' `?? 0` fallback) → the amount signal is EXCLUDED, never
   *  compared against a known-false zero. */
  finalPriceCents: number;
  /** ISO 4217 (reservations.currency). */
  currency: string;
  /** 'liteapi' | 'duffel' | 'viator' | … (reservations.provider). */
  provider: string;
  /** Hotels persist it (liteapi/book/route.ts:181); flight rows are null (D3)
   *  — their descriptor signal is provider vocab only. */
  hotelName: string | null;
  /** Booking time — the primary date anchor (the card charge fires at/near
   *  booking). */
  createdAt: string | Date;
  /** Stay window — secondary anchors when present (hotels; null on flights). */
  checkinDate?: string | Date | null;
  checkoutDate?: string | Date | null;
}

export interface MatcherTransaction {
  id: string;
  /** HOUSE: positive = outflow (see header). Dollars, account currency. */
  amount: number;
  date: string | Date;
  authorized_date?: string | Date | null;
  name: string;
  merchantName?: string | null;
  pending?: boolean;
}

export interface MatcherOptions {
  /** Amount drift allowed, as a fraction (0.05 = ±5%) — FX spreads and card
   *  fees are exactly why this is a parameter, not a constant. */
  amountTolerancePct: number;
  /** Days a transaction may sit from the nearest date anchor. */
  dateWindowDays: number;
  /** The currency transactions.amount is denominated in. Plaid rows carry NO
   *  currency column (schema.prisma transactions:414-449), so this is the
   *  caller's declaration — default 'USD'. A reservation in any OTHER
   *  currency gets its amount signal EXCLUDED (never converted by a guessed
   *  rate); date + descriptor must carry the proposal and the rationale says
   *  so. */
  accountCurrency?: string;
}

export interface MatchProposal {
  transactionId: string;
  reservationId: string;
  /** 0-1, weighted over PRESENT signals only (re-normalized). */
  confidence: number;
  /** Every contributing signal with its values; exclusions named. */
  rationale: string;
}

// Signal weights (re-normalized over the PRESENT set — an excluded signal's
// weight is redistributed, never scored as neutral).
const W_AMOUNT = 0.5;
const W_DATE = 0.3;
const W_DESCRIPTOR = 0.2;

/** Provider → bank-descriptor vocabulary. LiteAPI charges ride Nuitee's
 *  processing (FLIGHT-LITE-1: Nuitee Connect creates the Stripe intent), so
 *  both names are searched. Unknown providers fall back to their own key. */
const PROVIDER_VOCAB: Record<string, string[]> = {
  liteapi: ['liteapi', 'nuitee'],
  duffel: ['duffel'],
  viator: ['viator'],
};

const MS_PER_DAY = 86_400_000;

/** Calendar-day number (UTC) — date-only comparison, viewer-zone-proof. */
function utcDay(d: string | Date): number {
  const t = typeof d === 'string' ? Date.parse(d) : d.getTime();
  return Math.floor(t / MS_PER_DAY);
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Words usable as descriptor tokens from a hotel name (≥4 chars keeps 'the',
 *  'inn'-noise out while 'hilton'/'marriott'/'canggu' survive). */
function hotelTokens(hotelName: string | null): string[] {
  if (!hotelName) return [];
  return hotelName
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4);
}

/**
 * Score every (reservation × transaction) pair and return the surviving
 * proposals, ordered deterministically. See the module header for semantics;
 * hard disqualifiers (vs excluded signals):
 *   • txn.amount <= 0                                  → not a spend, skip.
 *   • same-currency amount drift beyond tolerance      → CONTRADICTION, skip
 *     (a present-but-failed amount is evidence against, not a weak signal).
 *   • no date anchor within dateWindowDays             → skip.
 * Exclusions (signal absent → weight re-normalized, named in rationale):
 *   • cross-currency reservation, or finalPriceCents 0 → amount excluded.
 */
export function proposeMatches({
  reservations,
  transactions,
  opts,
}: {
  reservations: MatcherReservation[];
  transactions: MatcherTransaction[];
  opts: MatcherOptions;
}): MatchProposal[] {
  const accountCurrency = (opts.accountCurrency ?? 'USD').toUpperCase();
  const proposals: MatchProposal[] = [];

  for (const r of reservations) {
    const resDollars = r.finalPriceCents / 100;
    const sameCurrency = r.currency.toUpperCase() === accountCurrency;
    const amountKnown = r.finalPriceCents > 0;
    const tokens = hotelTokens(r.hotelName);
    const vocab = PROVIDER_VOCAB[r.provider.toLowerCase()] ?? [r.provider.toLowerCase()];
    const bookedDay = utcDay(r.createdAt);
    const checkinDay = r.checkinDate ? utcDay(r.checkinDate) : null;
    const checkoutDay = r.checkoutDate ? utcDay(r.checkoutDate) : null;

    for (const t of transactions) {
      // HOUSE sign semantics: bookings are outflows; non-positive rows are
      // not spend and never candidates.
      if (!(t.amount > 0)) continue;

      const parts: string[] = [];
      const scores: Array<{ w: number; s: number }> = [];

      // ── AMOUNT ───────────────────────────────────────────────────────────
      if (sameCurrency && amountKnown) {
        const driftPct = Math.abs(t.amount - resDollars) / resDollars;
        if (driftPct > opts.amountTolerancePct) continue; // contradiction → no proposal
        const s = 1 - driftPct / opts.amountTolerancePct;
        scores.push({ w: W_AMOUNT, s });
        parts.push(
          `amount: $${t.amount.toFixed(2)} vs booked $${resDollars.toFixed(2)} ` +
          `(drift ${(driftPct * 100).toFixed(1)}% ≤ ${(opts.amountTolerancePct * 100).toFixed(1)}% tolerance)`
        );
      } else if (!sameCurrency) {
        parts.push(
          `amount: EXCLUDED — reservation currency ${r.currency.toUpperCase()} ≠ account ${accountCurrency} ` +
          `(never converted by guess); date + descriptor carry this proposal`
        );
      } else {
        parts.push('amount: EXCLUDED — reservation price unknown (0 cents recorded)');
      }

      // ── DATE ─────────────────────────────────────────────────────────────
      // Nearest anchor: booking day, or inside the stay window (distance 0),
      // or the nearest window edge. Both txn dates are tried; the better one
      // is used and named.
      const txnDays: Array<{ label: string; day: number }> = [
        { label: 'date', day: utcDay(t.date) },
        ...(t.authorized_date ? [{ label: 'authorized_date', day: utcDay(t.authorized_date) }] : []),
      ];
      let best: { label: string; dist: number; anchor: string } | null = null;
      for (const td of txnDays) {
        const candidates: Array<{ dist: number; anchor: string }> = [
          { dist: Math.abs(td.day - bookedDay), anchor: 'booking date' },
        ];
        if (checkinDay !== null && checkoutDay !== null) {
          const inWindow = td.day >= checkinDay && td.day <= checkoutDay;
          candidates.push({
            dist: inWindow ? 0 : Math.min(Math.abs(td.day - checkinDay), Math.abs(td.day - checkoutDay)),
            anchor: 'stay window',
          });
        }
        for (const c of candidates) {
          if (best === null || c.dist < best.dist) best = { label: td.label, dist: c.dist, anchor: c.anchor };
        }
      }
      // createdAt always exists → best is always set; outside the window → skip.
      if (best === null || best.dist > opts.dateWindowDays) continue;
      const dateScore = 1 - best.dist / opts.dateWindowDays;
      scores.push({ w: W_DATE, s: dateScore });
      parts.push(`date: txn ${best.label} ${best.dist}d from ${best.anchor} (window ${opts.dateWindowDays}d)`);

      // ── DESCRIPTOR ───────────────────────────────────────────────────────
      // Always present (name is required); a miss scores 0 within its weight
      // (that's a failed signal, not an absent one — no re-normalization).
      const haystack = `${t.name} ${t.merchantName ?? ''}`.toLowerCase();
      const vocabHit = vocab.find((v) => haystack.includes(v)) ?? null;
      const tokenHit = tokens.find((w) => haystack.includes(w)) ?? null;
      const descScore = vocabHit || tokenHit ? 1 : 0;
      scores.push({ w: W_DESCRIPTOR, s: descScore });
      parts.push(
        vocabHit || tokenHit
          ? `descriptor: "${t.name}" matched ${vocabHit ? `provider vocab '${vocabHit}'` : ''}` +
            `${vocabHit && tokenHit ? ' + ' : ''}${tokenHit ? `hotel token '${tokenHit}'` : ''}`
          : `descriptor: "${t.name}" matched nothing (provider vocab ${JSON.stringify(vocab)}${tokens.length ? `, hotel tokens ${JSON.stringify(tokens)}` : ''})`
      );

      if (t.pending) parts.push('note: transaction is PENDING — amount may still settle differently');

      // ── CONFIDENCE: weighted over PRESENT signals, re-normalized ─────────
      const wSum = scores.reduce((a, x) => a + x.w, 0);
      const confidence = round3(scores.reduce((a, x) => a + x.w * x.s, 0) / wSum);

      proposals.push({
        transactionId: t.id,
        reservationId: r.id,
        confidence,
        rationale: parts.join('; '),
      });
    }
  }

  proposals.sort(
    (a, b) =>
      b.confidence - a.confidence ||
      a.transactionId.localeCompare(b.transactionId) ||
      a.reservationId.localeCompare(b.reservationId)
  );
  return proposals;
}
