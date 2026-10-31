/**
 * The lockfile law's seeded regressions (LOCK-02, 2026-09-23).
 *
 * The law reads package.json and package-lock.json and asserts the lockfile's
 * root package entry mirrors what package.json declares — same names, same
 * ranges, in BOTH directions. These three seeds are the three ways that can
 * break, one per direction plus a range that moved on one side:
 *
 *   · a dependency removed from package.json alone — PIPE-01's actual failure,
 *     which left xai-sdk in the lockfile for two weeks;
 *   · one removed from the lockfile's root entry alone — what a hand-edit or a
 *     bad merge resolution does;
 *   · a range changed on one side only — a bump written into package.json
 *     without an install to carry it through.
 *
 * Each must fail THE LOCKFILE LAW by name, saying which package and which
 * direction. The anchors are lines that occur exactly once in their file, which
 * the harness enforces before it runs anything.
 */
import type { Seed } from '../prove';

const PKG = 'package.json';
const LOCK = 'package-lock.json';

export const SEEDS: Seed[] = [
  {
    name: 'lock-a a dependency is removed from package.json alone (PIPE-01\'s xai-sdk, reproduced)',
    file: PKG,
    find: '    "@tanstack/react-virtual": "^3.13.18",\n',
    replace: '',
    expect: 'root entry carries dependencies "@tanstack/react-virtual": "^3.13.18" and package.json does not declare it',
  },
  {
    name: 'lock-b a dependency is removed from the lockfile\'s root entry alone',
    file: LOCK,
    find: '        "@tastytrade/api": "^6.0.1",\n',
    replace: '',
    expect: 'package.json declares dependencies "@tastytrade/api": "^6.0.1" and package-lock.json\'s root entry does not carry it',
  },
  {
    name: 'lock-c a range is changed on one side only',
    file: PKG,
    find: '    "@stripe/stripe-js": "^8.7.0",',
    replace: '    "@stripe/stripe-js": "^8.7.1",',
    expect: '"@stripe/stripe-js" is "^8.7.1" in package.json\'s dependencies and "^8.7.0" in package-lock.json\'s root entry',
  },
];

export default SEEDS;
