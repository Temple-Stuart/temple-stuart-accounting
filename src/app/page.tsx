import fs from 'fs';
import path from 'path';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { decode } from 'next-auth/jwt';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { TAB_ENTITLEMENT_KEYS, BUNDLE_ALL_KEY } from '@/lib/categoryKeys';
import { getPriceIdFromEntitlementKey } from '@/lib/stripe';
import { BUILT_ON } from '@/lib/builtOnWall';
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
 * reads STRIPE_*_PRICE_ID env presence only (getPriceIdFromEntitlementKey;
 * price-ID values never reach the client). cookies() makes this route
 * request-dynamic by nature; force-dynamic states it explicitly. (PR-PRICE-3:
 * this page IS the pricing surface now — /pricing redirects to /#modules.)
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
  // ROUTE-1: legacy /?tab=<x> links redirect FOREVER to the real paths
  // (/travel, /runway, …) — old links in the wild keep working. redirect() =
  // 307 (temporary), deliberately not 308: browsers cache permanent redirects
  // aggressively and the mapping should stay revisable. Two carve-outs:
  //   • tab=compliance renders the app as before (NO redirect): /compliance is
  //     the standalone cockpit page — the collision awaits Alex's ruling.
  //   • an invalid/non-string value redirects to the clean root (never a lying
  //     URL — the F2 doctrine, now server-side).
  const params = await searchParams;
  if (params.tab !== undefined) {
    if (params.tab === 'compliance') return <HomeClient />;
    const TAB_TO_PATH: Record<string, string> = {
      calendar: '/runway', travel: '/travel', routines: '/routines',
      projects: '/projects', content: '/content', trade: '/trade',
      books: '/books', tax: '/tax',
    };
    redirect(typeof params.tab === 'string' ? (TAB_TO_PATH[params.tab] ?? '/') : '/');
  }

  if (await isVerifiedAuthed()) return <HomeClient />;

  // DECKS-3: availability computes over the FULL purchasable tab vocabulary
  // (categoryKeys.ts:22-29 + bundle:all) — tab:travel / tab:operations now
  // back landing Select buttons, so a Stripe price Alex configures for them
  // must surface without a code change. Same env-presence-only read.
  const entitlementAvailability = Object.fromEntries(
    [...TAB_ENTITLEMENT_KEYS, BUNDLE_ALL_KEY].map((k) => [k, getPriceIdFromEntitlementKey(k) !== null]),
  );
  // PR-ELEV-2d: per cleared logo slot, does public/logos/<slug>.svg exist?
  // File-presence only (the availability-map idiom above) — a dropped file
  // lights its Built-on card on the next request, no code change. force-
  // dynamic keeps the check per-request.
  const logoAvailability = Object.fromEntries(
    BUILT_ON.flatMap((e) =>
      e.logo ? [[e.logo.slug, fs.existsSync(path.join(process.cwd(), 'public', 'logos', `${e.logo.slug}.svg`))]] : [],
    ),
  );
  return <GuestLanding entitlementAvailability={entitlementAvailability} logoAvailability={logoAvailability} />;
}
