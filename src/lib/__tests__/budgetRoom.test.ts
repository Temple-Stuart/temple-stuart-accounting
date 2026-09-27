import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import {
  BUDGET_CATEGORIES, BUDGET_HOME, COLLAPSED_MODULES, BudgetCategoriesLawError,
  budgetCategoriesLaw, budgetHref, categoryFor,
} from '../budgetCategories';
import { navLaw, navToolByName, navRows } from '../nav';
import { TOOL_GATE } from '../offer';
import { TOOL_REGISTRY } from '../toolRegistry';
import { code } from '../sourceText';

// ROOM-01 — Budget is ONE room: six category pages became a switcher.


test('the six categories are one const, and the law holds on them', () => {
  assert.deepEqual(budgetCategoriesLaw({ throwOnFail: false }), []);
  assert.equal(BUDGET_CATEGORIES.length, 6);
  assert.deepEqual(BUDGET_CATEGORIES.map((c) => c.slug), ['business', 'personal', 'home', 'auto', 'growth', 'health']);
  // The labels and emoji are what the six page files encoded — not retyped.
  assert.deepEqual(BUDGET_CATEGORIES.map((c) => c.category), ['Business', 'Personal', 'Home', 'Auto', 'Growth', 'Health']);
  assert.throws(() => budgetCategoriesLaw({ categories: BUDGET_CATEGORIES.slice(0, 5) }), BudgetCategoriesLawError);
});

// TAB13-02b (2026-09-27): /budget renders THE BUDGET REPORT. The category
// switcher, its unknown-category line and the BudgetingPage mount left the page;
// this test replaced "the switcher renders every category from the const".
test('/budget renders the budget report — not the category switcher, not BudgetingPage', () => {
  const page = code('src/app/budget/page.tsx');
  assert.match(page, /import BudgetReport from '@\/components\/budget\/BudgetReport';/);
  assert.match(page, /<BudgetReport \/>/, 'the report is mounted');
  assert.doesNotMatch(page, /BudgetingPage/, 'the category room is not mounted');
  assert.doesNotMatch(page, /data-budget-switcher|BUDGET_CATEGORIES/, 'no switcher');
  // Still: not one category name is typed into the page.
  for (const c of BUDGET_CATEGORIES) {
    assert.ok(!new RegExp(`["'>]${c.category}["'<]`).test(page), `${c.category} is not typed into the page`);
  }
  // Nothing was deleted: the room's component and the const stay.
  assert.ok(existsSync(`${process.cwd()}/src/components/dashboard/BudgetingPage.tsx`));
  assert.ok(existsSync(`${process.cwd()}/src/lib/budgetCategories.ts`));
});

test('an unknown ?category= falls to the FIRST and says so — never an empty room', () => {
  assert.equal(categoryFor(undefined).category.slug, 'business');
  assert.equal(categoryFor(undefined).fellBack, false, 'no category asked for is not a fallback');
  assert.equal(categoryFor('growth').category.slug, 'growth');
  assert.equal(categoryFor('GROWTH').category.slug, 'growth', 'case does not matter');
  const bogus = categoryFor('nope');
  assert.equal(bogus.category.slug, 'business', 'the first, not nothing');
  assert.equal(bogus.fellBack, true, 'and the room is told to say so');
  // TAB13-02b: the page no longer reads ?category= — the two assertions that it
  // rendered the unknown-category line (data-category-fellback, "There is no")
  // left with the switcher. categoryFor itself is kept and still pinned above.
  assert.doesNotMatch(code('src/app/budget/page.tsx'), /category/, 'the page reads no ?category=');
});

test('the six legacy routes are redirects to the room, and each one resolves', () => {
  for (const c of BUDGET_CATEGORIES) {
    const file = `src/app${c.legacyPath}/page.tsx`;
    assert.ok(existsSync(`${process.cwd()}/${file}`), `${file} still exists — no page is deleted`);
    const body = code(file);
    assert.match(body, new RegExp(`redirect\\('${BUDGET_HOME}\\?category=${c.slug}'\\)`), `${c.legacyPath} redirects to its category`);
    assert.ok(body.split('\n').filter((l) => l.trim()).length <= 10, `${c.legacyPath} is a short redirect`);
    assert.ok(!body.includes('BudgetingPage'), `${c.legacyPath} no longer mounts the room`);
  }
  assert.equal(budgetHref('auto'), '/budget?category=auto');
});

test('Budget opens /budget, and no category page is a door anywhere', () => {
  // NAV-25: the steps layer is gone; the rail's rows are the twenty-five tools.
  assert.deepEqual(navLaw({ throwOnFail: false, gate: TOOL_GATE }), []);
  const budget = navToolByName('Budget', TOOL_GATE);
  assert.equal(budget.href, BUDGET_HOME);
  assert.equal(TOOL_REGISTRY.find((t) => t.name === 'Budget')?.home, BUDGET_HOME);
  const legacy = new Set(BUDGET_CATEGORIES.map((c) => c.legacyPath));
  for (const tool of navRows(TOOL_GATE)) {
    if (tool.href) assert.ok(!legacy.has(tool.href), `${tool.name} opens the category page ${tool.href}`);
    for (const sub of tool.subRows) assert.ok(!legacy.has(sub.door.href), `${tool.name} still links ${sub.label}`);
  }
  // What Budget keeps, plus the agenda planner CAL-01 handed it: recurring-spend
  // planning is Budget's work, and the planner is where it is done.
  assert.deepEqual(budget.subRows.map((r) => r.door.href), ['/agenda', '/shopping', '/hub/itinerary', '/runway']);
});

test('only the PROVABLY identical routes were collapsed — business and home kept their own', () => {
  assert.deepEqual([...COLLAPSED_MODULES], ['personal', 'auto', 'growth', 'health']);
  // Business returns an extra coaAccounts payload; home reads and writes a
  // DIFFERENT TABLE. Both routes are untouched and still exist.
  assert.ok(existsSync(`${process.cwd()}/src/app/api/business/route.ts`));
  assert.ok(existsSync(`${process.cwd()}/src/app/api/home/route.ts`));
  assert.match(code('src/app/api/business/route.ts'), /coaAccounts/);
  assert.match(code('src/app/api/home/route.ts'), /home_expenses/);
  // And the four that collapsed are gone, replaced by one parameterised route.
  for (const m of COLLAPSED_MODULES) {
    assert.ok(!existsSync(`${process.cwd()}/src/app/api/${m}/route.ts`), `/api/${m}/route.ts collapsed`);
  }
  assert.ok(existsSync(`${process.cwd()}/src/app/api/budget/[module]/route.ts`));
  assert.ok(existsSync(`${process.cwd()}/src/app/api/budget/[module]/[id]/route.ts`));
  // The gate is preserved verbatim, and an unknown module is a 404, never a query.
  const shared = code('src/app/api/budget/[module]/route.ts');
  assert.match(shared, /getVerifiedEmail\(\)/);
  assert.match(shared, /COLLAPSED_MODULES\.includes/);
  assert.match(shared, /status: 404/);
});
