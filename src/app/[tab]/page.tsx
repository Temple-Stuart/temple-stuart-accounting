import { notFound } from 'next/navigation';
import HomeClient from '@/components/home/HomeClient';

/**
 * ROUTE-1 — real URLs for the app tabs: /runway /travel /routines /projects
 * /content /trade /books /tax. ONE dynamic segment (the audit's call: eight
 * near-identical thin pages would say nothing this allowlist doesn't), with a
 * STRICT allowlist — any other value 404s via notFound(), so this segment
 * never swallows a typo as an app page. Next's static-route precedence keeps
 * every existing top-level page (/pricing, /modules, /hub, /compliance, …)
 * winning over this segment untouched.
 *
 * NOTE — /compliance is deliberately ABSENT: it collides with the standalone
 * cockpit page (src/app/compliance/page.tsx, AppLayout-wrapped), which is
 * out of ROUTE-1's scope by ruling ("the cockpit question is NOT in scope").
 * Static-beats-dynamic means this route could never receive it anyway; the
 * Compliance tab keeps the legacy /?tab=compliance URL until Alex rules the
 * collision (see the ROUTE-1 report).
 *
 * BOTH audiences render <HomeClient/> — byte-for-byte the old "?tab= is
 * explicit app intent" contract (page.tsx FD-2): an authed visitor gets the
 * cockpit shell with the tab active (ModuleLauncher's F2 restore now reads
 * the PATH), and a guest gets today's guest app view (pointer cards + the
 * guest-functional travel search) — no redirect, no new gate. Client-side
 * auth resolution is unchanged.
 */

// HERO-BUG-1: force-dynamic — the ONE real divergence between this mount and
// the front door's (page.tsx:35, which also force-dynamics).
// Without it, this page uses no dynamic API, so Next renders it on demand and
// CACHES it (the Full Route Cache) with cacheable response headers — a static
// shell that can outlive a deployment in CDN/browser caches
// (stale-while-revalidate) and keep pointing at the PREVIOUS build's immutable
// JS chunks. That is exactly how a signed-in user saw the pre-ROUTE-1b
// unconditional "Get Started" next to an authed header AFTER #1335 merged:
// within any one bundle both surfaces read the SAME `authed` state
// (HomeClient — one variable, one fetch; they cannot disagree), but a stale
// cached shell runs the OLD bundle. force-dynamic renders per-request with
// no-store headers — no cacheable shell, no resurrection. ROUTE-1b's
// three-state hero logic is untouched.
export const dynamic = 'force-dynamic';

const TAB_PATHS = new Set([
  'runway', 'travel', 'routines', 'projects', 'content', 'trade', 'books', 'tax',
]);

export default async function TabPage({ params }: {
  params: Promise<{ tab: string }>;
}) {
  const { tab } = await params;
  if (!TAB_PATHS.has(tab)) notFound();
  return <HomeClient />;
}
