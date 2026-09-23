/**
 * The plan law's seeded regressions (OFFER-01, 2026-09-23).
 *
 * The law says one thing five ways: the customer's page shows the customer's
 * offer, and every cell on it is the registry's answer, not a typed one. These
 * five seeds are its five clauses — each of them the shape the public offer had
 * on main 3f84ac5d, put back:
 *
 *   · the registry's tool count returns to a selling surface (clause 1);
 *   · a cell is typed instead of derived — the ✓ that outruns the registry
 *     (clause 2);
 *   · a partly built capability is forced to read ✓ (clause 3);
 *   · a price is typed into the slot while the plans' own constants are unset
 *     (clause 4);
 *   · a plan's relationship line stops being the cumulative one, so the ladder
 *     no longer says what each plan adds (clause 5).
 *
 * Each must fail THE PLAN LAW by name. The anchors occur exactly once in their
 * file, which the harness enforces before it runs anything.
 */
import type { Seed } from '../prove';

const PRICING = 'src/app/pricing/page.tsx';
const SECTION = 'src/components/offer/PlansSection.tsx';
const LEAF = 'src/lib/offer/plans.ts';

export const SEEDS: Seed[] = [
  {
    name: 'offer-a the registry’s tool count comes back to a selling surface (clause 1)',
    file: PRICING,
    find: '<main className="max-w-7xl mx-auto px-4 lg:px-8 py-10" data-pricing>',
    replace: '<main className="max-w-7xl mx-auto px-4 lg:px-8 py-10" data-pricing>\n        <p>Twenty-five tools, counted: two live, nine partial, fourteen on the blueprint.</p>',
    expect: 'carries "tools, counted"',
  },
  {
    name: 'offer-b a cell is typed instead of derived from the registry (clause 2)',
    file: SECTION,
    find: '{CELL_MARK[state]}',
    replace: "{'✓'}",
    expect: 'does not draw CELL_MARK[state]',
  },
  {
    // MEASURED: the leaf's OWN planLaw() runs at module scope and THROWS on this
    // one before the suite reaches its guarded region, so the build dies at the
    // import with the leaf's message rather than the guard's. That is the first
    // gate doing its job — the guarded clause re-runs the same derivation over
    // every cell and would be the one to speak if the module-scope call were ever
    // relaxed. The expect names what actually prints.
    name: 'offer-c a partly built capability is forced to read ✓ (clause 3)',
    file: LEAF,
    find: "  PARTIAL: 'partial',",
    replace: "  PARTIAL: 'ready',",
    expect: 'reads ready for personal while Banking is not LIVE',
  },
  {
    name: 'offer-d a price is typed into the slot while the constants are unset (clause 4)',
    file: SECTION,
    find: 'data-price-placeholder>{slot.text}</span>',
    replace: "data-price-placeholder>{'$29 / month'}</span>",
    expect: 'types a price figure',
  },
  {
    name: 'offer-e a plan stops saying what it adds to the one below it (clause 5)',
    file: LEAF,
    find: "    relationship: 'Everything in Personal, plus the company.',",
    replace: "    relationship: 'Business tools.',",
    expect: 'not "Everything in Personal, plus the company."',
  },
  // ── OFFER-03: THE MODULE MODEL ──────────────────────────────────────────
  {
    // A row whose module is not one of the three: the table would draw a column
    // for something no plan can hold.
    name: 'offer-f a capability row belongs to no module (OFFER-03)',
    file: LEAF,
    find: "      { label: 'Positions and balances from your broker', tools: ['Brokerage'], module: 'trading' },",
    replace: "      { label: 'Positions and balances from your broker', tools: ['Brokerage'], module: 'speculation' },",
    expect: 'is not one of the three modules',
  },
  {
    // A plan without the base. Personal is what everyone gets; a plan that drops it
    // would sell a module with nothing under it.
    name: 'offer-g a plan drops the base (OFFER-03)',
    file: LEAF,
    find: "    modules: ['personal', 'trading'],",
    replace: "    modules: ['trading'],",
    expect: 'and not the base — Personal is what every plan starts from',
  },
  {
    // A cell drawn for a module its plan does not hold — the cumulative special-casing
    // creeping back in, so Personal + Trading would light up the business rows.
    name: 'offer-h a cell is drawn for a module the plan does not hold (OFFER-03)',
    file: LEAF,
    find: "  if (!planCarries(plan, row)) return 'absent';",
    replace: "  if (false && !planCarries(plan, row)) return 'absent';",
    expect: 'and not the business module',
  },
  {
    // The desktop floor left ungated. At 390px the table would be 720px wide inside a
    // 324px scroller and the one column the selector chose would sit off the screen.
    name: 'offer-i the table keeps its desktop floor at phone width (OFFER-03)',
    file: SECTION,
    find: '<table className="w-full text-sm lg:min-w-[720px]">',
    replace: '<table className="w-full min-w-[720px] text-sm">',
    expect: 'a desktop floor must be gated',
  },
  {
    // The builder's vocabulary back on the screen. "base" and "module" are how this
    // codebase assembles the offer; a customer buys neither.
    name: 'offer-j the heading speaks the builder\'s vocabulary (OFFER-04)',
    file: LEAF,
    find: "export const PLANS_HEADLINE = 'Four plans. One question: what do you run?';",
    replace: "export const PLANS_HEADLINE = 'One base, two modules. Take the one you need.';",
    expect: 'are builder words, not a customer\'s',
  },
  {
    // The copy typed back into the component, where one place stops being the source
    // of the section's words.
    name: 'offer-k the component types the eyebrow instead of rendering the leaf\'s (OFFER-04)',
    file: SECTION,
    find: '                  {plan.role}',
    replace: "                  {plan.id === 'personal' ? 'The base' : 'The base + one module'}",
    expect: 'does not render plan.role',
  },
];

export default SEEDS;
