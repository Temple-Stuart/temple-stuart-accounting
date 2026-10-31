import type { PrismaClient } from '@prisma/client';
import { prismaChartDb } from '@/lib/coa/prismaChartDb';
import type { EntityDb } from './setup';

/**
 * SELL-04 — the Prisma binding of the entity-setup port (setup.ts EntityDb).
 * The route hands a $transaction context in so the entity, its starter chart
 * and the Schedule C mappings land together or not at all.
 */
type Client = Pick<PrismaClient, 'entities' | 'chart_of_accounts' | 'account_tax_mappings' | 'users'>;

const SELECT = { id: true, userId: true, name: true, entity_type: true, is_default: true } as const;

export function prismaEntityDb(client: Client, userId: string): EntityDb {
  return {
    count: (uid) => client.entities.count({ where: { userId: uid } }),
    findByName: (uid, name) => client.entities.findFirst({ where: { userId: uid, name: { equals: name, mode: 'insensitive' } }, select: SELECT }),
    insert: (row) =>
      client.entities.create({
        data: { userId: row.userId, name: row.name, entity_type: row.entity_type, is_default: row.is_default, fiscal_year_start: 1, created_by: row.userId },
        select: SELECT,
      }),
    chart: prismaChartDb(client, userId),
    async insertTaxMapping(row) {
      await client.account_tax_mappings.create({ data: row });
    },
    async markInitialized(uid) {
      await client.users.update({ where: { id: uid }, data: { bookkeeping_initialized: true } });
    },
  };
}
