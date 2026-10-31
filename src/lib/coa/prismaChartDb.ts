import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type { ChartAccountRow, ChartDb, ChartPatch, NewChartAccount } from './accounts';

/**
 * COA-01 — the Prisma binding of the chart port (accounts.ts ChartDb). A
 * route hands the client (or a $transaction context) in; the policies never
 * import prisma. HYG-04: the reclass posting port is postJournal's `post`
 * (src/lib/posting/postJournal.ts) — no ledger write lives here.
 */

type Client = Pick<PrismaClient, 'chart_of_accounts'>;

const SELECT = {
  id: true, userId: true, entity_id: true, entity_type: true, code: true, name: true,
  account_type: true, balance_type: true, sub_type: true, module: true, settled_balance: true, is_archived: true,
} as const;

type Selected = {
  id: string; userId: string | null; entity_id: string; entity_type: string | null; code: string; name: string;
  account_type: string; balance_type: string; sub_type: string | null; module: string | null; settled_balance: bigint; is_archived: boolean;
};

function row(r: Selected, userId: string): ChartAccountRow {
  return { ...r, userId: r.userId ?? userId };
}

export function prismaChartDb(client: Client, userId: string): ChartDb {
  return {
    async findByCode(uid, entityId, code) {
      const r = await client.chart_of_accounts.findFirst({ where: { userId: uid, entity_id: entityId, code }, select: SELECT });
      return r ? row(r, uid) : null;
    },
    async insert(a: NewChartAccount) {
      const r = await client.chart_of_accounts.create({
        data: {
          id: randomUUID(),
          userId: a.userId,
          entity_id: a.entity_id,
          entity_type: a.entity_type,
          code: a.code,
          name: a.name,
          account_type: a.account_type,
          balance_type: a.balance_type,
          sub_type: a.sub_type,
          module: a.module,
          settled_balance: 0,
          pending_balance: 0,
          version: 0,
          is_archived: false,
        },
        select: SELECT,
      });
      return row(r, userId);
    },
    async update(id, patch: ChartPatch) {
      const r = await client.chart_of_accounts.update({ where: { id }, data: { ...patch, updated_at: new Date() }, select: SELECT });
      return row(r, userId);
    },
  };
}
