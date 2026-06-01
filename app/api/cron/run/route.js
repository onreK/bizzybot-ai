import { NextResponse } from 'next/server';
import { query } from '@/lib/database.js';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const authHeader = request.headers.get('authorization');
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://bizzybotai.com';
  const startTime = Date.now();

  console.log('⏰ BizzyBot cron run started —', new Date().toISOString());

  // ── Gmail ────────────────────────────────────────────────────────────────
  let gmailResults = [];
  try {
    const connections = await query(
      `SELECT gmail_email FROM gmail_connections WHERE status = 'connected'`
    );

    console.log(`📧 Running Gmail check for ${connections.rows.length} connected account(s)`);

    for (const conn of connections.rows) {
      try {
        const res = await fetch(`${baseUrl}/api/gmail/monitor`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.CRON_SECRET}`
          },
          body: JSON.stringify({ action: 'check', emailAddress: conn.gmail_email })
        });

        const data = await res.json();
        gmailResults.push({
          email: conn.gmail_email,
          success: data.success ?? false,
          processed: data.totalProcessed || 0,
          followupsSent: data.followupsSent || 0,
          error: data.error || null
        });

        console.log(`✅ Gmail ${conn.gmail_email}: processed=${data.totalProcessed || 0}, followups=${data.followupsSent || 0}`);
      } catch (err) {
        console.error(`❌ Gmail ${conn.gmail_email} failed:`, err.message);
        gmailResults.push({ email: conn.gmail_email, success: false, error: err.message });
      }
    }
  } catch (err) {
    console.error('❌ Gmail cron query failed:', err.message);
  }

  const summary = {
    success: true,
    ranAt: new Date().toISOString(),
    durationMs: Date.now() - startTime,
    gmail: {
      accounts: gmailResults.length,
      totalProcessed: gmailResults.reduce((n, r) => n + (r.processed || 0), 0),
      totalFollowupsSent: gmailResults.reduce((n, r) => n + (r.followupsSent || 0), 0),
      results: gmailResults
    }
  };

  console.log('⏰ Cron run complete —', summary.durationMs + 'ms');
  return NextResponse.json(summary);
}

// Health check
export async function GET() {
  return NextResponse.json({ status: 'BizzyBot cron endpoint active' });
}
