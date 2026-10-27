import fs from 'fs';
import path from 'path';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { decode } from 'next-auth/jwt';
import { getVerifiedEmail } from '@/lib/cookie-auth';
// HOME-03 (Alex, 2026-10-27): the rail's HOME — where a signed-in `/` lands now.
import { ANSWERS_HOME } from '@/lib/answers';
// SELL-02: per offer key, is its Stripe price id set — the one env-presence read, passed to both landings.
import { offerAvailabilityFromEnv } from '@/lib/offer';
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
 *
 * HOME-02 (Alex, 2026-10-25) — A SIGNED-IN `/` LANDS ON /runway. After the
 * ?tab= map and before anything renders, a verified arrival (the same two
 * signals as before — isVerifiedAuthed: the HMAC cookie via getVerifiedEmail,
 * or the NextAuth JWT) is sent on to the cockpit's Runway panel, /runway, with
 * the query string it came with (a /?date=… link keeps its date) — a 307, the
 * page-level redirect() idiom. HOME-01 put the day card first on that panel;
 * until this ruling the cockpit rendered at `/` as well, so the card's first
 * ‹ › was a route change (/ → /runway) that remounted the cockpit. Now the
 * card's URL is stable from the first click. A guest still gets the landing
 * below, unchanged; /?tab=compliance still renders the cockpit here (the
 * carve-out above). The destination is the cockpit's default panel, which is
 * dayCard.ts DAY_CARD_PATH's page (home02.test.ts holds the two equal).
 *
 * HOME-03 (Alex, 2026-10-27) — /home IS THE HOME. The same verified arrival is
 * sent to /home — the rail's HOME (answers.ts ANSWERS_HOME): THE ANSWERS, then
 * the day card (moved there from the cockpit's Runway panel, unchanged inside;
 * dayCard.ts DAY_CARD_PATH is '/home'), then THE SHEET — with the query string
 * it came with, as before. The guest landing below is unchanged; /?tab=compliance
 * still renders the cockpit here; /?tab=calendar still redirects to /runway, the
 * cockpit's calendar tab, which keeps its panel without the card. home03.test.ts
 * holds SIGNED_IN_HOME, ANSWERS_HOME and DAY_CARD_PATH equal.
 */

export const dynamic = 'force-dynamic';

/** Where a signed-in `/` lands — HOME-03 (Alex, 2026-10-27): /home, the rail's HOME and the day card's page (dayCard.ts DAY_CARD_PATH; home03.test.ts holds the three equal). HOME-02 (2026-10-25) sent it to /runway, the cockpit's Runway panel, where the card was. */
const SIGNED_IN_HOME = ANSWERS_HOME;

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
  const offerAvailability = offerAvailabilityFromEnv(process.env);
  if (params.tab !== undefined) {
    if (params.tab === 'compliance') return <HomeClient offerAvailability={offerAvailability} />;
    const TAB_TO_PATH: Record<string, string> = {
      calendar: '/runway', travel: '/travel', routines: '/routines',
      projects: '/projects', content: '/content', trade: '/trade',
      books: '/books', tax: '/tax',
    };
    redirect(typeof params.tab === 'string' ? (TAB_TO_PATH[params.tab] ?? '/') : '/');
  }

  // HOME-02 (Alex, 2026-10-25): a verified arrival lands on the day card's page — carrying the query string as given; the
  // ?tab= map above has already had its say. HOME-03 (Alex, 2026-10-27): that page is /home (SIGNED_IN_HOME above).
  if (await isVerifiedAuthed()) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      for (const v of value === undefined ? [] : typeof value === 'string' ? [value] : value) query.append(key, v);
    }
    const qs = query.toString();
    redirect(qs === '' ? SIGNED_IN_HOME : `${SIGNED_IN_HOME}?${qs}`);
  }

  // SELL-02: the offer's availability (computed above, before the authed branch — the
  // cockpit's locked cards need it too) rides both landings; the env value never leaves.
  // PR-ELEV-2d: per cleared logo slot, does public/logos/<slug>.svg exist?
  // File-presence only (the availability-map idiom above) — a dropped file
  // lights its Built-on card on the next request, no code change. force-
  // dynamic keeps the check per-request.
  const logoAvailability = Object.fromEntries(
    BUILT_ON.flatMap((e) =>
      e.logo ? [[e.logo.slug, fs.existsSync(path.join(process.cwd(), 'public', 'logos', `${e.logo.slug}.svg`))]] : [],
    ),
  );
  return <GuestLanding offerAvailability={offerAvailability} logoAvailability={logoAvailability} />;
}
