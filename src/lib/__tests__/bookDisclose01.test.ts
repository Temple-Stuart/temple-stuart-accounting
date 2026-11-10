/**
 * BOOK-DISCLOSE-01 (Alex, 2026-11-08; board K tag 4) — one line directly under the booking box on the home page:
 * "When you book here, I may earn a commission." Its words live in a pure leaf (src/lib/disclosureWords.ts); the page
 * renders them, never types them.
 *
 *   T1 the words — COMMISSION_LINE is the exact ruled string; the leaf imports nothing; no other file under src types
 *      them (one source);
 *   T2 the line — Landing.tsx imports COMMISSION_LINE from the leaf and renders it once, as the ruled <p>, directly
 *      after the LandingBookingSection mount and before the guest lookup (data-guest-lookup-home); its words are never
 *      typed in Landing.tsx;
 *   T3 the stronger claim — "I earn a commission" (board K's first draft) is in no file's code under src/.
 * Every text check reads sourceText's code() (comments stripped). No line number, no file length. No clock, no network.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { code } from '../sourceText';
import { COMMISSION_LINE } from '../disclosureWords';

const LEAF = 'src/lib/disclosureWords.ts';
const LANDING = 'src/components/landing/Landing.tsx';
const SELF = 'src/lib/__tests__/bookDisclose01.test.ts';
const MOUNT = '<LandingBookingSection onRequireAuth={onRequireAuth} events={<ExperiencesSection today={today} />} />'; // HOME-BRIEF-04 (Alex, 2026-11-10 19:00): the booking mount carries the experiences catalog as its Events panel — '<LandingBookingSection onRequireAuth={onRequireAuth} />' until then
const LINE = '<p className="mt-3 font-mono text-xs text-text-secondary" data-commission-line>{COMMISSION_LINE}</p>';

/** Every .ts and .tsx under src/, as a repo-relative path. */
const srcFiles = (): string[] => {
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : /\.tsx?$/.test(name) ? [relative(process.cwd(), full)] : [];
  });
  return walk(resolve(process.cwd(), 'src'));
};

test('T1 the words: the exact ruled string, from a leaf that imports nothing; no other file under src types them', () => {
  assert.equal(COMMISSION_LINE, 'When you book here, I may earn a commission.');
  const leaf = code(LEAF);
  assert.doesNotMatch(leaf, /\bimport\b|\brequire\(/, 'the leaf imports nothing');
  assert.match(leaf, /export const COMMISSION_LINE = 'When you book here, I may earn a commission\.';/);
  const typed = srcFiles().filter((f) => f !== LEAF && f !== SELF && code(f).includes('I may earn a commission'));
  assert.deepEqual(typed, [], 'one source for the words');
});

test('T2 the line: Landing imports COMMISSION_LINE from the leaf and renders it once, directly under the booking section and above the guest lookup', () => {
  const landing = code(LANDING);
  assert.ok(landing.includes("import { COMMISSION_LINE } from '@/lib/disclosureWords';"), 'the import');
  assert.equal(landing.split('{COMMISSION_LINE}').length - 1, 1, 'rendered once');
  assert.equal(landing.split('data-commission-line').length - 1, 1, 'one hook on the page');
  assert.equal(landing.split(LINE).length - 1, 1, 'the ruled <p>, whole');
  const mount = landing.indexOf(MOUNT);
  const line = landing.indexOf(LINE);
  const lookup = landing.indexOf('data-guest-lookup-home');
  assert.ok(mount > -1 && line > mount && lookup > line, 'after the booking section, before the guest lookup');
  assert.match(landing.slice(mount + MOUNT.length, line), /^\s*$/, 'directly under the mount: nothing between');
  assert.doesNotMatch(landing, /When you book here/, 'the words are never typed in Landing.tsx');
});

test('T3 the stronger claim, "I earn a commission", is in no file\'s code under src/', () => {
  const claims = srcFiles().filter((f) => f !== SELF && /I earn a commission/i.test(code(f)));
  assert.deepEqual(claims, []);
});
