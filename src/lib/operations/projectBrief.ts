/**
 * projectBrief — THE CAPTURE'S QUESTIONS and THE BRIEF FORMAT (BACKLOG-01b, Alex, 2026-10-20).
 *
 * THE LOOP (Alex, 15:27 and 15:42 — the one truth): the morning card is the
 * running log of ongoing projects and tasks not done; the evening card's prompt
 * audits the day; "copy reflection prompt" → the chat returns the narrative and
 * the NEXT PROJECTS / TASKS in THE BRIEF FORMAT → "paste brief" → review →
 * create (backlog) → when its turn comes, "copy brief prompt" on the row → the
 * chat audits the code → THE AUDIT and THE PLAN paste back → "scope it" →
 * scoped → tasks → scheduled → in progress → done | dropped.
 *
 * PURE: no fetch, no clock, no React. Two directions of one format:
 *   parseBrief(text, entities)  — what "paste brief" READS into the capture form
 *   briefPromptText(project)    — what "copy brief prompt" WRITES from the row,
 *                                 THE BRIEF FORMAT then the TO THE CHAT paragraph
 * The round-trip law (backlog01b.test.ts): parseBrief(briefPromptText(p)) is p.
 *
 * The words here are Alex's, verbatim — the form prints them, the test pins them.
 */

import type { ProjectForm, ProjectSize, ProjectType } from '@/components/workbench/operations/projects/types';
import { PROJECT_SIZES, PROJECT_TYPES } from '@/components/workbench/operations/projects/types';
import { isIsoDay } from '@/lib/budget/days';

// ── THE CAPTURE'S QUESTIONS — label, then the question under it, in this order ──

export interface CaptureQuestion {
  readonly key: string;
  readonly label: string;
  /** The question printed under the label; '' prints none (the control says it). */
  readonly question: string;
}

export const CAPTURE_QUESTIONS: readonly CaptureQuestion[] = [
  { key: 'title', label: 'TITLE', question: 'Name it in a few words.' },
  { key: 'type', label: 'TYPE', question: '' },
  { key: 'book', label: 'BOOK', question: '' },
  { key: 'problem', label: '1 WHAT IS WRONG TODAY', question: 'What is wrong, missing, or unknown today? What you see on the screen; what you cannot do or cannot trust.' },
  { key: 'why', label: '2 WHY IT MATTERS', question: 'What does it cost you now — money, time, trust, a decision you can\'t make — and what does fixing it unlock?' },
  { key: 'goal', label: '3 THE ONE CORRECT OUTCOME', question: 'Describe the result done right, as a CPA, a regulator, or Dalio would judge it. If there is one true way to do this, state it.' },
  { key: 'rulings', label: '4 ALREADY RULED', question: 'What have you already decided? One ruling per line — nothing here gets re-decided.' },
  { key: 'open_questions', label: '5 WANT A RECOMMENDATION ON', question: 'What do you want the chat to recommend? One question per line.' },
  { key: 'by_when', label: '6 BY WHEN, AND WHY', question: 'Why that date — what happens if it slips?' },
  { key: 'definition_of_done', label: 'PROOF OF DONE', question: 'How will we prove it is done — what we will look at, which number must match which? (optional now; required to scope it)' },
  { key: 'size', label: 'SIZE', question: 'Your guess: small · medium · large' },
  { key: 'links', label: 'LINKS', question: 'The prompt docs, the PRs, the findings — one per line.' },
  { key: 'notes', label: 'NOTES', question: 'Anything else.' },
] as const;

export const captureQuestion = (key: string): CaptureQuestion => {
  const q = CAPTURE_QUESTIONS.find((x) => x.key === key);
  if (!q) throw new Error(`no capture question "${key}"`);
  return q;
};

/** The row's read view and edit view name the same facts — the capture's labels, plus the two the chat pastes back. */
export const AUDIT_LABEL = 'THE AUDIT';
export const PLAN_LABEL = 'THE PLAN';
export const NOT_ANSWERED_WORDS = '— not answered —';

// ── THE BRIEF FORMAT ──────────────────────────────────────────────────────────

/** The five KEY: lines, first. */
export const BRIEF_KEYS = ['TITLE', 'TYPE', 'BOOK', 'SIZE', 'TARGET'] as const;
export type BriefKey = (typeof BRIEF_KEYS)[number];

/** The nine section headings — exact, uppercase, on their own line; a section runs to the next heading. */
export const BRIEF_HEADINGS = [
  'WHAT IS WRONG TODAY',
  'WHY IT MATTERS',
  'THE ONE CORRECT OUTCOME',
  'ALREADY RULED',
  'WANT A RECOMMENDATION ON',
  'BY WHEN, AND WHY',
  'PROOF OF DONE',
  'LINKS',
  'NOTES',
] as const;
export type BriefHeading = (typeof BRIEF_HEADINGS)[number];

