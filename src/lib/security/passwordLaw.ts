/**
 * SEC-02b (2026-09-27) — NO PASSWORD HASH LEAVES THE SERVER. The reader behind
 * "The password-hash law" (scripts/assert-tool-registry.ts): pure functions over
 * the schema text and a route file's CODE (src/lib/sourceText.ts code()).
 *
 * THE MODELS. A model with a column named `passwordHash` or `password` holds a
 * hash (users.password, trip_participants.passwordHash). A relation field whose
 * type is such a model (trips.participants, trips.owner, …) reaches one.
 *
 * THE RULE. For every `NextResponse.json(…)` / `Response.json(…)` a route makes:
 *   · its body names no password column, except as the boolean the RSVP GET has
 *     always sent — `!!x.passwordHash` or `x.passwordHash !== null`;
 *   · every name it returns WHOLE (`{ participant }`, `{ trip: t }`, `...user`,
 *     `json(row)`) that a Prisma call produced must have come back through a
 *     `select` that omits the password column, when the model holds one — and
 *     through no `include` / `select` that pulls a hash-holding relation whole
 *     (`participants: true`, or `participants: { … }` with no `select`).
 * Nothing here decides a verdict about a file: the law says which fails, by name.
 */
import { closingOf, splitArgs } from './ownershipLaw';

export interface PasswordSchema {
  /** model → its password column. */
  models: Record<string, string>;
  /** relation field names whose type is a hash-holding model. */
  relations: Set<string>;
}

/** Read the hash-holding models and the relations that reach them from schema.prisma. */
export function passwordSchema(schema: string): PasswordSchema {
  const blocks = Array.from(schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm), (m) => ({ name: m[1], body: m[2] }));
  const models: Record<string, string> = {};
  for (const b of blocks) {
    const f = /^\s*(passwordHash|password)\s+String\??\b/m.exec(b.body);
    if (f) models[b.name] = f[1];
  }
  const relations = new Set<string>();
  for (const b of blocks) {
    for (const m of b.body.matchAll(/^\s*(\w+)\s+(\w+)(\[\])?\??(\s|$)/gm)) {
      if (models[m[2]]) relations.add(m[1]);
    }
  }
  return { models, relations };
}

/** The boolean forms a response may use to say whether a password is set. */
const BOOLEAN_FORM = /!!\s*[\w$.]+\.passwordHash\b|[\w$.]+\.passwordHash\s*!==\s*null|passwordHash\s*!==\s*null/g;

/** Names a response body returns WHOLE — values, shorthand keys, spreads, the bare argument. */
export function wholeNames(body: string): string[] {
  const out = new Set<string>();
  const trimmed = body.trim();
  if (/^[A-Za-z_$][\w$]*$/.test(trimmed)) out.add(trimmed);
  for (const m of body.matchAll(/(?:[{,]\s*(?:[\w$]+\s*:\s*)?|\.\.\.\s*)([A-Za-z_$][\w$]*)\s*(?=[,}])/g)) {
    if (!/^(true|false|null|undefined)$/.test(m[1])) out.add(m[1]);
  }
  return Array.from(out);
}

/** The `include: { … }` and `select: { … }` objects of a call — never its `where`. */
function shapeObjects(args: string): string[] {
  const out: string[] = [];
  for (const m of args.matchAll(/\b(include|select)\s*:\s*\{/g)) {
    const open = m.index! + m[0].length - 1;
    out.push(args.slice(open, closingOf(args, open) + 1));
  }
  return out;
}

/** Does this call's include/select pull a hash-holding relation whole? */
function pullsHashRelation(args: string, relations: Set<string>): string | null {
  for (const shape of shapeObjects(args)) {
    for (const rel of relations) {
      for (const m of shape.matchAll(new RegExp(`\\b${rel}\\s*:\\s*(true|\\{)`, 'g'))) {
        if (m[1] === 'true') return `${rel}: true`;
        const open = m.index! + m[0].length - 1;
        const inner = shape.slice(open, closingOf(shape, open) + 1);
        if (!/\bselect\s*:/.test(inner)) return `${rel}: { … } with no select`;
      }
    }
  }
  return null;
}

/** Every way a route's responses let a password hash out, named by line. */
export function passwordLeaks(code: string, schema: PasswordSchema): string[] {
  const out: string[] = [];
  const lineAt = (i: number) => code.slice(0, i).split('\n').length;
  for (const call of code.matchAll(/\b(?:NextResponse|Response)\.json\s*\(/g)) {
    const open = call.index! + call[0].length - 1;
    const close = closingOf(code, open);
    if (close < 0) continue;
    const body = splitArgs(code.slice(open + 1, close))[0] ?? '';
    const line = lineAt(call.index!);
    const named = body.replace(BOOLEAN_FORM, '');
    if (/\bpasswordHash\b|\.password\b|\bpassword\s*:/.test(named)) out.push(`:${line} the response body names a password column`);
    for (const name of wholeNames(body)) {
      // The LAST declaration of the name before the response is the one returned.
      const decls = Array.from(code.slice(0, call.index!).matchAll(new RegExp(`\\b(?:const|let)\\s+${name}\\s*=\\s*await\\s+(?:prisma|tx|db)\\s*\\.\\s*(\\w+)\\s*\\.\\s*(\\w+)\\s*\\(`, 'g')));
      const decl = decls[decls.length - 1];
      if (!decl) continue;
      const argsOpen = decl.index! + decl[0].length - 1;
      const args = code.slice(argsOpen, closingOf(code, argsOpen) + 1);
      const model = decl[1];
      const column = schema.models[model];
      if (column) {
        const select = /\bselect\s*:\s*(\{|[A-Z_][A-Z0-9_]*)/.exec(args);
        if (!select) out.push(`:${line} returns ${name} — a whole ${model} row (${column} included) read at :${lineAt(decl.index!)} with no select`);
        else if (new RegExp(`\\b${column}\\s*:\\s*true`).test(args)) out.push(`:${line} returns ${name}, whose select at :${lineAt(decl.index!)} names ${column}`);
      }
      const rel = pullsHashRelation(args, schema.relations);
      if (rel) out.push(`:${line} returns ${name}, read at :${lineAt(decl.index!)} with ${rel} — a hash-holding relation, whole`);
    }
  }
  return out;
}
