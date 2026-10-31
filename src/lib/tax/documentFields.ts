/**
 * TAX-WAGES-01 (Alex, 2026-10-28, ruling A) — ONE VOCABULARY for a tax document's fields.
 *
 * THE FINDING THIS CLOSES. The tax wizard stores a W-2 as gross_wages and federal_withheld
 * (DocumentsStep.tsx), but the Form 1040 service and /api/tax/calculate read data.wages and
 * data.federal_tax_withheld through `Number(…) || 0` — so a W-2 entered in the wizard came out as
 * line 1 wages $0 and withholding $0, and because a document existed the ledger figure was not used
 * either. The 1099-R's withholding and the 1098-T's tuition had the same split. The readers were
 * written for an earlier form's keys (dashboard/TaxReportTab.tsx DOC_FORM_FIELDS — no page mounts
 * it); the wizard wrote its own.
 *
 * THE RULE. The wizard's keys are canonical — they are what production stores. This file holds
 * them, once: the wizard's field schema (DocumentsStep.tsx) and every reader (form-1040-service.ts,
 * api/tax/calculate, the Income Review and File steps) import them, and no key is typed twice.
 * src/lib/tax/documentAmounts.ts reads an amount by these keys through one rule.
 *
 * THIS FILE IS PURE: no Prisma, no fetch, no React.
 */

/** The seven doc types /api/tax/documents accepts (route.ts validTypes), in its order. */
export const TAX_DOC_TYPES = ['w2', '1099r', '1098t', '1098e', '1099b', '1099int', '1099div'] as const;
export type TaxDocType = (typeof TAX_DOC_TYPES)[number];

/** W-2 — Wage and Tax Statement. */
export const W2 = {
  employerName: 'employer_name',
  employerEin: 'employer_ein',
  grossWages: 'gross_wages',
  federalWithheld: 'federal_withheld',
  socialSecurityWages: 'social_security_wages',
  socialSecurityTax: 'social_security_tax',
  medicareWages: 'medicare_wages',
  medicareTax: 'medicare_tax',
  stateWages: 'state_wages',
  stateWithheld: 'state_withheld',
} as const;

/** 1099-R — Distributions From Pensions, Annuities, Retirement. */
export const R1099 = {
  payerName: 'payer_name',
  grossDistribution: 'gross_distribution',
  taxableAmount: 'taxable_amount',
  federalWithheld: 'federal_withheld',
  distributionCode: 'distribution_code',
  isIraSepSimple: 'is_ira_sep_simple',
} as const;

/** 1098-E — Student Loan Interest Statement. */
export const E1098 = {
  lenderName: 'lender_name',
  interestPaid: 'interest_paid',
} as const;

/** 1098-T — Tuition Statement. */
export const T1098 = {
  schoolName: 'school_name',
  amountsBilled: 'amounts_billed',
  scholarships: 'scholarships',
} as const;

/**
 * Each type's fields — the wizard's schema. 1099-B, 1099-INT and 1099-DIV are accepted by the route
 * but have no wizard form and no reader of their fields: their schema is empty, so no reader may read one.
 */
export const DOCUMENT_FIELDS: Readonly<Record<TaxDocType, readonly string[]>> = {
  w2: Object.values(W2),
  '1099r': Object.values(R1099),
  '1098t': Object.values(T1098),
  '1098e': Object.values(E1098),
  '1099b': [],
  '1099int': [],
  '1099div': [],
};

/**
 * An amount box: the form's box words, and whether the form says a blank box means none.
 * Every box here means none when blank — except the 1099-R's Box 2a: a payer leaves the taxable
 * amount blank when it could not determine it (IRS Instructions for Forms 1099-R, Box 2a and 2b,
 * "Taxable amount not determined"), so a blank Box 2a is unknown, never none.
 */
export interface AmountBox {
  readonly box: string;
  readonly blankMeansNone: boolean;
}

export const AMOUNT_BOXES: Readonly<Record<TaxDocType, Readonly<Record<string, AmountBox>>>> = {
  w2: {
    [W2.grossWages]: { box: 'Box 1', blankMeansNone: true },
    [W2.federalWithheld]: { box: 'Box 2', blankMeansNone: true },
    [W2.socialSecurityWages]: { box: 'Box 3', blankMeansNone: true },
    [W2.socialSecurityTax]: { box: 'Box 4', blankMeansNone: true },
    [W2.medicareWages]: { box: 'Box 5', blankMeansNone: true },
    [W2.medicareTax]: { box: 'Box 6', blankMeansNone: true },
    [W2.stateWages]: { box: 'Box 16', blankMeansNone: true },
    [W2.stateWithheld]: { box: 'Box 17', blankMeansNone: true },
  },
  '1099r': {
    [R1099.grossDistribution]: { box: 'Box 1', blankMeansNone: true },
    [R1099.taxableAmount]: { box: 'Box 2a', blankMeansNone: false },
    [R1099.federalWithheld]: { box: 'Box 4', blankMeansNone: true },
  },
  '1098t': {
    [T1098.amountsBilled]: { box: 'Box 1', blankMeansNone: true },
    [T1098.scholarships]: { box: 'Box 5', blankMeansNone: true },
  },
  '1098e': {
    [E1098.interestPaid]: { box: 'Box 1', blankMeansNone: true },
  },
  '1099b': {},
  '1099int': {},
  '1099div': {},
};

/** The form's own name, for the words. */
export const DOC_WORDS: Readonly<Record<TaxDocType, string>> = {
  w2: 'W-2', '1099r': '1099-R', '1098t': '1098-T', '1098e': '1098-E', '1099b': '1099-B', '1099int': '1099-INT', '1099div': '1099-DIV',
};

/**
 * The keys the earlier, unmounted form (dashboard/TaxReportTab.tsx DOC_FORM_FIELDS) wrote for the same
 * amount box. They are NOT read: a row that holds one while the canonical box is blank is refused by
 * name (documentAmounts.ts) — its figure is not none, and it is not guessed either.
 */
export const EARLIER_AMOUNT_KEYS: Readonly<Record<TaxDocType, Readonly<Record<string, string>>>> = {
  w2: { [W2.grossWages]: 'wages', [W2.federalWithheld]: 'federal_tax_withheld', [W2.stateWithheld]: 'state_tax_withheld' },
  '1099r': { [R1099.federalWithheld]: 'federal_tax_withheld' },
  '1098t': { [T1098.amountsBilled]: 'qualified_tuition' },
  '1098e': {},
  '1099b': {},
  '1099int': {},
  '1099div': {},
};

export function isTaxDocType(t: string): t is TaxDocType {
  return (TAX_DOC_TYPES as readonly string[]).includes(t);
}
