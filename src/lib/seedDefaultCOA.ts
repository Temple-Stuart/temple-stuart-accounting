import { prisma } from './prisma';
import { DEFAULT_COA } from '@/lib/coaDefaults';

export async function seedDefaultCOA(userId: string, entityId: string): Promise<boolean> {
  try {
    // Check if user already has COA for this entity
    const existingCount = await prisma.chart_of_accounts.count({
      where: { userId, entity_id: entityId }
    });

    if (existingCount > 0) {
      return false; // Already has COA
    }

    // Create default COA entries
    for (const account of DEFAULT_COA) {
      // Check compound unique [userId, entity_id, code]
      const existing = await prisma.chart_of_accounts.findFirst({
        where: { userId, entity_id: entityId, code: account.code }
      });

      if (!existing) {
        await prisma.chart_of_accounts.create({
          data: {
            id: crypto.randomUUID(),
            code: account.code,
            name: account.name,
            account_type: account.account_type,
            balance_type: account.account_type === 'revenue' ? 'C' : 'D',
            entity_id: entityId,
            userId,
            settled_balance: 0,
            pending_balance: 0,
            version: 0,
            is_archived: false,
          }
        });
      }
    }

    return true;
  } catch (error) {
    console.error('Failed to seed default COA:', error);
    return false;
  }
}
