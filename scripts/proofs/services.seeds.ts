/**
 * The services law's seeded regressions for its pictures clause (HOME-SERVICES-01, Alex's brief, 2026-11-12 15:16 Manila).
 *
 * Ruling d: "THE PICTURES ARE FILES, one per door, named by its key. All six are in the page and one shows. They are decorative
 * (alt=""): the title and line beside each say what it shows. A door with no picture, or a picture with no door, fails the build
 * by name." The clause rides the services law's one line (scripts/assert-tool-registry.ts:710): every door of SERVICES has
 * public/brand/services/<key>.svg, and every file there is a door's. The two seeds below are its two directions, each broken the
 * one way a text change can break it — a seed changes the text of one file, so the doors move and the six files stay:
 *
 *   · a door with no picture — a seventh door, "audit", joins SERVICES, and no audit.svg is on file;
 *   · a picture with no door — the door "unsure" leaves SERVICES, and unsure.svg stays on file.
 *
 * Each must stop the law suite BY NAME. Both also move the doors away from the proposals_need_chk CHECK in force, so the services
 * law's CHECK clause speaks too; the expect names the pictures clause's own words, so a seed the CHECK clause alone caught would
 * not count as caught.
 */
import type { Seed } from '../prove';

const VOCAB = 'src/lib/proposalNeeds.ts';
const LAST_DOOR = "  { need: 'unsure', title: 'Something else', line: 'Out of scope, or not sure which fits? Tell me what you need.', kind: null },";

export const SEEDS: Seed[] = [
  {
    name: 'services-a a door with no picture (ruling d)',
    file: VOCAB,
    find: LAST_DOOR,
    replace: `${LAST_DOOR}\n  { need: 'audit', title: 'Audit', line: 'An audit of your books.', kind: SERVICE_KINDS.project },`,
    expect: 'services: the door "audit" has no picture — public/brand/services/audit.svg is not on file',
  },
  {
    name: 'services-b a picture with no door (ruling d)',
    file: VOCAB,
    find: LAST_DOOR,
    replace: '',
    expect: 'services: public/brand/services/unsure.svg is the picture of no door',
  },
];
