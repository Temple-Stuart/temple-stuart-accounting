import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
export async function GET(request: NextRequest) {
try {
const items = await prisma.plaid_items.findMany();
return NextResponse.json(items);
} catch (error: any) {
console.error('Error fetching items:', error);
return NextResponse.json({
error: error.message
}, { status: 500 });
} finally {
await prisma.$disconnect();
}
}
