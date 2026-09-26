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
//   • pending: persisted verbatim from Plaid (the one writer, sync-complete →
//     src/lib/arrivals/plaidTransactionsPage.ts:97 `pending: txn.pending || false`) and
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
  /** Integer cents (reservations.finalPriceCents), or NULL. SEC-03 (2026-09-25):
   *  NULL = the vendor stated no price → the amount signal is EXCLUDED and the
   *  weights re-normalize. A 0 is a REAL amount now (the book routes write NULL,
   *  never 0, for an unstated price), and is compared like any other. */
  finalPriceCents: number | null;
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
 *   • cross-currency reservation, or finalPriceCents NULL → amount excluded.
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
    const sameCurrency = r.currency.toUpperCase() === accountCurrency;
    // SEC-03: NULL is the one "unknown"; 0 is an amount and is compared (a real
    // $0 booking against a positive charge is a contradiction, not a wildcard).
    const amountKnown = r.finalPriceCents !== null;
    const resDollars = amountKnown ? r.finalPriceCents! / 100 : null;
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
      if (sameCurrency && resDollars !== null) {
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
        parts.push('amount: EXCLUDED — reservation price not stated by the vendor (NULL recorded)');
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

// ─── MATCH-02 (2026-09-26): REFUNDS COME HOME ────────────────────────────────
// A second pure function under the same constitution: no DB, no fetch, no clock,
// propose-only, guest-fenced by the caller, deterministic. It scores every
// (refund money event × inflow) pair — an inflow is money that came IN
// (transactions.amount < 0, the house sign) — and returns candidates a human
// accepts in the review queue. Accepting one settles the money event (the review
// route, the only writer of 'settled'); nothing here settles anything.
//
// A CANDIDATE EVENT is a money_events row the vendor stated as a REFUND, still
// 'stated' (a settled one is done), whose destination can reach a bank account:
//   · NULL — a hotel refund (cancellation.ts:91 writes no destination; LiteAPI
//     refunds a hotel to the card it charged);
//   · 'original_payment' — a flight refund back to the card (cancellation.ts:124,
//     the vendor's own word).
// 'voucher', 'agency_deposit', 'bsp_settlement', 'manual' and 'unknown' never
// land in the customer's bank as an inflow and are never candidates.
//
// A CANDIDATE INFLOW is a transaction with amount < 0 that no accepted link
// already claims (the caller passes those ids; a bank row is one thing).
//
// SIGNALS, the outflow weights (0.5 / 0.3 / 0.2), missing signals EXCLUDED and
// the weights re-normalized — never a neutral score, never an invented amount:
//   · amount — |inflow| vs the STATED amountCents/100, same currency only (the
//     event's currency = the account's). Cross-currency → EXCLUDED, named (never
//     converted by a guessed rate). amountCents NULL → the vendor did not
//     quantify the refund → EXCLUDED, named; date + descriptor carry it. An
//     account whose currency is not stated → EXCLUDED, named. Same-currency drift
//     beyond tolerance → CONTRADICTION, skipped and named.
//   · date — the inflow's date vs statedAt. HARD RULE: an inflow dated BEFORE the
//     vendor stated the refund is a CONTRADICTION (a refund cannot land before it
//     is stated): skipped, named. Window MATCH_REFUND_DATE_WINDOW_DAYS (below).
//   · descriptor — the provider vocab and the booking's name tokens as today,
//     PLUS the accepted CHARGE transaction's own name: a refund's bank descriptor
//     usually repeats the charge's. Which one matched is named.
// Every rationale names the event id, the reservation, the stated amount and
// currency, and statedAt.

/**
 * MATCH_REFUND_DATE_WINDOW_DAYS = 14. ASSUMPTION, NOT A VENDOR FACT: LiteAPI
 * documents no refund settlement time. Card networks generally post a merchant
 * refund to the cardholder 5–10 business days after the merchant issues it, and
 * the vendor may issue it days after it states it on the cancel answer; 14
 * calendar days covers that with room, without reaching the next month's
 * unrelated credits. A refund landing later is not proposed and is named in the
 * skipped list — a human can still link it by hand later (not built).
 */
export const MATCH_REFUND_DATE_WINDOW_DAYS = 14;

/** money_events.refundDestination values that reach the customer's bank as an inflow — NULL (hotel) and the vendor's 'original_payment' (flight). */
export const BANK_REACHABLE_REFUND_DESTINATIONS: ReadonlyArray<string | null> = [null, 'original_payment'];

export function isBankReachableRefund(destination: string | null): boolean {
  return BANK_REACHABLE_REFUND_DESTINATIONS.includes(destination);
}

export interface MatcherRefundEvent {
  /** money_events.id */
  id: string;
  reservationId: string;
  /** money_events.kind — only 'refund' is a candidate. */
  kind: string;
  /** money_events.status — only 'stated' is a candidate; 'settled' is done. */
  status: string;
  /** Integer cents the vendor stated, or NULL — the vendor did not quantify it. Never 0 for unknown. */
  amountCents: number | null;
  /** The vendor's currency for the stated amount, or NULL when it stated none. */
  currency: string | null;
  /** LiteAPI's own word, or NULL (hotel). */
  refundDestination: string | null;
  /** The instant the vendor stated the refund — the arrival's clock. */
  statedAt: string | Date;
  /** The reservation's provider and stated names, for the descriptor vocab. */
  provider: string;
  hotelName: string | null;
  displayName?: string | null;
  /** The bank descriptor (transactions.name) of the reservation's ACCEPTED charge link, or NULL when none is accepted. */
  chargeTransactionName: string | null;
}

export interface RefundMatcherOptions {
  /** Same-currency drift allowed, as a fraction — the outflow pass's tolerance. */
  amountTolerancePct: number;
  /** Days after statedAt an inflow may land — MATCH_REFUND_DATE_WINDOW_DAYS. */
  refundDateWindowDays: number;
}

export interface RefundMatchProposal extends MatchProposal {
  /** The refund money event this inflow is proposed against — rides onto the link as moneyEventId. */
  moneyEventId: string;
}

/** A pair the function refused, with the reason — contradictions are named, never silent. */
export interface RefundMatchSkip {
  transactionId: string;
  moneyEventId: string;
  reason: 'before_stated' | 'amount_contradiction' | 'outside_window';
  detail: string;
}

export interface RefundMatchResult {
  proposals: RefundMatchProposal[];
  skipped: RefundMatchSkip[];
}

function nameTokens(name: string | null | undefined): string[] {
  if (!name) return [];
  return name.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4);
}

