import dns from 'dns/promises';
import net from 'net';

// SEC-5: SSRF guard for server-side fetches of USER-SUPPLIED URLs (fetch-og).
// The og-preview feature legitimately fetches arbitrary PUBLIC listing pages, so
// a domain allowlist would break it. Instead we block the SSRF vector: non-http(s)
// schemes and any host that resolves to a private / loopback / link-local /
// cloud-metadata address. Deny-by-default — a malformed or unresolvable host is
// blocked, never fetched.
//
// IP-range math is delegated to Node's net.BlockList instead of hand-rolled
// string checks. BlockList does correct subnet arithmetic and, crucially,
// evaluates an IPv4-mapped IPv6 address (e.g. ::ffff:7f00:1) against the IPv4
// rules automatically — closing the IPv4-mapped-hex bypass that dotted-string
// matching missed. The IPv4-embedded-in-IPv6 transition ranges (::/96,
// 64:ff9b::/96, 2002::/16) are added as explicit v6 subnets so those forms are
// blocked structurally regardless of the embedded payload.

// Private / reserved ranges that must never be reached from a user-supplied URL.
// Kept as data so the set is auditable at a glance.
const BLOCKED_V4: Array<[string, number]> = [
  ['0.0.0.0', 8],       // 0.0.0.0/8 "this host" / current network
  ['10.0.0.0', 8],      // RFC1918 private
  ['100.64.0.0', 10],   // RFC6598 CGNAT
  ['127.0.0.0', 8],     // loopback
  ['169.254.0.0', 16],  // link-local (incl. 169.254.169.254 cloud metadata)
  ['172.16.0.0', 12],   // RFC1918 private
  ['192.168.0.0', 16],  // RFC1918 private
  ['224.0.0.0', 4],     // multicast
  ['240.0.0.0', 4],     // reserved / future use (incl. 255.255.255.255 broadcast)
];

const BLOCKED_V6: Array<[string, number]> = [
  ['::', 128],          // unspecified
  ['::1', 128],         // loopback
  ['::', 96],           // IPv4-compatible ::a.b.c.d (deprecated; embeds a v4 address)
  ['64:ff9b::', 96],    // NAT64 well-known prefix (embeds a v4 address)
  ['2002::', 16],       // 6to4 (embeds a v4 address in the next 32 bits)
  ['fc00::', 7],        // unique-local (fc00::/7 covers fc.. and fd..)
  ['fe80::', 10],       // link-local (fe80::/10 covers fe80.. through febf..)
  ['ff00::', 8],        // multicast
];

function buildBlockList(): net.BlockList {
  const bl = new net.BlockList();
  for (const [addr, prefix] of BLOCKED_V4) bl.addSubnet(addr, prefix, 'ipv4');
  for (const [addr, prefix] of BLOCKED_V6) bl.addSubnet(addr, prefix, 'ipv6');
  return bl;
}

const BLOCK_LIST = buildBlockList();

/**
 * True when `ip` (an IPv4 or IPv6 literal) falls in any private / reserved
 * range, or is not a recognizable IP literal at all (fail closed). BlockList
 * evaluates IPv4-mapped IPv6 (::ffff:a.b.c.d, in any hex/dotted spelling)
 * against the IPv4 rules automatically.
 */
function isBlockedIp(ip: string): boolean {
  const fam = net.isIP(ip);
  if (fam === 4) return BLOCK_LIST.check(ip, 'ipv4');
  if (fam === 6) return BLOCK_LIST.check(ip, 'ipv6');
  return true; // not a valid IP literal → block
}

/**
 * Returns null when `rawUrl` is safe to fetch server-side, or a string reason
 * when it must be blocked (non-http(s) scheme, or the host is / resolves to a
 * private/reserved address). Resolves the hostname and blocks if ANY returned
 * address is private — closing the direct SSRF path to internal services and
 * the cloud metadata endpoint. Fails closed on any parse/resolve failure.
 */
export async function assertPublicHttpUrl(rawUrl: string): Promise<string | null> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return 'Invalid URL';
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return 'Only http(s) URLs are allowed';
  }
  // URL.hostname wraps IPv6 literals in brackets — strip them for net.isIP.
  const host = parsed.hostname.replace(/^\[|\]$/g, '');

  // Host given as an IP literal — check it directly (no DNS).
  if (net.isIP(host)) {
    return isBlockedIp(host) ? 'URL resolves to a private or reserved address' : null;
  }

  // Hostname — resolve all A/AAAA records and block if ANY is private.
  let addresses: string[];
  try {
    const results = await dns.lookup(host, { all: true });
    addresses = results.map((r) => r.address);
  } catch {
    return 'Could not resolve host';
  }
  if (addresses.length === 0) return 'Could not resolve host';
  if (addresses.some(isBlockedIp)) return 'URL resolves to a private or reserved address';
  return null;
}

/**
 * Thrown when a request target (the initial URL or any redirect Location) fails
 * the SSRF guard. Routes map this to a 400. `reason` carries the guard's message.
 */
export class SsrfBlockedError extends Error {
  readonly reason: string;
  constructor(reason: string) {
    super(reason);
    this.name = 'SsrfBlockedError';
    this.reason = reason;
  }
}

const MAX_REDIRECTS = 4;

export interface SafeFetchOptions {
  /**
   * Validator run against the initial URL and every redirect Location. Defaults
   * to assertPublicHttpUrl. Exposed as a seam so per-call policies (and hermetic
   * redirect tests against loopback) can override it; production callers omit it
   * and get the standard public-only guard.
   */
  validate?: (url: string) => Promise<string | null>;
}

/**
 * SSRF-safe replacement for `fetch` on USER-INFLUENCED URLs. It re-validates
 * the target with assertPublicHttpUrl BEFORE every hop, follows redirects
 * manually (under `redirect: 'manual'` Node returns the real 3xx response with a
 * readable Location, unlike the browser's opaque redirect), re-checks each
 * Location resolved against the current URL, and caps the redirect depth.
 *
 * Fails closed: any block reason throws SsrfBlockedError and NO request to an
 * internal target is ever issued — there is no fallback path that fetches when a
 * check is uncertain.
 */
export async function safeFetch(
  rawUrl: string,
  init?: RequestInit,
  opts?: SafeFetchOptions,
): Promise<Response> {
  const validate = opts?.validate ?? assertPublicHttpUrl;
  let currentUrl = rawUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const blockReason = await validate(currentUrl);
    if (blockReason) throw new SsrfBlockedError(blockReason);

    const res = await fetch(currentUrl, { ...init, redirect: 'manual' });

    // Non-redirect response — hand it back to the caller.
    if (res.status < 300 || res.status >= 400) return res;

    const location = res.headers.get('location');
    if (!location) return res; // 3xx without a Location: nothing to follow.

    // Drain the redirect body so the socket can be reused, then resolve the
    // (possibly relative) Location against the current URL and loop to re-check.
    try {
      await res.arrayBuffer();
    } catch {
      /* body already consumed / empty — ignore */
    }

    let nextUrl: string;
    try {
      nextUrl = new URL(location, currentUrl).toString();
    } catch {
      throw new SsrfBlockedError('Invalid redirect target');
    }
    currentUrl = nextUrl;
  }

  throw new SsrfBlockedError('Too many redirects');
}
