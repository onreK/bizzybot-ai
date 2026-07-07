import { NextResponse } from 'next/server';
import { query } from '@/lib/database.js';
import { checkPendingTollfreeVerifications } from '@/lib/tollfree-verification.js';

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
      `SELECT DISTINCT gmail_email FROM gmail_connections WHERE status = 'connected'`
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

        // Retire dead connections so they stop erroring every hour.
        // Reconnecting from the dashboard sets status back to 'connected'.
        if (data.error && /expired|reconnect/i.test(data.error)) {
          await query(
            `UPDATE gmail_connections SET status = 'expired' WHERE gmail_email = $1`,
            [conn.gmail_email]
          ).catch(() => {});
          console.log(`🗑️ Gmail ${conn.gmail_email}: marked expired (token dead) — will skip until reconnected`);
        }

        console.log(`✅ Gmail ${conn.gmail_email}: processed=${data.totalProcessed || 0}, followups=${data.followupsSent || 0}`);
      } catch (err) {
        console.error(`❌ Gmail ${conn.gmail_email} failed:`, err.message);
        gmailResults.push({ email: conn.gmail_email, success: false, error: err.message });
      }
    }
  } catch (err) {
    console.error('❌ Gmail cron query failed:', err.message);
  }

  // ── Outlook ──────────────────────────────────────────────────────────────
  let outlookResults = [];
  try {
    const connections = await query(
      `SELECT DISTINCT outlook_email FROM outlook_connections WHERE status = 'connected'`
    ).catch(() => ({ rows: [] }));

    console.log(`📧 Running Outlook check for ${connections.rows.length} connected account(s)`);

    for (const conn of connections.rows) {
      try {
        const res = await fetch(`${baseUrl}/api/outlook/monitor`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.CRON_SECRET}`
          },
          body: JSON.stringify({ action: 'check', emailAddress: conn.outlook_email })
        });

        const data = await res.json();
        outlookResults.push({
          email: conn.outlook_email,
          success: data.success ?? false,
          processed: data.totalProcessed || 0,
          error: data.error || null
        });

        console.log(`✅ Outlook ${conn.outlook_email}: processed=${data.totalProcessed || 0}`);
      } catch (err) {
        console.error(`❌ Outlook ${conn.outlook_email} failed:`, err.message);
        outlookResults.push({ email: conn.outlook_email, success: false, error: err.message });
      }
    }
  } catch (err) {
    console.error('❌ Outlook cron query failed:', err.message);
  }

  // ── Toll-free verification status ────────────────────────────────────────
  let tfvResults = { checked: 0, approved: 0, rejected: 0 };
  try {
    tfvResults = await checkPendingTollfreeVerifications();
    if (tfvResults.checked > 0) {
      console.log(`📱 TFV check: ${tfvResults.checked} pending, ${tfvResults.approved} approved, ${tfvResults.rejected} rejected`);
    }
  } catch (err) {
    console.error('❌ TFV cron check failed:', err.message);
  }

  const summary = {
    success: true,
    ranAt: new Date().toISOString(),
    durationMs: Date.now() - startTime,
    tollfreeVerifications: tfvResults,
    gmail: {
      accounts: gmailResults.length,
      totalProcessed: gmailResults.reduce((n, r) => n + (r.processed || 0), 0),
      totalFollowupsSent: gmailResults.reduce((n, r) => n + (r.followupsSent || 0), 0),
      results: gmailResults
    },
    outlook: {
      accounts: outlookResults.length,
      totalProcessed: outlookResults.reduce((n, r) => n + (r.processed || 0), 0),
      results: outlookResults
    }
  };

  console.log('⏰ Cron run complete —', summary.durationMs + 'ms');
  return NextResponse.json(summary);
}

// Health check
export async function GET() {
  return NextResponse.json({ status: 'BizzyBot cron endpoint active' });
}
