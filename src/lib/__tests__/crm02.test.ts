/**
 * CRM-01b (Alex, 2026-11-07) — THE CRM WRITES: a stage and a next step on the row, a contact added by hand; the owner's
 * proposals panel retires into the CRM.
 *
 * Ruling A: two writes, one route file — the caller first (the GET's order), then whose row, every write WHERE user_id =
 * the caller's; the body shapes zod. Ruling B (corrected): the Stage select and the Next step input on the Contacts row,
 * both in CONTROL.input; "Add a contact" opens the add row; a failed write is said under the table; the re-read after
 * every write. Ruling C: /owner is the accounts console; the two routes are gone. Ruling D: CRM PARTIAL with four beats,
 * ownTable crm_contacts and its route; step 6 derives five; step 8 names CRM. Ruling E: no backfill in code.
 *
 *   T1 contactKeyOf — the three shapes, four refusals by name; every key contactsOf builds reads back;
 *   T2 the route, by code scan — getVerifiedEmail before any prisma read (401, then 404, then isAdminUser), every
 *      crm_contacts write carrying user_id from the caller, a proposal/signup key from a non-admin → 404, no client time,
 *      nothing read from proposals.status / owner_notes, not public; and the ownership law's own judge over the file;
 *   T3 the two bodies — the five stage words, the next step's length and null, name/email/business, the field on a miss;
 *   T4 the section — the select with the five words and the input with the row's next step, both in CONTROL.input; the add
 *      row's three labels and two buttons; the words typed once; the failed line's seat; the re-read after every write;
 *   T5 /owner — no Proposals section, no fetch of /api/owner/proposals; the two route files gone; the menu's entry; the
 *      laws' lists and the seed; the schema's two notes on their own lines; nothing writes the two columns;
 *   T6 the registry row — PARTIAL, four beats, the why, ownTable and a route that names `.crm_contacts.`; the citation's
 *      lines; step 6's derived words; step 8's comment; the census unchanged.
 *
 * Source is read through code() and comments() only (the reader law). No clock: every instant is a fixture.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { code, comments } from '../sourceText';
import { CRM_NEXT_STEP_MAX, CRM_STAGES, CrmLawError, contactKeyOf, contactsOf, contactsTable, type ContactRow, type WorkingInput } from '../crm/crm';
import { patchContactBody, postContactBody, validationOf } from '../crm/contactWrites';
import {
  ADD_CONTACT_LABELS, ADD_CONTACT_WORDS, ADD_WORDS, CANCEL_WORDS, NO_CONTACTS_OWN_WORDS, STAGE_WORDS, WRITE_FAILED_PREFIX_WORDS, crmWriteFailedWords,
  nextStepAriaWords, stageAriaWords,
} from '../crm/crmWords';
import { CONTROL } from '../ds';
import { EXPECTED_STATUS_COUNTS, TOOL_REGISTRY, ownTableLaw, ownTableLine, registryLaw, statusCounts } from '../toolRegistry';
import { OWNER_UTILITIES } from '../shellMenu';
import { PROBLEM_SHEET } from '../problemSheet';
import { handlerIdentity, inScope, judgeWrites } from '../security/ownershipLaw';
import { AddContactRow, CrmTables, type CrmLoaded } from '@/components/crm/CrmSection';

Object.assign(globalThis, { React });

const ROUTE = 'src/app/api/crm/contacts/route.ts';
const GET_ROUTE = 'src/app/api/crm/route.ts';
const SECTION = 'src/components/crm/CrmSection.tsx';
const OWNER_PAGE = 'src/app/owner/page.tsx';
const LAW = 'scripts/assert-tool-registry.ts';
const SEEDS = 'scripts/proofs/sec02.seeds.ts';
const SHELL_MENU = 'src/lib/shellMenu.ts';
const SCHEMA = 'prisma/schema.prisma';
const REGISTRY = 'src/lib/toolRegistry.ts';
const LANDING = 'src/components/landing/Landing.tsx';

const unescape = (html: string) => html.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const stops = (re: RegExp) => (e: unknown) => e instanceof CrmLawError && re.test(e.message);
const contact = (o: Partial<ContactRow> & { key: string }): ContactRow => ({
  came_in: '2026-11-01T10:00:00.000Z', name: 'Ada Lovelace', business: 'Analytical Engines', email: 'ada@example.com', from: 'proposal', need: 'Setup',
  budget: '$2–10k', start: 'now', stage: 'new', next_step: null, last_touch: null, ...o,
});
const loaded = (contacts: readonly ContactRow[], ownerOnly = false): CrmLoaded => ({ kind: 'loaded', ownerOnly, contacts, proposals: [], signups: [], said: [] });
const renderTables = (contacts: readonly ContactRow[]) => unescape(renderToStaticMarkup(React.createElement(CrmTables, { read: loaded(contacts), onWritten: () => undefined })));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === '__tests__' ? [] : sourceFiles(full);
    return /\.tsx?$/.test(name) ? [full.slice(process.cwd().length + 1)] : [];
  });
}

// ── T1 · THE KEY ────────────────────────────────────────────────────────────

test('T1 contactKeyOf: the three shapes read back; four refusals by name; every key contactsOf builds reads back to its source', () => {
  assert.deepEqual(contactKeyOf('proposal:00000000-0000-4000-8000-0000000000b2'), { source: 'proposal', ref: '00000000-0000-4000-8000-0000000000b2' });
  assert.deepEqual(contactKeyOf('signup:crm01a-member'), { source: 'signup', ref: 'crm01a-member' });
  assert.deepEqual(contactKeyOf('manual:0aa624f3-86e1-47c9-9bb4-3cee2e13e219'), { source: 'manual', ref: '0aa624f3-86e1-47c9-9bb4-3cee2e13e219' });
  assert.throws(() => contactKeyOf(''), stops(/contactKeyOf: the key is empty — a row is named "<source>:<id>"/));
  assert.throws(() => contactKeyOf('proposal'), stops(/contactKeyOf: "proposal" has no colon/));
  assert.throws(() => contactKeyOf('lead:abc'), stops(/contactKeyOf: "lead" is not a source — proposal, signup, manual/));
  assert.throws(() => contactKeyOf('signup:'), stops(/contactKeyOf: "signup:" names no row — the id after the colon is empty/));
  const working: WorkingInput[] = [{ id: 'w-1', source: 'manual', source_ref: null, name: 'Barbara Liskov', business: null, email: 'barbara@example.com', stage: 'sent', next_step: null, last_touch_at: null, created_at: '2026-11-04T08:00:00.000Z' }];
  const rows = contactsOf({
    proposals: [{ id: 'p-1', created_at: '2026-11-01T10:00:00.000Z', name: 'Ada', email: 'ada@example.com', business: 'AE', need: 'setup', need_words: 'Setup', modules: [], start_window: 'now', budget_range: '<$2k', current_stack: '', hard_deadline: null, deadline_driver: null, links: null, team_size: null, referral_source: null, notes_from_them: '' }],
    signups: [{ id: 'u-1', created_at: '2026-11-02T10:00:00.000Z', name: 'Grace', email: 'grace@example.com', signed_up_with: 'github', email_verified_at: null, plan: 'Free' }],
    working,
    today: '2026-11-07',
  });
  assert.deepEqual(rows.map((r) => [contactKeyOf(r.key).source, contactKeyOf(r.key).ref]), [['manual', 'w-1'], ['signup', 'u-1'], ['proposal', 'p-1']]);
  for (const r of rows) assert.equal(contactKeyOf(r.key).source, r.from);
  // a manual working row with no name or no email contradicts crm_contacts_manual_chk — named, never a blank on the row
  assert.throws(() => contactsOf({ proposals: [], signups: [], working: [{ ...working[0], name: null }], today: '2026-11-07' }), stops(/working row w-1 was added by hand with no name — crm_contacts_manual_chk forbids it/));
  assert.throws(() => contactsOf({ proposals: [], signups: [], working: [{ ...working[0], email: null }], today: '2026-11-07' }), stops(/working row w-1 was added by hand with no email/));
});

// ── T2 · THE ROUTE ──────────────────────────────────────────────────────────

test('T2 the route: the caller first in both handlers, every crm_contacts write scoped to the caller, a non-admin\'s proposal or signup key 404, no client time, not public — and the ownership law\'s own judge passes it with no list entry', () => {
  const r = code(ROUTE);
  const handlers = { PATCH: r.slice(r.indexOf('export async function PATCH('), r.indexOf('export async function POST(')), POST: r.slice(r.indexOf('export async function POST(')) };
  for (const [method, body] of Object.entries(handlers)) {
    const at = (s: string) => { const i = body.indexOf(s); assert.notEqual(i, -1, `${method}: ${s}`); return i; };
    const order = [
      'const userEmail = await getVerifiedEmail();',
      "if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });",
      "const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });",
      "if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });",
      'await request.json()',
    ].map(at);
    assert.deepEqual(order, [...order].sort((a, b) => a - b), `${method}: the cookie, the user, then the body`);
    assert.equal(body.indexOf('prisma.'), at('prisma.users.findFirst('), `${method}: no prisma read before the user`);
    assert.ok(at('await getVerifiedEmail()') < body.indexOf('prisma.'), `${method}: the cookie before any read`);
    assert.match(body, /return NextResponse\.json\(validationOf\(parsed\.error\), \{ status: 400 \}\);/, `${method}: a bad body is 400 with the field`);
  }
  const patch = handlers.PATCH;
  assert.ok(patch.indexOf('const owner = isAdminUser(user.id);') > patch.indexOf("{ status: 404 }"), 'isAdminUser after the user, the GET\'s order');
  assert.match(patch, /return NextResponse\.json\(\{ error: 'Validation', field: 'key', message: e\.message \}, \{ status: 400 \}\);/, 'a bad key names its field');
  // whose row: a proposal or signup key is the owner's alone — anyone else 404, never 403; the source row must exist; never the caller's own
  assert.match(patch, /if \(!owner\) return notFound\(\);/);
  assert.doesNotMatch(r, /status: 403/);
  assert.match(patch, /if \(!isValidUuid\(named\.ref\)\) return notFound\(\);/);
  assert.match(patch, /prisma\.proposals\.findUnique\(\{ where: \{ id: named\.ref \}, select: \{ id: true \} \}\);\n\s*if \(!proposal\) return notFound\(\);/);
  assert.match(patch, /if \(named\.ref === user\.id\) return notFound\(\);/);
  assert.match(patch, /prisma\.users\.findUnique\(\{ where: \{ id: named\.ref \}, select: \{ id: true \} \}\);\n\s*if \(!signup\) return notFound\(\);/);
  // every crm_contacts read and write carries user_id = the caller's
  assert.match(patch, /prisma\.crm_contacts\.findFirst\(\{ where: \{ id: named\.ref, user_id: user\.id \}/);
  assert.match(patch, /prisma\.crm_contacts\.updateMany\(\{ where: \{ id: named\.ref, user_id: user\.id \}, data: \{ \.\.\.changed, last_touch_at: now, updated_at: now \} \}\);\n\s*if \(count === 0\) return notFound\(\);/);
  assert.match(patch, /await prisma\.\$transaction\(async \(tx\) => \{/, 'the upsert pair in one transaction');
  assert.match(patch, /tx\.crm_contacts\.findFirst\(\{\n\s*where: \{ user_id: user\.id, source: named\.source, source_ref: named\.ref \},/);
  assert.match(patch, /tx\.crm_contacts\.update\(\{ where: \{ id: found\.id, user_id: user\.id \}, data: \{ \.\.\.changed, last_touch_at: now, updated_at: now \} \}\);/);
  assert.match(patch, /tx\.crm_contacts\.create\(\{\n\s*data: \{ user_id: user\.id, source: named\.source, source_ref: named\.ref, stage: changed\.stage \?\? UNTOUCHED\.stage, next_step: changed\.next_step \?\? UNTOUCHED\.next_step, last_touch_at: now, updated_at: now \},/);
  assert.match(handlers.POST, /prisma\.crm_contacts\.create\(\{\n\s*data: \{ user_id: user\.id, source: 'manual', source_ref: null, name: d\.name, business, email: d\.email, stage: 'new', next_step: null, last_touch_at: null, updated_at: now \},/);
  assert.match(handlers.POST, /return NextResponse\.json\(\{ ok: true, key: `manual:\$\{row\.id\}` \}\);/);
  // a PATCH that changes nothing writes no row
  assert.match(patch, /if \(changed === null\) return NextResponse\.json\(\{ ok: true, key: d\.key \}\);/);
  assert.match(patch, /if \(changed === null\) return;/);
  assert.match(r, /const UNTOUCHED = \{ stage: 'new', next_step: null \} as const;/);
  // the time is the server's: one `new Date()` per handler, nothing from the body
  assert.equal((r.match(/new Date\(\)/g) ?? []).length, 2);
  assert.doesNotMatch(r, /new Date\([^)]|Date\.parse|last_touch_at: d\.|updated_at: d\.|json\.last_touch|json\.updated/);
  // never proposals.status or owner_notes; no backfill
  assert.doesNotMatch(r, /status: true|ownerNotes|owner_notes|proposals\.(update|updateMany|upsert|create)/);
  // reads only its own tables
  assert.deepEqual([...new Set([...r.matchAll(/\b(?:prisma|tx)\.(\w+)\./g)].map((m) => m[1]))].sort(), ['crm_contacts', 'proposals', 'users']);
  // not public, no paid call, no email
  assert.doesNotMatch(code('src/middleware.ts'), /'\/api\/crm/, 'not in PUBLIC_PATHS');
  assert.doesNotMatch(r, /stripe|liteapi|anthropic|openai|resend|sendgrid|fetch\(/i);
  assert.match(r, /export const dynamic = 'force-dynamic';/);
  assert.match(r, /if \(error instanceof AdminConfigError \|\| error instanceof CrmLawError\) return NextResponse\.json\(\{ error: error\.message \}, \{ status: 500 \}\);/);
  // the ownership law (SEC-02): in scope, identity before the first write, every judged write names the caller — no list entry
  assert.ok(inScope(r));
  for (const h of handlerIdentity(r)) assert.ok(h.identityAt !== null && (h.firstWriteAt === null || h.identityAt < h.firstWriteAt), `${h.method} proves who is asking first`);
  const judged = judgeWrites(r);
  assert.equal(judged.length, 2, 'two WHERE writes: updateMany and update');
  for (const v of judged) assert.ok(v.ok && v.how === 'caller', `${v.site.model}.${v.site.op}:${v.site.line} names the caller in its WHERE`);
  assert.doesNotMatch(code(LAW), /api\/crm\/contacts/, 'no allowlist entry for the route');
});

// ── T3 · THE BODIES ─────────────────────────────────────────────────────────

test('T3 the bodies: the five stage words, a next step of at most 2000 or null, at least one of the two; name 1–255, the form\'s email, business ≤ 5000 or absent — a miss names its field', () => {
  const field = (schema: typeof patchContactBody | typeof postContactBody, body: unknown): string | null => {
    const p = schema.safeParse(body);
    return p.success ? null : validationOf(p.error).field;
  };
  for (const stage of CRM_STAGES) assert.equal(field(patchContactBody, { key: 'manual:x', stage }), null, stage);
  assert.deepEqual(Object.keys(STAGE_WORDS), [...CRM_STAGES], 'the select\'s words, one per stage, in order');
  assert.deepEqual(Object.values(STAGE_WORDS), ['New', 'Reviewing', 'Sent', 'Won', 'Lost']);
  assert.equal(field(patchContactBody, { key: 'manual:x', next_step: null }), null, 'an empty box saves null');
  assert.equal(field(patchContactBody, { key: 'manual:x', next_step: 'a'.repeat(CRM_NEXT_STEP_MAX) }), null);
  assert.equal(field(patchContactBody, { key: 'manual:x', stage: 'won', next_step: 'Invoice sent' }), null, 'both at once');
  assert.equal(CRM_NEXT_STEP_MAX, 2000);
  assert.equal(field(patchContactBody, { key: 'manual:x' }), 'stage', 'neither present');
  assert.equal(field(patchContactBody, { key: 'manual:x', stage: 'archived' }), 'stage');
  assert.equal(field(patchContactBody, { key: 'manual:x', next_step: 'a'.repeat(CRM_NEXT_STEP_MAX + 1) }), 'next_step');
  assert.equal(field(patchContactBody, { key: 'manual:x', next_step: 7 }), 'next_step');
  assert.equal(field(patchContactBody, { key: '', stage: 'new' }), 'key');
  assert.equal(field(patchContactBody, { stage: 'new' }), 'key');
  assert.equal(field(patchContactBody, { key: 'manual:x', stage: 'new', last_touch_at: '2026-01-01' }), 'body', 'nothing from the client names the time — an unknown field is refused');
  assert.deepEqual(postContactBody.parse({ name: '  Ada Lovelace ', email: ' ada@example.com ' }), { name: 'Ada Lovelace', email: 'ada@example.com' });
  assert.equal(field(postContactBody, { name: 'Ada', email: 'ada@example.com', business: 'x'.repeat(5000) }), null);
  assert.equal(field(postContactBody, { name: '', email: 'ada@example.com' }), 'name');
  assert.equal(field(postContactBody, { name: ' ', email: 'ada@example.com' }), 'name', 'blank after trim');
  assert.equal(field(postContactBody, { name: 'x'.repeat(256), email: 'ada@example.com' }), 'name');
  assert.equal(field(postContactBody, { name: 'Ada', email: 'nope' }), 'email');
  assert.equal(field(postContactBody, { name: 'Ada', email: 'ada@example.com', business: 'x'.repeat(5001) }), 'business');
  assert.equal(field(postContactBody, { name: 'Ada', email: 'ada@example.com', stage: 'won' }), 'body', 'a stage cannot be set at birth');
  // the copied shapes name their source, and the source still holds them
  assert.match(comments('src/lib/crm/contactWrites.ts'), /COPIED from src\/app\/api\/proposals\/route\.ts:46-47/);
  const proposals = code('src/app/api/proposals/route.ts').split('\n');
  assert.match(proposals[45], /name: z\.string\(\)\.trim\(\)\.min\(1\)\.max\(255\),/);
  assert.match(proposals[46], /email: z\.string\(\)\.trim\(\)\.email\(\)\.max\(255\),/);
});

// ── T4 · THE SECTION ────────────────────────────────────────────────────────

test('T4 the section: the Stage select with the five words and the Next step input with the row\'s next step, both in CONTROL.input; the add row\'s three labels; the words typed once; the failed line; the re-read after every write', () => {
  const html = renderTables([contact({ key: 'proposal:p-1', stage: 'reviewing', next_step: 'Send the quote' }), contact({ key: 'signup:u-1', name: 'Grace Hopper', email: 'grace@example.com', from: 'signup', business: null, need: 'Signed up — Free', budget: null, start: null })]);
  const select = html.slice(html.indexOf('<select'), html.indexOf('</select>'));
  assert.match(select, /data-crm-stage="proposal:p-1"/);
  assert.match(select, /aria-label="Stage of Ada Lovelace"/);
  assert.ok(select.includes(`class="${CONTROL.input}"`), 'the house\'s one field class — ds.ts has no select class (ruling B, corrected)');
  assert.deepEqual([...select.matchAll(/<option value="(\w+)"[^>]*>([^<]*)<\/option>/g)].map((m) => [m[1], m[2]]), CRM_STAGES.map((s) => [s, STAGE_WORDS[s]]), 'the five words, in order');
  assert.match(select, /<option value="reviewing" selected="">Reviewing<\/option>/, 'the row\'s stage picked');
  assert.equal((html.match(/<select/g) ?? []).length, 2, 'one select per contact row');
  assert.match(html, /aria-label="Stage of Grace Hopper"/);
  const input = html.slice(html.indexOf('<input'), html.indexOf('/>', html.indexOf('<input')));
  assert.match(input, /type="text"/);
  assert.ok(input.includes(`class="${CONTROL.input} w-full min-w-[16rem]"`));
  assert.match(input, /value="Send the quote"/);
  assert.match(input, /maxLength="2000"/);
  assert.match(input, /aria-label="Next step for Ada Lovelace"/);
  assert.match(input, /data-crm-next-step="proposal:p-1"/);
  assert.doesNotMatch(select, /disabled/, 'the select is live while nothing saves');
  assert.doesNotMatch(input, /disabled/, 'the input too');
  // the Stage column's words in the table, the CSV and the filters are STAGE_WORDS — the select shows the same
  const stage = contactsTable().find((c) => c.key === 'stage');
  assert.ok(stage);
  assert.equal(stage.words(contact({ key: 'x', stage: 'won' })), 'Won');
  assert.equal(stage.csv(contact({ key: 'x', stage: 'won' })), 'Won');
  assert.equal(stage.kind, 'value');
  // "Add a contact" in the Contacts controls row, before the CSV button; the add row closed until it opens
  const controls = html.slice(html.indexOf('data-crm-contacts-controls'), html.indexOf('data-crm-contacts-csv'));
  assert.match(controls, /data-crm-add[^>]*>Add a contact<\/button>/);
  assert.equal(ADD_CONTACT_WORDS, 'Add a contact');
  assert.doesNotMatch(html, /data-crm-add-row/);
  const add = unescape(renderToStaticMarkup(React.createElement(AddContactRow, { disabled: false, onAdd: () => undefined, onCancel: () => undefined })));
  assert.deepEqual([...add.matchAll(/<span class="[^"]*">([^<]*)<\/span>/g)].map((m) => m[1]), ['Name', 'Business', 'Email']);
  assert.deepEqual(Object.values(ADD_CONTACT_LABELS), ['Name', 'Business', 'Email']);
  assert.match(add, /data-crm-add-name[^>]*\/>/);
  assert.match(add, /type="email"[^>]*data-crm-add-email/);
  assert.match(add, /data-crm-add-submit[^>]*>Add<\/button>/);
  assert.match(add, /data-crm-add-cancel[^>]*>Cancel<\/button>/);
  assert.equal((add.match(new RegExp(`class="${CONTROL.input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g')) ?? []).length, 3, 'three inputs, the CONTROL family');
  assert.ok(add.includes(`class="${CONTROL.primaryButton}"`) && add.includes(`class="${CONTROL.ghostButton}"`));
  assert.equal(ADD_WORDS, 'Add');
  assert.equal(CANCEL_WORDS, 'Cancel');
  // the words typed once — crmWords', never the section's
  const s = code(SECTION);
  for (const literal of ['Add a contact', 'Stage of', 'Next step for', 'Not saved', 'Reviewing', 'Cancel', 'Add someone by hand']) {
    assert.ok(!s.includes(`'${literal}`) && !s.includes(`>${literal}`) && !s.includes(`\`${literal}`), `"${literal}" is crmWords', not typed in the section`);
  }
  assert.equal(stageAriaWords('Ada'), 'Stage of Ada');
  assert.equal(nextStepAriaWords('Ada'), 'Next step for Ada');
  assert.equal(WRITE_FAILED_PREFIX_WORDS, 'Not saved — ');
  assert.equal(crmWriteFailedWords('Not found'), 'Not saved — Not found');
  assert.equal(NO_CONTACTS_OWN_WORDS, 'No one yet. Add someone by hand above; your own intake form comes in CRM-02.');
  // the writes: PATCH on a change, POST on Add, through one route; saved on blur or Enter when changed, Escape restores, an empty box saves null
  assert.match(s, /const CRM_CONTACTS_ROUTE = '\/api\/crm\/contacts';/);
  assert.match(s, /sendJson\('PATCH', \{ key, \.\.\.body \}\)/);
  assert.match(s, /sendJson\('POST', \{ name: draft\.name, email: draft\.email, \.\.\.\(business === '' \? \{\} : \{ business \}\) \}\)/);
  assert.match(s, /void patch\(row\.key, \{ stage \}\);/);
  assert.match(s, /onSave=\{\(value\) => void patch\(row\.key, \{ next_step: value \}\)\}/);
  assert.match(s, /const value = trimmed === '' \? null : trimmed;\n\s*if \(value !== row\.next_step\) onSave\(value\);/);
  assert.match(s, /if \(e\.key === 'Enter'\) \{ e\.preventDefault\(\); commit\(\); \}/);
  assert.match(s, /if \(e\.key === 'Escape'\) \{ e\.preventDefault\(\); setDraft\(row\.next_step \?\? ''\); \}/);
  assert.match(s, /onBlur=\{commit\}/);
  assert.ok((s.match(/disabled=\{saving !== null\}/g) ?? []).length >= 3, 'the select, the input and the add row are disabled while saving');
  // a failed write is said under the table with the route's words; the row keeps the server's value — the re-read runs after every write
  assert.match(s, /if \(!res\.ok\) throw new Error\(String\(answer\.message \?\? answer\.error \?\? `HTTP \$\{res\.status\}`\)\);/);
  assert.match(s, /\} catch \(e: unknown\) \{\n\s*setWriteFailed\(e instanceof Error \? e\.message : String\(e\)\);\n\s*return false;\n\s*\} finally \{\n\s*setSaving\(null\);\n\s*setPicked\(null\);\n\s*onWritten\(\);\n\s*\}/);
  assert.match(s, /under=\{writeFailed !== null \? <p [^>]*data-crm-write-failed>\{crmWriteFailedWords\(writeFailed\)\}<\/p> : null\}/);
  assert.match(s, /\}, \[writes\]\);/, 'the read re-runs on every write');
  assert.match(s, /onWritten=\{\(\) => setWrites\(\(n\) => n \+ 1\)\}/);
  assert.match(s, /if \(ok\) setAdding\(false\);/, 'the add row closes on success only');
  assert.doesNotMatch(s, /localStorage|sessionStorage|document\.cookie/);
  assert.doesNotMatch(html, /data-crm-write-failed/, 'no failed line while nothing failed');
});

// ── T5 · /OWNER RETIRES ITS PROPOSALS PANEL ─────────────────────────────────

test('T5 /owner is the accounts console: no Proposals section, no fetch of /api/owner/proposals; the two routes are gone; the menu, the laws\' lists and the seed moved; the schema\'s two notes; nothing writes the two columns', () => {
  const page = code(OWNER_PAGE);
  assert.doesNotMatch(page, /api\/owner\/proposals|ProposalRow|PROPOSAL_STATUSES|saveTriage|statusFilter|ownerNotes|loadProposals/);
  assert.match(page, /fetch\('\/api\/owner\/accounts', \{ credentials: 'include' \}\)/);
  assert.match(page, /<span>Accounts \(/);
  assert.equal((page.match(/<section/g) ?? []).length, 1, 'one section — Accounts');
  for (const gone of ['src/app/api/owner/proposals/route.ts', 'src/app/api/owner/proposals/[id]/route.ts', 'src/app/api/owner/proposals']) assert.ok(!existsSync(resolve(process.cwd(), gone)), `${gone} is gone`);
  assert.ok(existsSync(resolve(process.cwd(), 'src/app/api/owner/accounts/route.ts')), 'the accounts route stays');
  assert.deepEqual(OWNER_UTILITIES.find((u) => u.href === '/owner'), { label: 'Owner · accounts', href: '/owner', why: "the founder's accounts console behind requireAdmin — src/app/api/owner/accounts/route.ts; not a customer's CRM" });
  assert.ok(comments(SHELL_MENU).includes('// CRM-01b (2026-11-07): the CRM owns the stage; /owner is the accounts console — it keeps its door here.'));
  const law = code(LAW);
  assert.match(law, /\{ route: '\/owner', door: 'utilities menu — Owner · accounts \(src\/lib\/shellMenu\.ts OWNER_UTILITIES\)' \},/);
  assert.doesNotMatch(law, /owner\/proposals/);
  assert.match(law, /const SEC02_PINNED = \{ publicWriters: 12, ownerConsole: 5,/);
  assert.match(comments(LAW), /CRM-01b \(2026-11-07\): ownerConsole 6 → 5/);
  const seeds = code(SEEDS);
  assert.doesNotMatch(seeds, /owner\/proposals/);
  assert.match(seeds, /expect: 'ownerConsole holds 6 entries, pinned at 5',/);
  assert.match(comments(SEEDS), /CRM-01b \(2026-11-07\): the anchor was the owner proposals PATCH's entry/);
  // the schema: the two notes on the columns' own lines (no line added — the ONE-FORM-01 way)
  const schemaCode = code(SCHEMA).split('\n');
  const schemaNotes = comments(SCHEMA).split('\n');
  assert.match(schemaCode[1678], /^\s+status\s+String\s+@default\("new"\) @db\.VarChar\(20\)/);
  assert.match(schemaCode[1679], /^\s+ownerNotes\s+String\?\s+@db\.Text @map\("owner_notes"\)/);
  for (const i of [1678, 1679]) assert.match(schemaNotes[i], /CRM-01b \(2026-11-07\): no longer written — the CRM's stage and next step live in crm_contacts; CLEAN rules on dropping/);
  assert.equal(schemaCode.length, 4764, 'no schema line added');
  // nothing writes proposals.status or owner_notes any more; the proposal form leaves them to the DDL defaults
  const files = [...sourceFiles(resolve(process.cwd(), 'src/app')), ...sourceFiles(resolve(process.cwd(), 'src/lib'))];
  for (const f of files) {
    const src = code(f);
    assert.doesNotMatch(src, /\b(?:prisma|tx|db)\.proposals\.(update|updateMany|upsert)\(/, `${f} writes proposals`); // discovery_proposals is another table
    assert.doesNotMatch(src, /ownerNotes/, `${f} names ownerNotes`);
  }
  assert.doesNotMatch(code('src/app/api/proposals/route.ts'), /status: '/, 'the form sets no status — the DDL default rules');
});

// ── T6 · THE REGISTRY, THE DECK ─────────────────────────────────────────────

test('T6 the registry row: CRM PARTIAL with four beats, its why and customer sentence, ownTable crm_contacts and a route that names `.crm_contacts.`; the citation\'s lines; step 6 derives five; step 8 names CRM; the census unchanged', () => {
  const t = TOOL_REGISTRY.find((x) => x.name === 'CRM');
  assert.ok(t);
  assert.equal(t.status, 'PARTIAL', 'four beats never imply LIVE (TRUTH-01)');
  assert.deepEqual(t.beats, { discover: true, decide: true, commit: true, record: true });
  assert.equal(t.home, '/crm');
  assert.equal(t.why, "the people you sell to: every proposal from the platform's form and every signup for the owner, anyone added by hand for every account; a stage and a next step on the row; a customer's own intake form is not built (CRM-02), and nothing is sent from here");
  assert.equal(t.customer, "The people you sell to, in flat tables: set each one's stage and next step, add someone by hand. Not built yet: your own intake form — so today only the platform's own proposal form and signups fill it on their own.");
  assert.equal(t.ownTable, 'crm_contacts');
  const route = /^src\/app\/api\/crm\/contacts\/route\.ts:(\d+) \(crm_contacts\.create — the row a PATCH makes on the first touch, the row a POST adds by hand\)$/.exec(t.ownTableRoute ?? '');
  assert.ok(route, 'the ownTableRoute names the PATCH\'s create line');
  const routeLines = code(ROUTE).split('\n');
  assert.match(routeLines[Number(route[1]) - 1], /await tx\.crm_contacts\.create\(\{/);
  assert.ok(code(ROUTE).includes('.crm_contacts.'), 'the law reads the client accessor in that file');
  assert.deepEqual(ownTableLaw({ schema: code(SCHEMA), codeOf: (f) => (existsSync(resolve(process.cwd(), f)) ? code(f) : null) }), []);
  assert.deepEqual(registryLaw({ throwOnFail: false }), []);
  assert.deepEqual(EXPECTED_STATUS_COUNTS, { LIVE: 5, PARTIAL: 9, NOT_BUILT: 11 }, 'no census change — PARTIAL stays PARTIAL');
  assert.deepEqual(statusCounts(), EXPECTED_STATUS_COUNTS);
  // the four beats, each with file:line that holds what it names
  const n = (re: RegExp): number => { const m = t.citation.match(re); assert.ok(m, String(re)); return Number(m[1]); };
  const lineOf = (file: string, k: number): string => code(file).split('\n')[k - 1] ?? '';
  assert.match(lineOf(GET_ROUTE, n(/^discover: src\/app\/api\/crm\/route\.ts:(\d+) \(GET \/api\/crm/)), /^export async function GET\(/);
  assert.match(lineOf(SECTION, n(/decide: src\/components\/crm\/CrmSection\.tsx:(\d+) \(the Stage select and the Next step input/)), /^\s+<select$/);
  assert.match(lineOf(ROUTE, n(/commit: src\/app\/api\/crm\/contacts\/route\.ts:(\d+) \(PATCH — the caller first/)), /^export async function PATCH\(/);
  assert.match(lineOf(ROUTE, n(/· :(\d+) \(POST — a contact typed by hand/)), /^export async function POST\(/);
  assert.match(lineOf(SECTION, n(/record: src\/components\/crm\/CrmSection\.tsx:(\d+) \(the three tables/)), /name=\{CRM_CONTACTS_TABLE_NAME\}/);
  assert.match(t.citation, /\/owner is the accounts console — its proposals panel and the two \/api\/owner\/proposals routes retired into the CRM \(CRM-01b\)$/);
  // the registry kept its lines: the row sits on :298-303 and every line the deck and the laws cite by number holds
  const reg = code(REGISTRY).split('\n');
  assert.match(reg[297], /^\s+CRM: \{$/);
  assert.match(reg[299], /^\s+ownTable: 'crm_contacts', ownTableRoute: 'src\/app\/api\/crm\/contacts\/route\.ts:\d+ \(crm_contacts\.create/);
  assert.equal(reg.length, 762, '761 lines');
  for (const [k, re] of [[218, /ownTable: 'operations_project_tasks'/], [290, /ownTable: 'operations_stop_records'/], [525, /ownTable: 'journal_entries'/], [531, /ownTable: 'tax_documents'/]] as const) assert.match(reg[k - 1], re, `toolRegistry.ts:${k}`);
  // step 6, derived over the sixteen the deck names: five, in registry order
  const MOVERS = new Set(['Payments', 'Expenses', 'Travel', 'Banking', 'Retirement', 'Brokerage', 'Trade Log', 'Debt', 'Compliance']);
  const sixteen = PROBLEM_SHEET.flatMap(({ tools }) => tools).filter((x) => !MOVERS.has(x));
  assert.equal(sixteen.length, 16);
  assert.equal(ownTableLine(sixteen), 'Today 5 of the sixteen keep their own table: Tasks, Time, CRM, Bookkeeping, Tax. The other 11 don\'t yet. One table for all of them is the blueprint.');
  // step 8's citation comment names CRM's table and route beside the four, and the closing clause is gone
  const s08 = comments(LANDING).split('\n')[1806];
  assert.match(s08, /true per src\/lib\/toolRegistry\.ts:218 ownTable \(Tasks\) · :290 ownTable \(Time\) · :300 ownTable \(CRM\) · :525 ownTable \(Bookkeeping\) · :531 ownTable \(Tax\)/);
  assert.match(s08, /CRM's is src\/app\/api\/crm\/contacts\/route\.ts:(\d+) crm_contacts\.create \(CRM-01b, 2026-11-07\)$/);
  assert.equal(Number(/route\.ts:(\d+) crm_contacts\.create/.exec(s08)![1]), Number(route[1]), 'the deck and the registry name the same line');
  assert.doesNotMatch(s08, /the other built tools keep none of their own/);
  assert.match(code(LANDING).split('\n')[1806], /^\s+s08: /, 'Landing.tsx:1807 is still the s08 line');
});
