/**
 * The map law's seeded regressions (HOME-PLANS-04, Alex's brief, 2026-11-12 14:07 Manila).
 *
 * Ruling e: "A TOOL'S MODULE is the module of the capability rows that name it (CAPABILITY_GROUPS), held by a law: one module
 * per tool, or the build fails by name." The guest landing's map lights each tool in its module's colour (src/lib/howTo.ts
 * toolModule), and each plan's name is drawn in one coloured part per module (nameParts). The two seeds below are the law's two
 * clauses, each broken the one way the data could break it:
 *
 *   · a tool is named by capability rows of two modules — the second row that names Expenses moves to Business (clause 1);
 *   · a plan's name stops splitting into one part per module — Personal + Trading loses its " + " (clause 2).
 *
 * Each must stop the law suite BY NAME. MEASURED, as offer-c measured for the plan law: importing src/lib/howTo.ts runs the
 * leaf's own mapLaw() at module scope, so the suite dies at the import with the leaf's message — "map law: Expenses is named by
 * capability rows of 2 modules …" — before the guarded seat speaks. The expect names what actually prints. (A tool named by NO
 * row is not seeded here: the plan law's coverage clause refuses that first, at the plans leaf's own import — "in the registry
 * and in no capability row" — a clause no seed exercises yet.)
 */
import type { Seed } from '../prove';

const PLANS_LEAF = 'src/lib/offer/plans.ts';

export const SEEDS: Seed[] = [
  {
    name: 'map-a a tool is named by capability rows of two modules (clause 1, ruling e)',
    file: PLANS_LEAF,
    find: "      { label: 'Every recurring expense planned, with its vendor and what it cost this month', tools: ['Expenses'], module: 'personal' },",
    replace: "      { label: 'Every recurring expense planned, with its vendor and what it cost this month', tools: ['Expenses'], module: 'business' },",
    expect: 'Expenses is named by capability rows of 2 modules (personal, business)',
  },
  {
    name: 'map-b a plan\'s name is not one part per module (clause 2)',
    file: PLANS_LEAF,
    find: "    name: 'Personal + Trading',",
    replace: "    name: 'Personal and Trading',",
    expect: 'the plan "trading" is named "Personal and Trading" — 1 part(s) for its 2 module(s)',
  },
];
