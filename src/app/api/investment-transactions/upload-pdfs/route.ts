import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  // PDF upload feature temporarily disabled
  return NextResponse.json({ 
    error: 'PDF upload temporarily disabled - use Plaid sync instead' 
  }, { status: 501 });
}
