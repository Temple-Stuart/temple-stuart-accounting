// Strategy Builder — client-side option strategy generation
// No API calls; purely computes from chain + Greeks data

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
}

export interface GenerateParams {
  strikes: StrikeData[];
  currentPrice: number;
  ivRank: number;
  expiration: string;
  dte: number;
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
  };
}

function computePnlPoints(legs: StrategyLeg[], currentPrice: number): { price: number; pnl: number }[] {
  const lo = currentPrice * 0.85;
  const hi = currentPrice * 1.15;
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
  const maxLoss = isUnlimited ? null : Math.round(Math.abs(Math.min(...pnls)) * 100) / 100;

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
  };
}

// ─── Tier 2: Full Strategy Generation ───────────────────────────────

export function generateStrategies(params: GenerateParams): StrategyCard[] {
  const { strikes, currentPrice, ivRank, expiration, dte } = params;
  const pct = ivRank * 100;

  // Filter to strikes with at least some Greeks data
  const valid = strikes.filter(s =>
    (s.callDelta != null || s.putDelta != null) &&
    (s.callBid != null || s.callAsk != null || s.putBid != null || s.putAsk != null)
  );
  if (valid.length < 3) return [];

  const cards: StrategyCard[] = [];

  if (pct > 50) {
    // ─── High IV: Sell Premium ─────────────────────────
    // A) Iron Condor
    const spIC = findByDelta(valid, -0.16, 'put');
    const scIC = findByDelta(valid, 0.16, 'call');
    if (spIC && scIC) {
      const lpIC = nextStrikeBelow(valid, spIC.strike);
      const lcIC = nextStrikeAbove(valid, scIC.strike);
      if (lpIC && lcIC) {
        const legs = [
          makeLeg(spIC, 'put', 'sell'),
          makeLeg(lpIC, 'put', 'buy'),
          makeLeg(scIC, 'call', 'sell'),
          makeLeg(lcIC, 'call', 'buy'),
        ].filter((l): l is StrategyLeg => l != null);
        if (legs.length === 4) {
          cards.push(buildCard('Iron Condor', 'A', legs, expiration, dte, currentPrice, false));
        }
      }
    }

    // B) Put Credit Spread
    const spPCS = findByDelta(valid, -0.20, 'put');
    if (spPCS) {
      const lpPCS = nextStrikeBelow(valid, spPCS.strike);
      if (lpPCS) {
        const legs = [
          makeLeg(spPCS, 'put', 'sell'),
          makeLeg(lpPCS, 'put', 'buy'),
        ].filter((l): l is StrategyLeg => l != null);
        if (legs.length === 2) {
          cards.push(buildCard('Put Credit Spread', 'B', legs, expiration, dte, currentPrice, false));
        }
      }
    }

    // C) Short Strangle (high IV only > 50)
    const spSS = findByDelta(valid, -0.16, 'put');
    const scSS = findByDelta(valid, 0.16, 'call');
    if (spSS && scSS) {
      const legs = [
        makeLeg(spSS, 'put', 'sell'),
        makeLeg(scSS, 'call', 'sell'),
      ].filter((l): l is StrategyLeg => l != null);
      if (legs.length === 2) {
        cards.push(buildCard('Short Strangle', 'C', legs, expiration, dte, currentPrice, true));
      }
    }
  } else if (pct >= 20) {
    // ─── Normal IV: Mild Directional ─────────────────────
    // A) Bull Call Spread
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

    // B) Iron Condor (wide wings)
    const spICW = findByDelta(valid, -0.10, 'put');
    const scICW = findByDelta(valid, 0.10, 'call');
    if (spICW && scICW) {
      const lpICW = nextStrikeBelow(valid, spICW.strike);
      const lcICW = nextStrikeAbove(valid, scICW.strike);
      if (lpICW && lcICW) {
        const legs = [
          makeLeg(spICW, 'put', 'sell'),
          makeLeg(lpICW, 'put', 'buy'),
          makeLeg(scICW, 'call', 'sell'),
          makeLeg(lcICW, 'call', 'buy'),
        ].filter((l): l is StrategyLeg => l != null);
        if (legs.length === 4) {
          cards.push(buildCard('Iron Condor (wide)', 'B', legs, expiration, dte, currentPrice, false));
        }
      }
    }

    // C) Put Credit Spread
    const spPCS2 = findByDelta(valid, -0.25, 'put');
    if (spPCS2) {
      const lpPCS2 = nextStrikeBelow(valid, spPCS2.strike);
      if (lpPCS2) {
        const legs = [
          makeLeg(spPCS2, 'put', 'sell'),
          makeLeg(lpPCS2, 'put', 'buy'),
        ].filter((l): l is StrategyLeg => l != null);
        if (legs.length === 2) {
          cards.push(buildCard('Put Credit Spread', 'C', legs, expiration, dte, currentPrice, false));
        }
      }
    }
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

  return cards;
}

// ─── Build from strikes data ────────────────────────────────────────

export function buildStrikeData(
  expStrikes: any[],
  greeksData: Record<string, any>
): StrikeData[] {
  return expStrikes.map((s: any) => {
    const cg = greeksData[s.callStreamerSymbol] || {};
    const pg = greeksData[s.putStreamerSymbol] || {};
    return {
      strike: s.strike,
      callBid: cg.bid ?? null,
      callAsk: cg.ask ?? null,
      putBid: pg.bid ?? null,
      putAsk: pg.ask ?? null,
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
    };
  });
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
    const price = cl.side === 'sell' ? (g.bid ?? null) : (g.ask ?? null);
    if (price == null || price <= 0) continue;
    legs.push({
      type: cl.type,
      side: cl.side,
      strike: cl.strike,
      price,
      delta: cl.side === 'sell' ? -(g.delta ?? 0) : (g.delta ?? 0),
      gamma: cl.side === 'sell' ? -(g.gamma ?? 0) : (g.gamma ?? 0),
      theta: cl.side === 'sell' ? -(g.theta ?? 0) : (g.theta ?? 0),
      vega: cl.side === 'sell' ? -(g.vega ?? 0) : (g.vega ?? 0),
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
