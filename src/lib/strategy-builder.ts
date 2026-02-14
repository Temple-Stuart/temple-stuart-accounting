// Strategy Builder — client-side option strategy generation
// No API calls; purely computes from chain + Greeks data

// ─── Math Utilities ─────────────────────────────────────────────────

// Standard normal CDF — Abramowitz & Stegun approximation
function normalCDF(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + p * absX);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
  return 0.5 * (1 + sign * y);
}

// HV-adjusted PoP for credit strategies — uses realized vol instead of IV-inflated delta
const CREDIT_STRATEGIES = ['Iron Condor', 'Put Credit Spread', 'Call Credit Spread', 'Short Strangle', 'Short Straddle', 'Jade Lizard'];

function computeHvAdjustedPoP(
  card: StrategyCard,
  price: number,
  hv30: number,  // decimal (e.g. 0.247 for 24.7%)
  dte: number
): number {
  if (!CREDIT_STRATEGIES.includes(card.name)) return card.pop ?? 0; // debit: keep delta PoP
  if (!hv30 || hv30 <= 0) return card.pop ?? 0; // no HV data: keep delta PoP

  const vol = price * hv30 * Math.sqrt(dte / 365);
  if (vol <= 0) return card.pop ?? 0;

  const shortPuts = card.legs.filter(l => l.side === 'sell' && l.type === 'put');
  const shortCalls = card.legs.filter(l => l.side === 'sell' && l.type === 'call');
  const credit = card.netCredit || 0;

  if (shortPuts.length > 0 && shortCalls.length > 0) {
    // Two-sided: iron condor, short strangle, jade lizard
    const beLow = Math.min(...shortPuts.map(l => l.strike)) - credit;
    const beHigh = Math.max(...shortCalls.map(l => l.strike)) + credit;
    const zDown = (price - beLow) / vol;
    const zUp = (beHigh - price) / vol;
    return Math.max(0, Math.min(1, normalCDF(zDown) + normalCDF(zUp) - 1));
  } else if (shortPuts.length > 0) {
    // Put credit spread
    const beLow = Math.min(...shortPuts.map(l => l.strike)) - credit;
    const z = (price - beLow) / vol;
    return Math.max(0, Math.min(1, normalCDF(z)));
  } else if (shortCalls.length > 0) {
    // Call credit spread
    const beHigh = Math.max(...shortCalls.map(l => l.strike)) + credit;
    const z = (beHigh - price) / vol;
    return Math.max(0, Math.min(1, normalCDF(z)));
  }
  return card.pop ?? 0;
}

// ─── Types ──────────────────────────────────────────────────────────

export interface StrikeData {
  strike: number;
  callBid: number | null;
  callAsk: number | null;
  putBid: number | null;
  putAsk: number | null;
  callDelta: number | null;
  putDelta: number | null;
  callTheta: number | null;
  putTheta: number | null;
  callGamma: number | null;
  putGamma: number | null;
  callVega: number | null;
  putVega: number | null;
  callIv: number | null;
  putIv: number | null;
  callVolume: number | null;
  putVolume: number | null;
  callOI: number | null;
  putOI: number | null;
  callWideSpread: boolean;
  putWideSpread: boolean;
}

export interface StrategyLeg {
  type: 'call' | 'put';
  side: 'buy' | 'sell';
  strike: number;
  price: number; // entry price (positive)
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  wideSpread: boolean;
}

export interface StrategyCard {
  name: string;
  label: string; // e.g. "A", "B", "C"
  legs: StrategyLeg[];
  expiration: string;
  dte: number;
  netCredit: number | null; // positive = credit received
  netDebit: number | null;  // positive = debit paid
  maxProfit: number | null;  // dollars per contract
  maxLoss: number | null;    // dollars per contract (null = unlimited)
  breakevens: number[];
  pop: number | null;        // probability of profit 0-1
  riskReward: number | null;
  netDelta: number;
  netGamma: number;
  netTheta: number;
  netVega: number;
  thetaPerDay: number;       // positive = collecting, negative = paying
  isUnlimited: boolean;      // unlimited risk or profit
  pnlPoints: { price: number; pnl: number }[];
  hasWideSpread: boolean;
  ev: number;                // expected value in dollars
  evPerRisk: number;         // EV per dollar risked
  hvPop: number | null;      // HV-adjusted PoP for credit strategies
}

export interface GenerateParams {
  strikes: StrikeData[];
  currentPrice: number;
  ivRank: number;
  expiration: string;
  dte: number;
  symbol?: string; // for debug logging
  iv30?: number;   // implied volatility decimal (e.g. 0.42 for 42%)
  hv30?: number;   // 30-day HV decimal (e.g. 0.25 for 25%)
}

// ─── Tier 1: Strategy Labels ────────────────────────────────────────

export interface StrategyLabel {
  name: string;
  type: 'credit' | 'debit' | 'neutral';
}

export function getStrategyLabels(ivRank: number): StrategyLabel[] {
  // ivRank is 0-1 scale from API; multiply by 100 for percentage
  const pct = ivRank * 100;
  if (pct > 70) return [
    { name: 'Iron Condor', type: 'credit' },
    { name: 'Put Credit Spread', type: 'credit' },
    { name: 'Short Strangle', type: 'credit' },
  ];
  if (pct > 50) return [
    { name: 'Iron Condor', type: 'credit' },
    { name: 'Put Credit Spread', type: 'credit' },
    { name: 'Call Credit Spread', type: 'credit' },
  ];
  if (pct > 30) return [
    { name: 'Bull Call Spread', type: 'debit' },
    { name: 'Iron Condor', type: 'neutral' },
    { name: 'Jade Lizard', type: 'credit' },
  ];
  if (pct > 20) return [
    { name: 'Bull Call Spread', type: 'debit' },
    { name: 'Calendar Spread', type: 'neutral' },
    { name: 'Diagonal Spread', type: 'neutral' },
  ];
  return [
    { name: 'Long Straddle', type: 'debit' },
    { name: 'Long Strangle', type: 'debit' },
    { name: 'Debit Spread', type: 'debit' },
  ];
}

