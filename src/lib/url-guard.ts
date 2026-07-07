import dns from 'dns/promises';
import net from 'net';

// SEC-5: SSRF guard for server-side fetches of USER-SUPPLIED URLs (fetch-og).
// The og-preview feature legitimately fetches arbitrary PUBLIC listing pages, so
// a domain allowlist would break it. Instead we block the SSRF vector: non-http(s)
// schemes and any host that resolves to a private / loopback / link-local /
// cloud-metadata address. Deny-by-default — a malformed or unresolvable host is
// blocked, never fetched.

function isBlockedIpv4(ip: string): boolean {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true; // malformed → block
  const [a, b] = p;
  if (a === 0) return true;                            // 0.0.0.0/8 "this host"
  if (a === 10) return true;                           // 10.0.0.0/8 private
  if (a === 127) return true;                          // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true;             // 169.254.0.0/16 link-local (incl. 169.254.169.254 metadata)
  if (a === 172 && b >= 16 && b <= 31) return true;    // 172.16.0.0/12 private
  if (a === 192 && b === 168) return true;             // 192.168.0.0/16 private
  if (a === 100 && b >= 64 && b <= 127) return true;   // 100.64.0.0/10 CGNAT
  if (a >= 224) return true;                           // 224.0.0.0/4 multicast + 240/4 reserved
  return false;
}

function isBlockedIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true;  // loopback / unspecified
  if (lower.startsWith('fe80')) return true;           // link-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique-local fc00::/7
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);        // IPv4-mapped
  if (mapped) return isBlockedIpv4(mapped[1]);
  return false;
}

function isBlockedIp(ip: string): boolean {
  const fam = net.isIP(ip);
  if (fam === 4) return isBlockedIpv4(ip);
  if (fam === 6) return isBlockedIpv6(ip);
  return true; // not a valid IP literal → block
}

/**
 * Returns null when `rawUrl` is safe to fetch server-side, or a string reason
 * when it must be blocked (non-http(s) scheme, or the host is / resolves to a
 * private/reserved address). Resolves the hostname and blocks if ANY returned
 * address is private — closing the direct SSRF path to internal services and
 * the cloud metadata endpoint.
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
