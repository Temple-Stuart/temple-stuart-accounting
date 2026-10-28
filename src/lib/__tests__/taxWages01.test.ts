/**
 * TAX-WAGES-01 (Alex, 2026-10-28) — the wizard's forms reach Form 1040: one vocabulary, no silent zero.
 *
 * The rule (src/lib/tax/documentAmounts.ts) is pure and driven here over fixtures shaped as the wizard stores
 * them; the key list (src/lib/tax/documentFields.ts) is checked against every reader; the readers are read from
 * source the way this repo proves what it cannot run without a database.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { code } from '../sourceText';
import { ValidationError } from '../errors/ValidationError';
import {
  AMOUNT_BOXES, DOCUMENT_FIELDS, E1098, EARLIER_AMOUNT_KEYS, R1099, T1098, TAX_DOC_TYPES, W2, type TaxDocType,
} from '../tax/documentFields';
import {
  TOTAL_READS, TaxDocumentValueError, blankDeclaredWords, documentTotals, documentWords, readTaxAmount, taxAmount, type TaxDocumentRow,
} from '../tax/documentAmounts';

const FIELDS = 'src/lib/tax/documentFields.ts';
const SERVICE = 'src/lib/form-1040-service.ts';
const CALCULATE = 'src/app/api/tax/calculate/route.ts';
const REPORT = 'src/app/api/tax/report/route.ts';
const DOCS_ROUTE = 'src/app/api/tax/documents/route.ts';
const WIZARD = 'src/components/tax-filing/steps/DocumentsStep.tsx';
const INCOME = 'src/components/tax-filing/steps/IncomeReviewStep.tsx';
const FILE_STEP = 'src/components/tax-filing/steps/FileStep.tsx';
const REVIEW = 'src/components/tax-filing/steps/ReviewStep.tsx';
const EARLIER_FORM = 'src/components/dashboard/TaxReportTab.tsx';
const READERS = [SERVICE, CALCULATE, INCOME, FILE_STEP];

const w2 = (data: unknown, label: string | null = 'Acme'): TaxDocumentRow => ({ doc_type: 'w2', label, data });
const r1099 = (data: unknown, label: string | null = 'Fidelity'): TaxDocumentRow => ({ doc_type: '1099r', label, data });
const t1098 = (data: unknown, label: string | null = 'CSULA'): TaxDocumentRow => ({ doc_type: '1098t', label, data });
const e1098 = (data: unknown, label: string | null = 'Nelnet'): TaxDocumentRow => ({ doc_type: '1098e', label, data });

/** How the reader read before TAX-WAGES-01 (form-1040-service.ts:170-171 on eb36b4ca) — kept here only to show the bug. */
const beforeRead = (data: Record<string, unknown>) => ({ wages: Number(data.wages) || 0, withheld: Number(data.federal_tax_withheld) || 0 });

