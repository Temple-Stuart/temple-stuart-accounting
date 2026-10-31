/**
 * TEST-TRUTH-01 (2026-09-17) — THE ONE PLACE A TEST OR A LAW READS A SOURCE FILE.
 *
 * WHY THIS EXISTS. TRUTH-CAL found `calendarRoom.test.ts:55` asserting that
 * HubCalendar still contained the `source === 'trip'` filter DAY-01 had DELETED.
 * The test was green: the string survives in DAY-01's own comments saying the
 * filter is gone, and the assertion read the raw file. A test that passes on a
 * comment is worse than no test — it certifies deleted behaviour as present, and
 * every audit and ruling that cited it was standing on nothing.
 *
 * THE RULE. A test or a law reads a source file through EXACTLY ONE of these:
 *   · code(file)     — the file with every comment removed. The default. An
 *                      assertion about BEHAVIOUR uses this and nothing else.
 *   · comments(file) — the comments ONLY. For an assertion that genuinely means
 *                      to read prose: a dated note, a citation, a named ruling.
 *                      Saying `comments()` out loud puts the intent on the page.
 * There is no third way, and `readFileSync` in a test or a law is a build
 * violation (scripts/assert-tool-registry.ts, the reader law).
 *
 * WHAT IS STRIPPED. Line comments (`// …`), block comments (`/* … *\/`) wherever
 * they start — including at the end of a line of code — and JSX comments
 * (`{/* … *\/}`, which are block comments inside braces). What is NOT stripped:
 * anything inside a string, a template literal or a regex literal, so a route
 * like '/api/calendar', a path in a template and a pattern like /a\/b/ all
 * survive intact. Line structure is preserved on both sides: a stripped comment
 * leaves its newlines behind, so line counts and multi-line patterns still work.
 *
 * KNOWN EDGE. A comment inside a template literal's `${…}` is treated as string
 * content and kept. Nothing in this repo writes one, and keeping it is the safe
 * direction: it can only make `code()` larger, never hide real code.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();

/** Does a `/` at this point begin a regex literal rather than a division? */
function startsRegex(text: string, i: number): boolean {
  for (let j = i - 1; j >= 0; j -= 1) {
    const c = text[j];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') continue;
    if ('(,=:[!&|?{};+-*%^~<>'.includes(c)) return true;
    // `return /re/`, `typeof /re/`, `case /re/` — a word boundary that is a keyword.
    const word = /(\w+)$/.exec(text.slice(0, j + 1));
    if (word && ['return', 'typeof', 'case', 'in', 'of', 'do', 'else', 'yield', 'await', 'void', 'delete', 'instanceof', 'new'].includes(word[1])) return true;
    return false;
  }
  return true;
}

/**
 * Split a source text into its code and its comments. Both keep the original
 * line structure, so `${code}\n` and `${comments}` line up with the file.
 */
/**
 * A .sql migration and a .prisma schema are source files too, and a pattern can
 * hide in one of their comments exactly as it can in a .ts one. SQL comments a
 * line with `--`; Prisma uses `//` like TypeScript. `--` is only a comment in
 * SQL — in TypeScript it is the decrement operator — so it is chosen by
 * EXTENSION and never applied to code.
 */
export type SourceDialect = 'ts' | 'sql';

export function dialectOf(file: string): SourceDialect {
  return file.endsWith('.sql') ? 'sql' : 'ts';
}

