import { cookies } from 'next/headers';
import { decode } from 'next-auth/jwt';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { TAB_ENTITLEMENT_KEYS, BUNDLE_ALL_KEY } from '@/lib/categoryKeys';
import { getPriceIdFromEntitlementKey } from '@/lib/stripe';
import HomeClient from '@/components/home/HomeClient';
import GuestLanding from '@/components/landing/GuestLanding';

/**
 * FD-2 — the front door. Bare templestuart.com BRANCHES server-side (zero
 * flicker): a VERIFIED-authed arrival gets the cockpit (<HomeClient/> — the
 * former page body, moved verbatim); an unverified arrival gets the Landing
 * sales floor. Any ?tab= param is EXPLICIT APP INTENT and renders the app for
 * both audiences (a guest gets today's guest view; the F2 client-side restore
 * in ModuleLauncher :204-231 then selects the tab).
 *
 * VERIFICATION, not cookie existence — the SAME two signals middleware trusts
 * (middleware.ts:127-138):
 *   1. the HMAC-signed userEmail cookie via getVerifiedEmail() (cookie-auth.ts
 *      :26-46 timing-safe verify; server-component-safe — cookies()-based);
 *   2. the NextAuth session JWT, VERIFIED by next-auth/jwt decode() with the
 *      same JWT_SECRET middleware passes to getToken (:132) — decode returns
 *      null/throws on a forged or garbled token.
 * A forged or stale cookie therefore fails verification and gets the Landing —
 * never a cockpit shell.
 *
 * Guest renders make ZERO paid/authed external calls: the availability map
 * reads STRIPE_*_PRICE_ID env presence only (getPriceIdFromEntitlementKey —
 * the /pricing/page.tsx:15-24 pattern; price-ID values never reach the
 * client). cookies() makes this route request-dynamic by nature; force-dynamic
 * states it explicitly, mirroring /pricing.
 */

export const dynamic = 'force-dynamic';

async function isVerifiedAuthed(): Promise<boolean> {
  // Signal 1 — the signed cookie, VERIFIED (timing-safe HMAC).
  if (await getVerifiedEmail()) return true;

  // Signal 2 — the NextAuth session token, VERIFIED (decode, same secret as
  // middleware's getToken). Checks both cookie names getToken checks.
  const cookieStore = await cookies();
  const rawToken =
    cookieStore.get('next-auth.session-token')?.value ??
    cookieStore.get('__Secure-next-auth.session-token')?.value;
  if (!rawToken || !process.env.JWT_SECRET) return false;
  try {
    return (await decode({ token: rawToken, secret: process.env.JWT_SECRET })) !== null;
  } catch {
    return false;
  }
}

export default async function Page({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // ?tab=<anything> → the app, both audiences (explicit app intent). The F2
  // restore validates the value client-side; an invalid one is stripped there.
  const params = await searchParams;
  if (params.tab !== undefined) return <HomeClient />;

  if (await isVerifiedAuthed()) return <HomeClient />;

  // DECKS-3: availability computes over the FULL purchasable tab vocabulary
  // (categoryKeys.ts:22-29 + bundle:all) — tab:travel / tab:operations now
  // back landing Select buttons, so a Stripe price Alex configures for them
  // must surface without a code change. Same env-presence-only read.
  const entitlementAvailability = Object.fromEntries(
    [...TAB_ENTITLEMENT_KEYS, BUNDLE_ALL_KEY].map((k) => [k, getPriceIdFromEntitlementKey(k) !== null]),
  );
  return <GuestLanding entitlementAvailability={entitlementAvailability} />;
}
