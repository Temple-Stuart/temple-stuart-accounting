/**
 * EDGE-01 — DOES THE SCANNER HAVE EDGE? The first read of prediction
 * (trade_cards) against outcome (trade_card_links), bucketed by premium
 * direction × strategy family × model-version era.
 *
 * Alex runs it locally against Azure:
 *   DATABASE_URL="postgresql://…" npx tsx scripts/edge-read.ts --user astuart@templestuart.com
 *   (add --no-benchmark to skip the free Cboe PUT/CMBO fetch)
 *
 * READ-ONLY: no table is written. Prints AGGREGATES only — never a row.
 * Scope: one user (ruling §1) — every other user's links are counted and
 * excluded. The benchmark comes from Cboe's public CSVs at run time
 * (src/lib/edge-read/cboe.ts) and is kept nowhere; a failed fetch prints
 * "unavailable" — never a substitute.
 */
import { prisma } from '../src/lib/prisma';
import { buildReport, secondaryBookReport, type ClosedTrade, type Ticket, type TicketPositionLeg } from '../src/lib/edge-read/report';
import { honestFrame } from '../src/lib/edge-read/frame';
import { cboeHistoryUrl, fetchCboeHistory, type BenchmarkIndex, type SeriesPoint } from '../src/lib/edge-read/cboe';
import { sideFromPositionLegs } from '../src/lib/edge-read/families';
import { MIN_N } from '../src/lib/edge-read/stats';
import { familyOf } from '../src/lib/edge-read/families';
import { positionOwnershipWhere, isManualSource } from '../src/lib/tradeLog/ownership';

type Args = { user: string | null; benchmark: boolean };

function parseArgs(argv: string[]): Args {
  const args: Args = { user: null, benchmark: true };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--user') args.user = argv[i + 1] ?? null;
    if (argv[i] === '--no-benchmark') args.benchmark = false;
  }
  return args;
}

const num = (x: unknown): number | null => {
  if (x === null || x === undefined) return null;
  const v = Number(x);
  return Number.isFinite(v) ? v : null;
};

const monthKey = (d: Date) => d.toISOString().slice(0, 7);