export function splitSource(text: string, dialect: SourceDialect = 'ts'): { code: string; comments: string } {
  const codeOut: string[] = [];
  const cmtOut: string[] = [];
  /** Send a char to one stream and whitespace (newlines preserved) to the other. */
  const emit = (ch: string, toComment: boolean) => {
    const blank = ch === '\n' ? '\n' : ' ';
    codeOut.push(toComment ? blank : ch);
    cmtOut.push(toComment ? ch : blank);
  };

  let i = 0;
  while (i < text.length) {
    const c = text[i];
    const next = text[i + 1];

    if (c === '/' && next === '/' && dialect === 'ts') {
      while (i < text.length && text[i] !== '\n') { emit(text[i], true); i += 1; }
      continue;
    }
    if (c === '-' && next === '-' && dialect === 'sql') {
      while (i < text.length && text[i] !== '\n') { emit(text[i], true); i += 1; }
      continue;
    }
    if (c === '/' && next === '*') {
      emit(text[i], true); emit(text[i + 1], true); i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) { emit(text[i], true); i += 1; }
      if (i < text.length) { emit(text[i], true); emit(text[i + 1], true); i += 2; }
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      emit(c, false); i += 1;
      while (i < text.length) {
        if (text[i] === '\\') { emit(text[i], false); if (i + 1 < text.length) emit(text[i + 1], false); i += 2; continue; }
        emit(text[i], false);
        if (text[i] === c) { i += 1; break; }
        i += 1;
      }
      continue;
    }
    if (c === '/' && dialect === 'ts' && startsRegex(text, i)) {
      // A regex literal: consume to the closing slash, honouring \ and [...].
      const start = i;
      let j = i + 1; let inClass = false; let closed = false;
      for (; j < text.length; j += 1) {
        const d = text[j];
        if (d === '\\') { j += 1; continue; }
        if (d === '\n') break;                 // not a regex after all
        if (d === '[') inClass = true;
        else if (d === ']') inClass = false;
        else if (d === '/' && !inClass) { closed = true; break; }
      }
      if (closed) {
        for (let k = start; k <= j; k += 1) emit(text[k], false);
        i = j + 1;
        continue;
      }
    }
    emit(c, false); i += 1;
  }
  return { code: codeOut.join(''), comments: cmtOut.join('') };
}

/** Every comment removed — what an assertion about BEHAVIOUR reads. */
export function stripComments(text: string, dialect: SourceDialect = 'ts'): string { return splitSource(text, dialect).code; }
/** The comments only — what an assertion about PROSE reads, and it must say so. */
export function commentsOf(text: string, dialect: SourceDialect = 'ts'): string { return splitSource(text, dialect).comments; }

/** A repo-relative source file, comments removed. The default reader. */
export function code(file: string): string {
  return stripComments(readFileSync(resolve(ROOT, file), 'utf8'), dialectOf(file));
}
/** A repo-relative source file, comments ONLY — for a citation or a dated note. */
export function comments(file: string): string {
  return commentsOf(readFileSync(resolve(ROOT, file), 'utf8'), dialectOf(file));
}
/**
 * The two halves put back together. This is NOT a reader — it takes the strings
 * code() and comments() already returned, so a caller still has to name which
 * halves it is using and why.
 *
 * It exists for ONE shape: a byte-for-byte equality against GENERATED text, where
 * the generator emits comments as part of the artefact (prisma/migrations' kind
 * views emit `-- kind: tables` headers above each CREATE VIEW). An exact equality
 * over the whole artefact cannot be satisfied by a comment the way a pattern match
 * can — it requires every character, comment and code alike, to be the expected
 * one. A pattern match may never use this; a whole-artefact equality may.
 */
export function rejoin(codeHalf: string, commentHalf: string): string {
  // TRAVEL-01 (2026-09-19): by CODE UNIT, the way splitSource emits. `[...codeHalf]`
  // walked code points while `commentHalf[i]` indexed code units, so every
  // character after an astral one (an emoji in a string) was shifted by one and
  // the "exact" rejoin dropped a byte — HotelPicker.tsx rejoined to a different
  // file. The two halves are the same code-unit length as the file, always.
  let out = '';
  for (let i = 0; i < codeHalf.length; i += 1) out += commentHalf[i] === ' ' ? codeHalf[i] : commentHalf[i];
  return out;
}

/**
 * HOTEL-01 (2026-09-22): the text of one top-level `export [async] function
 * NAME(` in a source — from the keyword to the matching close brace — so a law
 * can pin a FUNCTION byte-for-byte inside a file that also holds other things
 * (the LiteAPI client holds the search AND the booking calls). Reads the text it
 * is given; pass code(file) for behaviour. Returns null when the function is
 * not there. The parameter list is skipped by paren-balance, so a `{` inside a
 * parameter type never opens the body.
 */
export function functionBody(source: string, name: string): string | null {
  const m = new RegExp(`export (?:async )?function ${name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\(`).exec(source);
  if (!m) return null;
  const start = m.index;
  let i = start + m[0].length;
  let depth = 1;
  for (; i < source.length && depth > 0; i++) {
    if (source[i] === '(') depth += 1;
    else if (source[i] === ')') depth -= 1;
  }
  const open = source.indexOf('{', i);
  if (open < 0) return null;
  depth = 0;
  for (let j = open; j < source.length; j++) {
    if (source[j] === '{') depth += 1;
    else if (source[j] === '}') { depth -= 1; if (depth === 0) return source.slice(start, j + 1); }
  }
  return null;
}