// ─── Helpers ────────────────────────────────────────────────────────

function mid(bid: number | null, ask: number | null): number | null {
  if (bid != null && ask != null) return (bid + ask) / 2;
  if (bid != null) return bid;
  if (ask != null) return ask;
  return null;
}

function findByDelta(
  strikes: StrikeData[],
  target: number,
  side: 'call' | 'put'
): StrikeData | null {
  let best: StrikeData | null = null;
  let bestDiff = Infinity;
  for (const s of strikes) {
    const d = side === 'call' ? s.callDelta : s.putDelta;
    if (d == null) continue;
    const diff = Math.abs(d - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = s;
    }
  }
  return best;
}

function nextStrikeBelow(strikes: StrikeData[], refStrike: number): StrikeData | null {
  const below = strikes.filter(s => s.strike < refStrike).sort((a, b) => b.strike - a.strike);
  return below[0] || null;
}

function nextStrikeAbove(strikes: StrikeData[], refStrike: number): StrikeData | null {
  const above = strikes.filter(s => s.strike > refStrike).sort((a, b) => a.strike - b.strike);
  return above[0] || null;
}

function makeLeg(
  strike: StrikeData,
  type: 'call' | 'put',
  side: 'buy' | 'sell'
): StrategyLeg | null {
  const bid = type === 'call' ? strike.callBid : strike.putBid;
  const ask = type === 'call' ? strike.callAsk : strike.putAsk;
  const price = side === 'sell' ? bid : ask;
  if (price == null || price <= 0) return null;
  const delta = (type === 'call' ? strike.callDelta : strike.putDelta) ?? 0;
  const gamma = (type === 'call' ? strike.callGamma : strike.putGamma) ?? 0;
  const theta = (type === 'call' ? strike.callTheta : strike.putTheta) ?? 0;
  const vega = (type === 'call' ? strike.callVega : strike.putVega) ?? 0;

  return {
    type,
    side,
    strike: strike.strike,
    price,
    delta: side === 'sell' ? -delta : delta,
    gamma: side === 'sell' ? -gamma : gamma,
    theta: side === 'sell' ? -theta : theta,
    vega: side === 'sell' ? -vega : vega,
    wideSpread: type === 'call' ? strike.callWideSpread : strike.putWideSpread,
  };
}

function computePnlPoints(legs: StrategyLeg[], currentPrice: number): { price: number; pnl: number }[] {
  // Extend range to cover all strikes with margin so diagrams show full loss tails
  const allStrikes = legs.map(l => l.strike);
  const minStrike = Math.min(...allStrikes);
  const maxStrike = Math.max(...allStrikes);
  const spread = Math.max(maxStrike - minStrike, currentPrice * 0.1);
  const lo = Math.max(0, Math.min(currentPrice * 0.85, minStrike - spread));
  const hi = Math.max(currentPrice * 1.15, maxStrike + spread);
  const step = (hi - lo) / 50;
  const points: { price: number; pnl: number }[] = [];
  for (let p = lo; p <= hi + 0.01; p += step) {
    let pnl = 0;
    for (const leg of legs) {
      const intrinsic = leg.type === 'call'
        ? Math.max(0, p - leg.strike)
        : Math.max(0, leg.strike - p);
      if (leg.side === 'buy') {
        pnl += (intrinsic - leg.price) * 100;
      } else {
        pnl += (leg.price - intrinsic) * 100;
      }
    }
    points.push({ price: Math.round(p * 100) / 100, pnl: Math.round(pnl * 100) / 100 });
  }
  return points;
}

