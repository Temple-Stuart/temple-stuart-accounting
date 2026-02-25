import { NextResponse } from 'next/server';

// TODO: Rebuild for new schema — bank_reconciliations table has been dropped
export async function GET() {
  return NextResponse.json({ error: 'This endpoint is being rebuilt for the new schema' }, { status: 501 });
}

export async function POST() {
  return NextResponse.json({ error: 'This endpoint is being rebuilt for the new schema' }, { status: 501 });
}
