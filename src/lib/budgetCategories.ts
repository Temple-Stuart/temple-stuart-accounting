/**
 * ROOM-01 — THE SIX BUDGET CATEGORIES, one const.
 *
 * Step 11 BUDGET was eight doors in the rail: six near-identical pages each
 * mounting BudgetingPage with a different prop, plus /shopping and
 * /hub/itinerary. It is one room now — /budget — and this is the list the
 * switcher reads. Every field is what the six page files encoded on 2026-09-10,
 * moved here verbatim rather than retyped:
 *
 *   /business  <BudgetingPage category="Business" emoji="💼" apiPath="/api/business" />
 *   /personal  <BudgetingPage category="Personal" emoji="👤" apiPath="/api/personal" />
 *   /household <BudgetingPage category="Home"     emoji="🏠" apiPath="/api/home" />
 *   /auto      <BudgetingPage category="Auto"     emoji="🚗" apiPath="/api/auto" />
 *   /growth    <BudgetingPage category="Growth"   emoji="📈" apiPath="/api/growth" />
 *   /health    <BudgetingPage category="Health"   emoji="🏥" apiPath="/api/health" />
 *
 * `apiPath` is NOT uniform, and that is a finding, not an oversight: four of the
 * six routes were byte-identical apart from a module string and collapsed into
 * /api/budget/<module> (ROOM-01 STEP 3). Business keeps its own route — its GET
 * returns an extra coaAccounts payload — and Home keeps its own because it reads
 * and writes a DIFFERENT TABLE, home_expenses, with different columns. Neither
 * was merged; a different table is a finding, not a merge.
 *
 * `legacyPath` is the route that used to serve this category and now redirects
 * to /budget?category=<slug>. Zero imports — client-safe.
 */
export interface BudgetCategory {
  /** The ?category= value — lowercase, the URL's word. */
  slug: string;
  /** The label BudgetingPage renders and matches its entity on. */
  category: string;
  emoji: string;
  /** The API this category's recurring lines live behind. */
  apiPath: string;
  /** The page that used to serve it; now a redirect. */
  legacyPath: string;
}

export const BUDGET_CATEGORIES: readonly BudgetCategory[] = [
  { slug: 'business', category: 'Business', emoji: '💼', apiPath: '/api/business', legacyPath: '/business' },
  { slug: 'personal', category: 'Personal', emoji: '👤', apiPath: '/api/budget/personal', legacyPath: '/personal' },
  { slug: 'home', category: 'Home', emoji: '🏠', apiPath: '/api/home', legacyPath: '/household' },
  { slug: 'auto', category: 'Auto', emoji: '🚗', apiPath: '/api/budget/auto', legacyPath: '/auto' },
  { slug: 'growth', category: 'Growth', emoji: '📈', apiPath: '/api/budget/growth', legacyPath: '/growth' },
  { slug: 'health', category: 'Health', emoji: '🏥', apiPath: '/api/budget/health', legacyPath: '/health' },
];

/** The four whose routes were provably identical and now share /api/budget/<module>. */
export const COLLAPSED_MODULES: readonly string[] = BUDGET_CATEGORIES
  .filter((c) => c.apiPath.startsWith('/api/budget/'))
  .map((c) => c.slug);

/** The step's screen. The route matches the tab name — the standing rule. */
export const BUDGET_HOME = '/budget';

export const budgetHref = (slug: string): string => `${BUDGET_HOME}?category=${slug}`;

/**
 * The category a ?category= names. Returns the FIRST when the value is unknown
 * or absent, with `fellBack` set so the room can SAY it fell back rather than
 * render an empty room or pretend the URL was right.
 */
export function categoryFor(raw: string | undefined): { category: BudgetCategory; fellBack: boolean } {
  const found = raw ? BUDGET_CATEGORIES.find((c) => c.slug === raw.toLowerCase()) : undefined;
  if (found) return { category: found, fellBack: false };
  return { category: BUDGET_CATEGORIES[0], fellBack: raw !== undefined && raw !== '' };
}

export class BudgetCategoriesLawError extends Error {
  constructor(message: string) {
    super(`BUDGET CATEGORIES LAW: ${message}`);
    this.name = 'BudgetCategoriesLawError';
  }
}

/** THE LAW: six categories, unique slugs, every field present, every legacy path a route. */
export function budgetCategoriesLaw(opts: { throwOnFail?: boolean; categories?: readonly BudgetCategory[] } = {}): string[] {
  const cats = opts.categories ?? BUDGET_CATEGORIES;
  const violations: string[] = [];
  if (cats.length !== 6) violations.push(`${cats.length} categories, expected the six the pages encoded`);
  const slugs = new Set<string>();
  for (const c of cats) {
    if (slugs.has(c.slug)) violations.push(`duplicate slug "${c.slug}"`);
    slugs.add(c.slug);
    if (!/^[a-z][a-z0-9-]*$/.test(c.slug)) violations.push(`${c.slug}: slug is not kebab-case`);
    if (!c.category.trim()) violations.push(`${c.slug}: no category label`);
    if (!c.emoji.trim()) violations.push(`${c.slug}: no emoji`);
    if (!c.apiPath.startsWith('/api/')) violations.push(`${c.slug}: apiPath "${c.apiPath}" is not an API route`);
    if (!c.legacyPath.startsWith('/')) violations.push(`${c.slug}: legacyPath "${c.legacyPath}" is not a route`);
  }
  if (violations.length && opts.throwOnFail !== false) throw new BudgetCategoriesLawError(violations.join('\n  '));
  return violations;
}

budgetCategoriesLaw();