function buildCard(
  name: string,
  label: string,
  legs: StrategyLeg[],
  expiration: string,
  dte: number,
  currentPrice: number,
  isUnlimited: boolean
): StrategyCard {
  let netCredit: number | null = null;
  let netDebit: number | null = null;
  let cashFlow = 0; // positive = net credit
  for (const leg of legs) {
    if (leg.side === 'sell') cashFlow += leg.price;
    else cashFlow -= leg.price;
  }
  if (cashFlow >= 0) {
    netCredit = Math.round(cashFlow * 100) / 100;
  } else {
    netDebit = Math.round(Math.abs(cashFlow) * 100) / 100;
  }

  const pnlPoints = computePnlPoints(legs, currentPrice);
  const pnls = pnlPoints.map(p => p.pnl);
  const maxProfit = Math.round(Math.max(...pnls) * 100) / 100;

  // Compute max loss analytically at critical prices (0, each strike, high price)
  // rather than relying on sampled points which may miss the true worst case
  let maxLoss: number | null = null;
  if (!isUnlimited) {
    const criticalPrices = [0, ...legs.map(l => l.strike), Math.max(...legs.map(l => l.strike)) * 2];
    let worstPnl = 0;
    for (const p of criticalPrices) {
      let pnl = 0;
      for (const leg of legs) {
        const intrinsic = leg.type === 'call'
          ? Math.max(0, p - leg.strike)
          : Math.max(0, leg.strike - p);
        pnl += leg.side === 'buy' ? (intrinsic - leg.price) * 100 : (leg.price - intrinsic) * 100;
      }
      worstPnl = Math.min(worstPnl, pnl);
    }
    maxLoss = Math.round(Math.abs(worstPnl) * 100) / 100;
  }

  // Breakevens: where P&L crosses zero
  const breakevens: number[] = [];
  for (let i = 1; i < pnlPoints.length; i++) {
    const prev = pnlPoints[i - 1];
    const curr = pnlPoints[i];
    if ((prev.pnl <= 0 && curr.pnl > 0) || (prev.pnl >= 0 && curr.pnl < 0)) {
      // Linear interpolation
      const ratio = Math.abs(prev.pnl) / (Math.abs(prev.pnl) + Math.abs(curr.pnl));
      breakevens.push(Math.round((prev.price + ratio * (curr.price - prev.price)) * 100) / 100);
    }
  }

  const netDelta = legs.reduce((s, l) => s + l.delta, 0);
  const netGamma = legs.reduce((s, l) => s + l.gamma, 0);
  const netTheta = legs.reduce((s, l) => s + l.theta, 0);
  const netVega = legs.reduce((s, l) => s + l.vega, 0);
  const thetaPerDay = Math.round(netTheta * 100 * 100) / 100; // theta * 100 contracts scaling

  // Pop approximation
  let pop: number | null = null;
  if (cashFlow >= 0) {
    // Credit strategy: PoP ≈ 1 - sum of |short deltas in direction of risk|
    const shortPutDelta = legs.filter(l => l.side === 'sell' && l.type === 'put').reduce((s, l) => s + Math.abs(l.delta), 0);
    const shortCallDelta = legs.filter(l => l.side === 'sell' && l.type === 'call').reduce((s, l) => s + Math.abs(l.delta), 0);
    pop = Math.max(0, Math.min(1, 1 - shortPutDelta - shortCallDelta));
  } else {
    // Debit strategy: PoP ≈ delta of the long leg
    const longLegs = legs.filter(l => l.side === 'buy');
    if (longLegs.length > 0) {
      pop = Math.abs(longLegs[0].delta);
    }
  }

  const riskReward = maxLoss != null && maxLoss > 0 ? Math.round((maxProfit / maxLoss) * 100) / 100 : null;

  return {
    name, label, legs, expiration, dte,
    netCredit, netDebit,
    maxProfit: maxProfit > 0 ? maxProfit : null,
    maxLoss,
    breakevens,
    pop: pop != null ? Math.round(pop * 100) / 100 : null,
    riskReward,
    netDelta: Math.round(netDelta * 1000) / 1000,
    netGamma: Math.round(netGamma * 10000) / 10000,
    netTheta: Math.round(netTheta * 1000) / 1000,
    netVega: Math.round(netVega * 1000) / 1000,
    thetaPerDay,
    isUnlimited,
    pnlPoints,
    hasWideSpread: legs.some(l => l.wideSpread),
    ev: 0,
    evPerRisk: 0,
    hvPop: null,
  };
}

// ─── Delta Range Scanners ────────────────────────────────────────

const IC_DELTAS = [0.10, 0.12, 0.14, 0.16, 0.18, 0.20, 0.22, 0.25];
const PCS_DELTAS = [0.15, 0.18, 0.20, 0.22, 0.25, 0.28, 0.30];
const SS_DELTAS = [0.10, 0.12, 0.14, 0.16, 0.18, 0.20, 0.25];

function scanBestIronCondor(
  valid: StrikeData[], label: string, expiration: string, dte: number, currentPrice: number, sym = '??'
): StrategyCard | null {
  let best: StrategyCard | null = null;
  let bestScore = -Infinity;
  for (const d of IC_DELTAS) {
    const sp = findByDelta(valid, -d, 'put');
    const sc = findByDelta(valid, d, 'call');
    if (!sp || !sc) {
      console.log(`[StrategyBuilder] ${sym}: IC delta=${d} — findByDelta failed (shortPut=${sp?.strike ?? 'null'}, shortCall=${sc?.strike ?? 'null'})`);
      continue;
    }
    const lp = nextStrikeBelow(valid, sp.strike);
    const lc = nextStrikeAbove(valid, sc.strike);
    if (!lp || !lc) {
      console.log(`[StrategyBuilder] ${sym}: IC delta=${d} — no adjacent strike (longPut=${lp?.strike ?? 'null'}, longCall=${lc?.strike ?? 'null'})`);
      continue;
    }
    const legs = [
      makeLeg(sp, 'put', 'sell'),
      makeLeg(lp, 'put', 'buy'),
      makeLeg(sc, 'call', 'sell'),
      makeLeg(lc, 'call', 'buy'),
    ].filter((l): l is StrategyLeg => l != null);
    if (legs.length !== 4) {
      console.log(`[StrategyBuilder] ${sym}: IC delta=${d} — makeLeg failed, only ${legs.length}/4 legs built`);
      continue;
    }
    const card = buildCard('Iron Condor', label, legs, expiration, dte, currentPrice, false);
    if (card.netCredit == null || card.netCredit <= 0) {
      console.log(`[StrategyBuilder] ${sym}: IC delta=${d} — rejected: netCredit=${card.netCredit}`);
      continue;
    }
    if (card.pop == null || card.maxLoss == null || card.maxLoss <= 0) {
      console.log(`[StrategyBuilder] ${sym}: IC delta=${d} — rejected: pop=${card.pop}, maxLoss=${card.maxLoss}`);
      continue;
    }
    const mp = card.maxProfit ?? 0;
    if (mp <= 0) {
      console.log(`[StrategyBuilder] ${sym}: IC delta=${d} — rejected: maxProfit=${mp}`);
      continue;
    }
    const score = card.pop * (mp / card.maxLoss);
    console.log(`[StrategyBuilder] ${sym}: IC delta=${d} — candidate score=${score.toFixed(3)} (pop=${card.pop}, mp=$${mp}, ml=$${card.maxLoss})`);
    if (score > bestScore) { bestScore = score; best = card; }
  }
  console.log(`[StrategyBuilder] ${sym}: IC result → ${best ? `PASS (score=${bestScore.toFixed(3)})` : 'FAIL (no valid candidate)'}`);
  return best;
}

