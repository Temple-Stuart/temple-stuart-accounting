import { NextResponse } from 'next/server';

// closing_periods table was dropped in the schema rebuild.
// Period close functionality will be reimplemented in a future iteration.
export async function POST() {
  return NextResponse.json(
    { error: 'Period close is temporarily disabled during schema rebuild' },
    { status: 501 }
  );
}
