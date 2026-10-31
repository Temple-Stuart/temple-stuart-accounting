/**
 * FX-01b (Alex, 2026-10-30, ruling A) — THE BOOKS LANE IS WHAT BooksPipeline MOUNTS.
 *
 * The books currency law (scripts/assert-tool-registry.ts, "The books currency law") holds a LANE of files to
 * the one formatter in src/lib/books/functionalCurrency.ts. FX-01 named the lane's components by hand — eleven
 * of them — and five more screens BooksPipeline mounts kept a literal `$` (FinancialStatementsTab,
 * PositionReportTab, WashSaleReportTab, CloseBooksTab, SpendingTab). The component lane is now DERIVED:
 * every module src/components/home/BooksPipeline.tsx imports from '@/components/…' is in the lane, so a
 * component added to BooksPipeline's imports joins the lane with no law change, and a hand-kept list cannot
 * drift from the screen. The seven route directories stay named in the law — no component mounts a route.
 *
 * THIS FILE IS PURE: it reads the source TEXT it is handed (the law hands it code() — comments stripped — so
 * an import a comment mentions is not a mount) and returns repo-relative paths WITHOUT an extension, in
 * import order, each once; the law resolves each to .tsx / .ts (or an index file) and fails by name when
 * none answers. No filesystem, no Prisma, no React.
 */

/** `from '@/components/<path>'` — a value import or a type import alike; the path, without an extension. */
const COMPONENT_IMPORT = /\bfrom\s+['"]@\/components\/([^'"]+)['"]/g;

/** Every '@/components/…' module the source imports, as 'src/components/<path>' (no extension), in order, once each. */
export function booksLaneImports(source: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const re = new RegExp(COMPONENT_IMPORT.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    const path = `src/components/${m[1]}`;
    if (seen.has(path)) continue;
    seen.add(path);
    out.push(path);
  }
  return out;
}