function scanBestPutCreditSpread(
  valid: StrikeData[], label: string, expiration: string, dte: number, currentPrice: number, sym = '??'
): StrategyCard | null {
  let best: StrategyCard | null = null;
  let bestScore = -Infinity;
  for (const d of PCS_DELTAS) {
    const sp = findByDelta(valid, -d, 'put');
    if (!sp) {
      console.log(`[StrategyBuilder] ${sym}: PCS delta=${d} — findByDelta(put) returned null`);
      continue;
    }
    const lp = nextStrikeBelow(valid, sp.strike);
    if (!lp) {
      console.log(`[StrategyBuilder] ${sym}: PCS delta=${d} — no strike below ${sp.strike}`);
      continue;
    }
    const legs = [
      makeLeg(sp, 'put', 'sell'),
      makeLeg(lp, 'put', 'buy'),
    ].filter((l): l is StrategyLeg => l != null);
    if (legs.length !== 2) {
      console.log(`[StrategyBuilder] ${sym}: PCS delta=${d} — makeLeg failed, only ${legs.length}/2 legs`);
      continue;
    }
    const card = buildCard('Put Credit Spread', label, legs, expiration, dte, currentPrice, false);
    if (card.netCredit == null || card.netCredit <= 0) {
      console.log(`[StrategyBuilder] ${sym}: PCS delta=${d} — rejected: netCredit=${card.netCredit}`);
      continue;
    }
    if (card.pop == null || card.maxLoss == null || card.maxLoss <= 0) {
      console.log(`[StrategyBuilder] ${sym}: PCS delta=${d} — rejected: pop=${card.pop}, maxLoss=${card.maxLoss}`);
      continue;
    }
    const mp = card.maxProfit ?? 0;
    if (mp <= 0) {
      console.log(`[StrategyBuilder] ${sym}: PCS delta=${d} — rejected: maxProfit=${mp}`);
      continue;
    }
    const score = card.pop * (mp / card.maxLoss);
    console.log(`[StrategyBuilder] ${sym}: PCS delta=${d} — candidate score=${score.toFixed(3)} (pop=${card.pop}, mp=$${mp}, ml=$${card.maxLoss})`);
    if (score > bestScore) { bestScore = score; best = card; }
  }
  console.log(`[StrategyBuilder] ${sym}: PCS result → ${best ? `PASS (score=${bestScore.toFixed(3)})` : 'FAIL (no valid candidate)'}`);
  return best;
}

function scanBestShortStrangle(
  valid: StrikeData[], label: string, expiration: string, dte: number, currentPrice: number, sym = '??'
): StrategyCard | null {
  let best: StrategyCard | null = null;
  let bestScore = -Infinity;
  for (const d of SS_DELTAS) {
    const sp = findByDelta(valid, -d, 'put');
    const sc = findByDelta(valid, d, 'call');
    if (!sp || !sc) {
      console.log(`[StrategyBuilder] ${sym}: SS delta=${d} — findByDelta failed (put=${sp?.strike ?? 'null'}, call=${sc?.strike ?? 'null'})`);
      continue;
    }
    const legs = [
      makeLeg(sp, 'put', 'sell'),
      makeLeg(sc, 'call', 'sell'),
    ].filter((l): l is StrategyLeg => l != null);
    if (legs.length !== 2) {
      console.log(`[StrategyBuilder] ${sym}: SS delta=${d} — makeLeg failed, only ${legs.length}/2 legs`);
      continue;
    }
    const card = buildCard('Short Strangle', label, legs, expiration, dte, currentPrice, true);
    if (card.netCredit == null || card.netCredit <= 0) {
      console.log(`[StrategyBuilder] ${sym}: SS delta=${d} — rejected: netCredit=${card.netCredit}`);
      continue;
    }
    if (card.pop == null) {
      console.log(`[StrategyBuilder] ${sym}: SS delta=${d} — rejected: pop=null`);
      continue;
    }
    const score = card.pop * card.netCredit * 100;
    console.log(`[StrategyBuilder] ${sym}: SS delta=${d} — candidate score=${score.toFixed(3)} (pop=${card.pop}, credit=$${card.netCredit})`);
    if (score > bestScore) { bestScore = score; best = card; }
  }
  console.log(`[StrategyBuilder] ${sym}: SS result → ${best ? `PASS (score=${bestScore.toFixed(3)})` : 'FAIL (no valid candidate)'}`);
  return best;
}

// ─── Tier 2: Full Strategy Generation ───────────────────────────────

