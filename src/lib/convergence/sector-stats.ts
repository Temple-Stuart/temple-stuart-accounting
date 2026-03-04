import type { TTScannerData, CompanyTextProfile, TextBasedPeerGroup } from './types';

// ===== TYPES =====

export interface PeerMetricStats {
  mean: number;
  std: number;
  sortedValues: number[];  // Sorted peer values for percentile ranking (Mandelbrot 1963; Fama 1965)
}

export interface PeerStats {
  ticker_count: number;
  peer_group_type: 'industry' | 'sector_fallback' | 'unknown' | 'text_nlp' | 'finnhub_peers' | 'mixed';
  peer_group_name: string;
  metrics: {
    iv_percentile: PeerMetricStats;
    iv_hv_spread: PeerMetricStats;
    hv30: PeerMetricStats;
    hv60: PeerMetricStats;
    hv90: PeerMetricStats;
    iv30: PeerMetricStats;
    pe_ratio: PeerMetricStats;
    market_cap: PeerMetricStats;
    beta: PeerMetricStats;
    corr_spy: PeerMetricStats;
    dividend_yield: PeerMetricStats;
    eps: PeerMetricStats;
    term_structure_slope: PeerMetricStats;
  };
  insufficient_peers?: boolean;
  text_peer_trace?: {
    peer_source: 'text_nlp' | 'gics_industry' | 'gics_sector';
    text_peers: string[];
    avg_similarity: number;
    keywords_shared: string[];
  };
}

export type PeerStatsMap = Record<string, PeerStats>;

/** Per-ticker assignment: maps symbol → peer group key in PeerStatsMap */
export type PeerGroupAssignment = Record<string, string>;

// ===== HELPERS =====

function round(v: number, decimals = 2): number {
  const f = Math.pow(10, decimals);
  return Math.round(v * f) / f;
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stddev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((sum, v) => sum + (v - m) ** 2, 0) / (arr.length - 1));
}

function computeMetricStats(values: (number | null | undefined)[]): PeerMetricStats {
  const valid = values.filter((v): v is number => v != null && !isNaN(v));
  return {
    mean: round(mean(valid), 2),
    std: round(stddev(valid), 2),
    sortedValues: [...valid].sort((a, b) => a - b),
  };
}

function computeTermStructureSlope(ts: { date: string; iv: number }[]): number | null {
  if (ts.length < 2) return null;
  const sorted = [...ts].sort((a, b) => a.date.localeCompare(b.date));
  const frontIV = sorted[0].iv;
  const backIV = sorted[sorted.length - 1].iv;
  if (frontIV <= 0) return null;
  return (backIV - frontIV) / frontIV;
}

function buildPeerStats(
  tickers: TTScannerData[],
  peerGroupType: PeerStats['peer_group_type'],
  peerGroupName: string,
  textPeerTrace?: PeerStats['text_peer_trace'],
): PeerStats {
  if (tickers.length < 3) {
    const empty: PeerMetricStats = { mean: 0, std: 0, sortedValues: [] };
    return {
      ticker_count: tickers.length,
      peer_group_type: peerGroupType,
      peer_group_name: peerGroupName,
      metrics: {
        iv_percentile: { ...empty },
        iv_hv_spread: { ...empty },
        hv30: { ...empty },
        hv60: { ...empty },
        hv90: { ...empty },
        iv30: { ...empty },
        pe_ratio: { ...empty },
        market_cap: { ...empty },
        beta: { ...empty },
        corr_spy: { ...empty },
        dividend_yield: { ...empty },
        eps: { ...empty },
        term_structure_slope: { ...empty },
      },
      insufficient_peers: true,
      ...(textPeerTrace ? { text_peer_trace: textPeerTrace } : {}),
    };
  }

  return {
    ticker_count: tickers.length,
    peer_group_type: peerGroupType,
    peer_group_name: peerGroupName,
    metrics: {
      iv_percentile: computeMetricStats(tickers.map(t => t.ivPercentile)),
      iv_hv_spread: computeMetricStats(tickers.map(t => t.ivHvSpread)),
      hv30: computeMetricStats(tickers.map(t => t.hv30)),
      hv60: computeMetricStats(tickers.map(t => t.hv60)),
      hv90: computeMetricStats(tickers.map(t => t.hv90)),
      iv30: computeMetricStats(tickers.map(t => t.iv30)),
      pe_ratio: computeMetricStats(tickers.map(t => t.peRatio)),
      market_cap: computeMetricStats(tickers.map(t => t.marketCap)),
      beta: computeMetricStats(tickers.map(t => t.beta)),
      corr_spy: computeMetricStats(tickers.map(t => t.corrSpy)),
      dividend_yield: computeMetricStats(tickers.map(t => t.dividendYield)),
      eps: computeMetricStats(tickers.map(t => t.eps)),
      term_structure_slope: computeMetricStats(tickers.map(t => computeTermStructureSlope(t.termStructure))),
    },
    ...(textPeerTrace ? { text_peer_trace: textPeerTrace } : {}),
  };
}

