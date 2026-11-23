/**
 * The trip post law's seeded regressions for its two TRIPPOST-02 clauses (Alex's brief, 2026-11-23 11:38 Bali; the board approved
 * on the design canvas at 12:52; ruling o).
 *
 * The clauses ride the trip post law's line in scripts/assert-tool-registry.ts (ruling h):
 *
 *   · (1) each post's favorite photo is held to the stop photos' law — /was-here/<slug>.jpg or .webp, on disk under public/,
 *     400 KB at most, within 1% of 3 : 2 by its own header;
 *   · (2) each rental's days lie inside its stop's stay — from on or after the stay's start, to on or before its end where it
 *     has one.
 *
 * One seed for each, and each must stop the law suite BY NAME:
 *
 *   · a — Canggu's favorite photo names a file that is not on disk;
 *   · b — Canggu's rental ends a day after its stay does (Jul 31, against a stay that ends Jul 30).
 *
 * Each expect names the clause's own words, so a seed some other law caught would not count as caught.
 */
import type { Seed } from '../prove';

export const SEEDS: Seed[] = [
  {
    name: 'trippost02-a the favorite photo names a file that is not on disk',
    file: 'src/lib/tripPosts.ts',
    find: "image: { src: '/was-here/uluwatu-2026-11.jpg',",
    replace: "image: { src: '/was-here/canggu-2026-07-best-day.jpg',",
    expect: "trip posts: canggu-2026-07's favorite photo /was-here/canggu-2026-07-best-day.jpg does not exist under public/ (TRIPPOST-02)",
  },
  {
    name: 'trippost02-b the rental ends a day after its stay',
    file: 'src/lib/tripCosts.ts',
    find: "'canggu-2026-07': { from: '2026-07-03', to: '2026-07-30' },",
    replace: "'canggu-2026-07': { from: '2026-07-03', to: '2026-07-31' },",
    expect: "trip costs: canggu-2026-07's rental ends 2026-07-31, after its stay's end 2026-07-30 (TRIPPOST-02)",
  },
];
