import { NextResponse } from 'next/server';

// TODO: Rebuild for new schema — closing_periods table has been dropped
export async function POST() {
  return NextResponse.json({ error: 'This endpoint is being rebuilt for the new schema' }, { status: 501 });
}