// ===== TF-IDF TEXT SIMILARITY ENGINE (Hoberg & Phillips 2010, 2016) =====
// Firms that use similar product descriptions in 10-K filings are better economic peers
// than static GICS industry codes. Runs in milliseconds on ~16 documents.

const MIN_TEXT_PEERS = 3;
const TEXT_SIMILARITY_THRESHOLD = 0.40;

/** Tokenize business description into lowercase words */
function tokenizeForTfIdf(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2);
}

/** Compute TF (term frequency) for a single document */
function computeTF(words: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const w of words) {
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  // Normalize by document length
  const len = words.length || 1;
  for (const [word, count] of freq) {
    freq.set(word, count / len);
  }
  return freq;
}

/** Compute IDF (inverse document frequency) across all documents */
function computeIDF(documents: Map<string, number>[]): Map<string, number> {
  const docCount = documents.length;
  if (docCount === 0) return new Map();

  // Count how many documents contain each term
  const docFreq = new Map<string, number>();
  for (const doc of documents) {
    for (const word of doc.keys()) {
      docFreq.set(word, (docFreq.get(word) ?? 0) + 1);
    }
  }

  // IDF = log(N / df) — standard formula
  const idf = new Map<string, number>();
  for (const [word, df] of docFreq) {
    idf.set(word, Math.log(docCount / df));
  }
  return idf;
}

/** Compute TF-IDF vector for a single document */
function computeTfIdfVector(tf: Map<string, number>, idf: Map<string, number>): Map<string, number> {
  const vec = new Map<string, number>();
  for (const [word, tfVal] of tf) {
    const idfVal = idf.get(word) ?? 0;
    const tfidf = tfVal * idfVal;
    if (tfidf > 0) {
      vec.set(word, tfidf);
    }
  }
  return vec;
}

/** Compute cosine similarity between two TF-IDF vectors */
function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const [word, valA] of a) {
    normA += valA * valA;
    const valB = b.get(word);
    if (valB !== undefined) {
      dotProduct += valA * valB;
    }
  }
  for (const valB of b.values()) {
    normB += valB * valB;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  return dotProduct / denominator;
}

/** Get top N keywords from a TF-IDF vector */
function getTopKeywords(vec: Map<string, number>, n: number): string[] {
  return [...vec.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([word]) => word);
}

/** Find shared keywords between two TF-IDF vectors (top 5 by combined weight) */
function getSharedKeywords(a: Map<string, number>, b: Map<string, number>, n: number): string[] {
  const shared: [string, number][] = [];
  for (const [word, valA] of a) {
    const valB = b.get(word);
    if (valB !== undefined) {
      shared.push([word, valA + valB]);
    }
  }
  return shared
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([word]) => word);
}

/**
 * Compute text-based peer groups from 10-K business descriptions.
 * Uses TF-IDF with cosine similarity (Hoberg & Phillips 2010, 2016).
 *
 * @param profiles - CompanyTextProfile for each scored ticker
 * @returns Map of symbol → TextBasedPeerGroup
 */
