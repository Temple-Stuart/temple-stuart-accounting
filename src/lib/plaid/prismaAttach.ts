/**
 * BANK-03 — the Prisma-backed AttachDb. `prismaAttach(prisma)` binds the root
 * client; `transaction()` opens ONE interactive transaction and hands the
 * merge a port bound to it. Every history move is Prisma's own updateMany —
 * no raw SQL touches user financial data.
 */
import type { Prisma, PrismaClient } from '@prisma/client';
import type { AttachAccount, AttachDb, AttachItem, HistoryCounts, SurvivorUpdate } from './attachItem';

type Client = Prisma.TransactionClient;
type Root = PrismaClient;

const ACCOUNT_SELECT = {
  id: true, plaidItemId: true, accountId: true, mask: true, name: true, officialName: true, type: true, subtype: true,
  currentBalance: true, availableBalance: true, isoCurrencyCode: true, accountCode: true, subAccount: true, entityType: true, entity_id: true,
} as const;

const ITEM_SELECT = { id: true, userId: true, itemId: true, institutionId: true, institutionName: true, retired_at: true, createdAt: true } as const;

function bind(client: Client, root: Root | null): AttachDb {
  return {
    async item(userId, itemRowId): Promise<AttachItem | null> {
      return client.plaid_items.findFirst({ where: { id: itemRowId, userId }, select: ITEM_SELECT });
    },
    async liveItemsOfInstitution(userId, institutionId, excludeItemRowId): Promise<AttachItem[]> {
      return client.plaid_items.findMany({
        where: { userId, institutionId, retired_at: null, id: { not: excludeItemRowId } },
        select: ITEM_SELECT,
        orderBy: { createdAt: 'asc' },
      });
    },
    async accountsOfItem(itemRowId): Promise<AttachAccount[]> {
      return client.accounts.findMany({ where: { plaidItemId: itemRowId }, select: ACCOUNT_SELECT, orderBy: { mask: 'asc' } });
    },
    async historyCounts(accountRowId): Promise<HistoryCounts> {
      const [transactions, investment_transactions, bank_reconciliations] = await Promise.all([
        client.transactions.count({ where: { accountId: accountRowId } }),
        client.investment_transactions.count({ where: { accountId: accountRowId } }),
        client.bank_reconciliations.count({ where: { account_id: accountRowId } }),
      ]);
      return { transactions, investment_transactions, bank_reconciliations };
    },
    async historyCountsOfItem(itemRowId): Promise<HistoryCounts> {
      const [transactions, investment_transactions, bank_reconciliations] = await Promise.all([
        client.transactions.count({ where: { accounts: { plaidItemId: itemRowId } } }),
        client.investment_transactions.count({ where: { accounts: { plaidItemId: itemRowId } } }),
        client.bank_reconciliations.count({ where: { account: { plaidItemId: itemRowId } } }),
      ]);
      return { transactions, investment_transactions, bank_reconciliations };
    },
    async reconciliationCollisions(a, b): Promise<number> {
      const key = (r: { entity_id: string; year: number; month: number }) => `${r.entity_id} ${r.year} ${r.month}`;
      const [ra, rb] = await Promise.all([
        client.bank_reconciliations.findMany({ where: { account_id: a }, select: { entity_id: true, year: true, month: true } }),
        client.bank_reconciliations.findMany({ where: { account_id: b }, select: { entity_id: true, year: true, month: true } }),
      ]);
      const seen = new Set(ra.map(key));
      return rb.filter((r) => seen.has(key(r))).length;
    },
    async moveHistory(from, to): Promise<HistoryCounts> {
      const t = await client.transactions.updateMany({ where: { accountId: from }, data: { accountId: to } });
      const i = await client.investment_transactions.updateMany({ where: { accountId: from }, data: { accountId: to } });
      const r = await client.bank_reconciliations.updateMany({ where: { account_id: from }, data: { account_id: to } });
      return { transactions: t.count, investment_transactions: i.count, bank_reconciliations: r.count };
    },
    async deleteAccount(accountRowId): Promise<void> {
      await client.accounts.delete({ where: { id: accountRowId } });
    },
    async updateSurvivor(accountRowId, data: SurvivorUpdate): Promise<void> {
      await client.accounts.update({ where: { id: accountRowId }, data });
    },
    async retireItem(itemRowId, at, reason): Promise<void> {
      await client.plaid_items.update({ where: { id: itemRowId }, data: { retired_at: at, retired_reason: reason } });
    },
    async transaction<T>(fn: (tx: AttachDb) => Promise<T>): Promise<T> {
      if (!root) throw new Error('prismaAttach: a transaction cannot open inside another transaction');
      return root.$transaction(async (tx) => fn(bind(tx, null)), { maxWait: 10_000, timeout: 120_000 });
    },
  };
}

export function prismaAttach(root: Root): AttachDb {
  return bind(root as unknown as Client, root);
}