export function generateStrategies(params: GenerateParams): StrategyCard[] {
  const { strikes, currentPrice, ivRank, expiration, dte, symbol } = params;
  const sym = symbol || '??';
  const pct = ivRank * 100;

  // Filter to strikes with at least some Greeks data
  const valid = strikes.filter(s =>
    (s.callDelta != null || s.putDelta != null) &&
    (s.callBid != null || s.callAsk != null || s.putBid != null || s.putAsk != null)
  );

  const noGreeks = strikes.filter(s => s.callDelta == null && s.putDelta == null).length;
  console.log(`[StrategyBuilder] ${sym}: ENTER — price=$${currentPrice}, ivRank=${ivRank.toFixed(3)} (${pct.toFixed(1)}%), dte=${dte}, exp=${expiration}`);
  console.log(`[StrategyBuilder] ${sym}: strikes total=${strikes.length}, valid=${valid.length}, noGreeks=${noGreeks}`);
  if (valid.length > 0) {
    const putDeltas = valid.map(s => s.putDelta).filter(d => d != null) as number[];
    const callDeltas = valid.map(s => s.callDelta).filter(d => d != null) as number[];
    console.log(`[StrategyBuilder] ${sym}: putDeltas range=[${Math.min(...putDeltas).toFixed(3)}..${Math.max(...putDeltas).toFixed(3)}] (${putDeltas.length} strikes)`);
    console.log(`[StrategyBuilder] ${sym}: callDeltas range=[${Math.min(...callDeltas).toFixed(3)}..${Math.max(...callDeltas).toFixed(3)}] (${callDeltas.length} strikes)`);
    console.log(`[StrategyBuilder] ${sym}: strike range=[$${Math.min(...valid.map(s => s.strike))}..$${Math.max(...valid.map(s => s.strike))}]`);
  }
  if (valid.length < 3) {
    console.log(`[StrategyBuilder] ${sym}: ABORT — only ${valid.length} valid strikes (need ≥3)`);
    return [];
  }

  const tier = pct > 50 ? 'HIGH_IV (>50)' : pct >= 20 ? 'NORMAL_IV (20-50)' : 'LOW_IV (<20)';
  console.log(`[StrategyBuilder] ${sym}: IV tier=${tier} → generating strategies...`);

  const cards: StrategyCard[] = [];

  if (pct > 50) {
    // ─── High IV: Sell Premium — scan delta ranges ─────
    const ic = scanBestIronCondor(valid, 'A', expiration, dte, currentPrice, sym);
    if (ic) cards.push(ic);

    const pcs = scanBestPutCreditSpread(valid, 'B', expiration, dte, currentPrice, sym);
    if (pcs) cards.push(pcs);

    const ss = scanBestShortStrangle(valid, 'C', expiration, dte, currentPrice, sym);
    if (ss) cards.push(ss);

  } else if (pct >= 20) {
    // ─── Normal IV: Mild Directional ─────────────────────
    // A) Bull Call Spread (debit — fixed delta, no scan)
    const longBCS = findByDelta(valid, 0.50, 'call');
    const shortBCS = findByDelta(valid, 0.30, 'call');
    if (longBCS && shortBCS && longBCS.strike !== shortBCS.strike) {
      const legs = [
        makeLeg(longBCS, 'call', 'buy'),
        makeLeg(shortBCS, 'call', 'sell'),
      ].filter((l): l is StrategyLeg => l != null);
      if (legs.length === 2) {
        cards.push(buildCard('Bull Call Spread', 'A', legs, expiration, dte, currentPrice, false));
      }
    }

    // B) Iron Condor — scan
    const icW = scanBestIronCondor(valid, 'B', expiration, dte, currentPrice, sym);
    if (icW) cards.push(icW);

    // C) Put Credit Spread — scan
    const pcs2 = scanBestPutCreditSpread(valid, 'C', expiration, dte, currentPrice, sym);
    if (pcs2) cards.push(pcs2);

  } else {
    // ─── Low IV: Buy Premium ──────────────────────────
    // A) Long Straddle
    const atm = findByDelta(valid, 0.50, 'call');
    if (atm) {
      const legs = [
        makeLeg(atm, 'call', 'buy'),
        makeLeg(atm, 'put', 'buy'),
      ].filter((l): l is StrategyLeg => l != null);
      if (legs.length === 2) {
        cards.push(buildCard('Long Straddle', 'A', legs, expiration, dte, currentPrice, false));
      }
    }

    // B) Long Strangle
    const buyCallLS = findByDelta(valid, 0.30, 'call');
    const buyPutLS = findByDelta(valid, -0.30, 'put');
    if (buyCallLS && buyPutLS && buyCallLS.strike !== buyPutLS.strike) {
      const legs = [
        makeLeg(buyCallLS, 'call', 'buy'),
        makeLeg(buyPutLS, 'put', 'buy'),
      ].filter((l): l is StrategyLeg => l != null);
      if (legs.length === 2) {
        cards.push(buildCard('Long Strangle', 'B', legs, expiration, dte, currentPrice, false));
      }
    }

    // C) Bull Call Debit Spread
    const longDBS = findByDelta(valid, 0.50, 'call');
    const shortDBS = findByDelta(valid, 0.30, 'call');
    if (longDBS && shortDBS && longDBS.strike !== shortDBS.strike) {
      const legs = [
        makeLeg(longDBS, 'call', 'buy'),
        makeLeg(shortDBS, 'call', 'sell'),
      ].filter((l): l is StrategyLeg => l != null);
      if (legs.length === 2) {
        cards.push(buildCard('Debit Spread', 'C', legs, expiration, dte, currentPrice, false));
      }
    }
  }

  console.log(`[StrategyBuilder] ${sym}: pre-filter cards=${cards.length} [${cards.map(c => c.name).join(', ')}]`);

  // ─── Compute HV-Adjusted EV for each card ──────────────────────
  const iv = params.iv30 ?? 0.30;
  const hv = params.hv30 ?? iv;
  // Safety cap: if IV/HV ratio > 4, cap at 4 to prevent unrealistic adjustments
  const cappedHv = iv > 0 && hv > 0 && iv / hv > 4 ? iv / 4 : hv;
  const hvProxyML = currentPrice * cappedHv * Math.sqrt(dte / 365) * 2.5 * 100;

  for (const card of cards) {
    if (card.pop == null) continue;
    const mp = card.maxProfit ?? 0;
    const isCredit = CREDIT_STRATEGIES.includes(card.name);

    // HV-adjusted PoP for credit strategies; delta PoP for debit
    const hvPop = isCredit ? computeHvAdjustedPoP(card, currentPrice, cappedHv, dte) : card.pop;
    card.hvPop = isCredit ? Math.round(hvPop * 1000) / 1000 : null;

    // Use HV-based proxy for unlimited risk (actual expected movement, not inflated IV)
    const effectiveML = card.isUnlimited ? hvProxyML : (card.maxLoss ?? 0);
    const evPop = isCredit ? hvPop : card.pop;

    if (mp > 0 && effectiveML > 0) {
      card.ev = Math.round((evPop * mp - (1 - evPop) * effectiveML) * 100) / 100;
      card.evPerRisk = Math.round((card.ev / effectiveML) * 10000) / 10000;
    }
  }

  // ─── 3-Tier Gate System ─────────────────────────────────────────
  const POP_FLOORS: Record<string, number> = {
    'Put Credit Spread': 0.55, 'Call Credit Spread': 0.55,
    'Iron Condor': 0.50, 'Short Strangle': 0.60, 'Jade Lizard': 0.55,
    'Bull Call Spread': 0.30, 'Bear Put Spread': 0.30, 'Debit Spread': 0.30,
    'Calendar Spread': 0.30, 'Diagonal Spread': 0.30,
    'Long Straddle': 0.25, 'Long Strangle': 0.25,
  };

  const filtered = cards.filter(card => {
    // Gate A: EV must be positive (uses hvPoP for credit, deltaPoP for debit)
    if (card.ev <= 0) {
      const evPop = card.hvPop ?? card.pop;
      const effectiveML = card.isUnlimited ? hvProxyML : (card.maxLoss ?? 0);
      console.log(`[StrategyBuilder] ${sym}: EV GATE rejected "${card.name}" — EV=$${card.ev.toFixed(0)} (hvPoP=${card.hvPop?.toFixed(3) ?? 'n/a'}, deltaPoP=${card.pop?.toFixed(3)}, mp=$${card.maxProfit}, ml=$${effectiveML.toFixed(0)})`);
      return false;
    }

    // Gate B: Strategy-specific PoP floor (uses delta PoP — conservative)
    const threshold = POP_FLOORS[card.name] ?? 0.40;
    if (card.pop == null || card.pop < threshold) {
      console.log(`[StrategyBuilder] ${sym}: PoP GATE rejected "${card.name}" — pop=${card.pop != null ? (card.pop * 100).toFixed(1) + '%' : 'null'}, threshold=${(threshold * 100).toFixed(0)}%`);
      return false;
    }

    // Gate C: Minimum credit for credit strategies ($0.10/share = $10/contract)
    if (card.netCredit != null && card.netCredit < 0.10) {
      console.log(`[StrategyBuilder] ${sym}: MIN CREDIT rejected "${card.name}" — credit=$${card.netCredit.toFixed(2)} < $0.10 floor`);
      return false;
    }

    return true;
  });

  // ─── Edge-Aware Composite Scoring ───────────────────────────────
  const edgeRatio = iv > 0 ? Math.max(0, (iv - hv)) / iv : 0;
  filtered.sort((a, b) => {
    const scoreA = computeCompositeScore(a);
    const scoreB = computeCompositeScore(b);
    return scoreB - scoreA;
  });

  function computeCompositeScore(card: StrategyCard): number {
    const effectiveML = card.isUnlimited ? hvProxyML : (card.maxLoss ?? 0);
    const thetaEff = effectiveML > 0 ? Math.abs(card.thetaPerDay) / effectiveML * 100 : 0;
    return (card.evPerRisk * 50) + (thetaEff * 30) + (edgeRatio * 20);
  }

  // Re-label sequentially based on strategies that actually generated
  filtered.forEach((card, i) => { card.label = String.fromCharCode(65 + i); });
  console.log(`[StrategyBuilder] ${sym}: RESULT → ${filtered.length} strategies [${filtered.map(c => `${c.label}) ${c.name} (EV=$${c.ev.toFixed(0)})`).join(', ')}]`);
  return filtered;
}

