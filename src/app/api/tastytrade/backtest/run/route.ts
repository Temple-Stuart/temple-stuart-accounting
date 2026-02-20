import { NextResponse } from 'next/server';
import { getTastytradeSessionToken } from '@/lib/tastytrade';
import { buildBacktestRequest, parseBacktestResponse, type BacktestConfig } from '@/lib/backtest-translator';
import { getCurrentUser } from '@/lib/auth-helpers';

const BACKTESTER_BASE = 'https://backtester.vast.tastyworks.com';
const TT_USER_AGENT = 'TempleStuart/1.0';
const POLL_INTERVAL_MS = 1000;
const MAX_POLL_ATTEMPTS = 60; // Max 60 seconds

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const token = await getTastytradeSessionToken();
    console.log('[Backtest Run] Session token obtained, length:', token.length);

    const body = await request.json();
    const config = body.config as BacktestConfig;
    if (!config || !config.symbol || !config.legs || config.legs.length === 0) {
      return NextResponse.json({ error: 'Invalid backtest configuration' }, { status: 400 });
    }

    const reqBody = buildBacktestRequest(config);

    // Create the backtest
    const createUrl = `${BACKTESTER_BASE}/backtests`;
    console.log('[Backtest Run] Calling:', createUrl, 'body:', JSON.stringify(reqBody).slice(0, 300));

    const createResp = await fetch(createUrl, {
      method: 'POST',
      headers: {
        'Authorization': token,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': TT_USER_AGENT,
      },
      body: JSON.stringify(reqBody),
    });

    console.log('[Backtest Run] Create response status:', createResp.status);

    if (!createResp.ok) {
      const text = await createResp.text();
      console.error('[Backtest Run] Create failed:', createResp.status, text.slice(0, 500));
      return NextResponse.json({ error: 'Failed to create backtest', details: text.slice(0, 500) }, { status: createResp.status });
    }

    const createData = await createResp.json();
    console.log('[Backtest Run] Create response body preview:', JSON.stringify(createData).slice(0, 500));

    const backtestId = createData['id'] || createData['backtest-id'];

    if (!backtestId) {
      // If the response contains the full results already (synchronous response)
      if (createData['trades'] || createData['results'] || createData['summary']) {
        const result = parseBacktestResponse(createData, config);
        return NextResponse.json({ result });
      }
      console.error('[Backtest Run] No backtest ID in response');
      return NextResponse.json({ error: 'No backtest ID returned' }, { status: 500 });
    }

    console.log('[Backtest Run] Polling backtest ID:', backtestId);

    // Poll for completion
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));

      const pollUrl = `${BACKTESTER_BASE}/backtests/${backtestId}`;
      const pollResp = await fetch(pollUrl, {
        headers: {
          'Authorization': token,
          'Content-Type': 'application/json',
          'User-Agent': TT_USER_AGENT,
        },
      });

      if (!pollResp.ok) {
        console.error('[Backtest Run] Poll failed:', pollResp.status);
        continue;
      }

      const pollData = await pollResp.json();
      const status = pollData['status'] || '';
      console.log('[Backtest Run] Poll attempt', attempt + 1, 'status:', status);

      if (status === 'completed' || status === 'complete' || status === 'done') {
        const result = parseBacktestResponse(pollData, config);
        console.log('[Backtest Run] Completed with', result.trades.length, 'trades');
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
    console.error('[Backtest Run] Error:', error);
    return NextResponse.json({ error: 'Failed to run backtest' }, { status: 500 });
  }
}