/**
 * Score every (refund event × inflow) pair; return the proposals ordered
 * deterministically (confidence desc, transactionId, moneyEventId) and the
 * pairs refused by name. See the section header for the rules.
 */
export function proposeRefundMatches({
  refunds,
  transactions,
  accountCurrency,
  opts,
  excludeTransactionIds,
}: {
  refunds: MatcherRefundEvent[];
  transactions: MatcherTransaction[];
  /** The account's stated currency (accounts.isoCurrencyCode), or NULL when not stated → the amount signal is EXCLUDED. */
  accountCurrency: string | null;
  opts: RefundMatcherOptions;
  /** Inflows an accepted link already claims — never candidates. */
  excludeTransactionIds?: ReadonlySet<string>;
}): RefundMatchResult {
  const proposals: RefundMatchProposal[] = [];
  const skipped: RefundMatchSkip[] = [];
  const account = accountCurrency === null ? null : accountCurrency.toUpperCase();

  for (const e of refunds) {
    if (e.kind !== 'refund' || e.status !== 'stated') continue;
    if (!isBankReachableRefund(e.refundDestination)) continue;

    const statedDay = utcDay(e.statedAt);
    const statedAtIso = typeof e.statedAt === 'string' ? e.statedAt : e.statedAt.toISOString();
    const eventCurrency = e.currency === null ? null : e.currency.toUpperCase();
    const refundDollars = e.amountCents === null ? null : e.amountCents / 100;
    const statedWords = refundDollars === null
      ? 'no amount stated'
      : `${refundDollars.toFixed(2)} ${eventCurrency ?? '(no currency stated)'}`;
    const head = `refund: money event ${e.id} of booking ${e.reservationId}, vendor stated ${statedWords} at ${statedAtIso}`;
    const vocab = PROVIDER_VOCAB[e.provider.toLowerCase()] ?? [e.provider.toLowerCase()];
    const bookingTokens = [...new Set([...hotelTokens(e.hotelName), ...nameTokens(e.displayName)])];
    const chargeTokens = nameTokens(e.chargeTransactionName);

    for (const t of transactions) {
      // An inflow is money that came in. Outflows and zero rows are never candidates.
      if (!(t.amount < 0)) continue;
      if (excludeTransactionIds?.has(t.id)) continue;

      const parts: string[] = [head];
      const scores: Array<{ w: number; s: number }> = [];
      const inflow = Math.abs(t.amount);

      // ── AMOUNT ───────────────────────────────────────────────────────────
      if (refundDollars === null) {
        parts.push('amount: EXCLUDED — the vendor did not quantify this refund (NULL recorded); date + descriptor carry this proposal');
      } else if (account === null) {
        parts.push('amount: EXCLUDED — the account currency is not stated (accounts.isoCurrencyCode NULL); date + descriptor carry this proposal');
      } else if (eventCurrency === null || eventCurrency !== account) {
        parts.push(
          `amount: EXCLUDED — refund currency ${eventCurrency ?? '(not stated)'} ≠ account ${account} ` +
          '(never converted by guess); date + descriptor carry this proposal'
        );
      } else {
        // A stated 0 is a real amount: any non-zero inflow contradicts it.
        const driftPct = refundDollars === 0 ? (inflow === 0 ? 0 : Number.POSITIVE_INFINITY) : Math.abs(inflow - refundDollars) / refundDollars;
        if (driftPct > opts.amountTolerancePct) {
          skipped.push({ transactionId: t.id, moneyEventId: e.id, reason: 'amount_contradiction', detail: `inflow ${inflow.toFixed(2)} vs stated ${refundDollars.toFixed(2)} ${eventCurrency}: drift ${Number.isFinite(driftPct) ? `${(driftPct * 100).toFixed(1)}%` : 'total'} > ${(opts.amountTolerancePct * 100).toFixed(1)}% tolerance` });
          continue;
        }
        scores.push({ w: W_AMOUNT, s: 1 - driftPct / opts.amountTolerancePct });
        parts.push(
          `amount: inflow ${inflow.toFixed(2)} vs stated ${refundDollars.toFixed(2)} ${eventCurrency} ` +
          `(drift ${(driftPct * 100).toFixed(1)}% ≤ ${(opts.amountTolerancePct * 100).toFixed(1)}% tolerance)`
        );
      }

      // ── DATE ─────────────────────────────────────────────────────────────
      // The inflow's own date decides the hard rule; the authorized date, when
      // present and not before statedAt, may shorten the distance and is named.
      const dateDay = utcDay(t.date);
      if (dateDay < statedDay) {
        skipped.push({ transactionId: t.id, moneyEventId: e.id, reason: 'before_stated', detail: `inflow dated ${statedDay - dateDay}d BEFORE the vendor stated the refund at ${statedAtIso} — a refund cannot land before it is stated` });
        continue;
      }
      const txnDays: Array<{ label: string; day: number }> = [
        { label: 'date', day: dateDay },
        ...(t.authorized_date ? [{ label: 'authorized_date', day: utcDay(t.authorized_date) }] : []),
      ].filter((d) => d.day >= statedDay);
      let best: { label: string; dist: number } | null = null;
      for (const td of txnDays) {
        const dist = td.day - statedDay;
        if (best === null || dist < best.dist) best = { label: td.label, dist };
      }
      // `date` itself passed the hard rule, so best is always set.
      if (best === null || best.dist > opts.refundDateWindowDays) {
        skipped.push({ transactionId: t.id, moneyEventId: e.id, reason: 'outside_window', detail: `inflow ${best === null ? '?' : best.dist}d after statedAt ${statedAtIso}, beyond the ${opts.refundDateWindowDays}d window` });
        continue;
      }
      scores.push({ w: W_DATE, s: 1 - best.dist / opts.refundDateWindowDays });
      parts.push(`date: txn ${best.label} ${best.dist}d after statedAt (window ${opts.refundDateWindowDays}d)`);

      // ── DESCRIPTOR ───────────────────────────────────────────────────────
      const haystack = `${t.name} ${t.merchantName ?? ''}`.toLowerCase();
      const vocabHit = vocab.find((v) => haystack.includes(v)) ?? null;
      const bookingHit = bookingTokens.find((w) => haystack.includes(w)) ?? null;
      const chargeHit = chargeTokens.find((w) => haystack.includes(w)) ?? null;
      const hits = [
        ...(vocabHit ? [`provider vocab '${vocabHit}'`] : []),
        ...(bookingHit ? [`booking name token '${bookingHit}'`] : []),
        ...(chargeHit ? [`the accepted charge's descriptor token '${chargeHit}' (charge "${e.chargeTransactionName}")`] : []),
      ];
      scores.push({ w: W_DESCRIPTOR, s: hits.length > 0 ? 1 : 0 });
      parts.push(
        hits.length > 0
          ? `descriptor: "${t.name}" matched ${hits.join(' + ')}`
          : `descriptor: "${t.name}" matched nothing (provider vocab ${JSON.stringify(vocab)}${bookingTokens.length ? `, booking tokens ${JSON.stringify(bookingTokens)}` : ''}${chargeTokens.length ? `, charge tokens ${JSON.stringify(chargeTokens)}` : ', no accepted charge to compare'})`
      );

      if (t.pending) parts.push('note: transaction is PENDING — amount may still settle differently');

      // ── CONFIDENCE: weighted over PRESENT signals, re-normalized ─────────
      const wSum = scores.reduce((a, x) => a + x.w, 0);
      const confidence = round3(scores.reduce((a, x) => a + x.w * x.s, 0) / wSum);

      proposals.push({ transactionId: t.id, reservationId: e.reservationId, moneyEventId: e.id, confidence, rationale: parts.join('; ') });
    }
  }

  proposals.sort(
    (a, b) =>
      b.confidence - a.confidence ||
      a.transactionId.localeCompare(b.transactionId) ||
      a.moneyEventId.localeCompare(b.moneyEventId)
  );
  skipped.sort((a, b) => a.transactionId.localeCompare(b.transactionId) || a.moneyEventId.localeCompare(b.moneyEventId));
  return { proposals, skipped };
}
