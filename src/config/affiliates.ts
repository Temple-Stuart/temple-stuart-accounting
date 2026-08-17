// ─── Affiliate provider config + the generalized emit gate (PR-TILE-CFG-1) ───
// CHIP-1 proved the pattern on the activities chip: an affiliate URL leaves a
// public payload ONLY after validation (https + host allowlist + our partner
// id), else it is omitted with a loud log — never an arbitrary vendor URL,
// never an ID-less link. This module extracts that gate into per-provider
// config so every tile PR (TILE-AUDIT-1: ground/insurance/eSIM/events/visa/
// flights-bridge) validates its own host+ID the exact same way.
//
// TRUTH-FIRST SHIPPING RULE: only providers we are actually signed up with
// get an entry. Today that is VIATOR alone (partner id P00294427 — the single
// source, migrated here from viatorClient.ts). The 'marker' and 'hostOnly'
// MECHANISMS ship now (typed + validated below) but carry NO entries — each
// tile PR adds its entry when Alex supplies the real link format. No guessed
// formats, ever.
//
// ID VALUES for future providers resolve from env (rotation without a code
// change; the repo stays free of unsigned partner ids). A missing env var
// DISABLES that provider (null — absence is honest); it is never an error and
// never a fallback URL.

/** One provider's validation recipe. Three modes:
 *  - 'params':   per-result candidate URLs must carry literal required params
 *                (Viator: pid=P00294427).
 *  - 'marker':   per-result candidate URLs must carry `param` equal to the env
 *                var's value (Travelpayouts-style marker ids). Env missing →
 *                provider disabled.
 *  - 'hostOnly': the env var IS the complete affiliate URL (Impact-style links
 *                carry the id in the path/subdomain, not a query param). The
 *                candidate argument is ignored; the env URL is validated
 *                (https + host allowlist) and returned verbatim. */
export type AffiliateProviderConfig =
  | {
      mode: 'params';
      hosts: readonly string[];
      requiredParams: Readonly<Record<string, string>>;
    }
  | {
      mode: 'marker';
      hosts: readonly string[];
      param: string;
      envVar: string;
    }
  | {
      mode: 'hostOnly';
      hosts: readonly string[];
      envVar: string;
    };

export type AffiliateProviderKey = 'viator';

/** Our Viator partner id — THE single source (viatorClient.ts imports it for
 *  URL construction; the activities route validates against it via the entry
 *  below). Was duplicated in viatorClient.ts:284 + the CHIP-1 route constant. */
export const VIATOR_PARTNER_ID = 'P00294427';
/** Our Viator campaign id — moved here from viatorClient.ts (VIATOR-URL-FIX)
 *  so the ONE shared builder below is the only place both params are stamped. */
export const VIATOR_MCID = '42383';

// ─── VIATOR-URL-FIX: the ONE shared affiliate-URL builder ────────────────────
// The audit (Viator link audit, 2026-08-17) found every rendered Viator link
// came from a hand-built `/tours/{productCode}` short path that is NOT
// Viator's canonical page shape (theirs: /tours/{destination}/{slug}/
// d{destId}-{productCode}) — the reported breakage. RULING: the API's own
// `productUrl` is PRIMARY everywhere; our affiliate params are appended to it
// only when absent (its existing query preserved); the constructed short path
// survives ONLY as the no-productUrl fallback. Pure + client-safe (the
// discover page imports it); viatorClient (server) and the scanner-results
// read-time re-map use the same function — one builder, zero drift.
//
// GATE LOCKSTEP (declared, no gate change required): validatedAffiliateUrl
// checks https + viator.com host + literal pid=P00294427 via searchParams —
// path-shape-agnostic. The builder stamps pid when absent, so every emitted
// form passes. A productUrl arriving with a DIFFERENT pid is NOT overwritten:
// the gate rejects it loudly (an attribution mismatch must be seen, not
// silently rewritten — fail-loud).
export function viatorAffiliateUrl(
  productUrl: string | null | undefined,
  productCode: string | null | undefined,
): string | null {
  if (productUrl) {
    try {
      const u = new URL(productUrl);
      if (!u.searchParams.get('pid')) u.searchParams.set('pid', VIATOR_PARTNER_ID);
      if (!u.searchParams.get('mcid')) u.searchParams.set('mcid', VIATOR_MCID);
      if (!u.searchParams.get('medium')) u.searchParams.set('medium', 'api');
      return u.toString();
    } catch {
      // Unparseable productUrl — fall through to the constructed fallback
      // (fail-loud: a malformed vendor URL must be seen, never emitted raw).
      console.error(`[affiliates] viator: productUrl not parseable — using constructed fallback (${productUrl.substring(0, 80)})`);
    }
  }
  if (productCode) {
    return `https://www.viator.com/tours/${productCode}?pid=${VIATOR_PARTNER_ID}&mcid=${VIATOR_MCID}&medium=api`;
  }
  return null;
}

