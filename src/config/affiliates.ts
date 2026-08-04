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