/** A blank section prints its heading then this. Read back, it is blank. */
export const BRIEF_NONE = '— none —';

/** The closing paragraph "copy brief prompt" appends after a blank line; "paste brief" stops reading at it. */
export const BRIEF_TO_THE_CHAT =
  'TO THE CHAT — audit before any plan. Read every file this touches on current main; cite file:line; say "not verified" for what you did not read. Return in this order: THE FACTS (what exists today) · THE DATA (each piece and its source — typed, Plaid, booking, books, calculated; REAL vs CALCULATED) · MUST NEVER (the invariants) · DEPENDENCIES (what must exist first; what this feeds) · RISKS · THE DECISIONS I must make (options and consequences; no fallback recommended) · THE PR SEQUENCE (smallest safe order, migrations flagged) · A PROPOSED PROOF OF DONE for me to confirm. One truth.';
const BRIEF_END = 'TO THE CHAT';

export interface BriefEntity {
  readonly id: string;
  readonly name: string;
}

export interface BriefParse {
  /** The fields the brief set — a missing section leaves a field untouched; a blank one sets it empty. */
  readonly form: Partial<ProjectForm>;
  /** Every refusal, by name; the refused field is left untouched. */
  readonly refused: string[];
}

export const unknownHeadingWords = (line: string): string => `unknown heading "${line}" — not one of ${BRIEF_HEADINGS.join(' · ')}`;
export const strayLineWords = (line: string): string => `"${line}" is before the first heading and is not one of ${BRIEF_KEYS.map((k) => `${k}:`).join(' ')}`;
export const badTypeWords = (value: string): string => `type "${value}" — one of ${PROJECT_TYPES.join(', ')}`;
export const badSizeWords = (value: string): string => `size "${value}" — S, M, L or blank`;
export const badTargetWords = (value: string): string => `target "${value}" is not a yyyy-mm-dd date`;
export const noSuchBookWords = (value: string): string => `book "${value}" matches no entity`;

