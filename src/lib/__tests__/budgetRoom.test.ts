import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  BUDGET_CATEGORIES, BUDGET_HOME, COLLAPSED_MODULES, BudgetCategoriesLawError,
  budgetCategoriesLaw, budgetHref, categoryFor,
} from '../budgetCategories';
import { STEPS, stepBySlug, stepLinks, stepsLaw } from '../steps';
import { TOOL_REGISTRY } from '../toolRegistry';

// ROOM-01 — Budget is ONE room: six category pages became a switcher.

const src = (f: string) => readFileSync(`${process.cwd()}/${f}`, 'utf8');

test('the six categories are one const, and the law holds on them', () => {
  assert.deepEqual(budgetCategoriesLaw({ throwOnFail: false }), []);
  assert.equal(BUDGET_CATEGORIES.length, 6);
  assert.deepEqual(BUDGET_CATEGORIES.map((c) => c.slug), ['business', 'personal', 'home', 'auto', 'growth', 'health']);
  // The labels and emoji are what the six page files encoded — not retyped.
  assert.deepEqual(BUDGET_CATEGORIES.map((c) => c.category), ['Business', 'Personal', 'Home', 'Auto', 'Growth', 'Health']);
  assert.throws(() => budgetCategoriesLaw({ categories: BUDGET_CATEGORIES.slice(0, 5) }), BudgetCategoriesLawError);
});

test('the switcher renders every category from the const — no retyped list in the page', () => {
  const page = src('src/app/budget/page.tsx');
  assert.match(page, /BUDGET_CATEGORIES\.map\(/, 'the switcher maps the const');
  assert.match(page, /data-budget-switcher/);
  // Not one category name is typed into the page.
  for (const c of BUDGET_CATEGORIES) {
    assert.ok(!new RegExp(`["'>]${c.category}["'<]`).test(page), `${c.category} is not typed into the page`);
  }
});

test('an unknown ?category= falls to the FIRST and says so — never an empty room', () => {
  assert.equal(categoryFor(undefined).category.slug, 'business');
  assert.equal(categoryFor(undefined).fellBack, false, 'no category asked for is not a fallback');
  assert.equal(categoryFor('growth').category.slug, 'growth');
  assert.equal(categoryFor('GROWTH').category.slug, 'growth', 'case does not matter');
  const bogus = categoryFor('nope');
  assert.equal(bogus.category.slug, 'business', 'the first, not nothing');
  assert.equal(bogus.fellBack, true, 'and the room is told to say so');
  // The page renders that statement rather than silently correcting the URL.
  assert.match(src('src/app/budget/page.tsx'), /data-category-fellback/);
  assert.match(src('src/app/budget/page.tsx'), /There is no/);
});

test('the six legacy routes are redirects to the room, and each one resolves', () => {
  for (const c of BUDGET_CATEGORIES) {
    const file = `src/app${c.legacyPath}/page.tsx`;
    assert.ok(existsSync(`${process.cwd()}/${file}`), `${file} still exists — no page is deleted`);
    const body = src(file);
    assert.match(body, new RegExp(`redirect\\('${BUDGET_HOME}\\?category=${c.slug}'\\)`), `${c.legacyPath} redirects to its category`);
    assert.ok(body.split('\n').filter((l) => l.trim()).length <= 10, `${c.legacyPath} is a short redirect`);
    assert.ok(!body.includes('BudgetingPage'), `${c.legacyPath} no longer mounts the room`);
  }
  assert.equal(budgetHref('auto'), '/budget?category=auto');
});

test('step 11 opens /budget, and no category page is a sub-link anywhere', () => {
  assert.deepEqual(stepsLaw({ throwOnFail: false }), []);
  const step = stepBySlug('budget')!;
  assert.equal(step.number, 11);
  assert.equal(step.screen, BUDGET_HOME);
  assert.equal(TOOL_REGISTRY.find((t) => t.name === 'Budget')?.home, BUDGET_HOME);
  const legacy = new Set(BUDGET_CATEGORIES.map((c) => c.legacyPath));
  for (const s of STEPS) {
    for (const l of stepLinks(s)) {
      assert.ok(!legacy.has(l.door.kind === 'none' ? '' : l.door.href), `${s.name} still links ${l.label}`);
    }
  }
  // What BUDGET keeps: Shopping, the itinerary builder and Runway — reported, not moved.
  const kept = stepLinks(stepBySlug('budget')!).map((l) => (l.door.kind === 'none' ? '' : l.door.href));
  assert.deepEqual(kept, ['/shopping', '/hub/itinerary', '/runway']);
});

test('only the PROVABLY identical routes were collapsed — business and home kept their own', () => {
  assert.deepEqual([...COLLAPSED_MODULES], ['personal', 'auto', 'growth', 'health']);
  // Business returns an extra coaAccounts payload; home reads and writes a
  // DIFFERENT TABLE. Both routes are untouched and still exist.
  assert.ok(existsSync(`${process.cwd()}/src/app/api/business/route.ts`));
  assert.ok(existsSync(`${process.cwd()}/src/app/api/home/route.ts`));
  assert.match(src('src/app/api/business/route.ts'), /coaAccounts/);
  assert.match(src('src/app/api/home/route.ts'), /home_expenses/);
  // And the four that collapsed are gone, replaced by one parameterised route.
  for (const m of COLLAPSED_MODULES) {
    assert.ok(!existsSync(`${process.cwd()}/src/app/api/${m}/route.ts`), `/api/${m}/route.ts collapsed`);
  }
  assert.ok(existsSync(`${process.cwd()}/src/app/api/budget/[module]/route.ts`));
  assert.ok(existsSync(`${process.cwd()}/src/app/api/budget/[module]/[id]/route.ts`));
  // The gate is preserved verbatim, and an unknown module is a 404, never a query.
  const shared = src('src/app/api/budget/[module]/route.ts');
  assert.match(shared, /getVerifiedEmail\(\)/);
  assert.match(shared, /COLLAPSED_MODULES\.includes/);
  assert.match(shared, /status: 404/);
});