function countBy<T>(items: readonly T[], key: (t: T) => string): [string, number][] {
  const m = new Map<string, number>();
  for (const t of items) m.set(key(t), (m.get(key(t)) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

function excludedFieldsFromTrace(trace: unknown): string[] | null {
  if (!trace || typeof trace !== 'object') return null;
  const composite = (trace as { composite?: unknown }).composite;
  if (!composite || typeof composite !== 'object') return null;
  const dc = (composite as { data_confidence?: unknown }).data_confidence;
  if (!dc || typeof dc !== 'object') return null;
  const ex = (dc as { excluded_fields?: unknown }).excluded_fields;
  return Array.isArray(ex) ? ex.filter((f): f is string => typeof f === 'string') : null;
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.user) {
    console.error('usage: DATABASE_URL=… npx tsx scripts/edge-read.ts --user <email> [--no-benchmark]');
    return 2;
  }
  const out: string[] = [];
  const say = (s = '') => out.push(s);

  say('EDGE-01 — DOES THE SCANNER HAVE EDGE? (read-only; aggregates only; nothing written)');
  say(`run at ${new Date().toISOString()}`);
  say('');
  for (const l of honestFrame()) say(l);
  say('');

  // ── scope ────────────────────────────────────────────────────────────
  const user = await prisma.users.findUnique({ where: { email: args.user }, select: { id: true, email: true } });
  if (!user) {
    console.error(`no user with email ${args.user}`);
    return 2;
  }
  const otherUsersLinks = await prisma.trade_card_links.count({ where: { trade_card: { userId: { not: user.id } } } });
  const otherUsersCards = await prisma.trade_cards.count({ where: { userId: { not: user.id } } });
  say(`SCOPE: user ${user.email} only (ruling §1 — no other user has graded trades). Other users' cards: ${otherUsersCards}; other users' links: ${otherUsersLinks} — excluded from every number below.`);
  say('');

  // ── the book ─────────────────────────────────────────────────────────
  const cards = await prisma.trade_cards.findMany({
    where: { userId: user.id },
    select: {
      id: true, symbol: true, strategy_name: true, legs: true, expiration_date: true, generated_at: true, status: true,
      composite_score: true, vol_edge_score: true, quality_score: true, regime_score: true, info_edge_score: true,
      win_rate: true, max_loss: true,
      link: { select: { trade_num: true, linked_at: true, actual_pl: true, grade: true, thesis_results: true, notes: true } },
    },
  });
  const txns = await prisma.investment_transactions.findMany({ where: { accounts: { userId: user.id } }, select: { id: true } });
  const txnIds = txns.map((t) => t.id);
  // TRADE-LOG-01: the ownership predicate, not the arrivals chain alone — a
  // hand-entered trade has no arrival, and this read would otherwise miss the
  // whole book of a user who has never connected a brokerage. `source` comes
  // back with every leg: it is the split below, never a filter.
  const positions = await prisma.trading_positions.findMany({
    where: positionOwnershipWhere(user.id, txnIds),
    select: { id: true, trade_num: true, position_type: true, open_price: true, quantity: true, open_date: true, expiration_date: true, close_date: true, status: true, strategy: true, realized_pl: true, source: true },
  });

  /**
   * TRADE-LOG-01 — THE SOURCE SPLIT. A trade is HAND-ENTERED when every leg is;
   * SYNCED when none is. A trade whose legs disagree is neither and says so —
   * it is never quietly folded into one of the two.
   */
  const sourceSplit = (legs: readonly { source: string }[]): string => {
    const manual = legs.filter((l) => isManualSource(l.source)).length;
    if (manual === 0) return 'SYNCED';
    if (manual === legs.length) return 'HAND-ENTERED';
    return 'MIXED-SOURCE';
  };

  const byTradeNum = new Map<string, typeof positions>();
  let nullTradeNum = 0;
  for (const p of positions) {
    const k = p.trade_num ?? `(null:${p.id})`;
    if (p.trade_num === null) nullTradeNum += 1;
    byTradeNum.set(k, [...(byTradeNum.get(k) ?? []), p]);
  }
  const autoTradeNum = byTradeNum.get('AUTO')?.length ?? 0;
  const linked = cards.filter((c) => c.link !== null);
  const graded = linked.filter((c) => c.link !== null && c.link.actual_pl !== null);
  const linkedTradeNums = new Set(linked.map((c) => c.link?.trade_num as string));
  const closedTrades = [...byTradeNum.entries()].filter(([, legs]) => legs.every((l) => l.status === 'CLOSED'));
  const closedUnlinked = closedTrades.filter(([k]) => !linkedTradeNums.has(k));

  say('COUNTS (the founder\'s book):');
  say(`  trade_cards: ${cards.length} — by status: ${countBy(cards, (c) => c.status).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  say(`  trade_card_links: ${linked.length}; with an outcome (actual_pl not null): ${graded.length}; with a grade: ${linked.filter((c) => c.link?.grade).length}; with thesis_results: ${linked.filter((c) => c.link?.thesis_results !== null).length}; with notes: ${linked.filter((c) => c.link?.notes).length}`);
  say(`  trading_positions rows: ${positions.length}; trades (distinct trade_num): ${byTradeNum.size}; legs with a null trade_num: ${nullTradeNum}; legs with trade_num 'AUTO': ${autoTradeNum}`);
  say(`  by source (trading_positions.source): ${countBy(positions, (p) => p.source).map(([k, v]) => `${k} ${v}`).join(', ') || '—'} — hand-entered legs ${positions.filter((p) => isManualSource(p.source)).length}; every book below splits its buckets by source (bias 3 of the honest frame)`);
  say(`  CLOSED trades: ${closedTrades.length}; CLOSED trades never linked to a card: ${closedUnlinked.length} (the gap — scored or not, no prediction meets them)`);
  say(`  linked trades whose legs are not all CLOSED (no outcome yet): ${linked.length - graded.length}`);
  say(`  links by month (linked_at): ${countBy(linked, (c) => monthKey(c.link?.linked_at as Date)).map(([k, v]) => `${k} ${v}`).join(', ') || '—'}`);
  say(`  closed trades by premium direction (position_type net premium): ${countBy(closedTrades, ([, legs]) => sideFromPositionLegs(legs.map((l) => ({ positionType: l.position_type, openPrice: l.open_price, quantity: l.quantity })))).map(([k, v]) => `${k} ${v}`).join(', ') || '—'}`);
  const nullPlLegs = positions.filter((p) => p.status === 'CLOSED' && p.realized_pl === null).length;
  say(`  CLOSED legs with a null realized_pl: ${nullPlLegs} — the link route sums them as 0 (trade-card-links/route.ts:79, :248); this read does NOT inherit that: the secondary book excludes such trades, and the primary book flags how many linked outcomes contain one`);
  say('');

  // ── snapshots for (f): same-day scan_snapshots row per linked card ───
  const tickets: Ticket[] = [];
  let snapshotsFound = 0;
  let linkedWithNullPlLeg = 0;
  for (const c of linked) {
    const legs = byTradeNum.get(c.link?.trade_num as string) ?? [];
    if (legs.some((l) => l.status === 'CLOSED' && l.realized_pl === null)) linkedWithNullPlLeg += 1;
    const from = new Date(c.generated_at.getTime() - 36 * 3600 * 1000);
    const to = new Date(c.generated_at.getTime() + 36 * 3600 * 1000);
    const snaps = await prisma.scan_snapshots.findMany({
      where: { userId: user.id, ticker: c.symbol, scanDate: { gte: from, lte: to } },
      select: { scanDate: true, imputedCount: true, fullTrace: true },
    });
    let snapshot: Ticket['snapshot'] = null;
    if (snaps.length > 0) {
      const nearest = snaps.reduce((a, b) => (Math.abs(b.scanDate.getTime() - c.generated_at.getTime()) < Math.abs(a.scanDate.getTime() - c.generated_at.getTime()) ? b : a));
      const ex = excludedFieldsFromTrace(nearest.fullTrace);
      snapshot = { excludedFields: ex ?? [], imputedCount: nearest.imputedCount };
      snapshotsFound += 1;
    }
    const cardLegs = Array.isArray(c.legs)
      ? (c.legs as unknown[]).map((l) => {
          const o = (l ?? {}) as { side?: unknown; action?: unknown; price?: unknown };
          return { side: typeof o.side === 'string' ? o.side : typeof o.action === 'string' ? o.action : null, price: num(o.price) };
        })
      : [];
    const positionLegs: TicketPositionLeg[] = legs.map((l) => ({
      positionType: l.position_type,
      openPrice: num(l.open_price),
      quantity: num(l.quantity),
      openDate: l.open_date,
      expirationDate: l.expiration_date,
      closeDate: l.close_date,
      status: l.status,
      strategyRaw: l.strategy,
    }));
    tickets.push({
      id: c.id,
      symbol: c.symbol,
      generatedAt: c.generated_at,
      cardStrategyRaw: c.strategy_name,
      cardLegs,
      cardExpirationDate: c.expiration_date,
      positionLegs,
      compositeScore: num(c.composite_score),
      volEdgeScore: num(c.vol_edge_score),
      qualityScore: num(c.quality_score),
      regimeScore: num(c.regime_score),
      infoEdgeScore: num(c.info_edge_score),
      predictedWinRatePct: num(c.win_rate),
      maxLoss: num(c.max_loss),
      actualPl: num(c.link?.actual_pl),
      grade: c.link?.grade ?? null,
      snapshot,
      // TRADE-LOG-01: provenance is one more bucket dimension. A linked card
      // with no position legs at all has no source to declare.
      split: legs.length > 0 ? sourceSplit(legs) : undefined,
    });
  }
  say(`INPUT PRESENCE SOURCE: same-day scan_snapshots row found for ${snapshotsFound} of ${linked.length} linked cards (±36 h of generated_at, nearest); the card itself records gate-level nulls only — the composite's excluded_fields are not posted to trade_cards (ConvergenceIntelligence.tsx:4480-4540 omits data_confidence).`);
  say(`  linked outcomes that contain a CLOSED leg with a null realized_pl (actual_pl includes an imputed 0 from the link route): ${linkedWithNullPlLeg} of ${linked.length}`);
  say('');

  // ── benchmark ────────────────────────────────────────────────────────
  const benchmarks: { PUT?: SeriesPoint[]; CMBO?: SeriesPoint[]; errors: Partial<Record<BenchmarkIndex, string>> } = { errors: {} };
  if (args.benchmark) {
    for (const idx of ['PUT', 'CMBO'] as const) {
      const r = await fetchCboeHistory(idx);
      if (r.ok) {
        benchmarks[idx] = r.series;
        say(`BENCHMARK ${idx}: ${r.series.length} closes from ${cboeHistoryUrl(idx)} (${r.series[0].date} → ${r.series[r.series.length - 1].date}; ${r.skipped} malformed rows skipped) — fetched at run time, kept nowhere`);
      } else {
        benchmarks.errors[idx] = r.error;
        say(`BENCHMARK ${idx}: unavailable (${r.error}) — ${cboeHistoryUrl(idx)}`);
      }
    }
  } else {
    benchmarks.errors.PUT = 'skipped (--no-benchmark)';
    benchmarks.errors.CMBO = 'skipped (--no-benchmark)';
    say('BENCHMARK: skipped (--no-benchmark) — every (h) line prints unavailable');
  }
  say('');

  // ── the read ─────────────────────────────────────────────────────────
  say(`PRIMARY BOOK — trade_card_links ⋈ trade_cards: ${tickets.length} tickets (a locked prediction meeting a realized outcome); ${MIN_N} graded tickets per bucket before any percentage.`);
  say('');
  const report = buildReport(tickets, { benchmarks });
  for (const l of report.lines) say(l);
  say('');
  const closed: ClosedTrade[] = [];
  let excludedNullPl = 0;
  for (const [k, legs] of closedTrades) {
    if (legs.some((l) => l.realized_pl === null)) {
      excludedNullPl += 1;
      continue;
    }
    closed.push({
      tradeNum: k,
      legs: legs.map((l) => ({ positionType: l.position_type, openPrice: num(l.open_price), quantity: num(l.quantity), openDate: l.open_date, expirationDate: l.expiration_date, closeDate: l.close_date, status: l.status, strategyRaw: l.strategy })),
      realizedPl: legs.reduce((s, l) => s + (l.realized_pl as number), 0),
      linked: linkedTradeNums.has(k),
      split: sourceSplit(legs),
    });
  }
  say(`SECONDARY BOOK excludes ${excludedNullPl} closed trade${excludedNullPl === 1 ? '' : 's'} with a null realized_pl leg (declared, not imputed).`);
  for (const l of secondaryBookReport(closed, { benchmarks })) say(l);
  say('');
  // ── LOG-01: the THIRD book — every scored candidate with a settled outcome ──
  say('');
  const candRows = await prisma.scan_candidates.findMany({
    where: { run: { userId: user.id } },
    select: {
      id: true, symbol: true, strategy_name: true, legs: true, expiration: true, generated_at: true, taken: true, model_era: true,
      composite_score: true, vol_edge_score: true, quality_score: true, regime_score: true, info_edge_score: true,
      pop: true, max_loss: true, excluded_fields: true, imputed_count: true,
      outcome_pl: true, outcome_at: true, outcome_source: true, outcome_reason: true,
      cards: { select: { link: { select: { trade_num: true } } } },
    },
  });
  const runCount = await prisma.scan_runs.count({ where: { userId: user.id } });
  const todayIso = new Date().toISOString().slice(0, 10);
  const settled = candRows.filter((c) => c.outcome_at !== null);
  const expiredUnsettled = candRows.filter((c) => c.outcome_at === null && c.expiration.toISOString().slice(0, 10) <= todayIso);
  const pendingCands = candRows.filter((c) => c.outcome_at === null && c.expiration.toISOString().slice(0, 10) > todayIso);
  say(`CANDIDATE BOOK (LOG-01) — every scored candidate, taken or not: ${candRows.length} candidates over ${runCount} scan runs; settled ${settled.length} (from position ${settled.filter((c) => c.taken).length}, from the price path ${settled.filter((c) => !c.taken).length}); expired but unsettled ${expiredUnsettled.length}; not yet expired ${pendingCands.length}; taken ${candRows.filter((c) => c.taken).length}`);
  say(`  runs by model era: ${countBy(candRows, (c) => c.model_era).map(([k, v]) => `${k} ${v}`).join(', ') || '—'} · candidates by strategy: ${countBy(candRows, (c) => `${c.strategy_name} → ${familyOf(c.strategy_name).family}`).map(([k, v]) => `${k} ${v}`).join(', ') || '—'}`);
  const reasons = countBy(expiredUnsettled.filter((c) => c.outcome_reason), (c) => c.outcome_reason as string);
  if (reasons.length) say(`  unsettled reasons: ${reasons.map(([k, v]) => `"${k}" ×${v}`).join('; ')}`);
  say(`  bucket = direction × family × era × TAKEN/UNTAKEN × source — the founder's picks beside the model's full output; direction for an untaken candidate is read from its own legs (no position exists); the same n floor, CI and frame as the primary book. Cards that were saved but never linked count as UNTAKEN.`);
  const candTickets: Ticket[] = settled.map((c) => {
    const tradeNum = c.cards.map((k) => k.link?.trade_num).find((t): t is string => typeof t === 'string') ?? null;
    const legs = c.taken && tradeNum ? byTradeNum.get(tradeNum) ?? [] : [];
    const cardLegs = Array.isArray(c.legs) ? (c.legs as unknown[]).map((l) => { const o = (l ?? {}) as { side?: unknown; price?: unknown }; return { side: typeof o.side === 'string' ? o.side : null, price: num(o.price) }; }) : [];
    return {
      id: c.id,
      symbol: c.symbol,
      generatedAt: c.generated_at,
      cardStrategyRaw: c.strategy_name,
      cardLegs,
      cardExpirationDate: c.expiration,
      positionLegs: legs.map((l) => ({ positionType: l.position_type, openPrice: num(l.open_price), quantity: num(l.quantity), openDate: l.open_date, expirationDate: l.expiration_date, closeDate: l.close_date, status: l.status, strategyRaw: l.strategy })),
      compositeScore: num(c.composite_score),
      volEdgeScore: num(c.vol_edge_score),
      qualityScore: num(c.quality_score),
      regimeScore: num(c.regime_score),
      infoEdgeScore: num(c.info_edge_score),
      predictedWinRatePct: c.pop === null ? null : Number(c.pop) * 100,
      maxLoss: num(c.max_loss),
      actualPl: num(c.outcome_pl),
      grade: null,
      snapshot: { excludedFields: Array.isArray(c.excluded_fields) ? (c.excluded_fields as unknown[]).filter((f): f is string => typeof f === 'string') : [], imputedCount: c.imputed_count },
      directionSource: c.taken && legs.length > 0 ? 'position_legs' : 'card_legs',
      // TAKEN/UNTAKEN × source. An UNTAKEN candidate has no position and so no
      // source: its outcome came from the price path, not from anyone's typing.
      split: `${c.taken ? 'TAKEN' : 'UNTAKEN'}${legs.length > 0 ? ` × ${sourceSplit(legs)}` : ''}`,
      // a candidate's entry is the scan that scored it; an untaken one was held to its expiration
      entryDate: legs.length > 0 ? undefined : c.generated_at,
      closeDate: legs.length > 0 ? undefined : c.expiration,
    };
  });
  if (candTickets.length === 0) {
    say(`  nothing settled yet — the first candidates settle after their expiration (${pendingCands.length} pending); this book prints in full once they do.`);
  } else {
    const candReport = buildReport(candTickets, { benchmarks });
    for (const l of candReport.lines) say(l);
  }
  say('');
  say('END — nothing was written; every number above carries its n.');
  process.stdout.write(`${out.join('\n')}\n`);
  return 0;
}

main()
  .then(async (code) => {
    await prisma.$disconnect();
    process.exit(code);
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
