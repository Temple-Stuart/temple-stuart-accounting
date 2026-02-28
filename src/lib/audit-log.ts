/**
 * Lightweight structured audit logger.
 * Outputs JSON to stdout — Vercel captures these automatically.
 */
import { createHash } from 'crypto';

function hashEmail(email: string): string {
  return createHash('sha256').update(email).digest('hex');
}

export function logAuth(event: string, email: string, ip?: string): void {
  console.log(JSON.stringify({
    type: 'auth',
    event,
    emailHash: hashEmail(email),
    ip: ip ?? null,
    ts: new Date().toISOString(),
  }));
}

export function logAccess(route: string, userId: string): void {
  console.log(JSON.stringify({
    type: 'access',
    route,
    userId,
    ts: new Date().toISOString(),
  }));
}