// ─── Build from strikes data ────────────────────────────────────────

export function buildStrikeData(
  expStrikes: any[],
  greeksData: Record<string, any>
): StrikeData[] {
  const result: StrikeData[] = [];
  for (const s of expStrikes) {
    const cg = greeksData[s.callStreamerSymbol] || {};
    const pg = greeksData[s.putStreamerSymbol] || {};

    let callBid: number | null = cg.bid ?? null;
    let callAsk: number | null = cg.ask ?? null;
    let putBid: number | null = pg.bid ?? null;
    let putAsk: number | null = pg.ask ?? null;

    // Estimate missing bid/ask from the other side
    if (callBid === 0 && callAsk != null && callAsk > 0) callBid = callAsk * 0.4;
    if (callAsk === 0 && callBid != null && callBid > 0) callAsk = callBid * 2.5;
    if (putBid === 0 && putAsk != null && putAsk > 0) putBid = putAsk * 0.4;
    if (putAsk === 0 && putBid != null && putBid > 0) putAsk = putBid * 2.5;

    // Inverted quotes — null out that side entirely
    if (callBid != null && callAsk != null && callBid > callAsk) {
      callBid = null; callAsk = null;
    }
    if (putBid != null && putAsk != null && putBid > putAsk) {
      putBid = null; putAsk = null;
    }

    // Wide spread detection: (ask - bid) / midpoint > 50%
    const callMid = callBid != null && callAsk != null ? (callAsk + callBid) / 2 : 0;
    const callWideSpread = callMid > 0 ? (callAsk! - callBid!) / callMid > 0.50 : false;
    const putMid = putBid != null && putAsk != null ? (putAsk + putBid) / 2 : 0;
    const putWideSpread = putMid > 0 ? (putAsk! - putBid!) / putMid > 0.50 : false;

    result.push({
      strike: s.strike,
      callBid, callAsk, putBid, putAsk,
      callDelta: cg.delta ?? null,
      putDelta: pg.delta ?? null,
      callTheta: cg.theta ?? null,
      putTheta: pg.theta ?? null,
      callGamma: cg.gamma ?? null,
      putGamma: pg.gamma ?? null,
      callVega: cg.vega ?? null,
      putVega: pg.vega ?? null,
      callIv: cg.iv ?? null,
      putIv: pg.iv ?? null,
      callVolume: cg.volume ?? null,
      putVolume: pg.volume ?? null,
      callOI: cg.openInterest ?? null,
      putOI: pg.openInterest ?? null,
      callWideSpread,
      putWideSpread,
    });
  }
  return result;
}

