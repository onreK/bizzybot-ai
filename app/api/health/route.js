import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Railway healthcheck — traffic only switches to a new deploy once this
// returns 200, giving zero-downtime deploys (no more mid-deploy 502s).
export async function GET() {
  return NextResponse.json({ status: 'ok', at: new Date().toISOString() });
}
