/**
 * SEC-02 (2026-09-27) — THE OWNERSHIP LAW'S READER. Pure functions over a route
 * file's CODE (src/lib/sourceText.ts code(): comments stripped, lines kept), so
 * the law (scripts/assert-tool-registry.ts, "The ownership law") and its proofs
 * (src/lib/__tests__/sec02.test.ts) read a route the same way.
 *
 * What it answers, for one route file:
 *   · which methods it EXPORTS — every form: `export async function PUT(`,
 *     `export const PUT =`, `export const { GET, POST, PUT } = serve(…)` and
 *     `export { handler as POST }`. The census found the third form serving a
 *     PUT (src/app/api/inngest/route.ts) that a `function|const PUT` count misses;
 *   · every Prisma WRITE it makes — `prisma|tx|db.<model>.create|createMany|
 *     createManyAndReturn|update|updateMany|upsert|delete|deleteMany(`, every
 *     `$executeRaw*`, and every `$queryRaw*` whose SQL INSERTs, UPDATEs or DELETEs;
 *   · for each write that updates or deletes, whether its WHERE names the caller
 *     (userId / user_id) or a value PROVEN OWNED earlier in the same function.
 *
 * PROVEN OWNED — the house pattern, read from the function's own text before the
 * write. A name is owned when it is:
 *   · the caller: `user.id`, `user!.id`, or a helper's `userId` parameter;
 *   · the result R, or the `id` value V, of a read whose where names the caller
 *     (or an already-owned parent) and is followed by `if (!R …) … status: 404`
 *     — `const trip = await prisma.trips.findFirst({ where: { id, userId: user.id } })`;
 *   · the result R, or the argument V, of a read by id alone followed by the
 *     OWNER-CHAIN check `if (!R || R.….user_id !== user.id) … status: 404`;
 *   · the id list V of a caller-scoped `findMany({ where: { id: { in: V }, … } })`
 *     followed by `if (R.length !== V.length)` — missing and foreign alike are
 *     refused, so the answer confirms nothing — and each `for (const X of V)`;
 *   · the rows of a caller-scoped findMany L and each `for (const X of L)`;
 *   · the result of a named OWNED LOADER (loadAuthorized*, ownedAccount,
 *     ownedItemOr404) followed by a 404 — each loader's own where is read by
 *     the law;
 *   · the rows of a raw `SELECT … WHERE … user_id = ${user.id}` followed by a
 *     404 on no rows, and the `${V}` its WHERE matches `id` against.
 * A field of an owned name (`trip.id`, `link.trade_card_id`) is owned.
 *
 * Nothing here decides a verdict about a file: the law holds the tables (the
 * public writers, the owner console, the named derived-owned writes) and says
 * which file fails, by name.
 */

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type ExportForm = 'function' | 'const' | 'destructured' | 'reexport';
export interface ExportedMethod { method: Method; form: ExportForm; index: number }

const METHODS: readonly Method[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const isMethod = (s: string): s is Method => (METHODS as readonly string[]).includes(s);

/** Every HTTP method the file exports, in every export form. */
export function exportedMethods(code: string): ExportedMethod[] {
  const out: ExportedMethod[] = [];
  for (const m of code.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(/g)) out.push({ method: m[1] as Method, form: 'function', index: m.index! });
  for (const m of code.matchAll(/export\s+const\s+(GET|POST|PUT|PATCH|DELETE)\s*[=:]/g)) out.push({ method: m[1] as Method, form: 'const', index: m.index! });
  for (const m of code.matchAll(/export\s+const\s*\{([^}]*)\}\s*=/g)) {
    for (const part of m[1].split(',')) {
      const name = part.split(':').pop()!.trim();
      if (isMethod(name)) out.push({ method: name, form: 'destructured', index: m.index! });
    }
  }
  for (const m of code.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const name = part.split(/\s+as\s+/).pop()!.trim();
      if (isMethod(name)) out.push({ method: name, form: 'reexport', index: m.index! });
    }
  }
  return out.sort((a, b) => a.index - b.index);
}