// ─── Custom Strategy Builder ────────────────────────────────────────

export interface CustomLeg {
  type: 'call' | 'put';
  side: 'buy' | 'sell';
  strike: number;
  streamerSymbol: string;
}

export function detectStrategyName(legs: CustomLeg[]): string {
  const sorted = [...legs].sort((a, b) => a.strike - b.strike);
  const n = sorted.length;

  if (n === 1) {
    const l = sorted[0];
    return l.side === 'buy'
      ? (l.type === 'call' ? 'Long Call' : 'Long Put')
      : (l.type === 'call' ? 'Short Call' : 'Short Put');
  }

  if (n === 2) {
    const [lo, hi] = sorted;
    // Vertical spreads
    if (lo.type === 'call' && hi.type === 'call') {
      if (lo.side === 'buy' && hi.side === 'sell') return 'Bull Call Spread';
      if (lo.side === 'sell' && hi.side === 'buy') return 'Bear Call Spread';
    }
    if (lo.type === 'put' && hi.type === 'put') {
      if (lo.side === 'buy' && hi.side === 'sell') return 'Bear Put Spread';
      if (lo.side === 'sell' && hi.side === 'buy') return 'Bull Put Spread';
    }
    // Straddle
    if (lo.strike === hi.strike && lo.type !== hi.type) {
      return lo.side === 'buy' && hi.side === 'buy' ? 'Long Straddle' : 'Short Straddle';
    }
    // Strangle
    if (lo.type === 'put' && hi.type === 'call') {
      return lo.side === 'buy' && hi.side === 'buy' ? 'Long Strangle' : 'Short Strangle';
    }
  }

  if (n === 4) {
    const puts = sorted.filter(l => l.type === 'put');
    const calls = sorted.filter(l => l.type === 'call');
    if (puts.length === 2 && calls.length === 2) {
      const hasBuyPut = puts.some(p => p.side === 'buy');
      const hasSellPut = puts.some(p => p.side === 'sell');
      const hasBuyCall = calls.some(c => c.side === 'buy');
      const hasSellCall = calls.some(c => c.side === 'sell');
      if (hasBuyPut && hasSellPut && hasBuyCall && hasSellCall) return 'Iron Condor';
    }
    // Iron Butterfly
    const sells = sorted.filter(l => l.side === 'sell');
    if (sells.length === 2 && sells[0].strike === sells[1].strike) return 'Iron Butterfly';
  }

  if (n === 3) {
    // Jade Lizard: short put + short call spread
    const sellPuts = sorted.filter(l => l.type === 'put' && l.side === 'sell');
    const sellCalls = sorted.filter(l => l.type === 'call' && l.side === 'sell');
    const buyCalls = sorted.filter(l => l.type === 'call' && l.side === 'buy');
    if (sellPuts.length === 1 && sellCalls.length === 1 && buyCalls.length === 1) return 'Jade Lizard';
  }

  return 'Custom Strategy';
}

export function buildCustomCard(
  customLegs: CustomLeg[],
  greeksData: Record<string, any>,
  expiration: string,
  dte: number,
  currentPrice: number
): StrategyCard | null {
  const legs: StrategyLeg[] = [];
  for (const cl of customLegs) {
    const g = greeksData[cl.streamerSymbol] || {};
    const bid: number | null = g.bid ?? null;
    const ask: number | null = g.ask ?? null;
    const price = cl.side === 'sell' ? bid : ask;
    if (price == null || price <= 0) continue;
    const midVal = bid != null && ask != null ? (ask + bid) / 2 : 0;
    const wide = midVal > 0 ? (ask! - bid!) / midVal > 0.50 : false;
    legs.push({
      type: cl.type,
      side: cl.side,
      strike: cl.strike,
      price,
      delta: cl.side === 'sell' ? -(g.delta ?? 0) : (g.delta ?? 0),
      gamma: cl.side === 'sell' ? -(g.gamma ?? 0) : (g.gamma ?? 0),
      theta: cl.side === 'sell' ? -(g.theta ?? 0) : (g.theta ?? 0),
      vega: cl.side === 'sell' ? -(g.vega ?? 0) : (g.vega ?? 0),
      wideSpread: wide,
    });
  }
  if (legs.length === 0) return null;

  const hasNaked = legs.some(l => l.side === 'sell') &&
    !legs.every(l => l.side === 'sell' ? legs.some(l2 => l2.side === 'buy' && l2.type === l.type) : true);

  const name = detectStrategyName(customLegs);
  return buildCard(name, 'Custom', legs, expiration, dte, currentPrice, hasNaked);
}

// ─── P&L Chart SVG ──────────────────────────────────────────────────