/** A line that reads as a heading: uppercase words only (letters, digits, spaces, commas, apostrophes). */
const isHeadingShaped = (line: string): boolean => /^[A-Z][A-Z0-9 ,'’]*$/.test(line) && /[A-Z]{2}/.test(line);

/** A section's lines → its text: leading and trailing blank lines dropped, line breaks kept; "— none —" is blank. */
const sectionText = (lines: readonly string[]): string => {
  const text = lines.join('\n').replace(/^\s*\n/, '').replace(/\n\s*$/, '').trim();
  return text === BRIEF_NONE ? '' : text;
};

const oneLine = (text: string): string => text.trim();
/** LINKS, one per line: each non-blank line, trimmed. */
export const linesOf = (text: string): string[] => text.split(/\r\n|\r|\n/).map((l) => l.trim()).filter((l) => l.length > 0);

/**
 * "paste brief": THE BRIEF FORMAT → the capture form's fields, for REVIEW —
 * nothing posts. The five KEY: lines first (any order, each optional); then the
 * sections, each from its heading to the next. BOOK is matched to an entity's
 * name, case-insensitively, exact. TYPE and SIZE are validated; TARGET must be
 * a yyyy-mm-dd day. An unknown heading, a bad TYPE or SIZE or TARGET, or a BOOK
 * matching no entity is refused by name and its field left untouched; the
 * lines under an unknown heading are dropped. Reading stops at the TO THE CHAT
 * paragraph, so a copied brief prompt pastes back whole.
 */
export function parseBrief(text: string, entities: readonly BriefEntity[]): BriefParse {
  const lines = text.split(/\r\n|\r|\n/);
  const form: Partial<ProjectForm> = {};
  const refused: string[] = [];
  const keys: Partial<Record<BriefKey, string>> = {};
  let i = 0;
  // 1 · the KEY: lines, until the first line that is not one.
  for (; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (line === '') continue;
    const m = /^(TITLE|TYPE|BOOK|SIZE|TARGET):\s*(.*)$/.exec(line);
    if (!m) break;
    keys[m[1] as BriefKey] = m[2].trim();
  }
  // 2 · the sections.
  const sections = new Map<BriefHeading, string[]>();
  let current: BriefHeading | null = null;
  let dropping = false;
  for (; i < lines.length; i += 1) {
    const raw = lines[i];
    const line = raw.trim();
    if (line.startsWith(BRIEF_END)) break;
    if ((BRIEF_HEADINGS as readonly string[]).includes(line)) {
      current = line as BriefHeading;
      dropping = false;
      if (!sections.has(current)) sections.set(current, []);
      continue;
    }
    if (line !== '' && isHeadingShaped(line)) {
      refused.push(unknownHeadingWords(line));
      current = null;
      dropping = true;
      continue;
    }
    if (dropping) continue;
    if (current === null) {
      if (line !== '') refused.push(strayLineWords(line));
      continue;
    }
    sections.get(current)!.push(raw.replace(/\s+$/, ''));
  }

  // 3 · the keys → the fields.
  if (keys.TITLE !== undefined) form.title = oneLine(keys.TITLE);
  if (keys.TYPE !== undefined && keys.TYPE !== '') {
    const t = PROJECT_TYPES.find((x) => x === keys.TYPE!.toLowerCase());
    if (t) form.type = t as ProjectType;
    else refused.push(badTypeWords(keys.TYPE));
  }
  if (keys.BOOK !== undefined && keys.BOOK !== '') {
    const want = keys.BOOK.toLowerCase();
    const e = entities.find((x) => x.name.trim().toLowerCase() === want);
    if (e) form.entity_id = e.id;
    else refused.push(noSuchBookWords(keys.BOOK));
  }
  if (keys.SIZE !== undefined) {
    if (keys.SIZE === '') form.size = '';
    else {
      const s = PROJECT_SIZES.find((x) => x === keys.SIZE!.toUpperCase());
      if (s) form.size = s as ProjectSize;
      else refused.push(badSizeWords(keys.SIZE));
    }
  }
  if (keys.TARGET !== undefined) {
    if (keys.TARGET === '') form.target_completion_date = '';
    else if (isIsoDay(keys.TARGET)) form.target_completion_date = keys.TARGET;
    else refused.push(badTargetWords(keys.TARGET));
  }

  // 4 · the sections → the fields (a missing section leaves the field untouched).
  const sectionOf = (h: BriefHeading): string | undefined => (sections.has(h) ? sectionText(sections.get(h)!) : undefined);
  const put = (h: BriefHeading, field: 'problem' | 'why' | 'goal' | 'rulings' | 'open_questions' | 'deadline_reason' | 'definition_of_done' | 'notes') => {
    const t = sectionOf(h);
    if (t !== undefined) form[field] = t;
  };
  put('WHAT IS WRONG TODAY', 'problem');
  put('WHY IT MATTERS', 'why');
  put('THE ONE CORRECT OUTCOME', 'goal');
  put('ALREADY RULED', 'rulings');
  put('WANT A RECOMMENDATION ON', 'open_questions');
  put('BY WHEN, AND WHY', 'deadline_reason');
  put('PROOF OF DONE', 'definition_of_done');
  const links = sectionOf('LINKS');
  if (links !== undefined) form.links = linesOf(links);
  put('NOTES', 'notes');

  return { form, refused };
}

/** What "copy brief prompt" reads from the row. */
export interface BriefProject {
  readonly title: string;
  readonly type: ProjectType | null;
  readonly size: ProjectSize | null;
  /** ISO timestamp or yyyy-mm-dd, or null. */
  readonly target_completion_date: string | null;
  readonly problem: string | null;
  readonly why: string | null;
  readonly goal: string | null;
  readonly rulings: string | null;
  readonly open_questions: string | null;
  readonly deadline_reason: string | null;
  readonly definition_of_done: string | null;
  readonly links: readonly string[];
  readonly notes: string | null;
}

const keyLine = (key: BriefKey, value: string): string => (value === '' ? `${key}:` : `${key}: ${value}`);
const section = (heading: BriefHeading, text: string | null): string[] => [heading, text !== null && text.trim().length > 0 ? text.trim() : BRIEF_NONE];

/**
 * "copy brief prompt": THE BRIEF FORMAT from the row — the five KEY: lines, a
 * blank line, each section (its heading, then its text or "— none —"), a blank
 * line between sections — then a blank line and the TO THE CHAT paragraph.
 */
export function briefPromptText(p: BriefProject, bookName: string): string {
  return [
    keyLine('TITLE', p.title),
    keyLine('TYPE', p.type ?? ''),
    keyLine('BOOK', bookName),
    keyLine('SIZE', p.size ?? ''),
    keyLine('TARGET', p.target_completion_date ? p.target_completion_date.slice(0, 10) : ''),
    '',
    ...section('WHAT IS WRONG TODAY', p.problem), '',
    ...section('WHY IT MATTERS', p.why), '',
    ...section('THE ONE CORRECT OUTCOME', p.goal), '',
    ...section('ALREADY RULED', p.rulings), '',
    ...section('WANT A RECOMMENDATION ON', p.open_questions), '',
    ...section('BY WHEN, AND WHY', p.deadline_reason), '',
    ...section('PROOF OF DONE', p.definition_of_done), '',
    ...section('LINKS', p.links.length > 0 ? p.links.join('\n') : null), '',
    ...section('NOTES', p.notes), '',
    BRIEF_TO_THE_CHAT,
  ].join('\n');
}
