/**
 * HYG-02 — the route-side wrapper for failClosed(): one line in a catch-all,
 * the raw error text stays on the server.
 */
import { NextResponse } from 'next/server';
import { failClosed } from './failClosed';

export function failClosedResponse(stage: string, userMessage: string, err: unknown, status = 500, extra: Record<string, unknown> = {}): NextResponse {
  const failed = failClosed(stage, userMessage, err, status, extra);
  return NextResponse.json(failed.body, { status: failed.status });
}