export function renderPnlSvg(
  pnlPoints: { price: number; pnl: number }[],
  breakevens: number[],
  currentPrice: number,
  width = 280,
  height = 140
): string {
  if (pnlPoints.length < 2) return '';

  const pad = { top: 15, right: 10, bottom: 20, left: 40 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;

  const prices = pnlPoints.map(p => p.price);
  const pnls = pnlPoints.map(p => p.pnl);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const minPnl = Math.min(...pnls, 0);
  const maxPnl = Math.max(...pnls, 0);
  const pnlRange = maxPnl - minPnl || 1;

  const scaleX = (p: number) => pad.left + ((p - minP) / (maxP - minP)) * w;
  const scaleY = (pnl: number) => pad.top + h - ((pnl - minPnl) / pnlRange) * h;

  const zeroY = scaleY(0);

  // Build polyline points
  const linePoints = pnlPoints.map(p => `${scaleX(p.price).toFixed(1)},${scaleY(p.pnl).toFixed(1)}`).join(' ');

  // Green/red fill areas
  let greenPath = '';
  let redPath = '';

  // Build fill paths by splitting at zero crossings
  for (let i = 0; i < pnlPoints.length - 1; i++) {
    const p1 = pnlPoints[i];
    const p2 = pnlPoints[i + 1];
    const x1 = scaleX(p1.price);
    const x2 = scaleX(p2.price);
    const y1 = scaleY(p1.pnl);
    const y2 = scaleY(p2.pnl);

    if (p1.pnl >= 0 && p2.pnl >= 0) {
      greenPath += `M${x1.toFixed(1)},${zeroY.toFixed(1)} L${x1.toFixed(1)},${y1.toFixed(1)} L${x2.toFixed(1)},${y2.toFixed(1)} L${x2.toFixed(1)},${zeroY.toFixed(1)} Z `;
    } else if (p1.pnl <= 0 && p2.pnl <= 0) {
      redPath += `M${x1.toFixed(1)},${zeroY.toFixed(1)} L${x1.toFixed(1)},${y1.toFixed(1)} L${x2.toFixed(1)},${y2.toFixed(1)} L${x2.toFixed(1)},${zeroY.toFixed(1)} Z `;
    } else {
      // Crossing: split at zero
      const ratio = Math.abs(p1.pnl) / (Math.abs(p1.pnl) + Math.abs(p2.pnl));
      const xCross = x1 + ratio * (x2 - x1);
      if (p1.pnl > 0) {
        greenPath += `M${x1.toFixed(1)},${zeroY.toFixed(1)} L${x1.toFixed(1)},${y1.toFixed(1)} L${xCross.toFixed(1)},${zeroY.toFixed(1)} Z `;
        redPath += `M${xCross.toFixed(1)},${zeroY.toFixed(1)} L${x2.toFixed(1)},${y2.toFixed(1)} L${x2.toFixed(1)},${zeroY.toFixed(1)} Z `;
      } else {
        redPath += `M${x1.toFixed(1)},${zeroY.toFixed(1)} L${x1.toFixed(1)},${y1.toFixed(1)} L${xCross.toFixed(1)},${zeroY.toFixed(1)} Z `;
        greenPath += `M${xCross.toFixed(1)},${zeroY.toFixed(1)} L${x2.toFixed(1)},${y2.toFixed(1)} L${x2.toFixed(1)},${zeroY.toFixed(1)} Z `;
      }
    }
  }

  // Breakeven lines
  let beLines = '';
  for (const be of breakevens) {
    if (be >= minP && be <= maxP) {
      const x = scaleX(be);
      beLines += `<line x1="${x.toFixed(1)}" y1="${pad.top}" x2="${x.toFixed(1)}" y2="${pad.top + h}" stroke="#9ca3af" stroke-width="1" stroke-dasharray="4,3"/>`;
    }
  }

  // Current price line
  const cpX = scaleX(currentPrice);
  const cpLine = (currentPrice >= minP && currentPrice <= maxP)
    ? `<line x1="${cpX.toFixed(1)}" y1="${pad.top}" x2="${cpX.toFixed(1)}" y2="${pad.top + h}" stroke="#6366f1" stroke-width="1" stroke-dasharray="2,2"/>`
    : '';

  // Max profit / loss labels
  const mpVal = Math.max(...pnls);
  const mlVal = Math.min(...pnls);
  const mpLabel = mpVal > 0 ? `<text x="${pad.left + 2}" y="${pad.top + 10}" font-size="9" fill="#16a34a">+$${Math.round(mpVal)}</text>` : '';
  const mlLabel = mlVal < 0 ? `<text x="${pad.left + 2}" y="${pad.top + h - 2}" font-size="9" fill="#dc2626">-$${Math.round(Math.abs(mlVal))}</text>` : '';

  // Zero line
  const zeroLine = `<line x1="${pad.left}" y1="${zeroY.toFixed(1)}" x2="${pad.left + w}" y2="${zeroY.toFixed(1)}" stroke="#d1d5db" stroke-width="1"/>`;

  // Price axis labels
  const pLo = Math.round(minP);
  const pHi = Math.round(maxP);
  const axisLabels = `<text x="${pad.left}" y="${height - 3}" font-size="8" fill="#9ca3af">${pLo}</text><text x="${width - pad.right}" y="${height - 3}" font-size="8" fill="#9ca3af" text-anchor="end">${pHi}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <path d="${greenPath}" fill="#bbf7d0" opacity="0.6"/>
    <path d="${redPath}" fill="#fecaca" opacity="0.6"/>
    ${zeroLine}
    ${beLines}
    ${cpLine}
    <polyline points="${linePoints}" fill="none" stroke="#374151" stroke-width="1.5"/>
    ${mpLabel}
    ${mlLabel}
    ${axisLabels}
  </svg>`;
}