test('A one vocabulary: the seven types are the route’s; each type’s schema holds every box any reader reads; the wizard and the readers import the keys', () => {
  assert.deepEqual([...TAX_DOC_TYPES], ['w2', '1099r', '1098t', '1098e', '1099b', '1099int', '1099div']);
  assert.match(code(DOCS_ROUTE), /if \(!isTaxDocType\(doc_type\)\) \{/, 'the route’s allowlist is the one list');
  assert.doesNotMatch(code(DOCS_ROUTE), /\['w2', '1099r'/, 'no second allowlist typed');
  for (const t of TAX_DOC_TYPES) {
    for (const key of Object.keys(AMOUNT_BOXES[t])) assert.ok(DOCUMENT_FIELDS[t].includes(key), `${t}: amount box ${key} is in the wizard's schema`);
    for (const key of TOTAL_READS[t] ?? []) assert.ok(key in AMOUNT_BOXES[t], `${t}: the 1040 reads ${key}, an amount box of the schema`);
    for (const key of Object.keys(EARLIER_AMOUNT_KEYS[t])) assert.ok(key in AMOUNT_BOXES[t], `${t}: an earlier key names a real box`);
  }
  // The three types the wizard never writes: no schema, no reader.
  for (const t of ['1099b', '1099int', '1099div'] as const) {
    assert.deepEqual(DOCUMENT_FIELDS[t], []);
    assert.equal(TOTAL_READS[t], undefined);
  }
  // The wizard's schema IS the key list: every FieldDef key is a constant, every amount box derived.
  const wizard = code(WIZARD);
  assert.match(wizard, /import \{ AMOUNT_BOXES, E1098, R1099, T1098, W2 \} from '@\/lib\/tax\/documentFields';/);
  for (const head of ['W2_FIELDS', 'R1099_FIELDS', 'E1098_FIELDS', 'T1098_FIELDS']) {
    const at = wizard.indexOf(`const ${head}: FieldDef[] = [`);
    const block = wizard.slice(at, wizard.indexOf('\n];', at));
    assert.doesNotMatch(block, /key: '/, `${head}: no key typed as a string`);
    assert.doesNotMatch(block, /box: 'Box \d+[a-z]?', type: 'number'/, `${head}: an amount box comes from AMOUNT_BOXES`);
  }
  const keysIn = (obj: Record<string, string>) => Object.values(obj);
  assert.deepEqual(DOCUMENT_FIELDS.w2, keysIn(W2));
  assert.deepEqual(DOCUMENT_FIELDS['1099r'], keysIn(R1099));
  assert.deepEqual(DOCUMENT_FIELDS['1098t'], keysIn(T1098));
  assert.deepEqual(DOCUMENT_FIELDS['1098e'], keysIn(E1098));
});

test('A no key typed twice: outside the key list, no source names a wizard field as a string — the earlier, unmounted form excepted by name', () => {
  const keys = [...new Set(TAX_DOC_TYPES.flatMap((t) => DOCUMENT_FIELDS[t]))];
  const quoted = new RegExp(`'(${keys.join('|')})'|"(${keys.join('|')})"`);
  for (const f of [...READERS, WIZARD, REVIEW, DOCS_ROUTE, REPORT, 'src/lib/tax/documentAmounts.ts']) {
    assert.doesNotMatch(code(f), quoted, `${f} types a field key — it imports it from ${FIELDS}`);
  }
  // Every constant a reader names resolves to a key of its form's schema (the compiler holds it too).
  const objects: Record<string, [TaxDocType, Record<string, string>]> = { W2: ['w2', W2], R1099: ['1099r', R1099], T1098: ['1098t', T1098], E1098: ['1098e', E1098] };
  for (const f of READERS) {
    for (const m of code(f).matchAll(/\b(W2|R1099|T1098|E1098)\.([a-zA-Z]+)\b/g)) {
      const [type, obj] = objects[m[1]];
      assert.ok(m[2] in obj && DOCUMENT_FIELDS[type].includes(obj[m[2]]), `${f}: ${m[0]} is a key of the ${type} schema`);
    }
  }
  // The earlier form still types its own keys — it is mounted by nothing; the rule refuses a row it wrote, by name.
  assert.match(code(EARLIER_FORM), /\{ key: 'wages', label: 'Wages \(Box 1\)', type: 'number' \}/);
});

test('B the W-2: the wizard’s keys reach the 1040 — 50,000 and 5,000; before, the same row read as 0 and 0', () => {
  const data = { employer_name: 'Acme', gross_wages: 50000, federal_withheld: 5000 };
  assert.deepEqual(beforeRead(data), { wages: 0, withheld: 0 }, 'the bug: the wizard’s W-2 read as $0');
  const totals = documentTotals([w2(data)]);
  assert.deepEqual(totals.w2, { wages: 50000, withheld: 5000, count: 1 });
  assert.deepEqual(totals.notes, []);
  // Two W-2s sum, to the cent.
  assert.equal(documentTotals([w2(data), w2({ gross_wages: 1234.56, federal_withheld: '100.10' }, 'Beta')]).w2.wages, 51234.56);
});

test('B no silent zero: an unreadable amount is refused by name at 422; a blank box that means none reads 0 and is declared', () => {
  const abc = () => documentTotals([w2({ gross_wages: 'abc', federal_withheld: 5000 })]);
  assert.throws(abc, (e: unknown) => e instanceof TaxDocumentValueError && e instanceof ValidationError && e.status === 422 && e.message === 'W-2 from Acme has no readable Box 1');
  for (const bad of ['1,000', 'NaN', Number.NaN, Number.POSITIVE_INFINITY, true, {}, [5]]) {
    assert.throws(() => readTaxAmount(w2({ gross_wages: bad }), W2.grossWages), TaxDocumentValueError, `${String(bad)} is refused`);
  }
  assert.deepEqual(readTaxAmount(w2({ gross_wages: '50000' }), W2.grossWages), { value: 50000, blank: false });
  for (const blank of [undefined, null, '', '   ']) assert.deepEqual(readTaxAmount(w2({ gross_wages: blank }), W2.grossWages), { value: 0, blank: true });
  // A W-2 without Box 2: 0, and said.
  const noWithheld = documentTotals([w2({ gross_wages: 50000 })]);
  assert.equal(noWithheld.w2.withheld, 0);
  assert.deepEqual(noWithheld.notes, ['W-2 from Acme: Box 2 is blank — read as none']);
  assert.equal(blankDeclaredWords(w2({}), 'Box 2'), 'W-2 from Acme: Box 2 is blank — read as none');
  // A row the earlier form wrote: its figure is neither none nor read.
  assert.throws(() => documentTotals([w2({ wages: 50000, federal_tax_withheld: 5000 })]), (e: unknown) =>
    e instanceof TaxDocumentValueError && e.message === 'W-2 from Acme holds its Box 1 under "wages", a key an earlier form wrote — enter it again in the wizard');
  // A row that holds no fields, or no name.
  assert.throws(() => readTaxAmount(w2(null), W2.grossWages), (e: unknown) => e instanceof TaxDocumentValueError && e.message === 'W-2 from Acme has no readable Box 1');
  assert.equal(documentWords({ doc_type: 'w2', label: '  ' }), 'W-2 (no name)');
  // A reader asking for a box the wizard never writes is the code's fault — not a 422.
  assert.throws(() => readTaxAmount(w2({ wages: 1 }), 'wages'), (e: unknown) => e instanceof Error && !(e instanceof ValidationError) && /not one of its amount boxes/.test(e.message));
  // taxAmount declares only when given a list.
  const notes: string[] = [];
  assert.equal(taxAmount(w2({}), W2.stateWages, notes), 0);
  assert.deepEqual(notes, ['W-2 from Acme: Box 16 is blank — read as none']);
});

test('B the 1099-R: Box 1, 2a and 4 by the wizard’s keys; Box 4 blank reads none and is said; Box 2a blank is not none — refused', () => {
  const full = documentTotals([r1099({ payer_name: 'Fidelity', gross_distribution: 10000, taxable_amount: 8000, federal_withheld: 1000 })]);
  assert.deepEqual(full.r1099, { gross: 10000, taxable: 8000, withheld: 1000, count: 1 });
  const noBox4 = documentTotals([r1099({ gross_distribution: 10000, taxable_amount: 8000 })]);
  assert.equal(noBox4.r1099.withheld, 0);
  assert.deepEqual(noBox4.notes, ['1099-R from Fidelity: Box 4 is blank — read as none']);
  assert.throws(() => documentTotals([r1099({ gross_distribution: 10000, federal_withheld: 1000 })]), (e: unknown) =>
    e instanceof TaxDocumentValueError && e.message === '1099-R from Fidelity has no Box 2a — a blank taxable amount is one the payer did not determine, not none; enter it in the wizard');
  assert.equal(AMOUNT_BOXES['1099r'][R1099.taxableAmount].blankMeansNone, false);
  assert.throws(() => documentTotals([r1099({ gross_distribution: 'abc', taxable_amount: 1 })]), (e: unknown) => e instanceof TaxDocumentValueError && e.message === '1099-R from Fidelity has no readable Box 1');
  assert.throws(() => documentTotals([r1099({ gross_distribution: 1, taxable_amount: 1, federal_tax_withheld: 50 })]), (e: unknown) =>
    e instanceof TaxDocumentValueError && /holds its Box 4 under "federal_tax_withheld"/.test(e.message));
});

test('B the 1098-T and 1098-E: Box 1 is amounts_billed (it read qualified_tuition); a blank Box 5 is none, said; an unreadable one refused', () => {
  const t = documentTotals([t1098({ school_name: 'CSULA', amounts_billed: 6000, scholarships: 1000 })]);
  assert.deepEqual(t.t1098, { tuition: 6000, scholarships: 1000, count: 1 });
  const noBox5 = documentTotals([t1098({ amounts_billed: 6000 })]);
  assert.deepEqual(noBox5.notes, ['1098-T from CSULA: Box 5 is blank — read as none']);
  assert.throws(() => documentTotals([t1098({ amounts_billed: 'abc' })]), (e: unknown) => e instanceof TaxDocumentValueError && e.message === '1098-T from CSULA has no readable Box 1');
  assert.throws(() => documentTotals([t1098({ qualified_tuition: 6000 })]), (e: unknown) => e instanceof TaxDocumentValueError && /under "qualified_tuition"/.test(e.message));
  assert.deepEqual(documentTotals([e1098({ lender_name: 'Nelnet', interest_paid: 820.5 })]).e1098, { interest: 820.5, count: 1 });
});

test('C every reader goes through the rule: the 1040 service, /api/tax/calculate, the Income Review and File steps — no `Number(x) || 0` left in a tax path', () => {
  const service = code(SERVICE);
  assert.match(service, /import \{ documentTotals \} from '\.\/tax\/documentAmounts';/);
  assert.match(service, /const taxDocs = await prisma\.tax_documents\.findMany\(\{\n\s+where: \{ userId, tax_year: taxYear \},\n\s+\}\);\n\s+const docs = documentTotals\(taxDocs\);/);
  assert.match(service, /const w2FromDocs = \{ wages: docs\.w2\.wages, withheld: docs\.w2\.withheld, hasDocs: docs\.w2\.count > 0 \};/);
  assert.match(service, /const docTuition = docs\.t1098\.tuition;/);
  assert.match(service, /const docInterest = docs\.e1098\.interest;/);
  assert.match(service, /documentNotes: docs\.notes,/);
  assert.match(service, /documentNotes: readonly string\[\];/);
  assert.doesNotMatch(service, /getW2FromDocuments|docsByType/);
  const calc = code(CALCULATE);
  assert.match(calc, /const totals = documentTotals\(taxDocs\);/);
  assert.match(calc, /taxAmount\(d, W2\.grossWages\)/);
  assert.match(calc, /taxAmount\(d, R1099\.grossDistribution\)/);
  assert.match(calc, /document_notes: totals\.notes,/);
  assert.match(calc, /return failClosedResponse\('Tax calculate', 'Tax calculate failed', error\);/, 'a refusal (a ValidationError) reaches the customer verbatim through failClosed');
  assert.match(code(REPORT), /if \(error instanceof ValidationError\) return NextResponse\.json\(\{ error: error\.message \}, \{ status: error\.status \}\);/);
  for (const f of [INCOME, FILE_STEP]) {
    assert.match(code(f), /import \{ taxAmount \} from '@\/lib\/tax\/documentAmounts';/);
    assert.doesNotMatch(code(f), /function numField\(|function num\(/);
  }
  assert.match(code(REVIEW), /\{f\.documentNotes\.length > 0 && \(/);
  // No silent zero in any tax path.
  const silent = /(Number|parseFloat)\([^)]*\)\s*\|\|\s*0/;
  for (const f of [SERVICE, CALCULATE, REPORT, DOCS_ROUTE, WIZARD, INCOME, FILE_STEP, REVIEW, FIELDS, 'src/lib/tax/documentAmounts.ts']) {
    assert.doesNotMatch(code(f), silent, `${f} still turns an unreadable value into 0`);
  }
});
