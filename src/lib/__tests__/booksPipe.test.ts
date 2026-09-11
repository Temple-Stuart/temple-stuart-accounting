import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as React from 'react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
Object.assign(globalThis, { React });
import { PHASES_RENDERED_AT, navRows, navToolByName, phasesRenderedOn } from '../nav';
import { PIPE_PHASES } from '../pipePhases';
import { TOOL_GATE } from '../offer';
import { TOOL_REGISTRY } from '../toolRegistry';

// BOOKS-PIPE-01 — the pipeline is the page, and the opener stops printing citations.

const src = (f: string) => readFileSync(`${process.cwd()}/${f}`, 'utf8');
const code = (f: string) => src(f).split('\n').filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l)).join('\n');

test('no tool\'s rendered line is a citation — a tool with no `why` gets no line', () => {
  for (const t of navRows(TOOL_GATE)) {
    const reg = TOOL_REGISTRY.find((r) => r.name === t.name)!;
    assert.equal(t.line, reg.why?.trim() ? reg.why : null, `${t.name}: the line is the why, or nothing`);
    if (t.line !== null) {
      assert.doesNotMatch(t.line, /\.tsx?:/, `${t.name}: no file path in the line`);
      assert.doesNotMatch(t.line, /src\//, `${t.name}: no source path in the line`);
    }
  }
  // The seven that used to print a path now print none.
  const silent = navRows(TOOL_GATE).filter((t) => t.href && t.line === null).map((t) => t.name);
  assert.deepEqual(silent, ['Travel', 'Banking', 'Brokerage', 'Trade Log', 'Bookkeeping', 'Tax', 'Compliance']);
});

test('the opener renders no file path, for any tool, on any page', () => {
  // The rule is that nothing rendered READS the field — however it is reached
  // (`t.citation`, `x?.citation`, `['citation']`), which is what the build law
  // scans for. The word may appear in a comment saying not to.
  const READS_FIELD = /\??\.citation\b|\['citation'\]|\["citation"\]/;
  for (const f of ['src/components/shell/ToolOpener.tsx', 'src/lib/nav.ts', 'src/components/shell/TheSheet.tsx']) {
    assert.doesNotMatch(code(f), READS_FIELD, `${f} does not read the registry's citation`);
  }
  assert.match(src('src/components/shell/TheSheet.tsx'), /No note in the registry for this job\./);
});

test('the opener lists only the phases its page draws', () => {
  // Bookkeeping owns runway 04 Match; /books does not draw it.
  const books = navToolByName('Bookkeeping', TOOL_GATE);
  assert.deepEqual([...new Set(books.phases.map((p) => p.pipe))], ['books', 'runway'], 'it owns two pipes');
  assert.deepEqual(phasesRenderedOn('/books', books).map((p) => `${p.pipe} ${p.num}`),
    ['books 02', 'books 03', 'books 04', 'books 05', 'books 06'], '/books lists only what it draws');
  // Banking owns books 01 (drawn on /books) and runway 01 (drawn nowhere).
  assert.deepEqual(phasesRenderedOn('/accounts', navToolByName('Banking', TOOL_GATE)), []);
  // Brokerage and Trade Log own the trade pipe; /trading draws no strip at all.
  assert.equal(code('src/app/trading/page.tsx').includes('<StageStrip'), false);
  assert.deepEqual(phasesRenderedOn('/trading', navToolByName('Brokerage', TOOL_GATE)), []);
  // The three tools whose page draws their own pipe still list it, in pipe order.
  for (const [tool, route, pipe] of [['Calendar', '/calendar', 'routines'], ['Tasks', '/tasks', 'projects'], ['Time', '/time', 'content']] as const) {
    const listed = phasesRenderedOn(route, navToolByName(tool, TOOL_GATE));
    assert.deepEqual(listed.map((p) => p.num), PIPE_PHASES[pipe].map((p) => p.num), `${tool} lists ${pipe} in order`);
  }
});

test('what a route declares it draws is what the page\'s strip reads', () => {
  // The declaration is cross-checked at build; here, that it is not empty prose.
  assert.deepEqual(PHASES_RENDERED_AT['/books'], ['books']);
  assert.deepEqual(PHASES_RENDERED_AT['/calendar'], ['routines']);
  assert.deepEqual(PHASES_RENDERED_AT['/budget'], []);
  // Every route named is a real tool screen.
  const screens = new Set(navRows(TOOL_GATE).map((t) => t.href).filter(Boolean));
  for (const route of Object.keys(PHASES_RENDERED_AT)) assert.ok(screens.has(route), `${route} is a tool's screen`);
});

test('the opener\'s rendered output carries no source path', () => {
  const html = renderToStaticMarkup(createElement('div', null,
    ...navRows(TOOL_GATE).filter((t) => t.href).map((t) => createElement('p', { key: t.name }, t.line ?? '')),
  ));
  assert.doesNotMatch(html, /\.ts:/);
  assert.doesNotMatch(html, /\.tsx:/);
  assert.doesNotMatch(html, /src\//);
});

test('the pipeline is the page — the strip renders on first run, above the entity card', () => {
  const body = src('src/components/home/BooksPipeline.tsx');
  // The strip is hoisted into a const, so both the first-run branch and the
  // main return draw it — it used to sit below an early return.
  assert.match(body, /const strip = \(/);
  const stripAt = body.indexOf('const strip = (');
  const setupAt = body.indexOf("if (state === 'setup')");
  assert.ok(stripAt < setupAt, 'the strip is defined before the first-run branch');
  // First run renders the strip FIRST, then phase 01's header, then the form.
  const setupBlock = body.slice(setupAt, body.indexOf("if (state === 'error')"));
  assert.ok(setupBlock.indexOf('{strip}') < setupBlock.indexOf('<EntitySetup'), 'the strip is above the entity card');
  assert.match(setupBlock, /PIPE_FEED\.num/, 'phase 01 names itself from the pipe');
  // Six phases, from the pipe, unchanged.
  assert.deepEqual(PIPE_PHASES.books.map((p) => p.num), ['01', '02', '03', '04', '05', '06']);
  assert.equal((body.match(/<StageStrip/g) ?? []).length, 1, 'one strip, not two');
});