export function computeTextPeerGroups(
  profiles: CompanyTextProfile[],
): Record<string, TextBasedPeerGroup> {
  if (profiles.length < 2) return {};

  // Step 1: Tokenize and compute TF for each document
  const symbolWords = new Map<string, string[]>();
  const tfMaps: Map<string, number>[] = [];
  const symbols: string[] = [];

  for (const profile of profiles) {
    const words = tokenizeForTfIdf(profile.businessDescription);
    if (words.length < 20) continue; // Skip profiles with too little text
    symbolWords.set(profile.symbol, words);
    tfMaps.push(computeTF(words));
    symbols.push(profile.symbol);
  }

  if (symbols.length < 2) return {};

  // Step 2: Compute IDF across all documents
  const idf = computeIDF(tfMaps);

  // Step 3: Compute TF-IDF vectors
  const tfidfVectors = new Map<string, Map<string, number>>();
  for (let i = 0; i < symbols.length; i++) {
    tfidfVectors.set(symbols[i], computeTfIdfVector(tfMaps[i], idf));
  }

  // Step 4: Compute pairwise cosine similarity
  const similarities = new Map<string, Map<string, number>>();
  for (const sym of symbols) {
    similarities.set(sym, new Map());
  }

  for (let i = 0; i < symbols.length; i++) {
    for (let j = i + 1; j < symbols.length; j++) {
      const sim = round(cosineSimilarity(
        tfidfVectors.get(symbols[i])!,
        tfidfVectors.get(symbols[j])!,
      ), 4);
      similarities.get(symbols[i])!.set(symbols[j], sim);
      similarities.get(symbols[j])!.set(symbols[i], sim);
    }
  }

  // Step 5: Build text peer groups for each symbol
  const result: Record<string, TextBasedPeerGroup> = {};

  for (const sym of symbols) {
    const simMap = similarities.get(sym)!;
    const peers: [string, number][] = [];

    for (const [peerSym, sim] of simMap) {
      if (sim >= TEXT_SIMILARITY_THRESHOLD) {
        peers.push([peerSym, sim]);
      }
    }

    // Sort by similarity descending
    peers.sort((a, b) => b[1] - a[1]);

    const textPeers = peers.map(([s]) => s);
    const similarityScores: Record<string, number> = {};
    for (const [s, sim] of peers) {
      similarityScores[s] = sim;
    }

    // Generate group name from shared keywords across peers
    let textPeerGroupName = 'text_peers';
    if (peers.length > 0) {
      const myVec = tfidfVectors.get(sym)!;
      // Collect shared keywords across all peers
      const allShared: Map<string, number> = new Map();
      for (const [peerSym] of peers) {
        const peerVec = tfidfVectors.get(peerSym)!;
        const shared = getSharedKeywords(myVec, peerVec, 10);
        for (const kw of shared) {
          allShared.set(kw, (allShared.get(kw) ?? 0) + 1);
        }
      }
      const topShared = [...allShared.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([w]) => w);
      if (topShared.length > 0) {
        textPeerGroupName = topShared.join('_');
      }
    }

    // Determine peer source based on whether we have enough text peers
    const peerSource: TextBasedPeerGroup['peerSource'] =
      textPeers.length >= MIN_TEXT_PEERS ? 'text_nlp' : 'gics_industry';

    result[sym] = {
      symbol: sym,
      textPeers,
      similarityScores,
      textPeerGroupName,
      peerSource,
    };
  }

  console.log(`[TextPeers] Computed pairwise similarity for ${symbols.length} tickers, ${Object.values(result).filter(g => g.peerSource === 'text_nlp').length} using text-based peers`);

  return result;
}

// ===== MAIN FUNCTIONS =====

const MIN_INDUSTRY_PEERS = 5;

/**
 * Compute peer group statistics with 4-tier grouping:
 *   1. Text-based peers (cosine similarity > 0.40, min 3 peers) — most precise (Hoberg & Phillips 2010, 2016)
 *   2. Finnhub /stock/peers — industry-matched peers from Finnhub, expanded with scanner universe data
 *   3. GICS industry (min 5 peers) — standard fallback
 *   4. GICS sector — broadest fallback
 *
 * @param scannerResults - Scanner data for hard-filter survivors
 * @param textPeerGroups - Optional text-based peer groups from 10-K analysis
 * @param finnhubPeers - Optional map: symbol → peer tickers from Finnhub /stock/peers
 * @param fullUniverse - Optional map: symbol → TTScannerData for the full pre-filter scanner universe
 *                       (used to resolve Finnhub peer tickers that aren't in the survivor set)
 */
