/**
 * TIMESHEET-04a (Alex, 2026-11-25 + 2026-11-27) — THREE COLUMNS: A VENDOR'S INSTAGRAM TAG, A PLAN'S PLANNED ITEMS, A STOP'S NOTES.
 *
 * T1–T3 drive the pure rules (src/lib/operations/planVendor.ts) with made-up values. T4–T8 read the migration, the schema, the
 * two vendor routes and the vendor law from source through sourceText — code() for what the code does, comments() only for a
 * dated note or a header's words — the repo's TEST-TRUTH-01 way. Hermetic: no database, no request, no clock. No route is run
 * here and no SQL: what a database does with the migration is not this file's to say. It imports nothing from @prisma/client.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { code, comments } from '../sourceText';
import { closingOf, exportedMethods } from '../security/ownershipLaw';
import {
  INSTAGRAM_TAG_MAX, INSTAGRAM_TAG_WORDS, PLANNED_ITEMS_MAX, itemsAfter, readInstagramTag, readPlannedItems, readVendorId, writeFor,
  type HeldVendor,
} from '../operations/planVendor';

const RULE = 'src/lib/operations/planVendor.ts';
const ROUTE = 'src/app/api/operations/plan-vendors/route.ts';
const DIRECTORY = 'src/app/api/operations/vendor-directory/route.ts';
const REGISTRY = 'src/lib/toolRegistry.ts';
const LAW = 'scripts/assert-tool-registry.ts';
const SCHEMA = 'prisma/schema.prisma';
const MIGRATION_DIR = '20261127160000_timesheet_04_tag_items_notes';
const MIGRATION = `prisma/migrations/${MIGRATION_DIR}/migration.sql`;
const VENDOR = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const OTHER = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';

const fold = (s: string): string => s.replace(/\s+/g, ' ');
const flat = (s: string): string => fold(s).trim();
const count = (hay: string, needle: string): number => hay.split(needle).length - 1;
const say = (v: unknown): string => JSON.stringify(v) ?? String(v);
const refusal = (r: { ok: boolean }) => r as unknown as { ok: false; status: number; error: string; message: string };
/** A handler's text: from its `export async function` to the next exported function, or the first helper under it. */
const handler = (src: string, method: string): string => {
  const at0 = src.indexOf(`export async function ${method}(`);
  assert.ok(at0 >= 0, `${method} is a function`);
  const next = src.indexOf('\nexport async function ', at0 + 1);
  const helper = src.indexOf('\nfunction ', at0 + 1);
  const ends = [next, helper].filter((i) => i > 0);
  return src.slice(at0, ends.length ? Math.min(...ends) : undefined);
};
/** The 1-based line a text first stands on. */
const lineOf = (src: string, needle: string): number => {
  const at = src.indexOf(needle);
  assert.ok(at >= 0, needle);
  return src.slice(0, at).split('\n').length;
};
/** Each text stands in the source ONCE, and they stand in this order. */
const inOrder = (src: string, parts: readonly string[], what: string): void => {
  for (const p of parts) assert.equal(count(src, p), 1, `${what}: \`${p}\` stands once`);
  const at = parts.map((p) => src.indexOf(p));
  assert.deepEqual([...at].sort((a, b) => a - b), at, `${what}: in this order`);
};

// ── T1 · THE TAG ─────────────────────────────────────────────────────────────

test('T1 a typed tag is read ONE way: null and blank are none, one leading @ is dropped, the rest is kept as typed, 30 at most — anything else is a 400 in the rule\'s words, naming what was typed', () => {
  // None — and it is said, never guessed.
  for (const none of [null, '', '   ', '\n\t ']) assert.deepEqual(readInstagramTag(none), { ok: true, tag: null }, say(none));
  // With and without its @, and with spaces round it: kept as typed, without the @.
  assert.deepEqual(readInstagramTag('made.up_tag24'), { ok: true, tag: 'made.up_tag24' });
  assert.deepEqual(readInstagramTag('@made.up_tag24'), { ok: true, tag: 'made.up_tag24' });
  assert.deepEqual(readInstagramTag('  @made.up_tag24\n'), { ok: true, tag: 'made.up_tag24' });
  assert.deepEqual(readInstagramTag('\tmade.up_tag24  '), { ok: true, tag: 'made.up_tag24' });
  // Upper and lower case kept — nothing is lower-cased, so two cases are two tags.
  assert.deepEqual(readInstagramTag('Made_Up.Tag'), { ok: true, tag: 'Made_Up.Tag' });
  assert.deepEqual(readInstagramTag('@MADE.up'), { ok: true, tag: 'MADE.up' });
  assert.notDeepEqual(readInstagramTag('Made_Up.Tag'), readInstagramTag('made_up.tag'));
  // Each kind of character it is made of, alone.
  for (const one of ['a', 'Z', '7', '.', '_']) assert.deepEqual(readInstagramTag(one), { ok: true, tag: one }, one);
  // 30 lands, 31 is refused — and the @ is not one of the 30.
  assert.equal(INSTAGRAM_TAG_MAX, 30);
  assert.equal(INSTAGRAM_TAG_WORDS, 'an Instagram tag is letters, digits, dots and underscores, 30 at most');
  const thirty = 'a1_.'.repeat(7) + 'zz';
  assert.equal(thirty.length, 30);
  assert.deepEqual(readInstagramTag(thirty), { ok: true, tag: thirty });
  assert.deepEqual(readInstagramTag(`@${thirty}`), { ok: true, tag: thirty });
  // Refused, in the rule's words, naming the typed text — trimmed, with its @.
  const bad: ReadonlyArray<readonly [string, string]> = [
    ['31 characters', `${thirty}z`],
    ['31 after its @', `@${thirty}z`],
    ['a space inside', 'made up'],
    ['a hyphen', 'made-up'],
    ['a second @', '@@made'],
    ['an @ inside', 'made@up'],
    ['a letter that is not A–Z', 'madé'],
    ['a line break', 'made\nup'],
    ['a tab inside', 'made\tup'],
    ['a comma', 'made,up'],
    ['an @ and nothing else', '@'],
    ['a space after its @', '@ made'],
  ];
  for (const [why, typed] of bad) {
    const r = refusal(readInstagramTag(` ${typed}  `));
    assert.deepEqual([r.ok, r.status, r.error], [false, 400, 'bad-tag'], why);
    assert.equal(r.message, `${INSTAGRAM_TAG_WORDS} — ${JSON.stringify(typed)} is not one`, why);
  }
  assert.equal(refusal(readInstagramTag('  @made up ')).message, 'an Instagram tag is letters, digits, dots and underscores, 30 at most — "@made up" is not one');
  assert.match(refusal(readInstagramTag('made\nup')).message, / — "made\\nup" is not one$/, 'a line break is shown as written, never printed as one');
  // Not text: a number, a boolean, an object. Absent is not none either — the route refuses it first, and the rule would too.
  for (const notText of [42, 0, true, false, {}, [], ['made.up'], undefined]) {
    assert.deepEqual(readInstagramTag(notText), { ok: false, status: 400, error: 'bad-tag', message: 'instagramTag must be text, or null for none' }, say(notText));
  }
});

