import test from 'node:test';
import assert from 'node:assert/strict';
import { ANSWERS_HOME, ANSWER_INPUTS, ANSWER_READS, ANSWER_ROWS, NET_WORTH_READ, answersLaw, type AnswerRead } from '../answers';

// NAV-01c — THE ANSWERS LAW. Hermetic: rows / reads are injected for the failing shapes;
// the real constants must pass the law as the module already ran it at import.

test('the real constants pass: four questions, four reads in order, every number sourced', () => {
  assert.deepEqual(answersLaw({ throwOnFail: false }), []);
  assert.equal(ANSWER_ROWS.length, 4);
  assert.deepEqual(Object.keys(ANSWER_READS), ANSWER_ROWS.map(([q]) => q));
  assert.deepEqual(Object.keys(ANSWER_INPUTS), ANSWER_ROWS.map(([q]) => q));
  for (const read of [...Object.values(ANSWER_READS), NET_WORTH_READ]) {
    if (read.computed) {
      assert.ok(read.source.length > 0);
      assert.match(read.endpoint, /^\/api\//);
      assert.match(read.citation, /\.ts:\d+/);
      assert.match(read.home, /^\//);
    }
  }
  assert.equal(ANSWERS_HOME, '/answers');
});

test('a card with a number and no source line fails the law', () => {
  const reads: Record<string, AnswerRead> = Object.fromEntries(Object.entries(ANSWER_READS));
  const [first] = ANSWER_ROWS[0];
  const r = reads[first];
  assert.ok(r.computed);
  reads[first] = { ...r, source: '   ' };
  const v = answersLaw({ throwOnFail: false, reads });
  assert.equal(v.length, 1);
  assert.match(v[0], /a card with a number must declare its source line/);
  assert.throws(() => answersLaw({ reads }), /THE ANSWERS LAW failed/);
});

test('the reads must cover ANSWER_ROWS 4/4, in order — a missing, extra, or reordered question fails', () => {
  const entries = Object.entries(ANSWER_READS);
  const missing = Object.fromEntries(entries.slice(0, 3));
  assert.match(answersLaw({ throwOnFail: false, reads: missing })[0], /4\/4 in order/);
  const reordered = Object.fromEntries([entries[1], entries[0], ...entries.slice(2)]);
  assert.match(answersLaw({ throwOnFail: false, reads: reordered })[0], /4\/4 in order/);
  const extra = Object.fromEntries([...entries, ['Is this a fifth question?', { computed: false, honest: 'no' }]]);
  assert.match(answersLaw({ throwOnFail: false, reads: extra })[0], /4\/4 in order/);
});

test("an un-computed card carries the deck's honest words and reads nothing", () => {
  const reads: Record<string, AnswerRead> = Object.fromEntries(Object.entries(ANSWER_READS));
  const [q] = ANSWER_ROWS[3];
  reads[q] = { computed: false, honest: '' };
  assert.match(answersLaw({ throwOnFail: false, reads })[0], /must carry the deck's honest words/);
  reads[q] = { computed: false, honest: 'waits on the posting pipe' };
  assert.deepEqual(answersLaw({ throwOnFail: false, reads }), []);
  const leaking = { computed: false, honest: 'waits', endpoint: '/api/x' } as unknown as AnswerRead;
  reads[q] = leaking;
  assert.match(answersLaw({ throwOnFail: false, reads })[0], /reads nothing and prints no source/);
});

test('the net-worth read is held to the same law', () => {
  const v = answersLaw({ throwOnFail: false, netWorth: { ...NET_WORTH_READ, source: '' } });
  assert.deepEqual(v, ['Net worth: a card with a number must declare its source line']);
});
