import type { PrismaClient } from '@prisma/client';
import type { NewSubAccount, SubAccountDb } from './subAccounts';

/**
 * COALEVELS-01 (Alex, 2026-11-27) — the Prisma binding of the sub-account port (subAccounts.ts SubAccountDb), as
 * prismaChartDb.ts binds the chart's. A route hands the client in; the rule never imports prisma. Every read names the
 * caller: a sub-account is read by its user AND its account, never by its account alone.
 */

type Client = Pick<PrismaClient, 'chart_of_sub_accounts'>;

const SELECT = { id: true, userId: true, account_id: true, code: true, name: true, is_archived: true } as const;

export function prismaSubAccountDb(client: Client): SubAccountDb {
  return {
    async listOfAccount(userId, accountId) {
      return client.chart_of_sub_accounts.findMany({ where: { userId, account_id: accountId }, select: SELECT, orderBy: { code: 'asc' } });
    },
    async insert(row: NewSubAccount) {
      return client.chart_of_sub_accounts.create({
        data: { userId: row.userId, account_id: row.account_id, code: row.code, name: row.name, created_by: row.created_by },
        select: SELECT,
      });
    },
  };
}