export const AFFILIATE_PROVIDERS: Record<AffiliateProviderKey, AffiliateProviderConfig> = {
  // LIVE — the CHIP-1 recipe verbatim: the only host buildAffiliateUrl
  // constructs is www.viator.com (viatorClient.ts buildAffiliateUrl); the bare
  // apex is accepted exactly as CHIP-1 did.
  viator: {
    mode: 'params',
    hosts: ['www.viator.com', 'viator.com'],
    requiredParams: { pid: VIATOR_PARTNER_ID },
  },
};

/** The generalized emit gate. Returns the affiliate URL ONLY when it passes the
 *  provider's recipe; otherwise null. Rejections log loudly (fail-loud — a
 *  rejected URL in production means a provider changed their link shape or a
 *  raw vendor URL tried to escape). A null/undefined candidate ('params' and
 *  'marker' modes) and a missing env var ('marker'/'hostOnly') return null
 *  silently — absent is a normal state, not a defect. */
export function validatedAffiliateUrl(
  candidate: string | null | undefined,
  provider: AffiliateProviderKey,
): string | null {
  const cfg = AFFILIATE_PROVIDERS[provider];

  // hostOnly: the env value IS the URL; the per-result candidate is ignored.
  if (cfg.mode === 'hostOnly') {
    const fixed = process.env[cfg.envVar];
    if (!fixed) return null; // provider disabled — absence is honest
    return checkHostHttps(fixed, cfg.hosts, provider) ? fixed : null;
  }

  if (!candidate) return null;
  if (!checkHostHttps(candidate, cfg.hosts, provider)) return null;
  const u = new URL(candidate); // safe: checkHostHttps already parsed it

  if (cfg.mode === 'params') {
    for (const [param, expected] of Object.entries(cfg.requiredParams)) {
      if (u.searchParams.get(param) !== expected) {
        console.error(
          `[affiliates] ${provider}: URL failed validation (${param}=${u.searchParams.get(param) ?? 'none'}) — omitted`
        );
        return null;
      }
    }
    return candidate;
  }

  // mode === 'marker'
  const expected = process.env[cfg.envVar];
  if (!expected) return null; // provider disabled — absence is honest
  if (u.searchParams.get(cfg.param) !== expected) {
    console.error(
      `[affiliates] ${provider}: URL failed validation (${cfg.param}=${u.searchParams.get(cfg.param) ?? 'none'}) — omitted`
    );
    return null;
  }
  return candidate;
}

/** Shared https + host-allowlist check. Unparseable URLs reject loudly. */
function checkHostHttps(url: string, hosts: readonly string[], provider: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' || !hosts.includes(u.hostname)) {
      console.error(
        `[affiliates] ${provider}: URL failed validation (protocol=${u.protocol} host=${u.hostname}) — omitted`
      );
      return false;
    }
    return true;
  } catch {
    console.error(`[affiliates] ${provider}: URL is not parseable — omitted`);
    return false;
  }
}