/** The index of the bracket closing the one at `open` — strings and templates skipped. */
export function closingOf(code: string, open: number): number {
  const o = code[open];
  const c = o === '(' ? ')' : o === '{' ? '}' : o === '[' ? ']' : '';
  if (!c) return -1;
  let depth = 0;
  let quote: string | null = null;
  for (let i = open; i < code.length; i += 1) {
    const ch = code[i];
    if (quote) {
      if (ch === '\\') { i += 1; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === o) depth += 1;
    else if (ch === c) { depth -= 1; if (depth === 0) return i; }
  }
  return -1;
}

export const WRITE_OPS = ['create', 'createMany', 'createManyAndReturn', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany'] as const;
/** The ops a WHERE decides: they touch rows that already exist. */
export const WHERE_OPS: ReadonlySet<string> = new Set(['update', 'updateMany', 'upsert', 'delete', 'deleteMany']);
/** The Prisma clients a route writes through: the singleton, a transaction, the webhook's port. */
const RECEIVERS = '(?:prisma|tx|db)';

export interface WriteSite {
  index: number;
  line: number;
  kind: 'orm' | 'raw';
  /** The model, or for raw SQL the table. */
  model: string;
  /** create … deleteMany, or INSERT / UPDATE / DELETE for raw SQL. */
  op: string;
  /** The `where: { … }` object (ORM) or the text after WHERE (raw), or null when there is none. */
  where: string | null;
  /** The write's own text (the call, or the raw template/arguments). */
  text: string;
}

const lineAt = (code: string, i: number) => code.slice(0, i).split('\n').length;

/** The `where: { … }` object inside a call's argument text, or null. */
export function whereObjectOf(args: string): string | null {
  const m = /\bwhere\s*:\s*\{/.exec(args);
  if (!m) return null;
  const open = m.index + m[0].length - 1;
  const close = closingOf(args, open);
  return close < 0 ? null : args.slice(open, close + 1);
}

/** A call's argument text split at its top-level commas. */
export function splitArgs(args: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let from = 0;
  for (let i = 0; i < args.length; i += 1) {
    const ch = args[i];
    if (quote) { if (ch === '\\') { i += 1; continue; } if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '(' || ch === '{' || ch === '[') depth += 1;
    else if (ch === ')' || ch === '}' || ch === ']') depth -= 1;
    else if (ch === ',' && depth === 0) { out.push(args.slice(from, i)); from = i + 1; }
  }
  if (args.slice(from).trim()) out.push(args.slice(from));
  return out;
}

/** Every Prisma write in the file, in source order. */
export function writeSites(code: string): WriteSite[] {
  const out: WriteSite[] = [];
  const orm = new RegExp(`\\b${RECEIVERS}\\s*\\.\\s*(\\w+)\\s*\\.\\s*(${WRITE_OPS.join('|')})\\s*\\(`, 'g');
  for (const m of code.matchAll(orm)) {
    if (m[1].startsWith('$')) continue;
    const open = m.index! + m[0].length - 1;
    const close = closingOf(code, open);
    const text = code.slice(m.index!, close < 0 ? open + 1 : close + 1);
    out.push({ index: m.index!, line: lineAt(code, m.index!), kind: 'orm', model: m[1], op: m[2], where: WHERE_OPS.has(m[2]) ? whereObjectOf(text) : null, text });
  }
  for (const m of code.matchAll(/\$(executeRaw|executeRawUnsafe|queryRaw|queryRawUnsafe)\s*(?:<[^`(]*?>)?\s*(`|\()/g)) {
    let text: string;
    let sql: string;
    if (m[2] === '`') {
      const end = code.indexOf('`', m.index! + m[0].length);
      text = code.slice(m.index!, end + 1);
      sql = text;
    } else {
      // `$executeRawUnsafe(sql, a, b, …)`: the SQL is the first argument; `$N` is the Nth after it.
      const open = m.index! + m[0].length - 1;
      text = code.slice(m.index!, closingOf(code, open) + 1);
      const args = splitArgs(code.slice(open + 1, closingOf(code, open)));
      sql = (args[0] ?? '').replace(/\$(\d+)/g, (_all, n: string) => `\${${(args[Number(n)] ?? '?').trim()}}`);
    }
    const verb = /\b(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+("?\w+"?)/i.exec(sql);
    if (!verb) {
      if (m[1].startsWith('execute')) out.push({ index: m.index!, line: lineAt(code, m.index!), kind: 'raw', model: '?', op: 'EXECUTE', where: null, text });
      continue;
    }
    const op = verb[1].split(/\s+/)[0].toUpperCase();
    const where = /\bWHERE\b([\s\S]*)/i.exec(sql);
    // The WHERE runs to the end of the SQL literal: its closing quote is not part of it.
    const whereText = where ? where[1].replace(/\s*[`'"]\s*$/, '').trim() : null;
    out.push({ index: m.index!, line: lineAt(code, m.index!), kind: 'raw', model: verb[2].replace(/"/g, ''), op, where: op === 'INSERT' ? null : whereText, text });
  }
  return out.sort((a, b) => a.index - b.index);
}

/** A write whose WHERE the law reads: ORM update/delete/upsert, raw UPDATE/DELETE. */
export function isScopedOp(site: WriteSite): boolean {
  return site.kind === 'orm' ? WHERE_OPS.has(site.op) : site.op === 'UPDATE' || site.op === 'DELETE' || site.op === 'EXECUTE';
}

/** In the law's scope: exports DELETE, PATCH or PUT in any form, or exports POST and writes. */
export function inScope(code: string): boolean {
  const methods = exportedMethods(code).map((e) => e.method);
  if (methods.some((m) => m === 'DELETE' || m === 'PATCH' || m === 'PUT')) return true;
  return methods.includes('POST') && writeSites(code).length > 0;
}

export interface FunctionSpan { name: string; start: number; bodyStart: number; end: number; exported: boolean; isAsync: boolean }

/** Every top-level `function name(…) { … }` (exported or not) with its body span. */
export function topFunctions(code: string): FunctionSpan[] {
  const out: FunctionSpan[] = [];
  for (const m of code.matchAll(/^(export\s+)?(async\s+)?function\s+(\w+)\s*(?:<[^>]*>)?\s*\(/gm)) {
    const paren = m.index! + m[0].length - 1;
    const closeParen = closingOf(code, paren);
    if (closeParen < 0) continue;
    const bodyStart = code.indexOf('{', closeParen);
    // A return type may hold braces (`): Promise<{ … }> {`): the body is the LAST `{` before the first line break after the signature closes.
    let open = bodyStart;
    const eol = code.indexOf('\n', closeParen);
    const lastBrace = code.lastIndexOf('{', eol < 0 ? code.length : eol);
    if (lastBrace > closeParen) open = lastBrace;
    const end = closingOf(code, open);
    if (end < 0) continue;
    out.push({ name: m[3], start: m.index!, bodyStart: open, end, exported: !!m[1], isAsync: !!m[2] });
  }
  return out;
}

/** The function span holding an index, or null when it sits at the top level. */
export function enclosing(spans: FunctionSpan[], index: number): FunctionSpan | null {
  let best: FunctionSpan | null = null;
  for (const s of spans) if (s.start <= index && index <= s.end && (!best || s.start > best.start)) best = s;
  return best;
}

/** The identity calls: the verified cookie, the user it names, the owner console. */
export const IDENTITY_CALL = /\b(getVerifiedEmail|getCurrentUser|requireAdmin)\(\)/;

/** Same-file helpers whose body makes an identity call — `caller()`, `authed()`. */
export function identityHelpers(code: string): string[] {
  return topFunctions(code).filter((f) => !f.exported && IDENTITY_CALL.test(code.slice(f.bodyStart, f.end))).map((f) => f.name);
}

/**
 * Same-file ASYNC helpers whose body writes — calling one writes. A synchronous
 * factory that returns closures (`function ports(): BudgetLinkPorts`) writes
 * nothing when called; its closures run inside the lib that received them.
 */
export function writingHelpers(code: string): string[] {
  const sites = writeSites(code);
  return topFunctions(code).filter((f) => !f.exported && f.isAsync && sites.some((s) => s.index > f.bodyStart && s.index < f.end)).map((f) => f.name);
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * For each exported mutating handler written as a function: where its identity
 * call sits and where its first write (direct, or a call to a same-file writing
 * helper) sits. identityAt null = no identity call at all.
 */
export function handlerIdentity(code: string): Array<{ method: Method; line: number; identityAt: number | null; firstWriteAt: number | null }> {
  const helpers = identityHelpers(code);
  const writers = writingHelpers(code);
  const idRe = new RegExp(`\\b(getVerifiedEmail|getCurrentUser|requireAdmin${helpers.map((h) => `|${escape(h)}`).join('')})\\(`);
  const sites = writeSites(code);
  const out: Array<{ method: Method; line: number; identityAt: number | null; firstWriteAt: number | null }> = [];
  for (const f of topFunctions(code)) {
    if (!f.exported || !isMethod(f.name) || f.name === 'GET') continue;
    const body = code.slice(f.bodyStart, f.end);
    const id = idRe.exec(body);
    const direct = sites.filter((s) => s.index > f.bodyStart && s.index < f.end).map((s) => s.index - f.bodyStart);
    const helperCalls = writers.map((w) => new RegExp(`\\b${escape(w)}\\(`).exec(body)?.index).filter((i): i is number => i !== undefined);
    const first = [...direct, ...helperCalls].sort((a, b) => a - b)[0];
    out.push({ method: f.name, line: lineAt(code, f.start), identityAt: id ? id.index : null, firstWriteAt: first ?? null });
  }
  return out;
}

/** The caller, in the forms the routes name it. */
const CALLER = /^(user!?\.id|userId|uid)$/;
/** A value the request supplied — never the caller. */
const SUPPLIED = /^(body|params|query|searchParams|input|data|payload)\b/;

/** The identifier roots a where names: `{ id: optionId, trip_id: id }` → [optionId, id]; `{ id: existing.id }` → [existing.id]. */
export function whereValues(where: string): string[] {
  const out: string[] = [];
  const inner = where.replace(/^\{|\}$/g, '');
  // key: value pairs (value an identifier path) and shorthand keys.
  for (const m of inner.matchAll(/(?:^|[{,])\s*(\w+)\s*(?::\s*([A-Za-z_$][\w$]*(?:!?\.[\w$]+)*)\s*(?=[,}\s]|$)|(?=\s*[,}]|\s*$))/g)) {
    if (m[2]) { if (!/^(true|false|null|undefined)$/.test(m[2])) out.push(m[2]); } else if (m[1]) out.push(m[1]);
  }
  // `{ in: V }` lists and raw `${V}` interpolations.
  for (const m of where.matchAll(/\bin\s*:\s*(?:\[\s*\.\.\.\s*|Array\.from\(\s*)?([A-Za-z_$][\w$]*(?:\.[\w$]+)*)/g)) out.push(m[1].replace(/\.(map|filter)$/, ''));
  for (const m of where.matchAll(/\$\{\s*([A-Za-z_$][\w$]*(?:!?\.[\w$]+)*)\s*\}/g)) out.push(m[1]);
  return Array.from(new Set(out));
}

/** Does this where name the caller — a userId/user_id key whose value is the caller, never a supplied one? */
export function whereNamesCaller(where: string, kind: 'orm' | 'raw'): boolean {
  if (kind === 'raw') return /\b(user_id|"userId")\s*=\s*(\$\{\s*(user!?\.id|userId)\s*\}|\$\d+)/.test(where) || /\b(user_id|"userId")\s+IN\s*\(\s*SELECT/i.test(where);
  for (const m of where.matchAll(/\b(userId|user_id)\s*(?::\s*([A-Za-z_$][\w$]*(?:!?\.[\w$]+)*))?\s*(?=[,}])/g)) {
    const value = m[2] ?? m[1];
    if (SUPPLIED.test(value)) continue;
    if (CALLER.test(value)) return true;
  }
  return false;
}

const rootOf = (v: string) => v.split(/!?\./)[0];

/** The text of the statement that follows index i (to the next `;` at depth 0, bounded). */
function nextStatements(code: string, i: number, count = 2): string {
  let out = '';
  let at = i;
  for (let n = 0; n < count; n += 1) {
    let depth = 0;
    let j = at;
    for (; j < code.length && j < at + 1200; j += 1) {
      const ch = code[j];
      if (ch === '{' || ch === '(' || ch === '[') depth += 1;
      else if (ch === '}' || ch === ')' || ch === ']') depth -= 1;
      else if (ch === ';' && depth <= 0) break;
    }
    out += code.slice(at, j + 1);
    at = j + 1;
  }
  return out;
}

/** The named owned loaders the house uses, and the file each lives in. */
export const OWNED_LOADERS = ['loadAuthorizedProject', 'loadAuthorizedTask', 'loadAuthorizedRoutine', 'loadAuthorizedCalendarBlock', 'loadAuthorizedDailyPlanItem', 'loadAuthorizedRoutineStep', 'ownedAccount', 'ownedItemOr404'] as const;

/** `if (!R …) … return` — the refusal that answers missing and foreign alike. */
const refused = (after: string, r: string) => new RegExp(`^\\s*if\\s*\\(\\s*!${escape(r)}\\b[^)]*\\)\\s*\\{?\\s*return\\b`).test(after);
/** `if (!R || R.….user_id !== user.id) … return` — the owner chain, one condition, one answer. */
const chained = (after: string, r: string) => new RegExp(`^\\s*if\\s*\\(\\s*!${escape(r)}\\s*\\|\\|\\s*${escape(r)}(?:\\.\\w+)*\\.(user_id|userId)\\s*!==\\s*user\\.id\\s*\\)\\s*\\{?\\s*return\\b`).test(after);

/**
 * The names proven owned in `region` — the enclosing function's text up to the
 * write. See the header for the idioms. The caller's `user.id` is owned by name
 * (CALLER); `user` itself is not — the caller's email or name is not a key.
 *
 * A name is owned only if its OWNING declaration is its LAST declaration (or
 * assignment) before the write: a later `const participant = …` of the same
 * name — a sibling block, a reassignment — is not covered by an earlier proof.
 */
export function provenOwned(region: string): Set<string> {
  const lastDecl = new Map<string, number>();
  const note = (name: string, at: number) => { if ((lastDecl.get(name) ?? -1) < at) lastDecl.set(name, at); };
  for (const m of region.matchAll(/\b(?:const|let|var)\s+(\w+)\s*(?::[^=;]+)?=/g)) note(m[1], m.index!);
  for (const m of region.matchAll(/\b(?:const|let|var)\s*[{[]([^}\]]*)[}\]]\s*=/g)) {
    for (const part of m[1].split(',')) {
      const name = part.split(':').pop()!.split('=')[0].replace(/\.\.\./, '').trim();
      if (/^\w+$/.test(name)) note(name, m.index!);
    }
  }
  for (const m of region.matchAll(/for\s*\(\s*(?:const|let)\s+(\w+)\s+of\b/g)) note(m[1], m.index!);
  for (const m of region.matchAll(/(?:^|[;{}\n(])\s*(\w+)\s*=(?![=>])/g)) if (!/^(const|let|var|return)$/.test(m[1])) note(m[1], m.index! + m[0].indexOf(m[1]));
  for (const m of region.matchAll(/\(\s*(?:async\s*)?\(?\s*(\w+)\s*(?::\s*[\w<>[\]]+)?\s*\)?\s*=>/g)) note(m[1], m.index!);

  const ownedAt = new Map<string, number>();
  const prove = (name: string, at: number) => { if ((ownedAt.get(name) ?? -1) < at) ownedAt.set(name, at); };
  const isOwned = (v: string): boolean => {
    if (CALLER.test(v)) return true;
    const root = rootOf(v);
    const decl = lastDecl.get(root);
    if ((root === 'userId' || root === 'uid') && decl === undefined) return true;
    const at = ownedAt.get(root);
    return at !== undefined && at >= (decl ?? -1);
  };

  // Iterate to a fixed point: a child read proves itself only once its parent is proven.
  for (let pass = 0; pass < 8; pass += 1) {
    const before = JSON.stringify([...ownedAt]);
    // 1. Single-row reads.
    for (const m of region.matchAll(/const\s+(\w+)\s*=\s*await\s+(?:prisma|tx)\s*\.\s*\w+\s*\.\s*(findFirst|findUnique|findFirstOrThrow|findUniqueOrThrow)\s*\(/g)) {
      const open = m.index! + m[0].length - 1;
      const close = closingOf(region, open);
      if (close < 0) continue;
      const where = whereObjectOf(region.slice(open, close + 1));
      if (!where) continue;
      const r = m[1];
      const after = nextStatements(region, close + 1).replace(/^\s*;/, '');
      const values = whereValues(where);
      const idMatch = /(?:^|[{,])\s*id\s*(?::\s*([A-Za-z_$][\w$]*(?:!?\.[\w$]+)*))?\s*(?:as\s+\w+\s*)?[,}]/.exec(where);
      const idV = idMatch ? (idMatch[1] ?? 'id') : null;
      const scoped = whereNamesCaller(where, 'orm') || values.some((v) => v !== idV && isOwned(v));
      if (scoped) {
        // A read scoped to the caller (or an owned parent) returns only owned rows;
        prove(r, m.index!);
        // the id it was asked for is owned once a miss is refused.
        if (idV && refused(after, r)) prove(rootOf(idV), close);
      } else if (chained(after, r)) {
        prove(r, m.index!);
        if (idV) prove(rootOf(idV), close);
      } else if (idV && isOwned(idV)) {
        // A read of an owned id is an owned row.
        prove(r, m.index!);
      }
    }
    // 2. A named loader, or a same-file read, then the refusal / the owner chain.
    for (const m of region.matchAll(/const\s+(\w+)\s*=\s*await\s+(\w+)\s*\(\s*([A-Za-z_$][\w$]*(?:\.[\w$]+)*)?/g)) {
      const r = m[1];
      const close = closingOf(region, m.index! + m[0].lastIndexOf('('));
      if (close < 0) continue;
      const after = nextStatements(region, close + 1).replace(/^\s*;/, '');
      const loader = (OWNED_LOADERS as readonly string[]).includes(m[2]) && refused(after, r);
      if (chained(after, r) || loader) {
        prove(r, m.index!);
        if (m[3]) prove(rootOf(m[3]), close);
      }
    }
    // 3. Lists: a findMany scoped to the caller or an owned parent is owned; with the count check, so is the id list it was asked for.
    for (const m of region.matchAll(/const\s+(\w+)\s*=\s*await\s+(?:prisma|tx)\s*\.\s*\w+\s*\.\s*findMany\s*\(/g)) {
      const open = m.index! + m[0].length - 1;
      const close = closingOf(region, open);
      if (close < 0) continue;
      const where = whereObjectOf(region.slice(open, close + 1));
      if (!where) continue;
      const list = /\bid\s*:\s*\{\s*in\s*:\s*([A-Za-z_$][\w$]*)/.exec(where);
      const scoped = whereNamesCaller(where, 'orm') || whereValues(where).some((v) => v !== list?.[1] && isOwned(v));
      if (!scoped) continue;
      const r = m[1];
      prove(r, m.index!);
      const after = nextStatements(region, close + 1).replace(/^\s*;/, '');
      if (list && new RegExp(`^\\s*if\\s*\\(\\s*${escape(r)}\\.length\\s*!==\\s*${escape(list[1])}\\.length\\s*\\)`).test(after)) prove(list[1], close);
    }
    // 4. Raw: a caller-scoped SELECT; with a refusal on no rows, the id it matched.
    for (const m of region.matchAll(/const\s+(\w+)\s*=\s*await\s+prisma\.\$queryRaw(?:Unsafe)?\s*(?:<[^`(]*?>)?\s*`([^`]*)`/g)) {
      const sql = m[2];
      if (!/^\s*SELECT\b/i.test(sql) || !/\b(user_id|"userId")\s*=\s*\$\{\s*user\.id\s*\}/.test(sql)) continue;
      prove(m[1], m.index!);
      const after = nextStatements(region, m.index! + m[0].length).replace(/^[^\n]*?;/, '');
      const idm = /\bid\s*=\s*\$\{\s*([A-Za-z_$][\w$]*)\s*\}/.exec(sql);
      if (idm && new RegExp(`^\\s*if\\s*\\(\\s*!${escape(m[1])}\\.length\\s*\\)\\s*\\{?\\s*return\\b`).test(after)) prove(idm[1], m.index! + m[0].length);
    }
    // 5. A row this request created is its own.
    for (const m of region.matchAll(/const\s+(\w+)\s*=\s*await\s+(?:prisma|tx)\s*\.\s*\w+\s*\.\s*create\s*\(/g)) prove(m[1], m.index!);
    // 6. Derivations of an owned name: iteration, callbacks, copies, picks, templates.
    for (const m of region.matchAll(/for\s*\(\s*const\s+(\w+)\s+of\s+([A-Za-z_$][\w$]*(?:!?\.[\w$]+)*)\s*\)/g)) if (isOwned(m[2])) prove(m[1], m.index!);
    for (const m of region.matchAll(/([A-Za-z_$][\w$]*(?:\.[\w$]+)*)\s*\.\s*(?:map|filter|find|forEach|flatMap|some|every)\s*\(\s*(?:async\s*)?\(?\s*(\w+)\s*(?::\s*[\w<>[\]]+)?\s*\)?\s*=>/g)) if (isOwned(m[1])) prove(m[2], m.index! + m[0].indexOf('('));
    for (const m of region.matchAll(/(?:\b(?:const|let)\s+|(?:^|[;{}\n])\s*)(\w+)\s*(?::[^=;\n]+)?=\s*(?:\[\s*\.\.\.\s*|Array\.from\(\s*|new\s+Set\(\s*)?([A-Za-z_$][\w$]*)((?:\s*!?\.\s*[\w$]+|\s*\[[^\]]*\])*)\s*(?:\.\s*(?:map|filter|find|flatMap|sort|slice|concat)\s*\(|[;,\])\n])/gm)) {
      if (m[2] === 'user' || /^(const|let|var)$/.test(m[1])) continue;
      if (isOwned(m[2])) prove(m[1], m.index! + m[0].indexOf(m[1]));
    }
    for (const m of region.matchAll(/const\s+(\w+)\s*=\s*`([^`]*)`/g)) {
      if ([...m[2].matchAll(/\$\{\s*([A-Za-z_$][\w$]*(?:\.[\w$]+)*)\s*\}/g)].some((x) => isOwned(x[1]))) prove(m[1], m.index!);
    }
    // 7. A collector filled only with owned values: `const s = new Set<string>()` / `const a: T[] = []`, then only owned `.add(…)` / `.push(…)`.
    for (const m of region.matchAll(/const\s+(\w+)\s*(?::[^=;]+)?=\s*(?:new\s+Set(?:<[^>]*>)?\(\s*\)|\[\s*\])/g)) {
      const adds = [...region.slice(m.index!).matchAll(new RegExp(`\\b${escape(m[1])}\\.(?:add|push)\\(\\s*([A-Za-z_$][\\w$]*(?:\\.[\\w$]+)*)`, 'g'))];
      if (adds.length > 0 && adds.every((a) => isOwned(a[1]))) prove(m[1], m.index!);
    }
    if (JSON.stringify([...ownedAt]) === before) break;
  }
  return new Set([...ownedAt.keys(), 'userId', 'uid'].filter((n) => isOwned(n)));
}

export interface WriteVerdict { site: WriteSite; fn: string | null; ok: boolean; how: 'caller' | 'owned' | 'none'; values: string[] }

/** Every update/delete/upsert (and raw UPDATE/DELETE) in the file, judged by the WHERE rule. */
export function judgeWrites(code: string): WriteVerdict[] {
  const spans = topFunctions(code);
  return writeSites(code).filter(isScopedOp).map((site) => {
    const where = site.where ?? '';
    const span = enclosing(spans, site.index);
    const values = whereValues(where);
    if (where && whereNamesCaller(where, site.kind)) return { site, fn: span?.name ?? null, ok: true, how: 'caller', values };
    const region = code.slice(span ? span.bodyStart : 0, site.index);
    const owned = provenOwned(region);
    const ok = values.some((v) => owned.has(rootOf(v)) || CALLER.test(v));
    return { site, fn: span?.name ?? null, ok, how: ok ? 'owned' : 'none', values };
  });
}

/** A where, one line, for the allowlist and the verdicts. */
export const flatWhere = (where: string | null) => (where ?? '(no where)').replace(/\s+/g, ' ').trim();
