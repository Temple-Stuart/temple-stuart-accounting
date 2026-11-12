/**
 * The trip log law's seeded regressions for its 3 : 2 clause (TRIPCARDS-03, Alex's brief, 2026-11-12 21:08 Manila; the board
 * approved on the design canvas at 21:21).
 *
 * The clause: the card shows every photo whole at 3 : 2, so the build reads each photo's size from its own header
 * (src/lib/photoSize.ts) and refuses, by name, one more than 1% from 3 : 2 — on the trip log law's photo line in
 * scripts/assert-tool-registry.ts (the one that already holds the 400 KB check). A seed changes the text of one file, and every
 * photo is a binary file Alex crops, so the two seeds break the READING instead, each the one way a text change can — and each
 * must stop the law suite BY NAME, naming a real photo on disk:
 *
 *   · a — the reader takes the frame header's height for its width: every photo reads 2 : 3, and Canggu is refused by name;
 *   · b — the tolerance tightens from 1% to 0.03%: the four photos that are not exactly 3 : 2 (Canggu 0.05%, Uluwatu 0.04%,
 *     Da Nang and the second Bangkok stop 0.04%) are refused by name and the five exact ones pass — the measure is each photo's own.
 *
 * Each expect names the clause's own words, so a seed some other law caught would not count as caught.
 */
import type { Seed } from '../prove';

const PHOTO_SIZE = 'src/lib/photoSize.ts';
const FRAME_READ = '      const height = (bytes[at + 3] << 8) | bytes[at + 4];\n      const width = (bytes[at + 5] << 8) | bytes[at + 6];';

export const SEEDS: Seed[] = [
  {
    name: 'tripcards03-a the reader takes the height for the width (every photo reads 2 : 3)',
    file: PHOTO_SIZE,
    find: FRAME_READ,
    replace: '      const width = (bytes[at + 3] << 8) | bytes[at + 4];\n      const height = (bytes[at + 5] << 8) | bytes[at + 6];',
    expect: "was here: canggu-2026-07's photo /was-here/canggu-2026-07.jpg is 635 × 953 —",
  },
  {
    name: 'tripcards03-b the tolerance tightens to 0.03% (the four photos not exactly 3 : 2 are refused)',
    file: PHOTO_SIZE,
    find: 'export const THREE_TWO_TOLERANCE = 0.01;',
    replace: 'export const THREE_TWO_TOLERANCE = 0.0003;',
    expect: "was here: canggu-2026-07's photo /was-here/canggu-2026-07.jpg is 953 × 635 — 0.05% from 3 : 2, more than 0.03%",
  },
];
