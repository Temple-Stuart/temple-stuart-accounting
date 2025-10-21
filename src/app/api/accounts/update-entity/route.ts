import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
export async function POST(request: NextRequest) {
try {
const { accountId, entityType } = await request.json();
if (!accountId || !entityType) {
  return NextResponse.json(
    { error: 'Missing accountId or entityType' },
    { status: 400 }
  );
}

const validTypes = ['personal', 'business', 'trading', 'retirement'];
if (!validTypes.includes(entityType)) {
  return NextResponse.json(
    { error: 'Invalid entity type' },
    { status: 400 }
  );
}

await prisma.accounts.update({
  where: { id: accountId },
  data: { entityType }
});

return NextResponse.json({ success: true });
} catch (error) {
console.error('Error updating entity type:', error);
return NextResponse.json(
{ error: 'Failed to update entity type' },
{ status: 500 }
);
} finally {
await prisma.$disconnect();
}
}
