// NAV-01b: the owner utilities behind the header/profile menu — pages that are
// tools for the operator, not tools in the sheet. ONE source for both headers
// (HomeClient's cockpit header and the AppLayout shell bar) and for the
// build-time reachability law (scripts/assert-tool-registry.ts): a page listed
// here has its door in the menu. Zero imports, client-safe.
export interface ShellUtility {
  label: string;
  href: string;
  /** why it is a utility and not a tool — the census cite */
  why: string;
}

export const OWNER_UTILITIES: readonly ShellUtility[] = [
  { label: 'Developer console', href: '/developer', why: 'prospects + client accounts behind its own gate — src/app/developer/page.tsx:23' },
  { label: 'Data observatory', href: '/data-observatory', why: 'source health probes; the check route is requireAdmin — src/app/api/data-observatory/check/route.ts:934' },
  { label: 'Dev · flight checkout (Duffel)', href: '/dev/flight-checkout', why: 'test harness, disabled in production — src/app/dev/flight-checkout/page.tsx header' },
  { label: 'Dev · flight checkout (LiteAPI)', href: '/dev/liteapi-flight-checkout', why: 'test harness, disabled in production — src/app/dev/liteapi-flight-checkout/page.tsx header' },
];
