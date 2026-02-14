import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedClient } from '@/lib/tastytrade';
import { buildBacktestRequest, parseBacktestResponse, type BacktestConfig } from '@/lib/backtest-translator';

const BACKTESTER_BASE = 'https://backtester.vast.tastyworks.com';
const POLL_INTERVAL_MS = 1000;
const MAX_POLL_ATTEMPTS = 60; // Max 60 seconds

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('userEmail')?.value;
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findFirst({ where: { email: userEmail } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const client = await getAuthenticatedClient(user.id);
    if (!client) {
      return NextResponse.json({ error: 'Not connected' }, { status: 401 });
    }

    const body = await request.json();
    const config = body.config as BacktestConfig;
    if (!config || !config.symbol || !config.legs || config.legs.length === 0) {
      return NextResponse.json({ error: 'Invalid backtest configuration' }, { status: 400 });
    }

    // Get the access token
    const token = (client as any).accessToken?.token || (client as any).accessToken;
    if (!token) {
      return NextResponse.json({ error: 'Could not retrieve access token' }, { status: 500 });
    }

    const reqBody = buildBacktestRequest(config);

    // Create the backtest
    const createResp = await fetch(`${BACKTESTER_BASE}/backtests`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reqBody),
    });

    if (!createResp.ok) {
      const text = await createResp.text();
      console.error('[Backtest] Create failed:', createResp.status, text);
      return NextResponse.json({ error: 'Failed to create backtest', details: text }, { status: createResp.status });
    }

    const createData = await createResp.json();
    const backtestId = createData['id'] || createData['backtest-id'];

    if (!backtestId) {
      // If the response contains the full results already (synchronous response)
      if (createData['trades'] || createData['results'] || createData['summary']) {
        const result = parseBacktestResponse(createData, config);
        return NextResponse.json({ result });
      }
      return NextResponse.json({ error: 'No backtest ID returned' }, { status: 500 });
    }

    // Poll for completion
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));

      const pollResp = await fetch(`${BACKTESTER_BASE}/backtests/${backtestId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!pollResp.ok) {
        console.error('[Backtest] Poll failed:', pollResp.status);
        continue;
      }

      const pollData = await pollResp.json();
      const status = pollData['status'] || '';

      if (status === 'completed' || status === 'complete' || status === 'done') {
        const result = parseBacktestResponse(pollData, config);
        return NextResponse.json({ result });
      }

      if (status === 'failed' || status === 'error') {
        return NextResponse.json({
          error: 'Backtest failed',
          details: pollData['error'] || pollData['message'] || 'Unknown error',
        }, { status: 500 });
      }

      // Still running, continue polling
    }

    // Timed out
    return NextResponse.json({
      error: 'Backtest timed out',
      backtestId,
      message: 'The backtest is still running. Try again later.',
    }, { status: 408 });

  } catch (error: any) {
    console.error('[Backtest] Run error:', error);
    return NextResponse.json({ error: 'Failed to run backtest' }, { status: 500 });
  }
}
