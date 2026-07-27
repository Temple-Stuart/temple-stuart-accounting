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