export function computePeerStats(
  scannerResults: TTScannerData[],
  textPeerGroups?: Record<string, TextBasedPeerGroup>,
  finnhubPeers?: Record<string, string[]>,
  fullUniverse?: Map<string, TTScannerData>,
): { stats: PeerStatsMap; assignment: PeerGroupAssignment } {
  // Step 1: Group by industry
  const byIndustry = new Map<string, TTScannerData[]>();
  // Step 2: Group by sector (for fallback)
  const bySector = new Map<string, TTScannerData[]>();
  // Track each ticker's industry and sector for assignment
  const tickerIndustry = new Map<string, string | null>();
  const tickerSector = new Map<string, string | null>();
  // Quick scanner data lookup
  const scannerBySymbol = new Map<string, TTScannerData>();

  for (const item of scannerResults) {
    const industry = item.industry || null;
    const sector = item.sector || null;
    tickerIndustry.set(item.symbol, industry);
    tickerSector.set(item.symbol, sector);
    scannerBySymbol.set(item.symbol, item);

    // Always add to sector group (used for fallback)
    const sectorKey = sector || 'UNKNOWN';
    if (!bySector.has(sectorKey)) bySector.set(sectorKey, []);
    bySector.get(sectorKey)!.push(item);

    // Add to industry group
    if (industry) {
      if (!byIndustry.has(industry)) byIndustry.set(industry, []);
      byIndustry.get(industry)!.push(item);
    }
  }

  const result: PeerStatsMap = {};
  const assignment: PeerGroupAssignment = {};
  const textNlpUsed: string[] = [];
  const industryFallbacks: string[] = [];
  const industryUsed: string[] = [];

  // Step 3: Build text-based peer group stats (highest priority)
  if (textPeerGroups) {
    for (const [symbol, group] of Object.entries(textPeerGroups)) {
      if (group.peerSource !== 'text_nlp' || group.textPeers.length < MIN_TEXT_PEERS) continue;

      const key = `text_nlp:${symbol}`;
      // Collect scanner data for all peers + the symbol itself
      const peerTickers: TTScannerData[] = [];
      const selfData = scannerBySymbol.get(symbol);
      if (selfData) peerTickers.push(selfData);
      for (const peerSym of group.textPeers) {
        const peerData = scannerBySymbol.get(peerSym);
        if (peerData) peerTickers.push(peerData);
      }

      if (peerTickers.length < MIN_TEXT_PEERS) continue;

      // Find shared keywords for trace
      const simScores = Object.values(group.similarityScores);
      const avgSim = simScores.length > 0
        ? round(simScores.reduce((a, b) => a + b, 0) / simScores.length, 4)
        : 0;

      // Get top 5 shared keywords from the group name or group data
      const sharedKeywords = group.textPeerGroupName.split('_').slice(0, 5);

      const trace: PeerStats['text_peer_trace'] = {
        peer_source: 'text_nlp',
        text_peers: group.textPeers,
        avg_similarity: avgSim,
        keywords_shared: sharedKeywords,
      };

      result[key] = buildPeerStats(peerTickers, 'text_nlp', group.textPeerGroupName, trace);
    }
  }

  // Step 4: Build Finnhub peer group stats (per symbol, from /stock/peers)
  // Resolves peer tickers against the full scanner universe (not just survivors).
  const finnhubPeerKeys = new Map<string, string>(); // symbol → result key
  const finnhubPeersUsed: string[] = [];
  if (finnhubPeers) {
    const universe = fullUniverse ?? scannerBySymbol;

    for (const [symbol, peerSymbols] of Object.entries(finnhubPeers)) {
      if (!peerSymbols || peerSymbols.length === 0) continue;

      // Collect scanner data for the symbol + its Finnhub peers from the universe
      const peerTickers: TTScannerData[] = [];
      const selfData = universe.get(symbol) ?? scannerBySymbol.get(symbol);
      if (selfData) peerTickers.push(selfData);

      for (const peerSym of peerSymbols) {
        const peerData = universe.get(peerSym) ?? scannerBySymbol.get(peerSym);
        if (peerData && peerData.symbol !== symbol) peerTickers.push(peerData);
      }

      if (peerTickers.length < 3) continue; // Need at least 3 for meaningful stats

      const key = `finnhub_peers:${symbol}`;
      result[key] = buildPeerStats(peerTickers, 'finnhub_peers', `finnhub_peers(${symbol})`);
      finnhubPeerKeys.set(symbol, key);
    }
  }

  // Step 5: Build industry-level stats for groups with >= MIN_INDUSTRY_PEERS
  const validIndustries = new Set<string>();
  for (const [industry, tickers] of byIndustry) {
    if (tickers.length >= MIN_INDUSTRY_PEERS) {
      validIndustries.add(industry);
      const key = `industry:${industry}`;
      result[key] = buildPeerStats(tickers, 'industry', industry);
    }
  }

  // Step 6: Build sector-level stats (used as broadest fallback)
  for (const [sector, tickers] of bySector) {
    const key = `sector:${sector}`;
    result[key] = buildPeerStats(tickers, 'sector_fallback', sector);
  }

  // Step 7: Assign each ticker to its peer group (4-tier priority)
  for (const item of scannerResults) {
    const symbol = item.symbol;
    const industry = tickerIndustry.get(symbol);
    const sector = tickerSector.get(symbol);
    const textGroup = textPeerGroups?.[symbol];

    // Tier 1: Text-based peers (highest precision)
    if (textGroup && textGroup.peerSource === 'text_nlp' && textGroup.textPeers.length >= MIN_TEXT_PEERS) {
      const key = `text_nlp:${symbol}`;
      if (result[key] && !result[key].insufficient_peers) {
        assignment[symbol] = key;
        textNlpUsed.push(symbol);
        continue;
      }
    }

    // Tier 2: Finnhub /stock/peers (industry-matched, expanded from universe)
    const fhKey = finnhubPeerKeys.get(symbol);
    if (fhKey && result[fhKey] && !result[fhKey].insufficient_peers) {
      assignment[symbol] = fhKey;
      finnhubPeersUsed.push(symbol);
      continue;
    }

    // Tier 3: GICS industry (min 5 peers)
    if (industry && validIndustries.has(industry)) {
      assignment[symbol] = `industry:${industry}`;
      industryUsed.push(symbol);
    } else if (sector) {
      // Tier 4: GICS sector (broadest)
      assignment[symbol] = `sector:${sector}`;
      industryFallbacks.push(symbol);
    } else {
      assignment[symbol] = `sector:UNKNOWN`;
      industryFallbacks.push(symbol);
    }
  }

  // Log peer group assignments
  if (textNlpUsed.length > 0) {
    console.log(`[PeerStats] ${textNlpUsed.length} tickers using text-based NLP peers: ${textNlpUsed.slice(0, 10).join(', ')}${textNlpUsed.length > 10 ? '...' : ''}`);
  }
  if (finnhubPeersUsed.length > 0) {
    console.log(`[PeerStats] ${finnhubPeersUsed.length} tickers using Finnhub /stock/peers: ${finnhubPeersUsed.slice(0, 10).join(', ')}${finnhubPeersUsed.length > 10 ? '...' : ''}`);
  }
  if (industryUsed.length > 0) {
    console.log(`[PeerStats] ${industryUsed.length} tickers using industry-level peers`);
  }
  if (industryFallbacks.length > 0) {
    console.log(`[PeerStats] ${industryFallbacks.length} tickers using sector-level fallback: ${industryFallbacks.slice(0, 10).join(', ')}${industryFallbacks.length > 10 ? '...' : ''}`);
  }

  return { stats: result, assignment };
}

export function computeZScore(value: number | null, mean: number, std: number): number | null {
  if (value === null || value === undefined) return null;
  if (std < 0.001) return null;
  return round((value - mean) / std, 2);
}

// ===== BACKWARDS COMPAT (type aliases) =====

/** @deprecated Use PeerMetricStats */
export type SectorMetricStats = PeerMetricStats;
/** @deprecated Use PeerStats */
export type SectorStats = PeerStats;
/** @deprecated Use PeerStatsMap */
export type SectorStatsMap = PeerStatsMap;
