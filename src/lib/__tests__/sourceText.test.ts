import test from 'node:test';
import assert from 'node:assert/strict';
import { code, comments, commentsOf, rejoin, splitSource, stripComments } from '../sourceText';

// TEST-TRUTH-01 — the reader itself. Every assertion in the repo now stands on
// this, so it is tested on the shapes that made TRUTH-CAL's bug possible.

test('it strips line, block and JSX comments — and nothing else', () => {
  const cases: ReadonlyArray<readonly [string, string, string, string]> = [
    ['a line comment', "const a = 1; // source === 'trip'", 'const a = 1;', "// source === 'trip'"],
    ['a trailing block', "const b = 2; /* source === 'trip' */ const c = 3;", 'const b = 2; const c = 3;', "/* source === 'trip' */"],
    ['a JSX comment', '<div>{/* SectionE_Routines */}<X /></div>', '<div>{ }<X /></div>', '/* SectionE_Routines */'],
    ['a banner inside a block', '/**\n * ===== MAIN REGIME SCORER =====\n */', '', '/** * ===== MAIN REGIME SCORER ===== */'],
  ];
  // Stripped text keeps its positions (a comment leaves spaces behind), so the
  // comparison collapses runs of spaces — what matters is WHAT survives, not the
  // width of the hole the comment left.
  const flat = (x: string) => x.replace(/\s+/g, ' ').trim();
  for (const [name, input, wantCode, wantComment] of cases) {
    const r = splitSource(input);
    assert.equal(flat(r.code), flat(wantCode), `${name}: code`);
    assert.equal(flat(r.comments), flat(wantComment), `${name}: comments`);
  }
});

test('the stripper reads CONTEXT, not line prefixes — a bare `*` line is code', () => {
  // The old per-test stripper dropped any line matching /^\s*(\*|\/\/|\/\*)/, so a
  // line that merely BEGAN with `*` vanished whether or not it was in a comment —
  // and, the other way round, a comment at the END of a line of code survived it
  // whole. That second half is what let TRUTH-CAL's bug hide. This one tracks
  // state, so `*` is a comment only inside /* … */ and a trailing // is stripped.
  assert.match(splitSource('  * 2;').code, /\* 2;/, 'a bare * line is multiplication, not a comment');
  assert.equal(splitSource('  * 2;').comments.trim(), '');
  assert.equal(splitSource("call(); // source === 'trip'").code.trim(), 'call();', 'a TRAILING comment is stripped');
});

test('a slash that is not a comment survives — strings, templates, regexes, division', () => {
  const kept = [
    ["const r = '/api/calendar/events';", '/api/calendar/events'],
    ['const u = `${base}//host/path`;', '//host/path'],
    ['const re = /a\\/b/;', '/a\\/b/'],
    ['const x = a / b; const y = c / d;', 'a / b'],
    ["const p = \"https://example.com/x\";", 'https://example.com/x'],
    ['for (let i = n; i > 0; i--) { call(); }', 'i--'],
  ] as const;
  for (const [input, must] of kept) {
    const r = splitSource(input);
    assert.ok(r.code.includes(must), `code keeps ${must} — got ${JSON.stringify(r.code)}`);
    assert.equal(r.comments.trim(), '', `nothing in ${JSON.stringify(input)} is a comment`);
  }
});

test('a multi-line block comment is stripped whole, and line numbers survive on both sides', () => {
  const text = ['const a = 1;', '/**', ' * source === \'trip\' lives here', ' */', 'const b = 2;'].join('\n');
  const r = splitSource(text);
  assert.equal(r.code.split('\n').length, 5, 'the code keeps every line');
  assert.equal(r.comments.split('\n').length, 5, 'so do the comments');
  assert.equal(r.code.split('\n')[2].trim(), '', 'line 3 is comment, so the code side is blank there');
  assert.match(r.comments.split('\n')[2], /source === 'trip'/, 'and the comment side has it, on the same line');
  assert.equal(r.code.split('\n')[4], 'const b = 2;');
});

test('SQL is read with `--`, and `--` is NOT a comment in TypeScript', () => {
  const sql = "-- reference: securities\nCREATE VIEW reference AS SELECT 1;";
  const asSql = splitSource(sql, 'sql');
  assert.equal(asSql.code.trim(), 'CREATE VIEW reference AS SELECT 1;');
  assert.match(asSql.comments, /-- reference: securities/);
  // The same text read as TypeScript keeps the `--`: a decrement is not a comment.
  assert.match(splitSource(sql, 'ts').code, /-- reference: securities/);
  // A `//` line is a comment in Prisma/TS and NOT in SQL.
  assert.equal(splitSource('// x', 'ts').code.trim(), '');
  assert.equal(splitSource('// x', 'sql').code.trim(), '// x');
});

test('THE BUG ITSELF: a fixture whose pattern lives only in a comment fails code() and passes comments()', () => {
  // This is calendarRoom.test.ts:55 in miniature — the assertion that was green
  // for two rulings while the behaviour it named had been deleted.
  const fixture = [
    '// DAY-01: the bare `source === \'trip\'` filter is GONE. Every source the app',
    '// writes is named in sources.ts instead.',
    'setEvents(raw.filter((e) => isRenderedCalendarSource(e.source)));',
  ].join('\n');
  assert.match(fixture, /source === 'trip'/, 'raw: the deleted filter appears to be present — the bug');
  assert.doesNotMatch(stripComments(fixture), /source === 'trip'/, 'code(): it is gone, which is the truth');
  assert.match(commentsOf(fixture), /source === 'trip'/, 'comments(): the note about it is still there');
  assert.match(stripComments(fixture), /isRenderedCalendarSource/, 'and what replaced it is real code');
});

test('rejoin puts the halves back exactly — it is the file, not a third reader', () => {
  const texts = [
    "const a = 1; // note\n/* block */\nconst b = '/api/x';\n",
    "-- header\nCREATE VIEW v AS SELECT 1;\n",
  ];
  for (const t of texts) {
    const d = t.startsWith('--') ? 'sql' : 'ts';
    const { code: c, comments: n } = splitSource(t, d);
    assert.equal(rejoin(c, n), t, 'code + comments === the original text');
  }
});

test('the file readers agree with the string splitters, on a real file', () => {
  const f = 'src/lib/sourceText.ts';
  assert.equal(rejoin(code(f), comments(f)).length, code(f).length, 'the halves are the same length as the file');
  // This file documents `readFileSync` in prose and calls it in code — the two
  // readers must each see their own half and not the other's.
  assert.match(comments(f), /readFileSync/, 'the doc block names it');
  assert.match(code(f), /readFileSync\(resolve\(ROOT, file\), 'utf8'\)/, 'and the reader really calls it');
  assert.doesNotMatch(code(f), /THE ONE PLACE A TEST OR A LAW READS A SOURCE FILE/, 'prose is not code');
  assert.match(comments(f), /THE ONE PLACE A TEST OR A LAW READS A SOURCE FILE/, 'prose is prose');
});
