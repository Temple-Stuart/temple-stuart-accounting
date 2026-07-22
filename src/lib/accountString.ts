// ─── DIM-2: the dimensional display string ───────────────────────────────────
// deriveAccountString builds the 'B-5100-10-API'-style ENTITY-ACCOUNT-SUB-OBJECT
// string from STRUCTURED parts. The string is a RENDER, never stored — the
// structured columns (entity FK, code, sub_type, and DIM-3's transaction-level
// object) stay the source of truth (the ruled no-code-string-migration design).
//
// CONTRACT (fail-honest, grounded by the DIM-2 audit):
//   E — from the account's entity_type: personal→P, sole_prop→B, trading→T.
//       ANY OTHER entity_type renders NO letter (partial string), never a
//       guessed one.
//   A — the account code, verbatim (today's flat numeric codes, e.g. '5100').
//   S — sub_type VERBATIM, only when present. Today's real values are category
//       tokens ('investment', 'retirement', 'credit_card', 'loan' —
//       seed-coa-templates.ts:25-29), so strings render like
//       'P-1200-investment'; when the D-TEMPLATE list lands numeric subs, the
//       same function renders 'B-5100-10' with zero changes here.
//   O — the OBJECT segment is TRANSACTION-LEVEL by Alex's spec (FLT/HTL vary
//       under one account), so it arrives as a caller-supplied objectCode at
//       coding time (DIM-3). The account-level `module` column stays dormant
//       (zero writers — DIM-2 audit); a caller MAY pass it if it ever becomes
//       real. Absent → absent.
//
// Partial data → partial string ('B-5100', '5100'), never invented segments.

const ENTITY_LETTER: Record<string, string> = {
  personal: 'P',
  sole_prop: 'B',
  trading: 'T',
};

export interface AccountStringParts {
  /** entities.entity_type ('personal' | 'sole_prop' | 'trading' | other). */
  entityType?: string | null;
  /** chart_of_accounts.code — the one required segment. */
  code: string;
  /** chart_of_accounts.sub_type — rendered verbatim when present. */
  subType?: string | null;
  /** Transaction-level object code (DIM-3) — rendered verbatim when present. */
  objectCode?: string | null;
}

export function deriveAccountString({ entityType, code, subType, objectCode }: AccountStringParts): string {
  const segments: string[] = [];
  const letter = entityType ? ENTITY_LETTER[entityType] : undefined;
  if (letter) segments.push(letter);
  segments.push(code);
  const sub = subType?.trim();
  if (sub) segments.push(sub);
  const obj = objectCode?.trim();
  if (obj) segments.push(obj);
  return segments.join('-');
}