// ── T2 · THE VENDOR'S ID ─────────────────────────────────────────────────────

test('T2 a vendor\'s id is a UUID or it names no row: a UUID is itself, anything else is null — never an error, and never a query', () => {
  assert.equal(readVendorId(VENDOR), VENDOR);
  assert.equal(readVendorId(VENDOR.toUpperCase()), VENDOR.toUpperCase(), 'itself, as handed — never rewritten');
  for (const none of ['nope', '', 42, null, undefined, `${VENDOR}x`, ` ${VENDOR}`, VENDOR.replace(/-/g, ''), {}, [VENDOR]]) {
    assert.equal(readVendorId(none), null, say(none));
  }
  // The file's own isValidUuid — not a second reading of the shape.
  assert.match(code(RULE), /export function readVendorId\(raw: unknown\): string \| null \{\s*return isValidUuid\(raw\) \? raw : null;\s*\}/);
  assert.equal(count(code(RULE), "import { isValidUuid } from '@/lib/operations/parseUuid';"), 1);
});

// ── T3 · THE PLANNED ITEMS ───────────────────────────────────────────────────

test('T3 typed items are one line: null and blank are none, every run of spaces and line breaks is one space, no control character, 280 characters at most; a body that says nothing of items keeps what the row holds', () => {
  for (const none of [null, '', '   ', '\n\t \r\n']) assert.deepEqual(readPlannedItems(none), { ok: true, items: null }, say(none));
  // Runs of spaces and line breaks → one space; kept as typed otherwise.
  assert.deepEqual(readPlannedItems('  two   buns,\n\n one   tea\t'), { ok: true, items: 'two buns, one tea' });
  assert.deepEqual(readPlannedItems('first\r\nsecond'), { ok: true, items: 'first second' });
  assert.deepEqual(readPlannedItems('Two BUNS × 2 — no sugar!'), { ok: true, items: 'Two BUNS × 2 — no sugar!' });
  // A control character, or half a surrogate pair — the forms' one test (stopRecord.ts holdsControl).
  for (const held of ['buns\u0000', 'bu\u0007ns', 'bu\u001bns', 'buns\u007f', 'bu\u0085ns', 'buns \ud83e']) {
    assert.deepEqual(readPlannedItems(held), { ok: false, status: 400, error: 'bad-items', message: 'control characters are not planned items' }, say(held));
  }
  // 280 lands, 281 is refused with its count — counted in characters, once it is one line.
  assert.equal(PLANNED_ITEMS_MAX, 280);
  const full = 'x'.repeat(280);
  assert.deepEqual(readPlannedItems(full), { ok: true, items: full });
  assert.deepEqual(readPlannedItems(`  ${full}\n`), { ok: true, items: full }, 'the spaces round it are not counted');
  assert.deepEqual(readPlannedItems(`${'x'.repeat(140)}     ${'y'.repeat(139)}`), { ok: true, items: `${'x'.repeat(140)} ${'y'.repeat(139)}` }, 'a run of spaces counts as its one space');
  assert.deepEqual(readPlannedItems(`${full}x`), { ok: false, status: 400, error: 'bad-items', message: 'planned items are at most 280 characters — these are 281' });
  const wide = '🥐'.repeat(280);
  assert.equal(wide.length, 560);
  assert.deepEqual(readPlannedItems(wide), { ok: true, items: wide }, '280 characters, as the column counts them');
  assert.equal(refusal(readPlannedItems(`${wide}🥐`)).message, 'planned items are at most 280 characters — these are 281');
  // Not text.
  for (const notText of [42, true, {}, [], ['two buns'], undefined]) {
    assert.deepEqual(readPlannedItems(notText), { ok: false, status: 400, error: 'bad-items', message: 'items must be text, or null for none' }, say(notText));
  }
  // itemsAfter: nothing said keeps what is held; a text sets; null clears.
  assert.equal(itemsAfter('two buns', undefined), 'two buns');
  assert.equal(itemsAfter(null, undefined), null);
  assert.equal(itemsAfter(null, 'two buns'), 'two buns');
  assert.equal(itemsAfter('two buns', 'three buns'), 'three buns');
  assert.equal(itemsAfter('two buns', null), null);
  assert.equal(itemsAfter(null, null), null);
  // The rule's own pieces: the file's `spaced`, the forms' holdsControl, the name's way of counting.
  const rule = code(RULE);
  assert.equal(count(rule, "import { holdsControl } from '@/lib/operations/stopRecord';"), 1);
  assert.doesNotMatch(code('src/lib/operations/stopRecord.ts'), /^import /m, 'stopRecord.ts imports nothing — no cycle');
  assert.match(rule, /const items = spaced\(raw\);\s*if \(items === ''\) return \{ ok: true, items: null \};\s*if \(holdsControl\(items\)\) return refuse\(400, 'bad-items', 'control characters are not planned items'\);\s*const length = Array\.from\(items\)\.length;\s*if \(length > PLANNED_ITEMS_MAX\) return refuse\(/);
  assert.match(rule, /export function itemsAfter\(held: string \| null, said: string \| null \| undefined\): string \| null \{\s*return said === undefined \? held : said;\s*\}/);
});

// ── T4 · THE MIGRATION ───────────────────────────────────────────────────────

test('T4 the migration (the newest until COALEVELS-01’s followed) holds six statements and no other: three columns that admit NULL and three CHECKs — no row written, no default; authored, not applied', () => {
  const dirs = readdirSync(resolve(process.cwd(), 'prisma/migrations')).filter((d) => /^\d{14}_/.test(d)).sort();
  assert.equal(dirs[dirs.length - 2], MIGRATION_DIR, 'the migration before the newest (COALEVELS-01 followed)'); // COALEVELS-01 (2026-11-27): its migration, 20261127230000_coa_levels_01_sub_accounts_location, is the newest now — `dirs[dirs.length - 1]`, 'the newest migration', until then
  const statements = code(MIGRATION).split(';').map(flat).filter(Boolean);
  assert.deepEqual(statements, [
    'ALTER TABLE "operations_vendor_directory" ADD COLUMN "instagram_tag" VARCHAR(30)',
    'ALTER TABLE "operations_vendor_directory" ADD CONSTRAINT "operations_vendor_directory_instagram_tag_shape" CHECK ("instagram_tag" IS NULL OR "instagram_tag" ~ \'^[A-Za-z0-9._]{1,30}$\')',
    'ALTER TABLE "planned_item_vendors" ADD COLUMN "items" VARCHAR(280)',
    'ALTER TABLE "planned_item_vendors" ADD CONSTRAINT "planned_item_vendors_items_not_blank" CHECK ("items" IS NULL OR length(btrim("items")) > 0)',
    'ALTER TABLE "operations_stop_records" ADD COLUMN "notes" VARCHAR(2000)',
    'ALTER TABLE "operations_stop_records" ADD CONSTRAINT "operations_stop_records_notes_not_blank" CHECK ("notes" IS NULL OR length(btrim("notes")) > 0)',
  ]);
  // TIMESHEET-04a-fix (2026-11-27): the header's words were put right before the merge — a migration's file is never edited once it has been applied — and not one statement moved by
  // a character: each stands on a line of its own, exactly as listed above.
  assert.deepEqual(code(MIGRATION).split('\n').map((l) => l.trimEnd()).filter(Boolean), statements.map((s) => `${s};`), 'the six statements, each on its own line, character for character');
  const sql = flat(code(MIGRATION));
  assert.doesNotMatch(sql, /\b(INSERT|UPDATE|DELETE)\b/i, 'no row is written — nothing is backfilled');
  assert.doesNotMatch(sql, /\bDEFAULT\b/i, 'no default — a column that admits NULL rewrites no row');
  assert.doesNotMatch(sql, /\bNOT\s+NULL\b/i);
  assert.doesNotMatch(sql, /\bIF\s+(NOT\s+)?EXISTS\b/i);
  assert.doesNotMatch(sql, /\b(DROP|ALTER\s+TYPE|CREATE|TRIGGER|INDEX)\b/i, 'no enum value, no index, no trigger, nothing dropped');
  // The two not-blank CHECKs are the stop record's own idiom, on the same table (STOP-01's note).
  const idiom = (column: string): string => `CHECK ("${column}" IS NULL OR length(btrim("${column}")) > 0)`;
  assert.ok(code('prisma/migrations/20261012140000_stop_01_operations_stop_records/migration.sql').includes(`CONSTRAINT "operations_stop_records_note_not_blank" ${idiom('note')},`));
  assert.ok(statements[3].endsWith(idiom('items')) && statements[5].endsWith(idiom('notes')));
  // Its header — who writes each column, and that this file was run against nothing.
  const header = comments(MIGRATION);
  assert.match(header, /AUTHORED, NOT APPLIED to any database\./);
  assert.match(header, /NO BACKFILL\./);
  assert.match(header, /WRITTEN by the directory route's PATCH/);
  assert.match(header, /WRITTEN by the plan-vendors route/);
  assert.match(header, /NO READER AND NO WRITER until TIMESHEET-04b/);
  assert.match(header, /scripts\/migrate-gate\.ts; PREVIEW-DB-01: a preview never migrates/);
  // TIMESHEET-04a-fix (2026-11-27), ruling C: what the items column holds, in its own words — what is planned to be had at a stop, on the plan's vendor row at that row's own grain.
  // Whether the stop is ahead is not the column's to say, so the header no longer says that it is.
  assert.match(header, /planned_item_vendors\.items — what is planned to be had at a stop:/);
  assert.match(header, /on the plan's vendor row, at that row's own grain\./);
  assert.doesNotMatch(header, /still ahead/);
});

// ── T5 · THE SCHEMA, AND THE RULES' BOUNDS ───────────────────────────────────

test('T5 the schema moves with it: each model declares its new field once, with the column\'s type, under its last scalar field; the rules\' bounds are the columns\', and the tag\'s shape is the CHECK\'s own', () => {
  const schemaLines = code(SCHEMA).split('\n');
  const noteLines = comments(SCHEMA).split('\n');
  assert.equal(schemaLines.length, noteLines.length);
  const sql = code(MIGRATION);
  const fields = [
    ['operations_vendor_directory', 'instagram_tag', 30, 'created_by'],
    ['planned_item_vendors', 'items', 280, 'updated_at'],
    ['operations_stop_records', 'notes', 2000, 'updated_at'],
  ] as const;
  for (const [model, field, max, under] of fields) {
    const open = schemaLines.findIndex((l) => l.trimEnd() === `model ${model} {`);
    assert.ok(open >= 0, `model ${model}`);
    const close = schemaLines.findIndex((l, i) => i > open && l.trimEnd() === '}');
    const declared = schemaLines.map((l, i) => ({ l, i })).filter(({ l, i }) => i > open && i < close && new RegExp(`^[ \\t]+${field}[ \\t]`).test(l));
    assert.equal(declared.length, 1, `${model} declares ${field} once`);
    const { l, i } = declared[0];
    assert.match(l, new RegExp(`^[ \\t]+${field}[ \\t]+String\\?[ \\t]+@db\\.VarChar\\(${max}\\)[ \\t]*$`), `${model}.${field}: text that may be none, ${max} at most`);
    assert.match(schemaLines[i - 1], new RegExp(`^[ \\t]+${under}[ \\t]`), `${model}.${field} stands directly under ${under}`);
    assert.match(noteLines[i], /\/\/ TIMESHEET-04a \(2026-11-27\): /, `${model}.${field} carries its dated note on its own line`);
    assert.match(sql, new RegExp(`^ALTER TABLE "${model}" ADD COLUMN "${field}" VARCHAR\\(${max}\\);$`, 'm'), `${model}.${field} is the column the migration adds`);
  }
  // TIMESHEET-04a-fix (2026-11-27), ruling C: the schema's note on `items` and the rule's own comment say what the column holds — what is planned to be had at a stop, on the plan's
  // vendor row at that row's own grain — and neither says the stop is ahead: that is not the column's to say (neither the route nor the rule reads a clock — vendor01.test.ts T7).
  const itemsAt = schemaLines.findIndex((l) => /^[ \t]+items[ \t]+String\?[ \t]+@db\.VarChar\(280\)[ \t]*$/.test(l));
  assert.ok(itemsAt >= 0, 'the schema declares items');
  assert.match(noteLines[itemsAt], /what is planned to be had at a stop, on the plan's vendor row at that row's own grain/);
  const ruleNotes = comments(RULE);
  const bullet = ruleNotes.slice(ruleNotes.indexOf('a plan\'s PLANNED ITEMS'), ruleNotes.indexOf('null is NONE for both'));
  assert.match(bullet, /at that row's own grain: what is planned to be had at a stop/);
  for (const words of [noteLines[itemsAt], bullet]) assert.doesNotMatch(words, /still ahead/);
  // No enum value is added: the tag's audit type was in AuditActionType already.
  assert.match(code(SCHEMA), /enum AuditActionType \{[^}]*\boperations_vendor_updated\b[^}]*\}/);
  assert.match(code('src/app/api/audit-log/route.ts'), /'operations_vendor_updated'/);
  // The rules' bounds are the columns'.
  assert.equal(INSTAGRAM_TAG_MAX, fields[0][2]);
  assert.equal(PLANNED_ITEMS_MAX, fields[1][2]);
  // The tag's shape is the CHECK's own pattern, character for character — and the rule keeps a text exactly when the CHECK's
  // pattern admits it. (The pattern is run here as JavaScript reads it; no database is asked.)
  const check = /CHECK \("instagram_tag" IS NULL OR "instagram_tag" ~ '([^']+)'\);/.exec(sql);
  assert.ok(check);
  assert.equal(check[1], `^[A-Za-z0-9._]{1,${INSTAGRAM_TAG_MAX}}$`);
  assert.ok(code(RULE).includes(`if (!/${check[1]}/.test(tag)) return refuse(400, 'bad-tag', `), 'the rule tests the CHECK\'s own pattern');
  const shape = new RegExp(check[1]);
  const probes = ['made.up_tag24', 'Made_Up.Tag', 'a', '_', '.', '9', 'a'.repeat(30), 'a'.repeat(31), '', ' ', 'made up', 'made-up', 'made@up', '@made', 'madé', 'made\nup', 'made\tup', 'made,up', 'made/up', 'made!'];
  for (const probe of probes) {
    const read = readInstagramTag(probe);
    assert.equal(read.ok && read.tag === probe, shape.test(probe), `${say(probe)}: kept as it is exactly when the CHECK admits it`);
  }
  for (const typed of ['@made.up_tag24', '  Made_Up.Tag ', `@${'a'.repeat(30)}`, '\t_\n']) {
    const read = readInstagramTag(typed);
    assert.ok(read.ok && read.tag !== null && shape.test(read.tag), `${say(typed)}: what the rule keeps, the CHECK admits`);
  }
  // What the rule keeps of typed items is never blank and never past the column: the not-blank CHECK and VarChar(280) admit it.
  for (const typed of ['two buns', '  two   buns \n', 'x'.repeat(280), `\t${'🥐'.repeat(280)} `, '.']) {
    const read = readPlannedItems(typed);
    assert.ok(read.ok && read.items !== null && read.items.trim().length > 0 && Array.from(read.items).length <= PLANNED_ITEMS_MAX, say(typed));
  }
  // The section's exports, and no other — between takenBy and THE ADDRESS.
  const rule = code(RULE);
  const section = rule.slice(rule.indexOf('export function takenBy<'), rule.indexOf('export const PLAN_VENDOR_KINDS'));
  assert.deepEqual(
    [...section.matchAll(/^export (?:const|function|interface|type) (\w+)/gm)].map((m) => m[1]),
    // TIMESHEET-04b (2026-11-27): ONE export more, after readVendorId — instagramTagWords, the tag as it is printed, with its @ (the time sheet's cell and CSV field). The seven without it until then.
    ['takenBy', 'INSTAGRAM_TAG_MAX', 'INSTAGRAM_TAG_WORDS', 'readInstagramTag', 'readVendorId', 'instagramTagWords', 'PLANNED_ITEMS_MAX', 'readPlannedItems', 'itemsAfter'],
  );
  assert.doesNotMatch(section, /@prisma\/client|@\/lib\/prisma|next\/server|process\.env|toLowerCase\(/, 'pure, and nothing is lower-cased');
});

// ── T6 · THE DIRECTORY ROUTE ─────────────────────────────────────────────────

test('T6 the directory route exports GET, POST and PATCH: the GET reads the tag, the POST writes the name only, and the PATCH is the tag\'s ONE write — refused before the vendor is read, one 404, nothing written when nothing changes, then the update and its audit', () => {
  const src = code(DIRECTORY);
  assert.deepEqual(exportedMethods(src).map((e) => e.method), ['GET', 'POST', 'PATCH']);
  assert.doesNotMatch(src, /403/, 'no 403 anywhere');
  assert.doesNotMatch(src, /rateLimit/i, 'no rate limit — the POST has none');
  assert.equal(count(src, "import { readInstagramTag, readVendorId, readVendorName, takenBy } from '@/lib/operations/planVendor';"), 1);
  const get = handler(src, 'GET');
  const post = handler(src, 'POST');
  const patch = handler(src, 'PATCH');

  // The GET reads the tag; nothing else of it changed, and it writes nothing.
  assert.ok(fold(get).includes("const vendors = await prisma.operations_vendor_directory.findMany({ where: { user_id: user.id, is_active: true }, orderBy: { vendor_name: 'asc' }, select: { id: true, vendor_name: true, entity_id: true, category: true, instagram_tag: true }, });"));
  assert.doesNotMatch(get, /\.(create|update|upsert|delete)\w*\(/);

  // The POST's create is as it was, and its handler does not name the tag: the tag is written ONE way.
  assert.ok(fold(post).includes('const created = await tx.operations_vendor_directory.create({ data: { user_id: user.id, entity_id: entityId, vendor_name: name.name, created_by: userEmail }, select: { id: true, vendor_name: true, entity_id: true }, });'));
  assert.doesNotMatch(post, /instagram_tag|instagramTag|readInstagramTag|readVendorId/);
  assert.doesNotMatch(post, /operations_vendor_directory\.update/);

  // Nothing was added above the GET or the POST: the registry cites each by its line.
  const registry = code(REGISTRY);
  assert.ok(registry.includes(`its GET lists vendors (vendor-directory/route.ts:${lineOf(src, 'export async function GET(')})`), 'the registry\'s line for the GET');
  assert.ok(registry.includes(`add → vendor-directory/route.ts:${lineOf(src, 'export async function POST(')} (POST)`), 'the registry\'s line for the POST');

  // THE PATCH. It opens with the GET's own gate, character for character, and reads its body exactly as the POST does.
  const gateOf = (h: string): string => {
    const end = "return NextResponse.json({ error: 'User not found' }, { status: 404 });";
    const from = h.indexOf('{', h.indexOf(')'));
    const to = h.indexOf(end);
    assert.ok(from > 0 && to > from);
    return h.slice(from, to + end.length);
  };
  assert.equal(gateOf(patch), gateOf(get));
  assert.ok(gateOf(get).includes('const userEmail = await getVerifiedEmail();') && gateOf(get).includes("{ status: 401 }"));
  const bodyRead = (h: string): string => h.slice(h.indexOf('let raw: unknown;'), h.indexOf('const body = raw as {'));
  assert.equal(bodyRead(patch), bodyRead(post));
  assert.ok(bodyRead(post).includes("return NextResponse.json({ error: 'A JSON object body is required.' }, { status: 400 });"));
  assert.ok(patch.includes('const body = raw as { id?: unknown; instagramTag?: unknown };'));

  // The steps, each once, in order: the required field and the rule BEFORE the vendor is read; the unchanged answer BEFORE
  // the update; the audit AFTER it.
  const NOT_FOUND = "if (before === null) return NextResponse.json({ error: 'Not found' }, { status: 404 });";
  const UNCHANGED = 'if (before.instagram_tag === read.tag) return NextResponse.json({ ...before, changed: false });';
  inOrder(patch, [
    'Array.isArray(raw)',
    'if (body.instagramTag === undefined) {',
    "return NextResponse.json({ error: 'Validation', message: 'instagramTag is required — text, or null for none' }, { status: 400 });",
    'const read = readInstagramTag(body.instagramTag);',
    'if (!read.ok) return NextResponse.json({ error: read.error, message: read.message }, { status: read.status });',
    'const id = readVendorId(body.id);',
    'prisma.operations_vendor_directory.findFirst(',
    NOT_FOUND,
    UNCHANGED,
    'prisma.operations_vendor_directory.update(',
    'await writeAuditLog({',
    'return NextResponse.json({ ...after, changed: true });',
  ], 'the PATCH');

  // The vendor: the caller's own row by id and user_id — active or archived. An id that is no UUID makes no query. ONE 404
  // for an id that is no UUID, a missing row and another user's.
  assert.ok(fold(patch).includes('const before = id === null ? null : await prisma.operations_vendor_directory.findFirst({ where: { id, user_id: user.id }, select: { id: true, vendor_name: true, entity_id: true, instagram_tag: true }, });'));
  assert.equal(count(patch, "{ error: 'Not found' }"), 1);
  assert.equal(count(patch, 'status: 404'), 2, 'the gate\'s user, and the vendor — no other');
  assert.doesNotMatch(patch, /is_active/, 'active or archived');

  // THE ONE WRITE — the ruled line, character for character; its where is id and the caller, its data the tag alone.
  const TAG_WRITE = 'const after = await prisma.operations_vendor_directory.update({ where: { id: before.id, user_id: user.id }, data: { instagram_tag: read.tag }, select: { id: true, vendor_name: true, entity_id: true, instagram_tag: true } });';
  assert.ok(patch.includes(`\n    ${TAG_WRITE}\n`), 'on one line');
  assert.equal(count(src, 'operations_vendor_directory.update('), 1, 'the file\'s one update');
  assert.doesNotMatch(src, /operations_vendor_directory\.(updateMany|upsert|delete|deleteMany|createMany)\(/);
  const at = patch.indexOf('prisma.operations_vendor_directory.update(');
  const call = patch.slice(at, closingOf(patch, at + 'prisma.operations_vendor_directory.update'.length) + 1);
  const where = /\bwhere: \{([^{}]*)\}/.exec(call);
  const data = /\bdata: \{([^{}]*)\}/.exec(call);
  assert.ok(where && data);
  assert.equal(where[1].trim(), 'id: before.id, user_id: user.id');
  assert.deepEqual(data[1].split(',').map((p) => p.split(':')[0].trim()), ['instagram_tag'], 'instagram_tag alone');

  // Its audit — the type the enum already holds, the row before and after.
  const audit = fold(patch.slice(patch.indexOf('await writeAuditLog({')));
  assert.ok(audit.includes("action: { type: 'operations_vendor_updated', description: `${read.tag === null ? 'Cleared' : 'Set'} the Instagram tag of \"${after.vendor_name}\"` },"));
  assert.ok(audit.includes("target: { table: 'operations_vendor_directory', id: after.id },"));
  assert.ok(audit.includes('payload: { before, after, metadata: { entity_id: after.entity_id } },'));
  assert.equal(count(patch, 'writeAuditLog('), 1);
  assert.ok(patch.includes("return failClosedResponse('Vendor directory PATCH', 'Failed to set the vendor\\'s Instagram tag', error);"));
});

// ── T7 · THE PLAN-VENDORS ROUTE ──────────────────────────────────────────────

test('T7 the plan-vendors POST reads items by the rule only when the body says them, before the plan is read; itemsAfter decides; nothing is written only when neither the vendor nor the items change; the DELETE does not name them', () => {
  const route = code(ROUTE);
  assert.deepEqual(exportedMethods(route).map((e) => e.method), ['POST', 'DELETE']);
  const post = handler(route, 'POST');
  const del = handler(route, 'DELETE');
  assert.match(comments(ROUTE), /POST {3}\{ kind, id, instant, vendorId, items\? \} → set the vendor at that address\./);
  assert.ok(code(REGISTRY).includes(`POST src/app/api/operations/plan-vendors/route.ts:${lineOf(route, 'export async function POST(')} at instant null`), 'nothing was added above the POST: the registry cites it by its line');
  // TIMESHEET-04a-fix (2026-11-27), ruling A: the registry cites the DELETE where it stands too — in the Expenses row's citation and in the note above the row — read from the
  // route's source as the POST's cite is, so a line added above the DELETE fails here. The lines the POST gained had moved the handler, and the two cites were not moved with it
  // until this fix; the row's dated note says what moved. The PR that moves a cited line re-points the cite.
  const deleteAt = lineOf(route, 'export async function DELETE(');
  assert.ok(code(REGISTRY).includes(`clear → route.ts:${deleteAt} (DELETE); add → vendor-directory/route.ts:`), 'the registry\'s line for the DELETE, in the Expenses row\'s citation');
  assert.match(comments(REGISTRY), new RegExp(`"clear" is the route's DELETE\\n[ \\t]*//[ \\t]+\\(:${deleteAt}\\) at the same address`), 'and in the note above the row');
  assert.match(comments(REGISTRY), /TIMESHEET-04a \(Alex, 2026-11-27\): the plan-vendors route grew \(its POST reads a plan's planned items\) — :\d+ → :\d+ \(DELETE\); what it cites is unchanged/, 'the dated note on the row says what moved');
  assert.ok(post.includes('const body = raw as { kind?: unknown; id?: unknown; instant?: unknown; vendorId?: unknown; items?: unknown };'));

  // Each step once, in order: the address, then the items — only when said — then the plan, the grain, the write, the audit.
  inOrder(post, [
    'const address = read.address;',
    'let said: string | null | undefined;',
    'if (body.items !== undefined) {',
    'const items = readPlannedItems(body.items);',
    'if (!items.ok) return refused(items);',
    'said = items.items;',
    'prisma.operations_routines.findFirst(',
    'prisma.planned_item_vendors.findMany(',
    'const write = writeFor(existing, fits.vendor.id);',
    'const before = existing === null ? null : rows.find((r) => r.id === existing.id) ?? null;',
    'const itemsNow = before === null ? null : before.items;',
    'const itemsNext = itemsAfter(itemsNow, said);',
    "if (write === 'unchanged' && itemsNext === itemsNow) {",
    'prisma.planned_item_vendors.create(',
    'prisma.planned_item_vendors.update(',
    'await writeAuditLog({',
  ], 'the POST');
  assert.ok(fold(post).includes('let said: string | null | undefined; if (body.items !== undefined) { const items = readPlannedItems(body.items); if (!items.ok) return refused(items); said = items.items; }'));
  assert.equal(count(route, 'body.items'), 2, 'asked whether it is said, and read — nowhere else');
  // Before the plan is read: every query but the gate's own stands after the items are read.
  const saidAt = post.indexOf('said = items.items;');
  const queries = [...post.matchAll(/\b(?:prisma\.(\w+)\.\w+|loadRoutineBudgetInputs)\(/g)].filter((m) => m[1] !== 'users');
  assert.ok(queries.length >= 7 && queries.every((m) => m.index > saidAt), 'no query of a plan, a book, a vendor or the grain before the items are read');

  // The grain's select reads the items the row holds.
  assert.ok(fold(post).includes('const rows = await prisma.planned_item_vendors.findMany({ where: { user_id: user.id, ...planWhere(address) }, select: { id: true, occurrence_at: true, vendor_id: true, items: true, vendor: { select: { vendor_name: true } } }, });'));

  // 'unchanged' only when neither changes — and it answers the items the row holds.
  assert.ok(fold(post).includes("if (write === 'unchanged' && itemsNext === itemsNow) { return NextResponse.json({ outcome: 'unchanged', address: addressMeta(address), vendor: { id: fits.vendor.id, vendor_name: fits.vendor.vendor_name }, items: itemsNow }); }"));
  assert.equal(count(post, "outcome: 'unchanged'"), 1);
  // The create and the update both carry the items; the update's where is as it was.
  assert.ok(fold(post).includes("const after = write === 'create' ? await prisma.planned_item_vendors.create({ data: { user_id: user.id, ...addressWhere(address), vendor_id: fits.vendor.id, items: itemsNext } }) : await prisma.planned_item_vendors.update({ where: { id: (existing as HeldVendor).id, user_id: user.id }, data: { vendor_id: fits.vendor.id, items: itemsNext } });"));
  // The audit's type is unchanged; its words say which of the two was written.
  assert.ok(fold(post).includes("action: { type: 'operations_plan_vendor_set', description: write === 'unchanged' ? `${itemsNext === null ? 'Cleared' : 'Set'} the planned items of a plan at \"${fits.vendor.vendor_name}\"` : `Set the vendor of a plan to \"${fits.vendor.vendor_name}\"` },"));
  assert.equal(count(route, "'operations_plan_vendor_set'"), 1);
  assert.equal(count(route, "'operations_plan_vendor_cleared'"), 1);
  // TIMESHEET-04a-fix (2026-11-27), ruling B: the audit names a replaced vendor only when one is replaced — the standing vendor's name when the write replaces it, and null for a
  // created row and for a write of the items alone. Until then it named the standing vendor whenever a row stood (`existing === null ? null : existing.vendorName`).
  assert.ok(fold(post).includes("payload: { before, after, metadata: { address: addressMeta(address), vendor_name: fits.vendor.vendor_name, replaced: write === 'replace' ? (existing as HeldVendor).vendorName : null }, },"));
  assert.equal(count(post, 'replaced:'), 1);
  // The three outcomes, the items in the answer, the statuses as they were.
  assert.ok(fold(post).includes("return NextResponse.json( { outcome: write === 'create' ? 'set' : write === 'replace' ? 'replaced' : 'items', address: addressMeta(address), vendor: { id: fits.vendor.id, vendor_name: fits.vendor.vendor_name }, items: itemsNext }, { status: write === 'create' ? 201 : 200 }, );"));

  // The DELETE does not name the items, and the rule's writeFor and HeldVendor are as they were.
  assert.doesNotMatch(del, /\bitems\b|readPlannedItems|itemsAfter|\bsaid\b/);
  const rule = code(RULE);
  assert.match(rule, /export function writeFor\(existing: HeldVendor \| null, vendorId: string\): 'create' \| 'replace' \| 'unchanged' \{\s*if \(existing === null\) return 'create';\s*return existing\.vendorId === vendorId \? 'unchanged' : 'replace';\s*\}/);
  assert.match(rule, /export interface HeldVendor \{\s*readonly id: string;\s*readonly occurrenceAt: Date \| null;\s*readonly vendorId: string;\s*readonly vendorName: string;\s*\}/);

  // The same decision the route makes, over the rule's own writeFor and itemsAfter — every case of a row, a vendor and what is said.
  const row = (vendorId: string): HeldVendor => ({ id: 'row-1', occurrenceAt: null, vendorId, vendorName: 'Made Up One' });
  const decide = (existing: HeldVendor | null, held: string | null, vendorId: string, said: string | null | undefined): [string, string | null] => {
    const write = writeFor(existing, vendorId);
    const itemsNow = existing === null ? null : held;
    const itemsNext = itemsAfter(itemsNow, said);
    if (write === 'unchanged' && itemsNext === itemsNow) return ['unchanged', itemsNow];
    return [write === 'create' ? 'set' : write === 'replace' ? 'replaced' : 'items', itemsNext];
  };
  const cases: ReadonlyArray<readonly [string, HeldVendor | null, string | null, string | null | undefined, readonly [string, string | null]]> = [
    ['no row, nothing said', null, null, undefined, ['set', null]],
    ['no row, items said', null, null, 'two buns', ['set', 'two buns']],
    ['no row, none said', null, null, null, ['set', null]],
    ['the same vendor, nothing said', row(VENDOR), 'two buns', undefined, ['unchanged', 'two buns']],
    ['the same vendor, the same items said', row(VENDOR), 'two buns', 'two buns', ['unchanged', 'two buns']],
    ['the same vendor holding none, none said', row(VENDOR), null, null, ['unchanged', null]],
    ['the same vendor, other items', row(VENDOR), 'two buns', 'three buns', ['items', 'three buns']],
    ['the same vendor holding none, items said', row(VENDOR), null, 'two buns', ['items', 'two buns']],
    ['the same vendor, its items cleared', row(VENDOR), 'two buns', null, ['items', null]],
    ['another vendor, nothing said — the row keeps its items', row(OTHER), 'two buns', undefined, ['replaced', 'two buns']],
    ['another vendor, other items', row(OTHER), 'two buns', 'three buns', ['replaced', 'three buns']],
    ['another vendor, its items cleared', row(OTHER), 'two buns', null, ['replaced', null]],
  ];
  for (const [what, existing, held, said, expected] of cases) assert.deepEqual(decide(existing, held, VENDOR, said), expected, what);
  // … and the audit's `replaced`, as the route's expression reads it, over the three writes (TIMESHEET-04a-fix, ruling B).
  const replacedOf = (existing: HeldVendor | null, vendorId: string): string | null => (writeFor(existing, vendorId) === 'replace' ? (existing as HeldVendor).vendorName : null);
  assert.equal(replacedOf(null, VENDOR), null, 'a created row replaces no vendor');
  assert.equal(replacedOf(row(VENDOR), VENDOR), null, 'a write of the items alone replaces no vendor');
  assert.equal(replacedOf(row(OTHER), VENDOR), 'Made Up One', 'another vendor stood there: it is the one named');
});

// ── T8 · THE VENDOR LAW ──────────────────────────────────────────────────────

test('T8 the vendor law, read from its source: the directory route may hold ONE update — the tag\'s, in its shape — beside its create; every other write of the directory is refused anywhere, and the PATCH is held to the gate', () => {
  const lawLines = code(LAW).split('\n').map((l) => l.trimEnd());
  // PV_TAG_WRITE as ruled, and the directory's three handlers — one line.
  const tagLine = lawLines.find((l) => l.startsWith('const PV_TAG_WRITE = '));
  assert.ok(tagLine);
  assert.equal(tagLine, String.raw`const PV_TAG_WRITE = /\.operations_vendor_directory\.update\(\{ where: \{ id: before\.id, user_id: user\.id \}, data: \{ instagram_tag: read\.tag \}, select: /; const PV_HANDLERS: Record<string, readonly string[]> = { [PV_DIRECTORY]: ['GET', 'POST', 'PATCH'], [PV_ROUTE]: ['POST', 'DELETE'] };`);
  const tagWrite = new RegExp(tagLine.slice('const PV_TAG_WRITE = /'.length, tagLine.indexOf('/; const PV_HANDLERS')));
  assert.ok(lawLines.includes("const PV_WRITE = '(create|createMany|createManyAndReturn|update|updateMany|upsert|delete|deleteMany)';"));

  // The directory-write loop, five lines: a create and an update are let through in the directory route ONLY, and the
  // one-update check stands directly under the loop. EDIT-03 (2026-11-29): its first line lets the routine route's create through too — the book
  // move's copy of a vendor, held to ONE in its shape by the routine route's own check (clause 1's third exception; edit03.test.ts Y3 runs it).
  const skip = lawLines.indexOf("    if (((m[1] === 'create' || m[1] === 'update') && file === PV_DIRECTORY) || (m[1] === 'create' && file === PV_REKEY_ROUTE)) continue;"); // EDIT-03 (2026-11-29): and the routine route's create — "    if ((m[1] === 'create' || m[1] === 'update') && file === PV_DIRECTORY) continue;" until then
  assert.ok(skip > 0, 'the loop lets a create and an update through in the directory route only — and a create in the routine route, held to the book move\'s copy');
  assert.equal(lawLines[skip - 1], "  for (const m of src.matchAll(new RegExp(`\\\\.operations_vendor_directory\\\\s*\\\\.\\\\s*${PV_WRITE}\\\\s*\\\\(`, 'g'))) {");
  assert.equal(lawLines[skip + 1], "    if (m[1].startsWith('create')) pvFail(`${file} creates a vendor (.${m[1]}) — a vendor is created by ${PV_DIRECTORY} alone`); else pvFail(`${file} ${m[1]}s the vendor directory — a vendor is created, and its Instagram tag set, by ${PV_DIRECTORY} alone; it is never renamed, archived or deleted`);");
  assert.equal(lawLines[skip + 2], '  }');
  assert.equal(lawLines[skip + 3], "  if (file === PV_DIRECTORY && ((src.match(/\\.operations_vendor_directory\\s*\\.\\s*update\\s*\\(/g) ?? []).length !== 1 || !PV_TAG_WRITE.test(src))) pvFail(`${file}: its updates of the vendor directory are not the tag’s ONE write — exactly one update, instagram_tag alone, where id and the caller`);");

  // Clause 1 as those five lines run it, over a file's source: the writes the loop refuses, and whether the one-update check holds.
  const writes = /\.operations_vendor_directory\s*\.\s*(create|createMany|createManyAndReturn|update|updateMany|upsert|delete|deleteMany)\s*\(/g;
  const updates = /\.operations_vendor_directory\s*\.\s*update\s*\(/g;
  const judge = (file: string, src: string): { refused: string[]; one: boolean } => ({
    refused: [...src.matchAll(writes)].map((m) => m[1]).filter((op) => !((op === 'create' || op === 'update') && file === DIRECTORY)),
    one: file !== DIRECTORY || ((src.match(updates) ?? []).length === 1 && tagWrite.test(src)),
  });
  const dir = code(DIRECTORY);
  const RULED = '.operations_vendor_directory.update({ where: { id: before.id, user_id: user.id }, data: { instagram_tag: read.tag }, select: ';
  assert.equal(count(dir, RULED), 1);
  assert.deepEqual(judge(DIRECTORY, dir), { refused: [], one: true }, 'the route as ruled');
  assert.deepEqual(judge(ROUTE, code(ROUTE)), { refused: [], one: true }, 'the plan-vendors route reads the directory and never writes it');
  const broken: ReadonlyArray<readonly [string, string, string, { refused: string[]; one: boolean }]> = [
    ['a second field in the update\'s data', DIRECTORY, dir.replace('data: { instagram_tag: read.tag }', 'data: { instagram_tag: read.tag, is_active: false }'), { refused: [], one: false }],
    ['another field in its place', DIRECTORY, dir.replace('data: { instagram_tag: read.tag }', 'data: { vendor_name: read.tag }'), { refused: [], one: false }],
    ['the caller missing from its where', DIRECTORY, dir.replace('where: { id: before.id, user_id: user.id }, data:', 'where: { id: before.id }, data:'), { refused: [], one: false }],
    ['an id that is not the row just read', DIRECTORY, dir.replace('where: { id: before.id, user_id: user.id }, data:', 'where: { id: body.id, user_id: user.id }, data:'), { refused: [], one: false }],
    ['a second update', DIRECTORY, dir.replace(RULED, `${RULED}{ id: true } }); await prisma${RULED}`), { refused: [], one: false }],
    ['an updateMany', DIRECTORY, dir.replace('.operations_vendor_directory.update(', '.operations_vendor_directory.updateMany('), { refused: ['updateMany'], one: false }],
    ['a delete', DIRECTORY, `${dir}\nawait prisma.operations_vendor_directory.delete({ where: { id, user_id: user.id } });`, { refused: ['delete'], one: true }],
    ['an upsert', DIRECTORY, `${dir}\nawait prisma.operations_vendor_directory.upsert({});`, { refused: ['upsert'], one: true }],
    ['the tag\'s own update, in the plan-vendors route', ROUTE, `${code(ROUTE)}\nawait prisma${RULED}{ id: true } });`, { refused: ['update'], one: true }],
    ['a create, in the plan-vendors route', ROUTE, `${code(ROUTE)}\nawait prisma.operations_vendor_directory.create({});`, { refused: ['create'], one: true }],
  ];
  for (const [why, file, src, expected] of broken) {
    assert.notEqual(src, code(file), `${why}: the source was changed`);
    assert.deepEqual(judge(file, src), expected, why);
  }

  // PV_GATE's four methods — and, read from the law's own line, it holds every handler of both routes and no altered PATCH.
  const gateLine = lawLines.find((l) => l.startsWith('const PV_GATE = /'));
  assert.ok(gateLine);
  assert.ok(gateLine.startsWith('const PV_GATE = /^export async function (GET|POST|PATCH|DELETE)\\((?:request: NextRequest)?\\) \\{ try \\{ const userEmail = await getVerifiedEmail\\(\\);'));
  const gate = new RegExp(gateLine.slice('const PV_GATE = /'.length, gateLine.lastIndexOf('/;')));
  /** A handler as the law reads it: from its `export async function` to its closing brace, every run of whitespace one space. */
  const asRead = (src: string, method: string): string => {
    const at = src.indexOf(`export async function ${method}(`);
    assert.ok(at >= 0, method);
    return fold(src.slice(at, closingOf(src, src.indexOf('{', src.indexOf(')', at))) + 1));
  };
  for (const [file, methods] of [[DIRECTORY, ['GET', 'POST', 'PATCH']], [ROUTE, ['POST', 'DELETE']]] as const) {
    for (const method of methods) assert.ok(gate.test(asRead(code(file), method)), `${file} ${method} opens with the gate`);
  }
  const patch = asRead(dir, 'PATCH');
  const altered: ReadonlyArray<readonly [string, string]> = [
    ['the 401 gone', patch.replace("if (!userEmail) { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); } ", '')],
    ['the user read by another key', patch.replace("where: { email: { equals: userEmail, mode: 'insensitive' } }", 'where: { id: userEmail }')],
    ['the body read before the caller', patch.replace('try { const userEmail', 'try { const early = await request.json(); const userEmail')],
    ['a 403 for no user', patch.replace("{ error: 'User not found' }, { status: 404 }", "{ error: 'User not found' }, { status: 403 }")],
    ['another method', patch.replace('export async function PATCH(', 'export async function PUT(')],
  ];
  for (const [why, src] of altered) {
    assert.notEqual(src, patch, `${why}: the handler was changed`);
    assert.equal(gate.test(src), false, why);
  }

  // The law's own words: clause 1's second exception, and what its ✔ line says of the directory.
  assert.match(comments(LAW), /THREE exceptions, each pinned to its shape:/); // EDIT-03 (2026-11-29): the book move is the third — /TWO exceptions, each ONE write pinned to its shape:/ until then
  assert.match(comments(LAW), /TIMESHEET-04 \(Alex, 2026-11-27 — "tag is own column"\): the directory route's one update is a vendor's Instagram tag —/);
  assert.ok(code(LAW).includes("the vendor directory is created only by ${PV_DIRECTORY} (and, in a plan's book move, the target book's copy of a vendor the plan names — its own name and tag — by ${PV_REKEY_ROUTE} alone, EDIT-03), never deleted, and updated only there, once — a vendor’s Instagram tag alone, by id and the caller (TIMESHEET-04);")); // EDIT-03 (2026-11-29): the ✔ line names the book move's copy — '…created only by ${PV_DIRECTORY}, never deleted…' until then
});
