import { PrismaClient } from '@prisma/client';

// BigInt JSON serialization — required because our ledger uses BIGINT cents.
// Without this, any API route returning financial data will crash with:
// TypeError: Do not know how to serialize a BigInt
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

declare global {
  var prisma: PrismaClient | undefined;
}

export const prisma = global.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}
