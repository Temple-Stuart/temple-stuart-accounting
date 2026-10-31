/**
 * SELL-04 — the runway's operating entities, resolved PER USER (never a
 * constant). Pure: the route hands in the user's own entity rows and the
 * per-entity burn map its user-scoped SQL grouped; this decides who is
 * Personal, who is Business, who is excluded (Trading), and what the rest is.
 *
 *   • personal — the user's default `personal` entity, else their first one;
 *   • business — their first `sole_prop` entity;
 *   • trading  — their first `trading` entity (excluded from operating burn —
 *                the RUNWAY-ENTITY-MODEL decision, unchanged), or none;
 *   • a user with NO operating entity gets the declared setup line — never an
 *     `unattributed` bucket that pretends there is something to attribute;
 *   • with entities present, rows on any other entity id are `unattributed`
 *     (surfaced, never dropped — the invariant Personal + Business +
 *     Unattributed === combined still holds).
 *
 * Nothing here can mix users: the rows come in already scoped by the caller
 * (WHERE "userId" = the viewer), and the ids matched are the viewer's own.
 */

export interface EntityRow {
  id: string;
  entity_type: string;
  is_default: boolean;
}

export interface OperatingEntities {
  personalId: string | null;
  businessId: string | null;
  tradingId: string | null;
}

export function resolveOperatingEntities(rows: readonly EntityRow[]): OperatingEntities {
  const personal = rows.find((r) => r.entity_type === 'personal' && r.is_default) ?? rows.find((r) => r.entity_type === 'personal');
  const business = rows.find((r) => r.entity_type === 'sole_prop');
  const trading = rows.find((r) => r.entity_type === 'trading');
  return { personalId: personal?.id ?? null, businessId: business?.id ?? null, tradingId: trading?.id ?? null };
}

export interface BurnLeg {
  exp: number;
  rev: number;
}

export interface EntityBurnFigure {
  expenses: number;
  income: number;
  netBurnTotal: number;
  netBurnPerMonth: number;
}

export interface BurnAttribution {
  personal: EntityBurnFigure | null;
  business: EntityBurnFigure | null;
  /** Rows on an entity that is neither — only when the user HAS operating entities and the remainder is non-zero. */
  unattributed: EntityBurnFigure | null;
  /** The declared line for a user with no operating entity; null otherwise. */
  setup: string | null;
}

export const RUNWAY_SETUP_LINE = 'Set up your entity in Books — nothing to attribute yet.';

const round2 = (n: number) => Math.round(n * 100) / 100;

export function entityFigure(leg: BurnLeg, months: number): EntityBurnFigure {
  const total = round2(leg.exp - leg.rev);
  return { expenses: leg.exp, income: leg.rev, netBurnTotal: total, netBurnPerMonth: round2(total / months) };
}

export function attributeBurn(byEntity: Readonly<Record<string, BurnLeg>>, ents: OperatingEntities, months: number): BurnAttribution {
  if (ents.personalId === null && ents.businessId === null) {
    return { personal: null, business: null, unattributed: null, setup: RUNWAY_SETUP_LINE };
  }
  const personal = ents.personalId === null ? null : entityFigure(byEntity[ents.personalId] ?? { exp: 0, rev: 0 }, months);
  const business = ents.businessId === null ? null : entityFigure(byEntity[ents.businessId] ?? { exp: 0, rev: 0 }, months);
  let otherExp = 0;
  let otherRev = 0;
  for (const [id, leg] of Object.entries(byEntity)) {
    if (id === ents.personalId || id === ents.businessId) continue;
    otherExp += leg.exp;
    otherRev += leg.rev;
  }
  const rest = entityFigure({ exp: otherExp, rev: otherRev }, months);
  return { personal, business, unattributed: rest.netBurnTotal !== 0 || otherExp !== 0 || otherRev !== 0 ? rest : null, setup: null };
}
