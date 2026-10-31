#!/usr/bin/env tsx
/**
 * MODEL-01 STEP 6 — regenerate README's "The scanner's gates" block from
 * src/lib/convergence/gateCards.ts, byte-for-byte between the two markers.
 * The build (scripts/assert-tool-registry.ts, the gate-cards law) refuses a
 * README whose block differs from what this script would write.
 *
 *   npx tsx scripts/regen-gate-cards-readme.ts          # rewrite the block
 *   npx tsx scripts/regen-gate-cards-readme.ts --check  # exit 1 if it differs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gateCardsMarkdown, README_GATE_CARDS_END, README_GATE_CARDS_START } from '../src/lib/convergence/gateCards';

const README = resolve(__dirname, '..', 'README.md');
const text = readFileSync(README, 'utf8');
const start = text.indexOf(README_GATE_CARDS_START);
const end = text.indexOf(README_GATE_CARDS_END);
if (start < 0 || end < 0 || end < start) {
  console.error(`README.md has no gate-cards block — add the markers:\n${README_GATE_CARDS_START}\n${README_GATE_CARDS_END}`);
  process.exit(1);
}
const expected = `${README_GATE_CARDS_START}\n${gateCardsMarkdown()}\n${README_GATE_CARDS_END}`;
const current = text.slice(start, end + README_GATE_CARDS_END.length);
if (process.argv.includes('--check')) {
  if (current !== expected) {
    console.error('README.md gate-cards block differs from src/lib/convergence/gateCards.ts — run: npx tsx scripts/regen-gate-cards-readme.ts');
    process.exit(1);
  }
  console.log('README.md gate-cards block is byte-stable with gateCards.ts');
  process.exit(0);
}
if (current === expected) {
  console.log('README.md gate-cards block already byte-stable — nothing written');
} else {
  writeFileSync(README, text.slice(0, start) + expected + text.slice(end + README_GATE_CARDS_END.length));
  console.log('README.md gate-cards block regenerated');
}
