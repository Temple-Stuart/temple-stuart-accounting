import Link from 'next/link';
import AppLayout from '@/components/ui/AppLayout';
import BudgetingPage from '@/components/dashboard/BudgetingPage';
import ToolOpener from '@/components/shell/ToolOpener';
import { navToolByName } from '@/lib/nav';
import { TOOL_GATE } from '@/lib/offer';
import { BUDGET_CATEGORIES, budgetHref, categoryFor } from '@/lib/budgetCategories';

/**
 * ROOM-01 — /budget, STEP 11's ONE ROOM. Six near-identical pages (/business,
 * /personal, /household, /auto, /growth, /health) each mounted BudgetingPage
 * with a different prop and each had its own rail door. They are one screen with
 * a category switcher now, and the route matches the tab name.
 *
 * The selection lives in the URL (?category=…) so a link is shareable and the
 * back button works — no browser storage, no client state. The switcher is
 * plain links over the ONE const (src/lib/budgetCategories.ts).
 *
 * An unknown ?category= falls to the first and SAYS SO on screen: never an empty
 * room, never a silent correction of the URL the viewer typed.
 *
 * `key` on BudgetingPage: the room loads on mount (useEffect with []), so
 * switching category remounts it rather than leaving the previous category's
 * rows on screen. The room's own body is untouched — DS-02 owns interiors.
 */
export const dynamic = 'force-dynamic';

export default async function BudgetPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = typeof params.category === 'string' ? params.category : undefined;
  const { category, fellBack } = categoryFor(raw);
  const budget = navToolByName('Budget', TOOL_GATE);

  return (
    <AppLayout page>
      <ToolOpener
        tools={[budget]}
        line="Your recurring cost lines and what you actually spent, by category."
      />

      <nav aria-label="Budget categories" data-budget-switcher className="mb-4 flex flex-wrap gap-1.5">
        {BUDGET_CATEGORIES.map((c) => {
          const active = c.slug === category.slug;
          return (
            <Link
              key={c.slug}
              href={budgetHref(c.slug)}
              data-category={c.slug}
              aria-current={active ? 'page' : undefined}
              className={`rounded border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                active
                  ? 'border-brand-purple bg-brand-purple text-white'
                  : 'border-border text-text-secondary hover:bg-bg-row'
              }`}
            >
              {c.emoji} {c.category}
            </Link>
          );
        })}
      </nav>

      {fellBack && (
        <p role="status" data-category-fellback className="mb-3 font-mono text-[11px] text-brand-amber">
          There is no “{raw}” category — showing {category.category}. The six are{' '}
          {BUDGET_CATEGORIES.map((c) => c.category).join(', ')}.
        </p>
      )}

      <BudgetingPage
        key={category.slug}
        category={category.category}
        emoji={category.emoji}
        apiPath={category.apiPath}
      />
    </AppLayout>
  );
}
